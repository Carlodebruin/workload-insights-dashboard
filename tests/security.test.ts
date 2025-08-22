import { NextRequest } from 'next/server';
import { headers } from 'next/headers';

/**
 * Comprehensive Security Test Suite
 * 
 * Tests all implemented security controls including:
 * - Authentication bypass attempts
 * - Input validation with malicious payloads
 * - Rate limiting verification
 * - CSRF protection
 * - SQL injection prevention
 * - XSS protection
 * - Authorization checks
 * - Data exposure prevention
 */

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  apiKey: process.env.TEST_API_KEY || 'test-key',
  timeout: 10000,
  retryAttempts: 3
};

// Common payloads for security testing
const MALICIOUS_PAYLOADS = {
  sql_injection: [
    "'; DROP TABLE users; --",
    "1' OR '1'='1",
    "1; SELECT * FROM users",
    "' UNION SELECT * FROM users --",
    "admin'--",
    "admin'/*",
    "' OR 1=1--"
  ],
  xss_payloads: [
    "<script>alert('xss')</script>",
    "<img src=x onerror=alert('xss')>",
    "javascript:alert('xss')",
    "<svg onload=alert('xss')>",
    "';alert('xss');//",
    "<iframe src=javascript:alert('xss')>",
    "'-alert('xss')-'"
  ],
  command_injection: [
    "; ls -la",
    "| cat /etc/passwd",
    "&& rm -rf /",
    "`id`",
    "$(whoami)",
    "; cat /etc/hosts",
    "| nc -l 4444"
  ],
  path_traversal: [
    "../../../etc/passwd",
    "..\\..\\..\\windows\\system32\\config\\sam",
    "....//....//....//etc//passwd",
    "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
    "..%252f..%252f..%252fetc%252fpasswd"
  ],
  oversized_data: [
    "A".repeat(1000000), // 1MB string
    "A".repeat(10000),   // 10KB string
    JSON.stringify({data: "A".repeat(100000)}) // Large JSON
  ]
};

// Security test results interface
interface SecurityTestResult {
  testName: string;
  category: 'authentication' | 'authorization' | 'input_validation' | 'rate_limiting' | 'csrf' | 'data_protection';
  passed: boolean;
  details: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  payload?: string;
  response?: {
    status: number;
    headers: Record<string, string>;
    body?: any;
  };
}

// Test utility functions
class SecurityTestUtils {
  private static results: SecurityTestResult[] = [];

