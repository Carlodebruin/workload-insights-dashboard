import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { AI_PROVIDERS } from '../../../../lib/ai-providers';

export async function GET() {
  try {
    const configurations = await prisma.llmConfiguration.findMany({
      where: {
        isActive: true,
      },
      select: {
        provider: true,
        isDefault: true,
      },
    });

    const availableProviders = Array.from(new Set(configurations.map(c => c.provider)));
    
    let defaultProvider = configurations.find(c => c.isDefault)?.provider;
    if (!defaultProvider && availableProviders.length > 0) {
      defaultProvider = availableProviders[0];
    }

    const providersWithDetails = availableProviders.map(provider => ({
      id: provider,
      ...AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]
    }));

    return NextResponse.json({
      providers: providersWithDetails,
      default: defaultProvider,
      available: availableProviders,
    });
  } catch (error) {
    console.error('Error getting AI providers:', error);
    return NextResponse.json({ error: 'Failed to get AI providers' }, { status: 500 });
  }
}
