// Reviewer-owned adversarial tests for cr-115 target candidate legality filters (compiler leaf).
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 115.1 / 115.2: 対象は object/player。permanent 指定は特記なき限り battlefield 上のみ合法。
// - CR 601.2c: 対象は targeting criteria(nonland / you control 等)を満たすものだけ選べる。
// この slice は「単一 battlefield object 対象」の候補フィルタ保存のみを契約化する(値/複数/非戦場は manual)。
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';

function srcDef(): CardDef {
  return {
    scryfallId: 'r-cr115-src',
    oracleId: 'r-cr115-src',
    name: 'r-cr115-src',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Sorcery',
    faces: [{ name: 'r-cr115-src', typeLine: 'Sorcery' }],
  };
}

function compile(line: string) {
  return compileAbilityIR(parseAbilityIR(line, 'Sorcery'), { sourceId: 'source-1', def: srcDef() });
}

describe('cr-115 target filter compiler leaf (CR 115 / 601.2c)', () => {
  it('nonland → excludedTypes:[land]・nontoken → excludeTokens', () => {
    const r = compile('Exile target nonland, nontoken permanent.');
    expect(r.decision).toBe('guided');
    expect(r.prompts[0]).toMatchObject({
      atom: 'effect.exile',
      kind: 'target',
      filter: { types: ['permanent'], excludedTypes: ['land'], excludeTokens: true },
    });
  });

  it('noncreature artifact → positive:[artifact] / excluded:[creature](creature を正型に足さない)', () => {
    const r = compile('Exile target noncreature artifact.');
    expect(r.decision).toBe('guided');
    expect(r.prompts[0]).toMatchObject({
      atom: 'effect.exile',
      kind: 'target',
      filter: { types: ['artifact'], excludedTypes: ['creature'] },
    });
    // creature は正の型フィルタに混入してはならない(混入すると land 以外全 permanent が候補化する退行)。
    const filter = r.prompts[0].filter as { types: string[] };
    expect(filter.types).not.toContain('creature');
  });

  it('another target you control → controller:you + excludeSource', () => {
    const r = compile('Untap another target permanent you control.');
    expect(r.decision).toBe('guided');
    expect(r.prompts[0]).toMatchObject({
      atom: 'effect.untap',
      kind: 'target',
      filter: { types: ['permanent'], controller: 'you', excludeSource: true },
    });
  });

  it("you don't control / an opponent controls → controller:opponent", () => {
    const notYours = compile("Destroy target artifact you don't control.");
    expect(notYours.decision).toBe('guided');
    expect(notYours.prompts[0]).toMatchObject({
      filter: { types: ['artifact'], controller: 'opponent' },
    });

    const oppControls = compile('Destroy target creature or enchantment an opponent controls.');
    expect(oppControls.decision).toBe('guided');
    expect(oppControls.prompts[0]).toMatchObject({
      filter: { types: ['creature', 'enchantment'], controller: 'opponent' },
    });
  });
});
