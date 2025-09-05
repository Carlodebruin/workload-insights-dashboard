// Test script to bypass database configuration and force mock provider
const { exec } = require('child_process');

console.log('Testing streaming with forced mock provider bypass...');

// Create a simple test that should work with mock provider
const testData = {
  prompt: "Can you analyze the current workload distribution?",
  stream: true,
  history: []
};

// Test with a provider that doesn't exist to force mock fallback
exec(`curl -X POST "http://localhost:3001/api/ai/chat?provider=nonexistent" \
  -H "Content-Type: application/json" \
  -d '${JSON.stringify(testData)}'`, 
  (error, stdout, stderr) => {
    if (error) {
      console.error('Error:', error.message);
      return;
    }
    
    console.log('Response:');
    console.log(stdout);
    
    // Parse SSE events
    const lines = stdout.split('\n');
    const events = [];
    let currentEvent = {};
    
    for (const line of lines) {
      if (line.startsWith('event:')) {
        if (currentEvent.type) events.push(currentEvent);
        currentEvent = { type: line.substring(6).trim() };
      } else if (line.startsWith('data:')) {
        try {
          const data = JSON.parse(line.substring(5).trim());
          currentEvent.data = data;
        } catch (e) {
          // Ignore non-JSON data
        }
      } else if (line.trim() === '') {
        if (currentEvent.type) events.push(currentEvent);
        currentEvent = {};
      }
    }
    
    console.log('\nParsed events:');
    events.forEach((event, index) => {
      console.log(`Event ${index + 1}: ${event.type}`);
      if (event.data) {
        console.log('  Data:', JSON.stringify(event.data, null, 2));
      }
    });
    
    // Check if we got any content events
    const contentEvents = events.filter(e => e.type === 'content');
    if (contentEvents.length > 0) {
      console.log('\n✅ Streaming content received successfully!');
      let fullContent = '';
      contentEvents.forEach(event => {
        if (event.data && event.data.content) {
          fullContent += event.data.content;
        }
      });
      console.log(`📝 Content length: ${fullContent.length} characters`);
      console.log('📄 First 200 chars:', fullContent.substring(0, 200) + (fullContent.length > 200 ? '...' : ''));
    } else {
      console.log('\n❌ No content events found in streaming response');
      console.log('Available event types:', [...new Set(events.map(e => e.type))]);
    }
  }
);