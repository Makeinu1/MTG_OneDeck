import { beforeEach, describe, expect, it } from 'vitest';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

function instanceId(defId: string): string {
  const id = Object.values(store().state?.cards ?? {}).find((card) => card.defId === defId)?.id;
  if (!id) throw new Error(`missing ${defId}`);
  return id;
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

describe('stack control compatibility', () => {
  it('keeps resolve-time target guidance for a legacy counter placed directly on the stack', () => {
    const counter = makeDef({
      scryfallId: 'ordinary-legacy-counter',
      typeLine: 'Instant',
      faces: [{ name: 'Counterspell', typeLine: 'Instant', oracleText: 'Counter target spell.' }],
    });
    const target = makeDef({
      scryfallId: 'ordinary-legacy-target',
      typeLine: 'Sorcery',
      faces: [{ name: 'Target', typeLine: 'Sorcery', oracleText: 'Draw a card.' }],
    });
    store().newGame([
      { def: counter, isCommander: false },
      { def: target, isCommander: false },
      ...makeDeck(10),
    ], 301);
    const counterId = instanceId(counter.scryfallId);
    const targetId = instanceId(target.scryfallId);
    store().moveCard(targetId, 'stack');
    store().moveCard(counterId, 'stack');

    store().resolveTop();

    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      kind: 'target',
      filter: { zone: 'stack' },
    });
    expect(store().state?.cards[counterId].zone).toBe('stack');
  });

  it('keeps resolveAll as one global undo across a manual soft-gate pause', () => {
    const manual = makeDef({
      scryfallId: 'ordinary-manual-bottom',
      typeLine: 'Instant',
      faces: [{ name: 'Manual', typeLine: 'Instant', oracleText: 'Do an unsupported thing.' }],
    });
    const automatic = makeDef({
      scryfallId: 'ordinary-auto-top',
      typeLine: 'Instant',
      faces: [{ name: 'Automatic', typeLine: 'Instant', oracleText: 'Draw a card.' }],
    });
    store().newGame([
      { def: manual, isCommander: false },
      { def: automatic, isCommander: false },
      ...makeDeck(12),
    ], 302);
    const manualId = instanceId(manual.scryfallId);
    const automaticId = instanceId(automatic.scryfallId);
    store().moveCard(manualId, 'stack');
    store().moveCard(automaticId, 'stack');
    const baseline = store().state;

    store().resolveAll();
    expect(store().resolutionSession).toMatchObject({ mode: 'all', sourceId: manualId });
    expect(store().state?.cards[automaticId].zone).toBe('graveyard');

    store().resolveAll();
    store().completeManualResolution();
    expect(store().state?.zones.stack).toHaveLength(0);
    store().undo();
    expect(store().state).toEqual(baseline);
  });

  it('stops resolveAll for a trigger created by manual work and closes the undo batch', () => {
    const watcher = makeDef({
      scryfallId: 'ordinary-trigger-watcher',
      typeLine: 'Creature',
      faces: [{
        name: 'Watcher',
        typeLine: 'Creature',
        oracleText: 'Whenever another creature enters the battlefield, you gain 1 life.',
      }],
    });
    const entering = makeDef({ scryfallId: 'ordinary-trigger-entering', typeLine: 'Creature' });
    const lower = makeDef({
      scryfallId: 'ordinary-trigger-lower',
      typeLine: 'Sorcery',
      faces: [{ name: 'Lower', typeLine: 'Sorcery', oracleText: 'Draw a card.' }],
    });
    const manual = makeDef({
      scryfallId: 'ordinary-trigger-manual',
      typeLine: 'Instant',
      faces: [{ name: 'Manual', typeLine: 'Instant', oracleText: 'Do an unsupported thing.' }],
    });
    store().newGame([
      { def: watcher, isCommander: false },
      { def: entering, isCommander: false },
      { def: lower, isCommander: false },
      { def: manual, isCommander: false },
      ...makeDeck(12),
    ], 303);
    const watcherId = instanceId(watcher.scryfallId);
    const enteringId = instanceId(entering.scryfallId);
    const lowerId = instanceId(lower.scryfallId);
    const manualId = instanceId(manual.scryfallId);
    store().moveCard(watcherId, 'battlefield');
    store().moveCard(lowerId, 'stack');
    store().moveCard(manualId, 'stack');
    const baseline = store().state;

    store().resolveAll();
    store().moveCard(enteringId, 'battlefield');
    store().completeManualResolution();

    expect(store().state?.cards[lowerId].zone).toBe('stack');
    expect(store().triggerCandidates).toEqual([
      expect.objectContaining({ sourceId: watcherId, triggerId: 'trigger.etb-other' }),
    ]);
    store().undo();
    expect(store().state).toEqual(baseline);
  });

  it('blocks stack-copy responses while a manual resolution session is open', () => {
    const manual = makeDef({
      scryfallId: 'ordinary-copy-guard',
      typeLine: 'Instant',
      faces: [{ name: 'Manual', typeLine: 'Instant', oracleText: 'Do an unsupported thing.' }],
    });
    store().newGame([{ def: manual, isCommander: false }, ...makeDeck(10)], 304);
    const manualId = instanceId(manual.scryfallId);
    store().moveCard(manualId, 'stack');
    store().resolveTop();
    const before = store().state;

    store().copyStackItem(manualId);

    expect(store().state).toBe(before);
    expect(store().state?.zones.stack).toEqual([manualId]);
    expect(store().warnings.at(-1)).toContain('手動処理を完了');
  });
});
