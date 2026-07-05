import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';

function def(): CardDef {
  return {
    scryfallId: 'cr701-library-search-source',
    oracleId: 'cr701-library-search-source',
    name: 'cr701-library-search-source',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Sorcery',
    faces: [{ name: 'cr701-library-search-source', typeLine: 'Sorcery' }],
  };
}

function compile(line: string, allowLibrarySearchComposite = true) {
  return compileAbilityIR(parseAbilityIR(line, 'Sorcery'), {
    sourceId: 'source-1',
    def: def(),
    allowLibrarySearchComposite,
  });
}

describe('CR 701.23/701.24 guided single-card ramp search compiler', () => {
  it("prompts for Nature's Lore style single Forest-card battlefield search", () => {
    const result = compile(
      "Search your library for a Forest card, put that card onto the battlefield, then shuffle.",
    );

    expect(result).toMatchObject({
      decision: 'guided',
      prompts: [
        {
          atom: 'effect.search',
          kind: 'library-search',
          count: 1,
          librarySearch: {
            filter: { kind: 'land-subtype', subtype: 'Forest' },
            destination: 'battlefield',
            entersTapped: false,
            shuffle: true,
          },
        },
      ],
    });
    expect(result.commands).toEqual([]);
    expect(result.reasons).toEqual([]);
  });

  it('prompts for Rampant Growth style basic-land battlefield search tapped', () => {
    const result = compile(
      'Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.',
    );

    expect(result).toMatchObject({
      decision: 'guided',
      prompts: [
        {
          atom: 'effect.search',
          kind: 'library-search',
          count: 1,
          librarySearch: {
            filter: { kind: 'basic-land' },
            destination: 'battlefield',
            entersTapped: true,
            shuffle: true,
          },
        },
      ],
    });
  });

  it('keeps broad, multi-card, and compound search criteria manual', () => {
    expect(
      compile('Search your library for any card, put it onto the battlefield, then shuffle.')
        .decision,
    ).toBe('manual');
    expect(
      compile(
        'Search your library for up to two basic land cards, put them onto the battlefield tapped, then shuffle.',
      ).decision,
    ).toBe('manual');
    expect(
      compile(
        'Search your library for a Plains, Island, Swamp, or Mountain card, put it onto the battlefield tapped, then shuffle.',
      ).decision,
    ).toBe('manual');
  });

  it('can be disabled by callers that are compiling excluded modal search options', () => {
    expect(
      compile(
        'Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.',
        false,
      ).decision,
    ).toBe('manual');
  });
});
