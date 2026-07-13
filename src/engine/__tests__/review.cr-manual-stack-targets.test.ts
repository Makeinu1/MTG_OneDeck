// Reviewer-owned adversarial tests for the manual stack target annotation command
// (`setManualTargets`), a sandbox visibility feature (ChatGPT UI-track engine change,
// audited and re-owned by the judge as its own engine slice).
// 実装エージェント(ChatGPT/Codex/Sonnet含む)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 115.1a / 601.2c: the authority for a spell's REAL targets. A manual annotation is
//   explicitly NOT a claim of legality (legalityMode 'unchecked-warning'); it must never be
//   treated as a checked/forced rules target nor suppress guided prompts / auto-execute.
// - CR 400.7: an object that changes zones becomes a NEW object with no memory of prior
//   choices — so a true zone change clears ALL targetSelections (checked and manual alike);
//   stale annotations must not survive resolve/recast.
// - CR 707.10: a copy of a spell copies the choices (incl. targets) made for it.
//
// Contract (design draft: research/cr-grounding/manual-stack-target-annotation.draft.md):
// setManualTargets records manual annotations under the `manual-target-*` slot namespace with
// legalityMode 'unchecked-warning'; the source must be on the stack; candidates are other
// non-ability stack objects or non-ability battlefield permanents; parser/checked selections
// (non-`manual-target-*`) are preserved; re-invocation replaces only the manual namespace; one
// command = one deterministic undo/redo step.
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand } from '../commands';
import { initGame, type InitDeckCard } from '../init';
import type { GameState, TargetSelection, ZoneId } from '../types';
import { makeDef } from './helpers';

function cardDef(id: string, typeLine: string): CardDef {
  return makeDef({ scryfallId: id, name: id, typeLine, faces: [{ name: id, typeLine }] });
}

// initGame assigns instance ids c1..cN in deck order; all start in the library.
const SRC = 'c1';
const OTHER_SPELL = 'c2';
const PERM = 'c3';
const HAND = 'c4';

function move(state: GameState, cardId: string, to: ZoneId): GameState {
  return applyCommand(state, { type: 'moveCard', cardId, to, position: 'bottom' }).state;
}

function setup(): GameState {
  const deck: InitDeckCard[] = [
    { def: cardDef('src-spell', 'Instant'), isCommander: false },
    { def: cardDef('other-spell', 'Sorcery'), isCommander: false },
    { def: cardDef('perm-bear', 'Creature — Bear'), isCommander: false },
    { def: cardDef('hand-card', 'Instant'), isCommander: false },
  ];
  let state = initGame(deck, 1);
  state = move(state, SRC, 'stack');
  state = move(state, OTHER_SPELL, 'stack');
  state = move(state, PERM, 'battlefield');
  state = move(state, HAND, 'hand');
  return state;
}

function manualSlots(state: GameState, id: string): TargetSelection[] {
  return (state.cards[id].targetSelections ?? []).filter((s) =>
    s.slotId.startsWith('manual-target-'),
  );
}

describe('setManualTargets — manual stack target annotation (CR 115/400.7/707.10)', () => {
  it('records other-stack-spell and battlefield-permanent annotations as unchecked-warning', () => {
    const state = setup();
    const next = applyCommand(state, {
      type: 'setManualTargets',
      stackItemId: SRC,
      targetIds: [OTHER_SPELL, PERM],
    }).state;
    const slots = manualSlots(next, SRC);
    expect(slots).toHaveLength(2);
    expect(slots.every((s) => s.legalityMode === 'unchecked-warning')).toBe(true);
    // The annotation must NOT masquerade as a checked/forced rules target.
    expect(slots.some((s) => s.legalityMode === 'checked' || s.legalityMode === 'forced')).toBe(
      false,
    );
  });

  it('HIGH pin — source must be on the stack (battlefield source rejected)', () => {
    const state = setup();
    expect(() =>
      applyCommand(state, { type: 'setManualTargets', stackItemId: PERM, targetIds: [OTHER_SPELL] }),
    ).toThrow();
  });

  it('HIGH pin — illegal target zone (hand card) is rejected, no partial write', () => {
    const state = setup();
    expect(() =>
      applyCommand(state, { type: 'setManualTargets', stackItemId: SRC, targetIds: [HAND] }),
    ).toThrow();
    // original state is untouched (determinism / no mutation on throw)
    expect(state.cards[SRC].targetSelections ?? []).toEqual([]);
  });

  it('HIGH pin — the source cannot annotate itself', () => {
    const state = setup();
    expect(() =>
      applyCommand(state, { type: 'setManualTargets', stackItemId: SRC, targetIds: [SRC] }),
    ).toThrow();
  });

  it('pin — an ability source is rejected (feature is for unparseable spells; abilities model their own targets)', () => {
    let state = setup();
    state = {
      ...state,
      cards: { ...state.cards, [SRC]: { ...state.cards[SRC], isAbility: true } },
    };
    expect(() =>
      applyCommand(state, { type: 'setManualTargets', stackItemId: SRC, targetIds: [PERM] }),
    ).toThrow();
  });

  it('re-invocation replaces only the manual namespace (idempotent count, no accumulation)', () => {
    let state = setup();
    state = applyCommand(state, {
      type: 'setManualTargets',
      stackItemId: SRC,
      targetIds: [OTHER_SPELL, PERM],
    }).state;
    state = applyCommand(state, {
      type: 'setManualTargets',
      stackItemId: SRC,
      targetIds: [PERM],
    }).state;
    expect(manualSlots(state, SRC)).toHaveLength(1);
  });

  it('preserves checked (non-manual) selections when adding manual annotations', () => {
    let state = setup();
    // inject a parser/checked selection (player target) under a non-manual slot
    const checked: TargetSelection = {
      slotId: 'target-0',
      raw: 'checked',
      kind: 'player',
      selection: { kind: 'player', playerId: 'P1' },
      legalityMode: 'checked',
    };
    state = {
      ...state,
      cards: {
        ...state.cards,
        [SRC]: { ...state.cards[SRC], targetSelections: [checked] },
      },
    };
    const next = applyCommand(state, {
      type: 'setManualTargets',
      stackItemId: SRC,
      targetIds: [PERM],
    }).state;
    const all = next.cards[SRC].targetSelections ?? [];
    expect(all.some((s) => s.slotId === 'target-0' && s.legalityMode === 'checked')).toBe(true);
    expect(manualSlots(next, SRC)).toHaveLength(1);
  });

  it('HIGH pin — CR 400.7: a zone change clears ALL targetSelections (no stale annotation)', () => {
    let state = setup();
    state = applyCommand(state, {
      type: 'setManualTargets',
      stackItemId: SRC,
      targetIds: [PERM],
    }).state;
    expect(manualSlots(state, SRC)).toHaveLength(1);
    // move the stack spell to the graveyard (resolve-like true zone change)
    state = move(state, SRC, 'graveyard');
    expect(state.cards[SRC].targetSelections ?? []).toEqual([]);
  });

  it('determinism: applyCommand returns a new state; the input state is not mutated', () => {
    const state = setup();
    const before = state.cards[SRC].targetSelections ?? [];
    applyCommand(state, { type: 'setManualTargets', stackItemId: SRC, targetIds: [PERM] });
    expect(state.cards[SRC].targetSelections ?? []).toEqual(before);
  });
});
