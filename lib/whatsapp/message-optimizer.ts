import { MessageOptimization, MessageWindowTracker, WhatsAppUser } from './types';
import { logSecureInfo, logSecureWarning } from '../secure-logger';

/**
 * WhatsApp Message Optimizer
 * Optimizes message sending to maximize use of Meta's free 24-hour messaging window
 */

export class WhatsAppMessageOptimizer {
  private static readonly FREE_WINDOW_HOURS = 24;
  private static readonly MAX_FREE_MESSAGES = 1000; // Conservative limit per window

  /**
   * Analyze whether to send a message now or wait for optimal timing
   */
  public static analyzeMessage(
    phoneNumber: string,
    windowTracker: MessageWindowTracker,
    isUserInitiated: boolean = false
  ): MessageOptimization {
    const now = new Date();
    
    // If user initiated the conversation, we're in a free window
    if (isUserInitiated) {
      return {
        shouldSendNow: true,
        reason: 'new_window',
        windowTimeRemaining: this.FREE_WINDOW_HOURS * 60,
        recommendation: 'User initiated conversation - starting new free 24h window'
      };
    }

    // Check if we're within an active free window
    if (this.isWithinFreeWindow(windowTracker, now)) {
      const remainingTime = this.getRemainingWindowTime(windowTracker, now);
      
      if (windowTracker.messageCount < this.MAX_FREE_MESSAGES) {
        return {
          shouldSendNow: true,
          reason: 'free_window',
          windowTimeRemaining: remainingTime,
          recommendation: `Send now - ${remainingTime} minutes remaining in free window`
        };
      } else {
        logSecureWarning('Free message limit reached within window', {
          operation: 'message_optimization',
          timestamp: new Date().toISOString()
        }, {
          phoneNumber: this.maskPhoneNumber(phoneNumber)
        });
        
        return {
          shouldSendNow: false,
          reason: 'paid_required',
          estimatedCost: 0.05, // Approximate cost per message
          recommendation: 'Free message limit reached - message will incur charges'
        };
      }
    }

    // Outside free window - message will be paid
    return {
      shouldSendNow: false,
      reason: 'paid_required',
      estimatedCost: 0.05,
      recommendation: 'Outside free window - consider waiting for user to initiate conversation'
    };
  }

  /**
   * Update message window tracker after sending/receiving a message
   */
  public static updateWindowTracker(
    tracker: MessageWindowTracker,
    isUserInitiated: boolean,
    direction: 'inbound' | 'outbound'
  ): MessageWindowTracker {
    const now = new Date();

    // If user initiated, start new window
    if (isUserInitiated && direction === 'inbound') {
      return {
        ...tracker,
        windowStart: now,
        messageCount: 0,
        lastMessage: now,
        isWindowActive: true
      };
    }

    // If within existing window, increment count
    if (this.isWithinFreeWindow(tracker, now)) {
      return {
        ...tracker,
        messageCount: tracker.messageCount + (direction === 'outbound' ? 1 : 0),
        lastMessage: now
      };
    }

    // Outside window - reset if user initiated new conversation
    if (direction === 'inbound') {
      return {
        ...tracker,
        windowStart: now,
        messageCount: 0,
        lastMessage: now,
        isWindowActive: true
      };
    }

    return tracker;
  }

  /**
   * Check if current time is within the free messaging window
   */
  private static isWithinFreeWindow(tracker: MessageWindowTracker, now: Date): boolean {
    if (!tracker.isWindowActive || !tracker.windowStart) {
      return false;
    }

    const windowEnd = new Date(tracker.windowStart.getTime() + (this.FREE_WINDOW_HOURS * 60 * 60 * 1000));
    return now <= windowEnd;
  }

