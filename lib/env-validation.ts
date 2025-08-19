import { z } from 'zod';

// Environment variable validation schema
const envSchema = z.object({
  // Node.js environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Database configuration
  DATABASE_URL: z.string().optional(), // For PostgreSQL in production
  
  // Database connection pool settings
  DATABASE_CONNECTION_POOL_SIZE: z.string().transform(val => Math.max(1, Math.min(20, parseInt(val) || 5))).optional(),
  DATABASE_CONNECTION_TIMEOUT: z.string().transform(val => Math.max(5000, Math.min(60000, parseInt(val) || 10000))).optional(),
  DATABASE_POOL_TIMEOUT: z.string().transform(val => Math.max(10000, Math.min(120000, parseInt(val) || 20000))).optional(),
  DATABASE_IDLE_TIMEOUT: z.string().transform(val => Math.max(10000, Math.min(300000, parseInt(val) || 30000))).optional(),
  DATABASE_QUERY_TIMEOUT: z.string().transform(val => Math.max(5000, Math.min(60000, parseInt(val) || 15000))).optional(),
  DATABASE_MAX_CONNECTION_AGE: z.string().transform(val => Math.max(60000, Math.min(3600000, parseInt(val) || 300000))).optional(),
  DATABASE_ENABLE_QUERY_LOGGING: z.string().transform(val => val === 'true').optional(),
  DATABASE_LOG_SLOW_QUERIES_MS: z.string().transform(val => Math.max(100, Math.min(30000, parseInt(val) || 2000))).optional(),
  
  // Database SSL configuration (for production)
  DATABASE_SSL_CERT: z.string().optional(),
  DATABASE_SSL_KEY: z.string().optional(),
  DATABASE_SSL_ROOT_CERT: z.string().optional(),
  
  // AI Provider API Keys (at least one is required for AI functionality)
  GEMINI_API_KEY: z.string().optional(),
  CLAUDE_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  KIMI_API_KEY: z.string().optional(),
  
  // Redis configuration for rate limiting (optional, fallback to in-memory)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  
  // Vercel/Deployment configuration
  VERCEL_URL: z.string().optional(),
  VERCEL_ENV: z.string().optional(),
  
  // Security configuration
  NEXTAUTH_SECRET: z.string().optional(), // For future authentication implementation
  NEXTAUTH_URL: z.string().url().optional(),
  
  // Application configuration
  APP_URL: z.string().url().optional(),
  
  // Monitoring and logging
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
}).superRefine((env, ctx) => {
  // Custom validation: At least one AI provider API key is required
  const aiKeys = [env.GEMINI_API_KEY, env.CLAUDE_API_KEY, env.DEEPSEEK_API_KEY, env.KIMI_API_KEY];
  const hasAtLeastOneAiKey = aiKeys.some(key => key && key.length > 0 && key !== 'PLACEHOLDER_API_KEY');
  
  if (!hasAtLeastOneAiKey) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one AI provider API key is required (GEMINI_API_KEY, CLAUDE_API_KEY, DEEPSEEK_API_KEY, or KIMI_API_KEY)',
      path: ['AI_PROVIDERS'],
    });
  }
  
  // Validate Redis configuration: if URL is provided, token must also be provided
  if (env.UPSTASH_REDIS_REST_URL && !env.UPSTASH_REDIS_REST_TOKEN) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'UPSTASH_REDIS_REST_TOKEN is required when UPSTASH_REDIS_REST_URL is provided',
      path: ['UPSTASH_REDIS_REST_TOKEN'],
    });
  }
  
  // Production-specific validations
  if (env.NODE_ENV === 'production') {
    // In production, recommend using PostgreSQL instead of SQLite
    if (!env.DATABASE_URL) {
      console.warn('⚠️  WARNING: No DATABASE_URL provided. Using SQLite which is not recommended for production.');
    }
    
    // Validate that placeholder API keys are not used in production
    const placeholderKeys = aiKeys.filter(key => key === 'PLACEHOLDER_API_KEY');
    if (placeholderKeys.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Placeholder API keys detected in production environment. Please provide real API keys.',
        path: ['AI_PROVIDERS'],
      });
    }
  }
});

// Type for validated environment variables
export type ValidatedEnv = z.infer<typeof envSchema>;

