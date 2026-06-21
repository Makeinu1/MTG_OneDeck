// Reviewer-owned adversarial tests for engine-spec §31.3/§31.4/§31.7 (Phase G2: 解決時実行配線).
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// 対象: applyResolveStackTop の自動実行フック・effectsAuto(グローバル/カード毎)・
// 新コマンド setEffectsAuto/setCardEffectsAuto・新不変条件 I8・snapshot 前方互換。
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand } from '../commands';
import { initGame } from '../init';
import type { GameState } from '../types';
import { makeDeck } from './helpers';
import { useGameStore } from '../../store/gameStore';
import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';

function drawTwoCreature(): CardDef {
  return {
    scryfallId: 'g2-source',
    oracleId: 'g2-source',
    name: 'g2-source',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Creature — Wizard',
    faces: [
      {
        name: 'g2-source',
        typeLine: 'Creature — Wizard',
        oracleText: 'When this creature enters, draw two cards.',
      },
    ],
  };
}

// 戦場に発生源を置き、その誘発能力(abilityLineIndex=0)をスタックに積んだ状態を返す。
function setupTriggerOnStack(opts: { abilityLineIndex?: number } = {}): {
  state: GameState;
  sourceId: string;
} {
  let state = initGame([{ def: drawTwoCreature(), isCommander: false }, ...makeDeck(12)], 7);
  const sourceId = Object.values(state.cards).find((c) => c.defId === 'g2-source')!.id;
  state = applyCommand(state, {
    type: 'moveCard',
    cardId: sourceId,
    to: 'battlefield',
    position: 'bottom',
  }).state;
  state = applyCommand(state, {
    type: 'addAbilityToStack',
    sourceId,
    kind: 'triggered',
    ...(opts.abilityLineIndex === undefined ? {} : { abilityLineIndex: opts.abilityLineIndex }),
  }).state;
  return { state, sourceId };
}

describe('§31.3 GameState.effectsAuto 既定 ON', () => {
  it('initGame は effectsAuto=true で開始する', () => {
    const state = initGame(makeDeck(4), 1);
    expect(state.effectsAuto).toBe(true);
  });
});

describe('§31.4 解決時フック: auto 効果の自動実行(グローバル ON)', () => {
  it('「draw two cards」誘発を解決すると手札が2枚増える', () => {
    const { state } = setupTriggerOnStack({ abilityLineIndex: 0 });
    const before = state.zones.hand.length;
    const resolved = applyCommand(state, { type: 'resolveStackTop' }).state;
    expect(resolved.zones.hand.length).toBe(before + 2);
    expect(resolved.zones.stack).toHaveLength(0); // 能力は解決後に消える
  });
});

describe('§31.7 I8: effectsAuto OFF 時は解決前と差分ゼロ(自動実行しない)', () => {
  it('グローバル OFF: 能力削除のみ。手札/ライフ/ライブラリ不変', () => {
    let { state } = setupTriggerOnStack({ abilityLineIndex: 0 });
    state = applyCommand(state, { type: 'setEffectsAuto', value: false }).state;
    const handBefore = state.zones.hand.length;
    const libBefore = state.zones.library.length;
    const lifeBefore = state.life;

    const resolved = applyCommand(state, { type: 'resolveStackTop' }).state;
    expect(resolved.zones.stack).toHaveLength(0);
    expect(resolved.zones.hand.length).toBe(handBefore);
    expect(resolved.zones.library.length).toBe(libBefore);
    expect(resolved.life).toBe(lifeBefore);
  });

  it('カード毎 OFF: グローバル ON でも当該カードは自動実行しない', () => {
    const base = setupTriggerOnStack({ abilityLineIndex: 0 });
    const state = applyCommand(base.state, {
      type: 'setCardEffectsAuto',
      cardId: base.sourceId,
      value: false,
    }).state;
    expect(state.effectsAuto).toBe(true); // グローバルは ON のまま
    const handBefore = state.zones.hand.length;
    const resolved = applyCommand(state, { type: 'resolveStackTop' }).state;
    expect(resolved.zones.hand.length).toBe(handBefore);
  });

  it('abilityLineIndex 無しの能力は自動実行しない(従来挙動)', () => {
    const { state } = setupTriggerOnStack({}); // index 指定なし
    const handBefore = state.zones.hand.length;
    const resolved = applyCommand(state, { type: 'resolveStackTop' }).state;
    expect(resolved.zones.hand.length).toBe(handBefore);
    expect(resolved.zones.stack).toHaveLength(0);
  });
});

describe('§31.7 I8: effectsAuto は専用コマンド以外で不変', () => {
  it('setEffectsAuto で切替・他コマンドでは保存される', () => {
    let state = initGame(makeDeck(8), 3);
    expect(state.effectsAuto).toBe(true);
    state = applyCommand(state, { type: 'setEffectsAuto', value: false }).state;
    expect(state.effectsAuto).toBe(false);
    // 無関係なコマンドは effectsAuto を変えない
    state = applyCommand(state, { type: 'draw', count: 1 }).state;
    expect(state.effectsAuto).toBe(false);
    state = applyCommand(state, { type: 'setEffectsAuto', value: true }).state;
    expect(state.effectsAuto).toBe(true);
  });

  it('入力 state を破壊しない(I4)', () => {
    const state = initGame(makeDeck(4), 1);
    const snapshot = JSON.stringify(state);
    applyCommand(state, { type: 'setEffectsAuto', value: false });
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('§31.3 snapshot 前方互換(effectsAuto 欠落の旧 snapshot)', () => {
  it('restoreGame は effectsAuto 欠落をクラッシュせず true 補完する', () => {
    const base = initGame(makeDeck(5), 2);
    const legacyState = { ...base } as Partial<GameState>;
    delete legacyState.effectsAuto;
    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: legacyState as GameState,
      deck: makeDeck(5),
      autoAdvanceToMain: false,
    };

    expect(() => useGameStore.getState().restoreGame(snapshot)).not.toThrow();
    expect(useGameStore.getState().state?.effectsAuto).toBe(true);
  });
});
