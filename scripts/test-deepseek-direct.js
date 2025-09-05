// Direct DeepSeek API test to isolate the issue
const testDeepSeekAPI = async () => {
  console.log('=== Direct DeepSeek API Test ===');
  
  // Test environment variables
  const apiKey = process.env.DEEPSEEK_API_KEY;
  console.log('API Key exists:', !!apiKey);
  console.log('API Key length:', apiKey?.length || 0);
  console.log('API Key starts with sk-:', apiKey?.startsWith('sk-') || false);
  console.log('API Key ends with newline:', apiKey?.endsWith('\n') || false);
  console.log('API Key first 10 chars:', apiKey?.substring(0, 10) || 'undefined');
  console.log('API Key last 5 chars:', apiKey?.substring(apiKey.length - 5) || 'undefined');
  
  if (!apiKey) {
    console.log('❌ No API key found');
    return;
  }

  // Test direct API call
  try {
    console.log('\n🔍 Testing direct API call...');
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`, // Trim any whitespace/newlines
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Test message' }],
        max_tokens: 10
      }),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ DeepSeek API call successful');
      console.log('Response:', data);
    } else {
      const errorText = await response.text();
      console.log('❌ DeepSeek API call failed');
      console.log('Error:', errorText);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
};

// Execute the test
testDeepSeekAPI().catch(console.error);