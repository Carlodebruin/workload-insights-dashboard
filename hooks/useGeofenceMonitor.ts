
import { useState, useEffect, useRef } from 'react';
import { useGeofences } from './useGeofences';
import { useGeolocation } from './useGeolocation';
import { Geofence } from '../types';
import { isPointInGeofence } from '../lib/geofencing';

/**
 * A hook that monitors the user's location and determines which geofence they are currently in.
 * @returns An object containing the currently active geofence, if any.
 */
export const useGeofenceMonitor = () => {
  const { geofences, loading } = useGeofences();
  const { position } = useGeolocation({ enableHighAccuracy: true });
  const [activeGeofence, setActiveGeofence] = useState<Geofence | null>(null);
  
  // Use a ref to store the ID of the last active geofence to prevent unnecessary state updates
  const lastActiveGeofenceId = useRef<string | null>(null);

  useEffect(() => {
    // Wait for all data to be loaded and available
    if (loading || !position || !geofences) {
      return;
    }

    const currentPoint = { lat: position.latitude, lng: position.longitude };
    
    // Find the first geofence that contains the user's position.
    // The `find` method is efficient as it stops once a match is found.
    const foundGeofence = geofences.find(fence => isPointInGeofence(currentPoint, fence));
    const foundId = foundGeofence?.id || null;

    // Only update state if the active geofence has changed (user entered a new zone or exited all zones)
    if (foundId !== lastActiveGeofenceId.current) {
      setActiveGeofence(foundGeofence || null);
      lastActiveGeofenceId.current = foundId;
    }

  }, [position, geofences, loading]);

  return { activeGeofence };
};
