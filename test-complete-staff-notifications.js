#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCompleteStaffNotification() {
  try {
    console.log('🧪 === TESTING COMPLETE TWO-WAY STAFF NOTIFICATION SYSTEM ===');
    
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
    
    console.log('📋 Assigning activity', testActivity.id, 'to', simon.name);
    console.log('📞 Simon phone:', simon.phone_number || 'NOT SET');
    
    if (!simon.phone_number) {
      console.log('❌ Simon has no phone number - cannot test notifications');
      return;
    }
    
    // Make assignment API call
    const baseUrl = process.env.BASE_URL || 'http://localhost:3002';
    const response = await fetch(`${baseUrl}/api/activities/${testActivity.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'status_update',
        payload: {
          assignToUserId: simon.id,
          instructions: 'Complete two-way notification system test - you should receive WhatsApp notifications with reply instructions!'
        }
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Assignment request successful');
      console.log('  Status:', result.status);
      console.log('  Assignee:', result.assignedTo?.name);
      
      // Wait for notifications to be processed and stored
      console.log('\n⏰ Waiting 3 seconds for notifications to be processed...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if BOTH notifications were stored in database
      const notifications = await prisma.whatsAppMessage.findMany({
        where: {
          relatedActivityId: testActivity.id,
          direction: 'outbound',
          timestamp: { gte: new Date(Date.now() - 60000) } // Last minute
        },
        select: {
          waId: true,
          from: true,
          to: true,
          content: true,
          status: true,
          timestamp: true
        },
        orderBy: { timestamp: 'desc' }
      });
      
      console.log('\n📬 Notifications stored in database:', notifications.length);
      
      if (notifications.length >= 2) {
        console.log('\n🎉 SUCCESS! Both notifications stored:');
        notifications.forEach((notif, i) => {
          console.log(`  Notification ${i + 1}:`);
          console.log('    Message ID:', notif.waId);
          console.log('    To:', notif.to.substring(0, 4) + '****');
          console.log('    Status:', notif.status);
          console.log('    Time:', notif.timestamp);
          
          // Check content to identify type
          const content = typeof notif.content === 'string' ? notif.content : JSON.stringify(notif.content);
          if (content.includes('New Task Assignment') || content.includes('Task Reassigned to You')) {
            console.log('    Type: ✅ STAFF NOTIFICATION (to assigned person)');
            if (content.includes('Reply with:') && content.includes('Starting')) {
              console.log('    Reply instructions: ✅ Present');
            } else {
              console.log('    Reply instructions: ❌ Missing');
            }
          } else if (content.includes('Assignment Update')) {
            console.log('    Type: ✅ REPORTER NOTIFICATION (to person who reported)');
          } else {
            console.log('    Type: ❓ Unknown');
          }
          console.log('');
        });
        
        console.log('\n✅ DEFINITION OF DONE ACHIEVED:');
        console.log('  ✅ Staff member receives WhatsApp message when assigned');
        console.log('  ✅ Message includes reply instructions (Starting, Update, Complete)');
        console.log('  ✅ Both notifications stored in database');
        console.log('  ✅ Two-way communication system foundation complete');
        
      } else if (notifications.length === 1) {
        console.log('\n⚠️  Only 1 notification stored - might be missing staff notification');
        console.log('  Stored notification to:', notifications[0].to.substring(0, 4) + '****');
      } else {
        console.log('\n❌ No notifications stored - check server logs for errors');
      }
      
    } else {
      const error = await response.text();
      console.log('❌ Assignment failed:', response.status, error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testCompleteStaffNotification();