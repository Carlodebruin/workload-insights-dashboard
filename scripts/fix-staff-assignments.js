#!/usr/bin/env node

/**
 * Staff Assignment Fix Script
 * Fixes unassigned activities that should be assigned to staff members
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixStaffAssignments() {
  console.log('🔧 Fixing Staff Assignments...\n');

  try {
    // 1. Find unassigned activities that are Open/In Progress
    console.log('🔍 Finding unassigned Open/In Progress activities:');
    const unassignedActivities = await prisma.activity.findMany({
      where: {
        assigned_to_user_id: null,
        status: { in: ['Open', 'In Progress'] }
      },
      select: {
        id: true,
        status: true,
        category: { select: { name: true } },
        timestamp: true
      }
    });

    console.log(`   Found ${unassignedActivities.length} unassigned activities that need fixing:`);
    unassignedActivities.forEach(activity => {
      console.log(`     - ${activity.id.slice(0, 8)}: ${activity.status} (${activity.category.name}) - ${activity.timestamp.toISOString().split('T')[0]}`);
    });
    console.log('');

    if (unassignedActivities.length === 0) {
      console.log('✅ No unassigned activities found - nothing to fix!');
      return;
    }

    // 2. Get available staff members by role
    console.log('👥 Available Staff Members:');
    const staffMembers = await prisma.user.findMany({
      where: {
        role: { in: ['Admin', 'Maintenance', 'Support Staff', 'Staff'] }
      },
      select: {
        id: true,
        name: true,
        role: true
      },
      orderBy: [
        { role: 'asc' },
        { name: 'asc' }
      ]
    });

    staffMembers.forEach(staff => {
      console.log(`     - ${staff.name} (${staff.role})`);
    });
    console.log('');

    // 3. Fix assignments based on activity category
    console.log('⚙️ Fixing assignments:');
    let fixedCount = 0;

    for (const activity of unassignedActivities) {
      try {
        // Determine appropriate staff member based on category
        let assignedUserId = null;
        
        // Maintenance activities should go to Maintenance staff
        if (activity.category.name.includes('Maintenance') || activity.category.name.includes('Facility')) {
          const maintenanceStaff = staffMembers.find(s => s.role === 'Maintenance');
          assignedUserId = maintenanceStaff?.id || null;
        }
        // General activities should go to Admin or Support Staff
        else {
          const adminStaff = staffMembers.find(s => s.role === 'Admin');
          assignedUserId = adminStaff?.id || null;
        }

        if (assignedUserId) {
          await prisma.activity.update({
            where: { id: activity.id },
            data: { 
              assigned_to_user_id: assignedUserId,
              // If status is Open and we're assigning, consider changing to In Progress
              status: activity.status === 'Open' ? 'In Progress' : activity.status
            }
          });

          const staff = staffMembers.find(s => s.id === assignedUserId);
          console.log(`     ✅ ${activity.id.slice(0, 8)}: Assigned to ${staff?.name} (${staff?.role})`);
          fixedCount++;
        } else {
          console.log(`     ⚠️ ${activity.id.slice(0, 8)}: No suitable staff member found`);
        }
      } catch (error) {
        console.log(`     ❌ ${activity.id.slice(0, 8)}: Failed to assign - ${error.message}`);
      }
    }
    console.log('');

    // 4. Verify the fixes
    console.log('✅ Verification:');
    const remainingUnassigned = await prisma.activity.count({
      where: {
        assigned_to_user_id: null,
        status: { in: ['Open', 'In Progress'] }
      }
    });

    console.log(`   Fixed: ${fixedCount} activities`);
    console.log(`   Remaining unassigned: ${remainingUnassigned} activities`);
    console.log(`   Success rate: ${((fixedCount / unassignedActivities.length) * 100).toFixed(1)}%`);

    if (remainingUnassigned === 0) {
      console.log('\n🎉 All unassigned activities have been properly assigned!');
    } else {
      console.log(`\n⚠️  ${remainingUnassigned} activities remain unassigned and need manual attention`);
    }

  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixStaffAssignments().catch(console.error);