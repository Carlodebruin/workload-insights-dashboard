#!/usr/bin/env node

/**
 * Claude Code Setup Verification Script
 * Run this to verify your Claude Code setup is working correctly
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Claude Code Setup Verification\n');

// Check for required configuration files
const requiredFiles = [
  '.claudeignore',
  'CLAUDE.md',
  '.env.development.template'
];

const optionalFiles = [
  '.env.local',
  '.env'
];

console.log('📁 Checking configuration files...');
requiredFiles.forEach(file => {
  if (fs.existsSync(path.join(process.cwd(), file))) {
    console.log(`✅ ${file} - Found`);
  } else {
    console.log(`❌ ${file} - Missing (required)`);
  }
});

optionalFiles.forEach(file => {
  if (fs.existsSync(path.join(process.cwd(), file))) {
    console.log(`✅ ${file} - Found`);
  } else {
    console.log(`⚠️  ${file} - Not found (create from template for development)`);
  }
});

console.log('\n📋 Next Steps:');
console.log('1. Copy .env.development.template to .env.local');
console.log('2. Fill in your actual API keys in .env.local');
console.log('3. Test with: npx @anthropic-ai/claude-code');
console.log('4. Start development: npm run dev');

console.log('\n🎯 Claude Code is ready to use!');
console.log('Usage: npx @anthropic-ai/claude-code [command]');
console.log('Example: npx @anthropic-ai/claude-code "help me fix this bug"');