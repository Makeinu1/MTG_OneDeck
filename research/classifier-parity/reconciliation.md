# Parity 和解ワークシート(草稿・判定なし)

生成: 2026-06-25T01:49:22.506Z / 生成器: `npm run parity-reconcile`

> 契約 = engine-spec §34.7.3。**本書は草稿**。`draftAttribution` は Codex/器の暫定見立てで、
> 最終帰属はクラスタ単位で **Fable が CR(`rule/...txt`)を引いて裁定**する(method §3 = CR 一次権威)。
> 裁定後に Codex が `ruleClassifier.ts`/`*Classify.ts`/`CLASSIFIER_PARITY_ALLOWANCES` を修正し parity を 0 へ。

## クラスタ一覧

| Cluster (family\|direction) | 件数 | 草稿帰属 | 統べる CR |
| --- | ---: | --- | --- |
| cast\|runtime-only | 72 | runtime-FP | CR 603.2 / 603.3(誘発条件)・608(解決) |
| enters\|research-only | 36 | runtime-FN | CR 603.2 / 603.6e(ETB 誘発)・603.10 |
| dies\|runtime-only | 33 | runtime-FP | CR 700.4(dies=creature/PW 限定)・603.6c |
| attacks\|runtime-only | 33 | runtime-FP | CR 508(攻撃クリーチャー指定)・603.3 |
| enters\|runtime-only | 21 | runtime-FP | CR 603.6e(ETB 誘発) |
| dies\|research-only | 15 | runtime-FN | CR 700.4・603.2(複数主語「one or more ... die」) |
| leaves\|runtime-only | 15 | undecided | CR 603.6c(leaves-the-battlefield 誘発)・700.4 |
| attacks\|research-only | 6 | runtime-FN | CR 508・802(攻撃される=is attacked) |
| draw\|research-only | 1 | undecided | CR 603.2・120(draw) |
| draw\|runtime-only | 1 | undecided | CR 603.2・120(draw) |

**検算**: 比較行合計 = 233(report.json mismatchedComparisons=233 と一致するはず)/ ユニークカード = 225(divergentCards=225 と一致するはず)。

---

## cast|runtime-only(72件)

- **統べる CR**: CR 603.2 / 603.3(誘発条件)・608(解決)
- **草稿帰属**: `runtime-FP`
- **根拠(草稿)**: runtime が "cast" の語(`spent to cast`・装備/呪文文中の cast 言及)で trigger.cast を過剰検出している疑い。研究 eventClassify は「Whenever ... cast(s) a spell」型の cast 誘発のみを族 cast とする。
- **提案する修正(草稿)**: runtime trigger.cast を「Whenever <player> cast(s) ...」の cast 誘発へ限定し、mana-spent 反射誘発・非誘発の cast 言及を除外(per-card 確認後)。

