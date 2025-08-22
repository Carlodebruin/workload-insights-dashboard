#!/usr/bin/env node

// Performance test script for the workload insights dashboard
const https = require('https');
const http = require('http');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

// Test configuration
const tests = [
  {
    name: 'Health Check',
    path: '/api/health',
    method: 'GET',
    expectedStatus: 200,
    maxResponseTime: 10000 // 10 seconds
  },
  {
    name: 'System Diagnostics',
    path: '/api/debug/system-status',
    method: 'GET',
    expectedStatus: 200,
    maxResponseTime: 15000 // 15 seconds
  },
  {
    name: 'Activities List (Page 1)',
    path: '/api/activities?page=1&limit=10',
    method: 'GET',
    expectedStatus: 200,
    maxResponseTime: 3000 // 3 seconds
  },
  {
    name: 'Categories List',
    path: '/api/categories',
    method: 'GET',
    expectedStatus: 200,
    maxResponseTime: 2000 // 2 seconds
  },
  {
    name: 'Users List',
    path: '/api/users',
    method: 'GET',
    expectedStatus: 200,
    maxResponseTime: 2000 // 2 seconds
  },
  {
    name: 'WhatsApp Messages',
    path: '/api/whatsapp-messages?page=1&limit=10',
    method: 'GET',
    expectedStatus: 200,
    maxResponseTime: 3000 // 3 seconds
  },
  {
    name: 'WhatsApp Debug',
    path: '/api/whatsapp-debug',
    method: 'GET',
    expectedStatus: 200,
    maxResponseTime: 5000 // 5 seconds
  },
  {
    name: 'AI Chat Health',
    path: '/api/ai/chat',
    method: 'GET',
    expectedStatus: 200,
    maxResponseTime: 1000 // 1 second
  }
];

// Performance test function
async function performanceTest(test) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const url = new URL(test.path, BASE_URL);
    const client = url.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: test.method,
      headers: {
        'User-Agent': 'Performance-Test-Script/1.0'
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        let responseData = null;
        try {
          responseData = JSON.parse(data);
        } catch (e) {
          // Response might not be JSON
          responseData = { raw: data.substring(0, 100) };
        }

        resolve({
          test: test.name,
          success: res.statusCode === test.expectedStatus,
          statusCode: res.statusCode,
          expectedStatus: test.expectedStatus,
          responseTime,
          maxResponseTime: test.maxResponseTime,
          performancePass: responseTime <= test.maxResponseTime,
          responseSize: data.length,
          error: null,
          responseData
        });
      });
    });

    req.on('error', (err) => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      resolve({
        test: test.name,
        success: false,
        statusCode: null,
        expectedStatus: test.expectedStatus,
        responseTime,
        maxResponseTime: test.maxResponseTime,
        performancePass: false,
        responseSize: 0,
        error: err.message,
        responseData: null
      });
    });

    req.setTimeout(test.maxResponseTime + 5000, () => {
      req.destroy();
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      resolve({
        test: test.name,
        success: false,
        statusCode: null,
        expectedStatus: test.expectedStatus,
        responseTime,
        maxResponseTime: test.maxResponseTime,
        performancePass: false,
        responseSize: 0,
        error: 'Request timeout',
        responseData: null
      });
    });

    req.end();
  });
}

// Run all performance tests
async function runPerformanceTests() {
  console.log('🚀 Starting Performance Tests');
  console.log('='.repeat(50));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Count: ${tests.length}`);
  console.log('='.repeat(50));
  
  const results = [];
  
  for (const test of tests) {
    console.log(`\n🔍 Testing: ${test.name}`);
    const result = await performanceTest(test);
    results.push(result);
    
    // Print result
    const statusIcon = result.success ? '✅' : '❌';
    const perfIcon = result.performancePass ? '⚡' : '🐌';
    
    console.log(`${statusIcon} ${perfIcon} ${result.test}`);
    console.log(`   Status: ${result.statusCode} (expected: ${result.expectedStatus})`);
    console.log(`   Response Time: ${result.responseTime}ms (max: ${result.maxResponseTime}ms)`);
    console.log(`   Response Size: ${result.responseSize} bytes`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    if (result.responseData && result.responseData.status) {
      console.log(`   System Status: ${result.responseData.status}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 PERFORMANCE TEST SUMMARY');
  console.log('='.repeat(50));
  
  const totalTests = results.length;
  const successfulTests = results.filter(r => r.success).length;
  const performantTests = results.filter(r => r.performancePass).length;
  const avgResponseTime = Math.round(
    results.reduce((sum, r) => sum + r.responseTime, 0) / totalTests
  );
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Successful: ${successfulTests}/${totalTests} (${Math.round(successfulTests/totalTests*100)}%)`);
  console.log(`Performance Pass: ${performantTests}/${totalTests} (${Math.round(performantTests/totalTests*100)}%)`);
  console.log(`Average Response Time: ${avgResponseTime}ms`);
  
  // Failed tests
  const failedTests = results.filter(r => !r.success);
  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests:');
    failedTests.forEach(test => {
      console.log(`   - ${test.test}: ${test.error || `Status ${test.statusCode}`}`);
    });
  }
  
  // Slow tests
  const slowTests = results.filter(r => !r.performancePass && r.success);
  if (slowTests.length > 0) {
    console.log('\n🐌 Slow Tests:');
    slowTests.forEach(test => {
      console.log(`   - ${test.test}: ${test.responseTime}ms (max: ${test.maxResponseTime}ms)`);
    });
  }
  
  // Performance recommendations
  console.log('\n💡 Performance Recommendations:');
  const verySlowTests = results.filter(r => r.responseTime > 5000);
  if (verySlowTests.length > 0) {
    console.log('   - Investigate very slow endpoints (>5s):');
    verySlowTests.forEach(test => {
      console.log(`     • ${test.test}: ${test.responseTime}ms`);
    });
  }
  
  if (avgResponseTime > 2000) {
    console.log('   - Overall average response time is high - consider database optimization');
  }
  
  if (performantTests / totalTests < 0.8) {
    console.log('   - Less than 80% of tests meet performance requirements');
  }
  
  console.log('\n🎯 Target: All endpoints < 3s, Health checks < 10s');
  console.log('='.repeat(50));
  
  // Exit code based on results
  const overallSuccess = successfulTests === totalTests && performantTests >= totalTests * 0.8;
  process.exit(overallSuccess ? 0 : 1);
}

// Run the tests
if (require.main === module) {
  runPerformanceTests().catch(console.error);
}

module.exports = { runPerformanceTests, performanceTest };