"use client";

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const LoadingSkeleton = () => (
  <div className="space-y-6 p-6">
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
      </div>
      <div className="mt-6 h-32 bg-gray-200 rounded"></div>
    </div>
  </div>
);

const DynamicAIInsights = dynamic(() => import('../../page-components/AIInsightsPage'), {
  ssr: false,
  loading: () => <LoadingSkeleton />
});

export default function AIInsightsWrapper(props: any) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DynamicAIInsights {...props} />
    </Suspense>
  );
}