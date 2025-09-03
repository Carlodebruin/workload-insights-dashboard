import { NextResponse } from 'next/server';
// Type definitions for schema validation
import { Activity, User, Category } from '../../../../types';
import { INITIAL_ANALYSIS_PROMPT, CHAT_SYSTEM_INSTRUCTION } from '../../../../lib/prompts';
import { createAIProvider, getProviderFromRequest, getWorkingAIProvider, createAIProviderSafe, getFallbackProvider } from '../../../../lib/ai-factory';
import { AIMessage } from '../../../../lib/ai-providers';
import { withDb } from '../../../../lib/db-wrapper';
import { decrypt } from '../../../../lib/encryption';

// Streaming configuration with environment-based limits
const STREAMING_CONFIG = {
    // Production limits (Vercel serverless constraints)
    production: {
        maxChunks: 2000,  // Increased from 500 to 2000 for longer responses
        maxLength: 30000, // Increased from 10000 to 30000 for longer responses
        chunkSize: 200,
        timeoutMs: 6000
    },
    // Development limits (more generous for testing)
    development: {
        maxChunks: 4000,  // Increased from 1000 to 4000 for longer responses
        maxLength: 50000, // Increased from 20000 to 50000 for longer responses
        chunkSize: 300,
        timeoutMs: 30000
    }
};

// Get current environment configuration
function getStreamingConfig() {
    const isProduction = process.env.NODE_ENV === 'production';
    return isProduction ? STREAMING_CONFIG.production : STREAMING_CONFIG.development;
}

const serializeActivitiesForAI = (activities: Activity[], users: User[], allCategories: Category[]): string => {
    // Priority-based sampling: Ensure all staff members are represented
    const isProduction = process.env.NODE_ENV === 'production';
    const maxActivitiesPerStaff = isProduction ? 5 : 8; // Increased for better context in production
    const maxTotalActivities = isProduction ? 80 : 100; // Increased for comprehensive analysis
    
    // Enhanced staff overview with assignment visibility
    const staffSummary = users.map(user => {
        const userActivities = activities.filter(a => a.user_id === user.id);
        const recentActivity = userActivities
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        
        // Count assigned activities (where this user is assigned_to)
        const assignedActivities = activities.filter(a => a.assigned_to_user_id === user.id);
        
        // Get current assignments (Open/In Progress)
        const currentAssignments = assignedActivities.filter(a =>
            a.status === 'Open' || a.status === 'In Progress'
        );

        return {
            name: user.name,
            role: user.role,
            total_tasks: userActivities.length,
            assigned_tasks: assignedActivities.length,
            current_assignments: currentAssignments.length,
            status: recentActivity ?
                (recentActivity.status === 'In Progress' ? 'Working' :
                 recentActivity.status === 'Open' ? 'Pending' :
                 'Available') : 'Available',
            last_activity: recentActivity ? recentActivity.timestamp.split('T')[0] : null
        };
    });

    // Priority-based activity sampling: Ensure all staff have representation
    const sampledActivities: Activity[] = [];
    const staffActivityCount = new Map<string, number>();
    
    // Initialize count for each staff member
    users.forEach(user => staffActivityCount.set(user.id, 0));
    
    // First pass: Ensure each staff member has at least 1 recent activity
    const recentActivities = activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    for (const activity of recentActivities) {
        if (sampledActivities.length >= maxTotalActivities) break;
        
        const currentCount = staffActivityCount.get(activity.user_id) || 0;
        if (currentCount < maxActivitiesPerStaff) {
            sampledActivities.push(activity);
            staffActivityCount.set(activity.user_id, currentCount + 1);
        }
    }
    
    // Second pass: Fill remaining slots with most recent activities
    if (sampledActivities.length < maxTotalActivities) {
        for (const activity of recentActivities) {
            if (sampledActivities.length >= maxTotalActivities) break;
            if (!sampledActivities.includes(activity)) {
                sampledActivities.push(activity);
            }
        }
    }

    // Enhanced activity data with assignment context
    const activityData = sampledActivities.map(act => {
        const staff = users.find(u => u.id === act.user_id);
        const assignedTo = act.assigned_to_user_id ? users.find(u => u.id === act.assigned_to_user_id) : null;
        const category = allCategories.find(c => c.id === act.category_id);
        
        return {
            id: act.id,
            staff: staff?.name || 'Unknown',
            assigned_to: assignedTo?.name || (act.assigned_to_user_id ? 'Unassigned' : null),
            task: category?.name || 'Other',
            subcategory: act.subcategory,
            location: act.location,
            status: act.status,
            date: act.timestamp.split('T')[0],
            notes: act.notes ? act.notes.substring(0, 100) + (act.notes.length > 100 ? '...' : '') : null
        };
    });

    // Comprehensive context for AI analysis
    const context = {
        team_count: users.length,
        total_activities: activities.length,
        sampled_count: sampledActivities.length,
        sampling_strategy: 'priority-based',
        team: staffSummary,
        activities: activityData,
        data_completeness: {
            staff_representation: Array.from(staffActivityCount.entries()).filter(([_, count]) => count > 0).length / users.length,
            average_activities_per_staff: Array.from(staffActivityCount.values()).reduce((sum, count) => sum + count, 0) / users.length,
            timestamp: new Date().toISOString()
        }
    };

    return JSON.stringify(context);
};

