'use client';

import React, { useState, useEffect } from 'react';
import { PlusCircle, Edit, Trash2, Eye, EyeOff, MessageCircle, Settings, Key, Phone, Link } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import Spinner from './Spinner';

interface WhatsAppConfig {
  id: string;
  key: string;
  value: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface WhatsAppConfigManagementProps {
  dataLoading?: boolean;
}

interface WhatsAppConfigFormData {
  appId: string;
  appSecret: string;
  accessToken: string;
  webhookVerifyToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  webhookUrl: string;
}

const WhatsAppConfigManagement: React.FC<WhatsAppConfigManagementProps> = ({ dataLoading = false }) => {
  const [configs, setConfigs] = useState<WhatsAppConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [formData, setFormData] = useState<WhatsAppConfigFormData>({
    appId: '',
    appSecret: '',
    accessToken: '',
    webhookVerifyToken: '',
    phoneNumberId: '',
    businessAccountId: '',
    webhookUrl: '',
  });
  
  const { addToast } = useToast();

  // Load configurations on component mount
  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    try {
      const response = await fetch('/api/whatsapp/config', {
        headers: {
          'Authorization': 'Bearer demo-admin-token',
          'Origin': typeof window !== 'undefined' ? window.location.origin : '',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setConfigs(data.configs || []);
        
        // Pre-populate form if configs exist
        if (data.configs?.length > 0) {
          const configMap = data.configs.reduce((acc: any, config: WhatsAppConfig) => {
            acc[config.key] = config.value;
            return acc;
          }, {});
          
          setFormData({
            appId: configMap.WHATSAPP_APP_ID || '',
            appSecret: configMap.WHATSAPP_APP_SECRET || '',
            accessToken: configMap.WHATSAPP_ACCESS_TOKEN || '',
            webhookVerifyToken: configMap.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
            phoneNumberId: configMap.WHATSAPP_PHONE_NUMBER_ID || '',
            businessAccountId: configMap.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
            webhookUrl: configMap.WHATSAPP_WEBHOOK_URL || '',
          });
        }
      }
    } catch (error) {
      console.error('Failed to load WhatsApp configurations:', error);
      addToast('Error', 'Failed to load WhatsApp configurations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfiguration = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const configData = [
        { key: 'WHATSAPP_APP_ID', value: formData.appId, description: 'WhatsApp App ID from Meta Developer Console' },
        { key: 'WHATSAPP_APP_SECRET', value: formData.appSecret, description: 'WhatsApp App Secret for authentication' },
        { key: 'WHATSAPP_ACCESS_TOKEN', value: formData.accessToken, description: 'Permanent access token for WhatsApp Business API' },
        { key: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN', value: formData.webhookVerifyToken, description: 'Token used to verify webhook requests' },
        { key: 'WHATSAPP_PHONE_NUMBER_ID', value: formData.phoneNumberId, description: 'Business phone number ID' },
        { key: 'WHATSAPP_BUSINESS_ACCOUNT_ID', value: formData.businessAccountId, description: 'WhatsApp Business Account ID' },
        { key: 'WHATSAPP_WEBHOOK_URL', value: formData.webhookUrl, description: 'Webhook URL for receiving messages' },
      ];

      const response = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer demo-admin-token',
          'Origin': typeof window !== 'undefined' ? window.location.origin : '',
        },
        body: JSON.stringify({ configs: configData }),
      });

      if (response.ok) {
        addToast('Success', 'WhatsApp configuration saved successfully', 'success');
        await loadConfigurations();
        setIsFormOpen(false);
      } else {
        throw new Error('Failed to save configuration');
      }
    } catch (error) {
      console.error('Failed to save configuration:', error);
      addToast('Error', 'Failed to save WhatsApp configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConfiguration = async () => {
    setTestStatus('testing');
    
    try {
      const response = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer demo-admin-token',
          'Origin': typeof window !== 'undefined' ? window.location.origin : '',
        },
      });

      if (response.ok) {
        setTestStatus('success');
        addToast('Success', 'WhatsApp API connection test successful', 'success');
      } else {
        setTestStatus('error');
        const error = await response.json();
        addToast('Error', `Connection test failed: ${error.message}`, 'error');
      }
    } catch (error) {
      setTestStatus('error');
      addToast('Error', 'Failed to test WhatsApp API connection', 'error');
    }

