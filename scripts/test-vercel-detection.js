#!/usr/bin/env node

/**
 * Test script to verify Vercel environment detection
 * This script simulates Vercel environment variables to test middleware behavior
 */

const { spawn } = require('child_process');

// Test Vercel environment detection
console.log('🧪 Testing Vercel environment detection...\n');

// Test 1: No Vercel environment (should require auth)
console.log('Test 1: No Vercel environment variables');
testEnvironment({}, 'Should require authentication');

// Test 2: Vercel production environment
console.log('\nTest 2: Vercel production environment');
testEnvironment({
    VERCEL_ENV: 'production',
    VERCEL: '1',
    VERCEL_URL: 'workload-insights-dashboard.vercel.app'
}, 'Should bypass authentication');

// Test 3: Vercel preview environment  
console.log('\nTest 3: Vercel preview environment');
testEnvironment({
    VERCEL_ENV: 'preview',
    VERCEL: '1',
    VERCEL_URL: 'workload-insights-dashboard-git-feature.vercel.app'
}, 'Should bypass authentication');

// Test 4: Vercel region environment
console.log('\nTest 4: Vercel region environment');
testEnvironment({
    VERCEL_REGION: 'iad1',
    VERCEL: '1'
}, 'Should bypass authentication');

function testEnvironment(envVars, expectedBehavior) {
    console.log(`Environment: ${JSON.stringify(envVars, null, 2)}`);
    console.log(`Expected: ${expectedBehavior}`);
    
    // Create a test script that checks the middleware logic
    const testScript = `
        const isVercelEnvironment = 
            process.env.VERCEL_ENV === 'production' || 
            process.env.VERCEL_ENV === 'preview' ||
            process.env.VERCEL === '1' ||
            process.env.VERCEL_URL ||
            process.env.VERCEL_REGION;
        
        console.log('Result: Vercel environment detected:', isVercelEnvironment);
        console.log('Behavior: ' + (isVercelEnvironment ? 'BYPASS authentication' : 'REQUIRE authentication'));
    `;
    
    const child = spawn('node', ['-e', testScript], {
        env: { ...process.env, ...envVars },
        stdio: 'pipe'
    });
    
    child.stdout.on('data', (data) => {
        console.log(data.toString().trim());
    });
    
    child.stderr.on('data', (data) => {
        console.error('Error:', data.toString());
    });
    
    child.on('close', (code) => {
        console.log('---');
    });
}

// Test actual production endpoint
console.log('\n🧪 Testing actual production endpoint...');
console.log('Testing: https://workload-insights-dashboard-im1c2ktd3-carlo-de-bruins-projects.vercel.app/api/ai/chat');

const curlCommand = `curl -X POST https://workload-insights-dashboard-im1c2ktd3-carlo-de-bruins-projects.vercel.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"history": [], "message": "Test production authentication", "stream": false}' \
  --max-time 10 -v`;

console.log('Running curl command to test production...');

const curlProcess = spawn('sh', ['-c', curlCommand], {
    stdio: 'pipe'
});

curlProcess.stdout.on('data', (data) => {
    console.log('Response:', data.toString());
});

curlProcess.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.includes('HTTP/')) {
        console.log('HTTP Status:', output.match(/HTTP\/[0-9.]+ ([0-9]+)/)?.[1] || 'unknown');
    }
    if (output.includes('401') || output.includes('Unauthorized')) {
        console.log('❌ Authentication failed - 401 Unauthorized');
    } else if (output.includes('200')) {
        console.log('✅ Authentication successful - 200 OK');
    }
});

curlProcess.on('close', (code) => {
    console.log('Curl process exited with code:', code);
    console.log('\n📋 Summary:');
    console.log('1. Vercel environment detection logic is implemented');
    console.log('2. Middleware should bypass authentication on Vercel');
    console.log('3. Production deployment needs to be redeployed for changes to take effect');
    console.log('4. Check Vercel dashboard for environment variable configuration');
});