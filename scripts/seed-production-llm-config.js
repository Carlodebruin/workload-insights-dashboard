const { PrismaClient } = require('@prisma/prisma-client');
const { encrypt } = require('../lib/encryption');

async function seedProductionLLMConfig() {
    console.log('🔧 Starting surgical fix: Seeding production LLM configuration...');
    
    const prisma = new PrismaClient();
    
    try {
        // Test database connectivity first
        console.log('📡 Testing database connectivity...');
        await prisma.$connect();
        console.log('✅ Database connection successful');
        
        // Check if we have the required environment variables
        const deepseekKey = process.env.DEEPSEEK_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;
        const claudeKey = process.env.CLAUDE_API_KEY;
        
        console.log('🔍 Environment variables check:');
        console.log('DEEPSEEK_API_KEY:', deepseekKey ? 'Present' : 'Missing');
        console.log('GEMINI_API_KEY:', geminiKey ? 'Present' : 'Missing');
        console.log('CLAUDE_API_KEY:', claudeKey ? 'Present' : 'Missing');
        
        // Clean up existing configurations first
        console.log('🧹 Cleaning up existing LLM configurations...');
        await prisma.llmConfiguration.deleteMany({});
        console.log('✅ Existing configurations cleared');
        
        const configurations = [];
        
        // Add DeepSeek configuration if API key is available
        if (deepseekKey && deepseekKey.trim() && deepseekKey !== 'test_key_for_development_health_check') {
            try {
                const trimmedKey = deepseekKey.trim(); // Remove any newlines/whitespace
                const encryptedKey = encrypt(trimmedKey);
                
                // Create API key record
                const apiKeyRecord = await prisma.apiKey.create({
                    data: {
                        name: 'DeepSeek Production Key',
                        encryptedKey: encryptedKey,
                        provider: 'deepseek',
                        isActive: true
                    }
                });
                
                // Create LLM configuration
                const llmConfig = await prisma.llmConfiguration.create({
                    data: {
                        name: 'DeepSeek Chat Production',
                        provider: 'deepseek',
                        modelName: 'deepseek-chat',
                        apiKeyId: apiKeyRecord.id,
                        isActive: true,
                        isDefault: true,
                        maxTokens: 4000,
                        temperature: 0.7,
                        configuration: {
                            baseUrl: 'https://api.deepseek.com',
                            version: 'v1',
                            features: ['chat', 'streaming', 'context_caching']
                        }
                    }
                });
                
                configurations.push({ provider: 'deepseek', config: llmConfig });
                console.log('✅ DeepSeek configuration created successfully');
                
            } catch (error) {
                console.error('❌ Failed to create DeepSeek configuration:', error.message);
            }
        }
        
        // Add Gemini configuration if API key is available and valid
        if (geminiKey && geminiKey.trim() && geminiKey !== 'test_key_for_development_health_check') {
            try {
                const trimmedKey = geminiKey.trim();
                const encryptedKey = encrypt(trimmedKey);
                
                const apiKeyRecord = await prisma.apiKey.create({
                    data: {
                        name: 'Gemini Production Key',
                        encryptedKey: encryptedKey,
                        provider: 'gemini',
                        isActive: true
                    }
                });
                
                const llmConfig = await prisma.llmConfiguration.create({
                    data: {
                        name: 'Gemini Pro Production',
                        provider: 'gemini',
                        modelName: 'gemini-pro',
                        apiKeyId: apiKeyRecord.id,
                        isActive: true,
                        isDefault: false, // DeepSeek is primary
                        maxTokens: 3000,
                        temperature: 0.7,
                        configuration: {
                            baseUrl: 'https://generativelanguage.googleapis.com',
                            version: 'v1',
                            features: ['chat', 'streaming']
                        }
                    }
                });
                
                configurations.push({ provider: 'gemini', config: llmConfig });
                console.log('✅ Gemini configuration created successfully');
                
            } catch (error) {
                console.error('❌ Failed to create Gemini configuration:', error.message);
            }
        }
        
        // Add Claude configuration if API key is available
        if (claudeKey && claudeKey.trim() && claudeKey !== 'test_key_for_development_health_check') {
            try {
                const trimmedKey = claudeKey.trim();
                const encryptedKey = encrypt(trimmedKey);
                
                const apiKeyRecord = await prisma.apiKey.create({
                    data: {
                        name: 'Claude Production Key',
                        encryptedKey: encryptedKey,
                        provider: 'claude',
                        isActive: true
                    }
                });
                
                const llmConfig = await prisma.llmConfiguration.create({
                    data: {
                        name: 'Claude 3 Production',
                        provider: 'claude',
                        modelName: 'claude-3-sonnet-20240229',
                        apiKeyId: apiKeyRecord.id,
                        isActive: true,
                        isDefault: false,
                        maxTokens: 3000,
                        temperature: 0.7,
                        configuration: {
                            baseUrl: 'https://api.anthropic.com',
                            version: 'v1',
                            features: ['chat', 'streaming']
                        }
                    }
                });
                
                configurations.push({ provider: 'claude', config: llmConfig });
                console.log('✅ Claude configuration created successfully');
                
            } catch (error) {
                console.error('❌ Failed to create Claude configuration:', error.message);
            }
        }
        
        // Verify configurations
        console.log('\n📊 Configuration Summary:');
        console.log(`Total configurations created: ${configurations.length}`);
        for (const config of configurations) {
            console.log(`- ${config.provider}: ${config.config.name} (${config.config.isDefault ? 'DEFAULT' : 'FALLBACK'})`);
        }
        
        if (configurations.length === 0) {
            console.log('⚠️ No valid API keys found. Please check your environment variables.');
        } else {
            console.log('\n🚀 Production LLM configuration seeding completed successfully!');
        }
        
    } catch (error) {
        console.error('❌ Critical error during LLM configuration seeding:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Execute the seeding
if (require.main === module) {
    seedProductionLLMConfig()
        .then(() => {
            console.log('✅ Seeding process completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Seeding process failed:', error);
            process.exit(1);
        });
}

module.exports = { seedProductionLLMConfig };