/**
 * Reviewer-owned adversarial tests for M6.4: semi-automatic (target-requiring)
 * candidate actions (docs/engine-spec.md §21). New tags action.return /
 * action.attach, and the target-requiring candidate map. Implementation agents
 * must NOT modify this file.
 */
import { describe, expect, it } from 'vitest';
import { classifyCardRules } from '../ruleClassifier';
import { ruleActionCandidatesFromTags } from '../../components/playmat/ruleActionCandidates';
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
const candKinds = (def: CardDef): string[] =>
  ruleActionCandidatesFromTags(classifyCardRules(def)).map((c) => c.kind);

describe('M6.4 classifier tags', () => {
  it('detects return (from graveyard/exile) and attach/equip', () => {
    expect(ids(card('rean', 'Return target creature card from your graveyard to the battlefield.'))).toContain('action.return');
    expect(ids(card('equip', 'Equip {2}', 'Artifact — Equipment'))).toContain('action.attach');
  });

  it('keeps existing sacrifice/destroy/exile/search/card-counters detection', () => {
    expect(ids(card('s', 'As an additional cost, sacrifice a creature.'))).toContain('action.sacrifice');
    expect(ids(card('d', 'Destroy target creature.', 'Instant'))).toContain('action.destroy');
    expect(ids(card('x', 'Exile target permanent.', 'Instant'))).toContain('action.exile');
    expect(ids(card('q', 'Search your library for a basic land card.'))).toContain('action.search');
    expect(ids(card('cc', 'Put a +1/+1 counter on target creature.', 'Instant'))).toContain('action.card-counters');
  });
});

describe('M6.4 target-requiring candidates', () => {
  it('maps destroy/exile/counters/attach to target-requiring kinds with stable testIds', () => {
    expect(candKinds(card('d', 'Destroy target creature.', 'Instant'))).toContain('destroy-target');
    expect(candKinds(card('x', 'Exile target permanent.', 'Instant'))).toContain('exile-target');
    expect(candKinds(card('cc', 'Put a +1/+1 counter on target creature.', 'Instant'))).toContain('counters-target');
    expect(candKinds(card('eq', 'Equip {2}', 'Artifact — Equipment'))).toContain('attach-target');

    const destroyCand = ruleActionCandidatesFromTags(classifyCardRules(card('d', 'Destroy target creature.', 'Instant')))
      .find((c) => c.kind === 'destroy-target');
    expect(destroyCand?.testId).toBe('candidate-destroy-target');
    expect(destroyCand?.requiresTarget).toBe(true);
  });

  it('search/return route to existing viewers (not target-requiring)', () => {
    const search = ruleActionCandidatesFromTags(classifyCardRules(card('q', 'Search your library for a card.')))
      .find((c) => c.kind === 'search-library');
    expect(search).toBeTruthy();
    expect(search?.requiresTarget).toBe(false);

    expect(candKinds(card('r', 'Return target creature card from your graveyard to the battlefield.'))).toContain('return-from-zone');
  });

  it('a vanilla card yields no candidates', () => {
    expect(candKinds(card('bear', '', 'Creature — Bear'))).toEqual([]);
  });
});
