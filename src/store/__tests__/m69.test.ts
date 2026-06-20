import { beforeEach, describe, expect, it } from 'vitest';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

type ResourceTokenKind = 'clue' | 'food' | 'blood';

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: true,
    mulliganDecisionPending: false,
  });
}

function findInstanceId(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find((instance) => instance.defId === defId);
  if (!card) {
    throw new Error(`card instance not found for ${defId}`);
  }
  return card.id;
}

function tokenName(kind: ResourceTokenKind): string {
  const names: Record<ResourceTokenKind, string> = {
    clue: 'Clue',
    food: 'Food',
    blood: 'Blood',
  };
  return names[kind];
}

function setupResource(kind: ResourceTokenKind): string {
  const name = tokenName(kind);
  store().newGame(makeDeck(20), 1);
  store().createToken(name, `Token Artifact — ${name}`, undefined, undefined, 1, {
    tokenKind: kind,
  });
  const state = store().state!;
  const cardId = state.zones.battlefield.find((id) => {
    const card = state.cards[id];
    return card ? state.defs[card.defId]?.tokenKind === kind : false;
  });
  if (!cardId) {
    throw new Error(`resource token not found for ${kind}`);
  }
  store().clearWarnings();
  return cardId;
}

function snapshot(): string {
  return JSON.stringify(store().state);
}

describe('M6.9 resource token crack store actions', () => {
  beforeEach(() => {
    resetStore();
  });

  it('crackClue sacrifices the clue and draws one as a single undoable action', () => {
    const clueId = setupResource('clue');
    const before = snapshot();
    const handBefore = store().state!.zones.hand.length;

    store().crackClue(clueId);

    expect(store().state!.cards[clueId]).toBeUndefined(); // token ceases to exist
    expect(store().state!.zones.hand.length).toBe(handBefore + 1);

    store().undo();
    expect(snapshot()).toBe(before);
  });

  it('crackFood sacrifices the food and gains 3 life as a single undoable action', () => {
    const foodId = setupResource('food');
    const before = snapshot();
    const lifeBefore = store().state!.life;

    store().crackFood(foodId);

    expect(store().state!.cards[foodId]).toBeUndefined(); // token ceases to exist
    expect(store().state!.life).toBe(lifeBefore + 3);

    store().undo();
    expect(snapshot()).toBe(before);
  });

  it('crackBlood discards the chosen hand card, sacrifices blood, and draws as one undo', () => {
    const bloodId = setupResource('blood');
    const discardTarget = store().state!.zones.hand[0];
    const before = snapshot();
    const libraryBefore = store().state!.zones.library.length;

    store().crackBlood(bloodId, discardTarget);

    expect(store().state!.cards[bloodId]).toBeUndefined(); // blood token ceases to exist
    expect(store().state!.cards[discardTarget].zone).toBe('graveyard'); // discarded real card persists
    expect(store().state!.zones.library.length).toBe(libraryBefore - 1);

    store().undo();
    expect(snapshot()).toBe(before);
  });

  it('crackBlood without a discard target warns and still sacrifices plus draws', () => {
    const bloodId = setupResource('blood');
    for (const cardId of store().state!.zones.hand.slice()) {
      store().moveCard(cardId, 'battlefield', 'bottom');
    }
    store().clearWarnings();
    const before = snapshot();
    const libraryBefore = store().state!.zones.library.length;

    store().crackBlood(bloodId);

    expect(store().state!.cards[bloodId]).toBeUndefined(); // token ceases to exist
    expect(store().state!.zones.hand).toHaveLength(1);
    expect(store().state!.zones.library.length).toBe(libraryBefore - 1);
    expect(store().warnings).toContain('捨てるカードがありません');

    store().undo();
    expect(snapshot()).toBe(before);
  });

  it('does nothing when the target card is not the matching tokenKind', () => {
    const artifact = makeDef({
      scryfallId: 'm69-not-resource',
      typeLine: 'Artifact',
    });
    store().newGame([{ def: artifact, isCommander: false }, ...makeDeck(20)], 1);
    const artifactId = findInstanceId('m69-not-resource');
    store().moveCard(artifactId, 'battlefield', 'bottom');
    store().clearWarnings();

    const before = store().state;
    store().crackClue(artifactId);
    store().crackFood(artifactId);
    store().crackBlood(artifactId);

    expect(store().state).toBe(before);
    expect(store().warnings).toEqual([]);
  });
});
