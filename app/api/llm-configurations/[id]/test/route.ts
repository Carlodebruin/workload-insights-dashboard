import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { decrypt } from '../../../../../lib/encryption';
import { getProviderInfo } from '../../../../../lib/llm-providers';
import { validateBody, cuidSchema } from '../../../../../lib/validation';
import { logSecureError, logSecureInfo, createRequestContext } from '../../../../../lib/secure-logger';

/**
 * Test LLM configuration by making a simple API call
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const requestContext = createRequestContext('test_llm_configuration', 'POST');
  
  try {
    const configId = validateBody(cuidSchema, params.id);
    
    // Fetch configuration with API key
    const configuration = await prisma.llmConfiguration.findUnique({
      where: { id: configId },
      include: {
        apiKey: true
      }
    });

    if (!configuration) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    if (!configuration.isActive) {
      return NextResponse.json(
        { error: 'Configuration is not active' },
        { status: 400 }
      );
    }

    const providerInfo = getProviderInfo(configuration.provider as any);
    let apiKey: string | null = null;

    // Decrypt API key if required
    if (providerInfo.requiresApiKey && configuration.apiKey) {
      try {
        apiKey = decrypt(configuration.apiKey.encryptedKey);
      } catch (error) {
        logSecureError('Failed to decrypt API key for testing', {
          ...requestContext,
          statusCode: 500
        }, error instanceof Error ? error : undefined);

        return NextResponse.json(
          { error: 'Failed to decrypt API key' },
          { status: 500 }
        );
      }
    }

    // Parse configuration
    let config: Record<string, any> = {};
    try {
      config = JSON.parse(configuration.configuration || '{}');
    } catch (error) {
      logSecureError('Failed to parse configuration JSON', {
        ...requestContext,
        statusCode: 400
      }, error instanceof Error ? error : undefined);

      return NextResponse.json(
        { error: 'Invalid configuration format' },
        { status: 400 }
      );
    }

    // Perform provider-specific test
    let testResult: { success: boolean; message: string; responseTime?: number };
    const startTime = Date.now();

    try {
      switch (configuration.provider) {
        case 'claude':
          testResult = await testClaudeProvider(apiKey!, config, configuration.baseUrl || undefined);
          break;
        case 'openai':
          testResult = await testOpenAIProvider(apiKey!, config, configuration.baseUrl || undefined);
          break;
        case 'azure-openai':
          testResult = await testAzureOpenAIProvider(apiKey!, config, configuration.baseUrl || undefined);
          break;
        case 'gemini':
          testResult = await testGeminiProvider(apiKey!, config);
          break;
        case 'deepseek':
        case 'kimi':
          testResult = await testOpenAICompatibleProvider(apiKey!, config, configuration.baseUrl || undefined, configuration.provider);
          break;
        default:
          testResult = { success: false, message: `Provider ${configuration.provider} test not implemented` };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      testResult = {
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime
      };
    }

    testResult.responseTime = Date.now() - startTime;

    logSecureInfo('LLM configuration test completed', {
      ...requestContext,
      statusCode: 200
    }, {
      configId,
      provider: configuration.provider,
      success: testResult.success,
      responseTime: testResult.responseTime
    });

    return NextResponse.json(testResult);
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('Validation failed') ? 400 : 500;
    
    logSecureError('Failed to test LLM configuration', {
      ...requestContext,
      statusCode
    }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: statusCode === 400 ? (error as Error).message : 'Internal Server Error' },
      { status: statusCode }
    );
  }
}

// Provider-specific test functions

async function testClaudeProvider(apiKey: string, config: any, baseUrl?: string): Promise<{ success: boolean; message: string }> {
  const endpoint = baseUrl || 'https://api.anthropic.com/v1/messages';
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.model || 'claude-3-haiku-20240307',
      max_tokens: 10,
      messages: [{
        role: 'user',
        content: 'Test connection'
      }]
    })
  });

  if (response.ok) {
    return { success: true, message: 'Claude API connection successful' };
  } else {
    const error = await response.text();
    return { success: false, message: `Claude API error: ${response.status} - ${error}` };
  }
}

async function testOpenAIProvider(apiKey: string, config: any, baseUrl?: string): Promise<{ success: boolean; message: string }> {
  const endpoint = `${baseUrl || 'https://api.openai.com'}/v1/chat/completions`;
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: config.model || 'gpt-3.5-turbo',
      max_tokens: 5,
      messages: [{
        role: 'user',
        content: 'Test'
      }]
    })
  });

  if (response.ok) {
    return { success: true, message: 'OpenAI API connection successful' };
  } else {
    const error = await response.text();
    return { success: false, message: `OpenAI API error: ${response.status} - ${error}` };
  }
}

async function testAzureOpenAIProvider(apiKey: string, config: any, baseUrl?: string): Promise<{ success: boolean; message: string }> {
  if (!baseUrl || !config.deploymentName || !config.apiVersion) {
    return { success: false, message: 'Azure OpenAI requires baseUrl, deploymentName, and apiVersion' };
  }

  const endpoint = `${baseUrl}/openai/deployments/${config.deploymentName}/chat/completions?api-version=${config.apiVersion}`;
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify({
      max_tokens: 5,
      messages: [{
        role: 'user',
        content: 'Test'
      }]
    })
  });

  if (response.ok) {
    return { success: true, message: 'Azure OpenAI API connection successful' };
  } else {
    const error = await response.text();
    return { success: false, message: `Azure OpenAI API error: ${response.status} - ${error}` };
  }
}

async function testGeminiProvider(apiKey: string, config: any): Promise<{ success: boolean; message: string }> {
  const model = config.model || 'gemini-1.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: 'Test' }]
      }],
      generationConfig: {
        maxOutputTokens: 5
      }
    })
  });

  if (response.ok) {
    return { success: true, message: 'Gemini API connection successful' };
  } else {
    const error = await response.text();
    return { success: false, message: `Gemini API error: ${response.status} - ${error}` };
  }
}

async function testOpenAICompatibleProvider(apiKey: string, config: any, baseUrl?: string, provider?: string): Promise<{ success: boolean; message: string }> {
  if (!baseUrl) {
    return { success: false, message: `${provider} requires a base URL` };
  }

  const endpoint = `${baseUrl}/chat/completions`;
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: config.model || 'default',
      max_tokens: 5,
      messages: [{
        role: 'user',
        content: 'Test'
      }]
    })
  });

  if (response.ok) {
    return { success: true, message: `${provider} API connection successful` };
  } else {
    const error = await response.text();
    return { success: false, message: `${provider} API error: ${response.status} - ${error}` };
  }
}