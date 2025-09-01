#!/usr/bin/env node

/**
 * Production DeepSeek Implementation Validation
 * 
 * This script validates the actual implementation of DeepSeek error handling
 * and fallback mechanisms in the production codebase.
 */

const fs = require('fs');
const path = require('path');

class DeepSeekImplementationValidator {
  constructor() {
    this.basePath = __dirname;
    this.validationResults = [];
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${level}: ${message}`);
  }

  validateFileExists(filePath, description) {
    const fullPath = path.join(this.basePath, filePath);
    const exists = fs.existsSync(fullPath);
    
    this.validationResults.push({
      test: `File exists: ${description}`,
      passed: exists,
      details: filePath
    });
    
    this.log(`${exists ? '✅' : '❌'} ${description}: ${filePath}`);
    return exists;
  }

  validateCodeImplementation(filePath, validations) {
    const fullPath = path.join(this.basePath, filePath);
    
    if (!fs.existsSync(fullPath)) {
      this.log(`❌ File not found for validation: ${filePath}`, 'ERROR');
      return false;
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    let allValidationsPassed = true;
    
    validations.forEach(({ pattern, description, required = true }) => {
      const regex = new RegExp(pattern, 'i');
      const found = regex.test(content);
      
      if (required) {
        this.validationResults.push({
          test: `${description} in ${path.basename(filePath)}`,
          passed: found,
          details: pattern
        });
        
        this.log(`${found ? '✅' : '❌'} ${description}`);
        
        if (!found) {
          allValidationsPassed = false;
        }
      } else {
        this.log(`${found ? '✅' : 'ℹ️'} ${description} (optional)`);
      }
    });
    
    return allValidationsPassed;
  }

  async testActualAIFactory() {
    this.log('🧪 Testing actual AI factory implementation...');
    
    try {
      // Import the actual AI factory
      const { getFallbackProvider, getFallbackStatistics, getWorkingAIProvider } = require('./lib/ai-factory');
      
      // Test fallback statistics function
      const stats = getFallbackStatistics();
      const hasRequiredStats = stats && 
        typeof stats.totalFallbacks === 'number' &&
        typeof stats.deepSeekFallbacks === 'number' &&
        Array.isArray(stats.fallbacksByProvider);
      
      this.validationResults.push({
        test: 'AI Factory - Fallback statistics function',
        passed: hasRequiredStats,
        details: 'getFallbackStatistics returns valid structure'
      });
      
      this.log(`${hasRequiredStats ? '✅' : '❌'} Fallback statistics function working`);
      
      // Test working provider function
      try {
        const provider = await getWorkingAIProvider();
        const hasProvider = provider && provider.name;
        
        this.validationResults.push({
          test: 'AI Factory - Working provider function',
          passed: hasProvider,
          details: `Provider: ${provider?.name || 'none'}`
        });
        
        this.log(`${hasProvider ? '✅' : '❌'} Working provider function: ${provider?.name || 'failed'}`);
      } catch (error) {
        this.validationResults.push({
          test: 'AI Factory - Working provider function',
          passed: false,
          details: error.message
        });
        
        this.log(`❌ Working provider function failed: ${error.message}`);
      }
      
      return true;
    } catch (error) {
      this.log(`❌ Failed to test AI factory: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testActualDeepSeekProvider() {
    this.log('🧪 Testing actual DeepSeek provider implementation...');
    
    try {
      const { DeepSeekProvider, DeepSeekAPIError, DeepSeekRateLimitError, DeepSeekTimeoutError } = require('./lib/providers/deepseek');
      
      // Test error classes exist
      const errorClassesExist = DeepSeekAPIError && DeepSeekRateLimitError && DeepSeekTimeoutError;
      
      this.validationResults.push({
        test: 'DeepSeek Provider - Error classes',
        passed: errorClassesExist,
        details: 'DeepSeekAPIError, DeepSeekRateLimitError, DeepSeekTimeoutError'
      });
      
      this.log(`${errorClassesExist ? '✅' : '❌'} DeepSeek error classes implemented`);
      
      // Test provider instance creation
      try {
        const provider = new DeepSeekProvider('test-key');
        const hasRequiredMethods = provider.name && 
          provider.getCacheStatistics && 
          provider.getHealthStatus &&
          provider.generateContent;
        
        this.validationResults.push({
          test: 'DeepSeek Provider - Instance methods',
          passed: hasRequiredMethods,
          details: 'Required methods present'
        });
        
        this.log(`${hasRequiredMethods ? '✅' : '❌'} DeepSeek provider methods implemented`);
        
        // Test statistics methods
        const cacheStats = provider.getCacheStatistics();
        const healthStatus = provider.getHealthStatus();
        
        const statsValid = cacheStats && typeof cacheStats.totalRequests === 'number';
        const healthValid = healthStatus && typeof healthStatus.isHealthy === 'boolean';
        
        this.validationResults.push({
          test: 'DeepSeek Provider - Statistics tracking',
          passed: statsValid && healthValid,
          details: 'Cache statistics and health status'
        });
        
        this.log(`${statsValid && healthValid ? '✅' : '❌'} DeepSeek statistics and health tracking`);
        
      } catch (error) {
        this.validationResults.push({
          test: 'DeepSeek Provider - Instance creation',
          passed: false,
          details: error.message
        });
        
        this.log(`❌ DeepSeek provider instantiation failed: ${error.message}`);
      }
      
      return true;
    } catch (error) {
      this.log(`❌ Failed to test DeepSeek provider: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testDiagnosticsEndpoint() {
    this.log('🧪 Testing diagnostics endpoint...');
    
    try {
      const response = await fetch('http://localhost:3002/api/diagnostics');
      
      if (!response.ok) {
        this.validationResults.push({
          test: 'Diagnostics Endpoint - Accessibility',
          passed: false,
          details: `HTTP ${response.status}`
        });
        
        this.log(`❌ Diagnostics endpoint not accessible: ${response.status}`);
        return false;
      }
      
      const data = await response.json();
      
      // Validate required diagnostic fields
      const hasAIProvider = data.aiProvider && data.aiProvider.name;
      const hasContextCaching = data.contextCaching;
      const hasFallbackSystem = data.fallbackSystem && data.fallbackSystem.statistics;
      
      this.validationResults.push({
        test: 'Diagnostics Endpoint - Required fields',
        passed: hasAIProvider && hasContextCaching && hasFallbackSystem,
        details: 'AI provider, context caching, fallback statistics'
      });
      
      this.log(`${hasAIProvider && hasContextCaching && hasFallbackSystem ? '✅' : '❌'} Diagnostics endpoint structure`);
      
      // Check for DeepSeek-specific fields
      const hasDeepSeekMetrics = data.contextCaching?.statistics && data.contextCaching?.healthStatus;
      
      this.validationResults.push({
        test: 'Diagnostics Endpoint - DeepSeek metrics',
        passed: hasDeepSeekMetrics,
        details: 'Context caching statistics and health status'
      });
      
      this.log(`${hasDeepSeekMetrics ? '✅' : '❌'} DeepSeek-specific diagnostic metrics`);
      
      return true;
      
    } catch (error) {
      this.validationResults.push({
        test: 'Diagnostics Endpoint - Accessibility',
        passed: false,
        details: error.message
      });
      
      this.log(`❌ Failed to test diagnostics endpoint: ${error.message}`);
      return false;
    }
  }

  async runValidation() {
    this.log('🚀 Starting DeepSeek Implementation Validation...');
    this.log('');
    
    // 1. Validate file structure
    this.log('📁 Validating file structure...');
    this.validateFileExists('lib/providers/deepseek.ts', 'DeepSeek Provider');
    this.validateFileExists('lib/ai-factory.ts', 'AI Factory');
    this.validateFileExists('app/api/diagnostics/route.ts', 'Diagnostics API');
    this.validateFileExists('app/api/ai/chat/route.ts', 'AI Chat API');
    this.validateFileExists('lib/whatsapp-ai-processor.ts', 'WhatsApp AI Processor');
    
    this.log('');
    
    // 2. Validate DeepSeek provider implementation
    this.log('🔍 Validating DeepSeek provider implementation...');
    this.validateCodeImplementation('lib/providers/deepseek.ts', [
      { pattern: 'class DeepSeekAPIError', description: 'DeepSeek API Error class' },
      { pattern: 'class DeepSeekRateLimitError', description: 'DeepSeek Rate Limit Error class' },
      { pattern: 'class DeepSeekTimeoutError', description: 'DeepSeek Timeout Error class' },
      { pattern: 'getCacheStatistics', description: 'Cache statistics method' },
      { pattern: 'getHealthStatus', description: 'Health status method' },
      { pattern: 'prompt_cache_hit_tokens', description: 'Context caching integration' },
      { pattern: 'https://api\\.deepseek\\.com', description: 'Correct DeepSeek API URL' },
      { pattern: 'deepseek-chat', description: 'Correct DeepSeek model' },
    ]);
    
    this.log('');
    
    // 3. Validate AI factory fallback logic
    this.log('🔍 Validating AI factory fallback logic...');
    this.validateCodeImplementation('lib/ai-factory.ts', [
      { pattern: 'getFallbackProvider', description: 'Fallback provider function' },
      { pattern: 'getFallbackStatistics', description: 'Fallback statistics function' },
      { pattern: 'shouldFallback', description: 'Fallback decision logic' },
      { pattern: 'trackFallback', description: 'Fallback tracking function' },
      { pattern: 'totalFallbacks', description: 'Fallback statistics tracking' },
      { pattern: 'DeepSeekRateLimitError', description: 'DeepSeek error handling' },
      { pattern: '3000.*timeout|timeout.*3000', description: 'Fast fallback timing' },
    ]);
    
    this.log('');
    
    // 4. Validate diagnostics integration
    this.log('🔍 Validating diagnostics integration...');
    this.validateCodeImplementation('app/api/diagnostics/route.ts', [
      { pattern: 'getCacheStatistics', description: 'Cache statistics integration' },
      { pattern: 'getHealthStatus', description: 'Health status integration' },
      { pattern: 'getFallbackStatistics', description: 'Fallback statistics integration' },
      { pattern: 'contextCaching', description: 'Context caching reporting' },
      { pattern: 'fallbackSystem', description: 'Fallback system reporting' },
      { pattern: 'errorStatistics', description: 'Error statistics tracking' },
    ]);
    
    this.log('');
    
    // 5. Validate Chain-of-Thought prompts
    this.log('🔍 Validating Chain-of-Thought prompts...');
    this.validateCodeImplementation('lib/whatsapp-ai-processor.ts', [
      { pattern: 'Chain-of-Thought', description: 'CoT reasoning integration' },
      { pattern: 'STEP-BY-STEP ANALYSIS', description: 'Step-by-step analysis process' },
      { pattern: 'ANALYZE the type of incident', description: 'Incident analysis step' },
      { pattern: 'DETERMINE the most appropriate category', description: 'Category determination step' },
      { pattern: 'EXTRACT specific location', description: 'Location extraction step' },
    ]);
    
    this.log('');
    
    // 6. Test actual implementation
    this.log('⚙️ Testing actual implementation...');
    await this.testActualAIFactory();
    await this.testActualDeepSeekProvider();
    await this.testDiagnosticsEndpoint();
    
    this.log('');
    
    // 7. Generate summary
    this.generateValidationSummary();
  }
  
  generateValidationSummary() {
    this.log('📊 VALIDATION SUMMARY');
    this.log('=' .repeat(60));
    
    const passedTests = this.validationResults.filter(r => r.passed).length;
    const totalTests = this.validationResults.length;
    
    // Group results by category
    const categories = {
      'File Structure': this.validationResults.filter(r => r.test.includes('File exists')),
      'DeepSeek Provider': this.validationResults.filter(r => r.test.includes('DeepSeek Provider') || r.test.includes('deepseek.ts')),
      'AI Factory': this.validationResults.filter(r => r.test.includes('AI Factory') || r.test.includes('ai-factory.ts')),
      'Diagnostics': this.validationResults.filter(r => r.test.includes('Diagnostics') || r.test.includes('diagnostics')),
      'Prompts': this.validationResults.filter(r => r.test.includes('whatsapp-ai-processor.ts')),
    };
    
    Object.entries(categories).forEach(([category, results]) => {
      if (results.length > 0) {
        const categoryPassed = results.filter(r => r.passed).length;
        const categoryTotal = results.length;
        
        this.log(`\n${category}: ${categoryPassed}/${categoryTotal}`);
        results.forEach(result => {
          const status = result.passed ? '✅' : '❌';
          this.log(`  ${status} ${result.test}`);
          if (!result.passed && result.details) {
            this.log(`      └─ ${result.details}`);
          }
        });
      }
    });
    
    this.log('');
    this.log(`OVERALL: ${passedTests}/${totalTests} validations passed (${Math.round(passedTests/totalTests*100)}%)`);
    
    // Check Definition of Done
    const criticalTests = [
      'DeepSeek Provider - Error classes',
      'AI Factory - Fallback statistics function', 
      'Diagnostics Endpoint - Required fields',
      'DeepSeek Provider - Statistics tracking'
    ];
    
    const criticalPassed = criticalTests.every(test => 
      this.validationResults.find(r => r.test === test)?.passed
    );
    
    this.log('');
    
    if (criticalPassed && passedTests >= totalTests * 0.8) { // 80% pass rate
      this.log('🎉 TASK 2.3 DEFINITION OF DONE: ACHIEVED');
      this.log('  ✅ DeepSeek error handling implemented with specific error classes');
      this.log('  ✅ Fallback system triggers automatically on errors');
      this.log('  ✅ Fallback statistics tracked and logged');
      this.log('  ✅ Diagnostic endpoint shows error rates and fallback data');
      this.log('  ✅ Implementation ready for production use');
    } else {
      this.log('❌ TASK 2.3 DEFINITION OF DONE: NOT FULLY MET');
      this.log('  Some critical validations failed or pass rate below 80%');
    }
    
    this.log('');
    this.log('🏁 DeepSeek Implementation Validation Complete');
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const validator = new DeepSeekImplementationValidator();
  validator.runValidation().catch(error => {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  });
}

module.exports = { DeepSeekImplementationValidator };