/**
 * Reviewer-owned adversarial tests for M6.1: grammar-aware rule classifier +
 * per-deck rule-assist report (docs/engine-spec.md §16). Implementation agents
 * must NOT modify this file; make these pass by fixing src/data/*.
 *
 * Oracle texts below are the exact strings from the local Scryfall snapshot
 * (research/scryfall-rules/2026-06-19), confirmed during review.
 */
import { describe, expect, it } from 'vitest';
import { classifyCardRules } from '../ruleClassifier';
import { summarizeDeckRuleTags, type RuleDeckEntry } from '../ruleDeckSummary';
import type { CardDef, CardFace } from '../../types/card';

function makeCard(name: string, oracleText: string, extra: Partial<CardDef> = {}): CardDef {
  const face: CardFace = { name, typeLine: 'Test', oracleText };
  return {
    scryfallId: name,
    oracleId: name,
    name,
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Test',
    faces: [face],
    ...extra,
  };
}

const ids = (def: CardDef): string[] => classifyCardRules(def).map((t) => t.id);
const keywordIds = (def: CardDef): string[] => ids(def).filter((id) => id.startsWith('keyword.'));

// --- Real-card fixtures (exact Oracle text) ---
const ODRIC = makeCard(
  'Odric, Blood-Cursed',
  'When Odric enters, create X Blood tokens, where X is the number of abilities from among flying, first strike, double strike, deathtouch, haste, hexproof, indestructible, lifelink, menace, reach, trample, and vigilance found among creatures you control. (Count each ability only once.)',
  // Scryfall keywords WRONGLY lists all 12 counted keywords; classifier must ignore this field.
  { keywords: ['Deathtouch', 'Lifelink', 'Reach', 'Indestructible', 'Hexproof', 'First strike', 'Haste', 'Trample', 'Menace', 'Double strike'], edhrecRank: 12345 },
);
const ORNITHOPTER = makeCard('Ornithopter', 'Flying');
const ANGEL_OF_LIGHT = makeCard('Angel of Light', 'Flying, vigilance');
const AKROMAS_MEMORIAL = makeCard(
  "Akroma's Memorial",
  'Creatures you control have flying, first strike, vigilance, trample, haste, and protection from black and from red.',
);
const COUNTERSPELL = makeCard('Counterspell', 'Counter target spell.');
const HARDENED_SCALES = makeCard(
  'Hardened Scales',
  'If one or more +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead.',
);
const ABRUPT_DECAY = makeCard(
  'Abrupt Decay',
  "This spell can't be countered.\nDestroy target nonland permanent with mana value 3 or less.",
);
const AIRSHIP_CRASH = makeCard(
  'Airship Crash',
  'Destroy target artifact, enchantment, or creature with flying.\nCycling {2} ({2}, Discard this card: Draw a card.)',
);
const CULTIVATE = makeCard(
  'Cultivate',
  'Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.',
);

describe('keyword possession is grammar-based, not Scryfall-keywords-based (M6.1)', () => {
  it('Odric: no keyword possession despite Scryfall keywords listing 12; ETB + create-token detected', () => {
    expect(keywordIds(ODRIC)).toEqual([]);
    expect(ids(ODRIC)).toEqual(expect.arrayContaining(['trigger.etb', 'action.create-token']));
    expect(ids(ODRIC)).not.toContain('action.counter'); // "number of abilities" is not a counterspell
  });

  it('pure keyword lines ARE possession: Ornithopter / Angel of Light', () => {
    expect(keywordIds(ORNITHOPTER)).toEqual(['keyword.flying']);
    expect(keywordIds(ANGEL_OF_LIGHT)).toEqual(
      expect.arrayContaining(['keyword.flying', 'keyword.vigilance']),
    );
  });

  it('anthem grant is NOT possession: Akroma’s Memorial owns no keyword', () => {
    expect(keywordIds(AKROMAS_MEMORIAL)).toEqual([]);
  });

  it('reference vs possession + reminder stripping: Airship Crash', () => {
    const tags = ids(AIRSHIP_CRASH);
    expect(tags).toContain('keyword.cycling'); // "Cycling {2}" own line = possession
    expect(tags).not.toContain('keyword.flying'); // "creature with flying" = reference
    expect(tags).toContain('action.destroy');
    expect(tags).toContain('concept.target');
    expect(tags).not.toContain('action.draw'); // "Draw a card" is inside reminder text
  });
});

