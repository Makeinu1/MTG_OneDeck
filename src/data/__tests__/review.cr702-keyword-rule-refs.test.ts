/**
 * Reviewer-owned CR-reference pin for the fixed 2026-06-19 Comprehensive Rules.
 * Implementation agents must NOT modify this file.
 */
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { classifyCardRules } from '../ruleClassifier';

function lifelinkCard(): CardDef {
  return {
    scryfallId: 'review-cr702-lifelink-ref',
    oracleId: 'review-cr702-lifelink-ref',
    name: 'Lifelink Reference',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Creature',
    faces: [
      {
        name: 'Lifelink Reference',
        typeLine: 'Creature',
        oracleText: 'Lifelink',
      },
    ],
  };
}

describe('CR 702 keyword rule references', () => {
  it('classifies Lifelink with pinned CR 702.15, not the stale 702.13 reference', () => {
    const tag = classifyCardRules(lifelinkCard()).find((candidate) => candidate.id === 'keyword.lifelink');

    expect(tag).toMatchObject({ ruleRef: '702.15' });
  });
});
