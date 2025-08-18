import { WhatsAppCommand, WhatsAppCommandContext, WhatsAppInboundMessage } from './types';
import { whatsappMessaging } from './messaging-service';
import { WhatsAppMediaHandler } from './media-handler';
import { prisma } from '../prisma';
import { logSecureInfo, logSecureError, logSecureWarning } from '../secure-logger';

/**
 * WhatsApp Command System
 * Handles role-based commands and responses for WhatsApp integration
 */

export class WhatsAppCommandSystem {
  private static commands: Map<string, WhatsAppCommand> = new Map();

  /**
   * Initialize command system with available commands
   */
  public static initialize(): void {
    this.registerCommands();
  }

  /**
   * Register all available commands
   */
  private static registerCommands(): void {
    // General Commands (available to all verified users)
    this.commands.set('help', {
      command: 'help',
      description: 'Show available commands',
      requiresAuth: true,
      allowedRoles: ['Teacher', 'Admin', 'Maintenance', 'Support Staff'],
      examples: ['/help', '/help report']
    });

    this.commands.set('status', {
      command: 'status',
      description: 'Check your account status and recent activities',
      requiresAuth: true,
      allowedRoles: ['Teacher', 'Admin', 'Maintenance', 'Support Staff'],
      examples: ['/status']
    });

    this.commands.set('report', {
      command: 'report',
      description: 'Create a new incident report',
      requiresAuth: true,
      allowedRoles: ['Teacher', 'Admin', 'Maintenance', 'Support Staff'],
      parameters: [
        { name: 'location', type: 'text', required: true, description: 'Location of the incident' },
        { name: 'description', type: 'text', required: true, description: 'Description of the issue' }
      ],
      examples: ['/report Classroom 5A Broken projector', '/report Library Leaking roof']
    });

    // Teacher-specific Commands
    this.commands.set('myreports', {
      command: 'myreports',
      description: 'View your recent incident reports',
      requiresAuth: true,
      allowedRoles: ['Teacher', 'Admin'],
      examples: ['/myreports', '/myreports 5']
    });

    // Maintenance-specific Commands
    this.commands.set('assigned', {
      command: 'assigned',
      description: 'View incidents assigned to you',
      requiresAuth: true,
      allowedRoles: ['Maintenance', 'Admin'],
      examples: ['/assigned', '/assigned pending']
    });

    this.commands.set('complete', {
      command: 'complete',
      description: 'Mark an incident as completed',
      requiresAuth: true,
      allowedRoles: ['Maintenance', 'Admin'],
      parameters: [
        { name: 'incident_id', type: 'text', required: true, description: 'ID of the incident to complete' },
        { name: 'notes', type: 'text', required: false, description: 'Resolution notes' }
      ],
      examples: ['/complete ABC123 Fixed the projector', '/complete XYZ789']
    });

    // Admin-specific Commands
    this.commands.set('assign', {
      command: 'assign',
      description: 'Assign an incident to a maintenance staff member',
      requiresAuth: true,
      allowedRoles: ['Admin'],
      parameters: [
        { name: 'incident_id', type: 'text', required: true, description: 'ID of the incident' },
        { name: 'staff_phone', type: 'text', required: true, description: 'Phone number of staff member' }
      ],
      examples: ['/assign ABC123 +27821234567']
    });

    this.commands.set('stats', {
      command: 'stats',
      description: 'View system statistics',
      requiresAuth: true,
      allowedRoles: ['Admin'],
      examples: ['/stats', '/stats week']
    });

    // System Commands (no auth required)
    this.commands.set('start', {
      command: 'start',
      description: 'Start using the system (verify your phone number)',
      requiresAuth: false,
      allowedRoles: [],
      examples: ['/start']
    });

    this.commands.set('verify', {
      command: 'verify',
      description: 'Verify your phone number with a code',
      requiresAuth: false,
      allowedRoles: [],
      parameters: [
        { name: 'code', type: 'text', required: true, description: '6-digit verification code' }
      ],
      examples: ['/verify 123456']
    });
  }

