import { AIProvider, AIMessage, AIResponse, AIStreamResponse } from "../ai-providers";

export class KimiProvider implements AIProvider {
  name = 'kimi';
  displayName = 'Moonshot Kimi';
  private apiKey: string;
  private baseUrl = 'https://api.moonshot.cn/v1';

  constructor() {
    const apiKey = process.env.KIMI_API_KEY;
    if (!apiKey) throw new Error("KIMI_API_KEY not configured");
    this.apiKey = apiKey;
  }

  async generateContent(prompt: string, options?: {
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
    responseFormat?: 'json' | 'text';
  }): Promise<AIResponse> {
    const messages: any[] = [];
    
    if (options?.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }
    
    messages.push({ role: 'user', content: prompt });

    const requestBody = {
      model: 'moonshot-v1-8k',
      messages,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 0.7,
      ...(options?.responseFormat === 'json' && { 
        response_format: { type: 'json_object' }
      }),
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Kimi API error: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || '';

    return {
      text,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      }
    };
  }

  async generateContentStream(messages: AIMessage[], options?: {
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<AIStreamResponse> {
    const openaiMessages: any[] = [];
    
    if (options?.systemInstruction) {
      openaiMessages.push({ role: 'system', content: options.systemInstruction });
    }
    
    openaiMessages.push(...messages.map(msg => ({
      role: msg.role,
      content: msg.content
    })));

    const requestBody = {
      model: 'moonshot-v1-8k',
      messages: openaiMessages,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 0.7,
      stream: true,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Kimi API error: ${response.statusText}`);
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) return;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(new TextEncoder().encode(content));
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } finally {
          controller.close();
        }
      }
    });

    return { stream };
  }

  async generateStructuredContent<T>(prompt: string, schema: any, options?: {
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<T> {
    const jsonPrompt = `${prompt}\n\nPlease respond with valid JSON only that matches this schema: ${JSON.stringify(schema)}`;
    
    const response = await this.generateContent(jsonPrompt, {
      ...options,
      responseFormat: 'json'
    });

    return JSON.parse(response.text);
  }
}