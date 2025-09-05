# Real-Time Infrastructure Implementation

## Overview

This document describes the Server-Sent Events (SSE) real-time infrastructure implemented for the Workload Insights Dashboard. The system provides real-time updates for activity creation, updates, and assignment changes across all connected clients.

## Architecture

### Components

1. **SSE Endpoint** (`app/api/events/route.ts`)
   - Handles client connections via HTTP streaming
   - Manages connection lifecycle and heartbeats
   - Vercel-compatible ReadableStream implementation

2. **Event Publisher Service** (`lib/event-publisher-service.ts`)
   - Singleton service for broadcasting events
   - Manages global connection state
   - Provides typed event interfaces

3. **Client Hook** (`hooks/useRealtimeUpdates.ts`)
   - React hook for client-side real-time updates
   - Handles connection management and reconnection
   - Provides typed event handling

4. **Integration Points**
   - Activity creation endpoint broadcasts `activity_created` events
   - Activity update endpoint broadcasts `activity_updated` and `assignment_changed` events

## Event Types

### SSEEvent Interface

```typescript
interface SSEEvent {
  type: 'activity_created' | 'activity_updated' | 'assignment_changed' | 'presence_updated' | 'heartbeat';
  data: any;
  timestamp: number;
}
```

### Event Payloads

#### Activity Created
```typescript
{
  type: 'activity_created',
  data: {
    id: string;
    category: string;
    subcategory: string;
    location: string;
    status: string;
    reporter: string;
    assignedTo: string | null;
    timestamp: string;
  }
}
```

#### Activity Updated
```typescript
{
  type: 'activity_updated',
  data: {
    id: string;
    category: string;
    subcategory: string;
    location: string;
    status: string;
    reporter: string;
    assignedTo: string | null;
    updateType: 'status' | 'assignment' | 'general';
    latestUpdate: {
      notes: string;
      authorId: string;
      updateType: string;
    } | null;
    timestamp: string;
  }
}
```

#### Assignment Changed
```typescript
{
  type: 'assignment_changed',
  data: {
    id: string;
    category: string;
    subcategory: string;
    location: string;
    status: string;
    reporter: string;
    assignedTo: string | null;
    oldAssigneeId: string | undefined;
    newAssigneeId: string | undefined;
    timestamp: string;
  }
}
```

## Implementation Details

### Connection Management

- **Global Connection Map**: Uses `global.sseConnections` to track all active connections
- **Heartbeat System**: Sends heartbeat events every 30 seconds to keep connections alive
- **Cleanup**: Automatic cleanup of stale connections (5 minutes without activity)
- **Graceful Shutdown**: Handles SIGTERM for proper connection closure

### Integration Points

#### Activity Creation
```typescript
// In app/api/activities/route.ts POST handler
await eventPublisher.broadcastActivityCreated(newActivity.id);
```

#### Activity Updates
```typescript
// In app/api/activities/[activityId]/route.ts PUT handler
await eventPublisher.broadcastActivityUpdated(activityId, updateType);
await eventPublisher.broadcastAssignmentChanged(activityId, oldAssigneeId, newAssigneeId);
```

### Error Handling

- **Broadcast Failures**: Logged but don't fail the main operation
- **Connection Errors**: Broken connections are automatically removed
- **Database Errors**: Fallback to graceful degradation

## Performance Considerations

1. **Connection Limits**: Vercel has connection limits (≈50 concurrent connections)
2. **Memory Usage**: Each connection maintains a ReadableStream controller
3. **Broadcast Efficiency**: Events are broadcast to all connections simultaneously
4. **Database Queries**: Event publishing includes additional database queries for fresh data

## Security Considerations

1. **CORS**: Enabled for all origins (`Access-Control-Allow-Origin: *`)
2. **No Authentication**: Currently no authentication on SSE endpoint
3. **Data Exposure**: Only non-sensitive activity metadata is broadcast
4. **Rate Limiting**: Consider implementing connection rate limiting

## Testing

### Manual Testing
1. Start development server: `npm run dev`
2. Open dashboard in multiple browser tabs
3. Create/update activities in one tab
4. Observe real-time updates in other tabs

### Automated Testing
Run the test script: `node scripts/test-realtime-infrastructure.js`

## Monitoring

### Connection Statistics
```typescript
const stats = eventPublisher.getConnectionStats();
// {
//   totalConnections: number,
//   activeConnections: number,
//   connectionsByUser: Map<string, number>
// }
```

### Logging
- Connection establishment/closure events
- Broadcast success/failure metrics
- Error events with secure logging

## Deployment Considerations

### Vercel Compatibility
- Uses ReadableStream API (Vercel Edge Runtime compatible)
- No persistent WebSocket connections required
- Stateless architecture fits serverless model

### Scaling
- Consider Redis for connection management in multi-instance deployments
- Implement connection pooling for high traffic scenarios
- Monitor connection counts and memory usage

## Future Enhancements

1. **Authentication**: Add JWT-based connection authentication
2. **Selective Broadcasting**: Broadcast to specific users/roles only
3. **Redis Integration**: For multi-instance deployment support
4. **Metrics**: Detailed connection and event metrics
5. **Reconnection Strategy**: Enhanced client-side reconnection logic
6. **Event Batching**: Batch multiple events for efficiency

## Usage Examples

### Client-Side Usage
```typescript
const { isConnected, events } = useRealtimeUpdates();

useEffect(() => {
  events.forEach(event => {
    switch (event.type) {
      case 'activity_created':
        // Add new activity to UI
        break;
      case 'activity_updated':
        // Update existing activity
        break;
      case 'assignment_changed':
        // Refresh assignment data
        break;
    }
  });
}, [events]);
```

### Server-Side Broadcasting
```typescript
// Broadcast custom event
eventPublisher.broadcastEvent({
  type: 'presence_updated',
  data: { userId: 'user-123', isOnline: true },
  timestamp: Date.now()
});
```

## Troubleshooting

### Common Issues

1. **No Real-Time Updates**
   - Check browser console for SSE connection errors
   - Verify server is running and accessible
   - Check CORS headers

2. **Connection Drops**
   - Verify heartbeat interval (30 seconds)
   - Check network stability
   - Monitor server logs for errors

3. **Performance Issues**
   - Monitor connection count
   - Check memory usage
   - Consider implementing connection limits

### Debugging
- Enable debug logging in client hook
- Monitor server logs for broadcast events
- Use browser dev tools to inspect SSE connections