// Reviewer-owned adversarial tests for cr-614-615-616-replacement-prevention batch3-6
// demand check: shockland-style conditional ETB tapped replacement. 実装エージェント
// (Codex含む)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 614.1c/614.1d: "As [this permanent] enters..." / "[this permanent] enters..."は
//   replacement effect(このプロジェクトのサンドボックス哲学=ルール強制ではなくplayerの
//   honest choiceとして提示。CR604.4「pay 2 life」自体の支払い強制は既存方針通り
//   行わない=カードのペナルティを本人が判断する)。
// 判定者の確認事項: MyDeck実測demandのうち「replacement:11」の**過半数(7/12。
// Blood Crypt×2/Godless Shrine/Sacred Foundry/Watery Grave/Breeding Pool)**が
// shockland型("As this land enters, you may pay 2 life. If you don't, it enters
// tapped.")であり、既存`landEntersTapped`(status.ts)+`playLand`(store)の
// 'conditional'→'needs-tap-choice'フローが**既に正しく機能している**ことを本
// ファイルで実地確認した(新規実装なし・gap-classifierの`missingReadWrite:
// replacement`判定は既存honest-choice機構を計上していなかった="実装ギャップ
// なし"の別実例)。
import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type { GameState } from '../../engine/types';
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

function shocklandDef(id: string): CardDef {
  return makeDef({
    scryfallId: id,
    name: id,
    typeLine: 'Land',
    faces: [
      {
        name: id,
        typeLine: 'Land',
        oracleText: "As this land enters, you may pay 2 life. If you don't, it enters tapped.",
      },
    ],
  });
}

describe('cr-614-615-616-replacement-prevention: shockland ETB (CR 614.1c/614.1d)', () => {
  beforeEach(() => resetStore());

  it('golden: a shockland (Blood Crypt shape) in hand requires an explicit tap choice before entering', () => {
    const def = shocklandDef('r-cr614-shock-golden');
    startGameWith([def]);
    const id = findInstanceId('r-cr614-shock-golden');
    store().moveCard(id, 'hand');

    const result = store().playLand(id);
    expect(result).toBe('needs-tap-choice');
    // The card must not have silently moved to the battlefield while awaiting the choice.
    expect(snap().cards[id].zone).toBe('hand');
  });

  it('choosing to pay life (untapped): playLand(id, { entersTapped: false }) enters untapped', () => {
    const def = shocklandDef('r-cr614-shock-untapped');
    startGameWith([def]);
    const id = findInstanceId('r-cr614-shock-untapped');
    store().moveCard(id, 'hand');

    const result = store().playLand(id, { entersTapped: false });
    expect(result).toBe('ok');
    expect(snap().cards[id].zone).toBe('battlefield');
    expect(snap().cards[id].tapped).toBe(false);
  });

  it("choosing not to pay life: playLand(id, { entersTapped: true }) enters tapped", () => {
    const def = shocklandDef('r-cr614-shock-tapped');
    startGameWith([def]);
    const id = findInstanceId('r-cr614-shock-tapped');
    store().moveCard(id, 'hand');

    const result = store().playLand(id, { entersTapped: true });
    expect(result).toBe('ok');
    expect(snap().cards[id].zone).toBe('battlefield');
    expect(snap().cards[id].tapped).toBe(true);
  });

  it('non-regression: an unconditional tapland ("This land enters tapped.") never asks for a choice', () => {
    const def = makeDef({
      scryfallId: 'r-cr614-always-tapped',
      name: 'r-cr614-always-tapped',
      typeLine: 'Land',
      faces: [{ name: 'r-cr614-always-tapped', typeLine: 'Land', oracleText: 'This land enters tapped.' }],
    });
    startGameWith([def]);
    const id = findInstanceId('r-cr614-always-tapped');
    store().moveCard(id, 'hand');

    const result = store().playLand(id);
    expect(result).toBe('ok');
    expect(snap().cards[id].tapped).toBe(true);
  });

  it('non-regression: a basic land never asks for a choice and enters untapped', () => {
    const def = makeDef({
      scryfallId: 'r-cr614-basic',
      name: 'r-cr614-basic',
      typeLine: 'Basic Land — Plains',
      faces: [{ name: 'r-cr614-basic', typeLine: 'Basic Land — Plains' }],
    });
    startGameWith([def]);
    const id = findInstanceId('r-cr614-basic');
    store().moveCard(id, 'hand');

    const result = store().playLand(id);
    expect(result).toBe('ok');
    expect(snap().cards[id].tapped).toBe(false);
  });
});
