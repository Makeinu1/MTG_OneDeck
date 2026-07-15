// Implementer-owned tests for cr-121-drawing / cr-701-discard's "variable loot" slice
// (up-to/any-number discard, then draw that many cards [plus/minus K] — CR 121.1/121.2
// draw, CR 701.9 discard, CR 608.2h variable-value resolution: the draw count is the
// number of cards *actually* discarded at resolution time, not the declared "up to"/"any
// number of" upper bound). Not a `review.*` file — reviewer's own adversarial suite is
// separate and must not be touched here.
//
// Golden real oracle text (Scryfall, verified 2026-07-15) exercised below:
//   - Tersa Lightshatter (When ~ enters,): "discard up to two cards, then draw that many
//     cards." — up-to, delta 0.
//   - Celes, Rune Knight (When ~ enters,): "discard any number of cards, then draw that
//     many cards plus one." — any-number (max=Infinity), delta +1.
//   - Fable of the Mirror-Breaker chapter II: "You may discard up to two cards. If you do,
//     draw that many cards." — deliberately optional ("you may"/"if you do"), so the
//     recognizer must NOT fire (fail-closed; stays whatever it already was: manual).
//   - Absolving Lammasu / Tolsimir, Friend to Wolves: real cards named in
//     research/cr-grounding/cr-backbone-ledger.json as the two real-card regressions a
//     prior attempt caused by globally reclassifying any "up to N" text in the shared
//     `countSpec()` classifier (ir.ts) from `fixed` to `up-to`. Both cards' oracle text is
//     a single `effect.gain-life` clause — "you gain 3 life and suspect/fights up to one
//     target creature ..." — whose count must resolve to `{kind:'fixed', value:3}`. This
//     suite's regression case (e) proves that invariant is untouched by this feature: this
//     implementation never modifies `countSpec()` and instead parses the discard/draw
//     clause raw text locally inside the recognizer (compile.ts's guidedVariableLootPrompt).
import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../__tests__/helpers';
import type { CardDef } from '../../../types/card';
import { compileAbilityIR, type CompiledEffect, type EffectPrompt } from '../compile';
import { parseAbilityIR } from '../ir';
import { useGameStore } from '../../../store/gameStore';

const SOURCE_ID = 'source-1';

function cardDef(typeLine: string, name = 'Test Card'): CardDef {
  return makeDef({ scryfallId: 'r-loot-src', typeLine, name, faces: [{ name, typeLine }] });
}

function compile(line: string, typeLine = 'Sorcery', name?: string): CompiledEffect {
  return compileAbilityIR(parseAbilityIR(line, typeLine), {
    sourceId: SOURCE_ID,
    def: cardDef(typeLine, name),
  });
}

function lootPrompt(compiled: CompiledEffect): EffectPrompt | undefined {
  return compiled.prompts.find((prompt) => prompt.variableLoot !== undefined);
}

