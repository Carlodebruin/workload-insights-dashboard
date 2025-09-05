# Vercel Deployment Guide

## Current Issue
The Vercel deployment is returning 401 Authentication Required errors due to **Vercel Deployment Protection**, which is a separate authentication layer from the application's middleware.

## Two Authentication Layers
1. **Vercel Deployment Protection** - External layer managed by Vercel
2. **Application Middleware** - Internal authentication in the app

## Quick Fix: Disable Vercel Deployment Protection
1. Go to Vercel dashboard → Project Settings → Deployment Protection
2. Disable protection for production environment
3. Redeploy the application

## Alternative: Configure Application Authentication
If you want to keep Vercel protection enabled, configure the app to use authentication tokens:

Set in Vercel environment variables:
```
REQUIRE_AUTH=true
```

## Proper Setup: Configure Authentication

### 1. Vercel Environment Variables
Add these environment variables to your Vercel dashboard:

**Required:**
```
REQUIRE_AUTH=true
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

**Optional (for demo/testing):**
```
REQUIRE_AUTH=false  # Disable auth for testing
```

### 2. Using Authentication Tokens
When authentication is enabled, you need to include a Bearer token in your requests:

**Demo Tokens (for testing):**
- Admin: `demo-admin-token`
- Manager: `demo-manager-token` 
- User: `demo-user-token`
- Viewer: `demo-viewer-token`

**Example curl command with authentication:**
```bash
curl -X POST https://your-vercel-app.vercel.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-admin-token" \
  -d '{
    "history": [],
    "message": "Test production",
    "stream": false
  }'
```

### 3. Testing the Deployment

Use the provided test script with authentication:
```bash
# Test with authentication
node scripts/test-production-deployment.js
```

Or test manually:
```bash
# Test health endpoint
curl -H "Authorization: Bearer demo-admin-token" \
  https://your-vercel-app.vercel.app/api/health

# Test AI chat
curl -X POST https://your-vercel-app.vercel.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-admin-token" \
  -d '{"history": [], "message": "Test", "stream": false}'
```

### 4. Environment Variables Checklist

Ensure these environment variables are set in Vercel:

**Database:**
```
DATABASE_URL=postgres://...
DATABASE_URL_UNPOOLED=postgres://...
```

**AI Providers (at least one required):**
```
DEEPSEEK_API_KEY=your_deepseek_key
GEMINI_API_KEY=your_gemini_key  
CLAUDE_API_KEY=your_claude_key
KIMI_API_KEY=your_kimi_key
```

**Authentication:**
```
REQUIRE_AUTH=true
JWT_SECRET=your-super-secret-jwt-key
```

**Encryption:**
```
ENCRYPTION_KEY=your-32-character-encryption-key
```

**Twilio/WhatsApp (optional):**
```
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890
```

### 5. Deployment Commands

```bash
# Deploy to Vercel
npm run build
vercel --prod

# Or use Vercel CLI
vercel login
vercel
vercel --prod
```

### 6. Troubleshooting

**Common Issues:**

1. **Vercel Authentication Page (HTML response)**
   - **Symptom**: HTML page with "Authentication Required"
   - **Cause**: Vercel Deployment Protection is enabled
   - **Solution**: Disable in Vercel dashboard → Settings → Deployment Protection

2. **401 Unauthorized (JSON response)**
   - **Symptom**: `{"error": "Unauthorized"}`
   - **Cause**: Application middleware requires authentication
   - **Solution**: Include `Authorization: Bearer demo-admin-token` header

3. **Database Errors**
   - **Cause**: DATABASE_URL not configured in Vercel
   - **Solution**: Add database connection string to environment variables

4. **AI Provider Errors**
   - **Cause**: No AI API keys configured
   - **Solution**: Add at least one AI provider API key

5. **Build Failures**
   - **Cause**: Missing prisma generate step
   - **Solution**: Run `prisma generate` before building

**Debug Commands:**
```bash
# Check environment (bypass Vercel protection if needed)
curl "https://your-vercel-app.vercel.app/api/debug-env?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=your_token"

# Test database connection
curl -H "Authorization: Bearer demo-admin-token" \
  https://your-vercel-app.vercel.app/api/health/database

# Test AI providers
curl -H "Authorization: Bearer demo-admin-token" \
  https://your-vercel-app.vercel.app/api/ai/providers
```

### 7. Vercel Bypass Tokens (For Automation)

If you need to bypass Vercel protection for automated testing:

1. Get bypass token from Vercel dashboard → Deployment Protection
2. Use in URLs:
```
https://your-app.vercel.app/api/endpoint?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=your_token
```

**Example with curl:**
```bash
curl "https://your-app.vercel.app/api/ai/chat?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=your_token" \
  -H "Content-Type: application/json" \
  -d '{"history": [], "message": "Test", "stream": false}'
```

### 7. Production Readiness Checklist

- [ ] All environment variables configured in Vercel dashboard
- [ ] Database connection working
- [ ] AI providers configured with valid API keys
- [ ] Authentication properly set up
- [ ] All API endpoints tested with authentication
- [ ] Error handling and logging working
- [ ] CORS headers configured correctly