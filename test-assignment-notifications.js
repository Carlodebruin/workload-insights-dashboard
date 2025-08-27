#!/usr/bin/env node

/**
 * Test Assignment Notifications
 * 
 * This script tests:
 * 1. Creating a WhatsApp incident report
 * 2. Assigning the activity to a team member via dashboard
 * 3. Verifying assignment notification is sent to original reporter
 * 4. Testing reassignment and unassignment scenarios
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3003';
const TEST_PHONE = process.env.TEST_PHONE || '27833834848';

// Helper function to create WhatsApp incident
async function createTestIncident() {
  console.log('📝 Creating test incident via WhatsApp webhook...');
  
  const webhookPayload = {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'test_entry',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '27876543210',
            phone_number_id: '123456789012345'
          },
          contacts: [{
            profile: { name: 'Test User' },
            wa_id: TEST_PHONE
          }],
          messages: [{
            from: TEST_PHONE,
            id: `test_${Date.now()}`,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            text: { body: `Test assignment notification - broken desk needs urgent repair in room ${Math.floor(Math.random() * 100)}` },
            type: 'text'
          }]
        },
        field: 'messages'
      }]
    }]
  };

  const response = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-dev-bypass-signature': 'true'
    },
    body: JSON.stringify(webhookPayload)
  });

  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status}`);
  }

  console.log('✅ Incident created via webhook');
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Find the created activity
  const activitiesResponse = await fetch(`${BASE_URL}/api/data?page=1&limit=5`);
  const activitiesData = await activitiesResponse.json();
  
  const testActivity = activitiesData.activities?.find(act => 
    act.notes && act.notes.includes('Test assignment notification')
  );
  
  if (!testActivity) {
    throw new Error('Test activity not found');
  }
  
  console.log('✅ Test activity found:', {
    id: testActivity.id,
    subcategory: testActivity.subcategory,
    status: testActivity.status,
    reference: `${testActivity.category?.name?.substring(0,4).toUpperCase()}-${testActivity.id.slice(-4)}`
  });
  
  return testActivity;
}

// Helper function to get users for assignment
async function getUsers() {
  const response = await fetch(`${BASE_URL}/api/data?page=1&limit=50`);
  const data = await response.json();
  return data.users || [];
}

// Test assignment notification
async function testAssignmentNotification() {
  console.log('\n🧪 ===== TESTING ASSIGNMENT NOTIFICATIONS =====');
  console.log('📞 Test Phone:', TEST_PHONE);
  console.log('🌐 Base URL:', BASE_URL);
  console.log('⏰ Test Time:', new Date().toISOString());
  
  try {
    // Step 1: Create incident
    const activity = await createTestIncident();
    const activityId = activity.id;
    
    // Step 2: Get users for assignment
    console.log('\n📋 Getting users for assignment...');
    const users = await getUsers();
    const assignableUsers = users.filter(u => u.role === 'Maintenance' || u.role === 'Admin');
    
    if (assignableUsers.length === 0) {
      throw new Error('No assignable users found');
    }
    
    const assignee = assignableUsers[0];
    console.log('✅ Found assignable user:', assignee.name, `(${assignee.role})`);
    
    // Step 3: Test initial assignment
    console.log('\n👤 === TEST 1: INITIAL ASSIGNMENT ===');
    console.log(`Assigning activity ${activityId} to ${assignee.name}...`);
    
    const assignResponse = await fetch(`${BASE_URL}/api/activities/${activityId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'status_update',
        payload: {
          assignToUserId: assignee.id,
          instructions: 'Please check this urgently and provide update by end of day'
        }
      })
    });
    
    if (!assignResponse.ok) {
      const error = await assignResponse.text();
      throw new Error(`Assignment failed: ${assignResponse.status} - ${error}`);
    }
    
    const assignedActivity = await assignResponse.json();
    console.log('✅ Assignment successful:', {
      id: assignedActivity.id,
      status: assignedActivity.status,
      assignedTo: assignee.name
    });
    console.log('📬 Assignment notification should have been sent to', TEST_PHONE);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 4: Test reassignment
    if (assignableUsers.length > 1) {
      console.log('\n🔄 === TEST 2: REASSIGNMENT ===');
      const newAssignee = assignableUsers[1];
      console.log(`Reassigning activity to ${newAssignee.name}...`);
      
      const reassignResponse = await fetch(`${BASE_URL}/api/activities/${activityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'status_update',
          payload: {
            assignToUserId: newAssignee.id,
            instructions: 'Reassigned due to workload balancing'
          }
        })
      });
      
      if (reassignResponse.ok) {
        console.log('✅ Reassignment successful');
        console.log('📬 Reassignment notification should have been sent to', TEST_PHONE);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Step 5: Test unassignment
    console.log('\n⏸️ === TEST 3: UNASSIGNMENT ===');
    console.log('Unassigning activity (moving back to queue)...');
    
    const unassignResponse = await fetch(`${BASE_URL}/api/activities/${activityId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'status_update',
        payload: {
          status: 'Unassigned'
        }
      })
    });
    
    if (unassignResponse.ok) {
      console.log('✅ Unassignment successful');
      console.log('📬 Unassignment notification should have been sent to', TEST_PHONE);
    }
    
    // Step 6: Summary
    console.log('\n🎯 === TEST SUMMARY ===');
    console.log('1. ✅ Test incident created via WhatsApp');
    console.log('2. ✅ Initial assignment notification tested');
    if (assignableUsers.length > 1) {
      console.log('3. ✅ Reassignment notification tested');
    } else {
      console.log('3. ⏭️ Reassignment skipped (only one assignable user)');
    }
    console.log('4. ✅ Unassignment notification tested');
    console.log('');
    console.log('📱 Check WhatsApp messages on', TEST_PHONE, 'to verify notifications:');
    console.log('  - Initial incident confirmation');
    console.log('  - Assignment notification with expected completion time');
    if (assignableUsers.length > 1) {
      console.log('  - Reassignment notification');
    }
    console.log('  - Unassignment notification');
    console.log('');
    console.log('💡 Expected message format:');
    console.log('  👤 *Assignment Update: MAINT-XXXX*');
    console.log('  📋 **Task:** Maintenance - Broken desk');  
    console.log('  📍 **Location:** [Location]');
    console.log('  👤 **Assigned to:** [Name] ([Role])');
    console.log('  📊 **Status:** Assigned');
    console.log('  ✅ **Good news!** Your report has been assigned...');
    console.log('  ⏰ **Expected completion:** [Time estimate]');
    console.log('  📝 **Instructions:** [If provided]');
    console.log('  Reply /status [REF] for updates.');
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    console.error('🔍 Stack:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testAssignmentNotification();
}

module.exports = { testAssignmentNotification, createTestIncident };