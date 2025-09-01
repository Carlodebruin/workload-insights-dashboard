import { NextResponse } from 'next/server';
// Type definitions for schema validation
import { Activity, User, Category } from '../../../../types';
import { INITIAL_ANALYSIS_PROMPT, CHAT_SYSTEM_INSTRUCTION } from '../../../../lib/prompts';
import { createAIProvider, getProviderFromRequest, getWorkingAIProvider, createAIProviderSafe } from '../../../../lib/ai-factory';
import { AIMessage } from '../../../../lib/ai-providers';
import { prisma } from '../../../../lib/prisma';
import { decrypt } from '../../../../lib/encryption';

const serializeActivitiesForAI = (activities: Activity[], users: User[], allCategories: Category[]): string => {
    // Ultra-aggressive optimization for Vercel serverless limits
    const isProduction = process.env.NODE_ENV === 'production';
    const maxActivities = isProduction ? 10 : 50; // Even more aggressive for Vercel
    const dayRange = isProduction ? 7 : 30; // Just last week for production
    
    const currentDate = new Date();
    const cutoffDate = new Date(currentDate);
    cutoffDate.setDate(currentDate.getDate() - dayRange);

    // Minimal staff overview for production
    const staffSummary = users.map(user => {
        const userActivities = activities.filter(a => a.user_id === user.id);
        const recentActivity = userActivities
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

        return {
            name: user.name,
            role: user.role,
            total_tasks: userActivities.length,
            status: recentActivity ? 
                (recentActivity.status === 'In Progress' ? 'Working' :
                 recentActivity.status === 'Open' ? 'Pending' :
                 'Available') : 'Available'
        };
    });

    // Ultra-streamlined activity data
    const recentActivities = activities
        .filter(act => new Date(act.timestamp) >= cutoffDate)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, maxActivities)
        .map(act => {
            const staff = users.find(u => u.id === act.user_id);
            const category = allCategories.find(c => c.id === act.category_id);
            
            return {
                staff: staff?.name || 'Unknown',
                task: category?.name || 'Other',
                location: act.location,
                status: act.status,
                date: act.timestamp.split('T')[0]
            };
        });

    // Minimal context for faster processing
    const context = {
        team_count: users.length,
        total_activities: activities.length,
        recent_count: recentActivities.length,
        team: staffSummary,
        recent_tasks: recentActivities
    };

    return JSON.stringify(context);
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
    // Ultra-aggressive timeout for Vercel serverless limits
    const isProduction = process.env.NODE_ENV === 'production';
    const TIMEOUT_MS = isProduction ? 10000 : 45000; // 10s for Vercel, 45s for dev
    
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI request timeout')), TIMEOUT_MS);
    });

    const requestPromise = async () => {
        try {
            const { history, message, context, stream = true } = await request.json();
            
            const requestedProvider = getProviderFromRequest(request);

            let apiKey: string | undefined = undefined;

            // Fetch the LLM configuration for the requested provider with timeout
            const llmConfig = await Promise.race([
                prisma.llmConfiguration.findFirst({
                    where: {
                        provider: requestedProvider,
                        isActive: true,
                    },
                    include: {
                        apiKey: true,
                    },
                }),
                new Promise<null>((_, reject) =>
                    setTimeout(() => reject(new Error('Database query timeout')), isProduction ? 2000 : 5000)
                )
            ]);

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
                    
                    // Debug logging to verify complete data is being sent to AI
                    console.log('[AI Chat] INITIAL_SUMMARY context:', {
                        totalUsers: users.length,
                        totalActivities: activities.length,
                        totalCategories: allCategories.length,
                        userNames: users.map((u: User) => u.name),
                        activityDateRange: activities.length > 0 ? {
                            earliest: activities.reduce((earliest: Activity, act: Activity) =>
                                new Date(act.timestamp) < new Date(earliest.timestamp) ? act : earliest
                            ).timestamp,
                            latest: activities.reduce((latest: Activity, act: Activity) =>
                                new Date(act.timestamp) > new Date(latest.timestamp) ? act : latest
                            ).timestamp
                        } : null
                    });
                    
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
                    
                    const parsedData = await Promise.race([
                        ai.generateStructuredContent(prompt, schema, {
                            maxTokens: isProduction ? 100 : 300, // Ultra-aggressive for Vercel
                            temperature: 0.3 // Lower temperature for faster, more focused responses
                        }),
                        new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error('AI generation timeout')), isProduction ? 7000 : 25000) // 7s for Vercel
                        )
                    ]) as { analysis: string; suggestions: string[] };
                    
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
                    
                    // Debug logging for chat context
                    console.log('[AI Chat] Chat context:', {
                        totalUsers: context.users.length,
                        totalActivities: context.activities.length,
                        userNames: context.users.map((u: User) => u.name),
                        userMessage: message.substring(0, 100) + (message.length > 100 ? '...' : '')
                    });
                    
                    if (textData !== "[]") {
                        contextualizedMessage = `${message}\n\n[Current Dataset Context]:\n${textData}`;
                    }
                }
                
                const messages: AIMessage[] = [...history, { role: 'user', content: contextualizedMessage }];
                
                if (stream) {
                    // --- Streaming Response with Server-Sent Events ---
                    const streamResponse = await Promise.race([
                        ai.generateContentStream(messages, {
                            systemInstruction: CHAT_SYSTEM_INSTRUCTION,
                            maxTokens: isProduction ? 150 : 400, // Ultra-aggressive for Vercel
                            temperature: 0.3 // Lower temp for speed
                        }),
                        new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error('AI streaming timeout')), isProduction ? 6000 : 30000) // 6s for Vercel
                        )
                    ]);
                    
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
                    const response = await Promise.race([
                        ai.generateContent(contextualizedMessage, {
                            systemInstruction: CHAT_SYSTEM_INSTRUCTION,
                            maxTokens: isProduction ? 100 : 300, // Ultra-aggressive for Vercel
                            temperature: 0.3 // Lower temp for speed
                        }),
                        new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error('AI generation timeout')), isProduction ? 7000 : 25000) // 7s for Vercel
                        )
                    ]);
                    
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
    };

    try {
        // Execute with overall timeout
        return await Promise.race([requestPromise(), timeoutPromise]);
        
    } catch (error) {
        console.error("AI Chat Error (with timeout handling):", error);
        
        // Handle timeout specifically with better fallback for user experience
        if (error instanceof Error && error.message.includes('timeout')) {
            return NextResponse.json({
                error: "AI service timed out due to high demand. Here's a basic summary instead:",
                analysis: "Your workload tracking system is active. Review the dashboard for current activity distribution and team assignments. Consider filtering by specific team members or categories to focus your analysis.",
                suggestions: [
                    "Use the filters to narrow down your view",
                    "Check recent activities for current status",
                    "Review team workload distribution",
                    "Try the AI assistant again in a moment"
                ],
                fallback: true,
                timeout: true
            }, { status: 200 }); // Return 200 instead of 504 to provide useful fallback
        }
        
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