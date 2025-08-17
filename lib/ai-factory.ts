import { AIProvider, AIProviderType } from './ai-providers';
import { GeminiProvider } from './providers/gemini';
import { ClaudeProvider } from './providers/claude';
import { DeepSeekProvider } from './providers/deepseek';
import { KimiProvider } from './providers/kimi';

export function createAIProvider(providerType: AIProviderType): AIProvider {
  switch (providerType) {
    case 'gemini':
      return new GeminiProvider();
    case 'claude':
      return new ClaudeProvider();
    case 'deepseek':
      return new DeepSeekProvider();
    case 'kimi':
      return new KimiProvider();
    default:
      throw new Error(`Unknown AI provider: ${providerType}`);
  }
}

export function getProviderFromRequest(request: Request): AIProviderType {
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider') as AIProviderType;
  
  if (provider && ['gemini', 'claude', 'deepseek', 'kimi'].includes(provider)) {
    return provider;
  }
  
  // Default to first available provider
  if (process.env.CLAUDE_API_KEY) return 'claude';
  if (process.env.DEEPSEEK_API_KEY) return 'deepseek';
  if (process.env.KIMI_API_KEY) return 'kimi';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  
  return 'gemini'; // fallback
}