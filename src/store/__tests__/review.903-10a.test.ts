// REVIEWER-OWNED acceptance contract for S-903.10a commander-damage defeat advisory.
// (CR 903.10a: 21+ combat damage from the same commander -> loss, state-based action;
//  CR 104.3j restates it; CR 702.124d: partner commanders counted separately;
//  framing CR 704.3/117.5; sandbox advisory vs CR 104.5 leave-the-game.)
// Implementation agents must NOT edit this file. If it fails, fix the engine.
//
// This slice adds the FOURTH defeat advisory reason on top of §34.15. It observes the
// existing manual commanderDamage[label] counter (label = coarse "same commander/source")
// and creates a P1 advisory only — current commanderDamage is not target-player keyed, so
// per-opponent-exact attribution stays deferred to cr-player-specific-zones.
//
// Independent adversarial pins, distinct from the implementer's golden cases:
//   1. 903.10a boundary: 20 does NOT lose; 21 on one label DOES (P1, ruleRef 903.10a).
//   2. 903.10a transition: 20 then +1 emits exactly once when the label reaches 21.
//   3. 702.124d: labels are NEVER summed — 10 + 11 across two labels does not lose.
//   4. 702.124d: one label at 21 loses even if another label is below threshold.
//   5. CR 704.3 idempotence: a held-over value >=21 does not re-emit under later SBA passes.
//   6. CR 704.3 simultaneity: commanderDamage + lifeZero in one pass share a group id.
//   7. Sandbox (vs CR 104.5): advisory does not null state / end game / block commands;
//      reducing the counter below 21 does not erase the append-only advisory record.
//   8. Model boundary: commanderDamage[label] creates a P1 advisory, NOT opponent:${label}.
//   9. Source boundary: ordinary life loss (not commander combat damage) synthesizes nothing.
//  10. Snapshot forward-compat: the fourth known reason round-trips with its 903.10a ref.

import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck } from '../../engine/__tests__/helpers';
import { SNAPSHOT_VERSION } from '../../data/gameSnapshot';
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

type DefeatRecord = { reasons: string[]; ruleRefs?: Record<string, string>; advisory?: boolean };
function defeatFor(playerRef: string): DefeatRecord | undefined {
  const defeat = (store().state as unknown as { defeat?: Record<string, DefeatRecord> }).defeat;
  return defeat?.[playerRef];
}
function reasonsFor(playerRef: string): string[] {
  return defeatFor(playerRef)?.reasons ?? [];
}
function defeatEvents(sbaApplied: string) {
  return (store().state?.eventLog ?? []).filter(
    (e) => (e as { type?: string }).type === 'defeatAdvisory'
      && (e as { sbaApplied?: string }).sbaApplied === sbaApplied,
  );
}

