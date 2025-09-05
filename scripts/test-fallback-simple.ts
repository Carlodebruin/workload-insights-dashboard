#!/usr/bin/env tsx

/**
 * Simple test script to verify that the AI provider fallback mechanism works correctly
 */

import { PrismaClient } from '@prisma/client';
import { decrypt } from '../lib/encryption';
import { createAIProviderSafe, testAIProvider, getWorkingAIProvider } from '../lib/ai-factory';

const prisma = new PrismaClient();

async function testFallbackMechanism() {
    console.log('🧪 Testing AI Provider Fallback Mechanism...\n');

    try {
        // Test getWorkingAIProvider directly
        console.log('🔄 Testing getWorkingAIProvider() fallback...');
        const workingProvider = await getWorkingAIProvider();
        console.log('📊 Working Provider Result:');
        console.log(`   - Provider Name: ${workingProvider.name}`);
        console.log(`   - Provider Type: ${workingProvider.constructor.name}`);
        
        if (workingProvider.name === 'MockProvider') {
            console.log('✅ SUCCESS: System correctly fell back to MockProvider!');
            
            // Test that the mock provider actually works
            console.log('\n🧪 Testing Mock Provider Functionality...');
            try {
                const mockResponse = await workingProvider.generateContent('Test message', {
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
            console.log('❌ FAILED: System did not fall back to MockProvider');
            console.log(`   - Got provider: ${workingProvider.name}`);
        }

    } catch (error) {
        console.error('❌ Error during fallback test:', (error as Error).message);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the test
testFallbackMechanism().catch(console.error);