// Reviewer-owned adversarial gold for M0-1(有効特性 + 層オントロジー)の下面抽出分類器。
// 契約 = docs/engine-state-ontology.md「抽出タクソノミ + 出力スキーマ」/ docs/oracle-grammar-catalog.md。
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側(scripts/lib/layerClassify.ts)を直す。
//
// 対象は計測専用の純関数 classifyCardLayers(GameState 非依存・決定的・scripts 配下)。
// オラクル文は 2026-06-19 snapshot(英語 oracle_text 正本)から裏取り済みの確定値。
import { describe, expect, it } from 'vitest';

import {
  classifyCardLayers,
  type CardLayerSummary,
  type LayerId,
} from '../../../scripts/lib/layerClassify';
import { makeDef } from './helpers';

function defOf(name: string, typeLine: string, oracleText: string) {
  return makeDef({
    scryfallId: name,
    typeLine,
    faces: [{ name, typeLine, oracleText }],
  });
}

function layersOf(name: string, typeLine: string, oracleText: string): CardLayerSummary {
  return classifyCardLayers(defOf(name, typeLine, oracleText));
}

// [name, typeLine, oracleText, expectedLayers(昇順), expectedCda]
const cases: ReadonlyArray<[string, string, string, LayerId[], boolean]> = [
  // ── 単層・静的 ──────────────────────────────────────────────
  [
    "Gaea's Anthem",
    'Enchantment',
    'Creatures you control get +1/+1.',
    ['L7c'],
    false,
  ],
  [
    'Control Magic',
    'Enchantment — Aura',
    'Enchant creature\nYou control enchanted creature.',
    ['L2'],
    false,
  ],
  [
    'Blood Moon',
    'Enchantment',
    'Nonbasic lands are Mountains.',
    ['L4'],
    false,
  ],
  [
    'Archetype of Imagination',
    'Enchantment Creature — Human Wizard',
    "Creatures you control have flying.\nCreatures your opponents control lose flying and can't have or gain flying.",
    ['L6'],
    false,
  ],
  // ── 解決由来の継続効果(shape=spell でも対象)─────────────────
  [
    'Giant Growth',
    'Instant',
    'Target creature gets +3/+3 until end of turn.',
    ['L7c'],
    false,
  ],
  // ── CDA(特性定義能力)──────────────────────────────────────
  [
    'Tarmogoyf',
    'Creature — Lhurgoyf',
    "Tarmogoyf's power is equal to the number of card types among cards in all graveyards and its toughness is equal to that number plus 1.",
    ['L7a'],
    true,
  ],
  // ── 多層(1行に複数節)──────────────────────────────────────
  [
    'Darksteel Mutation',
    'Enchantment — Aura',
    'Enchant creature\nEnchanted creature is an Insect artifact creature with base power and toughness 0/1 and has indestructible, and it loses all other abilities, card types, and creature types.',
    ['L4', 'L6', 'L7b'],
    false,
  ],
  [
    'Lignify',
    'Kindred Enchantment — Treefolk Aura',
    'Enchant creature\nEnchanted creature is a Treefolk with base power and toughness 0/4 and loses all abilities.',
    ['L4', 'L6', 'L7b'],
    false,
  ],
  [
    'Song of the Dryads',
    'Enchantment — Aura',
    'Enchant permanent\nEnchanted permanent is a colorless Forest land.',
    ['L4', 'L5'],
    false,
  ],
  // ── 負例(継続効果を作らない = 層書き込み無し)──────────────────
  [
    'Lightning Bolt',
    'Instant',
    'Lightning Bolt deals 3 damage to any target.',
    [],
    false,
  ],
  [
    'Llanowar Elves',
    'Creature — Elf Druid',
    '{T}: Add {G}.',
    [],
    false,
  ],
  // ── iter2: 閉じた系統的ギャップ ───────────────────────────────
  // L6 非キーワード能力付与(引用された起動型)。カード自身の {T} 行は付与でない=誤計上しない。
  [
    'Chromatic Lantern',
    'Artifact',
    'Lands you control have "{T}: Add one mana of any color."\n{T}: Add one mana of any color.',
    ['L6'],
    false,
  ],
  [
    'Cryptolith Rite',
    'Enchantment',
    'Creatures you control have "{T}: Add one mana of any color."',
    ['L6'],
    false,
  ],
  // L4 条件付き否定型変更(isn't a creature)+ 起動型 +1/+0 = L7c。
  [
    'Purphoros, God of the Forge',
    'Legendary Enchantment Creature — God',
    "Indestructible\nAs long as your devotion to red is less than five, Purphoros isn't a creature.\nWhenever another creature you control enters, Purphoros deals 2 damage to each opponent.\n{2}{R}: Creatures you control get +1/+0 until end of turn.",
    ['L4', 'L7c'],
    false,
  ],
  // L4 否定型 + lifelink付与(L6)+ +1/+1カウンター(L7c)の3機構。
  [
    'Heliod, Sun-Crowned',
    'Legendary Enchantment Creature — God',
    "Indestructible\nAs long as your devotion to white is less than five, Heliod isn't a creature.\nWhenever you gain life, put a +1/+1 counter on target creature or enchantment you control.\n{1}{W}: Another target creature gains lifelink until end of turn.",
    ['L4', 'L6', 'L7c'],
    false,
  ],
  // L7c 乗算(+N/+N 形でない倍化)。
  [
    'Unnatural Growth',
    'Enchantment',
    'At the beginning of each combat, double the power and toughness of each creature you control until end of turn.',
    ['L7c'],
    false,
  ],
  // ── iter3: becomes a N/N creature(アニメート)= P/T設定(L7b)+ 型変更(L4)─────
  [
    'Alloy Animist',
    'Creature — Human Druid',
    '{2}{G}: Until end of turn, target noncreature artifact you control becomes a 4/4 artifact creature.',
    ['L4', 'L7b'],
    false,
  ],
  [
    'Cyberdrive Awakener',
    'Artifact Creature — Construct',
    'Flying\nOther artifact creatures you control have flying.\nWhen this creature enters, each noncreature artifact you control becomes a 4/4 artifact creature until end of turn.',
    ['L4', 'L6', 'L7b'],
    false,
  ],
];

