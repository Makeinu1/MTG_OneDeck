/**
 * Reviewer-owned adversarial tests for M6.2: classifier tags that drive the
 * safe candidate actions (docs/engine-spec.md §19). New tags: action.proliferate
 * / action.discard / action.shuffle / action.surveil. Implementation agents must
 * NOT modify this file.
 */
import { describe, expect, it } from 'vitest';
import { classifyCardRules } from '../ruleClassifier';
import type { CardDef } from '../../types/card';

function card(name: string, oracleText: string, typeLine = 'Sorcery'): CardDef {
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

describe('M6.2 candidate-action tags', () => {
  it('detects proliferate', () => {
    expect(ids(card('Prolif', 'Proliferate. (Choose any number of permanents and/or players with a counter on them, then give each another counter of each kind already there.)'))).toContain('action.proliferate');
  });

  it('detects discard (and not "can\'t discard")', () => {
    expect(ids(card('Mind Rot', 'Target player discards two cards.'))).toContain('action.discard');
    expect(ids(card('No Discard', "Players can't discard cards.", 'Enchantment'))).not.toContain('action.discard');
  });

  it('detects shuffle (Cultivate-style)', () => {
    const cultivate = card(
      'Cultivate',
      'Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.',
    );
    const t = ids(cultivate);
    expect(t).toContain('action.shuffle');
    expect(t).toContain('action.search'); // existing tag unaffected
  });

  it('detects surveil', () => {
    expect(ids(card('Surveil Spell', 'Surveil 2, then draw a card.', 'Instant'))).toContain('action.surveil');
  });

  it('keeps existing draw/mill/scry detection (no regression)', () => {
    expect(ids(card('Draw', 'Draw two cards.', 'Instant'))).toContain('action.draw');
    expect(ids(card('Mill', 'Each player mills four cards.', 'Sorcery'))).toContain('action.mill');
    expect(ids(card('Scry', 'Scry 2.', 'Instant'))).toContain('action.scry');
  });

  it('a vanilla card yields no candidate action tags', () => {
    const vanilla = card('Bear', '', 'Creature — Bear');
    const actions = ids(vanilla).filter((id) => id.startsWith('action.'));
    expect(actions).toEqual([]);
  });
});
