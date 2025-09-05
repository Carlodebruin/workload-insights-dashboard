const script = `
console.log('=== Production Environment Variable Check ===');
console.log('DEEPSEEK_API_KEY exists:', !!process.env.DEEPSEEK_API_KEY);
console.log('DEEPSEEK_API_KEY length:', process.env.DEEPSEEK_API_KEY?.length || 0);
console.log('DEEPSEEK_API_KEY ends with newline:', process.env.DEEPSEEK_API_KEY?.endsWith('\\n') || false);
console.log('DEEPSEEK_API_KEY starts with sk-:', process.env.DEEPSEEK_API_KEY?.startsWith('sk-') || false);

console.log('\\nGEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
console.log('GEMINI_API_KEY value:', process.env.GEMINI_API_KEY);

console.log('\\nCLAUDE_API_KEY exists:', !!process.env.CLAUDE_API_KEY);
console.log('CLAUDE_API_KEY length:', process.env.CLAUDE_API_KEY?.length || 0);
console.log('CLAUDE_API_KEY ends with newline:', process.env.CLAUDE_API_KEY?.endsWith('\\n') || false);

// Test DeepSeek provider creation
try {
  const { DeepSeekProvider } = require('./lib/providers/deepseek');
  const provider = new DeepSeekProvider();
  console.log('\\n✅ DeepSeek provider created successfully');
} catch (error) {
  console.log('\\n❌ DeepSeek provider creation failed:', error.message);
}

// Test AI factory
try {
  const { getWorkingAIProvider } = require('./lib/ai-factory');
  console.log('\\n🔍 Testing getWorkingAIProvider...');
  getWorkingAIProvider().then(provider => {
    console.log('Working provider:', provider.name, provider.displayName);
  }).catch(error => {
    console.log('getWorkingAIProvider failed:', error.message);
  });
} catch (error) {
  console.log('\\n❌ AI factory test failed:', error.message);
}
`;

console.log(script);