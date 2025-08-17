
import { useState, useEffect, useMemo } from 'react';

interface UseVirtualizerOptions<T> {
  items: T[];
  itemHeight: number;
  containerRef: React.RefObject<HTMLElement>;
  overscan?: number; // Number of items to render above and below the visible area
}

export function useVirtualizer<T>({
  items,
  itemHeight,
  containerRef,
  overscan = 5,
}: UseVirtualizerOptions<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerRef]);

  const { virtualItems, totalHeight, startIndex } = useMemo(() => {
    if (!containerRef.current) {
        return { virtualItems: [], totalHeight: 0, startIndex: 0 };
    }
    
    const containerHeight = containerRef.current.clientHeight;
    const totalHeight = items.length * itemHeight;

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
    );
    
    const virtualItems = items.slice(startIndex, endIndex + 1).map((item, index) => ({
      item,
      index: startIndex + index,
    }));

    return { virtualItems, totalHeight, startIndex };
  }, [items, itemHeight, containerRef, scrollTop, overscan]);

  return {
    virtualItems,
    totalHeight,
    startOffset: startIndex * itemHeight,
  };
}
