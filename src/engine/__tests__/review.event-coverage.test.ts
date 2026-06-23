// Reviewer-owned adversarial gold for M0-2(イベント語彙 = 誘発/観測者/介在条件)の下面抽出分類器。
// 契約 = docs/engine-state-ontology.md スライス2「抽出タクソノミ + 出力スキーマ」/ docs/oracle-grammar-catalog.md スライス2。
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側(scripts/lib/eventClassify.ts)を直す。
//
// 対象は計測専用の純関数 classifyCardEvents(GameState 非依存・決定的・scripts 配下)。
// オラクル文は 2026-06-19 snapshot(英語 oracle_text 正本)から裏取り済みの確定値。
//
// 本ゴールドの核 = **誘発「条件」を分類し、効果本体を分類しない**。
//   例)Bitterblossom の「you lose 1 life」、Mentor の「draw a card」、Agent の「gain control」は
//       いずれも効果であって観測イベントではない → families に混入させない。
import { describe, expect, it } from 'vitest';

import {
  classifyCardEvents,
  type CardEventSummary,
  type EventFamily,
  type ObserverScope,
  type TriggerShape,
} from '../../../scripts/lib/eventClassify';
import { makeDef } from './helpers';

function eventsOf(name: string, typeLine: string, oracleText: string): CardEventSummary {
  return classifyCardEvents(
    makeDef({ scryfallId: name, typeLine, faces: [{ name, typeLine, oracleText }] }),
  );
}

// [name, typeLine, oracleText, families(昇順), observers(昇順), triggerShapes(昇順), hasInterveningIf]
const cases: ReadonlyArray<
  [string, string, string, EventFamily[], ObserverScope[], TriggerShape[], boolean]
