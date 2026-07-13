export interface CardPreviewAnchor {
  x: number;
  y: number;
}

export function cardPreviewPosition(
  anchor: CardPreviewAnchor,
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const previewWidth = Math.min(360, viewport.width - 24);
  const previewHeight = Math.min(480, viewport.height - 24);
  const preferredLeft = anchor.x + 18;
  const left = preferredLeft + previewWidth <= viewport.width - 12
    ? preferredLeft
    : Math.max(12, anchor.x - previewWidth - 18);
  const top = Math.min(
    Math.max(12, anchor.y - previewHeight / 2),
    Math.max(12, viewport.height - previewHeight - 12),
  );
  return { left, top };
}
