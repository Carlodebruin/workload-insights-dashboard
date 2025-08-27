#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDashboardLogic() {
  try {
    console.log('🔍 TESTING DASHBOARD FILTERING LOGIC');
    console.log('=' .repeat(50));
    
    // Get first 10 activities to simulate what dashboard sees
    const activities = await prisma.activity.findMany({
      orderBy: { timestamp: 'desc' },
      take: 10,
      include: {
        user: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } }
      }
    });

    console.log(`📊 Top 10 activities from database:`);
    
    activities.forEach((activity, i) => {
      console.log(`  ${i+1}. ${activity.subcategory} - Status: '${activity.status}'`);
      console.log(`     Category: ${activity.category?.name}`);
      console.log(`     User: ${activity.user?.name}`);
      console.log(`     Location: ${activity.location.substring(0, 30)}...`);
      console.log(`     Created: ${activity.timestamp.toISOString().split('T')[0]}`);
      console.log('');
    });
    
    // Check what would be filtered with default dashboard settings
    const filterStatus = 'all'; // Default
    const viewTab = 'all'; // Default  
    const selectedCategory = 'all'; // Default
    
    console.log('🎯 DASHBOARD FILTER SIMULATION:');
    console.log(`   filterStatus: '${filterStatus}'`);
    console.log(`   viewTab: '${viewTab}'`);
    console.log(`   selectedCategory: '${selectedCategory}'`);
    console.log('');
    
    // Apply filters step by step
    let filtered = [...activities];
    
    // Step 1: viewTab filter
    if (viewTab === 'mytasks') {
      // This simulates the mytasks logic
      filtered = filtered.filter(a => a.status === 'Open' || a.status === 'In Progress');
    }
    console.log(`   After viewTab filter: ${filtered.length} activities`);
    
    // Step 2: filterStatus filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(activity => 
        activity.status === 'Open' || activity.status === 'In Progress'
      );
    }
    console.log(`   After filterStatus filter: ${filtered.length} activities`);
    
    // Step 3: category filter  
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(activity => {
        if (selectedCategory === 'UNPLANNED_INCIDENTS') {
          return activity.category_id === 'unplanned' || activity.category_id === 'learner_wellness';
        }
        return activity.category_id === selectedCategory;
      });
    }
    console.log(`   After category filter: ${filtered.length} activities`);
    
    console.log('\n✅ FINAL ACTIVITIES THAT WOULD DISPLAY:');
    filtered.forEach((activity, i) => {
      console.log(`   ${i+1}. ${activity.subcategory} (${activity.status})`);
    });
    
    if (filtered.length === activities.length) {
      console.log('\n🎉 ALL ACTIVITIES WOULD BE DISPLAYED!');
      console.log('   The dashboard filtering is working correctly with default settings.');
      
      // Check specifically for WhatsApp activities
      const whatsappActivities = filtered.filter(a => 
        a.location.includes('From WhatsApp') || a.notes.includes('WhatsApp')
      );
      console.log(`\n📱 WhatsApp activities in display: ${whatsappActivities.length}`);
      
    } else {
      console.log('\n⚠️ SOME ACTIVITIES ARE BEING FILTERED OUT');
      const removed = activities.length - filtered.length;
      console.log(`   ${removed} activities were filtered out`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testDashboardLogic().catch(console.error);