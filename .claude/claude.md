# Workload Insights Dashboard - Claude Code Configuration

This is a Next.js application for tracking workplace incidents and activities with WhatsApp integration.

## Project Overview

A workload insights dashboard that helps organizations:
- Track and manage incidents reported via WhatsApp
- Monitor activity status and assignments
- Provide staff notifications and updates
- Generate insights through AI-powered analysis

## Key Technologies

- **Framework**: Next.js 14 with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Custom token-based system (demo mode)
- **Messaging**: Twilio WhatsApp Business API
- **AI Integration**: Multiple AI providers (Claude, Gemini, etc.)
- **Deployment**: Vercel with Neon PostgreSQL

## Project Structure

- `app/api/` - API routes for backend functionality
- `components/` - React components
- `lib/` - Utility libraries and configurations
- `prisma/` - Database schema and migrations
- `hooks/` - Custom React hooks
- `contexts/` - React context providers

## Important Commands

```bash
# Development
npm run dev

# Database
npx prisma generate
npx prisma db push
npx prisma studio

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Key Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `CLAUDE_API_KEY` - Claude AI API key
- `TWILIO_ACCOUNT_SID` - Twilio account identifier
- `TWILIO_AUTH_TOKEN` - Twilio authentication token
- `WHATSAPP_PHONE_NUMBER_ID` - WhatsApp Business phone number ID

## Authentication

Currently using demo tokens for development:
- `demo-admin-token` - Full admin access
- `demo-manager-token` - Management permissions
- `demo-user-token` - Standard user access
- `demo-viewer-token` - Read-only access

## Recent Work

- Implemented WhatsApp webhook integration
- Fixed Twilio rate limit issues with mock mode
- Added comprehensive staff notification system
- Created activity tracking and assignment workflows