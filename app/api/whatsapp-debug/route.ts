import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 WhatsApp Debug endpoint called');

    // Get recent messages
    const recentMessages = await prisma.whatsAppMessage.findMany({
      take: 10,
      orderBy: { timestamp: 'desc' },
      include: {
        whatsappUser: {
          select: {
            displayName: true,
            phoneNumber: true,
            linkedUserId: true,
          }
        },
        relatedActivity: {
          select: {
            id: true,
            location: true,
            status: true
          }
        }
      }
    });

    // Get WhatsApp users
    const whatsappUsers = await prisma.whatsAppUser.findMany({
      take: 10,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        linkedUser: {
          select: {
            name: true,
            role: true
          }
        }
      }
    });

    // Get message statistics
    const messageStats = await Promise.all([
      prisma.whatsAppMessage.count(),
      prisma.whatsAppMessage.count({ where: { processed: true } }),
      prisma.whatsAppMessage.count({ where: { processed: false } }),
      prisma.whatsAppMessage.count({ where: { relatedActivityId: { not: null } } }),
    ]);

    const [totalMessages, processedMessages, unprocessedMessages, convertedMessages] = messageStats;

    // Environment check
    const envCheck = {
      WHATSAPP_VERIFY_TOKEN: !!process.env.WHATSAPP_VERIFY_TOKEN,
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: !!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      WHATSAPP_ACCESS_TOKEN: !!process.env.WHATSAPP_ACCESS_TOKEN,
      WHATSAPP_PHONE_NUMBER_ID: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
      DATABASE_URL: !!process.env.DATABASE_URL,
    };

    // Process messages for debug display
    const debugMessages = recentMessages.map(msg => {
      let content = '';
      try {
        const parsed = JSON.parse(msg.content);
        content = parsed.text || msg.content;
      } catch {
        content = msg.content;
      }

      return {
        id: msg.id,
        from: msg.whatsappUser?.phoneNumber || msg.from,
        sender: msg.whatsappUser?.displayName || 'Unknown',
        content: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
        type: msg.type,
        timestamp: msg.timestamp,
        processed: msg.processed,
        hasActivity: !!msg.relatedActivityId,
        activityId: msg.relatedActivity?.id,
      };
    });

    const debugData = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      environment: envCheck,
      statistics: {
        totalMessages,
        processedMessages,
        unprocessedMessages,
        convertedMessages,
        totalUsers: whatsappUsers.length,
        linkedUsers: whatsappUsers.filter(u => u.linkedUserId).length,
      },
      recentMessages: debugMessages,
      webhookEndpoints: [
        {
          endpoint: '/api/whatsapp-webhook',
          description: 'Simple webhook handler (current)',
          status: 'active'
        },
        {
          endpoint: '/api/whatsapp/webhook',
          description: 'Advanced webhook handler (full system)',
          status: 'available'
        }
      ],
      testInstructions: [
        'Send WhatsApp message to your business number',
        'Check /whatsapp-messages page in dashboard',
        'Look for new messages in this debug output',
        'Use "Convert to Activity" button to create tasks'
      ]
    };

    console.log('✅ Debug data compiled:', {
      messagesCount: debugMessages.length,
      usersCount: whatsappUsers.length,
      totalMessages,
    });

    return NextResponse.json(debugData, {
      headers: {
        'Content-Type': 'application/json',
      }
    });

  } catch (error) {
    console.error('❌ Error in WhatsApp debug endpoint:', error);
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        NODE_ENV: process.env.NODE_ENV,
      }
    }, { status: 500 });
  }
}