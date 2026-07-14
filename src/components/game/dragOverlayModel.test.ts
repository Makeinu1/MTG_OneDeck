import { describe, expect, it } from 'vitest';
import { createDragOverlayGeometry, rotationDegreesFromTransform } from './dragOverlayModel';

describe('drag overlay geometry', () => {
  it('keeps transformed bounds separate from the unscaled card size', () => {
    const geometry = createDragOverlayGeometry(
      { width: 160, height: 198 },
      { width: 122, height: 170 },
      'matrix(0.965926, 0.258819, -0.258819, 0.965926, 0, 0)',
      'matrix(1, 0, 0, 1, 0, -4)',
    );
    expect(geometry).toMatchObject({
      frameWidth: 160,
      frameHeight: 198,
      cardWidth: 122,
      cardHeight: 170,
      gripOffsetX: 80,
      gripOffsetY: 99,
      cardGripX: 61,
      cardGripY: 85,
      faceTransform: 'matrix(1, 0, 0, 1, 0, -4)',
    });
  });

  it('maps a pointer on a rotated card back to the same local grip point', () => {
    const angle = 15 * (Math.PI / 180);
    const cardGrip = { x: 8, y: 160 };
    const cardCenter = { x: 61, y: 85 };
    const transformedGrip = {
      x: (cardGrip.x - cardCenter.x) * Math.cos(angle)
        - (cardGrip.y - cardCenter.y) * Math.sin(angle) + 80,
      y: (cardGrip.x - cardCenter.x) * Math.sin(angle)
        + (cardGrip.y - cardCenter.y) * Math.cos(angle) + 99,
    };
    const geometry = createDragOverlayGeometry(
      { left: 300, top: 400, width: 160, height: 198 },
      { width: 122, height: 170 },
      'rotate(15deg)',
      'none',
      { x: 300 + transformedGrip.x, y: 400 + transformedGrip.y },
    );

    expect(geometry.gripOffsetX).toBeCloseTo(transformedGrip.x, 5);
    expect(geometry.gripOffsetY).toBeCloseTo(transformedGrip.y, 5);
    expect(geometry.cardGripX).toBeCloseTo(cardGrip.x, 5);
    expect(geometry.cardGripY).toBeCloseTo(cardGrip.y, 5);
  });

  it('reads a tapped card rotation while keeping the grip on its card surface', () => {
    expect(rotationDegreesFromTransform('matrix(0, 1, -1, 0, 0, 0)')).toBe(90);
    expect(
      createDragOverlayGeometry(
        { width: 170, height: 122 },
        { width: 122, height: 170 },
        'matrix(0, 1, -1, 0, 0, 0)',
      ),
    ).toMatchObject({ cardWidth: 122, cardHeight: 170, cardGripX: 61, cardGripY: 85 });
  });

  it('falls back to the actual card size when transformed bounds are unavailable', () => {
    expect(createDragOverlayGeometry(null, { width: 104, height: 145 }, 'none')).toEqual({
      frameWidth: 104,
      frameHeight: 145,
      cardWidth: 104,
      cardHeight: 145,
      gripOffsetX: 52,
      gripOffsetY: 72.5,
      cardGripX: 52,
      cardGripY: 72.5,
      faceTransform: 'none',
    });
  });
});
