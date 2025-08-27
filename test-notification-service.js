async function testNotificationService() {
  console.log('🧪 === TESTING ACTUAL NOTIFICATION SERVICE ===');
  
  try {
    // Create a test assignment via the API that should trigger notifications
    console.log('\n📋 Creating test assignment...');
    
    // First, get an activity to assign
    const activitiesResponse = await fetch('http://localhost:3002/api/activities');
    const activities = await activitiesResponse.json();
    
    // Find an unassigned activity
    const unassignedActivity = activities.find(a => 
      a.status === 'Open' && !a.assigned_to_user_id
    );
    
    if (!unassignedActivity) {
      console.log('❌ No unassigned activities found');
      return;
    }
    
    console.log(`📝 Selected activity: ${unassignedActivity.id.substring(0, 8)} - ${unassignedActivity.subcategory}`);
    
    // Get users to find a staff member to assign to
    const usersResponse = await fetch('http://localhost:3002/api/users');
    const users = await usersResponse.json();
    
    const staffMember = users.find(u => 
      (u.role === 'Maintenance' || u.role === 'Admin') && u.phone_number
    );
    
    if (!staffMember) {
      console.log('❌ No staff member with phone number found');
      return;
    }
    
    console.log(`👤 Assigning to: ${staffMember.name} (${staffMember.phone_number})`);
    
    // Make assignment API call that should trigger notification
    const assignmentData = {
      type: 'status_update',
      payload: {
        assignToUserId: staffMember.id,
        instructions: 'Test notification service - you should receive a WhatsApp message!'
      }
    };
    
    const assignResponse = await fetch(`http://localhost:3002/api/activities/${unassignedActivity.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(assignmentData)
    });
    
    console.log('\n📡 Assignment API Response:', assignResponse.status, assignResponse.ok ? '✅' : '❌');
    
    if (assignResponse.ok) {
      const result = await assignResponse.json();
      console.log('✅ Assignment successful');
      console.log(`   Activity: ${result.id?.substring(0, 8)}`);
      console.log(`   Assigned to: ${result.assignedTo?.name}`);
      console.log(`   Status: ${result.status}`);
      
      // Wait a moment for notification processing
      console.log('\n⏰ Waiting 3 seconds for notification processing...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('\n✅ STAFF NOTIFICATION TEST COMPLETED');
      console.log('📱 Check server logs for notification sending details');
      console.log('📲 Staff member should receive WhatsApp notification');
      console.log('🎯 Notification includes reference number and reply instructions');
      
    } else {
      const error = await assignResponse.text();
      console.log('❌ Assignment failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testNotificationService();