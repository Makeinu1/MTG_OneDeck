// Reviewer-owned adversarial tests for engine-spec §33.2/§33.4/§33.7 (Phase G4: 起動型コスト精算).
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// 対象: 純ヘルパ activationPlanForSource(commands.ts・state 読み取りのみ)と、
// その commands + addAbilityToStack を applyCommands で1バッチ適用したときの盤面、
// および I9(非マナ能力は effectsAuto OFF 時に plan===null → addAbilityToStack 単独と差分ゼロ)。
// マナ能力は CR 605 により I9 の例外としてスタックを使わない。
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand, activatedManaAbilityPlanForSource, activationPlanForSource } from '../commands';
import { applyCommands } from '../batch';
import { initGame } from '../init';
import type { GameState } from '../types';
import { makeDeck } from './helpers';

function activatedSource(id: string, typeLine: string, oracleText: string): CardDef {
  return {
    scryfallId: id,
    oracleId: id,
    name: id,
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine,
    faces: [{ name: id, typeLine, oracleText }],
  };
}

function forest(id: string): CardDef {
  return {
    scryfallId: id,
    oracleId: id,
    name: id,
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: ['G'],
    typeLine: 'Land',
    producedMana: ['G'],
    faces: [{ name: id, typeLine: 'Land' }],
  };
}

function idOf(state: GameState, defId: string): string {
  return Object.values(state.cards).find((c) => c.defId === defId)!.id;
}

function onBattlefield(state: GameState, cardId: string): GameState {
  return applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'bottom' })
    .state;
}

// source + N Forests を戦場に並べた初期状態を返す。
function setup(source: CardDef, forests = 0): { state: GameState; sourceId: string } {
  const entries = [
    { def: source, isCommander: false },
    ...Array.from({ length: forests }, (_, i) => ({ def: forest(`g4-forest-${i}`), isCommander: false })),
    ...makeDeck(12),
  ];
  let state = initGame(entries, 7);
  const sourceId = idOf(state, source.scryfallId);
  state = onBattlefield(state, sourceId);
  for (let i = 0; i < forests; i++) {
    state = onBattlefield(state, idOf(state, `g4-forest-${i}`));
  }
  return { state, sourceId };
}

function stackCount(state: GameState): number {
  return state.zones.stack.length;
}

describe('§33.2 auto: tap-self のみ', () => {
  it('「{T}: Draw a card.」→ plan.commands で source がタップされ能力がスタックへ(単一バッチ)', () => {
    const { state, sourceId } = setup(activatedSource('g4-tap', 'Artifact', '{T}: Draw a card.'));
    const plan = activationPlanForSource(state, sourceId);
    expect(plan).not.toBeNull();
    expect(plan!.decision).toBe('auto');

    const before = stackCount(state);
    const result = applyCommands(state, [
      ...plan!.commands,
      { type: 'addAbilityToStack', sourceId, kind: 'activated', abilityLineIndex: 0 },
    ]);
    expect(result.state.cards[sourceId].tapped).toBe(true);
    expect(stackCount(result.state)).toBe(before + 1);
  });
});

describe('M-CR-RECONCILE / CR 605: マナ能力はスタックを使わない', () => {
  it('「{T}: Add {G}.」→ source タップ + Gマナ即加算、stack 追加なし', () => {
    const { state, sourceId } = setup(activatedSource('g4-mana-ability', 'Creature — Elf Druid', '{T}: Add {G}.'));
    const plan = activatedManaAbilityPlanForSource(state, sourceId);
    expect(plan).not.toBeNull();
    expect(plan!.decision).toBe('auto');

    const result = applyCommands(state, plan!.commands);
    expect(result.state.cards[sourceId].tapped).toBe(true);
    expect(result.state.manaPool.G).toBe(1);
    expect(stackCount(result.state)).toBe(0);
  });

  it('対象を取る「Add mana」能力は CR605 のマナ能力扱いにしない', () => {
    const { state, sourceId } = setup(
      activatedSource('g4-targeted-mana', 'Artifact', '{T}: Add {G}. This artifact deals 1 damage to any target.'),
    );
    expect(activatedManaAbilityPlanForSource(state, sourceId)).toBeNull();
  });
});

