/**
 * Reviewer-owned regression corpus for the classifier accuracy program
 * (docs/engine-spec.md §26). High-confidence labeled cards (oracle text from
 * the Scryfall snapshot) pin classifyCardRules / possessedKeywords against
 * judged ground truth, including grant-vs-has known divergences (forbid*).
 * Implementation agents must NOT modify this file.
 *
 * Corpus data: ./fixtures/classifier-corpus.ts. Known-divergence rationale:
 * research/classifier-accuracy/known-divergences.json.
 */
import { describe, expect, it } from 'vitest';
import { classifyCardRules } from '../ruleClassifier';
import { possessedKeywords } from '../../engine/keywordGrammar';
import type { CardDef } from '../../types/card';
import { classifierCorpus, type CorpusEntry } from './fixtures/classifier-corpus';

const corpus = classifierCorpus;

function defOf(entry: CorpusEntry): CardDef {
  return {
    scryfallId: entry.name,
    oracleId: entry.name,
    name: entry.name,
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: entry.typeLine,
    faces: [{ name: entry.name, typeLine: entry.typeLine, oracleText: entry.oracleText }],
  };
}

describe('classifier accuracy regression corpus', () => {
  it('corpus is non-empty and only high-confidence rows gate', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(20);
    expect(corpus.every((e) => e.confidence === 'high')).toBe(true);
  });

  for (const entry of corpus) {
    it(`${entry.name}: keyword possession (has != grants)`, () => {
      const kw = possessedKeywords(defOf(entry));
      for (const k of entry.expectKeywords) {
        expect(kw, `${entry.name} should possess ${k}`).toContain(k);
      }
      for (const k of entry.forbidKeywords) {
        expect(kw, `${entry.name} must NOT possess ${k} (${entry.note})`).not.toContain(k);
      }
    });

    it(`${entry.name}: rule tags`, () => {
      const ids = classifyCardRules(defOf(entry)).map((t) => t.id);
      for (const t of entry.expectTags) {
        expect(ids, `${entry.name} should tag ${t}`).toContain(t);
      }
      for (const t of entry.forbidTags) {
        expect(ids, `${entry.name} must NOT tag ${t}`).not.toContain(t);
      }
    });
  }
});
