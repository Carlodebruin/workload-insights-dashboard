import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const envCheck = {
      DATABASE_URL: !!process.env.DATABASE_URL ? 'SET' : 'MISSING',
      POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL ? 'SET' : 'MISSING',
      CLAUDE_API_KEY: !!process.env.CLAUDE_API_KEY ? 'SET' : 'MISSING',
      ENCRYPTION_KEY: !!process.env.ENCRYPTION_KEY ? 'SET' : 'MISSING',
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY ? 'SET' : 'MISSING',
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json(envCheck);
  } catch (error) {
    return NextResponse.json({ error: 'Debug failed' }, { status: 500 });
  }
}