import { withDb } from './db-wrapper';
import { generateReferenceNumber, findActivityByReference, parseReferenceNumber } from './reference-number-service';
import { logSecureInfo, logSecureError, createRequestContext } from './secure-logger';

/**
 * WhatsApp Command System
 * Handles complex command interactions for staff task management
 */

export interface CommandContext {
  fromPhone: string;
  senderName: string;
  messageContent: string;
  user?: any;
  requestContext?: any;
}

export interface CommandResult {
  success: boolean;
  message: string;
  requiresFollowup?: boolean;
  followupType?: string;
  context?: any;
}

/**
 * Session manager for multi-step command interactions
 */
class CommandSessionManager {
  private static sessions = new Map<string, any>();
  
  static createSession(phoneNumber: string, sessionData: any): void {
    this.sessions.set(phoneNumber, {
      ...sessionData,
      createdAt: new Date(),
      lastActivity: new Date()
    });
    
    // Auto-cleanup sessions after 5 minutes
    setTimeout(() => {
      this.sessions.delete(phoneNumber);
    }, 5 * 60 * 1000);
  }
  
  static getSession(phoneNumber: string): any | null {
    return this.sessions.get(phoneNumber) || null;
  }
  
  static updateSession(phoneNumber: string, updates: any): void {
    const session = this.sessions.get(phoneNumber);
    if (session) {
      this.sessions.set(phoneNumber, {
        ...session,
        ...updates,
        lastActivity: new Date()
      });
    }
  }
  
  static clearSession(phoneNumber: string): void {
    this.sessions.delete(phoneNumber);
  }
  
  static hasActiveSession(phoneNumber: string): boolean {
    return this.sessions.has(phoneNumber);
  }
}

/**
 * Main command processor
 */
export class WhatsAppCommandSystem {
  static async processCommand(context: CommandContext): Promise<CommandResult> {
    const { fromPhone, senderName, messageContent } = context;
    
    try {
      // Check if user has an active session (multi-step command in progress)
      if (CommandSessionManager.hasActiveSession(fromPhone)) {
        return await this.processSessionCommand(context);
      }
      
      // Process new commands
      const messageText = messageContent.toLowerCase().trim();
      
      // Handle commands with parameters (e.g., "/update PROJ-4341 progress text" or "/update 2 progress text")
      if (messageText.startsWith('/update ')) {
        return await this.handleDirectUpdateCommand(context);
      }
      
      if (messageText.startsWith('/complete ')) {
        return await this.handleDirectCompleteCommand(context);
      }
      
      // Handle exact commands without parameters
      const command = messageText;
      
      switch (command) {
        case '/update':
          return await this.handleUpdateCommand(context);
          
        case '/assigned':
          return await this.handleAssignedCommand(context);
          
        case '/complete':
          return await this.handleCompleteCommand(context);
          
        case '/help':
          return await this.handleHelpCommand(context);
          
        case '/status':
          return await this.handleStatusCommand(context);
          
        default:
          // Check if it looks like a reference number or task selection
          if (this.isTaskReference(messageContent)) {
            return await this.handleTaskReferenceCommand(context);
          }
          
          return {
            success: false,
            message: `Unknown command: ${messageContent}. Type /help for available commands.`
          };
      }
    } catch (error) {
      logSecureError('Command processing error', context.requestContext, error instanceof Error ? error : undefined);
      return {
        success: false,
        message: 'Sorry, there was an error processing your command. Please try again.'
      };
    }
  }
  
  /**
   * Handle multi-step command sessions
   */
  private static async processSessionCommand(context: CommandContext): Promise<CommandResult> {
    const session = CommandSessionManager.getSession(context.fromPhone);
    if (!session) {
      return {
        success: false,
        message: 'Session expired. Please start over with /update.'
      };
    }
    
    switch (session.type) {
      case 'task_update':
        return await this.processTaskUpdateSession(context, session);
        
      default:
        CommandSessionManager.clearSession(context.fromPhone);
        return {
          success: false,
          message: 'Invalid session. Please start over.'
        };
    }
  }
  
