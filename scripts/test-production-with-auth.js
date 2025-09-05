const https = require('https');

const PRODUCTION_URL = 'https://workload-insights-dashboard-im1c2ktd3-carlo-de-bruins-projects.vercel.app';
const AUTH_TOKEN = 'demo-admin-token'; // Use demo token for testing

const TEST_ENDPOINTS = [
  '/api/health',
  '/api/data',
  '/api/ai/providers'
];

async function testEndpoint(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = `${PRODUCTION_URL}${endpoint}`;
    console.log(`\n🔍 Testing: ${method} ${url}`);
    
    const options = {
      method,
      timeout: 15000,
      headers: {
        'User-Agent': 'Production-Test-Script/1.0',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    };
    
    if (data && method === 'POST') {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }
    
    const req = https.request(url, options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log(`✅ Status: ${res.statusCode}`);
        
        try {
          const parsed = JSON.parse(responseData);
          console.log(`📋 Response: ${JSON.stringify(parsed, null, 2).substring(0, 300)}${responseData.length > 300 ? '...' : ''}`);
        } catch {
          console.log(`📋 Response: ${responseData.substring(0, 200)}${responseData.length > 200 ? '...' : ''}`);
        }
        
        resolve({ status: res.statusCode, data: responseData });
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
    
    if (data && method === 'POST') {
      req.write(data);
    }
    
    req.end();
  });
}

async function testAllEndpoints() {
  console.log('🚀 Testing Production Deployment with Authentication');
  console.log('='.repeat(70));
  console.log(`Using Auth Token: ${AUTH_TOKEN}`);
  console.log('='.repeat(70));
  
  // Test GET endpoints
  for (const endpoint of TEST_ENDPOINTS) {
    try {
      await testEndpoint(endpoint);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between requests
    } catch (error) {
      console.log(`❌ Failed to test ${endpoint}: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('🎯 Testing AI Chat Endpoint with POST request...');
  
  // Test AI Chat endpoint with POST
  try {
    const postData = JSON.stringify({
      history: [],
      message: "Test production deployment with authentication",
      stream: false
    });
    
    await testEndpoint('/api/ai/chat', 'POST', postData);
    
  } catch (error) {
    console.log(`❌ AI Chat Test Failed: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('🧪 Testing Staff Recognition Capability...');
  
  // Test staff recognition specifically
  try {
    const staffTestData = JSON.stringify({
      history: [],
      message: "List all staff members and their current tasks",
      stream: false
    });
    
    await testEndpoint('/api/ai/chat', 'POST', staffTestData);
    
  } catch (error) {
    console.log(`❌ Staff Recognition Test Failed: ${error.message}`);
  }
}

// Run the tests
testAllEndpoints().catch(console.error);