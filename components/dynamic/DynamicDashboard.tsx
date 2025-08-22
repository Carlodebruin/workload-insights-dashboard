"use client";

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import DashboardSkeleton from '../DashboardSkeleton';

const DynamicDashboard = dynamic(() => import('../Dashboard'), {
  ssr: false,
  loading: () => <DashboardSkeleton />
});

export default function DashboardWrapper(props: any) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DynamicDashboard {...props} />
    </Suspense>
  );
}