# Manual Vercel Environment Variable Setup

## Step 1: Login
```bash
vercel login
```

## Step 2: Add Environment Variables

### DATABASE_URL
```bash
echo "postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require" | vercel env add DATABASE_URL production
echo "postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require" | vercel env add DATABASE_URL preview
echo "postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require" | vercel env add DATABASE_URL development
```

### POSTGRES_PRISMA_URL
```bash
echo "postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require" | vercel env add POSTGRES_PRISMA_URL production
echo "postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require" | vercel env add POSTGRES_PRISMA_URL preview  
echo "postgres://neondb_owner:npg_9iyjdECXQIA7@ep-frosty-night-a2vjsg3k-pooler.eu-central-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require" | vercel env add POSTGRES_PRISMA_URL development
```

### CLAUDE_API_KEY
```bash
echo "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" | vercel env add CLAUDE_API_KEY production
echo "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" | vercel env add CLAUDE_API_KEY preview
echo "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" | vercel env add CLAUDE_API_KEY development
```

### ENCRYPTION_KEY  
```bash
echo "4de665b9cfdb476d1b90592d83b74d5e4a621d790cce3c2f25de4ffc836e4444" | vercel env add ENCRYPTION_KEY production
echo "4de665b9cfdb476d1b90592d83b74d5e4a621d790cce3c2f25de4ffc836e4444" | vercel env add ENCRYPTION_KEY preview
echo "4de665b9cfdb476d1b90592d83b74d5e4a621d790cce3c2f25de4ffc836e4444" | vercel env add ENCRYPTION_KEY development
```

### GEMINI_API_KEY
```bash
echo "test_key_for_development_health_check" | vercel env add GEMINI_API_KEY production
echo "test_key_for_development_health_check" | vercel env add GEMINI_API_KEY preview
echo "test_key_for_development_health_check" | vercel env add GEMINI_API_KEY development
```

## Step 3: Deploy
```bash
vercel --prod
```

## Step 4: Test Endpoints
```bash
curl "https://workload-insights-dashboard.vercel.app/api/health"
curl "https://workload-insights-dashboard.vercel.app/api/users"  
curl "https://workload-insights-dashboard.vercel.app/api/categories"
```