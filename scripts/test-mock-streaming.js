const { exec } = require('child_process');
const fs = require('fs');

// Test the streaming API endpoint with mock provider
const testData = {
  prompt: "Can you provide a comprehensive analysis of the current workload distribution across all team members?",
  useStreaming: true,
  history: []
};

console.log('Testing streaming API endpoint with mock provider fallback...');

// Create a simple test that should trigger streaming
exec(`curl -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '${JSON.stringify(testData)}'`, 
  (error, stdout, stderr) => {
    if (error) {
      console.error('Error:', error.message);
      return;
    }
    if (stderr) {
      console.error('Stderr:', stderr);
      return;
    }
    
    console.log('Raw response:');
    console.log(stdout);
    
    // Parse SSE response
    const lines = stdout.split('\n');
    let events = [];
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
          console.log('Non-JSON data:', line.substring(5).trim());
        }
      } else if (line.trim() === '') {
        if (currentEvent.type) events.push(currentEvent);
        currentEvent = {};
      }
    }
    
    console.log('\nParsed events:');
    events.forEach((event, index) => {
      console.log(`\nEvent ${index + 1}: ${event.type}`);
      if (event.data) {
        console.log('Data:', JSON.stringify(event.data, null, 2));
      }
    });
    
    // Check if we got streaming content
    const contentEvents = events.filter(e => e.type === 'content');
    if (contentEvents.length > 0) {
      console.log('\n✅ Streaming content received successfully!');
      console.log(`📊 Total content events: ${contentEvents.length}`);
      
      // Extract all content
      let fullContent = '';
      contentEvents.forEach(event => {
        if (event.data && event.data.content) {
          fullContent += event.data.content;
        }
      });
      
      console.log(`📝 Total content length: ${fullContent.length} characters`);
      console.log('📄 First 200 chars:', fullContent.substring(0, 200) + (fullContent.length > 200 ? '...' : ''));
    } else {
      console.log('\n❌ No streaming content events found');
      console.log('Available event types:', [...new Set(events.map(e => e.type))]);
    }
  }
);