describe('M0-1 層分類ゴールド: classifyCardLayers(有効特性 + 層オントロジー)', () => {
  it.each(cases)('《%s》→ 層・CDA が CR613/604.3 と一致', (name, typeLine, oracle, expLayers, expCda) => {
    const summary = layersOf(name, typeLine, oracle);
    expect(summary.layers).toEqual(expLayers);
    expect(summary.cda).toBe(expCda);
  });
});

describe('M0-1 不変条件(計測専用・エンジン非依存)', () => {
  it('layers は重複なし昇順(決定的)', () => {
    const { layers } = layersOf(
      'Darksteel Mutation',
      'Enchantment — Aura',
      'Enchant creature\nEnchanted creature is an Insect artifact creature with base power and toughness 0/1 and has indestructible, and it loses all other abilities, card types, and creature types.',
    );
    expect(layers).toEqual([...new Set(layers)].sort());
  });

  it('同入力で同出力', () => {
    const a = layersOf("Gaea's Anthem", 'Enchantment', 'Creatures you control get +1/+1.');
    const b = layersOf("Gaea's Anthem", 'Enchantment', 'Creatures you control get +1/+1.');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('oracleText 無しでも throw せず空集合', () => {
    const def = makeDef({ scryfallId: 'vanilla', typeLine: 'Creature — Bear' });
    expect(() => classifyCardLayers(def)).not.toThrow();
    expect(classifyCardLayers(def)).toEqual({ layers: [], cda: false });
  });
});
