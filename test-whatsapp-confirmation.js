async function testWhatsAppConfirmation() {
  console.log('🧪 === TESTING WHATSAPP CONFIRMATION MESSAGES ===');
  
  // Get activity count before
  console.log('\n📊 Testing WhatsApp webhook with confirmation messages');
  
  // Test message: "Clean windows in classroom A"
  const testPayload = {
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "test_entry",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp", 
          "metadata": {
            "display_phone_number": "15551234567",
            "phone_number_id": "test_phone_number_id"
          },
          "contacts": [{
            "profile": {
              "name": "Test User Confirmation"
            },
            "wa_id": "27833834848"
          }],
          "messages": [{
            "from": "27833834848",
            "id": "test_confirm_" + Date.now(),
            "timestamp": Math.floor(Date.now() / 1000).toString(),
            "type": "text",
            "text": {
              "body": "Clean windows in classroom A"
            }
          }]
        },
        "field": "messages"
      }]
    }]
  };
  
  console.log('\n📱 Test message: "Clean windows in classroom A"');
  console.log('📞 From: 27833834848');
  
  try {
    const response = await fetch('http://localhost:3002/api/whatsapp-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log('\n🌐 Webhook Response:', response.status, response.ok ? '✅' : '❌');
    
    if (response.ok) {
      const result = await response.json();
      console.log('Response body:', result);
      
      // Wait for processing and message sending
      console.log('\n⏰ Waiting 5 seconds for complete processing...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('\n✅ TEST COMPLETED - Check server logs for:');
      console.log('  🤖 AI parsing results');
      console.log('  📋 Activity creation');
      console.log('  📨 Confirmation message sending');
      console.log('  💾 Database storage');
      
      console.log('\n🎯 EXPECTED BEHAVIOR:');
      console.log('  1. Message received and stored');
      console.log('  2. AI parser extracts: Category=Maintenance, Location=Classroom A');
      console.log('  3. Activity created with "Open" status');
      console.log('  4. Confirmation message sent back to 27833834848');
      console.log('  5. Confirmation includes activity reference number');
      
    } else {
      const error = await response.text();
      console.log('❌ Webhook failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWhatsAppConfirmation();