// Validate environment variables at startup
function validateEnv(): ValidatedEnv {
  try {
    const parsed = envSchema.parse(process.env);
    
    // Log successful validation in development
    if (parsed.NODE_ENV === 'development') {
      console.log('✅ Environment variables validated successfully');
      
      // Log which AI providers are available
      const availableProviders = [];
      if (parsed.GEMINI_API_KEY && parsed.GEMINI_API_KEY !== 'PLACEHOLDER_API_KEY') availableProviders.push('Gemini');
      if (parsed.CLAUDE_API_KEY && parsed.CLAUDE_API_KEY !== 'PLACEHOLDER_API_KEY') availableProviders.push('Claude');
      if (parsed.DEEPSEEK_API_KEY && parsed.DEEPSEEK_API_KEY !== 'PLACEHOLDER_API_KEY') availableProviders.push('DeepSeek');
      if (parsed.KIMI_API_KEY && parsed.KIMI_API_KEY !== 'PLACEHOLDER_API_KEY') availableProviders.push('Kimi');
      
      if (availableProviders.length > 0) {
        console.log(`🤖 AI Providers available: ${availableProviders.join(', ')}`);
      }
      
      // Log Redis configuration status
      if (parsed.UPSTASH_REDIS_REST_URL && parsed.UPSTASH_REDIS_REST_TOKEN) {
        console.log('🗄️  Redis rate limiting configured');
      } else {
        console.log('📝 Using in-memory rate limiting (Redis not configured)');
      }
    }
    
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment variable validation failed:');
      
      // Group errors by type for better readability
      const missingVars: string[] = [];
      const invalidVars: string[] = [];
      const customErrors: string[] = [];
      
      error.issues.forEach((err) => {
        const field = err.path.join('.');
        
        if (err.code === 'invalid_type' && 'received' in err && err.received === 'undefined') {
          missingVars.push(`${field}: ${err.message}`);
        } else if (err.code === 'custom') {
          customErrors.push(err.message);
        } else {
          invalidVars.push(`${field}: ${err.message}`);
        }
      });
      
      if (missingVars.length > 0) {
        console.error('\n📋 Missing required variables:');
        missingVars.forEach(msg => console.error(`  - ${msg}`));
      }
      
      if (invalidVars.length > 0) {
        console.error('\n⚠️  Invalid variable formats:');
        invalidVars.forEach(msg => console.error(`  - ${msg}`));
      }
      
      if (customErrors.length > 0) {
        console.error('\n🔧 Configuration errors:');
        customErrors.forEach(msg => console.error(`  - ${msg}`));
      }
      
      console.error('\n💡 Tips:');
      console.error('  - Copy .env.local.example to .env.local and fill in the values');
      console.error('  - Ensure at least one AI provider API key is configured');
      console.error('  - Use real API keys, not placeholder values');
      
      // In development, provide helpful setup instructions
      if (process.env.NODE_ENV !== 'production') {
        console.error('\n🚀 Quick setup for development:');
        console.error('  1. Get a free API key from https://aistudio.google.com/app/apikey (Gemini)');
        console.error('  2. Add GEMINI_API_KEY=your_key_here to .env.local');
        console.error('  3. Restart the development server');
      }
      
      throw new Error('Environment variable validation failed. Please check the configuration above.');
    }
    
    console.error('❌ Unexpected error during environment validation:', error);
    throw new Error('Unexpected error during environment validation');
  }
}

// Validate and export environment variables
export const env = validateEnv();

// Helper functions for checking specific configurations
export const envHelpers = {
  // Check if running in production
  isProduction: () => env.NODE_ENV === 'production',
  
  // Check if running in development
  isDevelopment: () => env.NODE_ENV === 'development',
  
  // Check if Redis is configured for rate limiting
  hasRedis: () => !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
  
  // Get available AI provider keys (excluding placeholders)
  getAvailableAiProviders: () => {
    const providers: string[] = [];
    if (env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'PLACEHOLDER_API_KEY') providers.push('gemini');
    if (env.CLAUDE_API_KEY && env.CLAUDE_API_KEY !== 'PLACEHOLDER_API_KEY') providers.push('claude');
    if (env.DEEPSEEK_API_KEY && env.DEEPSEEK_API_KEY !== 'PLACEHOLDER_API_KEY') providers.push('deepseek');
    if (env.KIMI_API_KEY && env.KIMI_API_KEY !== 'PLACEHOLDER_API_KEY') providers.push('kimi');
    return providers;
  },
  
  // Get the application base URL
  getAppUrl: () => {
    if (env.APP_URL) return env.APP_URL;
    if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
    if (env.NODE_ENV === 'development') return 'http://localhost:3000';
    return undefined;
  },
  
  // Check if authentication is configured
  hasAuth: () => !!(env.NEXTAUTH_SECRET && env.NEXTAUTH_URL),
  
  // Check if monitoring is configured
  hasMonitoring: () => !!env.SENTRY_DSN,
};