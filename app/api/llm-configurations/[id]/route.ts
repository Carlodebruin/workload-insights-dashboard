import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { encrypt, decrypt, generateSecureId, maskApiKey } from '../../../../lib/encryption';
import { validateProviderConfiguration, getProviderInfo } from '../../../../lib/llm-providers';
import { validateBody, cuidSchema } from '../../../../lib/validation';
import { logSecureError, logSecureInfo, createRequestContext } from '../../../../lib/secure-logger';
import { withAuth } from '../../../../lib/auth-context';
import { z } from 'zod';

const updateLlmConfigurationSchema = z.object({
  provider: z.enum(['claude', 'deepseek', 'kimi', 'gemini', 'openai', 'azure-openai']).optional(),
  name: z.string().min(1).max(100).optional(),
  model: z.string().optional(),
  baseUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  configuration: z.record(z.any()).optional(),
  apiKey: z.string().optional() // Optional for updates
});

export const GET = withAuth(async (request: NextRequest, user, { params }: { params: { id: string } }) => {
  const requestContext = createRequestContext('get_llm_configuration', 'GET');
  
  try {
    const configId = validateBody(cuidSchema, params.id);
    
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

    // Transform configuration for frontend (exclude sensitive data)
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
      hasApiKey: !!configuration.apiKey?.encryptedKey
    };

    logSecureInfo('LLM configuration fetched successfully', {
      ...requestContext,
      statusCode: 200,
      configId: configuration.id
    });

    return NextResponse.json(safeConfiguration);
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('Validation failed') ? 400 : 500;
    
    logSecureError('Failed to fetch LLM configuration', {
      ...requestContext,
      statusCode
    }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: statusCode === 400 ? (error as Error).message : 'Internal Server Error' },
      { status: statusCode }
    );
  }
});

export const PUT = withAuth(async (request: NextRequest, user, { params }: { params: { id: string } }) => {
  const requestContext = createRequestContext('update_llm_configuration', 'PUT');
  
  try {
    const configId = validateBody(cuidSchema, params.id);
    const body = await request.json();
    const validatedData = validateBody(updateLlmConfigurationSchema, body);

    // Check if configuration exists
    const existingConfig = await prisma.llmConfiguration.findUnique({
      where: { id: configId },
      include: { apiKey: true }
    });

    if (!existingConfig) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    // Validate provider-specific configuration if provided
    if (validatedData.configuration) {
      const provider = validatedData.provider || existingConfig.provider;
      const providerValidation = validateProviderConfiguration(
        provider as any,
        validatedData.configuration
      );

      if (!providerValidation.isValid) {
        return NextResponse.json(
          { error: 'Invalid provider configuration', details: providerValidation.errors },
          { status: 400 }
        );
      }
    }

    // Handle default configuration (only one default allowed)
    if (validatedData.isDefault === true) {
      await prisma.llmConfiguration.updateMany({
        where: { 
          isDefault: true,
          id: { not: configId }
        },
        data: { isDefault: false }
      });
    }

    // Handle API key update
    let apiKeyId = existingConfig.apiKeyId;
    const provider = validatedData.provider || existingConfig.provider;
    const providerInfo = getProviderInfo(provider as any);
    
    if (validatedData.apiKey && providerInfo.requiresApiKey) {
      // Create new API key or update existing
      if (existingConfig.apiKeyId) {
        // Update existing API key
        const encryptedKey = encrypt(validatedData.apiKey);
        await prisma.apiKey.update({
          where: { keyId: existingConfig.apiKeyId },
          data: {
            encryptedKey,
            updatedAt: new Date()
          }
        });

        logSecureInfo('API key updated', {
          ...requestContext,
          configId
        }, {
          provider,
          keyId: existingConfig.apiKeyId,
          maskedKey: maskApiKey(validatedData.apiKey)
        });
      } else {
        // Create new API key
        apiKeyId = generateSecureId();
        const encryptedKey = encrypt(validatedData.apiKey);
        
        await prisma.apiKey.create({
          data: {
            keyId: apiKeyId,
            encryptedKey,
            provider,
            description: `API key for ${validatedData.name || existingConfig.name}`,
            isActive: true
          }
        });

        logSecureInfo('New API key created for configuration', {
          ...requestContext,
          configId
        }, {
          provider,
          keyId: apiKeyId,
          maskedKey: maskApiKey(validatedData.apiKey)
        });
      }
    }

    // Update LLM configuration
    const configuration = await prisma.llmConfiguration.update({
      where: { id: configId },
      data: {
        ...(validatedData.provider && { provider: validatedData.provider }),
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.model !== undefined && { model: validatedData.model }),
        ...(validatedData.baseUrl !== undefined && { baseUrl: validatedData.baseUrl }),
        ...(validatedData.isActive !== undefined && { isActive: validatedData.isActive }),
        ...(validatedData.isDefault !== undefined && { isDefault: validatedData.isDefault }),
        ...(validatedData.configuration && { configuration: JSON.stringify(validatedData.configuration) }),
        ...(apiKeyId && apiKeyId !== existingConfig.apiKeyId && { apiKeyId })
      }
    });

    logSecureInfo('LLM configuration updated successfully', {
      ...requestContext,
      statusCode: 200,
      configId: configuration.id
    });

    // Return safe configuration
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

    return NextResponse.json(safeConfiguration);
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('Validation failed') ? 400 : 500;
    const message = statusCode === 400 ? (error as Error).message : 'Internal Server Error';
    
    logSecureError('Failed to update LLM configuration', {
      ...requestContext,
      statusCode
    }, error instanceof Error ? error : undefined);

    return NextResponse.json({ error: message }, { status: statusCode });
  }
});

export const DELETE = withAuth(async (request: NextRequest, user, { params }: { params: { id: string } }) => {
  const requestContext = createRequestContext('delete_llm_configuration', 'DELETE');
  
  try {
    const configId = validateBody(cuidSchema, params.id);
    
    // Check if configuration exists
    const existingConfig = await prisma.llmConfiguration.findUnique({
      where: { id: configId },
      include: { apiKey: true }
    });

    if (!existingConfig) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    // Delete associated API key if exists
    if (existingConfig.apiKeyId) {
      await prisma.apiKey.delete({
        where: { keyId: existingConfig.apiKeyId }
      });

      logSecureInfo('Associated API key deleted', {
        ...requestContext,
        configId
      }, {
        keyId: existingConfig.apiKeyId,
        provider: existingConfig.provider
      });
    }

    // Delete the configuration
    await prisma.llmConfiguration.delete({
      where: { id: configId }
    });

    // If this was the default configuration, make another one default
    if (existingConfig.isDefault) {
      const nextConfig = await prisma.llmConfiguration.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' }
      });

      if (nextConfig) {
        await prisma.llmConfiguration.update({
          where: { id: nextConfig.id },
          data: { isDefault: true }
        });

        logSecureInfo('New default configuration set', {
          ...requestContext
        }, {
          newDefaultId: nextConfig.id,
          newDefaultName: nextConfig.name
        });
      }
    }

    logSecureInfo('LLM configuration deleted successfully', {
      ...requestContext,
      statusCode: 200,
      configId
    }, {
      name: existingConfig.name,
      provider: existingConfig.provider,
      wasDefault: existingConfig.isDefault
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('Validation failed') ? 400 : 500;
    
    logSecureError('Failed to delete LLM configuration', {
      ...requestContext,
      statusCode
    }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: statusCode === 400 ? (error as Error).message : 'Internal Server Error' },
      { status: statusCode }
    );
  }
});