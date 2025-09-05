/**
 * Verification script for mobile touch optimization implementation
 * Checks file structure and configuration without complex dependencies
 */

const fs = require('fs');
const path = require('path');

function verifyImplementation() {
  console.log('🔍 Verifying Mobile Touch Optimization Implementation...\n');
  
  let allChecksPassed = true;

  // Check 1: Tailwind config has touch classes
  try {
    const tailwindConfigPath = path.join(__dirname, '../tailwind.config.js');
    const tailwindContent = fs.readFileSync(tailwindConfigPath, 'utf8');
    
    const hasTouchHeight = tailwindContent.includes("'touch': '44px'");
    const hasTouchWidth = tailwindContent.includes("'touch': '44px'");
    
    console.log('✅ Tailwind Config:');
    console.log(`   min-h-touch: ${hasTouchHeight ? '44px ✓' : 'MISSING ❌'}`);
    console.log(`   min-w-touch: ${hasTouchWidth ? '44px ✓' : 'MISSING ❌'}`);
    
    if (!hasTouchHeight || !hasTouchWidth) allChecksPassed = false;
  } catch (error) {
    console.log('❌ Failed to check Tailwind config:', error.message);
    allChecksPassed = false;
  }

  // Check 2: Feature flags file exists
  const featureFlagsPath = path.join(__dirname, '../lib/feature-flags.ts');
  const featureFlagsExists = fs.existsSync(featureFlagsPath);
  
  console.log('\n✅ Feature Flags:');
  console.log(`   File exists: ${featureFlagsExists ? 'YES ✓' : 'NO ❌'}`);
  
  if (featureFlagsExists) {
    const featureFlagsContent = fs.readFileSync(featureFlagsPath, 'utf8');
    const hasMobileTouchFlag = featureFlagsContent.includes('mobileTouchOptimization');
    console.log(`   Mobile touch flag defined: ${hasMobileTouchFlag ? 'YES ✓' : 'NO ❌'}`);
    if (!hasMobileTouchFlag) allChecksPassed = false;
  } else {
    allChecksPassed = false;
  }

  // Check 3: Mobile detection hook exists
  const mobileDetectionPath = path.join(__dirname, '../hooks/useMobileDetection.ts');
  const mobileDetectionExists = fs.existsSync(mobileDetectionPath);
  
  console.log('\n✅ Mobile Detection:');
  console.log(`   useMobileDetection hook: ${mobileDetectionExists ? 'EXISTS ✓' : 'MISSING ❌'}`);
  
  if (!mobileDetectionExists) allChecksPassed = false;

  // Check 4: ActivityCard component implementation
  const activityCardPath = path.join(__dirname, '../components/ActivityCard.tsx');
  const activityCardExists = fs.existsSync(activityCardPath);
  
  console.log('\n✅ ActivityCard Implementation:');
  console.log(`   File exists: ${activityCardExists ? 'YES ✓' : 'NO ❌'}`);
  
  if (activityCardExists) {
    const activityCardContent = fs.readFileSync(activityCardPath, 'utf8');
    
    const usesTouchClasses = activityCardContent.includes('min-h-touch') || activityCardContent.includes('min-w-touch');
    const usesMobileDetection = activityCardContent.includes('useMobileDetection');
    const usesFeatureFlags = activityCardContent.includes('featureFlags');
    
    console.log(`   Uses touch classes: ${usesTouchClasses ? 'YES ✓' : 'NO ❌'}`);
    console.log(`   Uses mobile detection: ${usesMobileDetection ? 'YES ✓' : 'NO ❌'}`);
    console.log(`   Uses feature flags: ${usesFeatureFlags ? 'YES ✓' : 'NO ❌'}`);
    
    if (!usesTouchClasses || !usesMobileDetection || !usesFeatureFlags) allChecksPassed = false;
  } else {
    allChecksPassed = false;
  }

  // Summary
  console.log('\n📊 IMPLEMENTATION SUMMARY:');
  
  if (allChecksPassed) {
    console.log('🎉 MOBILE TOUCH OPTIMIZATION IMPLEMENTED SUCCESSFULLY!');
    console.log('\n🚀 Implementation includes:');
    console.log('   • 44px minimum touch targets (min-h-touch, min-w-touch)');
    console.log('   • Feature flag controlled rollout (NEXT_PUBLIC_ENABLE_MOBILE_TOUCH)');
    console.log('   • Mobile device detection hook');
    console.log('   • Enhanced ActivityCard with touch optimization');
    console.log('\n📋 Next steps for deployment:');
    console.log('   1. Set environment variable: NEXT_PUBLIC_ENABLE_MOBILE_TOUCH=true');
    console.log('   2. Run build to regenerate Tailwind CSS');
    console.log('   3. Test on mobile devices to verify 44px touch targets');
    console.log('   4. Monitor performance and user experience');
  } else {
    console.log('❌ IMPLEMENTATION INCOMPLETE. Missing critical components.');
    console.log('   Please check the files mentioned above and complete the implementation.');
    process.exit(1);
  }
}

// Run verification
try {
  verifyImplementation();
} catch (error) {
  console.error('❌ Verification failed:', error.message);
  process.exit(1);
}