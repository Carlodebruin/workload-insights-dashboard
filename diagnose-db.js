#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

// Create Prisma client with enhanced error handling
const prisma = new PrismaClient({
  log: ['error', 'warn'],
  errorFormat: 'pretty',
});

async function diagnoseDatabaseConnection() {
  console.log('🔍 === DATABASE CONNECTION DIAGNOSIS ===\n');
  
  try {
    console.log('1️⃣ Testing basic connection...');
    const startTime = Date.now();
    
    const result = await prisma.$queryRaw`SELECT 1 as test, NOW() as current_time`;
    const connectionTime = Date.now() - startTime;
    
    console.log(`✅ Connection successful in ${connectionTime}ms`);
    console.log(`   Result:`, result[0]);
    
    console.log('\n2️⃣ Testing connection pool stress...');
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        prisma.$queryRaw`SELECT ${i} as query_id, pg_backend_pid() as process_id`
          .catch(err => ({ error: err.message, queryId: i }))
      );
    }
    
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected');
    
    console.log(`   Completed queries: ${successful}/10`);
    if (failed.length > 0) {
      console.log(`   ⚠️ Failed queries: ${failed.length}`);
      failed.forEach((f, i) => {
        console.log(`     Query ${i}: ${f.reason?.message || 'Unknown error'}`);
      });
    }
    
    console.log('\n3️⃣ Testing connection info...');
    try {
      const connInfo = await prisma.$queryRaw`
        SELECT 
          count(*) as active_connections,
          current_setting('max_connections') as max_connections
        FROM pg_stat_activity 
        WHERE state = 'active'
      `;
      console.log(`   Active connections: ${connInfo[0].active_connections}`);
      console.log(`   Max connections: ${connInfo[0].max_connections}`);
    } catch (infoError) {
      console.log(`   ⚠️ Could not get connection info: ${infoError.message}`);
    }
    
    console.log('\n4️⃣ Testing rapid disconnection/reconnection...');
    await prisma.$disconnect();
    console.log('   Disconnected successfully');
    
    // Try to reconnect
    const reconnectResult = await prisma.$queryRaw`SELECT 'reconnected' as status`;
    console.log(`   Reconnected successfully: ${reconnectResult[0].status}`);
    
  } catch (error) {
    console.error('\n❌ Database diagnosis failed:');
    console.error(`   Error type: ${error.constructor.name}`);
    console.error(`   Message: ${error.message}`);
    
    if (error.message.includes('Closed')) {
      console.log('\n🎯 DIAGNOSIS: Connection closure detected!');
      console.log('   This matches the reported error pattern');
      console.log('   Likely causes:');
      console.log('   - Connection pool exhaustion');
      console.log('   - Network timeout or instability');
      console.log('   - Database server connection limits');
      console.log('   - Prisma client connection management issues');
    }
  } finally {
    await prisma.$disconnect();
    console.log('\n✅ Cleanup completed');
  }
}

// Run diagnosis
diagnoseDatabaseConnection()
  .catch(console.error)
  .finally(() => process.exit(0));