  /**
   * Handle /update command - shows task list for selection
   */
  private static async handleUpdateCommand(context: CommandContext): Promise<CommandResult> {
    try {
      const user = await withDb(async (prisma) => {
        return prisma.user.findFirst({
          where: { phone_number: context.fromPhone }
        });
      });
      
      if (!user) {
        return {
          success: false,
          message: "No account found for your phone number. Contact your supervisor if you should have access to assigned tasks."
        };
      }
      
      // Get user's assigned tasks
      const assignedTasks = await withDb(async (prisma) => {
        return prisma.activity.findMany({
          where: {
            assigned_to_user_id: user.id,
            status: { in: ['Open', 'In Progress'] }
          },
          orderBy: { timestamp: 'desc' },
          take: 10,
          include: {
            category: { select: { name: true } },
            user: { select: { name: true } }
          }
        });
      });
      
      if (assignedTasks.length === 0) {
        return {
          success: true,
          message: "📋 *No Tasks to Update*\\n\\nYou currently have no open tasks assigned to you.\\n\\nGreat job keeping up with your work! 👍"
        };
      }
      
      // Create session for task selection
      CommandSessionManager.createSession(context.fromPhone, {
        type: 'task_update',
        step: 'select_task',
        tasks: assignedTasks,
        user: user
      });
      
      let message = `📝 *Update Task Progress*\n\nSelect a task to update by replying with the number:\n\n`;
      
      assignedTasks.forEach((task, index) => {
        const ref = generateReferenceNumber({
          categoryName: task.category?.name,
          activityId: task.id
        });
        
        const statusIcon = task.status === 'In Progress' ? '🔄' : '⏳';
        message += `${index + 1}. ${statusIcon} **${ref}**\n`;
        message += `   ${task.subcategory}\n`;
        message += `   📍 ${task.location}\n`;
        message += `   👤 ${task.user?.name}\n\n`;
      });
      
      message += `💡 *Instructions:*\n• Reply with a number (1-${assignedTasks.length})\n• Or type 'cancel' to exit`;
      
      return {
        success: true,
        message,
        requiresFollowup: true,
        followupType: 'task_selection'
      };
      
    } catch (error) {
      logSecureError('Update command error', context.requestContext, error instanceof Error ? error : undefined);
      return {
        success: false,
        message: 'Failed to retrieve your tasks. Please try again later.'
      };
    }
  }
  
  /**
   * Get task by number from user's assigned list (for commands like "/update 2 message")
   */
  private static async getTaskByNumber(context: CommandContext, taskNumber: number): Promise<{success: boolean, activity?: any, reference?: string, message: string}> {
    try {
      const user = await withDb(async (prisma) => {
        return prisma.user.findFirst({
          where: { phone_number: context.fromPhone }
        });
      });
      
      if (!user) {
        return {
          success: false,
          message: "No account found for your phone number. Contact your supervisor if you should have access to assigned tasks."
        };
      }
      
      // Get user's assigned tasks in the same order as /assigned command
      const assignedTasks = await withDb(async (prisma) => {
        return prisma.activity.findMany({
          where: {
            assigned_to_user_id: user.id,
            status: { in: ['Open', 'In Progress'] }
          },
          orderBy: { timestamp: 'desc' },
          take: 10,
          include: {
            category: { select: { name: true } },
            user: { select: { name: true } }
          }
        });
      });
      
      if (assignedTasks.length === 0) {
        return {
          success: false,
          message: "📋 *No Assigned Tasks*\\n\\nYou currently have no open tasks assigned to you.\\n\\nUse `/assigned` to see your tasks."
        };
      }
      
      if (taskNumber < 1 || taskNumber > assignedTasks.length) {
        return {
          success: false,
          message: `**Invalid Task Number**: ${taskNumber}\\n\\nValid task numbers: 1-${assignedTasks.length}\\n\\nUse \`/assigned\` to see your current tasks with numbers.`
        };
      }
      
      const selectedTask = assignedTasks[taskNumber - 1]; // Convert to 0-based index
      const reference = generateReferenceNumber({
        categoryName: selectedTask.category?.name,
        activityId: selectedTask.id
      });
      
      return {
        success: true,
        activity: selectedTask,
        reference: reference,
        message: ''
      };
      
    } catch (error) {
      logSecureError('Get task by number error', context.requestContext, error instanceof Error ? error : undefined);
      return {
        success: false,
        message: 'Failed to retrieve your task. Please try again or use `/assigned` to see your tasks.'
      };
    }
  }
  
