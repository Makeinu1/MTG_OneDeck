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

function battlefieldLand(oracleText: string, typeLine: string, producedMana: CardDef['producedMana']) {
  const { card, def } = battlefieldSubject(oracleText);
  return {
    card,
    def: {
      ...def,
      typeLine,
      producedMana,
      faces: def.faces.map((face, index) => index === card.faceIndex
        ? { ...face, typeLine, oracleText }
        : face),
    },
  };
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

  it('routes intrinsic and reminder-only land mana through tap-for-mana', () => {
    const island = battlefieldLand('({T}: Add {U}.)', 'Basic Land — Island', ['U']);
    expect(quickAbilityAction(island.card, island.def)).toEqual({
      kind: 'tap-for-mana', lines: [], colors: ['U'],
    });

    const sanctuary = battlefieldLand(
      'Mystic Sanctuary enters tapped unless you control three or more other Islands.\nWhen Mystic Sanctuary enters untapped, you may put target instant or sorcery card from your graveyard on top of your library.\n({T}: Add {U}.)',
      'Land — Island',
      ['U'],
    );
    expect(quickAbilityAction(sanctuary.card, sanctuary.def).kind).toBe('tap-for-mana');
  });

  it('preserves color choice and fails closed when another activated ability exists', () => {
    const dual = battlefieldLand('', 'Land', ['U', 'R']);
    expect(quickAbilityAction(dual.card, dual.def)).toEqual({
      kind: 'tap-for-mana', lines: [], colors: ['U', 'R'],
    });

    const complex = battlefieldLand('{1}, {T}: Add {U}.', 'Land', ['U']);
    expect(quickAbilityAction(complex.card, complex.def).kind).toBe('activate');

    const competing = battlefieldLand('{1}: Scry 1.', 'Land — Island', ['U']);
    expect(quickAbilityAction(competing.card, competing.def).kind).toBe('manual-tap');
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