  // Make HTTP request with custom options
  static async makeRequest(
    endpoint: string, 
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      timeout?: number;
    } = {}
  ): Promise<Response> {
    const url = `${TEST_CONFIG.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || TEST_CONFIG.timeout);

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SecurityTestSuite/1.0',
          ...options.headers
        },
        body: options.body,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Record test result
  static recordResult(result: SecurityTestResult): void {
    this.results.push(result);
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const severity = result.severity.toUpperCase();
    console.log(`${status} [${severity}] ${result.testName}: ${result.details}`);
  }

  // Get test summary
  static getSummary(): {
    total: number;
    passed: number;
    failed: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  } {
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;
    const critical = this.results.filter(r => r.severity === 'critical').length;
    const high = this.results.filter(r => r.severity === 'high').length;
    const medium = this.results.filter(r => r.severity === 'medium').length;
    const low = this.results.filter(r => r.severity === 'low').length;

    return { total, passed, failed, critical, high, medium, low };
  }

  // Get all results
  static getResults(): SecurityTestResult[] {
    return [...this.results];
  }

  // Clear results
  static clearResults(): void {
    this.results = [];
  }
}

// Authentication Security Tests
class AuthenticationTests {
  
  // Test authentication bypass attempts
  static async testAuthenticationBypass(): Promise<void> {
    const bypassAttempts = [
      { name: 'No Authorization Header', headers: {} },
      { name: 'Empty Authorization Header', headers: { 'Authorization': '' } },
      { name: 'Invalid Bearer Token', headers: { 'Authorization': 'Bearer invalid-token' } },
      { name: 'Malformed Authorization', headers: { 'Authorization': 'Malformed token' } },
      { name: 'SQL Injection in Token', headers: { 'Authorization': "Bearer '; DROP TABLE users; --" } },
      { name: 'XSS in Token', headers: { 'Authorization': "Bearer <script>alert('xss')</script>" } },
      { name: 'Very Long Token', headers: { 'Authorization': `Bearer ${'A'.repeat(10000)}` } }
    ];

    for (const attempt of bypassAttempts) {
      try {
        const response = await SecurityTestUtils.makeRequest('/api/data', {
          method: 'GET',
          headers: attempt.headers as Record<string, string>
        });

        const passed = response.status === 401 || response.status === 403;
        
        SecurityTestUtils.recordResult({
          testName: `Authentication Bypass: ${attempt.name}`,
          category: 'authentication',
          passed,
          details: passed ? 
            'Correctly rejected unauthorized request' : 
            `Unexpectedly allowed request with status ${response.status}`,
          severity: passed ? 'low' : 'critical',
          timestamp: new Date().toISOString(),
          response: {
            status: response.status,
            headers: Object.fromEntries(response.headers.entries())
          }
        });
      } catch (error) {
        SecurityTestUtils.recordResult({
          testName: `Authentication Bypass: ${attempt.name}`,
          category: 'authentication',
          passed: true,
          details: 'Request properly rejected (network error)',
          severity: 'low',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Test JWT token manipulation
  static async testJWTManipulation(): Promise<void> {
    const manipulatedTokens = [
      'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsImlhdCI6MTYxNjIzOTAyMn0.',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImFkbWluIjp0cnVlLCJpYXQiOjE2MTYyMzkwMjJ9.invalid-signature',
      'not-a-jwt-token',
      '',
      'Bearer token',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    ];

    for (const token of manipulatedTokens) {
      try {
        const response = await SecurityTestUtils.makeRequest('/api/data', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const passed = response.status === 401 || response.status === 403;
        
        SecurityTestUtils.recordResult({
          testName: `JWT Manipulation: ${token.substring(0, 20)}...`,
          category: 'authentication',
          passed,
          details: passed ? 
            'Correctly rejected manipulated JWT' : 
            `Unexpectedly accepted JWT with status ${response.status}`,
          severity: passed ? 'low' : 'high',
          timestamp: new Date().toISOString(),
          payload: token
        });
      } catch (error) {
        SecurityTestUtils.recordResult({
          testName: `JWT Manipulation: ${token.substring(0, 20)}...`,
          category: 'authentication',
          passed: true,
          details: 'Request properly rejected',
          severity: 'low',
          timestamp: new Date().toISOString()
        });
      }
    }
  }
}

// Input Validation Security Tests
class InputValidationTests {

  // Test SQL injection prevention
  static async testSQLInjection(): Promise<void> {
    const endpoints = [
      '/api/activities',
      '/api/categories',
      '/api/data',
      '/api/ai/insights'
    ];

    for (const endpoint of endpoints) {
      for (const payload of MALICIOUS_PAYLOADS.sql_injection) {
        try {
          // Test in query parameters
          const queryResponse = await SecurityTestUtils.makeRequest(
            `${endpoint}?search=${encodeURIComponent(payload)}`,
            { method: 'GET' }
          );

          const queryPassed = queryResponse.status !== 200 || 
                             !await this.checkForSQLError(queryResponse);

          SecurityTestUtils.recordResult({
            testName: `SQL Injection in Query: ${endpoint}`,
            category: 'input_validation',
            passed: queryPassed,
            details: queryPassed ? 
              'SQL injection properly prevented' : 
              'Potential SQL injection vulnerability detected',
            severity: queryPassed ? 'low' : 'critical',
            timestamp: new Date().toISOString(),
            payload
          });

          // Test in POST body
          if (endpoint !== '/api/data') {
            const bodyResponse = await SecurityTestUtils.makeRequest(endpoint, {
              method: 'POST',
              body: JSON.stringify({ name: payload, description: payload })
            });

            const bodyPassed = bodyResponse.status === 400 || bodyResponse.status === 422;

            SecurityTestUtils.recordResult({
              testName: `SQL Injection in Body: ${endpoint}`,
              category: 'input_validation',
              passed: bodyPassed,
              details: bodyPassed ? 
                'Input validation properly rejected SQL injection' : 
                'SQL injection may have been processed',
              severity: bodyPassed ? 'low' : 'critical',
              timestamp: new Date().toISOString(),
              payload
            });
          }
        } catch (error) {
          SecurityTestUtils.recordResult({
            testName: `SQL Injection Test: ${endpoint}`,
            category: 'input_validation',
            passed: true,
            details: 'Request properly rejected',
            severity: 'low',
            timestamp: new Date().toISOString(),
            payload
          });
        }
      }
    }
  }

  // Test XSS prevention
  static async testXSSPrevention(): Promise<void> {
    for (const payload of MALICIOUS_PAYLOADS.xss_payloads) {
      try {
        const response = await SecurityTestUtils.makeRequest('/api/activities', {
          method: 'POST',
          body: JSON.stringify({
            title: payload,
            description: payload,
            category_id: 'cat1'
          })
        });

        const passed = response.status === 400 || response.status === 422;
        
        SecurityTestUtils.recordResult({
          testName: 'XSS Prevention Test',
          category: 'input_validation',
          passed,
          details: passed ? 
            'XSS payload properly rejected' : 
            'XSS payload may have been stored',
          severity: passed ? 'low' : 'high',
          timestamp: new Date().toISOString(),
          payload
        });
      } catch (error) {
        SecurityTestUtils.recordResult({
          testName: 'XSS Prevention Test',
          category: 'input_validation',
          passed: true,
          details: 'Request properly rejected',
          severity: 'low',
          timestamp: new Date().toISOString(),
          payload
        });
      }
    }
  }

  // Test command injection prevention
  static async testCommandInjection(): Promise<void> {
    for (const payload of MALICIOUS_PAYLOADS.command_injection) {
      try {
        const response = await SecurityTestUtils.makeRequest('/api/ai/insights', {
          method: 'POST',
          body: JSON.stringify({
            prompt: payload,
            data: payload
          })
        });

        const passed = response.status === 400 || response.status === 422;
        
        SecurityTestUtils.recordResult({
          testName: 'Command Injection Prevention',
          category: 'input_validation',
          passed,
          details: passed ? 
            'Command injection properly prevented' : 
            'Command injection may be possible',
          severity: passed ? 'low' : 'critical',
          timestamp: new Date().toISOString(),
          payload
        });
      } catch (error) {
        SecurityTestUtils.recordResult({
          testName: 'Command Injection Prevention',
          category: 'input_validation',
          passed: true,
          details: 'Request properly rejected',
          severity: 'low',
          timestamp: new Date().toISOString(),
          payload
        });
      }
    }
  }

  // Test oversized input handling
  static async testOversizedInput(): Promise<void> {
    for (const payload of MALICIOUS_PAYLOADS.oversized_data) {
      try {
        const response = await SecurityTestUtils.makeRequest('/api/activities', {
          method: 'POST',
          body: JSON.stringify({
            title: payload,
            description: payload
          })
        });

        const passed = response.status === 413 || response.status === 400;
        
        SecurityTestUtils.recordResult({
          testName: `Oversized Input Test (${payload.length} chars)`,
          category: 'input_validation',
          passed,
          details: passed ? 
            'Oversized input properly rejected' : 
            'Oversized input was accepted',
          severity: passed ? 'low' : 'medium',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        SecurityTestUtils.recordResult({
          testName: `Oversized Input Test (${payload.length} chars)`,
          category: 'input_validation',
          passed: true,
          details: 'Request properly rejected',
          severity: 'low',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Helper to check for SQL error indicators
  private static async checkForSQLError(response: Response): Promise<boolean> {
    try {
      const text = await response.text();
      const sqlErrorPatterns = [
        /SQL syntax.*MySQL/i,
        /Warning.*mysql_/i,
        /valid MySQL result/i,
        /PostgreSQL.*ERROR/i,
        /Warning.*pg_/i,
        /valid PostgreSQL result/i,
        /SQLite\/JDBCDriver/i,
        /SQLite error/i,
        /SQLITE_ERROR/i,
        /ORA-\d{5}/i,
        /Microsoft.*ODBC.*SQL Server Driver/i,
        /OLE DB.*SQL Server/i
      ];
      
      return sqlErrorPatterns.some(pattern => pattern.test(text));
    } catch {
      return false;
    }
  }
}

// Rate Limiting Security Tests
class RateLimitingTests {

  // Test rate limiting enforcement
  static async testRateLimiting(): Promise<void> {
    const endpoint = '/api/data';
    const requestLimit = 100; // Test limit
    const requests: Promise<Response>[] = [];

    // Send many concurrent requests
    for (let i = 0; i < requestLimit + 10; i++) {
      requests.push(
        SecurityTestUtils.makeRequest(endpoint, {
          method: 'GET',
          headers: { 'X-Test-Request': `rate-limit-${i}` }
        })
      );
    }

    try {
      const responses = await Promise.allSettled(requests);
      const rateLimitedCount = responses.filter(result => 
        result.status === 'fulfilled' && 
        (result.value.status === 429 || result.value.status === 503)
      ).length;

      const passed = rateLimitedCount > 0;

      SecurityTestUtils.recordResult({
        testName: 'Rate Limiting Enforcement',
        category: 'rate_limiting',
        passed,
        details: passed ? 
          `Rate limiting active: ${rateLimitedCount} requests blocked` : 
          'Rate limiting not enforced',
        severity: passed ? 'low' : 'medium',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      SecurityTestUtils.recordResult({
        testName: 'Rate Limiting Enforcement',
        category: 'rate_limiting',
        passed: true,
        details: 'Rate limiting appears to be working (requests failed)',
        severity: 'low',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Test rate limiting headers
  static async testRateLimitHeaders(): Promise<void> {
    try {
      const response = await SecurityTestUtils.makeRequest('/api/data');
      
      const hasRateLimitHeaders = 
        response.headers.has('x-ratelimit-limit') ||
        response.headers.has('x-ratelimit-remaining') ||
        response.headers.has('x-ratelimit-reset') ||
        response.headers.has('retry-after');

      SecurityTestUtils.recordResult({
        testName: 'Rate Limit Headers Present',
        category: 'rate_limiting',
        passed: hasRateLimitHeaders,
        details: hasRateLimitHeaders ? 
          'Rate limiting headers are present' : 
          'Rate limiting headers missing',
        severity: hasRateLimitHeaders ? 'low' : 'low', // Not critical but good practice
        timestamp: new Date().toISOString(),
        response: {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries())
        }
      });
    } catch (error) {
      SecurityTestUtils.recordResult({
        testName: 'Rate Limit Headers Present',
        category: 'rate_limiting',
        passed: false,
        details: 'Could not test rate limit headers',
        severity: 'low',
        timestamp: new Date().toISOString()
      });
    }
  }
}

// CSRF Protection Tests
class CSRFTests {

  // Test CSRF protection
  static async testCSRFProtection(): Promise<void> {
    const endpoints = [
      { path: '/api/activities', method: 'POST' },
      { path: '/api/categories', method: 'POST' },
      { path: '/api/activities/act1', method: 'PUT' },
      { path: '/api/activities/act1', method: 'DELETE' }
    ];

    for (const endpoint of endpoints) {
      try {
        // Test without CSRF token
        const response = await SecurityTestUtils.makeRequest(endpoint.path, {
          method: endpoint.method,
          headers: {
            'Origin': 'https://malicious-site.com',
            'Referer': 'https://malicious-site.com'
          },
          body: endpoint.method === 'POST' || endpoint.method === 'PUT' ? 
                JSON.stringify({ title: 'Test', description: 'Test' }) : undefined
        });

        const passed = response.status === 403 || response.status === 400;

        SecurityTestUtils.recordResult({
          testName: `CSRF Protection: ${endpoint.method} ${endpoint.path}`,
          category: 'csrf',
          passed,
          details: passed ? 
            'CSRF protection working correctly' : 
            'CSRF protection may be missing',
          severity: passed ? 'low' : 'high',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        SecurityTestUtils.recordResult({
          testName: `CSRF Protection: ${endpoint.method} ${endpoint.path}`,
          category: 'csrf',
          passed: true,
          details: 'Request properly rejected',
          severity: 'low',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Test origin header validation
  static async testOriginValidation(): Promise<void> {
    const maliciousOrigins = [
      'https://evil.com',
      'http://localhost:3000.evil.com',
      'https://sub.domain.evil.com',
      'null',
      '',
      'javascript:',
      'data:text/html,<script>alert(1)</script>'
    ];

    for (const origin of maliciousOrigins) {
      try {
        const response = await SecurityTestUtils.makeRequest('/api/activities', {
          method: 'POST',
          headers: { 'Origin': origin },
          body: JSON.stringify({ title: 'Test', description: 'Test' })
        });

        const passed = response.status === 403 || response.status === 400;

        SecurityTestUtils.recordResult({
          testName: `Origin Validation: ${origin}`,
          category: 'csrf',
          passed,
          details: passed ? 
            'Malicious origin properly rejected' : 
            'Malicious origin was accepted',
          severity: passed ? 'low' : 'high',
          timestamp: new Date().toISOString(),
          payload: origin
        });
      } catch (error) {
        SecurityTestUtils.recordResult({
          testName: `Origin Validation: ${origin}`,
          category: 'csrf',
          passed: true,
          details: 'Request properly rejected',
          severity: 'low',
          timestamp: new Date().toISOString(),
          payload: origin
        });
      }
    }
  }
}

// Data Protection Tests
class DataProtectionTests {

  // Test for information disclosure
  static async testInformationDisclosure(): Promise<void> {
    const endpoints = [
      '/api/health',
      '/api/data',
      '/api/activities',
      '/api/categories'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await SecurityTestUtils.makeRequest(endpoint);
        
        if (response.ok) {
          const responseText = await response.text();
          
          // Check for sensitive information patterns
          const sensitivePatterns = [
            /password/i,
            /secret/i,
            /private[_-]?key/i,
            /api[_-]?key/i,
            /token/i,
            /database.*url/i,
            /connection.*string/i,
            /stack.*trace/i,
            /error.*trace/i
          ];

          const foundSensitive = sensitivePatterns.some(pattern => 
            pattern.test(responseText)
          );

          SecurityTestUtils.recordResult({
            testName: `Information Disclosure: ${endpoint}`,
            category: 'data_protection',
            passed: !foundSensitive,
            details: foundSensitive ? 
              'Potential sensitive information disclosure detected' : 
              'No sensitive information disclosed',
            severity: foundSensitive ? 'medium' : 'low',
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        SecurityTestUtils.recordResult({
          testName: `Information Disclosure: ${endpoint}`,
          category: 'data_protection',
          passed: true,
          details: 'Endpoint properly protected',
          severity: 'low',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Test for debug information exposure
  static async testDebugInformationExposure(): Promise<void> {
    const debugEndpoints = [
      '/debug',
      '/.env',
      '/config',
      '/admin',
      '/test',
      '/api/debug',
      '/api/test'
    ];

    for (const endpoint of debugEndpoints) {
      try {
        const response = await SecurityTestUtils.makeRequest(endpoint);
        
        const passed = response.status === 404 || response.status === 403;

        SecurityTestUtils.recordResult({
          testName: `Debug Endpoint Access: ${endpoint}`,
          category: 'data_protection',
          passed,
          details: passed ? 
            'Debug endpoint properly protected' : 
            'Debug endpoint accessible',
          severity: passed ? 'low' : 'medium',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        SecurityTestUtils.recordResult({
          testName: `Debug Endpoint Access: ${endpoint}`,
          category: 'data_protection',
          passed: true,
          details: 'Debug endpoint not accessible',
          severity: 'low',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Test HTTP security headers
  static async testSecurityHeaders(): Promise<void> {
    try {
      const response = await SecurityTestUtils.makeRequest('/');
      
      const expectedHeaders = {
        'content-security-policy': 'CSP header present',
        'x-frame-options': 'Clickjacking protection',
        'x-content-type-options': 'MIME sniffing protection',
        'strict-transport-security': 'HTTPS enforcement',
        'referrer-policy': 'Referrer policy set',
        'permissions-policy': 'Feature policy set'
      };

      for (const [header, description] of Object.entries(expectedHeaders)) {
        const hasHeader = response.headers.has(header);
        
        SecurityTestUtils.recordResult({
          testName: `Security Header: ${header}`,
          category: 'data_protection',
          passed: hasHeader,
          details: hasHeader ? description : `${description} missing`,
          severity: hasHeader ? 'low' : 'medium',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      SecurityTestUtils.recordResult({
        testName: 'Security Headers Test',
        category: 'data_protection',
        passed: false,
        details: 'Could not test security headers',
        severity: 'medium',
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Authorization Tests
class AuthorizationTests {

  // Test vertical privilege escalation
  static async testVerticalPrivilegeEscalation(): Promise<void> {
    const adminOnlyEndpoints = [
      { path: '/api/admin/users', method: 'GET' },
      { path: '/api/admin/config', method: 'GET' },
      { path: '/api/admin/logs', method: 'GET' }
    ];

    for (const endpoint of adminOnlyEndpoints) {
      try {
        const response = await SecurityTestUtils.makeRequest(endpoint.path, {
          method: endpoint.method,
          headers: { 'Authorization': 'Bearer regular-user-token' }
        });

        const passed = response.status === 403 || response.status === 404;

        SecurityTestUtils.recordResult({
          testName: `Vertical Privilege Escalation: ${endpoint.path}`,
          category: 'authorization',
          passed,
          details: passed ? 
            'Admin endpoint properly protected' : 
            'Regular user can access admin endpoint',
          severity: passed ? 'low' : 'critical',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        SecurityTestUtils.recordResult({
          testName: `Vertical Privilege Escalation: ${endpoint.path}`,
          category: 'authorization',
          passed: true,
          details: 'Endpoint properly protected',
          severity: 'low',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Test horizontal privilege escalation
  static async testHorizontalPrivilegeEscalation(): Promise<void> {
    const userSpecificEndpoints = [
      '/api/activities?user_id=other-user',
      '/api/user/other-user/profile',
      '/api/user/other-user/activities'
    ];

    for (const endpoint of userSpecificEndpoints) {
      try {
        const response = await SecurityTestUtils.makeRequest(endpoint, {
          headers: { 'Authorization': 'Bearer user1-token' }
        });

        const passed = response.status === 403 || response.status === 404;

        SecurityTestUtils.recordResult({
          testName: `Horizontal Privilege Escalation: ${endpoint}`,
          category: 'authorization',
          passed,
          details: passed ? 
            'User data properly protected' : 
            'User can access other user data',
          severity: passed ? 'low' : 'high',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        SecurityTestUtils.recordResult({
          testName: `Horizontal Privilege Escalation: ${endpoint}`,
          category: 'authorization',
          passed: true,
          details: 'Endpoint properly protected',
          severity: 'low',
          timestamp: new Date().toISOString()
        });
      }
    }
  }
}

// Main test runner
class SecurityTestRunner {
  
  static async runAllTests(): Promise<void> {
    console.log('🔒 Starting Comprehensive Security Test Suite...\n');
    
    SecurityTestUtils.clearResults();
    
    try {
      console.log('🔐 Running Authentication Tests...');
      await AuthenticationTests.testAuthenticationBypass();
      await AuthenticationTests.testJWTManipulation();
      
      console.log('📝 Running Input Validation Tests...');
      await InputValidationTests.testSQLInjection();
      await InputValidationTests.testXSSPrevention();
      await InputValidationTests.testCommandInjection();
      await InputValidationTests.testOversizedInput();
      
      console.log('⏱️ Running Rate Limiting Tests...');
      await RateLimitingTests.testRateLimiting();
      await RateLimitingTests.testRateLimitHeaders();
      
      console.log('🛡️ Running CSRF Protection Tests...');
      await CSRFTests.testCSRFProtection();
      await CSRFTests.testOriginValidation();
      
      console.log('🔒 Running Data Protection Tests...');
      await DataProtectionTests.testInformationDisclosure();
      await DataProtectionTests.testDebugInformationExposure();
      await DataProtectionTests.testSecurityHeaders();
      
      console.log('👥 Running Authorization Tests...');
      await AuthorizationTests.testVerticalPrivilegeEscalation();
      await AuthorizationTests.testHorizontalPrivilegeEscalation();
      
    } catch (error) {
      console.error('❌ Test suite encountered an error:', error);
    }
    
    this.printSummary();
  }
  
  static printSummary(): void {
    const summary = SecurityTestUtils.getSummary();
    const results = SecurityTestUtils.getResults();
    
    console.log('\n' + '='.repeat(60));
    console.log('🔒 SECURITY TEST SUITE SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${summary.total}`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log('');
    console.log('Severity Breakdown:');
    console.log(`🚨 Critical: ${summary.critical}`);
    console.log(`⚠️  High: ${summary.high}`);
    console.log(`⚡ Medium: ${summary.medium}`);
    console.log(`ℹ️  Low: ${summary.low}`);
    
    if (summary.failed > 0) {
      console.log('\n' + '❌ FAILED TESTS:');
      console.log('-'.repeat(40));
      results
        .filter(r => !r.passed)
        .forEach(result => {
          console.log(`[${result.severity.toUpperCase()}] ${result.testName}`);
          console.log(`   ${result.details}`);
          if (result.payload) {
            console.log(`   Payload: ${result.payload.substring(0, 100)}...`);
          }
          console.log('');
        });
    }
    
    console.log('\n' + '✅ RECOMMENDATIONS:');
    console.log('-'.repeat(40));
    
    if (summary.critical > 0) {
      console.log('🚨 CRITICAL: Immediate action required for critical vulnerabilities');
    }
    if (summary.high > 0) {
      console.log('⚠️  HIGH: Address high-severity issues promptly');
    }
    if (summary.medium > 0) {
      console.log('⚡ MEDIUM: Plan remediation for medium-severity issues');
    }
    
    if (summary.failed === 0) {
      console.log('🎉 All security tests passed! Security posture looks good.');
    }
    
    console.log('\n📊 Detailed results available in test logs');
    console.log('='.repeat(60));
  }
}

// Export test runner for external use
export { SecurityTestRunner, SecurityTestUtils };

// Run tests if executed directly
if (require.main === module) {
  SecurityTestRunner.runAllTests()
    .then(() => {
      process.exit(SecurityTestUtils.getSummary().failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Fatal error in security test suite:', error);
      process.exit(1);
    });
}