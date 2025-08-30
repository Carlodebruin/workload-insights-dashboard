export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    // Context caching metrics for providers that support it (e.g., DeepSeek)
    cacheMetrics?: {
      cacheHitTokens?: number;
      cacheMissTokens?: number;
      cacheHitRate?: number; // Calculated percentage
    };
  };
}

export interface AIStreamResponse {
  stream: ReadableStream<Uint8Array>;
}

export interface AIProvider {
  name: string;
  displayName: string;
  generateContent(prompt: string, options?: {
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
    responseFormat?: 'json' | 'text';
  }): Promise<AIResponse>;
  
  generateContentStream(messages: AIMessage[], options?: {
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<AIStreamResponse>;
  
  generateStructuredContent<T>(prompt: string, schema: any, options?: {
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<T>;
}

export type AIProviderType = 'gemini' | 'claude' | 'deepseek' | 'kimi';

export const AI_PROVIDERS: Record<AIProviderType, { name: string; displayName: string; requiresApiKey: boolean }> = {
  deepseek: { name: 'deepseek', displayName: 'DeepSeek', requiresApiKey: true },
  gemini: { name: 'gemini', displayName: 'Google Gemini', requiresApiKey: true },
  kimi: { name: 'kimi', displayName: 'Moonshot Kimi', requiresApiKey: true },
  claude: { name: 'claude', displayName: 'Anthropic Claude', requiresApiKey: true },
};

