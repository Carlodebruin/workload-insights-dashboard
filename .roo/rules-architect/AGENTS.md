# Project Architecture Rules (Non-Obvious Only)

- AI provider system uses factory pattern with automatic fallback and health monitoring (not typical singleton)
- Database operations wrapped in exponential backoff retry logic at infrastructure level, not application level
- Rate limiting gracefully degrades to in-memory storage when Redis unavailable (dual-mode architecture)
- WhatsApp webhook processing must return TwiML XML format - HTTP JSON responses will fail
- Prisma client singleton with dev-mode query performance monitoring (>500ms warnings built-in)
- Security logging automatically redacts PII at infrastructure level, not application responsibility
- Database connection pool parameters auto-injected into DATABASE_URL if missing (transparent modification)
- AI parsing has mandatory dual-path architecture: AI provider + simple fallback parser
- WhatsApp command system auto-initializes on module import (not explicit initialization required)
- Build pipeline has hidden dependency chain: prisma generate → next build (not parallel)
- Encrypted API key storage with project-specific encryption implementation (not standard env vars)
- Connection resilience patterns implemented at wrapper level, not embedded in business logic