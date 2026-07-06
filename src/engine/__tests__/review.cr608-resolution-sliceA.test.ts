// Reviewer-owned adversarial tests for cr-608-resolution Slice A (batch3-2a):
// stack-target filtering + pure "counter target spell" leaf. 実装エージェント
// (Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 608.2b: 解決時に対象を再チェック。対象が期待ゾーンを離れていれば非合法。
// - CR 701.6a: counter=stackからcancel・除去。解決しない。countered spellはowner's
//   graveyardへ。
// - CR 701.6b: counterされたコストの払戻はない。
// 契約の要石 = 厳密な5パターンのみguided(修飾語・follow-up節付きはhonest manual)。
// 既存removeStackItemをそのまま再利用(新規GameCommand追加なし)。counter spell
// 自身・stack上のability(activated/triggered)は自分の候補から除外される。
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommands } from '../batch';
import { applyCommand, eligibleTargets, guidedPlanForStackTop } from '../commands';
import { buildGuidedCommands, compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';
import { initGame } from '../init';
import type { GameState, ZoneId } from '../types';
import { makeDef } from './helpers';

function spellDef(id: string, typeLine: string, oracleText?: string): CardDef {
  return makeDef({ scryfallId: id, name: id, typeLine, faces: [{ name: id, typeLine, ...(oracleText ? { oracleText } : {}) }] });
}

function move(state: GameState, cardId: string, to: ZoneId): GameState {
  return applyCommand(state, { type: 'moveCard', cardId, to, position: 'bottom' }).state;
}

function idOf(state: GameState, defId: string): string {
  return Object.values(state.cards).find((card) => card.defId === defId)?.id ?? '';
}

function compile(line: string) {
  const source = spellDef('r-cr608-compile-source', 'Instant', line);
  return compileAbilityIR(parseAbilityIR(line, 'Instant'), { sourceId: 'source-1', def: source });
}

describe('cr-608-resolution Slice A: stack target filtering + counter-spell (CR 608.2b/701.6a/701.6b)', () => {
  it('exact-phrase gate: rejects Flusterstorm-style "unless" rider and an unapproved type combo', () => {
    expect(compile('Counter target spell unless its controller pays {1}.')).not.toMatchObject({ decision: 'guided' });
    expect(compile('Counter target creature or planeswalker spell.')).not.toMatchObject({ decision: 'guided' });
    expect(compile('Counter target spell. If that spell is countered this way, exile it instead.')).not.toMatchObject({
      decision: 'guided',
    });
  });

  it('exact-phrase gate: the 5 approved phrasings compile to guided with the correct stack filter', () => {
    expect(compile('Counter target spell.')).toMatchObject({
      decision: 'guided',
      prompts: [{ atom: 'effect.counter-spell', filter: { zone: 'stack' } }],
    });
    expect(compile('Counter target noncreature spell.')).toMatchObject({
      prompts: [{ filter: { zone: 'stack', excludedTypes: ['creature'] } }],
    });
    expect(compile('Counter target creature spell.')).toMatchObject({
      prompts: [{ filter: { zone: 'stack', types: ['creature'] } }],
    });
  });

  it('a lone counter-spell cannot appear in its own candidate list (self-exclusion)', () => {
    const pact = spellDef('r-cr608-self-pact', 'Instant', 'Counter target spell.');
    let state = initGame([{ def: pact, isCommander: false }], 1);
    const pactId = idOf(state, 'r-cr608-self-pact');
    state = move(state, pactId, 'stack');

    const filter = { zone: 'stack' as const };
    expect(eligibleTargets(state, filter, { sourceId: pactId })).toEqual([]);
  });

  it('activated/triggered abilities on the stack are excluded from counter-spell candidates', () => {
    const pact = spellDef('r-cr608-ability-pact', 'Instant', 'Counter target spell.');
    const abilitySource = spellDef('r-cr608-ability-src', 'Creature — Wizard');
    let state = initGame([{ def: pact, isCommander: false }, { def: abilitySource, isCommander: false }], 1);
    const pactId = idOf(state, 'r-cr608-ability-pact');
    const sourceId = idOf(state, 'r-cr608-ability-src');
    state = move(state, sourceId, 'battlefield');
    state = applyCommand(state, { type: 'addAbilityToStack', sourceId, kind: 'activated' }).state;
    const abilityId = state.zones.stack[0];
    state = move(state, pactId, 'stack');

    const candidates = eligibleTargets(state, { zone: 'stack' }, { sourceId: pactId });
    expect(candidates).not.toContain(abilityId);
    expect(candidates).not.toContain(pactId);
    expect(candidates).toEqual([]);
  });

  it('type filter reads the stack spell type, not battlefield objects: creature vs noncreature spells', () => {
    const source = spellDef('r-cr608-type-source', 'Instant', 'Counter target creature spell.');
    const creatureSpell = spellDef('r-cr608-type-creature', 'Creature — Bear');
    const sorcerySpell = spellDef('r-cr608-type-sorcery', 'Sorcery', 'Draw two cards.');
    let state = initGame(
      [{ def: source, isCommander: false }, { def: creatureSpell, isCommander: false }, { def: sorcerySpell, isCommander: false }],
      1,
    );
    const sourceId = idOf(state, 'r-cr608-type-source');
    const creatureId = idOf(state, 'r-cr608-type-creature');
    const sorceryId = idOf(state, 'r-cr608-type-sorcery');
    state = move(state, creatureId, 'stack');
    state = move(state, sorceryId, 'stack');
    state = move(state, sourceId, 'stack');

    const candidates = eligibleTargets(state, { zone: 'stack', types: ['creature'] }, { sourceId });
    expect(candidates).toEqual([creatureId]);
  });

  it('countering resolves via existing removeStackItem: no cost refund, target moves to graveyard without resolving', () => {
    const pact = spellDef('r-cr608-resolve-pact', 'Instant', 'Counter target spell.');
    const target = spellDef('r-cr608-resolve-target', 'Instant', 'Draw two cards.');
    let state = initGame([{ def: pact, isCommander: false }, { def: target, isCommander: false }], 1);
    const pactId = idOf(state, 'r-cr608-resolve-pact');
    const targetId = idOf(state, 'r-cr608-resolve-target');
    state = move(state, targetId, 'stack');
    state = move(state, pactId, 'stack');

    const beforeHand = state.zones.hand.length;
    const plan = guidedPlanForStackTop(state);
    const commands = buildGuidedCommands(plan!.prompts[0], { kind: 'target', cardIds: [targetId] }, { sourceId: pactId, def: pact });
    expect(commands).toEqual([{ type: 'removeStackItem', id: targetId }]);

    const resolved = applyCommands(state, [...commands, { type: 'resolveStackTop' }]).state;
    expect(resolved.cards[targetId].zone).toBe('graveyard');
    expect(resolved.zones.stack).not.toContain(targetId);
    // No draw effect occurred: the countered spell never resolved (CR 701.6a).
    expect(resolved.zones.hand).toHaveLength(beforeHand);
  });
});
