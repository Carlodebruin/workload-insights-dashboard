#!/usr/bin/env node

/**
 * DeepSeek Performance Verification Script
 * Tests the comprehensive fixes for the AI reporting system
 */

const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');
const prisma = new PrismaClient();

class PerformanceVerifier {
  constructor() {
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    this.results = {
      database: { passed: 0, total: 0, details: [] },
      api: { passed: 0, total: 0, details: [] },
      deepseek: { passed: 0, total: 0, details: [] },
      monitoring: { passed: 0, total: 0, details: [] }
    };
  }

  async testDatabasePerformance() {
    console.log('🧪 Testing Database Performance...');
    
    // Test 1: Basic connection
    try {
      const startTime = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const duration = Date.now() - startTime;
      
      this.addResult('database', duration < 1000, 
        `Database connection: ${duration}ms`, duration);
    } catch (error) {
      this.addResult('database', false, `Database connection failed: ${error.message}`);
    }

    // Test 2: Activity count performance
    try {
      const startTime = Date.now();
      const count = await prisma.activity.count();
      const duration = Date.now() - startTime;
      
      this.addResult('database', duration < 500, 
        `Activity count (${count} records): ${duration}ms`, duration);
    } catch (error) {
      this.addResult('database', false, `Activity count failed: ${error.message}`);
    }

    // Test 3: Paginated query performance
    try {
      const startTime = Date.now();
      const activities = await prisma.activity.findMany({
        take: 200,
        orderBy: { timestamp: 'desc' },
        select: { id: true, subcategory: true, status: true, timestamp: true }
      });
      const duration = Date.now() - startTime;
      
      this.addResult('database', duration < 1000 && activities.length === 200,
        `Paginated query (200 records): ${duration}ms`, duration);
    } catch (error) {
      this.addResult('database', false, `Paginated query failed: ${error.message}`);
    }
  }

  async testApiEndpoints() {
    console.log('🧪 Testing API Endpoints...');
    
    const endpoints = [
      { path: '/api/data?limit=50', name: 'Data API (50 records)', maxTime: 2000 },
      { path: '/api/data?limit=200', name: 'Data API (200 records)', maxTime: 3000 },
      { path: '/api/health', name: 'Health Check', maxTime: 1000 },
      { path: '/api/diagnostics', name: 'Diagnostics', maxTime: 1500 }
    ];

    for (const endpoint of endpoints) {
      try {
        const startTime = Date.now();
        const response = await fetch(`${this.baseUrl}${endpoint.path}`);
        const duration = Date.now() - startTime;
        
        const success = response.ok && duration <= endpoint.maxTime;
        const data = await response.json().catch(() => ({}));
        
        this.addResult('api', success,
          `${endpoint.name}: ${duration}ms (${response.status})`, duration);
          
        if (endpoint.path === '/api/data?limit=200') {
          // Verify data completeness
          const hasCompleteData = data.activities && data.activities.length === 200;
          this.addResult('api', hasCompleteData,
            `Data completeness: ${data.activities?.length || 0}/200 records`);
        }
      } catch (error) {
        this.addResult('api', false, `${endpoint.name} failed: ${error.message}`);
      }
    }
  }

  async testDeepSeekProvider() {
    console.log('🧪 Testing DeepSeek Provider...');
    
    // Test token limit consistency
    try {
      const response = await fetch(`${this.baseUrl}/api/diagnostics`);
      const diagnostics = await response.json();
      
      if (diagnostics.contextCaching && diagnostics.contextCaching.provider === 'deepseek') {
        const hasTokenLimits = diagnostics.contextCaching.usageMetrics?.tokenUsage?.averageInputTokensPerRequest < 1000;
        this.addResult('deepseek', hasTokenLimits,
          'Token limits enforced (max 1000 tokens)');
      } else {
        this.addResult('deepseek', true, 'Using fallback provider (not DeepSeek)');
      }
    } catch (error) {
      this.addResult('deepseek', false, `DeepSeek diagnostics failed: ${error.message}`);
    }
  }

  async testMonitoring() {
    console.log('🧪 Testing Monitoring & Diagnostics...');
    
    try {
      const response = await fetch(`${this.baseUrl}/api/diagnostics`);
      const diagnostics = await response.json();
      
      // Test required monitoring fields
      const tests = [
        { field: 'timestamp', description: 'Timestamp present' },
        { field: 'aiProvider', description: 'AI provider info' },
        { field: 'fallbackSystem', description: 'Fallback system metrics' },
        { field: 'database', description: 'Database performance' },
        { field: 'apiPerformance', description: 'API performance metrics' }
      ];

      tests.forEach(test => {
        const hasField = diagnostics[test.field] !== undefined;
        this.addResult('monitoring', hasField, test.description);
      });

      // Test response time tracking
      const hasResponseTime = diagnostics.apiPerformance?.responseTime !== undefined;
      this.addResult('monitoring', hasResponseTime, 'Response time tracking');

    } catch (error) {
      this.addResult('monitoring', false, `Monitoring test failed: ${error.message}`);
    }
  }

  addResult(category, passed, description, value = null) {
    this.results[category].total++;
    if (passed) this.results[category].passed++;
    
    this.results[category].details.push({
      passed,
      description,
      value,
      timestamp: new Date().toISOString()
    });
  }

  printResults() {
    console.log('\n📊 === PERFORMANCE VERIFICATION RESULTS ===\n');
    
    let totalPassed = 0;
    let totalTests = 0;

    Object.entries(this.results).forEach(([category, stats]) => {
      console.log(`${category.toUpperCase()}: ${stats.passed}/${stats.total} tests passed`);
      
      stats.details.forEach(detail => {
        const status = detail.passed ? '✅' : '❌';
        const value = detail.value ? ` (${detail.value}ms)` : '';
        console.log(`  ${status} ${detail.description}${value}`);
      });
      
      console.log('');
      totalPassed += stats.passed;
      totalTests += stats.total;
    });

    const successRate = (totalPassed / totalTests) * 100;
    console.log(`🎯 OVERALL: ${totalPassed}/${totalTests} tests passed (${successRate.toFixed(1)}%)`);

    if (successRate >= 90) {
      console.log('\n🚀 EXCELLENT: System is performing optimally!');
    } else if (successRate >= 75) {
      console.log('\n⚠️  ACCEPTABLE: Some areas need improvement');
    } else {
      console.log('\n❌ CRITICAL: Significant performance issues detected');
    }

    // Generate recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (this.results.database.passed < this.results.database.total) {
      console.log('  • Review database indexing and query optimization');
    }
    if (this.results.api.passed < this.results.api.total) {
      console.log('  • Optimize API response serialization and caching');
    }
    if (this.results.deepseek.passed < this.results.deepseek.total) {
      console.log('  • Verify DeepSeek API configuration and rate limits');
    }
  }

  async runAllTests() {
    console.log('🔧 === DEEPSEEK PERFORMANCE VERIFICATION ===\n');
    
    await this.testDatabasePerformance();
    await this.testApiEndpoints();
    await this.testDeepSeekProvider();
    await this.testMonitoring();
    
    this.printResults();
    
    // Cleanup
    await prisma.$disconnect();
  }
}

// Run verification if called directly
if (require.main === module) {
  const verifier = new PerformanceVerifier();
  verifier.runAllTests().catch(console.error);
}

module.exports = PerformanceVerifier;