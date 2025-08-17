
import React, { useState, useEffect, useRef } from 'react';
import { useActiveGeofence } from '../contexts/GeofenceContext';
import { NewActivityData } from '../types';
import { MapPin, PlusCircle, X } from 'lucide-react';

interface GeofencePromptProps {
  onLogRequest: (prefilledData: Partial<NewActivityData>) => void;
}

const GeofencePrompt: React.FC<GeofencePromptProps> = ({ onLogRequest }) => {
  const { activeGeofence } = useActiveGeofence();
  const [visible, setVisible] = useState(false);
  const [promptedGeofenceId, setPromptedGeofenceId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Clear any existing timer when the component unmounts or activeGeofence changes
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [activeGeofence]);

  useEffect(() => {
    if (activeGeofence && activeGeofence.id !== promptedGeofenceId) {
      setPromptedGeofenceId(activeGeofence.id);
      setVisible(true);

      // Auto-dismiss after 15 seconds
      timerRef.current = window.setTimeout(() => {
        setVisible(false);
      }, 15000);
    } else if (!activeGeofence) {
      // If user leaves all geofences, hide the prompt and reset so it can be shown again for the same zone
      setVisible(false);
      setPromptedGeofenceId(null);
    }
  }, [activeGeofence, promptedGeofenceId]);

  const handleLog = () => {
    if (activeGeofence) {
      onLogRequest({ location: activeGeofence.name });
    }
    setVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleDismiss = () => {
    setVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  if (!visible || !activeGeofence) {
    return null;
  }

  return (
    <div
      role="alert"
      className="fixed bottom-4 inset-x-4 sm:bottom-6 sm:left-auto sm:right-6 z-50 w-auto max-w-lg p-4 rounded-lg bg-card border border-border shadow-2xl transition-all duration-300 ease-in-out animate-fade-in-up"
    >
      <style>
        {`
          @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(1rem); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-up {
            animation: fade-in-up 0.3s ease-out forwards;
          }
        `}
      </style>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 text-primary pt-0.5">
          <MapPin className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">You've entered the {activeGeofence.name}.</p>
          <p className="text-sm text-muted-foreground mt-1">Would you like to log an activity?</p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleLog}
              className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Log Now
            </button>
            <button
              onClick={handleDismiss}
              className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Dismiss
            </button>
          </div>
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={handleDismiss}
            className="inline-flex rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Dismiss"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeofencePrompt;
