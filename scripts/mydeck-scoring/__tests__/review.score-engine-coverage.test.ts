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

  it('CR701出荷後: cross-player each-opponent sacrifice は covered(§4更新)', () => {
    const tags = engineCoverageTags(
      cardWithText('gap', 'Sorcery', 'Each opponent sacrifices a creature.'),
    );
    expect(tags.has('action:sacrifice')).toBe(true);
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

// 別 engine 経路の credit(follow-up score-ts-credit-nonability-paths)。修復後の計器は
// ability-compiler 経路だけでなく、app が専用経路(fetch/land-enters-tapped/mana-ability/
// cycling)で実際に解決するカードも credit する。各 credit の真の根拠は「app がそのコマンドを
// 実 emit する経路」(src/engine/status.ts + src/store/gameStore.ts + actionCatalog.ts)。
// fetch/land/mana は out-of-band commit 76c52d9 で着地→独立 Tier-1 で再オーナー化(RED 0)。
// cycling / {T} 対称修正は本スライスで実装。**最重要=over-credit(gap を covered と誤認)を
// 起こさないこと**——各 describe の「過剰credit防止」pin がその要石。
describe('engineCoverageTags — 別engine経路のcredit(score-ts-credit-nonability-paths)', () => {
  // fetch 専用経路(addFetchEngineCoverage): 汎用 compiler は二重基本地形 filter / 条件 untap を
  // parse できず manual に落ちるが、app は fetchAbility()+activateFetch/resolveFetch で完全解決。
  // life:write は pay-life コストを持つ fetch のみ=この専用経路でしか付かない識別子。
  it('fetch土地(二重タイプfilter+pay-life): 専用経路が search/shuffle/sacrifice/life を credit', () => {
    const tags = engineCoverageTags(
      cardWithText(
        'flooded-strand',
        'Land',
        '{T}, Pay 1 life, Sacrifice this land: Search your library for a Plains or Island card, put it onto the battlefield, then shuffle.',
      ),
    );
    expect(tags.has('action:search')).toBe(true);
    expect(tags.has('action:shuffle')).toBe(true);
    expect(tags.has('action:sacrifice')).toBe(true);
    expect(tags.has('life:write')).toBe(true);
    expect(tags.has('cost:tap')).toBe(true);
  });

  // land-enters-tapped 経路(addLandEntersTappedCoverage): landEntersTapped()+playLand()。
  it('タップイン土地: enters-tapped 経路が tap-state:write を credit', () => {
    const tags = engineCoverageTags(cardWithText('tapland', 'Land', 'This land enters tapped.'));
    expect(tags.has('tap-state:write')).toBe(true);
  });

  it("過剰credit防止: enters-tapped 句を持たない土地('never')は tap-state:write を credit しない", () => {
    const tags = engineCoverageTags(cardWithText('plain-land', 'Land', '{T}: Add {G}.'));
    expect(tags.has('tap-state:write')).toBe(false);
  });

  // any-color マナ能力: mana:write を covered にする。app は producedMana 経路
  // (tapForMana)に加え compiler 自身の guided color-choice prompt でもこれを解決する
  // (probe 実測: effect.decision='guided' / prompt=mana/effect.add-mana)。どちらの経路でも
  // covered=gap でない、という契約を pin する(経路の内部分岐は実装者テストが担当)。
  it('any-color マナ能力: mana:write を covered にする(gap でない)', () => {
    const tags = engineCoverageTags(
      makeDef({
        scryfallId: 'chromatic-lantern',
        typeLine: 'Artifact',
        producedMana: ['W', 'U', 'B', 'R', 'G'],
        faces: [
          {
            name: 'chromatic-lantern',
            typeLine: 'Artifact',
            oracleText: '{T}: Add one mana of any color.',
          },
        ],
      }),
    );
    expect(tags.has('mana:write')).toBe(true);
  });

  // cycling 経路(addCyclingEngineCoverage): actionCatalog の cycle action(cyclingCost)+
  // gameStore.cycle()(discard+draw を無条件 emit)。plain "Cycling {cost}" のみ credit。
  it('plain cycling: action:draw + action:discard を credit', () => {
    const tags = engineCoverageTags(cardWithText('cycler', 'Creature — Bird', 'Flying\nCycling {2}'));
    expect(tags.has('action:draw')).toBe(true);
    expect(tags.has('action:discard')).toBe(true);
  });

  it('過剰credit防止: landcycling は cycling として credit しない(基本地形search であり discard+draw でない)', () => {
    // cyclingCost() は語頭 [type] を許容し landcycling にもマッチするが、cycle() の discard+draw
    // 挙動は landcycling には誤り(本来は library から基本地形を search)。ゆえ coverage は
    // \bcycling\b 語境界で landcycling を除外する=専用経路の false credit を防ぐ要石 pin。
    const tags = engineCoverageTags(cardWithText('ash-barrens', 'Land', 'Basic landcycling {1}'));
    expect(tags.has('action:draw')).toBe(false);
    expect(tags.has('action:discard')).toBe(false);
  });

  // {T} は起動コスト(cost:tap)であって効果としての盤面タップ(tap-state:write)ではない。
  // demand 側の対称修正(score.ts の tap-state:write regex を effectText へスコープ化)と整合する
  // coverage 側の不変=マナロックの {T} は tap-state:write を生まない。
  it('過剰credit防止: {T}起動コストは cost:tap であり tap-state:write を credit しない', () => {
    const tags = engineCoverageTags(cardWithText('sol-ring2', 'Artifact', '{T}: Add {C}{C}.'));
    expect(tags.has('cost:tap')).toBe(true);
    expect(tags.has('tap-state:write')).toBe(false);
  });
});
