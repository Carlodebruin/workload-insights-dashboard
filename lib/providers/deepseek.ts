import { AIProvider, AIMessage, AIResponse, AIStreamResponse } from "../ai-providers";
import { logger } from '../logger';

// DeepSeek pricing configuration (as of 2024)
const DEEPSEEK_PRICING = {
  // Input tokens (per 1M tokens)
  inputTokenCost: 0.14, // $0.14 per 1M input tokens
  // Output tokens (per 1M tokens) 
  outputTokenCost: 0.28, // $0.28 per 1M output tokens
  // Context caching pricing (cached tokens are 90% cheaper)
  cacheHitDiscount: 0.9 // 90% discount for cached tokens
};

// Rate limiting configuration
const RATE_LIMITS = {
  requestsPerMinute: 60,     // 60 requests per minute (safe default)
  requestsPerHour: 3600,     // 3600 requests per hour
  tokensPerMinute: 200000,   // 200K tokens per minute
  tokensPerDay: 10000000,    // 10M tokens per day
  maxCostPerHour: 10.0,      // $10 max spend per hour
  maxCostPerDay: 100.0       // $100 max spend per day
};

// Rate limiter class for managing API usage
class DeepSeekRateLimiter {
  private requestsByMinute = new Map<string, number>();
  private requestsByHour = new Map<string, number>();
  private tokensByMinute = new Map<string, number>();
  private tokensByDay = new Map<string, number>();
  private costByHour = new Map<string, number>();
  private costByDay = new Map<string, number>();

  // Clean up old tracking data
  private cleanup() {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000).toString();
    const currentHour = Math.floor(now / 3600000).toString();
    const currentDay = Math.floor(now / 86400000).toString();

    // Keep only current and previous periods
    for (const [key] of Array.from(this.requestsByMinute)) {
      if (parseInt(key) < parseInt(currentMinute) - 1) {
        this.requestsByMinute.delete(key);
      }
    }
    
    for (const [key] of Array.from(this.requestsByHour)) {
      if (parseInt(key) < parseInt(currentHour) - 1) {
        this.requestsByHour.delete(key);
      }
    }
    
    for (const [key] of Array.from(this.tokensByMinute)) {
      if (parseInt(key) < parseInt(currentMinute) - 1) {
        this.tokensByMinute.delete(key);
      }
    }
    
    for (const [key] of Array.from(this.tokensByDay)) {
      if (parseInt(key) < parseInt(currentDay) - 1) {
        this.tokensByDay.delete(key);
      }
    }
    
    for (const [key] of Array.from(this.costByHour)) {
      if (parseInt(key) < parseInt(currentHour) - 1) {
        this.costByHour.delete(key);
      }
    }
    
