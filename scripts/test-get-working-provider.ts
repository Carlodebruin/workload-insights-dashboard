#!/usr/bin/env tsx

/**
 * Test script to verify that getWorkingAIProvider() correctly falls back to MockProvider
 * when all configured providers fail with fallback-eligible errors
 */

import { MockProvider } from '../lib/providers/mock';
import { getWorkingAIProvider } from '../lib/ai-factory';

async function testGetWorkingProvider() {
    console.log('🧪 Testing getWorkingAIProvider() fallback behavior...\n');

    try {
        console.log('🔄 Testing getWorkingAIProvider()...');
        const workingProvider = await getWorkingAIProvider();
        
        console.log('📊 Working Provider Result:');
        console.log(`   - Provider Name: ${workingProvider.name}`);
        console.log(`   - Provider Type: ${workingProvider.constructor.name}`);
        
        if (workingProvider.name === 'MockProvider') {
            console.log('✅ SUCCESS: System correctly fell back to MockProvider!');
            
            // Test that the mock provider actually works
            console.log('\n🧪 Testing Mock Provider Functionality...');
            try {
                const mockResponse = await workingProvider.generateContent('Test message for fallback verification', {
                    maxTokens: 50,
                    temperature: 0.3
                });
                
                console.log('📊 Mock Provider Test:');
                console.log(`   - Response: ${mockResponse.text}`);
                console.log(`   - Response Length: ${mockResponse.text.length}`);
                console.log('✅ Mock provider is working correctly!');
                
                return true;
                
            } catch (mockError) {
                console.log('❌ Mock provider failed:', (mockError as Error).message);
                return false;
            }
        } else {
            console.log('❌ FAILED: Expected MockProvider but got:', workingProvider.name);
            return false;
        }

    } catch (error) {
        console.error('❌ Error during getWorkingAIProvider test:', (error as Error).message);
        return false;
    }
}

// Run the test
testGetWorkingProvider().then(success => {
    if (success) {
        console.log('\n🎉 All tests passed! The fallback mechanism is working correctly.');
        process.exit(0);
    } else {
        console.log('\n💥 Some tests failed. Check the implementation.');
        process.exit(1);
    }
}).catch(console.error);