  /**
   * Handle direct update commands with reference/number and message (e.g., "/update PROJ-4341 making progress" or "/update 2 making progress")
   */
  private static async handleDirectUpdateCommand(context: CommandContext): Promise<CommandResult> {
    const messageContent = context.messageContent.trim();
    const parts = messageContent.split(' ');
    
    if (parts.length < 3) {
      return {
        success: false,
        message: "📝 **Update Format Error**\\n\\nCorrect formats:\\n• `/update TASK-REF your update message`\\n• `/update 2 your update message` (task number from /assigned)\\n\\nExample: `/update PROJ-4341 making good progress`\\nOr: `/update 2 making good progress`\\n\\nUse `/assigned` to see your task list."
      };
    }
    
    const taskIdentifier = parts[1];
    const updateText = parts.slice(2).join(' ');
    
    // Check if it's a task number (e.g., "2", "8.") or task reference (e.g., "PROJ-4341")
    const isTaskNumber = /^\d+\.?$/.test(taskIdentifier);
    let activity: any = null;
    let reference: string = '';
    
    if (isTaskNumber) {
      // Handle task number format - get the task from user's assigned list
      const taskNumber = parseInt(taskIdentifier.replace('.', ''));
      const result = await this.getTaskByNumber(context, taskNumber);
      if (!result.success) {
        return {
          success: false,
          message: result.message
        };
      }
      activity = result.activity;
      reference = result.reference!;
    } else {
      // Handle task reference format
      reference = taskIdentifier.toUpperCase();
      
      // Validate reference format
      if (!this.isTaskReference(reference)) {
        return {
          success: false,
          message: `**Invalid Task Reference**: ${taskIdentifier}\\n\\nCorrect formats:\\n• \`/update TASK-REF your update message\`\\n• \`/update 2 your update message\` (task number)\\n\\nExample: \`/update PROJ-4341 making good progress\`\\nOr: \`/update 2 making good progress\`\\n\\nUse \`/assigned\` to see your task list.`
        };
      }
    }
    
    try {
      // Find the user
      const user = await withDb(async (prisma) => {
        return prisma.user.findFirst({
          where: { phone_number: context.fromPhone }
        });
      });
      
      if (!user) {
        return {
          success: false,
          message: "No account found for your phone number. Contact your supervisor if you should have access to assigned tasks."
        };
      }
      
      // If we don't have the activity yet (task reference format), find it
      if (!activity) {
        activity = await withDb(async (prisma) => {
          return findActivityByReference(reference, prisma);
        });
        
        if (!activity) {
          return {
            success: false,
            message: `Task **${reference}** not found.\\n\\nUse \`/assigned\` to see your current tasks with reference numbers.`
          };
        }
        
        // Check if user has access to this task
        if (activity.assigned_to_user_id !== user.id && activity.user_id !== user.id) {
          return {
            success: false,
            message: `Task **${reference}** is not assigned to you.\\n\\nUse \`/assigned\` to see your current tasks.`
          };
        }
      }
      
      // Create activity update
      await withDb(async (prisma) => {
        await prisma.activityUpdate.create({
          data: {
            activity_id: activity!.id,
            author_id: user.id,
            notes: updateText,
            update_type: 'progress'
          }
        });
        
        // Update activity status to In Progress if it was Open
        if (activity!.status === 'Open') {
          await prisma.activity.update({
            where: { id: activity!.id },
            data: { status: 'In Progress' }
          });
        }
      });
      
      logSecureInfo('Direct task update submitted via WhatsApp', context.requestContext, {
        taskId: activity.id.substring(0, 8),
        userId: user.id.substring(0, 8),
        updateLength: updateText.length
      });
      
      return {
        success: true,
        message: `✅ **Update Logged: ${reference}**\\n\\n📝 **Your Update:** ${updateText.substring(0, 150)}${updateText.length > 150 ? '...' : ''}\\n\\n📊 **Status:** ${activity.status === 'Open' ? 'In Progress' : activity.status}\\n⏰ **Time:** ${new Date().toLocaleTimeString()}\\n\\n🔔 Reporter and supervisors have been notified.\\n\\n💡 Use \`/update\` alone to see your task list, or \`/assigned\` to see all tasks.`
      };
      
    } catch (error) {
      logSecureError('Direct update command error', context.requestContext, error instanceof Error ? error : undefined);
      return {
        success: false,
        message: 'Failed to process your update. Please try again or use `/update` to see your task list.'
      };
    }
  }
  
