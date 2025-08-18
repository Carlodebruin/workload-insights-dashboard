// WhatsApp Business API Types and Interfaces

export interface WhatsAppUser {
  id: string;
  phoneNumber: string;
  displayName?: string;
  profileName?: string;
  isVerified: boolean;
  linkedUserId?: string; // Link to existing User model
  isBlocked: boolean;
  lastMessageAt?: Date;
  messagesInWindow: number; // Track free messages in 24h window
  windowStartTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsAppMessage {
  id: string;
  waId: string; // WhatsApp message ID
  from: string; // Phone number
  to: string; // Business phone number
  type: 'text' | 'image' | 'voice' | 'location' | 'document' | 'video' | 'audio';
  content: string | WhatsAppMediaContent | WhatsAppLocationContent;
  timestamp: Date;
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'read' | 'failed';
  isFreeMessage: boolean; // Whether it used free 24h window
  context?: WhatsAppMessageContext; // Reply context
  relatedActivityId?: string; // Link to Activity if relevant
  processed: boolean;
  processingError?: string;
}

export interface WhatsAppMediaContent {
  mediaId: string;
  mimeType: string;
  sha256: string;
  filename?: string;
  caption?: string;
  url?: string; // Downloaded URL
}

export interface WhatsAppLocationContent {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface WhatsAppMessageContext {
  messageId: string; // ID of message being replied to
  from: string;
  type: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  category: 'utility' | 'marketing' | 'authentication';
  status: 'approved' | 'pending' | 'rejected';
  components: WhatsAppTemplateComponent[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'footer' | 'buttons';
  format?: 'text' | 'image' | 'video' | 'document';
  text?: string;
  parameters?: WhatsAppTemplateParameter[];
  buttons?: WhatsAppTemplateButton[];
}

export interface WhatsAppTemplateParameter {
  type: 'text' | 'currency' | 'date_time';
  text?: string;
}

export interface WhatsAppTemplateButton {
  type: 'quick_reply' | 'url' | 'phone_number';
  text: string;
  payload?: string;
  url?: string;
  phone_number?: string;
}

export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: WhatsAppWebhookEntry[];
}

export interface WhatsAppWebhookEntry {
  id: string;
  changes: WhatsAppWebhookChange[];
}

export interface WhatsAppWebhookChange {
  value: {
    messaging_product: 'whatsapp';
    metadata: {
      display_phone_number: string;
      phone_number_id: string;
    };
    contacts?: WhatsAppContact[];
    messages?: WhatsAppInboundMessage[];
    statuses?: WhatsAppMessageStatus[];
    errors?: WhatsAppError[];
  };
  field: 'messages';
}

export interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

export interface WhatsAppInboundMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'voice' | 'location' | 'document' | 'video' | 'audio';
  text?: { body: string };
  image?: WhatsAppMediaMessage;
  voice?: WhatsAppMediaMessage;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  document?: WhatsAppMediaMessage;
  video?: WhatsAppMediaMessage;
  audio?: WhatsAppMediaMessage;
  context?: {
    from: string;
    id: string;
  };
}

export interface WhatsAppMediaMessage {
  id: string;
  mime_type: string;
  sha256: string;
  caption?: string;
  filename?: string;
}

export interface WhatsAppMessageStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: WhatsAppError[];
}

export interface WhatsAppError {
  code: number;
  title: string;
  message: string;
  error_data?: {
    details: string;
  };
}

// Command System Types
export interface WhatsAppCommand {
  command: string;
  description: string;
  requiresAuth: boolean;
  allowedRoles: string[];
  parameters?: WhatsAppCommandParameter[];
  examples: string[];
}

export interface WhatsAppCommandParameter {
  name: string;
  type: 'text' | 'number' | 'location' | 'image';
  required: boolean;
  description: string;
}

export interface WhatsAppCommandContext {
  user: WhatsAppUser;
  linkedUser?: any; // User from your system
  message: WhatsAppMessage;
  command: string;
  parameters: string[];
}

// Configuration Types
export interface WhatsAppConfig {
  appId: string;
  appSecret: string;
  accessToken: string;
  webhookVerifyToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  apiVersion: string;
  baseUrl: string;
  webhookUrl: string;
}

// Analytics Types
export interface WhatsAppAnalytics {
  totalMessages: number;
  freeMessages: number;
  paidMessages: number;
  messagesByType: Record<string, number>;
  messagesByDirection: Record<string, number>;
  activeUsers: number;
  responseTime: number; // Average response time in minutes
  period: {
    start: Date;
    end: Date;
  };
}

// Free Message Window Optimization
export interface MessageWindowTracker {
  phoneNumber: string;
  windowStart: Date;
  messageCount: number;
  lastMessage: Date;
  isWindowActive: boolean;
}

export interface MessageOptimization {
  shouldSendNow: boolean;
  reason: 'free_window' | 'new_window' | 'paid_required';
  estimatedCost?: number;
  windowTimeRemaining?: number; // Minutes remaining in free window
  recommendation?: string;
}