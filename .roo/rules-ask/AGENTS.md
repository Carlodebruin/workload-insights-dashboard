# Project Documentation Rules (Non-Obvious Only)

- CLAUDE.md contains full project instructions but focuses on general usage patterns
- Database schema has extensive composite indexes for specific query patterns (not obvious from model names)
- AI provider factory pattern abstracts multiple providers with automatic fallback logic
- WhatsApp integration has complex command system with role-based permissions in `lib/whatsapp/command-system.ts`
- Rate limiting is context-aware with different limits per endpoint type (auth:5, ai:10, read:100, write:30)
- PII redaction system has configurable levels and operates automatically in logging functions
- Database connection resilience built into wrapper functions rather than at model level
- Encryption/decryption for API keys uses project-specific implementation in `lib/encryption.ts`
- Prisma client auto-configures connection pool parameters for Neon PostgreSQL compatibility
- Security headers configured in `next.config.js` with CORS allowance for API endpoints
- Testing has separate PII compliance variants with environment-driven redaction levels
- Build process has hidden dependency: Prisma generate must run before Next.js build