describe('counter (打ち消し) vs card-counters separation (M6.1)', () => {
  it('Counterspell => action.counter (+target), never card-counters', () => {
    const tags = ids(COUNTERSPELL);
    expect(tags).toContain('action.counter');
    expect(tags).toContain('concept.target');
    expect(tags).not.toContain('action.card-counters');
  });

  it('Hardened Scales => card-counters (+replacement), never counter', () => {
    const tags = ids(HARDENED_SCALES);
    expect(tags).toContain('action.card-counters');
    expect(tags).toContain('effect.replacement');
    expect(tags).not.toContain('action.counter');
  });

  it("can't be countered is neither counter nor card-counters: Abrupt Decay", () => {
    const tags = ids(ABRUPT_DECAY);
    expect(tags).not.toContain('action.counter');
    expect(tags).not.toContain('action.card-counters');
    expect(tags).toEqual(expect.arrayContaining(['action.destroy', 'concept.target']));
  });

  it('Cultivate => action.search', () => {
    expect(ids(CULTIVATE)).toContain('action.search');
  });
});

describe('purity / robustness (M6.1)', () => {
  it('null-safe: missing oracleText / faces / metadata never throws', () => {
    const noText = makeCard('Blank', '');
    noText.faces = [{ name: 'Blank', typeLine: 'X' }]; // no oracleText
    expect(() => classifyCardRules(noText)).not.toThrow();
    expect(classifyCardRules(noText)).toEqual([]);

    const noFaces = { ...makeCard('NoFaces', 'Flying') };
    (noFaces as { faces: unknown }).faces = undefined;
    expect(() => classifyCardRules(noFaces)).not.toThrow();
  });

  it('deterministic: same def yields identical tags (stable order)', () => {
    expect(classifyCardRules(ODRIC)).toEqual(classifyCardRules(ODRIC));
    expect(classifyCardRules(AIRSHIP_CRASH)).toEqual(classifyCardRules(AIRSHIP_CRASH));
  });

  it('every tag carries a non-empty matchedText (transparency)', () => {
    for (const def of [ODRIC, COUNTERSPELL, AIRSHIP_CRASH, HARDENED_SCALES]) {
      for (const tag of classifyCardRules(def)) {
        expect(typeof tag.matchedText).toBe('string');
        expect(tag.matchedText.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('summarizeDeckRuleTags aggregation (M6.1)', () => {
  it('quantity-weighted counts, deduped representative names, deckCount-desc order', () => {
    const entries: RuleDeckEntry[] = [
      { card: COUNTERSPELL, quantity: 1, section: 'main' },
      { card: CULTIVATE, quantity: 2, section: 'main' },
      { card: makeCard('Kodama’s Reach', 'Search your library for up to two basic land cards...'), quantity: 1, section: 'main' },
    ];
    const summary = summarizeDeckRuleTags(entries);
    const search = summary.find((s) => s.tag.id === 'action.search');
    expect(search?.deckCount).toBe(3); // Cultivate x2 + Kodama x1
    expect(search?.cardNames.length).toBe(2); // two distinct cards
    // ordering: deckCount descending
    const counts = summary.map((s) => s.deckCount);
    expect([...counts]).toEqual([...counts].sort((a, b) => b - a));
  });

  it('uses printedName when present for representative names', () => {
    const ja = makeCard('Counterspell', 'Counter target spell.', { printedName: '意思を決める撃ち' });
    const summary = summarizeDeckRuleTags([{ card: ja, quantity: 1, section: 'main' }]);
    const counter = summary.find((s) => s.tag.id === 'action.counter');
    expect(counter?.cardNames).toContain('意思を決める撃ち');
  });
});
