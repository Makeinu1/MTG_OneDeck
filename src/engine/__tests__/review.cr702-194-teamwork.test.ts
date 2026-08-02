/**
 * review.cr702-194-teamwork — CR 702.194 Teamwork keyword recognition.
 *
 * REVIEWER-OWNED: implementers must NOT edit this file; fix the engine.
 *
 * CR grounding (pinned 2026-06-19):
 *   702.194a: "Teamwork N" means "As an additional cost to cast this spell,
 *     you may tap any number of creatures you control with total power N or
 *     more." Paying follows 601.2b and 601.2f–h.
 *   702.194b: "using teamwork" refers to whether the player declared the
 *     intention to pay the teamwork cost as they cast that spell.
 */

import { describe, expect, it } from 'vitest';

import { KEYWORD_DEFINITIONS, parseTeamworkThreshold, possessedKeywords } from '../keywordGrammar';
import { makeDef } from './helpers';

describe('review.cr702-194 — Teamwork keyword definition', () => {
  it('R1: KEYWORD_DEFINITIONS contains teamwork with ruleRef 702.194', () => {
    const def = KEYWORD_DEFINITIONS.find((d) => d.id === 'teamwork');
    expect(def).toBeDefined();
    expect(def!.name).toBe('teamwork');
    expect(def!.ruleRef).toBe('702.194');
  });

  it('R2: possessedKeywords recognizes Teamwork on a card', () => {
    const cardDef = makeDef({
      scryfallId: 'team Tactics',
      typeLine: 'Instant',
      faces: [{
        name: 'Team Tactics',
        typeLine: 'Instant',
        manaCost: '{1}{W}',
        oracleText:
          'Teamwork 1 (As an additional cost to cast this spell, you may tap any number of creatures you control with total power 1 or more.)\nTarget creature gains double strike until end of turn. If this spell was cast using teamwork, that creature also gains trample until end of turn.',
      }],
    });
    const keywords = possessedKeywords(cardDef);
    expect(keywords).toContain('teamwork');
  });
});

describe('review.cr702-194 — parseTeamworkThreshold', () => {
  it('R3: extracts threshold from Teamwork N with reminder text', () => {
    expect(
      parseTeamworkThreshold(
        'Teamwork 4 (As an additional cost to cast this spell, you may tap any number of creatures you control with total power 4 or more.)\nChoose one.',
      ),
    ).toBe(4);
  });

  it('R4: extracts threshold 1', () => {
    expect(
      parseTeamworkThreshold(
        'Teamwork 1 (As an additional cost to cast this spell, you may tap any number of creatures you control with total power 1 or more.)\nTarget creature gets +2/+2.',
      ),
    ).toBe(1);
  });

  it('R5: extracts threshold 5', () => {
    expect(
      parseTeamworkThreshold(
        "Teamwork 5 (As an additional cost to cast this spell, you may tap any number of creatures you control with total power 5 or more.)\nReveal the top eight cards of your library.",
      ),
    ).toBe(5);
  });

  it('R6: returns null for non-teamwork text', () => {
    expect(parseTeamworkThreshold('Flying\nVigilance')).toBeNull();
    expect(parseTeamworkThreshold('')).toBeNull();
    expect(
      parseTeamworkThreshold('Whenever Agent Maria Hill becomes tapped to pay a teamwork cost, put a +1/+1 counter on her.'),
    ).toBeNull();
  });

  it('R7: case-insensitive matching', () => {
    expect(parseTeamworkThreshold('TEAMWORK 3 (reminder)\nEffect')).toBe(3);
  });
});
