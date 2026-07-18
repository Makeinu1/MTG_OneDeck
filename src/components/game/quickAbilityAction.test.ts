import { describe, expect, it } from 'vitest';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import type { CardDef } from '../../types/card';
import { quickAbilityAction, quickAbilityLabel } from './quickAbilityAction';

function battlefieldSubject(oracleText: string) {
  const state = buildVisualFixture('battlefield').snapshot.state;
  const cardId = state.zones.battlefield.find((id) =>
    state.defs[state.cards[id].defId]?.typeLine.includes('Creature'))!;
  const card = { ...state.cards[cardId], tapped: false };
  const sourceDef = state.defs[card.defId];
  const def: CardDef = {
    ...sourceDef,
    faces: sourceDef.faces.map((face, index) => index === card.faceIndex ? { ...face, oracleText } : face),
  };
  return { card, def };
}

describe('quickAbilityAction', () => {
  it('routes one modeled {T} line to its flat ability index', () => {
    const { card, def } = battlefieldSubject('Flying\n{T}: Add {G}.');
    const action = quickAbilityAction(card, def);
    expect(action.kind).toBe('activate');
    expect(action.lines.map((line) => line.index)).toEqual([1]);
  });

  it('offers a choice when multiple {T} lines are available', () => {
    const { card, def } = battlefieldSubject('{T}: Add {G}.\n{T}: Draw a card.');
    const action = quickAbilityAction(card, def);
    expect(action.kind).toBe('choose');
    expect(action.lines.map((line) => line.index)).toEqual([0, 1]);
  });

  it('keeps manual tap for no {T} ability, face-down cards, and tapped cards', () => {
    const { card, def } = battlefieldSubject('{1}: Draw a card.');
    expect(quickAbilityAction(card, def).kind).toBe('manual-tap');
    expect(quickAbilityAction({ ...card, faceDown: true }, def).kind).toBe('manual-tap');
    expect(quickAbilityAction({ ...card, tapped: true }, def).kind).toBe('manual-tap');
  });

  it('shortens long picker labels without changing short labels', () => {
    const { card, def } = battlefieldSubject('{T}: Add {G}.\n{T}: Draw a card, then discard a card, then create a very descriptive token.');
    const action = quickAbilityAction(card, def);
    expect(action.kind).toBe('choose');
    const [first, second] = action.lines;
    if (!first || !second) throw new Error('expected two quick ability lines');
    expect(quickAbilityLabel(first, 'immediate')).toBe('{T}: Add {G}. [即時]');
    expect(quickAbilityLabel(second, 'stack').endsWith('…')).toBe(true);
  });
});
