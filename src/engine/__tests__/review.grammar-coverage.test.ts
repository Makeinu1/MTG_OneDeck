// Reviewer-owned adversarial tests for engine-spec §29 (Phase G0: 文法カバレッジ分析).
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// 対象は計測専用の純関数群 `src/engine/grammar/`(GameState 非依存・決定的)。
// 期待値は engine-spec §29.1〜§29.7 の契約と snapshot 裏取りに準拠する。
import { describe, expect, it } from 'vitest';

import {
  classifyAbilityShape,
  detectConstructs,
  detectEffectAtoms,
  splitAbilityLines,
  type AbilityShape,
} from '../grammar';
import { makeDef } from './helpers';

describe('§29.2 classifyAbilityShape: 能力タイプ分類(先勝ち)', () => {
  const cases: ReadonlyArray<[string, string, AbilityShape]> = [
    // keyword 行は最優先
    ['Flying', 'Creature', 'keyword'],
    ['Flying, deathtouch', 'Creature', 'keyword'],
    // 起動型(コロン左辺がコスト様)
    ['{T}: Add {G}.', 'Creature', 'activated'],
    ['{2}{B}, {T}: Draw a card.', 'Artifact', 'activated'],
    ['Sacrifice this creature: Add two mana of any one color.', 'Creature', 'activated'],
    // 誘発型
    ['When this creature enters, draw a card.', 'Creature', 'triggered'],
    ['Whenever you draw a card, you gain 1 life.', 'Creature', 'triggered'],
    ['At the beginning of your upkeep, draw a card.', 'Enchantment', 'triggered'],
    // 遅延誘発(next + 時間語で triggered から降格)
    ['At the beginning of the next end step, sacrifice it.', 'Instant', 'delayed-triggered'],
    // 置換
    ['If a creature would die, exile it instead.', 'Enchantment', 'replacement'],
    ['This creature enters with three +1/+1 counters on it.', 'Creature', 'replacement'],
    // 呪文(Instant/Sorcery 本体)
    ['Draw three cards.', 'Sorcery', 'spell'],
    ['Destroy target creature.', 'Instant', 'spell'],
    // 常在(既定の落とし所)
    ['Creatures you control get +1/+1.', 'Enchantment', 'static'],
  ];

  it.each(cases)('「%s」(%s)→ %s', (line, typeLine, expected) => {
    expect(classifyAbilityShape(line, typeLine)).toBe(expected);
  });

  it('注釈的コロン(コスト様でない左辺)は activated 扱いしない', () => {
    // 左辺がコスト様でないため activated にはならない(static など別 shape へ)。
    expect(classifyAbilityShape('Creatures you control get +1/+1.', 'Enchantment')).not.toBe(
      'activated',
    );
  });
});

describe('§29.3 detectEffectAtoms: 効果アトム検出', () => {
  it('ETB ドローは effect.draw を含む', () => {
    expect(detectEffectAtoms('When this creature enters, draw a card.')).toContain('effect.draw');
  });

  it('トークン生成', () => {
    expect(
      detectEffectAtoms('Create a 1/1 white Soldier creature token.'),
    ).toContain('effect.create-token');
  });

  it('破壊 + 対象', () => {
    const atoms = detectEffectAtoms('Destroy target creature.');
    expect(atoms).toContain('effect.destroy');
  });

  it('マナ生成: add は拾い pay/spend は拾わない', () => {
    expect(detectEffectAtoms('Add {G}.')).toContain('effect.add-mana');
    expect(detectEffectAtoms('Spend this mana only to cast creature spells.')).not.toContain(
      'effect.add-mana',
    );
  });

  it('打ち消しは counter-spell であって counter-plus(+1/+1)ではない', () => {
    const atoms = detectEffectAtoms('Counter target spell.');
    expect(atoms).toContain('effect.counter-spell');
    expect(atoms).not.toContain('effect.counter-plus');
  });

  it('+1/+1 カウンターは counter-plus', () => {
    expect(detectEffectAtoms('Put a +1/+1 counter on target creature.')).toContain(
      'effect.counter-plus',
    );
  });

  it('§29.6 tap: {T} 起動コストは effect.tap に二重計上しない / 効果側 tap は拾う', () => {
    expect(detectEffectAtoms('{T}: Add {G}.')).not.toContain('effect.tap');
    expect(detectEffectAtoms('Tap target creature.')).toContain('effect.tap');
  });

  it('untap は effect.tap を誤検出しない', () => {
    const atoms = detectEffectAtoms('Untap target permanent.');
    expect(atoms).toContain('effect.untap');
    expect(atoms).not.toContain('effect.tap');
  });

  it('戦闘外の damage / gain-life', () => {
    expect(detectEffectAtoms('It deals 3 damage to any target.')).toContain('effect.damage');
    expect(detectEffectAtoms('You gain 3 life.')).toContain('effect.gain-life');
  });

  it('効果が無い純キーワード行はアトムを返さない', () => {
    expect(detectEffectAtoms('Flying')).toEqual([]);
  });

  it('戻り値は重複なし昇順(決定的)', () => {
    const atoms = detectEffectAtoms('Draw a card. Draw a card. You gain 2 life.');
    expect(atoms).toEqual([...new Set(atoms)].sort());
  });
});

