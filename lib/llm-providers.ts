import { LLMProvider, LLMProviderInfo } from '../types';

/**
 * Comprehensive LLM provider configurations
 * This defines the available providers and their specific settings
 */
export const LLM_PROVIDERS: Record<LLMProvider, LLMProviderInfo> = {
  claude: {
    provider: 'claude',
    name: 'Anthropic Claude',
    description: 'Advanced AI assistant by Anthropic with strong reasoning capabilities',
    defaultModel: 'claude-3-5-sonnet-20241022',
    supportedModels: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ],
    requiresApiKey: true,
    requiresBaseUrl: false,
    configurationFields: [
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        required: true,
        options: [
          'claude-3-5-sonnet-20241022',
          'claude-3-5-haiku-20241022',
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307'
        ],
        description: 'Claude model to use for requests'
      },
      {
        key: 'maxTokens',
        label: 'Max Tokens',
        type: 'number',
        required: false,
        min: 1,
        max: 4096,
        placeholder: '1024',
        description: 'Maximum number of tokens to generate'
      },
      {
        key: 'temperature',
        label: 'Temperature',
        type: 'number',
        required: false,
        min: 0,
        max: 1,
        step: 0.1,
        placeholder: '0.7',
        description: 'Controls randomness in responses (0-1)'
      }
    ]
  },

  deepseek: {
    provider: 'deepseek',
    name: 'DeepSeek',
    description: 'High-performance language model with strong coding capabilities',
    defaultModel: 'deepseek-chat',
    supportedModels: [
      'deepseek-chat',
      'deepseek-coder'
    ],
    requiresApiKey: true,
    requiresBaseUrl: true,
    configurationFields: [
      {
        key: 'baseUrl',
        label: 'Base URL',
        type: 'text',
        required: true,
        placeholder: 'https://api.deepseek.com/v1',
        description: 'API endpoint URL'
      },
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        required: true,
        options: ['deepseek-chat', 'deepseek-coder'],
        description: 'DeepSeek model to use'
      },
      {
        key: 'maxTokens',
        label: 'Max Tokens',
        type: 'number',
        required: false,
        min: 1,
        max: 4096,
        placeholder: '1024',
        description: 'Maximum number of tokens to generate'
      },
      {
        key: 'temperature',
        label: 'Temperature',
        type: 'number',
        required: false,
        min: 0,
        max: 2,
        step: 0.1,
        placeholder: '1.0',
        description: 'Controls randomness in responses (0-2)'
      }
    ]
  },

  kimi: {
    provider: 'kimi',
    name: 'Moonshot Kimi',
    description: 'Advanced Chinese language model with long context support',
    defaultModel: 'moonshot-v1-8k',
    supportedModels: [
      'moonshot-v1-8k',
      'moonshot-v1-32k',
      'moonshot-v1-128k'
    ],
    requiresApiKey: true,
    requiresBaseUrl: true,
    configurationFields: [
      {
        key: 'baseUrl',
        label: 'Base URL',
        type: 'text',
        required: true,
        placeholder: 'https://api.moonshot.cn/v1',
        description: 'API endpoint URL'
      },
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        required: true,
        options: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
        description: 'Kimi model to use (different context lengths)'
      },
      {
        key: 'maxTokens',
        label: 'Max Tokens',
        type: 'number',
        required: false,
        min: 1,
        max: 8192,
        placeholder: '1024',
        description: 'Maximum number of tokens to generate'
      },
      {
        key: 'temperature',
        label: 'Temperature',
        type: 'number',
        required: false,
        min: 0,
        max: 1,
        step: 0.1,
        placeholder: '0.3',
        description: 'Controls randomness in responses (0-1)'
      }
    ]
  },

  gemini: {
    provider: 'gemini',
    name: 'Google Gemini',
    description: 'Google\'s advanced multimodal AI model with strong reasoning',
    defaultModel: 'gemini-1.5-pro',
    supportedModels: [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.0-pro'
    ],
    requiresApiKey: true,
    requiresBaseUrl: false,
    configurationFields: [
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        required: true,
        options: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
        description: 'Gemini model to use'
      },
      {
        key: 'maxTokens',
        label: 'Max Tokens',
        type: 'number',
        required: false,
        min: 1,
        max: 2048,
        placeholder: '1024',
        description: 'Maximum number of tokens to generate'
      },
      {
        key: 'temperature',
        label: 'Temperature',
        type: 'number',
        required: false,
        min: 0,
        max: 2,
        step: 0.1,
        placeholder: '0.9',
        description: 'Controls randomness in responses (0-2)'
      },
      {
        key: 'topP',
        label: 'Top P',
        type: 'number',
        required: false,
        min: 0,
        max: 1,
        step: 0.05,
        placeholder: '0.95',
        description: 'Nucleus sampling parameter (0-1)'
      }
    ]
  },

  openai: {
    provider: 'openai',
    name: 'OpenAI',
    description: 'OpenAI\'s GPT models for text generation and conversation',
    defaultModel: 'gpt-4-turbo-preview',
    supportedModels: [
      'gpt-4-turbo-preview',
      'gpt-4',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k'
    ],
    requiresApiKey: true,
    requiresBaseUrl: false,
    configurationFields: [
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        required: true,
        options: ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k'],
        description: 'OpenAI model to use'
      },
      {
        key: 'maxTokens',
        label: 'Max Tokens',
        type: 'number',
        required: false,
        min: 1,
        max: 4096,
        placeholder: '1024',
        description: 'Maximum number of tokens to generate'
      },
      {
        key: 'temperature',
        label: 'Temperature',
        type: 'number',
        required: false,
        min: 0,
        max: 2,
        step: 0.1,
        placeholder: '0.7',
        description: 'Controls randomness in responses (0-2)'
      },
      {
        key: 'topP',
        label: 'Top P',
        type: 'number',
        required: false,
        min: 0,
        max: 1,
        step: 0.05,
        placeholder: '1',
        description: 'Nucleus sampling parameter (0-1)'
      },
      {
        key: 'presencePenalty',
        label: 'Presence Penalty',
        type: 'number',
        required: false,
        min: -2,
        max: 2,
        step: 0.1,
        placeholder: '0',
        description: 'Penalize new tokens based on presence (-2 to 2)'
      },
      {
        key: 'frequencyPenalty',
        label: 'Frequency Penalty',
        type: 'number',
        required: false,
        min: -2,
        max: 2,
        step: 0.1,
        placeholder: '0',
        description: 'Penalize new tokens based on frequency (-2 to 2)'
      }
    ]
  },

  'azure-openai': {
    provider: 'azure-openai',
    name: 'Azure OpenAI',
    description: 'OpenAI models hosted on Microsoft Azure with enterprise features',
    defaultModel: 'gpt-4',
    supportedModels: [
      'gpt-4',
      'gpt-4-32k',
      'gpt-35-turbo',
      'gpt-35-turbo-16k'
    ],
    requiresApiKey: true,
    requiresBaseUrl: true,
    configurationFields: [
      {
        key: 'baseUrl',
        label: 'Azure Endpoint',
        type: 'text',
        required: true,
        placeholder: 'https://your-resource.openai.azure.com',
        description: 'Azure OpenAI endpoint URL'
      },
      {
        key: 'deploymentName',
        label: 'Deployment Name',
        type: 'text',
        required: true,
        placeholder: 'gpt-4-deployment',
        description: 'Azure deployment name'
      },
      {
        key: 'apiVersion',
        label: 'API Version',
        type: 'text',
        required: true,
        placeholder: '2024-02-01',
        description: 'Azure OpenAI API version'
      },
      {
        key: 'maxTokens',
        label: 'Max Tokens',
        type: 'number',
        required: false,
        min: 1,
        max: 4096,
        placeholder: '1024',
        description: 'Maximum number of tokens to generate'
      },
      {
        key: 'temperature',
        label: 'Temperature',
        type: 'number',
        required: false,
        min: 0,
        max: 2,
        step: 0.1,
        placeholder: '0.7',
        description: 'Controls randomness in responses (0-2)'
      }
    ]
  }
};

