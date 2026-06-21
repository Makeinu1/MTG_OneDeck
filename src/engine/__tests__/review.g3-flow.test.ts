// Reviewer-owned adversarial tests for engine-spec §32.5/§32.7 (Phase G3: 解決誘導フローのエンジン面).
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// 対象: 純ヘルパ guidedPlanForStackTop / eligibleTargets(commands.ts・state 読み取りのみ)と、
// buildGuidedCommands で得たコマンド + resolveStackTop を applyCommands で1バッチ適用したときの盤面、
// および I8(effectsAuto OFF 時は誘導しない=解決前差分ゼロ)。
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand } from '../commands';
import { applyCommands } from '../batch';
import { eligibleTargets, guidedPlanForStackTop } from '../commands';
import { buildGuidedCommands } from '../grammar/compile';
import { initGame } from '../init';
import type { GameState } from '../types';
import { makeDeck } from './helpers';

function destroyTargetSource(): CardDef {
  return {
    scryfallId: 'g3-source',
    oracleId: 'g3-source',
    name: 'g3-source',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Creature — Wizard',
    faces: [
      {
        name: 'g3-source',
        typeLine: 'Creature — Wizard',
        oracleText: 'When this creature enters, destroy target creature.',
      },
    ],
  };
}

function vanillaCreature(id: string): CardDef {
  return {
    scryfallId: id,
    oracleId: id,
    name: id,
    lang: 'en',
    layout: 'normal',
    cmc: 1,
    colorIdentity: [],
    typeLine: 'Creature — Bear',
    faces: [{ name: id, typeLine: 'Creature — Bear', power: '2', toughness: '2' }],
  };
}

function plainLand(id: string): CardDef {
  return {
    scryfallId: id,
    oracleId: id,
    name: id,
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Land',
    faces: [{ name: id, typeLine: 'Land' }],
  };
}

// 発生源(destroy 誘発)+ 標的クリーチャー + 土地 を戦場に置き、誘発をスタックに積む。
function setup(): { state: GameState; sourceId: string; victimId: string; landId: string } {
  let state = initGame(
    [
      { def: destroyTargetSource(), isCommander: false },
      { def: vanillaCreature('g3-victim'), isCommander: false },
      { def: plainLand('g3-land'), isCommander: false },
      ...makeDeck(12),
    ],
    7,
  );
  const idOf = (defId: string) => Object.values(state.cards).find((c) => c.defId === defId)!.id;
  const sourceId = idOf('g3-source');
  const victimId = idOf('g3-victim');
  const landId = idOf('g3-land');
  for (const cardId of [sourceId, victimId, landId]) {
    state = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'bottom' })
      .state;
  }
  state = applyCommand(state, {
    type: 'addAbilityToStack',
    sourceId,
    kind: 'triggered',
    abilityLineIndex: 0,
  }).state;
  return { state, sourceId, victimId, landId };
}

describe('§32.5 guidedPlanForStackTop: 誘導対象の検出', () => {
  it('destroy target creature 誘発 → target prompt(creature)を返す', () => {
    const { state, sourceId } = setup();
    const plan = guidedPlanForStackTop(state);
    expect(plan).not.toBeNull();
    expect(plan!.sourceId).toBe(sourceId);
    expect(plan!.prompts).toHaveLength(1);
    expect(plan!.prompts[0].kind).toBe('target');
    expect(plan!.prompts[0].atom).toBe('effect.destroy');
    expect(plan!.prompts[0].filter?.types).toEqual(['creature']);
  });

  it('effectsAuto グローバル OFF → null(誘導しない)', () => {
    let { state } = setup();
    state = applyCommand(state, { type: 'setEffectsAuto', value: false }).state;
    expect(guidedPlanForStackTop(state)).toBeNull();
  });

  it('発生源カード毎 OFF → null', () => {
    const initial = setup();
    const { sourceId } = initial;
    let state = initial.state;
    state = applyCommand(state, { type: 'setCardEffectsAuto', cardId: sourceId, value: true }).state;
    state = applyCommand(state, {
      type: 'setCardEffectsAuto',
      cardId: sourceId,
      value: false,
    }).state;
    expect(guidedPlanForStackTop(state)).toBeNull();
  });
});

describe('§32.5 eligibleTargets: フィルタ列挙', () => {
  it('creature フィルタは戦場のクリーチャーのみ(土地除外)', () => {
    const { state, victimId, sourceId, landId } = setup();
    const ids = eligibleTargets(state, { types: ['creature'] });
    expect(ids).toContain(victimId);
    expect(ids).toContain(sourceId); // 自分自身も「target creature」適格
    expect(ids).not.toContain(landId);
  });

  it('permanent フィルタは戦場の全パーマネント', () => {
    const { state, victimId, landId } = setup();
    const ids = eligibleTargets(state, { types: ['permanent'] });
    expect(ids).toContain(victimId);
    expect(ids).toContain(landId);
  });
});

describe('§32.5 誘導実行: 効果コマンド + resolveStackTop を1バッチ適用', () => {
  it('対象を選んで destroy → victim が墓地・スタック空', () => {
    const { state, victimId, sourceId } = setup();
    const plan = guidedPlanForStackTop(state)!;
    const cmds = buildGuidedCommands(
      plan.prompts[0],
      { kind: 'target', cardIds: [victimId] },
      { sourceId, def: destroyTargetSource() },
    );
    const resolved = applyCommands(state, [...cmds, { type: 'resolveStackTop' }]).state;
    expect(resolved.zones.graveyard).toContain(victimId);
    expect(resolved.zones.battlefield).not.toContain(victimId);
    expect(resolved.zones.stack).toHaveLength(0);
  });
});

describe('§32.7 I8: OFF / キャンセル時は誘導による変化ゼロ', () => {
  it('OFF で resolveStackTop だけ進めても victim は破壊されない(能力削除のみ)', () => {
    const initial = setup();
    const { victimId } = initial;
    let state = initial.state;
    state = applyCommand(state, { type: 'setEffectsAuto', value: false }).state;
    const resolved = applyCommand(state, { type: 'resolveStackTop' }).state;
    expect(resolved.zones.battlefield).toContain(victimId); // 据え置き
    expect(resolved.zones.stack).toHaveLength(0);
  });

  it('ON でも誘導コマンドを与えず resolveStackTop 単独なら destroy は起きない(guided は auto 発火しない)', () => {
    const { state, victimId } = setup();
    const resolved = applyCommand(state, { type: 'resolveStackTop' }).state;
    expect(resolved.zones.battlefield).toContain(victimId);
    expect(resolved.zones.stack).toHaveLength(0);
  });

  it('入力 state を破壊しない(I4)', () => {
    const { state } = setup();
    const snapshot = JSON.stringify(state);
    guidedPlanForStackTop(state);
    eligibleTargets(state, { types: ['creature'] });
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