> = [
  // ── ETB + dies, self。効果(search/「draw a card」)は族にしない ──────────────
  [
    'Solemn Simulacrum',
    'Artifact Creature — Golem',
    'When this creature enters, you may search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.\nWhen this creature dies, you may draw a card.',
    ['dies', 'enters'],
    ['self'],
    ['when'],
    false,
  ],
  // ── 自軍集合(controlled-set)の dies。「sacrifices a creature」は効果 ───────────
  [
    'Grave Pact',
    'Enchantment',
    'Whenever a creature you control dies, each other player sacrifices a creature of their choice.',
    ['dies'],
    ['controlled-set'],
    ['whenever'],
    false,
  ],
  // ── 対戦相手スコープの draw。括弧注釈と効果内「If the player doesn't」は介在条件でない ─
  [
    'Smothering Tithe',
    'Enchantment',
    "Whenever an opponent draws a card, that player may pay {2}. If the player doesn't, you create a Treasure token. (It's an artifact with \"{T}, Sacrifice this token: Add one mana of any color.\")",
    ['draw'],
    ['opponent'],
    ['whenever'],
    false,
  ],
  // ── 自分の呪文詠唱。「deals 2 damage」は効果 ───────────────────────────────
  [
    'Guttersnipe',
    'Creature — Goblin Shaman',
    'Whenever you cast an instant or sorcery spell, this creature deals 2 damage to each opponent.',
    ['cast'],
    ['self'],
    ['whenever'],
    false,
  ],
  // ── フェイズ juncture(self)。**効果の「you lose 1 life」を life 族にしない** ─────
  [
    'Bitterblossom',
    'Tribal Enchantment — Faerie',
    'At the beginning of your upkeep, you lose 1 life and create a 1/1 black Faerie Rogue creature token with flying.',
    ['phase'],
    ['self'],
    ['at'],
    false,
  ],
  // ── discard 観測。行頭でない「at the beginning of …」(効果内)は誘発でない ───────
  // 「Skip your draw step」は静的、起動型は誘発でない → discard のみ。
  [
    'Necropotence',
    'Enchantment',
    'Skip your draw step.\nWhenever you discard a card, exile that card from your graveyard.\nPay 1 life: Exile the top card of your library face down. Put that card into your hand at the beginning of your next end step.',
    ['discard'],
    ['self'],
    ['whenever'],
    false,
  ],
  // ── controlled-set の enters。「If you do, draw a card」は効果(介在条件でない)──────
  [
    'Mentor of the Meek',
    'Creature — Human Soldier',
    'Whenever another creature you control with power 2 or less enters, you may pay {1}. If you do, draw a card.',
    ['enters'],
    ['controlled-set'],
    ['whenever'],
    false,
  ],
  // ── enters + phase の二誘発(self)。「If you're the monarch … instead」は効果 ─────
  [
    'Court of Grace',
    'Enchantment',
    "When this enchantment enters, you become the monarch.\nAt the beginning of your upkeep, create a 1/1 white Spirit creature token with flying. If you're the monarch, create a 4/4 white Angel creature token with flying instead.",
    ['enters', 'phase'],
    ['self'],
    ['at', 'when'],
    false,
  ],
  // ── enters(self)。効果の「exile … then return … to the battlefield」を族にしない ──
  [
    'Felidar Guardian',
    'Creature — Cat Beast',
    'When this creature enters, you may exile another target permanent you control, then return that card to the battlefield under its owner\'s control.',
    ['enters'],
    ['self'],
    ['when'],
    false,
  ],
  // ── 介在条件(CR603.4)= TRUE。enters の直後に「if you control another Knight」──────
  [
    'Acclaimed Contender',
    'Creature — Human Knight',
    'When this creature enters, if you control another Knight, look at the top five cards of your library. You may reveal a Knight, Aura, Equipment, or legendary artifact card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.',
    ['enters'],
    ['self'],
    ['when'],
    true,
  ],
  // ── 任意プレイヤー(any)の cast + 介在条件。2行目「activate an ability」は other(逃さない箱)─
  [
    'Adrenaline Jockey',
    'Creature — Devil',
    'Whenever a player casts a spell, if it\'s not their turn, this creature deals 4 damage to them.\nWhenever you activate an exhaust ability, put a +1/+1 counter on this creature.',
    ['cast', 'other'],
    ['any', 'self'],
    ['whenever'],
    true,
  ],
  // ── enters + end-step phase。「gain control」「draw three cards」は効果。2行目に介在条件 ─
  [
    'Agent of Treachery',
    'Creature — Human',
    "When this creature enters, gain control of target permanent.\nAt the beginning of your end step, if you control three or more permanents you don't own, draw three cards.",
    ['enters', 'phase'],
    ['self'],
    ['at', 'when'],
    true,
  ],
  // ── iter2: dies FN(複数形「creatures die」)= dies。観測者 any。第2文は誘発でない ──
  [
    'Morbid Opportunist',
    'Creature — Human Rogue',
    'Whenever one or more other creatures die, draw a card. This ability triggers only once each turn.',
    ['dies'],
    ['any'],
    ['whenever'],
    false,
  ],
  // ── iter2: counter FN(受動「counters are put on this creature」)= counter。観測者 self ──
  // Adapt 起動型(`{1}{G}: Adapt 2.`)と注釈は誘発でない。
  [
    'Evolution Witness',
    'Creature — Elf Shaman',
    '{1}{G}: Adapt 2. (If this creature has no +1/+1 counters on it, put two +1/+1 counters on it.)\nWhenever one or more +1/+1 counters are put on this creature, return target permanent card from your graveyard to your hand.',
    ['counter'],
    ['self'],
    ['whenever'],
    false,
  ],
  // ── iter2: cast+zone FP の解消 = cast のみ。「from exile」は zone を発火させない。──────
  // **引用能力内の「At the beginning of the end step」を phase 誘発にしない**(quote 除去)。
  [
    'Nalfeshnee',
    'Creature — Demon',
    'Flying\nWhenever you cast a spell from exile, copy it. You may choose new targets for the copy. If it\'s a permanent spell, the copy gains haste and "At the beginning of the end step, sacrifice this permanent." (A copy of a permanent spell becomes a token.)',
    ['cast'],
    ['self'],
    ['whenever'],
    false,
  ],
  // ── iter2 control: 単数 dies は不変・観測者 any・効果「loses 1 life」は life 族にしない ──
  [
    'Poison-Tip Archer',
    'Creature — Elf Archer',
    'Reach\nDeathtouch\nWhenever another creature dies, each opponent loses 1 life.',
    ['dies'],
    ['any'],
    ['whenever'],
    false,
  ],
  // ── iter3: cast FN(列挙型)= cast。「cast an Aura, Equipment, or Vehicle spell」──────
  // 列挙された型の後ろにある `spell` まで読み、cast を発火させる(44枚の FN を閉鎖)。
  [
    'Sram, Senior Edificer',
    'Legendary Creature — Dwarf Advisor',
    'Whenever you cast an Aura, Equipment, or Vehicle spell, draw a card.',
    ['cast'],
    ['self'],
    ['whenever'],
    false,
  ],
  // ── 継続効果(層スライス1)は誘発でない = 全空。silent divergence を作らない ──────
  [
    "Gaea's Anthem",
    'Enchantment',
    'Creatures you control get +1/+1.',
    [],
    [],
    [],
    false,
  ],

  // ════ M0-O2 iter2-a 回帰 pin(LLM-oracle 盲予測 iter1 が炙り出した compiler 帰属の修正を固定)════
  // 正本 = research/event-oracle/adjudication.json。各 pin は CR 準拠の正しい分類で、修正前は classifier が外す。

  // ── P1: 自己名 short form。「Whenever <legendary short name> attacks」= self(分類器は full name のみ照合し unknown) ──
  [
    'Etali, Primal Storm',
    'Legendary Creature — Elder Dinosaur',
    "Whenever Etali attacks, exile the top card of each player's library, then you may cast any number of spells from among those cards without paying their mana costs.",
    ['attacks'],
    ['self'],
    ['whenever'],
    false,
  ],
  // ── P2a: ability-word 接頭辞「Landfall —」を剥がして誘発解析。+ P2b 非creature「a land you control」= controlled-set ──
  // 1行目「this creature enters」= self、landfall 行「a land you control enters」= controlled-set。
  [
    'Avenger of Zendikar',
    'Creature — Elemental',
    'When this creature enters, create a 0/1 green Plant creature token for each land you control.\nLandfall — Whenever a land you control enters, you may put a +1/+1 counter on each Plant creature you control.',
    ['enters'],
    ['controlled-set', 'self'],
    ['when', 'whenever'],
    false,
  ],
  // ── P2b: 戦闘ダメージの主語スコープ。「creatures you control deal combat damage to a player」= damage / controlled-set ──
  // 効果対象の「to a player」を any-player と誤認しない。phase 族にもしない(phase は物差し誤り=oracle)。
  [
    'Professional Face-Breaker',
    'Creature — Orc Warrior',
    'Menace\nWhenever one or more creatures you control deal combat damage to a player, create a Treasure token.\nSacrifice a Treasure: Exile the top card of your library. You may play that card this turn.',
    ['damage'],
    ['controlled-set'],
    ['whenever'],
    false,
  ],
  // ── P3: 複合主語「this X or another X you control」= self + controlled-set(行内で複数観測者) ──
  [
    'Zulaport Cutthroat',
    'Creature — Human Cleric',
    'Whenever this creature or another creature you control dies, each opponent loses 1 life and you gain 1 life.',
    ['dies'],
    ['controlled-set', 'self'],
    ['whenever'],
    false,
  ],
  // ── P4: 「becomes the target of a spell」= other(逃さない箱)。「this creature attacks」= self ──
  [
    'Goldspan Dragon',
    'Creature — Dragon',
    'Flying, haste\nWhenever this creature attacks or becomes the target of a spell, create a Treasure token.\nTreasures you control have "{T}, Sacrifice this artifact: Add two mana of any one color."',
    ['attacks', 'other'],
    ['self'],
    ['whenever'],
    false,
  ],
  // ── P4: 行内2誘発の分割。「When this Aura leaves the battlefield」が「When this Aura enters」の同一行末尾に埋没 → leaves を拾う ──
  // enters 側に介在条件「if it's on the battlefield」= iif true。引用 "..." は除去済。
  [
    'Animate Dead',
    'Enchantment — Aura',
    'Enchant creature card in a graveyard\nWhen this Aura enters, if it\'s on the battlefield, it loses "enchant creature card in a graveyard" and gains "enchant creature put onto the battlefield with this Aura." Return enchanted creature card to the battlefield under your control and attach this Aura to it. When this Aura leaves the battlefield, that creature\'s controller sacrifices it.\nEnchanted creature gets -1/-0.',
    ['enters', 'leaves'],
    ['self'],
    ['when'],
    true,
  ],
  // ── P5: mana 生成の tap は other(mana-tap)。状態変化 tap/untap でないので tap 族にしない。──
  // iter3 裁定1: 被付与パーマネント(enchanted Forest)主体 = コントローラ不問の開集合 → observer=any(旧 unknown を訂正)。
  // 「As this Aura enters」は誘発形(When/Whenever/At)でないので非カウント。
  [
    'Utopia Sprawl',
    'Enchantment — Aura',
    'Enchant Forest\nAs this Aura enters, choose a color.\nWhenever enchanted Forest is tapped for mana, its controller adds an additional one mana of the chosen color.',
    ['other'],
    ['any'],
    ['whenever'],
    false,
  ],
  // ── iter3 裁定3: 観測者=主体スコープ。「deals damage to an opponent」の opponent は受け手(recipient)であり観測者でない。──
  // 主体 = enchanted creature(被付与・開集合)→ 裁定1より observer=any(旧 opponent を訂正)。
  // opponent 主語(「an opponent draws」「each opponent's upkeep」)は Smothering Tithe/Sheoldred/Bloodchief が引き続きガード。
  [
    'Curiosity',
    'Enchantment — Aura',
    'Enchant creature\nWhenever enchanted creature deals damage to an opponent, you may draw a card.',
    ['damage'],
    ['any'],
    ['whenever'],
    false,
  ],
  [
    'Sheoldred, Whispering One',
    'Legendary Creature — Praetor',
    "Swampwalk (This creature can't be blocked as long as defending player controls a Swamp.)\nAt the beginning of your upkeep, return target creature card from your graveyard to the battlefield.\nAt the beginning of each opponent's upkeep, that player sacrifices a creature of their choice.",
    ['phase'],
    ['opponent', 'self'],
    ['at'],
    false,
  ],
  [
    'Bloodchief Ascension',
    'Enchantment',
    'At the beginning of each end step, if an opponent lost 2 or more life this turn, you may put a quest counter on this enchantment. (Damage causes loss of life.)\nWhenever a card is put into an opponent\'s graveyard from anywhere, if this enchantment has three or more quest counters on it, you may have that player lose 2 life. If you do, you gain 2 life.',
    ['phase', 'zone'],
    ['any', 'opponent'],
    ['at', 'whenever'],
    true,
  ],

  // ════ M0-O2 iter3 裁定 pin(ESO 境界3決定 + compiler 複合トリガ修正を固定)════
  // 正本 = docs/engine-state-ontology.md「iter3 ESO 境界裁定」/ research/event-oracle/adjudication.json。

  // ── 裁定1(unknown→any): 被付与/装備パーマネント主体 = コントローラ不問の開集合 → any。tap-for-mana は other 族。──
  [
    'Wild Growth',
    'Enchantment — Aura',
    'Enchant land\nWhenever enchanted land is tapped for mana, its controller adds an additional {G}.',
    ['other'],
    ['any'],
    ['whenever'],
    false,
  ],
  [
    'Fertile Ground',
    'Enchantment — Aura',
    'Enchant land\nWhenever enchanted land is tapped for mana, its controller adds an additional one mana of any color.',
    ['other'],
    ['any'],
    ['whenever'],
    false,
  ],
  // ── 裁定1: equipped creature dies = dies 族(creature)・観測者 any(装備先=開集合)──
  [
    'Skullclamp',
    'Artifact — Equipment',
    'Equipped creature gets +1/-1.\nWhenever equipped creature dies, draw two cards.\nEquip {1}',
    ['dies'],
    ['any'],
    ['whenever'],
    false,
  ],
  // ── 裁定1+3: equipped creature deals combat damage = damage 族・「to a player」は受け手で観測者でない・装備先=any ──
  [
    'Sword of Feast and Famine',
    'Artifact — Equipment',
    'Equipped creature gets +2/+2 and has protection from black and from green.\nWhenever equipped creature deals combat damage to a player, that player discards a card and you untap all lands you control.\nEquip {2}',
    ['damage'],
    ['any'],
    ['whenever'],
    false,
  ],
  // ── 裁定1: equipped creature attacks = attacks 族・装備先=any ──
  [
    'Sword of the Animist',
    'Legendary Artifact — Equipment',
    'Equipped creature gets +1/+1.\nWhenever equipped creature attacks, you may search your library for a basic land card, put it onto the battlefield tapped, then shuffle.\nEquip {2}',
    ['attacks'],
    ['any'],
    ['whenever'],
    false,
  ],

  // ── 裁定2(dies→leaves): 非creature の戦場→墓地 = leaves(CR700.4 の dies は creature 限定)──
  // Marionette: 「creature or artifact you control … from the battlefield」= creature 半→dies + artifact 半→leaves。主語 you control = controlled-set。
  [
    'Marionette Apprentice',
    'Creature — Human Artificer',
    'Fabricate 1 (When this creature enters, put a +1/+1 counter on it or create a 1/1 colorless Servo artifact creature token.)\nWhenever another creature or artifact you control is put into a graveyard from the battlefield, each opponent loses 1 life.',
    ['dies', 'leaves'],
    ['controlled-set'],
    ['whenever'],
    false,
  ],
  // Ichor Wellspring: artifact の enters + 「from the battlefield」= leaves(dies でない)。主体 this artifact = self。
  [
    'Ichor Wellspring',
    'Artifact',
    'When this artifact enters or is put into a graveyard from the battlefield, draw a card.',
    ['enters', 'leaves'],
    ['self'],
    ['when'],
    false,
  ],
  // Titania: 「Titania enters」(self) + 「a land you control … from the battlefield」= leaves(land=非creature)・controlled-set。
  [
    'Titania, Protector of Argoth',
    'Legendary Creature — Elemental',
    'When Titania enters, return target land card from your graveyard to the battlefield.\nWhenever a land you control is put into a graveyard from the battlefield, create a 5/3 green Elemental creature token.',
    ['enters', 'leaves'],
    ['controlled-set', 'self'],
    ['when', 'whenever'],
    false,
  ],

  // ── compiler 修正(複合『A, or B, or C』列挙トリガの中位/末尾取りこぼし)──
  // Trouble in Pairs: 「an opponent attacks you …, draws their second card …, or casts their second spell …」= attacks/cast/draw・主語 opponent。
  // 1行目「If an opponent would begin an extra turn …」は置換効果で誘発でない。
  [
    'Trouble in Pairs',
    'Enchantment',
    'If an opponent would begin an extra turn, that player skips that turn instead.\nWhenever an opponent attacks you with two or more creatures, draws their second card each turn, or casts their second spell each turn, you draw a card.',
    ['attacks', 'cast', 'draw'],
    ['opponent'],
    ['whenever'],
    false,
  ],
  // Syr Konrad: 「another creature dies(any), or a creature card … from anywhere other than the battlefield(zone), or … leaves your graveyard(zone/self)」。
  [
    'Syr Konrad, the Grim',
    'Legendary Creature — Human Knight',
    'Whenever another creature dies, or a creature card is put into a graveyard from anywhere other than the battlefield, or a creature card leaves your graveyard, Syr Konrad deals 1 damage to each opponent.\n{1}{B}: Each player mills a card. (They each put the top card of their library into their graveyard.)',
    ['dies', 'zone'],
    ['any', 'self'],
    ['whenever'],
    false,
  ],
  // Mirkwood Bats: 「you create or sacrifice a token」= create→other(専用族なし) + sacrifice。主語 you=self。
  [
    'Mirkwood Bats',
    'Creature — Bat',
    'Flying\nWhenever you create or sacrifice a token, each opponent loses 1 life.',
    ['other', 'sacrifice'],
    ['self'],
    ['whenever'],
    false,
  ],
  // ── compiler 修正(無所有格の主体 = any): Blood Artist「this creature(self) or another creature(無所有格=any) dies」。──
  // 対比: Zulaport Cutthroat「another creature you control」= controlled-set。所有格の有無で any/controlled-set を弁別。
  [
    'Blood Artist',
    'Creature — Vampire',
    'Whenever this creature or another creature dies, target player loses 1 life and you gain 1 life.',
    ['dies'],
    ['any', 'self'],
    ['whenever'],
    false,
  ],
  // ── compiler 修正(unpossessed phase → any): 「At the beginning of the end step」(無 your)= 各ターンの終了ステップ → any。──
  // 「Each nonland card … has escape」は静的能力で誘発でない → phase のみ。
  [
    'Underworld Breach',
    'Enchantment',
    "Each nonland card in your graveyard has escape. The escape cost is equal to the card's mana cost plus exile three other cards from your graveyard. (You may cast cards from your graveyard for their escape cost.)\nAt the beginning of the end step, sacrifice this enchantment.",
    ['phase'],
    ['any'],
    ['at'],
    false,
  ],
  // ── compiler 修正(causes-you → self): 「a land's ability causes you to add … mana」= mana 事象(other)・「you」= self。──
  [
    'Caged Sun',
    'Artifact',
    'As this artifact enters, choose a color.\nCreatures you control of the chosen color get +1/+1.\nWhenever a land\'s ability causes you to add one or more mana of the chosen color, add an additional one mana of that color.',
    ['other'],
    ['self'],
    ['whenever'],
    false,
  ],
  // ── compiler 修正(is-attacked 受動 → attacks 族): 「enchanted player is attacked」の compiler バグは族(other→attacks)。──
  // 観測者は「被付与プレイヤー」= 特定だがテキスト不定の単一プレイヤー(「各プレイヤーの攻撃」ではない)→ unknown を維持。
  // 裁定1(enchanted permanent → any = コントローラ不問の開集合)とは別物。物差しも unknown を uncertain として保留。
  [
    'Curse of Opulence',
    'Enchantment — Aura Curse',
    'Enchant player\nWhenever enchanted player is attacked, create a Gold token. Each opponent attacking that player does the same. (A Gold token is an artifact with "Sacrifice this token: Add one mana of any color.")',
    ['attacks'],
    ['unknown'],
    ['whenever'],
    false,
  ],
  // ── compiler 修正(any 過剰の是正 → self): 「your library and/or your graveyard」「your graveyard」= self。──
  // Laelia: 「Laelia attacks」(self・自己名) + 「cards … put into exile from your library and/or your graveyard」= zone/self。
  [
    'Laelia, the Blade Reforged',
    'Legendary Creature — Spirit Warrior',
    'Haste\nWhenever Laelia attacks, exile the top card of your library. You may play that card this turn.\nWhenever one or more cards are put into exile from your library and/or your graveyard, put a +1/+1 counter on Laelia.',
    ['attacks', 'zone'],
    ['self'],
    ['whenever'],
    false,
  ],
  // Gitrog: 「your upkeep」(phase/self) + 「land cards … into your graveyard from anywhere」= zone(from anywhere≠leaves)・self。
  [
    'The Gitrog Monster',
    'Legendary Creature — Frog Horror',
    'Deathtouch\nAt the beginning of your upkeep, sacrifice The Gitrog Monster unless you sacrifice a land.\nYou may play an additional land on each of your turns.\nWhenever one or more land cards are put into your graveyard from anywhere, draw a card.',
    ['phase', 'zone'],
    ['self'],
    ['at', 'whenever'],
    false,
  ],
];

