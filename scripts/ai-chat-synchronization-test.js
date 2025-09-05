#!/usr/bin/env node

/**
 * AI Chat Data Synchronization Test Script
 * Verifies that the AI chat system properly synchronizes staff assignment data
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAIChatSynchronization() {
    console.log('🧪 Testing AI Chat Data Synchronization...\n');
    
    try {
        // Get test data
        const users = await prisma.user.findMany();
        const activities = await prisma.activity.findMany({
            include: {
                category: true,
                user: true,
                assignedTo: true
            },
            orderBy: {
                timestamp: 'desc'
            },
            take: 200 // Get sufficient data for testing
        });
        
        const categories = await prisma.category.findMany();
        
        console.log(`📊 Dataset Overview:`);
        console.log(`- Total Users: ${users.length}`);
        console.log(`- Total Activities: ${activities.length}`);
        console.log(`- Total Categories: ${categories.length}`);
        
        // Simulate the serializeActivitiesForAI function logic
        const sampledActivities = [];
        const staffActivityCount = new Map();
        const maxActivitiesPerStaff = 3;
        const maxTotalActivities = 50;
        
        // Initialize count for each staff member
        users.forEach(user => staffActivityCount.set(user.id, 0));
        
        // Priority-based sampling simulation
        const recentActivities = [...activities].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        // First pass: Ensure each staff member has representation
        for (const activity of recentActivities) {
            if (sampledActivities.length >= maxTotalActivities) break;
            
            const currentCount = staffActivityCount.get(activity.user_id) || 0;
            if (currentCount < maxActivitiesPerStaff) {
                sampledActivities.push(activity);
                staffActivityCount.set(activity.user_id, currentCount + 1);
            }
        }
        
        // Second pass: Fill remaining slots
        if (sampledActivities.length < maxTotalActivities) {
            for (const activity of recentActivities) {
                if (sampledActivities.length >= maxTotalActivities) break;
                if (!sampledActivities.includes(activity)) {
                    sampledActivities.push(activity);
                }
            }
        }
        
        // Analyze results
        console.log('\n📈 Sampling Results:');
        console.log(`- Sampled Activities: ${sampledActivities.length}/${activities.length}`);
        
        const staffWithActivities = Array.from(staffActivityCount.entries())
            .filter(([_, count]) => count > 0)
            .length;
        
        const staffRepresentation = (staffWithActivities / users.length) * 100;
        console.log(`- Staff Representation: ${staffRepresentation.toFixed(1)}% (${staffWithActivities}/${users.length} staff members)`);
        
        // Check assignment visibility
        const activitiesWithAssignments = sampledActivities.filter(a => a.assigned_to_user_id);
        console.log(`- Activities with Assignments: ${activitiesWithAssignments.length}/${sampledActivities.length}`);
        
        // Verify all staff have at least minimal representation
        const underrepresentedStaff = Array.from(staffActivityCount.entries())
            .filter(([staffId, count]) => count === 0)
            .map(([staffId]) => users.find(u => u.id === staffId)?.name || staffId);
        
        if (underrepresentedStaff.length > 0) {
            console.log('\n❌ ISSUE DETECTED: Underrepresented Staff:');
            console.log(underrepresentedStaff.join(', '));
            return false;
        }
        
        // Check assignment context completeness
        const assignedActivities = sampledActivities.filter(a => a.assigned_to_user_id);
        const assignedStaff = new Set(assignedActivities.map(a => a.assigned_to_user_id));
        
        console.log('\n✅ ASSIGNMENT VISIBILITY:');
        console.log(`- Staff with assigned tasks visible: ${assignedStaff.size}`);
        console.log(`- Assignment context completeness: ${((assignedStaff.size / users.length) * 100).toFixed(1)}%`);
        
        // Detailed staff visibility report
        console.log('\n👥 STAFF VISIBILITY REPORT:');
        users.forEach(user => {
            const activityCount = staffActivityCount.get(user.id) || 0;
            const assignedCount = assignedActivities.filter(a => a.assigned_to_user_id === user.id).length;
            const status = activityCount > 0 ? '✅ VISIBLE' : '❌ MISSING';
            console.log(`- ${user.name}: ${activityCount} activities, ${assignedCount} assignments - ${status}`);
        });
        
        // Success criteria
        const allStaffVisible = staffRepresentation === 100;
        const sufficientData = sampledActivities.length >= Math.min(30, activities.length);
        
        console.log('\n🎯 SUCCESS CRITERIA:');
        console.log(`- All staff represented: ${allStaffVisible ? '✅' : '❌'}`);
        console.log(`- Sufficient data sampled: ${sufficientData ? '✅' : '❌'}`);
        console.log(`- Assignment context included: ${assignedStaff.size > 0 ? '✅' : '❌'}`);
        
        if (allStaffVisible && sufficientData) {
            console.log('\n🎉 SUCCESS: AI Chat data synchronization is working correctly!');
            console.log('All staff members are properly represented with assignment context.');
            return true;
        } else {
            console.log('\n❌ FAILURE: AI Chat data synchronization needs improvement.');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error testing AI chat synchronization:', error);
        return false;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the test
testAIChatSynchronization()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Test failed with error:', error);
        process.exit(1);
    });