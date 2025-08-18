import { NextRequest, NextResponse } from 'next/server';
import { whatsappTemplateManager } from '../../../../../lib/whatsapp/template-manager';
import { withAuth } from '../../../../../lib/auth-context';
import { logSecureInfo, logSecureError, createRequestContext } from '../../../../../lib/secure-logger';

/**
 * WhatsApp Template Initialization API Endpoint
 */

/**
 * POST - Initialize default system templates
 */
export const POST = withAuth(async (request: NextRequest) => {
  const requestContext = createRequestContext('initialize_whatsapp_templates', 'POST');
  
  try {
    // Initialize default templates
    await whatsappTemplateManager.initializeDefaultTemplates();

    // Get all templates to return current state
    const templates = await whatsappTemplateManager.getApprovedTemplates();

    logSecureInfo('WhatsApp templates initialized', {
      ...requestContext,
      statusCode: 200
    }, {
      templateCount: templates.length
    });

    return NextResponse.json({
      success: true,
      message: 'Default templates initialized successfully',
      templateCount: templates.length,
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        status: t.status
      }))
    });
  } catch (error) {
    logSecureError('Failed to initialize WhatsApp templates', {
      ...requestContext,
      statusCode: 500
    }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
});