import { describe, expect, it } from 'vitest';
import { classifyCardEvents } from '../../../scripts/lib/eventClassify.ts';
import { makeDef } from '../../engine/__tests__/helpers';
import { classifyCardRules } from '../ruleClassifier';

function tagIds(oracleText: string): string[] {
  return classifyCardRules(makeDef({
    scryfallId: `classifier-${oracleText.length}`,
    typeLine: 'Enchantment',
    faces: [{ name: 'Boundary Host', typeLine: 'Enchantment', oracleText }],
  })).map((tag) => tag.id);
}

describe('rule classifier trigger condition boundary', () => {
  it('classifies At timing without promoting effect verbs into event subscriptions', () => {
    const ids = tagIds(
      'At the beginning of your upkeep, draw a card, discard a card, and put a counter on Boundary Host.',
    );
    expect(ids).toContain('trigger.upkeep');
    expect(ids).not.toContain('trigger.draw');
    expect(ids).not.toContain('trigger.sacrifice');
  });

  it('uses only a genuine leading Whenever condition', () => {
    const ids = tagIds(
      'Whenever you draw a card, put a charge counter on Boundary Host.',
    );
    expect(ids).toContain('trigger.draw');
    expect(ids).not.toContain('trigger.upkeep');
  });

  it('ignores quoted and reflexive inner trigger text', () => {
    expect(tagIds(
      'At the beginning of your upkeep, create a token with "Whenever you draw a card, gain 1 life."',
    )).not.toContain('trigger.draw');
    expect(tagIds(
      'At the beginning of your end step, discard a card. When you do, draw a card.',
    )).not.toContain('trigger.draw');
  });

  it('recognizes labelled trigger lines without promoting their At effects', () => {
    const ids = tagIds(
      '• Mirran — Whenever you cast an artifact spell, create a Myr token.\n'
      + '• Phyrexian — At the beginning of your end step, draw a card, then discard a card.',
    );
    expect(ids).toContain('trigger.cast');
    expect(ids).toContain('trigger.end-step');
    expect(ids).not.toContain('trigger.draw');
  });

  it('keeps the research classifier fail-closed on effect-body delayed triggers', () => {
    const def = makeDef({
      scryfallId: 'research-delayed-boundary',
      typeLine: 'Legendary Planeswalker — Boundary',
      faces: [{
        name: 'Boundary Walker',
        typeLine: 'Legendary Planeswalker — Boundary',
        oracleText:
          '+1: Create a token. When that token leaves the battlefield, draw a card.\n'
          + '−1: Until your next turn, whenever a creature attacks, it gets -1/-0.',
      }],
    });
    const events = classifyCardEvents(def);
    expect(events.families).not.toContain('leaves');
    expect(events.families).not.toContain('attacks');
    expect(events.families).not.toContain('draw');
  });
});
