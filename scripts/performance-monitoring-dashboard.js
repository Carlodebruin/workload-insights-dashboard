#!/usr/bin/env node

/**
 * Performance Monitoring Dashboard Script
 * Tracks API performance, user engagement, and system metrics for the multi-user assignment system
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      apiPerformance: {
        assignmentEndpoints: {},
        responseTimes: [],
        errorRates: []
      },
      userEngagement: {
        assignmentOperations: 0,
        multiUserAssignments: 0,
        realTimeUpdates: 0
      },
      systemHealth: {
        databaseConnections: 0,
        memoryUsage: 0,
        uptime: 0
      },
      mobileOptimization: {
        touchTargetUsage: 0,
        mobileResponsiveness: 0,
        performanceScore: 0
      }
    };
    
    this.startTime = Date.now();
  }

  async collectMetrics() {
    console.log('📊 Collecting Performance Metrics...\n');
    
    try {
      // 1. API Performance Metrics
      await this.collectAPIMetrics();
      
      // 2. User Engagement Metrics
      await this.collectUserEngagementMetrics();
      
      // 3. System Health Metrics
      await this.collectSystemHealthMetrics();
      
      // 4. Mobile Optimization Metrics
      await this.collectMobileOptimizationMetrics();
      
      // 5. Generate comprehensive report
      this.generateReport();
      
      return true;
    } catch (error) {
      console.error('❌ Error collecting metrics:', error.message);
      return false;
    }
  }

  async collectAPIMetrics() {
    console.log('1. Collecting API Performance Metrics...');
    
    try {
      // Check if development server is running
      const devServerCheck = execSync('curl -s http://localhost:3000/api/health 2>/dev/null || echo "down"', {
        encoding: 'utf8'
      });
      
      if (devServerCheck.trim() !== 'down') {
        // Test assignment API endpoints
        const endpoints = [
          '/api/activities/test/assignments',
          '/api/activities/test/assignments/test',
          '/api/activities'
        ];
        
        for (const endpoint of endpoints) {
          try {
            const startTime = Date.now();
            const response = await axios.get(`http://localhost:3000${endpoint}`, {
              timeout: 5000,
              validateStatus: () => true // Don't throw on error status
            });
            const responseTime = Date.now() - startTime;
            
            this.metrics.apiPerformance.assignmentEndpoints[endpoint] = {
              responseTime,
              status: response.status,
              success: response.status >= 200 && response.status < 300
            };
            
            this.metrics.apiPerformance.responseTimes.push(responseTime);
            
            console.log(`   ✅ ${endpoint}: ${responseTime}ms (${response.status})`);
          } catch (error) {
            console.log(`   ⚠️  ${endpoint}: Unavailable - ${error.message}`);
            this.metrics.apiPerformance.errorRates.push({
              endpoint,
              error: error.message
            });
          }
        }
      } else {
        console.log('   🔶 Development server not running, skipping API tests');
      }
    } catch (error) {
      console.log('   ⚠️  Could not collect API metrics:', error.message);
    }
  }

  async collectUserEngagementMetrics() {
    console.log('2. Collecting User Engagement Metrics...');
    
    try {
      // Count assignment operations from logs (simulated)
      const assignmentLogs = execSync('grep -r "assignment" logs/ 2>/dev/null | wc -l || echo "0"', {
        encoding: 'utf8'
      }).trim();
      
      this.metrics.userEngagement.assignmentOperations = parseInt(assignmentLogs) || 0;
      
      // Count multi-user assignments
      const multiUserCount = execSync('grep -r "multi.*user" logs/ 2>/dev/null | wc -l || echo "0"', {
        encoding: 'utf8'
      }).trim();
      
      this.metrics.userEngagement.multiUserAssignments = parseInt(multiUserCount) || 0;
      
      // Count real-time updates
      const realTimeCount = execSync('grep -r "real.*time\\|sse\\|event" logs/ 2>/dev/null | wc -l || echo "0"', {
        encoding: 'utf8'
      }).trim();
      
      this.metrics.userEngagement.realTimeUpdates = parseInt(realTimeCount) || 0;
      
      console.log(`   Assignment Operations: ${this.metrics.userEngagement.assignmentOperations}`);
      console.log(`   Multi-user Assignments: ${this.metrics.userEngagement.multiUserAssignments}`);
      console.log(`   Real-time Updates: ${this.metrics.userEngagement.realTimeUpdates}`);
      
    } catch (error) {
      console.log('   ⚠️  Could not collect user engagement metrics:', error.message);
    }
  }

  async collectSystemHealthMetrics() {
    console.log('3. Collecting System Health Metrics...');
    
    try {
      // Database connection check
      const dbCheck = execSync('ps aux | grep -i "prisma\\|postgres" | grep -v grep | wc -l', {
        encoding: 'utf8'
      }).trim();
      
      this.metrics.systemHealth.databaseConnections = parseInt(dbCheck) || 0;
      
      // Memory usage (simplified)
      const memoryUsage = process.memoryUsage();
      this.metrics.systemHealth.memoryUsage = Math.round(memoryUsage.heapUsed / 1024 / 1024); // MB
      
      // Uptime
      this.metrics.systemHealth.uptime = Math.round((Date.now() - this.startTime) / 1000); // seconds
      
      console.log(`   Database Connections: ${this.metrics.systemHealth.databaseConnections}`);
      console.log(`   Memory Usage: ${this.metrics.systemHealth.memoryUsage}MB`);
      console.log(`   Uptime: ${this.metrics.systemHealth.uptime}s`);
      
    } catch (error) {
      console.log('   ⚠️  Could not collect system health metrics:', error.message);
    }
  }

  async collectMobileOptimizationMetrics() {
    console.log('4. Collecting Mobile Optimization Metrics...');
    
    try {
      // Check touch target usage in components
      const touchUsage = execSync('grep -r "min-h-touch\\|min-w-touch\\|touch-target" components/ app/ 2>/dev/null | wc -l', {
        encoding: 'utf8'
      }).trim();
      
      this.metrics.mobileOptimization.touchTargetUsage = parseInt(touchUsage) || 0;
      
      // Check responsive design patterns
      const responsivePatterns = execSync('grep -r "sm:\\|md:\\|lg:\\|xl:" components/ app/ 2>/dev/null | wc -l', {
        encoding: 'utf8'
      }).trim();
      
      this.metrics.mobileOptimization.mobileResponsiveness = parseInt(responsivePatterns) || 0;
      
      // Calculate performance score (simplified)
      const avgResponseTime = this.metrics.apiPerformance.responseTimes.length > 0 ?
        this.metrics.apiPerformance.responseTimes.reduce((a, b) => a + b, 0) / 
        this.metrics.apiPerformance.responseTimes.length : 0;
      
      this.metrics.mobileOptimization.performanceScore = Math.max(0, 100 - (avgResponseTime / 10));
      
      console.log(`   Touch Target Usage: ${this.metrics.mobileOptimization.touchTargetUsage} instances`);
      console.log(`   Responsive Patterns: ${this.metrics.mobileOptimization.mobileResponsiveness} instances`);
      console.log(`   Performance Score: ${this.metrics.mobileOptimization.performanceScore.toFixed(1)}/100`);
      
    } catch (error) {
      console.log('   ⚠️  Could not collect mobile optimization metrics:', error.message);
    }
  }

  generateReport() {
    console.log('\n5. Generating Comprehensive Performance Report...\n');
    
    const report = {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      summary: {
        overallHealth: this.calculateOverallHealth(),
        recommendations: this.generateRecommendations()
      }
    };
    
    // Calculate average response time
    const responseTimes = this.metrics.apiPerformance.responseTimes;
    const avgResponseTime = responseTimes.length > 0 ? 
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
    
    console.log('📈 PERFORMANCE MONITORING DASHBOARD');
    console.log('====================================');
    console.log(`Timestamp: ${new Date().toLocaleString()}`);
    console.log(`Overall Health: ${report.summary.overallHealth}/100`);
    console.log(`Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`Error Rate: ${this.metrics.apiPerformance.errorRates.length} errors`);
    console.log(`Assignment Operations: ${this.metrics.userEngagement.assignmentOperations}`);
    console.log(`Multi-user Usage: ${this.metrics.userEngagement.multiUserAssignments}`);
    console.log(`Real-time Events: ${this.metrics.userEngagement.realTimeUpdates}`);
    
    console.log('\n🔧 RECOMMENDATIONS:');
    report.summary.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
    
    // Save detailed report
    fs.writeFileSync('performance-monitoring-report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Detailed report saved to: performance-monitoring-report.json');
  }

  calculateOverallHealth() {
    const weights = {
      apiPerformance: 0.4,
      userEngagement: 0.3,
      systemHealth: 0.2,
      mobileOptimization: 0.1
    };
    
    let score = 0;
    
    // API Performance (40%)
    const responseTimes = this.metrics.apiPerformance.responseTimes;
    const avgResponseTime = responseTimes.length > 0 ? 
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 1000;
    const apiScore = Math.max(0, 100 - (avgResponseTime / 20)); // 200ms = 90, 500ms = 75
    
    // User Engagement (30%)
    const engagementScore = Math.min(100, this.metrics.userEngagement.assignmentOperations * 0.1);
    
    // System Health (20%)
    const systemScore = this.metrics.systemHealth.databaseConnections > 0 ? 80 : 40;
    
    // Mobile Optimization (10%)
    const mobileScore = this.metrics.mobileOptimization.performanceScore;
    
    score = (apiScore * weights.apiPerformance) +
            (engagementScore * weights.userEngagement) +
            (systemScore * weights.systemHealth) +
            (mobileScore * weights.mobileOptimization);
    
    return Math.round(score);
  }

  generateRecommendations() {
    const recommendations = [];
    
    // API Performance recommendations
    const responseTimes = this.metrics.apiPerformance.responseTimes;
    const avgResponseTime = responseTimes.length > 0 ? 
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
    
    if (avgResponseTime > 500) {
      recommendations.push('Optimize API response times - target <500ms');
    }
    
    if (this.metrics.apiPerformance.errorRates.length > 0) {
      recommendations.push('Investigate API error rates and implement retry logic');
    }
    
    // User Engagement recommendations
    if (this.metrics.userEngagement.multiUserAssignments < 5) {
      recommendations.push('Promote multi-user assignment feature to increase adoption');
    }
    
    if (this.metrics.userEngagement.realTimeUpdates < 10) {
      recommendations.push('Enhance real-time update visibility and user notifications');
    }
    
    // System Health recommendations
    if (this.metrics.systemHealth.databaseConnections === 0) {
      recommendations.push('Verify database connectivity and connection pooling');
    }
    
    // Mobile Optimization recommendations
    if (this.metrics.mobileOptimization.touchTargetUsage < 10) {
      recommendations.push('Increase mobile touch target implementation across components');
    }
    
    if (this.metrics.mobileOptimization.performanceScore < 80) {
      recommendations.push('Optimize mobile performance through code splitting and lazy loading');
    }
    
    return recommendations.length > 0 ? recommendations : ['System performing well - maintain current standards'];
  }
}

// Run the performance monitoring
async function main() {
  console.log('🚀 Starting Performance Monitoring Dashboard\n');
  
  const monitor = new PerformanceMonitor();
  const success = await monitor.collectMetrics();
  
  if (success) {
    console.log('\n✅ Performance monitoring completed successfully');
    console.log('   Run this script regularly to track system performance over time');
  } else {
    console.log('\n❌ Performance monitoring encountered issues');
    console.log('   Check system status and try again');
  }
}

// Install axios if not present and run
try {
  require('axios');
  main().catch(console.error);
} catch (error) {
  console.log('📦 Installing axios dependency...');
  execSync('npm install axios', { stdio: 'inherit' });
  main().catch(console.error);
}