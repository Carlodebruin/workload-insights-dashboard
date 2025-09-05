import { logSecureInfo, logSecureError, createRequestContext } from './secure-logger';
import { withDb } from './db-wrapper';

// Import the SSE connections map from the events endpoint
// We'll reference the existing connections map
declare global {
  var sseConnections: Map<string, ReadableStreamDefaultController> | undefined;
}

// Initialize the connections map if it doesn't exist
if (!global.sseConnections) {
  global.sseConnections = new Map();
}

const connections = global.sseConnections;

export interface SSEEvent {
  type: 'activity_created' | 'activity_updated' | 'assignment_changed' | 'presence_updated' | 'heartbeat';
  data: any;
  timestamp: number;
}

export class EventPublisherService {
  private static instance: EventPublisherService;

  private constructor() {}

  public static getInstance(): EventPublisherService {
    if (!EventPublisherService.instance) {
      EventPublisherService.instance = new EventPublisherService();
    }
    return EventPublisherService.instance;
  }

  /**
   * Broadcast an event to all connected SSE clients
   */
  public broadcastEvent(event: SSEEvent): void {
    const now = Date.now();
    let successfulBroadcasts = 0;
    let failedBroadcasts = 0;

    connections.forEach((controller, id) => {
      try {
        // Send the event as SSE format
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
        );
        successfulBroadcasts++;
      } catch (error) {
        failedBroadcasts++;
        // Remove broken connections
        connections.delete(id);
        logSecureError('Failed to broadcast event to SSE connection',
          createRequestContext('sse_broadcast', 'POST', undefined, undefined, undefined),
          error instanceof Error ? error : undefined,
          { connectionId: id }
        );
      }
    });

    if (successfulBroadcasts > 0 || failedBroadcasts > 0) {
      logSecureInfo('Event broadcast completed',
        createRequestContext('broadcast_event', 'POST', undefined, undefined, undefined),
        {
          eventType: event.type,
          successfulBroadcasts,
          failedBroadcasts,
          totalConnections: connections.size
        }
      );
    }
  }

  /**
   * Broadcast activity creation event
   */
  public async broadcastActivityCreated(activityId: string): Promise<void> {
    try {
      const activity = await withDb(async (prisma) => {
        return prisma.activity.findUnique({
          where: { id: activityId },
          include: {
            category: { select: { name: true } },
            user: { select: { name: true } },
            assignedTo: { select: { name: true } }
          }
        });
      });

      if (!activity) {
        logSecureError('Activity not found for broadcast',
          createRequestContext('broadcast_activity_created', 'POST', undefined, activityId, undefined)
        );
        return;
      }

      const event: SSEEvent = {
        type: 'activity_created',
        data: {
          id: activity.id,
          category: activity.category?.name,
          subcategory: activity.subcategory,
          location: activity.location,
          status: activity.status,
          reporter: activity.user?.name,
          assignedTo: activity.assignedTo?.name,
          timestamp: activity.timestamp.toISOString()
        },
        timestamp: Date.now()
      };

      this.broadcastEvent(event);
    } catch (error) {
      logSecureError('Failed to broadcast activity creation',
        createRequestContext('broadcast_activity_created', 'POST', undefined, activityId, undefined),
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Broadcast activity update event
   */
  public async broadcastActivityUpdated(activityId: string, updateType: 'status' | 'assignment' | 'general' = 'general'): Promise<void> {
    try {
      const activity = await withDb(async (prisma) => {
        return prisma.activity.findUnique({
          where: { id: activityId },
          include: {
            category: { select: { name: true } },
            user: { select: { name: true } },
            assignedTo: { select: { name: true } },
            updates: {
              orderBy: { timestamp: 'desc' },
              take: 1,
              select: { notes: true, author_id: true, update_type: true }
            }
          }
        });
      });

      if (!activity) {
        logSecureError('Activity not found for broadcast',
          createRequestContext('broadcast_activity_updated', 'POST', undefined, activityId, undefined)
        );
        return;
      }

      const latestUpdate = activity.updates[0];

      const event: SSEEvent = {
        type: 'activity_updated',
        data: {
          id: activity.id,
          category: activity.category?.name,
          subcategory: activity.subcategory,
          location: activity.location,
          status: activity.status,
          reporter: activity.user?.name,
          assignedTo: activity.assignedTo?.name,
          updateType,
          latestUpdate: latestUpdate ? {
            notes: latestUpdate.notes,
            authorId: latestUpdate.author_id,
            updateType: latestUpdate.update_type
          } : null,
          timestamp: new Date().toISOString()
        },
        timestamp: Date.now()
      };

      this.broadcastEvent(event);
    } catch (error) {
      logSecureError('Failed to broadcast activity update',
        createRequestContext('broadcast_activity_updated', 'POST', undefined, activityId, undefined),
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Broadcast assignment change event
   */
  public async broadcastAssignmentChanged(activityId: string, oldAssigneeId?: string, newAssigneeId?: string): Promise<void> {
    try {
      const activity = await withDb(async (prisma) => {
        return prisma.activity.findUnique({
          where: { id: activityId },
          include: {
            category: { select: { name: true } },
            user: { select: { name: true } },
            assignedTo: { select: { name: true } }
          }
        });
      });

      if (!activity) {
        logSecureError('Activity not found for broadcast',
          createRequestContext('broadcast_assignment_changed', 'POST', undefined, activityId, undefined)
        );
        return;
      }

      const event: SSEEvent = {
        type: 'assignment_changed',
        data: {
          id: activity.id,
          category: activity.category?.name,
          subcategory: activity.subcategory,
          location: activity.location,
          status: activity.status,
          reporter: activity.user?.name,
          assignedTo: activity.assignedTo?.name,
          oldAssigneeId,
          newAssigneeId: activity.assigned_to_user_id,
          timestamp: new Date().toISOString()
        },
        timestamp: Date.now()
      };

      this.broadcastEvent(event);
    } catch (error) {
      logSecureError('Failed to broadcast assignment change',
        createRequestContext('broadcast_assignment_changed', 'POST', undefined, activityId, undefined),
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Broadcast presence update (user online/offline status)
   */
  public broadcastPresenceUpdated(userId: string, isOnline: boolean, lastSeen?: Date): void {
    const event: SSEEvent = {
      type: 'presence_updated',
      data: {
        userId,
        isOnline,
        lastSeen: lastSeen?.toISOString() || new Date().toISOString()
      },
      timestamp: Date.now()
    };

    this.broadcastEvent(event);
  }

  /**
   * Get connection statistics
   * Note: This is a simplified version since the connections map only contains controllers
   * For more detailed tracking, we'd need to extend the connection management
   */
  public getConnectionStats(): {
    totalConnections: number;
    activeConnections: number;
    connectionsByUser: Map<string, number>;
  } {
    // Since we only have controllers, we can't track last activity per connection
    // We'll assume all connections are active for this simplified implementation
    const activeConnections = connections.size;

    const connectionsByUser = new Map<string, number>();
    // User tracking would require additional metadata storage

    return {
      totalConnections: connections.size,
      activeConnections,
      connectionsByUser
    };
  }
}

// Export singleton instance
export const eventPublisher = EventPublisherService.getInstance();