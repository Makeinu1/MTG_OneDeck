// Implementer-owned tests for cr-122-counters candidate-4 (self-referential
// "+1/+1 counter on it" leaf). Not a `review.*` file — the reviewer's own adversarial
// suite lives at src/engine/__tests__/review.cr122-self-referential-counter.test.ts and
// must not be touched here; this file exists to document my own probe coverage.
//
// CR grounding: CR 122.1 (a counter is placed on an object; +1/+1 is a specific,
// signed counter kind — CR 122.1a). The gap: compile.ts's `isSingleTargetClause`
// requires a literal `target`, so "put a/an <N> +1/+1 counter(s) on it" (it = the
// ability's own source) fell to manual. The fix adds a narrow, exact-shape
// self-reference leaf that emits `addCounters` on `ctx.sourceId` with decision='auto'
// (no player choice — the referent is fixed by the ability's own grammar).
//
// The critical risk (why most of this file is negative cases): a shallow "no `target`
// word in this clause => self-apply" check is unsound, because `splitEffectClauses`
// (ir.ts) splits an ability's effect span into multiple clauses on ". " / "then", and a
// bare "it" in a later clause can be anaphoric to an object a *preceding* clause
// introduced (a target, a newly created token, a reanimated permanent) rather than to
// the source. Any such antecedent must fail closed to manual.
import { describe, expect, it } from 'vitest';

import { makeDef } from '../../__tests__/helpers';
import type { CardDef } from '../../../types/card';
import type { GameCommand } from '../../commands';
import { compileAbilityIR, type CompiledEffect } from '../compile';
import { parseAbilityIR } from '../ir';

const SOURCE_ID = 'source-1';

function cardDef(typeLine: string, name?: string): CardDef {
  return makeDef({
    scryfallId: 'r-selfref-src',
    typeLine,
    ...(name === undefined ? {} : { name, faces: [{ name, typeLine }] }),
  });
}

function compile(line: string, typeLine = 'Creature — Test', name?: string): CompiledEffect {
  return compileAbilityIR(parseAbilityIR(line, typeLine), {
    sourceId: SOURCE_ID,
    def: cardDef(typeLine, name),
  });
}

function addCountersOnSource(
  result: CompiledEffect,
): Extract<GameCommand, { type: 'addCounters' }>[] {
  return result.commands.filter(
    (c): c is Extract<GameCommand, { type: 'addCounters' }> =>
      c.type === 'addCounters' && c.cardId === SOURCE_ID,
  );
}

