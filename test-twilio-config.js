#!/usr/bin/env node

// Test if Twilio configuration is working
const { twilioClient } = require('./lib/twilio');

async function testTwilioConfig() {
  try {
    console.log('🧪 === TESTING TWILIO CONFIGURATION ===');
    
    // Test configuration
    const configTest = await twilioClient.testConfiguration();
    
    if (configTest.success) {
      console.log('✅ Twilio configuration is valid');
      console.log('  Account SID:', configTest.details?.accountSid);
      console.log('  Account Status:', configTest.details?.accountStatus);
      console.log('  Account Name:', configTest.details?.friendlyName);
    } else {
      console.log('❌ Twilio configuration failed:', configTest.error);
      return;
    }
    
    // Test sending a simple message
    console.log('\n📱 Testing WhatsApp message send...');
    const result = await twilioClient.sendWhatsAppMessage(
      '+27793265020', // Simon's phone number
      'Test message from notification system - configuration check',
      { test: true }
    );
    
    if (result.success) {
      console.log('✅ Test message sent successfully');
      console.log('  Message SID:', result.messageSid);
      console.log('  Status:', result.status);
    } else {
      console.log('❌ Test message failed:', result.error);
      console.log('  Error code:', result.errorCode);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testTwilioConfig();