describe('§33.2 auto: マナ自動タップ', () => {
  it('「{2}{G}: Draw a card.」+ Forest×3 → 3 土地が自動タップされマナ精算', () => {
    const { state, sourceId } = setup(
      activatedSource('g4-mana', 'Artifact', '{2}{G}: Draw a card.'),
      3,
    );
    const plan = activationPlanForSource(state, sourceId);
    expect(plan).not.toBeNull();
    expect(plan!.decision).toBe('auto');
    expect(plan!.manaShortfall).toBe(0);

    const result = applyCommands(state, [
      ...plan!.commands,
      { type: 'addAbilityToStack', sourceId, kind: 'activated', abilityLineIndex: 0 },
    ]);
    const tappedLands = Object.values(result.state.cards).filter(
      (c) => c.zone === 'battlefield' && c.tapped && result.state.defs[c.defId]?.producedMana,
    );
    expect(tappedLands).toHaveLength(3);
    expect(stackCount(result.state)).toBe(1);
  });

  it('マナ不足でも auto(強行)・manaShortfall>0', () => {
    const { state, sourceId } = setup(
      activatedSource('g4-short', 'Artifact', '{5}{G}: Draw a card.'),
      1,
    );
    const plan = activationPlanForSource(state, sourceId);
    expect(plan).not.toBeNull();
    expect(plan!.decision).toBe('auto');
    expect(plan!.manaShortfall).toBeGreaterThan(0);
  });
});

describe('§33.2 auto: 自己生け贄', () => {
  it('「{T}, Sacrifice this creature: Draw a card.」→ source が墓地へ+能力スタック', () => {
    const { state, sourceId } = setup(
      activatedSource('g4-sac', 'Creature — Bear', '{T}, Sacrifice this creature: Draw a card.'),
    );
    const plan = activationPlanForSource(state, sourceId);
    expect(plan).not.toBeNull();
    expect(plan!.decision).toBe('auto');

    const result = applyCommands(state, [
      ...plan!.commands,
      { type: 'addAbilityToStack', sourceId, kind: 'activated', abilityLineIndex: 0 },
    ]);
    expect(result.state.cards[sourceId].zone).toBe('graveyard');
    expect(stackCount(result.state)).toBe(1);
  });
});

describe('§33.2 manual: 未モデルコストはコスト精算しない', () => {
  it('「{X}, {T}: Deal X damage.」→ decision manual / commands 空', () => {
    const { state, sourceId } = setup(
      activatedSource('g4-x', 'Creature — Wizard', '{X}, {T}: This deals X damage to any target.'),
    );
    const plan = activationPlanForSource(state, sourceId);
    expect(plan).not.toBeNull();
    expect(plan!.decision).toBe('manual');
    expect(plan!.commands).toEqual([]);
  });
});

describe('§33.4 I9: effectsAuto OFF 時はコスト精算しない(plan===null)', () => {
  it('グローバル OFF → plan===null。addAbilityToStack 単独でコスト未払い', () => {
    const base = setup(activatedSource('g4-i9g', 'Artifact', '{T}: Draw a card.'));
    const state = applyCommand(base.state, { type: 'setEffectsAuto', value: false }).state;
    expect(activationPlanForSource(state, base.sourceId)).toBeNull();

    // ストアは plan===null のとき addAbilityToStack 単独を適用する(=旧挙動)。
    const result = applyCommand(state, {
      type: 'addAbilityToStack',
      sourceId: base.sourceId,
      kind: 'activated',
      abilityLineIndex: 0,
    });
    expect(result.state.cards[base.sourceId].tapped).toBe(false); // コスト({T})未払い
    expect(stackCount(result.state)).toBe(1);
  });

  it('カード単位 OFF → plan===null', () => {
    const base = setup(activatedSource('g4-i9c', 'Artifact', '{T}: Draw a card.'));
    const state = applyCommand(base.state, {
      type: 'setCardEffectsAuto',
      cardId: base.sourceId,
      value: false,
    }).state;
    expect(activationPlanForSource(state, base.sourceId)).toBeNull();
  });

  it('I9 差分ゼロ: OFF の activate 経路 === addAbilityToStack 単独適用', () => {
    const base = setup(activatedSource('g4-i9eq', 'Creature — Bear', '{T}, Sacrifice this creature: Draw a card.'));
    const state = applyCommand(base.state, { type: 'setEffectsAuto', value: false }).state;
    const plan = activationPlanForSource(state, base.sourceId);
    expect(plan).toBeNull();

    const addCmd = {
      type: 'addAbilityToStack' as const,
      sourceId: base.sourceId,
      kind: 'activated' as const,
      abilityLineIndex: 0,
    };
    const viaActivate = applyCommands(state, [...(plan?.commands ?? []), addCmd]).state;
    const viaPlain = applyCommand(state, addCmd).state;
    expect(viaActivate.cards).toEqual(viaPlain.cards);
    expect(viaActivate.zones).toEqual(viaPlain.zones);
  });
});

describe('§33.7 純粋性: activationPlanForSource は state 非破壊', () => {
  it('呼び出し前後で state が不変(同参照スナップショット)', () => {
    const { state, sourceId } = setup(activatedSource('g4-pure', 'Artifact', '{2}{G}: Draw a card.'), 3);
    const snapshot = JSON.stringify(state);
    activationPlanForSource(state, sourceId);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
