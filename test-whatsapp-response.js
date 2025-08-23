#!/usr/bin/env node

// Test WhatsApp response system
console.log('🧪 Testing WhatsApp Response System...');

// Test the webhook with a non-incident message
const testMessage = {
  from: '27833834848',
  text: { body: 'hello' },
  type: 'text',
  id: 'test_' + Date.now(),
  timestamp: Math.floor(Date.now() / 1000).toString()
};

console.log('📝 Sending test message:', testMessage.text.body);
console.log('📞 Expected response: Greeting message');
console.log('⏰ Check your WhatsApp in 10-15 seconds...');

// Send to production webhook
fetch('https://workload-insights-dashboard.vercel.app/api/whatsapp/webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Hub-Signature-256': 'test-signature'
  },
  body: JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      id: 'test',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: { phone_number_id: '7393473592441' },
          messages: [testMessage]
        },
        field: 'messages'
      }]
    }]
  })
})
.then(r => r.json())
.then(result => {
  console.log('✅ Webhook response:', result);
})
.catch(err => {
  console.log('❌ Webhook error:', err.message);
});