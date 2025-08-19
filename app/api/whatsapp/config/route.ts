import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import CryptoJS from 'crypto-js';

const prisma = new PrismaClient();

// Get encryption key from environment
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

function encryptValue(value: string): string {
  return CryptoJS.AES.encrypt(value, ENCRYPTION_KEY).toString();
}

function decryptValue(encryptedValue: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedValue, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Failed to decrypt value:', error);
    return encryptedValue; // Return as-is if decryption fails
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    if (token !== 'demo-admin-token') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get all WhatsApp configurations
    const configs = await prisma.whatsAppConfig.findMany({
      where: { isActive: true },
      orderBy: { key: 'asc' }
    });

    // Decrypt values for response
    const decryptedConfigs = configs.map(config => ({
      ...config,
      value: decryptValue(config.value)
    }));

    return NextResponse.json({ 
      configs: decryptedConfigs,
      count: configs.length 
    });

  } catch (error) {
    console.error('Failed to fetch WhatsApp configurations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configurations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    if (token !== 'demo-admin-token') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // CSRF protection
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    if (!origin && !referer) {
      return NextResponse.json({ error: 'CSRF protection: Missing origin or referer header' }, { status: 403 });
    }

    const body = await request.json();
    const { configs } = body;

    if (!configs || !Array.isArray(configs)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Validate required fields
    const requiredKeys = [
      'WHATSAPP_APP_ID',
      'WHATSAPP_APP_SECRET', 
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_BUSINESS_ACCOUNT_ID',
      'WHATSAPP_WEBHOOK_URL'
    ];

    const providedKeys = configs.map((c: any) => c.key);
    const missingKeys = requiredKeys.filter(key => !providedKeys.includes(key));

    if (missingKeys.length > 0) {
      return NextResponse.json({ 
        error: `Missing required configurations: ${missingKeys.join(', ')}` 
      }, { status: 400 });
    }

    // Use transaction to ensure all configs are saved or none
    const result = await prisma.$transaction(async (tx) => {
      const savedConfigs = [];

      for (const config of configs) {
        const { key, value, description } = config;

        if (!key || !value) {
          throw new Error(`Missing key or value for configuration: ${key}`);
        }

        // Encrypt the value
        const encryptedValue = encryptValue(value);

        // Upsert configuration
        const savedConfig = await tx.whatsAppConfig.upsert({
          where: { key },
          update: {
            value: encryptedValue,
            description,
            updatedAt: new Date(),
          },
          create: {
            key,
            value: encryptedValue,
            description,
            isActive: true,
          },
        });

        savedConfigs.push({
          ...savedConfig,
          value: value // Return unencrypted value in response
        });
      }

      return savedConfigs;
    });

    return NextResponse.json({ 
      message: 'WhatsApp configuration saved successfully',
      configs: result 
    });

  } catch (error) {
    console.error('Failed to save WhatsApp configuration:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authentication check
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    if (token !== 'demo-admin-token') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // CSRF protection
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    if (!origin && !referer) {
      return NextResponse.json({ error: 'CSRF protection: Missing origin or referer header' }, { status: 403 });
    }

    const body = await request.json();
    const { key, value, description, isActive } = body;

    if (!key) {
      return NextResponse.json({ error: 'Configuration key is required' }, { status: 400 });
    }

    // Find existing configuration
    const existingConfig = await prisma.whatsAppConfig.findUnique({
      where: { key }
    });

    if (!existingConfig) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
    }

    // Update configuration
    const updatedConfig = await prisma.whatsAppConfig.update({
      where: { key },
      data: {
        ...(value && { value: encryptValue(value) }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Configuration updated successfully',
      config: {
        ...updatedConfig,
        value: value || decryptValue(updatedConfig.value)
      }
    });

  } catch (error) {
    console.error('Failed to update WhatsApp configuration:', error);
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}