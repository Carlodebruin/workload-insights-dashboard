import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function DELETE(
  request: NextRequest,
  { params }: { params: { configId: string } }
) {
  try {
    // Authentication check
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    if (token !== 'demo-admin-token') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { configId } = params;

    if (!configId) {
      return NextResponse.json({ error: 'Configuration ID is required' }, { status: 400 });
    }

    // Check if configuration exists
    const existingConfig = await prisma.whatsAppConfig.findUnique({
      where: { id: configId }
    });

    if (!existingConfig) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
    }

    // Delete the configuration
    await prisma.whatsAppConfig.delete({
      where: { id: configId }
    });

    return NextResponse.json({ 
      message: 'Configuration deleted successfully',
      deletedConfig: { id: configId, key: existingConfig.key }
    });

  } catch (error) {
    console.error('Failed to delete WhatsApp configuration:', error);
    return NextResponse.json(
      { error: 'Failed to delete configuration' },
      { status: 500 }
    );
  }
}