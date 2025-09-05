import { useState, useCallback, useRef } from 'react';

export interface SwipeGestureConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number; // Default 50px
  preventScroll?: boolean;
}

export interface SwipeGestureResult {
  touchHandlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
  isGesturing: boolean;
  swipeDirection: 'left' | 'right' | 'none';
  swipeDistance: number;
}

export const useSwipeGestures = (config: SwipeGestureConfig): SwipeGestureResult => {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isGesturing, setIsGesturing] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'none'>('none');
  const [swipeDistance, setSwipeDistance] = useState(0);

  const touchStartRef = useRef<number | null>(null);
  const touchEndRef = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only handle single touch gestures
    if (e.touches.length > 1) return;
    
    const startX = e.touches[0].clientX;
    setTouchStart(startX);
    setTouchEnd(null);
    setIsGesturing(true);
    setSwipeDirection('none');
    setSwipeDistance(0);
    
    touchStartRef.current = startX;
    touchEndRef.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    
    const currentX = e.touches[0].clientX;
    setTouchEnd(currentX);
    touchEndRef.current = currentX;
    
    const distance = touchStartRef.current - currentX;
    setSwipeDistance(Math.abs(distance));
    
    // Determine direction
    if (distance > 0) {
      setSwipeDirection('left');
    } else if (distance < 0) {
      setSwipeDirection('right');
    }
    
    // Prevent scroll if large horizontal movement and configured to do so
    if (config.preventScroll && Math.abs(distance) > 10) {
      e.preventDefault();
    }
  }, [config.preventScroll]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !touchEndRef.current) {
      setIsGesturing(false);
      return;
    }
    
    const distance = touchStartRef.current - touchEndRef.current;
    const threshold = config.threshold || 50;
    const absDistance = Math.abs(distance);
    
    if (absDistance > threshold) {
      if (distance > 0 && config.onSwipeLeft) {
        config.onSwipeLeft();
      } else if (distance < 0 && config.onSwipeRight) {
        config.onSwipeRight();
      }
    }
    
    // Reset state after a short delay for smooth animation
    setTimeout(() => {
      setIsGesturing(false);
      setSwipeDirection('none');
      setSwipeDistance(0);
    }, 150);
  }, [config.onSwipeLeft, config.onSwipeRight, config.threshold]);

  return {
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    isGesturing,
    swipeDirection,
    swipeDistance
  };
};