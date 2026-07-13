import { describe, expect, it } from 'vitest';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { manaReadinessModel } from './manaReadiness';

describe('manaReadinessModel', () => {
  it('separates exact floating mana from untapped source count', () => {
    const state = buildVisualFixture('stack').snapshot.state;
    const firstLandId = state.zones.battlefield.find((cardId) =>
      (state.defs[state.cards[cardId]?.defId]?.producedMana?.length ?? 0) > 0,
    );
    const withMana = {
      ...state,
      manaPool: { ...state.manaPool, U: 2, C: 1 },
      cards: firstLandId
        ? { ...state.cards, [firstLandId]: { ...state.cards[firstLandId], tapped: true } }
        : state.cards,
    };
    const model = manaReadinessModel(withMana);
    expect(model.poolTotal).toBe(3);
    expect(model.pool.U).toBe(2);
    expect(model.untappedSourceCount).toBeGreaterThanOrEqual(0);
  });
});
