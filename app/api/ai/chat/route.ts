import { NextResponse } from 'next/server';
// Type definitions for schema validation
import { Activity, User, Category } from '../../../../types';
import { INITIAL_ANALYSIS_PROMPT, CHAT_SYSTEM_INSTRUCTION } from '../../../../lib/prompts';
import { createAIProvider, getProviderFromRequest, getWorkingAIProvider, createAIProviderSafe } from '../../../../lib/ai-factory';
import { AIMessage } from '../../../../lib/ai-providers';
import { prisma } from '../../../../lib/prisma';
import { decrypt } from '../../../../lib/encryption';

const serializeActivitiesForAI = (activities: Activity[], users: User[], allCategories: Category[]): string => {
    if (activities.length === 0) return "[]";
    const serialized = activities.map(act => ({
        id: act.id, staff: users.find(u => u.id === act.user_id)?.name || 'Unknown',
        category: allCategories.find(c => c.id === act.category_id)?.name || act.category_id,
        details: act.subcategory, location: act.location,
        ...(act.notes && { notes: act.notes }),
        has_photo: !!act.photo_url
    }));
    return JSON.stringify(serialized, null, 2);
};

export async function GET(request: Request) {
    return NextResponse.json({
        message: "AI Chat API is running",
        supportedMethods: ["POST"],
        usage: {
            initialSummary: "POST with { message: 'INITIAL_SUMMARY', context: { activities, users, allCategories } }",
            streamingChat: "POST with { history: AIMessage[], message: string, context?: any, stream: true }",
            nonStreamingChat: "POST with { history: AIMessage[], message: string, context?: any, stream: false }"
        },
        availableProviders: await getAvailableProviders()
    });
}

async function getAvailableProviders() {
    try {
        const configurations = await prisma.llmConfiguration.findMany({
            where: {
                isActive: true,
            },
            select: {
                provider: true,
            },
        });
        return configurations.map(c => c.provider);
    } catch (error) {
        console.warn('Failed to get providers from database, falling back to env vars:', error);
        const providers = [];
        if (process.env.CLAUDE_API_KEY && process.env.CLAUDE_API_KEY !== 'test_key_for_development_health_check') {
            providers.push('claude');
        }
        if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'test_key_for_development_health_check') {
            providers.push('gemini');
        }
        if (process.env.DEEPSEEK_API_KEY) {
            providers.push('deepseek');
        }
        if (process.env.KIMI_API_KEY) {
            providers.push('kimi');
        }
        return providers;
    }
}

