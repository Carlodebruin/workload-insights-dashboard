"use client";

import dynamic from 'next/dynamic';

const DynamicMapView = dynamic(() => import('../../pages/MapView'), {
  ssr: false,
});

export default DynamicMapView;
