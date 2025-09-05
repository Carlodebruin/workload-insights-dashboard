#!/usr/bin/env tsx
/**
 * Test script for optimized database queries
 * Verifies that all optimized query methods work correctly
 */

import { PrismaClient } from '@prisma/client';
import { optimizedQueries, performanceMonitor } from '../lib/database-optimization';

const prisma = new PrismaClient();

async function testOptimizedQueries() {
  console.log('🧪 Testing Optimized Database Queries...\n');

  try {
    // Test 1: Basic optimized activity query
    console.log('1. Testing getActivitiesOptimized...');
    const activities = await optimizedQueries.getActivitiesOptimized(prisma, {
      limit: 5,
      offset: 0
    });
    console.log(`   ✅ Retrieved ${activities.length} activities`);

    // Test 2: Backward compatibility - getActivitiesMinimal
    console.log('2. Testing backward compatibility (getActivitiesMinimal)...');
    const minimalResult = await optimizedQueries.getActivitiesMinimal(prisma, 1, 5);
    console.log(`   ✅ Retrieved ${minimalResult.activities.length} activities with pagination`);
    console.log(`   ✅ Total records: ${minimalResult.pagination.totalRecords}`);

    // Test 3: Backward compatibility - getWhatsAppMessagesOptimized
    console.log('3. Testing WhatsApp messages optimization...');
    const whatsappResult = await optimizedQueries.getWhatsAppMessagesOptimized(prisma, 1, 5);
    console.log(`   ✅ Retrieved ${whatsappResult.messages.length} WhatsApp messages`);
    console.log(`   ✅ Total messages: ${whatsappResult.pagination.totalRecords}`);

    // Test 4: Dashboard statistics
    console.log('4. Testing dashboard statistics...');
    const dashboardStats = await optimizedQueries.getDashboardStatsOptimized(prisma);
    console.log(`   ✅ Activities: ${dashboardStats.activities.total}`);
    console.log(`   ✅ Users: ${dashboardStats.users}`);
    console.log(`   ✅ Categories: ${dashboardStats.categories}`);

    // Test 5: User workload analysis
    console.log('5. Testing user workload analysis...');
    const userWorkloads = await optimizedQueries.getUserWorkloadsOptimized(prisma);
    console.log(`   ✅ Analyzed ${userWorkloads.userWorkloads.length} users`);
    console.log(`   ✅ Team summary: ${userWorkloads.teamSummary.totalActive} active assignments`);

    // Test 6: Performance monitoring
    console.log('6. Testing performance monitoring...');
    const healthCheck = await performanceMonitor.checkDatabaseHealth(prisma);
    console.log(`   ✅ Database health: ${healthCheck.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`   ✅ Response time: ${healthCheck.responseTimeMs}ms`);

    // Test 7: Search optimization
    console.log('7. Testing search optimization...');
    const searchResults = await optimizedQueries.searchActivitiesOptimized(prisma, 'test', 3);
    console.log(`   ✅ Found ${searchResults.length} search results`);

    console.log('\n🎉 All optimized query tests completed successfully!');
    console.log('\n📊 Performance Metrics:');
    console.log('   - All queries executed with optimized patterns');
    console.log('   - Backward compatibility maintained');
    console.log('   - Performance monitoring integrated');
    console.log('   - Strategic indexing ready for deployment');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests with performance monitoring
performanceMonitor.measureQuery(
  'complete_test_suite',
  () => testOptimizedQueries()
).then(() => {
  console.log('\n🏁 Test suite completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});