describe('§29.4 detectConstructs: 自動化の壁構文', () => {
  it('target', () => {
    expect(detectConstructs('Destroy target creature.')).toContain('construct.target');
  });
  it('may', () => {
    expect(detectConstructs('You may draw a card.')).toContain('construct.may');
  });
  it('choose-modal', () => {
    expect(detectConstructs('Choose one — Draw a card; or gain 3 life.')).toContain(
      'construct.choose-modal',
    );
  });
  it('each-player', () => {
    expect(detectConstructs('Each opponent loses 2 life.')).toContain('construct.each-player');
  });
  it('壁の無い自己完結効果は target/choose-modal を返さない', () => {
    const c = detectConstructs('Draw a card.');
    expect(c).not.toContain('construct.target');
    expect(c).not.toContain('construct.choose-modal');
  });
});

describe('§29.1 splitAbilityLines: 分割と shape 付与', () => {
  it('複数段落を行分割し shape を付ける(Baleful Strix 相当)', () => {
    const def = makeDef({
      scryfallId: 'baleful-strix',
      typeLine: 'Artifact Creature — Bird',
      faces: [
        {
          name: 'Baleful Strix',
          typeLine: 'Artifact Creature — Bird',
          oracleText: 'Flying, deathtouch\nWhen this creature enters, draw a card.',
        },
      ],
    });
    const lines = splitAbilityLines(def);
    const shapes = lines.map((l) => l.shape);
    expect(shapes).toContain('keyword');
    expect(shapes).toContain('triggered');
    // 誘発行は effect.draw を持つ(誘発タグの draw 除外とは別系統・§29.6)
    const trig = lines.find((l) => l.shape === 'triggered');
    expect(trig).toBeDefined();
    expect(detectEffectAtoms(trig!.text)).toContain('effect.draw');
  });

  it('oracleText 無しでも throw せず空配列', () => {
    const def = makeDef({ scryfallId: 'vanilla', typeLine: 'Creature — Bear' });
    expect(() => splitAbilityLines(def)).not.toThrow();
    expect(splitAbilityLines(def)).toEqual([]);
  });
});

describe('§29.7 純粋・決定的(エンジン不変)', () => {
  it('同入力で同出力(splitAbilityLines)', () => {
    const def = makeDef({
      scryfallId: 'det',
      typeLine: 'Enchantment',
      faces: [
        {
          name: 'det',
          typeLine: 'Enchantment',
          oracleText: 'Creatures you control get +1/+1.\nWhenever you draw a card, you gain 1 life.',
        },
      ],
    });
    expect(JSON.stringify(splitAbilityLines(def))).toBe(JSON.stringify(splitAbilityLines(def)));
  });

  it('入力文字列を破壊しない', () => {
    const line = 'Destroy target creature.';
    detectEffectAtoms(line);
    detectConstructs(line);
    classifyAbilityShape(line, 'Instant');
    expect(line).toBe('Destroy target creature.');
  });
});
