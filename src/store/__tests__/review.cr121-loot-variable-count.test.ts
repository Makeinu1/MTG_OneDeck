import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { useGameStore } from '../gameStore';

/**
 * Review pins (judge-owned) for cr-121 variable-count loot.
 *
 * Contract under test (autoloop idx 11, approved 2026-07-15):
 *   Oracle "Discard up to N cards, then draw that many cards [plus/minus K]"
 *   (and the "any number of" variant) compiles to a GUIDED variable discard
 *   where the player discards 0..N cards and then draws EXACTLY the number
 *   actually discarded (+ delta, floored at 0).
 *
 * North star / CR anchor:
 *   CR608.2h — a value that depends on a player's runtime choice is fixed at
 *   resolution. The draw count is the number actually discarded, never the
 *   declared maximum. Drawing the maximum after discarding fewer is a
 *   fake-auto = CR608.2h violation (this is THE pin that killed candidate-1's
 *   naive fixed-N reclassification). CR121.1/121.2 (draw), CR701.9 (discard).
 *
 * These assertions are behavioral (public store API + zone outcomes) so they
 * bind the contract, not an implementation's internal field names.
 */

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

function lootSpell(oracleText: string, scryfallId = 'cr121-loot-spell') {
  return makeDef({
    scryfallId,
    typeLine: 'Sorcery',
    faces: [{ name: scryfallId, typeLine: 'Sorcery', oracleText }],
  });
}

/** Put the loot spell on the stack and enter guided resolution. Returns ids. */
function enterLoot(oracleText: string): { sourceId: string; handIds: string[] } {
  const spell = lootSpell(oracleText);
  store().newGame([{ def: spell, isCommander: false }, ...makeDeck(24)], 1);
  const sourceId = findInstanceId('cr121-loot-spell');
  store().moveCard(sourceId, 'stack', 'bottom');
  const handIds = (store().state?.zones.hand ?? []).filter((id) => id !== sourceId);
  store().resolveTop();
  return { sourceId, handIds };
}