  /**
   * Process a command from a WhatsApp message
   */
  public static async processCommand(
    message: WhatsAppInboundMessage,
    whatsappUser: any,
    requestContext: any
  ): Promise<void> {
    try {
      const messageText = message.text?.body || '';
      const commandParts = messageText.split(' ');
      const commandName = commandParts[0].substring(1).toLowerCase(); // Remove '/' prefix
      const parameters = commandParts.slice(1);

      const command = this.commands.get(commandName);
      if (!command) {
        await this.sendUnknownCommandResponse(whatsappUser.phoneNumber, commandName);
        return;
      }

      // Check authentication requirements
      if (command.requiresAuth && !whatsappUser.isVerified) {
        await this.sendAuthRequiredResponse(whatsappUser.phoneNumber, commandName);
        return;
      }

      // Check role permissions
      if (command.requiresAuth && whatsappUser.linkedUser) {
        const userRole = whatsappUser.linkedUser.role;
        if (!command.allowedRoles.includes(userRole)) {
          await this.sendPermissionDeniedResponse(whatsappUser.phoneNumber, commandName, userRole);
          return;
        }
      }

      // Create command context
      const context: WhatsAppCommandContext = {
        user: whatsappUser,
        linkedUser: whatsappUser.linkedUser,
        message: {
          id: message.id,
          waId: message.id,
          from: message.from,
          to: '', // Will be filled by messaging service
          type: 'text',
          content: messageText,
          timestamp: new Date(parseInt(message.timestamp) * 1000),
          direction: 'inbound',
          status: 'delivered',
          isFreeMessage: true,
          processed: true
        },
        command: commandName,
        parameters
      };

      // Execute command
      await this.executeCommand(command, context, requestContext);

    } catch (error) {
      logSecureError('Failed to process WhatsApp command', requestContext,
        error instanceof Error ? error : undefined);
      
      await this.sendErrorResponse(whatsappUser.phoneNumber);
    }
  }

  /**
   * Execute a specific command
   */
  private static async executeCommand(
    command: WhatsAppCommand,
    context: WhatsAppCommandContext,
    requestContext: any
  ): Promise<void> {
    logSecureInfo('Executing WhatsApp command', requestContext, {
      command: command.command,
      userId: context.linkedUser?.id,
      userRole: context.linkedUser?.role,
      phoneNumber: this.maskPhoneNumber(context.user.phoneNumber)
    });

    switch (command.command) {
      case 'help':
        await this.handleHelpCommand(context);
        break;
      
      case 'status':
        await this.handleStatusCommand(context);
        break;
      
      case 'report':
        await this.handleReportCommand(context);
        break;
      
      case 'myreports':
        await this.handleMyReportsCommand(context);
        break;
      
      case 'assigned':
        await this.handleAssignedCommand(context);
        break;
      
      case 'complete':
        await this.handleCompleteCommand(context);
        break;
      
      case 'assign':
        await this.handleAssignCommand(context);
        break;
      
      case 'stats':
        await this.handleStatsCommand(context);
        break;
      
      case 'start':
        await this.handleStartCommand(context);
        break;
      
      case 'verify':
        await this.handleVerifyCommand(context);
        break;
      
      default:
        await this.sendUnknownCommandResponse(context.user.phoneNumber, command.command);
    }
  }

  /**
   * Handle /help command
   */
  private static async handleHelpCommand(context: WhatsAppCommandContext): Promise<void> {
    const userRole = context.linkedUser?.role || 'Guest';
    const availableCommands = Array.from(this.commands.values()).filter(cmd => 
      !cmd.requiresAuth || (context.user.isVerified && cmd.allowedRoles.includes(userRole))
    );

    let helpText = `*Available Commands for ${userRole}:*\n\n`;
    
    availableCommands.forEach(cmd => {
      helpText += `*/${cmd.command}* - ${cmd.description}\n`;
      if (cmd.examples.length > 0) {
        helpText += `Example: ${cmd.examples[0]}\n`;
      }
      helpText += '\n';
    });

    helpText += '_Send a photo, voice note, or location to create an incident report._';

    await whatsappMessaging.sendQuickResponse(context.user.phoneNumber, helpText);
  }

