// Reviewer-owned adversarial gold for M0-3(スライス3 = ゾーン + プレイヤー)の下面抽出分類器。
// 契約 = docs/engine-state-ontology.md スライス3「抽出タクソノミ + 出力スキーマ」/ docs/oracle-grammar-catalog.md スライス3。
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側(scripts/lib/zoneClassify.ts)を直す。
//
// 対象は計測専用の純関数 classifyCardZones(GameState 非依存・決定的・scripts 配下)。
// オラクル文は英語 oracle_text 正本を基準に、現代テンプレート表記へ正規化した確定値(CR-truth)。
//
// 本ゴールドの核 = **4軸の弁別を CR 準拠で固定する**:
//   zones(参照ゾーン集合)/ crossPlayer(あなた以外のゾーンに触れるか)/
//   ownership(owner≠controller, CR108.4/110)/ playerScopes(効果側のプレイヤー参照)。
import { describe, expect, it } from 'vitest';

import {
  classifyCardZones,
  type CardZoneSummary,
  type OwnershipKind,
  type PlayerScope,
} from '../../../scripts/lib/zoneClassify';
import type { ZoneId } from '../types';
import { makeDef } from './helpers';

function zonesOf(name: string, typeLine: string, oracleText: string): CardZoneSummary {
  return classifyCardZones(
    makeDef({ scryfallId: name, typeLine, faces: [{ name, typeLine, oracleText }] }),
  );
}

// [name, typeLine, oracleText, zones(昇順), crossPlayer, ownership, playerScopes(昇順)]
const cases: ReadonlyArray<
  [string, string, string, ZoneId[], boolean, OwnershipKind, PlayerScope[]]
> = [
  // ── 自ライブラリ→自手札。所有/コントロール語なし=none ───────────────────────
  [
    'Demonic Tutor',
    'Sorcery',
    'Search your library for a card and put that card into your hand. Then shuffle.',
    ['hand', 'library'],
    false,
    'none',
    ['you'],
  ],
  // ── 自ライブラリのみ。「You lose」も you スコープ ─────────────────────────────
  [
    'Vampiric Tutor',
    'Instant',
    'Search your library for a card, then shuffle and put that card on top. You lose 2 life.',
    ['library'],
    false,
    'none',
    ['you'],
  ],
  // ── 自手札 + 自ライブラリ。draw は族でなくゾーン語(your hand/your library)で拾う ─
  [
    'Brainstorm',
    'Instant',
    'Draw three cards, then put two cards from your hand on top of your library.',
    ['hand', 'library'],
    false,
    'none',
    ['you'],
  ],
  // ── 自墓地→自手札。target card は player スコープでない ─────────────────────────
  [
    'Regrowth',
    'Sorcery',
    'Return target card from your graveyard to your hand.',
    ['graveyard', 'hand'],
    false,
    'none',
    ['you'],
  ],
  // ── 3ゾーン(library/battlefield/hand)。自分のみ ────────────────────────────────
  [
    'Cultivate',
    'Sorcery',
    'Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.',
    ['battlefield', 'hand', 'library'],
    false,
    'none',
    ['you'],
  ],
  // ── ETB(battlefield)+ 自墓地→自手札。enters はゾーン参照としても拾う ────────────
  [
    'Eternal Witness',
    'Creature — Human Shaman',
    'When this creature enters, return target card from your graveyard to your hand.',
    ['battlefield', 'graveyard', 'hand'],
    false,
    'none',
    ['you'],
  ],
  // ── クロスプレイヤー: target player's graveyard。enters + exile + graveyard ────────
  [
    'Bojuka Bog',
    'Land',
    "This land enters tapped.\nWhen this land enters, exile target player's graveyard.",
    ['battlefield', 'exile', 'graveyard'],
    true,
    'none',
    ['target-player'],
  ],
  // ── クロスプレイヤー: an opponent's hand or graveyard。each-opponent + you ─────────
  [
    'Agonizing Remorse',
    'Sorcery',
    "Exile target card from an opponent's hand or graveyard. You lose life equal to its mana value.",
    ['exile', 'graveyard', 'hand'],
    true,
    'none',
    ['each-opponent', 'you'],
  ],
  // ── コントロール: 「You control enchanted creature」。ゾーン語なし=zones 空 ────────
  [
    'Control Magic',
    'Enchantment — Aura',
    'Enchant creature\nYou control enchanted creature.',
    [],
    false,
    'controller',
    ['you'],
  ],
  // ── コントロール奪取: 「under your control」。a graveyard(不特定)は cross でない ───
  [
    'Reanimate',
    'Sorcery',
    'Put target creature card from a graveyard onto the battlefield under your control. You lose life equal to its mana value.',
    ['battlefield', 'graveyard'],
    false,
    'controller',
    ['you'],
  ],
  // ── 所有者: 「to its owner's hand」。owner≠controller の弁別 ─────────────────────
  [
    'Boomerang',
    'Instant',
    "Return target permanent to its owner's hand.",
    ['hand'],
    false,
    'owner',
    ['owner'],
  ],
  // ── 静的コントロールフィルタ: 「Creatures you control」。ゾーン移動なし ─────────────
  [
    "Gaea's Anthem",
    'Enchantment',
    'Creatures you control get +1/+1.',
    [],
    false,
    'controller',
    ['you'],
  ],
  // ── バニラ: ゾーン/プレイヤー参照なし=全軸空/none ────────────────────────────────
  ['Grizzly Bears', 'Creature — Bear', '', [], false, 'none', []],
  // ── each-player(各他プレイヤー)+ you。ゾーン語なし ───────────────────────────────
  [
    'Syphon Mind',
    'Sorcery',
    'Each other player discards a card. You draw a card for each card discarded this way.',
    [],
    false,
    'none',
    ['each-player', 'you'],
  ],
  // ── 自ライブラリ→自墓地 ─────────────────────────────────────────────────────────
  [
    'Entomb',
    'Sorcery',
    'Search your library for a card, then put that card into your graveyard. Then shuffle.',
    ['graveyard', 'library'],
    false,
    'none',
    ['you'],
  ],
];

describe('M0-3 ゾーン/プレイヤー分類ゴールド(CR400/108/110)', () => {
  it.each(cases)(
    '《%s》→ zones/crossPlayer/ownership/playerScopes が CR と一致',
    (name, typeLine, oracleText, expZones, expCross, expOwnership, expScopes) => {
      const summary = zonesOf(name, typeLine, oracleText);
      expect(summary.zones).toEqual(expZones);
      expect(summary.crossPlayer).toBe(expCross);
      expect(summary.ownership).toBe(expOwnership);
      expect(summary.playerScopes).toEqual(expScopes);
    },
  );
});

describe('M0-3 不変条件', () => {
  it('zones/playerScopes は重複なし昇順(決定的)', () => {
    const s = zonesOf(
      'multi',
      'Sorcery',
      "Exile target card from an opponent's graveyard, then search your library and shuffle.",
    );
    expect(s.zones).toEqual([...new Set(s.zones)].sort());
    expect(s.playerScopes).toEqual([...new Set(s.playerScopes)].sort());
  });

  it('同入力で同出力(決定的)', () => {
    const a = zonesOf('det', 'Sorcery', 'Return target card from your graveyard to your hand.');
    const b = zonesOf('det', 'Sorcery', 'Return target card from your graveyard to your hand.');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('oracleText 無しでも throw せず空集合/none', () => {
    expect(zonesOf('blank', 'Creature — Bear', '')).toEqual({
      zones: [],
      crossPlayer: false,
      ownership: 'none',
      playerScopes: [],
    });
  });
});
