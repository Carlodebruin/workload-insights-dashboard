#!/bin/bash

echo "🔄 Testing Claude API Production Status..."

# Test Claude API key directly first
echo "📊 Step 1: Testing Claude API key directly..."
CLAUDE_KEY="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"

curl -X POST "https://api.anthropic.com/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $CLAUDE_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 20,
    "messages": [{"role": "user", "content": "Quick test"}]
  }' | head -c 100

echo -e "\n\n📊 Step 2: Testing Production System Status..."
curl -X GET "https://workload-insights-dashboard.vercel.app/api/debug/system-status" | grep -A 10 '"ai"'

echo -e "\n\n📊 Step 3: Testing AI Chat Endpoint..."
curl -X POST "https://workload-insights-dashboard.vercel.app/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "WhatsApp test message"}' | head -c 200

echo -e "\n\n🎯 Analysis complete!"