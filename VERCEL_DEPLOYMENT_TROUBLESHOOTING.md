# Vercel Deployment Troubleshooting Guide

## Current Issue: 401 Authentication Required in Production

The production deployment at `https://workload-insights-dashboard-im1c2ktd3-carlo-de-bruins-projects.vercel.app` is returning 401 Authentication Required errors due to Vercel's deployment protection system.

## Root Cause Analysis

### 1. Vercel Deployment Protection
Vercel has an additional authentication layer called "Deployment Protection" that intercepts requests before they reach your application. This is separate from your application's authentication middleware.

### 2. Two Layers of Authentication
- **Layer 1**: Vercel Deployment Protection (external to your app)
- **Layer 2**: Application Middleware (your custom authentication)

## Solution Steps

### Step 1: Disable Vercel Deployment Protection

1. Go to your Vercel dashboard
2. Select your project: `workload-insights-dashboard`
3. Go to Settings → Deployment Protection
4. Disable deployment protection for the production environment
5. Alternatively, configure allowed bypass tokens for automation

### Step 2: Redeploy the Application

After making middleware changes, you must redeploy:

```bash
# Deploy to Vercel
vercel --prod

# Or push to main branch if connected to GitHub
git push origin main
```

### Step 3: Verify Environment Variables

Ensure these environment variables are set in Vercel dashboard:

```bash
# Required for authentication bypass
REQUIRE_AUTH=false

# Database connection
DATABASE_URL=your_postgres_connection_string

# AI API Keys (optional for demo)
DEEPSEEK_API_KEY=your_key
CLAUDE_API_KEY=your_key  
GEMINI_API_KEY=your_key
KIMI_API_KEY=your_key
```

## Testing Production Deployment

### Test Without Authentication Bypass
```bash
curl -X POST https://your-domain.vercel.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"history": [], "message": "Test", "stream": false}' \
  -v
```

### Test With Authentication (if needed)
```bash
curl -X POST https://your-domain.vercel.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-admin-token" \
  -d '{"history": [], "message": "Test", "stream": false}' \
  -v
```

## Middleware Configuration

The application middleware has been updated to:

1. **Detect Vercel environments** using multiple indicators:
   - `VERCEL_ENV` environment variable
   - `VERCEL` environment variable  
   - `VERCEL_URL` environment variable
   - `VERCEL_REGION` environment variable
   - `x-vercel-id` request header
   - `x-vercel-deployment-url` request header

2. **Bypass authentication** when Vercel environment is detected
3. **Maintain security headers** for all responses

## Emergency Bypass Options

### Option A: Temporary Disable All Authentication
```typescript
// In middleware.ts - temporary override
const isPublicEndpoint = true; // Force all endpoints public
```

### Option B: Environment Variable Control
```bash
# Set this in Vercel dashboard to disable auth
REQUIRE_AUTH=false
```

### Option C: Vercel Bypass Token
Use Vercel's built-in bypass mechanism:
```
https://your-domain.vercel.app/api/endpoint?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=your_bypass_token
```

## Verification Checklist

- [ ] Vercel Deployment Protection is disabled
- [ ] Application has been redeployed after middleware changes
- [ ] Environment variables are properly configured
- [ ] `/api/health` endpoint returns 200 without authentication
- [ ] `/api/ai/chat` endpoint works without authentication
- [ ] Security headers are still present in responses

## Common Error Messages

### Vercel Authentication Page
**Symptom**: HTML response with "Authentication Required"
**Solution**: Disable Vercel Deployment Protection

### 401 Unauthorized from Application
**Symptom**: JSON response with `{"error": "Unauthorized"}`
**Solution**: Middleware is not bypassing authentication - check Vercel environment detection

### 500 Internal Server Error
**Symptom**: Generic server error
**Solution**: Check environment variables and database connection

## Support Resources

- [Vercel Deployment Protection Docs](https://vercel.com/docs/deployment-protection)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Vercel CLI Deployment](https://vercel.com/docs/cli/deploy)
