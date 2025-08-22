import { AIProvider, AIProviderType } from './ai-providers';
import { GeminiProvider } from './providers/gemini';
import { ClaudeProvider } from './providers/claude';
import { DeepSeekProvider } from './providers/deepseek';
import { KimiProvider } from './providers/kimi';
import { MockProvider } from './providers/mock';

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

export function createAIProviderSafe(providerType: AIProviderType): AIProvider | null {
  try {
    return createAIProvider(providerType);
  } catch (error) {
    console.warn(`Failed to create ${providerType} provider:`, error instanceof Error ? error.message : error);
    return null;
  }
}

export async function testAIProvider(provider: AIProvider): Promise<boolean> {
  try {
    // Test with a very simple request
    const response = await provider.generateContent('Test', { maxTokens: 10 });
    return response.text.length > 0;
  } catch (error) {
    console.warn(`Provider ${provider.name} failed test:`, error instanceof Error ? error.message : error);
    return false;
  }
}

export function getWorkingAIProvider(): AIProvider {
  // Check environment variables first to avoid creating providers with invalid keys
  // Trim whitespace and newlines from all API keys
  const claudeKey = process.env.CLAUDE_API_KEY?.trim();
  const hasValidClaude = !!(claudeKey && 
    claudeKey !== 'test_key_for_development_health_check' &&
    claudeKey.startsWith('sk-ant-'));
    
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const hasValidGemini = !!(geminiKey && 
    geminiKey !== 'test_key_for_development_health_check' &&
    geminiKey.length > 20);
    
  const deepSeekKey = process.env.DEEPSEEK_API_KEY?.trim();
  const hasValidDeepSeek = !!(deepSeekKey && 
    deepSeekKey !== 'test_key_for_development_health_check');
    
  const kimiKey = process.env.KIMI_API_KEY?.trim();
  const hasValidKimi = !!(kimiKey && 
    kimiKey !== 'test_key_for_development_health_check');

  // Try providers in order of preference
  const providerOrder: { type: AIProviderType, hasValid: boolean }[] = [
    { type: 'claude', hasValid: hasValidClaude },
    { type: 'gemini', hasValid: hasValidGemini },
    { type: 'deepseek', hasValid: hasValidDeepSeek },
    { type: 'kimi', hasValid: hasValidKimi }
  ];
  
  for (const { type, hasValid } of providerOrder) {
    if (hasValid) {
      const provider = createAIProviderSafe(type);
      if (provider) {
        console.log(`✅ Using ${type} as AI provider`);
        return provider;
      }
    }
  }
  
  // Fallback to mock provider for development/demo
  console.log('⚠️ No real AI providers available, using mock provider for development');
  return new MockProvider();
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