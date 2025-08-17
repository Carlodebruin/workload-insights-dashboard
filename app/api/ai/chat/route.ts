import { NextResponse } from 'next/server';
// Type definitions for schema validation
import { Activity, User, Category } from '../../../../types';
import { INITIAL_ANALYSIS_PROMPT, CHAT_SYSTEM_INSTRUCTION } from '../../../../lib/prompts';
import { createAIProvider, getProviderFromRequest } from '../../../../lib/ai-factory';
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

export async function POST(request: Request) {
    try {
        const providerType = getProviderFromRequest(request);
        const ai = createAIProvider(providerType);

        const { history, message, context } = await request.json();
        
        // --- Handle Initial Summary Generation ---
        if (message === "INITIAL_SUMMARY") {
            const { activities, users, allCategories } = context;
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
        }

        // --- Handle Streaming Chat ---
        const messages: AIMessage[] = [...history, { role: 'user', content: message }];
        const streamResponse = await ai.generateContentStream(messages, {
            systemInstruction: CHAT_SYSTEM_INSTRUCTION
        });
        
        return new Response(streamResponse.stream, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });

    } catch (error) {
        console.error("AI Chat Error on server:", error);
        return NextResponse.json({ error: "Failed to communicate with AI." }, { status: 500 });
    }
}