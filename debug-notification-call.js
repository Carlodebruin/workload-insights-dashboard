#!/usr/bin/env node

/**
 * Debug Notification Call
 * Test the exact message that should be sent via Twilio
 */

async function debugNotificationCall() {
  console.log('🔧 Debug: Testing Exact Notification Message');
  console.log('=' .repeat(50));

  // Create the exact same message format as the notification function
  const referenceNumber = `MAIN-DXJU`; // Last 4 chars of activity ID
  
  let statusMessage = `📋 Status Update: ${referenceNumber}\n\n`;
  statusMessage += `🏷️ Issue: Maintenance - Broken Window\n`;
  statusMessage += `📍 Location: Classroom A\n`;
  statusMessage += `📊 Status: In Progress → On Hold\n`;
  statusMessage += `⏰ Updated: ${new Date().toLocaleString()}\n\n`;
  statusMessage += `⏸️ Work on this issue is temporarily on hold.\n\n`;
  statusMessage += `Reference: ${referenceNumber}`;

  console.log('📱 Message that would be sent:');
  console.log('=' .repeat(40));
  console.log(statusMessage);
  console.log('=' .repeat(40));

  console.log('\n🚀 Sending via Twilio...');

  try {
    const response = await fetch('http://localhost:3000/api/twilio/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: "+27815761685",
        message: statusMessage
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Message sent successfully!');
      console.log(`📨 Message SID: ${result.messageSid}`);
      console.log(`📊 Status: ${result.status}`);
      console.log('\n💡 This proves Twilio sending works with notification format');
    } else {
      console.log('❌ Message failed to send');
      console.log('Error:', result.error);
    }
    
  } catch (error) {
    console.log('❌ Error calling Twilio API:', error.message);
  }

  console.log('\n🔍 Now testing staff update message...');

  let updateMessage = `📝 Update: ${referenceNumber}\n\n`;
  updateMessage += `🏷️ Issue: Maintenance - Broken Window\n`;
  updateMessage += `📍 Location: Classroom A\n`;
  updateMessage += `👤 Updated by: Test Reporter\n`;
  updateMessage += `⏰ Time: ${new Date().toLocaleString()}\n\n`;
  updateMessage += `📋 Note: Safety inspection scheduled for Monday. Will resume work after approval.\n\n`;
  updateMessage += `Reference: ${referenceNumber}`;

  console.log('\n📱 Update message that would be sent:');
  console.log('=' .repeat(40));
  console.log(updateMessage);
  console.log('=' .repeat(40));

  try {
    const response = await fetch('http://localhost:3000/api/twilio/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: "+27815761685",
        message: updateMessage
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Update message sent successfully!');
      console.log(`📨 Message SID: ${result.messageSid}`);
      console.log('\n🎯 CONCLUSION: Notification sending mechanism works perfectly');
      console.log('   The issue must be in the notification function integration');
    } else {
      console.log('❌ Update message failed to send');
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

debugNotificationCall().catch(console.error);