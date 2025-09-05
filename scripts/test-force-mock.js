// Test script to verify streaming functionality with mock provider
const { exec } = require('child_process');

console.log('Testing streaming API with forced mock provider...');

// Test 1: Streaming request
console.log('\n1. Testing streaming request...');
exec(`curl -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Test streaming with workload analysis","stream":true,"history":[]}'`, 
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
    } else {
      console.log('\n❌ No content events found in streaming response');
    }
  }
);

// Test 2: Non-streaming request
console.log('\n2. Testing non-streaming request...');
exec(`curl -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Test non-streaming analysis","stream":false,"history":[]}'`, 
  (error, stdout, stderr) => {
    if (error) {
      console.error('Error:', error.message);
      return;
    }
    
    console.log('Response:');
    try {
      const response = JSON.parse(stdout);
      console.log(JSON.stringify(response, null, 2));
      
      if (response.content || response.analysis) {
        console.log('✅ Non-streaming response received successfully!');
      } else if (response.error) {
        console.log('❌ Error response:', response.error);
      }
    } catch (e) {
      console.log('Raw response:', stdout);
    }
  }
);

// Test 3: Test with provider parameter
console.log('\n3. Testing with provider parameter...');
exec(`curl -X POST "http://localhost:3001/api/ai/chat?provider=gemini" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Test with gemini provider","stream":true,"history":[]}'`, 
  (error, stdout, stderr) => {
    if (error) {
      console.error('Error:', error.message);
      return;
    }
    
    console.log('Response:');
    console.log(stdout);
  }
);