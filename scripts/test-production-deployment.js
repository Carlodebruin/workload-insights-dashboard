const https = require('https');

const PRODUCTION_URL = 'https://workload-insights-dashboard-im1c2ktd3-carlo-de-bruins-projects.vercel.app';
const TEST_ENDPOINTS = [
  '/api/health',
  '/api/ai/chat',
  '/api/data'
];

async function testEndpoint(endpoint) {
  return new Promise((resolve, reject) => {
    const url = `${PRODUCTION_URL}${endpoint}`;
    console.log(`\n🔍 Testing: ${url}`);
    
    const req = https.request(url, {
      method: 'GET',
      timeout: 10000,
      headers: {
        'User-Agent': 'Production-Test-Script/1.0'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`✅ Status: ${res.statusCode}`);
        console.log(`📋 Response: ${data.substring(0, 200)}${data.length > 200 ? '...' : ''}`);
        resolve({ status: res.statusCode, data });
      });
    });
    
    req.on('error', (error) => {
      console.log(`❌ Error: ${error.message}`);
      reject(error);
    });
    
    req.on('timeout', () => {
      console.log('❌ Timeout: Request took too long');
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.end();
  });
}

async function testAllEndpoints() {
  console.log('🚀 Testing Production Deployment Endpoints');
  console.log('='.repeat(60));
  
  for (const endpoint of TEST_ENDPOINTS) {
    try {
      await testEndpoint(endpoint);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between requests
    } catch (error) {
      console.log(`❌ Failed to test ${endpoint}: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎯 Testing AI Chat Endpoint with POST request...');
  
  // Test AI Chat endpoint with POST
  try {
    const postData = JSON.stringify({
      history: [],
      message: "Test production deployment",
      stream: false
    });
    
    const req = https.request(`${PRODUCTION_URL}/api/ai/chat`, {
      method: 'POST',
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Production-Test-Script/1.0'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`✅ AI Chat Status: ${res.statusCode}`);
        console.log(`📋 AI Response: ${data.substring(0, 300)}${data.length > 300 ? '...' : ''}`);
      });
    });
    
    req.on('error', (error) => {
      console.log(`❌ AI Chat Error: ${error.message}`);
    });
    
    req.on('timeout', () => {
      console.log('❌ AI Chat Timeout');
      req.destroy();
    });
    
    req.write(postData);
    req.end();
    
  } catch (error) {
    console.log(`❌ AI Chat Test Failed: ${error.message}`);
  }
}

// Run the tests
testAllEndpoints().catch(console.error);