import { useState, useEffect, useCallback } from 'react';

export interface SSEEvent {
  type: 'activity_created' | 'activity_updated' | 'assignment_changed' | 'presence_updated' | 'heartbeat';
  data: any;
  timestamp: string;
  userId?: string;
}

interface RealtimeUpdatesResult {
  isConnected: boolean;
  lastUpdate: SSEEvent | null;
  error: string | null;
  reconnect: () => void;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

/**
 * Hook for real-time updates using Server-Sent Events
 * Provides connection status and latest events from the server
 */
export const useRealtimeUpdates = (): RealtimeUpdatesResult => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<SSEEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  const connect = useCallback(() => {
    try {
      setConnectionStatus('connecting');
      setError(null);

      // Create new EventSource connection
      const source = new EventSource('/api/events');
      
      source.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        console.log('SSE connection established');
      };

      source.onmessage = (event) => {
        try {
          const sseEvent: SSEEvent = JSON.parse(event.data);
          setLastUpdate(sseEvent);
          
          // Handle different event types
          switch (sseEvent.type) {
            case 'heartbeat':
              // Keep connection alive, no action needed
              break;
            case 'activity_created':
            case 'activity_updated':
            case 'assignment_changed':
              // These events will trigger UI updates in consuming components
              console.log('Real-time update received:', sseEvent.type, sseEvent.data);
              break;
            case 'presence_updated':
              // Handle presence updates if needed
              break;
          }
        } catch (parseError) {
          console.warn('Failed to parse SSE event:', parseError, event.data);
        }
      };

      source.onerror = (error) => {
        console.error('SSE connection error:', error);
        setConnectionStatus('error');
        setIsConnected(false);
        setError('Connection failed');
        
        // Attempt reconnect after delay
        setTimeout(() => {
          if (source.readyState === EventSource.CLOSED) {
            connect();
          }
        }, 5000);
      };

      setEventSource(source);

      // Cleanup on unmount
      return () => {
        source.close();
        setConnectionStatus('disconnected');
        setIsConnected(false);
      };
    } catch (initialError) {
      console.error('Failed to create SSE connection:', initialError);
      setConnectionStatus('error');
      setError('Failed to establish connection');
      return () => {}; // No cleanup needed
    }
  }, []);

  const reconnect = useCallback(() => {
    if (eventSource) {
      eventSource.close();
    }
    connect();
  }, [eventSource, connect]);

  useEffect(() => {
    const cleanup = connect();
    
    return () => {
      if (cleanup) {
        cleanup();
      }
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  // Auto-reconnect when connection is lost
  useEffect(() => {
    if (connectionStatus === 'error' || connectionStatus === 'disconnected') {
      const timer = setTimeout(() => {
        reconnect();
      }, 10000); // Reconnect after 10 seconds

      return () => clearTimeout(timer);
    }
  }, [connectionStatus, reconnect]);

  return {
    isConnected,
    lastUpdate,
    error,
    reconnect,
    connectionStatus
  };
};

/**
 * Simplified hook for specific event type monitoring
 */
export const useRealtimeEvent = (eventType: SSEEvent['type']) => {
  const { lastUpdate, isConnected } = useRealtimeUpdates();
  const [relevantEvents, setRelevantEvents] = useState<SSEEvent[]>([]);

  useEffect(() => {
    if (lastUpdate && lastUpdate.type === eventType) {
      setRelevantEvents(prev => [...prev, lastUpdate].slice(-50)); // Keep last 50 events
    }
  }, [lastUpdate, eventType]);

  return {
    events: relevantEvents,
    latestEvent: relevantEvents[relevantEvents.length - 1] || null,
    isConnected
  };
};