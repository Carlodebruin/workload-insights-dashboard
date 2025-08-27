#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkWhatsAppUsers() {
  try {
    console.log('🔍 === WHATSAPP USERS IN DATABASE ===');
    
    const users = await prisma.whatsAppUser.findMany({
      select: { phoneNumber: true, displayName: true }
    });
    
    console.log('✅ Valid WhatsApp Users (for foreign key reference):');
    users.forEach(user => {
      console.log(`  - ${user.phoneNumber} (${user.displayName})`);
    });
    
    // Check what the system should use as 'from' for outbound messages
    const systemPhone = process.env.WHATSAPP_PHONE_NUMBER_ID || 'system';
    console.log(`\n🔍 Current system phone: ${systemPhone}`);
    
    // Check if system phone exists in users
    const systemUser = users.find(u => u.phoneNumber === systemPhone);
    console.log(`System phone exists in DB: ${!!systemUser}`);
    
    // Check recent outbound messages to see what 'from' values work
    const recentOutbound = await prisma.whatsAppMessage.findMany({
      where: { direction: 'outbound' },
      orderBy: { timestamp: 'desc' },
      take: 5,
      select: { from: true, status: true, timestamp: true }
    });
    
    console.log('\n📬 Recent outbound messages "from" values:');
    recentOutbound.forEach((msg, i) => {
      console.log(`  ${i+1}. From: "${msg.from}" - Status: ${msg.status}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkWhatsAppUsers();