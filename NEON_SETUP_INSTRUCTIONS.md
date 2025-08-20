# Neon PostgreSQL Database Setup - Complete Guide

## 🎯 What You'll Accomplish
- Create a free PostgreSQL database on Neon
- Connect your app to the cloud database
- Fix all CRUD operations (users, categories, activities)
- Keep your WhatsApp webhook working

## 📋 Prerequisites
- GitHub account (for Neon signup)
- Vercel account with your deployed project

---

## Step 1: Create Neon Database Account

### 1.1 Sign Up for Neon
1. Go to: **https://neon.tech**
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"** (recommended)
4. Authorize Neon to access your GitHub account

### 1.2 Create Your First Project
1. **Project name**: `workload-insights`
2. **Database name**: Leave as `neondb` (default)
3. **Region**: Choose closest to you:
   - Europe: `eu-central-1` (Frankfurt)
   - US East: `us-east-1` (Virginia)
   - US West: `us-west-2` (Oregon)
4. **Plan**: Free Tier (automatically selected)
5. Click **"Create Project"**

---

## Step 2: Get Your Connection Strings

After project creation, Neon shows you connection details. You need these **two specific URLs**:

### 2.1 Copy These Connection Strings
```bash
# Main connection (pooled - use this one)
DATABASE_URL=postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require

# Prisma connection (with timeout)
POSTGRES_PRISMA_URL=postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require
```

**🔍 How to identify the right URLs:**
- Look for the one with **`-pooler.`** in the hostname (this is the pooled connection)
- The Prisma URL should have **`connect_timeout=15`** parameter

---

## Step 3: Configure Environment Variables

### 3.1 Update Local Environment File (.env.local)
Your `.env.local` file should contain:
```bash
GEMINI_API_KEY=test_key_for_development_health_check
CLAUDE_API_KEY=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
ENCRYPTION_KEY=4de665b9cfdb476d1b90592d83b74d5e4a621d790cce3c2f25de4ffc836e4444

# Neon PostgreSQL - Main connection (pooled)
DATABASE_URL=postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require

# Prisma-specific URL with timeout
POSTGRES_PRISMA_URL=postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require
```

### 3.2 Set Environment Variables in Vercel
1. Go to: **https://vercel.com/dashboard**
2. Select your **`workload-insights-dashboard`** project
3. Go to **Settings** → **Environment Variables**
4. Add these **3 environment variables**:

| Name | Value | Environment |
|------|-------|-------------|
| `DATABASE_URL` | `postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require` | Production, Preview, Development |
| `POSTGRES_PRISMA_URL` | `postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require` | Production, Preview, Development |
| `CLAUDE_API_KEY` | `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` | Production, Preview, Development |

5. Click **"Save"** for each variable

---

## Step 4: Deploy Database Schema

### 4.1 Push Schema to Neon Database
Open terminal in your project directory and run:
```bash
npx prisma db push
```

**Expected output:**
```
Environment variables loaded from .env.local
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "neondb", schema "public" at "ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech:5432"

🚀  Your database is now in sync with your schema.
```

### 4.2 Generate Prisma Client
```bash
npx prisma generate
```

### 4.3 Test Local Connection
```bash
npm run dev
```
Open: **http://localhost:3000** and test creating users/categories

---

## Step 5: Deploy to Production

### 5.1 Commit Changes
```bash
git add .
git commit -m "Configure Neon PostgreSQL database

🚀 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```

### 5.2 Deploy to Vercel
```bash
vercel --prod
```

---

## Step 6: Test Everything Works

### 6.1 Test Database Operations
```bash
# Test users API (should return empty array, not error)
curl "https://workload-insights-dashboard.vercel.app/api/users"
# Expected: {"users": []}

# Test categories API (should return empty array, not error)
curl "https://workload-insights-dashboard.vercel.app/api/categories"
# Expected: {"categories": []}
```

### 6.2 Test Webhook (Should Still Work)
```bash
curl "https://workload-insights-dashboard.vercel.app/api/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=my_verify_token_123&hub.challenge=test123"
# Expected: test123
```

### 6.3 Test Creating Data
```bash
# Create a test user
curl -X POST "https://workload-insights-dashboard.vercel.app/api/users" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "phone_number": "+1234567890", "role": "staff"}'

# Create a test category
curl -X POST "https://workload-insights-dashboard.vercel.app/api/categories" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Category"}'
```

---

## ✅ Success Criteria

After completing all steps, you should have:

- ✅ **Neon Database**: Created and accessible
- ✅ **Schema Deployed**: All tables created in Neon
- ✅ **Environment Variables**: Set in both local and Vercel
- ✅ **CRUD Operations**: APIs return data instead of "Internal Server Error"
- ✅ **Webhook Preserved**: WhatsApp webhook still returns `test123`
- ✅ **Production Ready**: App fully functional on Vercel

---

## 🔧 Troubleshooting

### Issue: "Internal Server Error" on API calls
**Solution:** Check Vercel environment variables are set correctly

### Issue: Database connection errors
**Solution:** Verify the connection string has `-pooler.` in the hostname

### Issue: Prisma client errors
**Solution:** Run `npx prisma generate` and redeploy

### Issue: Local development not working
**Solution:** Check `.env.local` file has correct Neon URLs

---

## 📊 Neon Dashboard Features

In your Neon dashboard you can:
- **Monitor database usage** and performance
- **View query statistics** and slow queries
- **Create database branches** for testing features
- **Manage connection pooling** settings
- **Scale compute** when needed (paid plans)

---

## 💰 Neon Free Tier Limits

- **Storage**: 3 GB
- **Compute**: 1 CU (compute unit)
- **Projects**: 1 project
- **Databases**: 1 database per project
- **Branches**: 10 branches

**Note:** These limits are generous for development and small production apps.

---

**Total Setup Time**: ~15 minutes  
**Cost**: Free (up to 3GB storage)  
**Result**: Full cloud PostgreSQL database with working CRUD operations and preserved webhook functionality