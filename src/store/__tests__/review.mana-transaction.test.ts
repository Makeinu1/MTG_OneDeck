// REVIEWER-OWNED acceptance contract for S-EVENTS / MANA (CR 605.1b / 605.4a).
// Implementation agents must NOT edit this file. If it fails, fix the engine.
//
// Independent adversarial pins for the mana-ability transaction substrate:
//   1. CR 605.1b mana-added triggered mana ability resolves inside the transaction,
//      never on the stack, never in GameState.pendingTriggers, and fires exactly once
//      (no double-fire from the activated/resolved event pair).
//   2. A non-mana-event add-mana trigger is an ORDINARY trigger (CR 605.5a) and is
//      never consumed by the mana transaction.
//   3. A targeted add-mana trigger fails CR 605.1b's targetless requirement -> ordinary.
//   4. The activation-source clause of CR 605.1b is DEFERRED to C-GRAMMAR: it must not
//      fire (and must not double-fire) from the substrate's heuristic. When C-GRAMMAR
//      implements real activation-source detection, the reviewer updates this pin.
//   5. Infinite 605.1b chains are bounded by an iteration cap with a warning, and
//      nothing escapes to the stack or to pendingTriggers.

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
  const card = Object.values(store().state?.cards ?? {}).find(
    (instance) => instance.defId === defId,
  );
  if (!card) {
    throw new Error(`card instance not found for ${defId}`);
  }
  return card.id;
}

