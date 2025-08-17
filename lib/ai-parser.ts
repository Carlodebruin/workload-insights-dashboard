import { Category } from '../types';

interface ParseMessageParams {
    message: string;
    photo?: string; // Base64 encoded string, WITH the data URI prefix
    audioBlob?: Blob | null; // Audio data
    categories: Category[];
}

interface ParsedActivityData {
    category_id: string;
    subcategory: string;
    location: string;
    notes: string;
}

export const parseWhatsAppMessage = async ({
    message,
    photo,
    audioBlob,
    categories
}: ParseMessageParams): Promise<ParsedActivityData> => {
    
    const formData = new FormData();
    formData.append('message', message);
    formData.append('categories', JSON.stringify(categories));

    if (photo) {
        // The photo is a data URI, we can send it as is or convert to blob.
        // Sending as text is simpler for this use case.
        formData.append('photo', photo);
    }

    if (audioBlob) {
        formData.append('audio', audioBlob, 'voice-note.webm');
    }

    const response = await fetch('/api/ai/parse', {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "AI parsing failed on the server.");
    }
    
    return response.json();
};