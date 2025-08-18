import { NextRequest, NextResponse } from 'next/server';
import { whatsappTemplateManager } from '../../../../../lib/whatsapp/template-manager';
import { withAuth } from '../../../../../lib/auth-context';
import { logSecureInfo, logSecureError, createRequestContext } from '../../../../../lib/secure-logger';

/**
 * Individual WhatsApp Template Management API Endpoints
 */

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET - Get a specific template by ID or name
 */
export const GET = withAuth(async (request: NextRequest, { params }: RouteParams) => {
  const requestContext = createRequestContext('get_whatsapp_template', 'GET');
  const templateId = params.id;
  
  try {
    // Try to get by name first (more common), then by ID
    let template = await whatsappTemplateManager.getTemplate(templateId);
    
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Get analytics for this specific template
    const analytics = await whatsappTemplateManager.getTemplateAnalytics(template.name);

    logSecureInfo('WhatsApp template retrieved', {
      ...requestContext,
      statusCode: 200
    }, {
      templateId: template.id,
      templateName: template.name,
      category: template.category
    });

    return NextResponse.json({
      template,
      analytics: analytics[0] || null
    });
  } catch (error) {
    logSecureError('Failed to get WhatsApp template', {
      ...requestContext,
      statusCode: 500
    }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
});

/**
 * DELETE - Delete a template
 */
export const DELETE = withAuth(async (request: NextRequest, { params }: RouteParams) => {
  const requestContext = createRequestContext('delete_whatsapp_template', 'DELETE');
  const templateId = params.id;
  
  try {
    // Get template first to log details
    const template = await whatsappTemplateManager.getTemplate(templateId);
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Delete template
    const result = await whatsappTemplateManager.deleteTemplate(template.id);

    if (result.success) {
      logSecureInfo('WhatsApp template deleted', {
        ...requestContext,
        statusCode: 200
      }, {
        templateId: template.id,
        templateName: template.name,
        category: template.category
      });

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to delete template' },
        { status: 400 }
      );
    }
  } catch (error) {
    logSecureError('Failed to delete WhatsApp template', {
      ...requestContext,
      statusCode: 500
    }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
});