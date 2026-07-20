import { beforeEach, describe, expect, it } from 'vitest';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type { GameState } from '../../engine/types';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

function snap(): GameState {
  const state = store().state;
  if (!state) throw new Error('state unavailable');
  return state;
}

function instanceId(defId: string): string {
  const id = Object.values(snap().cards).find((card) => card.defId === defId)?.id;
  if (!id) throw new Error(`missing ${defId}`);
  return id;
}

function manualDef(id: string) {
  return makeDef({
    scryfallId: id,
    typeLine: 'Instant',
    faces: [{ name: id, typeLine: 'Instant', oracleText: 'Do an unsupported thing.' }],
  });
}

function startManualSession(id = 'ordinary-hotfix-manual'): { sourceId: string; baseline: GameState } {
  const manual = manualDef(id);
  store().newGame([{ def: manual, isCommander: false }, ...makeDeck(16)], 8301);
  store().keepOpeningHand();
  const sourceId = instanceId(manual.scryfallId);
  store().moveCard(sourceId, 'stack');
  const baseline = snap();
  store().resolveTop();
  expect(store().resolutionSession).toMatchObject({ reason: 'unsupported' });
  return { sourceId, baseline };
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
    mulliganDecisionPending: false,
  });
});

describe('manual resolution session undo boundary', () => {
  it('aborts a completely manual session and rebuilds baseline trigger candidates', () => {
    const watcher = makeDef({
      scryfallId: 'ordinary-hotfix-watcher',
      typeLine: 'Creature',
      faces: [{
        name: 'Watcher',
        typeLine: 'Creature',
        oracleText: 'Whenever another creature enters the battlefield, you gain 1 life.',
      }],
    });
    const entering = makeDef({ scryfallId: 'ordinary-hotfix-entering', typeLine: 'Creature' });
    const manual = manualDef('ordinary-hotfix-trigger-manual');
    store().newGame([
      { def: watcher, isCommander: false },
      { def: entering, isCommander: false },
      { def: manual, isCommander: false },
      ...makeDeck(16),
    ], 8302);
    store().keepOpeningHand();
    const watcherId = instanceId(watcher.scryfallId);
    const enteringId = instanceId(entering.scryfallId);
    const manualId = instanceId(manual.scryfallId);
    store().moveCard(watcherId, 'battlefield');
    store().moveCard(enteringId, 'battlefield');
    store().moveCard(manualId, 'stack');
    const baseline = snap();
    expect(store().triggerCandidates).toHaveLength(1);

    store().resolveTop();
    expect(store().canUndoInteraction).toBe(true);
    expect(store().triggerCandidates).toEqual([]);
    store().undo();

    expect(store().resolutionSession).toBeNull();
    expect(store().state).toEqual(baseline);
    expect(store().triggerCandidates).toMatchObject([
      { sourceId: watcherId, triggerId: 'trigger.etb-other' },
    ]);
    expect(store().canRedoInteraction).toBe(false);
  });

  it('undoes and redoes local manual steps, then keeps Undo available for abort', () => {
    const { baseline } = startManualSession('ordinary-hotfix-local-history');
    store().dispatch({ type: 'adjustLife', delta: -1 });

    store().undo();
    expect(snap().life).toBe(baseline.life);
    expect(store().resolutionSession).not.toBeNull();
    expect(store().canUndoInteraction).toBe(true);
    expect(store().canRedoInteraction).toBe(true);

    store().redo();
    expect(snap().life).toBe(baseline.life - 1);
    store().undo();
    store().undo();
    expect(store().resolutionSession).toBeNull();
    expect(store().state).toEqual(baseline);
  });

  it('aborts partial and runtime-failure handoffs without creating redo entries', () => {
    const swan = makeDef({
      scryfallId: 'ordinary-hotfix-swan',
      typeLine: 'Instant',
      faces: [{
        name: 'Swan Song',
        typeLine: 'Instant',
        manaCost: '{U}',
        oracleText:
          'Counter target enchantment, instant, or sorcery spell. Its controller creates a 2/2 blue Bird creature token with flying.',
      }],
    });
    const target = makeDef({
      scryfallId: 'ordinary-hotfix-target',
      typeLine: 'Sorcery',
      faces: [{ name: 'Target', typeLine: 'Sorcery', oracleText: 'Draw a card.' }],
    });
    store().newGame([
      { def: swan, isCommander: false },
      { def: target, isCommander: false },
      ...makeDeck(16),
    ], 8303);
    store().keepOpeningHand();
    const swanId = instanceId(swan.scryfallId);
    const targetId = instanceId(target.scryfallId);
    store().moveCard(swanId, 'hand');
    store().moveCard(targetId, 'stack');
    store().adjustMana('U', 1);
    store().castToStack(swanId);
    store().answerPendingCastTarget(targetId);
    store().confirmPendingCast();
    const partialBaseline = snap();
    store().resolveTop();
    expect(store().resolutionSession?.reason).toBe('partial');
    store().undo();
    expect(store().state).toEqual(partialBaseline);
    expect(store().resolutionSession).toBeNull();

    const runtime = startManualSession('ordinary-hotfix-runtime');
    const session = store().resolutionSession;
    if (!session) throw new Error('runtime session unavailable');
    useGameStore.setState({
      resolutionSession: { ...session, reason: 'runtime-failure' },
    });
    store().undo();
    expect(store().state).toEqual(runtime.baseline);
    expect(store().resolutionSession).toBeNull();
    store().redo();
    expect(store().state).toEqual(runtime.baseline);
  });

  it('aborts resolveAll to its exact group anchor while preserving older history', () => {
    const manual = manualDef('ordinary-hotfix-all-manual');
    const automatic = makeDef({
      scryfallId: 'ordinary-hotfix-all-auto',
      typeLine: 'Instant',
      faces: [{ name: 'Automatic', typeLine: 'Instant', oracleText: 'Draw a card.' }],
    });
    store().newGame([
      { def: manual, isCommander: false },
      { def: automatic, isCommander: false },
      ...makeDeck(16),
    ], 8304);
    store().keepOpeningHand();
    const manualId = instanceId(manual.scryfallId);
    const automaticId = instanceId(automatic.scryfallId);
    store().moveCard(manualId, 'stack');
    store().moveCard(automaticId, 'stack');
    const batchStart = snap();

    store().resolveAll();
    expect(store().resolutionSession).toMatchObject({ mode: 'all', sourceId: manualId });
    store().undo();
    expect(store().state).toEqual(batchStart);
    store().undo();
    expect(snap().cards[automaticId].zone).not.toBe('stack');
  });

  it('restores the global redo lane only when a resolveAll batch is aborted', () => {
    const manual = manualDef('ordinary-hotfix-redo-manual');
    const automatic = makeDef({
      scryfallId: 'ordinary-hotfix-redo-auto',
      typeLine: 'Instant',
      faces: [{ name: 'Automatic Redo', typeLine: 'Instant', oracleText: 'Draw a card.' }],
    });
    store().newGame([
      { def: manual, isCommander: false },
      { def: automatic, isCommander: false },
      ...makeDeck(16),
    ], 8305);
    store().keepOpeningHand();
    const manualId = instanceId(manual.scryfallId);
    const automaticId = instanceId(automatic.scryfallId);
    store().moveCard(manualId, 'stack');
    store().moveCard(automaticId, 'stack');
    store().adjustMana('C', 1);
    store().undo();
    const batchStart = snap();
    expect(store().canRedo).toBe(true);

    store().resolveAll();
    expect(store().resolutionSession).toMatchObject({ mode: 'all', sourceId: manualId });
    store().undo();

    expect(store().state).toEqual(batchStart);
    expect(store().canRedo).toBe(true);
    expect(store().canRedoInteraction).toBe(false);
    store().redo();
    expect(snap().manaPool.C).toBe(1);
  });

  it('discards the saved redo lane when resolveAll completes normally', () => {
    const automatic = makeDef({
      scryfallId: 'ordinary-hotfix-redo-success',
      typeLine: 'Instant',
      faces: [{ name: 'Automatic Success', typeLine: 'Instant', oracleText: 'Draw a card.' }],
    });
    store().newGame([
      { def: automatic, isCommander: false },
      ...makeDeck(16),
    ], 8306);
    store().keepOpeningHand();
    const automaticId = instanceId(automatic.scryfallId);
    store().moveCard(automaticId, 'stack');
    store().adjustMana('C', 1);
    store().undo();
    expect(store().canRedo).toBe(true);

    store().resolveAll();

    expect(store().resolutionSession).toBeNull();
    expect(snap().cards[automaticId].zone).toBe('graveyard');
    expect(store().canRedo).toBe(false);
    const completed = snap();
    store().redo();
    expect(store().state).toBe(completed);
  });

  it('hides an old global redo while a session has no local future', () => {
    const { baseline } = startManualSession('ordinary-hotfix-redo-scope');
    store().undo();
    store().adjustMana('C', 1);
    store().undo();
    expect(store().canRedo).toBe(true);

    // Restore the manual stack baseline through global redo, then create a
    // fresh global future and enter the session without committing state.
    store().redo();
    store().undo();
    expect(store().state).toEqual(baseline);
    store().resolveTop();
    expect(store().canRedo).toBe(false);
    expect(store().canRedoInteraction).toBe(false);
    const sessionState = snap();
    store().redo();
    expect(store().state).toBe(sessionState);
  });
});
