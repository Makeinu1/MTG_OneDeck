// Reviewer-owned adversarial tests for engine-spec §32 (Phase G3: 対象/モード誘導フロー).
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// 対象は純関数 `compileAbilityIR` / `buildGuidedCommands`(`src/engine/grammar/compile.ts`)と
// `parseAbilityIR` の modal 解析(`src/engine/grammar/ir.ts`)。すべて GameState 非依存・決定的。
// 期待値は engine-spec §32.1〜§32.7 の契約と裏取り(snapshot 実カード文言)に準拠する。
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { parseAbilityIR } from '../grammar/ir';
import {
  buildGuidedCommands,
  compileAbilityIR,
  type EffectPrompt,
} from '../grammar/compile';

function ctx(): { sourceId: string; def: CardDef } {
  const def: CardDef = {
    scryfallId: 'src-1',
    oracleId: 'src-1',
    name: 'src-1',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Sorcery',
    faces: [{ name: 'src-1', typeLine: 'Sorcery' }],
  };
  return { sourceId: 'c1', def };
}

function compile(line: string, typeLine = 'Sorcery') {
  return compileAbilityIR(parseAbilityIR(line, typeLine), ctx());
}

function onlyPrompt(line: string, typeLine = 'Sorcery'): EffectPrompt {
  const r = compile(line, typeLine);
  expect(r.decision).toBe('guided');
  expect(r.prompts.length).toBeGreaterThanOrEqual(1);
  return r.prompts[0];
}

describe('§32.3 guided-target: 単一対象パーマネント効果', () => {
  it('「Destroy target creature.」→ guided / target / creature / commands 空', () => {
    const r = compile('Destroy target creature.');
    expect(r.decision).toBe('guided');
    expect(r.commands).toEqual([]);
    expect(r.prompts).toHaveLength(1);
    const p = r.prompts[0];
    expect(p.kind).toBe('target');
    expect(p.atom).toBe('effect.destroy');
    expect(p.count).toBe(1);
    expect(p.filter?.types).toEqual(['creature']);
  });

  it('「Destroy target artifact or enchantment.」→ 両型 filter', () => {
    const p = onlyPrompt('Destroy target artifact or enchantment.');
    expect(p.atom).toBe('effect.destroy');
    expect(p.filter?.types).toEqual(['artifact', 'enchantment']);
  });

  it('「Exile target creature.」→ guided / exile', () => {
    const p = onlyPrompt('Exile target creature.');
    expect(p.kind).toBe('target');
    expect(p.atom).toBe('effect.exile');
    expect(p.filter?.types).toEqual(['creature']);
  });

  it('「Tap target creature.」/「Untap target permanent.」→ guided', () => {
    expect(onlyPrompt('Tap target creature.').atom).toBe('effect.tap');
    const u = onlyPrompt('Untap target permanent.');
    expect(u.atom).toBe('effect.untap');
    expect(u.filter?.types).toEqual(['permanent']);
  });

  it('「Return target creature to its owner\'s hand.」→ guided(hand ゾーンゲート通過)', () => {
    const p = onlyPrompt("Return target creature to its owner's hand.");
    expect(p.atom).toBe('effect.return');
    expect(p.filter?.types).toEqual(['creature']);
  });

  it('「Put a +1/+1 counter on target creature.」→ guided / counter-plus', () => {
    const p = onlyPrompt('Put a +1/+1 counter on target creature.');
    expect(p.atom).toBe('effect.counter-plus');
    expect(p.filter?.types).toEqual(['creature']);
  });

  it('修飾語つき「Destroy target tapped creature.」も型のみ抽出して guided', () => {
    const p = onlyPrompt('Destroy target tapped creature.');
    expect(p.filter?.types).toEqual(['creature']);
  });
});

