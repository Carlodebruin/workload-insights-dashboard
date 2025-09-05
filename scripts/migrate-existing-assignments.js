#!/usr/bin/env node

/**
 * Migration script to populate ActivityAssignment table with existing assignments
 * from the legacy assigned_to_user_id field for backward compatibility
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateExistingAssignments() {
  console.log('🚀 Starting migration of existing assignments to ActivityAssignment table...\n');

  try {
    // Step 1: Find all activities with existing assignments
    console.log('1. Finding activities with existing assignments...');
    const activitiesWithAssignments = await prisma.activity.findMany({
      where: {
        assigned_to_user_id: {
          not: null
        }
      },
      select: {
        id: true,
        assigned_to_user_id: true,
        user_id: true, // The reporter/creator
        assignment_instructions: true
      }
    });

    console.log(`   Found ${activitiesWithAssignments.length} activities with existing assignments`);

    if (activitiesWithAssignments.length === 0) {
      console.log('✅ No existing assignments to migrate');
      return;
    }

    // Check if assignments have already been migrated
    const existingAssignments = await prisma.activityAssignment.count();
    if (existingAssignments > 0) {
      console.log(`✅ Assignments already migrated (${existingAssignments} records found)`);
      console.log('   Skipping migration to avoid duplicates');
      return;
    }

    // Step 2: Create ActivityAssignment records for each existing assignment
    console.log('2. Creating ActivityAssignment records...');
    
    let successCount = 0;
    let errorCount = 0;

    for (const activity of activitiesWithAssignments) {
      try {
        // Create primary assignment record
        await prisma.activityAssignment.create({
          data: {
            activity_id: activity.id,
            user_id: activity.assigned_to_user_id,
            assigned_by: activity.user_id, // Use reporter as the assigner
            assignment_type: 'primary',
            status: 'active',
            role_instructions: activity.assignment_instructions || undefined,
            receive_notifications: true
          }
        });

        successCount++;
        
        if (successCount % 50 === 0) {
          console.log(`   Processed ${successCount} assignments...`);
        }

      } catch (error) {
        console.error(`   Error migrating assignment for activity ${activity.id}:`, error.message);
        errorCount++;
      }
    }

    // Step 3: Verify migration results
    console.log('\n3. Verifying migration results...');
    const totalAssignments = await prisma.activityAssignment.count();
    
    console.log(`
📊 Migration Results:
   - Total activities with assignments: ${activitiesWithAssignments.length}
   - Successfully migrated: ${successCount}
   - Failed to migrate: ${errorCount}
   - Total ActivityAssignment records: ${totalAssignments}
    `);

    if (errorCount > 0) {
      console.warn('⚠️  Some assignments failed to migrate. Check logs for details.');
    }

    // Step 4: Verify data integrity
    console.log('4. Verifying data integrity...');
    
    // Check that all migrated assignments have corresponding activity and user records
    // First get all assignment IDs
    const allAssignments = await prisma.activityAssignment.findMany({
      select: {
        id: true,
        activity_id: true,
        user_id: true
      }
    });

    // Check for orphaned assignments by verifying existence of activity and user
    const orphanedAssignments = [];
    
    for (const assignment of allAssignments) {
      const activityExists = await prisma.activity.findUnique({
        where: { id: assignment.activity_id }
      });
      
      const userExists = await prisma.user.findUnique({
        where: { id: assignment.user_id }
      });
      
      if (!activityExists || !userExists) {
        orphanedAssignments.push(assignment);
      }
    }

    if (orphanedAssignments.length > 0) {
      console.warn(`   ⚠️  Found ${orphanedAssignments.length} orphaned assignments (missing activity or user)`);
    } else {
      console.log('   ✅ All assignments have valid activity and user references');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   - Test that existing functionality continues to work');
    console.log('   - Verify new multi-user assignment API endpoints');
    console.log('   - Implement dual-write pattern for new assignments');
    console.log('   - Monitor for any data consistency issues');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateExistingAssignments().catch(console.error);
}

module.exports = { migrateExistingAssignments };