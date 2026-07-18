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
