"use client";

import React, { useRef, useEffect, useState } from 'react';
import { Geofence, NewGeofenceData } from '../types';
import { SCHOOL_LOCATIONS } from '../lib/locations';

interface GeofenceMapProps {
  geofences: Geofence[];
  onGeofenceCreate?: (geofence: NewGeofenceData) => void;
  onGeofenceEdit?: (id: string, geofence: Partial<Geofence>) => void;
  onGeofenceDelete?: (id: string) => void;
  className?: string;
}

const GeofenceMap: React.FC<GeofenceMapProps> = ({
  geofences,
  onGeofenceCreate,
  onGeofenceEdit,
  onGeofenceDelete,
  className = ''
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const geofenceLayerRef = useRef<any>(null);
  const drawControlRef = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    let isMounted = true;

    const initializeMap = async () => {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;

      try {
        // Dynamic imports
        const L = await import('leaflet');
        await import('leaflet-draw');
        const { GeoSearchControl, OpenStreetMapProvider } = await import('leaflet-geosearch');

        if (!isMounted) return;

        // Fix default icon issue
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        // Initialize map
        if (!mapRef.current && mapContainerRef.current) {
          mapRef.current = L.map(mapContainerRef.current).setView(
            [SCHOOL_LOCATIONS[0].latitude, SCHOOL_LOCATIONS[0].longitude],
            16
          );

          // Add tile layer
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
          }).addTo(mapRef.current);

          // Add search control
          const provider = new OpenStreetMapProvider();
          const searchControl = new (GeoSearchControl as any)({
            provider: provider,
            style: 'bar',
            showMarker: true,
            showPopup: false,
            autoClose: true,
            retainZoomLevel: false,
            animateZoom: true,
            keepResult: false,
            searchLabel: 'Search for locations...',
          });
          mapRef.current.addControl(searchControl);

          // Initialize layers - use FeatureGroup for leaflet-draw compatibility
          geofenceLayerRef.current = L.featureGroup().addTo(mapRef.current);

          // Setup drawing controls if create callback is provided
          if (onGeofenceCreate) {
            const drawControl = new L.Control.Draw({
              edit: {
                featureGroup: geofenceLayerRef.current,
                remove: !!onGeofenceDelete
              },
              draw: {
                polygon: {
                  allowIntersection: false,
                  drawError: {
                    color: '#e1e100',
                    message: '<strong>Error:</strong> shape edges cannot cross!'
                  },
                  shapeOptions: {
                    color: '#3b82f6',
                    fillOpacity: 0.2
                  }
                },
                circle: {
                  shapeOptions: {
                    color: '#3b82f6',
                    fillOpacity: 0.2
                  }
                },
                rectangle: false,
                marker: false,
                polyline: false,
                circlemarker: false
              }
            });

            mapRef.current.addControl(drawControl);
            drawControlRef.current = drawControl;

            // Handle drawing events
            mapRef.current.on('draw:created', (e: any) => {
              const layer = e.layer;
              const type = e.layerType;

              let geofenceData: NewGeofenceData;

              if (type === 'circle') {
                const center = layer.getLatLng();
                const radius = layer.getRadius();
                geofenceData = {
                  name: `Geofence ${Date.now()}`,
                  shape: 'circle',
                  latitude: center.lat,
                  longitude: center.lng,
                  radius: radius
                };
              } else if (type === 'polygon') {
                const latlngs = layer.getLatLngs()[0].map((ll: any) => ({
                  lat: ll.lat,
                  lng: ll.lng
                }));
                geofenceData = {
                  name: `Geofence ${Date.now()}`,
                  shape: 'polygon',
                  latlngs: [latlngs]
                };
              } else {
                return;
              }

              if (onGeofenceCreate) {
                onGeofenceCreate(geofenceData);
              }

              geofenceLayerRef.current.addLayer(layer);
            });

            if (onGeofenceEdit) {
              mapRef.current.on('draw:edited', (e: any) => {
                e.layers.eachLayer((layer: any) => {
                  const geofenceId = layer.geofenceId;
                  if (geofenceId) {
                    // Handle edited geofence
                    console.log('Geofence edited:', geofenceId);
                  }
                });
              });
            }

            if (onGeofenceDelete) {
              mapRef.current.on('draw:deleted', (e: any) => {
                e.layers.eachLayer((layer: any) => {
                  const geofenceId = layer.geofenceId;
                  if (geofenceId) {
                    onGeofenceDelete(geofenceId);
                  }
                });
              });
            }
          }

          setIsMapLoaded(true);
        }
      } catch (error) {
        console.error('Failed to load geofence map:', error);
      }
    };

    initializeMap();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [onGeofenceCreate, onGeofenceEdit, onGeofenceDelete]);

  // Update geofences when they change
  useEffect(() => {
    if (!isMapLoaded || !geofenceLayerRef.current) return;

    const updateGeofences = async () => {
      const L = await import('leaflet');
      
      geofenceLayerRef.current.clearLayers();

      geofences.forEach((geofence) => {
        let layer: any;

        if (geofence.shape === 'circle' && geofence.latitude && geofence.longitude && geofence.radius) {
          layer = L.circle([geofence.latitude, geofence.longitude], {
            radius: geofence.radius,
            color: '#3b82f6',
            fillOpacity: 0.2
          });
        } else if (geofence.shape === 'polygon' && geofence.latlngs) {
          layer = L.polygon(geofence.latlngs, {
            color: '#3b82f6',
            fillOpacity: 0.2
          });
        }

        if (layer) {
          layer.geofenceId = geofence.id;
          layer.bindPopup(`
            <div>
              <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold;">${geofence.name}</h3>
              <p style="margin: 0; font-size: 12px;">Type: ${geofence.shape}</p>
            </div>
          `);
          geofenceLayerRef.current.addLayer(layer);
        }
      });
    };

    updateGeofences();
  }, [geofences, isMapLoaded]);

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={mapContainerRef} 
        className="w-full h-96 bg-gray-100 rounded-lg border"
      />
      {!isMapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg border">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeofenceMap;