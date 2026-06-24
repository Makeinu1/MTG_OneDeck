// Reviewer-owned adversarial gold for M0-4(スライス4 = タイミング + SBA)の下面抽出分類器。
// 契約 = docs/engine-state-ontology.md スライス4「抽出タクソノミ + 出力スキーマ」/ CR ターン構造真理テーブル(CR500)。
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側(scripts/lib/timingClassify.ts)を直す。
//
// 対象は計測専用の純関数 classifyCardTiming(GameState 非依存・決定的・scripts 配下)。
// オラクル文は英語 oracle_text 正本(2026-06-19 snapshot で裏取り)を基準にした確定値(CR-truth)。
//
// 本ゴールドの核 = **3軸の弁別を CR500 準拠で固定する**:
//   junctures(誘発が掛かるターン構造ステップ)/ junctureScope(誰のターンか= Slice2 ObserverScope 再利用)/
//   castTiming(キャスト/起動のタイミング制限)。
// 最重要の敵対点 = 「deals combat damage は juncture でない(Slice2 damage)」=《Sword of Feast and Famine》。
import { describe, expect, it } from 'vitest';

import type { ObserverScope } from '../../../scripts/lib/eventClassify';
import {
  classifyCardTiming,
  type CardTimingSummary,
  type CastTiming,
  type TimingStep,
} from '../../../scripts/lib/timingClassify';
import { makeDef } from './helpers';

function timingOf(name: string, typeLine: string, oracleText: string): CardTimingSummary {
  return classifyCardTiming(
    makeDef({ scryfallId: name, typeLine, faces: [{ name, typeLine, oracleText }] }),
  );
}

// [name, typeLine, oracleText, junctures(昇順), junctureScope(昇順), castTiming(昇順)]
const cases: ReadonlyArray<
  [string, string, string, TimingStep[], ObserverScope[], CastTiming[]]
