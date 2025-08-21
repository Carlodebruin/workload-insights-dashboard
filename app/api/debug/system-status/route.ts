import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function GET() {
  const startTime = Date.now();
  const debug = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks: {} as any,
    database: {} as any,
    apis: {} as any,
    summary: {} as any
  };

  try {
    // 1. Environment Variables Check
    debug.checks.environment_variables = {
      DATABASE_URL: !!process.env.DATABASE_URL,
      POSTGRES_URL: !!process.env.POSTGRES_URL,
      ENCRYPTION_KEY: !!process.env.ENCRYPTION_KEY,
      NODE_ENV: process.env.NODE_ENV,
      database_url_length: process.env.DATABASE_URL?.length || 0
    };

    // 2. Database Connection Test
    try {
      const dbStart = Date.now();
      await prisma.$connect();
      debug.database.connection = {
        status: 'connected',
        latency_ms: Date.now() - dbStart
      };

      // 3. Database Counts
      const [userCount, activityCount, categoryCount, updateCount] = await Promise.all([
        prisma.user.count(),
        prisma.activity.count(),
        prisma.category.count(),
        prisma.activityUpdate.count()
      ]);

      debug.database.counts = {
        users: userCount,
        activities: activityCount,
        categories: categoryCount,
        activity_updates: updateCount
      };

      // 4. Sample Data Check
      const sampleActivity = await prisma.activity.findFirst({
        select: {
          id: true,
          user_id: true,
          category_id: true,
          location: true,
          timestamp: true,
          status: true
        }
      });

      debug.database.sample_activity = sampleActivity ? {
        id: sampleActivity.id,
        user_id: sampleActivity.user_id,
        category_id: sampleActivity.category_id,
        location: sampleActivity.location,
        timestamp: sampleActivity.timestamp.toISOString(),
        status: sampleActivity.status
      } : null;

      // 5. Recent Activities
      const recentActivities = await prisma.activity.findMany({
        take: 3,
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          location: true,
          status: true,
          timestamp: true
        }
      });

      debug.database.recent_activities = recentActivities.map(a => ({
        ...a,
        timestamp: a.timestamp.toISOString()
      }));

    } catch (dbError) {
      debug.database.connection = {
        status: 'failed',
        error: dbError instanceof Error ? dbError.message : 'Unknown database error'
      };
    }

    // 6. API Endpoints Test (internal)
    debug.apis.internal_tests = {
      prisma_client: !!prisma,
      database_connected: debug.database.connection?.status === 'connected'
    };

    // 7. Summary
    debug.summary = {
      overall_status: debug.database.connection?.status === 'connected' && 
                      (debug.database.counts?.activities || 0) > 0 ? 'healthy' : 'issues_detected',
      total_execution_time_ms: Date.now() - startTime,
      critical_issues: [],
      recommendations: []
    };

    // Add critical issues
    if (debug.database.connection?.status !== 'connected') {
      debug.summary.critical_issues.push('Database connection failed');
    }
    if ((debug.database.counts?.activities || 0) === 0) {
      debug.summary.critical_issues.push('No activities found in database');
    }
    if (!debug.checks.environment_variables.DATABASE_URL) {
      debug.summary.critical_issues.push('DATABASE_URL environment variable missing');
    }

    // Add recommendations
    if (debug.summary.critical_issues.length === 0) {
      debug.summary.recommendations.push('System appears healthy - check frontend data fetching');
    } else {
      debug.summary.recommendations.push('Fix critical database/environment issues first');
    }

    return NextResponse.json(debug);

  } catch (error) {
    debug.summary = {
      overall_status: 'critical_error',
      error: error instanceof Error ? error.message : 'Unknown system error',
      total_execution_time_ms: Date.now() - startTime
    };
    
    return NextResponse.json(debug, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect();
    } catch (e) {
      // Ignore disconnect errors in debug endpoint
    }
  }
}