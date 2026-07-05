// Reviewer-owned adversarial tests for cr-400-408 linked-exile / LKI substrate (compiler leaf).
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding (docs/engine-spec.md §34.21 design-lock):
// - CR 400.7/400.7j: zone move = new object; the same resolving effect can find the object it
//   moved to a public zone (grounds same-resolution exile-then-return).
// - CR 607.2a: `exiled with [this object]` is a linked ability referring only to cards exiled by
//   that specific instruction — a plain simple-target exile must NOT create a link record.
// - CR 603.10a/608.2h: delayed/look-back triggers use LKI; a printed delay ("at the beginning of
//   the next end step/turn/upkeep") requires a scheduling primitive this engine does not have
//   (judgment point B, resolved 2026-07-05) — such text MUST stay manual, not be silently
//   collapsed into an immediate same-resolution return.
// scope: single-card same-resolution temporary-return (Thassa-style) is guided; delayed return,
// multi-card, non-battlefield destinations, and Skyclave-style exiled-with-source oracle-text
// recognition are honest manual/out-of-scope this slice.
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';

function srcDef(typeLine = 'Sorcery'): CardDef {
  return {
    scryfallId: 'r-cr400-src',
    oracleId: 'r-cr400-src',
    name: 'r-cr400-src',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine,
    faces: [{ name: 'r-cr400-src', typeLine }],
  };
}

function compile(line: string, typeLine = 'Sorcery') {
  return compileAbilityIR(parseAbilityIR(line, typeLine), {
    sourceId: 'source-1',
    def: srcDef(typeLine),
  });
}

describe('cr-400-408 linked-exile compiler leaf (CR 400.7/400.7j/607.2a)', () => {
  it("Thassa-style same-resolution temporary-return: guided with linkedExile purpose", () => {
    const r = compile(
      "At the beginning of your end step, exile up to one target creature you control, then return that card to the battlefield under its owner's control.",
      'Legendary Enchantment Creature',
    );
    expect(r.decision).toBe('guided');
    expect(r.prompts[0]).toMatchObject({
      atom: 'effect.exile',
      kind: 'target',
      minCount: 0,
      filter: { types: ['creature'], controller: 'you' },
      linkedExile: { purpose: 'temporary-return' },
    });
  });

  it('Path to Exile style simple exile: guided but NO linkedExile purpose (no record)', () => {
    const r = compile('Exile target creature.', 'Instant');
    expect(r.decision).toBe('guided');
    expect(r.prompts[0]).toMatchObject({ atom: 'effect.exile', kind: 'target' });
    expect((r.prompts[0] as { linkedExile?: unknown }).linkedExile).toBeUndefined();
  });

  describe('honest manual boundary (auto/guided を騙らない)', () => {
    it('delayed return ("at the beginning of the next end step") must NOT be treated as same-resolution', () => {
      // Regression pin for Tier-1 BLOCKER (2026-07-05): the compiler previously matched this
      // as same-resolution temporary-return via an un-anchored regex, silently discarding the
      // printed delay. Fixed in compile.ts isSameResolutionBattlefieldReturn ($ anchor added).
      const r = compile(
        "Exile target creature. Return that card to the battlefield under its owner's control at the beginning of the next end step.",
      );
      expect(r.decision).toBe('manual');
    });

    it('delayed return ("at the beginning of the next turn") also stays manual', () => {
      const r = compile(
        'Exile target creature, then return that card to the battlefield at the beginning of the next turn.',
      );
      expect(r.decision).toBe('manual');
    });

    it('multi-card temporary-return stays manual', () => {
      const r = compile(
        'Exile up to two target creatures, then return those cards to the battlefield under their owner\'s control.',
      );
      expect(r.decision).toBe('manual');
    });

    it('non-battlefield return destination stays manual', () => {
      const r = compile("Exile target creature, then return that card to its owner's hand.");
      expect(r.decision).toBe('manual');
    });
  });
});
