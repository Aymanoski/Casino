'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';

export interface VirtualListHandle {
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
  scrollToTop: () => void;
}

export interface VirtualListProps<T> {
  items: T[];
  /** Fixed height in px for each row (or grid row when columns > 1) */
  rowHeight: number;
  /** Viewport height of the scrollable container in px (default 560) */
  height?: number;
  /** Number of columns per virtual row (1 = list, 2/3/4 = grid). Defaults to 1. */
  columns?: number;
  /** Extra rows rendered above and below the viewport (default 4) */
  overscan?: number;
  /** Gap in px between items inside a grid row */
  gap?: number;
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  emptyState?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
}

function VirtualListInner<T>(
  {
    items,
    rowHeight,
    height = 560,
    columns = 1,
    overscan = 4,
    gap = 12,
    getKey,
    renderItem,
    emptyState,
    ariaLabel,
    className,
  }: VirtualListProps<T>,
  ref: React.ForwardedRef<VirtualListHandle>
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(height);

  const safeCols = Math.max(1, columns);
  const rowCount = Math.ceil(items.length / safeCols);
  const stride = rowHeight + gap;
  const totalHeight = Math.max(0, rowCount * stride - (rowCount > 0 ? gap : 0));

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const nextH = entries[0]?.contentRect.height;
      if (nextH && nextH > 0) setViewportHeight(nextH);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex(index: number, behavior: ScrollBehavior = 'smooth') {
        const el = containerRef.current;
        if (!el || items.length === 0) return;
        const clamped = Math.max(0, Math.min(items.length - 1, index));
        const targetRow = Math.floor(clamped / safeCols);
        const top = Math.max(0, targetRow * stride - stride * 1.5);
        el.scrollTo({ top, behavior });
        if (behavior === 'auto' || behavior === 'instant') {
          setScrollTop(top);
        }
      },
      scrollToTop() {
        containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      },
    }),
    [items.length, safeCols, stride]
  );

  const { startRow, endRow } = useMemo(() => {
    if (rowCount === 0) return { startRow: 0, endRow: -1 };
    const visibleStart = Math.floor(scrollTop / stride);
    const visibleCount = Math.ceil(viewportHeight / stride);
    return {
      startRow: Math.max(0, visibleStart - overscan),
      endRow: Math.min(rowCount - 1, visibleStart + visibleCount + overscan),
    };
  }, [rowCount, scrollTop, stride, viewportHeight, overscan]);

  if (items.length === 0) {
    return <>{emptyState ?? null}</>;
  }

  const rows: React.ReactNode[] = [];
  for (let r = startRow; r <= endRow; r++) {
    const rowItems: React.ReactNode[] = [];
    for (let c = 0; c < safeCols; c++) {
      const idx = r * safeCols + c;
      if (idx >= items.length) break;
      rowItems.push(
        <div key={getKey(items[idx], idx)} className="min-w-0 h-full">
          {renderItem(items[idx], idx)}
        </div>
      );
    }

    rows.push(
      <div
        key={`vrow-${r}`}
        style={{
          position: 'absolute',
          top: r * stride,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          height: rowHeight,
          display: 'grid',
          gridTemplateColumns: `repeat(${safeCols}, minmax(0, 1fr))`,
          gap,
        }}
      >
        {rowItems}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      role="region"
      aria-label={ariaLabel}
      style={{ height: Math.min(height, Math.max(rowHeight + 16, totalHeight + 8)) }}
      className={cn(
        'relative w-full overflow-y-auto overscroll-contain pe-1',
        className
      )}
    >
      <div style={{ position: 'relative', height: totalHeight, width: '100%' }}>
        {rows}
      </div>
    </div>
  );
}

export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: React.ForwardedRef<VirtualListHandle> }
) => React.ReactElement;

/**
 * Responsive column count helper for VirtualList grids across 320px–2560px.
 */
export function useResponsiveColumns(breakpoints: {
  base: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  '2xl'?: number;
}): number {
  const [cols, setCols] = useState(breakpoints.base);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const compute = () => {
      const w = window.innerWidth;
      if (breakpoints['2xl'] && w >= 1536) return breakpoints['2xl'];
      if (breakpoints.xl && w >= 1280) return breakpoints.xl;
      if (breakpoints.lg && w >= 1024) return breakpoints.lg;
      if (breakpoints.md && w >= 768) return breakpoints.md;
      if (breakpoints.sm && w >= 640) return breakpoints.sm;
      return breakpoints.base;
    };
    const update = () => setCols(compute());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [
    breakpoints.base,
    breakpoints.sm,
    breakpoints.md,
    breakpoints.lg,
    breakpoints.xl,
    breakpoints['2xl'],
  ]);

  return cols;
}