describe('review.903-10a: CR 903.10a commander-damage loss-condition SBA (advisory)', () => {
  beforeEach(() => {
    resetStore();
  });

  // 1a. CR 903.10a negative boundary: 20 combat damage from a commander does not lose.
  it('903.10a: a single label at 20 does NOT create a commanderDamage advisory', () => {
    store().newGame(makeDeck(12), 1);
    store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: 20 });
    expect(store().state!.commanderDamage['Opp Commander A']).toBe(20);
    expect(reasonsFor('P1')).not.toContain('commanderDamage');
    expect(defeatEvents('903.10a').length).toBe(0);
  });

  // 1b. CR 903.10a positive boundary: 21 from the same label loses (P1, ref 903.10a).
  it('903.10a: a single label at 21 creates a P1 commanderDamage advisory with ref 903.10a', () => {
    store().newGame(makeDeck(12), 1);
    store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: 21 });
    expect(store().state!.commanderDamage['Opp Commander A']).toBe(21);
    expect(reasonsFor('P1')).toContain('commanderDamage');
    expect(defeatFor('P1')?.ruleRefs?.commanderDamage).toBe('903.10a');
    const events = defeatEvents('903.10a');
    expect(events.length).toBe(1);
    expect(events[0]).toMatchObject({
      type: 'defeatAdvisory',
      reason: 'sba',
      sbaApplied: '903.10a',
      playerRef: 'P1',
      defeatReason: 'commanderDamage',
      advisory: true,
    });
  });

  // 2. CR 903.10a transition: appears only when the same label reaches 21, and once.
  it('903.10a: 20 then +1 emits the advisory exactly once at the 21 crossing', () => {
    store().newGame(makeDeck(12), 1);
    store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: 20 });
    expect(reasonsFor('P1')).not.toContain('commanderDamage');
    store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: 1 });
    expect(store().state!.commanderDamage['Opp Commander A']).toBe(21);
    expect(reasonsFor('P1')).toContain('commanderDamage');
    expect(defeatEvents('903.10a').length).toBe(1);
  });

  // 3. CR 702.124d: separate labels model separate commanders and must NOT be summed.
  it('702.124d: 10 on one label plus 11 on another does NOT reach the 21 threshold', () => {
    store().newGame(makeDeck(12), 1);
    store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: 10 });
    store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander B', delta: 11 });
    expect(reasonsFor('P1')).not.toContain('commanderDamage');
    expect(defeatEvents('903.10a').length).toBe(0);
  });

  // 4. CR 702.124d: one label at 21 loses even if another label is below threshold.
  it('702.124d: one label at 21 loses independently of a below-threshold sibling label', () => {
    store().newGame(makeDeck(12), 1);
    store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: 20 });
    store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander B', delta: 21 });
    expect(reasonsFor('P1')).toContain('commanderDamage');
    expect(defeatEvents('903.10a').length).toBe(1);
  });

  // 5. CR 704.3 fixed point: a held-over value >=21 does not re-emit under later SBA passes.
  it('704.3: a held-over counter >=21 does not re-emit the advisory on subsequent SBA checks', () => {
    store().newGame(makeDeck(12), 1);
    store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: 21 });
    expect(defeatEvents('903.10a').length).toBe(1);
    store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: 1 });
    store().dispatch({ type: 'adjustLife', delta: 0 }); // re-runs the SBA loop; reaching here proves no hang
    expect(store().state!.commanderDamage['Opp Commander A']).toBe(22);
    expect(reasonsFor('P1').filter((r) => r === 'commanderDamage').length).toBe(1);
    expect(defeatEvents('903.10a').length).toBe(1);
  });

  // 6. CR 704.3 simultaneity: commanderDamage + lifeZero in one pass share a group id.
  it('704.3: commanderDamage and lifeZero found in one SBA pass share a simultaneousGroupId', () => {
    store().newGame(makeDeck(12), 1);
    useGameStore.setState({
      state: {
        ...store().state!,
        life: 0,
        commanderDamage: { ...store().state!.commanderDamage, 'Opp Commander A': 21 },
      },
    });
    store().dispatch({ type: 'adjustLife', delta: 0 });
    expect(reasonsFor('P1')).toEqual(expect.arrayContaining(['lifeZero', 'commanderDamage']));
    const groups = new Set([
      ...defeatEvents('704.5a').map((e) => (e as { simultaneousGroupId?: string }).simultaneousGroupId),
      ...defeatEvents('903.10a').map((e) => (e as { simultaneousGroupId?: string }).simultaneousGroupId),
    ]);
    expect(groups.size).toBe(1);
    expect(defeatFor('P1')?.ruleRefs?.lifeZero).toBe('704.5a');
    expect(defeatFor('P1')?.ruleRefs?.commanderDamage).toBe('903.10a');
  });

  // 7. Sandbox vs CR 104.5: advisory does not hard-enforce; append-only after counter drops.
  it('sandbox: advisory does not end the game and survives the counter dropping below 21', () => {
    store().newGame(makeDeck(20), 1);
    store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: 21 });
    expect(reasonsFor('P1')).toContain('commanderDamage');
    expect(store().state).toBeTruthy();
    expect(() => store().dispatch({ type: 'nextPhase' })).not.toThrow();
    store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: -1 });
    expect(store().state!.commanderDamage['Opp Commander A']).toBe(20);
    // Append-only: the advisory record persists even though the manual counter fell below 21.
    expect(reasonsFor('P1')).toContain('commanderDamage');
  });

  // 8. Model boundary: commanderDamage[label] keys a P1 advisory, NOT opponent:${label}.
  it('903.10a boundary: the label counter creates a P1 advisory, not an opponent-keyed one', () => {
    store().newGame(makeDeck(12), 1);
    store().dispatch({ type: 'adjustCommanderDamage', label: '対戦相手A', delta: 21 });
    expect(reasonsFor('P1')).toContain('commanderDamage');
    expect(reasonsFor('opponent:対戦相手A')).not.toContain('commanderDamage');
  });

  // 9. Source boundary: ordinary life loss is not commander combat damage.
  it('903.10a boundary: ordinary life loss does not synthesize a commanderDamage advisory', () => {
    store().newGame(makeDeck(12), 1);
    store().dispatch({ type: 'adjustLife', delta: -21 });
    expect(store().state!.commanderDamage['Opp Commander A'] ?? 0).toBe(0);
    expect(reasonsFor('P1')).not.toContain('commanderDamage');
    expect(defeatEvents('903.10a').length).toBe(0);
  });

  // 10. Snapshot forward-compat: the fourth known reason round-trips with its 903.10a ref.
  it('forward-compat: a commanderDamage advisory round-trips through a snapshot with ref 903.10a', () => {
    store().newGame(makeDeck(12), 1);
    store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: 21 });
    const snapshot = {
      version: SNAPSHOT_VERSION,
      state: { ...store().state! },
      deck: makeDeck(12),
      autoAdvanceToMain: false,
    };
    expect(() => store().restoreGame(snapshot)).not.toThrow();
    expect(reasonsFor('P1')).toContain('commanderDamage');
    expect(defeatFor('P1')?.ruleRefs?.commanderDamage).toBe('903.10a');
  });
});
