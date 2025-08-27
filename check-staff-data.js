const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStaffStructure() {
  try {
    console.log('🔍 === CHECKING STAFF DATA STRUCTURE ===');
    
    // Check users table structure and sample data
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        phone_number: true
      },
      take: 5
    });
    
    console.log('📊 Sample Users:');
    users.forEach(user => {
      console.log(`  ${user.name} (${user.role}) - Phone: ${user.phone_number || 'MISSING'}`);
    });
    
    // Check how many users have phone numbers
    const totalUsers = await prisma.user.count();
    const usersWithPhones = await prisma.user.count({
      where: { 
        phone_number: { 
          not: null,
          not: ''
        } 
      }
    });
    
    console.log(`\n📈 Phone Number Coverage:`);
    console.log(`  Total Users: ${totalUsers}`);
    console.log(`  Users with Phones: ${usersWithPhones}`);
    console.log(`  Coverage: ${Math.round(usersWithPhones/totalUsers*100)}%`);
    
    // Check admin/maintenance staff specifically
    const staffMembers = await prisma.user.findMany({
      where: {
        role: { in: ['Admin', 'Maintenance', 'Manager'] }
      },
      select: {
        id: true,
        name: true,
        role: true,
        phone_number: true
      }
    });
    
    console.log(`\n👥 Staff Members (Admin/Maintenance/Manager):`);
    staffMembers.forEach(staff => {
      console.log(`  ${staff.name} (${staff.role}) - Phone: ${staff.phone_number || 'MISSING'}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkStaffStructure();
