# Neon PostgreSQL Database Setup Guide

## 🎯 Why Neon Instead of Vercel Postgres

Vercel Postgres is now only available through the marketplace/integrations. Neon is:
- ✅ **Free tier available** (3GB storage, 1 database)
- ✅ **Serverless PostgreSQL** with auto-scaling
- ✅ **Database branching** (like git for databases)
- ✅ **Easy integration** with any platform
- ✅ **No credit card required** for free tier

## 🚀 Step-by-Step Setup Instructions

### Step 1: Create Neon Account & Database

1. **Sign up for Neon:**
   - Visit: https://neon.tech
   - Click "Sign up" → Continue with GitHub (recommended)
   - Choose "Free Plan" (no credit card needed)

2. **Create Database:**
   - Project name: `workload-insights`
   - Database name: `workload_db` (or keep default)
   - Region: Choose closest to you
   - Click "Create Project"

3. **Get Connection String:**
   - After creation, you'll see the connection string
   - It looks like: `postgresql://username:password@hostname/database?sslmode=require`
   - Copy this connection string

### Step 2: Configure Environment Variables

**Neon provides multiple connection strings. Use these specific ones:**

1. **Update Local .env.local:**
   ```bash
   # Main database connection (pooled - recommended)
   DATABASE_URL=postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
   
   # Prisma-specific URL with timeout
   POSTGRES_PRISMA_URL=postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require
   ```

2. **Set in Vercel Dashboard:**
   - Go to: https://vercel.com/dashboard  
   - Select your `workload-insights-dashboard` project
   - Go to Settings → Environment Variables
   - Add these environment variables:
     - `DATABASE_URL` = `postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require`
     - `POSTGRES_PRISMA_URL` = `postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require`
     - `CLAUDE_API_KEY` = `[Your Claude API key starting with sk-ant-api03-]`
   - Set environment to "Production, Preview, and Development"

**Note:** The pooled connection (`-pooler.eu-central-1.aws.neon.tech`) is recommended for production as it handles connection limits better.

### Step 3: Deploy Schema and Test

1. **Push Schema to Neon Database:**
   ```bash
   npx prisma db push
   ```

2. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

3. **Test Locally First:**
   ```bash
   npm run dev
   # Test at http://localhost:3000
   ```

4. **Commit and Deploy:**
   ```bash
   git add .
   git commit -m "Configure Neon PostgreSQL database

   🚀 Generated with [Claude Code](https://claude.ai/code)

   Co-Authored-By: Claude <noreply@anthropic.com>"
   git push origin main
   vercel --prod
   ```

### Step 4: Test Everything Works

1. **Test Database Operations:**
   ```bash
   # Test users API
   curl "https://workload-insights-dashboard.vercel.app/api/users"
   # Should return: {"users": []}

   # Test categories API  
   curl "https://workload-insights-dashboard.vercel.app/api/categories"
   # Should return: {"categories": []}
   ```

2. **Test Webhook (Should Still Work):**
   ```bash
   curl "https://workload-insights-dashboard.vercel.app/api/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=my_verify_token_123&hub.challenge=test123"
   # Should return: test123
   ```

3. **Test Creating Data:**
   ```bash
   # Create a user
   curl -X POST "https://workload-insights-dashboard.vercel.app/api/users" \
     -H "Content-Type: application/json" \
     -d '{"name": "Test User", "phone_number": "+1234567890", "role": "staff"}'

   # Create a category
   curl -X POST "https://workload-insights-dashboard.vercel.app/api/categories" \
     -H "Content-Type: application/json" \
     -d '{"name": "Test Category"}'
   ```

## 🎯 Expected Results

After setup:
- ✅ **Database Connection**: App connects to Neon PostgreSQL
- ✅ **CRUD Operations**: All endpoints work without errors
- ✅ **Webhook Preserved**: WhatsApp webhook still functional
- ✅ **Free Hosting**: No database costs on free tier
- ✅ **Scalability**: Auto-scales with usage

## 🔧 Neon Dashboard Features

In your Neon dashboard you can:
- **Monitor queries** and performance
- **Create branches** for testing
- **View connection logs**
- **Manage multiple databases**
- **Scale up** when needed

## 💡 Benefits of Neon

- **Serverless**: Automatically pauses when inactive (saves resources)
- **Branching**: Create database branches for testing features
- **Fast**: Sub-second cold starts
- **Secure**: Built-in SSL, SOC 2 compliant
- **Developer-friendly**: Great tooling and dashboard

---
**Total Setup Time**: ~10 minutes  
**Cost**: Free (up to 3GB storage)  
**Result**: Full PostgreSQL database with your app working perfectly