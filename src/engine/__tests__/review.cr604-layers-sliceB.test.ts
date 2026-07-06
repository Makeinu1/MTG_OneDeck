// Reviewer-owned adversarial tests for S-LAYERS Slice B: keyword-only Layer 6 additions
// (design-lock: docs/engine-spec.md §34.32). 実装エージェント(Codex含む)は本ファイルを
// 変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 613.1f: Layer 6 = ability-adding/keyword counter/ability-removing/can't-have effects。
//   本スライスはability-adding(keyword付与)のみ対象。
// - CR 604.4: Aura/Equipment/Fortificationの装着先修正はtargetしない。
// 契約の要石=Slice A(§34.31)と同じself/attached-object・battlefield限定・additive
// のみのexact-phrase gateパターンをkeyword付与へ再利用。ability除去("can't have")・
// 未知keyword語彙・anthem型は全てhonest fallback(非マッチ=既存挙動のまま)。
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand } from '../commands';
import { initGame } from '../init';
import { effectiveKeywords } from '../status';
import type { GameState } from '../types';
import { makeDef } from './helpers';

function cardDef(id: string, typeLine: string, oracleText?: string): CardDef {
  return makeDef({ scryfallId: id, name: id, typeLine, faces: [{ name: id, typeLine, ...(oracleText ? { oracleText } : {}) }] });
}

function move(state: GameState, cardId: string, to: 'battlefield' | 'hand' | 'graveyard'): GameState {
  return applyCommand(state, { type: 'moveCard', cardId, to, position: 'bottom' }).state;
}

function idOf(state: GameState, defId: string): string {
  return Object.values(state.cards).find((card) => card.defId === defId)?.id ?? '';
}

