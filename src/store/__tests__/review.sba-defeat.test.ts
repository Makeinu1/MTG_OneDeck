// REVIEWER-OWNED acceptance contract for S-SBA defeat-state substrate
// (CR 704.5a life<=0, 704.5b empty-library draw attempt, 704.5c poison>=10;
//  framing CR 704.1/704.3/117.5; sandbox advisory vs CR 104.5 leave-the-game).
// Implementation agents must NOT edit this file. If it fails, fix the engine.
//
// Independent adversarial pins, distinct from the implementer's golden cases:
//   1. 704.5a: life reaching exactly 0 sets a lifeZero advisory for the app player.
//   2. 704.5a: each opponent life label is evaluated independently (label-keyed).
//   3. 704.5c boundary: poison 10 sets a poison advisory; poison 9 does NOT.
//   4. 704.5b: a draw attempt from an empty library sets an emptyLibraryDraw advisory,
//      and the "since last SBA" interval flag is CLEARED by the SBA check (CR 121.4).
//   5. 704.5b: mill from an empty library is NOT a draw and sets no advisory (CR 121.5).
//   6. CR 704.3 fixed point: re-checking SBA while life<=0 must terminate (no hang)
//      and must NOT append duplicate advisory events (advisory is idempotent).
//   7. Sandbox (vs CR 104.5): a defeat advisory must NOT hard-enforce — state stays
//      non-null, phase movement and further commands still work, game is not ended.
//   8. CR 704.3 simultaneity: life<=0 AND poison>=10 found in one SBA pass share a
//      single simultaneousGroupId.
//   9. Snapshot forward-compat: an old snapshot lacking the new fields restores without
//      throwing and backfills to empty advisory state.
//  10. CR 903.10a (§34.16): commander damage 21 now creates a P1 commanderDamage advisory
//      at advisory level; per-opponent-exact attribution stays deferred. Full commander-
//      damage acceptance lives in review.903-10a.test.ts.

import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck } from '../../engine/__tests__/helpers';
import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';
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

// Reviewer-owned accessors for the new (not-yet-existing-until-implemented) substrate.
// Bracket access keeps this strict (no `any`) while tolerating the Record-shaped contract.
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

