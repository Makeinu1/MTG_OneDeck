import { describe, expect, it } from 'vitest';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { applyCommand } from '../../engine/commands';
import { clampWorkspaceOffset, stackItemPresentations } from './stackWorkspaceModel';

describe('stack workspace model', () => {
  it('orders the top item first', () => {
    const state = buildVisualFixture('stack').snapshot.state;
    const items = stackItemPresentations(state);
    expect(items.map((item) => item.cardId)).toEqual([...state.zones.stack].reverse());
    expect(items.some((item) => item.source?.includes('置物'))).toBe(true);
    expect(items.some((item) => item.targets.some((target) => target.playerId))).toBe(true);
    expect(items.some((item) => item.targets.some((target) => target.cardId))).toBe(true);
    expect(items.some((item) => item.targets.some((target) =>
      target.cardId && state.zones.stack.includes(target.cardId)))).toBe(true);
  });

  it('presents the announced value of X, including zero', () => {
    const initial = buildVisualFixture('hand7').snapshot.state;
    const cardId = initial.zones.hand[0];
    const state = applyCommand(initial, {
      type: 'castToStack',
      cardId,
      payment: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      forced: true,
      xValue: 0,
    }).state;
    expect(stackItemPresentations(state).find((item) => item.cardId === cardId)?.announcedX).toBe(0);
  });

  it('keeps dragged workspace within the viewport', () => {
    expect(clampWorkspaceOffset({ x: 9999, y: -9999 }, { width: 1280, height: 800 }))
      .toEqual({ x: 348, y: -78 });
    expect(clampWorkspaceOffset({ x: 9999, y: -9999 }, { width: 812, height: 375 }))
      .toEqual({ x: 114, y: 0 });
  });
});
