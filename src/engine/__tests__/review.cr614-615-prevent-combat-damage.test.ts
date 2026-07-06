// Reviewer-owned adversarial tests for cr-614-615-616-replacement-prevention Slice A:
// single-turn combat damage prevention shield (design-lock: docs/engine-spec.md §34.34).
// 実装エージェント(Codex含む)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 615.1/615.1a: "prevent"を使う効果はprevention effect。damage eventを部分/完全に防ぐ。
// - CR 615.6: 防がれたdamageは発生しない。eventとしては観測可能であってよい(advisory)。
// 契約の要石=厳密1パターンのみ("Prevent all combat damage that would be dealt this turn."
// の完全一致。Fog/Darkness/Constant Mists/Spore Frogがローカルscryfallスナップショットで
// この文言と一致することを確認済み)。player-scope付き・source/creature限定・count付き・
// 条件付きは全てhonest manual。combat damageのみを防ぎ、noncombat damageは無影響。
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand } from '../commands';
import { compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';
import { initGame } from '../init';
import type { GameState } from '../types';
import { makeDef } from './helpers';

function cardDef(id: string, typeLine: string, oracleText?: string): CardDef {
  return makeDef({ scryfallId: id, name: id, typeLine, faces: [{ name: id, typeLine, ...(oracleText ? { oracleText } : {}) }] });
}

function compile(line: string, typeLine = 'Creature') {
  const source = cardDef('r-cr615-src', typeLine, line);
  return compileAbilityIR(parseAbilityIR(line, typeLine), { sourceId: 'source-1', def: source });
}

function move(state: GameState, cardId: string, to: 'battlefield' | 'hand' | 'graveyard'): GameState {
  return applyCommand(state, { type: 'moveCard', cardId, to, position: 'bottom' }).state;
}

function idOf(state: GameState, defId: string): string {
  return Object.values(state.cards).find((card) => card.defId === defId)?.id ?? '';
}

describe('cr-614-615-616-replacement-prevention Slice A: combat damage prevention shield (CR 615.1/615.1a/615.6)', () => {
  it('golden (Fog/Spore Frog shape): exact phrase compiles to auto', () => {
    const result = compile('Prevent all combat damage that would be dealt this turn.');
    expect(result).toMatchObject({ decision: 'auto', commands: [{ type: 'preventCombatDamageThisTurn' }] });
  });

  it('shield blocks combat damage dealt to a player', () => {
    const source = cardDef('r-cr615-source', 'Creature — Bear');
    let state = initGame([{ def: source, isCommander: false }], 1);
    const id = idOf(state, 'r-cr615-source');
    state = move(state, id, 'battlefield');
    state = applyCommand(state, { type: 'preventCombatDamageThisTurn' }).state;

    const before = state.life;
    state = applyCommand(state, {
      type: 'dealDamage',
      sourceId: id,
      amount: 5,
      combatDamage: true,
      targetPlayerId: 'P1',
    }).state;
    expect(state.life).toBe(before);
  });

  it('shield blocks combat damage dealt to a creature', () => {
    const source = cardDef('r-cr615-source2', 'Creature — Bear');
    const victim = cardDef('r-cr615-victim', 'Creature — Bear');
    let state = initGame([{ def: source, isCommander: false }, { def: victim, isCommander: false }], 1);
    const sourceId = idOf(state, 'r-cr615-source2');
    const victimId = idOf(state, 'r-cr615-victim');
    state = move(state, sourceId, 'battlefield');
    state = move(state, victimId, 'battlefield');
    state = applyCommand(state, { type: 'preventCombatDamageThisTurn' }).state;

    state = applyCommand(state, {
      type: 'dealDamage',
      sourceId,
      amount: 4,
      combatDamage: true,
      targetCardId: victimId,
    }).state;
    expect(state.cards[victimId].damageMarked).toBe(0);
  });

  it('non-regression: noncombat damage is unaffected by the shield', () => {
    const source = cardDef('r-cr615-noncombat-src', 'Creature — Bear');
    let state = initGame([{ def: source, isCommander: false }], 1);
    const id = idOf(state, 'r-cr615-noncombat-src');
    state = move(state, id, 'battlefield');
    state = applyCommand(state, { type: 'preventCombatDamageThisTurn' }).state;

    const before = state.life;
    state = applyCommand(state, {
      type: 'dealDamage',
      sourceId: id,
      amount: 3,
      combatDamage: false,
      targetPlayerId: 'P1',
    }).state;
    expect(state.life).toBe(before - 3);
  });

  it('shield expires at the start of the next turn (does not persist)', () => {
    const source = cardDef('r-cr615-turn-src', 'Creature — Bear');
    let state = initGame([{ def: source, isCommander: false }], 1);
    const id = idOf(state, 'r-cr615-turn-src');
    state = move(state, id, 'battlefield');
    state = applyCommand(state, { type: 'preventCombatDamageThisTurn' }).state;
    expect(state.combatDamagePreventedUntilEndOfTurn).toBe(true);

    state = applyCommand(state, { type: 'nextTurn' }).state;
    expect(state.combatDamagePreventedUntilEndOfTurn).toBe(false);

    const before = state.life;
    state = applyCommand(state, {
      type: 'dealDamage',
      sourceId: id,
      amount: 2,
      combatDamage: true,
      targetPlayerId: 'P1',
    }).state;
    expect(state.life).toBe(before - 2);
  });

  it('false-positive guard: player-scoped variant ("dealt to players this turn") stays manual', () => {
    const result = compile('Prevent all combat damage that would be dealt to players this turn.');
    expect(result.decision).toBe('manual');
    expect(result.commands).toEqual([]);
  });

  it('false-positive guard: creature-scoped variant ("dealt to and dealt by this creature") stays manual', () => {
    const result = compile('Prevent all combat damage that would be dealt to and dealt by this creature this turn.');
    expect(result.decision).toBe('manual');
    expect(result.commands).toEqual([]);
  });

  it('false-positive guard: conditional variant (Batwing Brume shape) stays manual', () => {
    const result = compile('Prevent all combat damage that would be dealt this turn if {W} was spent to cast this spell.');
    expect(result.decision).toBe('manual');
    expect(result.commands).toEqual([]);
  });

  it('false-positive guard: source-limited variant (Arachnogenesis shape) stays manual', () => {
    const result = compile('Prevent all combat damage that would be dealt this turn by non-Spider creatures.');
    expect(result.decision).toBe('manual');
    expect(result.commands).toEqual([]);
  });

  it('non-regression: an unrelated ability containing the word "damage" is unaffected by the effect.damage/effect.prevent collision guard', () => {
    const result = compile('This creature deals 3 damage to any target.');
    // Should not be silently treated as a no-op prevention clause.
    expect(result.decision).not.toBe('auto');
  });
});
