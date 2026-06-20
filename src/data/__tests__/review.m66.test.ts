/**
 * Reviewer-owned tests for M6.6/D: classifier false-positive tightening
 * (action.destroy / action.exile / action.sacrifice now require an object).
 * Implementation agents must NOT modify this file.
 */
import { describe, expect, it } from 'vitest';
import { classifyCardRules } from '../ruleClassifier';
import type { CardDef } from '../../types/card';

function card(name: string, oracleText: string, typeLine = 'Instant'): CardDef {
  return {
    scryfallId: name,
    oracleId: name,
    name,
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine,
    faces: [{ name, typeLine, oracleText }],
  };
}
const ids = (def: CardDef): string[] => classifyCardRules(def).map((t) => t.id);

describe('M6.6/D classifier FP tightening', () => {
  it('real destroy/exile/sacrifice with an object still detected', () => {
    expect(ids(card('m', 'Destroy target creature.'))).toContain('action.destroy');
    expect(ids(card('d', 'Destroy all creatures.', 'Sorcery'))).toContain('action.destroy');
    expect(ids(card('s', 'Exile target permanent.'))).toContain('action.exile');
    expect(ids(card('sac', 'As an additional cost to cast this spell, sacrifice a creature.', 'Sorcery'))).toContain('action.sacrifice');
  });

  it('does NOT fire destroy on "can\'t be destroyed" / indestructible / would-be-destroyed', () => {
    expect(ids(card('a', "This creature can't be destroyed.", 'Creature — Avatar'))).not.toContain('action.destroy');
    expect(ids(card('b', 'Indestructible (Damage and effects that say "destroy" don\'t destroy this.)', 'Creature — Wall'))).not.toContain('action.destroy');
    expect(ids(card('c', 'If this creature would be destroyed, exile it instead.', 'Creature — Phoenix'))).not.toContain('action.destroy');
  });

  it('does NOT fire exile on "from exile" / "in exile" references', () => {
    expect(ids(card('e', 'You may play that card from exile this turn.', 'Sorcery'))).not.toContain('action.exile');
    expect(ids(card('f', 'Whenever a card is put into exile, draw a card.', 'Enchantment'))).not.toContain('action.exile');
  });

  it('keeps unrelated tags intact (search still works)', () => {
    expect(ids(card('q', 'Search your library for a basic land card.', 'Sorcery'))).toContain('action.search');
  });
});
