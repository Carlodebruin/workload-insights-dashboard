# Vercel Postgres Database Setup Guide

## ✅ Completed Preparations

- ✅ **Prisma Schema**: Updated to use PostgreSQL with `POSTGRES_PRISMA_URL`
- ✅ **Build Scripts**: Already configured with `prisma generate && next build`
- ✅ **Environment Template**: Added placeholder variables to `.env.local`

## 🚀 Step-by-Step Setup Instructions

### Step 1: Create Vercel Postgres Database

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Select your `workload-insights-dashboard` project

2. **Create Database:**
   - Navigate to the "Storage" tab
   - Click "Create Database" → "Postgres"
   - Database name: `workload-insights-db`
   - Select your preferred region (closest to you)
   - Click "Create"

3. **Copy Connection Strings:**
   After creation, Vercel will provide these environment variables:
   ```bash
   POSTGRES_URL="postgresql://..."
   POSTGRES_PRISMA_URL="postgresql://..."
   POSTGRES_URL_NON_POOLING="postgresql://..."
   POSTGRES_USER="..."
   POSTGRES_HOST="..."
   POSTGRES_PASSWORD="..."
   POSTGRES_DATABASE="..."
   ```

### Step 2: Configure Environment Variables

1. **In Vercel Dashboard:**
   - Go to Project Settings → Environment Variables
   - Add each variable with their values:
     - `POSTGRES_URL`
     - `POSTGRES_PRISMA_URL` 
     - `POSTGRES_URL_NON_POOLING`
     - `CLAUDE_API_KEY` (if not already set)
   - Set environment to "Production, Preview, and Development"

2. **Update Local .env.local:**
   Replace the placeholder values in `.env.local` with actual Vercel database URLs:
   ```bash
   # Replace these lines with actual values from Vercel:
   POSTGRES_URL=your_actual_postgres_url
   POSTGRES_PRISMA_URL=your_actual_prisma_url
   POSTGRES_URL_NON_POOLING=your_actual_non_pooling_url
   ```

### Step 3: Deploy Schema and Test

1. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

2. **Push Schema to Database:**
   ```bash
   npx prisma db push
   ```

3. **Commit and Deploy:**
   ```bash
   git add .
   git commit -m "Configure Vercel Postgres database

   🚀 Generated with [Claude Code](https://claude.ai/code)

   Co-Authored-By: Claude <noreply@anthropic.com>"
   git push origin main
   ```

4. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

### Step 4: Test Everything Works

1. **Test Database Operations:**
   ```bash
   # Test users API
   curl "https://workload-insights-dashboard.vercel.app/api/users"
   # Should return: {"users": []} (empty array initially)

   # Test categories API
   curl "https://workload-insights-dashboard.vercel.app/api/categories"
   # Should return: {"categories": []} (empty array initially)
   ```

2. **Test Webhook (Should Still Work):**
   ```bash
   curl "https://workload-insights-dashboard.vercel.app/api/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=my_verify_token_123&hub.challenge=test123"
   # Should return: test123
   ```

3. **Test Creating a User:**
   ```bash
   curl -X POST "https://workload-insights-dashboard.vercel.app/api/users" \
     -H "Content-Type: application/json" \
     -d '{"name": "Test User", "phone_number": "+1234567890", "role": "staff"}'
   # Should return success with user data
   ```

### Step 5: Optional Data Migration

If you want to migrate data from your local SQLite database:

1. **Export Local Data:**
   ```bash
   # This would require custom migration scripts
   # For now, you can manually recreate test data via the API
   ```

2. **Seed Production Database:**
   ```bash
   # If you have a seed script
   npx prisma db seed
   ```

## 🎯 Expected Results

After completing all steps:

✅ **Database Connection**: Vercel app connects to Postgres database  
✅ **CRUD Operations**: All API endpoints work without "Internal Server Error"  
✅ **Users API**: Returns `{"users": []}` instead of error  
✅ **Categories API**: Returns `{"categories": []}` instead of error  
✅ **Webhook Preserved**: WhatsApp webhook still returns `test123`  
✅ **Schema Deployed**: All tables created in Vercel Postgres  

## 🔧 Troubleshooting

**If CRUD operations still fail:**
1. Check Vercel logs: `vercel logs`
2. Verify environment variables are set in Vercel dashboard
3. Ensure `POSTGRES_PRISMA_URL` is used (not `POSTGRES_URL`)
4. Check if Prisma client was regenerated after schema change

**If build fails:**
1. Verify Prisma schema syntax: `npx prisma validate`
2. Check if all environment variables are available during build
3. Review build logs in Vercel dashboard

## 📍 Current Status

- **Webhook**: ✅ Working perfectly (returns `test123`)
- **Database**: ⏳ Needs Vercel Postgres setup and environment variables
- **Schema**: ✅ Updated for PostgreSQL
- **Build Scripts**: ✅ Already configured
- **Claude API**: ✅ Key ready to be set in Vercel

---
**Next Steps:** Follow the manual steps above to complete the database setup, then test both webhook and CRUD functionality.