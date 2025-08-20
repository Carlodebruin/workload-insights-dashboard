'use client';

import AppShell from '../components/AppShell';
import { Suspense } from 'react';

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading Dashboard...</p>
        </div>
      </div>
    }>
      <AppShell />
    </Suspense>
  );
}
