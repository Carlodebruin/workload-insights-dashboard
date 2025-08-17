"use client";

import dynamic from 'next/dynamic';

const DynamicMapView = dynamic(() => import('../../page-components/MapView'), {
  ssr: false,
});

export default DynamicMapView;
