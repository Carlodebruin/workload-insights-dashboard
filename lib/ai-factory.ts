import { AIProvider, AIProviderType } from './ai-providers';
import { GeminiProvider } from './providers/gemini';
import { ClaudeProvider } from './providers/claude';
import { DeepSeekProvider, DeepSeekAPIError, DeepSeekRateLimitError, DeepSeekTimeoutError } from './providers/deepseek';
import { KimiProvider } from './providers/kimi';
import { MockProvider } from './providers/mock';
import { prisma } from './prisma'; // Import prisma
import { decrypt } from './encryption'; // Import decrypt
import { logger } from './logger';

// Global fallback statistics
const fallbackStats = {
  totalFallbacks: 0,
  deepSeekFallbacks: 0,
  rateLimitFallbacks: 0,
  timeoutFallbacks: 0,
  lastFallback: null as { timestamp: Date; from: string; to: string; reason: string } | null,
  fallbacksByProvider: new Map<AIProviderType, number>()
};

// Get fallback statistics for diagnostics
export function getFallbackStatistics() {
  return {
    ...fallbackStats,
    fallbacksByProvider: Array.from(fallbackStats.fallbacksByProvider.entries())
  };
}

// Track fallback occurrence
function trackFallback(fromProvider: AIProviderType, toProvider: AIProviderType, reason: string, error?: Error) {
  fallbackStats.totalFallbacks++;
  fallbackStats.fallbacksByProvider.set(
    fromProvider,
    (fallbackStats.fallbacksByProvider.get(fromProvider) || 0) + 1
  );
  
  if (fromProvider === 'deepseek') {
    fallbackStats.deepSeekFallbacks++;
    
    if (error instanceof DeepSeekRateLimitError) {
      fallbackStats.rateLimitFallbacks++;
    } else if (error instanceof DeepSeekTimeoutError) {
      fallbackStats.timeoutFallbacks++;
    }
  }
  
  fallbackStats.lastFallback = {
    timestamp: new Date(),
    from: fromProvider,
    to: toProvider,
    reason
  };
  
  logger.warn('AI provider fallback occurred', {
    operation: 'provider_fallback'
  }, {
    fromProvider,
    toProvider,
    reason,
    errorType: error?.name,
    totalFallbacks: fallbackStats.totalFallbacks,
    timestamp: new Date().toISOString()
  });
}

// Check if an error should trigger fallback
export function shouldFallback(error: Error): boolean {
  // Always fallback for these DeepSeek errors
  if (error instanceof DeepSeekRateLimitError || error instanceof DeepSeekTimeoutError) {
    return true;
  }
  
  // Fallback for authentication errors (likely invalid API key)
  if (error instanceof DeepSeekAPIError && (error.statusCode === 401 || error.statusCode === 403)) {
    return true;
  }
  
  // Fallback for server errors if they're persistent
  if (error instanceof DeepSeekAPIError && error.statusCode >= 500) {
    return true;
  }
  
  // Fallback for network errors
  if (error.message?.includes('Network error') || error.name === 'NetworkError') {
    return true;
  }
  
  return false;
}

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