  /**
   * Handle direct complete commands with reference/number (e.g., "/complete PROJ-4341" or "/complete 2")
   */
  private static async handleDirectCompleteCommand(context: CommandContext): Promise<CommandResult> {
    const messageContent = context.messageContent.trim();
    const parts = messageContent.split(' ');
    
    if (parts.length < 2) {
      return {
        success: false,
        message: "🎯 **Complete Format Error**\\n\\nCorrect formats:\\n• `/complete TASK-REF [optional notes]`\\n• `/complete 2 [optional notes]` (task number)\\n\\nExample: `/complete PROJ-4341 task finished`\\nOr: `/complete 2 task finished`\\n\\nUse `/assigned` to see your task list."
      };
    }
    
    const taskIdentifier = parts[1];
    const completionNotes = parts.length > 2 ? parts.slice(2).join(' ') : 'Task completed via WhatsApp';
    
    // Check if it's a task number or task reference
    const isTaskNumber = /^\d+\.?$/.test(taskIdentifier);
    let activity: any = null;
    let reference: string = '';
    
    if (isTaskNumber) {
      // Handle task number format
      const taskNumber = parseInt(taskIdentifier.replace('.', ''));
      const result = await this.getTaskByNumber(context, taskNumber);
      if (!result.success) {
        return {
          success: false,
          message: result.message
        };
      }
      activity = result.activity;
      reference = result.reference!;
    } else {
      // Handle task reference format
      reference = taskIdentifier.toUpperCase();
      
      // Validate reference format
      if (!this.isTaskReference(reference)) {
        return {
          success: false,
          message: `**Invalid Task Reference**: ${taskIdentifier}\\n\\nCorrect formats:\\n• \`/complete TASK-REF [optional notes]\`\\n• \`/complete 2 [optional notes]\` (task number)\\n\\nExample: \`/complete PROJ-4341 task finished\`\\nOr: \`/complete 2 task finished\`\\n\\nUse \`/assigned\` to see your task list.`
        };
      }
    }
    
    try {
      // Find the user
      const user = await withDb(async (prisma) => {
        return prisma.user.findFirst({
          where: { phone_number: context.fromPhone }
        });
      });
      
      if (!user) {
        return {
          success: false,
          message: "No account found for your phone number. Contact your supervisor if you should have access to assigned tasks."
        };
      }
      
      // If we don't have the activity yet (task reference format), find it
      if (!activity) {
        activity = await withDb(async (prisma) => {
          return findActivityByReference(reference, prisma);
        });
        
        if (!activity) {
          return {
            success: false,
            message: `Task **${reference}** not found.\\n\\nUse \`/assigned\` to see your current tasks with reference numbers.`
          };
        }
        
        // Check if user has access to this task
        if (activity.assigned_to_user_id !== user.id && activity.user_id !== user.id) {
          return {
            success: false,
            message: `Task **${reference}** is not assigned to you.\\n\\nUse \`/assigned\` to see your current tasks.`
          };
        }
      }
      
      // Check if already completed
      if (activity.status === 'Resolved') {
        return {
          success: false,
          message: `Task **${reference}** is already completed.\\n\\nUse \`/assigned\` to see your open tasks.`
        };
      }
      
      // Mark task as completed
      await withDb(async (prisma) => {
        await prisma.activity.update({
          where: { id: activity!.id },
          data: {
            status: 'Resolved',
            resolution_notes: completionNotes
          }
        });
        
        // Create completion update
        await prisma.activityUpdate.create({
          data: {
            activity_id: activity!.id,
            author_id: user.id,
            notes: completionNotes,
            update_type: 'completion',
            status_context: 'Resolved'
          }
        });
      });
      
      logSecureInfo('Direct task completion via WhatsApp', context.requestContext, {
        taskId: activity.id.substring(0, 8),
        userId: user.id.substring(0, 8)
      });
      
      return {
        success: true,
        message: `🎉 **Task Completed: ${reference}**\\n\\n✅ **Status:** Task marked as complete\\n⏰ **Completed:** ${new Date().toLocaleTimeString()}\\n📝 **Notes:** ${completionNotes.substring(0, 100)}${completionNotes.length > 100 ? '...' : ''}\\n\\n🔔 All stakeholders have been notified.\\n\\n👍 Great work! Use \`/assigned\` to see your remaining tasks.`
      };
      
    } catch (error) {
      logSecureError('Direct complete command error', context.requestContext, error instanceof Error ? error : undefined);
      return {
        success: false,
        message: 'Failed to complete the task. Please try again or use `/complete` for instructions.'
      };
    }
  }
  
