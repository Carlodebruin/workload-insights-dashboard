#!/usr/bin/env node

/**
 * Component Touch Target Verification Script
 * Verifies that components are actually using the 44px mobile touch classes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Key components that should have mobile touch targets
const KEY_COMPONENTS = [
  'components/ui/button.tsx',
  'components/TaskDetailsModal.tsx',
  'components/Dashboard.tsx',
  'page-components/AIInsightsPage.tsx',
  'app/**/page.tsx',
  'app/**/layout.tsx'
];

async function verifyComponentTouchTargets() {
  console.log('🔍 Verifying Component Touch Target Implementation\n');
  
  try {
    let componentsChecked = 0;
    let componentsUsingTouchClasses = 0;
    let componentsNeedingAttention = 0;

    // 1. Check key component files
    console.log('1. Checking key component files for touch target usage...\n');
    
    for (const pattern of KEY_COMPONENTS) {
      try {
        const findCommand = `find . -path "./${pattern}" 2>/dev/null`;
        const files = execSync(findCommand, { encoding: 'utf8' }).split('\n').filter(Boolean);
        
        for (const file of files) {
          if (fs.existsSync(file)) {
            const content = fs.readFileSync(file, 'utf8');
            componentsChecked++;
            
            // Check for mobile touch class usage
            const usesMinHTouch = content.includes('min-h-touch');
            const usesMinWTouch = content.includes('min-w-touch');
            const usesTouchTarget = content.includes('touch-target');
            
            if (usesMinHTouch || usesMinWTouch || usesTouchTarget) {
              console.log(`   ✅ ${file} - Using mobile touch classes`);
              componentsUsingTouchClasses++;
            } else {
              // Check if it has interactive elements that should use touch targets
              const hasInteractiveElements = content.includes('onClick') || 
                                           content.includes('onTouch') ||
                                           content.includes('button') ||
                                           content.includes('Button') ||
                                           content.includes('select') ||
                                           content.includes('input');
              
              if (hasInteractiveElements) {
                console.log(`   ⚠️  ${file} - Has interactive elements but no touch classes`);
                componentsNeedingAttention++;
              } else {
                console.log(`   🔶 ${file} - No interactive elements found`);
              }
            }
          }
        }
      } catch (error) {
        // File not found, continue
      }
    }

    // 2. Check for common interactive patterns
    console.log('\n2. Checking for interactive patterns across codebase...');
    
    try {
      const interactivePatterns = execSync('grep -r "onClick\\|onTouch\\|button\\|Button" components/ app/ page-components/ | head -10', {
        encoding: 'utf8'
      });
      
      if (interactivePatterns) {
        console.log('   ✅ Interactive patterns found throughout codebase');
        
        // Count how many use touch classes
        const touchUsageCount = (interactivePatterns.match(/min-h-touch|min-w-touch|touch-target/g) || []).length;
        if (touchUsageCount > 0) {
          console.log(`   ✅ ${touchUsageCount} instances using touch classes`);
        } else {
          console.log('   ⚠️  Interactive patterns found but no touch classes detected');
        }
      }
    } catch (error) {
      console.log('   ⚠️  Could not scan for interactive patterns');
    }

    // 3. Generate comprehensive report
    console.log('\n3. Generating comprehensive touch target report...\n');
    
    const report = {
      timestamp: new Date().toISOString(),
      componentsChecked,
      componentsUsingTouchClasses,
      componentsNeedingAttention,
      coveragePercentage: componentsChecked > 0 ? 
        Math.round((componentsUsingTouchClasses / componentsChecked) * 100) : 0,
      recommendations: []
    };

    console.log('📊 TOUCH TARGET IMPLEMENTATION REPORT:');
    console.log('======================================');
    console.log(`Components Checked: ${report.componentsChecked}`);
    console.log(`Using Touch Classes: ${report.componentsUsingTouchClasses}`);
    console.log(`Needing Attention: ${report.componentsNeedingAttention}`);
    console.log(`Coverage: ${report.coveragePercentage}%`);
    
    if (report.coveragePercentage < 50) {
      console.log('\n🔧 RECOMMENDATIONS:');
      console.log('   1. Add min-h-touch and min-w-touch to interactive components');
      console.log('   2. Focus on Button components first');
      console.log('   3. Update form elements (inputs, selects)');
      console.log('   4. Review navigation and menu items');
      
      report.recommendations = [
        'Add touch classes to interactive components',
        'Focus on high-usage components first',
        'Create reusable touch-optimized components'
      ];
    } else if (report.coveragePercentage < 80) {
      console.log('\n🔧 RECOMMENDATIONS:');
      console.log('   1. Continue adding touch classes to remaining components');
      console.log('   2. Ensure all new components use touch classes');
      console.log('   3. Conduct mobile usability testing');
      
      report.recommendations = [
        'Continue touch class implementation',
        'Establish component development standards',
        'Conduct mobile usability testing'
      ];
    } else {
      console.log('\n🎉 Excellent touch target coverage!');
      console.log('   Maintain this standard for all new components.');
      
      report.recommendations = [
        'Maintain current standards',
        'Include touch targets in component reviews',
        'Continue mobile testing'
      ];
    }

    // 4. Check build output for mobile classes
    console.log('\n4. Checking build output for mobile classes...');
    
    try {
      const buildCheck = execSync('npm run build 2>&1 | grep -i "mobile\\|touch\\|44px" | head -5', {
        encoding: 'utf8'
      });
      
      if (buildCheck) {
        console.log('   ✅ Mobile optimization detected in build');
      } else {
        console.log('   🔶 No specific mobile optimizations detected in build output');
      }
    } catch (error) {
      console.log('   ⚠️  Could not check build output');
    }

    // Save detailed report
    fs.writeFileSync('touch-target-implementation-report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Detailed report saved to: touch-target-implementation-report.json');

    return report.coveragePercentage >= 50; // Pass if at least 50% coverage
    
  } catch (error) {
    console.log('❌ Error during touch target verification:', error.message);
    return false;
  }
}

// Run the verification
verifyComponentTouchTargets()
  .then(success => {
    console.log(success ? '\n✅ Touch target verification PASSED' : '\n❌ Touch target verification needs improvement');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });