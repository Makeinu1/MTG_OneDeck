// Reviewer-owned adversarial tests for engine-spec §33.1 (Phase G4: 起動型コスト精算).
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// 対象は純関数 `compileAbilityCost`(`src/engine/grammar/compile.ts`)。GameState 非依存・決定的。
// 入力は activated 行の `parseAbilityIR(...).cost`。期待値は engine-spec §33.1/§33.6(裏取り)に準拠。
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import type { GameCommand } from '../commands';
import { parseAbilityIR } from '../grammar/ir';
import { compileAbilityCost } from '../grammar/compile';

function defWithName(name: string): CardDef {
  return {
    scryfallId: name,
    oracleId: name,
    name,
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Creature',
    faces: [{ name, typeLine: 'Creature' }],
  };
}

function ctx(name = 'src-card') {
  return { sourceId: 'c1', def: defWithName(name) };
}

// activated 行をパースして cost コンパイル結果を返す。shape が activated であることを sanity check。
function compileCost(line: string, typeLine = 'Creature', name = 'src-card') {
  const ir = parseAbilityIR(line, typeLine);
  expect(ir.shape).toBe('activated');
  return compileAbilityCost(ir.cost, ctx(name));
}

const tapSelf: GameCommand = { type: 'setTapped', cardId: 'c1', tapped: true };
const sacSelf: GameCommand = { type: 'moveCard', cardId: 'c1', to: 'graveyard', position: 'top' };

// すべての commands が自己言及の既知コスト型(setTapped/moveCard→graveyard)であること(新コマンド型なし)。
function assertKnownCostCommands(commands: GameCommand[]): void {
  for (const cmd of commands) {
    const ok =
      (cmd.type === 'setTapped' && cmd.cardId === 'c1') ||
      (cmd.type === 'moveCard' && cmd.cardId === 'c1' && cmd.to === 'graveyard');
    expect(ok, `unexpected cost command: ${JSON.stringify(cmd)}`).toBe(true);
  }
}

describe('§33.1 auto: tap-self のみ', () => {
  it('「{T}: Add {G}.」→ auto / setTapped self / manaCost null', () => {
    const r = compileCost('{T}: Add {G}.');
    expect(r.decision).toBe('auto');
    expect(r.commands).toEqual([tapSelf]);
    expect(r.manaCost).toBeNull();
    expect(r.reasons).toEqual([]);
  });
});

describe('§33.1 auto: マナ + tap', () => {
  it('「{2}{R}, {T}: Draw a card.」→ auto / setTapped / manaCost {2}{R}', () => {
    const r = compileCost('{2}{R}, {T}: Draw a card.');
    expect(r.decision).toBe('auto');
    expect(r.commands).toEqual([tapSelf]);
    expect(r.manaCost).toBe('{2}{R}');
    assertKnownCostCommands(r.commands);
  });

  it('「{1}{U}: Scry 1.」→ tap なし / manaCost のみ', () => {
    const r = compileCost('{1}{U}: Scry 1.');
    expect(r.decision).toBe('auto');
    expect(r.commands).toEqual([]);
    expect(r.manaCost).toBe('{1}{U}');
  });
});

describe('§33.1 auto: 自己生け贄(裏取り = 複合コストの取りこぼし対策)', () => {
  it('「Sacrifice this creature: Draw a card.」→ auto / moveCard self / manaCost null', () => {
    const r = compileCost('Sacrifice this creature: Draw a card.');
    expect(r.decision).toBe('auto');
    expect(r.commands).toEqual([sacSelf]);
    expect(r.manaCost).toBeNull();
  });

  it('「{1}, {T}, Sacrifice this artifact: Add {C}{C}.」→ tap+sac+mana(tap が先)', () => {
    const r = compileCost('{1}, {T}, Sacrifice this artifact: Add {C}{C}.', 'Artifact');
    expect(r.decision).toBe('auto');
    expect(r.commands).toEqual([tapSelf, sacSelf]);
    expect(r.manaCost).toBe('{1}');
    assertKnownCostCommands(r.commands);
  });

  it('「{1}{U}, Sacrifice Adric: Draw a card.」→ カード名一致で sac-self 検出', () => {
    const r = compileCost('{1}{U}, Sacrifice Adric: Draw a card.', 'Creature', 'Adric');
    expect(r.decision).toBe('auto');
    expect(r.commands).toEqual([sacSelf]);
    expect(r.manaCost).toBe('{1}{U}');
  });
});

describe('§33.1 manual: 未モデルコスト据え置き(honest)', () => {
  it('「{X}, {T}: Deal X damage.」→ manual / variable-x', () => {
    const r = compileCost('{X}, {T}: Deal X damage to any target.');
    expect(r.decision).toBe('manual');
    expect(r.commands).toEqual([]);
    expect(r.reasons).toContain('variable-x');
  });

  it('「{T}, Pay 3 life: Draw a card.」→ manual(ライフ支払いは未対応)', () => {
    const r = compileCost('{T}, Pay 3 life: Draw a card.');
    expect(r.decision).toBe('manual');
    expect(r.commands).toEqual([]);
  });

  it('「{T}, Sacrifice another creature: Draw a card.」→ manual(他パーマネント生け贄)', () => {
    const r = compileCost('{T}, Sacrifice another creature: Draw a card.');
    expect(r.decision).toBe('manual');
    expect(r.commands).toEqual([]);
  });

  it('「{1}, Discard a card: Scry 1.」→ manual(カード捨て)', () => {
    const r = compileCost('{1}, Discard a card: Scry 1.');
    expect(r.decision).toBe('manual');
  });

  it('「Coven — {1}{W}, {T}: Draw a card.」→ manual(能力語ラベル据え置き)', () => {
    const r = compileCost('Coven — {1}{W}, {T}: Draw a card.');
    expect(r.decision).toBe('manual');
  });
});

describe('§33.1 防御的: cost なし', () => {
  it('cost===null → auto / 空', () => {
    const r = compileAbilityCost(null, ctx());
    expect(r.decision).toBe('auto');
    expect(r.commands).toEqual([]);
    expect(r.manaCost).toBeNull();
    expect(r.reasons).toEqual([]);
  });
});

describe('§33.1 純粋性・決定性', () => {
  it('同入力→同出力(決定的)', () => {
    const a = compileCost('{1}, {T}, Sacrifice this artifact: Add {C}{C}.', 'Artifact');
    const b = compileCost('{1}, {T}, Sacrifice this artifact: Add {C}{C}.', 'Artifact');
    expect(a).toEqual(b);
  });

  it('reasons は昇順・重複なし', () => {
    const r = compileCost('{X}, {T}, Pay 2 life: Draw a card.');
    const sorted = [...r.reasons].sort((x, y) => x.localeCompare(y));
    expect(r.reasons).toEqual(sorted);
    expect(new Set(r.reasons).size).toBe(r.reasons.length);
  });
});
