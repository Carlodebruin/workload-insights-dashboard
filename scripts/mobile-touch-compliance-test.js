#!/usr/bin/env node

/**
 * Mobile Touch Compliance Test Script
 * Tests 44px touch target compliance across the application
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// CSS classes that should have 44px minimum touch targets
const TOUCH_TARGET_CLASSES = [
  'touch-target',
  'btn',
  'button',
  'select',
  'input',
  'checkbox',
  'radio',
  'toggle',
  'tab',
  'menu-item',
  'list-item',
  'card',
  'tile',
  'icon-button',
  'action-button',
  'primary-button',
  'secondary-button'
];

// Files to check for touch target compliance
const FILES_TO_CHECK = [
  'app/**/*.tsx',
  'app/**/*.jsx',
  'components/**/*.tsx',
  'components/**/*.jsx',
  'page-components/**/*.tsx',
  'page-components/**/*.jsx'
];

// Minimum touch target size (44px)
const MIN_TOUCH_SIZE = 44;

async function testMobileTouchCompliance() {
  console.log('📱 Testing Mobile Touch Target Compliance (44px minimum)\n');
  
  try {
    // 1. Check if mobile touch optimization is enabled
    console.log('1. Checking mobile touch optimization environment...');
    
    const envContent = fs.readFileSync('.env.local', 'utf8');
    const isMobileTouchEnabled = envContent.includes('NEXT_PUBLIC_ENABLE_MOBILE_TOUCH=true');
    
    console.log(`   - NEXT_PUBLIC_ENABLE_MOBILE_TOUCH: ${isMobileTouchEnabled ? '✅ Enabled' : '❌ Disabled'}`);
    
    if (!isMobileTouchEnabled) {
      console.log('   ⚠️  Mobile touch optimization is not enabled in environment');
    }
    
    // 2. Check Tailwind config for mobile touch classes
    console.log('\n2. Checking Tailwind config for mobile touch classes...');
    
    let hasTouchClasses = false;
    
    try {
      const tailwindConfig = fs.readFileSync('tailwind.config.js', 'utf8');
      if (tailwindConfig.includes('minHeight') && tailwindConfig.includes('44px')) {
        hasTouchClasses = true;
        console.log('   ✅ Found mobile touch classes in tailwind.config.js');
      }
    } catch (error) {
      console.log('   ⚠️  Could not read tailwind.config.js:', error.message);
    }
    
    if (!hasTouchClasses) {
      console.log('   ❌ No mobile touch classes found in Tailwind config');
    }
    
    // 3. Check component files for touch target compliance
    console.log('\n3. Checking component files for touch target compliance...');
    
    let componentsChecked = 0;
    let componentsWithIssues = 0;
    
    // Use find command to get all relevant files
    const findCommand = `find . -name "*.tsx" -o -name "*.jsx" | grep -E "(${FILES_TO_CHECK.map(f => f.replace('**/*', '')).join('|')})" | head -20`;
    
    try {
      const files = execSync(findCommand, { encoding: 'utf8' }).split('\n').filter(Boolean);
      
      for (const file of files) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          componentsChecked++;
          
          // Check for mobile touch classes usage
          const hasTouchClasses = content.includes('min-h-touch') || content.includes('min-w-touch');
          const hasSmallTargets = /h-[0-3][0-9]px/.test(content) || /min-h-[0-3][0-9]px/.test(content);
          
          if (hasTouchClasses) {
            console.log(`   ✅ Using mobile touch classes in: ${file}`);
          } else if (hasSmallTargets) {
            console.log(`   ⚠️  Potential small touch targets in: ${file}`);
            componentsWithIssues++;
          }
        }
      }
      
      console.log(`   ✅ Checked ${componentsChecked} component files`);
      if (componentsWithIssues > 0) {
        console.log(`   ⚠️  Found ${componentsWithIssues} files with potential touch target issues`);
      }
      
    } catch (error) {
      console.log('   ⚠️  Could not automatically check component files:', error.message);
    }
    
    // 4. Check for responsive design patterns
    console.log('\n4. Checking responsive design patterns...');
    
    const hasResponsiveDesign = execSync('grep -r "sm:\\|md:\\|lg:\\|xl:" components/ app/ page-components/ | head -5', { 
      encoding: 'utf8' 
    });
    
    if (hasResponsiveDesign) {
      console.log('   ✅ Responsive design patterns found');
    } else {
      console.log('   ⚠️  Limited responsive design patterns found');
    }
    
    // 5. Test actual mobile rendering (simulated)
    console.log('\n5. Testing mobile rendering simulation...');
    
    // Check if there are any viewport meta tags
    const layoutFiles = [
      'app/layout.tsx',
      'app/layout.jsx',
      'src/app/layout.tsx',
      'src/app/layout.jsx'
    ].filter(file => fs.existsSync(file));
    
    let hasViewportMeta = false;
    
    for (const layoutFile of layoutFiles) {
      const content = fs.readFileSync(layoutFile, 'utf8');
      if (content.includes('viewport') || content.includes('initial-scale')) {
        hasViewportMeta = true;
        console.log(`   ✅ Viewport meta tag found in: ${layoutFile}`);
        break;
      }
    }
    
    if (!hasViewportMeta) {
      console.log('   ⚠️  No viewport meta tag found for mobile responsiveness');
    }
    
    // 6. Generate test report
    console.log('\n6. Generating compliance report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      mobileTouchEnabled: isMobileTouchEnabled,
      hasTouchCssClasses: hasTouchClasses,
      componentsChecked,
      componentsWithIssues,
      hasResponsiveDesign: !!hasResponsiveDesign,
      hasViewportMeta,
      recommendations: []
    };
    
    if (!isMobileTouchEnabled) {
      report.recommendations.push('Enable NEXT_PUBLIC_ENABLE_MOBILE_TOUCH=true in .env.local');
    }
    
    if (!hasTouchClasses) {
      report.recommendations.push('Add mobile touch CSS classes (min-h-11, min-h-[44px])');
    }
    
    if (componentsWithIssues > 0) {
      report.recommendations.push('Review components for small touch targets');
    }
    
    if (!hasViewportMeta) {
      report.recommendations.push('Add viewport meta tag for mobile responsiveness');
    }
    
    console.log('\n📋 MOBILE TOUCH COMPLIANCE REPORT:');
    console.log('===================================');
    console.log(`Status: ${report.recommendations.length === 0 ? '✅ PASS' : '⚠️  NEEDS ATTENTION'}`);
    console.log(`Mobile Touch Enabled: ${report.mobileTouchEnabled ? '✅' : '❌'}`);
    console.log(`Touch CSS Classes: ${report.hasTouchCssClasses ? '✅' : '❌'}`);
    console.log(`Components Checked: ${report.componentsChecked}`);
    console.log(`Components with Issues: ${report.componentsWithIssues}`);
    console.log(`Responsive Design: ${report.hasResponsiveDesign ? '✅' : '⚠️'}`);
    console.log(`Viewport Meta: ${report.hasViewportMeta ? '✅' : '❌'}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n🔧 RECOMMENDATIONS:');
      report.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    } else {
      console.log('\n🎉 All mobile touch compliance checks passed!');
    }
    
    // Save report to file
    fs.writeFileSync('mobile-compliance-report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Report saved to: mobile-compliance-report.json');
    
    return report.recommendations.length === 0;
    
  } catch (error) {
    console.log('❌ Error during mobile compliance testing:', error.message);
    return false;
  }
}

// Run the test
testMobileTouchCompliance()
  .then(success => {
    console.log(success ? '\n✅ Mobile touch compliance test PASSED' : '\n❌ Mobile touch compliance test FAILED');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });