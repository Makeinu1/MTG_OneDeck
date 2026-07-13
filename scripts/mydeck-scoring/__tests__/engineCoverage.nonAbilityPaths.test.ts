// 実装者の自分のテスト(review.* ではない — レビュー担当専有ファイルは別途)。
// score-ts-credit-nonability-paths タスクのpin: engineCoverageTagsForLine は
// ability-compiler経路(compileAbilityIR/compileAbilityCost)だけでなく、
// src/store/gameStore.ts が実際に使う非ability-compiler経路
// (fetchAbility/activateFetch/resolveFetch/fetchLand, landEntersTapped+
// playLand, producedMana+tapForMana)もcreditする。over-credit防止(genuine
// gapは依然gapのまま)も併せてpinする。
import { describe, expect, it } from 'vitest';
import { engineCoverageTags, engineCoverageTagsForLine } from '../engineCoverage';
import { splitAbilityLines } from '../../../src/engine/grammar';
import { makeDef } from '../../../src/engine/__tests__/helpers';
import type { CardDef } from '../../../src/types/card';

function cardWithText(
  scryfallId: string,
  typeLine: string,
  oracleText: string,
  producedMana?: CardDef['producedMana'],
): CardDef {
  return makeDef({
    scryfallId,
    typeLine,
    faces: [{ name: scryfallId, typeLine, oracleText }],
    ...(producedMana ? { producedMana } : {}),
  });
}

