# Parity 和解ワークシート（草稿・判定なし）

> Codex による Fable 裁定用の草稿。どちらの分類器が正しいかは確定せず、分類器も変更しない。

## 入力と分類方法

- parity report: `research/classifier-parity/report.json`
- Scryfall snapshot: `research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json`
- report generated: 2026-06-24T11:23:57.801Z
- report mismatch cards: 225
- snapshot join failures: 0
- mismatch comparison records represented: 233
- 一意配属規則: 各カードを report 内の先頭 mismatch へ1回だけ配属する。draw の両方向は mixed 1クラスタへ統合する。複数族カードの全 mismatch key は各行へ残す。

## クラスタ一覧

| Cluster | Assigned cards | Draft attribution | Governing CR |
| --- | ---: | --- | --- |
| cast\|runtime-only | 70 | `granularity-allowance` | CR 603.1: “Triggered abilities have a trigger condition and an effect.” CR 601.2i: casting完了後に cast 誘発が誘発する。 |
| enters\|research-only | 36 | `runtime-FN` | CR 603.6a: ETB能力は “When [this object] enters” / “Whenever a [type] enters” と書かれ、各 entry event に一致する誘発を確認する。 |
| dies\|runtime-only | 33 | `research-FN` | CR 700.4: dies は “is put into a graveyard from the battlefield”。CR 603.7: 解決中に作られる delayed trigger も when/whenever/at を含む。 |
| attacks\|runtime-only | 29 | `research-FN` | CR 508.1m: attacker 宣言で該当能力が誘発する。CR 508.3a–d: “attacks” / “is attacked” / player attacks の各条件を定義する。 |
| enters\|runtime-only | 21 | `granularity-allowance` | CR 603.6a が ETB誘発を定義する一方、CR 603.6d は “enters with/as/tapped” を triggered ability ではなく static ability とする。 |
| dies\|research-only | 15 | `runtime-FN` | CR 700.4 が dies を定義し、CR 603.2c は一つの event に複数 occurrence がある場合の反復誘発を認める。 |
| leaves\|runtime-only | 13 | `research-FN` | CR 603.6c が leaves-the-battlefield trigger と “from anywhere” の非該当を定義し、CR 603.10a が leaves trigger の look-back を定める。 |
| attacks\|research-only | 6 | `runtime-FN` | CR 508.3b: “Whenever [a player/permanent] is attacked” は attacker 宣言で誘発する。CR 508.3d は “Whenever [a player] attacks” を定義する。 |
| draw\|mixed | 2 | `granularity-allowance` | CR 121.1 が draw を定義し、CR 121.5 は “draw” を使わない hand 移動を draw でないとする。CR 603.1 は trigger condition を要求する。 |

## cast|runtime-only (70 cards)

- Governing CR: CR 603.1: “Triggered abilities have a trigger condition and an effect.” CR 601.2i: casting完了後に cast 誘発が誘発する。
- Draft attribution: `granularity-allowance`
- Rationale: 真の埋め込み/遅延 cast 誘発（“When you next cast ...”）と、別誘発の効果や mana-spent 条件内に cast が現れるだけのカードが混在する。族の有無だけでは単一帰属にできない。
- Proposed fix (not applied): 裁定後、runtime の cast 検出を構文解析済み trigger condition と単なる効果/参照文へ分離し、research は bullet・threshold・埋め込み遅延誘発の接頭辞を認識する。