describe('review.mana-transaction: CR 605.1b triggered mana ability substrate', () => {
  beforeEach(() => {
    resetStore();
  });

  it('mana-added 605.1b resolves no-stack inside the transaction, exactly once', () => {
    const land = makeDef({
      scryfallId: 'rev-mana-land',
      typeLine: 'Land',
      producedMana: ['G'],
      faces: [{ name: 'Reviewer Land', typeLine: 'Land', oracleText: '{T}: Add {G}.' }],
    });
    const watcher = makeDef({
      scryfallId: 'rev-mana-watcher',
      typeLine: 'Enchantment',
      faces: [
        {
          name: 'Reviewer Mana Watcher',
          typeLine: 'Enchantment',
          oracleText:
            'Whenever a player taps a land for mana, that player adds one mana of any type that land produced.',
        },
      ],
    });

    store().newGame(
      [
        { def: land, isCommander: false },
        { def: watcher, isCommander: false },
        ...makeDeck(12),
      ],
      1,
    );
    const landId = findInstanceId(land.scryfallId);
    const watcherId = findInstanceId(watcher.scryfallId);
    store().moveCard(landId, 'battlefield');
    store().moveCard(watcherId, 'battlefield');
    const stackBefore = store().state?.zones.stack.length ?? 0;

    store().activateAbility(landId);

    const state = store().state;
    // land's own {T}: Add {G} = 1, watcher fires EXACTLY once = 1. Double-fire would be 3.
    expect(state?.manaPool.G).toBe(2);
    expect(state?.zones.stack.length).toBe(stackBefore);
    expect(state?.pendingTriggers).toEqual([]);
    expect(store().triggerCandidates).toEqual([]);
  });

  it('non-mana-event add-mana trigger is ordinary (CR 605.5a), not consumed by the transaction', () => {
    const watcher = makeDef({
      scryfallId: 'rev-cast-add-mana',
      typeLine: 'Enchantment',
      faces: [
        {
          name: 'Reviewer Cast Mana',
          typeLine: 'Enchantment',
          oracleText: 'Whenever you cast a spell, add {G}.',
        },
      ],
    });
    const spell = makeDef({
      scryfallId: 'rev-free-spell',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'Reviewer Free Spell',
          typeLine: 'Sorcery',
          manaCost: '',
          oracleText: 'Draw a card.',
        },
      ],
    });

    store().newGame(
      [
        { def: watcher, isCommander: false },
        { def: spell, isCommander: false },
        ...makeDeck(12),
      ],
      1,
    );
    const watcherId = findInstanceId(watcher.scryfallId);
    const spellId = findInstanceId(spell.scryfallId);
    store().moveCard(watcherId, 'battlefield');
    store().moveCard(spellId, 'hand');

    store().dispatch({
      type: 'castToStack',
      cardId: spellId,
      payment: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      forced: false,
    });

    const state = store().state;
    expect(state?.manaPool.G).toBe(0);
    expect(state?.pendingTriggers.some((t) => t.sourceId === watcherId)).toBe(true);
  });

  it('targeted add-mana trigger fails the CR 605.1b targetless requirement -> ordinary', () => {
    const watcher = makeDef({
      scryfallId: 'rev-targeted-add-mana',
      typeLine: 'Enchantment',
      faces: [
        {
          name: 'Reviewer Targeted Mana',
          typeLine: 'Enchantment',
          oracleText: 'Whenever you cast a spell, target player adds {G}.',
        },
      ],
    });
    const spell = makeDef({
      scryfallId: 'rev-target-spell',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'Reviewer Target Spell',
          typeLine: 'Sorcery',
          manaCost: '',
          oracleText: 'Draw a card.',
        },
      ],
    });

    store().newGame(
      [
        { def: watcher, isCommander: false },
        { def: spell, isCommander: false },
        ...makeDeck(12),
      ],
      1,
    );
    const watcherId = findInstanceId(watcher.scryfallId);
    const spellId = findInstanceId(spell.scryfallId);
    store().moveCard(watcherId, 'battlefield');
    store().moveCard(spellId, 'hand');

    store().dispatch({
      type: 'castToStack',
      cardId: spellId,
      payment: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      forced: false,
    });

    const state = store().state;
    expect(state?.manaPool.G).toBe(0);
    expect(state?.pendingTriggers.some((t) => t.sourceId === watcherId)).toBe(true);
  });

  it('activation-source 605.1b detection is DEFERRED to C-GRAMMAR: no fire, no double-fire', () => {
    // Until C-GRAMMAR builds IR-grade activation-source detection, an activation-worded
    // 605.1b watcher must NOT be resolved by the substrate's heuristic (which would
    // double-fire across the emitted 'activated'/'resolved' events). Reviewer-owned:
    // when activation-source detection lands, this expectation is updated deliberately.
    const land = makeDef({
      scryfallId: 'rev-act-land',
      typeLine: 'Land',
      producedMana: ['C'],
      faces: [{ name: 'Reviewer Plain Land', typeLine: 'Land', oracleText: '{T}: Add {C}.' }],
    });
    const watcher = makeDef({
      scryfallId: 'rev-activation-watcher',
      typeLine: 'Enchantment',
      faces: [
        {
          name: 'Reviewer Activation Watcher',
          typeLine: 'Enchantment',
          oracleText: 'Whenever you activate a mana ability, add {G}.',
        },
      ],
    });

    store().newGame(
      [
        { def: land, isCommander: false },
        { def: watcher, isCommander: false },
        ...makeDeck(12),
      ],
      1,
    );
    const landId = findInstanceId(land.scryfallId);
    const watcherId = findInstanceId(watcher.scryfallId);
    store().moveCard(landId, 'battlefield');
    store().moveCard(watcherId, 'battlefield');

    store().activateAbility(landId);

    const state = store().state;
    expect(state?.manaPool.C).toBe(1); // land's own mana
    expect(state?.manaPool.G).toBe(0); // deferred: watcher does not (double-)fire
    expect(state?.pendingTriggers).toEqual([]);
  });

  it('infinite 605.1b chains are bounded by the iteration cap; nothing escapes to the stack', () => {
    const land = makeDef({
      scryfallId: 'rev-loop-land',
      typeLine: 'Land',
      producedMana: ['G'],
      faces: [{ name: 'Reviewer Loop Land', typeLine: 'Land', oracleText: '{T}: Add {G}.' }],
    });
    // Triggers on ANY mana being added and itself adds mana -> would loop forever.
    const loop = makeDef({
      scryfallId: 'rev-loop-watcher',
      typeLine: 'Enchantment',
      faces: [
        {
          name: 'Reviewer Loop Watcher',
          typeLine: 'Enchantment',
          oracleText: 'Whenever one or more mana is added to a mana pool, add {G}.',
        },
      ],
    });

    store().newGame(
      [
        { def: land, isCommander: false },
        { def: loop, isCommander: false },
        ...makeDeck(12),
      ],
      1,
    );
    const landId = findInstanceId(land.scryfallId);
    const loopId = findInstanceId(loop.scryfallId);
    store().moveCard(landId, 'battlefield');
    store().moveCard(loopId, 'battlefield');
    const stackBefore = store().state?.zones.stack.length ?? 0;

    store().activateAbility(landId);

    const state = store().state;
    // Bounded, not hung. Cap warning surfaced. Nothing on the stack or pendingTriggers.
    expect(state?.zones.stack.length).toBe(stackBefore);
    expect(state?.pendingTriggers).toEqual([]);
    expect(store().warnings.some((w) => /605\.4a/.test(w))).toBe(true);
  });
});
