import { AIProvider, AIProviderType } from './ai-providers';
import { GeminiProvider } from './providers/gemini';
import { ClaudeProvider } from './providers/claude';
import { DeepSeekProvider } from './providers/deepseek';
import { KimiProvider } from './providers/kimi';
import { MockProvider } from './providers/mock';
import { prisma } from './prisma'; // Import prisma
import { decrypt } from './encryption'; // Import decrypt

export function createAIProvider(providerType: AIProviderType, apiKey?: string): AIProvider {
  switch (providerType) {
    case 'gemini':
      return new GeminiProvider(apiKey);
    case 'claude':
      return new ClaudeProvider(apiKey);
    case 'deepseek':
      return new DeepSeekProvider(apiKey);
    case 'kimi':
      return new KimiProvider(apiKey);
    default:
      throw new Error(`Unknown AI provider: ${providerType}`);
  }
}

export function createAIProviderSafe(providerType: AIProviderType, apiKey?: string): AIProvider | null {
  try {
    return createAIProvider(providerType, apiKey);
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

export async function getWorkingAIProvider(): Promise<AIProvider> {
  const configurations = await prisma.llmConfiguration.findMany({
    where: {
      isActive: true,
    },
    include: {
      apiKey: true,
    },
    orderBy: {
      isDefault: 'desc',
    },
  });

  for (const config of configurations) {
    let apiKey: string | undefined = undefined;
    if (config.apiKey) {
      try {
        apiKey = decrypt(config.apiKey.encryptedKey);
      } catch (e) {
        console.warn(`Failed to decrypt API key for ${config.provider} (${config.name}):`, e);
        continue;
      }
    }

    const providerInstance = createAIProviderSafe(config.provider as AIProviderType, apiKey);
    if (providerInstance) {
      const isWorking = await testAIProvider(providerInstance);
      if (isWorking) {
        console.log(`✅ Using ${config.provider} as AI provider (from DB config)`);
        return providerInstance;
      }
    }
  }
  
  // Fallback to mock provider if no database-configured provider works
  console.log('⚠️ No active or working AI providers configured in DB, using mock provider for development');
  return new MockProvider();
}

export function getProviderFromRequest(request: Request): AIProviderType {
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider') as AIProviderType;
  
  if (provider && ['gemini', 'claude', 'deepseek', 'kimi'].includes(provider)) {
    return provider;
  }
  
  // Default to first available provider (from env vars, will be removed later)
  if (process.env.CLAUDE_API_KEY) return 'claude';
  if (process.env.DEEPSEEK_API_KEY) return 'deepseek';
  if (process.env.KIMI_API_KEY) return 'kimi';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  
  return 'gemini'; // fallback
}
