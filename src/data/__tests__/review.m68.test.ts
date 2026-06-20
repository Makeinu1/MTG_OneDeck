/**
 * Reviewer-owned adversarial tests for M6.8: zone-cast assist classifier tags
 * (docs/engine-spec.md §23). Detects alt-cast keywords, "cast/play from
 * graveyard/exile" permissions, and additional/alternative cost phrases —
 * all advisory (no board change). Implementation agents must NOT modify this file.
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

describe('M6.8 zone-cast assist classifier tags', () => {
  it('detects keyword alt-cast (flashback / escape / disturb / aftermath / others)', () => {
    expect(ids(card('fl', 'Draw two cards, then discard two cards.\nFlashback {2}{R}', 'Sorcery'))).toContain('concept.alt-cast');
    expect(ids(card('uro', 'Escape—{G}{G}{U}{U}, Exile five other cards from your graveyard.', 'Creature — Elder Giant'))).toContain('concept.alt-cast');
    expect(ids(card('di', 'Disturb {1}{W} (You may cast this card from your graveyard transformed.)', 'Creature — Spirit'))).toContain('concept.alt-cast');
    expect(ids(card('af', 'Aftermath (Cast this spell only from your graveyard.)', 'Sorcery'))).toContain('concept.alt-cast');
    expect(ids(card('fo', 'Foretell {1}{U}', 'Sorcery'))).toContain('concept.alt-cast');
  });

  it('detects non-keyword "cast/play from graveyard/exile" permission', () => {
    expect(
      ids(card('mul', 'During each of your turns, you may play a land and cast a permanent spell of each permanent type from your graveyard.', 'Legendary Creature — Elemental')),
    ).toContain('concept.cast-from-zone');
    expect(
      ids(card('lur', 'During each of your turns, you may cast one permanent spell with mana value 2 or less from your graveyard.', 'Legendary Creature — Cat Nightmare')),
    ).toContain('concept.cast-from-zone');
  });

  it('detects additional and alternative cost phrases', () => {
    expect(ids(card('sq', 'As an additional cost to cast this spell, exile a creature card from your graveyard.', 'Sorcery'))).toContain('cost.additional');
    expect(ids(card('fg', 'If you control a commander, you may cast this spell without paying its mana cost.', 'Instant'))).toContain('cost.alternative');
  });

  it('does NOT fire cast-from-zone on return-to-battlefield (reanimation) effects', () => {
    expect(ids(card('rea', 'Put target creature card from a graveyard onto the battlefield under your control.', 'Sorcery'))).not.toContain('concept.cast-from-zone');
    expect(ids(card('ad', 'Return enchanted creature card to the battlefield.', 'Enchantment — Aura'))).not.toContain('concept.cast-from-zone');
    expect(
      ids(card('sun', 'Whenever Sun Titan enters or attacks, you may return target permanent card with mana value 3 or less from your graveyard to the battlefield.', 'Creature — Giant')),
    ).not.toContain('concept.cast-from-zone');
  });

  it('does NOT fire alt-cast / cost tags on unrelated text', () => {
    const plain = ids(card('bear', 'Vanilla bear with no special text.', 'Creature — Bear'));
    expect(plain).not.toContain('concept.alt-cast');
    expect(plain).not.toContain('concept.cast-from-zone');
    expect(plain).not.toContain('cost.additional');
    expect(plain).not.toContain('cost.alternative');
    expect(ids(card('ind', "This creature can't be destroyed.", 'Creature — Avatar'))).not.toContain('concept.alt-cast');
  });
});
