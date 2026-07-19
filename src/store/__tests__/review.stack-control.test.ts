/**
 * Reviewer-owned end-to-end store contract for M-STACK-CONTROL.
 * Implementers must not edit this file; fix source/ordinary tests when it fails.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

function cardId(defId: string): string {
  const id = Object.values(store().state?.cards ?? {}).find((card) => card.defId === defId)?.id;
  if (!id) throw new Error(`missing ${defId}`);
  return id;
}

function setup() {
  const counter = makeDef({
    scryfallId: 'msc-counter', typeLine: 'Instant',
    faces: [{ name: 'Counterspell', typeLine: 'Instant', manaCost: '{U}', oracleText: 'Counter target spell.' }],
  });
  const swan = makeDef({
    scryfallId: 'msc-swan-song', typeLine: 'Instant',
    faces: [{
      name: 'Swan Song', typeLine: 'Instant', manaCost: '{U}',
      oracleText: 'Counter target enchantment, instant, or sorcery spell. Its controller creates a 2/2 blue Bird creature token with flying.',
    }],
  });
  const target = makeDef({
    scryfallId: 'msc-target', typeLine: 'Sorcery',
    faces: [{ name: 'Target Spell', typeLine: 'Sorcery', oracleText: 'Draw a card.' }],
  });
  const manual = makeDef({
    scryfallId: 'msc-manual', typeLine: 'Instant',
    faces: [{ name: 'Manual Spell', typeLine: 'Instant', oracleText: 'Do something the engine cannot model.' }],
  });
  store().newGame([
    { def: counter, isCommander: false }, { def: swan, isCommander: false },
    { def: target, isCommander: false }, { def: manual, isCommander: false },
    ...makeDeck(12),
  ], 91);
  const ids = {
    counter: cardId('msc-counter'), swan: cardId('msc-swan-song'),
    target: cardId('msc-target'), manual: cardId('msc-manual'),
  };
  store().moveCard(ids.counter, 'hand');
  store().moveCard(ids.swan, 'hand');
  store().moveCard(ids.target, 'stack');
  store().moveCard(ids.manual, 'hand');
  store().adjustMana('U', 2);
  return ids;
}

beforeEach(() => {
  useGameStore.setState({
    state: null, warnings: [], triggerCandidates: [], pendingGuided: null,
    pendingCast: null, resolutionSession: null,
    pendingCommanderResolution: null, pendingForceActivation: null,
    canUndo: false, canRedo: false, canUndoInteraction: false, canRedoInteraction: false,
    mulliganDecisionPending: false,
  });
});

describe('M-STACK-CONTROL cast transaction and resolution soft gate', () => {
  it('chooses a counter target before payment and cancel is state-atomic', () => {
    const ids = setup();
    const before = store().state;
    expect(store().castToStack(ids.counter)).toBe('needs-choice');
    expect(store().state).toBe(before);
    expect(store().pendingCast?.prompts[0]).toMatchObject({
      kind: 'target', filter: { zone: 'stack' },
    });
    store().cancelPendingCast();
    expect(store().pendingCast).toBeNull();
    expect(store().state).toBe(before);
  });

  it('commits payment, cast, and checked target as one undo step', () => {
    const ids = setup();
    expect(store().castToStack(ids.counter)).toBe('needs-choice');
    store().answerPendingCastTarget(ids.target);
    store().confirmPendingCast();

    expect(store().state?.manaPool.U).toBe(1);
    expect(store().state?.cards[ids.counter].zone).toBe('stack');
    expect(store().state?.cards[ids.counter].targetSelections).toEqual([
      expect.objectContaining({ slotId: 'target-0', legalityMode: 'checked' }),
    ]);
    expect(store().pendingCast).toBeNull();

    store().undo();
    expect(store().state?.manaPool.U).toBe(2);
    expect(store().state?.cards[ids.counter].zone).toBe('hand');
    expect(store().state?.cards[ids.target].zone).toBe('stack');
  });

  it('Swan Song executes only the safe counter leaf, then soft-gates the Bird remainder', () => {
    const ids = setup();
    expect(store().castToStack(ids.swan)).toBe('needs-choice');
    store().answerPendingCastTarget(ids.target);
    store().confirmPendingCast();

    store().resolveTop();
    expect(store().state?.cards[ids.target].zone).toBe('graveyard');
    expect(store().state?.cards[ids.swan].zone).toBe('stack');
    expect(store().resolutionSession).toMatchObject({
      sourceId: ids.swan, stage: 'manual-required', reason: 'partial',
    });
    expect(store().resolutionSession?.tasks[0]?.message).toContain('手動');

    store().completeManualResolution();
    expect(store().resolutionSession).toBeNull();
    expect(store().state?.cards[ids.swan].zone).toBe('graveyard');
    store().undo();
    expect(store().state?.cards[ids.target].zone).toBe('stack');
    expect(store().state?.cards[ids.swan].zone).toBe('stack');
  });

  it('does not execute Swan Song remainder when its only checked target is illegal', () => {
    const ids = setup();
    store().castToStack(ids.swan);
    store().answerPendingCastTarget(ids.target);
    store().confirmPendingCast();
    store().removeStackItem(ids.target);
    store().resolveTop();

    expect(store().state?.cards[ids.swan].zone).toBe('graveyard');
    expect(store().resolutionSession).toBeNull();
    expect(store().state?.log.at(-1)?.message).toContain('対象不適正');
  });

  it('keeps a wholly unsupported spell on the stack until manual completion', () => {
    const ids = setup();
    store().moveCard(ids.manual, 'stack');
    const baseline = store().state;
    store().resolveTop();
    expect(store().resolutionSession).toMatchObject({
      sourceId: ids.manual, stage: 'manual-required', reason: 'unsupported',
    });
    expect(store().state?.cards[ids.manual].zone).toBe('stack');

    store().adjustMana('C', 1);
    expect(store().state?.manaPool.C).toBe(1);
    store().undo();
    expect(store().state?.manaPool.C).toBe(0);
    expect(store().resolutionSession).not.toBeNull();

    store().completeManualResolution();
    expect(store().state?.cards[ids.manual].zone).toBe('graveyard');
    store().undo();
    expect(store().state).toEqual(baseline);
  });

  it('pauses resolveAll at triggers created by manual work before resolving a lower item', () => {
    const watcher = makeDef({
      scryfallId: 'msc-trigger-watcher', typeLine: 'Creature',
      faces: [{
        name: 'Watcher', typeLine: 'Creature',
        oracleText: 'Whenever another creature enters the battlefield, you gain 1 life.',
      }],
    });
    const entering = makeDef({
      scryfallId: 'msc-trigger-entering', typeLine: 'Creature',
      faces: [{ name: 'Entering Creature', typeLine: 'Creature', oracleText: '' }],
    });
    const lower = makeDef({
      scryfallId: 'msc-trigger-lower', typeLine: 'Sorcery',
      faces: [{ name: 'Lower Spell', typeLine: 'Sorcery', oracleText: 'Draw a card.' }],
    });
    const manual = makeDef({
      scryfallId: 'msc-trigger-manual', typeLine: 'Instant',
      faces: [{ name: 'Manual Top', typeLine: 'Instant', oracleText: 'Do an unsupported thing.' }],
    });
    store().newGame([
      { def: watcher, isCommander: false }, { def: entering, isCommander: false },
      { def: lower, isCommander: false }, { def: manual, isCommander: false },
      ...makeDeck(12),
    ], 92);
    const watcherId = cardId(watcher.scryfallId);
    const enteringId = cardId(entering.scryfallId);
    const lowerId = cardId(lower.scryfallId);
    const manualId = cardId(manual.scryfallId);
    store().moveCard(watcherId, 'battlefield');
    store().moveCard(lowerId, 'stack');
    store().moveCard(manualId, 'stack');
    const baseline = store().state;

    store().resolveAll();
    expect(store().resolutionSession?.sourceId).toBe(manualId);
    store().moveCard(enteringId, 'battlefield');
    expect(store().triggerCandidates).toEqual([]);
    store().completeManualResolution();

    expect(store().state?.cards[lowerId].zone).toBe('stack');
    expect(store().triggerCandidates).toEqual([
      expect.objectContaining({ sourceId: watcherId, triggerId: 'trigger.etb-other' }),
    ]);
    store().undo();
    expect(store().state).toEqual(baseline);
  });

  it('does not let a reentrant resolveAll call split the active manual batch undo', () => {
    const ids = setup();
    store().moveCard(ids.target, 'hand');
    store().moveCard(ids.manual, 'stack');
    store().moveCard(ids.target, 'stack');
    const baseline = store().state;

    store().resolveAll();
    expect(store().resolutionSession?.sourceId).toBe(ids.manual);
    store().resolveAll();
    store().completeManualResolution();
    store().undo();

    expect(store().state).toEqual(baseline);
  });
});
