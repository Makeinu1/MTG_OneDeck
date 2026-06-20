/**
 * Reviewer-owned adversarial tests for P1: keyword possession is grammar-aware
 * and English-`oracleText`-only (docs/engine-spec.md §8.3 + CLAUDE.md 設計原則).
 * keywords() must not be fooled by counting/granting/reference clauses — this
 * directly affects hasVigilance (attack auto-tap) and isSummoningSick (haste).
 * Implementation agents must NOT modify this file.
 */
import { describe, expect, it } from 'vitest';
import type { CardDef } from '../../types/card';
import { keywords, hasVigilance, isSummoningSick } from '../status';
import { possessedKeywords } from '../keywordGrammar';
import { applyCommand } from '../commands';
import { initGame, type InitDeckCard } from '../init';
import type { GameState } from '../types';
import { makeDef } from './helpers';

function card(scryfallId: string, oracleText: string, typeLine = 'Creature — Test'): CardDef {
  return makeDef({ scryfallId, typeLine, faces: [{ name: scryfallId, typeLine, oracleText }] });
}

// Exact Scryfall English oracle text (verified against the local snapshot).
const ODRIC = card(
  'odric',
  'When Odric enters, create X Blood tokens, where X is the number of abilities from among flying, first strike, double strike, deathtouch, haste, hexproof, indestructible, lifelink, menace, reach, trample, and vigilance found among creatures you control. (Count each ability only once.)',
  'Legendary Creature — Vampire Soldier',
);

describe('keyword possession ignores counting/granting/reference clauses (P1)', () => {
  it('Odric: possessedKeywords and keywords are empty despite listing 12 keyword names', () => {
    expect(possessedKeywords(ODRIC)).toEqual([]);
    expect(keywords(ODRIC)).toEqual([]);
  });

  it('a pure English keyword line IS possession', () => {
    expect(keywords(card('flyer', 'Flying, vigilance')).sort()).toEqual(['flying', 'vigilance']);
  });

  it('an anthem grant is not possession by the source', () => {
    expect(keywords(card('anthem', 'Creatures you control have vigilance and haste.', 'Enchantment'))).toEqual([]);
  });

  it('a reference clause ("creature with flying") is not possession', () => {
    expect(keywords(card('ref', 'Destroy target creature with flying.', 'Instant'))).toEqual([]);
  });

  it('printedText (Japanese) is ignored — rule reading is English-only', () => {
    const jaOnly = makeDef({
      scryfallId: 'jaonly',
      typeLine: 'Creature',
      faces: [{ name: 'jaonly', typeLine: 'Creature', printedText: '飛行、警戒' }],
    });
    expect(keywords(jaOnly)).toEqual([]);
  });

  it('vanilla and undefined are empty / null-safe', () => {
    expect(keywords(makeDef({ scryfallId: 'v', typeLine: 'Creature', faces: [{ name: 'v', typeLine: 'Creature' }] }))).toEqual([]);
    expect(() => keywords(undefined)).not.toThrow();
    expect(possessedKeywords(undefined)).toEqual([]);
  });
});

describe('Odric is played correctly: no false vigilance/haste (P1)', () => {
  it('hasVigilance=false and isSummoningSick=true the turn Odric enters the battlefield', () => {
    const deck: InitDeckCard[] = [
      { def: ODRIC, isCommander: false },
      ...Array.from({ length: 9 }, (_, i) => ({ def: card(`filler${i}`, ''), isCommander: false })),
    ];
    let s: GameState = initGame(deck, 1);
    const odricId = Object.values(s.cards).find((c) => c.defId === 'odric')!.id;
    s = applyCommand(s, { type: 'moveCard', cardId: odricId, to: 'battlefield', position: 'bottom' }).state;

    expect(hasVigilance(s, odricId)).toBe(false); // would wrongly skip tapping if true
    expect(isSummoningSick(s, odricId)).toBe(true); // would wrongly allow attacking if false
  });
});
