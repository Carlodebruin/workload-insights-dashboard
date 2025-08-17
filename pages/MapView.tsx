"use client";

import React, { useRef, useEffect, useState } from 'react';
import { useGeolocation } from '../hooks/useGeolocation';
import { SCHOOL_LOCATIONS } from '../lib/locations';
import { Activity, User, Category } from '../types';
import Spinner from '../components/Spinner';
import dynamic from 'next/dynamic';

interface MapViewProps {
    users: User[];
    activities: Activity[];
    allCategories: Category[];
    loading: boolean;
    onEditActivity: (activity: Activity) => void;
    onDeleteActivity: (activityId: string) => void;
}

const MapView: React.FC<MapViewProps> = ({ users, activities, allCategories, loading, onEditActivity, onDeleteActivity }) => {
    const { position: userPosition, error: geoError } = useGeolocation();
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const userMarkerRef = useRef<any>(null);
    const activityLayerRef = useRef<any>(null);
    const [isInitialViewSetted, setIsInitialViewSetted] = useState(false);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    
    // Dynamic import Leaflet on client-side only
    useEffect(() => {
        let isMounted = true;

        const initializeMap = async () => {
            if (typeof window === 'undefined' || !mapContainerRef.current) return;

            try {
                // Dynamic import of Leaflet
                const L = await import('leaflet');
                
                // Fix default icon issue
                delete (L.Icon.Default.prototype as any)._getIconUrl;
                L.Icon.Default.mergeOptions({
                    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                });

                if (!isMounted) return;

                // Initialize map
                if (!mapRef.current && mapContainerRef.current) {
                    mapRef.current = L.map(mapContainerRef.current).setView(
                        [SCHOOL_LOCATIONS[0].latitude, SCHOOL_LOCATIONS[0].longitude], 
                        17
                    );

                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap contributors'
                    }).addTo(mapRef.current);

                    activityLayerRef.current = L.layerGroup().addTo(mapRef.current);
                    setIsMapLoaded(true);
                }
            } catch (error) {
                console.error('Failed to load map:', error);
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
    }, []);

    // Effect for managing user position marker
    useEffect(() => {
        if (!isMapLoaded || !userPosition) return;

        const updateUserMarker = async () => {
            const L = await import('leaflet');
            
            if (userMarkerRef.current) {
                mapRef.current?.removeLayer(userMarkerRef.current);
            }

            const userIcon = L.divIcon({
                className: 'user-location-marker',
                html: '<div style="background: #3b82f6; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });

            userMarkerRef.current = L.marker([userPosition.latitude, userPosition.longitude], { icon: userIcon })
                .addTo(mapRef.current)
                .bindPopup('Your Location');

            if (!isInitialViewSetted) {
                mapRef.current?.setView([userPosition.latitude, userPosition.longitude], 18);
                setIsInitialViewSetted(true);
            }
        };

        updateUserMarker();
    }, [userPosition, isMapLoaded, isInitialViewSetted]);

    // Effect for updating activity markers
    useEffect(() => {
        if (!isMapLoaded || !activityLayerRef.current) return;

        const updateActivityMarkers = async () => {
            const L = await import('leaflet');
            
            activityLayerRef.current.clearLayers();

            const categoryColors: Record<string, string> = {
                learner_wellness: '#ef4444',
                parents: '#f59e0b',
                department: '#8b5cf6',
                fees: '#10b981',
                maintenance: '#f97316',
                meetings: '#06b6d4',
                unplanned: '#dc2626'
            };

            activities
                .filter(activity => activity.latitude && activity.longitude)
                .forEach(activity => {
                    const user = users.find(u => u.id === activity.user_id);
                    const category = allCategories.find(c => c.id === activity.category_id);
                    const color = categoryColors[activity.category_id] || '#6b7280';

                    const markerIcon = L.divIcon({
                        className: 'activity-marker',
                        html: `<div style="background: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">${activity.id}</div>`,
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                    });

                    const marker = L.marker([activity.latitude!, activity.longitude!], { icon: markerIcon })
                        .addTo(activityLayerRef.current);

                    const popupContent = `
                        <div style="min-width: 200px;">
                            <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold;">${category?.name || 'Unknown'}</h3>
                            <p style="margin: 0 0 4px 0; font-size: 12px;"><strong>Details:</strong> ${activity.subcategory}</p>
                            <p style="margin: 0 0 4px 0; font-size: 12px;"><strong>Location:</strong> ${activity.location}</p>
                            <p style="margin: 0 0 4px 0; font-size: 12px;"><strong>Staff:</strong> ${user?.name || 'Unknown'}</p>
                            <p style="margin: 0 0 8px 0; font-size: 12px;"><strong>Time:</strong> ${new Date(activity.timestamp).toLocaleString()}</p>
                            ${activity.notes ? `<p style="margin: 0 0 8px 0; font-size: 12px;"><strong>Notes:</strong> ${activity.notes}</p>` : ''}
                            <div style="display: flex; gap: 8px;">
                                <button onclick="window.editActivity?.('${activity.id}')" style="background: #3b82f6; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">Edit</button>
                                <button onclick="window.deleteActivity?.('${activity.id}')" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">Delete</button>
                            </div>
                        </div>
                    `;

                    marker.bindPopup(popupContent);
                });
        };

        updateActivityMarkers();
    }, [activities, users, allCategories, isMapLoaded]);

    // Set up global functions for popup buttons
    useEffect(() => {
        (window as any).editActivity = (activityId: string) => {
            const activity = activities.find(a => a.id === activityId);
            if (activity) onEditActivity(activity);
        };

        (window as any).deleteActivity = (activityId: string) => {
            onDeleteActivity(activityId);
        };

        return () => {
            delete (window as any).editActivity;
            delete (window as any).deleteActivity;
        };
    }, [activities, onEditActivity, onDeleteActivity]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Activity Map</h2>
                <p className="text-muted-foreground">
                    Geographic view of all logged activities. {geoError && `Location access: ${geoError}`}
                </p>
            </div>
            
            <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div 
                    ref={mapContainerRef} 
                    className="w-full h-[70vh]"
                    style={{ minHeight: '500px' }}
                />
                
                {!isMapLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                        <Spinner size="lg" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading map...</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                    <span>Learner Wellness</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-amber-500 rounded-full"></div>
                    <span>Parents</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
                    <span>Department</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                    <span>Fees</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                    <span>Maintenance</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-cyan-500 rounded-full"></div>
                    <span>Meetings</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-600 rounded-full"></div>
                    <span>Unplanned</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                    <span>Your Location</span>
                </div>
            </div>
        </div>
    );
};

export default MapView;