export async function GET(request: Request) {
    return new Response(JSON.stringify({
        message: "AI Chat API is running",
        supportedMethods: ["POST"],
        usage: {
            initialSummary: "POST with { message: 'INITIAL_SUMMARY', context: { activities, users, allCategories } }",
            streamingChat: "POST with { history: AIMessage[], message: string, context?: any, stream: true }",
            nonStreamingChat: "POST with { history: AIMessage[], message: string, context?: any, stream: false }"
        },
        availableProviders: await getAvailableProviders()
    }), {
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control"
        }
    });
}

async function getAvailableProviders() {
    try {
        const configurations = await withDb(async (prisma) => {
            return prisma.llmConfiguration.findMany({
                where: {
                    isActive: true,
                },
                select: {
                    provider: true,
                },
            });
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
                withDb(async (prisma) => {
                    return prisma.llmConfiguration.findFirst({
                        where: {
                            provider: requestedProvider,
                            isActive: true,
                        },
                        include: {
                            apiKey: true,
                        },
                    });
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
                        try {
                            ai = await getWorkingAIProvider(); // This will use env vars, might need adjustment
                        } catch (fallbackError) {
                            console.error('Fallback provider search failed:', fallbackError);
                            // Continue with mock provider
                            ai = null;
                        }
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
                            maxTokens: isProduction ? 800 : 1200, // Increased for better initial summaries
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
                    
                    return new Response(JSON.stringify({ ...parsedData, history: initialHistory }), {
                        headers: {
                            "Content-Type": "application/json",
                            "Cache-Control": "no-cache",
                            "Connection": "keep-alive",
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Headers": "Cache-Control"
                        }
                    });
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
                    
                    return new Response(JSON.stringify({
                        analysis,
                        suggestions,
                        history: initialHistory,
                        fallback: true,
                        message: "AI services are not available. Showing basic analysis instead."
                    }), {
                        headers: {
                            "Content-Type": "application/json",
                            "Cache-Control": "no-cache",
                            "Connection": "keep-alive",
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Headers": "Cache-Control"
                        }
                    });
                }
            }

            // --- Handle Chat (Streaming or Non-Streaming) ---
            // Declare variables outside try block so they're accessible in catch block for fallback
            let contextualizedMessage = message;
            let messages: AIMessage[] = [];
            
            try {
                let ai: any = createAIProviderSafe(requestedProvider, apiKey);
                
                if (!ai) {
                    console.log(`Requested provider ${requestedProvider} not available, trying fallback...`);
                    try {
                        ai = await getWorkingAIProvider();
                    } catch (fallbackError) {
                        console.error('Fallback provider search failed:', fallbackError);
                        // Fallback to mock provider as last resort
                        console.log('Falling back to mock provider');
                        const { MockProvider } = await import('../../../../lib/providers/mock');
                        ai = new MockProvider();
                    }
                }
                
                // Include context data in chat messages if available
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
                
                messages = [...history, { role: 'user', content: contextualizedMessage }];
                
                if (stream) {
                    // --- Streaming Response with Server-Sent Events ---
                    const streamResponse = await Promise.race([
                        ai.generateContentStream(messages, {
                            systemInstruction: CHAT_SYSTEM_INSTRUCTION,
                            maxTokens: isProduction ? 3000 : 4000, // Increased for detailed responses
                            temperature: 0.3 // Lower temp for speed
                        }),
                        new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error('AI streaming timeout')), getStreamingConfig().timeoutMs)
                        )
                    ]);
                    
                    // Enhanced SSE streaming with intelligent chunking and continuation support
                    const sseStream = new ReadableStream({
                        async start(controller) {
                            const reader = streamResponse.stream.getReader();
                            const encoder = new TextEncoder();
                            
                            // Declare variables outside try block for error handling access
                            let accumulatedContent = '';
                            let chunkCount = 0;
                            const config = getStreamingConfig();
                            const MAX_CHUNKS = config.maxChunks;
                            const MAX_LENGTH = config.maxLength;
                            const CHUNK_SIZE = config.chunkSize;
                            let buffer = '';
                            
                            try {
                                // Send initial connection event with configuration info
                                controller.enqueue(encoder.encode('event: connected\n'));
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                    type: 'connected',
                                    config: {
                                        maxChunks: MAX_CHUNKS,
                                        maxLength: MAX_LENGTH,
                                        chunkSize: CHUNK_SIZE
                                    }
                                })}\n\n`));
                                
                                while (true) {
                                    const { done, value } = await reader.read();
                                    if (done) break;
                                    
                                    chunkCount++;
                                    if (chunkCount > MAX_CHUNKS) {
                                        console.warn('[AI Streaming] Response exceeded maximum chunks, truncating with continuation');
                                        // Send continuation token instead of truncating
                                        controller.enqueue(encoder.encode('event: continuation\n'));
                                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                            type: 'continuation',
                                            message: 'Response continues in next message',
                                            accumulatedLength: accumulatedContent.length,
                                            chunkCount: chunkCount
                                        })}\n\n`));
                                        break;
                                    }
                                    
                                    const chunk = new TextDecoder().decode(value);
                                    buffer += chunk;
                                    accumulatedContent += chunk;
                                    
                                    // Intelligent chunking: Send at natural breakpoints
                                    if (buffer.length > CHUNK_SIZE) {
                                        // Look for natural breakpoints (paragraphs, sentences, line breaks)
                                        const breakPoints = [
                                            buffer.lastIndexOf('\n\n'),      // Paragraph breaks
                                            buffer.lastIndexOf('. '),        // Sentence endings
                                            buffer.lastIndexOf('! '),        // Exclamation endings
                                            buffer.lastIndexOf('? '),        // Question endings
                                            buffer.lastIndexOf('\n'),        // Line breaks
                                            Math.floor(buffer.length * 0.8)  // Fallback: 80% of chunk size
                                        ].filter(pos => pos > 0);
                                        
                                        const breakPoint = breakPoints.length > 0 ? Math.max(...breakPoints) : -1;
                                        
                                        if (breakPoint > 0) {
                                            const chunkToSend = buffer.substring(0, breakPoint + 1);
                                            buffer = buffer.substring(breakPoint + 1);
                                            
                                            controller.enqueue(encoder.encode('event: content\n'));
                                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                                type: 'content',
                                                content: chunkToSend,
                                                accumulated: accumulatedContent,
                                                chunkIndex: chunkCount,
                                                totalLength: accumulatedContent.length,
                                                bufferRemaining: buffer.length
                                            })}\n\n`));
                                        }
                                    }
                                    
                                    // Additional safety: Stop if accumulated content is too long
                                    if (accumulatedContent.length > MAX_LENGTH) {
                                        console.warn('[AI Streaming] Response exceeded maximum length, truncating with continuation');
                                        // Send continuation token for extremely long responses
                                        controller.enqueue(encoder.encode('event: continuation\n'));
                                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                            type: 'continuation',
                                            message: 'Response continues in next message',
                                            accumulatedLength: accumulatedContent.length,
                                            chunkCount: chunkCount
                                        })}\n\n`));
                                        break;
                                    }
                                }
                                
                                // Send any remaining buffer content
                                if (buffer.length > 0) {
                                    controller.enqueue(encoder.encode('event: content\n'));
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                        type: 'content',
                                        content: buffer,
                                        accumulated: accumulatedContent,
                                        chunkIndex: chunkCount,
                                        totalLength: accumulatedContent.length
                                    })}\n\n`));
                                }
                                
                                // Send completion event with detailed stats
                                controller.enqueue(encoder.encode('event: complete\n'));
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                    type: 'complete',
                                    fullContent: accumulatedContent,
                                    totalLength: accumulatedContent.length,
                                    chunkCount: chunkCount,
                                    truncated: accumulatedContent.length >= MAX_LENGTH || chunkCount >= MAX_CHUNKS
                                })}\n\n`));
                                
                                // Log streaming performance for monitoring
                                console.log('[AI Streaming] Completed:', {
                                    totalLength: accumulatedContent.length,
                                    chunkCount: chunkCount,
                                    truncated: accumulatedContent.length >= MAX_LENGTH || chunkCount >= MAX_CHUNKS,
                                    timestamp: new Date().toISOString()
                                });
                                
                            } catch (error) {
                                // Enhanced error event with more context
                                controller.enqueue(encoder.encode('event: error\n'));
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                    type: 'error',
                                    error: 'Stream interrupted',
                                    message: error instanceof Error ? error.message : String(error),
                                    accumulatedLength: accumulatedContent ? accumulatedContent.length : 0,
                                    chunkCount: chunkCount
                                })}\n\n`));
                                
                                console.error('[AI Streaming] Error during streaming:', {
                                    error: error instanceof Error ? error.message : String(error),
                                    accumulatedLength: accumulatedContent ? accumulatedContent.length : 0,
                                    chunkCount: chunkCount
                                });
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
                    console.log('[AI Chat] About to generate content with AI provider...');
                    const response = await Promise.race([
                        ai.generateContent(contextualizedMessage, {
                            systemInstruction: CHAT_SYSTEM_INSTRUCTION,
                            maxTokens: isProduction ? 2500 : 3000, // Increased for comprehensive responses
                            temperature: 0.3 // Lower temp for speed
                        }),
                        new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error('AI generation timeout')), isProduction ? 7000 : 25000) // 7s for Vercel
                        )
                    ]);
                    console.log('[AI Chat] AI response received successfully');
                    
                    // Debug logging to see what's being returned
                    console.log('[AI Chat] Non-streaming response received:', {
                        contentLength: response.text.length,
                        hasUsage: !!response.usage,
                        historyLength: messages.length + 1,
                        responseKeys: Object.keys(response)
                    });
                    
                    // Create a simplified response to avoid potential circular references
                    const simplifiedUsage = response.usage ? {
                        promptTokens: response.usage.promptTokens,
                        completionTokens: response.usage.completionTokens,
                        totalTokens: response.usage.totalTokens
                    } : undefined;
                    
                    const result = {
                        content: response.text,
                        usage: simplifiedUsage,
                        history: [...messages, { role: 'assistant', content: response.text }]
                    };
                    
                    console.log('[AI Chat] Final response object prepared:', {
                        contentLength: result.content.length,
                        keys: Object.keys(result),
                        usageKeys: result.usage ? Object.keys(result.usage) : 'none'
                    });
                    
                    console.log('[AI Chat] About to send response...');
                    return new Response(JSON.stringify(result), {
                        headers: {
                            "Content-Type": "application/json",
                            "Cache-Control": "no-cache",
                            "Connection": "keep-alive",
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Headers": "Cache-Control"
                        }
                    });
                }
            } catch (aiError) {
                const error = aiError instanceof Error ? aiError : new Error(String(aiError));
                
                // Try to get a fallback provider for the error
                try {
                    const fallbackProvider = await getFallbackProvider(requestedProvider, error);
                    if (fallbackProvider) {
                        console.log(`Using fallback provider ${fallbackProvider.name} after ${requestedProvider} failed`);
                        
                        if (stream) {
                            // Retry with fallback provider for streaming
                            const streamResponse = await Promise.race([
                                fallbackProvider.generateContentStream(messages, {
                                    systemInstruction: CHAT_SYSTEM_INSTRUCTION,
                                    maxTokens: isProduction ? 3000 : 4000, // Increased for detailed fallback responses
                                    temperature: 0.3
                                }),
                                new Promise<never>((_, reject) =>
                                    setTimeout(() => reject(new Error('AI streaming timeout')), getStreamingConfig().timeoutMs)
                                )
                            ]);
                            
                            // Enhanced SSE streaming with intelligent chunking and continuation support
                            const sseStream = new ReadableStream({
                                async start(controller) {
                                    const reader = streamResponse.stream.getReader();
                                    const encoder = new TextEncoder();
                                    
                                    // Declare variables outside try block for error handling access
                                    let accumulatedContent = '';
                                    let chunkCount = 0;
                                    const config = getStreamingConfig();
                                    const MAX_CHUNKS = config.maxChunks;
                                    const MAX_LENGTH = config.maxLength;
                                    const CHUNK_SIZE = config.chunkSize;
                                    let buffer = '';
                                    
                                    try {
                                        // Send initial connection event with fallback info
                                        controller.enqueue(encoder.encode('event: fallback\n'));
                                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                            type: 'fallback',
                                            originalProvider: requestedProvider,
                                            fallbackProvider: fallbackProvider.name,
                                            error: error.message
                                        })}\n\n`));
                                        
                                        while (true) {
                                            const { done, value } = await reader.read();
                                            if (done) break;
                                            
                                            chunkCount++;
                                            if (chunkCount > MAX_CHUNKS) {
                                                console.warn('[AI Streaming] Response exceeded maximum chunks, truncating with continuation');
                                                // Send continuation token instead of truncating
                                                controller.enqueue(encoder.encode('event: continuation\n'));
                                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                                    type: 'continuation',
                                                    message: 'Response continues in next message',
                                                    accumulatedLength: accumulatedContent.length,
                                                    chunkCount: chunkCount
                                                })}\n\n`));
                                                break;
                                            }
                                            
                                            const chunk = new TextDecoder().decode(value);
                                            buffer += chunk;
                                            accumulatedContent += chunk;
                                            
                                            // Intelligent chunking: Send at natural breakpoints
                                            if (buffer.length > CHUNK_SIZE) {
                                                // Look for natural breakpoints (paragraphs, sentences, line breaks)
                                                const breakPoints = [
                                                    buffer.lastIndexOf('\n\n'),      // Paragraph breaks
                                                    buffer.lastIndexOf('. '),        // Sentence endings
                                                    buffer.lastIndexOf('! '),        // Exclamation endings
                                                    buffer.lastIndexOf('? '),        // Question endings
                                                    buffer.lastIndexOf('\n'),        // Line breaks
                                                    Math.floor(buffer.length * 0.8)  // Fallback: 80% of chunk size
                                                ].filter(pos => pos > 0);
                                                
                                                const breakPoint = breakPoints.length > 0 ? Math.max(...breakPoints) : -1;
                                                
                                                if (breakPoint > 0) {
                                                    const chunkToSend = buffer.substring(0, breakPoint + 1);
                                                    buffer = buffer.substring(breakPoint + 1);
                                                    
                                                    controller.enqueue(encoder.encode('event: content\n'));
                                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                                        type: 'content',
                                                        content: chunkToSend,
                                                        accumulated: accumulatedContent,
                                                        chunkIndex: chunkCount,
                                                        totalLength: accumulatedContent.length,
                                                        bufferRemaining: buffer.length
                                                    })}\n\n`));
                                                }
                                            }
                                            
                                            // Additional safety: Stop if accumulated content is too long
                                            if (accumulatedContent.length > MAX_LENGTH) {
                                                console.warn('[AI Streaming] Response exceeded maximum length, truncating with continuation');
                                                // Send continuation token for extremely long responses
                                                controller.enqueue(encoder.encode('event: continuation\n'));
                                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                                    type: 'continuation',
                                                    message: 'Response continues in next message',
                                                    accumulatedLength: accumulatedContent.length,
                                                    chunkCount: chunkCount
                                                })}\n\n`));
                                                break;
                                            }
                                        }
                                        
                                        // Send any remaining buffer content
                                        if (buffer.length > 0) {
                                            controller.enqueue(encoder.encode('event: content\n'));
                                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                                type: 'content',
                                                content: buffer,
                                                accumulated: accumulatedContent,
                                                chunkIndex: chunkCount,
                                                totalLength: accumulatedContent.length
                                            })}\n\n`));
                                        }
                                        
                                        // Send completion event with detailed stats
                                        controller.enqueue(encoder.encode('event: complete\n'));
                                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                            type: 'complete',
                                            fullContent: accumulatedContent,
                                            totalLength: accumulatedContent.length,
                                            chunkCount: chunkCount,
                                            truncated: accumulatedContent.length >= MAX_LENGTH || chunkCount >= MAX_CHUNKS,
                                            usedFallback: true
                                        })}\n\n`));
                                        
                                        // Log streaming performance for monitoring
                                        console.log('[AI Streaming] Completed with fallback provider:', {
                                            originalProvider: requestedProvider,
                                            fallbackProvider: fallbackProvider.name,
                                            totalLength: accumulatedContent.length,
                                            chunkCount: chunkCount,
                                            truncated: accumulatedContent.length >= MAX_LENGTH || chunkCount >= MAX_CHUNKS,
                                            timestamp: new Date().toISOString()
                                        });
                                        
                                    } catch (fallbackError) {
                                        // Enhanced error event with more context
                                        controller.enqueue(encoder.encode('event: error\n'));
                                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                            type: 'error',
                                            error: 'Stream interrupted during fallback',
                                            message: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
                                            accumulatedLength: accumulatedContent ? accumulatedContent.length : 0,
                                            chunkCount: chunkCount
                                        })}\n\n`));
                                        
                                        console.error('[AI Streaming] Error during fallback streaming:', {
                                            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
                                            accumulatedLength: accumulatedContent ? accumulatedContent.length : 0,
                                            chunkCount: chunkCount
                                        });
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
                            // Retry with fallback provider for non-streaming
                            const response = await Promise.race([
                                fallbackProvider.generateContent(contextualizedMessage, {
                                    systemInstruction: CHAT_SYSTEM_INSTRUCTION,
                                    maxTokens: isProduction ? 2500 : 3000, // Increased for comprehensive fallback responses
                                    temperature: 0.3
                                }),
                                new Promise<never>((_, reject) =>
                                    setTimeout(() => reject(new Error('AI generation timeout')), isProduction ? 7000 : 25000)
                                )
                            ]);
                            
                            return new Response(JSON.stringify({
                                content: response.text,
                                usage: response.usage,
                                history: [...messages, { role: 'assistant', content: response.text }],
                                usedFallback: true,
                                fallbackProvider: fallbackProvider.name
                            }), {
                                headers: {
                                    "Content-Type": "application/json",
                                    "Cache-Control": "no-cache",
                                    "Connection": "keep-alive",
                                    "Access-Control-Allow-Origin": "*",
                                    "Access-Control-Allow-Headers": "Cache-Control"
                                }
                            });
                        }
                    }
                } catch (fallbackError) {
                    console.error('Fallback provider also failed:', fallbackError);
                    // Continue to standard error handling
                }
                
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
                    return new Response(JSON.stringify({
                        error: "AI chat services are currently unavailable. Please check your API key configuration or try again later.",
                        fallback: true
                    }), {
                        headers: {
                            "Content-Type": "application/json",
                            "Cache-Control": "no-cache",
                            "Connection": "keep-alive",
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Headers": "Cache-Control"
                        },
                        status: 503
                    });
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
            
            return new Response(JSON.stringify({
                error: errorMessage,
                details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
            }), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Cache-Control"
                },
                status: statusCode
            });
        }
    };

    try {
        // Execute with overall timeout
        return await Promise.race([requestPromise(), timeoutPromise]);
        
    } catch (error) {
        console.error("AI Chat Error (with timeout handling):", error);
        
        // Handle timeout specifically with better fallback for user experience
        if (error instanceof Error && error.message.includes('timeout')) {
            return new Response(JSON.stringify({
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
            }), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Cache-Control"
                },
                status: 200
            }); // Return 200 instead of 504 to provide useful fallback
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
        
        return new Response(JSON.stringify({
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
        }), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Cache-Control"
            },
            status: statusCode
        });
    }
}