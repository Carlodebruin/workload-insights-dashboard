'use client';

import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "../contexts/ThemeContext";
import { ToastProvider } from "../contexts/ToastContext";
import { GeofenceProvider } from "../contexts/GeofenceContext";

export const metadata: Metadata = {
  title: "Workload Insights Dashboard",
  description: "A central reporting dashboard for school staff.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet-geosearch@4.0.0/dist/geosearch.css" />
      </head>
      <body className="bg-background text-foreground transition-colors duration-300">
        <ThemeProvider defaultTheme="dark" storageKey="workload-insights-theme">
          <ToastProvider>
            <GeofenceProvider>
              {children}
            </GeofenceProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
