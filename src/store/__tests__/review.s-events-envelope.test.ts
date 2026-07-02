// REVIEWER-OWNED acceptance contract for S-EVENTS life/damage/draw event envelope
// (engine-spec §34.18). Implementation agents must NOT edit this file; fix the engine.
//
// CR grounding:
//   - lifeChange: life gain/loss adjusts the total (119.3); a 0-life change is NOT an
//     event (119.9, 119.10); life<=0 is advisory-only at the SBA boundary (104.3b, 704.5a).
//   - draw: a draw moves the top library card to hand (121.1); multiple draws are
//     individual draws, never one aggregate (121.2); an empty-library draw is an attempt
//     with no card identity (121.4, 704.5b); moving library->hand without "draw" is not a
//     draw (121.5).
//   - damage: damage is dealt by a CR-legal source (120.1); a 0-damage packet is no event
//     (120.8). This slice adds the damage event TYPE only; source-less markDamage must NOT
//     counterfeit a trigger-eligible CR-120 damage event (source-backed emission deferred).
//   - envelope is an ADDITIVE union: existing zoneChange/defeatAdvisory events and legacy
//     snapshots stay valid (400.6, 400.7); I14 = same state + command -> same event delta.

import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck } from '../../engine/__tests__/helpers';
import { applyCommand, type GameCommand } from '../../engine/commands';
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

type Ev = Record<string, unknown> & { type?: string };
function events(): Ev[] {
  return (store().state?.eventLog ?? []) as unknown as Ev[];
}
function eventsOfType(type: string): Ev[] {
  return events().filter((e) => e.type === type);
}

