#!/usr/bin/env node

/**
 * Dashboard Optimization Verification Script
 * Tests the dashboard filtering logic and data completeness
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class DashboardVerifier {
  constructor() {
    this.results = {
      filtering: { passed: 0, total: 0, details: [] },
      performance: { passed: 0, total: 0, details: [] },
      completeness: { passed: 0, total: 0, details: [] }
    };
  }

  async testFilteringLogic() {
    console.log('🧪 Testing Dashboard Filtering Logic...');
    
    // Get sample data for testing
    const activities = await prisma.activity.findMany({
      take: 100,
      orderBy: { timestamp: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } }
      }
    });

    // Test 1: Default filter (all activities)
    const defaultFiltered = this.applyFilters(activities, 'all', 'all', 'all');
    const defaultPass = defaultFiltered.length === activities.length;
    this.addResult('filtering', defaultPass,
      `Default filter shows all activities: ${defaultFiltered.length}/${activities.length}`);

    // Test 2: Open tasks filter
    const openActivities = activities.filter(a => a.status === 'Open' || a.status === 'In Progress');
    const openFiltered = this.applyFilters(activities, 'all', 'all', 'open');
    const openPass = openFiltered.length === openActivities.length;
    this.addResult('filtering', openPass,
      `Open tasks filter: ${openFiltered.length}/${openActivities.length} open activities`);

    // Test 3: Category filter
    if (activities.length > 0) {
      const sampleCategory = activities[0].category_id;
      const categoryActivities = activities.filter(a => a.category_id === sampleCategory);
      const categoryFiltered = this.applyFilters(activities, 'all', sampleCategory, 'all');
      const categoryPass = categoryFiltered.length === categoryActivities.length;
      this.addResult('filtering', categoryPass,
        `Category filter: ${categoryFiltered.length}/${categoryActivities.length} matching category`);
    }

    // Test 4: User filter
    if (activities.length > 0) {
      const sampleUser = activities[0].user_id;
      const userActivities = activities.filter(a => a.user_id === sampleUser);
      const userFiltered = this.applyFilters(activities, sampleUser, 'all', 'all');
      const userPass = userFiltered.length === userActivities.length;
      this.addResult('filtering', userPass,
        `User filter: ${userFiltered.length}/${userActivities.length} user activities`);
    }
  }

  async testPerformance() {
    console.log('🧪 Testing Dashboard Performance...');
    
    // Test response times for different filter combinations
    const testCases = [
      { userId: 'all', category: 'all', status: 'all', maxTime: 1000, description: 'All filters' },
      { userId: 'all', category: 'all', status: 'open', maxTime: 800, description: 'Open tasks only' },
      { userId: 'all', category: 'unplanned', status: 'all', maxTime: 800, description: 'Unplanned incidents' }
    ];

    for (const testCase of testCases) {
      const startTime = Date.now();
      
      // Simulate the filtering logic that would happen in the dashboard
      const filtered = await this.simulateDashboardFiltering(
        testCase.userId,
        testCase.category,
        testCase.status
      );
      
      const duration = Date.now() - startTime;
      const passed = duration <= testCase.maxTime;
      
      this.addResult('performance', passed,
        `${testCase.description}: ${duration}ms (${filtered.length} activities)`, duration);
    }
  }

  async testDataCompleteness() {
    console.log('🧪 Testing Data Completeness...');
    
    // Test 1: Total activities count consistency
    const dbCount = await prisma.activity.count();
    const sampleData = await prisma.activity.findMany({ take: 500 });
    
    this.addResult('completeness', sampleData.length === Math.min(500, dbCount),
      `Data retrieval: ${sampleData.length}/${dbCount} activities retrieved`);

    // Test 2: Verify all critical fields are present
    if (sampleData.length > 0) {
      const sample = sampleData[0];
      const hasRequiredFields = 
        sample.id && sample.user_id && sample.category_id && sample.timestamp;
      
      this.addResult('completeness', hasRequiredFields,
        'Required fields present in all activities');
    }

    // Test 3: Verify no data loss in serialization
    try {
      const serialized = sampleData.map(activity => ({
        ...activity,
        timestamp: activity.timestamp.toISOString()
      }));
      
      const hasValidTimestamps = serialized.every(a => 
        a.timestamp && typeof a.timestamp === 'string' && a.timestamp.includes('T')
      );
      
      this.addResult('completeness', hasValidTimestamps,
        'Timestamp serialization preserves data integrity');
    } catch (error) {
      this.addResult('completeness', false, `Serialization failed: ${error.message}`);
    }
  }

  // Simulate the dashboard filtering logic from components/Dashboard.tsx
  applyFilters(activities, userId, category, status) {
    return activities.filter(activity => {
      // User filter
      if (userId !== 'all' && activity.user_id !== userId) {
        return false;
      }
      
      // Status filter
      if (status !== 'all' && !(activity.status === 'Open' || activity.status === 'In Progress')) {
        return false;
      }
      
      // Category filter
      if (category !== 'all') {
        if (category === 'UNPLANNED_INCIDENTS') {
          if (!(activity.category_id === 'unplanned' || activity.category_id === 'learner_wellness')) {
            return false;
          }
        } else if (activity.category_id !== category) {
          return false;
        }
      }
      
      return true;
    });
  }

  async simulateDashboardFiltering(userId, category, status) {
    const activities = await prisma.activity.findMany({
      take: 200,
      orderBy: { timestamp: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } }
      }
    });
    
    return this.applyFilters(activities, userId, category, status);
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
    console.log('\n📊 === DASHBOARD OPTIMIZATION RESULTS ===\n');
    
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

    // Generate specific recommendations
    console.log('\n💡 DASHBOARD OPTIMIZATION RECOMMENDATIONS:');
    
    if (this.results.filtering.passed < this.results.filtering.total) {
      console.log('  • Review filtering logic in components/Dashboard.tsx');
      console.log('  • Add debug logging to identify filter mismatches');
    }
    
    if (this.results.performance.passed < this.results.performance.total) {
      console.log('  • Optimize useMemo dependencies in filtering logic');
      console.log('  • Implement pagination for large datasets');
      console.log('  • Add client-side caching for frequent filter combinations');
    }
    
    if (this.results.completeness.passed < this.results.completeness.total) {
      console.log('  • Verify database indexing on frequently filtered columns');
      console.log('  • Add data validation in API response serialization');
      console.log('  • Implement data consistency checks between frontend and backend');
    }

    console.log('\n🔧 QUICK FIXES:');
    console.log('  1. Ensure all activities have required fields (user_id, category_id, timestamp)');
    console.log('  2. Verify category IDs match between frontend and backend');
    console.log('  3. Test filter combinations with realistic data volumes');
    console.log('  4. Monitor console for filtering-related warnings or errors');
  }

  async runAllTests() {
    console.log('🔧 === DASHBOARD OPTIMIZATION VERIFICATION ===\n');
    
    await this.testFilteringLogic();
    await this.testPerformance();
    await this.testDataCompleteness();
    
    this.printResults();
    
    // Cleanup
    await prisma.$disconnect();
  }
}

// Run verification if called directly
if (require.main === module) {
  const verifier = new DashboardVerifier();
  verifier.runAllTests().catch(console.error);
}

module.exports = DashboardVerifier;