import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
  try {
    console.log('📱 Fetching WhatsApp messages...');

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Fetch messages with user info
    const [messages, totalCount] = await Promise.all([
      prisma.whatsAppMessage.findMany({
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          whatsappUser: {
            select: {
              displayName: true,
              phoneNumber: true,
              linkedUserId: true,
              linkedUser: {
                select: {
                  name: true,
                  role: true
                }
              }
            }
          },
          relatedActivity: {
            select: {
              id: true,
              category_id: true,
              location: true,
              status: true
            }
          }
        }
      }),
      prisma.whatsAppMessage.count()
    ]);

    console.log(`✅ Retrieved ${messages.length} messages out of ${totalCount} total`);

    // Process messages for display
    const processedMessages = messages.map(msg => {
      let displayContent = '';
      try {
        const parsedContent = JSON.parse(msg.content);
        displayContent = parsedContent.text || msg.content;
      } catch {
        displayContent = msg.content;
      }

      return {
        id: msg.id,
        waId: msg.waId,
        from: msg.from,
        type: msg.type,
        content: displayContent,
        timestamp: msg.timestamp,
        direction: msg.direction,
        status: msg.status,
        processed: msg.processed,
        relatedActivityId: msg.relatedActivityId,
        sender: {
          name: msg.whatsappUser?.displayName || `Unknown (${msg.from})`,
          phone: msg.whatsappUser?.phoneNumber || msg.from,
          linkedUser: msg.whatsappUser?.linkedUser
        },
        activity: msg.relatedActivity
      };
    });

    return NextResponse.json({
      messages: processedMessages,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalRecords: totalCount,
        pageSize: limit,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPreviousPage: page > 1
      }
    });

  } catch (error) {
    console.error('❌ Error fetching WhatsApp messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch WhatsApp messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { messageId, action } = await request.json();

    if (action === 'mark_processed') {
      await prisma.whatsAppMessage.update({
        where: { id: messageId },
        data: { processed: true }
      });

      console.log(`✅ Message ${messageId} marked as processed`);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('❌ Error updating WhatsApp message:', error);
    return NextResponse.json(
      { error: 'Failed to update message' },
      { status: 500 }
    );
  }
}