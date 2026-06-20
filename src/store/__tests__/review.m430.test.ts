/**
 * Reviewer-owned adversarial tests for M4.30: per-turn counters (storm + draws)
 * and computeGameInfo (docs/engine-spec.md §14). Implementation agents must NOT
 * modify this file.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../gameStore';
import { computeGameInfo } from '../../data/gameInfo';
import { makeDef, makeDeck } from '../../engine/__tests__/helpers';
import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';
import type { GameState } from '../../engine/types';
import type { CardDef } from '../../types/card';

function store() {
  return useGameStore.getState();
}
function snap(): GameState {
  return store().state!;
}
function instanceByDef(defId: string): string {
  return Object.values(snap().cards).find((c) => c.defId === defId)!.id;
}

beforeEach(() => {
  useGameStore.setState({ autoAdvanceToMain: false });
});

function spellDeck(): { spell: string } {
  const deck = [
    { def: makeDef({ scryfallId: 'spell', typeLine: 'Creature — Bear' }), isCommander: false },
    ...makeDeck(14),
  ];
  store().newGame(deck, 5);
  const spell = instanceByDef('spell');
  store().moveCard(spell, 'hand');
  return { spell };
}

describe('storm: spellsCastThisTurn (M4.30)', () => {
  it('increments on a spell cast to the stack', () => {
    const { spell } = spellDeck();
    const before = snap().spellsCastThisTurn;
    store().castToStack(spell);
    expect(snap().spellsCastThisTurn).toBe(before + 1);
  });

  it('does NOT increment on abilities, copies, or fetch activation', () => {
    spellDeck();
    const src = snap().zones.hand[0];
    store().moveCard(src, 'battlefield');
    const base = snap().spellsCastThisTurn;

    store().addAbilityToStack(src, 'activated');
    expect(snap().spellsCastThisTurn).toBe(base);

    const abilityId = Object.values(snap().cards).find((c) => c.isAbility)!.id;
    store().copyStackItem(abilityId);
    expect(snap().spellsCastThisTurn).toBe(base);
  });
});

describe('draws: drawnThisTurn (M4.30)', () => {
  it('increments by the number of cards drawn', () => {
    store().newGame(makeDeck(20), 5);
    const before = snap().drawnThisTurn;
    store().draw(3);
    expect(snap().drawnThisTurn).toBe(before + 3);
  });
});

describe('per-turn reset on untap (M4.30)', () => {
  it('resets storm and draws to 0 at the next turn', () => {
    const { spell } = spellDeck();
    store().castToStack(spell);
    store().draw(2);
    expect(snap().spellsCastThisTurn).toBeGreaterThan(0);
    expect(snap().drawnThisTurn).toBeGreaterThan(0);

    // M6.2a: the stack must be empty before phases/turns can advance.
    store().resolveAll();
    expect(snap().zones.stack.length).toBe(0);

    store().nextTurn(); // advances into next turn's untap -> handleUntapEntry resets
    // land on untap (autoAdvanceToMain false)
    expect(snap().phase).toBe('untap');
    expect(snap().spellsCastThisTurn).toBe(0);
    expect(snap().drawnThisTurn).toBe(0);
  });
});

describe('computeGameInfo (M4.30)', () => {
  it('reports storm/lands/draws from state and devotion from the battlefield', () => {
    const gg = (id: string): CardDef =>
      makeDef({
        scryfallId: id,
        typeLine: 'Creature — Elf',
        faces: [{ name: id, typeLine: 'Creature — Elf', manaCost: '{G}{G}' }],
      });
    const hybrid = (id: string): CardDef =>
      makeDef({
        scryfallId: id,
        typeLine: 'Creature — Spirit',
        faces: [{ name: id, typeLine: 'Creature — Spirit', manaCost: '{G/U}' }],
      });
    const deck = [
      { def: gg('gg'), isCommander: false },
      { def: hybrid('hy'), isCommander: false },
      ...makeDeck(12),
    ];
    store().newGame(deck, 5);
    store().moveCard(instanceByDef('gg'), 'battlefield');
    store().moveCard(instanceByDef('hy'), 'battlefield');

    const info = computeGameInfo(snap());
    expect(info.storm).toBe(snap().spellsCastThisTurn);
    expect(info.landsThisTurn).toBe(snap().landsPlayedThisTurn);
    expect(info.drawsThisTurn).toBe(snap().drawnThisTurn);
    // {G}{G} -> G=2 ; {G/U} -> G+1, U+1
    expect(info.devotion.G).toBe(3);
    expect(info.devotion.U).toBe(1);
    expect(info.devotion.B).toBe(0);
  });
});

describe('snapshot forward-compat (M4.30)', () => {
  it('restoreGame backfills missing per-turn counters to 0', () => {
    store().newGame(makeDeck(12), 3);
    const live = snap();
    const oldState = { ...live } as Record<string, unknown>;
    delete oldState.spellsCastThisTurn;
    delete oldState.drawnThisTurn;
    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: oldState as unknown as GameState,
      deck: makeDeck(12),
      autoAdvanceToMain: false,
    };

    store().restoreGame(snapshot);
    expect(snap().spellsCastThisTurn).toBe(0);
    expect(snap().drawnThisTurn).toBe(0);
    expect(Number.isNaN(snap().spellsCastThisTurn)).toBe(false);
  });

  it('JSON round-trip preserves the counters', () => {
    const { spell } = spellDeck();
    store().castToStack(spell);
    const state = snap();
    const round = JSON.parse(JSON.stringify(state)) as GameState;
    expect(round.spellsCastThisTurn).toBe(state.spellsCastThisTurn);
    expect(round.drawnThisTurn).toBe(state.drawnThisTurn);
  });
});
