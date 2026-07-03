// REVIEWER-OWNED acceptance contract for the cr-701 discard leaf + cr-111 predefined-token
// leaf compilers. Implementation agents must NOT edit this file; fix the engine.
//
// CR grounding (rule/ 2026-06-19, verified verbatim):
//   - 701.9a: discarding moves the card from its owner's hand to that player's graveyard.
//   - 701.9b: by default the AFFECTED PLAYER CHOOSES which card to discard — so a compiled
//     "Discard a card." must be guided (player choice), never auto-picking a card.
//   - 701.7a: creating tokens puts the specified NUMBER of tokens with the specified
//     characteristics onto the battlefield.
//   - 111.10/111.10b/f/g: Food/Clue/Blood are predefined colorless artifact tokens.
//   - §34.19 status discipline: unsupported shapes (multi-card discard, variable-count
//     tokens) fall to manual — the compiler must not fake automation.

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

function sorcery(defId: string, oracleText: string) {
  return makeDef({
    scryfallId: defId,
    typeLine: 'Sorcery',
    faces: [{ name: defId, typeLine: 'Sorcery', oracleText }],
  });
}
function instanceId(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find((c) => c.defId === defId);
  if (!card) throw new Error(`no instance for ${defId}`);
  return card.id;
}
function onStackThenResolve(defId: string): string {
  const id = instanceId(defId);
  store().moveCard(id, 'stack', 'bottom');
  store().resolveTop();
  return id;
}

describe('review.leaf-discard-token: CR 701.9 discard leaf (guided)', () => {
  beforeEach(() => {
    resetStore();
  });

  // 1. CR 701.9b: the affected player chooses — resolution opens a guided prompt (not auto),
  //    and nothing is discarded before the choice is confirmed.
  it('701.9b: "Discard a card." opens a guided choice; no card leaves hand before confirm', () => {
    store().newGame([{ def: sorcery('rv-disc', 'Discard a card.'), isCommander: false }, ...makeDeck(12)], 1);
    const handBefore = () => store().state!.zones.hand.length;
    const id = instanceId('rv-disc');
    store().moveCard(id, 'stack', 'bottom');
    const n = handBefore();

    store().resolveTop();

    expect(store().pendingGuided).toBeTruthy();
    expect(handBefore()).toBe(n); // choice pending — hand untouched
  });

  // 2. CR 701.9a: the chosen card goes from hand to its owner's graveyard, and the spell
  //    finishes resolving off the stack.
  it('701.9a: the confirmed hand card moves to graveyard and the stack item resolves', () => {
    store().newGame([{ def: sorcery('rv-disc2', 'Discard a card.'), isCommander: false }, ...makeDeck(12)], 1);
    const srcId = onStackThenResolve('rv-disc2');
    const chosen = store().state!.zones.hand.find((c) => c !== srcId);
    if (!chosen) throw new Error('no spare hand card');

    store().confirmGuidedDiscard(chosen);

    expect(store().state!.cards[chosen].zone).toBe('graveyard');
    expect(store().state!.zones.stack).not.toContain(srcId);
    expect(store().pendingGuided).toBeNull();
  });

  // 3. Honest defer: multi-card discard is NOT silently automated or half-applied.
  it('§34.19: "Discard two cards." does not auto-discard anything (manual fall)', () => {
    store().newGame([{ def: sorcery('rv-disc3', 'Discard two cards.'), isCommander: false }, ...makeDeck(12)], 1);
    const id = instanceId('rv-disc3');
    store().moveCard(id, 'stack', 'bottom');
    const n = store().state!.zones.hand.length; // baseline after the spell left for the stack

    store().resolveTop();

    // No card silently left the hand; either manual (no prompt) or a prompt that has not
    // mutated state — the invariant is zero unchosen discards.
    expect(store().state!.zones.hand.length).toBe(n);
    expect(store().state!.zones.graveyard.filter((c) => c !== id).length).toBe(0);
  });
});

describe('review.leaf-discard-token: CR 111.10 predefined token leaf (auto)', () => {
  beforeEach(() => {
    resetStore();
  });

  function tokensOfKind(kind: string): string[] {
    const s = store().state!;
    return s.zones.battlefield.filter((cardId) => {
      const card = s.cards[cardId];
      return card?.isToken && s.defs[card.defId]?.tokenKind === kind;
    });
  }

  // 4. CR 701.7a + 111.10f: "Create two Clue tokens." puts EXACTLY two Clue tokens onto the
  //    battlefield (count fidelity), no guided prompt needed.
  it('701.7a/111.10f: "Create two Clue tokens." auto-creates exactly 2 Clue tokens', () => {
    store().newGame([{ def: sorcery('rv-clue', 'Create two Clue tokens.'), isCommander: false }, ...makeDeck(10)], 1);
    onStackThenResolve('rv-clue');

    expect(store().pendingGuided).toBeNull();
    expect(tokensOfKind('clue')).toHaveLength(2);
  });

  // 5. CR 111.10b: "Create a Food token." resolves to one Food token on the battlefield and
  //    the source finishes resolving.
  it('111.10b: "Create a Food token." creates one Food token and resolves the source', () => {
    store().newGame([{ def: sorcery('rv-food', 'Create a Food token.'), isCommander: false }, ...makeDeck(10)], 1);
    const srcId = onStackThenResolve('rv-food');

    expect(tokensOfKind('food')).toHaveLength(1);
    expect(store().state!.zones.stack).not.toContain(srcId);
  });

  // 6. Honest defer: variable-count token creation must NOT auto-create anything.
  it('§34.19: "Create X Blood tokens." creates no token automatically (manual fall)', () => {
    store().newGame([{ def: sorcery('rv-bloodx', 'Create X Blood tokens.'), isCommander: false }, ...makeDeck(10)], 1);
    onStackThenResolve('rv-bloodx');

    expect(tokensOfKind('blood')).toHaveLength(0);
  });

  // 7. Tier-1 F-1 (HIGH): a MIXED auto+guided line must not half-execute. The standing §32
  //    contract classifies mixed auto+guided as GUIDED overall — so after the guided choice
  //    is confirmed, BOTH halves must have applied: the deterministic token creation must not
  //    be silently dropped alongside the guided discard (CR 608.2c / §34.19 status discipline).
  it('608.2c/§32: "Create a Food token. Discard a card." applies BOTH halves after the choice', () => {
    store().newGame(
      [{ def: sorcery('rv-mixed', 'Create a Food token. Discard a card.'), isCommander: false }, ...makeDeck(12)],
      1,
    );
    const id = instanceId('rv-mixed');
    store().moveCard(id, 'stack', 'bottom');

    store().resolveTop();
    // §32: mixed line is guided — a discard prompt is offered, nothing applied yet.
    expect(store().pendingGuided).toBeTruthy();
    expect(tokensOfKind('food')).toHaveLength(0);
    const chosen = store().state!.zones.hand.find((c) => c !== id);
    if (!chosen) throw new Error('no spare hand card');

    store().confirmGuidedDiscard(chosen);

    // No silent drop: the auto half (Food token) AND the guided half (discard) both applied.
    expect(tokensOfKind('food')).toHaveLength(1);
    expect(store().state!.cards[chosen].zone).toBe('graveyard');
    expect(store().state!.zones.stack).not.toContain(id);
    expect(store().pendingGuided).toBeNull();
  });
});
