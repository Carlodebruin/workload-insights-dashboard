import { NextRequest, NextResponse } from 'next/server';
import { whatsappTemplateManager, CreateTemplateRequest } from '../../../../lib/whatsapp/template-manager';
import { withAuth } from '../../../../lib/auth-context';
import { logSecureInfo, logSecureError, createRequestContext } from '../../../../lib/secure-logger';
import { z } from 'zod';

/**
 * WhatsApp Template Management API Endpoints
 */

// Validation schemas
const templateComponentSchema = z.object({
  type: z.enum(['header', 'body', 'footer', 'buttons']),
  format: z.enum(['text', 'image', 'video', 'document']).optional(),
  text: z.string().optional(),
  parameters: z.array(z.object({
    type: z.enum(['text', 'currency', 'date_time']),
    text: z.string()
  })).optional(),
  buttons: z.array(z.object({
    type: z.enum(['quick_reply', 'url', 'phone_number']),
    text: z.string(),
    payload: z.string().optional(),
    url: z.string().optional(),
    phone_number: z.string().optional()
  })).optional()
});

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').regex(/^[a-z0-9_]+$/, 'Name must contain only lowercase letters, numbers, and underscores'),
  language: z.string().length(2, 'Language must be a 2-character ISO code'),
  category: z.enum(['utility', 'marketing', 'authentication']),
  components: z.array(templateComponentSchema).min(1, 'At least one component is required')
});

const templateMessageSchema = z.object({
  templateName: z.string().min(1, 'Template name is required'),
  languageCode: z.string().default('en'),
  parameters: z.array(z.object({
    type: z.enum(['text', 'currency', 'date_time']),
    text: z.string()
  })).optional()
});

/**
 * GET - Get all approved templates or filter by category
 */
export const GET = withAuth(async (request: NextRequest) => {
  const requestContext = createRequestContext('get_whatsapp_templates', 'GET');
  
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as 'utility' | 'marketing' | 'authentication' | null;
    const analytics = searchParams.get('analytics') === 'true';

    let templates;
    if (category) {
      templates = await whatsappTemplateManager.getTemplatesByCategory(category);
    } else {
      templates = await whatsappTemplateManager.getApprovedTemplates();
    }

    let response: any = {
      templates,
      total: templates.length
    };

    // Include analytics if requested
    if (analytics) {
      const analyticsData = await whatsappTemplateManager.getTemplateAnalytics();
      response.analytics = analyticsData;
    }

    logSecureInfo('WhatsApp templates retrieved', {
      ...requestContext,
      statusCode: 200
    }, {
      templateCount: templates.length,
      category,
      includeAnalytics: analytics
    });

    return NextResponse.json(response);
  } catch (error) {
    logSecureError('Failed to get WhatsApp templates', {
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
 * POST - Create a new template or build template message
 */
export const POST = withAuth(async (request: NextRequest) => {
  const requestContext = createRequestContext('create_whatsapp_template', 'POST');
  
  try {
    const body = await request.json();
    
    // Check if this is a template creation or message building request
    if (body.action === 'build_message') {
      return await handleBuildTemplateMessage(body, requestContext);
    }

    // Validate template creation request
    const validatedData = createTemplateSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { 
          error: 'Invalid template data',
          details: validatedData.error.issues.map(issue => issue.message)
        },
        { status: 400 }
      );
    }

    // Create template
    const result = await whatsappTemplateManager.createOrUpdateTemplate(validatedData.data);

    if (result.success) {
      logSecureInfo('WhatsApp template created', {
        ...requestContext,
        statusCode: 201
      }, {
        templateId: result.templateId,
        templateName: validatedData.data.name,
        category: validatedData.data.category
      });

      return NextResponse.json({
        success: true,
        templateId: result.templateId,
        templateName: validatedData.data.name
      }, { status: 201 });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to create template' },
        { status: 400 }
      );
    }
  } catch (error) {
    logSecureError('Failed to create WhatsApp template', {
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
 * Handle building template message for sending
 */
async function handleBuildTemplateMessage(body: any, requestContext: any) {
  const validatedData = templateMessageSchema.safeParse(body);
  if (!validatedData.success) {
    return NextResponse.json(
      { 
        error: 'Invalid template message data',
        details: validatedData.error.issues.map(issue => issue.message)
      },
      { status: 400 }
    );
  }

  try {
    // Get template to verify it exists
    const template = await whatsappTemplateManager.getTemplate(validatedData.data.templateName);
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Build template message
    const templateMessage = whatsappTemplateManager.buildTemplateMessage(
      validatedData.data.templateName,
      validatedData.data.parameters || []
    );

    logSecureInfo('Template message built', {
      ...requestContext,
      statusCode: 200
    }, {
      templateName: validatedData.data.templateName,
      parameterCount: validatedData.data.parameters?.length || 0
    });

    return NextResponse.json({
      success: true,
      templateMessage,
      template: {
        id: template.id,
        name: template.name,
        category: template.category,
        status: template.status
      }
    });
  } catch (error) {
    logSecureError('Failed to build template message', {
      ...requestContext,
      statusCode: 500
    }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}