  /**
   * Process task update session interactions
   */
  private static async processTaskUpdateSession(context: CommandContext, session: any): Promise<CommandResult> {
    const { step } = session;
    const message = context.messageContent.trim();
    
    // Handle cancel
    if (message.toLowerCase() === 'cancel') {
      CommandSessionManager.clearSession(context.fromPhone);
      return {
        success: true,
        message: "Update cancelled. Type /update to try again."
      };
    }
    
    switch (step) {
      case 'select_task':
        return await this.handleTaskSelection(context, session, message);
        
      case 'provide_update':
        return await this.handleTaskUpdate(context, session, message);
        
      case 'confirm_completion':
        return await this.handleTaskCompletion(context, session, message);
        
      default:
        CommandSessionManager.clearSession(context.fromPhone);
        return {
          success: false,
          message: 'Session error. Please start over with /update.'
        };
    }
  }
  
  /**
   * Handle task selection from numbered list
   */
  private static async handleTaskSelection(context: CommandContext, session: any, message: string): Promise<CommandResult> {
    const taskNumber = parseInt(message);
    
    if (isNaN(taskNumber) || taskNumber < 1 || taskNumber > session.tasks.length) {
      return {
        success: false,
        message: `Please reply with a valid number (1-${session.tasks.length}) or 'cancel'.`
      };
    }
    
    const selectedTask = session.tasks[taskNumber - 1];
    const ref = generateReferenceNumber({
      categoryName: selectedTask.category?.name,
      activityId: selectedTask.id
    });
    
    // Update session with selected task
    CommandSessionManager.updateSession(context.fromPhone, {
      step: 'provide_update',
      selectedTask,
      referenceNumber: ref
    });
    
    const responseMessage = `📝 *Update Progress: ${ref}*\\n\\n🏷️ **Task:** ${selectedTask.subcategory}\\n📍 **Location:** ${selectedTask.location}\\n📅 **Status:** ${selectedTask.status}\\n\\n💬 **Provide your update:**\\n• Describe what you've done\\n• Include any issues or progress\\n• You can also send a photo\\n\\n✅ **Options:**\\n• Type your update message\\n• Send 'complete' if task is finished\\n• Send 'cancel' to exit`;
    
    return {
      success: true,
      message: responseMessage,
      requiresFollowup: true,
      followupType: 'task_update'
    };
  }
  
