export interface User {
  id: string;
  phone_number: string;
  name: string;
  role: 'Teacher' | 'Admin' | 'Maintenance' | 'Support Staff';
}

export type NewUserData = Omit<User, 'id'>;

export interface Category {
  id: string;
  name: string;
  isSystem?: boolean; // To prevent deletion of default categories
}

export type ActivityStatus = 'Unassigned' | 'Open' | 'In Progress' | 'Resolved';

export interface ActivityUpdate {
  id: string;
  timestamp: string;
  notes: string;
  photo_url?: string;
  author_id: string;
  
  // Enhanced fields for status context tracking
  status_context?: string; // Optional status change that occurred with this update
  update_type?: 'progress' | 'status_change' | 'assignment' | 'completion'; // Type of update
}

export interface Activity {
  id: string;
  user_id: string;
  category_id: string;
  subcategory: string;
  location: string;
  timestamp: string; // ISO 8601 string
  notes?: string;
  photo_url?: string;
  latitude?: number;
  longitude?: number;
  // Task management fields
  status: ActivityStatus;
  assigned_to_user_id?: string;
  assignment_instructions?: string;
  resolution_notes?: string;
  updates?: ActivityUpdate[];
}

// Represents the data captured from the "Add Incident" form.
export type NewActivityData = Pick<Activity, 'user_id' | 'category_id' | 'subcategory' | 'location' | 'notes'> & { photo_url?: string; status?: ActivityStatus; assigned_to_user_id?: string; };

// Geofencing Types
export type GeofenceShape = 'circle' | 'polygon';

export interface Geofence {
    id: string;
    name: string;
    shape: GeofenceShape;
    // For circles
    latitude?: number;
    longitude?: number;
    radius?: number;
    // For polygons
    latlngs?: { lat: number, lng: number }[][];
}

export type NewGeofenceData = Omit<Geofence, 'id'>;

// LLM Provider Types
export type LLMProvider = 'claude' | 'deepseek' | 'kimi' | 'gemini' | 'openai' | 'azure-openai';

export interface LLMConfiguration {
  id: string;
  provider: LLMProvider;
  name: string; // Display name
  model?: string; // Specific model name
  apiKeyId?: string; // Reference to encrypted API key
  baseUrl?: string; // For custom endpoints
  isActive: boolean;
  isDefault: boolean;
  configuration: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    // Provider-specific settings
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}

export type NewLLMConfiguration = Omit<LLMConfiguration, 'id' | 'createdAt' | 'updatedAt' | 'apiKeyId'> & {
  apiKey: string; // Plain text key for creation
};

export interface LLMProviderInfo {
  provider: LLMProvider;
  name: string;
  description: string;
  defaultModel?: string;
  supportedModels: string[];
  requiresApiKey: boolean;
  requiresBaseUrl: boolean;
  configurationFields: {
    key: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'boolean';
    required?: boolean;
    options?: string[]; // For select type
    min?: number; // For number type
    max?: number; // For number type
    step?: number; // For number type
    placeholder?: string;
    description?: string;
  }[];
}
