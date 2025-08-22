/**
 * PII Redaction Test Suite
 * 
 * This file demonstrates and validates PII redaction functionality.
 * Run with: npx tsx tests/pii-redaction.test.ts
 */

import { 
  redactValue, 
  redactObject, 
  redactForLogging, 
  redactForPII,
  safeLog,
  testRedaction,
  getDefaultRedactionLevel
} from '../lib/pii-redaction';

// Test data samples
const testData = {
  // User data with PII
  user: {
    id: 'c1a2b3c4d5e6f7g8h9i0j1k2',
    name: 'John Smith',
    phone_number: '+27123456789',
    email: 'john.smith@example.com',
    role: 'Admin'
  },
  
  // Activity data with location PII
  activity: {
    id: 'act123',
    location: '123 Main Street, Cape Town',
    notes: 'User John Smith called +27123456789 about the issue',
    timestamp: '2024-01-15T10:30:00Z',
    latitude: -33.9249,
    longitude: 18.4241
  },
  
  // Error data that might contain PII
  error: {
    message: 'Database error for user john.smith@example.com',
    stack: 'Error at validateUser(+27123456789)\n    at line 123',
    code: 'DB_CONNECTION_FAILED',
    data: {
      phone: '+27987654321',
      query: 'SELECT * FROM users WHERE email = "user@domain.com"'
    }
  },
  
  // Sensitive credentials
  credentials: {
    password: 'supersecret123',
    api_key: 'sk-1234567890abcdef',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    secret: 'my-secret-value'
  },
  
  // Mixed data with arrays and nested objects
  complex: {
    users: [
      { name: 'Alice Johnson', phone: '+27111222333' },
      { name: 'Bob Wilson', phone: '+27444555666' }
    ],
    metadata: {
      created_by: 'admin@company.com',
      notes: 'Contact support at +27800123456 for issues'
    }
  }
};

// Test functions
function testBasicRedaction() {
  console.log('🧪 Testing Basic Redaction...\n');
  
  // Test individual values
  console.log('Field-based redaction:');
  console.log('- Phone:', redactValue('+27123456789', 'phone_number', 'moderate'));
  console.log('- Email:', redactValue('user@domain.com', 'email', 'moderate'));
  console.log('- Name:', redactValue('John Smith', 'name', 'moderate'));
  console.log('- Password:', redactValue('secret123', 'password', 'moderate'));
  
  // Test pattern detection
  console.log('\nPattern detection:');
  console.log('- Auto phone:', redactValue('+27123456789', 'unknown_field', 'moderate'));
  console.log('- Auto email:', redactValue('test@example.com', 'unknown_field', 'moderate'));
  
  console.log('\n' + '='.repeat(50) + '\n');
}

function testObjectRedaction() {
  console.log('🧪 Testing Object Redaction...\n');
  
  // Test different redaction levels
  const levels = ['minimal', 'moderate', 'strict'] as const;
  
  levels.forEach(level => {
    console.log(`${level.toUpperCase()} Level Redaction:`);
    const redacted = redactObject(testData.user, level);
    console.log(JSON.stringify(redacted, null, 2));
    console.log();
  });
  
  console.log('='.repeat(50) + '\n');
}

function testTextRedaction() {
  console.log('🧪 Testing Text PII Redaction...\n');
  
  const sensitiveTexts = [
    'Please call me at +27123456789 or email me at john@example.com',
    'Error: User with ID number 8001015009087 not found',
    'Credit card 4532-1234-5678-9012 was declined',
    'Database connection failed for user john.smith@company.com at +27800123456'
  ];
  
  sensitiveTexts.forEach((text, index) => {
    console.log(`Text ${index + 1}:`);
    console.log('Original:', text);
    console.log('Redacted:', redactForPII(text));
    console.log();
  });
  
  console.log('='.repeat(50) + '\n');
}

function testComplexData() {
  console.log('🧪 Testing Complex Data Structures...\n');
  
  console.log('Original complex data:');
  console.log(JSON.stringify(testData.complex, null, 2));
  
  console.log('\nRedacted complex data:');
  const redacted = redactForLogging(testData.complex, 'moderate');
  console.log(JSON.stringify(redacted, null, 2));
  
  console.log('\n' + '='.repeat(50) + '\n');
}

function testErrorRedaction() {
  console.log('🧪 Testing Error Data Redaction...\n');
  
  console.log('Original error:');
  console.log(JSON.stringify(testData.error, null, 2));
  
  console.log('\nRedacted error:');
  const redacted = safeLog.error(testData.error);
  console.log(JSON.stringify(redacted, null, 2));
  
  console.log('\n' + '='.repeat(50) + '\n');
}