describe('cr-121/cr-701 variable-count loot recognizer (compile-level)', () => {
  it('recognizes the up-to shape (Tersa Lightshatter: "discard up to two cards, then draw that many cards")', () => {
    const compiled = compile('Discard up to two cards, then draw that many cards.');
    expect(compiled.decision).toBe('guided');
    expect(compiled.commands).toEqual([]);
    const prompt = lootPrompt(compiled);
    expect(prompt).toMatchObject({
      atom: 'effect.discard',
      kind: 'discard',
      variableLoot: { max: 2, drawDelta: 0, discarded: 0 },
    });
  });

  it('recognizes the any-number + plus-delta shape (Celes, Rune Knight: "discard any number of cards, then draw that many cards plus one")', () => {
    const compiled = compile('Discard any number of cards, then draw that many cards plus one.');
    expect(compiled.decision).toBe('guided');
    const prompt = lootPrompt(compiled);
    expect(prompt?.variableLoot).toEqual({ max: Infinity, drawDelta: 1, discarded: 0 });
  });

  it('recognizes a minus-delta shape (synthetic — no real card matched this exact wording in the local corpus)', () => {
    const compiled = compile('Discard up to one card, then draw that many cards minus three.');
    const prompt = lootPrompt(compiled);
    expect(prompt?.variableLoot).toEqual({ max: 1, drawDelta: -3, discarded: 0 });
  });

  it('(d) fails closed for a cross-player subject ("target player discards ... draws that many")', () => {
    const compiled = compile(
      'Target player discards up to two cards, then draws that many cards.',
    );
    expect(lootPrompt(compiled)).toBeUndefined();
    expect(compiled.decision).toBe('manual');
  });

  it('(d) fails closed for an optional discard-then-draw (Fable of the Mirror-Breaker chapter II)', () => {
    // Real oracle text of chapter II is itself optional ("You may ... If you do, ..."),
    // so both clauses parse with optional=true and the recognizer must not fire.
    const compiled = compile('You may discard up to two cards. If you do, draw that many cards.');
    expect(lootPrompt(compiled)).toBeUndefined();
    expect(compiled.decision).toBe('manual');
    expect(compiled.reasons).toContain('optional');
  });

  it('(e) regression: Absolving Lammasu\'s fixed gain-life(3) is unaffected by the unrelated "up to one" target phrase in the same clause', () => {
    const compiled = compile(
      'When this creature dies, you gain 3 life and suspect up to one target creature an opponent controls.',
      'Creature — Lammasu',
      'Absolving Lammasu',
    );
    const ir = parseAbilityIR(
      'When this creature dies, you gain 3 life and suspect up to one target creature an opponent controls.',
      'Creature — Lammasu',
    );
    expect(ir.effects).toEqual([
      expect.objectContaining({
        atom: 'effect.gain-life',
        count: { kind: 'fixed', value: 3 },
      }),
    ]);
    expect(compiled.decision).toBe('auto');
    expect(compiled.commands).toEqual([{ type: 'adjustLife', delta: 3 }]);
  });

  it('(e) regression: Tolsimir, Friend to Wolves\'s fixed gain-life(3) is unaffected by the unrelated "up to one" target phrase in the same clause', () => {
    const line =
      "Whenever a Wolf you control enters, you gain 3 life and that creature fights up to one target creature you don't control.";
    const ir = parseAbilityIR(line, 'Legendary Creature — Elf Scout');
    const compiled = compileAbilityIR(ir, {
      sourceId: SOURCE_ID,
      def: cardDef('Legendary Creature — Elf Scout', 'Tolsimir, Friend to Wolves'),
    });
    expect(ir.effects).toEqual([
      expect.objectContaining({
        atom: 'effect.gain-life',
        count: { kind: 'fixed', value: 3 },
      }),
    ]);
    expect(compiled.decision).toBe('auto');
    expect(compiled.commands).toEqual([{ type: 'adjustLife', delta: 3 }]);
  });
});

// --- store-level (gameStore.ts) resolution tests -----------------------------------------

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

function castAndResolve(oracleText: string, scryfallId: string): { sourceId: string } {
  const spell = makeDef({
    scryfallId,
    typeLine: 'Sorcery',
    faces: [{ name: scryfallId, typeLine: 'Sorcery', oracleText }],
  });
  store().newGame([{ def: spell, isCommander: false }, ...makeDeck(30)], 1);
  const sourceId = findInstanceId(scryfallId);
  store().moveCard(sourceId, 'stack', 'bottom');
  store().resolveTop();
  return { sourceId };
}

