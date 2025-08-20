#!/bin/bash

# Script to add environment variables to Vercel
# Run this after logging in with: vercel login

echo "🚀 Setting up Vercel environment variables..."

# Set DATABASE_URL
echo "Adding DATABASE_URL..."
echo "postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require" | vercel env add DATABASE_URL production
echo "postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require" | vercel env add DATABASE_URL preview
echo "postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require" | vercel env add DATABASE_URL development

# Set POSTGRES_PRISMA_URL  
echo "Adding POSTGRES_PRISMA_URL..."
echo "postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require" | vercel env add POSTGRES_PRISMA_URL production
echo "postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require" | vercel env add POSTGRES_PRISMA_URL preview
echo "postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require" | vercel env add POSTGRES_PRISMA_URL development

# Set CLAUDE_API_KEY
echo "Adding CLAUDE_API_KEY..."
echo "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" | vercel env add CLAUDE_API_KEY production
echo "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" | vercel env add CLAUDE_API_KEY preview
echo "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" | vercel env add CLAUDE_API_KEY development

# Set ENCRYPTION_KEY
echo "Adding ENCRYPTION_KEY..."
echo "4de665b9cfdb476d1b90592d83b74d5e4a621d790cce3c2f25de4ffc836e4444" | vercel env add ENCRYPTION_KEY production
echo "4de665b9cfdb476d1b90592d83b74d5e4a621d790cce3c2f25de4ffc836e4444" | vercel env add ENCRYPTION_KEY preview
echo "4de665b9cfdb476d1b90592d83b74d5e4a621d790cce3c2f25de4ffc836e4444" | vercel env add ENCRYPTION_KEY development

# Set GEMINI_API_KEY
echo "Adding GEMINI_API_KEY..."
echo "test_key_for_development_health_check" | vercel env add GEMINI_API_KEY production
echo "test_key_for_development_health_check" | vercel env add GEMINI_API_KEY preview
echo "test_key_for_development_health_check" | vercel env add GEMINI_API_KEY development

echo "✅ All environment variables added!"
echo "🚀 Triggering deployment..."

# Trigger redeploy
vercel --prod

echo "🧪 Testing endpoints..."
sleep 30

echo "Health check:"
curl "https://workload-insights-dashboard.vercel.app/api/health"
echo ""

echo "Users API:"
curl "https://workload-insights-dashboard.vercel.app/api/users"
echo ""

echo "Categories API:"
curl "https://workload-insights-dashboard.vercel.app/api/categories"
echo ""

echo "✅ Setup complete!"