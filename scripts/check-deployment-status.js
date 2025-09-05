#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔍 Checking Vercel Deployment Status...\n');

try {
  // Check if we're in a Vercel project
  const projectInfo = execSync('vercel ls --meta', { encoding: 'utf8' });
  console.log('✅ Vercel project detected');
  
  // Get latest deployment
  const deployments = execSync('vercel ls --limit 1', { encoding: 'utf8' });
  const lines = deployments.trim().split('\n');
  
  if (lines.length > 1) {
    const latestDeployment = lines[1]; // First line is header
    const [name, url, state, , , created] = latestDeployment.split(/\s+/);
    
    console.log('📋 Latest Deployment:');
    console.log(`   • Name: ${name}`);
    console.log(`   • URL: ${url}`);
    console.log(`   • State: ${state}`);
    console.log(`   • Created: ${created}`);
    
    if (state === 'READY') {
      console.log('\n🎉 Deployment is ready and live!');
      console.log(`🌐 Open in browser: ${url}`);
    } else {
      console.log('\n⏳ Deployment is still processing...');
    }
  } else {
    console.log('ℹ️  No deployments found');
  }
  
} catch (error) {
  console.log('❌ Error checking deployment status:', error.message);
  console.log('ℹ️  The deployment might still be in progress');
}

console.log('\n💡 Tip: You can also check deployment status at:');
console.log('   https://vercel.com/carloredebruin-6877/workload-insights-dashboard');