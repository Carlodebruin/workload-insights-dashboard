# Claude Code Project Instructions

## Project Overview
This is a **Workload Insights Dashboard** - a Next.js application for managing activities, incidents, and workloads with AI-powered parsing and WhatsApp integration.

## Key Project Details
- **Framework**: Next.js 14 with App Router
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS
- **AI Integration**: Multiple providers (DeepSeek, Gemini, Claude)
- **External APIs**: Twilio/WhatsApp, Vercel deployment
- **Architecture**: Full-stack with API routes, React components, and server-side logic

## Critical Commands & Scripts

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production (includes Prisma generate)
npm run lint         # Run ESLint
```

### Database
```bash
npm run db:seed      # Seed database with initial data
npx prisma generate  # Generate Prisma client
npx prisma db push   # Push schema changes to database
```

### Testing & Compliance
```bash
npm run test:security     # Run security tests
npm run test:pii         # Test PII redaction
npm run compliance:check # Check compliance status
```

## Key Architecture Patterns

### API Routes (`app/api/`)
- RESTful endpoints following Next.js App Router conventions
- Authentication middleware for protected routes
- Rate limiting implementation
- Error handling with proper HTTP status codes

### Database Schema (`prisma/schema.prisma`)
- Activities, Users, Categories, WhatsApp messages
- LLM configurations for AI providers
- Geofencing and location tracking

### AI Integration (`lib/ai-factory.ts`, `lib/ai-providers.ts`)
- Factory pattern for multiple AI providers
- Fallback to mock provider if API keys missing
- Message parsing for WhatsApp incidents

### WhatsApp Integration (`lib/whatsapp/`)
- Twilio webhook handling
- Message parsing and classification
- Template management for responses

## Development Guidelines

### Code Style
- Use TypeScript for all new code
- Follow existing patterns in components and API routes
- Use proper error boundaries and error handling
- Implement proper validation with Zod schemas

### Database Operations
- Always use Prisma client from `lib/prisma.ts`
- Include proper error handling for database operations
- Use transactions for complex operations
- Follow the existing schema patterns

### Security Considerations
- Never commit API keys or secrets
- Use environment variables for configuration
- Implement proper input validation
- Follow GDPR compliance patterns already established

### AI/LLM Integration
- Use the AI factory pattern (`getWorkingAIProvider()`)
- Handle API failures gracefully with fallbacks
- Implement proper rate limiting
- Test with mock providers when API keys unavailable

## Environment Variables Required
```bash
# Database
DATABASE_URL="postgresql://..."

# AI Providers (at least one required)
CLAUDE_API_KEY="sk-..."
DEEPSEEK_API_KEY="sk-..."
GEMINI_API_KEY="..."

# WhatsApp/Twilio
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER_ID="..."

# Encryption
ENCRYPTION_KEY="..."

# Rate Limiting
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."
```

## Common Tasks

### Adding New API Endpoints
1. Create file in `app/api/[endpoint]/route.ts`
2. Implement GET, POST, PUT, DELETE as needed
3. Add proper validation with Zod
4. Include error handling and logging
5. Test with appropriate HTTP status codes

### Adding New React Components
1. Create in `components/` or `page-components/`
2. Use TypeScript interfaces for props
3. Follow existing styling patterns with Tailwind
4. Implement proper error boundaries
5. Use appropriate hooks from `hooks/`

### Database Schema Changes
1. Modify `prisma/schema.prisma`
2. Run `npx prisma db push` for development
3. Create migration for production
4. Update seed file if needed
5. Regenerate Prisma client

### AI Provider Integration
1. Add provider class in `lib/providers/`
2. Register in `lib/ai-providers.ts`
3. Add configuration in database
4. Test with factory pattern
5. Implement proper error handling

## Debugging & Testing

### Local Development
- Check `server.log` for application logs
- Use browser dev tools for client-side debugging
- Test API endpoints with tools like Postman
- Use the diagnostic endpoints for system health

### Common Issues
- **Database connection**: Check DATABASE_URL format
- **AI parsing failures**: Verify API keys and rate limits  
- **WhatsApp integration**: Check Twilio configuration
- **Build errors**: Run `npx prisma generate` first

### Performance Optimization
- Use React.memo for heavy components
- Implement proper caching strategies
- Optimize database queries with Prisma
- Monitor bundle size and loading times

## Production Considerations
- Always run tests before deployment
- Use environment-specific configurations
- Monitor API rate limits and usage
- Implement proper logging and monitoring
- Follow security best practices for secrets management

## Recent Major Changes
- Enhanced AI provider system with multiple providers
- Improved WhatsApp message processing
- Added comprehensive error handling
- Implemented rate limiting and security measures
- Updated to Next.js 14 with App Router

## Help Commands
When working on this project, you can:
- `npm run dev` to start development
- Check logs in `server.log` for debugging
- Use diagnostic endpoints at `/api/diagnostics`
- Review existing patterns in similar components/routes