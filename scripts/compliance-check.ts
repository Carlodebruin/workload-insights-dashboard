#!/usr/bin/env tsx

/**
 * GDPR/POPIA Compliance Check Script
 * 
 * This script helps administrators monitor and maintain data retention compliance.
 * Run with: npx tsx scripts/compliance-check.ts
 */

import { 
  generateComplianceReport, 
  runScheduledCleanup,
  analyzeUserRetention,
  analyzeActivityRetention,
  DATA_RETENTION_CONFIG
} from '../lib/data-retention';

interface ComplianceCheckOptions {
  verbose?: boolean;
  dryRun?: boolean;
  autoCleanup?: boolean;
}

async function runComplianceCheck(options: ComplianceCheckOptions = {}) {
  const { verbose = false, dryRun = true, autoCleanup = false } = options;
  
  console.log('🔍 GDPR/POPIA Compliance Check Starting...\n');
  console.log(`Configuration:`);
  console.log(`- User Retention: ${DATA_RETENTION_CONFIG.DEFAULT_USER_RETENTION_DAYS} days (~${Math.round(DATA_RETENTION_CONFIG.DEFAULT_USER_RETENTION_DAYS / 365)} years)`);
  console.log(`- Activity Retention: ${DATA_RETENTION_CONFIG.DEFAULT_ACTIVITY_RETENTION_DAYS} days (~${Math.round(DATA_RETENTION_CONFIG.DEFAULT_ACTIVITY_RETENTION_DAYS / 365)} years)`);
  console.log(`- Inactive User Threshold: ${DATA_RETENTION_CONFIG.INACTIVE_USER_THRESHOLD_DAYS} days\n`);

  try {
    // 1. Generate comprehensive compliance report
    console.log('📊 Generating compliance report...');
    const report = await generateComplianceReport();
    
    console.log('\n📋 USER RETENTION STATUS:');
    console.log(`- Total users: ${report.userRetention.totalRecords}`);
    console.log(`- Eligible for deletion: ${report.userRetention.eligibleForDeletion}`);
    if (report.userRetention.oldestRecord) {
      console.log(`- Oldest record: ${report.userRetention.oldestRecord.toISOString().split('T')[0]}`);
    }
    if (report.userRetention.newestRecord) {
      console.log(`- Newest record: ${report.userRetention.newestRecord.toISOString().split('T')[0]}`);
    }

    console.log('\n📋 ACTIVITY RETENTION STATUS:');
    console.log(`- Total activities: ${report.activityRetention.totalRecords}`);
    console.log(`- Eligible for deletion: ${report.activityRetention.eligibleForDeletion}`);
    if (report.activityRetention.oldestRecord) {
      console.log(`- Oldest record: ${report.activityRetention.oldestRecord.toISOString().split('T')[0]}`);
    }
    if (report.activityRetention.newestRecord) {
      console.log(`- Newest record: ${report.activityRetention.newestRecord.toISOString().split('T')[0]}`);
    }

    console.log('\n👤 INACTIVE USERS:');
    console.log(`- Inactive users (>1 year): ${report.inactiveUsers}`);

    console.log('\n💡 RECOMMENDATIONS:');
    report.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });

    // 2. Detailed analysis if verbose
    if (verbose) {
      console.log('\n🔍 DETAILED ANALYSIS:');
      
      const userAnalysis = await analyzeUserRetention();
      const activityAnalysis = await analyzeActivityRetention();
      
      console.log('\nUser Data Analysis:');
      console.log(`- Retention period: ${userAnalysis.retentionPeriodDays} days`);
      console.log(`- Deletion ratio: ${((userAnalysis.eligibleForDeletion / userAnalysis.totalRecords) * 100).toFixed(2)}%`);
      
      console.log('\nActivity Data Analysis:');
      console.log(`- Retention period: ${activityAnalysis.retentionPeriodDays} days`);
      console.log(`- Deletion ratio: ${((activityAnalysis.eligibleForDeletion / activityAnalysis.totalRecords) * 100).toFixed(2)}%`);
    }

    // 3. Automated cleanup if enabled
    if (autoCleanup) {
      console.log('\n🧹 RUNNING AUTOMATED CLEANUP...');
      
      const cleanupResult = await runScheduledCleanup({
        deleteExpiredActivities: true,
        anonymizeInactiveUsers: false, // Conservative default
        dryRun
      });

      console.log(`\n📊 CLEANUP RESULTS ${dryRun ? '(DRY RUN)' : '(EXECUTED)'}:`);
      console.log(`- Activities deleted: ${cleanupResult.activitiesDeleted}`);
      console.log(`- Users anonymized: ${cleanupResult.usersAnonymized}`);
      
      if (cleanupResult.errors.length > 0) {
        console.log('\n❌ CLEANUP ERRORS:');
        cleanupResult.errors.forEach((error, index) => {
          console.log(`${index + 1}. ${error}`);
        });
      }

      if (dryRun && (cleanupResult.activitiesDeleted > 0 || cleanupResult.usersAnonymized > 0)) {
        console.log('\n💡 To execute actual cleanup, run with --execute flag');
      }
    }

    // 4. Compliance status summary
    console.log('\n🎯 COMPLIANCE STATUS:');
    const hasIssues = report.userRetention.eligibleForDeletion > 0 || 
                     report.activityRetention.eligibleForDeletion > 0 ||
                     report.inactiveUsers > 10; // Threshold for concern

    if (hasIssues) {
      console.log('⚠️  ATTENTION REQUIRED: Review recommendations above');
      console.log('   Consider running cleanup operations or reviewing retention policies');
    } else {
      console.log('✅ COMPLIANT: All data is within retention policy guidelines');
    }

    console.log('\n📅 Next recommended check: 30 days from now');
    console.log('🔗 For detailed documentation, see: GDPR_COMPLIANCE.md\n');

  } catch (error) {
    console.error('❌ Compliance check failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// CLI argument parsing
function parseArguments(): ComplianceCheckOptions {
  const args = process.argv.slice(2);
  const options: ComplianceCheckOptions = {};

  if (args.includes('--verbose') || args.includes('-v')) {
    options.verbose = true;
  }

  if (args.includes('--execute')) {
    options.dryRun = false;
  }

  if (args.includes('--cleanup')) {
    options.autoCleanup = true;
  }

  return options;
}

// Help text
function showHelp() {
  console.log(`
GDPR/POPIA Compliance Check Tool

Usage: npx tsx scripts/compliance-check.ts [options]

Options:
  --verbose, -v    Show detailed analysis
  --cleanup        Run automated cleanup operations
  --execute        Execute cleanup (default is dry run)
  --help, -h       Show this help message

Examples:
  npx tsx scripts/compliance-check.ts                    # Basic compliance report
  npx tsx scripts/compliance-check.ts --verbose          # Detailed analysis
  npx tsx scripts/compliance-check.ts --cleanup          # Report + dry run cleanup
  npx tsx scripts/compliance-check.ts --cleanup --execute # Report + actual cleanup

Safety Notes:
  - Always run with dry run first (default behavior)
  - Use --execute only after reviewing dry run results
  - Consider backing up your database before cleanup operations
  - Test in staging environment before production use
`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  const options = parseArguments();
  
  if (!options.dryRun) {
    console.log('⚠️  WARNING: Running in EXECUTE mode. This will make permanent changes to your database.');
    console.log('🔄 Starting in 5 seconds... (Ctrl+C to cancel)\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  await runComplianceCheck(options);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });
}