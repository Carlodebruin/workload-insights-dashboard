"use client";

import dynamic from 'next/dynamic';

const DynamicGeofenceMap = dynamic(() => import('../GeofenceMap'), {
  ssr: false,
});

export default DynamicGeofenceMap;
