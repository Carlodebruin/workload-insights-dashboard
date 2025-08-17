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
  gemini: { name: 'gemini', displayName: 'Google Gemini', requiresApiKey: true },
  claude: { name: 'claude', displayName: 'Anthropic Claude', requiresApiKey: true },
  deepseek: { name: 'deepseek', displayName: 'DeepSeek', requiresApiKey: true },
  kimi: { name: 'kimi', displayName: 'Moonshot Kimi', requiresApiKey: true },
};

export function getDefaultProvider(): AIProviderType {
  if (process.env.CLAUDE_API_KEY) return 'claude';
  if (process.env.DEEPSEEK_API_KEY) return 'deepseek';
  if (process.env.KIMI_API_KEY) return 'kimi';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return 'gemini'; // fallback
}

export function getAvailableProviders(): AIProviderType[] {
  return Object.keys(AI_PROVIDERS).filter(provider => {
    switch (provider as AIProviderType) {
      case 'gemini': return !!process.env.GEMINI_API_KEY;
      case 'claude': return !!process.env.CLAUDE_API_KEY;
      case 'deepseek': return !!process.env.DEEPSEEK_API_KEY;
      case 'kimi': return !!process.env.KIMI_API_KEY;
      default: return false;
    }
  }) as AIProviderType[];
}