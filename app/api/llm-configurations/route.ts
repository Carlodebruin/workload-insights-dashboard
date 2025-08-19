import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { encrypt, decrypt, generateSecureId, maskApiKey } from '../../../lib/encryption';
import { validateProviderConfiguration, getProviderInfo } from '../../../lib/llm-providers';
import { validateBody } from '../../../lib/validation';
import { logSecureError, logSecureInfo, createRequestContext } from '../../../lib/secure-logger';
import { withAuth } from '../../../lib/auth-context';
import { z } from 'zod';

// Validation schema for LLM configuration
const llmConfigurationSchema = z.object({
  provider: z.enum(['claude', 'deepseek', 'kimi', 'gemini', 'openai', 'azure-openai']),
  name: z.string().min(1, 'Configuration name is required').max(100),
  model: z.string().optional(),
  baseUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  configuration: z.record(z.string(), z.any()).default({}),
  apiKey: z.string().min(1, 'API key is required')
});

const updateLlmConfigurationSchema = llmConfigurationSchema.partial().omit({ apiKey: true }).extend({
  apiKey: z.string().optional() // Optional for updates
});

export const GET = withAuth(async (request: NextRequest) => {
  const requestContext = createRequestContext('get_llm_configurations', 'GET');
  
  try {
    const configurations = await prisma.llmConfiguration.findMany({
      include: {
        apiKey: true
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // Transform configurations for frontend (exclude sensitive data)
    const safeConfigurations = configurations.map(config => ({
      id: config.id,
      provider: config.provider,
      name: config.name,
      model: config.model,
      baseUrl: config.baseUrl,
      isActive: config.isActive,
      isDefault: config.isDefault,
      configuration: config.configuration,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
      apiKeyId: config.apiKeyId,
      hasApiKey: !!config.apiKey?.encryptedKey
    }));

    logSecureInfo('LLM configurations fetched successfully', {
      ...requestContext,
      statusCode: 200
    }, { 
      configCount: configurations.length,
      activeCount: configurations.filter(c => c.isActive).length
    });

    return NextResponse.json(safeConfigurations);
  } catch (error) {
    logSecureError('Failed to fetch LLM configurations', {
      ...requestContext,
      statusCode: 500
    }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest) => {
  const requestContext = createRequestContext('create_llm_configuration', 'POST');
  
  try {
    const body = await request.json();
    
    // Basic validation
    if (!body.provider || !body.name || !body.apiKey) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, name, apiKey' },
        { status: 400 }
      );
    }
    
    const validatedData = {
      provider: body.provider,
      name: body.name,
      model: body.model,
      baseUrl: body.baseUrl,
      isActive: body.isActive !== false,
      isDefault: body.isDefault === true,
      configuration: body.configuration || {},
      apiKey: body.apiKey
    };

    // Validate provider-specific configuration
    const providerValidation = validateProviderConfiguration(
      validatedData.provider,
      validatedData.configuration
    );

    if (!providerValidation.isValid) {
      return NextResponse.json(
        { error: 'Invalid provider configuration', details: providerValidation.errors },
        { status: 400 }
      );
    }

    // Check if this should be the default (only one default allowed)
    if (validatedData.isDefault) {
      await prisma.llmConfiguration.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    // Create API key record if provider requires it
    let apiKeyId: string | null = null;
    const providerInfo = getProviderInfo(validatedData.provider);
    
    if (providerInfo.requiresApiKey && validatedData.apiKey) {
      apiKeyId = generateSecureId();
      const encryptedKey = encrypt(validatedData.apiKey);
      
      await prisma.apiKey.create({
        data: {
          keyId: apiKeyId,
          encryptedKey,
          provider: validatedData.provider,
          description: `API key for ${validatedData.name}`,
          isActive: true
        }
      });

      logSecureInfo('API key encrypted and stored', {
        ...requestContext,
        statusCode: 201
      }, {
        provider: validatedData.provider,
        keyId: apiKeyId,
        maskedKey: maskApiKey(validatedData.apiKey)
      });
    }

    // Create LLM configuration
    const configuration = await prisma.llmConfiguration.create({
      data: {
        provider: validatedData.provider,
        name: validatedData.name,
        model: validatedData.model,
        baseUrl: validatedData.baseUrl,
        apiKeyId,
        isActive: validatedData.isActive,
        isDefault: validatedData.isDefault,
        configuration: JSON.stringify(validatedData.configuration)
      }
    });

    logSecureInfo('LLM configuration created successfully', {
      ...requestContext,
      statusCode: 201
    }, {
      configId: configuration.id,
      provider: validatedData.provider,
      name: validatedData.name,
      hasApiKey: !!apiKeyId
    });

    // Return safe configuration (without sensitive data)
    const safeConfiguration = {
      id: configuration.id,
      provider: configuration.provider,
      name: configuration.name,
      model: configuration.model,
      baseUrl: configuration.baseUrl,
      isActive: configuration.isActive,
      isDefault: configuration.isDefault,
      configuration: configuration.configuration,
      createdAt: configuration.createdAt.toISOString(),
      updatedAt: configuration.updatedAt.toISOString(),
      apiKeyId: configuration.apiKeyId,
      hasApiKey: !!apiKeyId
    };

    return NextResponse.json(safeConfiguration, { status: 201 });
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('Validation failed') ? 400 : 500;
    const message = statusCode === 400 ? (error as Error).message : 'Internal Server Error';
    
    logSecureError('Failed to create LLM configuration', {
      ...requestContext,
      statusCode
    }, error instanceof Error ? error : undefined);

    return NextResponse.json({ error: message }, { status: statusCode });
  }
});