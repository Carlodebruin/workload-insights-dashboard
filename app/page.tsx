'use client';

import React, { Suspense } from 'react';
import AppShell from '../components/AppShell';
import DashboardSkeleton from '../components/DashboardSkeleton';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
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