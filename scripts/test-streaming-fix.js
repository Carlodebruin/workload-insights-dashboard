const { exec } = require('child_process');

// Test the streaming API endpoint
const testData = {
  prompt: "Can you provide a comprehensive analysis of the current workload distribution across all team members?",
  useStreaming: true,
  history: []
};

// Create a temporary file with the JSON data
const fs = require('fs');
fs.writeFileSync('/tmp/test-data.json', JSON.stringify(testData));

console.log('Testing streaming API endpoint...');

exec(`curl -X POST "http://localhost:3001/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d @/tmp/test-data.json`, 
  (error, stdout, stderr) => {
    if (error) {
      console.error('Error:', error.message);
      return;
    }
    if (stderr) {
      console.error('Stderr:', stderr);
      return;
    }
    console.log('Response:', stdout);
    
    // Check if it's a streaming response
    if (stdout.includes('data:') || stdout.includes('event:')) {
      console.log('✅ Streaming response detected!');
      
      // Count chunks
      const chunks = stdout.split('data:').length - 1;
      console.log(`📊 Total chunks received: ${chunks}`);
      
      // Extract content
      const contentMatch = stdout.match(/"content":"([^"]*)"/);
      if (contentMatch && contentMatch[1]) {
        const content = contentMatch[1];
        console.log(`📝 Content length: ${content.length} characters`);
        console.log('📄 First 200 chars:', content.substring(0, 200) + '...');
      }
    } else {
      console.log('❌ Not a streaming response');
      console.log('Response type:', stdout.substring(0, 100));
    }
  }
);