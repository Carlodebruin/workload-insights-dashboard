'use client';

import React from 'react';
import { ThemeProvider } from "../contexts/ThemeContext";
import { ToastProvider } from "../contexts/ToastContext";
import { GeofenceProvider } from "../contexts/GeofenceContext";

/**
 * ClientProviders Component
 * 
 * This component wraps all client-side React context providers to prevent
 * hydration mismatches in Next.js App Router. All context providers that
 * manage client-side state (theme, toasts, geofencing) are contained here.
 * 
 * Key Benefits:
 * - Prevents hydration mismatches between server and client
 * - Centralizes all client-side context management
 * - Enables server-side metadata and static generation
 * - Maintains theme persistence across page refreshes
 */

interface ClientProvidersProps {
  children: React.ReactNode;
}

export default function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <ThemeProvider 
      defaultTheme="dark" 
      storageKey="workload-insights-theme"
      enableSystem={true}
      attribute="class"
    >
      <ToastProvider
        maxToasts={5}
        duration={4000}
        position="top-right"
      >
        <GeofenceProvider
          enableHighAccuracy={true}
          timeout={10000}
          maximumAge={60000}
        >
          {children}
        </GeofenceProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

/**
 * Provider Configuration Details:
 * 
 * ThemeProvider:
 * - defaultTheme: "dark" - School staff prefer dark mode for reduced eye strain
 * - storageKey: Custom key for localStorage persistence
 * - enableSystem: Respects user's system preference
 * - attribute: "class" - Uses class-based dark mode switching
 * 
 * ToastProvider:
 * - maxToasts: 5 - Prevents UI clutter with too many notifications
 * - duration: 4000ms - Enough time to read important messages
 * - position: "top-right" - Standard UX pattern, doesn't block main content
 * 
 * GeofenceProvider:
 * - enableHighAccuracy: true - Important for precise incident location
 * - timeout: 10000ms - Reasonable wait time for GPS lock
 * - maximumAge: 60000ms - Cache location for 1 minute to avoid repeated requests
 */