    // Reset test status after 3 seconds
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  const handleDeleteConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) return;

    try {
      const response = await fetch(`/api/whatsapp/config/${configId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer demo-admin-token',
          'Origin': typeof window !== 'undefined' ? window.location.origin : '',
        },
      });

      if (response.ok) {
        addToast('Success', 'Configuration deleted successfully', 'success');
        await loadConfigurations();
      } else {
        throw new Error('Failed to delete configuration');
      }
    } catch (error) {
      addToast('Error', 'Failed to delete configuration', 'error');
    }
  };

  const toggleShowValue = (configId: string) => {
    setShowValues(prev => ({
      ...prev,
      [configId]: !prev[configId]
    }));
  };

  const maskValue = (value: string) => {
    if (value.length <= 8) return '*'.repeat(value.length);
    return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
  };

  const hasAllRequiredConfigs = () => {
    return configs.some(c => c.key === 'WHATSAPP_ACCESS_TOKEN' && c.value) &&
           configs.some(c => c.key === 'WHATSAPP_PHONE_NUMBER_ID' && c.value);
  };

  if (loading && dataLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageCircle className="h-6 w-6" />
            WhatsApp Business API
          </h2>
          <p className="text-muted-foreground">Configure WhatsApp Business API integration for messaging automation.</p>
        </div>
        <div className="flex gap-2">
          {hasAllRequiredConfigs() && (
            <button
              onClick={handleTestConfiguration}
              disabled={testStatus === 'testing'}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                testStatus === 'success' 
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : testStatus === 'error'
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200'
              }`}
            >
              {testStatus === 'testing' ? (
                <Spinner size="sm" />
              ) : (
                <Settings className="h-4 w-4" />
              )}
              {testStatus === 'testing' ? 'Testing...' : 
               testStatus === 'success' ? 'Test Passed' :
               testStatus === 'error' ? 'Test Failed' : 'Test Connection'}
            </button>
          )}
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            <Settings className="h-4 w-4" />
            {configs.length > 0 ? 'Update Config' : 'Setup WhatsApp'}
          </button>
        </div>
      </div>

      {/* Configuration Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-4 rounded-lg border ${hasAllRequiredConfigs() ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className="flex items-center gap-2">
            <MessageCircle className={`h-5 w-5 ${hasAllRequiredConfigs() ? 'text-green-600' : 'text-yellow-600'}`} />
            <span className="font-medium">API Status</span>
          </div>
          <p className={`text-sm ${hasAllRequiredConfigs() ? 'text-green-700' : 'text-yellow-700'}`}>
            {hasAllRequiredConfigs() ? 'Configured' : 'Not Configured'}
          </p>
        </div>
        
        <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
          <div className="flex items-center gap-2">
            <Link className="h-5 w-5 text-blue-600" />
            <span className="font-medium">Webhook</span>
          </div>
          <p className="text-sm text-blue-700">
            {configs.find(c => c.key === 'WHATSAPP_WEBHOOK_URL')?.value ? 'Configured' : 'Not Set'}
          </p>
        </div>
        
        <div className="p-4 rounded-lg border bg-purple-50 border-purple-200">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-purple-600" />
            <span className="font-medium">Phone Number</span>
          </div>
          <p className="text-sm text-purple-700">
            {configs.find(c => c.key === 'WHATSAPP_PHONE_NUMBER_ID')?.value ? 'Linked' : 'Not Linked'}
          </p>
        </div>
      </div>

      {/* Configuration Form */}
      {isFormOpen && (
        <div className="bg-secondary/30 border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">WhatsApp Business API Configuration</h3>
          <form onSubmit={handleSaveConfiguration} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">App ID</label>
                <input
                  type="text"
                  value={formData.appId}
                  onChange={(e) => setFormData(prev => ({ ...prev, appId: e.target.value }))}
                  placeholder="Your WhatsApp App ID"
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">App Secret</label>
                <input
                  type="password"
                  value={formData.appSecret}
                  onChange={(e) => setFormData(prev => ({ ...prev, appSecret: e.target.value }))}
                  placeholder="Your WhatsApp App Secret"
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Access Token</label>
                <input
                  type="password"
                  value={formData.accessToken}
                  onChange={(e) => setFormData(prev => ({ ...prev, accessToken: e.target.value }))}
                  placeholder="Permanent access token"
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Webhook Verify Token</label>
                <input
                  type="text"
                  value={formData.webhookVerifyToken}
                  onChange={(e) => setFormData(prev => ({ ...prev, webhookVerifyToken: e.target.value }))}
                  placeholder="Token for webhook verification"
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Phone Number ID</label>
                <input
                  type="text"
                  value={formData.phoneNumberId}
                  onChange={(e) => setFormData(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                  placeholder="Business phone number ID"
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Business Account ID</label>
                <input
                  type="text"
                  value={formData.businessAccountId}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessAccountId: e.target.value }))}
                  placeholder="WhatsApp Business Account ID"
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Webhook URL</label>
              <input
                type="url"
                value={formData.webhookUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, webhookUrl: e.target.value }))}
                placeholder="https://your-app.vercel.app/api/whatsapp/webhook"
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading && <Spinner size="sm" />}
                Save Configuration
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Current Configurations Table */}
      {configs.length > 0 && (
        <div className="bg-secondary/30 border border-border rounded-lg">
          <div className="p-4 border-b border-border">
            <h3 className="text-lg font-semibold">Current Configuration</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="p-4 text-left font-medium">Setting</th>
                  <th className="p-4 text-left font-medium">Value</th>
                  <th className="p-4 text-left font-medium">Description</th>
                  <th className="p-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {configs.map(config => (
                  <tr key={config.id} className="border-t border-border">
                    <td className="p-4 font-medium flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      {config.key.replace('WHATSAPP_', '').replace(/_/g, ' ')}
                    </td>
                    <td className="p-4 font-mono text-xs">
                      {showValues[config.id] ? config.value : maskValue(config.value)}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {config.description}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => toggleShowValue(config.id)}
                          className="p-2 text-muted-foreground hover:text-primary rounded-md hover:bg-secondary"
                          aria-label={showValues[config.id] ? 'Hide value' : 'Show value'}
                        >
                          {showValues[config.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button
                          onClick={() => handleDeleteConfig(config.id)}
                          className="p-2 text-muted-foreground hover:text-destructive rounded-md hover:bg-secondary"
                          aria-label="Delete configuration"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Setup Instructions */}
      {configs.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Setup Instructions</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>To setup WhatsApp Business API integration:</p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>Create a WhatsApp Business account at <a href="https://developers.facebook.com" className="underline" target="_blank" rel="noopener noreferrer">Meta for Developers</a></li>
              <li>Create a new app and add WhatsApp Business API product</li>
              <li>Get your App ID, App Secret, and Access Token</li>
              <li>Configure your webhook URL in Meta Developer Console</li>
              <li>Add a phone number to your WhatsApp Business account</li>
              <li>Fill in the configuration form above with your credentials</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppConfigManagement;