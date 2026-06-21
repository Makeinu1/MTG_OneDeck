// Reviewer-owned adversarial tests for engine-spec §30 (Phase G1: 能力IR型 + targetless パーサ).
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// 対象は計測/表現専用の純関数 `parseAbilityIR`(`src/engine/grammar/ir.ts`)と
// CR ground-truth(`src/engine/grammar/rule-refs.ts`)。GameState 非依存・決定的。
// 期待値は engine-spec §30.1〜§30.7 の契約と §30.6 の snapshot 裏取りに準拠する。
import { describe, expect, it } from 'vitest';

import { EFFECT_ATOM_DEFINITIONS } from '../grammar';
import { parseAbilityIR } from '../grammar/ir';
import { CR_KEYWORD_ACTIONS, isValidRuleRef } from '../grammar/rule-refs';

describe('§30.2 parseAbilityIR: status = full(対象/モード不要で完結)', () => {
  it('「Draw two cards.」→ full / effect.draw / count fixed(2) / optional false', () => {
    const ir = parseAbilityIR('Draw two cards.', 'Sorcery');
    expect(ir.shape).toBe('spell');
    expect(ir.status).toBe('full');
    expect(ir.cost).toBeNull();
    expect(ir.trigger).toBeNull();
    expect(ir.effects).toHaveLength(1);
    expect(ir.effects[0]?.atom).toBe('effect.draw');
    expect(ir.effects[0]?.count).toEqual({ kind: 'fixed', value: 2 });
    expect(ir.effects[0]?.optional).toBe(false);
    expect(ir.blockers).toEqual([]);
  });

  it('「Draw a card.」→ count one', () => {
    const ir = parseAbilityIR('Draw a card.', 'Sorcery');
    expect(ir.status).toBe('full');
    expect(ir.effects[0]?.count).toEqual({ kind: 'one' });
  });

  it('「Mill X cards.」→ count variable-x(full)', () => {
    const ir = parseAbilityIR('Mill X cards.', 'Sorcery');
    expect(ir.status).toBe('full');
    expect(ir.effects[0]?.atom).toBe('effect.mill');
    expect(ir.effects[0]?.count).toEqual({ kind: 'variable-x' });
  });
});

describe('§30.2 parseAbilityIR: status = partial(壁あり)', () => {
  it('「Destroy target creature.」→ partial / blocker construct.target', () => {
    const ir = parseAbilityIR('Destroy target creature.', 'Instant');
    expect(ir.status).toBe('partial');
    expect(ir.effects.map((e) => e.atom)).toContain('effect.destroy');
    expect(ir.constructs).toContain('construct.target');
    expect(ir.blockers).toContain('construct.target');
  });

  it('「Choose one — ...」→ partial / blocker construct.choose-modal', () => {
    const ir = parseAbilityIR('Choose one — Draw a card; or You gain 3 life.', 'Instant');
    expect(ir.status).toBe('partial');
    expect(ir.blockers).toContain('construct.choose-modal');
  });
});

describe('§30.2 parseAbilityIR: status = none / keyword', () => {
  it('「Flying」→ none / 効果なし / blocker no-atom', () => {
    const ir = parseAbilityIR('Flying', 'Creature — Bird');
    expect(ir.status).toBe('none');
    expect(ir.effects).toEqual([]);
    expect(ir.blockers).toContain('no-atom');
  });
});

describe('§30.2 起動コストの分解(activated)', () => {
  it('「{2}{U}, {T}: Draw a card.」→ activated / mana {2}{U} / tap true / 効果側 full', () => {
    const ir = parseAbilityIR('{2}{U}, {T}: Draw a card.', 'Artifact');
    expect(ir.shape).toBe('activated');
    expect(ir.cost).not.toBeNull();
    expect(ir.cost?.mana).toBe('{2}{U}');
    expect(ir.cost?.tap).toBe(true);
    expect(ir.cost?.sacrificesSelf).toBe(false);
    expect(ir.effects.map((e) => e.atom)).toContain('effect.draw');
    expect(ir.status).toBe('full');
  });

  it('コスト {T} を効果アトム effect.tap として二重計上しない', () => {
    const ir = parseAbilityIR('{T}: Add {G}.', 'Land');
    expect(ir.shape).toBe('activated');
    expect(ir.effects.map((e) => e.atom)).not.toContain('effect.tap');
    expect(ir.effects.map((e) => e.atom)).toContain('effect.add-mana');
  });
});

