/**
 * Feature flag system for controlled rollout of new functionality
 * All flags are controlled by environment variables for zero-downtime deployment
 */

// Simple hash function for user-based feature enablement
const simpleHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

interface FeatureFlagsType {
  mobileTouchOptimization: boolean;
  realtimeUpdates: boolean;
  optimisticAssignment: boolean;
  realtimeDashboard: boolean;
  getRolloutPercentage(feature: string): number;
  isEnabledForUser(feature: string, userId: string): boolean;
  isEnabled(feature: keyof FeatureFlagsType): boolean;
  getEnabledFeatures(): string[];
}

export const featureFlags: FeatureFlagsType = {
  /**
   * Mobile touch optimization feature flag
   * Enable enhanced touch targets and mobile-responsive design
   */
  mobileTouchOptimization: process.env.NEXT_PUBLIC_ENABLE_MOBILE_TOUCH === 'true',

  /**
   * Real-time updates feature flag
   * Enable Server-Sent Events for real-time activity updates
   */
  realtimeUpdates: process.env.NEXT_PUBLIC_ENABLE_REALTIME === 'true',

  /**
   * Optimistic UX feature flag
   * Enable optimistic updates and enhanced assignment UX
   */
  optimisticAssignment: process.env.NEXT_PUBLIC_ENABLE_OPTIMISTIC_UX === 'true',

  /**
   * Real-time dashboard integration feature flag
   * Enable real-time updates in the dashboard component
   */
  realtimeDashboard: process.env.NEXT_PUBLIC_ENABLE_REALTIME_DASHBOARD === 'true',

  /**
   * Get rollout percentage for gradual feature deployment
   */
  getRolloutPercentage(feature: string): number {
    const envVar = `NEXT_PUBLIC_${feature.toUpperCase()}_ROLLOUT_PERCENT`;
    return parseInt(process.env[envVar] || '0');
  },

  /**
   * Check if feature is enabled for specific user (for gradual rollout)
   */
  isEnabledForUser(feature: string, userId: string): boolean {
    if (!userId) return false;
    
    const rolloutPercent = this.getRolloutPercentage(feature);
    if (rolloutPercent >= 100) return true;
    if (rolloutPercent <= 0) return false;

    const hash = simpleHash(userId);
    return hash % 100 < rolloutPercent;
  },

  /**
   * Check if feature is enabled (general usage)
   */
  isEnabled(feature: keyof FeatureFlagsType): boolean {
    if (feature in this && typeof this[feature as keyof FeatureFlagsType] === 'boolean') {
      return this[feature as keyof FeatureFlagsType] as boolean;
    }
    return false;
  },

  /**
   * Get all enabled features for debugging/monitoring
   */
  getEnabledFeatures(): string[] {
    const enabled: string[] = [];
    const flags = this as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(flags)) {
      if (typeof value === 'boolean' && value === true) {
        enabled.push(key);
      }
    }
    return enabled;
  }
};

// Type exports for better TypeScript support
export type FeatureFlag = keyof FeatureFlagsType;
export type FeatureFlags = FeatureFlagsType;