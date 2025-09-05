import { NextRequest, NextResponse } from "next/server";
import { logSecureInfo, createRequestContext } from "../../../lib/secure-logger";
import { eventPublisher } from "../../../lib/event-publisher-service";

// Prevent static generation for real-time SSE endpoint
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Global event stream connections management
const connections = new Map<string, ReadableStreamDefaultController>();

// Clean up stale connections periodically
setInterval(() => {
  const now = Date.now();
  connections.forEach((controller, id) => {
    // Check if connection is still alive (heartbeat based)
    const connectionAge = now - parseInt(id.split('-')[1] || '0');
    if (connectionAge > 300000) { // 5 minutes without activity
      try {
        controller.close();
        connections.delete(id);
      } catch (error) {
        console.warn('Error closing stale connection:', error);
      }
    }
  });
}, 60000); // Check every minute

export interface SSEEvent {
  type: 'activity_created' | 'activity_updated' | 'assignment_changed' | 'presence_updated' | 'heartbeat';
  data: any;
  timestamp: string;
  userId?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Create unique connection ID
    const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create ReadableStream for Vercel compatibility
    const stream = new ReadableStream({
      start(controller) {
        // Store controller for broadcasting
        connections.set(connectionId, controller);
        
        // Send initial connection event
        const initialEvent: SSEEvent = {
          type: 'heartbeat',
          data: { status: 'connected', connectionId },
          timestamp: new Date().toISOString()
        };
        
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(initialEvent)}\n\n`)
        );

        // Send heartbeat every 30 seconds to keep connection alive
        const heartbeatInterval = setInterval(() => {
          try {
            const heartbeatEvent: SSEEvent = {
              type: 'heartbeat',
              data: { timestamp: Date.now() },
              timestamp: new Date().toISOString()
            };
            controller.enqueue(
              new TextEncoder().encode(`data: ${JSON.stringify(heartbeatEvent)}\n\n`)
            );
          } catch (error) {
            console.warn('Heartbeat failed, connection may be closed:', error);
            clearInterval(heartbeatInterval);
          }
        }, 30000);

        // Cleanup on connection close
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeatInterval);
          connections.delete(connectionId);
          console.log(`SSE connection closed: ${connectionId}`);
        });
      },
      
      cancel() {
        connections.delete(connectionId);
        console.log(`SSE connection cancelled: ${connectionId}`);
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Critical for Vercel compatibility
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });
  } catch (error) {
    console.error('SSE endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to establish SSE connection' },
      { status: 500 }
    );
  }
}

// Note: broadcastSSEEvent has been moved to lib/event-publisher-service.ts
// to maintain Next.js route export compliance

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing SSE connections...');
  connections.forEach((controller, id) => {
    try {
      controller.close();
    } catch (error) {
      console.warn(`Error closing connection ${id}:`, error);
    }
  });
  connections.clear();
});