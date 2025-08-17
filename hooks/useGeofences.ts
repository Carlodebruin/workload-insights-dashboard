
import { useState, useEffect } from 'react';
import { Geofence, NewGeofenceData } from '../types';
import { v4 as uuidv4 } from 'uuid';

const GEOFENCES_STORAGE_KEY = 'workload_insights_geofences';

const MOCK_GEOFENCES: Geofence[] = [
  {
    id: '1',
    name: 'Main Playground',
    shape: 'circle',
    latitude: -25.7475,
    longitude: 28.228,
    radius: 50,
  },
  {
    id: '2',
    name: 'Admin Block Area',
    shape: 'polygon',
    latlngs: [[
        { lat: -25.7463, lng: 28.2292 },
        { lat: -25.7458, lng: 28.2293 },
        { lat: -25.7459, lng: 28.2300 },
        { lat: -25.7464, lng: 28.2299 },
    ]]
  }
];

export const useGeofences = () => {
  const [loading, setLoading] = useState(true);
  const [geofences, setGeofences] = useState<Geofence[]>([]);

  useEffect(() => {
    try {
      let storedGeofences: Geofence[] | null = JSON.parse(localStorage.getItem(GEOFENCES_STORAGE_KEY) || 'null');

      if (!storedGeofences || storedGeofences.length === 0) {
        storedGeofences = MOCK_GEOFENCES;
        localStorage.setItem(GEOFENCES_STORAGE_KEY, JSON.stringify(storedGeofences));
      }

      setGeofences(storedGeofences);
    } catch (error) {
      console.error("Failed to load geofences from localStorage, falling back to mocks.", error);
      setGeofences(MOCK_GEOFENCES);
      localStorage.setItem(GEOFENCES_STORAGE_KEY, JSON.stringify(MOCK_GEOFENCES));
    } finally {
      setLoading(false);
    }
  }, []);
  
  const persistGeofences = (updatedGeofences: Geofence[]) => {
      localStorage.setItem(GEOFENCES_STORAGE_KEY, JSON.stringify(updatedGeofences));
  };

  const addGeofence = (geofenceData: NewGeofenceData): Promise<Geofence> => {
    return new Promise(resolve => {
        const newGeofence: Geofence = {
            id: uuidv4(),
            ...geofenceData
        };
        const updatedGeofences = [...geofences, newGeofence];
        setGeofences(updatedGeofences);
        persistGeofences(updatedGeofences);
        resolve(newGeofence);
    });
  };

  const updateGeofence = (geofenceId: string, updatedData: Partial<NewGeofenceData>): Promise<Geofence> => {
      return new Promise((resolve, reject) => {
          let updatedGeofence: Geofence | undefined;
          const updatedGeofences = geofences.map(fence => {
              if (fence.id === geofenceId) {
                  updatedGeofence = { ...fence, ...updatedData };
                  return updatedGeofence;
              }
              return fence;
          });

          if (updatedGeofence) {
              setGeofences(updatedGeofences);
              persistGeofences(updatedGeofences);
              resolve(updatedGeofence);
          } else {
              reject(new Error("Geofence not found"));
          }
      });
  };
  
  const deleteGeofence = (geofenceId: string): Promise<void> => {
      return new Promise(resolve => {
          const updatedGeofences = geofences.filter(g => g.id !== geofenceId);
          setGeofences(updatedGeofences);
          persistGeofences(updatedGeofences);
          resolve();
      });
  };

  return { loading, geofences, addGeofence, updateGeofence, deleteGeofence };
};
