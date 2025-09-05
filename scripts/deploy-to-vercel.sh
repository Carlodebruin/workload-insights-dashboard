#!/bin/bash

# Vercel Deployment Script
# Run this after successful login to deploy the middleware fixes

echo "🚀 Starting Vercel deployment..."
echo "📋 Deploying middleware authentication fixes"

# Check if user is logged in
if ! vercel whoami >/dev/null 2>&1; then
    echo "❌ Not logged in to Vercel. Please run: vercel login"
    exit 1
fi

echo "✅ Logged in to Vercel"

# Build the project first to ensure everything compiles
echo "📦 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix build errors before deploying."
    exit 1
fi

echo "✅ Build successful"

# Deploy to Vercel
echo "🌐 Deploying to Vercel..."
vercel --prod

if [ $? -eq 0 ]; then
    echo "🎉 Deployment successful!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Go to Vercel dashboard → Project Settings → Deployment Protection"
    echo "2. Disable protection for production environment"
    echo "3. Test the deployment: node scripts/verify-production-deployment.js"
    echo ""
    echo "🔧 If you need to keep deployment protection enabled:"
    echo "   - Use bypass tokens for testing"
    echo "   - Or configure authentication in the app with REQUIRE_AUTH=true"
else
    echo "❌ Deployment failed. Check the error messages above."
    exit 1
fi