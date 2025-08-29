import { sendTwilioMessage } from '../twilio';
import { logSecureError } from '../secure-logger';

// NOTE: This file has been surgically refactored to use Twilio for all outgoing messages
// to meet the requirement for consistent API usage. The original Meta-specific logic
// for optimization and scheduling has been removed for simplicity.

export interface SendMessageOptions {
  to: string;
  type: 'text' | 'template' | 'media';
  content: any; // Simplified for Twilio
  forceImmediate?: boolean;
  priority?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  scheduled?: boolean;
  cost?: number;
  scheduledTime?: string;
  optimization?: string;
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
   * Sends a single WhatsApp message using the Twilio API.
   */
  public async sendMessage(options: SendMessageOptions): Promise<SendResult> {
    try {
      // For simplicity, we only support sending plain text content for now.
      if (options.type !== 'text' || typeof options.content !== 'string') {
        throw new Error('This service is currently configured to send plain text messages only.');
      }

      const messageSid = await sendTwilioMessage(options.to, options.content);

      if (messageSid) {
        return { success: true, messageId: messageSid };
      } else {
        throw new Error('Twilio failed to send the message.');
      }

    } catch (error) {
      logSecureError('Failed to send WhatsApp message via Twilio service', {
        operation: 'sendMessage',
        timestamp: new Date().toISOString()
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

    /**
   * Sends a quick response message using Twilio.
   */
  public async sendQuickResponse(to: string, message: string): Promise<SendResult> {
    return this.sendMessage({ to, type: 'text', content: message });
  }

  /**
   * Sends multiple WhatsApp messages (bulk sending).
   */
  public async sendBulkMessages(messages: SendMessageOptions[]): Promise<SendResult[]> {
    const results: SendResult[] = [];
    
    for (const message of messages) {
      try {
        const result = await this.sendMessage(message);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return results;
  }
}

// Export singleton instance
export const whatsappMessaging = WhatsAppMessagingService.getInstance();
