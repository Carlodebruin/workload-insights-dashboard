"use client";

import React from 'react';
import { ChevronDown } from 'lucide-react';

export type AIProviderType = 'gemini' | 'claude' | 'deepseek' | 'kimi';

interface AIProviderSelectorProps {
  selectedProvider: AIProviderType;
  onProviderChange: (provider: AIProviderType) => void;
  availableProviders?: AIProviderType[];
}

const PROVIDER_DISPLAY_NAMES: Record<AIProviderType, string> = {
  gemini: 'Google Gemini',
  claude: 'Anthropic Claude',
  deepseek: 'DeepSeek',
  kimi: 'Moonshot Kimi',
};

const PROVIDER_ICONS: Record<AIProviderType, string> = {
  gemini: '🔷',
  claude: '🧠',
  deepseek: '🌊',
  kimi: '🌙',
};

export default function AIProviderSelector({ 
  selectedProvider, 
  onProviderChange, 
  availableProviders = ['gemini', 'claude', 'deepseek', 'kimi'] 
}: AIProviderSelectorProps) {
  return (
    <div className="relative">
      <label className="block text-sm font-medium text-foreground mb-2">
        AI Provider
      </label>
      <div className="relative">
        <select
          value={selectedProvider}
          onChange={(e) => onProviderChange(e.target.value as AIProviderType)}
          className="w-full px-3 py-2 pr-8 bg-background border border-border rounded-md text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {availableProviders.map((provider) => (
            <option key={provider} value={provider}>
              {PROVIDER_ICONS[provider]} {PROVIDER_DISPLAY_NAMES[provider]}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground pointer-events-none" />
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Choose your preferred AI provider for analysis and chat
      </p>
    </div>
  );
}