describe('review: cr-121 variable-count loot (CR608.2h honesty)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('discard up to two, discarding both, draws exactly two', () => {
    const { handIds } = enterLoot('Discard up to two cards, then draw that many cards.');
    expect(store().pendingGuided).not.toBeNull();
    expect(store().pendingGuided?.prompts[0]).toMatchObject({ kind: 'discard' });

    const libBefore = store().state?.zones.library.length ?? 0;
    const [d1, d2] = handIds;
    store().confirmGuidedDiscard(d1);
    store().confirmGuidedDiscard(d2);
    // Two-card ceiling reached -> resolution should finalize on its own.
    // If the impl requires an explicit "done", cancel here is a no-op finalizer.
    if (store().pendingGuided) {
      store().cancelGuidedPrompt();
    }

    const state = store().state;
    expect(store().pendingGuided).toBeNull();
    expect(state?.cards[d1].zone).toBe('graveyard');
    expect(state?.cards[d2].zone).toBe('graveyard');
    // draw count == actually discarded (2): library shrinks by exactly 2.
    expect(libBefore - (state?.zones.library.length ?? 0)).toBe(2);
  });

  it('HONESTY: discard up to two, discarding only one, draws exactly one (never two)', () => {
    const { handIds } = enterLoot('Discard up to two cards, then draw that many cards.');
    const libBefore = store().state?.zones.library.length ?? 0;

    store().confirmGuidedDiscard(handIds[0]);
    // player declines the second discard -> "done"
    store().cancelGuidedPrompt();

    const state = store().state;
    expect(store().pendingGuided).toBeNull();
    expect(state?.cards[handIds[0]].zone).toBe('graveyard');
    // the crux: exactly one drawn, NOT the declared maximum of two.
    expect(libBefore - (state?.zones.library.length ?? 0)).toBe(1);
  });

  it('discard up to two, discarding zero, draws zero', () => {
    const { handIds } = enterLoot('Discard up to two cards, then draw that many cards.');
    const libBefore = store().state?.zones.library.length ?? 0;
    const gyBefore = store().state?.zones.graveyard.length ?? 0;

    store().cancelGuidedPrompt(); // immediately done, discard nothing

    const state = store().state;
    expect(store().pendingGuided).toBeNull();
    // no draw, no discard beyond the spell resolving to graveyard.
    expect(libBefore - (state?.zones.library.length ?? 0)).toBe(0);
    // graveyard grows only by the resolved spell itself, not by any hand card.
    const gyGrowth = (state?.zones.graveyard.length ?? 0) - gyBefore;
    expect(gyGrowth).toBeLessThanOrEqual(1);
    for (const id of handIds) {
      expect(state?.cards[id].zone).not.toBe('graveyard');
    }
  });

  it('BOUNDARY: cross-player discard-then-draw stays manual (fail-closed, no fake loot)', () => {
    // "Target player discards ... then draws" is NOT a self-loot; must not be
    // guided as a variable self-discard (cross-player execution is a separate,
    // still-manual domain — idx 14). fail-closed to manual.
    const spell = lootSpell(
      'Target player discards up to two cards, then draws that many cards.',
      'cr121-crossplayer',
    );
    store().newGame([{ def: spell, isCommander: false }, ...makeDeck(24)], 1);
    const sourceId = findInstanceId('cr121-crossplayer');
    store().moveCard(sourceId, 'stack', 'bottom');
    store().resolveTop();
    // A cross-player loot must not open a self-discard guided prompt.
    const p = store().pendingGuided;
    const openedSelfDiscard = p?.prompts?.[0]?.kind === 'discard';
    expect(openedSelfDiscard).toBe(false);
  });

  it('REGRESSION-NEUTRAL: plain "Draw two cards." remains a clean auto draw', () => {
    // Extending CountSpec for up-to/that-many must not disturb ordinary
    // fixed-count draw compilation (candidate-1 rippled and broke real cards).
    const spell = lootSpell('Draw two cards.', 'cr121-plain-draw');
    store().newGame([{ def: spell, isCommander: false }, ...makeDeck(24)], 1);
    const sourceId = findInstanceId('cr121-plain-draw');
    store().moveCard(sourceId, 'stack', 'bottom');
    const libBefore = store().state?.zones.library.length ?? 0;
    store().resolveTop();
    // no guided prompt; two cards drawn automatically.
    expect(store().pendingGuided).toBeNull();
    expect(libBefore - (store().state?.zones.library.length ?? 0)).toBe(2);
  });

  /**
   * MP pins (added 2026-07-18, judge-owned): the loot slice landed after the
   * MP-STATE/MP-ZONES track, so hand-exhaustion and the finalizing draw must
   * follow the prompt's CONTROLLER, never the local player. CR121.2 (each
   * player draws from their own library) + CR608.2h. These pins were added on
   * a Tier-1 HIGH finding: the pre-merge code read `zones.hand` (P1 view) and
   * emitted `draw` without `playerId`, so an opponent-controlled loot would
   * discard from the opponent but draw to P1.
   */
  function reassignToOpponent(cardId: string): void {
    const current = store().state;
    const card = current?.cards[cardId];
    if (!current || !card) throw new Error(`card instance not found: ${cardId}`);
    useGameStore.setState({
      state: {
        ...current,
        cards: {
          ...current.cards,
          [cardId]: { ...card, ownerId: 'OPPONENT_A', controllerId: 'OPPONENT_A' },
        },
      },
    });
  }

  function enterOpponentLoot(handCount: number): { opponentHandIds: string[] } {
    const spell = lootSpell(
      'Discard up to two cards, then draw that many cards.',
      'cr121-mp-loot',
    );
    store().newGame([{ def: spell, isCommander: false }, ...makeDeck(24)], 1);
    const sourceId = findInstanceId('cr121-mp-loot');
    // Give OPPONENT_A a private hand and library (owner-routed zones, §34.43).
    const p1Hand = [...(store().state?.zones.hand ?? [])].filter((id) => id !== sourceId);
    const opponentHandIds = p1Hand.slice(0, handCount);
    for (const id of opponentHandIds) {
      reassignToOpponent(id);
      store().moveCard(id, 'hand', 'bottom');
    }
    for (const id of p1Hand.slice(handCount, handCount + 3)) {
      reassignToOpponent(id);
      store().moveCard(id, 'library', 'bottom');
    }
    // The loot spell itself resolves under the opponent's control.
    store().moveCard(sourceId, 'stack', 'bottom');
    reassignToOpponent(sourceId);
    store().resolveTop();
    return { opponentHandIds };
  }

  it('MP: opponent-controlled loot draws for the OPPONENT after cancel, P1 zones untouched', () => {
    const { opponentHandIds } = enterOpponentLoot(2);
    expect(store().pendingGuided?.prompts[0]).toMatchObject({ kind: 'discard' });
    const p1HandBefore = store().state?.zonesByPlayer.P1.hand.length ?? -1;
    const p1LibBefore = store().state?.zonesByPlayer.P1.library.length ?? -1;
    const oppLibBefore = store().state?.zonesByPlayer.OPPONENT_A.library.length ?? -1;

    // Opponent discards 1 of 2, then stops (cancel = "done discarding").
    store().confirmGuidedDiscard(opponentHandIds[0]);
    expect(store().pendingGuided).not.toBeNull();
    store().cancelGuidedPrompt();

    const s = store().state!;
    // CR608.2h + CR121.2: exactly 1 drawn, from the OPPONENT's library into the
    // OPPONENT's hand (2 - 1 discarded + 1 drawn = 2).
    expect(s.zonesByPlayer.OPPONENT_A.hand.length).toBe(2);
    expect(s.zonesByPlayer.OPPONENT_A.library.length).toBe(oppLibBefore - 1);
    // P1 is a bystander: hand and library are byte-for-byte uninvolved.
    expect(s.zonesByPlayer.P1.hand.length).toBe(p1HandBefore);
    expect(s.zonesByPlayer.P1.library.length).toBe(p1LibBefore);
  });

  it('MP: hand exhaustion is judged on the OPPONENT hand and finalizes their draw', () => {
    const { opponentHandIds } = enterOpponentLoot(1);
    expect(store().pendingGuided?.prompts[0]).toMatchObject({ kind: 'discard' });
    const p1LibBefore = store().state?.zonesByPlayer.P1.library.length ?? -1;
    const oppLibBefore = store().state?.zonesByPlayer.OPPONENT_A.library.length ?? -1;

    // Discarding the opponent's only card exhausts THEIR hand (not P1's, which
    // still holds cards) and must auto-finalize: draw 1 for the opponent.
    store().confirmGuidedDiscard(opponentHandIds[0]);

    const s = store().state!;
    expect(store().pendingGuided).toBeNull();
    expect(s.zonesByPlayer.OPPONENT_A.hand.length).toBe(1);
    expect(s.zonesByPlayer.OPPONENT_A.library.length).toBe(oppLibBefore - 1);
    expect(s.zonesByPlayer.P1.library.length).toBe(p1LibBefore);
  });
});
