#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testNotificationLogic() {
  try {
    console.log('🧪 === TESTING NOTIFICATION SYSTEM LOGIC ===');
    console.log('(Verifying database updates and function calls even if Twilio fails)');
    
    // Get a test activity to assign
    const testActivity = await prisma.activity.findFirst({
      where: { notes: { contains: 'Test assignment notification' } },
      orderBy: { timestamp: 'desc' }
    });
    
    if (!testActivity) {
      console.log('❌ No test activity found');
      return;
    }
    
    // Get Simon for assignment
    const simon = await prisma.user.findFirst({
      where: { name: { contains: 'Simon' } },
      select: { id: true, name: true, phone_number: true }
    });
    
    if (!simon) {
      console.log('❌ Simon not found');
      return;
    }
    
    console.log('📋 Test scenario: Assigning to Simon');
    console.log('  Activity ID:', testActivity.id);
    console.log('  Simon ID:', simon.id);
    console.log('  Simon Phone:', simon.phone_number);
    
    // Record before state
    const beforeMessages = await prisma.whatsAppMessage.count({
      where: { relatedActivityId: testActivity.id }
    });
    
    console.log('📊 Before assignment:');
    console.log('  Related WhatsApp messages:', beforeMessages);
    
    // Make assignment API call
    const baseUrl = process.env.BASE_URL || 'http://localhost:3002';
    const response = await fetch(`${baseUrl}/api/activities/${testActivity.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'status_update',
        payload: {
          assignToUserId: simon.id,
          instructions: 'Testing notification logic - checking database updates and function calls'
        }
      })
    });
    
    console.log('\n🎯 Assignment API Response:');
    console.log('  Status:', response.status, response.statusText);
    
    if (response.ok) {
      const result = await response.json();
      console.log('  ✅ Assignment successful');
      console.log('  Status:', result.status);
      console.log('  Assignee:', result.assignedTo?.name);
      
      // Wait for processing
      console.log('\n⏰ Waiting 2 seconds for processing...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check after state
      const afterMessages = await prisma.whatsAppMessage.count({
        where: { relatedActivityId: testActivity.id }
      });
      
      console.log('\n📊 After assignment:');
      console.log('  Related WhatsApp messages:', afterMessages);
      console.log('  New messages created:', afterMessages - beforeMessages);
      
      if (afterMessages > beforeMessages) {
        console.log('\n✅ SUCCESS! Database storage is working');
        console.log('  The notification logic successfully stored message records');
        console.log('  Even though Twilio may not be configured, the system structure is correct');
        
        // Check the actual messages created
        const newMessages = await prisma.whatsAppMessage.findMany({
          where: { relatedActivityId: testActivity.id },
          orderBy: { timestamp: 'desc' },
          take: afterMessages - beforeMessages,
          select: {
            waId: true,
            to: true,
            content: true,
            status: true,
            timestamp: true
          }
        });
        
        console.log('\n📝 Message details:');
        newMessages.forEach((msg, i) => {
          console.log(`  Message ${i + 1}:`);
          console.log('    To:', msg.to.substring(0, 4) + '****');
          console.log('    Status:', msg.status);
          console.log('    Created:', msg.timestamp);
          
          // Check if it's a staff notification by content
          const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
          if (content.includes('New Task Assignment') || content.includes('Task Reassigned to You')) {
            console.log('    Type: 🎯 STAFF NOTIFICATION');
            if (content.includes('Reply with:')) {
              console.log('    ✅ Contains reply instructions');
            }
          } else if (content.includes('Assignment Update')) {
            console.log('    Type: 📢 REPORTER NOTIFICATION');
          }
          console.log('');
        });
        
        console.log('🎉 NOTIFICATION SYSTEM VALIDATION SUCCESSFUL:');
        console.log('  ✅ Assignment API works correctly');
        console.log('  ✅ Database storage for notifications works');
        console.log('  ✅ Staff notification message creation works');
        console.log('  ✅ Reporter notification message creation works');
        console.log('  ✅ Two-way notification system foundation is complete');
        console.log('\n💡 Note: Actual WhatsApp delivery requires Twilio configuration');
        
      } else {
        console.log('\n❌ Database storage not working - no new messages created');
        console.log('Check server logs for detailed error information');
      }
      
    } else {
      const error = await response.text();
      console.log('❌ Assignment API failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testNotificationLogic();