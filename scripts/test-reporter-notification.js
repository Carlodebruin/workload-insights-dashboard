#!/usr/bin/env node

/**
 * Test script for Reporter Notification Service
 * This script tests the basic functionality without sending actual WhatsApp messages
 */

import { notifyReporterOfAssignment } from '../lib/reporter-notification-service.js';

async function testReporterNotification() {
  console.log('🧪 Testing Reporter Notification Service...\n');

  // Test 1: Valid activity with reporter phone number
  console.log('1. Testing with valid activity ID...');
  try {
    // Use a known activity ID from your database
    const result = await notifyReporterOfAssignment(
      'clxyz12345678901234567890', // Replace with actual activity ID
      'test-user-id',
      {
        includeAssignmentDetails: true,
        priority: 'normal'
      }
    );

    console.log('✅ Result:', {
      success: result.success,
      error: result.error,
      hasReporterInfo: !!result.reporterInfo
    });

    if (result.success) {
      console.log('🎉 Reporter notification would have been sent successfully!');
      console.log('📱 Message ID:', result.messageId);
    } else {
      console.log('⚠️  Notification not sent (expected for test):', result.error);
    }

  } catch (error) {
    console.log('❌ Test failed with error:', error.message);
  }

  // Test 2: Invalid activity ID
  console.log('\n2. Testing with invalid activity ID...');
  try {
    const result = await notifyReporterOfAssignment(
      'invalid-activity-id',
      'test-user-id'
    );

    console.log('✅ Result (expected to fail):', {
      success: result.success,
      error: result.error
    });

    if (!result.success) {
      console.log('✅ Correctly handled invalid activity ID');
    }

  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
  }

  console.log('\n🧪 Test completed!');
}

// Run the test
testReporterNotification().catch(console.error);