| Oracle ID | Name | All mismatch keys | Relevant Oracle text |
| --- | --- | --- | --- |
| `b473e293-59e3-4e04-acf2-622604aeb25f` | Path of Ancestry | cast\|runtime-only | {T}: Add one mana of any color in your commander's color identity. When that mana is spent to cast a creature spell that shares a creature type with your commander, scry 1. (Look at the top card of your library. You may put that card on the bottom.) |
| `5e060d58-4d6e-425c-b7d4-727669fcce5b` | Buster Sword | cast\|runtime-only | Whenever equipped creature deals combat damage to a player, draw a card, then you may cast a spell from your hand with mana value less than or equal to that damage without paying its mana cost. |
| `e1c9783a-1d1b-40d7-872e-0ca11b229ce6` | Uthros Research Craft | cast\|runtime-only | 3+ \| Whenever you cast an artifact spell, draw a card. Put a charge counter on this Spacecraft. |
| `88d0a394-79e2-42ac-9a37-1a7b78231941` | Thunderclap Drake | cast\|runtime-only | Instant and sorcery spells you cast cost {1} less to cast. / {2}{U}, Sacrifice this creature: When you next cast an instant or sorcery spell this turn, copy it for each time you've cast your commander from the command zone this game. You may choose new targets for the copies. |
| `3509171e-8d7d-4e9e-97a1-58e6c7d225ed` | Summon: Fenrir | cast\|runtime-only | II — Heavenward Howl — When you next cast a creature spell this turn, that creature enters with an additional +1/+1 counter on it. |
| `674e2683-31c0-4fee-95fb-98b1201e41e7` | Mirrodin Besieged | cast\|runtime-only | • Mirran — Whenever you cast an artifact spell, create a 1/1 colorless Myr artifact creature token. |
| `7bc4c7e2-6758-4a85-84e7-03ab93981106` | Tinybones, the Pickpocket | cast\|runtime-only | Whenever Tinybones deals combat damage to a player, you may cast target nonland permanent card from that player's graveyard, and mana of any type can be spent to cast that spell. |
| `93989dd7-2d3e-46e2-8e92-8d0479796087` | Twinferno | cast\|runtime-only | • When you cast your next instant or sorcery spell this turn, copy that spell. You may choose new targets for the copy. |
| `f76bcbfe-483f-4e63-8425-76feca1abf3e` | Pyromancer's Goggles | cast\|runtime-only | {T}: Add {R}. When that mana is spent to cast a red instant or sorcery spell, copy that spell and you may choose new targets for the copy. |
| `1718a442-b878-4690-b608-a013de3d79fc` | Light-Paws, Emperor's Voice | cast\|runtime-only | Whenever an Aura you control enters, if you cast it, you may search your library for an Aura card with mana value less than or equal to that Aura and with a different name than each Aura you control, put that card onto the battlefield attached to Light-Paws, then shuffle. |
| `13b96709-0e88-476b-9485-956e682bb818` | Scaled Nurturer | cast\|runtime-only | {T}: Add {G}. When you spend this mana to cast a Dragon creature spell, you gain 2 life. |
| `ba72d4a9-6f36-4796-bd71-2342fa9b4a30` | Yuna, Grand Summoner | cast\|runtime-only | Grand Summon — {T}: Add one mana of any color. When you next cast a creature spell this turn, that creature enters with two additional +1/+1 counters on it. |
| `c098c507-5154-423a-a70b-f6dfd4959cf6` | Sunken Palace | cast\|runtime-only | {1}{U}, {T}, Exile seven cards from your graveyard: Add {U}. When you spend this mana to cast a spell or activate an ability, copy that spell or ability. You may choose new targets for the copy. (Mana abilities can't be copied.) |
| `40ab2b22-9cf6-4a73-a05f-6ce496d10bf7` | Bonus Round | cast\|runtime-only | Until end of turn, whenever a player casts an instant or sorcery spell, that player copies it and may choose new targets for the copy. |
| `e8e2f273-5e74-4f16-8d49-2e86e9c9f2dc` | Solar Array | cast\|runtime-only | {T}: Add one mana of any color. When you next cast an artifact spell this turn, that spell gains sunburst. (If it's a creature, it enters with a +1/+1 counter on it for each color of mana spent to cast it. Otherwise, it enters with that many charge counters on it.) |
| `2148820c-85b6-4598-adf2-10873001a779` | Summon: Good King Mog XII | cast\|runtime-only | II, III — Whenever you cast a noncreature spell this turn, create a token that's a copy of a non-Saga token you control. |
| `295a831c-490e-42ba-afc1-dab3524a4f0c` | Glacierwood Siege | cast\|runtime-only | • Temur — Whenever you cast an instant or sorcery spell, target player mills four cards. |
| `52826984-44cb-48dc-a737-bb02983ffea8` | Glamdring | cast\|runtime-only | Whenever equipped creature deals combat damage to a player, you may cast an instant or sorcery spell from your hand with mana value less than or equal to that damage without paying its mana cost. |
| `5fe29c25-a7ad-4c79-a5a5-da1bbc832141` | Season of the Bold | cast\|runtime-only | {P}{P}{P} — Until the end of your next turn, whenever you cast a spell, Season of the Bold deals 2 damage to up to one target creature. |
| `c61ab8e1-ef23-465d-bcd3-f771434988b2` | Lapis Orb of Dragonkind | cast\|runtime-only | {T}: Add {U}. When you spend this mana to cast a Dragon creature spell, scry 2. (Look at the top two cards of your library, then put any number of them on the bottom and the rest on top in any order.) |
| `ac50ef98-1791-4dd4-9c1f-8cea7db7ade5` | Maelstrom Archangel | cast\|runtime-only | Whenever this creature deals combat damage to a player, you may cast a spell from your hand without paying its mana cost. |
| `ae9f5c80-bc96-4ab3-bb5b-e8bd470e9eab` | Magus Lucea Kane | cast\|runtime-only | Psychic Stimulus — {T}: Add {C}{C}. When you next cast a spell with {X} in its mana cost or activate an ability with {X} in its activation cost this turn, copy that spell or ability. You may choose new targets for the copy. (A copy of a permanent spell becomes a token.) |
| `32476743-c9d4-49ca-bec2-0669c215841b` | Anrakyr the Traveller | cast\|runtime-only | Lord of the Pyrrhian Legions — Whenever Anrakyr the Traveller attacks, you may cast an artifact spell from your hand or graveyard by paying life equal to its mana value rather than paying its mana cost. |
| `7fb88a5d-9b72-4da9-ade4-d09cadd7e1cb` | Nuka-Nuke Launcher | cast\|runtime-only | Whenever equipped creature attacks, until the end of defending player's next turn, that player gets two rad counters whenever they cast a spell. |
| `cbd483b5-5554-43ed-a729-535d01b0d5d3` | Jace Reawakened | cast\|runtime-only | You can't cast Jace Reawakened during your first, second, or third turns of the game. / −6: Until end of turn, whenever you cast a spell, copy it. You may choose new targets for the copy. |
| `e83a629e-2d74-48e2-ad4d-f390067cc51a` | Transcendent Dragon | cast\|runtime-only | When this creature enters, if you cast it, counter target spell. If that spell is countered this way, exile it instead of putting it into its owner's graveyard, then you may cast it without paying its mana cost. |
| `6107f9aa-3373-4166-b4b8-a26fd6d69c72` | Showdown of the Skalds | cast\|runtime-only | II, III — Whenever you cast a spell this turn, put a +1/+1 counter on target creature you control. |
| `fcc7ed01-ff64-4ffe-9b83-daa4132fd92d` | Commander Liara Portyr | cast\|runtime-only | Whenever you attack, spells you cast from exile this turn cost {X} less to cast, where X is the number of players being attacked. Exile the top X cards of your library. Until end of turn, you may cast spells from among those exiled cards. |
| `4c05b382-58ab-4a2d-a81c-408ea273b6b6` | Dreadhorde Arcanist | cast\|runtime-only | Whenever this creature attacks, you may cast target instant or sorcery card with mana value less than or equal to this creature's power from your graveyard without paying its mana cost. If that spell would be put into your graveyard, exile it instead. |
| `b6b22bac-853a-45a8-a74d-9904ec2b34fd` | Summon: G.F. Cerberus | cast\|runtime-only | II — Double — When you next cast an instant or sorcery spell this turn, copy it. You may choose new targets for the copy. / III — Triple — When you next cast an instant or sorcery spell this turn, copy it twice. You may choose new targets for the copies. |
| `ed7ba558-5341-4c7b-a9c5-b382dee88a13` | Crackling Spellslinger | cast\|runtime-only | When this creature enters, if you cast it, the next instant or sorcery spell you cast this turn has storm. (When you cast that spell, copy it for each spell cast before it this turn. You may choose new targets for the copies.) |
| `bab5e9ce-6d55-4d1e-a9ac-c2b954191be9` | Summon: Brynhildr | cast\|runtime-only | II, III — Gestalt Mode — When you next cast a creature spell this turn, it gains haste until end of turn. |
| `8933297c-62f1-4df9-91b8-2d3481db77e5` | Spider-Man India | cast\|runtime-only | Web-slinging {1}{G}{W} (You may cast this spell for {1}{G}{W} if you also return a tapped creature you control to its owner's hand.) / Pavitr's Sevā — Whenever you cast a creature spell, put a +1/+1 counter on target creature you control. It gains flying until end of turn. |
| `118da256-d1ea-44e8-9026-317e49694d29` | Forger's Foundry | cast\|runtime-only | {T}: Add {U}. When you spend this mana to cast an instant or sorcery spell with mana value 3 or less, you may exile that spell instead of putting it into its owner's graveyard as it resolves. / {3}{U}{U}, {T}: You may cast any number of spells from among cards exiled with this artifact without paying their mana costs. Activate only as a sorcery. |
| `494dc919-e429-491b-b19b-5037499e2dd6` | Bygone Marvels | cast\|runtime-only | Descend 8 — When you cast this spell, if there are eight or more permanent cards in your graveyard, copy this spell twice. You may choose new targets for the copies. |
| `821e8648-222c-4b33-a8bd-e8bfff7dcd9e` | Quistis Trepe | cast\|runtime-only | Blue Magic — When Quistis Trepe enters, you may cast target instant or sorcery card from a graveyard, and mana of any type can be spent to cast that spell. If that spell would be put into a graveyard, exile it instead. |
| `bbdb731d-c533-48ef-b82a-cf1a8ba36208` | The Sibsig Ceremony | cast\|runtime-only | Creature spells you cast cost {2} less to cast. / Whenever a creature you control enters, if you cast it, destroy that creature, then create a 2/2 black Zombie Druid creature token. |
| `a3e10b9b-9349-4b44-a46c-c825293dbd05` | The Dawning Archaic | cast\|runtime-only | This spell costs {1} less to cast for each instant and sorcery card in your graveyard. / Whenever The Dawning Archaic attacks, you may cast target instant or sorcery card from your graveyard without paying its mana cost. If that spell would be put into your graveyard, exile it instead. |
| `14c2c818-0ce2-4809-a5ff-ee4a6253defa` | Oskar, Rubbish Reclaimer | cast\|runtime-only | This spell costs {1} less to cast for each different mana value among cards in your graveyard. / Whenever you discard a nonland card, you may cast it from your graveyard. |
| `f74d8f53-a239-4641-90f1-bf786d57e253` | Brass Infiniscope | cast\|runtime-only | {T}: Add {C}{C}. When you next cast a spell with {X} in its mana cost this turn, you draw a card and gain half X life, rounded down. |
| `7849426d-895d-4dfe-a94d-b8df634618a5` | Apple of Eden, Isu Relic | cast\|runtime-only | {T}, Pay 4 life, Sacrifice Apple of Eden: Look at target opponent's hand and exile those cards face down. You may play those cards this turn, and mana of any type can be spent to cast them. Until end of turn, whenever you play a land or cast a spell this way, its owner draws a card. At the beginning of the next end step, return the exiled cards to their owner's hand. Activate only as a sorcery. |
| `2158c73d-421b-4c94-af06-dd89cb8d3126` | Jeong Jeong, the Deserter | cast\|runtime-only | Exhaust — {3}: Put a +1/+1 counter on Jeong Jeong. When you next cast a Lesson spell this turn, copy it and you may choose new targets for the copy. (Activate each exhaust ability only once.) |
| `3ec7ae18-b203-49bd-95f9-ad5482459a23` | Mirror of Life Trapping | cast\|runtime-only | Whenever a creature enters, if it was cast, exile it, then return all other permanent cards exiled with this artifact to the battlefield under their owners' control. |
| `67a9357c-4713-4e01-a60d-532bf0dd80b6` | Codie, Vociferous Codex | cast\|runtime-only | You can't cast permanent spells. / {4}, {T}: Add {W}{U}{B}{R}{G}. When you next cast a spell this turn, exile cards from the top of your library until you exile an instant or sorcery card with lesser mana value. Until end of turn, you may cast that card without paying its mana cost. Put each other card exiled this way on the bottom of your library in a random order. |
| `2a7504b9-220d-412e-9381-b6a8a3750241` | Najal, the Storm Runner | cast\|runtime-only | You may cast sorcery spells as though they had flash. / Whenever Najal attacks, you may pay {2}. If you do, when you next cast an instant or sorcery spell this turn, copy it. You may choose new targets for the copy. |
| `30c0df75-9822-4016-a52b-d2e69dd58124` | Galea, Kindler of Hope | cast\|runtime-only | You may cast Aura and Equipment spells from the top of your library. When you cast an Equipment spell this way, it gains "When this Equipment enters, attach it to target creature you control." |
| `aba60536-ffbd-480c-8e8f-9639bdc53d4b` | Spectral Arcanist | cast\|runtime-only | When this creature enters, you may cast an instant or sorcery spell with mana value less than or equal to the number of Spirits you control from a graveyard without paying its mana cost. If that spell would be put into a graveyard, exile it instead. |
| `c33e99c6-189e-4dcf-8b6a-64937dbad361` | Rimefire Torque | cast\|runtime-only | {T}, Remove three charge counters from this artifact: When you next cast an instant or sorcery spell this turn, copy it. You may choose new targets for the copy. |
| `0c85a577-db82-4a36-bc42-49644eba1cf2` | Zevlor, Elturel Exile | cast\|runtime-only | {2}, {T}: When you next cast an instant or sorcery spell that targets only a single opponent or a single permanent an opponent controls this turn, for each other opponent, choose that player or a permanent they control, copy that spell, and the copy targets the chosen player or permanent. |
| `158a6225-a246-4fd6-aa57-0df8067b4383` | Lutri, the Spellchaser | cast\|runtime-only | When Lutri enters, if you cast it, copy target instant or sorcery spell you control. You may choose new targets for the copy. |
| `5193172c-9024-409e-bd9e-0387971d65fe` | Boiling Rock Rioter | cast\|runtime-only | Whenever this creature attacks, you may cast an Ally spell from among cards you own exiled with this creature. |
| `cb4f65b0-2841-42bf-8e18-d04a3b9f1a76` | Epistolary Librarian | cast\|runtime-only | Veil of Time — Whenever this creature attacks, you may cast a spell with mana value X or less from your hand without paying its mana cost, where X is the number of attacking creatures. |
| `01376449-5cd2-4079-8aaa-5128634ef20b` | Long List of the Ents | cast\|runtime-only | I, II, III, IV, V, VI — Note a creature type that hasn't been noted for this Saga. When you next cast a creature spell of that type this turn, that creature enters with an additional +1/+1 counter on it. |
| `9a6bf8a3-7640-4890-ac62-d5028f41978b` | Rhino, Barreling Brute | cast\|runtime-only | Whenever Rhino attacks, if you've cast a spell with mana value 4 or greater this turn, draw a card. |
| `566533af-5e67-463f-ac33-dfcf1ec735c9` | Ether | cast\|runtime-only | {T}, Exile this artifact: Add {U}. When you next cast an instant or sorcery spell this turn, copy that spell. You may choose new targets for the copy. |
| `ca59fbf4-c774-49d3-8630-108c053e01fb` | Whispersteel Dagger | cast\|runtime-only | Whenever equipped creature deals combat damage to a player, you may cast a creature spell from that player's graveyard this turn, and you may spend mana as though it were mana of any color to cast that spell. |
| `eae3e762-dacd-4bd2-923c-3abb5ceb729a` | Aisha of Sparks and Smoke | cast\|runtime-only | Prowess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.) / Whenever Aisha deals combat damage, you may cast a sorcery spell from your hand with mana value less than or equal to that damage without paying its mana cost. |
| `c3a46eb3-38d9-4f47-9b71-26c9ea7ef1ce` | The Dragon-Kami Reborn // Dragon-Kami's Egg | cast\|runtime-only | Whenever this creature or a Dragon you control dies, you may cast a creature spell from among cards you own in exile with hatching counters on them without paying its mana cost. |
| `d49c94fa-712a-47c0-b571-4db7e064a590` | Ride the Avalanche | cast\|runtime-only | The next spell you cast this turn can be cast as though it had flash. When you next cast a spell this turn, put X +1/+1 counters on up to one target creature, where X is the mana value of that spell. |
| `bd7111bc-9b8f-4c4b-b61c-7841a857ce6b` | Cherished Hatchling | cast\|runtime-only | When this creature dies, you may cast Dinosaur spells this turn as though they had flash, and whenever you cast a Dinosaur spell this turn, it gains "When this creature enters, you may have it fight another target creature." |
| `0403bfb0-2174-4360-994d-68d8ca96fc55` | Nightmares and Daydreams | cast\|runtime-only | I, II, III — Until your next turn, whenever you cast an instant or sorcery spell, target player mills cards equal to that spell's mana value. |
| `e7b746c8-1b32-42ed-8328-4e16274209d8` | Kylox's Voltstrider | cast\|runtime-only | Whenever this Vehicle attacks, you may cast an instant or sorcery spell from among cards exiled with it. If that spell would be put into a graveyard, put it on the bottom of its owner's library instead. |
| `72a9a85d-7cfc-4b3c-82db-9d35be6c0982` | Bilbo, Thief in the Night | cast\|runtime-only | Spells you cast from anywhere other than your hand cost {1} less to cast. / Whenever Bilbo attacks, you may cast an artifact, instant, or sorcery spell from your graveyard. If an instant or sorcery spell cast this way would be put into your graveyard, exile it instead. |
| `f2a6dc8d-3c98-44ae-aff0-b838d7aee0b7` | Sandstalker Moloch | cast\|runtime-only | When this creature enters, if an opponent cast a blue and/or black spell this turn, look at the top four cards of your library. You may reveal a permanent card from among them and put it into your hand. Put the rest on the bottom of your library in a random order. |
| `fdd4b3a9-83ce-41bf-82e2-7808657e2c09` | Transcendent Archaic | cast\|runtime-only | Converge — When this creature enters, you may draw X cards, where X is the number of colors of mana spent to cast this spell. If you draw one or more cards this way, discard two cards. |
| `657c5473-f153-4dd2-94a0-d477cbc2451d` | Helmut Zemo, Mastermind | cast\|runtime-only | Whenever Helmut Zemo attacks, you may cast target instant or sorcery card with mana value less than or equal to his power from your graveyard. If that spell would be put into your graveyard, exile it instead. If you cast a spell this way, put a +1/+1 counter on Helmut Zemo. |
| `9c78778a-6335-4949-8ade-11d0f085cb2b` | Loki Laufeyson | cast\|runtime-only | {1}, {T}: When you next cast an instant or sorcery spell with mana value less than or equal to Loki's power this turn, copy that spell. You may choose new targets for the copy. |
| `658252ed-7f52-4a31-834b-c39cee1d5e00` | Misunderstood Trapeze Elf | cast\|runtime-only | {TK}{TK} — Whenever you cast a spell, this creature gets +X/+X until end of turn, where X is the amount of generic mana in that spell's mana cost. |
| `3e5ac76b-08bd-4232-9290-49742b0ff603` | Snazzy Aether Homunculus | cast\|runtime-only | {TK}{TK}{TK} — Magecraft — Whenever you cast or copy an instant or sorcery spell, draw a card. |
| `2c925531-63f8-4a6b-bfe0-bb8cd5d0d63d` | Weird Angel Flame | cast\|runtime-only | {TK}{TK} — Heroic — Whenever you cast a spell that targets this permanent, put two +1/+1 counters on it. |

## enters|research-only (36 cards)

- Governing CR: CR 603.6a: ETB能力は “When [this object] enters” / “Whenever a [type] enters” と書かれ、各 entry event に一致する誘発を確認する。
- Draft attribution: `runtime-FN`
- Rationale: 代表文は “one or more tokens ... enter”、 “other Elves ... enter”、 “enter or attack” など有効な watcher 条件。runtime が複数主語・修飾語・列挙条件を狭く扱っている候補。
- Proposed fix (not applied): runtime ETB の trigger condition を構造的に解析し、複数形・修飾付き watcher・列挙条件を追加する。CR 603.6d の static “enters with/as/tapped” は除外する。

| Oracle ID | Name | All mismatch keys | Relevant Oracle text |
| --- | --- | --- | --- |
| `605c1ee0-5e8a-4e0a-a99b-42a38873f822` | Welcoming Vampire | enters\|research-only | Whenever one or more other creatures you control with power 2 or less enter, draw a card. This ability triggers only once each turn. |
| `c97957a2-8310-4cff-8aad-871b7901d124` | Caretaker's Talent | enters\|research-only | Whenever one or more tokens you control enter, draw a card. This ability triggers only once each turn. |
| `98a389f4-2905-47f3-b60e-3d4afb3e5cb0` | Enduring Innocence | enters\|research-only | Whenever one or more other creatures you control with power 2 or less enter, draw a card. This ability triggers only once each turn. |
| `25c983e0-a8c9-4784-91a4-8fe04c6df882` | Tocasia's Welcome | enters\|research-only | Whenever one or more creatures you control with mana value 3 or less enter, draw a card. This ability triggers only once each turn. |
| `619e0686-e88c-4238-8364-75395e733533` | Kambal, Profiteering Mayor | enters\|research-only | Whenever one or more tokens your opponents control enter, for each of them, create a tapped token that's a copy of it. This ability triggers only once each turn. / Whenever one or more tokens you control enter, each opponent loses 1 life and you gain 1 life. |
| `f8c2a972-e38f-47e5-a355-6f30ad09b1ae` | Losheel, Clockwork Scholar | enters\|research-only | Whenever one or more artifact creatures you control enter, draw a card. This ability triggers only once each turn. |
| `bda83ef4-e345-495d-878c-4da171f997ba` | Elvish Warmaster | enters\|research-only | Whenever one or more other Elves you control enter, create a 1/1 green Elf Warrior creature token. This ability triggers only once each turn. |
| `752c7723-90f8-4e3a-8266-f251ee0dadd8` | Ingenious Artillerist | enters\|research-only | Whenever one or more artifacts you control enter, this creature deals that much damage to each opponent. |
| `7555c429-5f2d-4171-b6b0-8e3c8da7f314` | Satoru, the Infiltrator | enters\|research-only | Whenever Satoru and/or one or more other nontoken creatures you control enter, if none of them were cast or no mana was spent to cast them, draw a card. |
| `e25b516c-bf95-42bc-8b1e-04617a3d28df` | Baron Bertram Graywater | enters\|research-only | Whenever one or more tokens you control enter, create a 1/1 black Vampire Rogue creature token with lifelink. This ability triggers only once each turn. |
| `f6479f7e-01f4-49f1-a444-04bf38934f6b` | Marneus Calgar | enters\|research-only | Master Tactician — Whenever one or more tokens you control enter, draw a card. |
| `1b600345-2b89-45bc-98c8-609fdd08a5fd` | Merry, Warden of Isengard | enters\|research-only | Partner with Pippin, Warden of Isengard (When this creature enters, target player may put Pippin into their hand from their library, then shuffle.) / Whenever one or more artifacts you control enter, create a 1/1 white Soldier creature token with lifelink. This ability triggers only once each turn. |
| `1829f1dc-1fa9-4361-b318-d4dee280e6fd` | Anje, Maid of Dishonor | enters\|research-only | Whenever Anje and/or one or more other Vampires you control enter, create a Blood token. This ability triggers only once each turn. (It's an artifact with "{1}, {T}, Discard a card, Sacrifice this token: Draw a card.") |
| `0177b410-b559-491f-b393-ac3ed774653c` | Kotis, Sibsig Champion | enters\|research-only | Whenever one or more creatures you control enter, if one or more of them entered from a graveyard or was cast from a graveyard, put two +1/+1 counters on Kotis. |
| `d7035db0-4bde-4ba3-9028-dd14191c8126` | Elvish Archivist | enters\|research-only | Whenever one or more artifacts you control enter, put two +1/+1 counters on this creature. This ability triggers only once each turn. / Whenever one or more enchantments you control enter, draw a card. This ability triggers only once each turn. |
| `a728685f-8670-4db2-ae02-3cf74eb3c402` | Ran and Shaw | enters\|research-only | When Ran and Shaw enter, if you cast them and there are three or more Dragon and/or Lesson cards in your graveyard, create a token that's a copy of Ran and Shaw, except it's not legendary. |
| `de861715-fd0b-493e-9a7c-c470a23044c0` | J. Jonah Jameson | enters\|research-only | When J. Jonah Jameson enters, suspect up to one target creature. (A suspected creature has menace and can't block.) |
| `481c3e14-b670-4fab-aa9f-6ce5b514096d` | Aang and Katara | enters\|research-only | Whenever Aang and Katara enter or attack, create X 1/1 white Ally creature tokens, where X is the number of tapped artifacts and/or creatures you control. |
| `df72b5d6-6f9e-4d6b-acf6-7dec4ff35468` | Bess, Soul Nourisher | enters\|research-only | Whenever one or more other creatures you control with base power and toughness 1/1 enter, put a +1/+1 counter on Bess. |
| `2385c8fb-9c38-4ff3-8f61-4e25a8c7d46b` | Krang & Shredder | enters\|research-only | Whenever Krang & Shredder enter or attack, each opponent exiles cards from the top of their library until they exile a nonland card. |
| `675321d7-2cf0-4e0b-9517-d711b22865ab` | Woodland Champion | enters\|research-only | Whenever one or more tokens you control enter, put that many +1/+1 counters on this creature. |
| `61f09fcc-11cd-4999-a43a-54488b19861d` | Cloakwood Swarmkeeper | enters\|research-only | Gathered Swarm — Whenever one or more tokens you control enter, put a +1/+1 counter on this creature. |
| `ad643992-eb9f-4a4a-9b74-a5aee2337f30` | Lo and Li, Twin Tutors | enters\|research-only | When Lo and Li enter, search your library for a Lesson or Noble card, reveal it, put it into your hand, then shuffle. |
| `7b33368f-0668-4233-8bbf-725c66c771cb` | Donnie & April, Adorkable Duo | enters\|research-only | When Donnie & April enter, choose one or both. Each mode must target a different player. |
| `c77ddcac-ce54-4348-bde2-5d9caf3d5b04` | Spiritcall Enthusiast // Scrollboost | enters\|research-only | Whenever one or more tokens you control enter, this creature becomes prepared. (While it's prepared, you may cast a copy of its spell. Doing so unprepares it.) |
| `c01095ba-b9c9-44e0-97d1-35cc47c4ed04` | Splinter & Leo, Father & Son | enters\|research-only | When Splinter & Leo enter, choose one or both. Each mode must target a different player. |
| `7fa5237e-dd79-4646-b935-cb8c6ee803ab` | Mister Fantastic, Reed Richards | enters\|research-only | Whenever one or more tokens you control enter, you may draw a card. |
| `15e14a91-a596-465f-becc-cef2e7fbbd30` | Mikey & Mona, Mutant Sitters | enters\|research-only | When Mikey & Mona enter, choose one or both. Each mode must target a different player. |
| `f20a5297-31ba-4bbd-810e-be23175a116f` | Casey & Raph, Hotheads | enters\|research-only | When Casey & Raph enter, choose one or both. Each mode must target a different player. |
| `a2281c99-3f45-441b-8e78-7f1f29bf1dcd` | The Fantastic Four | enters\|research-only | When The Fantastic Four enter and whenever you cast a spell with power, toughness, or mana value 4, choose one that hasn't been chosen this turn. |
| `64132f93-66ac-4794-8c07-a88f9ed0e22b` | Cloak and Dagger, Entwined | enters\|research-only | When Cloak and Dagger enter, choose target opponent and up to one target creature they control. They reveal their hand. You may exile a nonland card from their hand or the chosen creature until Cloak and Dagger leave the battlefield. |
| `aaded61e-32c2-4e02-8557-3f8cd927a64e` | Gert and Old Lace, Runaways | enters\|research-only | When Gert and Old Lace enter, you may discard a card. If you do, search your library for a basic land card, reveal it, put it into your hand, then shuffle. |
| `74858500-8943-4ea7-894f-0cd022510bbe` | Devil K. Nevil | enters\|research-only | When Devil K. Nevil enters, jump it over any number of creatures. If it clears those creatures, put that many +1/+1 counters on it. (You can see a jumping demonstration at DevilKNevil.com.) |
| `760d6cb2-5d8a-495c-9853-f96a1efa5775` | The Immortal Weapons | enters\|research-only | When The Immortal Weapons enter, return target instant or sorcery card from your graveyard to your hand. |
| `2b6fa8b6-4865-4eb6-974b-00f6b16b6f0f` | U.S.Agent, John Walker | enters\|research-only | When U.S.Agent enters, create a colorless Equipment artifact token named Sturdy Shield with "Equipped creature gets +1/+2" and equip {2}. Attach it to U.S.Agent. |
| `26a1b36c-3c27-4eb4-b85f-63459653b773` | Ms. Marvel, Elastic Ally | enters\|research-only | When Ms. Marvel enters, target creature gets +2/+0 until end of turn. |

## dies|runtime-only (33 cards)

- Governing CR: CR 700.4: dies は “is put into a graveyard from the battlefield”。CR 603.7: 解決中に作られる delayed trigger も when/whenever/at を含む。
- Draft attribution: `research-FN`
- Rationale: “When that creature dies this turn” などの真の遅延誘発や、mode/bullet/attraction 接頭辞の後にある死亡誘発が多数。research の行頭前提で落ちる候補。
- Proposed fix (not applied): research が文境界の delayed trigger と bullet・room・saga・attraction・threshold 接頭辞を正規化して解析する。効果文だけの runtime-FP は別途 per-card 裁定する。

| Oracle ID | Name | All mismatch keys | Relevant Oracle text |
| --- | --- | --- | --- |
| `36b19ec0-d581-4213-bfae-1d7808a2f60d` | Together Forever | dies\|runtime-only | {1}: Choose target creature with a counter on it. When that creature dies this turn, return that card to its owner's hand. |
| `91df4cf5-d7ec-4fcd-87ed-e075ef6ceba9` | The Deck of Many Things | dies\|runtime-only | 20 \| Put a creature card from any graveyard onto the battlefield under your control. When that creature dies, its owner loses the game. |
| `78df47c3-b771-4377-8963-ae3065fdcf8a` | Waltz of Rage | dies\|runtime-only | Target creature you control deals damage equal to its power to each other creature. Until end of turn, whenever a creature you control dies, exile the top card of your library. You may play it until the end of your next turn. |
| `5b3326a5-18c5-4d45-90e1-f6d00ca2bced` | Kelsien, the Plague | dies\|runtime-only | {T}: Kelsien deals 1 damage to target creature you don't control. When that creature dies this turn, you get an experience counter. |
| `91596da5-5b1a-430c-a878-7757ae366b6b` | Battle of Hoover Dam | dies\|runtime-only | • Legion — Whenever a creature you control dies, put two +1/+1 counters on target creature you control. |
| `27a4b633-5a62-4d8c-8cc6-44959c311de9` | Cryptek | dies\|runtime-only | {1}{B}, {T}: Choose another target artifact creature you control. When that creature dies this turn, return it to the battlefield tapped under your control. |
| `be0a3925-8e0d-4ef6-85cb-c9f5eef6b4bb` | Turn Inside Out | dies\|runtime-only | Target creature gets +3/+0 until end of turn. When it dies this turn, manifest dread. (Look at the top two cards of your library. Put one onto the battlefield face down as a 2/2 creature and the other into your graveyard. Turn it face up any time for its mana cost if it's a creature card.) |
| `0332f7b5-dad3-4fd0-b86c-78bd8301f59d` | Gnawing Crescendo | dies\|runtime-only | Creatures you control get +2/+0 until end of turn. Whenever a nontoken creature you control dies this turn, create a 1/1 black Rat creature token with "This token can't block." |
| `860b5e4c-45bd-4ba1-930a-36a1450ebd37` | Infested Thrinax | dies\|runtime-only | When this creature enters, until end of turn, whenever a nontoken creature you control dies, create a number of 1/1 green Saproling creature tokens equal to that creature's power. |
| `f1f3df1c-5c51-445a-b66d-eee4aab23691` | Desperate Measures | dies\|runtime-only | Target creature gets +1/-1 until end of turn. When it dies under your control this turn, draw two cards. |
| `66d57851-2844-4b9d-be78-e90fc620b750` | Scarblade's Malice | dies\|runtime-only | Target creature you control gains deathtouch and lifelink until end of turn. When that creature dies this turn, create a 2/2 black and green Elf creature token. |
| `e1905321-180b-41d2-b7ef-0974ab90f188` | Felonious Rage | dies\|runtime-only | Target creature you control gets +2/+0 and gains haste until end of turn. When that creature dies this turn, create a 2/2 white and blue Detective creature token. |
| `75137acb-dc8e-439b-8d84-c5cf682ff6bc` | Reckless Blaze | dies\|runtime-only | Reckless Blaze deals 5 damage to each creature. Whenever a creature you control dealt damage this way dies this turn, add {R}. |
| `00cfbea0-e862-468b-90d5-7478eb9847c0` | End-Blaze Epiphany | dies\|runtime-only | End-Blaze Epiphany deals X damage to target creature. When that creature dies this turn, exile a number of cards from the top of your library equal to its power, then choose a card exiled this way. Until the end of your next turn, you may play that card. |
| `cc9088c4-6f6b-4a1a-90f1-794eb1e938c6` | Phenomenon Investigators | dies\|runtime-only | • Believe — Whenever a nontoken creature you control dies, create a 2/2 black Horror enchantment creature token. |
| `7d3a0216-871b-4c1b-adb1-de99b832f577` | Ruinous Waterbending | dies\|runtime-only | All creatures get -2/-2 until end of turn. If this spell's additional cost was paid, whenever a creature dies this turn, you gain 1 life. |
| `902b82fd-bb18-4833-b427-af8c9751f870` | Searing Blood | dies\|runtime-only | Searing Blood deals 2 damage to target creature. When that creature dies this turn, Searing Blood deals 3 damage to the creature's controller. |
| `202e45d6-8c7a-46db-85fb-634aa77b4097` | Fatal Fissure | dies\|runtime-only | Choose target creature. When that creature dies this turn, you earthbend 4. (Target land you control becomes a 0/0 creature with haste that's still a land. Put four +1/+1 counters on it. When it dies or is exiled, return it to the battlefield tapped.) |
| `04e3d36f-5dec-422c-a371-15e135fdface` | Blessed Defiance | dies\|runtime-only | Target creature you control gets +2/+0 and gains lifelink until end of turn. When that creature dies this turn, create a 1/1 white Spirit creature token with flying. |
| `a4374baa-a846-4b34-afbf-6bb7feb4648c` | Electric Seaweed | dies\|runtime-only | When this creature enters, until end of turn, whenever another creature dies, this creature deals 1 damage to each non-Wall creature. |
| `a0218a14-8301-4484-aed5-90334349620e` | Warhost's Frenzy | dies\|runtime-only | Creatures you control get +2/+0 until end of turn. If this spell was kicked, whenever a creature you control dies this turn, draw a card. |
| `59642d6f-8a25-4f79-9e81-643eac775658` | Time to Feed | dies\|runtime-only | Choose target creature an opponent controls. When that creature dies this turn, you gain 3 life. Target creature you control fights that creature. (Each deals damage equal to its power to the other.) |
| `03c47f1c-02a7-428c-a126-9e85325ebc71` | Heroic Sacrifice | dies\|runtime-only | Choose target creature you control. Until end of turn, all damage that would be dealt to you and creatures you control is dealt to the chosen creature instead (if it's still on the battlefield). When that creature dies this turn, put its counters on up to one target creature you control and draw a card. |
| `53129de9-4809-4c8c-9d11-37369899e70a` | Fight for the Throne | dies\|runtime-only | Put a +1/+1 counter on target creature you control. Then it fights target creature an opponent controls. When the creature an opponent controls dies this turn, if you control your commander, you become the monarch. |
| `5b18d2fd-bc65-49a2-b812-c217f125571d` | Initiate of Blood // Goka the Unjust | dies\|runtime-only | {T}: This creature deals 1 damage to target creature that was dealt damage this turn. When that creature dies this turn, flip this creature. |
| `e4f218b3-d96d-49c5-8dfa-8fcf993f795f` | Truss, Chief Engineer | dies\|runtime-only | Whenever Truss, Chief Engineer enters or another creature dies, put a hack counter on Truss. |
| `f81207e8-d5a2-4a5e-8a81-803ac563fe76` | Minotaur, Roxxon CEO | dies\|runtime-only | Whenever Minotaur, Roxxon CEO or another nontoken creature dies, you create a 2/1 black Villain creature token with menace. (It can't be blocked except by two or more creatures.) |
| `13d9822f-0398-4915-818b-b9fbaf63b93c` | Demonic Tourist Laser | dies\|runtime-only | {TK}{TK}{TK} — When this permanent dies, you get seven {TK}. |
| `5829ac8e-bd1c-4065-b30a-5307ab11ae79` | Elemental Time Flamingo | dies\|runtime-only | {TK}{TK}{TK}{TK} — Whenever a creature you control dies, each opponent loses 1 life and you gain 1 life. |
| `26f6170a-34dc-41c8-b3b1-20377f131e6e` | Giant Mana Cake | dies\|runtime-only, leaves\|runtime-only | {TK}{TK} — When this permanent leaves the battlefield, create two Food tokens. (They're artifacts with "{2}, {T}, Sacrifice this artifact: You gain 3 life.") / {TK}{TK}{TK}{TK} — When this permanent dies, destroy target nonland permanent. |
| `a7a00246-54e7-4213-b95b-907ab9015e53` | Primal Elder Kitty | dies\|runtime-only | {TK}{TK}{TK} — When this creature dies, you may put X +1/+1 counters on target creature, where X is this creature's power. |
| `3def54bf-2640-47de-84e8-7a9406df007e` | Sticky Kavu Daredevil | dies\|runtime-only, attacks\|runtime-only | {TK}{TK} — Whenever this permanent dies, you may return target creature to its owner's hand. / {TK}{TK}{TK}{TK} — Whenever this creature attacks, creatures you control get +1/+1 until end of turn. |
| `6ad4d181-21ce-47f3-9c00-2aa8c307e7fe` | Unassuming Gelatinous Serpent | dies\|runtime-only | {TK}{TK} — When this permanent dies, return target noncreature, nonland card from your graveyard to your hand. |

## attacks|runtime-only (29 cards)

- Governing CR: CR 508.1m: attacker 宣言で該当能力が誘発する。CR 508.3a–d: “attacks” / “is attacked” / player attacks の各条件を定義する。
- Draft attribution: `research-FN`
- Rationale: mode bullet、loyalty effect、station threshold、duration 文の後ろに実在する attack trigger が代表例。意味上は攻撃イベントだが research の ability line 先頭に来ない。
- Proposed fix (not applied): research の非標準接頭辞を正規化し、文境界の trigger clause を解析する。CR 508.4 の「attacking だが attacked ではない」ケースは区別する。

| Oracle ID | Name | All mismatch keys | Relevant Oracle text |
| --- | --- | --- | --- |
| `5958e9e3-9457-48e1-afc1-a5c89e3b0ed0` | Struggle for Project Purity | attacks\|runtime-only | • Enclave — Whenever a player attacks you with one or more creatures, that player gets twice that many rad counters. |
| `afc9436b-8cad-4916-929d-ff33a37b42d5` | Dawnsire, Sunstar Dreadnought | attacks\|runtime-only | 10+ \| Whenever you attack, Dawnsire deals 100 damage to up to one target creature or planeswalker. |
| `e0bdfbb4-3060-4492-bd9b-0c47e719400a` | Jumbo Cactuar | attacks\|runtime-only | 10,000 Needles — Whenever this creature attacks, it gets +9999/+0 until end of turn. |
| `31061e34-042e-40c3-99ab-752795ab4324` | Hollowmurk Siege | attacks\|runtime-only | • Abzan — Whenever you attack, put a +1/+1 counter on target attacking creature. It gains menace until end of turn. |
| `33a90122-7280-4481-9b97-5879194cae40` | Dalkovan Encampment | attacks\|runtime-only | {2}{W}, {T}: Whenever you attack this turn, create two 1/1 red Warrior creature tokens that are tapped and attacking. Sacrifice them at the beginning of the next end step. |
| `53643dd7-183b-4062-b7a3-e7723d23bdb0` | Company Commander | attacks\|runtime-only | Bring it Down! — Whenever this creature attacks, creatures you control gain deathtouch until end of turn. |
| `23af0a0a-1d12-47c7-b191-2bd3f84eea93` | The Tenth Doctor | attacks\|runtime-only | Allons-y! — Whenever you attack, exile cards from the top of your library until you exile a nonland card. Put three time counters on it. If it doesn't have suspend, it gains suspend. |
| `2274c7ae-5a40-4fd4-a4ac-6f56b23034e4` | Jace, Architect of Thought | attacks\|runtime-only | +1: Until your next turn, whenever a creature an opponent controls attacks, it gets -1/-0 until end of turn. |
| `fcd54631-ea47-49a7-ad5f-9a9a51a815ba` | Unstable Glyphbridge // Sandswirl Wanderglyph | attacks\|runtime-only | Whenever an opponent casts a spell during their turn, they can't attack you or planeswalkers you control this turn. / Each opponent who attacked you or a planeswalker you control this turn can't cast spells. |
| `f0554a8f-32de-4069-9f47-5e06ceb3f09d` | Aloy, Savior of Meridian | attacks\|runtime-only | In You, All Things Are Possible — Whenever one or more artifact creatures you control attack, discover X, where X is the greatest power among them. (Exile cards from the top of your library until you exile a nonland card with that mana value or less. Cast it without paying its mana cost or put it into your hand. Put the rest on the bottom in a random order.) |
| `2458aa66-5b20-4811-a4a4-8375ad0a6498` | Jaya, Fiery Negotiator | attacks\|runtime-only | −2: Choose target creature an opponent controls. Whenever you attack this turn, Jaya deals damage equal to the number of attacking creatures to that creature. |
| `a9a35c77-637f-4d56-afa2-6c8a4ded4838` | Stinging Cave Crawler | attacks\|runtime-only | Descend 4 — Whenever this creature attacks, if there are four or more permanent cards in your graveyard, you draw a card and you lose 1 life. |
| `20f92504-d03c-437e-9814-b25ee384b3ba` | Butch DeLoria, Tunnel Snake | attacks\|runtime-only | Tunnel Snakes Rule! — Whenever Butch DeLoria attacks, it gets +1/+1 until end of turn for each other Rogue and/or Snake you control. |
| `2494daad-c81d-4a80-ba5d-e7011af8de46` | Maeve, Insidious Singer | attacks\|runtime-only | {2}{U}: Goad target creature. Whenever that creature attacks one of your opponents this turn, you draw a card. (A goaded creature attacks each combat if able and attacks a player other than you if able, until your next turn.) |
| `d53d5d03-b180-4bdb-8801-260f8a75644d` | Tamiyo Meets the Story Circle | attacks\|runtime-only | I — Until your next turn, whenever a creature attacks you or a planeswalker you control, it gets -2/-0 until end of turn. |
| `25a9c864-59c6-4230-a234-bf78bf1ef24c` | Malamet Veteran | attacks\|runtime-only | Descend 4 — Whenever this creature attacks, if there are four or more permanent cards in your graveyard, put a +1/+1 counter on target creature. |
| `50d0d870-fe3d-44a2-ad6e-93307a1fb468` | Ace, Fearless Rebel | attacks\|runtime-only | Nitro-9 — Whenever Ace attacks, you may sacrifice an artifact. When you do, put a +1/+1 counter on Ace, then it fights up to one target creature defending player controls. |
| `02718076-4c71-4bf5-988f-e6f94fbf0aef` | Spara's Adjudicators | attacks\|runtime-only | When this creature enters, target creature an opponent controls can't attack or block until your next turn. |
| `8ec3c334-8a53-46d8-8cfb-c647c3a1ef74` | Stalked Researcher | attacks\|runtime-only | Eerie — Whenever an enchantment you control enters and whenever you fully unlock a Room, this creature can attack this turn as though it didn't have defender. |
| `7e06b7b4-22c1-4e5b-81ee-54ab5ac756eb` | Carnival Elephant Meteor | attacks\|runtime-only | {TK}{TK}{TK} — Whenever this creature attacks, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.) |
| `366e0a62-ff95-48d1-bc63-7995a393bc34` | Narrow-Minded Baloney Fireworks | attacks\|runtime-only | {TK}{TK} — Whenever this creature attacks, you gain 2 life. |
| `dde09abb-e3d3-4c76-b7e8-812949dd67f3` | Phyrexian Midway Bamboozle | attacks\|runtime-only | {TK}{TK} — Whenever this creature attacks, you get {TK}. |
| `065cdf8d-6874-4ab6-a08e-79bd88b245bd` | Playable Delusionary Hydra | attacks\|runtime-only | {TK}{TK}{TK}{TK} — Whenever this creature attacks, you gain 3 life and draw a card. |
| `16663933-c8e2-4411-8eed-673c52fa3ecb` | Sassy Gremlin Blood | attacks\|runtime-only | {TK}{TK} — Whenever this creature attacks, create a Treasure token. |
| `ea1fb0c3-d52c-4435-af2c-4b74f31189f7` | Unhinged Beast Hunt | attacks\|runtime-only | {TK}{TK}{TK}{TK} — Whenever this creature attacks, tap each creature an opponent controls with the same power and/or same toughness as this creature. |
| `989346e5-3e76-40ce-8295-d267929d4fd5` | Unique Charmed Pants | attacks\|runtime-only | {TK}{TK}{TK} — Whenever this creature attacks, if it's not a Brushwagg, it gets +X/+0 until end of turn, where X is the number of supertypes, card types, and subtypes it has. |
| `4413cb03-d6e9-4e6c-b5fe-9240ca0ebd13` | Unsanctioned Ancient Juggler | attacks\|runtime-only | {TK}{TK} — Whenever this creature attacks, bolster 1. (Choose a creature with the least toughness among creatures you control and put a +1/+1 counter on it.) |
| `676de97a-299b-42ac-aa93-bb12dc9c4460` | Unstable Robot Dragon | attacks\|runtime-only | {TK}{TK}{TK}{TK} — Whenever this creature attacks, it gets +5/+5 until end of turn. |
| `578c23d2-225f-4488-be7f-4abe38297bde` | Wild Ogre Bupkis | attacks\|runtime-only | {TK}{TK} — Whenever this creature attacks, put a +1/+1 counter on it. |

## enters|runtime-only (21 cards)

- Governing CR: CR 603.6a が ETB誘発を定義する一方、CR 603.6d は “enters with/as/tapped” を triggered ability ではなく static ability とする。
- Draft attribution: `granularity-allowance`
- Rationale: 接頭辞で隠れた有効な ETB 誘発と、“enters tapped/with” や “if ... entered this turn” の static/replacement/履歴条件が混在する。enters 語だけでは裁定できない。
- Proposed fix (not applied): 裁定後、runtime ETB tag を解析済み trigger condition に限定し、CR 603.6d は別 concept へ分離する。真の誘発について research の接頭辞処理を拡張する。

| Oracle ID | Name | All mismatch keys | Relevant Oracle text |
| --- | --- | --- | --- |
| `4cfaa5cf-cc3d-49a7-9544-38a8bb7e9ec1` | Frontier Siege | enters\|runtime-only | As this enchantment enters, choose Khans or Dragons. / • Dragons — Whenever a creature you control with flying enters, you may have it fight target creature you don't control. |
| `5eef3d70-ef16-4722-8c3d-21a0311597bd` | Jade Orb of Dragonkind | enters\|runtime-only, cast\|runtime-only | {T}: Add {G}. When you spend this mana to cast a Dragon creature spell, it enters with an additional +1/+1 counter on it and gains hexproof until your next turn. (It can't be the target of spells or abilities your opponents control.) |
| `95d018f4-7f97-4b2c-abb4-cef69031caa1` | Dalek Drone | enters\|runtime-only | Exterminate! — When this creature enters, destroy target creature an opponent controls. That player loses 3 life. |
| `83f776d9-f3b6-40c2-8008-1ace4d110825` | Barret, Avalanche Leader | enters\|runtime-only | Avalanche! — Whenever an Equipment you control enters, create a 2/2 red Rebel creature token. |
| `ddbacb74-1f98-4607-a92e-d14973b9d0ef` | Groundswell | enters\|runtime-only | Landfall — If you had a land enter the battlefield under your control this turn, that creature gets +4/+4 until end of turn instead. |
| `8419d1d5-bb0e-4a2d-bb6f-67957d035dde` | Thunder of Unity | enters\|runtime-only | (As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) / II, III — Whenever a creature you control enters this turn, each opponent loses 1 life and you gain 1 life. |
| `4900c157-8d9f-4f92-aaca-5246b6e2832e` | April O'Neil, Live on the Scene | enters\|runtime-only | Whenever a Mutant, Ninja, or Turtle you control enters, investigate. (Create a Clue token. It's an artifact with "{2}, Sacrifice this token: Draw a card.") |
| `169cf74a-07bf-4841-83f3-904df8a0a39b` | Jailbreak | enters\|runtime-only | Return target permanent card in an opponent's graveyard to the battlefield under their control. When that permanent enters, return up to one target permanent card with equal or lesser mana value from your graveyard to the battlefield. |
| `ed77fdf2-59c0-4310-9b12-80d28beeaeef` | Chocobo Camp | enters\|runtime-only, cast\|runtime-only | This land enters tapped unless you control a legendary creature. / {T}: Add {G}. When you next cast a Bird creature spell this turn, it enters with an additional +1/+1 counter on it. |
| `535f9bc6-9a07-4850-91eb-c00d06633e7e` | Coati Scavenger | enters\|runtime-only | Descend 4 — When this creature enters, if there are four or more permanent cards in your graveyard, return target permanent card from your graveyard to your hand. |
| `4469ff35-54ec-4ff5-bc19-3808ae0f711b` | Wildgrowth Archaic | enters\|runtime-only | Converge — This creature enters with a +1/+1 counter on it for each color of mana spent to cast it. / Whenever you cast a creature spell, that creature enters with X additional +1/+1 counters on it, where X is the number of colors of mana spent to cast it. |
| `1196a4cb-544c-4e7b-91cd-f0820b21a80d` | Lucy MacLean, Positively Armed | enters\|runtime-only | Golden Rule - Whenever a token enters, you may have target player other than its controller create a token that's a copy of it, then you draw a card if an opponent created a token this way. Do this only once each turn. |
| `0d5bbde7-6f33-4708-b3ab-34d4528af649` | Magitek Scythe | enters\|runtime-only | A Test of Your Reflexes! — When this Equipment enters, you may attach it to target creature you control. If you do, that creature gains first strike until end of turn and must be blocked this turn if able. |
| `74b08a70-b0bb-4340-98a0-b1d5b7c9d2cc` | Searing Blaze | enters\|runtime-only | Landfall — If you had a land enter the battlefield under your control this turn, Searing Blaze deals 3 damage to that player or planeswalker and 3 damage to that creature instead. |
| `80312910-5d53-44f1-9982-e46dc7532abb` | The Unbeatable Squirrel Girl | enters\|runtime-only, attacks\|runtime-only | Do You Like Squirrels? — Whenever The Unbeatable Squirrel Girl enters or attacks, create a 1/1 green Squirrel creature token. |
| `7b513bd0-27df-45f3-a85f-1f0aba3cae48` | Council of Echoes | enters\|runtime-only | Descend 4 — When this creature enters, if there are four or more permanent cards in your graveyard, return up to one target nonland permanent other than this creature to its owner's hand. |
| `85dec6cf-6f27-4eb0-834b-5f6fbbe25fc8` | Spider-Man, To the Rescue | enters\|runtime-only | No One Dies! — When Spider-Man enters, you may tap him. When you do, another target nonattacking creature you control gains indestructible until end of turn. (Damage and effects that say "destroy" don't destroy it.) |
| `ba2bb276-b7ef-46ec-9618-2cf4d60c70a6` | Cool Fluffy Loxodon | enters\|runtime-only, leaves\|runtime-only | {TK}{TK} — When this permanent leaves the battlefield, draw a card. / {TK}{TK}{TK}{TK}{TK} — Whenever a creature enters under your control, this permanent becomes a 13/13 Eldrazi creature in addition to its other types until end of turn. |
| `41c0e1f1-8ebe-4cd2-96fe-e4bb625fe6ee` | Familiar Beeble Mascot | enters\|runtime-only, attacks\|runtime-only | {TK}{TK} — Whenever this creature attacks, untap target permanent. / {TK}{TK}{TK}{TK} — Whenever a creature enters under your control, creatures you control get +1/+1 until end of turn. |
| `c0a448ee-e5f9-4e57-85b0-f6d401018170` | Geek Lotus Warrior | enters\|runtime-only | {TK}{TK}{TK}{TK} — Whenever a creature enters under your control, this permanent deals 2 damage to target player. |
| `a72927dc-b633-4830-be39-40674ed74ef3` | Werewolf Lightning Mage | enters\|runtime-only | {TK}{TK} — Landfall — Whenever a land enters under your control, put a +1/+1 counter on this permanent. |

## dies|research-only (15 cards)

- Governing CR: CR 700.4 が dies を定義し、CR 603.2c は一つの event に複数 occurrence がある場合の反復誘発を認める。
- Draft attribution: `runtime-FN`
- Rationale: “Whenever one or more creatures die” 型が一貫している。runtime の singular “dies” 中心のパターンが plural subject の verb “die” と修飾語を落とす候補。
- Proposed fix (not applied): runtime death condition に die/dies、one-or-more、other、attacking、token、controller/opponent 修飾を追加し、効果文の die 言及とは分離する。

| Oracle ID | Name | All mismatch keys | Relevant Oracle text |
| --- | --- | --- | --- |
| `322f44f0-e6da-4ee0-b474-e7d5e9a461c5` | Morbid Opportunist | dies\|research-only | Whenever one or more other creatures die, draw a card. This ability triggers only once each turn. |
| `ba26ff0a-e714-44f2-95cf-1a5a6088edf9` | The Skullspore Nexus | dies\|research-only | Whenever one or more nontoken creatures you control die, create a green Fungus Dinosaur creature token with base power and toughness each equal to the total power of those creatures. |
| `fde2653f-5270-4b8f-9642-0835dbb076c2` | Spiteful Banditry | dies\|research-only | Whenever one or more creatures your opponents control die, you create a Treasure token. This ability triggers only once each turn. |
| `aefea339-8a0d-4531-8a62-afaecc88d078` | Scavenger's Talent | dies\|research-only | Whenever one or more creatures you control die, create a Food token. This ability triggers only once each turn. |
| `b2f2645f-5f74-456a-bd02-83169d8b8a7e` | Vraan, Executioner Thane | dies\|research-only | Whenever one or more other creatures you control die, each opponent loses 2 life and you gain 2 life. This ability triggers only once each turn. |
| `3db40361-5f55-417e-a7cd-7e360cc91b4d` | Chainsaw | dies\|research-only | Whenever one or more creatures die, put a rev counter on this Equipment. |
| `39e20898-cf01-48dc-8972-7ac500c3fa79` | Ghoulish Procession | dies\|research-only | Whenever one or more nontoken creatures die, create a 2/2 black Zombie creature token with decayed. This ability triggers only once each turn. (A creature with decayed can't block. When it attacks, sacrifice it at end of combat.) |
| `b2d95950-18b3-463f-94f4-299e420751dc` | Éomer, Marshal of Rohan | dies\|research-only | Whenever one or more other attacking legendary creatures you control die, untap all creatures you control. After this phase, there is an additional combat phase. This ability triggers only once each turn. |
| `b2f9e07b-64b7-40b3-9a5e-5f1d59b35af7` | Thopter Shop | dies\|research-only | Whenever one or more artifact creatures you control die, draw a card. This ability triggers only once each turn. |
| `0c4603be-d71a-4d33-b62c-04ead1987dbe` | G'raha Tia | dies\|research-only | The Allagan Eye — Whenever one or more other creatures and/or artifacts you control die, draw a card. This ability triggers only once each turn. |
| `dc4d5602-47cb-47c8-8a43-3b840e12b79c` | Homicide Investigator | dies\|research-only | Whenever one or more nontoken creatures you control die, investigate. This ability triggers only once each turn. (Create a Clue token. It's an artifact with "{2}, Sacrifice this token: Draw a card.") |
| `47b29cf9-8ef3-4b6a-a9a3-3ab822c5dea4` | Rinoa, Angel Wing | dies\|research-only | Whenever one or more attacking creatures you control die, you may return one of them to the battlefield tapped under its owner's control with a flying counter on it. Do this only once each turn. |
| `aa929252-5dcc-4c9b-9e7c-61d0bef98d6d` | Blood Spatter Analysis | dies\|research-only | Whenever one or more creatures die, mill a card and put a bloodstain counter on this enchantment. Then sacrifice it if it has five or more bloodstain counters on it. When you do, return target creature card from your graveyard to your hand. |
| `c649d5ae-2f38-4737-8123-8069a2ba0bde` | Vengeful Townsfolk | dies\|research-only | Whenever one or more other creatures you control die, put a +1/+1 counter on this creature. |
| `8a4d505e-b884-4b8b-93d5-495992f3858e` | Sengir Connoisseur | dies\|research-only | Whenever one or more other creatures die, put a +1/+1 counter on this creature. This ability triggers only once each turn. |

## leaves|runtime-only (13 cards)

- Governing CR: CR 603.6c が leaves-the-battlefield trigger と “from anywhere” の非該当を定義し、CR 603.10a が leaves trigger の look-back を定める。
- Draft attribution: `research-FN`
- Rationale: 明示的 “leaves the battlefield” または battlefield-to-graveyard watcher が代表例。別文・mode 接頭辞・固有名の後ろに埋め込まれ、research の行頭解析で落ちる候補。
- Proposed fix (not applied): research が埋め込み explicit-leaves と CR 603.6c の noncreature battlefield-to-graveyard を解析する。“from anywhere” は除外を維持する。

| Oracle ID | Name | All mismatch keys | Relevant Oracle text |
| --- | --- | --- | --- |
| `18bdc181-9592-4147-81fb-7f83ce137f70` | Ugin, the Ineffable | leaves\|runtime-only | +1: Exile the top card of your library face down and look at it. Create a 2/2 colorless Spirit creature token. When that token leaves the battlefield, put the exiled card into your hand. |
| `2ffb38ec-5852-4e91-85a5-cfccd1f23556` | Tarrian's Soulcleaver | leaves\|runtime-only | Whenever another artifact or creature is put into a graveyard from the battlefield, put a +1/+1 counter on equipped creature. |
| `ebb24fc7-dc71-4712-8c2a-b5920f78e55d` | Outpost Siege | leaves\|runtime-only | • Dragons — Whenever a creature you control leaves the battlefield, this enchantment deals 1 damage to any target. |
| `10c31317-71e8-42e0-85e0-3e64bd0c3dd3` | Vat of Rebirth | leaves\|runtime-only | Whenever another artifact or creature you control is put into a graveyard from the battlefield, put an oil counter on this artifact. |
| `f1eb489d-104c-4801-b6d2-3f1a7ee73a75` | Mechtitan Core | leaves\|runtime-only | {5}, Exile this Vehicle and four other artifact creatures and/or Vehicles you control: Create Mechtitan, a legendary 10/10 Construct artifact creature token with flying, vigilance, trample, lifelink, and haste that's all colors. When that token leaves the battlefield, return all cards exiled with this Vehicle except this card to the battlefield tapped under their owners' control. |
| `6cd03270-54cc-43e1-9b86-70c76960c841` | Wernog, Rider's Chaplain | leaves\|runtime-only | When Wernog, Rider's Chaplain enters or leaves the battlefield, each opponent may investigate. Each opponent who doesn't loses 1 life. You investigate X times, where X is one plus the number of opponents who investigated this way. |
| `94d5c904-6504-4df2-b242-daf88a988475` | The Pandorica | leaves\|runtime-only | {1}{W}, {T}: Untap another target nonland permanent, then it phases out. It can't phase in for as long as The Pandorica remains tapped. When The Pandorica becomes untapped or leaves the battlefield, that permanent phases in. Activate only as a sorcery. |
| `40f664d8-4c73-44aa-8fb1-d38771a42520` | Mysterio, Master of Illusion | leaves\|runtime-only | When Mysterio enters, create a 3/3 blue Illusion Villain creature token for each nontoken Villain you control. Exile those tokens when Mysterio leaves the battlefield. |
| `b2bdccf1-857b-48f8-a9aa-8ef999ef0632` | Seer of Stolen Sight | leaves\|runtime-only | Whenever one or more artifacts and/or creatures you control are put into a graveyard from the battlefield, surveil 1. (Look at the top card of your library. You may put that card into your graveyard.) |
| `739eac91-3029-4ce7-9885-0af3ddea472e` | Stangg | leaves\|runtime-only | When Stangg enters, create Stangg Twin, a legendary 3/4 red and green Human Warrior creature token. Exile that token when Stangg leaves the battlefield. Sacrifice Stangg when that token leaves the battlefield. |
| `43f5ce56-6ad1-4a42-b1d7-26f1c7933693` | Deep-Fried Plague Myr | leaves\|runtime-only, attacks\|runtime-only | {TK}{TK} — Whenever this creature attacks, scry 1. / {TK}{TK}{TK} — Whenever this permanent leaves the battlefield, you may destroy target artifact or enchantment. |
| `7cad08c1-4bd9-4d9f-85d2-fb3ab718fbb8` | Goblin Coward Parade | leaves\|runtime-only | {TK}{TK}{TK} — When this permanent leaves the battlefield, you may destroy target creature with power 4 or greater. |
| `4c02ee30-8681-45ed-adb5-edf06409eee4` | Yawgmoth Merfolk Soul | leaves\|runtime-only | {TK}{TK} — When this permanent leaves the battlefield, target player discards a card. / {TK}{TK}{TK}{TK}{TK} — When this permanent leaves the battlefield, create five 1/1 white Clown Robot artifact creature tokens. |

## attacks|research-only (6 cards)

- Governing CR: CR 508.3b: “Whenever [a player/permanent] is attacked” は attacker 宣言で誘発する。CR 508.3d は “Whenever [a player] attacks” を定義する。
- Draft attribution: `runtime-FN`
- Rationale: Curse 系の passive “enchanted player is attacked” と “opponents are attacked” を runtime が未対応。Mr. Foxglove は省略名の句点に対する正規表現の脆弱性候補。
- Proposed fix (not applied): runtime attack condition に passive attacked-subject と句読点を含むカード名を追加し、CR 508.4 の attacking/attacked 差は維持する。

| Oracle ID | Name | All mismatch keys | Relevant Oracle text |
| --- | --- | --- | --- |
| `ba0d3df2-3acf-46d7-8d64-8d67d1579adc` | Curse of Opulence | attacks\|research-only | Whenever enchanted player is attacked, create a Gold token. Each opponent attacking that player does the same. (A Gold token is an artifact with "Sacrifice this token: Add one mana of any color.") |
| `c6f76fa7-095e-4bfe-a38c-5c4531880880` | Curse of Verbosity | attacks\|research-only | Whenever enchanted player is attacked, you draw a card. Each opponent attacking that player does the same. |
| `6cbd36d9-de47-41b0-9ef4-a72ca01adccd` | Curse of Disturbance | attacks\|research-only | Whenever enchanted player is attacked, create a 2/2 black Zombie creature token. Each opponent attacking that player does the same. |
| `c2008ba9-00df-4607-ba0c-189af52033eb` | Mr. Foxglove | attacks\|research-only | Whenever Mr. Foxglove attacks, draw cards equal to the number of cards in defending player's hand minus the number of cards in your hand. If you didn't draw cards this way, you may put a creature card from your hand onto the battlefield. |
| `b6689782-08d8-48e1-a05d-cd040dfe85bc` | Curse of Bounty | attacks\|research-only | Whenever enchanted player is attacked, untap all nonland permanents you control. Each opponent attacking that player untaps all nonland permanents they control. |
| `8df7a58c-053f-4ead-a778-2747718e5f10` | Party Dude | attacks\|research-only | Whenever one or more of your opponents are attacked, up to one target attacking creature gets +X/+X until end of turn, where X is the number of cards in your hand. |

## draw|mixed (2 cards)

- Governing CR: CR 121.1 が draw を定義し、CR 121.5 は “draw” を使わない hand 移動を draw でないとする。CR 603.1 は trigger condition を要求する。
- Draft attribution: `granularity-allowance`
- Rationale: Trouble in Pairs は comma 列挙の “draws their second card” を runtime が落とし、Starving Revenant は接頭辞付きの真の “Whenever you draw a card” を research が落とす。逆方向の parser boundary 問題。
- Proposed fix (not applied): runtime は comma 列挙条件、research は数字を含む ability-word 接頭辞を処理する。単に draw を指示する action text と draw trigger condition は分離する。

| Oracle ID | Name | All mismatch keys | Relevant Oracle text |
| --- | --- | --- | --- |
| `f349f58b-8cc8-45e4-9565-2b46fdf976c9` | Trouble in Pairs | draw\|research-only | Whenever an opponent attacks you with two or more creatures, draws their second card each turn, or casts their second spell each turn, you draw a card. |
| `2ca969eb-3d79-4d1f-8d9d-7b8204ad166a` | Starving Revenant | draw\|runtime-only | When this creature enters, surveil 2. Then for each card you put on top of your library, you draw a card and you lose 3 life. / Descend 8 — Whenever you draw a card, if there are eight or more permanent cards in your graveyard, target opponent loses 1 life and you gain 1 life. |

## 225枚の完全性検算

| Cluster | Assigned cards |
| --- | ---: |
| `cast|runtime-only` | 70 |
| `enters|research-only` | 36 |
| `dies|runtime-only` | 33 |
| `attacks|runtime-only` | 29 |
| `enters|runtime-only` | 21 |
| `dies|research-only` | 15 |
| `leaves|runtime-only` | 13 |
| `attacks|research-only` | 6 |
| `draw|mixed` | 2 |
| **Total** | **225** |

検算結果: クラスタ合計 = 225。225 assigned cards = 225 report mismatch cards。全225枚が9クラスタへ重複なく分類された。

