// Reviewer-owned adversarial tests for cr-110 permanent tap/untap status writes.
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 110.5 / 110.5c: パーマネントの status に tapped/untapped が含まれ、spell/ability/turn-based action が変えるまで保持。
// - CR 701.26a: タップできるのは untapped のパーマネントのみ。
// - CR 701.26b: アンタップできるのは tapped のパーマネントのみ。
// サンドボックス哲学: 701.26a/b 違反は hard-block せず warning のみ(ユーザーは強行可)。
// 契約境界: 新 GameCommand/GameState 型を足さず、status 書き込みは既存 `setTapped` のみ。
import { beforeEach, describe, expect, it } from 'vitest';

import { makeDef } from '../../engine/__tests__/helpers';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

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

function findInstanceId(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find((c) => c.defId === defId);
  if (!card) throw new Error(`card instance not found for ${defId}`);
  return card.id;
}

function guidedTapSpell(oracleText: string, targetTypeLine: string) {
  const spell = makeDef({
    scryfallId: 'r-cr110-spell',
    typeLine: 'Sorcery',
    faces: [{ name: 'r-cr110-spell', typeLine: 'Sorcery', oracleText }],
  });
  const target = makeDef({
    scryfallId: 'r-cr110-target',
    typeLine: targetTypeLine,
    faces: [{ name: 'r-cr110-target', typeLine: targetTypeLine }],
  });
  const bystander = makeDef({
    scryfallId: 'r-cr110-bystander',
    typeLine: 'Artifact',
    faces: [{ name: 'r-cr110-bystander', typeLine: 'Artifact' }],
  });
  store().newGame(
    [
      { def: spell, isCommander: false },
      { def: target, isCommander: false },
      { def: bystander, isCommander: false },
    ],
    1,
  );
  const spellId = findInstanceId('r-cr110-spell');
  const targetId = findInstanceId('r-cr110-target');
  const bystanderId = findInstanceId('r-cr110-bystander');
  store().moveCard(spellId, 'stack', 'bottom');
  store().moveCard(targetId, 'battlefield', 'bottom');
  store().moveCard(bystanderId, 'battlefield', 'bottom');
  return { spellId, targetId, bystanderId };
}

describe('cr-110 guided tap/untap status write (CR 110.5 / 701.26)', () => {
  beforeEach(() => resetStore());

  it('「Tap target permanent.」→ 選択パーマネントのみ setTapped true・spell は墓地へ', () => {
    const { spellId, targetId, bystanderId } = guidedTapSpell('Tap target permanent.', 'Artifact');

    store().resolveTop();
    expect(store().pendingGuided?.prompts[0]).toMatchObject({ atom: 'effect.tap', kind: 'target' });

    store().confirmGuidedTarget(targetId);

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.cards[targetId].tapped).toBe(true);
    // 無関係パーマネントと source は tap されない(status 書き込みは選択対象限定)。
    expect(store().state!.cards[bystanderId].tapped).toBe(false);
    expect(store().state!.cards[spellId].zone).toBe('graveyard');
    // 対象は battlefield に残る(status 変更のみ・zone 移動しない)。
    expect(store().state!.cards[targetId].zone).toBe('battlefield');
  });

  it('「Untap target artifact or creature.」→ setTapped false', () => {
    const { targetId } = guidedTapSpell('Untap target artifact or creature.', 'Artifact Creature');
    store().dispatch({ type: 'setTapped', cardId: targetId, tapped: true });

    store().resolveTop();
    expect(store().pendingGuided?.prompts[0]).toMatchObject({ atom: 'effect.untap', kind: 'target' });

    store().confirmGuidedTarget(targetId);
    expect(store().pendingGuided).toBeNull();
    expect(store().state!.cards[targetId].tapped).toBe(false);
  });

  it('CR 701.26a: すでにタップ済みを Tap しても hard-block せず warning のみ(サンドボックス)', () => {
    const { targetId } = guidedTapSpell('Tap target permanent.', 'Artifact');
    store().dispatch({ type: 'setTapped', cardId: targetId, tapped: true });

    store().resolveTop();
    store().confirmGuidedTarget(targetId);

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.cards[targetId].tapped).toBe(true);
    expect(store().warnings.some((w) => w.includes('すでにタップ'))).toBe(true);
  });

  it('CR 701.26b: untapped を Untap しても hard-block せず warning のみ(サンドボックス)', () => {
    const { targetId } = guidedTapSpell('Untap target artifact or creature.', 'Artifact Creature');

    store().resolveTop();
    store().confirmGuidedTarget(targetId);

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.cards[targetId].tapped).toBe(false);
    expect(store().warnings.some((w) => w.includes('アンタップ状態'))).toBe(true);
  });
});