describe('review.sba-defeat: CR 704.5a/b/c loss-condition SBA substrate (advisory)', () => {
  beforeEach(() => {
    resetStore();
  });

  // 1. CR 704.5a: life <= 0 -> lifeZero advisory for the app player.
  it('704.5a: app player life reaching 0 sets a lifeZero advisory', () => {
    store().newGame(makeDeck(12), 1);
    store().dispatch({ type: 'adjustLife', delta: -store().state!.life });
    expect(store().state!.life).toBeLessThanOrEqual(0);
    expect(reasonsFor('P1')).toContain('lifeZero');
    expect(defeatEvents('704.5a').length).toBeGreaterThanOrEqual(1);
  });

  // 2. CR 704.5a: opponent labels are evaluated independently.
  it('704.5a: an opponent life label at 0 sets its own lifeZero advisory', () => {
    store().newGame(makeDeck(12), 1);
    const label = Object.keys(store().state!.opponentLife)[0];
    const cur = store().state!.opponentLife[label];
    store().dispatch({ type: 'adjustOpponentLife', label, delta: -cur });
    expect(store().state!.opponentLife[label]).toBeLessThanOrEqual(0);
    expect(reasonsFor(`opponent:${label}`)).toContain('lifeZero');
    // App player is unaffected.
    expect(reasonsFor('P1')).not.toContain('lifeZero');
  });

  // 3. CR 704.5c boundary: 10 loses, 9 does not.
  it('704.5c: poison 10 sets a poison advisory but poison 9 does not', () => {
    store().newGame(makeDeck(12), 1);
    store().dispatch({ type: 'adjustPlayerCounter', kind: 'poison', delta: 9 });
    expect(store().state!.poison).toBe(9);
    expect(reasonsFor('P1')).not.toContain('poison');
    expect(defeatEvents('704.5c').length).toBe(0);

    store().dispatch({ type: 'adjustPlayerCounter', kind: 'poison', delta: 1 });
    expect(store().state!.poison).toBe(10);
    expect(reasonsFor('P1')).toContain('poison');
    expect(defeatEvents('704.5c').length).toBeGreaterThanOrEqual(1);
  });

  // 4. CR 704.5b: draw attempt from empty library sets advisory; interval flag cleared.
  it('704.5b: drawing from an empty library sets emptyLibraryDraw and clears the interval flag', () => {
    store().newGame(makeDeck(12), 1);
    useGameStore.setState({
      state: { ...store().state!, zones: { ...store().state!.zones, library: [] } },
    });
    store().dispatch({ type: 'draw', count: 1 });
    expect(reasonsFor('P1')).toContain('emptyLibraryDraw');
    // The "since last SBA check" flag must not persist past the SBA check (CR 121.4 / 704.5b).
    const flag = (store().state as unknown as {
      emptyLibraryDrawAttemptedSinceLastSba?: Record<string, boolean>;
    }).emptyLibraryDrawAttemptedSinceLastSba;
    expect(flag?.P1 ?? false).toBe(false);
  });

  // 5. CR 121.5: mill is not a draw -> no empty-library defeat advisory.
  it('704.5b/121.5: milling from an empty library does NOT set emptyLibraryDraw', () => {
    store().newGame(makeDeck(12), 1);
    useGameStore.setState({
      state: { ...store().state!, zones: { ...store().state!.zones, library: [] } },
    });
    store().dispatch({ type: 'mill', count: 1 });
    expect(reasonsFor('P1')).not.toContain('emptyLibraryDraw');
    expect(defeatEvents('704.5b').length).toBe(0);
  });

  // 6. CR 704.3 fixed point: terminates and is idempotent.
  it('704.3: re-checking SBA while life<=0 terminates and does not duplicate advisory events', () => {
    store().newGame(makeDeck(12), 1);
    store().dispatch({ type: 'adjustLife', delta: -store().state!.life });
    const first = defeatEvents('704.5a').length;
    expect(first).toBe(1);
    // A no-op command re-runs the SBA loop; reaching this assertion proves no infinite loop.
    store().dispatch({ type: 'adjustLife', delta: 0 });
    expect(defeatEvents('704.5a').length).toBe(1);
  });

  // 7. Sandbox vs CR 104.5: advisory must not hard-enforce a loss.
  it('sandbox: a defeat advisory does not null state, block phases, or end the game', () => {
    store().newGame(makeDeck(20), 1);
    store().dispatch({ type: 'adjustLife', delta: -store().state!.life });
    expect(reasonsFor('P1')).toContain('lifeZero');
    expect(store().state).toBeTruthy();
    expect(() => store().dispatch({ type: 'nextPhase' })).not.toThrow();
    expect(store().state).toBeTruthy();
    // Further commands still apply.
    store().dispatch({ type: 'adjustLife', delta: 5 });
    expect(store().state!.life).toBe(5);
  });

  // 8. CR 704.3 simultaneity: two reasons in one pass share a group id.
  it('704.3: life<=0 and poison>=10 in one SBA pass share a simultaneousGroupId', () => {
    store().newGame(makeDeck(12), 1);
    useGameStore.setState({ state: { ...store().state!, life: 0, poison: 10 } });
    store().dispatch({ type: 'adjustLife', delta: 0 });
    expect(reasonsFor('P1')).toEqual(expect.arrayContaining(['lifeZero', 'poison']));
    const groups = new Set([
      ...defeatEvents('704.5a').map((e) => (e as { simultaneousGroupId?: string }).simultaneousGroupId),
      ...defeatEvents('704.5c').map((e) => (e as { simultaneousGroupId?: string }).simultaneousGroupId),
    ]);
    expect(groups.size).toBe(1);
  });

  // 9. Snapshot forward-compat: old snapshot lacking new fields restores cleanly.
  it('forward-compat: a snapshot without defeat fields restores and backfills to empty', () => {
    store().newGame(makeDeck(12), 1);
    const legacy = { ...store().state! } as Record<string, unknown>;
    delete legacy.defeat;
    delete legacy.emptyLibraryDrawAttemptedSinceLastSba;
    const snapshot = {
      version: SNAPSHOT_VERSION,
      state: legacy,
      deck: makeDeck(12),
      autoAdvanceToMain: false,
    } as unknown as GameSnapshot;
    expect(() => store().restoreGame(snapshot)).not.toThrow();
    expect(defeatFor('P1')).toBeUndefined();
  });

  // 10. CR 903.10a is now implemented at advisory level (§34.16). The commander-damage
  //     reason lands as a P1 advisory; per-opponent-exact attribution stays deferred.
  //     Full commander-damage acceptance lives in review.903-10a.test.ts.
  it('903.10a: commander damage 21 creates a P1 commanderDamage advisory (advisory level)', () => {
    store().newGame(makeDeck(12), 1);
    store().dispatch({ type: 'adjustCommanderDamage', label: '対戦相手統率者', delta: 21 });
    expect(reasonsFor('P1')).toContain('commanderDamage');
    expect(defeatFor('P1')?.ruleRefs?.commanderDamage).toBe('903.10a');
    expect(defeatEvents('903.10a').length).toBe(1);
    // Per-opponent-exact commander damage remains deferred (not target-player keyed).
    expect(reasonsFor('opponent:対戦相手統率者')).not.toContain('commanderDamage');
  });
});
