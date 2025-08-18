import { useState, useEffect } from 'react';
import { LLMConfiguration, NewLLMConfiguration } from '../types';

interface UseLLMConfigurationsReturn {
  llmConfigurations: LLMConfiguration[];
  loading: boolean;
  error: string | null;
  addConfiguration: (config: NewLLMConfiguration) => Promise<LLMConfiguration>;
  updateConfiguration: (id: string, config: Partial<LLMConfiguration>) => Promise<LLMConfiguration>;
  deleteConfiguration: (id: string) => Promise<void>;
  testConfiguration: (id: string) => Promise<{ success: boolean; message: string }>;
  refresh: () => Promise<void>;
}

// Authentication headers for API calls
const getAuthHeaders = () => ({
  'Authorization': 'Bearer demo-admin-token',
  'Content-Type': 'application/json'
});

export function useLLMConfigurations(): UseLLMConfigurationsReturn {
  const [llmConfigurations, setLLMConfigurations] = useState<LLMConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigurations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/llm-configurations/', {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch configurations: ${response.status}`);
      }

      const data = await response.json();
      setLLMConfigurations(data);
    } catch (err) {
      console.error('Failed to fetch LLM configurations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch configurations');
    } finally {
      setLoading(false);
    }
  };

  const addConfiguration = async (config: NewLLMConfiguration): Promise<LLMConfiguration> => {
    const response = await fetch('/api/llm-configurations/', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create configuration');
    }

    const newConfig = await response.json();
    
    // Update local state
    setLLMConfigurations(prev => [newConfig, ...prev]);
    
    return newConfig;
  };

  const updateConfiguration = async (id: string, config: Partial<LLMConfiguration>): Promise<LLMConfiguration> => {
    const response = await fetch(`/api/llm-configurations/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update configuration');
    }

    const updatedConfig = await response.json();
    
    // Update local state
    setLLMConfigurations(prev => 
      prev.map(c => c.id === id ? updatedConfig : c)
    );
    
    return updatedConfig;
  };

  const deleteConfiguration = async (id: string): Promise<void> => {
    const response = await fetch(`/api/llm-configurations/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete configuration');
    }

    // Update local state
    setLLMConfigurations(prev => prev.filter(c => c.id !== id));
  };

  const testConfiguration = async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`/api/llm-configurations/${id}/test`, {
      method: 'POST',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to test configuration');
    }

    return response.json();
  };

  const refresh = async () => {
    await fetchConfigurations();
  };

  // Initial load
  useEffect(() => {
    fetchConfigurations();
  }, []);

  return {
    llmConfigurations,
    loading,
    error,
    addConfiguration,
    updateConfiguration,
    deleteConfiguration,
    testConfiguration,
    refresh
  };
}