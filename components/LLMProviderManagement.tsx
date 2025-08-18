'use client';

import React, { useState, useEffect } from 'react';
import { LLMConfiguration, NewLLMConfiguration, LLMProvider, LLMProviderInfo } from '../types';
import { getAllProviders, getProviderInfo, validateProviderConfiguration, getDefaultConfiguration } from '../lib/llm-providers';
import { useToast } from '../hooks/useToast';
import { PlusCircle, Edit, Trash2, Key, Eye, EyeOff, Settings, Check, AlertCircle, Zap } from 'lucide-react';

interface LLMProviderManagementProps {
  llmConfigurations: LLMConfiguration[];
  onAddConfiguration: (config: NewLLMConfiguration) => Promise<LLMConfiguration>;
  onUpdateConfiguration: (id: string, config: Partial<LLMConfiguration>) => Promise<LLMConfiguration>;
  onDeleteConfiguration: (id: string) => Promise<void>;
  onTestConfiguration: (id: string) => Promise<{ success: boolean; message: string }>;
  dataLoading: boolean;
}

const LLMProviderManagement: React.FC<LLMProviderManagementProps> = ({
  llmConfigurations,
  onAddConfiguration,
  onUpdateConfiguration,
  onDeleteConfiguration,
  onTestConfiguration,
  dataLoading
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<LLMConfiguration | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>('claude');
  const [formData, setFormData] = useState<NewLLMConfiguration>({
    provider: 'claude',
    name: '',
    isActive: true,
    isDefault: false,
    configuration: {},
    apiKey: ''
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingConfigs, setTestingConfigs] = useState<Set<string>>(new Set());
  const [availableProviders] = useState<LLMProviderInfo[]>(getAllProviders());

  const { addToast } = useToast();

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isModalOpen && !editingConfig) {
      const defaultConfig = getDefaultConfiguration(selectedProvider);
      setFormData({
        provider: selectedProvider,
        name: `${getProviderInfo(selectedProvider).name} Configuration`,
        isActive: true,
        isDefault: llmConfigurations.length === 0, // First config becomes default
        configuration: defaultConfig,
        apiKey: ''
      });
    } else if (isModalOpen && editingConfig) {
      setFormData({
        provider: editingConfig.provider as LLMProvider,
        name: editingConfig.name,
        model: editingConfig.model,
        baseUrl: editingConfig.baseUrl,
        isActive: editingConfig.isActive,
        isDefault: editingConfig.isDefault,
        configuration: JSON.parse(editingConfig.configuration || '{}'),
        apiKey: '' // Never pre-populate API key for security
      });
      setSelectedProvider(editingConfig.provider as LLMProvider);
    }
  }, [isModalOpen, editingConfig, selectedProvider, llmConfigurations.length]);

  const handleProviderChange = (provider: LLMProvider) => {
    setSelectedProvider(provider);
    const defaultConfig = getDefaultConfiguration(provider);
    const providerInfo = getProviderInfo(provider);
    
    setFormData(prev => ({
      ...prev,
      provider,
      name: `${providerInfo.name} Configuration`,
      configuration: defaultConfig,
      model: defaultConfig.model,
      baseUrl: providerInfo.requiresBaseUrl ? (defaultConfig.baseUrl || '') : undefined
    }));
  };

  const handleConfigFieldChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      configuration: {
        ...prev.configuration,
        [key]: value
      }
    }));

    // Update top-level fields if they match
    if (key === 'model' || key === 'baseUrl') {
      setFormData(prev => ({
        ...prev,
        [key]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const providerInfo = getProviderInfo(selectedProvider);
    
    // Validate required API key
    if (providerInfo.requiresApiKey && !editingConfig && !formData.apiKey) {
      addToast('Error', 'API key is required for this provider', 'error');
      return;
    }

    // Validate configuration
    const validation = validateProviderConfiguration(selectedProvider, formData.configuration);
    if (!validation.isValid) {
      addToast('Validation Error', validation.errors.join(', '), 'error');
      return;
    }

    try {
      if (editingConfig) {
        // Update existing configuration
        const updateData: Partial<LLMConfiguration> = {
          name: formData.name,
          model: formData.model,
          baseUrl: formData.baseUrl,
          isActive: formData.isActive,
          isDefault: formData.isDefault,
          configuration: JSON.stringify(formData.configuration)
        };
        
        await onUpdateConfiguration(editingConfig.id, updateData);
        addToast('Success', 'LLM configuration updated successfully', 'success');
      } else {
        // Create new configuration
        await onAddConfiguration(formData);
        addToast('Success', 'LLM configuration created successfully', 'success');
      }
      
      setIsModalOpen(false);
      setEditingConfig(null);
    } catch (error) {
      addToast('Error', `Failed to ${editingConfig ? 'update' : 'create'} configuration: ${error}`, 'error');
    }
  };

  const handleEdit = (config: LLMConfiguration) => {
    setEditingConfig(config);
    setIsModalOpen(true);
  };

  const handleDelete = async (config: LLMConfiguration) => {
    if (!confirm(`Are you sure you want to delete "${config.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await onDeleteConfiguration(config.id);
      addToast('Success', 'LLM configuration deleted successfully', 'success');
    } catch (error) {
      addToast('Error', `Failed to delete configuration: ${error}`, 'error');
    }
  };

  const handleTest = async (config: LLMConfiguration) => {
    setTestingConfigs(prev => new Set(prev).add(config.id));
    
    try {
      const result = await onTestConfiguration(config.id);
      addToast(
        result.success ? 'Test Successful' : 'Test Failed',
        result.message,
        result.success ? 'success' : 'error'
      );
    } catch (error) {
      addToast('Test Error', `Failed to test configuration: ${error}`, 'error');
    } finally {
      setTestingConfigs(prev => {
        const newSet = new Set(prev);
        newSet.delete(config.id);
        return newSet;
      });
    }
  };

  const renderConfigurationField = (field: LLMProviderInfo['configurationFields'][0]) => {
    const value = formData.configuration[field.key] || '';

    switch (field.type) {
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleConfigFieldChange(field.key, e.target.value)}
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            required={field.required}
          >
            <option value="">Select {field.label}</option>
            {field.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleConfigFieldChange(field.key, parseFloat(e.target.value) || 0)}
            min={field.min}
            max={field.max}
            step={field.step}
            placeholder={field.placeholder}
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            required={field.required}
          />
        );
      
      case 'boolean':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(e) => handleConfigFieldChange(field.key, e.target.checked)}
              className="w-4 h-4 text-primary focus:ring-2 focus:ring-primary border-border rounded"
            />
            <span className="text-sm">Enable {field.label}</span>
          </label>
        );
      
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleConfigFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            required={field.required}
          />
        );
    }
  };

  if (dataLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">LLM Provider Management</h2>
          <p className="text-muted-foreground">Configure AI providers for enhanced functionality</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          Add Provider
        </button>
      </div>

      {/* Configuration List */}
      <div className="bg-secondary/30 border border-border rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50">
              <tr>
                <th className="p-4 font-medium">Provider</th>
                <th className="p-4 font-medium hidden sm:table-cell">Model</th>
                <th className="p-4 font-medium hidden md:table-cell">Status</th>
                <th className="p-4 font-medium hidden lg:table-cell">Created</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {llmConfigurations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No LLM providers configured. Add one to get started.
                  </td>
                </tr>
              ) : (
                llmConfigurations.map(config => {
                  const providerInfo = getProviderInfo(config.provider as LLMProvider);
                  const isTesting = testingConfigs.has(config.id);
                  
                  return (
                    <tr key={config.id} className="border-t border-border">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-secondary flex-shrink-0 items-center justify-center flex">
                            <Settings size={18} className="text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-medium">{config.name}</div>
                            <div className="text-xs text-muted-foreground">{providerInfo?.name || config.provider}</div>
                            {config.isDefault && (
                              <div className="flex items-center gap-1 mt-1">
                                <Check size={12} className="text-green-600" />
                                <span className="text-xs text-green-600">Default</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground hidden sm:table-cell">
                        {config.model || 'Default'}
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${config.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <span className={config.isActive ? 'text-green-600' : 'text-red-600'}>
                            {config.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground hidden lg:table-cell">
                        {new Date(config.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1 sm:gap-2">
                          <button
                            onClick={() => handleTest(config)}
                            disabled={!config.isActive || isTesting}
                            className="p-2 text-muted-foreground hover:text-primary rounded-md hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Test Configuration"
                          >
                            {isTesting ? (
                              <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                            ) : (
                              <Zap size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => handleEdit(config)}
                            className="p-2 text-muted-foreground hover:text-primary rounded-md hover:bg-secondary"
                            title="Edit Configuration"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(config)}
                            className="p-2 text-muted-foreground hover:text-destructive rounded-md hover:bg-secondary"
                            title="Delete Configuration"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configuration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold">
                {editingConfig ? 'Edit LLM Configuration' : 'Add LLM Provider'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Provider Selection */}
              {!editingConfig && (
                <div>
                  <label className="block text-sm font-medium mb-2">Provider</label>
                  <select
                    value={selectedProvider}
                    onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
                    className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {availableProviders.map(provider => (
                      <option key={provider.provider} value={provider.provider}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getProviderInfo(selectedProvider).description}
                  </p>
                </div>
              )}

              {/* Configuration Name */}
              <div>
                <label className="block text-sm font-medium mb-2">Configuration Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  placeholder="e.g., Claude Production Config"
                />
              </div>

              {/* API Key */}
              {getProviderInfo(selectedProvider).requiresApiKey && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Key className="inline w-4 h-4 mr-1" />
                    API Key {!editingConfig && '*'}
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={formData.apiKey}
                      onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                      className="w-full bg-input border border-border rounded-md px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      required={!editingConfig}
                      placeholder={editingConfig ? 'Leave empty to keep current key' : 'Enter your API key'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-2 p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {editingConfig && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <AlertCircle className="inline w-3 h-3 mr-1" />
                      Leave empty to keep the existing API key
                    </p>
                  )}
                </div>
              )}

              {/* Dynamic Configuration Fields */}
              {getProviderInfo(selectedProvider).configurationFields.map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-medium mb-2">
                    {field.label} {field.required && '*'}
                  </label>
                  {renderConfigurationField(field)}
                  {field.description && (
                    <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
                  )}
                </div>
              ))}

              {/* Settings */}
              <div className="border-t border-border pt-4 space-y-3">
                <h4 className="font-medium">Settings</h4>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 text-primary focus:ring-2 focus:ring-primary border-border rounded"
                  />
                  <span className="text-sm">Active (available for use)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                    className="w-4 h-4 text-primary focus:ring-2 focus:ring-primary border-border rounded"
                  />
                  <span className="text-sm">Set as default provider</span>
                </label>
              </div>

              {/* Actions */}
              <div className="border-t border-border pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingConfig(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
                >
                  {editingConfig ? 'Update Configuration' : 'Add Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LLMProviderManagement;