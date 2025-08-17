import { NextResponse } from 'next/server';
import { AI_PROVIDERS, getAvailableProviders, getDefaultProvider } from '../../../../lib/ai-providers';

export async function GET() {
  try {
    const availableProviders = getAvailableProviders();
    const defaultProvider = getDefaultProvider();
    
    const providersWithDetails = availableProviders.map(provider => ({
      id: provider,
      ...AI_PROVIDERS[provider]
    }));

    return NextResponse.json({
      providers: providersWithDetails,
      default: defaultProvider,
      available: availableProviders
    });
  } catch (error) {
    console.error('Error getting AI providers:', error);
    return NextResponse.json({ error: 'Failed to get AI providers' }, { status: 500 });
  }
}