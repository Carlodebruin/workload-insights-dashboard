import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import CryptoJS from 'crypto-js';

const prisma = new PrismaClient();

// Get encryption key from environment
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

function decryptValue(encryptedValue: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedValue, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Failed to decrypt value:', error);
    return encryptedValue; // Return as-is if decryption fails
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

    // Get WhatsApp configuration from request body
    const configMap = await request.json();

    const accessToken = configMap.accessToken;
    const phoneNumberId = configMap.phoneNumberId;

    if (!accessToken || !phoneNumberId) {
      return NextResponse.json({ 
        error: 'Missing required configuration: Access Token or Phone Number ID' 
      }, { status: 400 });
    }

    // Test WhatsApp API connection by getting phone number info
    const whatsappApiUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}`;
    
    const response = await fetch(whatsappApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('WhatsApp API test failed:', errorData);
      
      return NextResponse.json({ 
        error: 'WhatsApp API connection failed',
        details: errorData.error?.message || 'Unknown error',
        status: response.status
      }, { status: 400 });
    }

    const phoneData = await response.json();

    // Test webhook URL accessibility (optional)
    const webhookUrl = configMap.WHATSAPP_WEBHOOK_URL;
    let webhookStatus = 'not_tested';
    
    if (webhookUrl) {
      try {
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const webhookResponse = await fetch(webhookUrl, {
          method: 'GET',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        webhookStatus = webhookResponse.ok ? 'accessible' : 'not_accessible';
      } catch (error) {
        webhookStatus = 'not_accessible';
      }
    }

    return NextResponse.json({
      message: 'WhatsApp API connection test successful',
      phoneNumber: {
        id: phoneData.id,
        display_phone_number: phoneData.display_phone_number,
        verified_name: phoneData.verified_name,
        status: phoneData.status
      },
      webhook: {
        url: webhookUrl,
        status: webhookStatus
      },
      testResults: {
        api_connection: 'success',
        phone_number_valid: !!phoneData.id,
        webhook_accessible: webhookStatus === 'accessible'
      }
    });

  } catch (error) {
    console.error('WhatsApp API test error:', error);
    
    return NextResponse.json({ 
      error: 'Failed to test WhatsApp API connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}