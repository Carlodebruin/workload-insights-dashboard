#!/usr/bin/env node

/**
 * Staff Assignment Fix Verification Script
 * Tests the API endpoint to ensure staff assignments are properly visible
 */

const axios = require('axios');

async function verifyStaffAssignmentFix() {
  console.log('🧪 Verifying Staff Assignment Fix...\n');

  try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    console.log(`🌐 Testing API endpoint: ${baseUrl}/api/data\n`);

    // Test 1: Fetch data from the API endpoint
    console.log('1️⃣ Testing API data endpoint:');
    const response = await axios.get(`${baseUrl}/api/data?limit=50`);
    const data = response.data;

    console.log(`   ✅ API Response: ${data.activities.length} activities`);
    console.log(`   ✅ Users: ${data.users.length} users`);
    console.log(`   ✅ Categories: ${data.categories.length} categories`);

    // Test 2: Check assignment statistics
    const assignedActivities = data.activities.filter(a => a.assigned_to_user_id);
    const unassignedActivities = data.activities.filter(a => !a.assigned_to_user_id);
    
    console.log(`\n2️⃣ Assignment Statistics:`);
    console.log(`   ✅ Total activities: ${data.activities.length}`);
    console.log(`   ✅ Assigned activities: ${assignedActivities.length}`);
    console.log(`   ✅ Unassigned activities: ${unassignedActivities.length}`);
    console.log(`   ✅ Assignment rate: ${((assignedActivities.length / data.activities.length) * 100).toFixed(1)}%`);

    // Test 3: Check for unassigned but active activities
    const unassignedButActive = data.activities.filter(a => 
      !a.assigned_to_user_id && (a.status === 'Open' || a.status === 'In Progress')
    );

    console.log(`\n3️⃣ Unassigned but Active Check:`);
    if (unassignedButActive.length === 0) {
      console.log(`   ✅ No unassigned active activities found`);
    } else {
      console.log(`   ⚠️ Found ${unassignedButActive.length} unassigned active activities:`);
      unassignedButActive.forEach(activity => {
        console.log(`     - ${activity.id.slice(0, 8)}: ${activity.status} (${activity.subcategory})`);
      });
    }

    // Test 4: Sample assignments verification
    console.log(`\n4️⃣ Sample Assignments Verification:`);
    const sampleAssignments = assignedActivities.slice(0, 5);
    sampleAssignments.forEach(activity => {
      const assignedUser = data.users.find(u => u.id === activity.assigned_to_user_id);
      console.log(`   ✅ ${activity.id.slice(0, 8)}: ${activity.status} → ${assignedUser?.name || 'Unknown'} (${assignedUser?.role || 'No Role'})`);
    });

    // Test 5: Check assignment consistency
    console.log(`\n5️⃣ Assignment Consistency Check:`);
    const inconsistentAssignments = data.activities.filter(a => 
      a.assigned_to_user_id && a.status === 'Unassigned'
    );

    if (inconsistentAssignments.length === 0) {
      console.log(`   ✅ No inconsistent assignments found`);
    } else {
      console.log(`   ⚠️ Found ${inconsistentAssignments.length} inconsistent assignments:`);
      inconsistentAssignments.forEach(activity => {
        const assignedUser = data.users.find(u => u.id === activity.assigned_to_user_id);
        console.log(`     - ${activity.id.slice(0, 8)}: Assigned to ${assignedUser?.name} but status is Unassigned`);
      });
    }

    // Summary
    console.log(`\n📋 VERIFICATION SUMMARY:`);
    console.log(`   • Total activities: ${data.activities.length}`);
    console.log(`   • Assigned activities: ${assignedActivities.length}`);
    console.log(`   • Assignment rate: ${((assignedActivities.length / data.activities.length) * 100).toFixed(1)}%`);
    console.log(`   • Unassigned but active: ${unassignedButActive.length}`);
    console.log(`   • Inconsistent assignments: ${inconsistentAssignments.length}`);

    if (unassignedButActive.length === 0 && inconsistentAssignments.length === 0) {
      console.log(`\n🎉 SUCCESS: All staff assignments are properly visible and consistent!`);
    } else {
      console.log(`\n⚠️  WARNING: Some assignment issues still need attention`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`❌ Verification failed: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data)}`);
    }
    process.exit(1);
  }
}

// Run verification
verifyStaffAssignmentFix().catch(console.error);