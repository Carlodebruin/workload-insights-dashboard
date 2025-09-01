import { WhatsAppConfig } from './types';

class WhatsAppConfigManager {
  private static instance: WhatsAppConfigManager;
  private config: WhatsAppConfig | null = null;

  private constructor() {}

  public static getInstance(): WhatsAppConfigManager {
    if (!WhatsAppConfigManager.instance) {
      WhatsAppConfigManager.instance = new WhatsAppConfigManager();
    }
    return WhatsAppConfigManager.instance;
  }

  public initialize(): void {
    this.config = {
      appId: process.env.WHATSAPP_APP_ID || '',
      appSecret: process.env.WHATSAPP_APP_SECRET || '',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
      webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || '',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
      apiVersion: process.env.WHATSAPP_API_VERSION || 'v19.0',
      baseUrl: 'https://graph.facebook.com',
      webhookUrl: process.env.WHATSAPP_WEBHOOK_URL || '',
    };
  }

  public getConfig(): WhatsAppConfig {
    if (!this.config) {
      this.initialize();
    }
    return this.config!;
  }

  public getApiUrl(endpoint: string): string {
    const config = this.getConfig();
    return `${config.baseUrl}/${config.apiVersion}/${endpoint}`;
  }

  public getApiHeaders(): Record<string, string> {
    const config = this.getConfig();
    return {
      'Authorization': `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    };
  }
}

export const whatsappConfig = WhatsAppConfigManager.getInstance();
