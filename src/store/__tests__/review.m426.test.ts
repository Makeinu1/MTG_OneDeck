/**
 * Reviewer-owned adversarial tests for M4.26: deck stats + goldfish utilities.
 * Implementation agents must NOT modify this file.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { computeDeckStats } from '../../data/deckStats';
import { useGameStore } from '../gameStore';
import { makeDef, makeDeck } from '../../engine/__tests__/helpers';
import type { CardDef } from '../../types/card';

function land(id: string): CardDef {
  return makeDef({ scryfallId: id, typeLine: 'Basic Land — Forest', cmc: 0, colorIdentity: [] });
}
function bear(id: string): CardDef {
  return makeDef({ scryfallId: id, typeLine: 'Creature — Bear', cmc: 2, colorIdentity: ['G'] });
}

describe('computeDeckStats (M4.26 A)', () => {
  it('computes totals, curve, colors, types, avgCmc and hypergeometric opening odds', () => {
    const commander = makeDef({
      scryfallId: 'cmd',
      typeLine: 'Legendary Creature — Dragon',
      cmc: 3,
      colorIdentity: ['G'],
    });
    const stats = computeDeckStats([
      { card: commander, quantity: 1, section: 'commander' },
      { card: land('forest'), quantity: 40, section: 'main' },
      { card: bear('bear'), quantity: 59, section: 'main' },
    ]);

    expect(stats.total).toBe(100);
    expect(stats.lands).toBe(40);
    expect(stats.nonland).toBe(60);
    expect(stats.types.land).toBe(40);
    expect(stats.types.creature).toBe(60);
    expect(stats.curve[2]).toBe(59);
    expect(stats.curve[3]).toBe(1);
    expect(stats.curve[0]).toBe(0);
    expect(stats.colors.G).toBe(60);
    expect(stats.colors.colorless).toBe(40);
    expect(stats.colors.U).toBe(0);
    expect(stats.avgCmc).toBeCloseTo((59 * 2 + 1 * 3) / 60, 3);

    // opening hand drawn from the 99 non-commander cards, 40 of which are lands
    expect(stats.opening.expectedLands).toBeCloseTo((7 * 40) / 99, 2);
    for (const p of [stats.opening.pMullRisk, stats.opening.pIdeal, stats.opening.pFlood]) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
    // 0-1 lands, 2-4 lands, 5-7 lands partition the outcome space
    expect(stats.opening.pMullRisk + stats.opening.pIdeal + stats.opening.pFlood).toBeCloseTo(1, 5);
  });
});

beforeEach(() => {
  useGameStore.setState({ autoAdvanceToMain: false });
});

function putOnBattlefield(defId: string): string {
  const id = Object.values(useGameStore.getState().state!.cards).find((c) => c.defId === defId)!.id;
  useGameStore.getState().moveCard(id, 'battlefield', 'bottom');
  return id;
}

describe('store.tapAllPermanents (M4.26 B)', () => {
  it('taps every battlefield permanent and reverts with a single undo', () => {
    useGameStore.getState().newGame(makeDeck(10), 1);
    const a = putOnBattlefield('card-1');
    const b = putOnBattlefield('card-2');
    useGameStore.getState().tapAllPermanents();
    let s = useGameStore.getState().state!;
    expect(s.cards[a].tapped).toBe(true);
    expect(s.cards[b].tapped).toBe(true);
    useGameStore.getState().undo();
    s = useGameStore.getState().state!;
    expect(s.cards[a].tapped).toBe(false);
    expect(s.cards[b].tapped).toBe(false);
  });
});

describe('store.proliferateAll (M4.26 B)', () => {
  it('adds one to existing counters and >0 player counters, leaves zero counters, single undo', () => {
    useGameStore.getState().newGame(makeDeck(10), 1);
    const a = putOnBattlefield('card-1');
    const b = putOnBattlefield('card-2');
    useGameStore.getState().dispatch({ type: 'addCounters', cardId: a, counterType: '+1/+1', delta: 2 });
    useGameStore.getState().dispatch({ type: 'adjustPlayerCounter', kind: 'poison', delta: 2 });

    const beforeB = { ...useGameStore.getState().state!.cards[b].counters };
    useGameStore.getState().proliferateAll();
    let s = useGameStore.getState().state!;
    expect(s.cards[a].counters['+1/+1']).toBe(3); // 2 -> 3
    expect(s.poison).toBe(3); // 2 -> 3
    expect(s.cards[b].counters).toEqual(beforeB); // no counters -> unchanged
    expect(s.energy).toBe(0); // was 0 -> stays 0

    useGameStore.getState().undo(); // single undo reverts the whole proliferate
    s = useGameStore.getState().state!;
    expect(s.cards[a].counters['+1/+1']).toBe(2);
    expect(s.poison).toBe(2);
  });
});
