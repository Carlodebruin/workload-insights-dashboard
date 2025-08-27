#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAssignmentSaving() {
  try {
    console.log('🔍 === DATABASE ASSIGNMENT AUDIT ===');
    
    // Get the most recent test activity
    const testActivity = await prisma.activity.findFirst({
      where: {
        notes: { contains: 'Test assignment notification' }
      },
      orderBy: { timestamp: 'desc' },
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        user: { select: { name: true, phone_number: true } },
        category: { select: { name: true } }
      }
    });
    
    if (!testActivity) {
      console.log('❌ No test activity found');
      return;
    }
    
    console.log('📋 Test Activity Found:');
    console.log('  ID:', testActivity.id);
    console.log('  Status:', testActivity.status);
    console.log('  Assigned To:', testActivity.assignedTo?.name || 'NONE');
    console.log('  Assignment Instructions:', testActivity.assignment_instructions || 'NONE');
    console.log('  Reporter:', testActivity.user.name);
    
    // Check for related WhatsApp messages
    const relatedMessages = await prisma.whatsAppMessage.findMany({
      where: {
        relatedActivityId: testActivity.id
      },
      orderBy: { timestamp: 'desc' },
      select: {
        direction: true,
        content: true,
        status: true,
        timestamp: true,
        from: true,
        to: true
      }
    });
    
    console.log('\n📬 Related WhatsApp Messages:', relatedMessages.length);
    relatedMessages.forEach((msg, i) => {
      console.log(`  Message ${i+1}:`);
      console.log('    Direction:', msg.direction);
      console.log('    Status:', msg.status);
      console.log('    Time:', msg.timestamp);
      console.log('    From/To:', msg.direction === 'inbound' ? msg.from : msg.to);
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      console.log('    Content Preview:', content.substring(0, 100) + '...');
      console.log('');
    });
    
    // Test assignment update
    console.log('🧪 === TESTING DIRECT ASSIGNMENT ===');
    const users = await prisma.user.findMany({
      where: { role: { in: ['Admin', 'Maintenance'] } },
      select: { id: true, name: true, role: true }
    });
    
    if (users.length > 0) {
      const assignee = users[0];
      console.log('Assigning to:', assignee.name);
      
      const updateResult = await prisma.activity.update({
        where: { id: testActivity.id },
        data: {
          assigned_to_user_id: assignee.id,
          assignment_instructions: 'Database audit test assignment',
          status: 'Assigned'
        },
        include: {
          assignedTo: { select: { name: true, role: true } }
        }
      });
      
      console.log('✅ Assignment update successful:');
      console.log('  Status:', updateResult.status);
      console.log('  Assignee:', updateResult.assignedTo?.name);
      console.log('  Instructions:', updateResult.assignment_instructions);
    }
    
    // Test API endpoint functionality
    console.log('\n🌐 === TESTING API ENDPOINT ===');
    const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';
    
    const assignmentPayload = {
      type: 'status_update',
      payload: {
        assignToUserId: users[0]?.id,
        instructions: 'API endpoint test assignment'
      }
    };
    
    console.log('Testing assignment via API...');
    const apiResponse = await fetch(`${BASE_URL}/api/activities/${testActivity.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assignmentPayload)
    });
    
    if (apiResponse.ok) {
      const result = await apiResponse.json();
      console.log('✅ API assignment successful:', {
        status: result.status,
        assignedTo: result.assignedTo?.name
      });
    } else {
      console.log('❌ API assignment failed:', apiResponse.status, await apiResponse.text());
    }
    
  } catch (error) {
    console.error('❌ Database audit failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testAssignmentSaving();