import { NextResponse } from 'next/server';
// Type definitions for schema validation
import { Category } from '../../../../types';
import { createAIProvider, getProviderFromRequest } from '../../../../lib/ai-factory';

const AI_PARSER_PROMPT = `You are a data entry bot for a school management system. Your task is to extract structured information from user messages, photos, or audio recordings about school incidents and activities.

Based on the input provided, extract and return the following information in JSON format:
- category_id: The most appropriate category from the available options
- subcategory: A specific subcategory or type of incident/activity
- location: The specific location where this occurred
- notes: Additional details or description

Be intelligent about interpreting the input. For photos, describe what you see and infer the type of incident. For audio, transcribe and interpret the content. Always provide reasonable defaults if information is unclear.`;

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const message = formData.get('message') as string;
        const photoDataUri = formData.get('photo') as string | null;
        const audioFile = formData.get('audio') as File | null;
        const categories: Category[] = JSON.parse(formData.get('categories') as string);
        
        const providerType = getProviderFromRequest(request);
        const ai = createAIProvider(providerType);

        const validCategoryIds = categories.map(c => c.id);
        let prompt = AI_PARSER_PROMPT;

        // Add category options to prompt
        prompt += `\n\nAvailable categories: ${categories.map(c => `${c.id} (${c.name})`).join(', ')}`;

        if (audioFile) {
            // For audio files, we'd need to handle transcription first
            // This is a simplified approach - in production you'd want proper audio handling
            prompt += `\n\nAudio file provided: ${audioFile.name}`;
        } else if (message) {
            prompt += `\n\nUser message: "${message}"`;
        }

        if (photoDataUri) {
            prompt += `\n\nPhoto provided - please analyze the image content.`;
            // Note: Only Gemini supports images directly in this implementation
            // Other providers would need image analysis preprocessing
        }
        
        const schema = {
            type: "object",
            properties: {
                category_id: { type: "string", enum: validCategoryIds },
                subcategory: { type: "string" },
                location: { type: "string" },
                notes: { type: "string" }
            },
            required: ["category_id", "subcategory", "location", "notes"]
        };

        const parsedJson = await ai.generateStructuredContent(prompt, schema) as { 
            category_id: string; 
            subcategory: string; 
            location: string; 
            notes: string; 
        };
        
        if (!parsedJson.category_id || !validCategoryIds.includes(parsedJson.category_id)) {
            parsedJson.category_id = 'unplanned';
        }
        
        return NextResponse.json(parsedJson);

    } catch (error) {
        console.error("AI Parsing Error on server:", error);
        return NextResponse.json({ error: "Failed to parse message with AI." }, { status: 500 });
    }
}