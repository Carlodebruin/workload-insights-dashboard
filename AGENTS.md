# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Non-Obvious Build Commands

- `npm run build` includes `prisma generate` - always runs before build
- `npm run postinstall` auto-generates Prisma client after dependencies
- `npm run compliance:execute` - runs cleanup AND executes (destructive)
- `npm run test:pii-strict` / `test:pii-minimal` - PII redaction level variants

## Critical Custom Utilities

- Use `withDb()` from `lib/db-wrapper.ts` instead of direct Prisma calls (auto-retry on connection failures)
- Use `withDbCritical()` for operations that absolutely cannot fail (higher retry count)
- Always use `logSecureError/Info/Warning()` from `lib/secure-logger.ts` - auto-redacts PII
- Database has connection pool params auto-added in `lib/prisma.ts` if missing from DATABASE_URL
- AI provider fallback system: `getWorkingAIProvider()` tests providers with 8s timeout, falls back to MockProvider
- Rate limiting uses in-memory Map if Redis not configured (dev/fallback mode)

## Non-Standard Architecture Patterns

- Prisma client singleton pattern with dev query logging (>500ms warnings, >1000ms slow warnings)
- AI providers use factory pattern with automatic fallback tracking and statistics
- WhatsApp webhook responses MUST be TwiML XML format (`createTwiMLResponse()`)
- Database operations wrapped in exponential backoff retry logic (detects "Closed", "ECONNRESET", P1001/P1017 errors)
- All sensitive data encrypted in database (`ApiKey.encryptedKey` field, use `decrypt()` from `lib/encryption.ts`)

## Hidden Dependencies

- Build requires `prisma generate` BEFORE `next build` or build fails
- WhatsApp command system auto-initializes on import (`WhatsAppCommandSystem.initialize()`)
- Database connection params automatically modified for Neon PostgreSQL compatibility
- Rate limiting gracefully degrades to in-memory if Redis unavailable (logs error but continues)
- AI parsing falls back to simple parser if AI provider fails

## Testing Gotchas

- PII tests have multiple redaction levels via environment variable
- Security tests via `tsx tests/security.test.ts` (not standard test framework)
- Database seed via `prisma db seed` not `npm run seed`
- Must use `tsx` not `ts-node` for TypeScript execution