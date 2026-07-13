export interface HandFanCardLayout {
  rotationDeg: number;
  translateY: number;
  marginLeft: number;
  zIndex: number;
}

const DESKTOP_CARD_WIDTH = 132;
const TARGET_FAN_WIDTH = 800;
const MAX_OVERLAP = DESKTOP_CARD_WIDTH * 0.68;

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
