#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getValidUsers() {
  try {
    console.log('🔍 === VALID USERS IN DATABASE ===');
    
    const users = await prisma.user.findMany({
      where: { role: { in: ['Admin', 'Maintenance'] } },
      select: { id: true, name: true, role: true, phone_number: true }
    });
    
    console.log('✅ Valid assignable users:');
    users.forEach(user => {
      console.log(`  - ${user.name} (${user.role}): ${user.id}`);
    });
    
    // Test the problematic user ID
    const problematicId = 'cmekqpfo0006s1ffmofjrvn';
    const userExists = await prisma.user.findUnique({
      where: { id: problematicId },
      select: { id: true, name: true }
    });
    
    console.log(`\n🔍 Problematic ID ${problematicId}:`);
    console.log(userExists ? `✅ EXISTS: ${userExists.name}` : '❌ DOES NOT EXIST');
    
    // Also check the correct Cassim ID that we know works
    const cassimUsers = await prisma.user.findMany({
      where: { name: { contains: 'Cassim' } },
      select: { id: true, name: true, role: true }
    });
    
    console.log('\n🔍 Cassim user records:');
    cassimUsers.forEach(user => {
      console.log(`  - ${user.name} (${user.role}): ${user.id}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getValidUsers();