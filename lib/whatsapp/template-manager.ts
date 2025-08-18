import { whatsappConfig } from './config';
import { WhatsAppTemplate, WhatsAppTemplateComponent, WhatsAppTemplateMessage } from './types';
import { prisma } from '../prisma';
import { logSecureInfo, logSecureError, logSecureWarning } from '../secure-logger';

/**
 * WhatsApp Template Manager
 * Manages Meta-optimized message templates for WhatsApp Business API
 */

export interface CreateTemplateRequest {
  name: string;
  language: string;
  category: 'utility' | 'marketing' | 'authentication';
  components: WhatsAppTemplateComponent[];
}

export interface TemplateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TemplateUsageAnalytics {
  templateName: string;
  totalSent: number;
  deliveryRate: number;
  responseRate: number;
  avgCostPerMessage: number;
  lastUsed: Date;
}

export class WhatsAppTemplateManager {
  private static instance: WhatsAppTemplateManager;

  private constructor() {}

  public static getInstance(): WhatsAppTemplateManager {
    if (!WhatsAppTemplateManager.instance) {
      WhatsAppTemplateManager.instance = new WhatsAppTemplateManager();
    }
    return WhatsAppTemplateManager.instance;
  }

  /**
   * Initialize default templates for the system
   */
  public async initializeDefaultTemplates(): Promise<void> {
    try {
      const defaultTemplates = this.getDefaultTemplates();
      
      for (const template of defaultTemplates) {
        await this.createOrUpdateTemplate(template);
      }

      logSecureInfo('Default WhatsApp templates initialized', {
        operation: 'initialize_templates'
      }, {
        templateCount: defaultTemplates.length
      });
    } catch (error) {
      logSecureError('Failed to initialize default templates', {
        operation: 'initialize_templates'
      }, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Get default system templates
   */
  private getDefaultTemplates(): CreateTemplateRequest[] {
    return [
      // Incident Notification Templates
      {
        name: 'incident_assigned',
        language: 'en',
        category: 'utility',
        components: [
          {
            type: 'header',
            format: 'text',
            text: '🔔 New Incident Assigned'
          },
          {
            type: 'body',
            text: 'Hi {{1}}, you have been assigned a new incident:\n\nID: {{2}}\nLocation: {{3}}\nDescription: {{4}}\n\nPlease respond with /assigned to view all your tasks.',
            parameters: [
              { type: 'text', text: 'name' },
              { type: 'text', text: 'incident_id' },
              { type: 'text', text: 'location' },
              { type: 'text', text: 'description' }
            ]
          },
          {
            type: 'footer',
            text: 'Workload Insights System'
          }
        ]
      },
      {
        name: 'incident_completed',
        language: 'en',
        category: 'utility',
        components: [
          {
            type: 'header',
            format: 'text',
            text: '✅ Incident Resolved'
          },
          {
            type: 'body',
            text: 'Your incident report has been resolved:\n\nID: {{1}}\nLocation: {{2}}\nResolved by: {{3}}\nResolution: {{4}}\n\nThank you for reporting this issue!',
            parameters: [
              { type: 'text', text: 'incident_id' },
              { type: 'text', text: 'location' },
              { type: 'text', text: 'resolver_name' },
              { type: 'text', text: 'resolution_notes' }
            ]
          },
          {
            type: 'footer',
            text: 'Workload Insights System'
          }
        ]
      },
      // Welcome and Verification Templates
      {
        name: 'welcome_new_user',
        language: 'en',
        category: 'utility',
        components: [
          {
            type: 'header',
            format: 'text',
            text: '👋 Welcome to Workload Insights'
          },
          {
            type: 'body',
            text: 'Hi {{1}}, welcome to the Workload Insights System!\n\nYour account has been set up with the following details:\n\nRole: {{2}}\nPhone: {{3}}\n\nYou can now:\n• Report incidents by sending photos, voice notes, or locations\n• Use commands like /help, /status, /report\n• Track your submitted reports\n\nSend /help to get started!',
            parameters: [
              { type: 'text', text: 'name' },
              { type: 'text', text: 'role' },
              { type: 'text', text: 'phone' }
            ]
          },
          {
            type: 'footer',
            text: 'Send /help for available commands'
          },
          {
            type: 'buttons',
            buttons: [
              { type: 'quick_reply', text: 'Get Help', payload: '/help' },
              { type: 'quick_reply', text: 'My Status', payload: '/status' }
            ]
          }
        ]
      },
      {
        name: 'verification_code',
        language: 'en',
        category: 'authentication',
        components: [
          {
            type: 'header',
            format: 'text',
            text: '🔐 Verification Code'
          },
          {
            type: 'body',
            text: 'Your verification code is: {{1}}\n\nThis code will expire in 10 minutes.\n\nReply with: /verify {{1}}',
            parameters: [
              { type: 'text', text: 'code' }
            ]
          },
          {
            type: 'footer',
            text: 'Do not share this code with anyone'
          }
        ]
      },
      // Status Update Templates
      {
        name: 'daily_summary',
        language: 'en',
        category: 'utility',
        components: [
          {
            type: 'header',
            format: 'text',
            text: '📊 Daily Summary'
          },
          {
            type: 'body',
            text: 'Hi {{1}}, here\'s your daily summary:\n\n📍 New incidents: {{2}}\n⏳ In progress: {{3}}\n✅ Completed: {{4}}\n🎯 Your pending tasks: {{5}}\n\nTotal system activities: {{6}}',
            parameters: [
              { type: 'text', text: 'name' },
              { type: 'text', text: 'new_count' },
              { type: 'text', text: 'progress_count' },
              { type: 'text', text: 'completed_count' },
              { type: 'text', text: 'user_pending' },
              { type: 'text', text: 'total_activities' }
            ]
          },
          {
            type: 'footer',
            text: 'Workload Insights System'
          },
          {
            type: 'buttons',
            buttons: [
              { type: 'quick_reply', text: 'My Tasks', payload: '/assigned' },
              { type: 'quick_reply', text: 'My Reports', payload: '/myreports' }
            ]
          }
        ]
      },
      // Emergency and Urgent Templates
      {
        name: 'urgent_incident',
        language: 'en',
        category: 'utility',
        components: [
          {
            type: 'header',
            format: 'text',
            text: '🚨 URGENT: Immediate Attention Required'
          },
          {
            type: 'body',
            text: 'URGENT INCIDENT REPORTED:\n\nLocation: {{1}}\nReported by: {{2}}\nDescription: {{3}}\nTime: {{4}}\n\nThis incident requires immediate attention. Please respond ASAP.',
            parameters: [
              { type: 'text', text: 'location' },
              { type: 'text', text: 'reporter_name' },
              { type: 'text', text: 'description' },
              { type: 'text', text: 'timestamp' }
            ]
          },
          {
            type: 'footer',
            text: 'URGENT - Respond immediately'
          },
          {
            type: 'buttons',
            buttons: [
              { type: 'quick_reply', text: 'Acknowledge', payload: '/acknowledge' },
              { type: 'quick_reply', text: 'View Details', payload: '/details' }
            ]
          }
        ]
      },
      // Reminder Templates
      {
        name: 'overdue_reminder',
        language: 'en',
        category: 'utility',
        components: [
          {
            type: 'header',
            format: 'text',
            text: '⏰ Overdue Task Reminder'
          },
          {
            type: 'body',
            text: 'Hi {{1}}, you have overdue tasks:\n\nIncident ID: {{2}}\nLocation: {{3}}\nDays overdue: {{4}}\n\nPlease update the status or complete the task.\n\nReply /complete {{2}} [notes] when finished.',
            parameters: [
              { type: 'text', text: 'name' },
              { type: 'text', text: 'incident_id' },
              { type: 'text', text: 'location' },
              { type: 'text', text: 'days_overdue' }
            ]
          },
          {
            type: 'footer',
            text: 'Workload Insights System'
          }
        ]
      }
    ];
  }

  /**
   * Create or update a template in the system and with Meta
   */
  public async createOrUpdateTemplate(template: CreateTemplateRequest): Promise<{
    success: boolean;
    templateId?: string;
    error?: string;
  }> {
    try {
      // Validate template structure
      const validation = this.validateTemplate(template);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Template validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Store template locally
      const storedTemplate = await prisma.whatsAppTemplate.upsert({
        where: { name: template.name },
        update: {
          language: template.language,
          category: template.category,
          components: JSON.stringify(template.components),
          status: 'pending'
        },
        create: {
          name: template.name,
          language: template.language,
          category: template.category,
          components: JSON.stringify(template.components),
          status: 'pending'
        }
      });

      // Submit to Meta for approval (in production)
      // For now, we'll mark as approved for testing
      await prisma.whatsAppTemplate.update({
        where: { id: storedTemplate.id },
        data: { status: 'approved' }
      });

      logSecureInfo('WhatsApp template created/updated', {
        operation: 'create_template'
      }, {
        templateName: template.name,
        templateId: storedTemplate.id,
        category: template.category,
        language: template.language
      });

      return {
        success: true,
        templateId: storedTemplate.id
      };
    } catch (error) {
      logSecureError('Failed to create/update template', {
        operation: 'create_template'
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all approved templates
   */
  public async getApprovedTemplates(): Promise<WhatsAppTemplate[]> {
    try {
      const templates = await prisma.whatsAppTemplate.findMany({
        where: { status: 'approved' },
        orderBy: { name: 'asc' }
      });

      return templates.map(template => ({
        id: template.id,
        name: template.name,
        language: template.language,
        category: template.category as 'utility' | 'marketing' | 'authentication',
        status: template.status as 'approved' | 'pending' | 'rejected',
        components: JSON.parse(template.components),
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      }));
    } catch (error) {
      logSecureError('Failed to get approved templates', {
        operation: 'get_templates'
      }, error instanceof Error ? error : undefined);

      return [];
    }
  }

  /**
   * Get a specific template by name
   */
  public async getTemplate(name: string): Promise<WhatsAppTemplate | null> {
    try {
      const template = await prisma.whatsAppTemplate.findUnique({
        where: { name }
      });

      if (!template) return null;

      return {
        id: template.id,
        name: template.name,
        language: template.language,
        category: template.category as 'utility' | 'marketing' | 'authentication',
        status: template.status as 'approved' | 'pending' | 'rejected',
        components: JSON.parse(template.components),
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      };
    } catch (error) {
      logSecureError('Failed to get template', {
        operation: 'get_template'
      }, error instanceof Error ? error : undefined);

      return null;
    }
  }

  /**
   * Build template message with parameters
   */
  public buildTemplateMessage(
    templateName: string,
    parameters: Array<{ type: 'text' | 'currency' | 'date_time'; text: string }>
  ): WhatsAppTemplateMessage {
    return {
      templateName,
      languageCode: 'en', // Default to English
      parameters
    };
  }

  /**
   * Validate template structure
   */
  private validateTemplate(template: CreateTemplateRequest): TemplateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Name validation
    if (!template.name || template.name.length < 1) {
      errors.push('Template name is required');
    } else if (!/^[a-z0-9_]+$/.test(template.name)) {
      errors.push('Template name must contain only lowercase letters, numbers, and underscores');
    }

    // Language validation
    if (!template.language || template.language.length !== 2) {
      errors.push('Language must be a 2-character ISO code (e.g., "en")');
    }

    // Category validation
    if (!['utility', 'marketing', 'authentication'].includes(template.category)) {
      errors.push('Category must be one of: utility, marketing, authentication');
    }

    // Components validation
    if (!template.components || template.components.length === 0) {
      errors.push('Template must have at least one component');
    } else {
      template.components.forEach((component, index) => {
        if (!component.type) {
          errors.push(`Component ${index} must have a type`);
        }

        if (component.type === 'body' && !component.text) {
          errors.push(`Body component ${index} must have text`);
        }

        if (component.type === 'header' && component.format === 'text' && !component.text) {
          errors.push(`Text header component ${index} must have text`);
        }

        // Check parameter count limits
        if (component.parameters && component.parameters.length > 10) {
          warnings.push(`Component ${index} has more than 10 parameters - this may cause issues`);
        }
      });
    }

    // Business policy checks
    if (template.category === 'marketing' && !template.components.some(c => c.type === 'footer')) {
      warnings.push('Marketing templates should include a footer with opt-out instructions');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get template usage analytics
   */
  public async getTemplateAnalytics(templateName?: string): Promise<TemplateUsageAnalytics[]> {
    try {
      // In a full implementation, this would analyze message delivery, read rates, etc.
      // For now, return mock data based on stored messages
      
      const whereClause = templateName ? { content: { contains: templateName } } : {};
      
      const messages = await prisma.whatsAppMessage.findMany({
        where: {
          ...whereClause,
          direction: 'outbound',
          type: 'template'
        },
        select: {
          content: true,
          status: true,
          timestamp: true,
          isFreeMessage: true
        }
      });

      // Group by template and calculate metrics
      const analytics: TemplateUsageAnalytics[] = [];
      
      // This is simplified - in production you'd have more sophisticated analytics
      if (messages.length > 0) {
        const totalSent = messages.length;
        const deliveredCount = messages.filter(m => ['delivered', 'read'].includes(m.status)).length;
        const freeMessages = messages.filter(m => m.isFreeMessage).length;
        
        analytics.push({
          templateName: templateName || 'all_templates',
          totalSent,
          deliveryRate: totalSent > 0 ? (deliveredCount / totalSent) * 100 : 0,
          responseRate: 0, // Would need to track responses
          avgCostPerMessage: freeMessages > 0 ? 0 : 0.05, // Approximate
          lastUsed: messages.length > 0 ? new Date(Math.max(...messages.map(m => m.timestamp.getTime()))) : new Date()
        });
      }

      return analytics;
    } catch (error) {
      logSecureError('Failed to get template analytics', {
        operation: 'get_template_analytics'
      }, error instanceof Error ? error : undefined);

      return [];
    }
  }

  /**
   * Delete a template
   */
  public async deleteTemplate(templateId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await prisma.whatsAppTemplate.delete({
        where: { id: templateId }
      });

      logSecureInfo('WhatsApp template deleted', {
        operation: 'delete_template'
      }, {
        templateId
      });

      return { success: true };
    } catch (error) {
      logSecureError('Failed to delete template', {
        operation: 'delete_template'
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get templates by category
   */
  public async getTemplatesByCategory(category: 'utility' | 'marketing' | 'authentication'): Promise<WhatsAppTemplate[]> {
    try {
      const templates = await prisma.whatsAppTemplate.findMany({
        where: { 
          category,
          status: 'approved'
        },
        orderBy: { name: 'asc' }
      });

      return templates.map(template => ({
        id: template.id,
        name: template.name,
        language: template.language,
        category: template.category as 'utility' | 'marketing' | 'authentication',
        status: template.status as 'approved' | 'pending' | 'rejected',
        components: JSON.parse(template.components),
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      }));
    } catch (error) {
      logSecureError('Failed to get templates by category', {
        operation: 'get_templates_by_category'
      }, error instanceof Error ? error : undefined);

      return [];
    }
  }
}

// Export singleton instance
export const whatsappTemplateManager = WhatsAppTemplateManager.getInstance();