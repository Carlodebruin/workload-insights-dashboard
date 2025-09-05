#!/usr/bin/env node

const fs = require('fs');

/**
 * Test script for real-time dashboard integration
 * Verifies that the AppShell properly integrates with real-time updates
 */

console.log('🧪 Testing Real-Time Dashboard Integration...\n');

// Test 1: Check if real-time hook is properly imported and used
console.log('1. Testing Real-Time Hook Integration...');
try {
  const appShellContent = fs.readFileSync('./components/AppShell.tsx', 'utf8');
  
  // Check for real-time hook import
  const hasRealtimeImport = appShellContent.includes('useRealtimeUpdates');
  console.log('   ✓ Real-time hook imported:', hasRealtimeImport);
  
  // Check for hook usage
  const hasHookUsage = appShellContent.includes('useRealtimeUpdates()');
  console.log('   ✓ Real-time hook used in component:', hasHookUsage);
  
  // Check for connection status handling
  const hasConnectionStatus = appShellContent.includes('connectionStatus');
  console.log('   ✓ Connection status handling:', hasConnectionStatus);
  
  // Check for event handling
  const hasEventHandling = appShellContent.includes('lastUpdate');
  console.log('   ✓ Real-time event handling:', hasEventHandling);
  
} catch (error) {
  console.log('   ✗ Error reading AppShell component:', error.message);
}

// Test 2: Check if real-time events trigger data refresh
console.log('\n2. Testing Real-Time Event Handling...');
try {
  const appShellContent = fs.readFileSync('./components/AppShell.tsx', 'utf8');
  
  // Check for useEffect that handles real-time events
  const hasUseEffect = appShellContent.includes('useEffect(() => {') && 
                       appShellContent.includes('lastUpdate');
  console.log('   ✓ useEffect for real-time events:', hasUseEffect);
  
  // Check for data refresh on relevant events
  const hasEventTypesCheck = appShellContent.includes('activity_created') || 
                            appShellContent.includes('activity_updated') ||
                            appShellContent.includes('assignment_changed');
  console.log('   ✓ Event type filtering:', hasEventTypesCheck);
  
  // Check for fetchInitialData call
  const hasDataRefresh = appShellContent.includes('fetchInitialData()');
  console.log('   ✓ Data refresh on events:', hasDataRefresh);
  
} catch (error) {
  console.log('   ✗ Error checking event handling:', error.message);
}

// Test 3: Check connection status indicator
console.log('\n3. Testing Connection Status UI...');
try {
  const appShellContent = fs.readFileSync('./components/AppShell.tsx', 'utf8');
  
  // Check for connection status indicator UI
  const hasStatusIndicator = appShellContent.includes('Real-time connection status indicator');
  console.log('   ✓ Connection status indicator present:', hasStatusIndicator);
  
  // Check for different status states
  const hasStatusStates = appShellContent.includes('connected') && 
                         appShellContent.includes('connecting') &&
                         appShellContent.includes('error');
  console.log('   ✓ Multiple connection states handled:', hasStatusStates);
  
  // Check for reconnect functionality
  const hasReconnect = appShellContent.includes('reconnect');
  console.log('   ✓ Reconnect functionality:', hasReconnect);
  
} catch (error) {
  console.log('   ✗ Error checking connection UI:', error.message);
}

// Test 4: Verify the real-time hook exists and exports correctly
console.log('\n4. Testing Real-Time Hook Implementation...');
try {
  const hookContent = fs.readFileSync('./hooks/useRealtimeUpdates.ts', 'utf8');
  
  // Check hook exports
  const exportsUseRealtimeUpdates = hookContent.includes('export const useRealtimeUpdates');
  console.log('   ✓ useRealtimeUpdates exported:', exportsUseRealtimeUpdates);
  
  const exportsUseRealtimeEvent = hookContent.includes('export const useRealtimeEvent');
  console.log('   ✓ useRealtimeEvent exported:', exportsUseRealtimeEvent);
  
  // Check EventSource integration
  const hasEventSource = hookContent.includes('EventSource');
  console.log('   ✓ EventSource integration:', hasEventSource);
  
  // Check error handling
  const hasErrorHandling = hookContent.includes('onerror');
  console.log('   ✓ Error handling:', hasErrorHandling);
  
  // Check reconnect logic
  const hasReconnectLogic = hookContent.includes('reconnect');
  console.log('   ✓ Reconnect logic:', hasReconnectLogic);
  
} catch (error) {
  console.log('   ✗ Error checking real-time hook:', error.message);
}

console.log('\n✅ Real-Time Dashboard Integration Tests Completed!');
console.log('\n📋 Next Steps:');
console.log('   - Start development server: npm run dev');
console.log('   - Verify real-time connection indicator appears');
console.log('   - Test creating/updating activities to see real-time updates');
console.log('   - Check that dashboard refreshes automatically');
console.log('   - Test connection error scenarios');
console.log('   - Verify reconnect functionality works');