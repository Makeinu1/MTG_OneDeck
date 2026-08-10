// REVIEWER-OWNED acceptance contract for the cr-605 mana-production catalog slice
// (mana:write clauses onto the §34.19 envelope / §34.11 mana transaction).
// Implementation agents must NOT edit this file; fix the engine.
//
// CR grounding (rule/ 2026-06-19):
//   - 605.1a: an activated ability with no target that could add mana and isn't loyalty is a
//     mana ability. A COLOR CHOICE is not a target, so "Add one mana of any color" stays a
//     mana ability: it resolves immediately and uses no stack (605.3b/405.6c).
//   - 106.1b/107.4: literal mana symbols denote exact kind and count — "Add {G}{G}" is two
//     green mana, deterministically (auto is honest here).
//   - §34.19 status discipline: clause forms the compiler can't faithfully automate (e.g.
//     "Spend this mana only to cast creature spells" restriction riders) must fall to manual —
//     never silently auto-executing a半端 approximation.

import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
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

function bf(defId: string, typeLine: string, oracleText: string) {
  return makeDef({ scryfallId: defId, typeLine, faces: [{ name: defId, typeLine, oracleText }] });
}
function instanceId(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find((c) => c.defId === defId);
  if (!card) throw new Error(`no instance for ${defId}`);
  return card.id;
}

describe('review.mana-write: CR 605 mana-production catalog (§34.19/§34.11)', () => {
  beforeEach(() => {
    resetStore();
  });

  // 1. CR 106.1b/605.3b: a literal multi-symbol clause adds the exact COUNT, immediately,
  //    with no stack object ({G}{G} = two green, not one).
  it('106.1b: "{T}: Add {G}{G}." auto-resolves to exactly 2 green mana with no stack object', () => {
    const src = bf('rv-gg', 'Creature — Elf', '{T}: Add {G}{G}.');
    store().newGame([{ def: src, isCommander: false }, ...makeDeck(10)], 1);
    const srcId = instanceId('rv-gg');
    store().moveCard(srcId, 'battlefield', 'bottom');
    store().clearWarnings();

    store().activateAbility(srcId, 0);

    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[srcId].tapped).toBe(true);
    expect(store().state!.manaPool.G).toBe(2);
  });

  // 2. CR 605.1a: a color CHOICE is not a target — "any color" stays a mana ability. Nothing
  //    mutates before the choice is confirmed; after confirm the pool gets the chosen color
  //    and still no stack object exists.
  it('605.1a: "Add one mana of any color" guides the choice without mutation, then resolves no-stack', () => {
    const src = bf('rv-anycolor', 'Artifact', '{T}: Add one mana of any color.');
    store().newGame([{ def: src, isCommander: false }, ...makeDeck(10)], 1);
    const srcId = instanceId('rv-anycolor');
    store().moveCard(srcId, 'battlefield', 'bottom');
    store().clearWarnings();
    const before = JSON.stringify(store().state);

    store().activateAbility(srcId, 0);
    // Choice pending: no tap, no mana, no stack (atomicity — CR 602.2).
    expect(JSON.stringify(store().state)).toBe(before);
    expect(store().pendingGuided).toBeTruthy();

    store().confirmGuidedMana('R');
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[srcId].tapped).toBe(true);
    expect(store().state!.manaPool.R).toBe(1);
  });

  // 3. Cancel is a non-event: canceling the color choice leaves state untouched.
  it('602.2: canceling the any-color choice commits nothing', () => {
    const src = bf('rv-cancel', 'Artifact', '{T}: Add one mana of any color.');
    store().newGame([{ def: src, isCommander: false }, ...makeDeck(10)], 1);
    const srcId = instanceId('rv-cancel');
    store().moveCard(srcId, 'battlefield', 'bottom');
    store().clearWarnings();
    const before = JSON.stringify(store().state);

    store().activateAbility(srcId, 0);
    store().cancelGuidedPrompt();

    expect(JSON.stringify(store().state)).toBe(before);
    expect(store().pendingGuided).toBeNull();
  });

  // 4. CR 118.3/602.2 (Tier-1 red flag): the no-stack mana path must enforce the same cost
  //    atomicity as the normal activation path — an already-tapped {T} source cannot pay and
  //    must add NO mana in rules-legal mode (warning instead).
  it('118.3: an already-tapped "{T}: Add {G}." source adds no mana in rules-legal mode', () => {
    const src = bf('rv-tapped-mana', 'Creature — Elf', '{T}: Add {G}.');
    store().newGame([{ def: src, isCommander: false }, ...makeDeck(10)], 1);
    const srcId = instanceId('rv-tapped-mana');
    store().moveCard(srcId, 'battlefield', 'bottom');
    store().dispatch({ type: 'setTapped', cardId: srcId, tapped: true });
    store().clearWarnings();

    store().activateAbility(srcId, 0);

    expect(store().state!.manaPool.G ?? 0).toBe(0);
    expect(store().warnings.length).toBeGreaterThanOrEqual(1);
    expect(store().pendingGuided).toBeNull();
  });

  // 5. Same gate for the guided any-color variant: tapped source opens no color prompt and
  //    adds nothing in rules-legal mode.
  it('118.3: an already-tapped any-color source opens no prompt and adds no mana (rules-legal)', () => {
    const src = bf('rv-tapped-any', 'Artifact', '{T}: Add one mana of any color.');
    store().newGame([{ def: src, isCommander: false }, ...makeDeck(10)], 1);
    const srcId = instanceId('rv-tapped-any');
    store().moveCard(srcId, 'battlefield', 'bottom');
    store().dispatch({ type: 'setTapped', cardId: srcId, tapped: true });
    store().clearWarnings();

    store().activateAbility(srcId, 0);

    expect(store().pendingGuided).toBeNull();
    expect(Object.values(store().state!.manaPool).every((n) => n === 0)).toBe(true);
    expect(store().warnings.length).toBeGreaterThanOrEqual(1);
  });

  // 6. §34.19 status discipline: a restriction rider must NOT silently auto-execute — no tap,
  //    no mana added (manual fall; the engine must not fake auto for text it can't honor).
  it('§34.19: a "Spend this mana only..." restriction does not auto-tap or auto-add mana', () => {
    const src = bf(
      'rv-restricted',
      'Artifact',
      '{T}: Add {G}. Spend this mana only to cast creature spells.',
    );
    store().newGame([{ def: src, isCommander: false }, ...makeDeck(10)], 1);
    const srcId = instanceId('rv-restricted');
    store().moveCard(srcId, 'battlefield', 'bottom');
    store().clearWarnings();

    store().activateAbility(srcId, 0);

    expect(store().state!.cards[srcId].tapped).toBe(false);
    expect(store().state!.manaPool.G ?? 0).toBe(0);
    expect(store().state!.zones.stack).toHaveLength(0);
  });
});
// verifies: ENG-MANA-003
