// Reviewer-owned adversarial tests for cr-500-514-turn-structure (S-TURN 前半).
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 500.2/500.3: a phase/step with priority only ends once the stack is empty and all
//   players pass; the untap/cleanup steps are the only priority-less steps. This engine models
//   the stack-empty precondition as a hard block on `nextPhase`/`nextTurn` (docs/engine-spec.md
//   §17 M6.2a) — already reviewer-pinned in `review.m62stack.test.ts` (not duplicated here).
// - CR 514.2: at cleanup, all damage marked on permanents is removed, simultaneously, without
//   using the stack. As of 2026-07-19 (engine-spec §34.50) this engine models a *real*
//   standalone `cleanup` phase in `PHASE_ORDER` (superseding the former end->untap surrogate).
//   `clearMarkedDamage` runs inside `completeCleanupStateActions` as the cleanup turn-based
//   action. When no hand-size discard is required, a single `nextPhase()` from `end` still
//   passes straight through cleanup to the next turn's untap with damage cleared — this file
//   pins that passthrough edge and the stack-block precondition end-to-end. The discard-stop
//   behavior (hand over the limit halting in cleanup) is pinned in `review.cleanup-hand-size`.
// - CR 514.3/514.3a (extra cleanup loop for a resolution-time draw) is modeled via
//   re-cleanup and is pinned in `review.cleanup-hand-size` (not duplicated here).
import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { useGameStore } from '../gameStore';

function store() {
  return useGameStore.getState();
}

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: false,
    mulliganDecisionPending: false,
  });
}

function findInstanceId(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find((c) => c.defId === defId);
  if (!card) throw new Error(`card instance not found for ${defId}`);
  return card.id;
}

function creatureOnBattlefield(id: string, power: string, toughness: string): string {
  const def = makeDef({
    scryfallId: id,
    typeLine: 'Creature',
    faces: [{ name: id, typeLine: 'Creature', power, toughness, oracleText: '' }],
  });
  store().newGame([{ def, isCommander: false }, ...makeDeck(12)], 1);
  const id_ = findInstanceId(id);
  store().moveCard(id_, 'battlefield');
  return id_;
}

describe('cr-500-514 cleanup surrogate wired into nextPhase(end->untap) (CR 514.2)', () => {
  beforeEach(() => resetStore());

  it('marked damage clears when nextPhase() carries end -> next-turn untap', () => {
    const creatureId = creatureOnBattlefield('r-cr514-a', '5', '5');
    store().dispatch({ type: 'markDamage', cardId: creatureId, amount: 3 });
    expect(store().state!.cards[creatureId].damageMarked).toBe(3);

    useGameStore.setState({ state: { ...store().state!, phase: 'end' } });
    const turnBefore = store().state!.turn;

    store().nextPhase();

    expect(store().state!.phase).toBe('untap');
    expect(store().state!.turn).toBe(turnBefore + 1);
    // CR 514.2: cleanup-equivalent must have fired as part of this single transition.
    expect(store().state!.cards[creatureId].damageMarked).toBe(0);
    // creature survives (sublethal, and now-cleared) rather than being destroyed by stale marks.
    expect(store().state!.cards[creatureId].zone).toBe('battlefield');
  });

  it('marked damage does NOT clear on an intermediate phase transition (main1 -> combat)', () => {
    const creatureId = creatureOnBattlefield('r-cr514-b', '5', '5');
    store().dispatch({ type: 'markDamage', cardId: creatureId, amount: 3 });

    useGameStore.setState({ state: { ...store().state!, phase: 'main1' } });
    store().nextPhase();

    expect(store().state!.phase).toBe('combat');
    // CR 514.2 only fires at cleanup (modeled as the end->untap edge), not every phase change.
    expect(store().state!.cards[creatureId].damageMarked).toBe(3);
  });

  it('marked damage clears via nextTurn() regardless of current phase', () => {
    const creatureId = creatureOnBattlefield('r-cr514-c', '5', '5');
    store().dispatch({ type: 'markDamage', cardId: creatureId, amount: 4 });

    useGameStore.setState({ state: { ...store().state!, phase: 'combat' } });
    const turnBefore = store().state!.turn;

    store().nextTurn();

    expect(store().state!.turn).toBe(turnBefore + 1);
    expect(store().state!.phase).toBe('untap');
    expect(store().state!.cards[creatureId].damageMarked).toBe(0);
  });

  it('cleanup surrogate does not fire while the stack is non-empty (CR 500.2 precondition)', () => {
    // Stack-block itself is pinned in review.m62stack.test.ts; this asserts the specific
    // interaction with cleanup: a blocked nextPhase() must not sneak in a partial cleanup.
    const creature = makeDef({
      scryfallId: 'r-cr514-d',
      typeLine: 'Creature',
      faces: [{ name: 'r-cr514-d', typeLine: 'Creature', power: '5', toughness: '5', oracleText: '' }],
    });
    const sorc = makeDef({ scryfallId: 'r-cr514-spell', typeLine: 'Sorcery' });
    store().newGame(
      [
        { def: creature, isCommander: false },
        { def: sorc, isCommander: false },
        ...makeDeck(11),
      ],
      1,
    );
    const creatureId = findInstanceId('r-cr514-d');
    const sorcId = findInstanceId('r-cr514-spell');
    store().moveCard(creatureId, 'battlefield');
    store().moveCard(sorcId, 'hand');
    store().dispatch({ type: 'markDamage', cardId: creatureId, amount: 2 });

    store().castToStack(sorcId);
    expect(store().state!.zones.stack.length).toBe(1);

    useGameStore.setState({ state: { ...store().state!, phase: 'end' } });
    store().nextPhase();

    expect(store().state!.phase).toBe('end'); // blocked, unchanged
    expect(store().state!.cards[creatureId].damageMarked).toBe(2); // cleanup did not fire
  });
});
