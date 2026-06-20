/**
 * Reviewer-owned adversarial tests for M6.3: trigger candidate queue
 * (docs/engine-spec.md §20). Events surface candidates; nothing is auto-stacked;
 * undo/redo never generate candidates. Implementation agents must NOT modify
 * this file.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../gameStore';
import { classifyCardRules } from '../../data/ruleClassifier';
import { makeDef, makeDeck } from '../../engine/__tests__/helpers';
import type { CardDef } from '../../types/card';

function store() {
  return useGameStore.getState();
}
function snap() {
  return store().state!;
}
function instanceByDef(defId: string): string {
  return Object.values(snap().cards).find((c) => c.defId === defId)!.id;
}
function withText(id: string, oracleText: string, typeLine = 'Creature'): CardDef {
  return makeDef({ scryfallId: id, typeLine, faces: [{ name: id, typeLine, oracleText }] });
}
const tagIds = (def: CardDef): string[] => classifyCardRules(def).map((t) => t.id);

beforeEach(() => {
  useGameStore.setState({ autoAdvanceToMain: false });
});

describe('M6.3 trigger tags (classifier)', () => {
  it('detects death / cast / landfall / upkeep triggers (and existing etb)', () => {
    expect(tagIds(withText('d', 'When this creature dies, draw a card.'))).toContain('trigger.death');
    expect(tagIds(withText('c', 'Whenever you cast a spell, scry 1.'))).toContain('trigger.cast');
    expect(
      tagIds(withText('l', 'Landfall — Whenever a land enters the battlefield under your control, draw a card.')),
    ).toContain('trigger.landfall');
    expect(tagIds(withText('u', 'At the beginning of your upkeep, draw a card.', 'Enchantment'))).toContain('trigger.upkeep');
    expect(tagIds(withText('e', 'When this creature enters, draw a card.'))).toContain('trigger.etb');
  });
});

describe('M6.3 trigger candidate queue (store)', () => {
  function newGameWithEtb(): string {
    store().newGame(
      [{ def: withText('etb', 'When this creature enters, draw a card.', 'Creature — Bird'), isCommander: false }, ...makeDeck(12)],
      7,
    );
    return instanceByDef('etb');
  }

  it('an ETB event surfaces a candidate but does NOT auto-stack', () => {
    const id = newGameWithEtb();
    store().moveCard(id, 'battlefield');
    expect(store().triggerCandidates.some((c) => c.sourceId === id)).toBe(true);
    expect(snap().zones.stack.length).toBe(0); // never auto-stacked
  });

  it('does NOT generate candidates on undo (cleared, not regenerated)', () => {
    const id = newGameWithEtb();
    store().moveCard(id, 'battlefield');
    expect(store().triggerCandidates.length).toBeGreaterThan(0);
    store().undo();
    expect(store().triggerCandidates).toEqual([]);
  });

  it('addAbilityToStack removes the acted candidate; dismiss clears all', () => {
    const id = newGameWithEtb();
    store().moveCard(id, 'battlefield');
    expect(store().triggerCandidates.some((c) => c.sourceId === id)).toBe(true);

    store().addAbilityToStack(id, 'triggered');
    expect(store().triggerCandidates.some((c) => c.sourceId === id)).toBe(false);
    expect(snap().zones.stack.length).toBe(1);

    // regenerate a candidate, then dismiss
    store().moveCard(id, 'graveyard');
    store().moveCard(id, 'battlefield');
    expect(store().triggerCandidates.length).toBeGreaterThan(0);
    store().dismissTriggerCandidates();
    expect(store().triggerCandidates).toEqual([]);
  });

  it('landfall: playing a land surfaces battlefield landfall watchers', () => {
    store().newGame(
      [
        { def: withText('watch', 'Landfall — Whenever a land enters the battlefield under your control, create a 1/1 green Saproling creature token.'), isCommander: false },
        { def: makeDef({ scryfallId: 'land', typeLine: 'Land', faces: [{ name: 'land', typeLine: 'Land' }] }), isCommander: false },
        ...makeDeck(10),
      ],
      7,
    );
    const wId = instanceByDef('watch');
    const lId = instanceByDef('land');
    store().moveCard(wId, 'battlefield');
    store().moveCard(lId, 'hand');
    store().playLand(lId);
    expect(store().triggerCandidates.some((c) => c.sourceId === wId)).toBe(true);
    expect(snap().zones.stack.length).toBe(0); // still not auto-stacked
  });
});