export async function testAIProvider(provider: AIProvider, timeout: number = 3000): Promise<{ isWorking: boolean; error?: Error; shouldFallback?: boolean }> {
  try {
    // Create a timeout promise to ensure fast failover
    const testPromise = provider.generateContent('Test', { maxTokens: 10 });
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Test timeout')), timeout)
    );
    
    const response = await Promise.race([testPromise, timeoutPromise]) as any;
    const isWorking = response && response.text && response.text.length > 0;
    
    if (isWorking) {
      logger.info(`Provider ${provider.name} test successful`, {
        operation: 'test_provider'
      }, {
        provider: provider.name,
        responseLength: response.text?.length || 0
      });
    }
    
    return { isWorking };
  } catch (error) {
    const testError = error instanceof Error ? error : new Error(String(error));
    const shouldFallbackFlag = shouldFallback(testError);
    
    logger.warn(`Provider ${provider.name} failed test`, {
      operation: 'test_provider'
    }, {
      provider: provider.name,
      errorType: testError.name,
      shouldFallback: shouldFallbackFlag,
      errorMessage: testError.message
    });
    
    return { 
      isWorking: false, 
      error: testError, 
      shouldFallback: shouldFallbackFlag 
    };
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

  let allProvidersFailed = true;
  let lastFallbackError: Error | null = null;

  for (const config of configurations) {
    let apiKey: string | undefined = undefined;
    if (config.apiKey) {
      try {
        apiKey = decrypt(config.apiKey.encryptedKey);
      } catch (e) {
        logger.warn(`Failed to decrypt API key for ${config.provider}`, {
          operation: 'decrypt_api_key'
        }, {
          provider: config.provider,
          configName: config.name
        });
        continue;
      }
    }

    const providerInstance = createAIProviderSafe(config.provider as AIProviderType, apiKey);
    if (providerInstance) {
      const testResult = await testAIProvider(providerInstance, 8000);
      
      if (testResult.isWorking) {
        logger.info(`Using ${config.provider} as primary AI provider`, {
          operation: 'select_provider'
        }, {
          provider: config.provider,
          source: 'database_config'
        });
        return providerInstance;
      } else if (testResult.shouldFallback && testResult.error) {
        // Track that we have a fallback candidate but continue to try others
        logger.warn(`Provider ${config.provider} failed but may need fallback`, {
          operation: 'provider_evaluation'
        }, {
          provider: config.provider,
          errorType: testResult.error.name,
          shouldFallback: testResult.shouldFallback
        });
        lastFallbackError = testResult.error;
        continue;
      } else {
        // Provider failed but shouldn't fallback (non-critical error)
        allProvidersFailed = false;
      }
    }
  }
  
  // If all configured providers failed with fallback-eligible errors, use mock provider
  if (allProvidersFailed && configurations.length > 0 && lastFallbackError) {
    logger.warn('All configured AI providers failed with fallback-eligible errors, using mock provider', {
      operation: 'fallback_to_mock_all_failed'
    }, {
      totalConfigurations: configurations.length,
      lastErrorType: lastFallbackError.name,
      lastErrorMessage: lastFallbackError.message
    });
    return new MockProvider();
  }
  
  // Fallback to mock provider if no database-configured provider works
  logger.warn('No working AI providers found, using mock provider', {
    operation: 'fallback_to_mock'
  }, {
    totalConfigurations: configurations.length
  });
  return new MockProvider();
}

// Get fallback provider when primary provider fails
export async function getFallbackProvider(failedProvider: AIProviderType, error: Error): Promise<AIProvider | null> {
  const startTime = Date.now();
  
  if (!shouldFallback(error)) {
    logger.info('Error does not require fallback', {
      operation: 'evaluate_fallback'
    }, {
      failedProvider,
      errorType: error.name,
      shouldFallback: false
    });
    return null;
  }
  
  logger.warn('Attempting to find fallback provider', {
    operation: 'find_fallback',
    timestamp: new Date().toISOString()
  }, {
    failedProvider,
    errorType: error.name
  });
  
  try {
    const configurations = await prisma.llmConfiguration.findMany({
      where: {
        isActive: true,
        provider: { not: failedProvider }, // Exclude the failed provider
      },
      include: {
        apiKey: true,
      },
      orderBy: {
        isDefault: 'desc', // Prefer default providers for fallback
      },
    });
    
    // Test each potential fallback provider quickly (2 second timeout for fast fallback)
    for (const config of configurations) {
      let apiKey: string | undefined = undefined;
      if (config.apiKey) {
        try {
          apiKey = decrypt(config.apiKey.encryptedKey);
        } catch (e) {
          continue; // Skip if can't decrypt
        }
      }
      
      const providerInstance = createAIProviderSafe(config.provider as AIProviderType, apiKey);
      if (providerInstance) {
        const testResult = await testAIProvider(providerInstance, 6000); // Reasonable timeout for fallback
        
        if (testResult.isWorking) {
          const fallbackTime = Date.now() - startTime;
          trackFallback(failedProvider, config.provider as AIProviderType, error.message, error);
          
          logger.info('Fallback provider found', {
            operation: 'fallback_success',
            timestamp: new Date().toISOString()
          }, {
            failedProvider,
            fallbackProvider: config.provider,
            fallbackTimeMs: fallbackTime,
            errorType: error.name
          });
          
          return providerInstance;
        }
      }
    }
    
    const fallbackTime = Date.now() - startTime;
    logger.error('No working fallback provider found', {
      operation: 'fallback_failed',
      timestamp: new Date().toISOString()
    }, {
      failedProvider,
      fallbackTimeMs: fallbackTime,
      testedProviders: configurations.length
    });
    
    return null;
  } catch (fallbackError) {
    logger.error('Error during fallback provider search', {
      operation: 'fallback_error',
      timestamp: new Date().toISOString()
    }, {
      failedProvider,
      fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
    });
    return null;
  }
}

export function getProviderFromRequest(request: Request): AIProviderType {
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider') as AIProviderType;
  
  if (provider && ['deepseek', 'gemini', 'kimi', 'claude'].includes(provider)) {
    return provider;
  }
  
  // Default to first available provider (DeepSeek priority order)
  if (process.env.DEEPSEEK_API_KEY) return 'deepseek';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.KIMI_API_KEY) return 'kimi';
  if (process.env.CLAUDE_API_KEY) return 'claude';
  
  return 'deepseek'; // fallback to DeepSeek as primary
}
