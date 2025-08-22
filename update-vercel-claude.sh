#!/bin/bash

echo "🔧 Updating Claude API key in Vercel Production..."

NEW_CLAUDE_KEY="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"

# Remove from Production specifically
echo "📝 Step 1: Removing old Production key..."
expect << 'EOF'
set timeout 30
spawn vercel env rm CLAUDE_API_KEY
expect "Remove CLAUDE_API_KEY from which Environments?"
send "Production\r"
expect "Are you sure?"
send "y\r"
expect eof
EOF

sleep 3

# Remove from Preview specifically  
echo "📝 Step 2: Removing old Preview key..."
expect << 'EOF'
set timeout 30
spawn vercel env rm CLAUDE_API_KEY
expect "Remove CLAUDE_API_KEY from which Environments?"
send "Preview\r"
expect "Are you sure?"
send "y\r"
expect eof
EOF

sleep 3

# Add new key to Production
echo "📝 Step 3: Adding new key to Production..."
expect << EOF
set timeout 30
spawn vercel env add CLAUDE_API_KEY
expect "What's the value of CLAUDE_API_KEY?"
send "$NEW_CLAUDE_KEY\r"
expect "Add CLAUDE_API_KEY to which Environments"
send "Production\r"
expect eof
EOF

sleep 3

# Add new key to Preview
echo "📝 Step 4: Adding new key to Preview..."
expect << EOF
set timeout 30
spawn vercel env add CLAUDE_API_KEY
expect "What's the value of CLAUDE_API_KEY?"
send "$NEW_CLAUDE_KEY\r"
expect "Add CLAUDE_API_KEY to which Environments"
send "Preview\r"
expect eof
EOF

echo "✅ Claude API key updated in all environments!"
echo "🚀 Triggering production deployment..."

# Force production deployment
vercel --prod

echo "🎯 Update and deployment completed!"