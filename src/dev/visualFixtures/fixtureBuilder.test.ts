/** Deterministic state pins for the D4a visual-only harness. */
import { describe, expect, it } from 'vitest';
import { buildVisualFixture, VISUAL_FIXTURE_SCENARIOS } from './fixtureBuilder';

function assertZoneConsistency(scenario: (typeof VISUAL_FIXTURE_SCENARIOS)[number]): void {
  const state = buildVisualFixture(scenario).snapshot.state;
  for (const [zone, cardIds] of Object.entries(state.zones)) {
    for (const cardId of cardIds) {
      expect(state.cards[cardId]?.zone).toBe(zone);
    }
  }
  const allZoneIds = Object.values(state.zones).flat();
  expect(new Set(allZoneIds).size).toBe(allZoneIds.length);
  expect(allZoneIds.length).toBe(Object.keys(state.cards).length);
}

describe('D4a visual fixture builder', () => {
  it('is deterministic and JSON round-trippable for all six scenarios', () => {
    for (const scenario of VISUAL_FIXTURE_SCENARIOS) {
      const first = buildVisualFixture(scenario);
      const second = buildVisualFixture(scenario);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(JSON.parse(JSON.stringify(first.snapshot))).toEqual(first.snapshot);
      assertZoneConsistency(scenario);
    }
  });

  it('pins the mulligan and eight-card hand scenes', () => {
    const mulligan = buildVisualFixture('mulligan');
    const hand = buildVisualFixture('hand');
    expect(mulligan.mulliganDecisionPending).toBe(true);
    expect(mulligan.snapshot.state.zones.hand).toHaveLength(7);
    expect(hand.mulliganDecisionPending).toBe(false);
    expect(hand.snapshot.state.zones.hand).toHaveLength(8);
  });

  it('pins the land density scene with mixed tapped state', () => {
    const state = buildVisualFixture('lands').snapshot.state;
    const lands = state.zones.battlefield.map((cardId) => state.cards[cardId]);
    expect(lands).toHaveLength(6);
    expect(lands.filter((card) => card.tapped)).toHaveLength(2);
    expect(lands.filter((card) => state.defs[card.defId].typeLine.includes('Basic'))).toHaveLength(3);
  });

  it('pins battlefield, stack, and graveyard scene cardinalities', () => {
    const battlefield = buildVisualFixture('battlefield').snapshot.state;
    const stack = buildVisualFixture('stack').snapshot.state;
    const graveyard = buildVisualFixture('graveyard').snapshot.state;

    expect(battlefield.zones.battlefield).toHaveLength(16);
    expect(stack.zones.stack).toHaveLength(2);
    expect(graveyard.zones.graveyard).toHaveLength(10);
    expect(graveyard.zones.exile).toHaveLength(2);
    expect(graveyard.life).toBe(31);
  });
});
