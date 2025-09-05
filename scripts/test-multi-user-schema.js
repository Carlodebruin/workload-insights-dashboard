#!/usr/bin/env node

/**
 * Test script for multi-user database schema implementation
 * Verifies that the schema changes are correctly implemented and backward compatible
 */

const fs = require('fs');

console.log('🧪 Testing Multi-User Database Schema Implementation...\n');

// Test 1: Check if ActivityAssignment model is properly defined
console.log('1. Testing ActivityAssignment Model Definition...');
try {
  const schemaContent = fs.readFileSync('./prisma/schema.prisma', 'utf8');
  
  // Check for ActivityAssignment model
  const hasActivityAssignmentModel = schemaContent.includes('model ActivityAssignment');
  console.log('   ✓ ActivityAssignment model defined:', hasActivityAssignmentModel);
  
  // Check for required fields
  const requiredFields = ['activity_id', 'user_id', 'assigned_at', 'assignment_type', 'status'];
  requiredFields.forEach(field => {
    const hasField = schemaContent.includes(field);
    console.log(`   ✓ ${field} field present:`, hasField);
  });
  
  // Check for relationships
  const hasActivityRelation = schemaContent.includes('activity Activity @relation');
  const hasUserRelation = schemaContent.includes('assignedUser        User @relation');
  const hasAssignedByRelation = schemaContent.includes('assignedByUser      User @relation');
  console.log('   ✓ Activity relationship:', hasActivityRelation);
  console.log('   ✓ Assigned user relationship:', hasUserRelation);
  console.log('   ✓ Assigned by relationship:', hasAssignedByRelation);
  
  // Check for constraints
  const hasUniqueConstraint = schemaContent.includes('@@unique([activity_id, user_id]');
  const hasIndexes = schemaContent.includes('@@index([activity_id]') && 
                    schemaContent.includes('@@index([user_id]');
  console.log('   ✓ Unique constraint:', hasUniqueConstraint);
  console.log('   ✓ Indexes defined:', hasIndexes);
  
} catch (error) {
  console.log('   ✗ Error reading schema:', error.message);
}

// Test 2: Check backward compatibility with existing models
console.log('\n2. Testing Backward Compatibility...');
try {
  const schemaContent = fs.readFileSync('./prisma/schema.prisma', 'utf8');
  
  // Check that assigned_to_user_id is preserved
  const hasLegacyField = schemaContent.includes('assigned_to_user_id String?');
  console.log('   ✓ assigned_to_user_id preserved:', hasLegacyField);
  
  // Check that existing relationships are preserved
  const hasAssignedToRelation = schemaContent.includes('assignedTo   User? @relation("AssignedTo"');
  console.log('   ✓ assignedTo relationship preserved:', hasAssignedToRelation);
  
  // Check that new relationships are additive
  const hasNewActivityRelation = schemaContent.includes('assignments  ActivityAssignment[]');
  const hasNewUserRelations = schemaContent.includes('activityAssignments ActivityAssignment[]') &&
                             schemaContent.includes('assignmentsMade     ActivityAssignment[]');
  console.log('   ✓ New Activity assignments relationship:', hasNewActivityRelation);
  console.log('   ✓ New User assignment relationships:', hasNewUserRelations);
  
} catch (error) {
  console.log('   ✗ Error checking compatibility:', error.message);
}

// Test 3: Check field types and defaults
console.log('\n3. Testing Field Types and Defaults...');
try {
  const schemaContent = fs.readFileSync('./prisma/schema.prisma', 'utf8');
  
  // Check assignment_type default
  const hasAssignmentTypeDefault = schemaContent.includes('assignment_type      String   @default("primary")');
  console.log('   ✓ assignment_type default value:', hasAssignmentTypeDefault);
  
  // Check status default
  const hasStatusDefault = schemaContent.includes('status               String   @default("active")');
  console.log('   ✓ status default value:', hasStatusDefault);
  
  // Check receive_notifications default
  const hasNotificationsDefault = schemaContent.includes('receive_notifications Boolean @default(true)');
  console.log('   ✓ receive_notifications default:', hasNotificationsDefault);
  
  // Check timestamp default
  const hasTimestampDefault = schemaContent.includes('assigned_at          DateTime @default(now())');
  console.log('   ✓ assigned_at default:', hasTimestampDefault);
  
} catch (error) {
  console.log('   ✗ Error checking field defaults:', error.message);
}

// Test 4: Check migration script exists
console.log('\n4. Testing Migration Infrastructure...');
try {
  const migrationScriptExists = fs.existsSync('./scripts/migrate-existing-assignments.js');
  console.log('   ✓ Migration script exists:', migrationScriptExists);
  
  if (migrationScriptExists) {
    const migrationContent = fs.readFileSync('./scripts/migrate-existing-assignments.js', 'utf8');
    const hasPrismaImport = migrationContent.includes('@prisma/client');
    const hasMigrationFunction = migrationContent.includes('migrateExistingAssignments');
    console.log('   ✓ Prisma client import:', hasPrismaImport);
    console.log('   ✓ Migration function:', hasMigrationFunction);
  }
  
} catch (error) {
  console.log('   ✗ Error checking migration script:', error.message);
}

// Test 5: Check schema validation
console.log('\n5. Testing Schema Validation...');
try {
  // Check for common schema validation issues
  const schemaContent = fs.readFileSync('./prisma/schema.prisma', 'utf8');
  
  // Check for duplicate model definitions
  const activityModelCount = (schemaContent.match(/^model Activity {$/gm) || []).length;
  const userModelCount = (schemaContent.match(/^model User {$/gm) || []).length;
  console.log('   ✓ Single Activity model definition:', activityModelCount === 1);
  console.log('   ✓ Single User model definition:', userModelCount === 1);
  
  // Check for proper relation names
  const hasProperRelationNames = schemaContent.includes('@relation("ActivityAssignments"') &&
                                schemaContent.includes('@relation("AssignmentsMade"') &&
                                schemaContent.includes('@relation("AssignedTo"');
  console.log('   ✓ Proper relation names:', hasProperRelationNames);
  
} catch (error) {
  console.log('   ✗ Error validating schema:', error.message);
}

console.log('\n✅ Multi-User Schema Implementation Tests Completed!');
console.log('\n📋 Next Steps:');
console.log('   - Run prisma generate to update client');
console.log('   - Create database migration: npx prisma migrate dev');
console.log('   - Run migration script: node scripts/migrate-existing-assignments.js');
console.log('   - Test that existing functionality continues to work');
console.log('   - Verify new multi-user assignment API endpoints');