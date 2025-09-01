# Project Coding Rules (Non-Obvious Only)

- Always use `withDb()` from `lib/db-wrapper.ts` instead of direct Prisma calls (prevents connection failures)
- Use `withDbCritical()` for operations that must not fail (5 retries vs 3)
- AI provider fallback is automatic via `getWorkingAIProvider()` - never create providers directly
- WhatsApp webhook responses MUST return TwiML XML via `createTwiMLResponse()` function
- Database connection pool params auto-added to DATABASE_URL if missing (connection_limit=10)
- Rate limiting falls back to in-memory Map if Redis unavailable (graceful degradation)
- All API keys stored encrypted in database - use `decrypt()` from `lib/encryption.ts`
- PII redaction is automatic in `logSecure*()` functions - never use console.log for sensitive data
- Prisma client has singleton pattern with connection retry logic built-in
- AI parsing falls back to simple parser if provider fails - implement both paths
- WhatsApp command system auto-initializes on import - no manual setup needed
- Build process requires `prisma generate` before `next build` or it fails