describe('cr-121/cr-701 variable-count loot resolution (gameStore-level)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('(a) up-to two: discarding 2 cards draws exactly 2 (not the max as a fake-auto, and not more)', () => {
    const { sourceId } = castAndResolve(
      'Discard up to two cards, then draw that many cards.',
      'loot-up-to-two',
    );
    const beforeDrawn = store().state!.drawnThisTurn;

    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      kind: 'discard',
      variableLoot: { max: 2, drawDelta: 0, discarded: 0 },
    });

    const first = store().state!.zones.hand[0];
    store().confirmGuidedDiscard(first);
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      variableLoot: { max: 2, drawDelta: 0, discarded: 1 },
    });

    const second = store().state!.zones.hand.find((id) => id !== first)!;
    store().confirmGuidedDiscard(second);

    // Reached max(2) => auto-finalizes: prompt sequence closes and a draw(2) command runs.
    expect(store().pendingGuided).toBeNull();
    const state = store().state!;
    expect(state.drawnThisTurn).toBe(beforeDrawn + 2);
    expect(state.cards[first].zone).toBe('graveyard');
    expect(state.cards[second].zone).toBe('graveyard');
    expect(state.cards[sourceId].zone).toBe('graveyard');
  });

  it('(a) up-to two: discarding 1 then cancelling ("done discarding") draws exactly 1', () => {
    castAndResolve('Discard up to two cards, then draw that many cards.', 'loot-up-to-two-cancel-1');
    const beforeDrawn = store().state!.drawnThisTurn;

    const first = store().state!.zones.hand[0];
    store().confirmGuidedDiscard(first);
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      variableLoot: { discarded: 1 },
    });

    store().cancelGuidedPrompt();

    expect(store().pendingGuided).toBeNull();
    const state = store().state!;
    expect(state.drawnThisTurn).toBe(beforeDrawn + 1);
    expect(state.cards[first].zone).toBe('graveyard');
  });

  it('(a) up-to two: cancelling immediately (0 discards) draws exactly 0', () => {
    castAndResolve('Discard up to two cards, then draw that many cards.', 'loot-up-to-two-cancel-0');
    const beforeDrawn = store().state!.drawnThisTurn;
    const beforeHand = store().state!.zones.hand.length;

    store().cancelGuidedPrompt();

    expect(store().pendingGuided).toBeNull();
    const state = store().state!;
    expect(state.drawnThisTurn).toBe(beforeDrawn);
    expect(state.zones.hand.length).toBe(beforeHand);
  });

  it('(b) any-number: discarding until the hand is exhausted auto-finalizes with draw = discarded + 1 (Celes-style plus-one delta)', () => {
    castAndResolve(
      'Discard any number of cards, then draw that many cards plus one.',
      'loot-any-number',
    );
    const beforeDrawn = store().state!.drawnThisTurn;
    const handBefore = store().state!.zones.hand.length;
    expect(handBefore).toBeGreaterThan(0);

    const discardedIds: string[] = [];
    for (let i = 0; i < handBefore; i += 1) {
      expect(store().pendingGuided).not.toBeNull();
      const nextId = store().state!.zones.hand.find((id) => !discardedIds.includes(id));
      if (!nextId) break;
      discardedIds.push(nextId);
      store().confirmGuidedDiscard(nextId);
    }

    // Hand exhausted mid-loop (or exactly at the end) => auto-finalized without a cancel.
    expect(store().pendingGuided).toBeNull();
    const state = store().state!;
    expect(state.drawnThisTurn).toBe(beforeDrawn + discardedIds.length + 1);
    for (const id of discardedIds) {
      expect(state.cards[id].zone).toBe('graveyard');
    }
  });

  it('(c) delta floors at 0: cancelling with 0 discards and a minus-three delta draws 0, not a negative count', () => {
    castAndResolve(
      'Discard up to one card, then draw that many cards minus three.',
      'loot-minus-delta',
    );
    const beforeDrawn = store().state!.drawnThisTurn;

    store().cancelGuidedPrompt();

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.drawnThisTurn).toBe(beforeDrawn);
  });

  it('(c) delta floors at 0: discarding the max(1) with a minus-three delta still draws 0', () => {
    castAndResolve(
      'Discard up to one card, then draw that many cards minus three.',
      'loot-minus-delta-max',
    );
    const beforeDrawn = store().state!.drawnThisTurn;
    const first = store().state!.zones.hand[0];

    store().confirmGuidedDiscard(first);

    // max=1 reached after a single discard => auto-finalizes.
    expect(store().pendingGuided).toBeNull();
    const state = store().state!;
    expect(state.drawnThisTurn).toBe(beforeDrawn);
    expect(state.cards[first].zone).toBe('graveyard');
  });
});

describe('cr-121/cr-701 variable-count loot — pre-existing single discard prompt regression', () => {
  beforeEach(() => {
    resetStore();
  });

  it('a plain "Discard a card." prompt (no variableLoot) still resolves exactly as before', () => {
    const { sourceId } = castAndResolve('Discard a card.', 'loot-plain-discard');
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      kind: 'discard',
      count: 1,
    });
    expect(store().pendingGuided?.prompts[0].variableLoot).toBeUndefined();

    const cardId = store().state!.zones.hand[0];
    store().confirmGuidedDiscard(cardId);

    expect(store().pendingGuided).toBeNull();
    const state = store().state!;
    expect(state.cards[cardId].zone).toBe('graveyard');
    expect(state.cards[sourceId].zone).toBe('graveyard');
  });
});
