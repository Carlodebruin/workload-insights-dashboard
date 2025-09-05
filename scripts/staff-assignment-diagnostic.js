#!/usr/bin/env node

/**
 * Staff Assignment Diagnostic Script
 * Tests and verifies staff assignment visibility across the system
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runDiagnostic() {
  console.log('🧪 Starting Staff Assignment Diagnostic...\n');

  try {
    // 1. Check database connection and basic counts
    console.log('📊 Database Statistics:');
    const totalUsers = await prisma.user.count();
    const totalActivities = await prisma.activity.count();
    const assignedActivities = await prisma.activity.count({
      where: { assigned_to_user_id: { not: null } }
    });

    console.log(`   Total Users: ${totalUsers}`);
    console.log(`   Total Activities: ${totalActivities}`);
    console.log(`   Assigned Activities: ${assignedActivities}`);
    console.log(`   Assignment Rate: ${((assignedActivities / totalActivities) * 100).toFixed(1)}%\n`);

    // 2. Check user roles and assignment patterns
    console.log('👥 User Role Analysis:');
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true }
    });

    usersByRole.forEach(roleGroup => {
      console.log(`   ${roleGroup.role}: ${roleGroup._count.id} users`);
    });
    console.log('');

    // 3. Check assignment patterns by role
    console.log('📋 Assignment Patterns by Role:');
    const assignmentsByRole = await prisma.user.findMany({
      select: {
        role: true,
        assignedActivities: {
          select: { id: true }
        }
      }
    });

    const roleAssignmentStats = {};
    assignmentsByRole.forEach(user => {
      if (!roleAssignmentStats[user.role]) {
        roleAssignmentStats[user.role] = { totalAssignments: 0, userCount: 0 };
      }
      roleAssignmentStats[user.role].totalAssignments += user.assignedActivities.length;
      roleAssignmentStats[user.role].userCount += 1;
    });

    Object.entries(roleAssignmentStats).forEach(([role, stats]) => {
      const avgAssignments = stats.userCount > 0 ? (stats.totalAssignments / stats.userCount).toFixed(1) : '0';
      console.log(`   ${role}: ${stats.totalAssignments} total assignments, ${avgAssignments} avg per user`);
    });
    console.log('');

    // 4. Check for null assignments that should be assigned
    console.log('🔍 Checking for Missing Assignments:');
    const unassignedButShouldBe = await prisma.activity.findMany({
      where: {
        assigned_to_user_id: null,
        status: { in: ['Open', 'In Progress'] }
      },
      select: {
        id: true,
        status: true,
        category: { select: { name: true } },
        timestamp: true
      },
      take: 10
    });

    console.log(`   Found ${unassignedButShouldBe.length} unassigned activities that are Open/In Progress:`);
    unassignedButShouldBe.forEach(activity => {
      console.log(`     - ${activity.id.slice(0, 8)}: ${activity.status} (${activity.category.name}) - ${activity.timestamp.toISOString().split('T')[0]}`);
    });
    console.log('');

    // 5. Check assignment consistency
    console.log('✅ Assignment Consistency Check:');
    const inconsistentAssignments = await prisma.activity.findMany({
      where: {
        assigned_to_user_id: { not: null },
        status: 'Unassigned'
      },
      select: {
        id: true,
        assigned_to_user_id: true,
        timestamp: true
      },
      take: 10
    });

    console.log(`   Found ${inconsistentAssignments.length} activities assigned but marked as Unassigned:`);
    inconsistentAssignments.forEach(activity => {
      console.log(`     - ${activity.id.slice(0, 8)}: Assigned to ${activity.assigned_to_user_id?.slice(0, 8)} but status is Unassigned`);
    });
    console.log('');

    // 6. Test API data retrieval patterns
    console.log('🌐 API Data Retrieval Test:');
    const apiTestActivities = await prisma.activity.findMany({
      take: 50,
      select: {
        id: true,
        assigned_to_user_id: true,
        status: true,
        user: { select: { name: true } },
        assignedTo: { select: { name: true } }
      },
      orderBy: { timestamp: 'desc' }
    });

    const apiAssignedCount = apiTestActivities.filter(a => a.assigned_to_user_id).length;
    console.log(`   API Sample: ${apiTestActivities.length} activities, ${apiAssignedCount} assigned (${((apiAssignedCount / apiTestActivities.length) * 100).toFixed(1)}%)`);

    // Show sample assignments
    const sampleAssignments = apiTestActivities.filter(a => a.assigned_to_user_id).slice(0, 5);
    console.log('   Sample Assignments:');
    sampleAssignments.forEach(activity => {
      console.log(`     - ${activity.id.slice(0, 8)}: ${activity.user.name} → ${activity.assignedTo?.name || 'Unknown'} (${activity.status})`);
    });
    console.log('');

    // 7. Check for orphaned assignments (users that don't exist)
    console.log('🔗 Checking for Orphaned Assignments:');
    const allAssignedActivities = await prisma.activity.findMany({
      where: { assigned_to_user_id: { not: null } },
      select: { assigned_to_user_id: true }
    });

    const assignedUserIds = [...new Set(allAssignedActivities.map(a => a.assigned_to_user_id))];
    const existingUsers = await prisma.user.findMany({
      where: { id: { in: assignedUserIds } },
      select: { id: true }
    });

    const existingUserIds = new Set(existingUsers.map(u => u.id));
    const orphanedAssignments = assignedUserIds.filter(id => !existingUserIds.has(id));

    console.log(`   Found ${orphanedAssignments.length} orphaned assignments (users that don't exist):`);
    orphanedAssignments.slice(0, 5).forEach(userId => {
      console.log(`     - User ID: ${userId}`);
    });
    if (orphanedAssignments.length > 5) {
      console.log(`     ... and ${orphanedAssignments.length - 5} more`);
    }
    console.log('');

    // 8. Summary and recommendations
    console.log('📋 DIAGNOSTIC SUMMARY:');
    console.log(`   • Total assignments: ${assignedActivities}`);
    console.log(`   • Assignment rate: ${((assignedActivities / totalActivities) * 100).toFixed(1)}%`);
    console.log(`   • Unassigned but active: ${unassignedButShouldBe.length}`);
    console.log(`   • Inconsistent status: ${inconsistentAssignments.length}`);
    console.log(`   • Orphaned assignments: ${orphanedAssignments.length}`);
    console.log('');

    console.log('💡 RECOMMENDATIONS:');
    if (unassignedButShouldBe.length > 0) {
      console.log('   • Review unassigned Open/In Progress activities for proper assignment');
    }
    if (inconsistentAssignments.length > 0) {
      console.log('   • Fix activities with assigned users but Unassigned status');
    }
    if (orphanedAssignments.length > 0) {
      console.log('   • Clean up orphaned assignments (users that were deleted)');
    }
    if (assignedActivities === 0 && totalActivities > 0) {
      console.log('   • No assignments found - check assignment workflow');
    }

  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the diagnostic
runDiagnostic().catch(console.error);