export async function POST(request: Request) {
    try {
        const { history, message, context, stream = true } = await request.json();
        
        const requestedProvider = getProviderFromRequest(request);

        let apiKey: string | undefined = undefined;

        // Fetch the LLM configuration for the requested provider
        const llmConfig = await prisma.llmConfiguration.findFirst({
            where: {
                provider: requestedProvider,
                isActive: true,
            },
            include: {
                apiKey: true,
            },
        });

        if (llmConfig && llmConfig.apiKey) {
            apiKey = decrypt(llmConfig.apiKey.encryptedKey);
        }
        
        // --- Handle Initial Summary Generation ---
        if (message === "INITIAL_SUMMARY") {
            const { activities, users, allCategories } = context;
            
            try {
                let ai: any = createAIProviderSafe(requestedProvider, apiKey);
                
                if (!ai) {
                    console.log(`Requested provider ${requestedProvider} not available, trying fallback...`);
                    ai = await getWorkingAIProvider(); // This will use env vars, might need adjustment
                }
                
                const textData = serializeActivitiesForAI(activities, users, allCategories);
                let prompt = INITIAL_ANALYSIS_PROMPT;
                if (textData !== "[]") prompt += `\n\nData:\n${textData}`;
                
                const schema = {
                    type: "object",
                    properties: {
                        analysis: { type: "string" },
                        suggestions: { type: "array", items: { type: "string" } }
                    },
                    required: ["analysis", "suggestions"]
                };
                
                const parsedData = await ai.generateStructuredContent(prompt, schema, {
                    maxTokens: 500, // Limit initial summary to 500 tokens
                    temperature: 0.7
                }) as { analysis: string; suggestions: string[] };
                
                const initialHistory: AIMessage[] = [
                    { role: 'user', content: prompt },
                    { role: 'assistant', content: parsedData.analysis }
                ];
                
                return NextResponse.json({ ...parsedData, history: initialHistory });
            } catch (aiError) {
                const totalActivities = activities.length;
                const activeUsers = new Set(activities.map((a: Activity) => a.user_id)).size;
                const categoriesUsed = new Set(activities.map((a: Activity) => a.category_id)).size;
                
                const analysis = `Workload Summary:\n\n` +
                    `• Total Activities: ${totalActivities}\n` +
                    `• Active Team Members: ${activeUsers}\n` +
                    `• Categories in Use: ${categoriesUsed}\n\n` +
                    `${totalActivities === 0 ? 
                        'No activities recorded yet. Start by adding your first activity to begin tracking your team\'s workload.' :
                        'Your team has been actively logging work activities. Review the distribution to identify patterns and optimization opportunities.'
                    }`;
                
                const suggestions = totalActivities === 0 ? [
                    "Add your first activity to start tracking",
                    "Set up categories for different types of work",
                    "Invite team members to begin collaboration"
                ] : [
                    "Review activity distribution across team members",
                    "Identify peak activity periods for resource planning",
                    "Consider creating additional categories for better organization",
                    "Use notes to capture important context for activities"
                ];
                
                const initialHistory: AIMessage[] = [
                    { role: 'user', content: 'Generate initial summary' },
                    { role: 'assistant', content: analysis }
                ];
                
                return NextResponse.json({
                    analysis,
                    suggestions,
                    history: initialHistory,
                    fallback: true,
                    message: "AI services are not available. Showing basic analysis instead."
                });
            }
        }

        // --- Handle Chat (Streaming or Non-Streaming) ---
        try {
            let ai: any = createAIProviderSafe(requestedProvider, apiKey);
            
            if (!ai) {
                console.log(`Requested provider ${requestedProvider} not available, trying fallback...`);
                ai = await getWorkingAIProvider();
            }
            
            // Include context data in chat messages if available
            let contextualizedMessage = message;
            if (context && context.activities && context.users && context.allCategories) {
                const textData = serializeActivitiesForAI(context.activities, context.users, context.allCategories);
                if (textData !== "[]") {
                    contextualizedMessage = `${message}\n\n[Current Dataset Context]:\n${textData}`;
                }
            }
            
            const messages: AIMessage[] = [...history, { role: 'user', content: contextualizedMessage }];
            
            if (stream) {
                // --- Streaming Response with Server-Sent Events ---
                const streamResponse = await ai.generateContentStream(messages, {
                    systemInstruction: CHAT_SYSTEM_INSTRUCTION,
                    maxTokens: 800, // Limit streaming responses to 800 tokens for better UX
                    temperature: 0.7
                });
                
                // Create SSE-formatted stream with length control
                const sseStream = new ReadableStream({
                    async start(controller) {
                        const reader = streamResponse.stream.getReader();
                        const encoder = new TextEncoder();
                        
                        try {
                            // Send initial connection event
                            controller.enqueue(encoder.encode('event: connected\n'));
                            controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));
                            
                            let accumulatedContent = '';
                            let chunkCount = 0;
                            const MAX_CHUNKS = 150; // Prevent runaway responses
                            
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                
                                chunkCount++;
                                if (chunkCount > MAX_CHUNKS) {
                                    console.warn('DeepSeek streaming response exceeded maximum chunks, truncating');
                                    break;
                                }
                                
                                const chunk = new TextDecoder().decode(value);
                                accumulatedContent += chunk;
                                
                                // Additional safety: Stop if accumulated content is too long
                                if (accumulatedContent.length > 4000) {
                                    console.warn('DeepSeek streaming response exceeded maximum length, truncating');
                                    break;
                                }
                                
                                // Send content as SSE
                                controller.enqueue(encoder.encode('event: content\n'));
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                                    type: 'content', 
                                    content: chunk,
                                    accumulated: accumulatedContent 
                                })}\n\n`));
                            }
                            
                            // Send completion event
                            controller.enqueue(encoder.encode('event: complete\n'));
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                                type: 'complete', 
                                fullContent: accumulatedContent 
                            })}\n\n`));
                            
                        } catch (error) {
                            // Send error event
                            controller.enqueue(encoder.encode('event: error\n'));
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                                type: 'error', 
                                error: 'Stream interrupted',
                                message: error instanceof Error ? error.message : String(error)
                            })}\n\n`));
                        } finally {
                            controller.close();
                        }
                    }
                });
                
                return new Response(sseStream, {
                    headers: { 
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Cache-Control'
                    },
                });
            } else {
                // --- Non-Streaming Response ---
                const response = await ai.generateContent(contextualizedMessage, {
                    systemInstruction: CHAT_SYSTEM_INSTRUCTION,
                    maxTokens: 600, // Limit non-streaming responses to 600 tokens 
                    temperature: 0.7
                });
                
                return NextResponse.json({
                    content: response.text,
                    usage: response.usage,
                    history: [...messages, { role: 'assistant', content: response.text }]
                });
            }
        } catch (aiError) {
            if (stream) {
                // Return SSE error for streaming requests
                const errorStream = new ReadableStream({
                    start(controller) {
                        const encoder = new TextEncoder();
                        controller.enqueue(encoder.encode('event: error\n'));
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                            type: 'error',
                            error: 'AI chat services are currently unavailable',
                            message: 'Please check your API key configuration or try again later.'
                        })}\n\n`));
                        controller.close();
                    }
                });
                
                return new Response(errorStream, {
                    headers: { 
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache'
                    },
                });
            } else {
                // Return JSON error for non-streaming requests
                return NextResponse.json({
                    error: "AI chat services are currently unavailable. Please check your API key configuration or try again later.",
                    fallback: true
                }, { status: 503 });
            }
        }

    } catch (error) {
        console.error("AI Chat Error on server:", error);
        
        let errorMessage = "Failed to communicate with AI.";
        let statusCode = 500;
        
        if (error instanceof Error) {
            if (error.message.includes('Unauthorized') || error.message.includes('API key')) {
                errorMessage = "AI service authentication failed. Please check your API key configuration.";
                statusCode = 401;
            } else if (error.message.includes('not configured')) {
                errorMessage = "AI service not configured. Please set up your API keys.";
                statusCode = 503;
            } else if (error.message.includes('API error')) {
                errorMessage = `AI service error: ${error.message}`;
                statusCode = 502;
            }
        }
        
        return NextResponse.json({
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
        }, { status: statusCode });
    }
}