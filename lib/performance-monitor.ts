import { PrismaClient } from '@prisma/client';

export interface QueryMetrics {
  queryName: string;
  duration: number;
  success: boolean;
  timestamp: Date;
  rowCount?: number;
  error?: string;
}

export interface PerformanceStats {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageDuration: number;
  maxDuration: number;
  minDuration: number;
  slowQueries: QueryMetrics[];
  recentQueries: QueryMetrics[];
}

export class PerformanceMonitor {
  private queryMetrics: QueryMetrics[] = [];
  private maxHistorySize = 1000;
  private slowQueryThreshold = 1000; // 1 second

  /**
   * Measure query execution time and track performance
   */
  async measureQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    context?: any
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;
      
      this.recordQueryMetrics({
        queryName,
        duration,
        success: true,
        timestamp: new Date(),
        rowCount: this.extractRowCount(result)
      });

      if (duration > this.slowQueryThreshold) {
        console.warn(`⚠️ Slow query detected: ${queryName} took ${duration}ms`);
      } else if (duration > 500) {
        console.log(`🔍 Query performance: ${queryName} took ${duration}ms`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.recordQueryMetrics({
        queryName,
        duration,
        success: false,
        timestamp: new Date(),
        error: errorMessage
      });

      console.error(`❌ Query failed: ${queryName} after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Record query metrics for performance analysis
   */
  private recordQueryMetrics(metrics: QueryMetrics): void {
    this.queryMetrics.push(metrics);
    
    // Keep only the most recent queries to prevent memory issues
    if (this.queryMetrics.length > this.maxHistorySize) {
      this.queryMetrics = this.queryMetrics.slice(-this.maxHistorySize);
    }
  }

  /**
   * Extract row count from query result (heuristic approach)
   */
  private extractRowCount(result: any): number | undefined {
    if (Array.isArray(result)) {
      return result.length;
    }
    
    if (typeof result === 'object' && result !== null) {
      // Check for common Prisma result structures
      if ('count' in result && typeof result.count === 'number') {
        return result.count;
      }
      
      if ('length' in result && typeof result.length === 'number') {
        return result.length;
      }
      
      // Check for array-like properties
      const arrayProps = Object.values(result).filter(Array.isArray);
      if (arrayProps.length === 1) {
        return arrayProps[0].length;
      }
    }
    
    return undefined;
  }

  /**
   * Get comprehensive performance statistics
   */
  getPerformanceStats(): PerformanceStats {
    const successfulQueries = this.queryMetrics.filter(q => q.success);
    const failedQueries = this.queryMetrics.filter(q => !q.success);
    
    const durations = successfulQueries.map(q => q.duration);
    const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
    const averageDuration = successfulQueries.length > 0 
      ? totalDuration / successfulQueries.length 
      : 0;
    
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    
    const slowQueries = successfulQueries
      .filter(q => q.duration > this.slowQueryThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
    
    const recentQueries = [...this.queryMetrics]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 20);

    return {
      totalQueries: this.queryMetrics.length,
      successfulQueries: successfulQueries.length,
      failedQueries: failedQueries.length,
      averageDuration,
      maxDuration,
      minDuration,
      slowQueries,
      recentQueries
    };
  }

  /**
   * Database health check with comprehensive diagnostics
   */
  async checkDatabaseHealth(prisma: PrismaClient, timeoutMs: number = 5000): Promise<{
    healthy: boolean;
    responseTime: number;
    connectionInfo?: any;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Database health check timeout')), timeoutMs);
      });

      const healthPromise = prisma.$queryRaw`SELECT 1 as health_check, current_timestamp as server_time, version() as postgres_version`;
      
      const result = await Promise.race([healthPromise, timeoutPromise]);
      const responseTime = Date.now() - startTime;

      // Get connection pool information
      let connectionInfo = null;
      try {
        connectionInfo = await prisma.$queryRaw`
          SELECT 
            count(*) as active_connections,
            current_setting('max_connections') as max_connections,
            (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections
          FROM pg_stat_activity 
          WHERE state = 'active'
        `;
      } catch (connectionError) {
        console.warn('Could not fetch connection info:', connectionError);
      }

      return {
        healthy: true,
        responseTime,
        connectionInfo
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        healthy: false,
        responseTime,
        error: errorMessage
      };
    }
  }

  /**
   * Reset all performance metrics
   */
  resetMetrics(): void {
    this.queryMetrics = [];
  }

  /**
   * Set custom slow query threshold
   */
  setSlowQueryThreshold(thresholdMs: number): void {
    this.slowQueryThreshold = thresholdMs;
  }

  /**
   * Export performance data for analysis
   */
  exportData(): QueryMetrics[] {
    return [...this.queryMetrics];
  }

  /**
   * Get query performance by name
   */
  getQueryStatsByName(queryName: string): {
    total: number;
    successful: number;
    failed: number;
    averageDuration: number;
    maxDuration: number;
    minDuration: number;
  } {
    const queries = this.queryMetrics.filter(q => q.queryName === queryName);
    const successful = queries.filter(q => q.success);
    const durations = successful.map(q => q.duration);
    
    const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
    const averageDuration = successful.length > 0 ? totalDuration / successful.length : 0;
    
    return {
      total: queries.length,
      successful: successful.length,
      failed: queries.length - successful.length,
      averageDuration,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0
    };
  }

  /**
   * Detect performance trends and anomalies
   */
  detectAnomalies(): {
    increasingLatency: boolean;
    frequentFailures: boolean;
    resourceContention: boolean;
  } {
    const recentQueries = this.queryMetrics
      .filter(q => q.timestamp.getTime() > Date.now() - 30 * 60 * 1000) // Last 30 minutes
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    if (recentQueries.length < 10) {
      return {
        increasingLatency: false,
        frequentFailures: false,
        resourceContention: false
      };
    }

    // Check for increasing latency trend
    const timeWindows = this.splitIntoTimeWindows(recentQueries, 3);
    const latencyTrend = timeWindows.map(window => 
      window.filter(q => q.success).reduce((sum, q) => sum + q.duration, 0) / 
      Math.max(1, window.filter(q => q.success).length)
    );
    
    const increasingLatency = latencyTrend.length >= 2 && 
      latencyTrend[latencyTrend.length - 1] > latencyTrend[0] * 1.5;

    // Check for frequent failures
    const failureRate = recentQueries.filter(q => !q.success).length / recentQueries.length;
    const frequentFailures = failureRate > 0.1; // More than 10% failure rate

    // Check for resource contention (many slow queries)
    const slowQueryRate = recentQueries.filter(q => q.success && q.duration > this.slowQueryThreshold).length / 
      Math.max(1, recentQueries.filter(q => q.success).length);
    const resourceContention = slowQueryRate > 0.2; // More than 20% slow queries

    return {
      increasingLatency,
      frequentFailures,
      resourceContention
    };
  }

  /**
   * Split queries into time windows for trend analysis
   */
  private splitIntoTimeWindows(queries: QueryMetrics[], numWindows: number): QueryMetrics[][] {
    if (queries.length === 0) return [];
    
    const sortedQueries = [...queries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const timeRange = sortedQueries[sortedQueries.length - 1].timestamp.getTime() - 
                     sortedQueries[0].timestamp.getTime();
    const windowSize = timeRange / numWindows;
    
    const windows: QueryMetrics[][] = Array(numWindows).fill(null).map(() => []);
    
    sortedQueries.forEach(query => {
      const timeOffset = query.timestamp.getTime() - sortedQueries[0].timestamp.getTime();
      const windowIndex = Math.min(numWindows - 1, Math.floor(timeOffset / windowSize));
      windows[windowIndex].push(query);
    });
    
    return windows;
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Helper function for automatic performance monitoring
export function withPerformanceMonitoring<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  return performanceMonitor.measureQuery(queryName, queryFn);
}