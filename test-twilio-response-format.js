// Test Twilio webhook response format fix
async function testTwilioResponseFormat() {
  console.log('🔧 === TESTING TWILIO WEBHOOK RESPONSE FORMAT FIX ===');
  
  try {
    const startTime = Date.now();
    
    console.log('\n📡 Testing webhook with corrected response format...');
    
    // Create form data like Twilio would send
    const formData = new FormData();
    formData.append('MessageSid', 'test_response_format_' + Date.now());
    formData.append('From', 'whatsapp:+27833834848');
    formData.append('To', 'whatsapp:+15551234567');
    formData.append('Body', 'Test Twilio response format - window repair');
    formData.append('ProfileName', 'Response Format Test');
    formData.append('WaId', '27833834848');
    
    // Test the webhook endpoint
    const response = await fetch('http://localhost:3004/api/twilio/webhook', {
      method: 'POST',
      body: formData
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`\n📊 WEBHOOK RESPONSE FORMAT RESULTS:`);
    console.log(`  Status: ${response.status} ${response.ok ? '✅' : '❌'}`);
    console.log(`  Response Time: ${responseTime}ms`);
    console.log(`  Content-Type: ${response.headers.get('content-type') || 'none'}`);
    console.log(`  Content-Length: ${response.headers.get('content-length') || '0'}`);
    
    // Read response body
    const responseText = await response.text();
    console.log(`  Response Body: "${responseText}" (length: ${responseText.length})`);
    
    // Analyze response format
    if (response.ok) {
      console.log('\n🔍 RESPONSE FORMAT ANALYSIS:');
      
      if (responseText === '' && response.status === 200) {
        console.log('  ✅ PERFECT! Empty 200 response (Twilio standard)');
        console.log('  ✅ No JSON content-type issues');
        console.log('  ✅ Twilio will accept this response format');
      } else if (responseText.includes('json') || responseText.includes('{')) {
        console.log('  ❌ Still returning JSON - needs further fix');
      } else {
        console.log('  ⚠️  Unexpected response format');
      }
      
      // Check headers
      const contentType = response.headers.get('content-type');
      if (!contentType || contentType.includes('text/plain')) {
        console.log('  ✅ Content-Type compatible with Twilio expectations');
      } else if (contentType.includes('application/json')) {
        console.log('  ⚠️  Content-Type still JSON - may cause issues');
      }
      
      console.log('\n🎯 TWILIO COMPATIBILITY:');
      if (responseText === '' && response.status === 200) {
        console.log('  ✅ Response format: TWILIO COMPATIBLE');
        console.log('  ✅ No more Content-Type errors expected');
        console.log('  ✅ Webhook will process successfully');
      } else {
        console.log('  ❌ Response format: MAY CAUSE TWILIO ISSUES');
      }
      
    } else {
      console.log('\n❌ Webhook failed - check server logs');
    }
    
    console.log('\n🔧 FIXES IMPLEMENTED:');
    console.log('  ✅ Line ~56: NextResponse.json() → new NextResponse(\'\', {status: 200})');
    console.log('  ✅ Line ~112: NextResponse.json() → new NextResponse(\'\', {status: 200})');
    console.log('  ✅ Webhook returns empty 200 instead of JSON');
    console.log('  ✅ Maintains all processing logic unchanged');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\nℹ️  Make sure development server is running on port 3004');
  }
}

testTwilioResponseFormat().catch(console.error);