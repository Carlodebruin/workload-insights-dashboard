#!/usr/bin/env node

/**
 * Test Twilio WhatsApp Message Script
 * Sends a test message to verify integration is working
 */

// Using built-in fetch (Node.js 18+)

async function testTwilioMessage() {
  console.log('🧪 Testing Twilio WhatsApp Message Integration');
  console.log('=' .repeat(50));
  
  const testData = {
    to: "+27815761685",
    message: "Hello from Twilio! Your WhatsApp integration is working correctly."
  };

  console.log('📞 Sending to:', testData.to);
  console.log('📝 Message:', testData.message);
  console.log('⏰ Time:', new Date().toISOString());
  console.log('');

  try {
    console.log('⏳ Making POST request to /api/twilio/test...');
    
    const response = await fetch('http://localhost:3000/api/twilio/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();

    console.log('📊 Response Status:', response.status);
    console.log('✅ Response OK:', response.ok);
    console.log('');

    if (response.ok && result.success) {
      console.log('🎉 === SUCCESS ===');
      console.log('✅ Message sent successfully!');
      console.log('📨 Message SID:', result.messageSid);
      console.log('📊 Status:', result.status);
      console.log('');
      console.log('📱 Check your WhatsApp (+27815761685) for the test message!');
      
      if (result.nextSteps) {
        console.log('');
        console.log('📋 Next Steps:');
        result.nextSteps.forEach((step, i) => {
          console.log(`  ${i + 1}. ${step}`);
        });
      }
    } else {
      console.log('❌ === FAILURE ===');
      console.log('🔍 Success:', result.success);
      console.log('❌ Error:', result.error);
      
      if (result.errorCode) {
        console.log('📊 Error Code:', result.errorCode);
      }

      if (result.troubleshooting) {
        console.log('');
        console.log('🛠️ Troubleshooting:');
        
        if (result.troubleshooting.commonIssues) {
          console.log('');
          console.log('📋 Common Issues:');
          result.troubleshooting.commonIssues.forEach((issue, i) => {
            console.log(`  ${i + 1}. ${issue}`);
          });
        }

        if (result.troubleshooting.nextSteps) {
          console.log('');
          console.log('🔧 Next Steps:');
          result.troubleshooting.nextSteps.forEach((step, i) => {
            console.log(`  ${i + 1}. ${step}`);
          });
        }
      }
    }

    console.log('');
    console.log('📄 Raw Response:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.log('💥 === REQUEST FAILED ===');
    console.log('❌ Error:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('');
      console.log('🌐 Connection Error:');
      console.log('  • Make sure your development server is running');
      console.log('  • Try: npm run dev');
      console.log('  • Ensure port 3000 is available');
    }
  }

  console.log('');
  console.log('🏁 Test completed!');
}

testTwilioMessage().catch(console.error);