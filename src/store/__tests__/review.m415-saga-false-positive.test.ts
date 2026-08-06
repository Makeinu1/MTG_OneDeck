/**
 * Reviewer-owned adversarial pin for §11.1 scoping (2026-08-06):
 * user report "ウルザの物語がうまく発動しない" — chapter I/II triggers opened the
 * land-fetch dialog because detectFetchClause matched the chapter III artifact
 * search ("Search your library for an artifact card … onto the battlefield … shuffle").
 * Implementation agents must NOT modify this file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAbility } from '../../engine/status';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { useGameStore } from '../gameStore';
import type { CardDef } from '../../types/card';

const store = () => useGameStore.getState();

const URZAS_SAGA_ORACLE =
  '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)\n'
  + 'I — This Saga gains "{T}: Add {C}."\n'
  + 'II — This Saga gains "{2}, {T}: Create a 0/0 colorless Construct artifact creature token with \'This token gets +1/+1 for each artifact you control.\'"\n'
  + 'III — Search your library for an artifact card with mana cost {0} or {1}, put it onto the battlefield, then shuffle.';

function urzasSagaDef(): CardDef {
  return makeDef({
    scryfallId: 'urzas-saga',
    typeLine: "Enchantment Land — Urza's Saga",
    faces: [{
      name: "Urza's Saga",
      typeLine: "Enchantment Land — Urza's Saga",
      oracleText: URZAS_SAGA_ORACLE,
    }],
  });
}

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    resolutionSession: null,
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: true,
  });
}

beforeEach(() => {
  resetStore();
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('review.m415-saga-false-positive: fetch detection must not match non-land searches (§11.1)', () => {
  it('R1: Urza Saga is NOT a fetch ability (artifact search is not a land fetch)', () => {
    expect(fetchAbility(urzasSagaDef())).toBeNull();
  });

  it('R2: resolving the chapter I trigger does not stop at a fetch dialog (store flow)', () => {
    store().newGame([{ def: urzasSagaDef(), isCommander: false }, ...makeDeck(24)], 1);
    const saga = Object.values(store().state?.cards ?? {}).find((c) => c.defId === 'urzas-saga');
    expect(saga).toBeDefined();
    store().moveCard(saga!.id, 'hand', 'top');
    // Play the saga land: ETB adds lore 1 and emits the chapter I trigger.
    store().playLand(saga!.id, { entersTapped: false });
    const stateAfterPlay = store().state;
    expect(stateAfterPlay).not.toBeNull();
    const triggers = stateAfterPlay!.pendingTriggers.filter(
      (t) => t.sourceId === saga!.id && t.triggerId.startsWith('saga-chapter-'),
    );
    expect(triggers).toHaveLength(1);

    store().placePendingTriggersForPriority(triggers.map((t) => t.pendingTriggerId));
    const withStack = store().state!;
    expect(withStack.zones.stack).toHaveLength(1);

    // resolveAll must not treat this ability as a fetch stop (pre-fix it returned
    // early here, leaving the chapter ability on the stack with no session at all).
    // Post-fix, the chapter ability is honestly manual (cr-714 boundary): it lands
    // in a manual resolution session on the ability itself.
    store().resolveAll();

    const after = store().state!;
    expect(after.zones.stack).toHaveLength(1);
    const session = store().resolutionSession;
    expect(session).not.toBeNull();
    expect(session!.sourceId).toBe(after.zones.stack[0]);
    expect(store().pendingGuided).toBeNull();
  });

  it('R3: real fetch lands still parse (regression floor)', () => {
    const pollutedDelta = makeDef({
      scryfallId: 'polluted-delta',
      typeLine: 'Land',
      faces: [{
        name: 'Polluted Delta',
        typeLine: 'Land',
        oracleText: '{T}, Pay 1 life, Sacrifice this land: Search your library for an Island or Swamp card, put it onto the battlefield, then shuffle.',
      }],
    });
    const fabledPassage = makeDef({
      scryfallId: 'fabled-passage',
      typeLine: 'Land',
      faces: [{
        name: 'Fabled Passage',
        typeLine: 'Land',
        oracleText: '{T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle. Then if you control four or more lands, untap that land.',
      }],
    });
    const delta = fetchAbility(pollutedDelta);
    expect(delta).not.toBeNull();
    expect(delta!.lifeCost).toBe(1);
    expect(delta!.entersTapped).toBe(false);
    const passage = fetchAbility(fabledPassage);
    expect(passage).not.toBeNull();
    expect(passage!.filter).toBe('basic');
    expect(passage!.entersTapped).toBe(true);
    expect(passage!.untapIfControlLandsAtLeast).toBe(4);
  });

  it('R4: comma-separated subtype fetch targets still parse (Panorama cycle, cold-audit Boyle F1)', () => {
    const bantPanorama = makeDef({
      scryfallId: 'bant-panorama',
      typeLine: 'Land',
      faces: [{
        name: 'Bant Panorama',
        typeLine: 'Land',
        oracleText: '{T}, Sacrifice this land: Search your library for a basic Forest, Plains, or Island card, put it onto the battlefield tapped, then shuffle.',
      }],
    });
    const panorama = fetchAbility(bantPanorama);
    expect(panorama).not.toBeNull();
    expect(panorama!.entersTapped).toBe(true);
    expect(panorama!.lifeCost).toBe(0);
    expect(typeof panorama!.filter === 'object'
      ? [...panorama!.filter.subtypes].sort()
      : null).toEqual(['Forest', 'Island', 'Plains']);
  });
});