  /**
   * Handle task update submission
   */
  private static async handleTaskUpdate(context: CommandContext, session: any, message: string): Promise<CommandResult> {
    const { selectedTask, referenceNumber, user } = session;
    
    // Check if user wants to complete the task
    if (message.toLowerCase() === 'complete') {
      CommandSessionManager.updateSession(context.fromPhone, {
        step: 'confirm_completion'
      });
      
      return {
        success: true,
        message: `✅ **Mark as Complete: ${referenceNumber}**\\n\\n🏷️ **Task:** ${selectedTask.subcategory}\\n📍 **Location:** ${selectedTask.location}\\n\\n⚠️ **Confirm Completion:**\\n• Reply 'yes' to mark as complete\\n• Reply 'no' to continue with regular update\\n• Optional: Add completion notes`,
        requiresFollowup: true,
        followupType: 'completion_confirmation'
      };
    }
    
    try {
      // Create activity update
      await withDb(async (prisma) => {
        await prisma.activityUpdate.create({
          data: {
            activity_id: selectedTask.id,
            author_id: user.id,
            notes: message,
            update_type: 'progress'
          }
        });
        
        // Update activity status to In Progress if it was Open
        if (selectedTask.status === 'Open') {
          await prisma.activity.update({
            where: { id: selectedTask.id },
            data: { status: 'In Progress' }
          });
        }
      });
      
      // Clear session
      CommandSessionManager.clearSession(context.fromPhone);
      
      // Send notifications to reporter and other stakeholders
      // This would integrate with the existing notification system
      
      logSecureInfo('Task update submitted via WhatsApp', context.requestContext, {
        taskId: selectedTask.id.substring(0, 8),
        userId: user.id.substring(0, 8),
        updateLength: message.length
      });
      
      return {
        success: true,
        message: `✅ **Update Logged: ${referenceNumber}**\\n\\n📝 **Your Update:** ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}\\n\\n📊 **Status:** ${selectedTask.status === 'Open' ? 'In Progress' : selectedTask.status}\\n⏰ **Time:** ${new Date().toLocaleTimeString()}\\n\\n🔔 Reporter and supervisors have been notified.\\n\\n💡 Type /update to update more tasks or /assigned to see all your tasks.`
      };
      
    } catch (error) {
      logSecureError('Failed to save task update', context.requestContext, error instanceof Error ? error : undefined);
      return {
        success: false,
        message: 'Failed to save your update. Please try again.'
      };
    }
  }
  
  /**
   * Handle task completion confirmation
   */
  private static async handleTaskCompletion(context: CommandContext, session: any, message: string): Promise<CommandResult> {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage === 'no') {
      CommandSessionManager.updateSession(context.fromPhone, {
        step: 'provide_update'
      });
      
      return {
        success: true,
        message: `📝 **Continue with regular update for ${session.referenceNumber}**\\n\\nPlease describe your progress or current status:`,
        requiresFollowup: true,
        followupType: 'task_update'
      };
    }
    
    if (lowerMessage !== 'yes' && !lowerMessage.startsWith('yes')) {
      return {
        success: false,
        message: "Please reply 'yes' to confirm completion, 'no' to continue with regular update, or 'cancel' to exit."
      };
    }
    
