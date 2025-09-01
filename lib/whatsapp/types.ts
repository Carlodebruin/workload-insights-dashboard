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

export interface WhatsAppTemplate {
  id?: string;
  name: string;
  category: string;
  language: string;
  components: any[];
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MessageOptimization {
  shouldSendNow: boolean;
  reason: 'free_window' | 'new_window' | 'paid_required' | 'not_applicable';
  estimatedCost?: number;
  windowTimeRemaining?: number;
  recommendation?: string;
}

export interface WhatsAppCommand {
  command: string;
  description: string;
  handler?: (context: WhatsAppCommandContext) => Promise<void>;
  requiresAuth?: boolean;
  allowedRoles?: string[];
  examples?: string[];
  parameters?: any;
}

export interface WhatsAppCommandContext {
  fromPhone: string;
  senderName: string;
  messageId: string;
  args?: string[];
  user?: any;
  linkedUser?: any;
  message?: any;
  command?: string;
  parameters?: any;
}

export interface WhatsAppInboundMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: {
    body: string;
  };
  interactive?: any;
  media?: WhatsAppMediaContent;
  location?: WhatsAppLocationContent;
  image?: any;
  voice?: any;
  audio?: any;
  video?: any;
  document?: any;
}

export interface WhatsAppMediaContent {
  id: string;
  mime_type: string;
  sha256: string;
  url?: string;
  caption?: string;
}

export interface WhatsAppLocationContent {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface MessageWindowTracker {
  phoneNumber: string;
  windowStartTime: Date;
  messagesInWindow: number;
  lastMessageAt: Date;
  windowStart?: Date;
  messageCount?: number;
  lastMessage?: Date;
  isWindowActive?: boolean;
}

export interface WhatsAppUser {
  id: string;
  phoneNumber: string;
  displayName?: string;
  profileName?: string;
  isVerified: boolean;
  lastMessageAt: Date;
  messagesInWindow: number;
  windowStartTime: Date;
  isBlocked?: boolean;
  linkedUserId?: string;
}

export interface WhatsAppTemplateComponent {
  type: string;
  parameters?: any[];
  format?: string;
  text?: string;
  buttons?: any[];
}

export interface WhatsAppTemplateMessage {
  name: string;
  language: {
    code: string;
  };
  components?: WhatsAppTemplateComponent[];
  templateName?: string;
  languageCode?: string;
  parameters?: Array<{ type: 'text' | 'currency' | 'date_time'; text: string }>;
}
