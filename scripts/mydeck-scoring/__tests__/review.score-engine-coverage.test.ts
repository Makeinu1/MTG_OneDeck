// レビュー専有(review.*)。実装エージェントは変更禁止。
// score-ts-demand-catalog-repair 契約ピン。
// 契約=research/cr-grounding/score-ts-demand-catalog-repair.draft.md(判定者確定)。
//
// seam: engineCoverageTags(card) は card の全 ability line を **実 runtime compiler**
// (parseAbilityIR→compileAbilityIR / compileAbilityCost)に通し、compiler が command
// または guided prompt を出す demand-family の tag id 集合を返す純関数。
// score.ts は main() を import 時に self-execute する(L1109)ため、seam は副作用のない
// 別モジュール scripts/mydeck-scoring/engineCoverage.ts に置くことが契約要件。
import { describe, expect, it } from 'vitest';
import { engineCoverageTags, engineCoverageTagsForLine } from '../engineCoverage';
import { splitAbilityLines } from '../../../src/engine/grammar';
import { makeDef } from '../../../src/engine/__tests__/helpers';
import type { CardDef } from '../../../src/types/card';

function cardWithText(scryfallId: string, typeLine: string, oracleText: string): CardDef {
  return makeDef({ scryfallId, typeLine, faces: [{ name: scryfallId, typeLine, oracleText }] });
}

describe('engineCoverageTags — demand計器を実compilerにアンカーする(§2/§3)', () => {
  it('Sol Ring 型 mana-rock: mana:write / cost:tap / cost:activation を covered にする(旧計器の最大の偽陽性)', () => {
    const tags = engineCoverageTags(cardWithText('sol-ring', 'Artifact', '{T}: Add {C}{C}.'));
    expect(tags.has('mana:write')).toBe(true);
    expect(tags.has('cost:tap')).toBe(true);
    expect(tags.has('cost:activation')).toBe(true);
  });

  it('Talisman 型(マナ払い+タップの起動): mana:write / cost:activation を covered にする', () => {
    const tags = engineCoverageTags(
      cardWithText('talisman', 'Artifact', '{T}: Add {C}. {T}, Pay 1 life: Add {G} or {U}.'),
    );
    expect(tags.has('mana:write')).toBe(true);
    expect(tags.has('cost:activation')).toBe(true);
  });

  it('you-subject の draw / sacrifice は covered(auto/guided は gap でない=honest-choice UX)', () => {
    expect(engineCoverageTags(cardWithText('d', 'Sorcery', 'Draw a card.')).has('action:draw')).toBe(
      true,
    );
    expect(
      engineCoverageTags(cardWithText('s', 'Sorcery', 'Sacrifice a creature.')).has('action:sacrifice'),
    ).toBe(true);
  });

  it('過補正防止: cross-player の本物のgap(each opponent sacrifices)は依然 missing(§4)', () => {
    const tags = engineCoverageTags(
      cardWithText('gap', 'Sorcery', 'Each opponent sacrifices a creature.'),
    );
    expect(tags.has('action:sacrifice')).toBe(false);
  });

  it('fetch土地(cost-form sacrifice + search + shuffle): cost/effect両側を covered にする(§3b-1/2)', () => {
    const tags = engineCoverageTags(
      cardWithText(
        'fetch',
        'Land',
        '{T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield, then shuffle.',
      ),
    );
    // cost 側(活性化・タップ・サクリファイ)
    expect(tags.has('cost:tap')).toBe(true);
    expect(tags.has('cost:activation')).toBe(true);
    expect(tags.has('action:sacrifice')).toBe(true); // §3b-1: cost-form sacrifice を credit
    // effect 側(サーチ + 切り直し)
    expect(tags.has('action:search')).toBe(true);
    expect(tags.has('action:shuffle')).toBe(true); // §3b-2: shuffle family を credit
  });

  it('per-line 分離(§3b-5): 同一カードの別能力の tag が行を跨いで漏れない', () => {
    const card = cardWithText(
      'two-ability',
      'Artifact',
      '{T}: Add {C}.\nSacrifice this artifact: Draw a card.',
    );
    const lines = splitAbilityLines(card);
    expect(lines.length).toBe(2);
    const [firstLine, secondLine] = lines;
    if (!firstLine || !secondLine) throw new Error('expected two ability lines');
    const manaLine = engineCoverageTagsForLine(card, firstLine);
    const drawLine = engineCoverageTagsForLine(card, secondLine);
    expect(manaLine.has('mana:write')).toBe(true);
    expect(manaLine.has('action:draw')).toBe(false); // draw は行1に属す=漏れない
    expect(drawLine.has('action:draw')).toBe(true);
    expect(drawLine.has('mana:write')).toBe(false); // mana は行0に属す=漏れない
  });

  it('vanilla(能力なし)は空集合=何も covered と主張しない', () => {
    const tags = engineCoverageTags(makeDef({ scryfallId: 'bear', typeLine: 'Creature — Bear' }));
    expect(tags.size).toBe(0);
  });
});
