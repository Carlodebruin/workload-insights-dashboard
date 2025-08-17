
"use client";

import React, { createContext, useContext } from 'react';
import { Geofence } from '../types';
import { useGeofenceMonitor } from '../hooks/useGeofenceMonitor';

interface GeofenceContextType {
  activeGeofence: Geofence | null;
}

const GeofenceContext = createContext<GeofenceContextType | undefined>(undefined);

interface GeofenceProviderProps {
    children: React.ReactNode;
}

/**
 * Provides the active geofence state to its children.
 * This provider activates the geofence monitoring for the application.
 */
export const GeofenceProvider: React.FC<GeofenceProviderProps> = ({ children }) => {
  const { activeGeofence } = useGeofenceMonitor();

  return (
    <GeofenceContext.Provider value={{ activeGeofence }}>
      {children}
    </GeofenceContext.Provider>
  );
};

/**
 * A custom hook to access the currently active geofence from the context.
 * Throws an error if used outside of a GeofenceProvider.
 *
 * @example
 * const { activeGeofence } = useActiveGeofence();
 * if (activeGeofence) {
 *   console.log(`User is in: ${activeGeofence.name}`);
 * }
 */
export const useActiveGeofence = () => {
  const context = useContext(GeofenceContext);
  if (context === undefined) {
    throw new Error('useActiveGeofence must be used within a GeofenceProvider');
  }
  return context;
};
