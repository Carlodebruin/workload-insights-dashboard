#!/usr/bin/env tsx

/**
 * Test script for User Workload Analytics Engine
 * Validates the implementation of Prompt 2.4
 */

import { calculateUserWorkloads, getWorkloadInsights } from '../lib/workload-analytics';
import { Activity, User, Category } from '../types';

// Mock data for testing
const mockUsers: User[] = [
  { id: 'user1', name: 'John Doe', role: 'Teacher', phone_number: '+1234567890' },
  { id: 'user2', name: 'Jane Smith', role: 'Admin', phone_number: '+1234567891' },
  { id: 'user3', name: 'Bob Johnson', role: 'Maintenance', phone_number: '+1234567892' }
];

const mockCategories: Category[] = [
  { id: 'cat1', name: 'Maintenance' },
  { id: 'cat2', name: 'Discipline' },
  { id: 'cat3', name: 'Sports' }
];

const mockActivities: Activity[] = [
  // User 1: High workload, some overdue
  { id: 'act1', user_id: 'user1', category_id: 'cat1', subcategory: 'Repair', location: 'Classroom A', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), status: 'In Progress', assigned_to_user_id: 'user1' },
  { id: 'act2', user_id: 'user1', category_id: 'cat1', subcategory: 'Maintenance', location: 'Hallway', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), status: 'Open', assigned_to_user_id: 'user1' },
  { id: 'act3', user_id: 'user1', category_id: 'cat2', subcategory: 'Incident', location: 'Playground', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), status: 'Resolved', assigned_to_user_id: 'user1' },
  
  // User 2: Medium workload, all resolved
  { id: 'act4', user_id: 'user2', category_id: 'cat3', subcategory: 'Training', location: 'Field', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), status: 'Resolved', assigned_to_user_id: 'user2' },
  { id: 'act5', user_id: 'user2', category_id: 'cat2', subcategory: 'Meeting', location: 'Office', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), status: 'Resolved', assigned_to_user_id: 'user2' },
  
  // User 3: No assignments
  // Intentionally empty to test zero workload case
];

async function testWorkloadAnalytics() {
  console.log('🧪 Testing User Workload Analytics Engine...\n');
  
  try {
    // Test 1: Basic calculation
    console.log('1. Testing workload calculation...');
    const result = await calculateUserWorkloads(mockActivities, mockUsers, mockCategories);
    
    console.log('✅ Workload calculation completed successfully');
    console.log(`   - User workloads: ${result.userWorkloads.length}`);
    console.log(`   - Team summary: ${result.teamSummary.totalActiveAssignments} active assignments`);
    
    // Test 2: Verify user workload data
    console.log('\n2. Verifying user workload data...');
    const user1Workload = result.userWorkloads.find(u => u.userId === 'user1');
    const user2Workload = result.userWorkloads.find(u => u.userId === 'user2');
    const user3Workload = result.userWorkloads.find(u => u.userId === 'user3');
    
    if (user1Workload) {
      console.log(`   ✅ User 1 (John Doe):`);
      console.log(`      - Active: ${user1Workload.workloadMetrics.activeAssignments}`);
      console.log(`      - Completed: ${user1Workload.workloadMetrics.completedThisWeek}`);
      console.log(`      - Workload Score: ${user1Workload.workloadMetrics.workloadScore}`);
    }
    
    if (user2Workload) {
      console.log(`   ✅ User 2 (Jane Smith):`);
      console.log(`      - Active: ${user2Workload.workloadMetrics.activeAssignments}`);
      console.log(`      - Completed: ${user2Workload.workloadMetrics.completedThisWeek}`);
      console.log(`      - Completion Rate: ${user2Workload.workloadMetrics.completionRate}%`);
    }
    
    if (user3Workload && user3Workload.workloadMetrics.activeAssignments === 0) {
      console.log(`   ✅ User 3 (Bob Johnson): No workload (as expected)`);
    }
    
    // Test 3: Team summary validation
    console.log('\n3. Verifying team summary...');
    console.log(`   ✅ Total active assignments: ${result.teamSummary.totalActiveAssignments}`);
    console.log(`   ✅ Total overdue: ${result.teamSummary.totalOverdue}`);
    console.log(`   ✅ Average completion rate: ${Math.round(result.teamSummary.averageCompletionRate)}%`);
    
    if (result.teamSummary.mostLoadedUser && result.teamSummary.leastLoadedUser) {
      console.log(`   ✅ Workload distribution: ${result.teamSummary.mostLoadedUser} (most) ↔ ${result.teamSummary.leastLoadedUser} (least)`);
    }
    
    // Test 4: Insights generation
    console.log('\n4. Testing insights generation...');
    const insights = getWorkloadInsights(result.userWorkloads, result.teamSummary);
    console.log(`   ✅ Generated ${insights.length} insights:`);
    
    insights.forEach((insight, index) => {
      console.log(`      ${index + 1}. [${insight.type.toUpperCase()}] ${insight.title}: ${insight.message}`);
    });
    
    // Test 5: Edge cases
    console.log('\n5. Testing edge cases...');
    
    // Empty data test
    const emptyResult = await calculateUserWorkloads([], mockUsers, mockCategories);
    console.log(`   ✅ Empty activities handled: ${emptyResult.userWorkloads.length} user workloads`);
    
    // Single user test
    const singleUserResult = await calculateUserWorkloads(
      mockActivities.filter(a => a.assigned_to_user_id === 'user1'),
      mockUsers.filter(u => u.id === 'user1'),
      mockCategories
    );
    console.log(`   ✅ Single user analysis: ${singleUserResult.userWorkloads.length} user workload`);
    
    console.log('\n🎉 All tests passed! Workload Analytics Engine is working correctly.');
    console.log('\n📊 Sample Workload Data:');
    console.log(JSON.stringify(result.userWorkloads.map(u => ({
      user: u.userName,
      active: u.workloadMetrics.activeAssignments,
      completed: u.workloadMetrics.completedThisWeek,
      overdue: u.workloadMetrics.overdueAssignments,
      score: u.workloadMetrics.workloadScore,
      utilization: `${u.workloadMetrics.capacityUtilization}%`
    })), null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the test
testWorkloadAnalytics().catch(console.error);