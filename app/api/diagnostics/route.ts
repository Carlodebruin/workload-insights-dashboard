import { NextResponse } from 'next/server';
import { getWorkingAIProvider, getFallbackStatistics } from '../../../lib/ai-factory';
import { DeepSeekProvider } from '../../../lib/providers/deepseek';
import { prisma } from '../../../lib/prisma';
import { logger } from '../../../lib/logger';

export async function GET() {
  try {
    const startTime = Date.now();
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      aiProvider: null,
      contextCaching: null,
      requestId: `diag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    // Get current AI provider information
    try {
      const provider = await getWorkingAIProvider();
      diagnostics.aiProvider = {
        name: provider.name,
        displayName: provider.displayName,
        isConfigured: true
      };

      // If it's DeepSeek, get comprehensive statistics
      if (provider.name === 'deepseek' && provider instanceof DeepSeekProvider) {
        const cacheStats = provider.getCacheStatistics();
        const healthStatus = provider.getHealthStatus();
        const usageStats = provider.getUsageStatistics();
        
        diagnostics.contextCaching = {
          provider: 'deepseek',
          enabled: true,
          statistics: cacheStats,
          healthStatus,
          usageMetrics: usageStats,
          performance: {
            efficiency: cacheStats.overallCacheHitRate > 50 ? 'excellent' : 
                       cacheStats.overallCacheHitRate > 20 ? 'good' : 
                       cacheStats.overallCacheHitRate > 0 ? 'fair' : 'no cache activity',
            costReduction: `~${Math.round(cacheStats.overallCacheHitRate)}% reduction in processing costs`,
            rateLimitStatus: {
              requestUtilization: usageStats.rateLimiting.utilizationPercent.requestsPerMinute,
              tokenUtilization: usageStats.rateLimiting.utilizationPercent.tokensPerMinute,
              costUtilization: usageStats.rateLimiting.utilizationPercent.costPerHour,
              status: usageStats.rateLimiting.utilizationPercent.requestsPerMinute > 80 ||
                      usageStats.rateLimiting.utilizationPercent.costPerHour > 80 
                      ? 'high' : usageStats.rateLimiting.utilizationPercent.requestsPerMinute > 60 
                      ? 'moderate' : 'low'
            },
            costEfficiency: {
              totalCost: usageStats.costAnalysis.totalCost,
              averageCostPerRequest: usageStats.costAnalysis.averageCostPerRequest,
              projectedMonthlyCost: usageStats.costAnalysis.projectedMonthlyCost,
              cachingSavings: usageStats.costAnalysis.costBreakdown.cacheSavings
            },
            recommendations: []
          }
        };

        // Generate smart recommendations based on usage patterns
        const recommendations = diagnostics.contextCaching.performance.recommendations;
        
        // Cache performance recommendations
        if (cacheStats.overallCacheHitRate < 20 && cacheStats.totalRequests > 10) {
          recommendations.push('Consider using more consistent prompts and system instructions to improve cache hit rates');
        } else if (cacheStats.overallCacheHitRate > 80) {
          recommendations.push('Excellent cache performance - context caching is working optimally');
        } else if (cacheStats.overallCacheHitRate > 0) {
          recommendations.push('Cache performance is good - monitor for continued optimization opportunities');
        }

        // Cost optimization recommendations
        if (usageStats.costAnalysis.averageCostPerRequest > 0.01) {
          recommendations.push('High average cost per request - consider optimizing prompt length or output tokens');
        }
        if (usageStats.costAnalysis.costBreakdown.cacheSavings > 0) {
          recommendations.push(`Context caching saved $${usageStats.costAnalysis.costBreakdown.cacheSavings.toFixed(4)} - excellent optimization`);
        }
        if (usageStats.costAnalysis.projectedMonthlyCost > 50) {
          recommendations.push('Projected monthly cost is high - monitor usage and consider implementing cost controls');
        }

        // Rate limiting recommendations
        if (usageStats.rateLimiting.utilizationPercent.requestsPerMinute > 80) {
          recommendations.push('Request rate approaching limit - consider implementing request queuing or rate limiting');
        }
        if (usageStats.rateLimiting.utilizationPercent.costPerHour > 80) {
          recommendations.push('Hourly cost approaching limit - implement cost controls to prevent overages');
        }

        // Error handling recommendations
        if (cacheStats.errorStatistics.errorRate > 10) {
          recommendations.push('High error rate detected - consider checking API credentials and network connectivity');
        }
        if (cacheStats.errorStatistics.consecutiveErrors > 3) {
          recommendations.push('Multiple consecutive errors - fallback providers may be needed');
        }
      } else {
        diagnostics.contextCaching = {
          provider: provider.name,
          enabled: false,
          message: 'Context caching and usage tracking is only supported for DeepSeek provider'
        };
      }
    } catch (error) {
      diagnostics.aiProvider = {
        name: 'unknown',
        displayName: 'Not configured',
        isConfigured: false,
        error: error instanceof Error ? error.message : String(error)
      };
      diagnostics.contextCaching = {
        enabled: false,
        message: 'Cannot determine caching status - AI provider not configured'
      };
    }

    // Add fallback statistics
    const fallbackStats = getFallbackStatistics();
    diagnostics.fallbackSystem = {
      enabled: true,
      statistics: fallbackStats,
      performance: {
        reliability: fallbackStats.totalFallbacks === 0 ? 'excellent' :
                    fallbackStats.totalFallbacks < 5 ? 'good' :
                    fallbackStats.totalFallbacks < 20 ? 'fair' : 'needs attention',
        fallbackSpeed: 'Target: < 3 seconds',
        recommendations: fallbackStats.totalFallbacks > 10
          ? ['High number of fallbacks detected - investigate primary provider reliability']
          : fallbackStats.deepSeekFallbacks > 5
          ? ['Multiple DeepSeek fallbacks - consider checking API limits and credentials']
          : ['Fallback system operating within normal parameters']
      }
    };

    // Add database performance metrics
    try {
      const dbStats = await prisma.$queryRaw`
        SELECT
          COUNT(*) as total_activities,
          COUNT(CASE WHEN status = 'Open' THEN 1 END) as open_activities,
          COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress_activities,
          COUNT(CASE WHEN status = 'Resolved' THEN 1 END) as resolved_activities,
          COUNT(DISTINCT user_id) as active_users,
          COUNT(DISTINCT category_id) as active_categories,
          MAX(timestamp) as latest_activity,
          MIN(timestamp) as earliest_activity
        FROM activities
      `;

      diagnostics.database = {
        performance: Array.isArray(dbStats) ? dbStats[0] : dbStats,
        health: 'healthy',
        timestamp: new Date().toISOString()
      };
    } catch (dbError) {
      diagnostics.database = {
        health: 'unhealthy',
        error: dbError instanceof Error ? dbError.message : 'Unknown database error',
        timestamp: new Date().toISOString()
      };
    }

    // Add API performance metrics
    diagnostics.apiPerformance = {
      responseTime: Date.now() - startTime,
      dataRetrievalTime: diagnostics.database?.performance ? Date.now() - startTime : null,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      environment: process.env.NODE_ENV || 'development'
    };

    return NextResponse.json(diagnostics);
  } catch (error) {
    console.error('Diagnostics endpoint error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve diagnostics',
        timestamp: new Date().toISOString() 
      },
      { status: 500 }
    );
  }
}