describe('§32.1 guided 据え置き(manual のまま)', () => {
  it('「Destroy all creatures.」(対象なし)→ guided でない', () => {
    expect(compile('Destroy all creatures.').decision).not.toBe('guided');
  });

  it('「up to two target creatures」(複数/up-to)→ guided でない', () => {
    const r = compile('Tap up to two target creatures.');
    expect(r.decision).not.toBe('guided');
    expect(r.reasons).toContain('needs-target');
  });

  it('「two target creatures」(複数対象)→ guided でない', () => {
    expect(compile('Return two target creatures to their owners\' hands.').decision).not.toBe(
      'guided',
    );
  });

  it('「deal 3 damage to target creature」(damage 据え置き)→ guided でない', () => {
    expect(compile('Lightning Strike deals 3 damage to target creature.').decision).not.toBe(
      'guided',
    );
  });

  it('リアニメイト「Return ... to the battlefield」→ guided でない(hand 以外)', () => {
    expect(
      compile(
        'Return target creature card from your graveyard to the battlefield under your control.',
      ).decision,
    ).not.toBe('guided');
  });

  it('「target player」(プレイヤー対象)→ guided でない', () => {
    expect(compile('Target player discards a card.').decision).not.toBe('guided');
  });
});

describe('§32.1B scry/surveil → guided(scry-surveil)', () => {
  it('「Scry 2.」→ guided / count 2', () => {
    const p = onlyPrompt('Scry 2.');
    expect(p.kind).toBe('scry-surveil');
    expect(p.atom).toBe('effect.scry');
    expect(p.count).toBe(2);
  });

  it('「Surveil 1.」→ guided / count 1', () => {
    const p = onlyPrompt('Surveil 1.');
    expect(p.kind).toBe('scry-surveil');
    expect(p.atom).toBe('effect.surveil');
    expect(p.count).toBe(1);
  });
});

describe('§32.2/§32.3 modal: choose-modal', () => {
  it('「Choose one — • Draw two cards. • You gain 3 life.」→ guided / modal / 2 options / (1,1)', () => {
    const ir = parseAbilityIR('Choose one — • Draw two cards. • You gain 3 life.', 'Instant');
    expect(ir.modal).toBeDefined();
    expect(ir.modal?.min).toBe(1);
    expect(ir.modal?.max).toBe(1);
    expect(ir.modal?.options).toHaveLength(2);

    const r = compileAbilityIR(ir, ctx());
    expect(r.decision).toBe('guided');
    expect(r.commands).toEqual([]);
    expect(r.prompts).toHaveLength(1);
    const p = r.prompts[0];
    expect(p.kind).toBe('modal');
    expect(p.atom).toBeNull();
    expect(p.count).toBe(1);
    expect(p.minCount).toBe(1);
    expect(p.options).toHaveLength(2);
    expect(p.options?.[0].index).toBe(0);
    expect(p.options?.[0].raw).toContain('Draw two cards');
    expect(p.options?.[1].raw).toContain('gain 3 life');
  });

  it('「Choose two —」→ (2,2)', () => {
    const ir = parseAbilityIR(
      'Choose two — • Draw a card. • You gain 2 life. • Each opponent loses 2 life.',
      'Instant',
    );
    expect(ir.modal?.min).toBe(2);
    expect(ir.modal?.max).toBe(2);
    expect(ir.modal?.options).toHaveLength(3);
  });

  it('「Choose one or more —」→ (1, options数)', () => {
    const ir = parseAbilityIR(
      'Choose one or more — • Destroy target artifact. • Destroy target creature. • Destroy target land.',
      'Instant',
    );
    expect(ir.modal?.min).toBe(1);
    expect(ir.modal?.max).toBe(3);
  });

  it('「Choose up to two —」→ (0, 2)', () => {
    const ir = parseAbilityIR('Choose up to two — • Draw a card. • You gain 2 life.', 'Instant');
    expect(ir.modal?.min).toBe(0);
    expect(ir.modal?.max).toBe(2);
  });

  it('bullet なしの「Choose one or more additional costs」(kicker)は modal でない', () => {
    const ir = parseAbilityIR('You may choose one or more additional costs.', 'Instant');
    expect(ir.modal).toBeUndefined();
  });
});

