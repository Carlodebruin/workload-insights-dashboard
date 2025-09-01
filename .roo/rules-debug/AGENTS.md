# Project Debug Rules (Non-Obvious Only)

- Database connection logs with dev query warnings (>500ms yellow, >1000ms red in console)
- AI provider fallback statistics tracked in `getFallbackStatistics()` for diagnostics
- Rate limiting errors logged but requests continue (graceful degradation mode)
- PII redaction has multiple levels via `PII_REDACTION_LEVEL` environment variable
- Security tests run via `tsx tests/security.test.ts` not standard test runner
- Database retry logic detects specific errors: "Closed", "ECONNRESET", P1001, P1017
- Connection pool info available via `connectionPool.getConnectionInfo()`
- WhatsApp webhook processing always returns TwiML XML even on errors
- AI provider test timeout is 8 seconds - longer than typical API timeouts
- Prisma client singleton reused in dev to prevent connection exhaustion
- Must use `tsx` not `ts-node` for running TypeScript files in this project
- Database operations wrapped in exponential backoff (1s, 2s, 4s delays)