> = [
  // ── upkeep / self: 「At the beginning of your upkeep」最頻形 ───────────────────────
  [
    'Phyrexian Arena',
    'Enchantment',
    'At the beginning of your upkeep, you draw a card and you lose 1 life.',
    ['upkeep'],
    ['self'],
    ['none'],
  ],
  // ── upkeep / self: トークン生成 juncture ─────────────────────────────────────────────
  [
    'Bitterblossom',
    'Kindred Enchantment — Faerie',
    'At the beginning of your upkeep, you lose 1 life and create a 1/1 black Faerie Rogue creature token with flying.',
    ['upkeep'],
    ['self'],
    ['none'],
  ],
  // ── upkeep / self: ETB 行(非 juncture)+ upkeep 行。junctureScope は juncture 行のみから ─
  [
    'Court of Grace',
    'Enchantment',
    'When this enchantment enters, you become the monarch.\nAt the beginning of your upkeep, create a 1/1 white Spirit creature token with flying. If you\'re the monarch, create a 4/4 white Angel creature token with flying instead.',
    ['upkeep'],
    ['self'],
    ['none'],
  ],
  // ── upkeep / any: 「each player's upkeep」= 全プレイヤー ──────────────────────────────
  [
    'Sulfuric Vortex',
    'Enchantment',
    "At the beginning of each player's upkeep, this enchantment deals 2 damage to that player.\nIf a player would gain life, that player gains no life instead.",
    ['upkeep'],
    ['any'],
    ['none'],
  ],
  // ── begin-combat / self: 「At the beginning of combat on your turn」───────────────────
  [
    'Goblin Rabblemaster',
    'Creature — Goblin Warrior',
    'Other Goblin creatures you control attack each combat if able.\nAt the beginning of combat on your turn, create a 1/1 red Goblin creature token with haste.\nWhenever this creature attacks, it gets +1/+0 until end of turn for each other attacking Goblin.',
    ['begin-combat'],
    ['self'],
    ['none'],
  ],
  // ── end-step / self: 「At the beginning of your end step」────────────────────────────
  [
    'Wilderness Reclamation',
    'Enchantment',
    'At the beginning of your end step, untap all lands you control.',
    ['end-step'],
    ['self'],
    ['none'],
  ],
  // ── untap / opponent: 「during each other player's untap step」(非 "beginning of" 形)──
  [
    'Seedborn Muse',
    'Creature — Spirit',
    "Untap all permanents you control during each other player's untap step.",
    ['untap'],
    ['opponent'],
    ['none'],
  ],
  // ── draw / any + flash: Flash キーワード + 「each player's draw step」複合 ──────────────
  [
    'Dictate of Kruphix',
    'Enchantment',
    'Flash\nAt the beginning of each player\'s draw step, that player draws an additional card.',
    ['draw'],
    ['any'],
    ['flash'],
  ],
  // ══ castTiming 軸 + 敵対的負例 ════════════════════════════════════════════════════════
  // ── 🔴 juncture 真値負例: 「deals combat damage」= Slice2 damage であって juncture でない ─
  [
    'Sword of Feast and Famine',
    'Artifact — Equipment',
    'Equipped creature gets +2/+2 and has protection from black and from green.\nWhenever equipped creature deals combat damage to a player, that player discards a card and you untap all lands you control.\nEquip {2}',
    [],
    [],
    ['none'],
  ],
  // ── sorcery-speed: 起動の「Activate only as a sorcery」───────────────────────────────
  [
    'Aggravated Assault',
    'Enchantment',
    '{3}{R}{R}: Untap all creatures you control. After this main phase, there is an additional combat phase followed by an additional main phase. Activate only as a sorcery.',
    [],
    [],
    ['sorcery-speed'],
  ],
  // ── your-turn-only: 「Cast this spell only during your turn」─────────────────────────
  [
    'Seedtime',
    'Instant',
    'Cast this spell only during your turn.\nTake an extra turn after this one if an opponent cast a blue spell this turn.',
    [],
    [],
    ['your-turn-only'],
  ],
  // ── flash: 「cast spells as though they had flash」(付与=認識のみ)──────────────────────
  [
    'Leyline of Anticipation',
    'Enchantment',
    'If this card is in your opening hand, you may begin the game with it on the battlefield.\nYou may cast spells as though they had flash.',
    [],
    [],
    ['flash'],
  ],
  // ── 負例: マナ能力のみ=タイミング参照なし ──────────────────────────────────────────────
  ['Sol Ring', 'Artifact', '{T}: Add {C}{C}.', [], [], ['none']],
  ['Llanowar Elves', 'Creature — Elf Druid', '{T}: Add {G}.', [], [], ['none']],
  // ── 負例: 素の Sorcery は castTiming none(カード型だけでは制限語にならない)───────────────
  [
    'Approach of the Second Sun',
    'Sorcery',
    "If this spell was cast from your hand and you've cast another spell named Approach of the Second Sun this game, you win the game. Otherwise, put Approach of the Second Sun into its owner's library seventh from the top and you gain 7 life.",
    [],
    [],
    ['none'],
  ],
  // ── 負例: バニラ(oracleText 空)= 全軸空 / castTiming none ─────────────────────────────
  ['Grizzly Bears', 'Creature — Bear', '', [], [], ['none']],

  // ══ iter2-a CR500 認識拡張 gold(begin-combat each/that / main-phase first/second/each / untap 否定FP / cast-clause FP)══
  // ── begin-combat / any: 「At the beginning of each combat」(隣接でない=iter1 begin-combat FN)──
  [
    'Full Throttle',
    'Sorcery',
    'After this main phase, there are two additional combat phases.\nAt the beginning of each combat this turn, untap all creatures that attacked this turn.',
    ['begin-combat'],
    ['any'],
    ['none'],
  ],
  [
    'Zopandrel, Hunger Dominus',
    'Legendary Creature — Phyrexian Horror',
    'Reach\nAt the beginning of each combat, double the power and toughness of each creature you control until end of turn.\n{G/P}{G/P}, Sacrifice two other creatures: Put an indestructible counter on Zopandrel.',
    ['begin-combat'],
    ['any'],
    ['none'],
  ],
  // ── main-precombat / self: 「your first main phase」= precombat(CR505.1)──────────────────
  [
    'Black Market Connections',
    'Enchantment',
    'At the beginning of your first main phase, choose one or more —\n• Sell Contraband — Create a Treasure token. You lose 1 life.\n• Buy Information — Draw a card. You lose 2 life.\n• Hire a Mercenary — Create a 3/2 colorless Shapeshifter creature token with changeling. You lose 3 life.',
    ['main-precombat'],
    ['self'],
    ['none'],
  ],
  // ── main-postcombat / self: 「your second main phase」= postcombat ────────────────────────
  [
    'Lost Monarch of Ifnir',
    'Creature — Zombie Noble',
    'Afflict 3 (Whenever this creature becomes blocked, defending player loses 3 life.)\nOther Zombies you control have afflict 3.\nAt the beginning of your second main phase, if a player was dealt combat damage by a Zombie this turn, mill three cards, then you may return a creature card from your graveyard to your hand.',
    ['main-postcombat'],
    ['self'],
    ['none'],
  ],
  // ── 両 main / self: 「each of your main phases」→ precombat + postcombat ───────────────────
  [
    'Carpet of Flowers',
    'Enchantment',
    'At the beginning of each of your main phases, if you haven\'t added mana with this ability this turn, you may add X mana of any one color, where X is the number of Islands target opponent controls.',
    ['main-precombat', 'main-postcombat'],
    ['self'],
    ['none'],
  ],
  // ── 🔴 untap 否定FP の真値: 「doesn't untap during your untap step」は untap juncture でない。upkeep+draw は juncture ─
  [
    'Mana Vault',
    'Artifact',
    "This artifact doesn't untap during your untap step.\nAt the beginning of your upkeep, you may pay {4}. If you do, untap this artifact.\nAt the beginning of your draw step, if this artifact is tapped, it deals 1 damage to you.\n{T}: Add {C}{C}{C}.",
    ['draw', 'upkeep'],
    ['self'],
    ['none'],
  ],
  // ── 否定 untap のみ=全 juncture 軸空(FP を出さない)─────────────────────────────────────────
  [
    'Basalt Monolith',
    'Artifact',
    "This artifact doesn't untap during your untap step.\n{T}: Add {C}{C}{C}.\n{3}: Untap this artifact.",
    [],
    [],
    ['none'],
  ],
  // ── 🔴 cast-clause juncture FP: 「When … enters during the declare attackers step」= enters 条件(Slice2)であり juncture でない。Flash は castTiming ─
  [
    'Misleading Signpost',
    'Artifact',
    'Flash\nWhen this artifact enters during the declare attackers step, you may reselect which player or permanent target attacking creature is attacking.\n{T}: Add {U}.',
    [],
    [],
    ['flash'],
  ],
  // ── 🔴 cast-clause juncture FP: 「Cast this spell only during combat on your turn」= cast 制限(combat-only+your-turn-only)であり begin-combat juncture でない ─
  [
    'Savage Beating',
    'Instant',
    'Cast this spell only during combat on your turn.\nChoose one —\n• Creatures you control gain double strike until end of turn.\n• Untap all creatures you control. After this phase, there is an additional combat phase.\nEntwine {1}{R}',
    [],
    [],
    ['combat-only', 'your-turn-only'],
  ],
  // ── 🔴 flash FP: 「a card with flash」= 検索フィルタの名詞であり flash 付与でない → castTiming none ─
  [
    'Waterlogged Teachings',
    'Instant',
    'Search your library for an instant card or a card with flash, reveal it, put it into your hand, then shuffle.',
    [],
    [],
    ['none'],
  ],
];

