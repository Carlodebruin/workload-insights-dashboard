import { NextResponse } from 'next/server';
// Type definitions for schema validation
import { Activity, User, Category } from '../../../../types';
import { INITIAL_ANALYSIS_PROMPT, CHAT_SYSTEM_INSTRUCTION } from '../../../../lib/prompts';
import { createAIProvider, getProviderFromRequest, getWorkingAIProvider, createAIProviderSafe } from '../../../../lib/ai-factory';
import { AIMessage } from '../../../../lib/ai-providers';

const serializeActivitiesForAI = (activities: Activity[], users: User[], allCategories: Category[]): string => {
    if (activities.length === 0) return "[]";
    const activitiesToProcess = activities.slice(0, 75); 
    const serialized = activitiesToProcess.map(act => ({
        id: act.id, staff: users.find(u => u.id === act.user_id)?.name || 'Unknown',
        category: allCategories.find(c => c.id === act.category_id)?.name || act.category_id,
        details: act.subcategory, location: act.location,
        ...(act.notes && { notes: act.notes.substring(0, 150) }),
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
            chat: "POST with { history: AIMessage[], message: string, context?: any }"
        },
        availableProviders: getAvailableProviders()
    });
}

function getAvailableProviders() {
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

export async function POST(request: Request) {
    try {
        const { history, message, context } = await request.json();
        
        // --- Handle Initial Summary Generation ---
        if (message === "INITIAL_SUMMARY") {
            const { activities, users, allCategories } = context;
            
            // Try to get a working AI provider with fallback
            try {
                // First try user-specified provider, then fallback to any working provider
                let ai: any = null;
                const requestedProvider = getProviderFromRequest(request);
                ai = createAIProviderSafe(requestedProvider);
                
                if (!ai) {
                    console.log(`Requested provider ${requestedProvider} not available, trying fallback...`);
                    ai = getWorkingAIProvider();
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
                
                const parsedData = await ai.generateStructuredContent(prompt, schema) as { analysis: string; suggestions: string[] };
                
                const initialHistory: AIMessage[] = [
                    { role: 'user', content: prompt },
                    { role: 'assistant', content: parsedData.analysis }
                ];
                
                return NextResponse.json({ ...parsedData, history: initialHistory });
            } catch (aiError) {
                // Fallback: Generate basic analysis without AI
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

        // --- Handle Streaming Chat ---
        try {
            // First try user-specified provider, then fallback to any working provider
            let ai: any = null;
            const requestedProvider = getProviderFromRequest(request);
            ai = createAIProviderSafe(requestedProvider);
            
            if (!ai) {
                console.log(`Requested provider ${requestedProvider} not available, trying fallback...`);
                ai = getWorkingAIProvider();
            }
            
            const messages: AIMessage[] = [...history, { role: 'user', content: message }];
            const streamResponse = await ai.generateContentStream(messages, {
                systemInstruction: CHAT_SYSTEM_INSTRUCTION
            });
            
            return new Response(streamResponse.stream, {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
        } catch (aiError) {
            // Fallback for chat: return helpful message
            const fallbackResponse = "AI chat services are currently unavailable. Please check your API key configuration or try again later.";
            
            return new Response(fallbackResponse, {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
        }

    } catch (error) {
        console.error("AI Chat Error on server:", error);
        
        // Provide more specific error messages based on the error type
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