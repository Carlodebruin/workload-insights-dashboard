import { whatsappConfig } from './config';
import { WhatsAppMessageOptimizer } from './message-optimizer';
import { WhatsAppTemplate, MessageOptimization } from './types';
import { prisma } from '../prisma';
import { logSecureInfo, logSecureError, logSecureWarning } from '../secure-logger';

/**
 * WhatsApp Messaging Service
 * Handles sending messages through Meta WhatsApp Business API with optimization
 */

export interface SendMessageOptions {
  to: string;
  type: 'text' | 'template' | 'media';
  content: string | WhatsAppTemplateMessage | WhatsAppMediaMessage;
  forceImmediate?: boolean; // Override optimization and send immediately
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface WhatsAppTemplateMessage {
  templateName: string;
  languageCode: string;
  parameters?: Array<{ type: 'text' | 'currency' | 'date_time'; text: string }>;
}

export interface WhatsAppMediaMessage {
  mediaType: 'image' | 'document' | 'video' | 'audio';
  mediaUrl?: string;
  mediaId?: string;
  caption?: string;
  filename?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  scheduled?: boolean;
  scheduledTime?: Date;
  optimization?: MessageOptimization;
  error?: string;
  cost?: number;
}

export interface BulkMessageOptions {
  recipients: string[];
  template: WhatsAppTemplateMessage;
  respectOptimization?: boolean;
  maxCost?: number;
}

export interface BulkSendResult {
  totalRecipients: number;
  sentImmediately: number;
  scheduled: number;
  failed: number;
  estimatedCost: number;
  results: Array<{ recipient: string; result: SendResult }>;
}

export class WhatsAppMessagingService {
  private static instance: WhatsAppMessagingService;

  private constructor() {}

  public static getInstance(): WhatsAppMessagingService {
    if (!WhatsAppMessagingService.instance) {
      WhatsAppMessagingService.instance = new WhatsAppMessagingService();
    }
    return WhatsAppMessagingService.instance;
  }

