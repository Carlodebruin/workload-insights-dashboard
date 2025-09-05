import { eventPublisher } from './event-publisher-service';
import { logSecureInfo, logSecureError, createRequestContext } from './secure-logger';

export interface UserPresence {
  userId: string;
  userName: string;
  status: 'active' | 'away' | 'offline';
  lastActivity: string;
  currentActivity?: string; // Activity ID they're viewing
  lastSeen?: string;
}

export interface ActivityPresence {
  activityId: string;
  viewers: UserPresence[];
  totalViewers: number;
  lastUpdated: string;
}

export class PresenceService {
  private static instance: PresenceService;
  private presenceMap = new Map<string, UserPresence>();
  private activityViewersMap = new Map<string, Set<string>>(); // activityId -> Set of userIds
  private activityTimeout = 5 * 60 * 1000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startCleanupInterval();
  }

  public static getInstance(): PresenceService {
    if (!PresenceService.instance) {
      PresenceService.instance = new PresenceService();
    }
    return PresenceService.instance;
  }

  /**
   * Update user presence when they view an activity
   */
  updatePresence(userId: string, userName: string, activityId?: string): void {
    const now = new Date().toISOString();
    const currentPresence = this.presenceMap.get(userId);
    
    const newPresence: UserPresence = {
      userId,
      userName,
      status: 'active',
      lastActivity: now,
      currentActivity: activityId,
      lastSeen: now
    };

    this.presenceMap.set(userId, newPresence);

    // Track activity viewers if activityId is provided
    if (activityId) {
      if (!this.activityViewersMap.has(activityId)) {
        this.activityViewersMap.set(activityId, new Set());
      }
      this.activityViewersMap.get(activityId)!.add(userId);
    }

    // Broadcast presence update via existing SSE infrastructure
    this.broadcastPresenceUpdate(userId);

    logSecureInfo('User presence updated', 
      createRequestContext('update_presence', 'POST', userId, activityId, undefined),
      { userId, userName, activityId, status: 'active' }
    );
  }

  /**
   * Mark user as away (inactive but not offline)
   */
  markUserAway(userId: string): void {
    const presence = this.presenceMap.get(userId);
    if (presence) {
      const updatedPresence: UserPresence = {
        ...presence,
        status: 'away',
        lastSeen: new Date().toISOString()
      };
      this.presenceMap.set(userId, updatedPresence);
      this.broadcastPresenceUpdate(userId);
    }
  }

  /**
   * Mark user as offline (disconnected)
   */
  markUserOffline(userId: string): void {
    const presence = this.presenceMap.get(userId);
    if (presence) {
      const updatedPresence: UserPresence = {
        ...presence,
        status: 'offline',
        lastSeen: new Date().toISOString()
      };
      this.presenceMap.set(userId, updatedPresence);
      this.broadcastPresenceUpdate(userId);
    }
  }

  /**
   * Get presence information for a specific user
   */
  getUserPresence(userId: string): UserPresence | null {
    return this.presenceMap.get(userId) || null;
  }

  /**
   * Get all users currently viewing a specific activity
   */
  getActivityViewers(activityId: string, excludeUserId?: string): UserPresence[] {
    const viewerIds = this.activityViewersMap.get(activityId);
    if (!viewerIds) return [];

    const viewers: UserPresence[] = [];
    viewerIds.forEach(userId => {
      if (userId !== excludeUserId) {
        const presence = this.presenceMap.get(userId);
        if (presence && presence.status === 'active') {
          viewers.push(presence);
        }
      }
    });

    return viewers;
  }

  /**
   * Get activity presence information
   */
  getActivityPresence(activityId: string, excludeUserId?: string): ActivityPresence {
    const viewers = this.getActivityViewers(activityId, excludeUserId);
    
    return {
      activityId,
      viewers,
      totalViewers: viewers.length,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get all active users
   */
  getAllActiveUsers(): UserPresence[] {
    const activeUsers: UserPresence[] = [];
    this.presenceMap.forEach(presence => {
      if (presence.status === 'active') {
        activeUsers.push(presence);
      }
    });
    return activeUsers;
  }

  /**
   * Remove user from all activity viewer lists
   */
  removeUserFromActivities(userId: string): void {
    this.activityViewersMap.forEach((viewerSet, activityId) => {
      if (viewerSet.has(userId)) {
        viewerSet.delete(userId);
        if (viewerSet.size === 0) {
          this.activityViewersMap.delete(activityId);
        }
      }
    });
  }

  /**
   * Broadcast presence update via SSE
   */
  private broadcastPresenceUpdate(userId: string): void {
    const presence = this.presenceMap.get(userId);
    if (presence) {
      eventPublisher.broadcastPresenceUpdated(
        userId,
        presence.status === 'active',
        presence.lastSeen ? new Date(presence.lastSeen) : undefined
      );
    }
  }

  /**
   * Start cleanup interval to remove stale presences
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStalePresences();
    }, 60000); // Check every minute
  }

  /**
   * Clean up stale presence data
   */
  private cleanupStalePresences(): void {
    const now = Date.now();
    const staleUserIds: string[] = [];

    this.presenceMap.forEach((presence, userId) => {
      const lastActivityTime = new Date(presence.lastActivity).getTime();
      if (now - lastActivityTime > this.activityTimeout) {
        if (presence.status === 'active') {
          this.markUserAway(userId);
        } else if (now - lastActivityTime > this.activityTimeout * 2) {
          staleUserIds.push(userId);
        }
      }
    });

    // Remove completely stale users
    staleUserIds.forEach(userId => {
      this.presenceMap.delete(userId);
      this.removeUserFromActivities(userId);
    });

    if (staleUserIds.length > 0) {
      logSecureInfo('Cleaned up stale presence data',
        createRequestContext('presence_cleanup', 'POST', undefined, undefined, undefined),
        { staleUserCount: staleUserIds.length }
      );
    }
  }

  /**
   * Stop cleanup interval (for testing or shutdown)
   */
  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get service statistics
   */
  public getStats(): {
    totalUsers: number;
    activeUsers: number;
    awayUsers: number;
    offlineUsers: number;
    trackedActivities: number;
  } {
    let activeUsers = 0;
    let awayUsers = 0;
    let offlineUsers = 0;

    this.presenceMap.forEach(presence => {
      switch (presence.status) {
        case 'active':
          activeUsers++;
          break;
        case 'away':
          awayUsers++;
          break;
        case 'offline':
          offlineUsers++;
          break;
      }
    });

    return {
      totalUsers: this.presenceMap.size,
      activeUsers,
      awayUsers,
      offlineUsers,
      trackedActivities: this.activityViewersMap.size
    };
  }
}

// Export singleton instance
export const presenceService = PresenceService.getInstance();