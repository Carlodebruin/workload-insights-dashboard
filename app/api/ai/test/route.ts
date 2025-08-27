import { NextResponse } from 'next/server';
import { createAIProviderSafe } from '../../../../lib/ai-factory';
import { prisma } from '../../../../lib/prisma';
import { decrypt } from '../../../../lib/encryption';

export async function POST(request: Request) {
  try {
    const { provider, message } = await request.json();

    if (!provider || !message) {
      return NextResponse.json({ error: 'Missing provider or message' }, { status: 400 });
    }

    // Fetch the LLM configuration for the requested provider
    const llmConfig = await prisma.llmConfiguration.findFirst({
      where: {
        provider: provider,
        isActive: true,
      },
      include: {
        apiKey: true,
      },
    });

    let apiKey: string | undefined = undefined;
    if (llmConfig && llmConfig.apiKey) {
      apiKey = decrypt(llmConfig.apiKey.encryptedKey);
    }

    const aiProvider = createAIProviderSafe(provider, apiKey);

    if (!aiProvider) {
      return NextResponse.json({ error: `AI provider "${provider}" is not configured or enabled.` }, { status: 500 });
    }

    const response = await aiProvider.generateContent(message);

    if (response) {
      return NextResponse.json({ success: true, response });
    } else {
      return NextResponse.json({ error: 'Failed to get response from AI provider' }, { status: 500 });
    }
  } catch (error) {
    console.error('AI Test Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: `Failed to test AI provider: ${errorMessage}` }, { status: 500 });
  }
}