    try {
      const { selectedTask, referenceNumber, user } = session;
      const completionNotes = lowerMessage === 'yes' ? 'Task marked complete via WhatsApp' : message;
      
      // Mark task as completed
      await withDb(async (prisma) => {
        await prisma.activity.update({
          where: { id: selectedTask.id },
          data: {
            status: 'Resolved',
            resolution_notes: completionNotes
          }
        });
        
        // Create completion update
        await prisma.activityUpdate.create({
          data: {
            activity_id: selectedTask.id,
            author_id: user.id,
            notes: completionNotes,
            update_type: 'completion',
            status_context: 'Resolved'
          }
        });
      });
      
      // Clear session
      CommandSessionManager.clearSession(context.fromPhone);
      
      logSecureInfo('Task completed via WhatsApp', context.requestContext, {
        taskId: selectedTask.id.substring(0, 8),
        userId: user.id.substring(0, 8)
      });
      
      return {
        success: true,
        message: `🎉 **Task Completed: ${referenceNumber}**\\n\\n✅ **Status:** Task marked as complete\\n⏰ **Completed:** ${new Date().toLocaleTimeString()}\\n📝 **Notes:** ${completionNotes.substring(0, 100)}${completionNotes.length > 100 ? '...' : ''}\\n\\n🔔 All stakeholders have been notified.\\n\\n👍 Great work! Type /assigned to see your remaining tasks.`
      };
      
    } catch (error) {
      logSecureError('Failed to complete task', context.requestContext, error instanceof Error ? error : undefined);
      return {
        success: false,
        message: 'Failed to mark task as complete. Please try again.'
      };
    }
  }
  
  /**
   * Handle /assigned command
   */
  private static async handleAssignedCommand(context: CommandContext): Promise<CommandResult> {
    try {
      const user = await withDb(async (prisma) => {
        return prisma.user.findFirst({
          where: { phone_number: context.fromPhone }
        });
      });
      
      if (!user) {
        return {
          success: false,
          message: "No account found for your phone number. Contact your supervisor if you should have access to assigned tasks."
        };
      }
      
      const assignedActivities = await withDb(async (prisma) => {
        return prisma.activity.findMany({
          where: {
            assigned_to_user_id: user.id,
            status: { in: ['Open', 'In Progress'] }
          },
          orderBy: { timestamp: 'desc' },
          take: 10,
          include: {
            category: { select: { name: true } },
            user: { select: { name: true } }
          }
        });
      });
      
      if (assignedActivities.length === 0) {
        return {
          success: true,
          message: "📋 *No Assigned Tasks*\\n\\nYou currently have no open tasks assigned to you.\\n\\nGreat job keeping up with your work! 👍"
        };
      }
      
      let message = `📋 *Your Assigned Tasks*\n\nHi ${context.senderName}, here are your current tasks:\n\n`;
      
      assignedActivities.forEach((activity, index) => {
        const ref = generateReferenceNumber({
          categoryName: activity.category?.name,
          activityId: activity.id
        });
        const statusIcon = activity.status === 'In Progress' ? '🔄' : '⏳';
        
        message += `${index + 1}. ${statusIcon} **${ref}**\n`;
        message += `   ${activity.subcategory}\n`;
        message += `   📍 ${activity.location}\n`;
        message += `   👤 Reported by: ${activity.user?.name}\n`;
        message += `   📅 ${activity.timestamp.toLocaleDateString()}\n\n`;
      });
      
      message += `💡 *Quick Actions:*\n• Reply \`/update 2 your progress\` to update task #2\n• Reply \`/complete 3 task done\` to complete task #3\n• Reply \`/help\` for more commands`;
      
      return {
        success: true,
        message
      };
      
    } catch (error) {
      logSecureError('Assigned command error', context.requestContext, error instanceof Error ? error : undefined);
      return {
        success: false,
        message: 'Failed to retrieve your assigned tasks. Please try again later.'
      };
    }
  }
  
  /**
   * Handle /complete command - direct task completion
   */
  private static async handleCompleteCommand(context: CommandContext): Promise<CommandResult> {
    return {
      success: true,
      message: "🎯 **Complete Tasks**\\n\\nTo mark a task as complete:\\n\\n1️⃣ **Method 1:** Type `/update` and select your task\\n2️⃣ **Method 2:** Reply with task reference (e.g., `/complete MAIN-1234`)\\n3️⃣ **Method 3:** Use task number (e.g., `/complete 2`)\\n\\n💡 **Tip:** Use `/assigned` to see all your tasks with numbers."
    };
  }
  
  /**
   * Handle /help command
   */
  private static async handleHelpCommand(context: CommandContext): Promise<CommandResult> {
    return {
      success: true,
      message: `🔧 **WhatsApp Bot Help**\\n\\n**📋 Task Commands:**\\n• /assigned - View your assigned tasks\\n• /update - Update task progress\\n• /complete - Mark tasks complete\\n• /status - Check your reports\\n\\n**📝 Quick Updates:**\\n• \`/update 2 your progress\` - Update task #2\\n• \`/complete 3 task done\` - Complete task #3\\n• \`/update PROJ-4341 progress\` - Update by reference\\n\\n**🎯 Quick Actions:**\\n• Send task reference (e.g., MAIN-1234)\\n• Include photos with updates\\n\\n**📞 Need Help?**\\nContact your supervisor or school office directly.`
    };
  }
  
  /**
   * Handle /status command
   */
  private static async handleStatusCommand(context: CommandContext): Promise<CommandResult> {
    // This will use the existing implementation from the webhook
    return {
      success: true,
      message: "Status functionality will be handled by existing webhook implementation."
    };
  }
  
  /**
   * Handle task reference commands (e.g., "MAIN-1234")
   */
  private static async handleTaskReferenceCommand(context: CommandContext): Promise<CommandResult> {
    const reference = context.messageContent.trim().toUpperCase();
    const parsed = parseReferenceNumber(reference);
    
    if (!parsed.isValid) {
      return {
        success: false,
        message: `"${reference}" doesn't look like a valid task reference. Use format like MAIN-1234.\\n\\nType /assigned to see your tasks with reference numbers.`
      };
    }
    
    try {
      const activity = await withDb(async (prisma) => {
        return findActivityByReference(reference, prisma);
      });
      
      if (!activity) {
        return {
          success: false,
          message: `Task ${reference} not found or not accessible to you.\\n\\nType /assigned to see your current tasks.`
        };
      }
      
      // Check if user has access to this task
      const user = await withDb(async (prisma) => {
        return prisma.user.findFirst({
          where: { phone_number: context.fromPhone }
        });
      });
      
      if (!user || (activity.assigned_to_user_id !== user.id && activity.user_id !== user.id)) {
        return {
          success: false,
          message: `Task ${reference} is not assigned to you.\\n\\nType /assigned to see your current tasks.`
        };
      }
      
      const statusIcon = activity.status === 'Resolved' ? '✅' : 
                        activity.status === 'In Progress' ? '🔄' : '⏳';
      
      return {
        success: true,
        message: `📋 **Task Details: ${reference}**\\n\\n${statusIcon} **Status:** ${activity.status}\\n🏷️ **Task:** ${activity.subcategory}\\n📍 **Location:** ${activity.location}\\n👤 **Reported by:** ${activity.user?.name}\\n📅 **Created:** ${activity.timestamp.toLocaleDateString()}\\n\\n💡 **Actions:**\\n• Reply "update" to provide progress\\n• Reply "complete" to mark as done\\n• Type /update for full update interface`
      };
      
    } catch (error) {
      logSecureError('Task reference command error', context.requestContext, error instanceof Error ? error : undefined);
      return {
        success: false,
        message: 'Failed to retrieve task information. Please try again.'
      };
    }
  }
  
  /**
   * Check if message looks like a task reference
   */
  private static isTaskReference(message: string): boolean {
    const cleaned = message.trim().toUpperCase();
    // Handle dashboard format (#SUBNG0) or old format (MAIN-1234)
    return /^#[A-Z0-9]{4,8}$/.test(cleaned) || /^[A-Z]{3,5}-[A-Z0-9]{4,6}$/.test(cleaned);
  }
  
  /**
   * Process image/media updates (to be implemented)
   */
  private static async processMediaUpdate(context: CommandContext, mediaData: any): Promise<CommandResult> {
    // This will be implemented in the next phase for image support
    return {
      success: false,
      message: "Image support coming soon. Please provide text updates for now."
    };
  }
}

// Export the session manager for external use if needed
export { CommandSessionManager };