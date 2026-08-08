/** Deterministic state pins for the D4a visual-only harness. */
import { describe, expect, it } from 'vitest';
import { buildVisualFixture, VISUAL_FIXTURE_SCENARIOS } from './fixtureBuilder';
import { bundleLands, landRowCards } from '../../components/game/landRowModel';

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
  it('is deterministic and JSON round-trippable for every scenario', () => {
    for (const scenario of VISUAL_FIXTURE_SCENARIOS) {
      const first = buildVisualFixture(scenario);
      const second = buildVisualFixture(scenario);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(JSON.parse(JSON.stringify(first.snapshot))).toEqual(first.snapshot);
      assertZoneConsistency(scenario);
    }
  }, 30_000);

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

  it('pins every mana color and a two-digit value for HUD readability', () => {
    const state = buildVisualFixture('mana-multicolor').snapshot.state;
    expect(state.manaPool).toEqual({ W: 1, U: 2, B: 3, R: 4, G: 5, C: 10 });
    expect(state.zones.battlefield).toHaveLength(6);
    expect(state.phase).toBe('main1');
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

  it('pins the ambient macro EMPTY and DENSE board cardinalities', () => {
    const empty = buildVisualFixture('ambient-macro-empty').snapshot.state;
    expect(empty.zones.hand).toHaveLength(0);
    expect(empty.zones.battlefield).toHaveLength(0);
    expect(empty.zones.stack).toHaveLength(0);
    expect(empty.zones.command).toHaveLength(1);

    const dense = buildVisualFixture('ambient-macro-dense').snapshot.state;
    const battlefieldTypes = dense.zones.battlefield.map((cardId) =>
      dense.defs[dense.cards[cardId].defId].typeLine);
    expect(dense.zones.hand).toHaveLength(7);
    expect(battlefieldTypes.filter((typeLine) => typeLine.includes('Land'))).toHaveLength(8);
    expect(battlefieldTypes.filter((typeLine) => !typeLine.includes('Land'))).toHaveLength(12);
    expect(dense.zones.battlefield).toHaveLength(20);
    expect(dense.zones.stack).toHaveLength(2);
    expect(dense.zones.command).toHaveLength(1);
  });

  it('pins partner and full-chrome board density scenes without changing existing fixtures', () => {
    const partner = buildVisualFixture('partner');
    expect(partner.snapshot.state.commanders).toHaveLength(2);
    expect(partner.snapshot.state.zones.command).toHaveLength(2);
    expect(new Set(partner.snapshot.state.commanders.map(({ cardId }) => cardId)).size).toBe(2);
    expect(partner.snapshot.deck.filter(({ isCommander }) => isCommander)).toHaveLength(2);

    const partnerAway = buildVisualFixture('partner-away').snapshot.state;
    const awayId = partnerAway.commanders.find(({ castCount }) => castCount === 2)?.cardId;
    expect(awayId).toBeDefined();
    expect(partnerAway.cards[awayId as string].zone).toBe('graveyard');
    expect(partnerAway.zones.graveyard).toContain(awayId);
    expect(partnerAway.zones.command).toHaveLength(1);
    expect(partnerAway.cards[awayId as string].zoneChangeCounter).toBe(4);
    expect(partnerAway.zonesByPlayer.P1.graveyard).toEqual(partnerAway.zones.graveyard);
    expect(partnerAway.zones.stack).toHaveLength(0);
    expect(partnerAway.pendingRuleChoices).toHaveLength(0);
    expect(partnerAway.pendingSbaChoices).toHaveLength(0);

    const dense = buildVisualFixture('board-dense').snapshot.state;
    const denseTypes = dense.zones.battlefield.map((cardId) => dense.defs[dense.cards[cardId].defId].typeLine);
    expect(dense.zones.hand).toHaveLength(15);
    expect(denseTypes.filter((typeLine) => typeLine.includes('Land'))).toHaveLength(12);
    expect(denseTypes.filter((typeLine) => typeLine.includes('Creature'))).toHaveLength(14);
    expect(denseTypes.filter((typeLine) => !typeLine.includes('Land') && !typeLine.includes('Creature'))).toHaveLength(10);
    expect(dense.zones.battlefield).toHaveLength(36);

    const sparse = buildVisualFixture('board-sparse').snapshot.state;
    const sparseTypes = sparse.zones.battlefield.map((cardId) => sparse.defs[sparse.cards[cardId].defId].typeLine);
    expect(sparse.zones.hand).toHaveLength(8);
    expect(sparseTypes.filter((typeLine) => typeLine.includes('Land'))).toHaveLength(4);
    expect(sparseTypes.filter((typeLine) => typeLine.includes('Creature'))).toHaveLength(3);
    expect(sparseTypes.filter((typeLine) => !typeLine.includes('Land') && !typeLine.includes('Creature'))).toHaveLength(2);
    expect(buildVisualFixture('battlefield').snapshot.state.zones.battlefield).toHaveLength(16);
  });

  it('keeps a battlefield commander reproducible for marker geometry checks', () => {
    const state = buildVisualFixture('commander-battlefield').snapshot.state;
    const commanderId = state.commanders[0].cardId;
    expect(state.cards[commanderId].zone).toBe('battlefield');
    expect(state.zones.battlefield).toContain(commanderId);
  });

  it('pins the mobile density acceptance scene', () => {
    const state = buildVisualFixture('mobile-density').snapshot.state;
    const battlefieldIds = state.zones.battlefield;
    const types = battlefieldIds.map((cardId) => state.defs[state.cards[cardId].defId].typeLine);
    const landIds = battlefieldIds.filter((_, index) => types[index].includes('Land'));

    expect(state.zones.hand).toHaveLength(5);
    expect(types.filter((typeLine) => typeLine.includes('Creature'))).toHaveLength(5);
    expect(types.filter((typeLine) => !typeLine.includes('Land') && !typeLine.includes('Creature'))).toHaveLength(3);
    expect(bundleLands(landRowCards(state, landIds))).toHaveLength(3);
  });

  it('builds isolated layout-limit fixtures without weakening zone consistency', () => {
    const board = buildVisualFixture('board-overflow').snapshot.state;
    const lands = buildVisualFixture('lands-overflow').snapshot.state;
    const stack = buildVisualFixture('stack-deep').snapshot.state;
    const zones = buildVisualFixture('graveyard-deep').snapshot.state;

    expect(board.zones.battlefield.length).toBeGreaterThanOrEqual(70);
    expect(lands.zones.battlefield.filter((id) =>
      lands.defs[lands.cards[id].defId].typeLine.includes('Land'))).toHaveLength(86);
    expect(stack.zones.stack).toHaveLength(20);
    expect(zones.zones.graveyard).toHaveLength(60);
    expect(zones.zones.exile).toHaveLength(40);
  }, 15_000);
});
