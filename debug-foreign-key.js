#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugForeignKey() {
  try {
    console.log('🔍 === DEBUGGING PHONE NUMBER FOREIGN KEY ===');
    
    // Check environment variable
    const envPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
    console.log('WHATSAPP_PHONE_NUMBER_ID env var:', envPhone || 'NOT SET');
    
    // Phone number that would be used as 'from'
    const fromPhone = envPhone || '27833834848';
    console.log('Phone that would be used as from:', fromPhone);
    
    // Check if phone exists in WhatsAppUser table
    const userExists = await prisma.whatsAppUser.findUnique({
      where: { phoneNumber: fromPhone },
      select: { phoneNumber: true, displayName: true }
    });
    
    console.log('Phone exists in WhatsAppUser table:', !!userExists);
    if (userExists) {
      console.log('  Display name:', userExists.displayName);
    }
    
    // Show all valid WhatsApp users
    const allUsers = await prisma.whatsAppUser.findMany({
      select: { phoneNumber: true, displayName: true }
    });
    
    console.log('\n📱 All valid WhatsApp users:');
    allUsers.forEach(user => {
      console.log(`  - '${user.phoneNumber}' (${user.displayName})`);
    });
    
    // Test direct message creation
    console.log('\n🧪 Testing direct WhatsApp message creation:');
    
    try {
      const testMessage = await prisma.whatsAppMessage.create({
        data: {
          waId: 'test_' + Date.now(),
          from: fromPhone,
          to: '27833834848',
          type: 'text',
          content: 'Test message',
          timestamp: new Date(),
          direction: 'outbound',
          status: 'sent',
          isFreeMessage: false,
          processed: true
        }
      });
      
      console.log('✅ Direct message creation successful:', testMessage.waId);
      
      // Clean up test message
      await prisma.whatsAppMessage.delete({ where: { waId: testMessage.waId } });
      console.log('✅ Test message cleaned up');
      
    } catch (createError) {
      console.log('❌ Direct message creation failed:', createError.message);
      
      // Try with a different phone number
      const alternativePhone = '27833834848';
      console.log(`\n🔄 Trying with alternative phone: ${alternativePhone}`);
      
      try {
        const testMessage2 = await prisma.whatsAppMessage.create({
          data: {
            waId: 'test2_' + Date.now(),
            from: alternativePhone,
            to: alternativePhone,
            type: 'text',
            content: 'Test message 2',
            timestamp: new Date(),
            direction: 'outbound',
            status: 'sent',
            isFreeMessage: false,
            processed: true
          }
        });
        
        console.log('✅ Alternative phone worked:', testMessage2.waId);
        await prisma.whatsAppMessage.delete({ where: { waId: testMessage2.waId } });
        
      } catch (altError) {
        console.log('❌ Alternative phone also failed:', altError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugForeignKey();