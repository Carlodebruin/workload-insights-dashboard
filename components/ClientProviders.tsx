'use client';

import { ThemeProvider } from "../contexts/ThemeContext";
import { ToastProvider } from "../contexts/ToastContext";
import { GeofenceProvider } from "../contexts/GeofenceContext";

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="workload-insights-theme">
      <ToastProvider>
        <GeofenceProvider>
          {children}
        </GeofenceProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}