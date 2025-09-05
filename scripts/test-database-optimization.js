#!/usr/bin/env node

/**
 * Database Query Optimization Test Script
 * Validates the implementation of Prompt 4.2: Advanced Database Query Optimization
 */

const { PrismaClient } = require('@prisma/client');
const { OptimizedQueries } = require('../lib/optimized-queries');
const { performanceMonitor } = require('../lib/performance-monitor');

const prisma = new PrismaClient();

// Test configuration
const TEST_CONFIG = {
  maxTestDuration: 30000, // 30 seconds max
  sampleDataSize: 10,
  performanceThreshold: 1000, // 1 second max per query
};

// Test results tracking
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  performance: [],
};

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function measurePerformance(name, fn) {
  const start = process.hrtime.bigint();
  const result = fn();
  const end = process.hrtime.bigint();
  const durationMs = Number(end - start) / 1e6;
  
  testResults.performance.push({ name, durationMs });
  
  if (durationMs > TEST_CONFIG.performanceThreshold) {
    log(`Slow performance: ${name} took ${durationMs.toFixed(2)}ms`, 'warning');
    testResults.warnings++;
  }
  
  return { result, durationMs };
}

async function testWithRetry(name, testFn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await testFn();
      return result;
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(`${name} failed after ${maxRetries} attempts: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Test cases
async function testOptimizedQueries() {
  log('Testing OptimizedQueries class...');
  
  // Test 1: Basic activity fetching
  await testWithRetry('getActivitiesOptimized', async () => {
    const { result, durationMs } = measurePerformance('getActivitiesOptimized', () => 
      OptimizedQueries.getActivitiesOptimized(prisma, { limit: 5 })
    );
    
    if (!Array.isArray(result)) {
      throw new Error('Expected array of activities');
    }
    
    log(`Fetched ${result.length} activities in ${durationMs.toFixed(2)}ms`);
    return true;
  });
  
  // Test 2: Filtered queries
  await testWithRetry('getActivitiesOptimized with filters', async () => {
    const { result } = measurePerformance('getActivitiesOptimized with filters', () => 
      OptimizedQueries.getActivitiesOptimized(prisma, { 
        status: 'Open',
        limit: 3
      })
    );
    
    if (result.some(activity => activity.status !== 'Open')) {
      throw new Error('Filter by status failed');
    }
    
    log(`Filtered queries working correctly`);
    return true;
  });
  
  // Test 3: User workload calculation
  await testWithRetry('getUserWorkloadOptimized', async () => {
    // Get a user with assignments
    const userWithAssignments = await prisma.user.findFirst({
      where: { 
        assignedActivities: { some: {} } 
      }
    });
    
    if (userWithAssignments) {
      const { result } = measurePerformance('getUserWorkloadOptimized', () => 
        OptimizedQueries.getUserWorkloadOptimized(prisma, userWithAssignments.id, {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end: new Date()
        })
      );
      
      if (typeof result.activeCount !== 'number') {
        throw new Error('Workload calculation failed');
      }
      
      log(`User workload calculation successful: ${result.activeCount} active assignments`);
    } else {
      log('No users with assignments found for workload test', 'warning');
    }
    
    return true;
  });
  
  // Test 4: Dashboard statistics
  await testWithRetry('getDashboardStatsOptimized', async () => {
    const { result } = measurePerformance('getDashboardStatsOptimized', () => 
      OptimizedQueries.getDashboardStatsOptimized(prisma)
    );
    
    if (!result.activities || !result.users) {
      throw new Error('Dashboard stats incomplete');
    }
    
    log(`Dashboard stats: ${result.activities.total} activities, ${result.users} users`);
    return true;
  });
  
  // Test 5: Search functionality
  await testWithRetry('searchActivitiesOptimized', async () => {
    // Get a sample activity to search for
    const sampleActivity = await prisma.activity.findFirst({
      where: { notes: { not: null } }
    });
    
    if (sampleActivity && sampleActivity.notes) {
      const searchTerm = sampleActivity.notes.split(' ')[0];
      if (searchTerm) {
        const { result } = measurePerformance('searchActivitiesOptimized', () => 
          OptimizedQueries.searchActivitiesOptimized(prisma, searchTerm, 5)
        );
        
        log(`Search found ${result.length} results for "${searchTerm}"`);
      }
    } else {
      log('No activities with notes found for search test', 'warning');
    }
    
    return true;
  });
}

async function testPerformanceMonitoring() {
  log('Testing Performance Monitoring...');
  
  // Test performance monitoring
  await performanceMonitor.measureQuery('test_query', async () => {
    return prisma.activity.count();
  });
  
  const stats = performanceMonitor.getPerformanceStats();
  
  if (stats.totalQueries === 0) {
    throw new Error('Performance monitoring not tracking queries');
  }
  
  log(`Performance monitoring active: ${stats.totalQueries} queries tracked`);
  
  // Test database health check
  const health = await performanceMonitor.checkDatabaseHealth(prisma);
  if (!health.healthy) {
    throw new Error(`Database health check failed: ${health.error}`);
  }
  
  log(`Database health: ${health.healthy} (${health.responseTime}ms)`);
}

async function testIndexValidation() {
  log('Validating database indexes...');
  
  // Check if common indexes exist (this is a basic validation)
  const indexCheck = await prisma.$queryRaw`
    SELECT 
      COUNT(*) as index_count,
      string_agg(indexname, ', ') as indexes
    FROM pg_indexes 
    WHERE tablename IN ('activities', 'users', 'categories', 'activity_updates')
    AND indexname LIKE 'idx_%'
  `;
  
  if (indexCheck[0].index_count > 0) {
    log(`Found ${indexCheck[0].index_count} optimization indexes`);
  } else {
    log('No optimization indexes found - run create-optimization-indexes.sql', 'warning');
  }
}

async function runAllTests() {
  const startTime = Date.now();
  
  try {
    log('Starting Database Query Optimization Tests');
    log('==========================================');
    
    // Verify database connection
    await prisma.$connect();
    log('Database connection established');
    
    // Run test suites
    await testOptimizedQueries();
    await testPerformanceMonitoring();
    await testIndexValidation();
    
    // Summary
    const totalDuration = Date.now() - startTime;
    const avgPerformance = testResults.performance.reduce((sum, p) => sum + p.durationMs, 0) / 
                          testResults.performance.length;
    
    log('\nTest Summary:');
    log('=============');
    log(`Total tests run: ${testResults.total}`);
    log(`Passed: ${testResults.passed}`);
    log(`Failed: ${testResults.failed}`);
    log(`Warnings: ${testResults.warnings}`);
    log(`Total duration: ${totalDuration}ms`);
    log(`Average query performance: ${avgPerformance.toFixed(2)}ms`);
    
    // Performance analysis
    const slowestQuery = testResults.performance.sort((a, b) => b.durationMs - a.durationMs)[0];
    const fastestQuery = testResults.performance.sort((a, b) => a.durationMs - b.durationMs)[0];
    
    log(`Slowest query: ${slowestQuery.name} (${slowestQuery.durationMs.toFixed(2)}ms)`);
    log(`Fastest query: ${fastestQuery.name} (${fastestQuery.durationMs.toFixed(2)}ms)`);
    
    if (testResults.failed > 0) {
      log('❌ Some tests failed!', 'error');
      process.exit(1);
    } else if (testResults.warnings > 0) {
      log('⚠️ Tests completed with warnings', 'warning');
      process.exit(0);
    } else {
      log('✅ All tests passed successfully!');
      process.exit(0);
    }
    
  } catch (error) {
    log(`Test execution failed: ${error.message}`, 'error');
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    performanceMonitor.resetMetrics();
  }
}

// Enhanced test tracking
const originalTest = async (name, testFn) => {
  testResults.total++;
  try {
    await testFn();
    testResults.passed++;
    log(`${name} - PASSED`);
    return true;
  } catch (error) {
    testResults.failed++;
    log(`${name} - FAILED: ${error.message}`, 'error');
    return false;
  }
};

// Monkey patch for better test tracking
const originalTestWithRetry = testWithRetry;
testWithRetry = async (name, testFn, maxRetries = 3) => {
  return originalTest(name, () => originalTestWithRetry(name, testFn, maxRetries));
};

// Run tests
runAllTests();

// Handle process termination
process.on('SIGINT', async () => {
  log('Test interrupted by user');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  log(`Unhandled rejection: ${error.message}`, 'error');
  process.exit(1);
});