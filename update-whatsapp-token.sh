#!/bin/bash

echo "🔄 Updating WhatsApp Access Token in Vercel..."

NEW_TOKEN="EAAclqjKLTacBPeZBBKuIvVC2yHV8xNmNZB2xNCrO1k1ZBkWoFVF8Q2MSIf65ngPNSpMSd8uRAR7ZAwNZAkNcftlj96aFYkttBCXvBU7xcYFZCO91xFgwb7ZBwkANUPdmcfgTJWnr8xD1P0PBZCZBOTPz4KBGDm9mwHENPUlQkflJ6F68oaDwTwiKjUrFMg9DYL9Vy8jSc9Nx2JEyTi7ms3zvB2Fyt3fuwXhcPCBABHCeL1IkZD"

# Remove from Production
echo "📝 Step 1: Removing old Production token..."
expect << 'EOF'
set timeout 30
spawn vercel env rm WHATSAPP_ACCESS_TOKEN
expect "Remove WHATSAPP_ACCESS_TOKEN from which Environments?"
send "Production\r"
expect "Are you sure?"
send "y\r"
expect eof
EOF

sleep 3

# Remove from Preview
echo "📝 Step 2: Removing old Preview token..."
expect << 'EOF'
set timeout 30
spawn vercel env rm WHATSAPP_ACCESS_TOKEN
expect "Remove WHATSAPP_ACCESS_TOKEN from which Environments?"
send "Preview\r"
expect "Are you sure?"
send "y\r"
expect eof
EOF

sleep 3

# Remove from Development
echo "📝 Step 3: Removing old Development token..."
expect << 'EOF'
set timeout 30
spawn vercel env rm WHATSAPP_ACCESS_TOKEN
expect "Remove WHATSAPP_ACCESS_TOKEN from which Environments?"
send "Development\r"
expect "Are you sure?"
send "y\r"
expect eof
EOF

sleep 3

# Add new token to Production
echo "📝 Step 4: Adding new token to Production..."
echo "$NEW_TOKEN" | vercel env add WHATSAPP_ACCESS_TOKEN production

# Add new token to Preview
echo "📝 Step 5: Adding new token to Preview..."
echo "$NEW_TOKEN" | vercel env add WHATSAPP_ACCESS_TOKEN preview

# Add new token to Development
echo "📝 Step 6: Adding new token to Development..."
echo "$NEW_TOKEN" | vercel env add WHATSAPP_ACCESS_TOKEN development

echo "✅ WhatsApp access token updated in all environments!"
echo "🚀 Triggering production deployment..."

# Force production deployment
vercel --prod

echo "🎯 Token update and deployment completed!"