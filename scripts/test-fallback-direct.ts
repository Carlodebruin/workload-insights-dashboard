#!/usr/bin/env tsx

/**
 * Direct test script to verify that the AI provider fallback mechanism works correctly
 * by simulating DeepSeek authentication errors
 */

import { MockProvider } from '../lib/providers/mock';
import { DeepSeekProvider, DeepSeekAPIError, DeepSeekRateLimitError, DeepSeekTimeoutError } from '../lib/providers/deepseek';
import { shouldFallback, getFallbackProvider } from '../lib/ai-factory';

async function testFallbackLogic() {
    console.log('🧪 Testing AI Provider Fallback Logic...\n');

    try {
        // Test 1: Simulate DeepSeek authentication error
        console.log('🔍 Test 1: Simulating DeepSeek authentication error...');
        const authError = new DeepSeekAPIError('Unauthorized: Invalid API key', 401);
        
        const shouldFallbackResult = shouldFallback(authError);
        console.log('📊 Authentication Error Fallback Check:');
        console.log(`   - Error Type: ${authError.name}`);
        console.log(`   - Status Code: ${(authError as any).statusCode}`);
        console.log(`   - Should Fallback: ${shouldFallbackResult}`);
        
        if (shouldFallbackResult) {
            console.log('✅ SUCCESS: Authentication errors should trigger fallback!');
        } else {
            console.log('❌ FAILED: Authentication errors should trigger fallback');
        }

        // Test 2: Test getFallbackProvider with authentication error
        console.log('\n🔍 Test 2: Testing getFallbackProvider with auth error...');
        const fallbackProvider = await getFallbackProvider('deepseek', authError);
        
        if (fallbackProvider) {
            console.log('📊 Fallback Provider Result:');
            console.log(`   - Provider Name: ${fallbackProvider.name}`);
            console.log(`   - Provider Type: ${fallbackProvider.constructor.name}`);
            
            if (fallbackProvider.name === 'MockProvider') {
                console.log('✅ SUCCESS: System correctly returned MockProvider as fallback!');
                
                // Test that the mock provider works
                console.log('\n🧪 Testing Mock Provider Functionality...');
                try {
                    const mockResponse = await fallbackProvider.generateContent('Test message', {
                        maxTokens: 50,
                        temperature: 0.3
                    });
                    
                    console.log('📊 Mock Provider Test:');
                    console.log(`   - Response: ${mockResponse.text}`);
                    console.log(`   - Response Length: ${mockResponse.text.length}`);
                    console.log('✅ Mock provider is working correctly!');
                    
                } catch (mockError) {
                    console.log('❌ Mock provider failed:', (mockError as Error).message);
                }
            } else {
                console.log('❌ FAILED: Expected MockProvider but got:', fallbackProvider.name);
            }
        } else {
            console.log('❌ FAILED: No fallback provider returned');
        }

        // Test 3: Test other error types that should trigger fallback
        console.log('\n🔍 Test 3: Testing other fallback-triggering errors...');
        const errorTypes = [
            { error: new DeepSeekRateLimitError('Rate limit exceeded', 30), name: 'DeepSeekRateLimitError', shouldFallback: true },
            { error: new DeepSeekTimeoutError('Request timeout'), name: 'DeepSeekTimeoutError', shouldFallback: true },
            { error: new Error('Network error'), name: 'NetworkError', shouldFallback: true },
            { error: new Error('Some generic error'), name: 'GenericError', shouldFallback: false },
        ];

        for (const errorType of errorTypes) {
            const error = errorType.error;
            
            const result = shouldFallback(error);
            console.log(`   - ${errorType.name}: ${result} (expected: ${errorType.shouldFallback})`);
            
            if (result === errorType.shouldFallback) {
                console.log(`     ✅ Correct`);
            } else {
                console.log(`     ❌ Incorrect`);
            }
        }

    } catch (error) {
        console.error('❌ Error during fallback test:', (error as Error).message);
    }
}

// Run the test
testFallbackLogic().catch(console.error);