describe('§32.4 buildGuidedCommands(純写像)', () => {
  it('target/destroy + cardId → moveCard graveyard', () => {
    const prompt: EffectPrompt = {
      atom: 'effect.destroy',
      kind: 'target',
      count: 1,
      filter: { types: ['creature'] },
      raw: 'Destroy target creature.',
    };
    expect(buildGuidedCommands(prompt, { kind: 'target', cardIds: ['x'] }, ctx())).toEqual([
      { type: 'moveCard', cardId: 'x', to: 'graveyard', position: 'bottom' },
    ]);
  });

  it('target/exile → exile, return → hand, tap/untap → setTapped', () => {
    const base = { kind: 'target' as const, count: 1, filter: { types: ['creature'] } };
    expect(
      buildGuidedCommands(
        { ...base, atom: 'effect.exile', raw: 'Exile target creature.' },
        { kind: 'target', cardIds: ['x'] },
        ctx(),
      ),
    ).toEqual([{ type: 'moveCard', cardId: 'x', to: 'exile', position: 'bottom' }]);
    expect(
      buildGuidedCommands(
        { ...base, atom: 'effect.return', raw: "Return target creature to its owner's hand." },
        { kind: 'target', cardIds: ['x'] },
        ctx(),
      ),
    ).toEqual([{ type: 'moveCard', cardId: 'x', to: 'hand', position: 'bottom' }]);
    expect(
      buildGuidedCommands(
        { ...base, atom: 'effect.tap', raw: 'Tap target creature.' },
        { kind: 'target', cardIds: ['x'] },
        ctx(),
      ),
    ).toEqual([{ type: 'setTapped', cardId: 'x', tapped: true }]);
    expect(
      buildGuidedCommands(
        { ...base, atom: 'effect.untap', raw: 'Untap target creature.' },
        { kind: 'target', cardIds: ['x'] },
        ctx(),
      ),
    ).toEqual([{ type: 'setTapped', cardId: 'x', tapped: false }]);
  });

  it('counter-plus → addCounters +1/+1', () => {
    const prompt: EffectPrompt = {
      atom: 'effect.counter-plus',
      kind: 'target',
      count: 1,
      filter: { types: ['creature'] },
      raw: 'Put a +1/+1 counter on target creature.',
    };
    expect(buildGuidedCommands(prompt, { kind: 'target', cardIds: ['x'] }, ctx())).toEqual([
      { type: 'addCounters', cardId: 'x', counterType: '+1/+1', delta: 1 },
    ]);
  });

  it('scry-surveil → arrangeTop', () => {
    const prompt: EffectPrompt = {
      atom: 'effect.scry',
      kind: 'scry-surveil',
      count: 2,
      raw: 'Scry 2.',
    };
    expect(
      buildGuidedCommands(
        prompt,
        { kind: 'scry-surveil', topOrder: ['a', 'b'], toBottom: [], toGraveyard: [] },
        ctx(),
      ),
    ).toEqual([{ type: 'arrangeTop', topOrder: ['a', 'b'], toBottom: [], toGraveyard: [] }]);
  });

  it('modal の buildGuidedCommands は [](再帰コンパイルはストア)', () => {
    const prompt: EffectPrompt = {
      atom: null,
      kind: 'modal',
      count: 1,
      minCount: 1,
      options: [
        { index: 0, raw: 'Draw two cards.' },
        { index: 1, raw: 'You gain 3 life.' },
      ],
      raw: 'Choose one — • Draw two cards. • You gain 3 life.',
    };
    expect(buildGuidedCommands(prompt, { kind: 'modal', chosen: [0] }, ctx())).toEqual([]);
  });

  it('入力非破壊・決定的(同入力→同出力)', () => {
    const prompt: EffectPrompt = {
      atom: 'effect.destroy',
      kind: 'target',
      count: 1,
      filter: { types: ['creature'] },
      raw: 'Destroy target creature.',
    };
    const answer = { kind: 'target' as const, cardIds: ['x'] };
    const a = buildGuidedCommands(prompt, answer, ctx());
    const b = buildGuidedCommands(prompt, answer, ctx());
    expect(a).toEqual(b);
    expect(answer.cardIds).toEqual(['x']);
    expect(prompt.filter?.types).toEqual(['creature']);
  });
});

describe('§32 非干渉: auto/manual は prompts 空', () => {
  it('「Draw two cards.」は auto・prompts 空・commands そのまま', () => {
    const r = compile('Draw two cards.');
    expect(r.decision).toBe('auto');
    expect(r.prompts).toEqual([]);
    expect(r.commands).toEqual([{ type: 'draw', count: 2 }]);
  });

  it('「Draw X cards.」は variable-count manual・prompts 空', () => {
    const r = compile('Draw X cards.');
    expect(r.decision).toBe('manual');
    expect(r.prompts).toEqual([]);
    expect(r.reasons).toContain('variable-count');
  });
});