describe('engineCoverageTags — 非ability-compiler経路のcredit(score-ts-credit-nonability-paths)', () => {
  describe('fetchAbility経路(activateFetch/resolveFetch/fetchLand)', () => {
    it('寓話の小道型(複合フィルタ+条件付きアンタップ句): search/shuffleをcoveredにする', () => {
      const tags = engineCoverageTags(
        cardWithText(
          'fabled-passage',
          'Land',
          '{T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle. Then if you control four or more lands, untap that land.',
        ),
      );
      expect(tags.has('action:search')).toBe(true);
      expect(tags.has('action:shuffle')).toBe(true);
      expect(tags.has('action:sacrifice')).toBe(true);
      expect(tags.has('tap-state:write')).toBe(true); // entersTapped=true
    });

    it('伝統的フェッチ土地型(2色OR-フィルタ、ライフ支払い、アンタップ): 依然covered', () => {
      const tags = engineCoverageTags(
        cardWithText(
          'flooded-strand',
          'Land',
          '{T}, Pay 1 life, Sacrifice this land: Search your library for a Plains or Island card, put it onto the battlefield, then shuffle.',
        ),
      );
      expect(tags.has('action:search')).toBe(true);
      expect(tags.has('action:shuffle')).toBe(true);
      expect(tags.has('life:write')).toBe(true);
      // tap-state:write は covered でない。{T} は起動コスト(cost:tap)であって、盤面の
      // permanent をタップ/アンタップする「効果」ではない。このカードは entersTapped=false
      // ゆえ fetchAbility 経路も tap-state:write を足さず、effect 側にも tap/untap は無い。
      // (旧版はコスト側 setTapped を effect family tap-state:write に誤 credit していた=
      // judge review.* pin が検出→engineCoverageTagsForLine のコスト generic-map を撤去。
      // demand 側の {T}→cost:tap 修正と対称の coverage 側修正。)
      expect(tags.has('cost:tap')).toBe(true);
      expect(tags.has('tap-state:write')).toBe(false);
    });

    it('過補正防止: 非Landの検索効果(Whir of Invention型)はfetchAbility経路の対象外=依然gap', () => {
      const tags = engineCoverageTags(
        cardWithText(
          'whir-of-invention',
          'Instant',
          'Search your library for an artifact card with mana value X or less, put it onto the battlefield, then shuffle.',
        ),
      );
      expect(tags.has('action:search')).toBe(false);
      expect(tags.has('action:shuffle')).toBe(false);
    });

    it('過補正防止: cross-player search(Path to Exile型)は依然gap', () => {
      const tags = engineCoverageTags(
        cardWithText(
          'path-to-exile',
          'Instant',
          "Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.",
        ),
      );
      expect(tags.has('action:search')).toBe(false);
      expect(tags.has('action:shuffle')).toBe(false);
    });

    it('per-line分離: 同一土地のマナ能力行にはsearch/shuffleが漏れない', () => {
      const card = cardWithText(
        'two-ability-land',
        'Land',
        '{T}: Add {C}.\nSacrifice this land: Search your library for a basic land card, put it onto the battlefield, then shuffle.',
      );
      const [manaLine, fetchLine] = splitAbilityLines(card);
      if (!manaLine || !fetchLine) throw new Error('expected two lines');
      const manaTags = engineCoverageTagsForLine(card, manaLine);
      const fetchTags = engineCoverageTagsForLine(card, fetchLine);
      expect(manaTags.has('action:search')).toBe(false);
      expect(manaTags.has('mana:write')).toBe(true);
      expect(fetchTags.has('action:search')).toBe(true);
      expect(fetchTags.has('mana:write')).toBe(false);
    });
  });

  describe('landEntersTapped経路(playLand + PendingLandTapChoice)', () => {
    it('常時tapped(ギルドゲート型): tap-state:writeをcoveredにする', () => {
      const tags = engineCoverageTags(cardWithText('guildgate', 'Land', 'This land enters tapped.'));
      expect(tags.has('tap-state:write')).toBe(true);
    });

    it('条件付きtapped(チェックランド型): guided-choiceダイアログでcoveredにする(honest-choice UX)', () => {
      const tags = engineCoverageTags(
        cardWithText(
          'checkland',
          'Land',
          'This land enters tapped unless you control a Swamp or a Mountain.',
        ),
      );
      expect(tags.has('tap-state:write')).toBe(true);
    });

    it('ショックランド型(pay-life-or-tapped): tap-state:writeはcovered、replacementは依然deferスコープのまま', () => {
      const tags = engineCoverageTags(
        cardWithText(
          'shockland',
          'Land',
          "As this land enters, you may pay 2 life. If you don't, it enters tapped.",
        ),
      );
      expect(tags.has('tap-state:write')).toBe(true);
      // 'replacement' はこの計器のcredit対象ではない(既存のscope境界(既知defer)分類のまま)。
      expect(tags.has('replacement')).toBe(false);
    });

    it('過補正防止: 無関係な"becomes tapped"テキストや非Landはcreditしない', () => {
      const vanilla = engineCoverageTags(cardWithText('vanilla-land', 'Land', 'Plains'));
      expect(vanilla.has('tap-state:write')).toBe(false);

      const creature = engineCoverageTags(
        cardWithText(
          'creature-becomes-tapped',
          'Creature',
          'Whenever this creature becomes tapped, draw a card.',
        ),
      );
      expect(creature.has('tap-state:write')).toBe(false);
    });
  });

  describe('producedMana + tapForMana経路', () => {
    it('2色選択タリスマン型: mana:writeをcoveredにする(producedMana必須)', () => {
      const tags = engineCoverageTags(
        cardWithText(
          'talisman',
          'Artifact',
          '{T}: Add {R} or {W}. This artifact deals 1 damage to you.',
          ['R', 'W'],
        ),
      );
      expect(tags.has('mana:write')).toBe(true);
      // damage側はこの経路の対象外(tapForManaは単に色マナを足すだけ)= 依然gap。
      expect(tags.has('damage:write')).toBe(false);
    });

    it('3通りの2色ペア選択(フィルターランド型): mana:writeをcoveredにする', () => {
      const tags = engineCoverageTags(
        cardWithText('fetid-heath', 'Land', '{W/B}, {T}: Add {W}{W}, {W}{B}, or {B}{B}.', ['W', 'B']),
      );
      expect(tags.has('mana:write')).toBe(true);
    });

    it('過補正防止: producedManaメタデータが無ければcreditしない', () => {
      const tags = engineCoverageTags(
        cardWithText('talisman-no-metadata', 'Artifact', '{T}: Add {R} or {W}. This artifact deals 1 damage to you.'),
      );
      expect(tags.has('mana:write')).toBe(false);
    });

    it('過補正防止: {0}コスト(tapを伴わない)可変マナ能力(Vivi Ornitier型)はtapForManaで解決できないため依然gap', () => {
      const tags = engineCoverageTags(
        cardWithText(
          'vivi',
          'Creature',
          "{0}: Add X mana in any combination of {U} and/or {R}, where X is Vivi's power. Activate only during your turn and only once each turn.",
          ['U', 'R'],
        ),
      );
      expect(tags.has('mana:write')).toBe(false);
    });
  });
});