| oracleId | name | oracleText 抜粋 |
| --- | --- | --- |
| `b473e293-59e3-4e04-acf2-622604aeb25f` | Path of Ancestry | This land enters tapped. {T}: Add one mana of any color in your commander's color identity. When that mana is spent to cast a creature spell that shares a creature type with your c… |
| `5e060d58-4d6e-425c-b7d4-727669fcce5b` | Buster Sword | Equipped creature gets +3/+2. Whenever equipped creature deals combat damage to a player, draw a card, then you may cast a spell from your hand with mana value less than or equal t… |
| `e1c9783a-1d1b-40d7-872e-0ca11b229ce6` | Uthros Research Craft | Station (Tap another creature you control: Put charge counters equal to its power on this Spacecraft. Station only as a sorcery. It's an artifact creature at 12+.) 3+ \| Whenever yo… |
| `88d0a394-79e2-42ac-9a37-1a7b78231941` | Thunderclap Drake | Flying Instant and sorcery spells you cast cost {1} less to cast. {2}{U}, Sacrifice this creature: When you next cast an instant or sorcery spell this turn, copy it for each time y… |
| `3509171e-8d7d-4e9e-97a1-58e6c7d225ed` | Summon: Fenrir | (As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) I — Crescent Fang — Search your library for a basic land card, put it onto the battlefield… |
| `674e2683-31c0-4fee-95fb-98b1201e41e7` | Mirrodin Besieged | As this enchantment enters, choose Mirran or Phyrexian. • Mirran — Whenever you cast an artifact spell, create a 1/1 colorless Myr artifact creature token. • Phyrexian — At the beg… |
| `7bc4c7e2-6758-4a85-84e7-03ab93981106` | Tinybones, the Pickpocket | Deathtouch Whenever Tinybones deals combat damage to a player, you may cast target nonland permanent card from that player's graveyard, and mana of any type can be spent to cast th… |
| `93989dd7-2d3e-46e2-8e92-8d0479796087` | Twinferno | Choose one — • When you cast your next instant or sorcery spell this turn, copy that spell. You may choose new targets for the copy. • Target creature you control gains double stri… |
| `f76bcbfe-483f-4e63-8425-76feca1abf3e` | Pyromancer's Goggles | {T}: Add {R}. When that mana is spent to cast a red instant or sorcery spell, copy that spell and you may choose new targets for the copy. |
| `1718a442-b878-4690-b608-a013de3d79fc` | Light-Paws, Emperor's Voice | Whenever an Aura you control enters, if you cast it, you may search your library for an Aura card with mana value less than or equal to that Aura and with a different name than eac… |
| `13b96709-0e88-476b-9485-956e682bb818` | Scaled Nurturer | {T}: Add {G}. When you spend this mana to cast a Dragon creature spell, you gain 2 life. |
| `ba72d4a9-6f36-4796-bd71-2342fa9b4a30` | Yuna, Grand Summoner | Grand Summon — {T}: Add one mana of any color. When you next cast a creature spell this turn, that creature enters with two additional +1/+1 counters on it. Whenever another perman… |
| `5eef3d70-ef16-4722-8c3d-21a0311597bd` | Jade Orb of Dragonkind | {T}: Add {G}. When you spend this mana to cast a Dragon creature spell, it enters with an additional +1/+1 counter on it and gains hexproof until your next turn. (It can't be the t… |
| `c098c507-5154-423a-a70b-f6dfd4959cf6` | Sunken Palace | This land enters tapped. {T}: Add {U}. {1}{U}, {T}, Exile seven cards from your graveyard: Add {U}. When you spend this mana to cast a spell or activate an ability, copy that spell… |
| `40ab2b22-9cf6-4a73-a05f-6ce496d10bf7` | Bonus Round | Until end of turn, whenever a player casts an instant or sorcery spell, that player copies it and may choose new targets for the copy. |
| `e8e2f273-5e74-4f16-8d49-2e86e9c9f2dc` | Solar Array | {T}: Add one mana of any color. When you next cast an artifact spell this turn, that spell gains sunburst. (If it's a creature, it enters with a +1/+1 counter on it for each color… |
| `2148820c-85b6-4598-adf2-10873001a779` | Summon: Good King Mog XII | (As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.) I — Create two 1/2 white Moogle creature tokens with lifelink. II, III — Whenever you cast a… |
| `295a831c-490e-42ba-afc1-dab3524a4f0c` | Glacierwood Siege | As this enchantment enters, choose Temur or Sultai. • Temur — Whenever you cast an instant or sorcery spell, target player mills four cards. • Sultai — You may play lands from your… |
| `52826984-44cb-48dc-a737-bb02983ffea8` | Glamdring | Equipped creature has first strike and gets +1/+0 for each instant and sorcery card in your graveyard. Whenever equipped creature deals combat damage to a player, you may cast an i… |
| `5fe29c25-a7ad-4c79-a5a5-da1bbc832141` | Season of the Bold | Choose up to five {P} worth of modes. You may choose the same mode more than once. {P} — Create a tapped Treasure token. {P}{P} — Exile the top two cards of your library. Until the… |
| `c61ab8e1-ef23-465d-bcd3-f771434988b2` | Lapis Orb of Dragonkind | {T}: Add {U}. When you spend this mana to cast a Dragon creature spell, scry 2. (Look at the top two cards of your library, then put any number of them on the bottom and the rest o… |
| `ac50ef98-1791-4dd4-9c1f-8cea7db7ade5` | Maelstrom Archangel | Flying Whenever this creature deals combat damage to a player, you may cast a spell from your hand without paying its mana cost. |
| `ae9f5c80-bc96-4ab3-bb5b-e8bd470e9eab` | Magus Lucea Kane | Spiritual Leader — At the beginning of combat on your turn, put a +1/+1 counter on target creature. Psychic Stimulus — {T}: Add {C}{C}. When you next cast a spell with {X} in its m… |
| `32476743-c9d4-49ca-bec2-0669c215841b` | Anrakyr the Traveller | Lord of the Pyrrhian Legions — Whenever Anrakyr the Traveller attacks, you may cast an artifact spell from your hand or graveyard by paying life equal to its mana value rather than… |
| `7fb88a5d-9b72-4da9-ade4-d09cadd7e1cb` | Nuka-Nuke Launcher | Equipped creature gets +3/+0 and has intimidate. (It can't be blocked except by artifact creatures and/or creatures that share a color with it.) Whenever equipped creature attacks,… |
| `cbd483b5-5554-43ed-a729-535d01b0d5d3` | Jace Reawakened | You can't cast Jace Reawakened during your first, second, or third turns of the game. +1: Draw a card, then discard a card. +1: You may exile a nonland card with mana value 3 or le… |
| `e83a629e-2d74-48e2-ad4d-f390067cc51a` | Transcendent Dragon | Flash Flying When this creature enters, if you cast it, counter target spell. If that spell is countered this way, exile it instead of putting it into its owner's graveyard, then y… |
| `6107f9aa-3373-4166-b4b8-a26fd6d69c72` | Showdown of the Skalds | (As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) I — Exile the top four cards of your library. Until the end of your next turn, you may play… |
| `fcc7ed01-ff64-4ffe-9b83-daa4132fd92d` | Commander Liara Portyr | Whenever you attack, spells you cast from exile this turn cost {X} less to cast, where X is the number of players being attacked. Exile the top X cards of your library. Until end o… |
| `4c05b382-58ab-4a2d-a81c-408ea273b6b6` | Dreadhorde Arcanist | Trample Whenever this creature attacks, you may cast target instant or sorcery card with mana value less than or equal to this creature's power from your graveyard without paying i… |
| `b6b22bac-853a-45a8-a74d-9904ec2b34fd` | Summon: G.F. Cerberus | (As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) I — Surveil 1. (Look at the top card of your library. You may put it into your graveyard.)… |
| `ed7ba558-5341-4c7b-a9c5-b382dee88a13` | Crackling Spellslinger | Flash When this creature enters, if you cast it, the next instant or sorcery spell you cast this turn has storm. (When you cast that spell, copy it for each spell cast before it th… |
| `bab5e9ce-6d55-4d1e-a9ac-c2b954191be9` | Summon: Brynhildr | (As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) I — Chain — Exile the top card of your library. During any turn you put a lore counter on t… |
| `8933297c-62f1-4df9-91b8-2d3481db77e5` | Spider-Man India | Web-slinging {1}{G}{W} (You may cast this spell for {1}{G}{W} if you also return a tapped creature you control to its owner's hand.) Pavitr's Sevā — Whenever you cast a creature sp… |
| `118da256-d1ea-44e8-9026-317e49694d29` | Forger's Foundry | {T}: Add {U}. When you spend this mana to cast an instant or sorcery spell with mana value 3 or less, you may exile that spell instead of putting it into its owner's graveyard as i… |
| `494dc919-e429-491b-b19b-5037499e2dd6` | Bygone Marvels | Descend 8 — When you cast this spell, if there are eight or more permanent cards in your graveyard, copy this spell twice. You may choose new targets for the copies. Return target… |
| `821e8648-222c-4b33-a8bd-e8bfff7dcd9e` | Quistis Trepe | Blue Magic — When Quistis Trepe enters, you may cast target instant or sorcery card from a graveyard, and mana of any type can be spent to cast that spell. If that spell would be p… |
| `bbdb731d-c533-48ef-b82a-cf1a8ba36208` | The Sibsig Ceremony | Creature spells you cast cost {2} less to cast. Whenever a creature you control enters, if you cast it, destroy that creature, then create a 2/2 black Zombie Druid creature token. |
| `a3e10b9b-9349-4b44-a46c-c825293dbd05` | The Dawning Archaic | This spell costs {1} less to cast for each instant and sorcery card in your graveyard. Reach Whenever The Dawning Archaic attacks, you may cast target instant or sorcery card from… |
| `14c2c818-0ce2-4809-a5ff-ee4a6253defa` | Oskar, Rubbish Reclaimer | This spell costs {1} less to cast for each different mana value among cards in your graveyard. Whenever you discard a nonland card, you may cast it from your graveyard. |
| `f74d8f53-a239-4641-90f1-bf786d57e253` | Brass Infiniscope | {T}: Add {C}{C}. When you next cast a spell with {X} in its mana cost this turn, you draw a card and gain half X life, rounded down. |
| `7849426d-895d-4dfe-a94d-b8df634618a5` | Apple of Eden, Isu Relic | {T}, Pay 4 life, Sacrifice Apple of Eden: Look at target opponent's hand and exile those cards face down. You may play those cards this turn, and mana of any type can be spent to c… |
| `2158c73d-421b-4c94-af06-dd89cb8d3126` | Jeong Jeong, the Deserter | Firebending 1 (Whenever this creature attacks, add {R}. This mana lasts until end of combat.) Exhaust — {3}: Put a +1/+1 counter on Jeong Jeong. When you next cast a Lesson spell t… |
| `3ec7ae18-b203-49bd-95f9-ad5482459a23` | Mirror of Life Trapping | Whenever a creature enters, if it was cast, exile it, then return all other permanent cards exiled with this artifact to the battlefield under their owners' control. |
| `67a9357c-4713-4e01-a60d-532bf0dd80b6` | Codie, Vociferous Codex | You can't cast permanent spells. {4}, {T}: Add {W}{U}{B}{R}{G}. When you next cast a spell this turn, exile cards from the top of your library until you exile an instant or sorcery… |
| `2a7504b9-220d-412e-9381-b6a8a3750241` | Najal, the Storm Runner | You may cast sorcery spells as though they had flash. Whenever Najal attacks, you may pay {2}. If you do, when you next cast an instant or sorcery spell this turn, copy it. You may… |
| `30c0df75-9822-4016-a52b-d2e69dd58124` | Galea, Kindler of Hope | Vigilance You may look at the top card of your library any time. You may cast Aura and Equipment spells from the top of your library. When you cast an Equipment spell this way, it… |
| `aba60536-ffbd-480c-8e8f-9639bdc53d4b` | Spectral Arcanist | Flying When this creature enters, you may cast an instant or sorcery spell with mana value less than or equal to the number of Spirits you control from a graveyard without paying i… |
| `c33e99c6-189e-4dcf-8b6a-64937dbad361` | Rimefire Torque | As this artifact enters, choose a creature type. Whenever a permanent you control of the chosen type enters, put a charge counter on this artifact. {T}, Remove three charge counter… |
| `0c85a577-db82-4a36-bc42-49644eba1cf2` | Zevlor, Elturel Exile | Haste {2}, {T}: When you next cast an instant or sorcery spell that targets only a single opponent or a single permanent an opponent controls this turn, for each other opponent, ch… |
| `158a6225-a246-4fd6-aa57-0df8067b4383` | Lutri, the Spellchaser | Companion — Each nonland card in your starting deck has a different name. (If this card is your chosen companion, you may put it into your hand from outside the game for {3} as a s… |
| `ed77fdf2-59c0-4310-9b12-80d28beeaeef` | Chocobo Camp | This land enters tapped unless you control a legendary creature. {T}: Add {G}. When you next cast a Bird creature spell this turn, it enters with an additional +1/+1 counter on it.… |
| `5193172c-9024-409e-bd9e-0387971d65fe` | Boiling Rock Rioter | Firebending 1 (Whenever this creature attacks, add {R}. This mana lasts until end of combat.) Tap an untapped Ally you control: Exile target card from a graveyard. Whenever this cr… |
| `cb4f65b0-2841-42bf-8e18-d04a3b9f1a76` | Epistolary Librarian | Veil of Time — Whenever this creature attacks, you may cast a spell with mana value X or less from your hand without paying its mana cost, where X is the number of attacking creatu… |
| `01376449-5cd2-4079-8aaa-5128634ef20b` | Long List of the Ents | (As this Saga enters and after your draw step, add a lore counter. Sacrifice after VI.) I, II, III, IV, V, VI — Note a creature type that hasn't been noted for this Saga. When you… |
| `9a6bf8a3-7640-4890-ac62-d5028f41978b` | Rhino, Barreling Brute | Vigilance, trample, haste Whenever Rhino attacks, if you've cast a spell with mana value 4 or greater this turn, draw a card. |
| `566533af-5e67-463f-ac33-dfcf1ec735c9` | Ether | {T}, Exile this artifact: Add {U}. When you next cast an instant or sorcery spell this turn, copy that spell. You may choose new targets for the copy. |
| `ca59fbf4-c774-49d3-8630-108c053e01fb` | Whispersteel Dagger | Equipped creature gets +2/+0. Whenever equipped creature deals combat damage to a player, you may cast a creature spell from that player's graveyard this turn, and you may spend ma… |
| `eae3e762-dacd-4bd2-923c-3abb5ceb729a` | Aisha of Sparks and Smoke | Prowess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.) {R/W}: Aisha of Sparks and Smoke gains first strike until end of turn. Whenever Aisha d… |
| `c3a46eb3-38d9-4f47-9b71-26c9ea7ef1ce` | The Dragon-Kami Reborn // Dragon-Kami's Egg | (As this Saga enters and after your draw step, add a lore counter.) I, II — You gain 2 life. Look at the top three cards of your library. Exile one of them face down with a hatchin… |
| `d49c94fa-712a-47c0-b571-4db7e064a590` | Ride the Avalanche | The next spell you cast this turn can be cast as though it had flash. When you next cast a spell this turn, put X +1/+1 counters on up to one target creature, where X is the mana v… |
| `bd7111bc-9b8f-4c4b-b61c-7841a857ce6b` | Cherished Hatchling | When this creature dies, you may cast Dinosaur spells this turn as though they had flash, and whenever you cast a Dinosaur spell this turn, it gains "When this creature enters, you… |
| `0403bfb0-2174-4360-994d-68d8ca96fc55` | Nightmares and Daydreams | (As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.) I, II, III — Until your next turn, whenever you cast an instant or sorcery spell, target pla… |
| `e7b746c8-1b32-42ed-8328-4e16274209d8` | Kylox's Voltstrider | Collect evidence 6: This Vehicle becomes an artifact creature until end of turn. Whenever this Vehicle attacks, you may cast an instant or sorcery spell from among cards exiled wit… |
| `72a9a85d-7cfc-4b3c-82db-9d35be6c0982` | Bilbo, Thief in the Night | Spells you cast from anywhere other than your hand cost {1} less to cast. Whenever Bilbo attacks, you may cast an artifact, instant, or sorcery spell from your graveyard. If an ins… |
| `f2a6dc8d-3c98-44ae-aff0-b838d7aee0b7` | Sandstalker Moloch | Flash When this creature enters, if an opponent cast a blue and/or black spell this turn, look at the top four cards of your library. You may reveal a permanent card from among the… |
| `fdd4b3a9-83ce-41bf-82e2-7808657e2c09` | Transcendent Archaic | Vigilance Converge — When this creature enters, you may draw X cards, where X is the number of colors of mana spent to cast this spell. If you draw one or more cards this way, disc… |
| `657c5473-f153-4dd2-94a0-d477cbc2451d` | Helmut Zemo, Mastermind | Whenever Helmut Zemo attacks, you may cast target instant or sorcery card with mana value less than or equal to his power from your graveyard. If that spell would be put into your… |
| `9c78778a-6335-4949-8ade-11d0f085cb2b` | Loki Laufeyson | {1}, {T}: When you next cast an instant or sorcery spell with mana value less than or equal to Loki's power this turn, copy that spell. You may choose new targets for the copy. Pow… |
| `658252ed-7f52-4a31-834b-c39cee1d5e00` | Misunderstood Trapeze Elf | {TK}{TK} — Whenever you cast a spell, this creature gets +X/+X until end of turn, where X is the amount of generic mana in that spell's mana cost. {TK}{TK}{TK} — Hexproof {TK}{TK}… |
| `3e5ac76b-08bd-4232-9290-49742b0ff603` | Snazzy Aether Homunculus | {TK}{TK} — {1}: Target creature gains all creature types until end of turn. {TK}{TK}{TK} — Magecraft — Whenever you cast or copy an instant or sorcery spell, draw a card. {TK}{TK}… |
| `2c925531-63f8-4a6b-bfe0-bb8cd5d0d63d` | Weird Angel Flame | {TK}{TK} — Heroic — Whenever you cast a spell that targets this permanent, put two +1/+1 counters on it. {TK}{TK}{TK} — Protection from even mana values {TK}{TK} — 2/3 {TK}{TK}{TK}… |

## enters|research-only(36件)

- **統べる CR**: CR 603.2 / 603.6e(ETB 誘発)・603.10
- **草稿帰属**: `runtime-FN`
- **根拠(草稿)**: 「Whenever another creature enters under your control」型 ETB watcher を runtime が取りこぼしている疑い(研究は enters 族として検出)。
- **提案する修正(草稿)**: runtime etb-other 検出を「another ... enters (under your control)」へ拡張(per-card 確認後)。

| oracleId | name | oracleText 抜粋 |
| --- | --- | --- |
| `605c1ee0-5e8a-4e0a-a99b-42a38873f822` | Welcoming Vampire | Flying Whenever one or more other creatures you control with power 2 or less enter, draw a card. This ability triggers only once each turn. |
| `c97957a2-8310-4cff-8aad-871b7901d124` | Caretaker's Talent | (Gain the next level as a sorcery to add its ability.) Whenever one or more tokens you control enter, draw a card. This ability triggers only once each turn. {W}: Level 2 When this… |
| `98a389f4-2905-47f3-b60e-3d4afb3e5cb0` | Enduring Innocence | Lifelink Whenever one or more other creatures you control with power 2 or less enter, draw a card. This ability triggers only once each turn. When Enduring Innocence dies, if it wa… |
| `25c983e0-a8c9-4784-91a4-8fe04c6df882` | Tocasia's Welcome | Whenever one or more creatures you control with mana value 3 or less enter, draw a card. This ability triggers only once each turn. |
| `619e0686-e88c-4238-8364-75395e733533` | Kambal, Profiteering Mayor | Whenever one or more tokens your opponents control enter, for each of them, create a tapped token that's a copy of it. This ability triggers only once each turn. Whenever one or mo… |
| `f8c2a972-e38f-47e5-a355-6f30ad09b1ae` | Losheel, Clockwork Scholar | Prevent all combat damage that would be dealt to attacking artifact creatures you control. Whenever one or more artifact creatures you control enter, draw a card. This ability trig… |
| `bda83ef4-e345-495d-878c-4da171f997ba` | Elvish Warmaster | Whenever one or more other Elves you control enter, create a 1/1 green Elf Warrior creature token. This ability triggers only once each turn. {5}{G}{G}: Elves you control get +2/+2… |
| `752c7723-90f8-4e3a-8266-f251ee0dadd8` | Ingenious Artillerist | Whenever one or more artifacts you control enter, this creature deals that much damage to each opponent. |
| `7555c429-5f2d-4171-b6b0-8e3c8da7f314` | Satoru, the Infiltrator | Menace Whenever Satoru and/or one or more other nontoken creatures you control enter, if none of them were cast or no mana was spent to cast them, draw a card. |
| `e25b516c-bf95-42bc-8b1e-04617a3d28df` | Baron Bertram Graywater | Whenever one or more tokens you control enter, create a 1/1 black Vampire Rogue creature token with lifelink. This ability triggers only once each turn. {1}{B}, Sacrifice another c… |
| `f6479f7e-01f4-49f1-a444-04bf38934f6b` | Marneus Calgar | Double strike Master Tactician — Whenever one or more tokens you control enter, draw a card. Chapter Master — {6}: Create two 2/2 white Astartes Warrior creature tokens with vigila… |
| `1b600345-2b89-45bc-98c8-609fdd08a5fd` | Merry, Warden of Isengard | Partner with Pippin, Warden of Isengard (When this creature enters, target player may put Pippin into their hand from their library, then shuffle.) Whenever one or more artifacts y… |
| `1829f1dc-1fa9-4361-b318-d4dee280e6fd` | Anje, Maid of Dishonor | Whenever Anje and/or one or more other Vampires you control enter, create a Blood token. This ability triggers only once each turn. (It's an artifact with "{1}, {T}, Discard a card… |
| `0177b410-b559-491f-b393-ac3ed774653c` | Kotis, Sibsig Champion | Once during each of your turns, you may cast a creature spell from your graveyard by exiling three other cards from your graveyard in addition to paying its other costs. Whenever o… |
| `d7035db0-4bde-4ba3-9028-dd14191c8126` | Elvish Archivist | Whenever one or more artifacts you control enter, put two +1/+1 counters on this creature. This ability triggers only once each turn. Whenever one or more enchantments you control… |
| `a728685f-8670-4db2-ae02-3cf74eb3c402` | Ran and Shaw | Flying, firebending 2 When Ran and Shaw enter, if you cast them and there are three or more Dragon and/or Lesson cards in your graveyard, create a token that's a copy of Ran and Sh… |
| `de861715-fd0b-493e-9a7c-c470a23044c0` | J. Jonah Jameson | When J. Jonah Jameson enters, suspect up to one target creature. (A suspected creature has menace and can't block.) Whenever a creature you control with menace attacks, create a Tr… |
| `481c3e14-b670-4fab-aa9f-6ce5b514096d` | Aang and Katara | Whenever Aang and Katara enter or attack, create X 1/1 white Ally creature tokens, where X is the number of tapped artifacts and/or creatures you control. |
| `df72b5d6-6f9e-4d6b-acf6-7dec4ff35468` | Bess, Soul Nourisher | Whenever one or more other creatures you control with base power and toughness 1/1 enter, put a +1/+1 counter on Bess. Whenever Bess attacks, each other creature you control with b… |
| `2385c8fb-9c38-4ff3-8f61-4e25a8c7d46b` | Krang & Shredder | Whenever Krang & Shredder enter or attack, each opponent exiles cards from the top of their library until they exile a nonland card. Disappear — At the beginning of your end step,… |
| `675321d7-2cf0-4e0b-9517-d711b22865ab` | Woodland Champion | Whenever one or more tokens you control enter, put that many +1/+1 counters on this creature. |
| `61f09fcc-11cd-4999-a43a-54488b19861d` | Cloakwood Swarmkeeper | Gathered Swarm — Whenever one or more tokens you control enter, put a +1/+1 counter on this creature. |
| `ad643992-eb9f-4a4a-9b74-a5aee2337f30` | Lo and Li, Twin Tutors | When Lo and Li enter, search your library for a Lesson or Noble card, reveal it, put it into your hand, then shuffle. Noble creatures you control and Lesson spells you control have… |
| `7b33368f-0668-4233-8bbf-725c66c771cb` | Donnie & April, Adorkable Duo | When Donnie & April enter, choose one or both. Each mode must target a different player. • Target player draws two cards. • Target player returns an artifact, instant, or sorcery c… |
| `c77ddcac-ce54-4348-bde2-5d9caf3d5b04` | Spiritcall Enthusiast // Scrollboost | Whenever one or more tokens you control enter, this creature becomes prepared. (While it's prepared, you may cast a copy of its spell. Doing so unprepares it.) // One or two target… |
| `c01095ba-b9c9-44e0-97d1-35cc47c4ed04` | Splinter & Leo, Father & Son | When Splinter & Leo enter, choose one or both. Each mode must target a different player. • Target player creates a 2/2 red Mutant creature token. • Put a +1/+1 counter on each othe… |
| `7fa5237e-dd79-4646-b935-cb8c6ee803ab` | Mister Fantastic, Reed Richards | Reach Whenever one or more tokens you control enter, you may draw a card. |
| `15e14a91-a596-465f-becc-cef2e7fbbd30` | Mikey & Mona, Mutant Sitters | When Mikey & Mona enter, choose one or both. Each mode must target a different player. • Target player chooses a creature they control and puts two +1/+1 counters on it. • Target p… |
| `f20a5297-31ba-4bbd-810e-be23175a116f` | Casey & Raph, Hotheads | When Casey & Raph enter, choose one or both. Each mode must target a different player. • Target player exiles the top card of their library. Until that player's next end step, they… |
| `a2281c99-3f45-441b-8e78-7f1f29bf1dcd` | The Fantastic Four | When The Fantastic Four enter and whenever you cast a spell with power, toughness, or mana value 4, choose one that hasn't been chosen this turn. • Create a 0/4 colorless Wall crea… |
| `64132f93-66ac-4794-8c07-a88f9ed0e22b` | Cloak and Dagger, Entwined | Deathtouch, lifelink When Cloak and Dagger enter, choose target opponent and up to one target creature they control. They reveal their hand. You may exile a nonland card from their… |
| `aaded61e-32c2-4e02-8557-3f8cd927a64e` | Gert and Old Lace, Runaways | Trample (This creature can deal excess combat damage to the player they're attacking.) When Gert and Old Lace enter, you may discard a card. If you do, search your library for a ba… |
| `74858500-8943-4ea7-894f-0cd022510bbe` | Devil K. Nevil | Haste When Devil K. Nevil enters, jump it over any number of creatures. If it clears those creatures, put that many +1/+1 counters on it. (You can see a jumping demonstration at De… |
| `760d6cb2-5d8a-495c-9853-f96a1efa5775` | The Immortal Weapons | When The Immortal Weapons enter, return target instant or sorcery card from your graveyard to your hand. Whenever you cast a noncreature spell, target creature gets +2/+0 and gains… |
| `2b6fa8b6-4865-4eb6-974b-00f6b16b6f0f` | U.S.Agent, John Walker | When U.S.Agent enters, create a colorless Equipment artifact token named Sturdy Shield with "Equipped creature gets +1/+2" and equip {2}. Attach it to U.S.Agent. |
| `26a1b36c-3c27-4eb4-b85f-63459653b773` | Ms. Marvel, Elastic Ally | Reach When Ms. Marvel enters, target creature gets +2/+0 until end of turn. Whenever a creature you control with power greater than its base power deals combat damage to a player,… |

## dies|runtime-only(33件)

- **統べる CR**: CR 700.4(dies=creature/PW 限定)・603.6c
- **草稿帰属**: `runtime-FP`
- **根拠(草稿)**: runtime が dies を過剰検出している疑い(置換「would die」や非 creature の戦場→墓地を死亡として拾う)。
- **提案する修正(草稿)**: 「would die」置換を除外し主語を creature/PW へ限定(trigger.leaves との弁別=Slice2/iter3 裁定の runtime ミラー)。

| oracleId | name | oracleText 抜粋 |
| --- | --- | --- |
| `36b19ec0-d581-4213-bfae-1d7808a2f60d` | Together Forever | When this enchantment enters, support 2. (Put a +1/+1 counter on each of up to two target creatures.) {1}: Choose target creature with a counter on it. When that creature dies this… |
| `91df4cf5-d7ec-4fcd-87ed-e075ef6ceba9` | The Deck of Many Things | {2}, {T}: Roll a d20 and subtract the number of cards in your hand. If the result is 0 or less, discard your hand. 1—9 \| Return a card at random from your graveyard to your hand. 1… |
| `78df47c3-b771-4377-8963-ae3065fdcf8a` | Waltz of Rage | Target creature you control deals damage equal to its power to each other creature. Until end of turn, whenever a creature you control dies, exile the top card of your library. You… |
| `5b3326a5-18c5-4d45-90e1-f6d00ca2bced` | Kelsien, the Plague | Vigilance, haste Kelsien gets +1/+1 for each experience counter you have. {T}: Kelsien deals 1 damage to target creature you don't control. When that creature dies this turn, you g… |
| `91596da5-5b1a-430c-a878-7757ae366b6b` | Battle of Hoover Dam | As this enchantment enters, choose NCR or Legion. • NCR — At the beginning of your end step, return target creature card with mana value 3 or less from your graveyard to the battle… |
| `27a4b633-5a62-4d8c-8cc6-44959c311de9` | Cryptek | {1}{B}, {T}: Choose another target artifact creature you control. When that creature dies this turn, return it to the battlefield tapped under your control. |
| `be0a3925-8e0d-4ef6-85cb-c9f5eef6b4bb` | Turn Inside Out | Target creature gets +3/+0 until end of turn. When it dies this turn, manifest dread. (Look at the top two cards of your library. Put one onto the battlefield face down as a 2/2 cr… |
| `0332f7b5-dad3-4fd0-b86c-78bd8301f59d` | Gnawing Crescendo | Creatures you control get +2/+0 until end of turn. Whenever a nontoken creature you control dies this turn, create a 1/1 black Rat creature token with "This token can't block." |
| `860b5e4c-45bd-4ba1-930a-36a1450ebd37` | Infested Thrinax | Flash When this creature enters, until end of turn, whenever a nontoken creature you control dies, create a number of 1/1 green Saproling creature tokens equal to that creature's p… |
| `f1f3df1c-5c51-445a-b66d-eee4aab23691` | Desperate Measures | Target creature gets +1/-1 until end of turn. When it dies under your control this turn, draw two cards. |
| `66d57851-2844-4b9d-be78-e90fc620b750` | Scarblade's Malice | Target creature you control gains deathtouch and lifelink until end of turn. When that creature dies this turn, create a 2/2 black and green Elf creature token. |
| `e1905321-180b-41d2-b7ef-0974ab90f188` | Felonious Rage | Target creature you control gets +2/+0 and gains haste until end of turn. When that creature dies this turn, create a 2/2 white and blue Detective creature token. |
| `75137acb-dc8e-439b-8d84-c5cf682ff6bc` | Reckless Blaze | Reckless Blaze deals 5 damage to each creature. Whenever a creature you control dealt damage this way dies this turn, add {R}. |
| `00cfbea0-e862-468b-90d5-7478eb9847c0` | End-Blaze Epiphany | End-Blaze Epiphany deals X damage to target creature. When that creature dies this turn, exile a number of cards from the top of your library equal to its power, then choose a card… |
| `cc9088c4-6f6b-4a1a-90f1-794eb1e938c6` | Phenomenon Investigators | As this creature enters, choose Believe or Doubt. • Believe — Whenever a nontoken creature you control dies, create a 2/2 black Horror enchantment creature token. • Doubt — At the… |
| `7d3a0216-871b-4c1b-adb1-de99b832f577` | Ruinous Waterbending | As an additional cost to cast this spell, you may waterbend {4}. (While paying a waterbend cost, you can tap your artifacts and creatures to help. Each one pays for {1}.) All creat… |
| `902b82fd-bb18-4833-b427-af8c9751f870` | Searing Blood | Searing Blood deals 2 damage to target creature. When that creature dies this turn, Searing Blood deals 3 damage to the creature's controller. |
| `202e45d6-8c7a-46db-85fb-634aa77b4097` | Fatal Fissure | Choose target creature. When that creature dies this turn, you earthbend 4. (Target land you control becomes a 0/0 creature with haste that's still a land. Put four +1/+1 counters… |
| `04e3d36f-5dec-422c-a371-15e135fdface` | Blessed Defiance | Target creature you control gets +2/+0 and gains lifelink until end of turn. When that creature dies this turn, create a 1/1 white Spirit creature token with flying. |
| `a4374baa-a846-4b34-afbf-6bb7feb4648c` | Electric Seaweed | Defender, haste When this creature enters, until end of turn, whenever another creature dies, this creature deals 1 damage to each non-Wall creature. {T}: This creature deals 1 dam… |
| `a0218a14-8301-4484-aed5-90334349620e` | Warhost's Frenzy | Kicker {B} (You may pay an additional {B} as you cast this spell.) Creatures you control get +2/+0 until end of turn. If this spell was kicked, whenever a creature you control dies… |
| `59642d6f-8a25-4f79-9e81-643eac775658` | Time to Feed | Choose target creature an opponent controls. When that creature dies this turn, you gain 3 life. Target creature you control fights that creature. (Each deals damage equal to its p… |
| `03c47f1c-02a7-428c-a126-9e85325ebc71` | Heroic Sacrifice | Choose target creature you control. Until end of turn, all damage that would be dealt to you and creatures you control is dealt to the chosen creature instead (if it's still on the… |
| `53129de9-4809-4c8c-9d11-37369899e70a` | Fight for the Throne | Put a +1/+1 counter on target creature you control. Then it fights target creature an opponent controls. When the creature an opponent controls dies this turn, if you control your… |
| `5b18d2fd-bc65-49a2-b812-c217f125571d` | Initiate of Blood // Goka the Unjust | {T}: This creature deals 1 damage to target creature that was dealt damage this turn. When that creature dies this turn, flip this creature. // {T}: Goka deals 4 damage to target c… |
| `e4f218b3-d96d-49c5-8dfa-8fcf993f795f` | Truss, Chief Engineer | Whenever Truss, Chief Engineer enters or another creature dies, put a hack counter on Truss. {2}, {T}, Remove X hack counters from Truss: Add or subtract X from a number or number… |
| `f81207e8-d5a2-4a5e-8a81-803ac563fe76` | Minotaur, Roxxon CEO | Whenever Minotaur, Roxxon CEO or another nontoken creature dies, you create a 2/1 black Villain creature token with menace. (It can't be blocked except by two or more creatures.) |
| `13d9822f-0398-4915-818b-b9fbaf63b93c` | Demonic Tourist Laser | {TK}{TK} — Outlast {1} ({1}, {T}: Put a +1/+1 counter on this creature. Outlast only as a sorcery.) {TK}{TK}{TK} — When this permanent dies, you get seven {TK}. {TK}{TK} — 1/4 {TK}… |
| `5829ac8e-bd1c-4065-b30a-5307ab11ae79` | Elemental Time Flamingo | {TK}{TK} — Exile this permanent: You may cast target nonland card from your graveyard this turn. {TK}{TK}{TK}{TK} — Whenever a creature you control dies, each opponent loses 1 life… |
| `26f6170a-34dc-41c8-b3b1-20377f131e6e` | Giant Mana Cake | {TK}{TK} — When this permanent leaves the battlefield, create two Food tokens. (They're artifacts with "{2}, {T}, Sacrifice this artifact: You gain 3 life.") {TK}{TK}{TK}{TK} — Whe… |
| `a7a00246-54e7-4213-b95b-907ab9015e53` | Primal Elder Kitty | {TK}{TK} — {1}: This creature gets +1/-1 until end of turn. {TK}{TK}{TK} — When this creature dies, you may put X +1/+1 counters on target creature, where X is this creature's powe… |
| `3def54bf-2640-47de-84e8-7a9406df007e` | Sticky Kavu Daredevil | {TK}{TK} — Whenever this permanent dies, you may return target creature to its owner's hand. {TK}{TK}{TK}{TK} — Whenever this creature attacks, creatures you control get +1/+1 unti… |
| `6ad4d181-21ce-47f3-9c00-2aa8c307e7fe` | Unassuming Gelatinous Serpent | {TK}{TK} — When this permanent dies, return target noncreature, nonland card from your graveyard to your hand. {TK}{TK}{TK}{TK} — Whenever this creature deals combat damage to a pl… |

## attacks|runtime-only(33件)

- **統べる CR**: CR 508(攻撃クリーチャー指定)・603.3
- **草稿帰属**: `runtime-FP`
- **根拠(草稿)**: runtime が attacks を過剰検出している疑い(攻撃誘発でない attack 言及を拾う)。
- **提案する修正(草稿)**: runtime trigger.attack を「Whenever <creature> attacks」型へ限定(per-card 確認後)。

| oracleId | name | oracleText 抜粋 |
| --- | --- | --- |
| `5958e9e3-9457-48e1-afc1-a5c89e3b0ed0` | Struggle for Project Purity | As this enchantment enters, choose Brotherhood or Enclave. • Brotherhood — At the beginning of your upkeep, each opponent draws a card. You draw a card for each card drawn this way… |
| `afc9436b-8cad-4916-929d-ff33a37b42d5` | Dawnsire, Sunstar Dreadnought | Station (Tap another creature you control: Put charge counters equal to its power on this Spacecraft. Station only as a sorcery. It's an artifact creature at 20+.) 10+ \| Whenever y… |
| `e0bdfbb4-3060-4492-bd9b-0c47e719400a` | Jumbo Cactuar | 10,000 Needles — Whenever this creature attacks, it gets +9999/+0 until end of turn. |
| `31061e34-042e-40c3-99ab-752795ab4324` | Hollowmurk Siege | As this enchantment enters, choose Sultai or Abzan. • Sultai — Whenever a counter is put on a creature you control, draw a card. This ability triggers only once each turn. • Abzan… |
| `33a90122-7280-4481-9b97-5879194cae40` | Dalkovan Encampment | This land enters tapped unless you control a Swamp or a Mountain. {T}: Add {W}. {2}{W}, {T}: Whenever you attack this turn, create two 1/1 red Warrior creature tokens that are tapp… |
| `53643dd7-183b-4062-b7a3-e7723d23bdb0` | Company Commander | Command Section — When this creature enters, create a number of 1/1 white Soldier creature tokens equal to the number of opponents you have. Bring it Down! — Whenever this creature… |
| `23af0a0a-1d12-47c7-b191-2bd3f84eea93` | The Tenth Doctor | Allons-y! — Whenever you attack, exile cards from the top of your library until you exile a nonland card. Put three time counters on it. If it doesn't have suspend, it gains suspen… |
| `2274c7ae-5a40-4fd4-a4ac-6f56b23034e4` | Jace, Architect of Thought | +1: Until your next turn, whenever a creature an opponent controls attacks, it gets -1/-0 until end of turn. −2: Reveal the top three cards of your library. An opponent separates t… |
| `fcd54631-ea47-49a7-ad5f-9a9a51a815ba` | Unstable Glyphbridge // Sandswirl Wanderglyph | When this artifact enters, if you cast it, for each player, choose a creature with power 2 or less that player controls. Then destroy all creatures except creatures chosen this way… |
| `f0554a8f-32de-4069-9f47-5e06ceb3f09d` | Aloy, Savior of Meridian | Vigilance, reach In You, All Things Are Possible — Whenever one or more artifact creatures you control attack, discover X, where X is the greatest power among them. (Exile cards fr… |
| `2458aa66-5b20-4811-a4a4-8375ad0a6498` | Jaya, Fiery Negotiator | +1: Create a 1/1 red Monk creature token with prowess. −1: Exile the top two cards of your library. Choose one of them. You may play that card this turn. −2: Choose target creature… |
| `a9a35c77-637f-4d56-afa2-6c8a4ded4838` | Stinging Cave Crawler | Deathtouch Descend 4 — Whenever this creature attacks, if there are four or more permanent cards in your graveyard, you draw a card and you lose 1 life. |
| `20f92504-d03c-437e-9814-b25ee384b3ba` | Butch DeLoria, Tunnel Snake | Menace (This creature can't be blocked except by two or more creatures.) Tunnel Snakes Rule! — Whenever Butch DeLoria attacks, it gets +1/+1 until end of turn for each other Rogue… |
| `2494daad-c81d-4a80-ba5d-e7011af8de46` | Maeve, Insidious Singer | {2}{U}: Goad target creature. Whenever that creature attacks one of your opponents this turn, you draw a card. (A goaded creature attacks each combat if able and attacks a player o… |
| `d53d5d03-b180-4bdb-8801-260f8a75644d` | Tamiyo Meets the Story Circle | (As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) I — Until your next turn, whenever a creature attacks you or a planeswalker you control, it… |
| `80312910-5d53-44f1-9982-e46dc7532abb` | The Unbeatable Squirrel Girl | Do You Like Squirrels? — Whenever The Unbeatable Squirrel Girl enters or attacks, create a 1/1 green Squirrel creature token. I LOVE Squirrels! — {1}{G}{G}{G}: Create X 1/1 green S… |
| `25a9c864-59c6-4230-a234-bf78bf1ef24c` | Malamet Veteran | Trample Descend 4 — Whenever this creature attacks, if there are four or more permanent cards in your graveyard, put a +1/+1 counter on target creature. |
| `50d0d870-fe3d-44a2-ad6e-93307a1fb468` | Ace, Fearless Rebel | Nitro-9 — Whenever Ace attacks, you may sacrifice an artifact. When you do, put a +1/+1 counter on Ace, then it fights up to one target creature defending player controls. Doctor's… |
| `02718076-4c71-4bf5-988f-e6f94fbf0aef` | Spara's Adjudicators | When this creature enters, target creature an opponent controls can't attack or block until your next turn. {2}, Exile this card from your hand: Target land gains "{T}: Add {G}, {W… |
| `8ec3c334-8a53-46d8-8cfb-c647c3a1ef74` | Stalked Researcher | Defender Eerie — Whenever an enchantment you control enters and whenever you fully unlock a Room, this creature can attack this turn as though it didn't have defender. |
| `7e06b7b4-22c1-4e5b-81ee-54ab5ac756eb` | Carnival Elephant Meteor | {TK}{TK} — Sacrifice this permanent: Draw two cards. {TK}{TK}{TK} — Whenever this creature attacks, proliferate. (Choose any number of permanents and/or players, then give each ano… |
| `43f5ce56-6ad1-4a42-b1d7-26f1c7933693` | Deep-Fried Plague Myr | {TK}{TK} — Whenever this creature attacks, scry 1. {TK}{TK}{TK} — Whenever this permanent leaves the battlefield, you may destroy target artifact or enchantment. {TK}{TK}{TK} — 4/5… |
| `41c0e1f1-8ebe-4cd2-96fe-e4bb625fe6ee` | Familiar Beeble Mascot | {TK}{TK} — Whenever this creature attacks, untap target permanent. {TK}{TK}{TK}{TK} — Whenever a creature enters under your control, creatures you control get +1/+1 until end of tu… |
| `366e0a62-ff95-48d1-bc63-7995a393bc34` | Narrow-Minded Baloney Fireworks | {TK}{TK} — Whenever this creature attacks, you gain 2 life. {TK}{TK}{TK} — Vigilance, reach {TK}{TK} — 2/4 {TK}{TK}{TK}{TK}{TK} — 7/7 |
| `dde09abb-e3d3-4c76-b7e8-812949dd67f3` | Phyrexian Midway Bamboozle | {TK}{TK} — Whenever this creature attacks, you get {TK}. {TK}{TK}{TK} — Undying (When this creature dies, if it had no +1/+1 counters on it, return it to the battlefield under its… |
| `065cdf8d-6874-4ab6-a08e-79bd88b245bd` | Playable Delusionary Hydra | {TK}{TK} — {T}: Draw a card, then discard a card. {TK}{TK}{TK}{TK} — Whenever this creature attacks, you gain 3 life and draw a card. {TK}{TK} — 1/5 {TK}{TK}{TK} — 4/4 |
| `16663933-c8e2-4411-8eed-673c52fa3ecb` | Sassy Gremlin Blood | {TK}{TK} — Whenever this creature attacks, create a Treasure token. {TK}{TK}{TK}{TK}{TK} — {3}: Target creature gains flying until end of turn. {TK}{TK} — 3/2 {TK}{TK}{TK}{TK}{TK}{… |
| `3def54bf-2640-47de-84e8-7a9406df007e` | Sticky Kavu Daredevil | {TK}{TK} — Whenever this permanent dies, you may return target creature to its owner's hand. {TK}{TK}{TK}{TK} — Whenever this creature attacks, creatures you control get +1/+1 unti… |
| `ea1fb0c3-d52c-4435-af2c-4b74f31189f7` | Unhinged Beast Hunt | {TK}{TK} — {T}: You gain 1 life. {TK}{TK}{TK}{TK} — Whenever this creature attacks, tap each creature an opponent controls with the same power and/or same toughness as this creatur… |
| `989346e5-3e76-40ce-8295-d267929d4fd5` | Unique Charmed Pants | {TK}{TK} — {T}: Add one mana of any color. {TK}{TK}{TK} — Whenever this creature attacks, if it's not a Brushwagg, it gets +X/+0 until end of turn, where X is the number of superty… |
| `4413cb03-d6e9-4e6c-b5fe-9240ca0ebd13` | Unsanctioned Ancient Juggler | {TK}{TK} — Whenever this creature attacks, bolster 1. (Choose a creature with the least toughness among creatures you control and put a +1/+1 counter on it.) {TK}{TK}{TK}{TK} — Ind… |
| `676de97a-299b-42ac-aa93-bb12dc9c4460` | Unstable Robot Dragon | {TK}{TK} — {1}: Switch this creature's power and toughness until end of turn. {TK}{TK}{TK}{TK} — Whenever this creature attacks, it gets +5/+5 until end of turn. {TK}{TK} — 3/2 {TK… |
| `578c23d2-225f-4488-be7f-4abe38297bde` | Wild Ogre Bupkis | {TK}{TK} — Whenever this creature attacks, put a +1/+1 counter on it. {TK}{TK}{TK} — Metalcraft — This permanent has protection from noncreature permanents as long as you control t… |

## enters|runtime-only(21件)

- **統べる CR**: CR 603.6e(ETB 誘発)
- **草稿帰属**: `runtime-FP`
- **根拠(草稿)**: runtime が enters を過剰検出している疑い(自己 ETB でない enters 言及)。研究との境界を要確認。
- **提案する修正(草稿)**: runtime etb/etb-other の発火条件を CR 603.6e に合わせ精密化(per-card 確認後)。

| oracleId | name | oracleText 抜粋 |
| --- | --- | --- |
| `4cfaa5cf-cc3d-49a7-9544-38a8bb7e9ec1` | Frontier Siege | As this enchantment enters, choose Khans or Dragons. • Khans — At the beginning of each of your main phases, add {G}{G}. • Dragons — Whenever a creature you control with flying ent… |
| `5eef3d70-ef16-4722-8c3d-21a0311597bd` | Jade Orb of Dragonkind | {T}: Add {G}. When you spend this mana to cast a Dragon creature spell, it enters with an additional +1/+1 counter on it and gains hexproof until your next turn. (It can't be the t… |
| `95d018f4-7f97-4b2c-abb4-cef69031caa1` | Dalek Drone | Flying, menace Exterminate! — When this creature enters, destroy target creature an opponent controls. That player loses 3 life. |
| `83f776d9-f3b6-40c2-8008-1ace4d110825` | Barret, Avalanche Leader | Reach Avalanche! — Whenever an Equipment you control enters, create a 2/2 red Rebel creature token. At the beginning of combat on your turn, attach up to one target Equipment you c… |
| `ddbacb74-1f98-4607-a92e-d14973b9d0ef` | Groundswell | Target creature gets +2/+2 until end of turn. Landfall — If you had a land enter the battlefield under your control this turn, that creature gets +4/+4 until end of turn instead. |
| `8419d1d5-bb0e-4a2d-bb6f-67957d035dde` | Thunder of Unity | (As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) I — You draw two cards and you lose 2 life. II, III — Whenever a creature you control enter… |
| `4900c157-8d9f-4f92-aaca-5246b6e2832e` | April O'Neil, Live on the Scene | Whenever a Mutant, Ninja, or Turtle you control enters, investigate. (Create a Clue token. It's an artifact with "{2}, Sacrifice this token: Draw a card.") Partner—Character select |
| `169cf74a-07bf-4841-83f3-904df8a0a39b` | Jailbreak | Return target permanent card in an opponent's graveyard to the battlefield under their control. When that permanent enters, return up to one target permanent card with equal or les… |
| `ed77fdf2-59c0-4310-9b12-80d28beeaeef` | Chocobo Camp | This land enters tapped unless you control a legendary creature. {T}: Add {G}. When you next cast a Bird creature spell this turn, it enters with an additional +1/+1 counter on it.… |
| `535f9bc6-9a07-4850-91eb-c00d06633e7e` | Coati Scavenger | Descend 4 — When this creature enters, if there are four or more permanent cards in your graveyard, return target permanent card from your graveyard to your hand. |
| `4469ff35-54ec-4ff5-bc19-3808ae0f711b` | Wildgrowth Archaic | Trample, reach Converge — This creature enters with a +1/+1 counter on it for each color of mana spent to cast it. Whenever you cast a creature spell, that creature enters with X a… |
| `1196a4cb-544c-4e7b-91cd-f0820b21a80d` | Lucy MacLean, Positively Armed | Golden Rule - Whenever a token enters, you may have target player other than its controller create a token that's a copy of it, then you draw a card if an opponent created a token… |
| `0d5bbde7-6f33-4708-b3ab-34d4528af649` | Magitek Scythe | A Test of Your Reflexes! — When this Equipment enters, you may attach it to target creature you control. If you do, that creature gains first strike until end of turn and must be b… |
| `74b08a70-b0bb-4340-98a0-b1d5b7c9d2cc` | Searing Blaze | Searing Blaze deals 1 damage to target player or planeswalker and 1 damage to target creature that player or that planeswalker's controller controls. Landfall — If you had a land e… |
| `80312910-5d53-44f1-9982-e46dc7532abb` | The Unbeatable Squirrel Girl | Do You Like Squirrels? — Whenever The Unbeatable Squirrel Girl enters or attacks, create a 1/1 green Squirrel creature token. I LOVE Squirrels! — {1}{G}{G}{G}: Create X 1/1 green S… |
| `7b513bd0-27df-45f3-a85f-1f0aba3cae48` | Council of Echoes | Flying Descend 4 — When this creature enters, if there are four or more permanent cards in your graveyard, return up to one target nonland permanent other than this creature to its… |
| `85dec6cf-6f27-4eb0-834b-5f6fbbe25fc8` | Spider-Man, To the Rescue | Flash Vigilance, reach No One Dies! — When Spider-Man enters, you may tap him. When you do, another target nonattacking creature you control gains indestructible until end of turn.… |
| `ba2bb276-b7ef-46ec-9618-2cf4d60c70a6` | Cool Fluffy Loxodon | {TK}{TK} — When this permanent leaves the battlefield, draw a card. {TK}{TK}{TK}{TK}{TK} — Whenever a creature enters under your control, this permanent becomes a 13/13 Eldrazi cre… |
| `41c0e1f1-8ebe-4cd2-96fe-e4bb625fe6ee` | Familiar Beeble Mascot | {TK}{TK} — Whenever this creature attacks, untap target permanent. {TK}{TK}{TK}{TK} — Whenever a creature enters under your control, creatures you control get +1/+1 until end of tu… |
| `c0a448ee-e5f9-4e57-85b0-f6d401018170` | Geek Lotus Warrior | {TK}{TK} — {2}: This creature gets +2/+0 until end of turn. {TK}{TK}{TK}{TK} — Whenever a creature enters under your control, this permanent deals 2 damage to target player. {TK}{T… |
| `a72927dc-b633-4830-be39-40674ed74ef3` | Werewolf Lightning Mage | {TK}{TK} — Landfall — Whenever a land enters under your control, put a +1/+1 counter on this permanent. {TK}{TK}{TK}{TK} — Whenever a creature blocks this creature, that creature g… |

## dies|research-only(15件)

- **統べる CR**: CR 700.4・603.2(複数主語「one or more ... die」)
- **草稿帰属**: `runtime-FN`
- **根拠(草稿)**: 「Whenever one or more other creatures die」型を runtime が取りこぼす疑い(研究は dies 族・iter2 で複数形を閉鎖済み。Morbid Opportunist 等)。
- **提案する修正(草稿)**: runtime death-other 検出を複数形「one or more (other) creatures die」へ拡張(per-card 確認後)。

| oracleId | name | oracleText 抜粋 |
| --- | --- | --- |
| `322f44f0-e6da-4ee0-b474-e7d5e9a461c5` | Morbid Opportunist | Whenever one or more other creatures die, draw a card. This ability triggers only once each turn. |
| `ba26ff0a-e714-44f2-95cf-1a5a6088edf9` | The Skullspore Nexus | This spell costs {X} less to cast, where X is the greatest power among creatures you control. Whenever one or more nontoken creatures you control die, create a green Fungus Dinosau… |
| `fde2653f-5270-4b8f-9642-0835dbb076c2` | Spiteful Banditry | When this enchantment enters, it deals X damage to each creature. Whenever one or more creatures your opponents control die, you create a Treasure token. This ability triggers only… |
| `aefea339-8a0d-4531-8a62-afaecc88d078` | Scavenger's Talent | (Gain the next level as a sorcery to add its ability.) Whenever one or more creatures you control die, create a Food token. This ability triggers only once each turn. {1}{B}: Level… |
| `b2f2645f-5f74-456a-bd02-83169d8b8a7e` | Vraan, Executioner Thane | Whenever one or more other creatures you control die, each opponent loses 2 life and you gain 2 life. This ability triggers only once each turn. |
| `3db40361-5f55-417e-a7cd-7e360cc91b4d` | Chainsaw | When this Equipment enters, it deals 3 damage to up to one target creature. Whenever one or more creatures die, put a rev counter on this Equipment. Equipped creature gets +X/+0, w… |
| `39e20898-cf01-48dc-8972-7ac500c3fa79` | Ghoulish Procession | Whenever one or more nontoken creatures die, create a 2/2 black Zombie creature token with decayed. This ability triggers only once each turn. (A creature with decayed can't block.… |
| `b2d95950-18b3-463f-94f4-299e420751dc` | Éomer, Marshal of Rohan | Haste Whenever one or more other attacking legendary creatures you control die, untap all creatures you control. After this phase, there is an additional combat phase. This ability… |
| `b2f9e07b-64b7-40b3-9a5e-5f1d59b35af7` | Thopter Shop | Whenever one or more artifact creatures you control die, draw a card. This ability triggers only once each turn. {2}{W}, {T}: Create a 1/1 colorless Thopter artifact creature token… |
| `0c4603be-d71a-4d33-b62c-04ead1987dbe` | G'raha Tia | Reach The Allagan Eye — Whenever one or more other creatures and/or artifacts you control die, draw a card. This ability triggers only once each turn. |
| `dc4d5602-47cb-47c8-8a43-3b840e12b79c` | Homicide Investigator | Whenever one or more nontoken creatures you control die, investigate. This ability triggers only once each turn. (Create a Clue token. It's an artifact with "{2}, Sacrifice this to… |
| `47b29cf9-8ef3-4b6a-a9a3-3ab822c5dea4` | Rinoa, Angel Wing | At the beginning of combat on your turn, creatures you control with flying get +1/+1 and gain vigilance until end of turn. Whenever one or more attacking creatures you control die,… |
| `aa929252-5dcc-4c9b-9e7c-61d0bef98d6d` | Blood Spatter Analysis | When this enchantment enters, it deals 3 damage to target creature an opponent controls. Whenever one or more creatures die, mill a card and put a bloodstain counter on this enchan… |
| `c649d5ae-2f38-4737-8123-8069a2ba0bde` | Vengeful Townsfolk | Whenever one or more other creatures you control die, put a +1/+1 counter on this creature. |
| `8a4d505e-b884-4b8b-93d5-495992f3858e` | Sengir Connoisseur | Flying Whenever one or more other creatures die, put a +1/+1 counter on this creature. This ability triggers only once each turn. |

## leaves|runtime-only(15件)

- **統べる CR**: CR 603.6c(leaves-the-battlefield 誘発)・700.4
- **草稿帰属**: `undecided`
- **根拠(草稿)**: runtime は trigger.leaves を持つが研究 leaves が未検出の対。新設 trigger.leaves の境界差(延長誘発の構文粒度差=許容差 候補)か研究 FN かを per-card で弁別する。
- **提案する修正(草稿)**: 研究 leaves と runtime trigger.leaves の境界を突合し、粒度差なら allowance(CR 引用付き)・取りこぼしなら研究側を拡張。

| oracleId | name | oracleText 抜粋 |
| --- | --- | --- |
| `18bdc181-9592-4147-81fb-7f83ce137f70` | Ugin, the Ineffable | Colorless spells you cast cost {2} less to cast. +1: Exile the top card of your library face down and look at it. Create a 2/2 colorless Spirit creature token. When that token leav… |
| `2ffb38ec-5852-4e91-85a5-cfccd1f23556` | Tarrian's Soulcleaver | Equipped creature has vigilance. Whenever another artifact or creature is put into a graveyard from the battlefield, put a +1/+1 counter on equipped creature. Equip {2} |
| `ebb24fc7-dc71-4712-8c2a-b5920f78e55d` | Outpost Siege | As this enchantment enters, choose Khans or Dragons. • Khans — At the beginning of your upkeep, exile the top card of your library. Until end of turn, you may play that card. • Dra… |
| `10c31317-71e8-42e0-85e0-3e64bd0c3dd3` | Vat of Rebirth | Whenever another artifact or creature you control is put into a graveyard from the battlefield, put an oil counter on this artifact. {2}{B}, {T}, Remove four oil counters from this… |
| `f1eb489d-104c-4801-b6d2-3f1a7ee73a75` | Mechtitan Core | {5}, Exile this Vehicle and four other artifact creatures and/or Vehicles you control: Create Mechtitan, a legendary 10/10 Construct artifact creature token with flying, vigilance,… |
| `6cd03270-54cc-43e1-9b86-70c76960c841` | Wernog, Rider's Chaplain | When Wernog, Rider's Chaplain enters or leaves the battlefield, each opponent may investigate. Each opponent who doesn't loses 1 life. You investigate X times, where X is one plus… |
| `94d5c904-6504-4df2-b242-daf88a988475` | The Pandorica | You may choose not to untap The Pandorica during your untap step. {1}{W}, {T}: Untap another target nonland permanent, then it phases out. It can't phase in for as long as The Pand… |
| `40f664d8-4c73-44aa-8fb1-d38771a42520` | Mysterio, Master of Illusion | When Mysterio enters, create a 3/3 blue Illusion Villain creature token for each nontoken Villain you control. Exile those tokens when Mysterio leaves the battlefield. |
| `b2bdccf1-857b-48f8-a9aa-8ef999ef0632` | Seer of Stolen Sight | Menace (This creature can't be blocked except by two or more creatures.) Whenever one or more artifacts and/or creatures you control are put into a graveyard from the battlefield,… |
| `739eac91-3029-4ce7-9885-0af3ddea472e` | Stangg | When Stangg enters, create Stangg Twin, a legendary 3/4 red and green Human Warrior creature token. Exile that token when Stangg leaves the battlefield. Sacrifice Stangg when that… |
| `ba2bb276-b7ef-46ec-9618-2cf4d60c70a6` | Cool Fluffy Loxodon | {TK}{TK} — When this permanent leaves the battlefield, draw a card. {TK}{TK}{TK}{TK}{TK} — Whenever a creature enters under your control, this permanent becomes a 13/13 Eldrazi cre… |
| `43f5ce56-6ad1-4a42-b1d7-26f1c7933693` | Deep-Fried Plague Myr | {TK}{TK} — Whenever this creature attacks, scry 1. {TK}{TK}{TK} — Whenever this permanent leaves the battlefield, you may destroy target artifact or enchantment. {TK}{TK}{TK} — 4/5… |
| `26f6170a-34dc-41c8-b3b1-20377f131e6e` | Giant Mana Cake | {TK}{TK} — When this permanent leaves the battlefield, create two Food tokens. (They're artifacts with "{2}, {T}, Sacrifice this artifact: You gain 3 life.") {TK}{TK}{TK}{TK} — Whe… |
| `7cad08c1-4bd9-4d9f-85d2-fb3ab718fbb8` | Goblin Coward Parade | {TK}{TK} — Mentor (Whenever this creature attacks, put a +1/+1 counter on target attacking creature with lesser power.) {TK}{TK}{TK} — When this permanent leaves the battlefield, y… |
| `4c02ee30-8681-45ed-adb5-edf06409eee4` | Yawgmoth Merfolk Soul | {TK}{TK} — When this permanent leaves the battlefield, target player discards a card. {TK}{TK}{TK}{TK}{TK} — When this permanent leaves the battlefield, create five 1/1 white Clown… |

## attacks|research-only(6件)

- **統べる CR**: CR 508・802(攻撃される=is attacked)
- **草稿帰属**: `runtime-FN`
- **根拠(草稿)**: 「Whenever enchanted player is attacked」型(Curse 系)を runtime が取りこぼす疑い(研究は受動 is-attacked を attacks 族へ・Curse of Opulence 等)。
- **提案する修正(草稿)**: runtime attack 検出を受動「is attacked」へ拡張(per-card 確認後)。

| oracleId | name | oracleText 抜粋 |
| --- | --- | --- |
| `ba0d3df2-3acf-46d7-8d64-8d67d1579adc` | Curse of Opulence | Enchant player Whenever enchanted player is attacked, create a Gold token. Each opponent attacking that player does the same. (A Gold token is an artifact with "Sacrifice this toke… |
| `c6f76fa7-095e-4bfe-a38c-5c4531880880` | Curse of Verbosity | Enchant player Whenever enchanted player is attacked, you draw a card. Each opponent attacking that player does the same. |
| `6cbd36d9-de47-41b0-9ef4-a72ca01adccd` | Curse of Disturbance | Enchant player Whenever enchanted player is attacked, create a 2/2 black Zombie creature token. Each opponent attacking that player does the same. |
| `c2008ba9-00df-4607-ba0c-189af52033eb` | Mr. Foxglove | Lifelink Whenever Mr. Foxglove attacks, draw cards equal to the number of cards in defending player's hand minus the number of cards in your hand. If you didn't draw cards this way… |
| `b6689782-08d8-48e1-a05d-cd040dfe85bc` | Curse of Bounty | Enchant player Whenever enchanted player is attacked, untap all nonland permanents you control. Each opponent attacking that player untaps all nonland permanents they control. |
| `8df7a58c-053f-4ead-a778-2747718e5f10` | Party Dude | (Gain the next level as a sorcery to add its ability.) When this Class enters, each player creates a Food token. {1}{G}: Level 2 Whenever an artifact an opponent controls is put in… |

## draw|research-only(1件)

- **統べる CR**: CR 603.2・120(draw)
- **草稿帰属**: `undecided`
- **根拠(草稿)**: 単発(Trouble in Pairs)。複合誘発の draw 条件の取りこぼし候補。per-card 確認。
- **提案する修正(草稿)**: oracleText を精査し研究/runtime いずれの境界かを裁定。

| oracleId | name | oracleText 抜粋 |
| --- | --- | --- |
| `f349f58b-8cc8-45e4-9565-2b46fdf976c9` | Trouble in Pairs | If an opponent would begin an extra turn, that player skips that turn instead. Whenever an opponent attacks you with two or more creatures, draws their second card each turn, or ca… |

## draw|runtime-only(1件)

- **統べる CR**: CR 603.2・120(draw)
- **草稿帰属**: `undecided`
- **根拠(草稿)**: 単発(Starving Revenant)。runtime の draw 誘発過剰 or 研究取りこぼし候補。per-card 確認。
- **提案する修正(草稿)**: oracleText を精査し裁定。

| oracleId | name | oracleText 抜粋 |
| --- | --- | --- |
| `2ca969eb-3d79-4d1f-8d9d-7b8204ad166a` | Starving Revenant | When this creature enters, surveil 2. Then for each card you put on top of your library, you draw a card and you lose 3 life. Descend 8 — Whenever you draw a card, if there are eig… |
