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
  // ── bare permanent bounce: 「Return target permanent to its owner's hand」= battlefield 起点 + owner ─
  [
    'Boomerang',
    'Instant',
    "Return target permanent to its owner's hand.",
    ['battlefield', 'hand'],
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
  // ── 暗黙移動: discard(他者→hand/graveyard=cross)+ draw(you→library/hand)─────────────
  [
    'Syphon Mind',
    'Sorcery',
    'Each other player discards a card. You draw a card for each card discarded this way.',
    ['graveyard', 'hand', 'library'],
    true,
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

  // ══ iter2-a 回帰 gold(照応 cross FN / battlefield FN / owner≠controller)════════════
  // ── 照応 cross + discard→graveyard: 「their hand」+「discards that card」 ──────────────
  [
    'Thoughtseize',
    'Sorcery',
    'Target player reveals their hand. You choose a nonland card from it. That player discards that card. You lose 2 life.',
    ['graveyard', 'hand'],
    true,
    'none',
    ['target-player', 'you'],
  ],
  // ── 照応 cross + discard(hand→graveyard)+ draw(library→hand): 各プレイヤー ─────────────
  [
    'Windfall',
    'Sorcery',
    'Each player discards their hand, then draws cards equal to the greatest number of cards a player discarded this way.',
    ['graveyard', 'hand', 'library'],
    true,
    'none',
    ['each-player'],
  ],
  // ── 照応 cross + owner: 「The owner of target permanent ... their library」+ battlefield ─
  [
    'Chaos Warp',
    'Instant',
    "The owner of target permanent shuffles it into their library, then reveals the top card of their library. If it's a permanent card, they put it onto the battlefield.",
    ['battlefield', 'library'],
    true,
    'owner',
    ['owner'],
  ],
  // ── battlefield FN: 「Exile target creature」= 戦場起点の除去 + controller ────────────
  [
    'Swords to Plowshares',
    'Instant',
    'Exile target creature. Its controller gains life equal to its power.',
    ['battlefield', 'exile'],
    false,
    'controller',
    ['controller'],
  ],
  // ── battlefield(token)FN: 「creates two Treasure tokens」+ counter=stack ───────────────
  [
    "An Offer You Can't Refuse",
    'Instant',
    'Counter target noncreature spell. Its controller creates two Treasure tokens.',
    ['battlefield', 'stack'],
    false,
    'controller',
    ['controller'],
  ],
  // ── owner≠controller=both: 「an opponent owns ... under your control」(明示 owner 語)──
  [
    'Brainstealer Dragon',
    'Creature — Dragon Horror',
    'Flying\nAt the beginning of your end step, exile the top card of each opponent\'s library. You may play those cards for as long as they remain exiled. If you cast a spell this way, you may spend mana as though it were mana of any color to cast it.\nWhenever a nonland permanent an opponent owns enters the battlefield under your control, they lose life equal to its mana value.',
    ['battlefield', 'exile', 'library'],
    true,
    'both',
    ['each-opponent', 'you'],
  ],
  // ── 照応 cross + both + battlefield: 「you don't control ... to its owner's hand」────────
  [
    'Cyclonic Rift',
    'Instant',
    "Return target nonland permanent you don't control to its owner's hand.",
    ['battlefield', 'hand'],
    true,
    'both',
    ['owner', 'you'],
  ],

  // ══ iter3-a 暗黙移動 gold(draw→lib+hand / discard→hand+grave / dies→bf+grave)═══════════
  // ── draw のみ: library(source)+ hand(dest)─────────────────────────────────────────────
  ['Divination', 'Sorcery', 'Draw two cards.', ['hand', 'library'], false, 'none', ['you']],
  // ── draw + 自己 discard: library/hand/graveyard ───────────────────────────────────────
  [
    'Faithless Looting',
    'Sorcery',
    'Draw two cards, then discard two cards.',
    ['graveyard', 'hand', 'library'],
    false,
    'none',
    ['you'],
  ],
  // ── discard(他者)= cross: target player の hand→graveyard ───────────────────────────────
  [
    'Mind Rot',
    'Sorcery',
    'Target player discards two cards.',
    ['graveyard', 'hand'],
    true,
    'none',
    ['target-player'],
  ],
  // ── dies(battlefield→graveyard)+ token(battlefield)───────────────────────────────────
  [
    'Doomed Traveler',
    'Creature — Human Soldier',
    'When this creature dies, create a 1/1 white Spirit creature token with flying.',
    ['battlefield', 'graveyard'],
    false,
    'none',
    ['you'],
  ],

  // ══ iter3-b CR-truth gold(destroy=CR701.8a / sacrifice=CR701.21a → battlefield+graveyard)══
  // ── destroy = move from battlefield to owner's graveyard(CR701.8a)───────────────────────
  ['Doom Blade', 'Instant', 'Destroy target nonblack creature.', ['battlefield', 'graveyard'], false, 'none', []],
  // ── sacrifice = move from battlefield to owner's graveyard(CR701.21a)─────────────────────
  [
    'Fling',
    'Instant',
    "As an additional cost to cast this spell, sacrifice a creature.\nFling deals damage equal to the sacrificed creature's power to any target.",
    ['battlefield', 'graveyard'],
    false,
    'none',
    [],
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