  /**
   * Get remaining time in free window (in minutes)
   */
  private static getRemainingWindowTime(tracker: MessageWindowTracker, now: Date): number {
    if (!tracker.windowStart) return 0;

    const windowEnd = new Date(tracker.windowStart.getTime() + (this.FREE_WINDOW_HOURS * 60 * 60 * 1000));
    const remaining = Math.max(0, windowEnd.getTime() - now.getTime());
    return Math.floor(remaining / (1000 * 60)); // Convert to minutes
  }

  /**
   * Generate optimization recommendations for bulk messaging
   */
  public static optimizeBulkMessages(
    recipients: string[],
    windowTrackers: Map<string, MessageWindowTracker>
  ): {
    sendNow: string[];
    sendLater: string[];
    waitForUserInitiation: string[];
    estimatedCost: number;
  } {
    const sendNow: string[] = [];
    const sendLater: string[] = [];
    const waitForUserInitiation: string[] = [];
    let estimatedCost = 0;

    recipients.forEach(phoneNumber => {
      const tracker = windowTrackers.get(phoneNumber) || this.createDefaultTracker(phoneNumber);
      const optimization = this.analyzeMessage(phoneNumber, tracker);

      switch (optimization.reason) {
        case 'free_window':
        case 'new_window':
          sendNow.push(phoneNumber);
          break;
        case 'paid_required':
          if (optimization.estimatedCost) {
            estimatedCost += optimization.estimatedCost;
            if (optimization.windowTimeRemaining && optimization.windowTimeRemaining > 60) {
              sendLater.push(phoneNumber);
            } else {
              waitForUserInitiation.push(phoneNumber);
            }
          }
          break;
      }
    });

    logSecureInfo('Bulk message optimization completed', {
      operation: 'bulk_optimization',
      timestamp: new Date().toISOString()
    }, {
      totalRecipients: recipients.length,
      sendNow: sendNow.length,
      sendLater: sendLater.length,
      waitForUserInitiation: waitForUserInitiation.length,
      estimatedCost
    });

    return {
      sendNow,
      sendLater,
      waitForUserInitiation,
      estimatedCost
    };
  }

  /**
   * Create default window tracker for new phone number
   */
  private static createDefaultTracker(phoneNumber: string): MessageWindowTracker {
    return {
      phoneNumber,
      windowStart: new Date(),
      messageCount: 0,
      lastMessage: new Date(),
      isWindowActive: false
    };
  }

  /**
   * Mask phone number for logging
   */
  private static maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length < 4) return '****';
    return phoneNumber.slice(0, -4).replace(/./g, '*') + phoneNumber.slice(-4);
  }

  /**
   * Get cost estimate for sending outside free window
   */
  public static getCostEstimate(messageCount: number, messageType: 'text' | 'media' = 'text'): number {
    // Approximate Meta WhatsApp pricing (varies by region)
    const baseCost = messageType === 'text' ? 0.05 : 0.10;
    return messageCount * baseCost;
  }

  /**
   * Schedule optimal send times for messages
   */
  public static scheduleOptimalSending(
    messages: Array<{ phoneNumber: string; content: string }>,
    windowTrackers: Map<string, MessageWindowTracker>
  ): Array<{ phoneNumber: string; content: string; scheduledTime: Date; isFree: boolean }> {
    return messages.map(message => {
      const tracker = windowTrackers.get(message.phoneNumber) || this.createDefaultTracker(message.phoneNumber);
      const optimization = this.analyzeMessage(message.phoneNumber, tracker);

      let scheduledTime = new Date();
      let isFree = true;

      if (optimization.reason === 'paid_required') {
        // Schedule for next likely user-initiated window (e.g., next business day)
        scheduledTime = this.getNextBusinessHour();
        isFree = false;
      }

      return {
        ...message,
        scheduledTime,
        isFree
      };
    });
  }

  /**
   * Get next business hour for optimal message delivery
   */
  private static getNextBusinessHour(): Date {
    const now = new Date();
    const nextDay = new Date(now);
    nextDay.setDate(now.getDate() + 1);
    nextDay.setHours(9, 0, 0, 0); // 9 AM next day
    return nextDay;
  }
}