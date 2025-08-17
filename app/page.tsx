'use client';

import dynamic from 'next/dynamic';

// Import AppShell dynamically with no SSR
const AppShell = dynamic(() => import('../components/AppShell'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center min-h-screen">Loading...</div>
});

export default function HomePage() {
  return (
    <AppShell />
  );
}
