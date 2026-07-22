import { useCallback, useLayoutEffect, useState } from 'react';

export interface AdaptiveLaneLayoutInput {
  width: number;
  height: number;
  count: number;
  preferredWidth: number;
  wrapWidth: number;
  maxRows?: number;
  gap?: number;
  rowGap?: number;
  aspectRatio?: number;
}

export interface AdaptiveLaneLayout {
  cardWidth: number;
  columns: number;
  rows: number;
  denseOverview: boolean;
}

export type ResponsiveLaneMode = 'desktop' | 'mobile-portrait' | 'mobile-landscape';
export type ResponsiveLaneRole = 'creature' | 'support';

export interface ResponsiveLaneLayoutInput {
  mode: ResponsiveLaneMode;
  role: ResponsiveLaneRole;
  width: number;
  height: number;
  count: number;
}

export function responsiveLaneMode(width: number, height: number): ResponsiveLaneMode {
  if (width >= 900) return 'desktop';
  return width > height ? 'mobile-landscape' : 'mobile-portrait';
}

const DEFAULT_ASPECT_RATIO = 680 / 488;

function widthForRows(input: AdaptiveLaneLayoutInput, rows: number): number {
  const gap = input.gap ?? 8;
  const rowGap = input.rowGap ?? gap;
  const aspectRatio = input.aspectRatio ?? DEFAULT_ASPECT_RATIO;
  const columns = Math.max(1, Math.ceil(input.count / rows));
  const widthLimit = (Math.max(0, input.width) - gap * Math.max(0, columns - 1)) / columns;
  const heightLimit = ((Math.max(0, input.height) - rowGap * Math.max(0, rows - 1)) / rows) / aspectRatio;
  return Math.max(1, Math.min(input.preferredWidth, widthLimit, heightLimit));
}

/** Pure layout solver shared by creature and support lanes. */
export function computeAdaptiveLaneLayout(input: AdaptiveLaneLayoutInput): AdaptiveLaneLayout {
  if (input.count <= 0) return { cardWidth: input.preferredWidth, columns: 0, rows: 1, denseOverview: false };
  const maxRows = Math.max(1, input.maxRows ?? 3);
  const oneRowWidth = widthForRows(input, 1);
  if (oneRowWidth >= input.wrapWidth || maxRows === 1) {
    const cardWidth = Math.floor(oneRowWidth);
    return { cardWidth, columns: input.count, rows: 1, denseOverview: cardWidth < 44 };
  }

  let bestRows = 1;
  let bestWidth = oneRowWidth;
  for (let rows = 2; rows <= Math.min(maxRows, input.count); rows += 1) {
    const candidate = widthForRows(input, rows);
    if (candidate > bestWidth + 0.5) {
      bestWidth = candidate;
      bestRows = rows;
    }
  }
  const cardWidth = Math.floor(bestWidth);
  return {
    cardWidth,
    columns: Math.ceil(input.count / bestRows),
    rows: bestRows,
    denseOverview: cardWidth < 44,
  };
}

/** Viewport profile wrapper used by every battlefield shelf. */
export function computeResponsiveLaneLayout(input: ResponsiveLaneLayoutInput): AdaptiveLaneLayout {
  const desktopProfile = input.role === 'creature'
    ? { preferredWidth: 168, wrapWidth: 96 }
    : { preferredWidth: 112, wrapWidth: 72 };

  if (input.mode === 'desktop') {
    return computeAdaptiveLaneLayout({
      ...input,
      ...desktopProfile,
      maxRows: 3,
    });
  }

  if (input.mode === 'mobile-landscape') {
    return computeAdaptiveLaneLayout({
      ...input,
      ...desktopProfile,
      maxRows: 1,
    });
  }

  const portraitProfile = input.role === 'creature'
    ? { preferredWidth: 72, wrapWidth: 48, targetCount: 5 }
    : { preferredWidth: 60, wrapWidth: 44, targetCount: 3 };
  if (input.count <= portraitProfile.targetCount) {
    const cardWidth = input.count <= 0
      ? portraitProfile.preferredWidth
      : Math.floor(widthForRows({
          ...input,
          ...portraitProfile,
          maxRows: 1,
        }, 1));
    return {
      cardWidth,
      columns: Math.max(0, input.count),
      rows: 1,
      denseOverview: cardWidth < 44,
    };
  }
  return computeAdaptiveLaneLayout({
    ...input,
    ...portraitProfile,
    maxRows: 2,
  });
}

export function useElementSize<T extends HTMLElement>(): {
  setNode: (node: T | null) => void;
  width: number;
  height: number;
} {
  const [node, setNodeState] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const setNode = useCallback((next: T | null) => setNodeState(next), []);
  useLayoutEffect(() => {
    if (!node) return;
    const update = (): void => {
      const rect = node.getBoundingClientRect();
      setSize((current) => current.width === rect.width && current.height === rect.height
        ? current
        : { width: rect.width, height: rect.height });
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return { setNode, ...size };
}