    for (const [key] of Array.from(this.costByDay)) {
      if (parseInt(key) < parseInt(currentDay) - 1) {
        this.costByDay.delete(key);
      }
    }
  }

  // Check if request can proceed based on all rate limits
  canMakeRequest(estimatedTokens: number = 0, estimatedCost: number = 0): {
    allowed: boolean;
    reason?: string;
    waitTimeSeconds?: number;
  } {
    this.cleanup();
    
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000).toString();
    const currentHour = Math.floor(now / 3600000).toString();
    const currentDay = Math.floor(now / 86400000).toString();

    // Check request rate limits
    const requestsThisMinute = this.requestsByMinute.get(currentMinute) || 0;
    if (requestsThisMinute >= RATE_LIMITS.requestsPerMinute) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${requestsThisMinute}/${RATE_LIMITS.requestsPerMinute} requests per minute`,
        waitTimeSeconds: 60 - (Math.floor(now / 1000) % 60)
      };
    }

    const requestsThisHour = this.requestsByHour.get(currentHour) || 0;
    if (requestsThisHour >= RATE_LIMITS.requestsPerHour) {
      return {
        allowed: false,
        reason: `Hourly rate limit exceeded: ${requestsThisHour}/${RATE_LIMITS.requestsPerHour} requests per hour`,
        waitTimeSeconds: 3600 - (Math.floor(now / 1000) % 3600)
      };
    }

    // Check token limits
    if (estimatedTokens > 0) {
      const tokensThisMinute = this.tokensByMinute.get(currentMinute) || 0;
      if (tokensThisMinute + estimatedTokens > RATE_LIMITS.tokensPerMinute) {
        return {
          allowed: false,
          reason: `Token rate limit exceeded: ${tokensThisMinute + estimatedTokens}/${RATE_LIMITS.tokensPerMinute} tokens per minute`,
          waitTimeSeconds: 60 - (Math.floor(now / 1000) % 60)
        };
      }

      const tokensThisDay = this.tokensByDay.get(currentDay) || 0;
      if (tokensThisDay + estimatedTokens > RATE_LIMITS.tokensPerDay) {
        return {
          allowed: false,
          reason: `Daily token limit exceeded: ${tokensThisDay + estimatedTokens}/${RATE_LIMITS.tokensPerDay} tokens per day`,
          waitTimeSeconds: 86400 - (Math.floor(now / 1000) % 86400)
        };
      }
    }

    // Check cost limits
    if (estimatedCost > 0) {
      const costThisHour = this.costByHour.get(currentHour) || 0;
      if (costThisHour + estimatedCost > RATE_LIMITS.maxCostPerHour) {
        return {
          allowed: false,
          reason: `Hourly cost limit exceeded: $${(costThisHour + estimatedCost).toFixed(4)}/$${RATE_LIMITS.maxCostPerHour} per hour`,
          waitTimeSeconds: 3600 - (Math.floor(now / 1000) % 3600)
        };
      }

      const costThisDay = this.costByDay.get(currentDay) || 0;
      if (costThisDay + estimatedCost > RATE_LIMITS.maxCostPerDay) {
        return {
          allowed: false,
          reason: `Daily cost limit exceeded: $${(costThisDay + estimatedCost).toFixed(4)}/$${RATE_LIMITS.maxCostPerDay} per day`,
          waitTimeSeconds: 86400 - (Math.floor(now / 1000) % 86400)
        };
      }
    }

    return { allowed: true };
  }

  // Record successful request for rate limiting
  recordRequest(actualTokens: number, actualCost: number) {
    this.cleanup();
    
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000).toString();
    const currentHour = Math.floor(now / 3600000).toString();
    const currentDay = Math.floor(now / 86400000).toString();

    // Track requests
    this.requestsByMinute.set(currentMinute, (this.requestsByMinute.get(currentMinute) || 0) + 1);
    this.requestsByHour.set(currentHour, (this.requestsByHour.get(currentHour) || 0) + 1);

    // Track tokens
    this.tokensByMinute.set(currentMinute, (this.tokensByMinute.get(currentMinute) || 0) + actualTokens);
    this.tokensByDay.set(currentDay, (this.tokensByDay.get(currentDay) || 0) + actualTokens);

    // Track costs
    this.costByHour.set(currentHour, (this.costByHour.get(currentHour) || 0) + actualCost);
    this.costByDay.set(currentDay, (this.costByDay.get(currentDay) || 0) + actualCost);
  }

  // Get current usage statistics
  getUsageStats() {
    this.cleanup();
    
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000).toString();
    const currentHour = Math.floor(now / 3600000).toString();
    const currentDay = Math.floor(now / 86400000).toString();

    return {
      currentPeriod: {
        requestsThisMinute: this.requestsByMinute.get(currentMinute) || 0,
        requestsThisHour: this.requestsByHour.get(currentHour) || 0,
        tokensThisMinute: this.tokensByMinute.get(currentMinute) || 0,
        tokensThisDay: this.tokensByDay.get(currentDay) || 0,
        costThisHour: this.costByHour.get(currentHour) || 0,
        costThisDay: this.costByDay.get(currentDay) || 0
      },
      limits: RATE_LIMITS,
      utilizationPercent: {
        requestsPerMinute: Math.round(((this.requestsByMinute.get(currentMinute) || 0) / RATE_LIMITS.requestsPerMinute) * 100),
        requestsPerHour: Math.round(((this.requestsByHour.get(currentHour) || 0) / RATE_LIMITS.requestsPerHour) * 100),
        tokensPerMinute: Math.round(((this.tokensByMinute.get(currentMinute) || 0) / RATE_LIMITS.tokensPerMinute) * 100),
        tokensPerDay: Math.round(((this.tokensByDay.get(currentDay) || 0) / RATE_LIMITS.tokensPerDay) * 100),
        costPerHour: Math.round(((this.costByHour.get(currentHour) || 0) / RATE_LIMITS.maxCostPerHour) * 100),
        costPerDay: Math.round(((this.costByDay.get(currentDay) || 0) / RATE_LIMITS.maxCostPerDay) * 100)
      }
    };
  }
}

// DeepSeek-specific error classes
export class DeepSeekAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'DeepSeekAPIError';
  }
}

export class DeepSeekRateLimitError extends DeepSeekAPIError {
  constructor(message: string, retryAfter?: number) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', retryAfter);
    this.name = 'DeepSeekRateLimitError';
  }
}

export class DeepSeekTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeepSeekTimeoutError';
  }
}

export class DeepSeekProvider implements AIProvider {
  name = 'deepseek';
  displayName = 'DeepSeek';
  private apiKey: string;
  private baseUrl = 'https://api.deepseek.com';
  private rateLimiter = new DeepSeekRateLimiter();
  
  // Cache and error metrics tracking for diagnostics
  private cacheStats = {
    totalRequests: 0,
    totalCacheHits: 0,
    totalCacheMisses: 0,
    totalCacheHitTokens: 0,
    totalCacheMissTokens: 0
  };

  // Token usage and cost tracking
  private usageStats = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCachedInputTokens: 0, // Cached input tokens (cheaper)
    totalCost: 0,
    requestCount: 0,
    averageInputTokensPerRequest: 0,
    averageOutputTokensPerRequest: 0,
    averageCostPerRequest: 0,
    costBreakdown: {
      inputTokenCost: 0,
      outputTokenCost: 0,
      cacheSavings: 0
    }
  };

  // Error statistics for monitoring and diagnostics
  private errorStats = {
    totalErrors: 0,
    rateLimitErrors: 0,
    timeoutErrors: 0,
    apiErrors: 0,
    networkErrors: 0,
    lastError: null as { timestamp: Date; error: string; statusCode?: number } | null,
    errorsByMinute: new Map<string, number>(), // Track errors by minute for rate monitoring
    consecutiveErrors: 0,
    lastSuccessfulRequest: new Date()
  };

  // Enhanced health monitoring metrics
  private healthMetrics = {
    // Latency tracking
    latencyStats: {
      totalMeasurements: 0,
      totalLatency: 0,
      minLatency: Number.MAX_VALUE,
      maxLatency: 0,
      recentLatencies: [] as number[], // Keep last 100 measurements
      latencyByHour: new Map<string, { sum: number; count: number; avg: number }>()
    },
    
    // Success/failure tracking with 24-hour rolling windows
    requestHistory: {
      successfulRequests: 0,
      failedRequests: 0,
      requestsByHour: new Map<string, { success: number; failure: number; totalLatency: number }>(),
      last24Hours: [] as Array<{ timestamp: number; success: boolean; latency: number; errorType?: string }>
    },
    
    // Model availability and performance
    modelHealth: {
      lastAvailabilityCheck: new Date(0), // Force initial check
      isModelAvailable: true,
      lastSuccessfulModelTest: new Date(),
      consecutiveModelFailures: 0,
      modelTestHistory: [] as Array<{ timestamp: number; success: boolean; latency?: number; error?: string }>
    },
    
    // Trend analysis data
    trends: {
      hourlySuccessRates: new Map<string, number>(),
      hourlyAvgLatency: new Map<string, number>(),
      hourlyErrorRates: new Map<string, { total: number; rate: number }>()
    }
  };

  constructor(apiKey?: string) {
    const key = apiKey || process.env.DEEPSEEK_API_KEY;
    if (!key) throw new Error("DEEPSEEK_API_KEY not configured properly. Please set a valid DeepSeek API key in your environment variables or pass it to the constructor.");
    this.apiKey = key;
  }

  // Calculate cost based on token usage and caching
  private calculateCost(inputTokens: number, outputTokens: number, cacheHitTokens: number = 0): number {
    // Regular input tokens cost
    const regularInputTokens = Math.max(0, inputTokens - cacheHitTokens);
    const inputCost = (regularInputTokens / 1000000) * DEEPSEEK_PRICING.inputTokenCost;
    
    // Cached input tokens cost (90% discount)
    const cachedInputCost = (cacheHitTokens / 1000000) * DEEPSEEK_PRICING.inputTokenCost * (1 - DEEPSEEK_PRICING.cacheHitDiscount);
    
    // Output tokens cost (no caching discount)
    const outputCost = (outputTokens / 1000000) * DEEPSEEK_PRICING.outputTokenCost;
    
    return inputCost + cachedInputCost + outputCost;
  }

  // Estimate token count for rate limiting (rough approximation)
  private estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  // Estimate request cost before making the call
  private estimateRequestCost(prompt: string, maxTokens: number = 1000): number {
    const estimatedInputTokens = this.estimateTokenCount(prompt);
    const estimatedOutputTokens = maxTokens;
    return this.calculateCost(estimatedInputTokens, estimatedOutputTokens);
  }

  // Update usage statistics after successful request
  private updateUsageStats(inputTokens: number, outputTokens: number, cacheHitTokens: number = 0) {
    const cost = this.calculateCost(inputTokens, outputTokens, cacheHitTokens);
    
    this.usageStats.totalInputTokens += inputTokens;
    this.usageStats.totalOutputTokens += outputTokens;
    this.usageStats.totalCachedInputTokens += cacheHitTokens;
    this.usageStats.totalCost += cost;
    this.usageStats.requestCount += 1;

    // Update averages
    this.usageStats.averageInputTokensPerRequest = this.usageStats.totalInputTokens / this.usageStats.requestCount;
    this.usageStats.averageOutputTokensPerRequest = this.usageStats.totalOutputTokens / this.usageStats.requestCount;
    this.usageStats.averageCostPerRequest = this.usageStats.totalCost / this.usageStats.requestCount;

    // Update cost breakdown
    const regularInputTokens = Math.max(0, inputTokens - cacheHitTokens);
    const inputCost = (regularInputTokens / 1000000) * DEEPSEEK_PRICING.inputTokenCost;
    const cachedInputCost = (cacheHitTokens / 1000000) * DEEPSEEK_PRICING.inputTokenCost * (1 - DEEPSEEK_PRICING.cacheHitDiscount);
    const outputCost = (outputTokens / 1000000) * DEEPSEEK_PRICING.outputTokenCost;
    const cacheSavings = (cacheHitTokens / 1000000) * DEEPSEEK_PRICING.inputTokenCost * DEEPSEEK_PRICING.cacheHitDiscount;

    this.usageStats.costBreakdown.inputTokenCost += inputCost + cachedInputCost;
    this.usageStats.costBreakdown.outputTokenCost += outputCost;
    this.usageStats.costBreakdown.cacheSavings += cacheSavings;

    // Update rate limiter
    const totalTokens = inputTokens + outputTokens;
    this.rateLimiter.recordRequest(totalTokens, cost);

    logger.info('DeepSeek usage updated', {
      operation: 'updateUsageStats',
      timestamp: new Date().toISOString()
    }, {
      provider: 'deepseek',
      inputTokens,
      outputTokens,
      cacheHitTokens,
      cost: parseFloat(cost.toFixed(6)),
      totalCost: parseFloat(this.usageStats.totalCost.toFixed(6))
    });
  }

  // Track latency for health monitoring
  private trackLatency(latencyMs: number, success: boolean, errorType?: string) {
    const now = Date.now();
    const currentHour = new Date(now).toISOString().substring(0, 13); // YYYY-MM-DDTHH format

    // Update latency statistics
    if (success) {
      this.healthMetrics.latencyStats.totalMeasurements++;
      this.healthMetrics.latencyStats.totalLatency += latencyMs;
      this.healthMetrics.latencyStats.minLatency = Math.min(this.healthMetrics.latencyStats.minLatency, latencyMs);
      this.healthMetrics.latencyStats.maxLatency = Math.max(this.healthMetrics.latencyStats.maxLatency, latencyMs);

      // Keep recent latencies for trend analysis (last 100)
      this.healthMetrics.latencyStats.recentLatencies.push(latencyMs);
      if (this.healthMetrics.latencyStats.recentLatencies.length > 100) {
        this.healthMetrics.latencyStats.recentLatencies.shift();
      }

      // Track hourly latency
      const hourlyLatency = this.healthMetrics.latencyStats.latencyByHour.get(currentHour) || { sum: 0, count: 0, avg: 0 };
      hourlyLatency.sum += latencyMs;
      hourlyLatency.count++;
      hourlyLatency.avg = hourlyLatency.sum / hourlyLatency.count;
      this.healthMetrics.latencyStats.latencyByHour.set(currentHour, hourlyLatency);
    }

    // Track request history with 24-hour window
    this.healthMetrics.requestHistory.last24Hours.push({
      timestamp: now,
      success,
      latency: latencyMs,
      errorType
    });

    // Clean up old data (keep only last 24 hours)
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
    this.healthMetrics.requestHistory.last24Hours = this.healthMetrics.requestHistory.last24Hours.filter(
      entry => entry.timestamp > twentyFourHoursAgo
    );

    // Update hourly success/failure counts
    const hourlyRequests = this.healthMetrics.requestHistory.requestsByHour.get(currentHour) || 
      { success: 0, failure: 0, totalLatency: 0 };
    
    if (success) {
      hourlyRequests.success++;
      hourlyRequests.totalLatency += latencyMs;
      this.healthMetrics.requestHistory.successfulRequests++;
    } else {
      hourlyRequests.failure++;
      this.healthMetrics.requestHistory.failedRequests++;
    }
    
    this.healthMetrics.requestHistory.requestsByHour.set(currentHour, hourlyRequests);

    // Clean up old hourly data (keep last 48 hours for trend analysis)
    const fortyEightHoursAgo = new Date(now - (48 * 60 * 60 * 1000)).toISOString().substring(0, 13);
    for (const [hour] of Array.from(this.healthMetrics.requestHistory.requestsByHour)) {
      if (hour < fortyEightHoursAgo) {
        this.healthMetrics.requestHistory.requestsByHour.delete(hour);
      }
    }
    for (const [hour] of Array.from(this.healthMetrics.latencyStats.latencyByHour)) {
      if (hour < fortyEightHoursAgo) {
        this.healthMetrics.latencyStats.latencyByHour.delete(hour);
      }
    }

    // Update trend data
    this.updateTrendAnalysis(currentHour);
  }

  // Update trend analysis data
  private updateTrendAnalysis(currentHour: string) {
    const hourlyData = this.healthMetrics.requestHistory.requestsByHour.get(currentHour);
    if (!hourlyData) return;

    const totalRequests = hourlyData.success + hourlyData.failure;
    const successRate = totalRequests > 0 ? (hourlyData.success / totalRequests) * 100 : 0;
    const avgLatency = hourlyData.success > 0 ? hourlyData.totalLatency / hourlyData.success : 0;
    const errorRate = totalRequests > 0 ? (hourlyData.failure / totalRequests) * 100 : 0;

    this.healthMetrics.trends.hourlySuccessRates.set(currentHour, parseFloat(successRate.toFixed(2)));
    this.healthMetrics.trends.hourlyAvgLatency.set(currentHour, parseFloat(avgLatency.toFixed(2)));
    this.healthMetrics.trends.hourlyErrorRates.set(currentHour, { total: hourlyData.failure, rate: parseFloat(errorRate.toFixed(2)) });
  }

  // Perform lightweight model availability check
  async performModelAvailabilityCheck(): Promise<{ available: boolean; latency?: number; error?: string }> {
    const startTime = performance.now();
    
    try {
      // Lightweight test with minimal token usage
      const testResponse = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout for health checks
      });

      const endTime = performance.now();
      const latency = endTime - startTime;

      if (!testResponse.ok) {
        const error = `Model availability check failed: HTTP ${testResponse.status}`;
        this.healthMetrics.modelHealth.consecutiveModelFailures++;
        this.healthMetrics.modelHealth.isModelAvailable = false;
        
        this.healthMetrics.modelHealth.modelTestHistory.push({
          timestamp: Date.now(),
          success: false,
          error,
          latency
        });

        return { available: false, latency, error };
      }

      // Reset consecutive failures on success
      this.healthMetrics.modelHealth.consecutiveModelFailures = 0;
      this.healthMetrics.modelHealth.isModelAvailable = true;
      this.healthMetrics.modelHealth.lastSuccessfulModelTest = new Date();
      this.healthMetrics.modelHealth.lastAvailabilityCheck = new Date();

      this.healthMetrics.modelHealth.modelTestHistory.push({
        timestamp: Date.now(),
        success: true,
        latency
      });

      // Keep only last 24 hours of model test history
      const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
      this.healthMetrics.modelHealth.modelTestHistory = this.healthMetrics.modelHealth.modelTestHistory.filter(
        entry => entry.timestamp > twentyFourHoursAgo
      );

      return { available: true, latency };

    } catch (error) {
      const endTime = performance.now();
      const latency = endTime - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.healthMetrics.modelHealth.consecutiveModelFailures++;
      this.healthMetrics.modelHealth.isModelAvailable = false;
      this.healthMetrics.modelHealth.lastAvailabilityCheck = new Date();
      
      this.healthMetrics.modelHealth.modelTestHistory.push({
        timestamp: Date.now(),
        success: false,
        error: this.sanitizeErrorMessage(errorMessage),
        latency
      });

      return { available: false, latency, error: this.sanitizeErrorMessage(errorMessage) };
    }
  }

  // Get comprehensive health metrics
  getHealthMetrics() {
    const now = Date.now();
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
    
    // Calculate 24-hour success rate
    const last24HourRequests = this.healthMetrics.requestHistory.last24Hours;
    const successful24h = last24HourRequests.filter(req => req.success).length;
    const total24h = last24HourRequests.length;
    const successRate24h = total24h > 0 ? (successful24h / total24h) * 100 : 0;
    
    // Calculate average latency
    const avgLatency = this.healthMetrics.latencyStats.totalMeasurements > 0 
      ? this.healthMetrics.latencyStats.totalLatency / this.healthMetrics.latencyStats.totalMeasurements 
      : 0;
    
    // Calculate recent latency (last 10 measurements)
    const recentLatencies = this.healthMetrics.latencyStats.recentLatencies.slice(-10);
    const recentAvgLatency = recentLatencies.length > 0 
      ? recentLatencies.reduce((sum, lat) => sum + lat, 0) / recentLatencies.length 
      : 0;

    // Time since last model availability check
    const timeSinceLastCheck = now - this.healthMetrics.modelHealth.lastAvailabilityCheck.getTime();
    const shouldCheckModel = timeSinceLastCheck > 5 * 60 * 1000; // Check every 5 minutes

    return {
      overall: {
        status: this.determineOverallHealthStatus(),
        lastUpdated: new Date().toISOString()
      },
      latency: {
        current: parseFloat(recentAvgLatency.toFixed(2)),
        average: parseFloat(avgLatency.toFixed(2)),
        min: this.healthMetrics.latencyStats.minLatency === Number.MAX_VALUE ? 0 : this.healthMetrics.latencyStats.minLatency,
        max: this.healthMetrics.latencyStats.maxLatency,
        measurements: this.healthMetrics.latencyStats.totalMeasurements,
        trend: this.calculateLatencyTrend()
      },
      successRate: {
        last24Hours: parseFloat(successRate24h.toFixed(2)),
        totalRequests: total24h,
        successfulRequests: successful24h,
        failedRequests: total24h - successful24h,
        trend: this.calculateSuccessRateTrend()
      },
      modelAvailability: {
        isAvailable: this.healthMetrics.modelHealth.isModelAvailable,
        lastCheck: this.healthMetrics.modelHealth.lastAvailabilityCheck.toISOString(),
        lastSuccessfulTest: this.healthMetrics.modelHealth.lastSuccessfulModelTest.toISOString(),
        consecutiveFailures: this.healthMetrics.modelHealth.consecutiveModelFailures,
        shouldRecheck: shouldCheckModel,
        recentTests: this.healthMetrics.modelHealth.modelTestHistory.slice(-5) // Last 5 tests
      },
      errorAnalysis: this.getDetailedErrorAnalysis(),
      trends: {
        hourlySuccessRates: Array.from(this.healthMetrics.trends.hourlySuccessRates.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(-24), // Last 24 hours
        hourlyAvgLatency: Array.from(this.healthMetrics.trends.hourlyAvgLatency.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(-24),
        hourlyErrorRates: Array.from(this.healthMetrics.trends.hourlyErrorRates.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(-24)
      }
    };
  }

  // Determine overall health status
  private determineOverallHealthStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    const recentRequests = this.healthMetrics.requestHistory.last24Hours.slice(-10); // Last 10 requests
    const recentSuccessRate = recentRequests.length > 0 
      ? (recentRequests.filter(req => req.success).length / recentRequests.length) * 100 
      : 0;
    
    const modelAvailable = this.healthMetrics.modelHealth.isModelAvailable;
    const consecutiveFailures = this.healthMetrics.modelHealth.consecutiveModelFailures;
    const consecutiveErrors = this.errorStats.consecutiveErrors;

    // Determine health status
    if (!modelAvailable || consecutiveFailures > 5 || consecutiveErrors > 5) {
      return 'unhealthy';
    } else if (recentSuccessRate < 80 || consecutiveFailures > 2 || consecutiveErrors > 2) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  // Calculate latency trend
  private calculateLatencyTrend(): 'improving' | 'stable' | 'degrading' {
    const recent = this.healthMetrics.latencyStats.recentLatencies.slice(-20); // Last 20 measurements
    if (recent.length < 10) return 'stable';
    
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, lat) => sum + lat, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, lat) => sum + lat, 0) / secondHalf.length;
    
    const threshold = firstAvg * 0.1; // 10% threshold
    if (secondAvg < firstAvg - threshold) return 'improving';
    if (secondAvg > firstAvg + threshold) return 'degrading';
    return 'stable';
  }

  // Calculate success rate trend
  private calculateSuccessRateTrend(): 'improving' | 'stable' | 'degrading' {
    const recentHours = Array.from(this.healthMetrics.trends.hourlySuccessRates.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6) // Last 6 hours
      .map(entry => entry[1]);
    
    if (recentHours.length < 3) return 'stable';
    
    const firstHalf = recentHours.slice(0, Math.floor(recentHours.length / 2));
    const secondHalf = recentHours.slice(Math.floor(recentHours.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, rate) => sum + rate, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, rate) => sum + rate, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg + 5) return 'improving'; // 5% threshold
    if (secondAvg < firstAvg - 5) return 'degrading';
    return 'stable';
  }

  // Get detailed error analysis
  private getDetailedErrorAnalysis() {
    const last24Hours = this.healthMetrics.requestHistory.last24Hours;
    const errors24h = last24Hours.filter(req => !req.success);
    
    const errorTypeCount = errors24h.reduce((acc, error) => {
      const type = error.errorType || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalErrors24h: errors24h.length,
      errorRate24h: last24Hours.length > 0 ? parseFloat(((errors24h.length / last24Hours.length) * 100).toFixed(2)) : 0,
      errorsByType: errorTypeCount,
      recentErrors: errors24h.slice(-5).map(error => ({
        timestamp: new Date(error.timestamp).toISOString(),
        type: error.errorType,
        latency: error.latency
      }))
    };
  }

  // Get comprehensive usage and cost statistics
  getUsageStatistics() {
    return {
      tokenUsage: {
        totalInputTokens: this.usageStats.totalInputTokens,
        totalOutputTokens: this.usageStats.totalOutputTokens,
        totalCachedInputTokens: this.usageStats.totalCachedInputTokens,
        totalTokens: this.usageStats.totalInputTokens + this.usageStats.totalOutputTokens,
        averageInputTokensPerRequest: Math.round(this.usageStats.averageInputTokensPerRequest),
        averageOutputTokensPerRequest: Math.round(this.usageStats.averageOutputTokensPerRequest)
      },
      costAnalysis: {
        totalCost: parseFloat(this.usageStats.totalCost.toFixed(6)),
        averageCostPerRequest: parseFloat(this.usageStats.averageCostPerRequest.toFixed(6)),
        costBreakdown: {
          inputTokenCost: parseFloat(this.usageStats.costBreakdown.inputTokenCost.toFixed(6)),
          outputTokenCost: parseFloat(this.usageStats.costBreakdown.outputTokenCost.toFixed(6)),
          cacheSavings: parseFloat(this.usageStats.costBreakdown.cacheSavings.toFixed(6))
        },
        projectedMonthlyCost: parseFloat((this.usageStats.totalCost * 30).toFixed(2)), // Rough monthly projection
        costEfficiency: {
          costPerInputToken: this.usageStats.totalInputTokens > 0 ? parseFloat((this.usageStats.costBreakdown.inputTokenCost / this.usageStats.totalInputTokens * 1000000).toFixed(6)) : 0,
          costPerOutputToken: this.usageStats.totalOutputTokens > 0 ? parseFloat((this.usageStats.costBreakdown.outputTokenCost / this.usageStats.totalOutputTokens * 1000000).toFixed(6)) : 0,
          cachingEffectiveness: this.usageStats.totalInputTokens > 0 ? parseFloat((this.usageStats.totalCachedInputTokens / this.usageStats.totalInputTokens * 100).toFixed(2)) : 0
        }
      },
      rateLimiting: this.rateLimiter.getUsageStats(),
      requestMetrics: {
        totalRequests: this.usageStats.requestCount,
        successfulRequests: this.usageStats.requestCount - this.errorStats.totalErrors,
        errorRate: this.usageStats.requestCount > 0 ? parseFloat(((this.errorStats.totalErrors / this.usageStats.requestCount) * 100).toFixed(2)) : 0
      }
    };
  }

  // Get comprehensive statistics for diagnostics
  getCacheStatistics() {
    const totalCacheTokens = this.cacheStats.totalCacheHitTokens + this.cacheStats.totalCacheMissTokens;
    const overallCacheHitRate = totalCacheTokens > 0 
      ? (this.cacheStats.totalCacheHitTokens / totalCacheTokens) * 100 
      : 0;
    
    // Calculate error rates
    const totalRequests = this.cacheStats.totalRequests;
    const errorRate = totalRequests > 0 ? (this.errorStats.totalErrors / totalRequests) * 100 : 0;
    const timeSinceLastSuccess = new Date().getTime() - this.errorStats.lastSuccessfulRequest.getTime();
    
    // Clean up old error-by-minute data (keep last 60 minutes)
    const currentMinute = Math.floor(Date.now() / 60000);
    const cutoffMinute = currentMinute - 60;
    for (const [minute] of Array.from(this.errorStats.errorsByMinute)) {
      if (parseInt(minute) < cutoffMinute) {
        this.errorStats.errorsByMinute.delete(minute);
      }
    }
    
    return {
      // Cache metrics
      totalRequests: this.cacheStats.totalRequests,
      totalCacheHits: this.cacheStats.totalCacheHits,
      totalCacheMisses: this.cacheStats.totalCacheMisses,
      totalCacheHitTokens: this.cacheStats.totalCacheHitTokens,
      totalCacheMissTokens: this.cacheStats.totalCacheMissTokens,
      overallCacheHitRate: parseFloat(overallCacheHitRate.toFixed(2)),
      
      // Error metrics
      errorStatistics: {
        totalErrors: this.errorStats.totalErrors,
        rateLimitErrors: this.errorStats.rateLimitErrors,
        timeoutErrors: this.errorStats.timeoutErrors,
        apiErrors: this.errorStats.apiErrors,
        networkErrors: this.errorStats.networkErrors,
        errorRate: parseFloat(errorRate.toFixed(2)),
        consecutiveErrors: this.errorStats.consecutiveErrors,
        timeSinceLastSuccessMinutes: Math.floor(timeSinceLastSuccess / 60000),
        lastError: this.errorStats.lastError,
        recentErrorsPerMinute: Array.from(this.errorStats.errorsByMinute.entries())
          .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
          .slice(0, 10) // Last 10 minutes
      }
    };
  }

  // Get health status for quick diagnostics
  getHealthStatus() {
    const stats = this.getCacheStatistics();
    const isHealthy = stats.errorStatistics.consecutiveErrors < 3 && 
                     stats.errorStatistics.timeSinceLastSuccessMinutes < 30;
    
    return {
      status: isHealthy ? 'healthy' : 'degraded',
      canFallback: stats.errorStatistics.consecutiveErrors >= 2,
      recommendation: isHealthy 
        ? 'Operating normally' 
        : stats.errorStatistics.consecutiveErrors >= 5
        ? 'Consider switching to fallback provider'
        : 'Monitor for continued issues'
    };
  }

  // Track error occurrences for statistics
  private trackError(error: Error, statusCode?: number) {
    this.errorStats.totalErrors++;
    this.errorStats.consecutiveErrors++;
    
    const currentMinute = Math.floor(Date.now() / 60000).toString();
    this.errorStats.errorsByMinute.set(
      currentMinute,
      (this.errorStats.errorsByMinute.get(currentMinute) || 0) + 1
    );
    
    this.errorStats.lastError = {
      timestamp: new Date(),
      error: this.sanitizeErrorMessage(error.message),
      statusCode
    };
    
    // Categorize error types
    if (error instanceof DeepSeekRateLimitError) {
      this.errorStats.rateLimitErrors++;
    } else if (error instanceof DeepSeekTimeoutError) {
      this.errorStats.timeoutErrors++;
    } else if (error instanceof DeepSeekAPIError) {
      this.errorStats.apiErrors++;
    } else {
      this.errorStats.networkErrors++;
    }
    
    logger.warn('DeepSeek provider error tracked', {
      operation: 'trackError',
      timestamp: new Date().toISOString()
    }, {
      provider: 'deepseek',
      errorType: error.name,
      statusCode,
      consecutiveErrors: this.errorStats.consecutiveErrors
    });
  }

  // Reset consecutive error count on successful request
  private trackSuccess() {
    this.errorStats.consecutiveErrors = 0;
    this.errorStats.lastSuccessfulRequest = new Date();
  }

  // Sanitize error messages to prevent information leakage
  private sanitizeErrorMessage(message: string): string {
    // Remove API keys, tokens, and other sensitive information
    return message
      .replace(/Bearer\s+[A-Za-z0-9\-_]+/g, 'Bearer [REDACTED]')
      .replace(/api[_-]?key[:\s=]+[A-Za-z0-9\-_]+/gi, 'api_key=[REDACTED]')
      .replace(/token[:\s=]+[A-Za-z0-9\-_]+/gi, 'token=[REDACTED]')
      .replace(/sk-[A-Za-z0-9\-_]+/g, 'sk-[REDACTED]');
  }

  // Parse DeepSeek API errors with specific handling
  private async handleAPIError(response: Response): Promise<never> {
    const statusCode = response.status;
    let errorMessage = `DeepSeek API error: ${response.statusText}`;
    let errorCode: string | undefined;
    let retryAfter: number | undefined;
    
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error.message || errorData.error;
        errorCode = errorData.error.code || errorData.error.type;
      }
    } catch {
      // If we can't parse the error response, use the status text
    }
    
    // Extract retry-after header for rate limiting
    const retryAfterHeader = response.headers.get('retry-after');
    if (retryAfterHeader) {
      retryAfter = parseInt(retryAfterHeader);
    }
    
    // Create specific error types based on status codes
    switch (statusCode) {
      case 429:
        const rateLimitError = new DeepSeekRateLimitError(
          `Rate limit exceeded: ${errorMessage}`,
          retryAfter
        );
        this.trackError(rateLimitError, statusCode);
        throw rateLimitError;
        
      case 401:
      case 403:
        const authError = new DeepSeekAPIError(
          `Authentication failed: ${this.sanitizeErrorMessage(errorMessage)}`,
          statusCode,
          errorCode
        );
        this.trackError(authError, statusCode);
        throw authError;
        
      case 400:
        const validationError = new DeepSeekAPIError(
          `Invalid request: ${this.sanitizeErrorMessage(errorMessage)}`,
          statusCode,
          errorCode
        );
        this.trackError(validationError, statusCode);
        throw validationError;
        
      case 500:
      case 502:
      case 503:
      case 504:
        const serverError = new DeepSeekAPIError(
          `Server error: ${this.sanitizeErrorMessage(errorMessage)}`,
          statusCode,
          errorCode,
          retryAfter
        );
        this.trackError(serverError, statusCode);
        throw serverError;
        
      default:
        const genericError = new DeepSeekAPIError(
          this.sanitizeErrorMessage(errorMessage),
          statusCode,
          errorCode
        );
        this.trackError(genericError, statusCode);
        throw genericError;
    }
  }

  async generateContent(prompt: string, options?: {
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
    responseFormat?: 'json' | 'text';
  }): Promise<AIResponse> {
    // Start latency tracking
    const startTime = performance.now();
    let success = false;
    let errorType: string | undefined;

    // Pre-flight rate limiting check
    const maxTokens = options?.maxTokens || 1000;
    const fullPrompt = (options?.systemInstruction ? options.systemInstruction + '\n\n' : '') + prompt;
    const estimatedTokens = this.estimateTokenCount(fullPrompt) + maxTokens;
    const estimatedCost = this.estimateRequestCost(fullPrompt, maxTokens);
    
    const rateLimitCheck = this.rateLimiter.canMakeRequest(estimatedTokens, estimatedCost);
    if (!rateLimitCheck.allowed) {
      logger.warn('DeepSeek rate limit prevented request', {
        operation: 'generateContent',
        timestamp: new Date().toISOString()
      }, {
        provider: 'deepseek',
        reason: rateLimitCheck.reason,
        waitTimeSeconds: rateLimitCheck.waitTimeSeconds
      });
      
      // Track latency for rate limit error
      errorType = 'rate_limit';
      this.trackLatency(performance.now() - startTime, false, errorType);
      
      // Throw rate limit error that triggers fallback
      throw new DeepSeekRateLimitError(
        rateLimitCheck.reason || 'Rate limit exceeded',
        rateLimitCheck.waitTimeSeconds
      );
    }

    const messages: any[] = [];
    
    if (options?.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }
    
    messages.push({ role: 'user', content: prompt });

    const requestBody = {
      model: 'deepseek-chat',
      messages,
      max_tokens: Math.min(options?.maxTokens || 1000, 1000), // Cap at 1000 tokens to prevent runaway responses
      temperature: options?.temperature || 0.7,
      ...(options?.responseFormat === 'json' && { 
        response_format: { type: 'json_object' }
      }),
    };

    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 30000); // 30 second timeout

    let response: Response;
    let data: any;

    try {
      response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleAPIError(response);
      }

      data = await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof DeepSeekAPIError) {
        errorType = 'api_error';
        this.trackLatency(performance.now() - startTime, false, errorType);
        throw error;  // Re-throw our specific API errors
      }
      
      if ((error as any)?.name === 'AbortError') {
        errorType = 'timeout';
        const timeoutError = new DeepSeekTimeoutError('Request timed out after 30 seconds');
        this.trackError(timeoutError);
        this.trackLatency(performance.now() - startTime, false, errorType);
        throw timeoutError;
      }
      
      // Handle network errors
      errorType = 'network_error';
      const networkError = new Error(`Network error: ${this.sanitizeErrorMessage((error as any)?.message || 'Unknown error')}`);
      this.trackError(networkError);
      this.trackLatency(performance.now() - startTime, false, errorType);
      throw networkError;
    }

    const text = data.choices[0]?.message?.content || '';

    // Track cache metrics and successful request
    this.cacheStats.totalRequests++;
    
    // Extract cache metrics from DeepSeek response
    const cacheHitTokens = data.usage?.prompt_cache_hit_tokens || 0;
    const cacheMissTokens = data.usage?.prompt_cache_miss_tokens || 0;
    
    // Update cache statistics
    if (cacheHitTokens > 0) {
      this.cacheStats.totalCacheHits++;
      this.cacheStats.totalCacheHitTokens += cacheHitTokens;
    }
    if (cacheMissTokens > 0) {
      this.cacheStats.totalCacheMisses++;
      this.cacheStats.totalCacheMissTokens += cacheMissTokens;
    }
    
    // Calculate cache hit rate for this request
    const totalCacheTokens = cacheHitTokens + cacheMissTokens;
    const cacheHitRate = totalCacheTokens > 0 ? (cacheHitTokens / totalCacheTokens) * 100 : 0;

    // Track successful request
    this.trackSuccess();
    success = true;

    // Track latency for successful request
    const latency = performance.now() - startTime;
    this.trackLatency(latency, true);

    // Update usage statistics with actual token counts
    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;
    this.updateUsageStats(inputTokens, outputTokens, cacheHitTokens);

    return {
      text,
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: data.usage?.total_tokens,
        cacheMetrics: totalCacheTokens > 0 ? {
          cacheHitTokens,
          cacheMissTokens,
          cacheHitRate: parseFloat(cacheHitRate.toFixed(2))
        } : undefined
      }
    };
  }

  async generateContentStream(messages: AIMessage[], options?: {
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<AIStreamResponse> {
    // Start latency tracking for streaming request
    const startTime = performance.now();
    let success = false;
    let errorType: string | undefined;

    // Pre-flight rate limiting check for streaming
    const maxTokens = Math.min(options?.maxTokens || 1000, 1000); // Cap at 1000 tokens consistently
    const fullContent = (options?.systemInstruction || '') + messages.map(m => m.content).join('\n');
    const estimatedTokens = this.estimateTokenCount(fullContent) + maxTokens;
    const estimatedCost = this.estimateRequestCost(fullContent, maxTokens);
    
    const rateLimitCheck = this.rateLimiter.canMakeRequest(estimatedTokens, estimatedCost);
    if (!rateLimitCheck.allowed) {
      logger.warn('DeepSeek rate limit prevented streaming request', {
        operation: 'generateStreamResponse',
        timestamp: new Date().toISOString()
      }, {
        provider: 'deepseek',
        reason: rateLimitCheck.reason,
        waitTimeSeconds: rateLimitCheck.waitTimeSeconds
      });
      
      // Track latency for rate limit error
      errorType = 'rate_limit';
      this.trackLatency(performance.now() - startTime, false, errorType);
      
      // Throw rate limit error that triggers fallback
      throw new DeepSeekRateLimitError(
        rateLimitCheck.reason || 'Rate limit exceeded',
        rateLimitCheck.waitTimeSeconds
      );
    }

    const openaiMessages: any[] = [];
    
    if (options?.systemInstruction) {
      openaiMessages.push({ role: 'system', content: options.systemInstruction });
    }
    
    openaiMessages.push(...messages.map(msg => ({
      role: msg.role,
      content: msg.content
    })));

    const requestBody = {
      model: 'deepseek-chat',
      messages: openaiMessages,
      max_tokens: Math.min(options?.maxTokens || 1000, 1000), // Cap at 1000 tokens for streaming too
      temperature: options?.temperature || 0.7,
      stream: true,
    };

    // Create AbortController for streaming timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 60000); // 60 second timeout for streaming

    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleAPIError(response);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof DeepSeekAPIError) {
        errorType = 'api_error';
        this.trackLatency(performance.now() - startTime, false, errorType);
        throw error;
      }
      
      if ((error as any)?.name === 'AbortError') {
        errorType = 'timeout';
        const timeoutError = new DeepSeekTimeoutError('Streaming request timed out after 60 seconds');
        this.trackError(timeoutError);
        this.trackLatency(performance.now() - startTime, false, errorType);
        throw timeoutError;
      }
      
      errorType = 'network_error';
      const networkError = new Error(`Network error: ${this.sanitizeErrorMessage((error as any)?.message || 'Unknown error')}`);
      this.trackError(networkError);
      this.trackLatency(performance.now() - startTime, false, errorType);
      throw networkError;
    }

    // Track streaming request success and latency (stream established successfully)
    this.cacheStats.totalRequests++;
    success = true;
    const latency = performance.now() - startTime;
    this.trackLatency(latency, true);
    this.trackSuccess();
    
    const provider = this; // Capture context
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) return;

        let streamCacheHitTokens = 0;
        let streamCacheMissTokens = 0;
        let cacheMetricsProcessed = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  // Process final cache metrics if not already done
                  if (!cacheMetricsProcessed && (streamCacheHitTokens > 0 || streamCacheMissTokens > 0)) {
                    if (streamCacheHitTokens > 0) {
                      provider.cacheStats.totalCacheHits++;
                      provider.cacheStats.totalCacheHitTokens += streamCacheHitTokens;
                    }
                    if (streamCacheMissTokens > 0) {
                      provider.cacheStats.totalCacheMisses++;
                      provider.cacheStats.totalCacheMissTokens += streamCacheMissTokens;
                    }
                    cacheMetricsProcessed = true;
                  }
                  continue;
                }

                try {
                  const parsed = JSON.parse(data);
                  
                  // Extract cache metrics from streaming response if available
                  if (parsed.usage && !cacheMetricsProcessed) {
                    streamCacheHitTokens = parsed.usage.prompt_cache_hit_tokens || 0;
                    streamCacheMissTokens = parsed.usage.prompt_cache_miss_tokens || 0;
                    
                    // Update statistics immediately for streaming
                    if (streamCacheHitTokens > 0) {
                      provider.cacheStats.totalCacheHits++;
                      provider.cacheStats.totalCacheHitTokens += streamCacheHitTokens;
                    }
                    if (streamCacheMissTokens > 0) {
                      provider.cacheStats.totalCacheMisses++;
                      provider.cacheStats.totalCacheMissTokens += streamCacheMissTokens;
                    }
                    cacheMetricsProcessed = true;
                  }
                  
                  const content = parsed.choices[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(new TextEncoder().encode(content));
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (streamError) {
          // If streaming fails after connection is established, track it separately
          provider.trackError(new Error(`Streaming error: ${provider.sanitizeErrorMessage((streamError as any)?.message || 'Unknown streaming error')}`));
          controller.error(streamError);
        } finally {
          controller.close();
        }
      }
    });

    return { stream };
  }

  async generateStructuredContent<T>(prompt: string, schema: any, options?: {
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<T> {
    const jsonPrompt = `${prompt}\n\nPlease respond with valid JSON only that matches this schema: ${JSON.stringify(schema)}`;
    
    const response = await this.generateContent(jsonPrompt, {
      ...options,
      responseFormat: 'json'
    });

    return JSON.parse(response.text);
  }
}