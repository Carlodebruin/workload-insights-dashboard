#!/usr/bin/env node

/**
 * Test script to verify that the AI provider fallback mechanism works correctly
 * when DeepSeek authentication fails and should fall back to mock provider
 */

const { PrismaClient } = require('@prisma/client');
const { decrypt } = require('./../lib/encryption');
const { createAIProviderSafe, testAIProvider, getWorkingAIProvider } = require('./../lib/ai-factory');

const prisma = new PrismaClient();

async function testFallbackMechanism() {
    console.log('🧪 Testing AI Provider Fallback Mechanism...\n');

    try {
        // Get the current DeepSeek configuration
        const deepseekConfig = await prisma.llmConfiguration.findFirst({
            where: {
                provider: 'deepseek',
                isActive: true,
            },
            include: {
                apiKey: true,
            },
        });

        if (!deepseekConfig) {
            console.log('❌ No active DeepSeek configuration found in database');
            return;
        }

        console.log('📋 DeepSeek Configuration Found:');
        console.log(`   - Name: ${deepseekConfig.name}`);
        console.log(`   - Provider: ${deepseekConfig.provider}`);
        console.log(`   - Has API Key: ${!!deepseekConfig.apiKey}`);

        // Test the provider directly
        let apiKey;
        if (deepseekConfig.apiKey) {
            try {
                apiKey = decrypt(deepseekConfig.apiKey.encryptedKey);
                console.log(`   - API Key: ${apiKey ? 'Present (encrypted)' : 'Missing'}`);
            } catch (e) {
                console.log('   - API Key: Failed to decrypt');
            }
        }

        console.log('\n🔍 Testing DeepSeek Provider...');
        const deepseekProvider = createAIProviderSafe('deepseek', apiKey);
        
        if (!deepseekProvider) {
            console.log('❌ Failed to create DeepSeek provider');
            return;
        }

        const testResult = await testAIProvider(deepseekProvider, 8000);
        console.log('📊 DeepSeek Provider Test Result:');
        console.log(`   - Is Working: ${testResult.isWorking}`);
        console.log(`   - Should Fallback: ${testResult.shouldFallback}`);
        if (testResult.error) {
            console.log(`   - Error: ${testResult.error.message}`);
            console.log(`   - Error Type: ${testResult.error.name}`);
        }

        console.log('\n🔄 Testing getWorkingAIProvider() fallback...');
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
                console.log('❌ Mock provider failed:', mockError.message);
            }
        } else {
            console.log('❌ FAILED: System did not fall back to MockProvider');
            console.log(`   - Got provider: ${workingProvider.name}`);
        }

    } catch (error) {
        console.error('❌ Error during fallback test:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the test
testFallbackMechanism().catch(console.error);