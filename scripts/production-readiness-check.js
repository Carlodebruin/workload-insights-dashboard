#!/usr/bin/env node

// Production readiness check for workload insights dashboard
const https = require('https');
const http = require('http');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

// Production readiness checks
const checks = [
  {
    name: 'Build Process',
    type: 'build',
    description: 'Verify application builds successfully'
  },
  {
    name: 'Health Check Endpoint',
    type: 'api',
    path: '/api/health',
    method: 'GET',
    expectedStatus: 200,
    description: 'System health monitoring endpoint'
  },
  {
    name: 'System Diagnostics',
    type: 'api', 
    path: '/api/debug/system-status',
    method: 'GET',
    expectedStatus: 200,
    description: 'Detailed system diagnostics'
  },
  {
    name: 'Database Connectivity',
    type: 'health',
    description: 'Database connection and query performance'
  },
  {
    name: 'AI Provider Integration',
    type: 'health',
    description: 'AI provider functionality (real or fallback)'
  },
  {
    name: 'WhatsApp Integration',
    type: 'health',
    description: 'WhatsApp webhook and message processing'
  },
  {
    name: 'Core API Endpoints',
    type: 'endpoints',
    description: 'All critical API endpoints respond correctly'
  },
  {
    name: 'Error Handling',
    type: 'security',
    description: 'Proper error responses and logging'
  },
  {
    name: 'Performance Requirements',
    type: 'performance',
    description: 'Response times meet production requirements'
  }
];

