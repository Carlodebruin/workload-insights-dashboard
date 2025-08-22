"use client";

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const LoadingSkeleton = () => (
  <div className="space-y-4 p-6">
    <div className="animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
      {[1, 2, 3].map(i => (
        <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-16"></div>
          </div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  </div>
);

const DynamicWhatsAppMessages = dynamic(() => import('../../page-components/WhatsAppMessagesPage'), {
  ssr: false,
  loading: () => <LoadingSkeleton />
});

export default function WhatsAppMessagesWrapper(props: any) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DynamicWhatsAppMessages {...props} />
    </Suspense>
  );
}