describe('self-referential +1/+1 counter leaf (cr-122 candidate-4)', () => {
  describe('positive: exact "put ... on it" self-reference resolves without a target prompt', () => {
    it('single counter, attack trigger', () => {
      const result = compile('Whenever this creature attacks, put a +1/+1 counter on it.');
      expect(result.decision).toBe('auto');
      expect(result.prompts).toEqual([]);
      expect(addCountersOnSource(result)).toEqual([
        { type: 'addCounters', cardId: SOURCE_ID, counterType: '+1/+1', delta: 1 },
      ]);
    });

    it('single counter, combat-damage trigger (Skullbriar/Bloodmad Vampire template)', () => {
      const result = compile(
        'Whenever this creature deals combat damage to a player, put a +1/+1 counter on it.',
      );
      expect(result.decision).toBe('auto');
      expect(addCountersOnSource(result)).toEqual([
        { type: 'addCounters', cardId: SOURCE_ID, counterType: '+1/+1', delta: 1 },
      ]);
    });

    it('fixed multi-count ("two")', () => {
      const result = compile('Whenever this creature attacks, put two +1/+1 counters on it.');
      expect(result.decision).toBe('auto');
      expect(addCountersOnSource(result)).toEqual([
        { type: 'addCounters', cardId: SOURCE_ID, counterType: '+1/+1', delta: 2 },
      ]);
    });

    it('fixed multi-count (digit "3")', () => {
      const result = compile('Whenever this creature attacks, put 3 +1/+1 counters on it.');
      expect(result.decision).toBe('auto');
      expect(addCountersOnSource(result)).toEqual([
        { type: 'addCounters', cardId: SOURCE_ID, counterType: '+1/+1', delta: 3 },
      ]);
    });

    it('emits only the existing addCounters GameCommand shape (no new command/state type)', () => {
      const result = compile('Whenever this creature attacks, put a +1/+1 counter on it.');
      const [command] = addCountersOnSource(result);
      expect(Object.keys(command).sort()).toEqual(['cardId', 'counterType', 'delta', 'type']);
    });

    it('card-name subject at trigger head (Skullbriar/Alesha) is the source → auto', () => {
      const result = compile(
        'Whenever Skullbriar deals combat damage to a player, put a +1/+1 counter on it.',
        'Legendary Creature — Zombie Elemental',
        'Skullbriar, the Walking Grave',
      );
      expect(result.decision).toBe('auto');
      expect(addCountersOnSource(result)).toEqual([
        { type: 'addCounters', cardId: SOURCE_ID, counterType: '+1/+1', delta: 1 },
      ]);
    });

    it('"This Vehicle becomes ..." after an activated/keyword cost prefix is the source → auto', () => {
      const result = compile(
        'Exhaust — {3}: This Vehicle becomes an artifact creature. Put a +1/+1 counter on it.',
        'Artifact — Vehicle',
        'Rocketeer Boostbuggy',
      );
      expect(result.decision).toBe('auto');
      expect(addCountersOnSource(result)).toEqual([
        { type: 'addCounters', cardId: SOURCE_ID, counterType: '+1/+1', delta: 1 },
      ]);
    });
  });

  // CR 608.2: "it" binds to the trigger/clause subject. When that subject is an indefinite
  // noun phrase ("a/an/another <X> you control", "a permanent", "a Detective"), "it" is that
  // OTHER permanent, not the ability's source — a shallow "no competing keyword in the deny
  // list" check would fail open and silently buff the source. These are the 11 corpus
  // false-autos the allow-list closes; they must all be manual with zero self-counter.
  describe('negative: indefinite trigger subject binds "it" elsewhere — must NOT self-apply', () => {
    it('"a creature you control attacks" (Black Panther) → manual', () => {
      const result = compile(
        'Whenever a creature you control attacks, put a +1/+1 counter on it.',
        'Legendary Creature — Human Warrior Hero',
        'Black Panther, Claws of Bast',
      );
      expect(addCountersOnSource(result)).toEqual([]);
      expect(result.decision).not.toBe('auto');
    });

    it('"another creature you control" → manual', () => {
      const result = compile(
        'Whenever another creature you control attacks, put a +1/+1 counter on it.',
      );
      expect(addCountersOnSource(result)).toEqual([]);
      expect(result.decision).not.toBe('auto');
    });

    it('non-creature source: "a Detective you control enters" on an Enchantment (Case of the Pilfered Proof) → manual', () => {
      const result = compile(
        'Whenever a Detective you control enters, put a +1/+1 counter on it.',
        'Enchantment — Case',
        'Case of the Pilfered Proof',
      );
      expect(addCountersOnSource(result)).toEqual([]);
      expect(result.decision).not.toBe('auto');
    });

    it('non-creature source: "you turn a permanent face up" on an Enchantment (Growing Dread) → manual', () => {
      const result = compile(
        'Whenever you turn a permanent face up, put a +1/+1 counter on it.',
        'Enchantment',
        'Growing Dread',
      );
      expect(addCountersOnSource(result)).toEqual([]);
      expect(result.decision).not.toBe('auto');
    });

    it('"a commander you control attacks" (Keleth) → manual', () => {
      const result = compile(
        'Whenever a commander you control attacks, put a +1/+1 counter on it.',
        'Legendary Creature — Horse',
        'Keleth, Sunmane Familiar',
      );
      expect(addCountersOnSource(result)).toEqual([]);
      expect(result.decision).not.toBe('auto');
    });

    it('no antecedent at all (bare "Put a +1/+1 counter on it." spell) → manual', () => {
      const result = compile('Put a +1/+1 counter on it.', 'Sorcery');
      expect(addCountersOnSource(result)).toEqual([]);
      expect(result.decision).not.toBe('auto');
    });
  });

  describe('negative: fail-closed antecedent guard — preceding clause introduces a different referent', () => {
    it('HIGH: preceding target antecedent (Aang-type land animation) must not self-apply', () => {
      const result = compile(
        "Target land you control becomes a 0/0 creature that's still a land. Put two +1/+1 counters on it.",
      );
      expect(addCountersOnSource(result)).toEqual([]);
      expect(result.decision).not.toBe('auto');
    });

    it('HIGH: preceding token-creation antecedent (Additive Evolution type) must not self-apply', () => {
      const result = compile(
        'Create a 1/1 green Insect creature token. Put three +1/+1 counters on it.',
      );
      expect(addCountersOnSource(result)).toEqual([]);
      expect(result.decision).not.toBe('auto');
    });

    it('preceding "then"-joined creation antecedent must not self-apply', () => {
      const result = compile(
        'Create a 1/1 colorless Servo artifact creature token, then put three +1/+1 counters on it.',
      );
      expect(addCountersOnSource(result)).toEqual([]);
      expect(result.decision).not.toBe('auto');
    });

    it('preceding reanimation ("onto the battlefield") antecedent must not self-apply', () => {
      const result = compile(
        'Return target creature card from your graveyard to the battlefield. Put a +1/+1 counter on it.',
      );
      expect(addCountersOnSource(result)).toEqual([]);
      expect(result.decision).not.toBe('auto');
    });

    it('equipped-relative "it" (trigger condition names equipped creature) must not self-apply', () => {
      const result = compile(
        'Whenever equipped creature attacks, put a +1/+1 counter on it.',
        'Artifact — Equipment',
      );
      expect(addCountersOnSource(result)).toEqual([]);
      expect(result.decision).not.toBe('auto');
    });

    it('enchanted-relative "it" (trigger condition names enchanted creature) must not self-apply', () => {
      const result = compile(
        'Whenever enchanted creature attacks, put a +1/+1 counter on it.',
        'Enchantment — Aura',
      );
      expect(addCountersOnSource(result)).toEqual([]);
      expect(result.decision).not.toBe('auto');
    });
  });

  describe('negative: shape boundaries stay out of leaf scope (honest manual, no fabricated command)', () => {
    it('-1/-1 sign is a distinct counter kind (CR 122.1a) — never fabricate a +1/+1', () => {
      const result = compile('Whenever this creature attacks, put a -1/-1 counter on it.');
      expect(addCountersOnSource(result).some((c) => c.counterType === '+1/+1')).toBe(false);
    });

    it('variable "for each" count stays manual, no auto self-counter', () => {
      const result = compile(
        'Whenever this creature attacks, put a +1/+1 counter on it for each other creature you control.',
      );
      expect(result.decision).not.toBe('auto');
      expect(addCountersOnSource(result)).toEqual([]);
    });

    it('trailing qualifier after "on it" (compound clause) stays manual', () => {
      const result = compile(
        'Whenever this creature attacks, put a +1/+1 counter on it and it gains trample until end of turn.',
      );
      expect(result.decision).not.toBe('auto');
      expect(addCountersOnSource(result)).toEqual([]);
    });
  });

  describe('regression: explicit target clause is unaffected (existing guided-target leaf)', () => {
    it('"put a +1/+1 counter on target creature" stays guided with a target choice', () => {
      const result = compile('Put a +1/+1 counter on target creature.', 'Sorcery');
      expect(result.decision).toBe('guided');
      expect(addCountersOnSource(result)).toEqual([]);
    });
  });
});