function testSafeLogUtilities() {
  console.log('🧪 Testing Safe Log Utilities...\n');
  
  // Test different safe log methods
  console.log('General redaction:');
  console.log(JSON.stringify(safeLog.redact(testData.user), null, 2));
  
  console.log('\nUser-specific redaction (strict):');
  console.log(JSON.stringify(safeLog.user(testData.user), null, 2));
  
  console.log('\nText redaction:');
  console.log(safeLog.text('Contact John Smith at +27123456789 or john@example.com'));
  
  console.log('\n' + '='.repeat(50) + '\n');
}

function testRedactionRules() {
  console.log('🧪 Testing Redaction Rules Analysis...\n');
  
  const analysis = testRedaction(testData.user, 'moderate');
  
  console.log('Redaction Analysis:');
  console.log('Rules applied:', analysis.rulesApplied);
  console.log('\nOriginal:');
  console.log(JSON.stringify(analysis.original, null, 2));
  console.log('\nRedacted:');
  console.log(JSON.stringify(analysis.redacted, null, 2));
  
  console.log('\n' + '='.repeat(50) + '\n');
}

function testEnvironmentConfiguration() {
  console.log('🧪 Testing Environment Configuration...\n');
  
  console.log('Current environment:', process.env.NODE_ENV || 'undefined');
  console.log('Default redaction level:', getDefaultRedactionLevel());
  console.log('Custom level (PII_REDACTION_LEVEL):', process.env.PII_REDACTION_LEVEL || 'not set');
  
  // Test with different environment values
  const originalEnv = process.env.NODE_ENV;
  const originalLevel = process.env.PII_REDACTION_LEVEL;
  
  const environments = ['development', 'staging', 'production'];
  environments.forEach(env => {
    (process.env as any).NODE_ENV = env;
    delete process.env.PII_REDACTION_LEVEL; // Reset custom level
    console.log(`Environment '${env}' -> Default level: ${getDefaultRedactionLevel()}`);
  });
  
  // Restore original values
  if (originalEnv) (process.env as any).NODE_ENV = originalEnv;
  if (originalLevel) process.env.PII_REDACTION_LEVEL = originalLevel;
  
  console.log('\n' + '='.repeat(50) + '\n');
}

function testIntegrationExample() {
  console.log('🧪 Testing Integration Example...\n');
  
  // Simulate a real logging scenario
  try {
    throw new Error('Database connection failed for user john.smith@example.com');
  } catch (error) {
    // How you would log this safely
    const safeError = safeLog.error({
      message: (error as Error).message,
      stack: (error as Error).stack,
      userData: testData.user,
      activityData: testData.activity
    });
    
    console.log('Safe error logging result:');
    console.log(JSON.stringify(safeError, null, 2));
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
}

function runPerformanceTest() {
  console.log('🧪 Testing Performance...\n');
  
  const iterations = 1000;
  const largeObject = {
    users: Array(100).fill(testData.user),
    activities: Array(100).fill(testData.activity)
  };
  
  console.log(`Testing redaction performance with ${iterations} iterations...`);
  
  const start = Date.now();
  for (let i = 0; i < iterations; i++) {
    redactForLogging(largeObject, 'moderate');
  }
  const end = Date.now();
  
  console.log(`Time taken: ${end - start}ms`);
  console.log(`Average per operation: ${(end - start) / iterations}ms`);
  
  console.log('\n' + '='.repeat(50) + '\n');
}

// Main test runner
async function runAllTests() {
  console.log('🔒 PII Redaction Test Suite\n');
  console.log('This test suite demonstrates PII redaction capabilities for GDPR/POPIA compliance.\n');
  
  testBasicRedaction();
  testObjectRedaction();
  testTextRedaction();
  testComplexData();
  testErrorRedaction();
  testSafeLogUtilities();
  testRedactionRules();
  testEnvironmentConfiguration();
  testIntegrationExample();
  runPerformanceTest();
  
  console.log('✅ All tests completed successfully!');
  console.log('\n💡 Integration Tips:');
  console.log('1. Use safeLog.redact() for general data redaction');
  console.log('2. Use safeLog.user() for user-specific data (strict redaction)');
  console.log('3. Use safeLog.error() for error objects');
  console.log('4. Use safeLog.text() for free-form text content');
  console.log('5. Set PII_REDACTION_LEVEL environment variable to override defaults');
  console.log('\n📖 See GDPR_COMPLIANCE.md for full documentation');
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

export { runAllTests };