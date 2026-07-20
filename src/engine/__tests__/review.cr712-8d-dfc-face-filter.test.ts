// Reviewer-owned adversarial tests for CR 712.8d DFC face filter in trigger detection.
// 実装エージェントは本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 712.8d: While a double-faced card is on the battlefield, consider only the
//   characteristics of the face that's currently up.
// - Consequence: trigger detection must NOT scan back-face ability lines.
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand } from '../commands';
import { initGame, type InitDeckCard } from '../init';
import { abilityLineIndexForKind, detectTriggerCandidates } from '../triggers';
import type { GameState } from '../types';
import { makeDeck, makeDef } from './helpers';

function dfcDef(
  id: string,
  frontText: string,
  backText: string,
  frontType = 'Creature — Human',
  backType = 'Creature — Werewolf',
): CardDef {
  return makeDef({
    scryfallId: id,
    name: id,
    layout: 'transform',
    typeLine: frontType,
    faces: [
      { name: `${id}-front`, typeLine: frontType, oracleText: frontText },
      { name: `${id}-back`, typeLine: backType, oracleText: backText },
    ],
  });
}

const FRONT_ETB_OTHER = 'Whenever another creature enters, draw a card.';
const BACK_DEATH_OTHER = 'Whenever another creature dies, put a +1/+1 counter on this creature.';

function gameWithDfc(def: CardDef): GameState {
  const fodder = makeDef({ scryfallId: 'fodder', typeLine: 'Creature — Bear' });
  const deck: InitDeckCard[] = [
    { def, isCommander: false },
    { def: fodder, isCommander: false },
    ...makeDeck(20),
  ];
  let state = initGame(deck, 1);
  const dfcId = Object.values(state.cards).find((c) => c.defId === def.oracleId)!.id;
  const fodId = Object.values(state.cards).find((c) => c.defId === 'fodder')!.id;
  state = applyCommand(state, { type: 'moveCard', cardId: dfcId, to: 'battlefield', position: 'bottom' }).state;
  state = applyCommand(state, { type: 'moveCard', cardId: fodId, to: 'battlefield', position: 'bottom' }).state;
  return state;
}

function idOf(state: GameState, defId: string): string {
  return Object.values(state.cards).find((c) => c.defId === defId)?.id ?? '';
}

describe('CR 712.8d DFC face filter — trigger detection', () => {
  const dfc = dfcDef('r-dfc-werewolf', FRONT_ETB_OTHER, BACK_DEATH_OTHER);

  it('face-0 up: back-face death-other trigger is NOT detected when a creature dies', () => {
    const state = gameWithDfc(dfc);
    const dfcId = idOf(state, 'r-dfc-werewolf');
    const fodId = idOf(state, 'fodder');
    // Kill fodder → death event. Back face has "whenever another creature dies" but face is 0.
    const after = applyCommand(state, { type: 'moveCard', cardId: fodId, to: 'graveyard', position: 'bottom' }).state;
    const candidates = detectTriggerCandidates(state, after);
    if (candidates) {
      const backTrigger = candidates.find((c) => c.sourceId === dfcId);
      expect(backTrigger).toBeUndefined();
    }
  });

  it('face-0 up: front-face triggered ability line index is resolvable (no ambiguity from back face)', () => {
    const state = gameWithDfc(dfc);
    const dfcId = idOf(state, 'r-dfc-werewolf');
    // Front face has 1 triggered line, back face has 1 triggered line.
    // Without face filter: 2 matches → ambiguous → undefined.
    // With face filter: 1 match → resolved.
    const idx = abilityLineIndexForKind(state, dfcId, 'triggered');
    expect(idx).toBeDefined();
    expect(typeof idx).toBe('number');
  });

  it('MDFC (Pathway): back-face activated ability does not create ambiguity', () => {
    const pathway = dfcDef('r-dfc-pathway', '{T}: Add {G}.', '{T}: Add {U}.', 'Land', 'Land');
    const deck: InitDeckCard[] = [{ def: pathway, isCommander: false }, ...makeDeck(20)];
    let state = initGame(deck, 1);
    const cardId = Object.values(state.cards).find((c) => c.defId === 'r-dfc-pathway')!.id;
    state = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'bottom' }).state;
    // Face 0 has {T}: Add {G}, face 1 has {T}: Add {U}.
    // Without face filter: 2 activated → ambiguous → undefined → manual.
    // With face filter: 1 activated → resolved.
    const idx = abilityLineIndexForKind(state, cardId, 'activated');
    expect(idx).toBeDefined();
  });

  it('false-positive guard: back-face trigger text does not appear in candidates after ETB event', () => {
    const state = gameWithDfc(dfc);
    const dfcId = idOf(state, 'r-dfc-werewolf');
    // Create a token (ETB event). Front face has "whenever another creature enters" → should fire.
    const after = applyCommand(state, { type: 'createToken', name: 'Token', typeLine: 'Creature — Beast', power: '1', toughness: '1', quantity: 1 }).state;
    const candidates = detectTriggerCandidates(state, after);
    if (candidates) {
      const fromDfc = candidates.filter((c) => c.sourceId === dfcId);
      // Front face ETB-other should appear (if tagged), back face death-other must NOT
      for (const c of fromDfc) {
        expect(c.triggerId).not.toBe('trigger.death-other');
        expect(c.triggerId).not.toBe('trigger.death');
      }
    }
  });
});
