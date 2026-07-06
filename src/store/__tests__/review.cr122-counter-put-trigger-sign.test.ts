// Reviewer-owned adversarial tests for cr-122-counters batch3-4 residual demand check
// (event:counter demand=8). 実装エージェント(Codex含む)は本ファイルを変更しないこと。
// 落ちたら実装側を直す。
//
// CR grounding:
// - CR 122.7: 「When/Whenever the Nth [kind] counter is put on an object」型のtriggerは、
//   counterが実際に置かれた時に発火する。counterの種類(kind)はtrigger条件に明記された
//   ものと一致する必要がある(+1/+1 counterのtriggerは-1/-1 counterでは発火しない)。
// - CR 122.1a: +X/+Yと-X/-Yは符号込みで別種のcounter。
// 判定者の確認事項: このスライスで当初新規実装が必要と想定していた
// 「counter-placement event emission」(MyDeck demand=event:counter 8)は、
// 実際には**既存のcr-603-triggers-apnap Slice Cの汎用CounterChangeEvent
// +trigger.counter-put配線が既にcounterType非依存で正しく動いている**ことを
// 本ファイルで実地確認した(新規実装なし。counter-plus符号バグ修正
// (engine-spec §34.30)により-1/-1 counter配置が正しいcounterTypeで
// resolveされるようになったことで、この既存配線が-1/-1側でも正しく
// 機能するようになった、という接続の検証)。
import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { buildGuidedCommands, compileAbilityIR } from '../../engine/grammar/compile';
import { parseAbilityIR } from '../../engine/grammar/ir';
import type { CounterChangeEvent, GameState } from '../../engine/types';
import type { CardDef } from '../../types/card';
import { useGameStore } from '../gameStore';

function store() {
  return useGameStore.getState();
}

function snap(): GameState {
  const state = store().state;
  if (!state) throw new Error('game state is not available');
  return state;
}

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: true,
    mulliganDecisionPending: false,
  });
}

function startGameWith(defs: CardDef[]): void {
  store().newGame(
    [...defs.map((def) => ({ def, isCommander: false })), ...makeDeck(Math.max(0, 24 - defs.length))],
    1,
  );
}

function findInstanceId(defId: string): string {
  const card = Object.values(snap().cards).find((instance) => instance.defId === defId);
  if (!card) throw new Error(`card instance not found for ${defId}`);
  return card.id;
}

function pendingFor(sourceId: string) {
  return snap().pendingTriggers.filter((t) => t.sourceId === sourceId);
}

function counterChangeEvents(): CounterChangeEvent[] {
  return snap().eventLog.filter((e): e is CounterChangeEvent => e.type === 'counterChange');
}

describe('cr-122-counters: counter-put trigger sign-correctness (CR 122.7/122.1a)', () => {
  beforeEach(() => resetStore());

  it('a -1/-1 counter-put trigger fires when the guided -1/-1 leaf places a matching counter', () => {
    const watcher = makeDef({
      scryfallId: 'r-cr122-minus-watcher',
      faces: [
        {
          name: 'r-cr122-minus-watcher',
          typeLine: 'Creature — Bear',
          oracleText: 'Whenever a -1/-1 counter is put on this creature, you lose 1 life.',
        },
      ],
    });
    startGameWith([watcher]);
    const watcherId = findInstanceId('r-cr122-minus-watcher');
    store().moveCard(watcherId, 'battlefield');

    const spellSource = makeDef({
      scryfallId: 'r-cr122-minus-spell',
      typeLine: 'Sorcery',
      faces: [{ name: 'r-cr122-minus-spell', typeLine: 'Sorcery', oracleText: 'Put a -1/-1 counter on target creature.' }],
    });
    const compiled = compileAbilityIR(
      parseAbilityIR('Put a -1/-1 counter on target creature.', 'Sorcery'),
      { sourceId: 'src', def: spellSource },
    );
    const commands = buildGuidedCommands(
      compiled.prompts[0],
      { kind: 'target', cardIds: [watcherId] },
      { sourceId: 'src', def: spellSource },
    );
    for (const command of commands) {
      store().dispatch(command);
    }

    expect(counterChangeEvents()).toMatchObject([{ counterType: '-1/-1', delta: 1 }]);
    expect(pendingFor(watcherId)).toMatchObject([{ triggerId: 'trigger.counter-put' }]);
  });

  it('sign-specific matching: a "+1/+1 counter" trigger does NOT fire when a -1/-1 counter is put (no cross-contamination)', () => {
    const watcher = makeDef({
      scryfallId: 'r-cr122-plus-only-watcher',
      faces: [
        {
          name: 'r-cr122-plus-only-watcher',
          typeLine: 'Creature — Bear',
          oracleText: 'Whenever a +1/+1 counter is put on this creature, draw a card.',
        },
      ],
    });
    startGameWith([watcher]);
    const watcherId = findInstanceId('r-cr122-plus-only-watcher');
    store().moveCard(watcherId, 'battlefield');

    store().dispatch({ type: 'addCounters', cardId: watcherId, counterType: '-1/-1', delta: 1 });

    expect(counterChangeEvents()).toMatchObject([{ counterType: '-1/-1' }]);
    expect(pendingFor(watcherId)).toEqual([]);
  });

  it('the reverse: a "-1/-1 counter" trigger does NOT fire when a +1/+1 counter is put', () => {
    const watcher = makeDef({
      scryfallId: 'r-cr122-minus-only-watcher',
      faces: [
        {
          name: 'r-cr122-minus-only-watcher',
          typeLine: 'Creature — Bear',
          oracleText: 'Whenever a -1/-1 counter is put on this creature, you lose 1 life.',
        },
      ],
    });
    startGameWith([watcher]);
    const watcherId = findInstanceId('r-cr122-minus-only-watcher');
    store().moveCard(watcherId, 'battlefield');

    store().dispatch({ type: 'addCounters', cardId: watcherId, counterType: '+1/+1', delta: 1 });

    expect(counterChangeEvents()).toMatchObject([{ counterType: '+1/+1' }]);
    expect(pendingFor(watcherId)).toEqual([]);
  });
});
