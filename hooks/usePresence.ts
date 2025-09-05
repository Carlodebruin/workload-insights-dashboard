import { useState, useEffect, useCallback } from 'react';
import { UserPresence, ActivityPresence, presenceService } from '../lib/presence-service';
import { useRealtimeEvent } from './useRealtimeUpdates';

export interface UsePresenceResult {
  /**
   * Current user's presence status
   */
  currentPresence: UserPresence | null;
  
  /**
   * Other users viewing the same activity
   */
  otherViewers: UserPresence[];
  
  /**
   * Total number of viewers (including current user)
   */
  totalViewers: number;
  
  /**
   * Complete activity presence information
   */
  activityPresence: ActivityPresence | null;
  
  /**
   * Whether presence data is being tracked
   */
  isTracking: boolean;
  
  /**
   * Update current user's presence
   */
  updatePresence: (activityId?: string) => void;
  
  /**
   * Mark current user as away
   */
  markAway: () => void;
  
  /**
   * Mark current user as offline
   */
  markOffline: () => void;
}

export interface UsePresenceOptions {
  /**
   * Activity ID to track presence for
   */
  activityId?: string;
  
  /**
   * Current user ID
   */
  userId?: string;
  
  /**
   * Current user name
   */
  userName?: string;
  
  /**
   * Whether to automatically track presence when component mounts
   */
  autoTrack?: boolean;
  
  /**
   * Whether to listen for real-time presence updates
   */
  listenForUpdates?: boolean;
}

/**
 * Hook for tracking user presence and activity viewers
 */
export const usePresence = (options: UsePresenceOptions): UsePresenceResult => {
  const {
    activityId,
    userId,
    userName,
    autoTrack = true,
    listenForUpdates = true
  } = options;

  const [currentPresence, setCurrentPresence] = useState<UserPresence | null>(null);
  const [otherViewers, setOtherViewers] = useState<UserPresence[]>([]);
  const [totalViewers, setTotalViewers] = useState(0);
  const [activityPresence, setActivityPresence] = useState<ActivityPresence | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // Listen for real-time presence updates
  const { events: presenceEvents } = useRealtimeEvent('presence_updated');

  // Update presence information when real-time events are received
  useEffect(() => {
    if (listenForUpdates && activityId) {
      refreshActivityPresence();
    }
  }, [presenceEvents, activityId, listenForUpdates]);

  // Initialize presence tracking when component mounts
  useEffect(() => {
    if (autoTrack && userId && userName) {
      updatePresence(activityId);
    }
  }, [autoTrack, userId, userName, activityId]);

  // Clean up presence tracking when component unmounts
  useEffect(() => {
    return () => {
      if (userId) {
        presenceService.markUserOffline(userId);
      }
    };
  }, [userId]);

  // Refresh activity presence information
  const refreshActivityPresence = useCallback(() => {
    if (!activityId) return;

    const presence = presenceService.getActivityPresence(activityId, userId);
    setActivityPresence(presence);
    setOtherViewers(presence.viewers);
    setTotalViewers(presence.totalViewers + (userId ? 1 : 0)); // Include current user if present
  }, [activityId, userId]);

  // Update current user's presence
  const updatePresence = useCallback((newActivityId?: string) => {
    if (!userId || !userName) return;

    const targetActivityId = newActivityId || activityId;
    presenceService.updatePresence(userId, userName, targetActivityId);
    
    // Update local state
    const updatedPresence = presenceService.getUserPresence(userId);
    setCurrentPresence(updatedPresence);
    
    if (targetActivityId) {
      refreshActivityPresence();
    }
    
    setIsTracking(true);
  }, [userId, userName, activityId, refreshActivityPresence]);

  // Mark current user as away
  const markAway = useCallback(() => {
    if (!userId) return;
    
    presenceService.markUserAway(userId);
    const updatedPresence = presenceService.getUserPresence(userId);
    setCurrentPresence(updatedPresence);
    
    if (activityId) {
      refreshActivityPresence();
    }
  }, [userId, activityId, refreshActivityPresence]);

  // Mark current user as offline
  const markOffline = useCallback(() => {
    if (!userId) return;
    
    presenceService.markUserOffline(userId);
    const updatedPresence = presenceService.getUserPresence(userId);
    setCurrentPresence(updatedPresence);
    
    if (activityId) {
      refreshActivityPresence();
    }
  }, [userId, activityId, refreshActivityPresence]);

  // Set up visibility change listener for automatic away/online status
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (userId && userName) {
        if (document.visibilityState === 'visible') {
          updatePresence(activityId);
        } else {
          markAway();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId, userName, activityId, updatePresence, markAway]);

  // Set up page unload listener for offline status
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (userId) {
        presenceService.markUserOffline(userId);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userId]);

  return {
    currentPresence,
    otherViewers,
    totalViewers,
    activityPresence,
    isTracking,
    updatePresence,
    markAway,
    markOffline
  };
};

/**
 * Simplified hook for getting activity viewers (without current user tracking)
 */
export const useActivityViewers = (activityId?: string, excludeUserId?: string) => {
  const [viewers, setViewers] = useState<UserPresence[]>([]);
  const [totalViewers, setTotalViewers] = useState(0);

  // Listen for real-time presence updates
  const { events: presenceEvents } = useRealtimeEvent('presence_updated');

  useEffect(() => {
    if (activityId) {
      refreshViewers();
    }
  }, [activityId, presenceEvents]);

  const refreshViewers = useCallback(() => {
    if (!activityId) return;

    const presence = presenceService.getActivityPresence(activityId, excludeUserId);
    setViewers(presence.viewers);
    setTotalViewers(presence.totalViewers);
  }, [activityId, excludeUserId]);

  return {
    viewers,
    totalViewers,
    refreshViewers
  };
};