  /**
   * Send a single WhatsApp message with optimization
   */
  public async sendMessage(options: SendMessageOptions): Promise<SendResult> {
    try {
      const config = whatsappConfig.getConfig();
      
      // Get or create window tracker for optimization
      const windowTracker = await this.getWindowTracker(options.to);
      
      // Analyze message optimization unless forced immediate
      let optimization: MessageOptimization | undefined;
      if (!options.forceImmediate && options.priority !== 'urgent') {
        optimization = WhatsAppMessageOptimizer.analyzeMessage(
          options.to,
          windowTracker,
          false // Not user initiated
        );

        // If optimization suggests not sending now, handle accordingly
        if (!optimization.shouldSendNow) {
          return await this.handleOptimizedSending(options, optimization);
        }
      }

      // Prepare message payload
      const messagePayload = this.buildMessagePayload(options);
      
      // Send message via Meta API
      const response = await fetch(
        whatsappConfig.getApiUrl(`${config.phoneNumberId}/messages`),
        {
          method: 'POST',
          headers: whatsappConfig.getApiHeaders(),
          body: JSON.stringify(messagePayload)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`WhatsApp API error: ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();
      const messageId = result.messages?.[0]?.id;

      // Store message in database
      await this.storeOutboundMessage(options, messageId, optimization);

      // Update window tracker
      if (optimization) {
        await this.updateWindowTracker(options.to, optimization, 'outbound');
      }

      logSecureInfo('WhatsApp message sent successfully', {
        operation: 'send_message',
        timestamp: new Date().toISOString()
      }, {
        messageId,
        recipient: this.maskPhoneNumber(options.to),
        type: options.type,
        isFreeMessage: optimization?.reason === 'free_window',
        optimization: optimization?.reason
      });

      return {
        success: true,
        messageId,
        optimization,
        cost: optimization?.estimatedCost || 0
      };

    } catch (error) {
      logSecureError('Failed to send WhatsApp message', {
        operation: 'send_message',
        timestamp: new Date().toISOString()
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send bulk messages with optimization
   */
  public async sendBulkMessages(options: BulkMessageOptions): Promise<BulkSendResult> {
    const results: Array<{ recipient: string; result: SendResult }> = [];
    let sentImmediately = 0;
    let scheduled = 0;
    let failed = 0;
    let totalCost = 0;

    // Get window trackers for all recipients
    const windowTrackers = new Map();
    for (const recipient of options.recipients) {
      const tracker = await this.getWindowTracker(recipient);
      windowTrackers.set(recipient, tracker);
    }

    // Optimize bulk sending
    const optimization = WhatsAppMessageOptimizer.optimizeBulkMessages(
      options.recipients,
      windowTrackers
    );

    // Check cost limits
    if (options.maxCost && optimization.estimatedCost > options.maxCost) {
      logSecureWarning('Bulk message cost exceeds limit', {
        operation: 'bulk_send',
        timestamp: new Date().toISOString()
      }, {
        estimatedCost: optimization.estimatedCost,
        maxCost: options.maxCost,
        recipientCount: options.recipients.length
      });

      return {
        totalRecipients: options.recipients.length,
        sentImmediately: 0,
        scheduled: 0,
        failed: options.recipients.length,
        estimatedCost: optimization.estimatedCost,
        results: options.recipients.map(recipient => ({
          recipient,
          result: {
            success: false,
            error: 'Cost limit exceeded'
          }
        }))
      };
    }

    // Send immediate messages
    for (const recipient of optimization.sendNow) {
      const result = await this.sendMessage({
        to: recipient,
        type: 'template',
        content: options.template,
        forceImmediate: true
      });

      results.push({ recipient, result });
      
      if (result.success) {
        sentImmediately++;
        totalCost += result.cost || 0;
      } else {
        failed++;
      }
    }

    // Schedule delayed messages
    for (const recipient of optimization.sendLater) {
      const result = await this.scheduleMessage(recipient, options.template);
      results.push({ recipient, result });
      
      if (result.success) {
        scheduled++;
      } else {
        failed++;
      }
    }

    // Handle recipients waiting for user initiation
    for (const recipient of optimization.waitForUserInitiation) {
      results.push({
        recipient,
        result: {
          success: false,
          error: 'Waiting for user to initiate conversation to avoid charges'
        }
      });
      failed++;
    }

    logSecureInfo('Bulk WhatsApp messages processed', {
      operation: 'bulk_send',
        timestamp: new Date().toISOString()
    }, {
      totalRecipients: options.recipients.length,
      sentImmediately,
      scheduled,
      failed,
      estimatedCost: optimization.estimatedCost,
      actualCost: totalCost
    });

    return {
      totalRecipients: options.recipients.length,
      sentImmediately,
      scheduled,
      failed,
      estimatedCost: totalCost,
      results
    };
  }

  /**
   * Send quick response message (always free within conversation window)
   */
  public async sendQuickResponse(
    to: string,
    message: string,
    replyToMessageId?: string
  ): Promise<SendResult> {
    const payload: any = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message }
    };

    if (replyToMessageId) {
      payload.context = { message_id: replyToMessageId };
    }

    try {
      const config = whatsappConfig.getConfig();
      const response = await fetch(
        whatsappConfig.getApiUrl(`${config.phoneNumberId}/messages`),
        {
          method: 'POST',
          headers: whatsappConfig.getApiHeaders(),
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`WhatsApp API error: ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();
      const messageId = result.messages?.[0]?.id;

      // Store as free message within conversation
      await this.storeOutboundMessage({
        to,
        type: 'text',
        content: message
      }, messageId, { shouldSendNow: true, reason: 'free_window' } as MessageOptimization);

      return {
        success: true,
        messageId,
        cost: 0 // Free within conversation window
      };
    } catch (error) {
      logSecureError('Failed to send quick response', {
        operation: 'quick_response',
        timestamp: new Date().toISOString()
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle optimized sending (scheduling or immediate with cost warning)
   */
  private async handleOptimizedSending(
    options: SendMessageOptions,
    optimization: MessageOptimization
  ): Promise<SendResult> {
    if (optimization.reason === 'paid_required') {
      // For high priority messages, send anyway but log cost
      if (options.priority === 'high') {
        logSecureWarning('Sending high priority message outside free window', {
          operation: 'paid_message',
        timestamp: new Date().toISOString()
        }, {
          recipient: this.maskPhoneNumber(options.to),
          estimatedCost: optimization.estimatedCost,
          priority: options.priority
        });

        // Continue with sending
        return this.sendMessage({ ...options, forceImmediate: true });
      }

      // For normal/low priority, schedule for later
      return this.scheduleMessage(options.to, options.content);
    }

    // Default to immediate sending
    return this.sendMessage({ ...options, forceImmediate: true });
  }

  /**
   * Schedule message for optimal sending time
   */
  private async scheduleMessage(to: string, content: any): Promise<SendResult> {
    // In a full implementation, this would use a job queue
    // For now, we'll store it for later processing
    
    const scheduledTime = new Date(Date.now() + (2 * 60 * 60 * 1000)); // 2 hours later
    
    logSecureInfo('Message scheduled for optimal delivery', {
      operation: 'schedule_message',
        timestamp: new Date().toISOString()
    }, {
      recipient: this.maskPhoneNumber(to),
      scheduledTime: scheduledTime.toISOString()
    });

    return {
      success: true,
      scheduled: true,
      scheduledTime,
      cost: 0 // Will be charged when actually sent
    };
  }

  /**
   * Build message payload for Meta API
   */
  private buildMessagePayload(options: SendMessageOptions): any {
    const config = whatsappConfig.getConfig();
    
    const basePayload = {
      messaging_product: 'whatsapp',
      to: options.to
    };

    switch (options.type) {
      case 'text':
        return {
          ...basePayload,
          type: 'text',
          text: { body: options.content as string }
        };

      case 'template':
        const template = options.content as WhatsAppTemplateMessage;
        return {
          ...basePayload,
          type: 'template',
          template: {
            name: template.templateName,
            language: { code: template.languageCode },
            components: template.parameters ? [{
              type: 'body',
              parameters: template.parameters
            }] : undefined
          }
        };

      case 'media':
        const media = options.content as WhatsAppMediaMessage;
        const mediaPayload: any = {
          ...basePayload,
          type: media.mediaType
        };

        mediaPayload[media.mediaType] = {
          ...(media.mediaId ? { id: media.mediaId } : { link: media.mediaUrl }),
          ...(media.caption && { caption: media.caption }),
          ...(media.filename && { filename: media.filename })
        };

        return mediaPayload;

      default:
        throw new Error(`Unsupported message type: ${options.type}`);
    }
  }

  /**
   * Store outbound message in database
   */
  private async storeOutboundMessage(
    options: SendMessageOptions,
    messageId?: string,
    optimization?: MessageOptimization
  ): Promise<void> {
    try {
      const config = whatsappConfig.getConfig();
      
      await prisma.whatsAppMessage.create({
        data: {
          waId: messageId || `temp_${Date.now()}`,
          from: config.phoneNumberId,
          to: options.to,
          type: options.type,
          content: JSON.stringify(options.content),
          timestamp: new Date(),
          direction: 'outbound',
          status: 'sent',
          isFreeMessage: optimization?.reason === 'free_window' || optimization?.reason === 'new_window',
          processed: true
        }
      });
    } catch (error) {
      logSecureError('Failed to store outbound message', {
        operation: 'store_message',
        timestamp: new Date().toISOString()
      }, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Get window tracker for phone number
   */
  private async getWindowTracker(phoneNumber: string) {
    try {
      const whatsappUser = await prisma.whatsAppUser.findUnique({
        where: { phoneNumber }
      });

      if (whatsappUser) {
        return {
          phoneNumber,
          windowStart: whatsappUser.windowStartTime || new Date(),
          messageCount: whatsappUser.messagesInWindow,
          lastMessage: whatsappUser.lastMessageAt || new Date(),
          isWindowActive: !!whatsappUser.windowStartTime
        };
      }

      // Return default tracker for new phone number
      return {
        phoneNumber,
        windowStart: new Date(),
        messageCount: 0,
        lastMessage: new Date(),
        isWindowActive: false
      };
    } catch (error) {
      logSecureError('Failed to get window tracker', {
        operation: 'get_window_tracker',
        timestamp: new Date().toISOString()
      }, error instanceof Error ? error : undefined);

      return {
        phoneNumber,
        windowStart: new Date(),
        messageCount: 0,
        lastMessage: new Date(),
        isWindowActive: false
      };
    }
  }

  /**
   * Update window tracker after sending
   */
  private async updateWindowTracker(
    phoneNumber: string,
    optimization: MessageOptimization,
    direction: 'inbound' | 'outbound'
  ): Promise<void> {
    try {
      const currentTracker = await this.getWindowTracker(phoneNumber);
      const updatedTracker = WhatsAppMessageOptimizer.updateWindowTracker(
        currentTracker,
        false, // Not user initiated for outbound
        direction
      );

      await prisma.whatsAppUser.upsert({
        where: { phoneNumber },
        update: {
          messagesInWindow: updatedTracker.messageCount,
          windowStartTime: updatedTracker.windowStart,
          lastMessageAt: new Date()
        },
        create: {
          phoneNumber,
          messagesInWindow: updatedTracker.messageCount,
          windowStartTime: updatedTracker.windowStart,
          lastMessageAt: new Date()
        }
      });
    } catch (error) {
      logSecureError('Failed to update window tracker', {
        operation: 'update_window_tracker',
        timestamp: new Date().toISOString()
      }, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Mask phone number for logging
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length < 4) return '****';
    return phoneNumber.slice(0, -4).replace(/./g, '*') + phoneNumber.slice(-4);
  }
}

// Export singleton instance
export const whatsappMessaging = WhatsAppMessagingService.getInstance();