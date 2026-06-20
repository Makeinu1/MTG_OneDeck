/**
 * Reviewer-owned adversarial tests for M6.9: resource-token crack abilities
 * (docs/engine-spec.md §24). Clue/Food/Blood crack = sacrifice + effect,
 * composed from existing commands via applyCommands (single undo), engine
 * unchanged. Implementation agents must NOT modify this file.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../gameStore';
import { makeDeck } from '../../engine/__tests__/helpers';
import type { GameState } from '../../engine/types';

function store() {
  return useGameStore.getState();
}
function snap(): GameState {
  return store().state!;
}
function tokenId(kind: string): string {
  const s = snap();
  return Object.values(s.cards).find((c) => s.defs[c.defId]?.tokenKind === kind)!.id;
}
function zoneOf(cardId: string): string {
  const s = snap();
  return (Object.keys(s.zones) as (keyof typeof s.zones)[]).find((z) =>
    s.zones[z].includes(cardId),
  ) as string;
}

beforeEach(() => {
  useGameStore.setState({ autoAdvanceToMain: false });
  store().newGame(makeDeck(14), 7);
});

function makeToken(kind: 'clue' | 'food' | 'blood'): string {
  store().dispatch({
    type: 'createToken',
    name: kind,
    typeLine: `Token Artifact — ${kind}`,
    quantity: 1,
    tokenKind: kind,
  });
  return tokenId(kind);
}

describe('M6.9 resource-token crack abilities', () => {
  it('crackClue: sacrifices token (ceases to exist) + draws 1; single undo restores both', () => {
    const id = makeToken('clue');
    const handBefore = snap().zones.hand.length;
    store().crackClue(id);
    expect(snap().cards[id]).toBeUndefined(); // token ceased to exist (consistent w/ treasure)
    expect(snap().zones.hand.length).toBe(handBefore + 1);
    store().undo();
    expect(zoneOf(id)).toBe('battlefield');
    expect(snap().zones.hand.length).toBe(handBefore);
  });

  it('crackFood: sacrifices token (ceases to exist) + gains 3 life; single undo restores', () => {
    const id = makeToken('food');
    const lifeBefore = snap().life;
    store().crackFood(id);
    expect(snap().cards[id]).toBeUndefined();
    expect(snap().life).toBe(lifeBefore + 3);
    store().undo();
    expect(zoneOf(id)).toBe('battlefield');
    expect(snap().life).toBe(lifeBefore);
  });

  it('crackBlood (hand present): discards chosen card + sacrifices + draws; single undo', () => {
    const id = makeToken('blood');
    const discardTarget = snap().zones.hand[0];
    const libBefore = snap().zones.library.length;
    store().crackBlood(id, discardTarget);
    expect(snap().cards[id]).toBeUndefined(); // blood token ceased to exist
    expect(zoneOf(discardTarget)).toBe('graveyard'); // the discarded real card persists
    expect(snap().zones.hand).not.toContain(discardTarget);
    expect(snap().zones.library.length).toBe(libBefore - 1); // drew 1
    store().undo();
    expect(zoneOf(id)).toBe('battlefield');
    expect(zoneOf(discardTarget)).toBe('hand');
    expect(snap().zones.library.length).toBe(libBefore);
  });

  it('crackBlood (no discard target): skips discard, still sacrifices + draws', () => {
    const id = makeToken('blood');
    const handBefore = snap().zones.hand.length;
    store().crackBlood(id);
    expect(snap().cards[id]).toBeUndefined();
    expect(snap().zones.hand.length).toBe(handBefore + 1); // only the draw
  });

  it('crack methods are defensive: wrong tokenKind does nothing', () => {
    const clue = makeToken('clue');
    const lifeBefore = snap().life;
    store().crackFood(clue); // clue is not food
    expect(zoneOf(clue)).toBe('battlefield');
    expect(snap().life).toBe(lifeBefore);
  });
});
