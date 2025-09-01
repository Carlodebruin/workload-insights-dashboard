#!/usr/bin/env node

/**
 * Automated integration verification for TaskDetailsModal
 * Tests the key integration points without browser interaction
 */

const http = require('http');

console.log('🔍 TaskDetailsModal Integration Verification');
console.log('============================================\n');

// Test 1: Verify server is running
function testServerRunning() {
    return new Promise((resolve) => {
        const req = http.get('http://localhost:3008', (res) => {
            if (res.statusCode === 200) {
                console.log('✅ Server Running: Development server is accessible');
                resolve(true);
            } else {
                console.log('❌ Server Running: Unexpected status code:', res.statusCode);
                resolve(false);
            }
        });

        req.on('error', (err) => {
            console.log('❌ Server Running: Server not accessible:', err.message);
            resolve(false);
        });
    });
}

// Test 2: Verify API endpoints are working
function testAPIEndpoints() {
    return new Promise((resolve) => {
        const req = http.get('http://localhost:3008/api/data', (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.users && response.activities && response.categories) {
                        console.log('✅ API Data: Dashboard API returning proper data structure');
                        console.log(`   - Users: ${response.users.length}`);
                        console.log(`   - Activities: ${response.activities.length}`);
                        console.log(`   - Categories: ${response.categories.length}`);
                        resolve(true);
                    } else {
                        console.log('❌ API Data: Invalid data structure returned');
                        resolve(false);
                    }
                } catch (err) {
                    console.log('❌ API Data: Invalid JSON response');
                    resolve(false);
                }
            });
        });

        req.on('error', (err) => {
            console.log('❌ API Data: API endpoint not accessible');
            resolve(false);
        });
    });
}

// Test 3: Verify TypeScript compilation
function testTypeScript() {
    return new Promise((resolve) => {
        const { exec } = require('child_process');
        
        exec('npx tsc --noEmit', (error, stdout, stderr) => {
            if (error) {
                console.log('❌ TypeScript: Compilation errors found');
                console.log('   Error:', stderr.split('\n')[0]);
                resolve(false);
            } else {
                console.log('✅ TypeScript: No compilation errors');
                resolve(true);
            }
        });
    });
}

// Test 4: Verify key files exist
function testFileStructure() {
    const fs = require('fs');
    const path = require('path');
    
    const criticalFiles = [
        'components/TaskDetailsModal.tsx',
        'components/ActivityCard.tsx',
        'components/ActivityFeed.tsx',
        'components/Dashboard.tsx',
        'components/AppShell.tsx'
    ];
    
    let allFilesExist = true;
    
    criticalFiles.forEach(filePath => {
        const fullPath = path.join(__dirname, filePath);
        if (fs.existsSync(fullPath)) {
            console.log(`✅ File Structure: ${filePath} exists`);
        } else {
            console.log(`❌ File Structure: ${filePath} missing`);
            allFilesExist = false;
        }
    });
    
    return allFilesExist;
}

// Test 5: Verify component imports and exports
function testComponentStructure() {
    const fs = require('fs');
    
    // Check TaskDetailsModal exports
    try {
        const taskDetailsModal = fs.readFileSync('components/TaskDetailsModal.tsx', 'utf8');
        const hasCorrectInterface = taskDetailsModal.includes('TaskDetailsModalProps') &&
                                   taskDetailsModal.includes('onViewDetails') === false && // Should be onEdit, onDelete, etc.
                                   taskDetailsModal.includes('export default TaskDetailsModal');
        
        if (hasCorrectInterface) {
            console.log('✅ Component Structure: TaskDetailsModal properly structured');
        } else {
            console.log('❌ Component Structure: TaskDetailsModal interface issues');
            return false;
        }
        
        // Check ActivityCard has onViewDetails prop
        const activityCard = fs.readFileSync('components/ActivityCard.tsx', 'utf8');
        const hasViewDetailsProp = activityCard.includes('onViewDetails: (activity: Activity) => void');
        
        if (hasViewDetailsProp) {
            console.log('✅ Component Structure: ActivityCard has onViewDetails prop');
        } else {
            console.log('❌ Component Structure: ActivityCard missing onViewDetails prop');
            return false;
        }
        
        return true;
    } catch (err) {
        console.log('❌ Component Structure: Error reading component files');
        return false;
    }
}

// Run all verification tests
async function runVerification() {
    console.log('Running automated verification tests...\n');
    
    const results = {
        fileStructure: testFileStructure(),
        componentStructure: testComponentStructure(),
        typeScript: await testTypeScript(),
        serverRunning: await testServerRunning(),
        apiEndpoints: await testAPIEndpoints()
    };
    
    console.log('\n📊 Verification Results:');
    console.log('========================');
    
    let passedTests = 0;
    const totalTests = Object.keys(results).length;
    
    Object.entries(results).forEach(([test, passed]) => {
        console.log(`${test.padEnd(20)}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
        if (passed) passedTests++;
    });
    
    console.log(`\n🎯 Overall Score: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('\n🎉 ALL INTEGRATION CHECKS PASSED!');
        console.log('✅ TaskDetailsModal integration is ready for testing');
        console.log('\n🔗 Next Steps:');
        console.log('1. Open http://localhost:3008 in your browser');
        console.log('2. Click on any activity card to test TaskDetailsModal');
        console.log('3. Test all tabs and functionality');
        console.log('4. Verify event propagation fixes work correctly');
    } else {
        console.log('\n⚠️  SOME INTEGRATION CHECKS FAILED');
        console.log('Please review the failed tests above before proceeding');
    }
    
    return passedTests === totalTests;
}

// Run verification
runVerification().then(success => {
    process.exit(success ? 0 : 1);
});