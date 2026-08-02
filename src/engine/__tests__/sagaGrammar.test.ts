import { describe, expect, it } from 'vitest';

import { finalChapterNumber, numberToRoman, parseSagaChapters } from '../sagaGrammar';

describe('parseSagaChapters', () => {
  it('parses a 3-chapter Saga in oracle-text order', () => {
    const text = [
      'I — Draw a card.',
      'II, III — Each opponent loses 2 life.',
      'IV — You gain 4 life.',
    ].join('\n');

    const abilities = parseSagaChapters(text);
    expect(abilities).toHaveLength(3);

    expect(abilities[0].chapters).toEqual([1]);
    expect(abilities[0].effectText).toBe('Draw a card.');

    expect(abilities[1].chapters).toEqual([2, 3]);
    expect(abilities[1].effectText).toBe('Each opponent loses 2 life.');

    expect(abilities[2].chapters).toEqual([4]);
    expect(abilities[2].effectText).toBe('You gain 4 life.');
  });

  it('returns [] for empty text', () => {
    expect(parseSagaChapters('')).toEqual([]);
  });

  it('returns [] for undefined/null text', () => {
    expect(parseSagaChapters(undefined)).toEqual([]);
    expect(parseSagaChapters(null)).toEqual([]);
  });

  it('returns [] for non-Saga text', () => {
    const text = [
      'Flying, vigilance',
      'Whenever this creature attacks, draw a card.',
      'This Saga enters the battlefield tapped.',
    ].join('\n');
    expect(parseSagaChapters(text)).toEqual([]);
  });

  it('multi-chapter line (II, III) produces chapters [2, 3]', () => {
    const abilities = parseSagaChapters('II, III — Each opponent loses 2 life.');
    expect(abilities).toHaveLength(1);
    expect(abilities[0].chapters).toEqual([2, 3]);
  });

  it('ignores non-chapter lines mixed with chapter lines', () => {
    const text = [
      'This Saga enters tapped.',
      'I — Draw a card.',
      'Static ability text here.',
      'II — Destroy target creature.',
    ].join('\n');

    const abilities = parseSagaChapters(text);
    expect(abilities).toHaveLength(2);
    expect(abilities[0].chapters).toEqual([1]);
    expect(abilities[1].chapters).toEqual([2]);
  });

  it('handles en-dash and hyphen separators', () => {
    const enDash = parseSagaChapters('I – Draw a card.');
    expect(enDash).toHaveLength(1);
    expect(enDash[0].effectText).toBe('Draw a card.');

    const hyphen = parseSagaChapters('I - Draw a card.');
    expect(hyphen).toHaveLength(1);
    expect(hyphen[0].effectText).toBe('Draw a card.');
  });

  it('handles higher Roman numerals (V–X)', () => {
    const text = [
      'V — Effect five.',
      'VII — Effect seven.',
      'IX — Effect nine.',
      'X — Effect ten.',
    ].join('\n');

    const abilities = parseSagaChapters(text);
    expect(abilities).toHaveLength(4);
    expect(abilities[0].chapters).toEqual([5]);
    expect(abilities[1].chapters).toEqual([7]);
    expect(abilities[2].chapters).toEqual([9]);
    expect(abilities[3].chapters).toEqual([10]);
  });
});

describe('finalChapterNumber', () => {
  it('returns the greatest chapter number', () => {
    const abilities = parseSagaChapters(
      'I — A.\nII, III — B.\nIV — C.',
    );
    expect(finalChapterNumber(abilities)).toBe(4);
  });

  it('returns 0 for empty abilities', () => {
    expect(finalChapterNumber([])).toBe(0);
  });

  it('handles multi-chapter lines correctly', () => {
    const abilities = parseSagaChapters('II, III — Effect.');
    expect(finalChapterNumber(abilities)).toBe(3);
  });
});

describe('numberToRoman', () => {
  it('converts 1–10 to Roman numerals', () => {
    expect(numberToRoman(1)).toBe('I');
    expect(numberToRoman(2)).toBe('II');
    expect(numberToRoman(3)).toBe('III');
    expect(numberToRoman(4)).toBe('IV');
    expect(numberToRoman(5)).toBe('V');
    expect(numberToRoman(10)).toBe('X');
  });
});
