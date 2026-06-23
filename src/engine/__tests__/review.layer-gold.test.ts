// Reviewer-owned adversarial gold — M0 改善ループ iter4。
// 出自: research/llm-oracle/adjudication.json(Fable 裁定・2026-06-23)。LLM-oracle 物差しが暴いた
// 35 不一致のうち、Fable が「分類器(scripts/lib/layerClassify.ts)を直すべき=compiler 誤訳」と裁定した
// カードの確定層、および「物差し誤り(oracle)で分類器は既に正しい」カードの回帰ガードを固定する。
// 契約 = docs/engine-state-ontology.md / docs/oracle-grammar-catalog.md。
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら scripts/lib/layerClassify.ts を直す。
//
// オラクル文は 2026-06-19 snapshot(英語 oracle_text 正本)から確定。期待層は CR613/604.3/707 準拠。
import { describe, expect, it } from 'vitest';

import {
  classifyCardLayers,
  type CardLayerSummary,
  type LayerId,
} from '../../../scripts/lib/layerClassify';
import { makeDef } from './helpers';

function layersOf(name: string, typeLine: string, oracleText: string): CardLayerSummary {
  return classifyCardLayers(
    makeDef({ scryfallId: name, typeLine, faces: [{ name, typeLine, oracleText }] }),
  );
}

// [name, typeLine, oracleText, expectedLayers(昇順)]
type Case = readonly [string, string, string, LayerId[]];

// ── P1: コピー検出の取りこぼし(L1a)──────────────────────────────
// 『enters as a copy of』は動詞 is/are/becomes を伴わず現 L1a probe が取りこぼす。
// 自オブジェクトが恒久的にコピーになる=コピー効果(CR707)= L1a。
const P1_L1A_MISS: readonly Case[] = [
  ['Sculpting Steel', 'Artifact', 'You may have this artifact enter as a copy of any artifact on the battlefield.', ['L1a']],
  ['Mirrormade', 'Enchantment', 'You may have this enchantment enter as a copy of any artifact or enchantment on the battlefield.', ['L1a']],
  ['Phyrexian Metamorph', 'Artifact Creature — Phyrexian', "({U/P} can be paid with either {U} or 2 life.)\nYou may have this creature enter as a copy of any artifact or creature on the battlefield, except it's an artifact in addition to its other types.", ['L1a', 'L4']],
  ['Spark Double', 'Creature — Shapeshifter', "You may have this creature enter as a copy of a creature or planeswalker you control, except it enters with an additional +1/+1 counter on it if it's a creature, it enters with an additional loyalty counter on it if it's a planeswalker, and it isn't legendary.", ['L1a', 'L7c']],
  ['Mockingbird', 'Creature — Shapeshifter', "Flying\nYou may have this creature enter as a copy of any creature on the battlefield with mana value less than or equal to the amount of mana spent to cast this creature, except it's a Bird in addition to its other types and it has flying.", ['L1a', 'L4', 'L6']],
];

// ── P1: L4 過貪欲(layerClassify.ts:98-99 の `[A-Z][A-Za-z'-]+` が i フラグで小文字語に一致)──
// 『becomes a copy』『is an additional combat phase』が L4 を誤発火する。capitalized 部分節を
// 大文字必須(case-sensitive)化して除去。正の L4(Elemental 等の大文字サブタイプ、
// 『in addition to its other types』)は維持されること。
const P1_L4_OVERFIRE: readonly Case[] = [
  ['The Mycosynth Gardens', 'Land', '{T}: Add {C}.\n{1}, {T}: Add one mana of any color.\n{X}, {T}: This land becomes a copy of target nontoken artifact you control with mana value X.', ['L1a']],
  ['Mirage Mirror', 'Artifact', '{2}: This artifact becomes a copy of target artifact, creature, enchantment, or land until end of turn.', ['L1a']],
  ['Shifting Woodland', 'Land', 'This land enters tapped unless you control a Forest.\n{T}: Add {G}.\nDelirium — {2}{G}{G}: This land becomes a copy of target permanent card in your graveyard until end of turn. Activate only if there are four or more card types among cards in your graveyard.', ['L1a']],
  ['Cursed Mirror', 'Artifact', '{T}: Add {R}.\nAs this artifact enters, you may have it become a copy of any creature on the battlefield, except it has haste.', ['L1a', 'L6']],
  ['Karlach, Fury of Avernus', 'Legendary Creature — Demon', "Whenever you attack, if it's the first combat phase of the turn, untap all attacking creatures. They gain first strike until end of turn. After this phase, there is an additional combat phase.\nChoose a Background", ['L6']],
  ['Genji Glove', 'Artifact — Equipment', "Equipped creature has double strike.\nWhenever equipped creature attacks, if it's the first combat phase of the turn, untap it. After this phase, there is an additional combat phase.\nEquip {3}", ['L6']],
  ['Great Train Heist', 'Instant', 'Spree (Choose one or more additional costs.)\n+ {2}{R} — Untap all creatures you control. If it’s your combat phase, there is an additional combat phase after this phase.\n+ {2} — Creatures you control get +1/+0 and gain first strike until end of turn.\n+ {R} — Choose target opponent. Whenever a creature you control deals combat damage to that player this turn, create a tapped Treasure token.', ['L6', 'L7c']],
];

// ── 回帰ガード: 物差し誤り(oracle)= 分類器は既に正しい。Codex の過剰修正で L7a を
// 紛れ込ませないことを表明する。『gets +X/+X for each』は修整=L7c であって CDA(L7a)ではない。
const GUARD_NO_L7A: readonly Case[] = [
  ['Faeburrow Elder', 'Creature — Dryad', 'Vigilance\nThis creature gets +1/+1 for each color among permanents you control.\n{T}: For each color among permanents you control, add one mana of that color.', ['L7c']],
  ['Storm-Kiln Artist', 'Creature — Dwarf Shaman', 'This creature gets +1/+0 for each artifact you control.\nMagecraft — Whenever you cast or copy an instant or sorcery spell, create a Treasure token.', ['L7c']],
  ['All That Glitters', 'Enchantment — Aura', 'Enchant creature\nEnchanted creature gets +1/+1 for each artifact and/or enchantment you control.', ['L7c']],
  ['Shared Animosity', 'Enchantment', 'Whenever a creature you control attacks, it gets +1/+0 until end of turn for each other attacking creature that shares a creature type with it.', ['L7c']],
  ['Blackblade Reforged', 'Legendary Artifact — Equipment', 'Equipped creature gets +1/+1 for each land you control.\nEquip legendary creature {3}\nEquip {7}', ['L7c']],
  ['Banner of Kinship', 'Artifact', 'As this artifact enters, choose a creature type. This artifact enters with a fellowship counter on it for each creature you control of the chosen type.\nCreatures you control of the chosen type get +1/+1 for each fellowship counter on this artifact.', ['L7c']],
  ['Ethereal Armor', 'Enchantment — Aura', 'Enchant creature\nEnchanted creature gets +1/+1 for each enchantment you control and has first strike.', ['L6', 'L7c']],
];

const HARD_CASES: readonly Case[] = [...P1_L1A_MISS, ...P1_L4_OVERFIRE, ...GUARD_NO_L7A];

describe('M0 iter4 層ゴールド(裁定確定・compiler 修正/物差し誤りガード)', () => {
  it.each(HARD_CASES)('《%s》→ 層が裁定値と一致', (name, typeLine, oracle, expLayers) => {
    expect(layersOf(name, typeLine, oracle).layers).toEqual(expLayers);
  });
});
