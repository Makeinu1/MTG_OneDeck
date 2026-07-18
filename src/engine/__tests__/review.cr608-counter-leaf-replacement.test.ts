/**
 * review.cr608-counter-leaf-replacement — 判定者専有(実装エージェント変更禁止)。
 *
 * engine-spec §34.49(b): manual複合カウンターの無条件葉補助は、カウンターされた
 * オブジェクト自身の行き先を書き換える置換形remainder("...exile it instead of
 * putting it into its owner's graveyard"・CR 616.1)を葉と認識してはならない。
 * plain counter leaf の removeStackItem(既定=graveyard)を実行すると対象が誤った
 * ゾーンを経由する(Tier-1 CRITICAL 2026-07-19 の回帰床)。
 */
import { describe, expect, it } from 'vitest';

import { guidedCounterLeafForManualComposite } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';

function leafFor(oracleText: string) {
  return guidedCounterLeafForManualComposite(parseAbilityIR(oracleText, 'Instant'));
}

describe('review.cr608 counter leaf vs replacement remainder', () => {
  it('Force of Negation型: "exile it instead" 置換remainderは全体manual(葉を出さない)', () => {
    expect(leafFor(
      "Counter target noncreature spell. If a spell is countered this way, exile it instead of putting it into its owner's graveyard.",
    )).toBeNull();
  });

  it('Dissipate型: 単文内でも "instead" 置換があれば葉を出さない', () => {
    expect(leafFor(
      "Counter target spell. If that spell is countered this way, exile it instead of putting it into its owner's graveyard.",
    )).toBeNull();
  });

  it('独立remainder(Treasure生成)は従来どおり葉+manual警告で補助する', () => {
    const leaf = leafFor('Counter target spell. Create a Treasure token.');
    expect(leaf).not.toBeNull();
    expect(leaf?.prompt.raw.toLowerCase()).toContain('counter target spell');
    expect(leaf?.warning).toContain('手動で反映');
    expect(leaf?.warning).toContain('Create a Treasure token');
  });

  it('unless条件付き(Mana Leak型)は従来どおり葉を出さない(回帰確認)', () => {
    expect(leafFor(
      'Counter target spell unless its controller pays {3}.',
    )).toBeNull();
  });
});