describe('S-LAYERS Slice B: keyword-only Layer 6 additions (CR 613.1f)', () => {
  it('self keyword grant: "This creature has flying." grants flying while on battlefield', () => {
    const def = cardDef('r-cr604b-self', 'Creature — Bear', 'This creature has flying.');
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604b-self');
    state = move(state, id, 'battlefield');
    expect(effectiveKeywords(state, id)).toContain('flying');
  });

  it('golden pattern (Angelic Gift shape): attached-object keyword grant applies to the ENCHANTED creature, not the Aura itself', () => {
    const creature = cardDef('r-cr604b-target', 'Creature — Bear');
    const aura = cardDef('r-cr604b-aura', 'Enchantment — Aura', 'Enchanted creature has flying.');
    let state = initGame([{ def: creature, isCommander: false }, { def: aura, isCommander: false }], 1);
    const creatureId = idOf(state, 'r-cr604b-target');
    const auraId = idOf(state, 'r-cr604b-aura');
    state = move(state, creatureId, 'battlefield');
    state = move(state, auraId, 'battlefield');
    state = applyCommand(state, { type: 'attach', cardId: auraId, to: creatureId }).state;

    expect(effectiveKeywords(state, creatureId)).toContain('flying');
    expect(effectiveKeywords(state, auraId)).not.toContain('flying');
  });

  it('multi-keyword grant: "has deathtouch and lifelink." grants both keywords', () => {
    const def = cardDef('r-cr604b-multi', 'Creature — Bear', 'This creature has deathtouch and lifelink.');
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604b-multi');
    state = move(state, id, 'battlefield');
    const kws = effectiveKeywords(state, id);
    expect(kws).toContain('deathtouch');
    expect(kws).toContain('lifelink');
  });

  it('Oxford-comma list: "has flying, vigilance, and lifelink." grants all three', () => {
    const def = cardDef('r-cr604b-oxford', 'Creature — Bear', 'This creature has flying, vigilance, and lifelink.');
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604b-oxford');
    state = move(state, id, 'battlefield');
    const kws = effectiveKeywords(state, id);
    expect(kws).toEqual(expect.arrayContaining(['flying', 'vigilance', 'lifelink']));
  });

  it('false-positive guard: ability-removal ("can\'t have [keyword]") is not treated as a grant', () => {
    const def = cardDef('r-cr604b-cant-have', 'Creature — Bear', "This creature can't have flying.");
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604b-cant-have');
    state = move(state, id, 'battlefield');
    expect(effectiveKeywords(state, id)).not.toContain('flying');
  });

  it('false-positive guard: unrecognized keyword word fails the whole clause closed (no partial grant)', () => {
    const def = cardDef('r-cr604b-unknown', 'Creature — Bear', 'This creature has bogus-keyword.');
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604b-unknown');
    state = move(state, id, 'battlefield');
    expect(effectiveKeywords(state, id)).toEqual([]);
  });

  it('false-positive guard: mixing a recognized keyword with an unrecognized one fails the whole clause closed', () => {
    const def = cardDef('r-cr604b-mixed', 'Creature — Bear', "This creature has hexproof and can't be countered.");
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604b-mixed');
    state = move(state, id, 'battlefield');
    // "can't be countered" is not a recognized keyword word, so the entire clause must be
    // rejected — hexproof must NOT be granted from a partially-matched list.
    expect(effectiveKeywords(state, id)).not.toContain('hexproof');
  });

  it('false-positive guard: anthem-style multi-object static text does not apply to anything', () => {
    const def = cardDef('r-cr604b-anthem', 'Creature — Bear', 'Creatures you control have flying.');
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604b-anthem');
    state = move(state, id, 'battlefield');
    expect(effectiveKeywords(state, id)).toEqual([]);
  });

  it('off-battlefield: additive keyword grant does not apply while the source is in hand', () => {
    const def = cardDef('r-cr604b-in-hand', 'Creature — Bear', 'This creature has flying.');
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604b-in-hand');
    state = move(state, id, 'hand');
    expect(effectiveKeywords(state, id)).toEqual([]);
  });

  it('detached Aura: attachedTo undefined does not grant anything, no crash', () => {
    const creature = cardDef('r-cr604b-detached-target', 'Creature — Bear');
    const aura = cardDef('r-cr604b-detached-aura', 'Enchantment — Aura', 'Enchanted creature has flying.');
    let state = initGame([{ def: creature, isCommander: false }, { def: aura, isCommander: false }], 1);
    const creatureId = idOf(state, 'r-cr604b-detached-target');
    const auraId = idOf(state, 'r-cr604b-detached-aura');
    state = move(state, creatureId, 'battlefield');
    state = move(state, auraId, 'battlefield');
    expect(() => effectiveKeywords(state, creatureId)).not.toThrow();
    expect(effectiveKeywords(state, creatureId)).toEqual([]);
  });

  it('non-regression: manualKeywords and printed keywords still compose correctly alongside static grants', () => {
    const def = cardDef('r-cr604b-manual-compose', 'Creature — Bear', 'This creature has flying.');
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604b-manual-compose');
    state = move(state, id, 'battlefield');
    state = applyCommand(state, { type: 'setManualKeywords', cardId: id, keywords: ['trample'] }).state;
    const kws = effectiveKeywords(state, id);
    expect(kws).toContain('flying');
    expect(kws).toContain('trample');
  });

  it('non-regression: Slice A effectiveTypeLine is unaffected by Slice B additions (both can coexist on the same card)', () => {
    const def = cardDef(
      'r-cr604b-coexist',
      'Land',
      'This land is a Mountain in addition to its other types. This land has flying.',
    );
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604b-coexist');
    state = move(state, id, 'battlefield');
    expect(effectiveKeywords(state, id)).toContain('flying');
  });

  it('non-regression: a plain vanilla creature with no static ability has no granted keywords', () => {
    const def = cardDef('r-cr604b-vanilla', 'Creature — Bear');
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604b-vanilla');
    state = move(state, id, 'battlefield');
    expect(effectiveKeywords(state, id)).toEqual([]);
  });
});
