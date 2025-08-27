import { AIProvider, AIMessage, AIResponse, AIStreamResponse } from "../ai-providers";

export class ClaudeProvider implements AIProvider {
  name = 'claude';
  displayName = 'Anthropic Claude';
  private apiKey: string;
  private baseUrl = 'https://api.anthropic.com/v1';

  constructor(apiKey?: string) {
    const key = apiKey || process.env.CLAUDE_API_KEY?.trim();
    if (!key || key === 'test_key_for_development_health_check') {
      throw new Error("CLAUDE_API_KEY not configured properly. Please set a valid Claude API key in your environment variables or pass it to the constructor.");
    }
    this.apiKey = key;
  }

  async generateContent(prompt: string, options?: {
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
    responseFormat?: 'json' | 'text';
  }): Promise<AIResponse> {
    const messages: any[] = [{ role: 'user', content: prompt }];

    const requestBody = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 0.7,
      messages,
      ...(options?.systemInstruction && { system: options.systemInstruction }),
    };

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.statusText}`);
    }

    const data = await response.json();
    let text = data.content[0]?.text || '';

    // Handle JSON response format
    if (options?.responseFormat === 'json') {
      try {
        JSON.parse(text); // Validate JSON
      } catch {
        // If not valid JSON, wrap in JSON structure
        text = JSON.stringify({ response: text });
      }
    }

    return {
      text,
      usage: {
        promptTokens: data.usage?.input_tokens,
        completionTokens: data.usage?.output_tokens,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      }
    };
  }

  async generateContentStream(messages: AIMessage[], options?: {
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<AIStreamResponse> {
    const claudeMessages = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    const requestBody = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 0.7,
      messages: claudeMessages,
      stream: true,
      ...(options?.systemInstruction && { system: options.systemInstruction }),
    };

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.statusText}`);
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
                  if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                    controller.enqueue(new TextEncoder().encode(parsed.delta.text));
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
    const jsonPrompt = `${prompt}\n\nPlease respond with valid JSON that matches this schema: ${JSON.stringify(schema)}`;
    
    const response = await this.generateContent(jsonPrompt, {
      ...options,
      responseFormat: 'json'
    });

    return JSON.parse(response.text);
  }
}