/**
 * Reviewer-owned adversarial tests for Phase C (docs/engine-spec.md §28):
 * trigger-family expansion — end-step / draw / sacrifice / combat-damage.
 * end-step/draw also feed the live candidate queue; sacrifice/combat-damage
 * are classification-only this milestone (§28.0). Oracle text is the real
 * Scryfall snapshot wording so the FP fixes stay locked.
 * Implementation agents must NOT modify this file.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../gameStore';
import { classifyCardRules } from '../../data/ruleClassifier';
import { makeDef, makeDeck } from '../../engine/__tests__/helpers';
import type { GameState } from '../../engine/types';
import type { CardDef } from '../../types/card';

function store() {
  return useGameStore.getState();
}
function snap(): GameState {
  return store().state!;
}
function instByDef(defId: string): string {
  return Object.values(snap().cards).find((c) => c.defId === defId)!.id;
}
function perm(id: string, typeLine: string, oracleText: string): CardDef {
  return makeDef({
    scryfallId: id,
    typeLine,
    faces: [{ name: id, typeLine, oracleText }],
  });
}
function creature(id: string, oracleText: string): CardDef {
  return perm(id, 'Creature — Test', oracleText);
}
function tagIds(def: CardDef): string[] {
  return classifyCardRules(def).map((t) => t.id);
}
function candidateTriggerIds(): string[] {
  return store().triggerCandidates.map((c) => c.triggerId);
}
function advanceToEndPhase(): void {
  let guard = 0;
  while (snap().phase !== 'end' && guard < 12) {
    store().nextPhase();
    guard += 1;
  }
}

beforeEach(() => {
  useGameStore.setState({ autoAdvanceToMain: false });
});

describe('Phase C classifier tags — detection', () => {
  it('detects the four new trigger families', () => {
    expect(tagIds(perm('grace', 'Enchantment', 'At the beginning of your end step, choose one —')))
      .toContain('trigger.end-step');
    expect(tagIds(creature('locust', 'Flying\nWhenever you draw a card, create a 1/1 blue and red Insect creature token.')))
      .toContain('trigger.draw');
    expect(tagIds(creature('mayhem', 'Whenever a player sacrifices a permanent, this creature deals 1 damage to any target.')))
      .toContain('trigger.sacrifice');
    expect(tagIds(creature('piracy', 'Whenever a creature you control deals combat damage to an opponent, you may draw a card.')))
      .toContain('trigger.combat-damage');
  });
});

describe('Phase C classifier tags — adversarial false positives', () => {
  it('does NOT tag trigger.draw when draw is the effect of another trigger', () => {
    // Baleful Strix: ETB-draw effect, not a draw trigger.
    const strix = tagIds(creature('strix', 'Flying, deathtouch\nWhen this creature enters, draw a card.'));
    expect(strix).toContain('trigger.etb');
    expect(strix).not.toContain('trigger.draw');
    // Coastal Piracy: combat-damage trigger whose effect draws.
    const piracy = tagIds(creature('piracy', 'Whenever a creature you control deals combat damage to an opponent, you may draw a card.'));
    expect(piracy).toContain('trigger.combat-damage');
    expect(piracy).not.toContain('trigger.draw');
  });

  it('does NOT tag trigger.end-step for delayed "next end step" wording', () => {
    const locust = tagIds(creature('locust', 'Whenever you draw a card, create a token.\nWhen this creature dies, return it to its owner’s hand at the beginning of the next end step.'));
    expect(locust).toContain('trigger.draw');
    expect(locust).not.toContain('trigger.end-step');
    const ashling = tagIds(creature('ashling', 'Whenever you sacrifice a nontoken Elemental, create a copy.\nAt the beginning of your next end step, sacrifice it unless you pay {W}{U}{B}{R}{G}.'));
    expect(ashling).toContain('trigger.sacrifice');
    expect(ashling).not.toContain('trigger.end-step');
  });

  it('does NOT tag trigger.sacrifice when sacrifice is an effect or a cost', () => {
    // ETB effect that makes players sacrifice.
    expect(tagIds(creature('accursed', 'When this creature enters, each player sacrifices a nontoken creature of their choice.')))
      .not.toContain('trigger.sacrifice');
    // Activated-ability cost (no when/whenever).
    expect(tagIds(creature('altar', '{T}, Sacrifice this creature: Draw two cards.')))
      .not.toContain('trigger.sacrifice');
  });
});

describe('Phase C live candidate queue — end-step / draw', () => {
  it('surfaces an end-step trigger when entering the end phase', () => {
    const grace = perm('grace', 'Enchantment', 'At the beginning of your end step, choose one —');
    store().newGame([{ def: grace, isCommander: false }, ...makeDeck(10)], 3);
    const id = instByDef('grace');
    store().moveCard(id, 'battlefield');
    advanceToEndPhase();
    expect(store().triggerCandidates.some((c) => c.sourceId === id && c.triggerId === 'trigger.end-step')).toBe(true);
  });

  it('surfaces a draw trigger when a card is drawn', () => {
    const locust = creature('locust', 'Flying\nWhenever you draw a card, create a 1/1 Insect token.');
    store().newGame([{ def: locust, isCommander: false }, ...makeDeck(10)], 3);
    const id = instByDef('locust');
    store().moveCard(id, 'battlefield');
    store().draw(1);
    expect(store().triggerCandidates.some((c) => c.sourceId === id && c.triggerId === 'trigger.draw')).toBe(true);
    store().undo();
    expect(store().triggerCandidates).toEqual([]);
  });
});

describe('Phase C boundary — sacrifice / combat-damage stay OUT of the queue', () => {
  it('a sacrifice trigger never becomes a live candidate (death event)', () => {
    const mayhem = creature('mayhem', 'Whenever a player sacrifices a permanent, this creature deals 1 damage to any target.');
    const fodder = creature('fodder', 'Vanilla.');
    store().newGame([{ def: mayhem, isCommander: false }, { def: fodder, isCommander: false }, ...makeDeck(10)], 7);
    const mayhemId = instByDef('mayhem');
    const fodderId = instByDef('fodder');
    store().moveCard(mayhemId, 'battlefield');
    store().moveCard(fodderId, 'battlefield');
    store().moveCard(fodderId, 'graveyard'); // battlefield -> graveyard (sacrifice is indistinguishable from death)
    expect(candidateTriggerIds()).not.toContain('trigger.sacrifice');
  });

  it('a combat-damage trigger never becomes a live candidate (attack event)', () => {
    const piracy = creature('piracy', 'Whenever a creature you control deals combat damage to an opponent, you may draw a card.');
    store().newGame([{ def: piracy, isCommander: false }, ...makeDeck(10)], 3);
    const id = instByDef('piracy');
    store().moveCard(id, 'battlefield');
    store().declareAttack([id], '対戦相手');
    expect(candidateTriggerIds()).not.toContain('trigger.combat-damage');
  });
});
