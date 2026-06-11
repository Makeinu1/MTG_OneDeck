import { describe, it, expect } from 'vitest';
import { parseDeckList, type ParsedDeck } from '../deckParser';

describe('parseDeckList', () => {
  describe('basic entry formats', () => {
    const cases: { name: string; input: string; expected: ParsedDeck }[] = [
      {
        name: 'plain quantity + ascii name',
        input: '1 Sol Ring',
        expected: {
          entries: [{ quantity: 1, name: 'Sol Ring', section: 'main', line: 1 }],
          errors: [],
        },
      },
      {
        name: 'quantity with x suffix',
        input: '1x Sol Ring',
        expected: {
          entries: [{ quantity: 1, name: 'Sol Ring', section: 'main', line: 1 }],
          errors: [],
        },
      },
      {
        name: 'quantity with X suffix (uppercase)',
        input: '4X Mountain',
        expected: {
          entries: [{ quantity: 4, name: 'Mountain', section: 'main', line: 1 }],
          errors: [],
        },
      },
      {
        name: 'japanese card name',
        input: '4 稲妻',
        expected: {
          entries: [{ quantity: 4, name: '稲妻', section: 'main', line: 1 }],
          errors: [],
        },
      },
      {
        name: 'full-width digits normalized to ascii',
        input: '４ 稲妻',
        expected: {
          entries: [{ quantity: 4, name: '稲妻', section: 'main', line: 1 }],
          errors: [],
        },
      },
      {
        name: 'full-width space between quantity and name',
        input: '4　稲妻',
        expected: {
          entries: [{ quantity: 4, name: '稲妻', section: 'main', line: 1 }],
          errors: [],
        },
      },
      {
        name: 'leading/trailing whitespace trimmed',
        input: '   1 Sol Ring   ',
        expected: {
          entries: [{ quantity: 1, name: 'Sol Ring', section: 'main', line: 1 }],
          errors: [],
        },
      },
    ];

    it.each(cases)('$name', ({ input, expected }) => {
      expect(parseDeckList(input)).toEqual(expected);
    });
  });

  describe('section headers', () => {
    it('marks entries after "Commander" header as commander section', () => {
      const result = parseDeckList("Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n1 Sol Ring");
      expect(result.entries).toEqual([
        { quantity: 1, name: "Atraxa, Praetors' Voice", section: 'commander', line: 2 },
        { quantity: 1, name: 'Sol Ring', section: 'main', line: 5 },
      ]);
      expect(result.errors).toEqual([]);
    });

    it('handles "Commander:" header with trailing colon', () => {
      const result = parseDeckList("Commander:\n1 Atraxa, Praetors' Voice");
      expect(result.entries).toEqual([
        { quantity: 1, name: "Atraxa, Praetors' Voice", section: 'commander', line: 2 },
      ]);
    });

    it('handles "統率者" header', () => {
      const result = parseDeckList('統率者\n1 アトラクサ');
      expect(result.entries).toEqual([
        { quantity: 1, name: 'アトラクサ', section: 'commander', line: 2 },
      ]);
    });

    it('handles "デッキ" header switching back to main', () => {
      const result = parseDeckList('統率者\n1 アトラクサ\nデッキ\n1 稲妻');
      expect(result.entries).toEqual([
        { quantity: 1, name: 'アトラクサ', section: 'commander', line: 2 },
        { quantity: 1, name: '稲妻', section: 'main', line: 4 },
      ]);
    });

    it('handles "Mainboard" header', () => {
      const result = parseDeckList('Mainboard\n1 Sol Ring');
      expect(result.entries).toEqual([{ quantity: 1, name: 'Sol Ring', section: 'main', line: 2 }]);
    });

    it('defaults to main section when no header is present', () => {
      const result = parseDeckList('1 Sol Ring\n1 Lightning Bolt');
      expect(result.entries.every((e) => e.section === 'main')).toBe(true);
    });
  });

  describe('double-faced card names', () => {
    it('preserves "//" within a card name (not treated as comment)', () => {
      const result = parseDeckList('1 Fable of the Mirror-Breaker // Reflection of Kiki-Jiki');
      expect(result.entries).toEqual([
        {
          quantity: 1,
          name: 'Fable of the Mirror-Breaker // Reflection of Kiki-Jiki',
          section: 'main',
          line: 1,
        },
      ]);
      expect(result.errors).toEqual([]);
    });
  });

  describe('comments and blank lines', () => {
    it('ignores lines starting with "#"', () => {
      const result = parseDeckList('# this is a comment\n1 Sol Ring');
      expect(result.entries).toEqual([{ quantity: 1, name: 'Sol Ring', section: 'main', line: 2 }]);
      expect(result.errors).toEqual([]);
    });

    it('ignores lines starting with "//" (full-line comment)', () => {
      const result = parseDeckList('// this is a comment\n1 Sol Ring');
      expect(result.entries).toEqual([{ quantity: 1, name: 'Sol Ring', section: 'main', line: 2 }]);
      expect(result.errors).toEqual([]);
    });

    it('ignores blank lines (including whitespace-only lines)', () => {
      const result = parseDeckList('1 Sol Ring\n\n   \n1 Lightning Bolt');
      expect(result.entries).toEqual([
        { quantity: 1, name: 'Sol Ring', section: 'main', line: 1 },
        { quantity: 1, name: 'Lightning Bolt', section: 'main', line: 4 },
      ]);
    });
  });

  describe('sideboard handling', () => {
    it('reports "SB:" prefixed lines as errors', () => {
      const result = parseDeckList('1 Sol Ring\nSB: 1 Lightning Bolt');
      expect(result.entries).toEqual([{ quantity: 1, name: 'Sol Ring', section: 'main', line: 1 }]);
      expect(result.errors).toEqual([
        {
          line: 2,
          text: 'SB: 1 Lightning Bolt',
          reason: 'Sideboard entries are not supported in EDH (single-deck format)',
        },
      ]);
    });

    it('reports entries within a "Sideboard" section as errors', () => {
      const result = parseDeckList('1 Sol Ring\nSideboard\n1 Lightning Bolt');
      expect(result.entries).toEqual([{ quantity: 1, name: 'Sol Ring', section: 'main', line: 1 }]);
      expect(result.errors).toEqual([
        {
          line: 3,
          text: '1 Lightning Bolt',
          reason: 'Sideboard entries are not supported in EDH (single-deck format)',
        },
      ]);
    });
  });

  describe('error cases', () => {
    it('reports lines without a quantity as errors', () => {
      const result = parseDeckList('Sol Ring');
      expect(result.entries).toEqual([]);
      expect(result.errors).toEqual([
        {
          line: 1,
          text: 'Sol Ring',
          reason: 'Missing quantity prefix (expected "<n> <card name>")',
        },
      ]);
    });

    it('reports lines with quantity but no name as errors', () => {
      const result = parseDeckList('4');
      expect(result.entries).toEqual([]);
      expect(result.errors).toEqual([{ line: 1, text: '4', reason: 'Missing card name' }]);
    });

    it('reports quantity-with-x but no name as errors', () => {
      const result = parseDeckList('4x');
      expect(result.entries).toEqual([]);
      expect(result.errors).toEqual([{ line: 1, text: '4x', reason: 'Missing card name' }]);
    });

    it('preserves the original line number across mixed errors and entries', () => {
      const result = parseDeckList('1 Sol Ring\nbad line\n1 Lightning Bolt');
      expect(result.entries).toEqual([
        { quantity: 1, name: 'Sol Ring', section: 'main', line: 1 },
        { quantity: 1, name: 'Lightning Bolt', section: 'main', line: 3 },
      ]);
      expect(result.errors).toEqual([
        {
          line: 2,
          text: 'bad line',
          reason: 'Missing quantity prefix (expected "<n> <card name>")',
        },
      ]);
    });
  });

  describe('combined real-world example', () => {
    it('parses a full decklist with commander, comments, and DFC names', () => {
      const input = [
        '# My Commander Deck',
        'Commander',
        "1 Atraxa, Praetors' Voice",
        '',
        'Deck',
        '1 Sol Ring',
        '4 稲妻',
        '1 Fable of the Mirror-Breaker // Reflection of Kiki-Jiki',
        'SB: 1 Lightning Bolt',
      ].join('\n');

      const result = parseDeckList(input);

      expect(result.entries).toEqual([
        { quantity: 1, name: "Atraxa, Praetors' Voice", section: 'commander', line: 3 },
        { quantity: 1, name: 'Sol Ring', section: 'main', line: 6 },
        { quantity: 4, name: '稲妻', section: 'main', line: 7 },
        {
          quantity: 1,
          name: 'Fable of the Mirror-Breaker // Reflection of Kiki-Jiki',
          section: 'main',
          line: 8,
        },
      ]);
      expect(result.errors).toEqual([
        {
          line: 9,
          text: 'SB: 1 Lightning Bolt',
          reason: 'Sideboard entries are not supported in EDH (single-deck format)',
        },
      ]);
    });
  });
});
