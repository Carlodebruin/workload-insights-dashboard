import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIProvider, AIMessage, AIResponse, AIStreamResponse } from "../ai-providers";

export class GeminiProvider implements AIProvider {
  name = 'gemini';
  displayName = 'Google Gemini';
  private client: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'test_key_for_development_health_check') {
      throw new Error("GEMINI_API_KEY not configured properly. Please set a valid Gemini API key in your environment variables.");
    }
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateContent(prompt: string, options?: {
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
    responseFormat?: 'json' | 'text';
  }): Promise<AIResponse> {
    const model = this.client.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      systemInstruction: options?.systemInstruction,
      generationConfig: {
        maxOutputTokens: options?.maxTokens || 4096,
        temperature: options?.temperature || 0.7,
        ...(options?.responseFormat === 'json' && { responseMimeType: "application/json" }),
      }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    return {
      text: response.text(),
      usage: {
        promptTokens: result.response.usageMetadata?.promptTokenCount,
        completionTokens: result.response.usageMetadata?.candidatesTokenCount,
        totalTokens: result.response.usageMetadata?.totalTokenCount,
      }
    };
  }

  async generateContentStream(messages: AIMessage[], options?: {
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<AIStreamResponse> {
    const model = this.client.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      systemInstruction: options?.systemInstruction,
      generationConfig: {
        maxOutputTokens: options?.maxTokens || 4096,
        temperature: options?.temperature || 0.7,
      }
    });

    // Convert messages to Gemini format
    const history = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({ history });
    const lastMessage = messages[messages.length - 1];
    
    const result = await chat.sendMessageStream(lastMessage.content);

    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            controller.enqueue(new TextEncoder().encode(chunkText));
          }
        }
        controller.close();
      }
    });

    return { stream };
  }

  async generateStructuredContent<T>(prompt: string, schema: any, options?: {
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<T> {
    const model = this.client.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      systemInstruction: options?.systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        maxOutputTokens: options?.maxTokens || 4096,
        temperature: options?.temperature || 0.7,
      }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return JSON.parse(response.text());
  }
}