  /**
   * Handle /status command
   */
  private static async handleStatusCommand(context: WhatsAppCommandContext): Promise<void> {
    if (!context.linkedUser) {
      await whatsappMessaging.sendQuickResponse(
        context.user.phoneNumber,
        'Please verify your account first using /start'
      );
      return;
    }

    // Get user's recent activities
    const recentActivities = await prisma.activity.findMany({
      where: { user_id: context.linkedUser.id },
      orderBy: { timestamp: 'desc' },
      take: 5,
      include: { category: true }
    });

    let statusText = `*Account Status*\n`;
    statusText += `Name: ${context.linkedUser.name}\n`;
    statusText += `Role: ${context.linkedUser.role}\n`;
    statusText += `Phone: ${this.maskPhoneNumber(context.user.phoneNumber)}\n\n`;

    if (recentActivities.length > 0) {
      statusText += `*Recent Reports (${recentActivities.length}):*\n`;
      recentActivities.forEach(activity => {
        statusText += `• ${activity.subcategory} - ${activity.status}\n`;
        statusText += `  ${activity.location} (${new Date(activity.timestamp).toLocaleDateString()})\n`;
      });
    } else {
      statusText += '*No recent reports*';
    }

    await whatsappMessaging.sendQuickResponse(context.user.phoneNumber, statusText);
  }

  /**
   * Handle /report command
   */
  private static async handleReportCommand(context: WhatsAppCommandContext): Promise<void> {
    if (!context.linkedUser) {
      await whatsappMessaging.sendQuickResponse(
        context.user.phoneNumber,
        'Please verify your account first using /start'
      );
      return;
    }

    if (context.parameters.length < 2) {
      await whatsappMessaging.sendQuickResponse(
        context.user.phoneNumber,
        '*Usage:* /report [location] [description]\n\n*Example:* /report Classroom 5A Broken projector'
      );
      return;
    }

    const location = context.parameters[0];
    const description = context.parameters.slice(1).join(' ');

    try {
      // Create incident report
      const activity = await prisma.activity.create({
        data: {
          user_id: context.linkedUser.id,
          category_id: await this.getDefaultCategoryId(),
          subcategory: 'Text Report',
          location,
          notes: description,
          status: 'Open',
          timestamp: new Date()
        }
      });

      await whatsappMessaging.sendQuickResponse(
        context.user.phoneNumber,
        `✅ *Report Created*\n\nReport ID: ${activity.id.substring(0, 8)}\nLocation: ${location}\nStatus: Open\n\nYour report has been submitted and will be reviewed by our team.`
      );

      logSecureInfo('Incident report created via WhatsApp command', {
        operation: 'command_report'
      }, {
        activityId: activity.id,
        userId: context.linkedUser.id,
        location,
        phoneNumber: this.maskPhoneNumber(context.user.phoneNumber)
      });

    } catch (error) {
      logSecureError('Failed to create report via command', {
        operation: 'command_report'
      }, error instanceof Error ? error : undefined);

      await whatsappMessaging.sendQuickResponse(
        context.user.phoneNumber,
        '❌ Failed to create report. Please try again or contact support.'
      );
    }
  }

  /**
   * Handle /myreports command
   */
  private static async handleMyReportsCommand(context: WhatsAppCommandContext): Promise<void> {
    if (!context.linkedUser) {
      await whatsappMessaging.sendQuickResponse(
        context.user.phoneNumber,
        'Please verify your account first using /start'
      );
      return;
    }

    const limit = context.parameters[0] ? parseInt(context.parameters[0]) : 10;
    
    const activities = await prisma.activity.findMany({
      where: { user_id: context.linkedUser.id },
      orderBy: { timestamp: 'desc' },
      take: Math.min(limit, 20), // Max 20 for readability
      include: { category: true }
    });

    if (activities.length === 0) {
      await whatsappMessaging.sendQuickResponse(
        context.user.phoneNumber,
        '*No reports found*\n\nYou haven\'t submitted any reports yet. Use /report to create one.'
      );
      return;
    }

    let reportsText = `*Your Recent Reports (${activities.length}):*\n\n`;
    
    activities.forEach(activity => {
      const date = new Date(activity.timestamp).toLocaleDateString();
      reportsText += `*${activity.subcategory}*\n`;
      reportsText += `ID: ${activity.id.substring(0, 8)}\n`;
      reportsText += `Location: ${activity.location}\n`;
      reportsText += `Status: ${activity.status}\n`;
      reportsText += `Date: ${date}\n\n`;
    });

    await whatsappMessaging.sendQuickResponse(context.user.phoneNumber, reportsText);
  }

