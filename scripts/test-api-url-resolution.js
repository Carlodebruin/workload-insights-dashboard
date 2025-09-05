#!/usr/bin/env node

/**
 * Test script to verify API URL resolution works correctly
 * This helps diagnose port mismatch issues between client and server
 */

function getApiBaseUrl() {
    if (typeof window === 'undefined') return '';
    
    // Use current origin to handle different ports
    const { protocol, hostname, port } = window.location;
    
    // For development, use the current port, otherwise use relative URLs
    if (process.env.NODE_ENV === 'development') {
        return `${protocol}//${hostname}${port ? ':' + port : ''}`;
    }
    
    // In production, use relative URLs for same-origin requests
    return '';
}

// Test the function in different scenarios
console.log('🧪 Testing API URL resolution...');

// Mock window.location for testing
const testScenarios = [
    {
        name: 'Development with port 3000',
        mockWindow: { location: { protocol: 'http:', hostname: 'localhost', port: '3000' } },
        expected: 'http://localhost:3000'
    },
    {
        name: 'Development with port 3001', 
        mockWindow: { location: { protocol: 'http:', hostname: 'localhost', port: '3001' } },
        expected: 'http://localhost:3001'
    },
    {
        name: 'Development without port',
        mockWindow: { location: { protocol: 'https:', hostname: 'example.com', port: '' } },
        expected: 'https://example.com'
    },
    {
        name: 'Production environment',
        mockWindow: { location: { protocol: 'https:', hostname: 'app.example.com', port: '' } },
        env: 'production',
        expected: ''
    }
];

let allPassed = true;

for (const scenario of testScenarios) {
    // Mock window and process.env
    const originalWindow = global.window;
    const originalProcessEnv = process.env.NODE_ENV;
    
    global.window = scenario.mockWindow;
    if (scenario.env) {
        process.env.NODE_ENV = scenario.env;
    } else {
        process.env.NODE_ENV = 'development';
    }
    
    try {
        const result = getApiBaseUrl();
        const passed = result === scenario.expected;
        
        console.log(`\n${passed ? '✅' : '❌'} ${scenario.name}`);
        console.log(`   Expected: "${scenario.expected}"`);
        console.log(`   Received: "${result}"`);
        console.log(`   Status: ${passed ? 'PASS' : 'FAIL'}`);
        
        if (!passed) {
            allPassed = false;
        }
    } catch (error) {
        console.log(`\n❌ ${scenario.name}`);
        console.log(`   Error: ${error.message}`);
        allPassed = false;
    } finally {
        // Restore original globals
        global.window = originalWindow;
        process.env.NODE_ENV = originalProcessEnv;
    }
}

console.log(`\n${allPassed ? '🎉 All tests passed!' : '💥 Some tests failed!'}`);

// Test the actual fetch URLs that would be generated
console.log('\n📋 Example API URLs that would be generated:');
const testUrls = [
    { provider: 'deepseek', endpoint: '/api/ai/chat' },
    { provider: 'gemini', endpoint: '/api/ai/providers' }
];

for (const test of testUrls) {
    // Mock development environment
    global.window = { location: { protocol: 'http:', hostname: 'localhost', port: '3001' } };
    process.env.NODE_ENV = 'development';
    
    const baseUrl = getApiBaseUrl();
    const fullUrl = `${baseUrl}${test.endpoint}?provider=${test.provider}`;
    
    console.log(`   ${test.provider}: ${fullUrl}`);
}

// Clean up
delete global.window;
process.env.NODE_ENV = 'test';

console.log('\n💡 If you see "localhost:3001" in the URLs above,');
console.log('   make sure your Next.js server is running on port 3001');
console.log('   or adjust the port in your development command:');
console.log('   PORT=3001 npm run dev');