#!/usr/bin/env node

/**
 * Comprehensive production deployment verification script
 * Tests all critical endpoints after Vercel deployment protection is disabled
 */

const https = require('https');

const PRODUCTION_URL = 'https://workload-insights-dashboard-im1c2ktd3-carlo-de-bruins-projects.vercel.app';
const DEMO_TOKEN = 'demo-admin-token';

// Test endpoints configuration
const TEST_ENDPOINTS = [
  {
    path: '/api/health',
    method: 'GET',
    requiresAuth: false,
    description: 'Health check endpoint'
  },
  {
    path: '/api/health/database',
    method: 'GET', 
    requiresAuth: false,
    description: 'Database health check'
  },
  {
    path: '/api/ai/chat',
    method: 'POST',
    requiresAuth: false, // Should work without auth after middleware fix
    description: 'AI Chat endpoint',
    body: JSON.stringify({
      history: [],
      message: 'Test production deployment',
      stream: false
    })
  },
  {
    path: '/api/ai/providers',
    method: 'GET',
    requiresAuth: false,
    description: 'AI Providers list'
  },
  {
    path: '/api/data',
    method: 'GET',
    requiresAuth: false,
    description: 'Data endpoint'
  },
  {
    path: '/api/whatsapp/config',
    method: 'GET',
    requiresAuth: true, // This one requires admin token
    description: 'WhatsApp config (requires auth)'
  }
];

async function testEndpoint(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'workload-insights-dashboard-im1c2ktd3-carlo-de-bruins-projects.vercel.app',
      port: 443,
      path: endpoint.path,
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    // Add authorization header if required
    if (endpoint.requiresAuth) {
      options.headers['Authorization'] = `Bearer ${DEMO_TOKEN}`;
    }

    if (endpoint.body) {
      options.headers['Content-Length'] = Buffer.byteLength(endpoint.body);
    }

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const result = {
          endpoint: endpoint.path,
          method: endpoint.method,
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          description: endpoint.description,
          requiresAuth: endpoint.requiresAuth,
          success: res.statusCode >= 200 && res.statusCode < 300,
          response: data.length > 1000 ? data.substring(0, 1000) + '...' : data
        };

        resolve(result);
      });
    });

    req.on('error', (error) => {
      reject({
        endpoint: endpoint.path,
        method: endpoint.method,
        error: error.message,
        description: endpoint.description,
        success: false
      });
    });

    if (endpoint.body) {
      req.write(endpoint.body);
    }

    req.end();
  });
}

async function runTests() {
  console.log('🚀 Starting production deployment verification\n');
  console.log(`Production URL: ${PRODUCTION_URL}`);
  console.log('Testing endpoints without Vercel deployment protection...\n');

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const endpoint of TEST_ENDPOINTS) {
    try {
      console.log(`Testing: ${endpoint.method} ${endpoint.path} - ${endpoint.description}`);
      
      const result = await testEndpoint(endpoint);
      results.push(result);

      if (result.success) {
        console.log(`✅ SUCCESS: ${result.statusCode} ${result.statusMessage}`);
        passed++;
      } else {
        console.log(`❌ FAILED: ${result.statusCode} ${result.statusMessage}`);
        if (result.statusCode === 401 && !endpoint.requiresAuth) {
          console.log('   ↳ This suggests Vercel deployment protection is still enabled');
        }
        failed++;
      }

      // Add small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.error}`);
      results.push(error);
      failed++;
    }
    console.log('---');
  }

  // Summary
  console.log('\n📊 TEST SUMMARY');
  console.log(`Total tests: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success rate: ${Math.round((passed / results.length) * 100)}%`);

  // Detailed results
  console.log('\n📋 DETAILED RESULTS:');
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${result.method} ${result.endpoint}`);
    console.log(`   Status: ${result.statusCode || 'ERROR'} ${result.statusMessage || result.error}`);
    if (!result.success && result.statusCode === 401 && !result.requiresAuth) {
      console.log('   ↳ Vercel deployment protection detected - disable in Vercel dashboard');
    }
  });

  // Recommendations
  console.log('\n🎯 RECOMMENDATIONS:');
  if (failed > 0) {
    console.log('1. Disable Vercel Deployment Protection in dashboard');
    console.log('2. Redeploy application after middleware changes');
    console.log('3. Verify environment variables in Vercel');
    console.log('4. Test with authentication tokens if needed');
  } else {
    console.log('🎉 Production deployment is working correctly!');
    console.log('All endpoints are accessible without authentication issues.');
  }

  return { passed, failed, results };
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, TEST_ENDPOINTS, PRODUCTION_URL };