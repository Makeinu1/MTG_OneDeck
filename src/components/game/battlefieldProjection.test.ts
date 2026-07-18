import { describe, expect, it } from 'vitest';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { battlefieldRole, bundleVisibleTokens, projectBattlefield } from './battlefieldProjection';

describe('battlefieldProjection', () => {
  it('projects planeswalkers, including mixed current faces, into support', () => {
    const state = buildVisualFixture('battlefield').snapshot.state;
    const id = state.zones.battlefield[0];
    const card = state.cards[id];
    const def = state.defs[card.defId];
    const next = {
      ...state,
      defs: {
        ...state.defs,
        [card.defId]: {
          ...def,
          typeLine: 'Artifact Creature Planeswalker Land',
          faces: def.faces.map((face, index) => index === card.faceIndex
            ? { ...face, typeLine: 'Artifact Creature Planeswalker Land' }
            : face),
        },
      },
    };
    expect(battlefieldRole(next, id)).toBe('support');
    expect(projectBattlefield(next).support.flatMap((bundle) => bundle.cardIds)).toContain(id);
  });

  it('only bundles tokens whose visible state is equal', () => {
    const base = buildVisualFixture('battlefield').snapshot.state;
    const ids = base.zones.battlefield.slice(0, 2);
    const seed = base.cards[ids[0]];
    const cards = {
      ...base.cards,
      [ids[0]]: { ...seed, id: ids[0], isToken: true },
      [ids[1]]: { ...seed, id: ids[1], isToken: true },
    };
    const state = { ...base, cards };
    expect(bundleVisibleTokens(state, ids)).toHaveLength(1);
    const changed = {
      ...state,
      cards: { ...cards, [ids[1]]: { ...cards[ids[1]], tapped: !cards[ids[1]].tapped } },
    };
    expect(bundleVisibleTokens(changed, ids)).toHaveLength(2);
  });

  it('keeps otherwise identical tokens separate while their combat roles differ', () => {
    const base = buildVisualFixture('battlefield').snapshot.state;
    const ids = base.zones.battlefield.slice(0, 2);
    const seed = base.cards[ids[0]];
    const cards = {
      ...base.cards,
      [ids[0]]: { ...seed, id: ids[0], isToken: true },
      [ids[1]]: { ...seed, id: ids[1], isToken: true },
    };
    const state = {
      ...base,
      cards,
      combat: {
        combatId: 'combat-1', turn: base.turn, step: 'declareAttackers' as const,
        attackingPlayerId: base.localPlayerId,
        defendingPlayerId: base.turnOrder.find((id) => id !== base.localPlayerId) ?? 'OPPONENT_A',
        attackers: [{
          cardId: ids[0], objectId: `${ids[0]}:${cards[ids[0]].zoneChangeCounter}`,
          controllerId: base.localPlayerId,
          target: { type: 'player' as const, playerId: 'OPPONENT_A' },
          blockedBy: [], declaredOrder: 0,
        }],
        blockers: [],
      },
    };
    expect(bundleVisibleTokens(state, ids)).toHaveLength(2);
  });

  it('does not silently lose an attachment whose host is missing', () => {
    const base = buildVisualFixture('battlefield').snapshot.state;
    const id = base.zones.battlefield[0];
    const state = {
      ...base,
      cards: { ...base.cards, [id]: { ...base.cards[id], attachedTo: 'missing-host' } },
    };
    const projection = projectBattlefield(state);
    expect(projection.orphanAttachments).toContain(id);
    expect(projection.support.flatMap((bundle) => bundle.cardIds)).toContain(id);
  });
});