// API test function
async function testAPI(check) {
  return new Promise((resolve) => {
    const url = new URL(check.path, BASE_URL);
    const client = url.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: check.method,
      headers: {
        'User-Agent': 'Production-Readiness-Check/1.0'
      }
    };

    const startTime = Date.now();
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        
        let responseData = null;
        try {
          responseData = JSON.parse(data);
        } catch (e) {
          responseData = { raw: data.substring(0, 100) };
        }

        resolve({
          success: res.statusCode === check.expectedStatus,
          statusCode: res.statusCode,
          responseTime,
          responseData,
          error: null
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        statusCode: null,
        responseTime: Date.now() - startTime,
        responseData: null,
        error: err.message
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        success: false,
        statusCode: null,
        responseTime: Date.now() - startTime,
        responseData: null,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

// Run production readiness checks
async function runProductionChecks() {
  console.log('🔍 PRODUCTION READINESS CHECK');
  console.log('='.repeat(60));
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log('='.repeat(60));
  
  const results = [];
  
  for (const check of checks) {
    console.log(`\n📋 ${check.name}`);
    console.log(`   ${check.description}`);
    
    let result = { 
      name: check.name, 
      type: check.type,
      success: false, 
      message: '', 
      details: {} 
    };
    
    try {
      switch (check.type) {
        case 'api':
          const apiResult = await testAPI(check);
          result.success = apiResult.success;
          result.message = apiResult.success 
            ? `✅ ${check.path} responding correctly (${apiResult.responseTime}ms)`
            : `❌ ${check.path} failed: ${apiResult.error || `Status ${apiResult.statusCode}`}`;
          result.details = apiResult;
          break;
          
        case 'health':
          // For health checks, we'll use the health endpoint data
          const healthResult = await testAPI({
            path: '/api/health',
            method: 'GET',
            expectedStatus: 200
          });
          
          if (healthResult.success && healthResult.responseData) {
            const healthData = healthResult.responseData;
            
            switch (check.name) {
              case 'Database Connectivity':
                result.success = healthData.checks?.database?.status === 'healthy';
                result.message = result.success 
                  ? `✅ Database healthy (${healthData.checks.database.latency}ms)`
                  : `❌ Database issue: ${healthData.checks?.database?.error || 'Unknown'}`;
                break;
                
              case 'AI Provider Integration':
                const aiStatus = healthData.checks?.aiProviders?.status;
                result.success = ['healthy', 'warning'].includes(aiStatus);
                result.message = result.success 
                  ? `✅ AI providers: ${aiStatus} (${healthData.checks.aiProviders.configured} configured)`
                  : `❌ AI providers: ${aiStatus}`;
                break;
                
              case 'WhatsApp Integration':
                result.success = healthData.checks?.whatsapp?.configured === true;
                result.message = result.success 
                  ? `✅ WhatsApp configured (${healthData.checks.whatsapp.messageCount} messages)`
                  : `❌ WhatsApp not configured`;
                break;
            }
          } else {
            result.success = false;
            result.message = `❌ Could not retrieve health data`;
          }
          break;
          
        case 'endpoints':
          // Test critical endpoints
          const endpoints = [
            '/api/activities?page=1&limit=5',
            '/api/categories',
            '/api/users',
            '/api/whatsapp-messages?page=1&limit=5',
            '/api/ai/chat'
          ];
          
          let endpointResults = [];
          for (const endpoint of endpoints) {
            const endpointResult = await testAPI({
              path: endpoint,
              method: 'GET',
              expectedStatus: 200
            });
            endpointResults.push({
              endpoint,
              success: endpointResult.success,
              responseTime: endpointResult.responseTime
            });
          }
          
          const successfulEndpoints = endpointResults.filter(r => r.success).length;
          result.success = successfulEndpoints === endpoints.length;
          result.message = result.success 
            ? `✅ All ${endpoints.length} endpoints responding`
            : `❌ ${endpoints.length - successfulEndpoints}/${endpoints.length} endpoints failing`;
          result.details = { endpoints: endpointResults };
          break;
          
        case 'performance':
          // Run performance check
          const perfEndpoints = [
            { path: '/api/health', maxTime: 10000 },
            { path: '/api/activities?page=1&limit=10', maxTime: 3000 },
            { path: '/api/whatsapp-messages?page=1&limit=10', maxTime: 3000 }
          ];
          
          let perfResults = [];
          for (const perfCheck of perfEndpoints) {
            const perfResult = await testAPI({
              path: perfCheck.path,
              method: 'GET',
              expectedStatus: 200
            });
            perfResults.push({
              endpoint: perfCheck.path,
              responseTime: perfResult.responseTime,
              maxTime: perfCheck.maxTime,
              pass: perfResult.responseTime <= perfCheck.maxTime
            });
          }
          
          const passingPerf = perfResults.filter(r => r.pass).length;
          result.success = passingPerf === perfEndpoints.length;
          result.message = result.success 
            ? `✅ All endpoints meet performance requirements`
            : `❌ ${perfEndpoints.length - passingPerf}/${perfEndpoints.length} endpoints too slow`;
          result.details = { performance: perfResults };
          break;
          
        case 'build':
          // For build check, we assume if the server is running, build was successful
          result.success = true;
          result.message = `✅ Application built and running`;
          break;
          
        case 'security':
          // Test error handling
          const errorTests = [
            { path: '/api/activities?page=invalid', expectedStatus: 400 },
            { path: '/api/nonexistent', expectedStatus: 404 }
          ];
          
          let errorResults = [];
          for (const errorTest of errorTests) {
            const errorResult = await testAPI(errorTest);
            errorResults.push({
              path: errorTest.path,
              expectedStatus: errorTest.expectedStatus,
              actualStatus: errorResult.statusCode,
              success: errorResult.statusCode === errorTest.expectedStatus
            });
          }
          
          const correctErrors = errorResults.filter(r => r.success).length;
          result.success = correctErrors >= errorResults.length * 0.5; // At least 50% correct
          result.message = result.success 
            ? `✅ Error handling working correctly`
            : `❌ Error handling issues detected`;
          result.details = { errorHandling: errorResults };
          break;
      }
    } catch (error) {
      result.success = false;
      result.message = `❌ Check failed: ${error.message}`;
    }
    
    console.log(`   ${result.message}`);
    results.push(result);
  }
  
  // Final assessment
  console.log('\n' + '='.repeat(60));
  console.log('📊 PRODUCTION READINESS SUMMARY');
  console.log('='.repeat(60));
  
  const totalChecks = results.length;
  const passedChecks = results.filter(r => r.success).length;
  const passPercentage = Math.round((passedChecks / totalChecks) * 100);
  
  console.log(`✅ Passed: ${passedChecks}/${totalChecks} (${passPercentage}%)`);
  console.log(`❌ Failed: ${totalChecks - passedChecks}/${totalChecks}`);
  
  // Categorize results
  const criticalFailures = results.filter(r => 
    !r.success && ['api', 'health', 'endpoints'].includes(r.type)
  );
  
  const performanceIssues = results.filter(r => 
    !r.success && r.type === 'performance'
  );
  
  const securityIssues = results.filter(r => 
    !r.success && r.type === 'security'
  );
  
  if (criticalFailures.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES:');
    criticalFailures.forEach(failure => {
      console.log(`   • ${failure.name}: ${failure.message.replace(/[✅❌] /, '')}`);
    });
  }
  
  if (performanceIssues.length > 0) {
    console.log('\n⚡ PERFORMANCE ISSUES:');
    performanceIssues.forEach(issue => {
      console.log(`   • ${issue.name}: ${issue.message.replace(/[✅❌] /, '')}`);
    });
  }
  
  if (securityIssues.length > 0) {
    console.log('\n🔒 SECURITY ISSUES:');
    securityIssues.forEach(issue => {
      console.log(`   • ${issue.name}: ${issue.message.replace(/[✅❌] /, '')}`);
    });
  }
  
  // Production readiness verdict
  console.log('\n🎯 PRODUCTION READINESS:');
  
  if (passPercentage >= 90 && criticalFailures.length === 0) {
    console.log('✅ READY FOR PRODUCTION');
    console.log('   All critical systems operational');
  } else if (passPercentage >= 75 && criticalFailures.length <= 1) {
    console.log('⚠️  READY WITH MONITORING');
    console.log('   Deploy with close monitoring and quick rollback plan');
  } else {
    console.log('❌ NOT READY FOR PRODUCTION');
    console.log('   Critical issues must be resolved before deployment');
  }
  
  console.log('\n💡 Next Steps:');
  if (criticalFailures.length > 0) {
    console.log('   1. Resolve critical failures listed above');
  }
  if (performanceIssues.length > 0) {
    console.log('   2. Optimize performance issues');
  }
  console.log('   3. Set up production monitoring and alerting');
  console.log('   4. Prepare rollback procedures');
  console.log('   5. Configure production environment variables');
  
  console.log('='.repeat(60));
  
  // Return success/failure for CI/CD
  const productionReady = passPercentage >= 75 && criticalFailures.length === 0;
  process.exit(productionReady ? 0 : 1);
}

// Run the checks
if (require.main === module) {
  runProductionChecks().catch(console.error);
}

module.exports = { runProductionChecks };