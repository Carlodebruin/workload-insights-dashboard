
import { useState, useEffect } from 'react';

interface GeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface GeolocationError {
  code: number;
  message: string;
}

export const useGeolocation = (options: PositionOptions = {}) => {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<GeolocationError | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError({ code: 0, message: 'Geolocation is not supported by your browser' });
      return;
    }

    let isMounted = true;
    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        if (isMounted) {
            setPosition({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            });
            setError(null);
        }
      },
      (err) => {
        if(isMounted) {
            setError({ code: err.code, message: err.message });
        }
      },
      options
    );

    return () => {
      isMounted = false;
      navigator.geolocation.clearWatch(watcher);
    };
  }, [options.enableHighAccuracy, options.timeout, options.maximumAge]); // Re-run effect if options change

  return { position, error };
};