/**
 * Get provider information by provider name
 */
export function getProviderInfo(provider: LLMProvider): LLMProviderInfo {
  return LLM_PROVIDERS[provider];
}

/**
 * Get all available providers
 */
export function getAllProviders(): LLMProviderInfo[] {
  return Object.values(LLM_PROVIDERS);
}

/**
 * Get providers that require API keys
 */
export function getProvidersRequiringApiKey(): LLMProviderInfo[] {
  return getAllProviders().filter(provider => provider.requiresApiKey);
}

/**
 * Get providers that require custom base URLs
 */
export function getProvidersRequiringBaseUrl(): LLMProviderInfo[] {
  return getAllProviders().filter(provider => provider.requiresBaseUrl);
}

/**
 * Validate provider configuration
 */
export function validateProviderConfiguration(
  provider: LLMProvider,
  configuration: Record<string, any>
): { isValid: boolean; errors: string[] } {
  const providerInfo = getProviderInfo(provider);
  const errors: string[] = [];

  if (!providerInfo) {
    return { isValid: false, errors: ['Unknown provider'] };
  }

  // Check required fields
  for (const field of providerInfo.configurationFields) {
    if (field.required && (!configuration[field.key] || configuration[field.key] === '')) {
      errors.push(`${field.label} is required`);
    }

    const value = configuration[field.key];
    if (value !== undefined && value !== null && value !== '') {
      // Type-specific validation
      switch (field.type) {
        case 'number':
          const numValue = Number(value);
          if (isNaN(numValue)) {
            errors.push(`${field.label} must be a number`);
          } else {
            if (field.min !== undefined && numValue < field.min) {
              errors.push(`${field.label} must be at least ${field.min}`);
            }
            if (field.max !== undefined && numValue > field.max) {
              errors.push(`${field.label} must be at most ${field.max}`);
            }
          }
          break;
        
        case 'select':
          if (field.options && !field.options.includes(value)) {
            errors.push(`${field.label} must be one of: ${field.options.join(', ')}`);
          }
          break;
        
        case 'text':
          if (typeof value !== 'string') {
            errors.push(`${field.label} must be a string`);
          }
          break;
        
        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(`${field.label} must be a boolean`);
          }
          break;
      }
    }
  }

  // Provider-specific validation
  if (providerInfo.requiresBaseUrl && !configuration.baseUrl) {
    errors.push('Base URL is required for this provider');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get default configuration for a provider
 */
export function getDefaultConfiguration(provider: LLMProvider): Record<string, any> {
  const providerInfo = getProviderInfo(provider);
  const config: Record<string, any> = {};

  // Set default model
  if (providerInfo.defaultModel) {
    config.model = providerInfo.defaultModel;
  }

  // Set field defaults
  for (const field of providerInfo.configurationFields) {
    if (field.placeholder && field.key !== 'baseUrl') {
      const placeholder = field.placeholder;
      if (field.type === 'number') {
        config[field.key] = Number(placeholder);
      } else if (field.type === 'boolean') {
        config[field.key] = placeholder === 'true';
      } else {
        config[field.key] = placeholder;
      }
    }
  }

  return config;
}