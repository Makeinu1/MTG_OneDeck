/**
 * Reviewer-owned acceptance pins for M-STACK-TRUST-HOTFIX.
 * Implementers must not edit this file; fix source/ordinary tests when it fails.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type { GameState } from '../../engine/types';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

function snap(): GameState {
  const state = store().state;
  if (!state) throw new Error('game state is not available');
  return state;
}

function instanceId(defId: string): string {
  const id = Object.values(snap().cards).find((card) => card.defId === defId)?.id;
  if (!id) throw new Error(`missing ${defId}`);
  return id;
}

function clearPendingTriggers(): void {
  const state = snap();
  useGameStore.setState({
    state: { ...state, pendingTriggers: [] },
    triggerCandidates: [],
  });
}

function setupKelpieAndRing(): { kelpieId: string; ringId: string } {
  const kelpie = makeDef({
    scryfallId: 'msth-kelpie-guide',
    typeLine: 'Creature',
    faces: [{
      name: 'Kelpie Guide',
      typeLine: 'Creature',
      oracleText:
        '{T}: Untap another target permanent you control.\n{T}: Tap target permanent. Activate only if you control eight or more lands.',
    }],
  });
  const ring = makeDef({
    scryfallId: 'msth-the-one-ring',
    typeLine: 'Legendary Artifact',
    faces: [{
      name: 'The One Ring',
      typeLine: 'Legendary Artifact',
      oracleText:
        'Indestructible\nWhen The One Ring enters, if you cast it, you gain protection from everything until your next turn.\nAt the beginning of your upkeep, you lose 1 life for each burden counter on The One Ring.\n{T}: Put a burden counter on The One Ring, then draw a card for each burden counter on The One Ring.',
    }],
  });
  store().newGame([
    { def: kelpie, isCommander: false },
    { def: ring, isCommander: false },
    ...makeDeck(20),
  ], 7301);
  store().keepOpeningHand();
  const kelpieId = instanceId(kelpie.scryfallId);
  const ringId = instanceId(ring.scryfallId);
  store().moveCard(kelpieId, 'battlefield');
  store().moveCard(ringId, 'battlefield');
  clearPendingTriggers();
  return { kelpieId, ringId };
}

function startKelpieManualSession(kelpieId: string): GameState {
  store().addAbilityToStack(kelpieId, 'activated', 1);
  const baseline = snap();
  store().resolveTop();
  expect(store().resolutionSession).toMatchObject({
    mode: 'top',
    stage: 'manual-required',
  });
  return baseline;
}

beforeEach(() => {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    pendingCast: null,
    resolutionSession: null,
    pendingCommanderResolution: null,
    pendingForceActivation: null,
    canUndo: false,
    canRedo: false,
    canUndoInteraction: false,
    canRedoInteraction: false,
    autoAdvanceToMain: false,
    mulliganDecisionPending: false,
  });
});

describe('M-STACK-TRUST-HOTFIX resolution-session undo boundary', () => {
  it('aborts the untouched Kelpie manual resolution with the existing first Undo', () => {
    const { kelpieId } = setupKelpieAndRing();
    const baseline = startKelpieManualSession(kelpieId);

    expect(store().canUndoInteraction).toBe(true);
    store().undo();

    expect(store().resolutionSession).toBeNull();
    expect(store().state).toEqual(baseline);
    expect(store().canRedoInteraction).toBe(false);
    store().redo();
    expect(store().state).toEqual(baseline);
    expect(store().resolutionSession).toBeNull();
  });

  it('undoes manual steps first, then aborts the whole resolution at the boundary', () => {
    const { kelpieId } = setupKelpieAndRing();
    const baseline = startKelpieManualSession(kelpieId);
    const lifeBefore = snap().life;
    store().dispatch({ type: 'adjustLife', delta: -1 });

    store().undo();
    expect(snap().life).toBe(lifeBefore);
    expect(store().resolutionSession).not.toBeNull();
    expect(store().canUndoInteraction).toBe(true);

    store().undo();
    expect(store().resolutionSession).toBeNull();
    expect(store().state).toEqual(baseline);
  });

  it('aborts a Swan Song partial handoff back to its pre-resolution stack', () => {
    const swan = makeDef({
      scryfallId: 'msth-swan-song', typeLine: 'Instant',
      faces: [{
        name: 'Swan Song', typeLine: 'Instant', manaCost: '{U}',
        oracleText:
          'Counter target enchantment, instant, or sorcery spell. Its controller creates a 2/2 blue Bird creature token with flying.',
      }],
    });
    const target = makeDef({
      scryfallId: 'msth-swan-target', typeLine: 'Sorcery',
      faces: [{ name: 'Target', typeLine: 'Sorcery', oracleText: 'Draw a card.' }],
    });
    store().newGame([
      { def: swan, isCommander: false },
      { def: target, isCommander: false },
      ...makeDeck(20),
    ], 7302);
    store().keepOpeningHand();
    const swanId = instanceId(swan.scryfallId);
    const targetId = instanceId(target.scryfallId);
    store().moveCard(swanId, 'hand');
    store().moveCard(targetId, 'stack');
    store().adjustMana('U', 1);
    expect(store().castToStack(swanId)).toBe('needs-choice');
    store().answerPendingCastTarget(targetId);
    store().confirmPendingCast();
    const baseline = snap();

    store().resolveTop();
    expect(store().resolutionSession).toMatchObject({ reason: 'partial' });
    expect(snap().cards[targetId].zone).toBe('graveyard');
    store().undo();

    expect(store().resolutionSession).toBeNull();
    expect(store().state).toEqual(baseline);
    expect(snap().cards[targetId].zone).toBe('stack');
    expect(snap().cards[swanId].zone).toBe('stack');
  });

  it('aborts resolveAll to its group start without leaving a duplicate global anchor', () => {
    const manual = makeDef({
      scryfallId: 'msth-manual-bottom', typeLine: 'Instant',
      faces: [{ name: 'Manual', typeLine: 'Instant', oracleText: 'Do an unsupported thing.' }],
    });
    const automatic = makeDef({
      scryfallId: 'msth-automatic-top', typeLine: 'Instant',
      faces: [{ name: 'Automatic', typeLine: 'Instant', oracleText: 'Draw a card.' }],
    });
    store().newGame([
      { def: manual, isCommander: false },
      { def: automatic, isCommander: false },
      ...makeDeck(20),
    ], 7303);
    store().keepOpeningHand();
    const manualId = instanceId(manual.scryfallId);
    const automaticId = instanceId(automatic.scryfallId);
    store().moveCard(manualId, 'stack');
    store().moveCard(automaticId, 'stack');
    const batchStart = snap();

    store().resolveAll();
    expect(store().resolutionSession).toMatchObject({ mode: 'all', sourceId: manualId });
    expect(snap().cards[automaticId].zone).toBe('graveyard');
    store().undo();

    expect(store().resolutionSession).toBeNull();
    expect(store().state).toEqual(batchStart);

    store().undo();
    expect(store().state).not.toEqual(batchStart);
    expect(snap().cards[automaticId].zone).not.toBe('stack');
  });

  it('preserves a pre-existing global redo when resolveAll is aborted', () => {
    const manual = makeDef({
      scryfallId: 'msth-redo-manual-bottom', typeLine: 'Instant',
      faces: [{ name: 'Manual Redo Boundary', typeLine: 'Instant', oracleText: 'Do an unsupported thing.' }],
    });
    const automatic = makeDef({
      scryfallId: 'msth-redo-automatic-top', typeLine: 'Instant',
      faces: [{ name: 'Automatic Redo Boundary', typeLine: 'Instant', oracleText: 'Draw a card.' }],
    });
    store().newGame([
      { def: manual, isCommander: false },
      { def: automatic, isCommander: false },
      ...makeDeck(20),
    ], 7304);
    store().keepOpeningHand();
    const manualId = instanceId(manual.scryfallId);
    const automaticId = instanceId(automatic.scryfallId);
    store().moveCard(manualId, 'stack');
    store().moveCard(automaticId, 'stack');

    store().adjustMana('C', 1);
    store().undo();
    expect(snap().manaPool.C).toBe(0);
    expect(store().canRedo).toBe(true);
    const batchStart = snap();

    store().resolveAll();
    expect(store().resolutionSession).toMatchObject({ mode: 'all', sourceId: manualId });
    expect(snap().cards[automaticId].zone).toBe('graveyard');
    store().undo();

    expect(store().resolutionSession).toBeNull();
    expect(store().state).toEqual(batchStart);
    expect(store().canRedo).toBe(true);
    expect(store().canRedoInteraction).toBe(false);

    store().redo();
    expect(snap().manaPool.C).toBe(1);
  });

  it('preserves all 200 global Undo entries when a full history resolveAll is aborted', () => {
    const manual = makeDef({
      scryfallId: 'msth-history-cap-manual', typeLine: 'Instant',
      faces: [{ name: 'Manual History Cap', typeLine: 'Instant', oracleText: 'Do an unsupported thing.' }],
    });
    const automatic = makeDef({
      scryfallId: 'msth-history-cap-automatic', typeLine: 'Instant',
      faces: [{ name: 'Automatic History Cap', typeLine: 'Instant', oracleText: 'Draw a card.' }],
    });
    store().newGame([
      { def: manual, isCommander: false },
      { def: automatic, isCommander: false },
      ...makeDeck(20),
    ], 7305);
    store().keepOpeningHand();
    const manualId = instanceId(manual.scryfallId);
    const automaticId = instanceId(automatic.scryfallId);
    store().moveCard(manualId, 'stack');
    store().moveCard(automaticId, 'stack');
    for (let index = 0; index < 205; index += 1) {
      store().adjustMana('C', index % 2 === 0 ? 1 : -1);
    }

    store().resolveAll();
    expect(store().resolutionSession).toMatchObject({ mode: 'all', sourceId: manualId });
    store().undo();
    expect(store().resolutionSession).toBeNull();

    let undoCount = 0;
    while (store().canUndo && undoCount <= 200) {
      store().undo();
      undoCount += 1;
    }
    expect(undoCount).toBe(200);
  });
});
