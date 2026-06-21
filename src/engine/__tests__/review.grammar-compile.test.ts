// Reviewer-owned adversarial tests for engine-spec §31 (Phase G2: コンパイラ中核).
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// 対象は純関数 `compileAbilityIR`(`src/engine/grammar/compile.ts`)。GameState 非依存・決定的。
// 入力は §30 の `parseAbilityIR` が返す AbilityIR。期待値は engine-spec §31.1〜§31.7 の契約と
// §31.6 の snapshot 裏取りに準拠する。
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { parseAbilityIR } from '../grammar/ir';
import { compileAbilityIR } from '../grammar/compile';

function ctx(): { sourceId: string; def: CardDef } {
  const def: CardDef = {
    scryfallId: 'src-1',
    oracleId: 'src-1',
    name: 'src-1',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Creature',
    faces: [{ name: 'src-1', typeLine: 'Creature' }],
  };
  return { sourceId: 'c1', def };
}

function compile(line: string, typeLine = 'Sorcery') {
  return compileAbilityIR(parseAbilityIR(line, typeLine), ctx());
}

describe('§31.2 compileAbilityIR: auto(対象/選択不要・count 確定)', () => {
  it('「Draw two cards.」→ auto / draw count 2 / reasons 空', () => {
    const r = compile('Draw two cards.');
    expect(r.decision).toBe('auto');
    expect(r.commands).toEqual([{ type: 'draw', count: 2 }]);
    expect(r.reasons).toEqual([]);
    expect(r.risk).toBe('low');
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('「Draw a card.」→ auto / draw count 1', () => {
    const r = compile('Draw a card.');
    expect(r.decision).toBe('auto');
    expect(r.commands).toEqual([{ type: 'draw', count: 1 }]);
  });

  it('「You gain 3 life.」→ auto / adjustLife +3', () => {
    const r = compile('You gain 3 life.');
    expect(r.decision).toBe('auto');
    expect(r.commands).toEqual([{ type: 'adjustLife', delta: 3 }]);
  });

  it('「You lose 2 life.」→ auto / adjustLife -2', () => {
    const r = compile('You lose 2 life.');
    expect(r.decision).toBe('auto');
    expect(r.commands).toEqual([{ type: 'adjustLife', delta: -2 }]);
  });

  it('「Mill three cards.」→ auto / mill count 3', () => {
    const r = compile('Mill three cards.');
    expect(r.decision).toBe('auto');
    expect(r.commands).toEqual([{ type: 'mill', count: 3 }]);
  });

  it('「Create a Treasure token.」→ auto / createToken treasure', () => {
    const r = compile('Create a Treasure token.');
    expect(r.decision).toBe('auto');
    expect(r.commands).toHaveLength(1);
    expect(r.commands[0]).toMatchObject({ type: 'createToken', tokenKind: 'treasure', quantity: 1 });
  });
});

describe('§31.2 compileAbilityIR: manual(壁・選択・対象・可変)', () => {
  it('「Scry 2.」→ manual(needs-choice)。IR は full でもゲートで弾く', () => {
    expect(parseAbilityIR('Scry 2.', 'Sorcery').status).toBe('full');
    const r = compile('Scry 2.');
    expect(r.decision).toBe('manual');
    expect(r.reasons).toContain('needs-choice');
  });

  it('「Destroy target creature.」→ manual(needs-target)', () => {
    const r = compile('Destroy target creature.', 'Instant');
    expect(r.decision).toBe('manual');
    expect(r.reasons).toContain('needs-target');
  });

  it('「Draw X cards.」→ manual(variable-count)', () => {
    const r = compile('Draw X cards.');
    expect(r.decision).toBe('manual');
    expect(r.reasons).toContain('variable-count');
  });

  it('「You may draw a card.」→ manual(optional)', () => {
    const r = compile('You may draw a card.');
    expect(r.decision).toBe('manual');
    expect(r.reasons).toContain('optional');
  });

  it('keyword 行(効果なし)→ manual / no-effect', () => {
    const r = compile('Flying', 'Creature — Bird');
    expect(r.decision).toBe('manual');
    expect(r.reasons).toContain('no-effect');
  });
});

describe('§31.2 複数クローズ: 全 auto のみ auto', () => {
  it('「Draw a card. You gain 1 life.」→ auto / 2 コマンド連結', () => {
    const r = compile('Draw a card. You gain 1 life.');
    expect(r.decision).toBe('auto');
    expect(r.commands).toEqual([
      { type: 'draw', count: 1 },
      { type: 'adjustLife', delta: 1 },
    ]);
  });

  it('1クローズでも manual を含めば全体 manual', () => {
    const r = compile('Draw a card. Destroy target creature.', 'Instant');
    expect(r.decision).toBe('manual');
    expect(r.reasons).toContain('needs-target');
  });
});

describe('§31.2 reasons は昇順・重複なし', () => {
  it('reasons がソート済みで重複しない', () => {
    const r = compile('You may draw X cards.');
    expect(r.decision).toBe('manual');
    expect([...r.reasons].sort()).toEqual(r.reasons);
    expect(new Set(r.reasons).size).toBe(r.reasons.length);
  });
});

describe('§31.7 純粋性(同入力同出力・入力非破壊)', () => {
  it('同じ IR を2回コンパイルしても同一結果', () => {
    const ir = parseAbilityIR('Draw two cards.', 'Sorcery');
    const frozen = JSON.stringify(ir);
    const a = compileAbilityIR(ir, ctx());
    const b = compileAbilityIR(ir, ctx());
    expect(a).toEqual(b);
    // 入力 IR を変更しない
    expect(JSON.stringify(ir)).toBe(frozen);
  });
});
