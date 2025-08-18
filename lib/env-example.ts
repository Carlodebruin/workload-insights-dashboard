// Example usage of environment validation
// Import this at the top of your main application files

import { env, envHelpers } from './env-validation';

// Example usage in an API route
export function exampleApiUsage() {
  // Access validated environment variables
  const isProduction = envHelpers.isProduction();
  const availableProviders = envHelpers.getAvailableAiProviders();
  const hasRedis = envHelpers.hasRedis();
  
  console.log('Environment configuration:');
  console.log('- Production mode:', isProduction);
  console.log('- AI providers:', availableProviders);
  console.log('- Redis configured:', hasRedis);
  
  // Use specific environment variables with type safety
  if (env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'PLACEHOLDER_API_KEY') {
    console.log('✅ Gemini API configured');
  }
  
  // Get application URL with fallbacks
  const appUrl = envHelpers.getAppUrl();
  console.log('- App URL:', appUrl);
}

// Example usage in a provider factory
export function createAiProviderExample() {
  const providers = envHelpers.getAvailableAiProviders();
  
  if (providers.length === 0) {
    throw new Error('No AI providers configured. Please set up at least one API key.');
  }
  
  // Use the first available provider
  const primaryProvider = providers[0];
  console.log(`Using primary AI provider: ${primaryProvider}`);
  
  return primaryProvider;
}

// Example usage in database connection
export function getDatabaseConfigExample() {
  if (env.DATABASE_URL) {
    console.log('✅ Using PostgreSQL database');
    return { url: env.DATABASE_URL, provider: 'postgresql' };
  } else {
    console.log('📝 Using SQLite database (development)');
    return { url: 'file:./dev.db', provider: 'sqlite' };
  }
}