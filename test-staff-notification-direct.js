#!/usr/bin/env node

/**
 * Direct Test of Staff Notification System
 * Tests the notification correlation logic directly
 */

async function testDirectNotification() {
  console.log('🔧 Testing Staff Notification Correlation Logic');
  console.log('=' .repeat(55));

  // Get the activity we just created
  const activityId = 'cmeph5sc20002ey82yp9hdxju';
  
  console.log(`📋 Testing notifications for activity: ${activityId}`);
  console.log('');

  // Test status update notification by calling the API and checking what happens
  console.log('🔍 Step 1: Testing Status Update Notification Correlation');
  
  try {
    const response = await fetch(`http://localhost:3000/api/activities/${activityId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'status_update',
        payload: {
          status: 'On Hold',
          instructions: 'Waiting for safety approval'
        }
      })
    });

    if (response.ok) {
      console.log('  ✅ Status update API call successful');
      console.log('  🔍 This should trigger WhatsApp notification correlation logic');
      
      // Wait a moment for notification to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if notification was sent by looking for the outbound message
      const checkResponse = await fetch('http://localhost:3000/api/twilio/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: "+27815761685",
          message: "🔍 Debug: If you received status update notifications above this message, the system is working!"
        })
      });
      
      if (checkResponse.ok) {
        const result = await checkResponse.json();
        console.log('  📱 Debug message sent:', result.messageSid);
      }
      
    } else {
      console.log('  ❌ Status update API call failed');
    }
  } catch (error) {
    console.log('  ❌ Error testing status update:', error.message);
  }

  console.log('');
  console.log('📝 Step 2: Testing Staff Note Notification');
  
  try {
    const response = await fetch(`http://localhost:3000/api/activities/${activityId}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notes: 'Safety inspection scheduled for Monday. Will resume work after approval.',
        photo_url: null,
        author_id: 'cmeph5rq90000ey82w1qdi3xy'
      })
    });

    if (response.ok) {
      console.log('  ✅ Staff note API call successful'); 
      console.log('  🔍 This should trigger WhatsApp update notification logic');
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const checkResponse = await fetch('http://localhost:3000/api/twilio/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: "+27815761685",
          message: "🔍 Debug: If you received staff note notifications above this message, the update system is working!"
        })
      });
      
      if (checkResponse.ok) {
        const result = await checkResponse.json();
        console.log('  📱 Debug message sent:', result.messageSid);
      }
      
    } else {
      console.log('  ❌ Staff note API call failed');
    }
  } catch (error) {
    console.log('  ❌ Error testing staff note:', error.message);
  }

  console.log('');
  console.log('🎯 DIRECT NOTIFICATION TEST COMPLETE');
  console.log('');
  console.log('📱 Check your WhatsApp now for:');
  console.log('  1. Status update notification (On Hold status)');
  console.log('  2. Staff note notification (Safety inspection message)');
  console.log('  3. Two debug confirmation messages');
  console.log('');
  console.log('💡 If you only see the debug messages but not the notifications,');
  console.log('   there may be an issue with the correlation logic between');
  console.log('   the WhatsApp messages and activities.');
}

testDirectNotification().catch(console.error);