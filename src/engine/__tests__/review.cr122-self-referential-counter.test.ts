// Reviewer-owned adversarial tests for cr-122-counters candidate-4
// (self-referential "+1/+1 counter on it" guided/auto leaf).
// 実装エージェント(Codex/Sonnet含む)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 122.1: a counter is placed on an object; "+1/+1" is a specific counter kind.
// - CR 608.2 / pronoun antecedent: "it" resolves to the object the effect most recently
//   referred to. In "Whenever this creature attacks, put a +1/+1 counter on it.", "it" is the
//   ability's source. But in "Target land ... becomes a 0/0 creature ... Put two +1/+1 counters
//   on it." the antecedent of "it" is the PRECEDING targeted land, NOT the source; and in
//   "Create a 1/1 token. Put three +1/+1 counters on it." it is the just-created token.
//
// Gap being closed: `isSingleTargetClause` requires a literal `target`, so a self-referential
// "put a/an <N> +1/+1 counter(s) on it" (no `target`) falls to manual. candidate-4 adds a
// self-reference leaf that emits `addCounters` on `ctx.sourceId` without a target prompt.
//
// 誤自動化≈0 の要石: 浅い「同一クローズに target 語なし → 自己適用」チェックは不十分。
// splitEffectClauses が文/`then` でクローズを割るため、先行文に target 節や object 生成節を
// 持つ "it" を source と誤解釈し、**サイレントに間違った permanent へ counter を付与**しうる。
// 実カード48件(Aang 型土地アニメ化)+ Additive Evolution 型が該当。これらは manual へ
// fail-closed し、source へ addCounters を出してはならない。
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import type { GameCommand } from '../commands';
import type { CompiledEffect } from '../grammar/compile';
import { compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';
import { makeDef } from './helpers';

const SOURCE_ID = 'source-1';

function cardDef(typeLine: string, oracleText: string): CardDef {
  return makeDef({
    scryfallId: 'r-cr122-selfref-src',
    name: 'r-cr122-selfref-src',
    typeLine,
    faces: [{ name: 'r-cr122-selfref-src', typeLine, oracleText }],
  });
}

function compile(line: string, typeLine = 'Creature — Test'): CompiledEffect {
  return compileAbilityIR(parseAbilityIR(line, typeLine), {
    sourceId: SOURCE_ID,
    def: cardDef(typeLine, line),
  });
}

// Every addCounters command that would land on the ability's own source.
function selfCounterCommands(
  result: CompiledEffect,
): Extract<GameCommand, { type: 'addCounters' }>[] {
  return (result.commands ?? []).filter(
    (c): c is Extract<GameCommand, { type: 'addCounters' }> =>
      c.type === 'addCounters' && c.cardId === SOURCE_ID,
  );
}

describe('cr-122 self-referential +1/+1 counter leaf (CR 122.1 / pronoun antecedent)', () => {
  // ---- Positive: "on it" == the source, deterministic (no player choice) => auto on source ----
  it('triggered self-ref: "Whenever this creature attacks, put a +1/+1 counter on it." → auto +1/+1 on source', () => {
    const result = compile('Whenever this creature attacks, put a +1/+1 counter on it.');
    expect(result.decision).toBe('auto');
    expect(selfCounterCommands(result)).toEqual([
      { type: 'addCounters', cardId: SOURCE_ID, counterType: '+1/+1', delta: 1 },
    ]);
  });

  it('triggered self-ref (combat damage template — Skullbriar/Bloodmad Vampire): one +1/+1 on source', () => {
    const result = compile(
      'Whenever this creature deals combat damage to a player, put a +1/+1 counter on it.',
    );
    expect(result.decision).toBe('auto');
    expect(selfCounterCommands(result)).toEqual([
      { type: 'addCounters', cardId: SOURCE_ID, counterType: '+1/+1', delta: 1 },
    ]);
  });

  it('fixed multi-count self-ref: "put two +1/+1 counters on it." → delta 2 on source', () => {
    const result = compile('Whenever this creature attacks, put two +1/+1 counters on it.');
    expect(result.decision).toBe('auto');
    expect(selfCounterCommands(result)).toEqual([
      { type: 'addCounters', cardId: SOURCE_ID, counterType: '+1/+1', delta: 2 },
    ]);
  });

  // ---- Critical negatives: "it" antecedent is NOT the source => never self-apply ----
  it('HIGH pin — preceding target antecedent (Aang land-animation, 48件型): counter must NOT auto-land on source', () => {
    const result = compile(
      "Target land you control becomes a 0/0 creature that's still a land. Put two +1/+1 counters on it.",
    );
    // "it" = the targeted land, not the source. Must not silently self-apply.
    expect(selfCounterCommands(result)).toEqual([]);
    expect(result.decision).not.toBe('auto');
  });

  it('HIGH pin — preceding created-object antecedent (Additive Evolution 型): counter must NOT auto-land on source', () => {
    const result = compile(
      'Create a 1/1 green Insect creature token. Put three +1/+1 counters on it.',
    );
    // "it" = the created token, not the source.
    expect(selfCounterCommands(result)).toEqual([]);
    expect(result.decision).not.toBe('auto');
  });

  // ---- Critical negatives: INDEFINITE-SUBJECT trigger => "it" binds the trigger's subject,
  //      NOT the source (CR 608.2). Corpus found 11 real false-auto here (Black Panther,
  //      Case of the Pilfered Proof [an Enchantment!], Rite of Passage, Stensia Masquerade …).
  //      The guard must be an allow-list (self only when the subject is "this creature" /
  //      "this <type>" / the card's own name), not a deny-list. ----
  it('HIGH pin — indefinite subject "a creature you control": counter must NOT auto-land on source', () => {
    const result = compile('Whenever a creature you control attacks, put a +1/+1 counter on it.');
    expect(selfCounterCommands(result)).toEqual([]);
    expect(result.decision).not.toBe('auto');
  });

  it('HIGH pin — "another ... you control" subject: not self, no auto self-counter', () => {
    const result = compile(
      'Whenever another creature you control enters, put a +1/+1 counter on it.',
    );
    expect(selfCounterCommands(result)).toEqual([]);
    expect(result.decision).not.toBe('auto');
  });

  it('HIGH pin — typed indefinite subject on a non-creature source (Case-of-the-Pilfered-Proof 型): no self-counter', () => {
    const result = compile(
      'Whenever a Detective you control enters, put a +1/+1 counter on it.',
      'Enchantment',
    );
    expect(selfCounterCommands(result)).toEqual([]);
    expect(result.decision).not.toBe('auto');
  });

  it('positive — own-name trigger subject resolves to source (allow-list must keep these 19 auto)', () => {
    const line = 'Whenever Grizzly Bears attacks, put a +1/+1 counter on it.';
    const result = compileAbilityIR(parseAbilityIR(line, 'Creature — Test'), {
      sourceId: SOURCE_ID,
      def: makeDef({
        scryfallId: SOURCE_ID,
        name: 'Grizzly Bears',
        typeLine: 'Creature — Test',
        faces: [{ name: 'Grizzly Bears', typeLine: 'Creature — Test', oracleText: line }],
      }),
    });
    expect(result.decision).toBe('auto');
    expect(selfCounterCommands(result)).toEqual([
      { type: 'addCounters', cardId: SOURCE_ID, counterType: '+1/+1', delta: 1 },
    ]);
  });

  // ---- Boundary / regression ----
  it('regression: explicit "on target creature" stays guided with a target choice (not self-auto)', () => {
    const result = compile('Put a +1/+1 counter on target creature.', 'Sorcery');
    expect(result.decision).toBe('guided');
    // No auto self-application; the target is chosen by the player.
    expect(selfCounterCommands(result)).toEqual([]);
  });

  it('boundary: variable "for each" self-ref count stays manual (honest, no auto self-counter)', () => {
    const result = compile(
      'Whenever this creature attacks, put a +1/+1 counter on it for each other creature you control.',
    );
    expect(result.decision).not.toBe('auto');
    expect(selfCounterCommands(result)).toEqual([]);
  });

  it('boundary: -1/-1 self-ref is out of the +1/+1 leaf scope → no fabricated +1/+1 on source', () => {
    const result = compile('Whenever this creature attacks, put a -1/-1 counter on it.');
    // Must never place a +1/+1 (wrong sign) on the source; either manual or a correctly-signed
    // command, but never a fabricated +1/+1.
    expect(
      selfCounterCommands(result).some((c) => c.counterType === '+1/+1'),
    ).toBe(false);
  });
});
