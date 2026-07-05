// Reviewer-owned adversarial tests for cr-701 generic single-card ramp search composite (compiler).
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 701.23a: search = 該当ゾーンを見て条件に合うカードを見つける。narrow criteria(basic land /
//   単一 basic land subtype)の単一カード検索を guided prompt へ。
// - CR 701.23d: 数量検索は要求数 or 可能な限り。本 slice は単一カードのみ guided、複数はmanual。
// - CR 701.24a/b: shuffle は library をランダム化し、見つけて動かしたカードは shuffle 対象外。
// scope: 単一カード self-library search →(onto the battlefield [tapped])→ shuffle のみ guided。
// broad tutor / 複数 / target player / 非library zone / 非battlefield destination / 複合subtype は manual。
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';

function srcDef(): CardDef {
  return {
    scryfallId: 'r-cr701-src',
    oracleId: 'r-cr701-src',
    name: 'r-cr701-src',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Sorcery',
    faces: [{ name: 'r-cr701-src', typeLine: 'Sorcery' }],
  };
}

function compile(line: string, allowLibrarySearchComposite = true) {
  return compileAbilityIR(parseAbilityIR(line, 'Sorcery'), {
    sourceId: 'source-1',
    def: srcDef(),
    allowLibrarySearchComposite,
  });
}

describe('cr-701 generic ramp search compiler (CR 701.23/701.24)', () => {
  it("Nature's Lore: `a Forest card` → guided land-subtype search, untapped, shuffle", () => {
    const r = compile(
      "Search your library for a Forest card, put that card onto the battlefield, then shuffle.",
    );
    expect(r.decision).toBe('guided');
    expect(r.prompts[0]).toMatchObject({
      atom: 'effect.search',
      kind: 'library-search',
      count: 1,
      librarySearch: {
        filter: { kind: 'land-subtype', subtype: 'Forest' },
        destination: 'battlefield',
        entersTapped: false,
        shuffle: true,
      },
    });
    // guided は解決時に実行=compile 時点で commands を発行しない(auto を騙らない)。
    expect(r.commands).toEqual([]);
    expect(r.reasons).toEqual([]);
  });

  it('Rampant Growth: `a basic land card` → guided basic-land search, tapped, shuffle', () => {
    const r = compile(
      'Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.',
    );
    expect(r.decision).toBe('guided');
    expect(r.prompts[0]).toMatchObject({
      atom: 'effect.search',
      kind: 'library-search',
      librarySearch: { filter: { kind: 'basic-land' }, entersTapped: true, shuffle: true },
    });
  });

  describe('honest manual boundary (auto/guided を騙らない)', () => {
    const manualCases: Array<[string, string]> = [
      ['broad tutor `any card`', 'Search your library for any card, put it onto the battlefield, then shuffle.'],
      ['bare `a card` broad tutor', 'Search your library for a card, put it onto the battlefield, then shuffle.'],
      ['複数 `up to two`', 'Search your library for up to two basic land cards, put them onto the battlefield tapped, then shuffle.'],
      ['Farseek 複合subtype', 'Search your library for a Plains, Island, Swamp, or Mountain card, put it onto the battlefield tapped, then shuffle.'],
      ['subtype OR', 'Search your library for a Forest or Plains card, put it onto the battlefield, then shuffle.'],
      ['非battlefield destination(to hand)', 'Search your library for a Forest card, put it into your hand, then shuffle.'],
      ['非library zone(graveyard)', 'Search your graveyard for a Forest card, put that card onto the battlefield, then shuffle.'],
      ['target player search', "Target player searches their library for a basic land card, puts it onto the battlefield tapped, then shuffles."],
      ['optional `You may`', 'You may search your library for a Forest card, put that card onto the battlefield, then shuffle.'],
      ['非land type', 'Search your library for an artifact card, put it onto the battlefield, then shuffle.'],
    ];
    for (const [label, line] of manualCases) {
      it(`${label} → manual`, () => {
        expect(compile(line).decision).toBe('manual');
      });
    }
  });

  it('allowLibrarySearchComposite=false(除外modal option compile 時)は manual に落とす', () => {
    expect(
      compile(
        'Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.',
        false,
      ).decision,
    ).toBe('manual');
  });
});
