import { useState, useEffect } from 'react';

/**
 * Hook to detect mobile devices and provide touch optimization context
 */
export const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      setIsMobile(isMobileDevice);
    };

    // Check if device supports touch
    const checkTouchDevice = () => {
      const isTouchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouchDevice(isTouchCapable);
    };

    checkMobile();
    checkTouchDevice();

    // Listen for orientation changes
    const handleOrientationChange = () => {
      checkMobile();
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  return {
    isMobile,
    isTouchDevice,
    isMobileOrTouch: isMobile || isTouchDevice
  };
};