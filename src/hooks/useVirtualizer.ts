import { useState, useEffect, useMemo, useCallback } from 'react';

interface UseVirtualizerOptions {
  totalItems: number;
  layoutMode: 'grid' | 'list';
  containerRef: React.RefObject<HTMLDivElement | null>;
  overscan?: number;
}

export function useVirtualizer({
  totalItems,
  layoutMode,
  containerRef,
  overscan = 3,
}: UseVirtualizerOptions) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(800);
  const [columns, setColumns] = useState(4);

  // Exact row heights with card and gap metrics
  const rowHeight = useMemo(() => {
    return layoutMode === 'grid' ? 220 : 76;
  }, [layoutMode]);

  // Determine dynamic column count based on container width
  const updateDimensions = useCallback(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = window.innerHeight;
    setViewportHeight(height);

    if (layoutMode === 'list') {
      setColumns(1);
    } else {
      if (width < 640) setColumns(1);
      else if (width < 768) setColumns(2);
      else if (width < 1024) setColumns(3);
      else setColumns(4);
    }
  }, [containerRef, layoutMode]);

  // Measure on mount and window resize
  useEffect(() => {
    updateDimensions();
    const handleResize = () => updateDimensions();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateDimensions]);

  // Handle scroll events with requestAnimationFrame for 60fps zero-lag scrolling
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            // How much has scrolled past the top of the container
            const currentScroll = Math.max(0, -rect.top);
            setScrollTop(currentScroll);
          } else {
            setScrollTop(window.scrollY);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Run once on mount to establish position
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [containerRef]);

  // Compute virtualization math
  const totalRows = Math.ceil(totalItems / columns);
  const totalHeight = totalRows * rowHeight;

  if (totalItems === 0 || totalRows === 0) {
    return {
      columns,
      rowHeight,
      totalHeight: 0,
      startIndex: 0,
      endIndex: 0,
      topOffset: 0,
      bottomOffset: 0,
      visibleRowCount: 0,
    };
  }

  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endRow = Math.min(totalRows - 1, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);

  const startIndex = startRow * columns;
  const endIndex = Math.min(totalItems, (endRow + 1) * columns);

  const topOffset = startRow * rowHeight;
  const bottomOffset = Math.max(0, (totalRows - (endRow + 1)) * rowHeight);

  return {
    columns,
    rowHeight,
    totalHeight,
    startIndex,
    endIndex,
    topOffset,
    bottomOffset,
    visibleRowCount: Math.max(0, endRow - startRow + 1),
  };
}