  /**
   * Handle /assigned command (for maintenance staff)
   */
  private static async handleAssignedCommand(context: WhatsAppCommandContext): Promise<void> {
    if (!context.linkedUser) {
      await whatsappMessaging.sendQuickResponse(
        context.user.phoneNumber,
        'Please verify your account first using /start'
      );
      return;
    }

    const statusFilter = context.parameters[0]?.toLowerCase() || 'all';
    const whereClause: any = { assigned_to_user_id: context.linkedUser.id };
    
    if (statusFilter !== 'all') {
      whereClause.status = statusFilter === 'pending' ? 'In Progress' : statusFilter;
    }

    const assignedActivities = await prisma.activity.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      take: 15,
      include: { user: true, category: true }
    });

    if (assignedActivities.length === 0) {
      await whatsappMessaging.sendQuickResponse(
        context.user.phoneNumber,
        '*No assigned tasks*\n\nYou don\'t have any assigned incidents at the moment.'
      );
      return;
    }

    let assignedText = `*Assigned to You (${assignedActivities.length}):*\n\n`;
    
    assignedActivities.forEach(activity => {
      const date = new Date(activity.timestamp).toLocaleDateString();
      assignedText += `*${activity.subcategory}*\n`;
      assignedText += `ID: ${activity.id.substring(0, 8)}\n`;
      assignedText += `Location: ${activity.location}\n`;
      assignedText += `Status: ${activity.status}\n`;
      assignedText += `Reporter: ${activity.user.name}\n`;
      assignedText += `Date: ${date}\n\n`;
    });

    await whatsappMessaging.sendQuickResponse(context.user.phoneNumber, assignedText);
  }

  /**
   * Handle /complete command
   */
  private static async handleCompleteCommand(context: WhatsAppCommandContext): Promise<void> {
    if (!context.linkedUser) {
      await whatsappMessaging.sendQuickResponse(
        context.user.phoneNumber,
        'Please verify your account first using /start'
      );
      return;
    }

    if (context.parameters.length < 1) {
      await whatsappMessaging.sendQuickResponse(
        context.user.phoneNumber,
        '*Usage:* /complete [incident_id] [resolution_notes]\n\n*Example:* /complete ABC123 Fixed the projector'
      );
      return;
    }

    const incidentIdPrefix = context.parameters[0];
    const resolutionNotes = context.parameters.slice(1).join(' ') || 'Completed via WhatsApp';

    try {
      // Find activity by ID prefix
      const activity = await prisma.activity.findFirst({
        where: {
          id: { startsWith: incidentIdPrefix },
          assigned_to_user_id: context.linkedUser.id
        }
      });

      if (!activity) {
        await whatsappMessaging.sendQuickResponse(
          context.user.phoneNumber,
          `❌ *Incident not found*\n\nNo incident found with ID starting with "${incidentIdPrefix}" assigned to you.`
        );
        return;
      }

      // Update activity status
      await prisma.activity.update({
        where: { id: activity.id },
        data: {
          status: 'Resolved',
          resolution_notes: resolutionNotes
        }
      });

      await whatsappMessaging.sendQuickResponse(
        context.user.phoneNumber,
        `✅ *Incident Completed*\n\nID: ${activity.id.substring(0, 8)}\nLocation: ${activity.location}\nResolution: ${resolutionNotes}\n\nThank you for completing this task!`
      );

      logSecureInfo('Incident completed via WhatsApp command', {
        operation: 'command_complete'
      }, {
        activityId: activity.id,
        completedBy: context.linkedUser.id,
        phoneNumber: this.maskPhoneNumber(context.user.phoneNumber)
      });

    } catch (error) {
      logSecureError('Failed to complete incident via command', {
        operation: 'command_complete'
      }, error instanceof Error ? error : undefined);

      await whatsappMessaging.sendQuickResponse(
        context.user.phoneNumber,
        '❌ Failed to update incident. Please try again or contact support.'
      );
    }
  }

  /**
   * Handle /assign command (admin only)
   */
  private static async handleAssignCommand(context: WhatsAppCommandContext): Promise<void> {
    if (context.parameters.length < 2) {
      await whatsappMessaging.sendQuickResponse(
        context.user.phoneNumber,
        '*Usage:* /assign [incident_id] [staff_phone]\n\n*Example:* /assign ABC123 +27821234567'
      );
      return;
    }

    const incidentIdPrefix = context.parameters[0];
    const staffPhone = context.parameters[1];

    try {
      // Find incident
      const activity = await prisma.activity.findFirst({
        where: { id: { startsWith: incidentIdPrefix } }
      });

      if (!activity) {
        await whatsappMessaging.sendQuickResponse(
          context.user.phoneNumber,
          `❌ *Incident not found*\n\nNo incident found with ID starting with "${incidentIdPrefix}".`
        );
        return;
      }

      // Find staff member
      const staffUser = await prisma.user.findUnique({
        where: { phone_number: staffPhone }
      });

      if (!staffUser) {
        await whatsappMessaging.sendQuickResponse(
          context.user.phoneNumber,
          `❌ *Staff member not found*\n\nNo user found with phone number ${staffPhone}.`
        );
        return;
      }

      // Assign incident
      await prisma.activity.update({
        where: { id: activity.id },
        data: {
          assigned_to_user_id: staffUser.id,
          status: 'In Progress'
        }
      });

      await whatsappMessaging.sendQuickResponse(
        context.user.phoneNumber,
        `✅ *Incident Assigned*\n\nID: ${activity.id.substring(0, 8)}\nAssigned to: ${staffUser.name}\nLocation: ${activity.location}`
      );

      // Notify assigned staff member
      await whatsappMessaging.sendMessage({
        to: staffPhone,
        type: 'text',
        content: `🔔 *New Assignment*\n\nYou have been assigned a new incident:\n\nID: ${activity.id.substring(0, 8)}\nLocation: ${activity.location}\nDescription: ${activity.notes || 'No description'}\n\nUse /assigned to view all your tasks.`,
        priority: 'high'
      });

    } catch (error) {
      logSecureError('Failed to assign incident via command', {
        operation: 'command_assign'
      }, error instanceof Error ? error : undefined);

      await whatsappMessaging.sendQuickResponse(
        context.user.phoneNumber,
        '❌ Failed to assign incident. Please try again or contact support.'
      );
    }
  }

  /**
   * Handle /stats command (admin only)
   */
  private static async handleStatsCommand(context: WhatsAppCommandContext): Promise<void> {
    try {
      const period = context.parameters[0]?.toLowerCase() || 'all';
      let dateFilter = {};

      if (period === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateFilter = { timestamp: { gte: weekAgo } };
      } else if (period === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateFilter = { timestamp: { gte: monthAgo } };
      }

      // Get statistics
      const [total, open, inProgress, resolved] = await Promise.all([
        prisma.activity.count({ where: dateFilter }),
        prisma.activity.count({ where: { ...dateFilter, status: 'Open' } }),
        prisma.activity.count({ where: { ...dateFilter, status: 'In Progress' } }),
        prisma.activity.count({ where: { ...dateFilter, status: 'Resolved' } })
      ]);

      const periodText = period === 'all' ? 'All Time' : period === 'week' ? 'Last 7 Days' : 'Last Month';

      let statsText = `*System Statistics (${periodText})*\n\n`;
      statsText += `Total Reports: ${total}\n`;
      statsText += `Open: ${open}\n`;
      statsText += `In Progress: ${inProgress}\n`;
      statsText += `Resolved: ${resolved}\n\n`;
      
      if (total > 0) {
        const resolvedPercentage = Math.round((resolved / total) * 100);
        statsText += `Resolution Rate: ${resolvedPercentage}%`;
      }

      await whatsappMessaging.sendQuickResponse(context.user.phoneNumber, statsText);

    } catch (error) {
      logSecureError('Failed to get stats via command', {
        operation: 'command_stats'
      }, error instanceof Error ? error : undefined);

      await whatsappMessaging.sendQuickResponse(
        context.user.phoneNumber,
        '❌ Failed to get statistics. Please try again.'
      );
    }
  }

  /**
   * Handle /start command
   */
  private static async handleStartCommand(context: WhatsAppCommandContext): Promise<void> {
    if (context.user.isVerified) {
      await whatsappMessaging.sendQuickResponse(
        context.user.phoneNumber,
        `✅ *Already Verified*\n\nYour account is already verified!\n\nUse /help to see available commands.`
      );
      return;
    }

    await whatsappMessaging.sendQuickResponse(
      context.user.phoneNumber,
      `👋 *Welcome to the Workload Insights System*\n\nTo get started, you need to verify your phone number.\n\nIf you're a registered user, you'll be automatically linked to your account. If not, a new account will be created for you.\n\nA verification code will be sent to this number. Please wait...`
    );

    // This would trigger the verification process
    // For now, just inform them to contact admin
    await whatsappMessaging.sendQuickResponse(
      context.user.phoneNumber,
      `📱 *Verification Required*\n\nPlease contact your system administrator to complete the verification process.\n\nThey will help link your WhatsApp to your account.`
    );
  }

  /**
   * Handle /verify command
   */
  private static async handleVerifyCommand(context: WhatsAppCommandContext): Promise<void> {
    if (context.parameters.length < 1) {
      await whatsappMessaging.sendQuickResponse(
        context.user.phoneNumber,
        '*Usage:* /verify [6-digit-code]\n\n*Example:* /verify 123456'
      );
      return;
    }

    const code = context.parameters[0];
    
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      await whatsappMessaging.sendQuickResponse(
        context.user.phoneNumber,
        '❌ *Invalid Code*\n\nPlease enter a 6-digit verification code.\n\n*Example:* /verify 123456'
      );
      return;
    }

    // In a full implementation, this would verify the code
    await whatsappMessaging.sendQuickResponse(
      context.user.phoneNumber,
      `🔐 *Verification Code Received*\n\nCode: ${code}\n\nPlease contact your administrator to complete the verification process.`
    );
  }

  /**
   * Send response for unknown command
   */
  private static async sendUnknownCommandResponse(phoneNumber: string, command: string): Promise<void> {
    await whatsappMessaging.sendQuickResponse(
      phoneNumber,
      `❓ *Unknown Command*\n\nThe command "/${command}" is not recognized.\n\nUse /help to see available commands.`
    );
  }

  /**
   * Send response when authentication is required
   */
  private static async sendAuthRequiredResponse(phoneNumber: string, command: string): Promise<void> {
    await whatsappMessaging.sendQuickResponse(
      phoneNumber,
      `🔒 *Authentication Required*\n\nYou need to verify your account to use "/${command}".\n\nUse /start to begin verification.`
    );
  }

  /**
   * Send response when user lacks permission
   */
  private static async sendPermissionDeniedResponse(phoneNumber: string, command: string, userRole: string): Promise<void> {
    await whatsappMessaging.sendQuickResponse(
      phoneNumber,
      `⛔ *Permission Denied*\n\nYour role (${userRole}) doesn't have permission to use "/${command}".\n\nUse /help to see available commands.`
    );
  }

  /**
   * Send generic error response
   */
  private static async sendErrorResponse(phoneNumber: string): Promise<void> {
    await whatsappMessaging.sendQuickResponse(
      phoneNumber,
      `❌ *Error*\n\nSomething went wrong while processing your command. Please try again or contact support.`
    );
  }

  /**
   * Get default category ID
   */
  private static async getDefaultCategoryId(): Promise<string> {
    try {
      const category = await prisma.category.findFirst({
        where: { name: 'General' }
      });

      if (category) {
        return category.id;
      }

      const newCategory = await prisma.category.create({
        data: {
          name: 'General',
          isSystem: true
        }
      });

      return newCategory.id;
    } catch (error) {
      throw new Error('Could not determine category for incident');
    }
  }

  /**
   * Mask phone number for logging
   */
  private static maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length < 4) return '****';
    return phoneNumber.slice(0, -4).replace(/./g, '*') + phoneNumber.slice(-4);
  }

  /**
   * Get available commands for a user role
   */
  public static getCommandsForRole(role: string, isVerified: boolean): WhatsAppCommand[] {
    return Array.from(this.commands.values()).filter(cmd => 
      !cmd.requiresAuth || (isVerified && cmd.allowedRoles.includes(role))
    );
  }
}

// Initialize the command system
WhatsAppCommandSystem.initialize();