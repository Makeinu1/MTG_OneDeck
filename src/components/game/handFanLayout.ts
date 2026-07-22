export interface HandFanCardLayout {
  rotationDeg: number;
  translateY: number;
  marginLeft: number;
  zIndex: number;
}

export interface MobileHandLayout {
  cardWidth: number;
  marginLeft: number;
  visibleCount: number;
  visibleSpan: number;
}

const DESKTOP_CARD_WIDTH = 132;
const TARGET_FAN_WIDTH = 800;
const MAX_OVERLAP = DESKTOP_CARD_WIDTH * 0.68;
const MOBILE_HAND_SIDE_RESERVE = 16;
const MOBILE_HAND_VISIBLE_CARDS = 5;
const MOBILE_HAND_MIN_EXPOSURE = 44;

/** Portrait-only hand rail geometry. Desktop and landscape continue to use the fan model. */
export function computeMobileHandLayout({
  containerWidth,
  viewportHeight,
  count,
}: {
  containerWidth: number;
  viewportHeight: number;
  count: number;
}): MobileHandLayout {
  const cardWidth = Math.min(76, Math.max(52, viewportHeight * 0.1));
  const visibleCount = Math.min(Math.max(0, count), MOBILE_HAND_VISIBLE_CARDS);
  if (visibleCount === 0) return { cardWidth, marginLeft: 0, visibleCount: 0, visibleSpan: 0 };
  if (visibleCount === 1) return { cardWidth, marginLeft: 0, visibleCount: 1, visibleSpan: cardWidth };

  const availableWidth = Math.max(0, containerWidth - MOBILE_HAND_SIDE_RESERVE * 2);
  const fitMargin = (availableWidth - cardWidth) / (visibleCount - 1) - cardWidth;
  const marginLeft = Math.min(0, Math.max(MOBILE_HAND_MIN_EXPOSURE - cardWidth, fitMargin));
  return {
    cardWidth,
    marginLeft,
    visibleCount,
    visibleSpan: cardWidth + (visibleCount - 1) * (cardWidth + marginLeft),
  };
}

export function handFanCardLayout(index: number, count: number): HandFanCardLayout {
  if (count <= 1) return { rotationDeg: 0, translateY: 0, marginLeft: 0, zIndex: 1 };
  const normalized = (index / (count - 1)) * 2 - 1;
  const totalArc = Math.min(30, Math.max(12, (count - 1) * 3.5));
  const desiredOverlap = (TARGET_FAN_WIDTH - count * DESKTOP_CARD_WIDTH) / (count - 1);
  const marginLeft = index === 0 ? 0 : Math.max(-MAX_OVERLAP, Math.min(0, desiredOverlap));
  return {
    rotationDeg: normalized * totalArc / 2,
    translateY: -Math.pow(Math.abs(normalized), 1.6) * 12,
    marginLeft,
    // A physical fan is one continuous stack: cards farther to the right sit
    // above cards to their left.  Only hover/focus temporarily raises a card.
    zIndex: index + 1,
  };
}

export function estimatedFanWidth(count: number): number {
  if (count <= 0) return 0;
  const layout = handFanCardLayout(Math.min(1, count - 1), count);
  return count * DESKTOP_CARD_WIDTH + Math.max(0, count - 1) * layout.marginLeft;
}

export function exposedCardWidth(count: number): number {
  if (count <= 1) return DESKTOP_CARD_WIDTH;
  return DESKTOP_CARD_WIDTH + handFanCardLayout(1, count).marginLeft;
}