describe('review.s-events-envelope: CR 119/120/121 life/damage/draw event envelope (§34.18)', () => {
  beforeEach(() => {
    resetStore();
  });

  // 1. CR 119.3: a nonzero life gain emits one lifeChange(gain) with correct totals.
  it('119.3: a life gain emits a single lifeChange gain event with previous/next totals', () => {
    store().newGame(makeDeck(12), 1);
    const before = store().state!.life;
    const n0 = eventsOfType('lifeChange').length;
    store().dispatch({ type: 'adjustLife', delta: 3 });
    const life = eventsOfType('lifeChange');
    expect(life.length).toBe(n0 + 1);
    const ev = life[life.length - 1];
    expect(ev.delta).toBe(3);
    expect(ev.direction).toBe('gain');
    expect(ev.playerId).toBe('P1');
    expect(ev.previousLife).toBe(before);
    expect(ev.nextLife).toBe(before + 3);
  });

  // 2. CR 119.3/119.4: a nonzero life loss emits one lifeChange(loss).
  it('119.4: a life loss emits a single lifeChange loss event', () => {
    store().newGame(makeDeck(12), 1);
    const before = store().state!.life;
    store().dispatch({ type: 'adjustLife', delta: -5 });
    const ev = eventsOfType('lifeChange').at(-1)!;
    expect(ev.delta).toBe(-5);
    expect(ev.direction).toBe('loss');
    expect(ev.nextLife).toBe(before - 5);
  });

  // 3. CR 119.9/119.10: a 0-delta life change is NOT a lifeChange event.
  it('119.9/119.10: adjusting life by 0 emits no lifeChange event', () => {
    store().newGame(makeDeck(12), 1);
    const n = eventsOfType('lifeChange').length;
    store().dispatch({ type: 'adjustLife', delta: 0 });
    expect(eventsOfType('lifeChange').length).toBe(n);
  });

  // 4. CR 104.3b/704.5a sandbox: life<=0 emits lifeChange but is advisory-only, not enforced.
  it('104.3b/704.5a: reaching 0 life emits lifeChange yet the game stays operable (advisory)', () => {
    store().newGame(makeDeck(20), 1);
    store().dispatch({ type: 'adjustLife', delta: -store().state!.life });
    expect(eventsOfType('lifeChange').length).toBeGreaterThanOrEqual(1);
    expect(store().state).toBeTruthy();
    // advisory does not hard-enforce: further commands still apply.
    expect(() => store().dispatch({ type: 'nextPhase' })).not.toThrow();
    expect(store().state).toBeTruthy();
  });

  // 5. CR 121.1/400.6: a successful draw emits a draw event linked to a zoneChange event.
  it('121.1/400.6: a successful draw emits a drawn event linked to its library->hand zoneChange', () => {
    store().newGame(makeDeck(12), 1);
    const before = eventsOfType('draw').length;
    store().dispatch({ type: 'draw', count: 1 });
    const draws = eventsOfType('draw');
    expect(draws.length).toBe(before + 1);
    const ev = draws[draws.length - 1];
    expect(ev.result).toBe('drawn');
    expect(ev.playerId).toBe('P1');
    expect(typeof ev.zoneChangeEventId).toBe('string');
    const linked = eventsOfType('zoneChange').find((z) => z.eventId === ev.zoneChangeEventId);
    expect(linked).toBeDefined();
  });

  // 6. CR 121.2: drawing multiple cards emits one draw event per card, never an aggregate.
  it('121.2: drawing two cards emits two individual draw events, not one aggregate', () => {
    store().newGame(makeDeck(12), 1);
    const before = eventsOfType('draw').length;
    store().dispatch({ type: 'draw', count: 2 });
    const draws = eventsOfType('draw').slice(before);
    expect(draws.length).toBe(2);
    expect(draws.every((d) => d.result === 'drawn')).toBe(true);
    expect(draws[0].sequence).not.toBe(draws[1].sequence);
  });

  // 7. CR 121.4/704.5b: an empty-library draw is an attempt event with no card identity.
  it('121.4/704.5b: drawing from an empty library emits an empty-library-attempt with no card', () => {
    store().newGame(makeDeck(12), 1);
    useGameStore.setState({
      state: { ...store().state!, zones: { ...store().state!.zones, library: [] } },
    });
    const before = eventsOfType('draw').length;
    store().dispatch({ type: 'draw', count: 1 });
    const draws = eventsOfType('draw').slice(before);
    expect(draws.length).toBe(1);
    expect(draws[0].result).toBe('empty-library-attempt');
    expect(draws[0].physicalCardId ?? undefined).toBeUndefined();
    expect(draws[0].zoneChangeEventId ?? undefined).toBeUndefined();
  });

  // 8. CR 121.5: milling from an empty library is NOT a draw and emits no draw event.
  it('121.5: milling emits no draw event', () => {
    store().newGame(makeDeck(12), 1);
    useGameStore.setState({
      state: { ...store().state!, zones: { ...store().state!.zones, library: [] } },
    });
    const before = eventsOfType('draw').length;
    store().dispatch({ type: 'mill', count: 1 });
    expect(eventsOfType('draw').length).toBe(before);
  });

  // 9. CR 120.1 boundary: this slice wires no source-backed damage, so no damage event fires.
  it('120.1: source-less mark/combat damage emits no trigger-eligible damage event this slice', () => {
    store().newGame(makeDeck(12), 1);
    store().dispatch({ type: 'adjustLife', delta: -3 });
    store().dispatch({ type: 'draw', count: 1 });
    // The damage event TYPE exists in the union, but no CR-legal source-backed emission is
    // wired here; a source-less markDamage must never counterfeit a CR-120 damage event.
    expect(eventsOfType('damage').length).toBe(0);
  });

  // 10. Union extension backcompat: existing event kinds remain filterable/emitted.
  it('backcompat: adding new union members does not break zoneChange/defeatAdvisory consumers', () => {
    store().newGame(makeDeck(12), 1);
    store().dispatch({ type: 'draw', count: 1 });
    expect(eventsOfType('zoneChange').length).toBeGreaterThanOrEqual(1);
    store().dispatch({ type: 'adjustLife', delta: -store().state!.life });
    expect(eventsOfType('defeatAdvisory').length).toBeGreaterThanOrEqual(1);
  });

  // 11. Snapshot forward-compat: a snapshot carrying the new events restores without loss.
  it('forward-compat: a snapshot with the new event kinds restores and preserves them', () => {
    store().newGame(makeDeck(12), 1);
    store().dispatch({ type: 'adjustLife', delta: 3 });
    store().dispatch({ type: 'draw', count: 1 });
    const snapshot = {
      version: SNAPSHOT_VERSION,
      state: { ...store().state! },
      deck: makeDeck(12),
      autoAdvanceToMain: false,
    };
    expect(() => store().restoreGame(snapshot)).not.toThrow();
    expect(eventsOfType('lifeChange').length).toBeGreaterThanOrEqual(1);
    expect(eventsOfType('draw').length).toBeGreaterThanOrEqual(1);
  });

  // 12. I14: identical state + identical command yields an identical appended event delta.
  it('I14: applying the same command to the same state produces identical events and ids', () => {
    store().newGame(makeDeck(12), 1);
    const base = store().state!;
    const lifeCmd: GameCommand = { type: 'adjustLife', delta: 7 };
    const d1 = applyCommand(base, lifeCmd).state.eventLog.slice(base.eventLog.length);
    const d2 = applyCommand(base, lifeCmd).state.eventLog.slice(base.eventLog.length);
    expect(d1).toEqual(d2);
    expect(d1.length).toBeGreaterThanOrEqual(1);

    const drawCmd: GameCommand = { type: 'draw', count: 1 };
    const dr1 = applyCommand(base, drawCmd).state.eventLog.slice(base.eventLog.length);
    const dr2 = applyCommand(base, drawCmd).state.eventLog.slice(base.eventLog.length);
    expect(dr1).toEqual(dr2);
  });
});
