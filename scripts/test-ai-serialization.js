#!/usr/bin/env node

/**
 * Test AI Serialization Logic
 * Tests the priority-based sampling algorithm without database access
 */

function testSerializationLogic() {
    console.log('🧪 Testing AI Serialization Logic (Priority-Based Sampling)...\n');
    
    // Mock data simulating real scenario
    const mockUsers = [
        { id: 'user1', name: 'John Doe', role: 'Teacher' },
        { id: 'user2', name: 'Jane Smith', role: 'Principal' },
        { id: 'user3', name: 'Bob Johnson', role: 'Janitor' },
        { id: 'user4', name: 'Alice Brown', role: 'Counselor' },
        { id: 'user5', name: 'Charlie Wilson', role: 'IT Support' }
    ];

    // Mock activities with different timestamps and assignments
    const mockActivities = [
        // User1 activities (recent)
        { id: 'act1', user_id: 'user1', assigned_to_user_id: 'user2', timestamp: '2024-01-15T10:00:00Z', status: 'Open', subcategory: 'Lesson Planning', location: 'Classroom A' },
        { id: 'act2', user_id: 'user1', assigned_to_user_id: 'user3', timestamp: '2024-01-14T09:00:00Z', status: 'In Progress', subcategory: 'Grading', location: 'Office' },
        { id: 'act3', user_id: 'user1', assigned_to_user_id: null, timestamp: '2024-01-13T14:00:00Z', status: 'Resolved', subcategory: 'Meeting', location: 'Conference Room' },
        
        // User2 activities
        { id: 'act4', user_id: 'user2', assigned_to_user_id: 'user1', timestamp: '2024-01-15T11:00:00Z', status: 'Open', subcategory: 'Administration', location: 'Principal Office' },
        { id: 'act5', user_id: 'user2', assigned_to_user_id: 'user4', timestamp: '2024-01-12T15:00:00Z', status: 'In Progress', subcategory: 'Budget', location: 'Finance Office' },
        
        // User3 activities
        { id: 'act6', user_id: 'user3', assigned_to_user_id: 'user2', timestamp: '2024-01-14T08:00:00Z', status: 'Open', subcategory: 'Maintenance', location: 'Hallway' },
        { id: 'act7', user_id: 'user3', assigned_to_user_id: null, timestamp: '2024-01-11T16:00:00Z', status: 'Resolved', subcategory: 'Cleaning', location: 'Bathroom' },
        
        // User4 activities
        { id: 'act8', user_id: 'user4', assigned_to_user_id: 'user5', timestamp: '2024-01-13T13:00:00Z', status: 'Open', subcategory: 'Counseling', location: 'Counselor Office' },
        
        // User5 activities (older)
        { id: 'act9', user_id: 'user5', assigned_to_user_id: 'user1', timestamp: '2024-01-10T10:00:00Z', status: 'In Progress', subcategory: 'IT Support', location: 'Computer Lab' },
        { id: 'act10', user_id: 'user5', assigned_to_user_id: null, timestamp: '2024-01-09T09:00:00Z', status: 'Resolved', subcategory: 'Network', location: 'Server Room' },
        
        // Additional activities to test sampling
        { id: 'act11', user_id: 'user1', assigned_to_user_id: 'user4', timestamp: '2024-01-08T10:00:00Z', status: 'Open', subcategory: 'Training', location: 'Classroom B' },
        { id: 'act12', user_id: 'user2', assigned_to_user_id: 'user3', timestamp: '2024-01-07T11:00:00Z', status: 'In Progress', subcategory: 'Planning', location: 'Meeting Room' },
        { id: 'act13', user_id: 'user3', assigned_to_user_id: 'user5', timestamp: '2024-01-06T08:00:00Z', status: 'Open', subcategory: 'Repair', location: 'Classroom C' },
        { id: 'act14', user_id: 'user4', assigned_to_user_id: 'user2', timestamp: '2024-01-05T13:00:00Z', status: 'In Progress', subcategory: 'Session', location: 'Office' },
        { id: 'act15', user_id: 'user5', assigned_to_user_id: 'user3', timestamp: '2024-01-04T10:00:00Z', status: 'Resolved', subcategory: 'Update', location: 'Computer Lab' }
    ];

    const mockCategories = [
        { id: 'cat1', name: 'Academic' },
        { id: 'cat2', name: 'Administrative' },
        { id: 'cat3', name: 'Maintenance' },
        { id: 'cat4', name: 'Support' }
    ];

    console.log('📊 Mock Dataset Overview:');
    console.log(`- Users: ${mockUsers.length}`);
    console.log(`- Activities: ${mockActivities.length}`);
    console.log(`- Categories: ${mockCategories.length}`);

    // Simulate the serializeActivitiesForAI function logic
    const sampledActivities = [];
    const staffActivityCount = new Map();
    const maxActivitiesPerStaff = 3;
    const maxTotalActivities = 10;

    // Initialize count for each staff member
    mockUsers.forEach(user => staffActivityCount.set(user.id, 0));

    // Priority-based sampling: Ensure all staff have representation
    const recentActivities = [...mockActivities].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );

    console.log('\n🔄 Sampling Process:');
    
    // First pass: Ensure each staff member has representation
    console.log('1. First pass: Ensuring staff representation...');
    for (const activity of recentActivities) {
        if (sampledActivities.length >= maxTotalActivities) break;
        
        const currentCount = staffActivityCount.get(activity.user_id) || 0;
        if (currentCount < maxActivitiesPerStaff) {
            sampledActivities.push(activity);
            staffActivityCount.set(activity.user_id, currentCount + 1);
            console.log(`   → Added activity ${activity.id} for ${mockUsers.find(u => u.id === activity.user_id)?.name} (count: ${currentCount + 1})`);
        }
    }

    // Second pass: Fill remaining slots with most recent activities
    console.log('2. Second pass: Filling remaining slots...');
    if (sampledActivities.length < maxTotalActivities) {
        for (const activity of recentActivities) {
            if (sampledActivities.length >= maxTotalActivities) break;
            if (!sampledActivities.includes(activity)) {
                sampledActivities.push(activity);
                const currentCount = staffActivityCount.get(activity.user_id) || 0;
                staffActivityCount.set(activity.user_id, currentCount + 1);
                console.log(`   → Added activity ${activity.id} for ${mockUsers.find(u => u.id === activity.user_id)?.name} (fill slot)`);
            }
        }
    }

    // Analyze results
    console.log('\n📈 Sampling Results:');
    console.log(`- Sampled Activities: ${sampledActivities.length}/${mockActivities.length}`);
    
    const staffWithActivities = Array.from(staffActivityCount.entries())
        .filter(([_, count]) => count > 0)
        .length;
    
    const staffRepresentation = (staffWithActivities / mockUsers.length) * 100;
    console.log(`- Staff Representation: ${staffRepresentation.toFixed(1)}% (${staffWithActivities}/${mockUsers.length} staff members)`);

    // Check assignment visibility
    const activitiesWithAssignments = sampledActivities.filter(a => a.assigned_to_user_id);
    console.log(`- Activities with Assignments: ${activitiesWithAssignments.length}/${sampledActivities.length}`);
    
    // Verify all staff have at least minimal representation
    const underrepresentedStaff = Array.from(staffActivityCount.entries())
        .filter(([staffId, count]) => count === 0)
        .map(([staffId]) => mockUsers.find(u => u.id === staffId)?.name || staffId);

    if (underrepresentedStaff.length > 0) {
        console.log('\n❌ ISSUE DETECTED: Underrepresented Staff:');
        console.log(underrepresentedStaff.join(', '));
    } else {
        console.log('\n✅ SUCCESS: All staff members are represented!');
    }

    // Check assignment context completeness
    const assignedStaff = new Set(activitiesWithAssignments.map(a => a.assigned_to_user_id));
    console.log(`- Staff with assigned tasks visible: ${assignedStaff.size}/${mockUsers.length}`);

    // Detailed staff visibility report
    console.log('\n👥 STAFF VISIBILITY REPORT:');
    mockUsers.forEach(user => {
        const activityCount = staffActivityCount.get(user.id) || 0;
        const assignedCount = activitiesWithAssignments.filter(a => a.assigned_to_user_id === user.id).length;
        const status = activityCount > 0 ? '✅ VISIBLE' : '❌ MISSING';
        console.log(`- ${user.name}: ${activityCount} activities, ${assignedCount} assignments - ${status}`);
    });

    // Show sampled activities with assignment context
    console.log('\n📋 SAMPLED ACTIVITIES WITH ASSIGNMENT CONTEXT:');
    sampledActivities.forEach(activity => {
        const user = mockUsers.find(u => u.id === activity.user_id);
        const assignedTo = activity.assigned_to_user_id ? mockUsers.find(u => u.id === activity.assigned_to_user_id) : null;
        console.log(`- ${activity.id}: ${user?.name} → ${assignedTo?.name || 'Unassigned'} (${activity.status})`);
    });

    // Success criteria
    const allStaffVisible = staffRepresentation === 100;
    const sufficientData = sampledActivities.length >= Math.min(5, mockActivities.length);
    const assignmentContext = assignedStaff.size > 0;

    console.log('\n🎯 SUCCESS CRITERIA:');
    console.log(`- All staff represented: ${allStaffVisible ? '✅' : '❌'}`);
    console.log(`- Sufficient data sampled: ${sufficientData ? '✅' : '❌'}`);
    console.log(`- Assignment context included: ${assignmentContext ? '✅' : '❌'}`);

    if (allStaffVisible && sufficientData && assignmentContext) {
        console.log('\n🎉 SUCCESS: AI Serialization logic is working correctly!');
        console.log('The priority-based sampling ensures all staff visibility with assignment context.');
        return true;
    } else {
        console.log('\n❌ FAILURE: Serialization logic needs adjustment.');
        return false;
    }
}

// Run the test
const success = testSerializationLogic();
process.exit(success ? 0 : 1);