describe('§30.2 誘発条件の分解(triggered / delayed)', () => {
  it('「When this creature enters, draw a card.」→ triggered / 条件はカンマ前 / 効果は draw', () => {
    const ir = parseAbilityIR('When this creature enters, draw a card.', 'Creature — Bird');
    expect(ir.shape).toBe('triggered');
    expect(ir.trigger).not.toBeNull();
    expect(ir.trigger?.word).toBe('when');
    expect(ir.trigger?.raw).toContain('this creature enters');
    // 条件文に効果(draw)を巻き込まない
    expect(ir.trigger?.raw.toLowerCase()).not.toContain('draw');
    expect(ir.effects.map((e) => e.atom)).toContain('effect.draw');
    expect(ir.status).toBe('full');
  });

  it('「At the beginning of the next end step, sacrifice it.」→ delayed-triggered', () => {
    const ir = parseAbilityIR(
      'At the beginning of the next end step, sacrifice it.',
      'Instant',
    );
    expect(ir.shape).toBe('delayed-triggered');
    expect(ir.trigger?.word).toBe('at');
  });
});

describe('§30.2 optional(you may)', () => {
  it('「You may draw a card.」→ effect.draw / optional true', () => {
    const ir = parseAbilityIR('You may draw a card.', 'Sorcery');
    const draw = ir.effects.find((e) => e.atom === 'effect.draw');
    expect(draw).toBeDefined();
    expect(draw?.optional).toBe(true);
  });
});

describe('§30.3/§30.4 ruleRef 錨付けと CR ground-truth', () => {
  it('全 atom の ruleRef が isValidRuleRef を満たす', () => {
    for (const def of EFFECT_ATOM_DEFINITIONS) {
      expect(
        isValidRuleRef((def as { ruleRef: string }).ruleRef),
        `${def.id} の ruleRef=${(def as { ruleRef: string }).ruleRef} が無効`,
      ).toBe(true);
    }
  });

  it('正本マッピング: draw→121 / create-token→701.7', () => {
    const byId = new Map(
      EFFECT_ATOM_DEFINITIONS.map((d) => [d.id, (d as { ruleRef: string }).ruleRef]),
    );
    expect(byId.get('effect.draw')).toBe('121');
    expect(byId.get('effect.create-token')).toBe('701.7');
  });

  it('CR_KEYWORD_ACTIONS は 701.7(Create)/701.21(Sacrifice)を含む', () => {
    const ids = new Set(CR_KEYWORD_ACTIONS.map((a) => a.id));
    expect(ids.has('701.7')).toBe(true);
    expect(ids.has('701.21')).toBe(true);
  });

  it('isValidRuleRef: 既知のみ true / 未知は false', () => {
    expect(isValidRuleRef('701.7')).toBe(true);
    expect(isValidRuleRef('121')).toBe(true);
    expect(isValidRuleRef('standard')).toBe(true);
    expect(isValidRuleRef('701.999')).toBe(false);
    expect(isValidRuleRef('bogus')).toBe(false);
  });

  it('クローズの ruleRef は atom 定義の ruleRef と一致する', () => {
    const ir = parseAbilityIR('Draw a card.', 'Sorcery');
    expect(ir.effects[0]?.ruleRef).toBe('121');
  });
});

describe('§30.7 純粋・決定的(エンジン不変)', () => {
  it('同入力で同出力', () => {
    const line = 'When this creature enters, draw two cards.';
    expect(JSON.stringify(parseAbilityIR(line, 'Creature'))).toBe(
      JSON.stringify(parseAbilityIR(line, 'Creature')),
    );
  });

  it('入力文字列を破壊しない', () => {
    const line = 'Destroy target creature.';
    parseAbilityIR(line, 'Instant');
    expect(line).toBe('Destroy target creature.');
  });

  it('blockers / constructs は重複なし昇順', () => {
    const ir = parseAbilityIR('Each opponent sacrifices a creature of their choice.', 'Sorcery');
    expect(ir.blockers).toEqual([...new Set(ir.blockers)].sort());
    expect(ir.constructs).toEqual([...new Set(ir.constructs)].sort());
  });

  it('未知の崩れた入力でも throw しない', () => {
    expect(() => parseAbilityIR('', 'Creature')).not.toThrow();
    expect(() => parseAbilityIR(':::', 'Creature')).not.toThrow();
  });
});
