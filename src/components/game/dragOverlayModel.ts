export interface DragOverlaySize {
  width: number;
  height: number;
}

export interface DragOverlayPoint {
  x: number;
  y: number;
}

export interface DragOverlayBounds extends DragOverlaySize {
  left: number;
  top: number;
}

export interface DragOverlayGeometry {
  /** The transformed source bounds used by dnd-kit to retain the pointer offset. */
  frameWidth: number;
  frameHeight: number;
  /** The card's untransformed dimensions, retained so its artwork is never resized. */
  cardWidth: number;
  cardHeight: number;
  /** Pointer position inside dnd-kit's transformed source frame. */
  gripOffsetX: number;
  gripOffsetY: number;
  /** The same physical grip expressed in the card's unrotated coordinates. */
  cardGripX: number;
  cardGripY: number;
  /** Preserve the hovered face lift at the exact point the card is picked up. */
  faceTransform: string;
}

function validDimension(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function rotationDegreesFromTransform(transform: string): number {
  if (!transform || transform === 'none') return 0;

  const matrix = /^matrix\(([^)]+)\)$/.exec(transform);
  if (matrix) {
    const values = matrix[1].split(',').map(Number);
    if (values.length >= 2 && values.every(Number.isFinite)) {
      return Math.atan2(values[1], values[0]) * (180 / Math.PI);
    }
  }

  const matrix3d = /^matrix3d\(([^)]+)\)$/.exec(transform);
  if (matrix3d) {
    const values = matrix3d[1].split(',').map(Number);
    if (values.length === 16 && values.every(Number.isFinite)) {
      return Math.atan2(values[1], values[0]) * (180 / Math.PI);
    }
  }

  const rotate = /rotate\((-?[\d.]+)(deg|rad)\)/.exec(transform);
  if (!rotate) return 0;
  const value = Number(rotate[1]);
  if (!Number.isFinite(value)) return 0;
  return rotate[2] === 'rad' ? value * (180 / Math.PI) : value;
}

export function createDragOverlayGeometry(
  transformedBounds: Partial<DragOverlayBounds> | null,
  cardSize: Partial<DragOverlaySize> | null,
  transform: string,
  faceTransform = 'none',
  pointer: DragOverlayPoint | null = null,
): DragOverlayGeometry {
  const cardWidth = validDimension(cardSize?.width, 66);
  const cardHeight = validDimension(cardSize?.height, 92);
  const frameWidth = validDimension(transformedBounds?.width, cardWidth);
  const frameHeight = validDimension(transformedBounds?.height, cardHeight);
  const boundsLeft = typeof transformedBounds?.left === 'number' ? transformedBounds.left : 0;
  const boundsTop = typeof transformedBounds?.top === 'number' ? transformedBounds.top : 0;
  const gripOffsetX = pointer ? clamp(pointer.x - boundsLeft, 0, frameWidth) : frameWidth / 2;
  const gripOffsetY = pointer ? clamp(pointer.y - boundsTop, 0, frameHeight) : frameHeight / 2;
  const rotationRad = rotationDegreesFromTransform(transform) * (Math.PI / 180);
  const transformedX = gripOffsetX - frameWidth / 2;
  const transformedY = gripOffsetY - frameHeight / 2;
  const cardGripX = clamp(
    transformedX * Math.cos(rotationRad) + transformedY * Math.sin(rotationRad) + cardWidth / 2,
    0,
    cardWidth,
  );
  const cardGripY = clamp(
    -transformedX * Math.sin(rotationRad) + transformedY * Math.cos(rotationRad) + cardHeight / 2,
    0,
    cardHeight,
  );
  return {
    frameWidth,
    frameHeight,
    cardWidth,
    cardHeight,
    gripOffsetX,
    gripOffsetY,
    cardGripX,
    cardGripY,
    faceTransform,
  };
}
