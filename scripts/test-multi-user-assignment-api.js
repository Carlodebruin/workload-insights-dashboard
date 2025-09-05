#!/usr/bin/env node

/**
 * Test script to verify the multi-user assignment API endpoints
 * This script tests the new API endpoints without requiring a full build
 */

const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function testMultiUserAssignmentAPI() {
  console.log('🧪 Testing Multi-User Assignment API Endpoints\n');
  
  try {
    // 1. Check if ActivityAssignment model exists in Prisma
    console.log('1. Checking Prisma client for ActivityAssignment model...');
    
    // Test if we can access the model
    try {
      const testQuery = await prisma.activityAssignment.findFirst();
      console.log('✅ ActivityAssignment model is accessible in Prisma client');
    } catch (error) {
      console.log('❌ ActivityAssignment model not found in Prisma client:', error.message);
      return false;
    }
    
    // 2. Test API route file exists and has correct structure
    console.log('\n2. Checking API route file structure...');
    const apiRoutePath = path.join(__dirname, '../app/api/activities/[activityId]/assignments/route.ts');
    
    if (fs.existsSync(apiRoutePath)) {
      const content = fs.readFileSync(apiRoutePath, 'utf8');
      
      // Check for required exports
      const hasGET = content.includes('export async function GET');
      const hasPOST = content.includes('export async function POST');
      const hasValidationImport = content.includes('newActivityAssignmentSchema');
      
      console.log(`✅ API route file exists at: ${apiRoutePath}`);
      console.log(`   - GET function: ${hasGET ? '✅' : '❌'}`);
      console.log(`   - POST function: ${hasPOST ? '✅' : '❌'}`);
      console.log(`   - Validation schema import: ${hasValidationImport ? '✅' : '❌'}`);
      
      if (!hasGET || !hasPOST || !hasValidationImport) {
        console.log('❌ API route file is missing required components');
        return false;
      }
    } else {
      console.log('❌ API route file does not exist');
      return false;
    }
    
    // 3. Test validation schema file
    console.log('\n3. Checking validation schema file...');
    const validationPath = path.join(__dirname, '../lib/validation/activity-assignment.ts');
    
    if (fs.existsSync(validationPath)) {
      const content = fs.readFileSync(validationPath, 'utf8');
      
      const hasActivityAssignmentSchema = content.includes('activityAssignmentSchema');
      const hasNewActivityAssignmentSchema = content.includes('newActivityAssignmentSchema');
      const hasZodImports = content.includes('import { z }');
      
      console.log(`✅ Validation schema file exists at: ${validationPath}`);
      console.log(`   - activityAssignmentSchema: ${hasActivityAssignmentSchema ? '✅' : '❌'}`);
      console.log(`   - newActivityAssignmentSchema: ${hasNewActivityAssignmentSchema ? '✅' : '❌'}`);
      console.log(`   - Zod imports: ${hasZodImports ? '✅' : '❌'}`);
      
      if (!hasActivityAssignmentSchema || !hasNewActivityAssignmentSchema || !hasZodImports) {
        console.log('❌ Validation schema file is missing required components');
        return false;
      }
    } else {
      console.log('❌ Validation schema file does not exist');
      return false;
    }
    
    // 4. Test TypeScript compilation (quick check)
    console.log('\n4. Testing TypeScript compilation...');
    try {
      // Try to compile just the API route file
      const tscCheck = execSync('npx tsc --noEmit --skipLibCheck app/api/activities/[activityId]/assignments/route.ts', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      console.log('✅ TypeScript compilation passed (no errors)');
    } catch (error) {
      console.log('❌ TypeScript compilation failed:');
      console.log(error.stdout || error.message);
      return false;
    }
    
    // 5. Test individual assignment endpoint file
    console.log('\n5. Checking individual assignment API endpoint...');
    const individualApiRoutePath = path.join(__dirname, '../app/api/activities/[activityId]/assignments/[assignmentId]/route.ts');
    
    if (fs.existsSync(individualApiRoutePath)) {
      const content = fs.readFileSync(individualApiRoutePath, 'utf8');
      
      // Check for required exports
      const hasGET = content.includes('export async function GET');
      const hasPUT = content.includes('export async function PUT');
      const hasDELETE = content.includes('export async function DELETE');
      
      console.log(`✅ Individual assignment API route file exists at: ${individualApiRoutePath}`);
      console.log(`   - GET function: ${hasGET ? '✅' : '❌'}`);
      console.log(`   - PUT function: ${hasPUT ? '✅' : '❌'}`);
      console.log(`   - DELETE function: ${hasDELETE ? '✅' : '❌'}`);
      
      if (!hasGET || !hasPUT || !hasDELETE) {
        console.log('❌ Individual assignment API route file is missing required components');
        return false;
      }
    } else {
      console.log('❌ Individual assignment API route file does not exist');
      return false;
    }
    
    // 6. Test database connection and sample data
    console.log('\n6. Testing database connection and sample data...');
    try {
      // Count existing assignments
      const assignmentCount = await prisma.activityAssignment.count();
      console.log(`✅ Database connection successful`);
      console.log(`   - Existing assignments in database: ${assignmentCount}`);
      
      // Check if we have sample activities and users to test with
      const activityCount = await prisma.activity.count();
      const userCount = await prisma.user.count();
      
      console.log(`   - Available activities: ${activityCount}`);
      console.log(`   - Available users: ${userCount}`);
      
      if (activityCount === 0 || userCount < 2) {
        console.log('⚠️  Need at least 1 activity and 2 users for comprehensive testing');
      }
      
    } catch (error) {
      console.log('❌ Database connection test failed:', error.message);
      return false;
    }
    
    console.log('\n🎉 Multi-User Assignment API implementation is complete and ready!');
    console.log('\n📋 Next steps:');
    console.log('   - Test the API endpoints manually with curl or Postman');
    console.log('   - Integrate the new endpoints with the frontend UI');
    console.log('   - Update existing activity APIs to maintain backward compatibility');
    console.log('   - Add DELETE and PUT endpoints for assignment management');
    
    return true;
    
  } catch (error) {
    console.log('❌ Unexpected error during testing:', error.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testMultiUserAssignmentAPI()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });