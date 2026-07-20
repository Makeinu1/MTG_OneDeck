import { describe, expect, it } from 'vitest';
import { makeDef } from './helpers';
import { parseTriggerConditionLine, parseTriggerConditionLines } from '../triggerCondition';

describe('CR 603 leading trigger condition parser', () => {
  it('strips ability words and separates a genuine leading condition from its effect', () => {
    expect(parseTriggerConditionLine(
      'Landfall — Whenever a land enters under your control, draw a card.',
    )).toEqual({
      word: 'whenever',
      condition: 'a land enters under your control',
      effect: 'draw a card.',
    });
  });

  it('accepts structural modal, value, and sticker labels only before a leading trigger', () => {
    expect(parseTriggerConditionLine(
      '• Mirran — Whenever you cast an artifact spell, create a Myr token.',
    )).toMatchObject({
      word: 'whenever',
      condition: 'you cast an artifact spell',
    });
    expect(parseTriggerConditionLine(
      'Descend 8 — Whenever this creature attacks, draw a card.',
    )).toMatchObject({
      word: 'whenever',
      condition: 'this creature attacks',
    });
    expect(parseTriggerConditionLine(
      '{TK}{TK}{TK} — When this permanent dies, you get seven {TK}.',
    )).toMatchObject({
      word: 'when',
      condition: 'this permanent dies',
    });
  });

  it('preserves self-name punctuation and enumerated event conditions', () => {
    const gau = makeDef({
      scryfallId: 'parser-gau',
      name: 'Gau, Feral Youth',
      faces: [{ name: 'Gau, Feral Youth', typeLine: 'Creature' }],
    });
    expect(parseTriggerConditionLine(
      'Whenever Gau, Feral Youth attacks, draw a card.',
      gau,
    )).toMatchObject({
      condition: 'Gau, Feral Youth attacks',
      effect: 'draw a card.',
    });
    expect(parseTriggerConditionLine(
      'Whenever another creature dies, or a creature card leaves your graveyard, you gain 1 life.',
    )).toMatchObject({
      condition: 'another creature dies, or a creature card leaves your graveyard',
      effect: 'you gain 1 life.',
    });
    expect(parseTriggerConditionLine(
      'Whenever a player casts an artifact, instant, or sorcery spell, draw a card.',
    )).toMatchObject({
      condition: 'a player casts an artifact, instant, or sorcery spell',
      effect: 'draw a card.',
    });
  });

  it('returns At only for phase callers and rejects quoted/reflexive inner triggers', () => {
    expect(parseTriggerConditionLine(
      'At the beginning of your upkeep, you lose 1 life and draw a card.',
    )).toEqual({
      word: 'at',
      condition: 'the beginning of your upkeep',
      effect: 'you lose 1 life and draw a card.',
    });
    expect(parseTriggerConditionLine(
      'Create a token with "Whenever you draw a card, you gain 1 life."',
    )).toBeNull();
    expect(parseTriggerConditionLine(
      'You may discard a card. When you do, draw a card.',
    )).toBeNull();
    expect(parseTriggerConditionLine(
      '{1}: Choose target creature. When that creature dies this turn, return it to its owner\'s hand.',
    )).toBeNull();
    expect(parseTriggerConditionLine(
      '+1: Until your next turn, whenever a creature an opponent controls attacks, it gets -1/-0.',
    )).toBeNull();
  });

  it('preserves a coalesced independent source trigger without admitting inner triggers', () => {
    expect(parseTriggerConditionLines(
      'When this Aura enters, attach it. When this Aura leaves the battlefield, sacrifice the creature.',
    )).toMatchObject([
      { word: 'when', condition: 'this Aura enters' },
      { word: 'when', condition: 'this Aura leaves the battlefield' },
    ]);
    expect(parseTriggerConditionLines(
      'Whenever this creature attacks, create a token with "Whenever this creature dies, draw a card."',
    )).toHaveLength(1);
    expect(parseTriggerConditionLines(
      'Whenever this creature attacks, create a token. When that token dies this turn, draw a card.',
    )).toHaveLength(1);
  });
});
