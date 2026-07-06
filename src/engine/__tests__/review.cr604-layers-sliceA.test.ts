// Reviewer-owned adversarial tests for S-LAYERS Slice A: read-time additive Layer 4
// type accessor (design-lock: docs/engine-spec.md §34.31). 実装エージェント(Codex含む)
// は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 613.1d: Layer 4 = type-changing effects.
// - CR 611.3/611.3a: static abilityのcontinuous effectはlocked-inでなく常時再評価。
// - CR 604.4: Aura/Equipment/Fortificationの装着先修正はtargetしない。移動すれば
//   新objectを修正する(=attachedToが変われば追従する)。
// 契約の要石=本スライスは①additive(型追加のみ・除去/isnt/becomes-without-addition
// は非対応)②self/attached-objectの単一object限定(anthem非対応)③read-time計算
// (新GameState/GameCommandなし)④ObjectSnapshotは既存printed type lineのまま
// (本スライスで移行しない)。
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand } from '../commands';
import { initGame } from '../init';
import type { GameState } from '../types';
import { effectiveTypeLine } from '../status';
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

describe('S-LAYERS Slice A: read-time additive Layer 4 type accessor (CR 604/611/613)', () => {
  it('self additive: "This land is a Mountain in addition to its other types." adds Mountain while on battlefield', () => {
    const def = cardDef('r-cr604-self-land', 'Land', 'This land is a Mountain in addition to its other types.');
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604-self-land');
    state = move(state, id, 'battlefield');
    expect(effectiveTypeLine(state, id)).toContain('Mountain');
    expect(effectiveTypeLine(state, id)).toContain('Land');
  });

  it('dedup: does not duplicate a type that is already printed on the type line', () => {
    const def = cardDef('r-cr604-dup', 'Land — Mountain', 'This land is a Mountain in addition to its other types.');
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604-dup');
    state = move(state, id, 'battlefield');
    const typeLine = effectiveTypeLine(state, id);
    expect(typeLine.match(/\bMountain\b/g)).toHaveLength(1);
  });

  it('"every basic land type" self form appends all five basic land types', () => {
    const def = cardDef('r-cr604-every-basic', 'Land', 'This land is every basic land type in addition to its other types.');
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604-every-basic');
    state = move(state, id, 'battlefield');
    const typeLine = effectiveTypeLine(state, id);
    for (const basic of ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest']) {
      expect(typeLine).toContain(basic);
    }
  });

  it('attached-object additive: an Aura grants the ATTACHED creature the type, not itself', () => {
    const creature = cardDef('r-cr604-attach-target', 'Creature — Bear');
    const aura = cardDef('r-cr604-attach-aura', 'Enchantment — Aura', 'Enchanted creature is a Zombie in addition to its other types.');
    let state = initGame([{ def: creature, isCommander: false }, { def: aura, isCommander: false }], 1);
    const creatureId = idOf(state, 'r-cr604-attach-target');
    const auraId = idOf(state, 'r-cr604-attach-aura');
    state = move(state, creatureId, 'battlefield');
    state = move(state, auraId, 'battlefield');
    state = applyCommand(state, { type: 'attach', cardId: auraId, to: creatureId }).state;

    expect(effectiveTypeLine(state, creatureId)).toContain('Zombie');
    expect(effectiveTypeLine(state, auraId)).not.toContain('Zombie');
  });

  it('false-positive guard: anthem-style multi-object static text does not apply to anything', () => {
    const creature = cardDef(
      'r-cr604-anthem-victim',
      'Creature — Bear',
      'Creatures you control are Zombies in addition to their other types.',
    );
    let state = initGame([{ def: creature, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604-anthem-victim');
    state = move(state, id, 'battlefield');
    expect(effectiveTypeLine(state, id)).toBe('Creature — Bear');
  });

  it('false-positive guard: "becomes [type]" without "in addition to its other types" does not add types', () => {
    const def = cardDef('r-cr604-becomes', 'Land', 'This land becomes a 4/4 red Dragon creature with flying.');
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604-becomes');
    state = move(state, id, 'battlefield');
    expect(effectiveTypeLine(state, id)).toBe('Land');
  });

  it('false-positive guard: type removal text is not treated as an addition', () => {
    const def = cardDef('r-cr604-removal', 'Creature — Human Soldier', "This creature isn't a Human.");
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604-removal');
    state = move(state, id, 'battlefield');
    expect(effectiveTypeLine(state, id)).toBe('Creature — Human Soldier');
  });

  it('off-battlefield: additive static effect does not apply while the source is in hand', () => {
    const def = cardDef('r-cr604-in-hand', 'Land', 'This land is a Mountain in addition to its other types.');
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604-in-hand');
    state = move(state, id, 'hand');
    expect(effectiveTypeLine(state, id)).toBe('Land');
  });

  it('detached Aura: attachedTo undefined does not affect any creature, no crash', () => {
    const creature = cardDef('r-cr604-detached-target', 'Creature — Bear');
    const aura = cardDef('r-cr604-detached-aura', 'Enchantment — Aura', 'Enchanted creature is a Zombie in addition to its other types.');
    let state = initGame([{ def: creature, isCommander: false }, { def: aura, isCommander: false }], 1);
    const creatureId = idOf(state, 'r-cr604-detached-target');
    const auraId = idOf(state, 'r-cr604-detached-aura');
    state = move(state, creatureId, 'battlefield');
    state = move(state, auraId, 'battlefield');
    // Aura is on the battlefield but never attached (attachedTo left undefined).
    expect(() => effectiveTypeLine(state, creatureId)).not.toThrow();
    expect(effectiveTypeLine(state, creatureId)).toBe('Creature — Bear');
  });

  it('multiple additive sources on the same object: both additions appear, no drop', () => {
    const creature = cardDef('r-cr604-multi-target', 'Creature — Bear');
    const auraA = cardDef('r-cr604-multi-aura-a', 'Enchantment — Aura', 'Enchanted creature is a Zombie in addition to its other types.');
    const auraB = cardDef('r-cr604-multi-aura-b', 'Enchantment — Aura', 'Enchanted creature is a Horror in addition to its other types.');
    let state = initGame(
      [{ def: creature, isCommander: false }, { def: auraA, isCommander: false }, { def: auraB, isCommander: false }],
      1,
    );
    const creatureId = idOf(state, 'r-cr604-multi-target');
    const auraAId = idOf(state, 'r-cr604-multi-aura-a');
    const auraBId = idOf(state, 'r-cr604-multi-aura-b');
    state = move(state, creatureId, 'battlefield');
    state = move(state, auraAId, 'battlefield');
    state = move(state, auraBId, 'battlefield');
    state = applyCommand(state, { type: 'attach', cardId: auraAId, to: creatureId }).state;
    state = applyCommand(state, { type: 'attach', cardId: auraBId, to: creatureId }).state;

    const typeLine = effectiveTypeLine(state, creatureId);
    expect(typeLine).toContain('Zombie');
    expect(typeLine).toContain('Horror');
  });

  it('golden pattern (Awakened Skyclave shape): "As long as this creature is on the battlefield, it\'s a land in addition to its other types."', () => {
    const def = cardDef(
      'r-cr604-golden-skyclave',
      'Creature — Elemental',
      "As long as this creature is on the battlefield, it's a land in addition to its other types.",
    );
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604-golden-skyclave');
    state = move(state, id, 'battlefield');
    expect(effectiveTypeLine(state, id)).toContain('Land');
  });

  it('golden pattern (Nylea\'s Presence shape): attached-object "every basic land type" addition', () => {
    const land = cardDef('r-cr604-golden-nylea-land', 'Land');
    const aura = cardDef(
      'r-cr604-golden-nylea-aura',
      'Enchantment — Aura',
      'Enchanted land is every basic land type in addition to its other types.',
    );
    let state = initGame([{ def: land, isCommander: false }, { def: aura, isCommander: false }], 1);
    const landId = idOf(state, 'r-cr604-golden-nylea-land');
    const auraId = idOf(state, 'r-cr604-golden-nylea-aura');
    state = move(state, landId, 'battlefield');
    state = move(state, auraId, 'battlefield');
    state = applyCommand(state, { type: 'attach', cardId: auraId, to: landId }).state;

    const typeLine = effectiveTypeLine(state, landId);
    for (const basic of ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest']) {
      expect(typeLine).toContain(basic);
    }
  });

  it('HIGH fix pin: an unrelated leading sentence in the same paragraph does not get swallowed into the additive clause\'s capture group', () => {
    const def = cardDef(
      'r-cr604-multisentence-a',
      'Land',
      'This land is tapped. This land is a Mountain in addition to its other types.',
    );
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604-multisentence-a');
    state = move(state, id, 'battlefield');
    expect(effectiveTypeLine(state, id)).toBe('Land Mountain');
  });

  it('HIGH fix pin: two independent additive sentences in the same paragraph both apply (neither is dropped)', () => {
    const def = cardDef(
      'r-cr604-multisentence-b',
      'Creature — Elemental',
      'This creature is a Wall in addition to its other types. This creature is a Zombie in addition to its other types.',
    );
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604-multisentence-b');
    state = move(state, id, 'battlefield');
    const typeLine = effectiveTypeLine(state, id);
    expect(typeLine).toContain('Wall');
    expect(typeLine).toContain('Zombie');
  });

  it('non-regression: a plain vanilla creature with no static ability is unaffected', () => {
    const def = cardDef('r-cr604-vanilla', 'Creature — Bear');
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'r-cr604-vanilla');
    state = move(state, id, 'battlefield');
    expect(effectiveTypeLine(state, id)).toBe('Creature — Bear');
  });
});