describe('M0-4 タイミング分類ゴールド(CR500 ターン構造 / juncture / castTiming)', () => {
  it.each(cases)(
    '《%s》→ junctures/junctureScope/castTiming が CR と一致',
    (name, typeLine, oracleText, expJunctures, expScope, expCast) => {
      const summary = timingOf(name, typeLine, oracleText);
      expect(summary.junctures).toEqual(expJunctures);
      expect(summary.junctureScope).toEqual(expScope);
      expect(summary.castTiming).toEqual(expCast);
    },
  );
});

describe('M0-4 不変条件', () => {
  it('junctures/junctureScope/castTiming は重複なし昇順(決定的)', () => {
    const s = timingOf(
      'multi',
      'Enchantment',
      "At the beginning of your upkeep, draw a card. At the beginning of each opponent's upkeep, you lose 1 life.",
    );
    expect(s.junctures).toEqual([...new Set(s.junctures)].sort());
    expect(s.junctureScope).toEqual([...new Set(s.junctureScope)].sort());
    expect(s.castTiming).toEqual([...new Set(s.castTiming)].sort());
  });

  it('同入力で同出力(決定的)', () => {
    const a = timingOf('det', 'Enchantment', 'At the beginning of your upkeep, you draw a card.');
    const b = timingOf('det', 'Enchantment', 'At the beginning of your upkeep, you draw a card.');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('oracleText 無しでも throw せず空 juncture / castTiming=[none]', () => {
    expect(timingOf('blank', 'Creature — Bear', '')).toEqual({
      junctures: [],
      junctureScope: [],
      castTiming: ['none'],
    });
  });

  it('juncture 無し行(deals combat damage)では junctureScope を立てない', () => {
    const s = timingOf(
      'cd',
      'Creature — Bear',
      'Whenever this creature deals combat damage to a player, draw a card.',
    );
    expect(s.junctures).toEqual([]);
    expect(s.junctureScope).toEqual([]);
  });
});
