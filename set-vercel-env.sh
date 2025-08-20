#!/bin/bash

# Script to set Vercel environment variables for Neon PostgreSQL
echo "Setting Vercel environment variables for Neon PostgreSQL..."

# Set DATABASE_URL
echo "Setting DATABASE_URL..."
vercel env add DATABASE_URL production <<EOF
postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
EOF

# Set POSTGRES_PRISMA_URL
echo "Setting POSTGRES_PRISMA_URL..."
vercel env add POSTGRES_PRISMA_URL production <<EOF
postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require
EOF

# Set CLAUDE_API_KEY (if not already set)
echo "Setting CLAUDE_API_KEY..."
vercel env add CLAUDE_API_KEY production <<EOF
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
EOF

echo "Environment variables set! Now deploying..."
vercel --prod

echo "Deployment complete! Testing endpoints..."

echo "Testing users API..."
curl "https://workload-insights-dashboard.vercel.app/api/users"

echo ""
echo "Testing webhook..."
curl "https://workload-insights-dashboard.vercel.app/api/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=my_verify_token_123&hub.challenge=test123"

echo ""
echo "Setup complete!"