#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testTwilioAIParsing() {
  try {
    console.log('🧪 === TESTING TWILIO AI PARSING ===');
    
    // Test the AI parsing endpoint directly first
    console.log('1️⃣ Testing AI parsing endpoint directly...');
    
    const categories = await prisma.category.findMany({
      select: { id: true, name: true, isSystem: true }
    });
    
    console.log('Categories available:', categories.length);
    
    const formData = new FormData();
    formData.append('message', 'Broken desk in classroom B');
    formData.append('categories', JSON.stringify(categories));
    
    const aiResponse = await fetch('http://localhost:3002/api/ai/parse', {
      method: 'POST',
      body: formData
    });
    
    console.log('AI endpoint response status:', aiResponse.status, aiResponse.statusText);
    
    if (aiResponse.ok) {
      const result = await aiResponse.json();
      console.log('✅ AI parsing successful:', result);
    } else {
      const errorText = await aiResponse.text();
      console.log('❌ AI parsing failed:', errorText);
    }
    
    console.log('\n2️⃣ Testing Twilio webhook with simulated message...');
    
    // Test the Twilio webhook endpoint with a simulated message
    const twilioFormData = new FormData();
    twilioFormData.append('MessageSid', 'test_' + Date.now());
    twilioFormData.append('From', 'whatsapp:+27833834848');
    twilioFormData.append('To', 'whatsapp:+15551234567');
    twilioFormData.append('Body', 'Broken desk in classroom B');
    twilioFormData.append('ProfileName', 'Test User');
    twilioFormData.append('WaId', '27833834848');
    
    const webhookResponse = await fetch('http://localhost:3002/api/twilio/webhook', {
      method: 'POST',
      body: twilioFormData
    });
    
    console.log('Twilio webhook response status:', webhookResponse.status, webhookResponse.statusText);
    
    if (webhookResponse.ok) {
      const result = await webhookResponse.json();
      console.log('✅ Twilio webhook successful:', result);
    } else {
      const errorText = await webhookResponse.text();
      console.log('❌ Twilio webhook failed:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testTwilioAIParsing();