describe('M0-2 イベント分類ゴールド: classifyCardEvents(誘発/観測者/介在条件)', () => {
  it.each(cases)(
    '《%s》→ 族・観測者・誘発形・介在条件が CR603/703 と一致',
    (name, typeLine, oracle, expFamilies, expObservers, expShapes, expIif) => {
      const summary = eventsOf(name, typeLine, oracle);
      expect(summary.families).toEqual(expFamilies);
      expect(summary.observers).toEqual(expObservers);
      expect(summary.triggerShapes).toEqual(expShapes);
      expect(summary.hasInterveningIf).toBe(expIif);
    },
  );
});

describe('M0-2 不変条件(計測専用・エンジン非依存)', () => {
  it('families/observers/triggerShapes は重複なし昇順(決定的)', () => {
    const s = eventsOf(
      'Solemn Simulacrum',
      'Artifact Creature — Golem',
      'When this creature enters, you may search your library for a basic land card.\nWhen this creature dies, you may draw a card.',
    );
    expect(s.families).toEqual([...new Set(s.families)].sort());
    expect(s.observers).toEqual([...new Set(s.observers)].sort());
    expect(s.triggerShapes).toEqual([...new Set(s.triggerShapes)].sort());
  });

  it('同入力で同出力(決定的)', () => {
    const a = eventsOf('Grave Pact', 'Enchantment', 'Whenever a creature you control dies, each other player sacrifices a creature of their choice.');
    const b = eventsOf('Grave Pact', 'Enchantment', 'Whenever a creature you control dies, each other player sacrifices a creature of their choice.');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('oracleText 無し(バニラ)でも throw せず空集合', () => {
    const def = makeDef({ scryfallId: 'vanilla', typeLine: 'Creature — Bear' });
    expect(() => classifyCardEvents(def)).not.toThrow();
    expect(classifyCardEvents(def)).toEqual({
      families: [],
      observers: [],
      triggerShapes: [],
      hasInterveningIf: false,
    });
  });
});
