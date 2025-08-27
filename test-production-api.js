#!/usr/bin/env node

/**
 * Test Production WhatsApp API
 * This script directly calls your production API endpoint to test WhatsApp messaging
 * and shows the enhanced logging results
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🧪 WhatsApp Production API Test');
console.log('=' .repeat(40));
console.log('');

// Default values
let phoneNumber = '27833834848';
let message = 'Test message from production API';

async function promptUser() {
  return new Promise((resolve) => {
    rl.question(`📞 Phone number (default: ${phoneNumber}): `, (phone) => {
      if (phone.trim()) phoneNumber = phone.trim();
      
      rl.question(`📝 Test message (default: "${message}"): `, (msg) => {
        if (msg.trim()) message = msg.trim();
        resolve();
      });
    });
  });
}

async function testAPI() {
  const baseUrl = 'https://workload-insights-dashboard-917jhwaum-carlo-de-bruins-projects.vercel.app';
  const params = new URLSearchParams({
    phone: phoneNumber,
    message: message
  });
  
  const apiUrl = `${baseUrl}/api/test-whatsapp-send?${params}`;
  
  console.log('\n🚀 Testing WhatsApp API...');
  console.log('📍 URL:', apiUrl);
  console.log('📞 Phone:', phoneNumber);
  console.log('📝 Message:', message);
  console.log('');
  
  try {
    console.log('⏳ Making request to production API...');
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    console.log('\n📊 === RESPONSE ANALYSIS ===');
    console.log('📊 Status Code:', response.status);
    console.log('✅ Success:', response.ok);
    
    if (response.ok) {
      console.log('\n🎉 === SUCCESS ===');
      if (data.success) {
        console.log('✅ Message sent successfully!');
        console.log('📨 Message ID:', data.messageId);
        console.log('📞 Phone:', data.phoneNumber);
        console.log('⏱️ Execution Time:', data.executionTime + 'ms');
        console.log('📅 Timestamp:', data.timestamp);
      } else {
        console.log('❌ API call failed:');
        console.log('🔍 Error:', data.error);
        
        if (data.troubleshooting) {
          console.log('\n🛠️ Troubleshooting Information:');
          console.log('\n📋 Common Issues:');
          data.troubleshooting.commonIssues.forEach((issue, i) => {
            console.log(`  ${i + 1}. ${issue}`);
          });
          
          console.log('\n🔧 Next Steps:');
          data.troubleshooting.nextSteps.forEach((step, i) => {
            console.log(`  ${i + 1}. ${step}`);
          });
        }
      }
    } else {
      console.log('\n❌ === HTTP ERROR ===');
      console.log('🔍 Error:', data.error || 'Unknown error');
      console.log('📊 Status:', data.status || 'No status');
      
      if (data.details) {
        console.log('📋 Details:', data.details);
      }
    }
    
    console.log('\n📄 === RAW RESPONSE ===');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.log('\n💥 === REQUEST FAILED ===');
    console.log('❌ Error:', error.message);
    
    if (error.message.includes('fetch')) {
      console.log('\n🔍 This might be a network issue or the API endpoint is not accessible');
      console.log('💡 Try checking:');
      console.log('  • Your internet connection');
      console.log('  • The Vercel deployment status');
      console.log('  • Whether the API endpoint exists');
    }
  }
}

async function main() {
  await promptUser();
  rl.close();
  
  await testAPI();
  
  console.log('\n🏁 Test completed!');
  console.log('\n💡 Note: If you see authentication errors, the detailed logs are still');
  console.log('   captured in your Vercel Function Logs even if the response is blocked.');
  console.log('\n📊 Check your Vercel dashboard → Functions → test-whatsapp-send for');
  console.log('   complete diagnostic information including:');
  console.log('   • Environment variable analysis');
  console.log('   • Token validation details');
  console.log('   • API request construction');
  console.log('   • Meta API error responses');
}

main().catch(console.error);