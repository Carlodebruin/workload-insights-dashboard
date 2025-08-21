'use client';

import React, { Suspense } from 'react';
import AppShell from '../components/AppShell';
import DashboardSkeleton from '../components/DashboardSkeleton';

/**
 * HomePage Component
 * 
 * This is the main entry point for the Workload Insights Dashboard.
 * It renders the AppShell component which contains the entire application
 * including navigation, data management, and all page views.
 * 
 * Architecture:
 * - Client Component: Required for AppShell's interactive state management
 * - Suspense Boundary: Provides loading state while AppShell initializes
 * - Error Boundary: Graceful error handling (handled by AppShell internally)
 * 
 * Data Flow:
 * HomePage -> AppShell -> [Dashboard|WhatsApp|AI|Admin|Map] Views
 */

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      {/* 
        Suspense boundary provides loading state while AppShell fetches initial data.
        The DashboardSkeleton shows a structured loading state that matches 
        the final dashboard layout, reducing perceived loading time.
      */}
      <Suspense 
        fallback={
          <div className="flex flex-col min-h-screen">
            <div className="border-b border-border px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 bg-primary/20 rounded animate-pulse" />
                  <div className="h-6 w-48 bg-primary/20 rounded animate-pulse" />
                </div>
                <div className="flex space-x-2">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-9 w-20 bg-secondary/20 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex-1">
              <DashboardSkeleton />
            </div>
          </div>
        }
      >
        {/* 
          AppShell is the main application component that handles:
          - Navigation between different views (Dashboard, WhatsApp, AI, Admin, Map)
          - Data fetching and state management for activities, users, categories
          - Modal management for creating/editing activities
          - Global error handling and toast notifications
          
          All interactive functionality is contained within AppShell to maintain
          clean separation between server-side layout and client-side application logic.
        */}
        <AppShell />
      </Suspense>
    </main>
  );
}

/**
 * Component Hierarchy:
 * 
 * app/layout.tsx (Server Component)
 * ├── ClientProviders (Client Component)
 *     └── app/page.tsx (Client Component) 
 *         └── AppShell (Client Component)
 *             ├── Header (Navigation)
 *             ├── Dashboard (Main view)
 *             ├── WhatsAppMessagesPage (WhatsApp integration)
 *             ├── AIInsightsPage (AI-powered insights)
 *             ├── AdminPage (User/category management)
 *             ├── MapView (Geographic visualization)
 *             └── Modals (Activity creation/editing)
 * 
 * This structure ensures:
 * - Server-side rendering for metadata and SEO
 * - Proper hydration without mismatches
 * - Client-side interactivity where needed
 * - Clean separation of concerns
 * - Optimal performance and user experience
 */