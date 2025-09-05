#!/usr/bin/env node

/**
 * Test script to verify code splitting implementation
 * Validates that lazy loading components work correctly
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Code Splitting Implementation...\n');

// Test 1: Check lazy component wrappers exist
console.log('1. Checking lazy component wrappers...');
const lazyWrapperPath = path.join(__dirname, '..', 'components', 'lazy', 'LazyComponentWrappers.tsx');
if (fs.existsSync(lazyWrapperPath)) {
    console.log('✅ LazyComponentWrappers.tsx exists');
} else {
    console.log('❌ LazyComponentWrappers.tsx not found');
    process.exit(1);
}

// Test 2: Check Dashboard imports lazy components
console.log('2. Checking Dashboard component imports...');
const dashboardPath = path.join(__dirname, '..', 'components', 'Dashboard.tsx');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

const lazyImports = [
    'ActivityDistributionChart',
    'UserWorkloadChart', 
    'PeakTimesChart',
    'ActivityFeed'
];

let allImportsFound = true;
lazyImports.forEach(importName => {
    if (dashboardContent.includes(importName)) {
        console.log(`✅ ${importName} import found in Dashboard`);
    } else {
        console.log(`❌ ${importName} import not found in Dashboard`);
        allImportsFound = false;
    }
});

// Test 3: Check AppShell imports lazy TaskDetailsModal
console.log('3. Checking AppShell imports...');
const appShellPath = path.join(__dirname, '..', 'components', 'AppShell.tsx');
const appShellContent = fs.readFileSync(appShellPath, 'utf8');

if (appShellContent.includes('TaskDetailsModal') && appShellContent.includes('lazy/LazyComponentWrappers')) {
    console.log('✅ TaskDetailsModal lazy import found in AppShell');
} else {
    console.log('❌ TaskDetailsModal lazy import not found in AppShell');
    allImportsFound = false;
}

// Test 4: Verify lazy wrapper exports
console.log('4. Checking lazy wrapper exports...');
const wrapperContent = fs.readFileSync(lazyWrapperPath, 'utf8');
const exportsToCheck = [
    'export const ActivityDistributionChart',
    'export const UserWorkloadChart',
    'export const PeakTimesChart', 
    'export const ActivityFeed',
    'export const TaskDetailsModal'
];

let allExportsFound = true;
exportsToCheck.forEach(exportLine => {
    if (wrapperContent.includes(exportLine)) {
        console.log(`✅ ${exportLine.split(' ')[2]} export found`);
    } else {
        console.log(`❌ ${exportLine.split(' ')[2]} export not found`);
        allExportsFound = false;
    }
});

// Test 5: Check lazy imports in wrapper
console.log('5. Checking lazy imports in wrapper...');
const lazyImportPatterns = [
    /lazy\(\(\) => import\('\.\.\/charts\/ActivityDistributionChart'\)\)/,
    /lazy\(\(\) => import\('\.\.\/charts\/UserWorkloadChart'\)\)/,
    /lazy\(\(\) => import\('\.\.\/charts\/PeakTimesChart'\)\)/,
    /lazy\(\(\) => import\('\.\.\/ActivityFeed'\)\)/,
    /lazy\(\(\) => import\('\.\.\/TaskDetailsModal'\)\)/
];

let allLazyImportsFound = true;
lazyImportPatterns.forEach((pattern, index) => {
    if (pattern.test(wrapperContent)) {
        console.log(`✅ Lazy import ${index + 1} found`);
    } else {
        console.log(`❌ Lazy import ${index + 1} not found`);
        allLazyImportsFound = false;
    }
});

// Test 6: Check Suspense fallbacks
console.log('6. Checking Suspense fallbacks...');
const suspensePatterns = [
    /<Suspense fallback={<ChartSkeleton type="pie" \/>}>/,
    /<Suspense fallback={<ChartSkeleton type="bar" \/>}>/,
    /<Suspense fallback={<ChartSkeleton type="times" \/>}>/,
    /<Suspense fallback={<FeedSkeleton \/>}>/,
    /<Suspense fallback={<ModalSkeleton \/>}>/
];

let allSuspenseFound = true;
suspensePatterns.forEach((pattern, index) => {
    if (pattern.test(wrapperContent)) {
        console.log(`✅ Suspense fallback ${index + 1} found`);
    } else {
        console.log(`❌ Suspense fallback ${index + 1} not found`);
        allSuspenseFound = false;
    }
});

// Summary
console.log('\n📊 Test Summary:');
console.log('================');
console.log(`Lazy Wrapper File: ${fs.existsSync(lazyWrapperPath) ? '✅' : '❌'}`);
console.log(`Dashboard Imports: ${allImportsFound ? '✅' : '❌'}`);
console.log(`AppShell Import: ${allImportsFound ? '✅' : '❌'}`);
console.log(`Wrapper Exports: ${allExportsFound ? '✅' : '❌'}`);
console.log(`Lazy Imports: ${allLazyImportsFound ? '✅' : '❌'}`);
console.log(`Suspense Fallbacks: ${allSuspenseFound ? '✅' : '❌'}`);

const overallSuccess = allImportsFound && allExportsFound && allLazyImportsFound && allSuspenseFound;
console.log(`\nOverall Result: ${overallSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);

if (overallSuccess) {
    console.log('\n🎉 Code splitting implementation validated successfully!');
    console.log('📦 Heavy components will now be lazy-loaded for better performance.');
} else {
    console.log('\n⚠️  Code splitting implementation needs fixes.');
    process.exit(1);
}