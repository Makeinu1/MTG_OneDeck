import { beforeEach, describe, expect, it } from 'vitest';

import { makeDef } from '../../engine/__tests__/helpers';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

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

function moveToBattlefield(cardId: string): void {
  store().moveCard(cardId, 'battlefield', 'bottom');
}

describe('CR 110.5 / 701.26 guided tap status writes', () => {
  beforeEach(() => {
    resetStore();
  });

  it('taps a selected permanent through the existing guided target flow', () => {
    const spell = makeDef({
      scryfallId: 'cr110-tap-spell',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'cr110-tap-spell',
          typeLine: 'Sorcery',
          oracleText: 'Tap target permanent.',
        },
      ],
    });
    const target = makeDef({
      scryfallId: 'cr110-tap-target',
      typeLine: 'Artifact',
      faces: [{ name: 'cr110-tap-target', typeLine: 'Artifact' }],
    });

    store().newGame(
      [
        { def: spell, isCommander: false },
        { def: target, isCommander: false },
      ],
      1,
    );
    const spellId = findInstanceId('cr110-tap-spell');
    const targetId = findInstanceId('cr110-tap-target');
    store().moveCard(spellId, 'stack', 'bottom');
    moveToBattlefield(targetId);

    store().resolveTop();

    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      atom: 'effect.tap',
      kind: 'target',
      filter: { types: ['permanent'] },
    });

    store().confirmGuidedTarget(targetId);

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.cards[targetId].tapped).toBe(true);
    expect(store().state!.cards[spellId].zone).toBe('graveyard');
  });

  it('untaps a selected artifact or creature through the existing guided target flow', () => {
    const spell = makeDef({
      scryfallId: 'cr110-untap-spell',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'cr110-untap-spell',
          typeLine: 'Sorcery',
          oracleText: 'Untap target artifact or creature.',
        },
      ],
    });
    const target = makeDef({
      scryfallId: 'cr110-untap-target',
      typeLine: 'Artifact Creature',
      faces: [{ name: 'cr110-untap-target', typeLine: 'Artifact Creature' }],
    });

    store().newGame(
      [
        { def: spell, isCommander: false },
        { def: target, isCommander: false },
      ],
      2,
    );
    const spellId = findInstanceId('cr110-untap-spell');
    const targetId = findInstanceId('cr110-untap-target');
    store().moveCard(spellId, 'stack', 'bottom');
    moveToBattlefield(targetId);
    store().dispatch({ type: 'setTapped', cardId: targetId, tapped: true });

    store().resolveTop();

    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      atom: 'effect.untap',
      kind: 'target',
      filter: { types: ['creature', 'artifact'] },
    });

    store().confirmGuidedTarget(targetId);

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.cards[targetId].tapped).toBe(false);
    expect(store().state!.cards[spellId].zone).toBe('graveyard');
  });

  it('warns but continues when tapping an already tapped permanent', () => {
    const spell = makeDef({
      scryfallId: 'cr110-tap-already-tapped-spell',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'cr110-tap-already-tapped-spell',
          typeLine: 'Sorcery',
          oracleText: 'Tap target permanent.',
        },
      ],
    });
    const target = makeDef({
      scryfallId: 'cr110-tap-already-tapped-target',
      typeLine: 'Artifact',
      faces: [{ name: 'cr110-tap-already-tapped-target', typeLine: 'Artifact' }],
    });

    store().newGame(
      [
        { def: spell, isCommander: false },
        { def: target, isCommander: false },
      ],
      3,
    );
    const spellId = findInstanceId('cr110-tap-already-tapped-spell');
    const targetId = findInstanceId('cr110-tap-already-tapped-target');
    store().moveCard(spellId, 'stack', 'bottom');
    moveToBattlefield(targetId);
    store().dispatch({ type: 'setTapped', cardId: targetId, tapped: true });

    store().resolveTop();
    store().confirmGuidedTarget(targetId);

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.cards[targetId].tapped).toBe(true);
    expect(store().state!.cards[spellId].zone).toBe('graveyard');
    expect(store().warnings.some((warning) => warning.includes('すでにタップ'))).toBe(true);
  });

  it('warns but continues when untapping an untapped permanent', () => {
    const spell = makeDef({
      scryfallId: 'cr110-untap-already-untapped-spell',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'cr110-untap-already-untapped-spell',
          typeLine: 'Sorcery',
          oracleText: 'Untap target artifact or creature.',
        },
      ],
    });
    const target = makeDef({
      scryfallId: 'cr110-untap-already-untapped-target',
      typeLine: 'Artifact Creature',
      faces: [{ name: 'cr110-untap-already-untapped-target', typeLine: 'Artifact Creature' }],
    });

    store().newGame(
      [
        { def: spell, isCommander: false },
        { def: target, isCommander: false },
      ],
      4,
    );
    const spellId = findInstanceId('cr110-untap-already-untapped-spell');
    const targetId = findInstanceId('cr110-untap-already-untapped-target');
    store().moveCard(spellId, 'stack', 'bottom');
    moveToBattlefield(targetId);

    store().resolveTop();
    store().confirmGuidedTarget(targetId);

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.cards[targetId].tapped).toBe(false);
    expect(store().state!.cards[spellId].zone).toBe('graveyard');
    expect(store().warnings.some((warning) => warning.includes('アンタップ状態'))).toBe(true);
  });
});
