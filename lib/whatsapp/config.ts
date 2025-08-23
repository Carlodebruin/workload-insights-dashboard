import { WhatsAppConfig } from './types';

/**
 * WhatsApp Business API Configuration
 * Manages secure configuration for Meta WhatsApp Business API
 */

export class WhatsAppConfigManager {
  private static instance: WhatsAppConfigManager;
  private config: WhatsAppConfig | null = null;

  private constructor() {}

  public static getInstance(): WhatsAppConfigManager {
    if (!WhatsAppConfigManager.instance) {
      WhatsAppConfigManager.instance = new WhatsAppConfigManager();
    }
    return WhatsAppConfigManager.instance;
  }

  /**
   * Initialize WhatsApp configuration from environment variables
   */
  public initialize(): void {
    // Helper function to clean environment variables
    const cleanEnvVar = (value: string | undefined): string => {
      if (!value) return '';
      return value.replace(/\\n$/, '').replace(/\n$/, '').trim();
    };

    this.config = {
      appId: cleanEnvVar(process.env.WHATSAPP_APP_ID),
      appSecret: cleanEnvVar(process.env.WHATSAPP_APP_SECRET),
      accessToken: cleanEnvVar(process.env.WHATSAPP_ACCESS_TOKEN),
      webhookVerifyToken: cleanEnvVar(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN),
      phoneNumberId: cleanEnvVar(process.env.WHATSAPP_PHONE_NUMBER_ID),
      businessAccountId: cleanEnvVar(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID),
      apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
      baseUrl: 'https://graph.facebook.com',
      webhookUrl: cleanEnvVar(process.env.WHATSAPP_WEBHOOK_URL)
    };

    this.validateConfiguration();
  }

  /**
   * Get current configuration
   */
  public getConfig(): WhatsAppConfig {
    if (!this.config) {
      throw new Error('WhatsApp configuration not initialized. Call initialize() first.');
    }
    return { ...this.config };
  }

  /**
   * Get API endpoint URL
   */
  public getApiUrl(endpoint: string): string {
    const config = this.getConfig();
    return `${config.baseUrl}/${config.apiVersion}/${endpoint}`;
  }

  /**
   * Get headers for API requests
   */
  public getApiHeaders(): Record<string, string> {
    const config = this.getConfig();
    return {
      'Authorization': `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Validate that all required configuration is present
   */
  private validateConfiguration(): void {
    if (!this.config) {
      throw new Error('Configuration not initialized');
    }

    const requiredFields: (keyof WhatsAppConfig)[] = [
      'appId',
      'appSecret', 
      'accessToken',
      'webhookVerifyToken',
      'phoneNumberId',
      'businessAccountId'
    ];

    const missingFields = requiredFields.filter(field => !this.config![field]);

    if (missingFields.length > 0) {
      throw new Error(
        `Missing required WhatsApp configuration: ${missingFields.join(', ')}. ` +
        'Please set the following environment variables: ' +
        missingFields.map(field => this.envVarName(field)).join(', ')
      );
    }
  }

  /**
   * Map config field to environment variable name
   */
  private envVarName(field: keyof WhatsAppConfig): string {
    const mapping: Record<keyof WhatsAppConfig, string> = {
      appId: 'WHATSAPP_APP_ID',
      appSecret: 'WHATSAPP_APP_SECRET',
      accessToken: 'WHATSAPP_ACCESS_TOKEN',
      webhookVerifyToken: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
      phoneNumberId: 'WHATSAPP_PHONE_NUMBER_ID',
      businessAccountId: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
      apiVersion: 'WHATSAPP_API_VERSION',
      baseUrl: 'WHATSAPP_BASE_URL',
      webhookUrl: 'WHATSAPP_WEBHOOK_URL'
    };
    return mapping[field];
  }

  /**
   * Test configuration by making a test API call
   */
  public async testConfiguration(): Promise<{ success: boolean; error?: string }> {
    try {
      const config = this.getConfig();
      const response = await fetch(
        this.getApiUrl(`${config.phoneNumberId}`),
        {
          method: 'GET',
          headers: this.getApiHeaders()
        }
      );

      if (response.ok) {
        return { success: true };
      } else {
        const errorData = await response.json();
        return { 
          success: false, 
          error: `API test failed: ${errorData.error?.message || response.statusText}` 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Configuration test failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Check if configuration is complete
   */
  public isConfigured(): boolean {
    try {
      this.validateConfiguration();
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const whatsappConfig = WhatsAppConfigManager.getInstance();