import { describe, expect, it } from 'vitest';

import { KEYWORD_DEFINITIONS, parseTeamworkThreshold } from '../keywordGrammar';

describe('parseTeamworkThreshold (CR 702.194a)', () => {
  it('extracts threshold from "Teamwork 4 (...)"', () => {
    const text =
      'Teamwork 4 (As an additional cost to cast this spell, you may tap any number of creatures you control with total power 4 or more.)\nDraw two cards.';
    expect(parseTeamworkThreshold(text)).toBe(4);
  });

  it('extracts threshold 1', () => {
    expect(parseTeamworkThreshold('Teamwork 1 (reminder)\nEffect.')).toBe(1);
  });

  it('extracts threshold 5', () => {
    expect(parseTeamworkThreshold('Teamwork 5 (reminder)\nEffect.')).toBe(5);
  });

  it('returns null for non-teamwork text', () => {
    expect(parseTeamworkThreshold('Flying')).toBeNull();
    expect(parseTeamworkThreshold('Draw two cards.')).toBeNull();
    expect(parseTeamworkThreshold('')).toBeNull();
  });

  it('returns null when teamwork appears mid-text', () => {
    expect(parseTeamworkThreshold('Flying\nTeamwork 3 (reminder)')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(parseTeamworkThreshold('teamwork 2 (reminder)\nEffect.')).toBe(2);
    expect(parseTeamworkThreshold('TEAMWORK 3 (reminder)\nEffect.')).toBe(3);
  });
});

describe('KEYWORD_DEFINITIONS includes teamwork', () => {
  it('has a teamwork entry with ruleRef 702.194', () => {
    const teamwork = KEYWORD_DEFINITIONS.find((def) => def.id === 'teamwork');
    expect(teamwork).toBeDefined();
    expect(teamwork?.name).toBe('teamwork');
    expect(teamwork?.label).toBe('チームワーク');
    expect(teamwork?.ruleRef).toBe('702.194');
  });
});
