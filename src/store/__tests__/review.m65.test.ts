/**
 * Reviewer-owned adversarial tests for M6.5: manual keyword override
 * (docs/engine-spec.md §22). Printed keywords (grammar-aware) stay correct;
 * manual keywords merge into summoning-sickness / vigilance / badges.
 * Implementation agents must NOT modify this file.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../gameStore';
import { isSummoningSick, hasVigilance, effectiveKeywords } from '../../engine/status';
import { makeDef, makeDeck } from '../../engine/__tests__/helpers';
import type { GameState } from '../../engine/types';

function store() {
  return useGameStore.getState();
}
function snap(): GameState {
  return store().state!;
}
function instByDef(defId: string): string {
  return Object.values(snap().cards).find((c) => c.defId === defId)!.id;
}

beforeEach(() => {
  useGameStore.setState({ autoAdvanceToMain: false });
});

function gameWithVanilla(): string {
  const cre = makeDef({
    scryfallId: 'vanilla',
    typeLine: 'Creature — Bear',
    faces: [{ name: 'vanilla', typeLine: 'Creature — Bear' }],
  });
  store().newGame([{ def: cre, isCommander: false }, ...makeDeck(12)], 7);
  const id = instByDef('vanilla');
  store().moveCard(id, 'battlefield'); // entered this turn -> summoning sick
  return id;
}

describe('M6.5 manual keyword override', () => {
  it('manual haste clears summoning sickness; one undo restores', () => {
    const id = gameWithVanilla();
    expect(isSummoningSick(snap(), id)).toBe(true);
    store().setManualKeywords(id, ['haste']);
    expect(isSummoningSick(snap(), id)).toBe(false);
    store().undo();
    expect(isSummoningSick(snap(), id)).toBe(true);
  });

  it('manual vigilance makes hasVigilance true', () => {
    const id = gameWithVanilla();
    expect(hasVigilance(snap(), id)).toBe(false);
    store().setManualKeywords(id, ['vigilance']);
    expect(hasVigilance(snap(), id)).toBe(true);
  });

  it('effectiveKeywords = printed ∪ manual; printed detection unchanged', () => {
    const flyer = makeDef({
      scryfallId: 'flyer',
      typeLine: 'Creature — Bird',
      faces: [{ name: 'flyer', typeLine: 'Creature — Bird', oracleText: 'Flying' }],
    });
    store().newGame([{ def: flyer, isCommander: false }, ...makeDeck(12)], 7);
    const id = instByDef('flyer');
    store().moveCard(id, 'battlefield');
    expect(effectiveKeywords(snap(), id)).toContain('flying'); // printed
    store().setManualKeywords(id, ['haste', 'vigilance']);
    expect(effectiveKeywords(snap(), id)).toEqual(
      expect.arrayContaining(['flying', 'haste', 'vigilance']),
    );
  });

  it('setManualKeywords normalizes invalid ids out (Keyword subset only)', () => {
    const id = gameWithVanilla();
    store().setManualKeywords(id, ['haste', 'notakeyword', 'flying']);
    const mk = snap().cards[id].manualKeywords ?? [];
    expect(mk).toContain('haste');
    expect(mk).toContain('flying');
    expect(mk).not.toContain('notakeyword');
  });

  it('snapshot JSON round-trip preserves manualKeywords and tolerates missing', () => {
    const id = gameWithVanilla();
    store().setManualKeywords(id, ['haste']);
    const state = snap();
    const round = JSON.parse(JSON.stringify(state)) as GameState;
    expect(round.cards[id].manualKeywords).toEqual(['haste']);

    const stripped = JSON.parse(JSON.stringify(state)) as GameState;
    delete stripped.cards[id].manualKeywords;
    expect(() => effectiveKeywords(stripped, id)).not.toThrow();
    expect(isSummoningSick(stripped, id)).toBe(true); // no manual haste anymore
  });
});
