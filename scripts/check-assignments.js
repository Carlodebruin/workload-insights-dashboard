#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAssignments() {
  console.log('🔍 Checking ActivityAssignment records...');
  
  try {
    const assignments = await prisma.activityAssignment.findMany({
      select: {
        id: true,
        activity_id: true,
        user_id: true,
        assigned_at: true
      },
      orderBy: {
        assigned_at: 'desc'
      }
    });
    
    console.log(`📊 Found ${assignments.length} ActivityAssignment records:`);
    
    if (assignments.length > 0) {
      console.log('\nFirst 5 records:');
      assignments.slice(0, 5).forEach((assignment, index) => {
        console.log(`  ${index + 1}. Activity: ${assignment.activity_id}, User: ${assignment.user_id}, Created: ${assignment.assigned_at}`);
      });
      
      if (assignments.length > 5) {
        console.log(`  ... and ${assignments.length - 5} more records`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking assignments:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAssignments();