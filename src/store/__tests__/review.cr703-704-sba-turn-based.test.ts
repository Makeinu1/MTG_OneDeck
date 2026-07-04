// Reviewer-owned adversarial tests for cr-703-704-sba-turn-based (S-TURN 後半).
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 704.3: whenever a player would get priority, ALL applicable SBAs are checked and
//   performed "simultaneously as a single event"; the check repeats until none apply.
// - CR 704.5j (legend rule): if a player controls two-or-more same-named legendary
//   permanents, that player chooses one to keep; the rest go to their owners' graveyards.
//   This project models the "which one to keep" step as a `PendingRuleChoice`
//   (kind:'legend-rule', src/engine/types.ts) — already reviewer-pinned in isolation by
//   `ruleChoices.test.ts` (cr-legend-rule-choice; do not duplicate here).
// - `performStateBasedActionsOnce` (src/engine/commands.ts, ~line 1240) returns `false`
//   immediately whenever ANY `pendingRuleChoices` entry exists — BEFORE checking any other
//   CR 704.5 condition (including 704.5a life<=0). This means an orthogonal SBA (e.g. a
//   defeat condition unrelated to the pending legend/commander-zone choice) is deferred
//   until the pending choice resolves, rather than being detected "simultaneously" per
//   CR 704.3's literal wording. This is a known, low-priority, zero-demand deviation
//   (research/cr-grounding/cr-backbone-ledger.json domain cr-703-704-sba-turn-based,
//   originally flagged by a Tier-1 finding as "plausibly correct... untested edge, not a
//   known defect"). This project does NOT redesign the pending-choice/SBA interaction here
//   (that redesign is cr-903-9-commander-zone-choice's own nextGate: generalizing
//   pendingRuleChoices so multiple simultaneous SBA groups can co-exist). This file closes
//   the "golden未整備" gap by pinning that the CURRENT deferred-then-resolves-on-next-pass
//   behavior degrades safely: no crash, no lost life-adjustment, no duplicate/lost defeat
//   advisory, and the deferred SBA is correctly picked up once the blocking choice clears.
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
    autoAdvanceToMain: true,
    mulliganDecisionPending: false,
  });
  localStorage.clear();
}

function findInstanceId(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find((c) => c.defId === defId);
  if (!card) throw new Error(`card instance not found for ${defId}`);
  return card.id;
}

function defeatEvents(sbaApplied: string) {
  return (store().state?.eventLog ?? []).filter(
    (e) =>
      (e as { type?: string }).type === 'defeatAdvisory' &&
      (e as { sbaApplied?: string }).sbaApplied === sbaApplied,
  );
}

describe('cr-703-704 pending rule choice defers an orthogonal SBA (CR 704.3 known boundary)', () => {
  beforeEach(() => resetStore());

  it('life-zero defeat (704.5a) is deferred while a legend-rule choice (704.5j) is pending, then applies once resolved', () => {
    const firstLegend = makeDef({
      scryfallId: 'r-cr703-legend-a',
      name: 'Shared Turn Legend',
      typeLine: 'Legendary Creature',
      faces: [{ name: 'Shared Turn Legend', typeLine: 'Legendary Creature' }],
    });
    const secondLegend = makeDef({
      scryfallId: 'r-cr703-legend-b',
      name: 'Shared Turn Legend',
      typeLine: 'Legendary Creature',
      faces: [{ name: 'Shared Turn Legend', typeLine: 'Legendary Creature' }],
    });
    store().newGame(
      [
        { def: firstLegend, isCommander: false },
        { def: secondLegend, isCommander: false },
        ...makeDeck(12),
      ],
      1,
    );
    const firstId = findInstanceId(firstLegend.scryfallId);
    const secondId = findInstanceId(secondLegend.scryfallId);

    store().moveCard(firstId, 'battlefield');
    store().moveCard(secondId, 'battlefield');

    const choice = store().state!.pendingRuleChoices[0];
    expect(choice).toMatchObject({ kind: 'legend-rule', ruleRef: '704.5j' });

    // An orthogonal SBA condition becomes true while the legend-rule choice is pending.
    store().dispatch({ type: 'adjustLife', delta: -store().state!.life });

    // The life adjustment itself applies immediately (it is not gated on SBA checking)...
    expect(store().state!.life).toBe(0);
    // ...but the derived defeat advisory (704.5a) is deferred: the pending choice blocked
    // performStateBasedActionsOnce before it reached the life<=0 check.
    expect(defeatEvents('704.5a')).toHaveLength(0);
    expect(store().state!.pendingRuleChoices).toHaveLength(1);

    // Resolve the legend-rule choice.
    store().resolveRuleChoice(choice.choiceId, { kind: 'legend-rule', keepCardId: firstId });

    expect(store().state!.pendingRuleChoices).toEqual([]);
    expect(store().state!.cards[firstId].zone).toBe('battlefield');
    expect(store().state!.cards[secondId].zone).toBe('graveyard');
    // Resolving the choice does not, by itself, re-run a stabilization pass with the choice
    // already cleared (resolveRuleChoiceInState moves the loser via applyCommand while the
    // choice is still present, then removes it afterward) — so the deferred defeat advisory
    // has still not appeared yet. This is the crux of the documented boundary.
    expect(defeatEvents('704.5a')).toHaveLength(0);

    // The next command that runs stabilizeBeforePriority (here, a no-op life delta, mirroring
    // review.sba-defeat.test.ts's own re-check pattern) now sees pendingRuleChoices empty and
    // correctly detects the previously-deferred life-zero defeat. Eventual consistency: no
    // crash, no lost state, no duplicate/lost advisory once unblocked.
    store().dispatch({ type: 'adjustLife', delta: 0 });
    expect(defeatEvents('704.5a')).toHaveLength(1);
  });
});
