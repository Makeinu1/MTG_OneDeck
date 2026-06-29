# MTGオラクル文 定型文法レポート

対象: MTG_OneDeck / M6.1 基盤調査  
作成日: 2026-06-20 JST  
ローカル検証データ: `research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json`

## 要旨

結論は明確で、Scryfall の `keywords` フィールドは「そのカード/面がそのキーワード能力を持つ」ことの正本にはできない。`Odric, Blood-Cursed` は代表例で、Scryfall `keywords` には `Deathtouch` など10語が入っているが、Oracle本文ではそれらは「能力の種類数を数えるための列挙」であり、Odric 自身は1つも保有していない。

分類器は、キーワード語の単純一致ではなく、CR 207/113/6xx/701/702 に沿って「テキストボックスの段落」「reminder text」「純キーワード行」「have/gain の主語」「from among の数え上げ」「with/has の参照」を分ける必要がある。推奨仕様では Odric は `ownedKeywords = []`、一方で `trigger: enters` と `keywordAction: create token` は検出する。

## 参照ソース

一次情報:

- Wizards 公式ルールページ: https://magic.wizards.com/en/rules
- Comprehensive Rules TXT, effective 2026-04-17: https://media.wizards.com/2026/downloads/MagicCompRules%2020260417.txt
- 日本公式サイト「マジック総合ルール（和訳 20260417.2 版）」: https://mtg-jp.com/gameplay/rules/docs/0006836/

M-CR-RECONCILE note(2026-06-26): 最新正本は Comprehensive Rules effective 2026-06-19 (`rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json`)。本レポートは 2026-04-17 CR で生成された研究資産であり、Power-up/Teamwork/Preparation/Heal など 2026-06-19 差分の根拠には使わない。

補助情報:

- MTG Wiki: Oracle: https://mtg.fandom.com/wiki/Oracle
- MTG Wiki: Keyword ability: https://mtg.fandom.com/wiki/Keyword_ability
- MTG Wiki: Ability word: https://mtg.fandom.com/wiki/Ability_word
- MTG Wiki: Reminder text: https://mtg.fandom.com/wiki/Reminder_text
- Wizards / Mark Rosewater, "Even More Words with R&D" (keyword / keyword action / ability word / templating のR&D用語): https://magic.wizards.com/en/news/making-magic/even-more-words-rd-2022-01-10

CR番号の主要根拠:

- Oracle正本: CR 108.1
- テキストボックス/reminder/ability word/flavor word: CR 207.1, 207.2a-d
- 能力と段落: CR 113.1a, 113.2c, 113.3a-d
- 起動型能力: CR 602.1, 113.3b
- 誘発型能力: CR 603.1, 603.4, 603.6a
- 常在型能力: CR 604.1, 113.3d
- 置換効果: CR 614.1a-d
- `enters` 短縮形: CR 700.15
- キーワード処理: CR 701.1
- キーワード能力: CR 702.1, 702.1a-d

## 1. テキストボックス構造

CR上の根拠:

- CR 207.1 はテキストボックスをカード下半分の領域とし、通常そこにカードの能力を定義するルール・テキストがある。
- CR 207.2a は reminder text を、能力に関係するルールを要約する括弧内の斜体テキストとする。
- CR 207.2c は ability word を「能力の冒頭にある斜体語」とし、特別なルール上の意味を持たないとする。
- CR 207.2d は flavor word もルール上の意味を持たないとする。
- CR 113.2c は、カードのテキストでは一部のキーワード能力を同一行に連結できること、また段落区切りが原則として別能力を示すことを定める。
- CR 702.1 はキーワード能力を、長い能力を名前だけで示す省略表現として定義する。

ローカル実例:

- `Ornithopter`: `oracle_text` は `Flying` だけ。これは1段落の純キーワード行。
- `Serra Angel`: `Flying\nVigilance ...`。Scryfall `oracle_text` の `\n` は能力段落の境界として使える。
- `Aang, Swift Savior // Aang and La, Ocean's Fury`: `card_faces` の各 face が独立した `oracle_text` を持つ。面単位で処理し、カード全体へ雑に連結しない。
- `Odric, Blood-Cursed`: 1段落の誘発型能力であり、キーワード列挙は同一文内の数え上げ。

標準テンプレートとしては、現代Oracleでは「先頭にキーワード能力行群、その後に能力段落」が多い。ただしこれは絶対条件ではない。`Absolute Virtue` は `This spell can't be countered.` の後に `Flying` が置かれている。したがって分類器は「先頭行だけ」を見るのではなく、全段落を面単位で走査し、純キーワード行かどうかを構造的に判定する。

## 2. キーワード能力の定型

CR上の根拠:

- CR 702.1: キーワード能力は能力名だけで長いルールを表す。
- CR 702.1a: `[keyword ability] cost` は、そのキーワードの可変コストだけを指す。
- CR 702.1b: 効果がキーワード能力を付与する場合、そのキーワード内の変数は継続的に再評価されうる。
- CR 702.1c: `the same is true for ...` のような列挙付与は、変種や変数を含むキーワード能力にも及ぶ。
- CR 702.1d: `with [keyword ability]` と `has [keyword ability]` は「そのキーワード能力を持つオブジェクト」を参照する表現である。

### 2.1 純キーワード行

純キーワード行とは、reminder text を除いた段落が、CR 702 のキーワード能力節だけで構成される段落である。カンマ区切りの列を許す。

ローカル実例:

- `Ornithopter`: `Flying` -> 保有 `Flying`
- `Abigale, Eloquent First-Year`: `Flying, first strike, lifelink` -> 保有3件
- `Aang and La, Ocean's Fury`: `Reach, trample` -> 保有2件
- `Akroma, Angel of Fury`: `Flying, trample, protection from white and from blue` -> `Protection` の値句を含む

reminder text は同じ行に続くが、保有判定では括弧部分を無視する。

例: `Storm Crow` の `Flying (This creature can't be blocked except by creatures with flying or reach.)` は、括弧外の `Flying` だけを保有とし、括弧内の `flying` / `reach` は reminder として無視する。

### 2.2 表記形グループ

CR 702 は 2026-04-17 時点で 191 個のキーワード能力を定義している。ローカルの既存CR語彙抽出では、このうち17個は対象データに出現しなかった。分類器の辞書は「ローカル出現語だけ」ではなく、CR 702 の全キーワード名を持つべきである。

| 形 | 例 | CR例 | 実カード例 | パース方針 |
|---|---|---:|---|---|
| 裸キーワード | `Flying`, `Trample` | 702.9, 702.19 | `Ornithopter`: `Flying` | 完全一致。カンマ列可。 |
| カンマ区切り列 | `Flying, first strike, lifelink` | 113.2c, 702 | `Abigale, Eloquent First-Year` | 段落全体がキーワード節列なら全て保有。 |
| コストつき | `Cycling {2}`, `Equip {3}`, `Flashback {3}{R}` | 702.29, 702.6, 702.34 | `+2 Mace`, `Agonasaur Rex` | キーワード名 + コスト部を1節として認識。 |
| 値つき | `Annihilator 2`, `Toxic 1`, `Mobilize 2` | 702.86, 702.164, 702.181 | `Kozilek, Butcher of Truth`, `Voice of Victory` | キーワード名 + 数値/`X`/`N` を保持。 |
| 値+コスト+ダッシュ | `Suspend 3-{cost}`, `Reinforce N-{cost}`, `Impending N-{cost}` | 702.62, 702.77, 702.176 | `Search for Tomorrow`, `Overlord of the Hauntwoods` | `-` と `—` の両方を正規化。 |
| 品質/対象句つき | `Protection from white`, `Enchant creature`, `Affinity for artifacts` | 702.16, 702.5, 702.41 | `Animar, Soul of Elements`, `Abundant Growth` | `from/for/enchant` 以降をパラメータとして保持。 |
| 変種名 | `Islandwalk`, `Swampwalk`, `Basic landcycling` | 702.14, 702.29 | `Adrestia`, `Bog Wraith`, `Ash Barrens` | CR上の親キーワードへ正規化し、表記値も残す。 |
| 起動型キーワード | `Boast - {cost}: ...`, `Exhaust - [Cost]: ...`, `Station` | 702.142, 702.177, 702.184 | `Usher of the Fallen`, `Evendo, Waking Haven` | コロンを含むがCR 702辞書でキーワード能力として認識。 |
| 代替コスト系 | `Kicker`, `Overload`, `Foretell`, `Plot`, `Warp`, `Sneak` | 702.33, 702.96, 702.143, 702.170, 702.185, 702.190 | `Aang's Journey`, `Saw It Coming`, `Outcaster Trailblazer` | 保有能力だが、支払い済み状態の検出は別レイヤー。 |
| レイアウト/特殊カード系 | `Level up`, `Prototype`, `Station`, `Read ahead` | 702.87, 702.160, 702.184, 702.155 | `Wizard Class`, `Cityscape Leveler` | 通常段落だけでなく、特殊レイアウト情報と併用。 |
| ルール語だが保有でないもの | `create`, `sacrifice`, `exile`, `scry`, `mill` | 701 | `Odric, Blood-Cursed`, `Preordain` | キーワード処理として別分類。 |
| ability word / flavor word | `Landfall -`, `Delirium -`, `Probing Telepathy -` | 207.2c-d | `Tireless Provisioner`, `Aboleth Spawn` | それ自体は保有キーワード能力ではない。 |

キーワード能力の代表的なパラメータ形:

- コスト: `Equip {3}`, `Cycling {2}`, `Flashback {3}{R}`, `Ninjutsu {2}{U}`, `Foretell {1}{U}`, `Plot {2}{G}`, `Warp {1}{W}`
- 数値: `Annihilator 2`, `Toxic 1`, `Afflict 3`, `Mobilize 2`, `Devour 2`
- 品質: `Protection from black`, `Hexproof from monocolored`, `Enchant land`, `Affinity for artifacts`
- 組み合わせ: `Suspend 3-{G}`, `Impending 4-{2}{W}`, `Reinforce 2-{1}{W}`
- 句全体: `Gift a card`, `Partner with [name]`, `Splice onto Arcane {1}{U}`, `[quality] offering`

## 3. 保有 vs 非保有の判別規則

### 3.1 保有

保有として扱うのは、原則として次のどれか。

- face の rules text にある純キーワード行。
- CR 702 のキーワード能力として定義された起動型/誘発型/常在型キーワード節。
- 自身を主語にした `has`/`gains`/`with` が、現在の継続効果としてそのオブジェクトに能力を与える場合。ただしこれは「印刷された独立キーワード行」と区別し、`conditionalSelfGrant` など別分類にする。

実例:

- `Ornithopter`: `Flying` -> 印刷保有 `Flying`
- `+2 Mace`: `Equip {3}` -> 印刷保有 `Equip`
- `Saw It Coming` 日本語印刷: `予顕{1}{U}...` -> 印刷保有 `Foretell`
- `Faceless Haven` 日本語印刷: `...警戒...を持つ４/３のクリーチャーになる` -> 起動後に自己へ `Vigilance` を持たせる効果であり、カードの常時保有ではない

### 3.2 付与

`have` / `has` / `gain(s)` は、CR 113.1a が明示するように、効果が能力を付与するときによく使われる。分類器は主語を読む必要がある。

実例:

- `Akroma's Memorial`: `Creatures you control have flying, first strike, vigilance, trample, haste, and protection from black and from red.`  
  -> Memorial 自身は保有0。あなたのクリーチャーへ複数キーワードを付与。
- `Aerial Guide`: `Flying` は自身の保有。`another target attacking creature gains flying until end of turn` は別クリーチャーへの一時付与。
- `Acrobatic Leap`: `Target creature ... gains flying until end of turn.`  
  -> 呪文自身の保有ではなく対象への一時付与。
- 日本語 `Kaya the Inexorable`: `それは「...飛行を持つ...トークン１体を生成する。」を得る。`  
  -> 対象クリーチャーが引用内の誘発型能力を得る。引用内の `飛行` は生成されるトークンの能力で、Kaya自身の保有ではない。

### 3.3 数える

`number of abilities from among ...` は、CR 702.1d の「has/with は参照できる」という構造に近いが、ここでは語が能力名の列挙オペランドとして使われているだけである。

実例:

- `Odric, Blood-Cursed`: `the number of abilities from among flying, first strike, double strike, ... found among creatures you control`  
  -> Odric は listed keywords を保有しない。コントロールしているクリーチャー群に見つかる能力種類数を数える。

### 3.4 参照

`with [keyword]`, `that has [keyword]`, `creature with flying`, `can't be blocked by creatures with flying or reach` などは参照であり、語の出現先が能力を保有しているとは限らない。

実例:

- `Airship Crash`: `Destroy target artifact, enchantment, or creature with flying.`  
  -> `flying` は対象条件。
- `Abzan Ascendancy`: `create a 1/1 white Spirit creature token with flying.`  
  -> 生成されるトークンが `Flying` を持つ。ソースカードは保有しない。
- `Storm Crow`: reminder text 内の `creatures with flying or reach` は reminder の説明であり、保有判定対象外。

### 3.5 `can't be countered`

`can't be countered` はキーワード能力ではない。CR 113.6g は「打ち消されない/コピーされない」と書かれた能力がスタック上で機能することを扱うが、CR 702 のキーワード能力ではない。

実例:

- `Abrupt Decay`: `This spell can't be countered.` -> 静的/呪文能力。保有キーワード0。
- `Absolute Virtue`: `This spell can't be countered.` と `Flying` が別段落。`Flying` は保有、uncounterable はキーワード能力ではない。

### 3.6 Odric の明示追跡

`Odric, Blood-Cursed` の Oracle:

```text
When Odric enters, create X Blood tokens, where X is the number of abilities from among flying, first strike, double strike, deathtouch, haste, hexproof, indestructible, lifelink, menace, reach, trample, and vigilance found among creatures you control. (Count each ability only once.)
```

分類手順:

1. faceは通常カード1面。
2. 段落は1つ。
3. reminder text `(Count each ability only once.)` を分離。
4. 段落先頭が `When ... enters,` なので CR 603.1/603.6a の誘発型能力。
5. `create X Blood tokens` は CR 701.7 の create 系キーワード処理。
6. `number of abilities from among ...` にあるキーワード名は `countOperand`。
7. 純キーワード行は0。

結論:

- `ownedKeywords`: `[]`
- `mentionedKeywords/countOperand`: `flying`, `first strike`, `double strike`, `deathtouch`, `haste`, `hexproof`, `indestructible`, `lifelink`, `menace`, `reach`, `trample`, `vigilance`
- `abilityTypes`: `triggered(ETB)`
- `keywordActions`: `create token`

## 4. 能力種別の定型

CR上の根拠:

- CR 113.3a-d は spell ability / activated / triggered / static の4分類を定める。
- CR 602.1 と CR 113.3b は起動型能力を `cost: effect` 型とする。
- CR 603.1 と CR 113.3c は誘発型能力を `When/Whenever/At ..., ...` 型とする。
- CR 603.4 は intervening `if` 節を扱う。
- CR 603.6a は `When [this object] enters, ...` を enters-the-battlefield trigger とする。
- CR 604.1 と CR 113.3d は常在型能力を文として真である能力とする。
- CR 614.1a-d は `instead`, `skip`, `enters with`, `as ... enters`, `enters as` などの置換効果を定める。
- CR 701.1 はキーワード処理を、通常言語ではなくゲーム用語として定義された動詞群とする。

検出テンプレート:

| 種別 | 英語テンプレート | 日本語テンプレート | 実例 |
|---|---|---|---|
| 誘発型 | `When/Whenever/At ..., ...` | `〜とき`, `〜たび`, `〜開始時` | `Odric`: `When Odric enters, ...` |
| ETB誘発 | `When [this] enters, ...` | `戦場に出たとき` | `Eternal Witness`, `Odric` |
| 起動型 | `[cost]: [effect]` | `[コスト]：効果` | `+2 Mace` reminder, `Usher of the Fallen`: `誇示 ― {1}{W}：...` |
| 忠誠度能力 | `+1:`, `-3:` | `+1：`, `-3：` | `Kaya the Inexorable` |
| 常在型 | 文として常に真 | 文として常に真 | `Abrupt Decay`: `This spell can't be countered.` |
| 置換効果 | `if ... would ... instead`, `as ... enters`, `enters with` | `代わりに`, `戦場に出るに際し`, `状態で戦場に出る` | `Adrix and Nev`: token replacement |
| キーワード処理 | `create`, `sacrifice`, `exile`, `search`, `shuffle`, `destroy`, `mill`, `scry` | `生成する`, `生け贄に捧げる`, `追放する`, `探す`, `切り直す`, `破壊する`, `切削する`, `占術` | `Odric`: `create X Blood tokens` |
| カードを引く | `draw` | `引く` | `Preordain`, `Mind Stone` |

注意: `draw` は頻出処理だが、CR 701 のキーワード処理ではなく CR 121 の「カードを引くこと」として扱う。

## 5. 日本語の対応定型

日本語ソース:

- 日本公式CRページは、英語を正文とし、2026-04-17 のComprehensive Rulesを和訳したものと明示している。
- 同ページ CR 700.15 の訳注は、日本語版カードテキストでは従来どおり主に `戦場に出る` を使うと説明している。

ローカルデータ上の制約:

- `printed_text` を持つカードは30件。
- ただし `lang=ja` は6件だけだった。残りは英語の別名印刷やファイレクシア語風データを含む。
- したがって日本語文法は、公式和訳CRを主根拠にし、ローカルカード例は極小サンプルとして扱う。

日本語実例:

- `Nicol Bolas` printed_text: `飛行` -> 純キーワード行。
- `Saw It Coming`: `予顕{1}{U}（...）` -> キーワード能力 + 全角括弧 reminder。
- `Usher of the Fallen`: `誇示 ― {1}{W}：...（...）` -> キーワード能力 `Boast`、全角コロン `：`、全角括弧 reminder。
- `Faceless Haven`: `{S}{S}{S}：...警戒...を持つ...クリーチャーになる。` -> 起動型能力の解決で自己へ `Vigilance` を持たせる。
- `Kaya the Inexorable`: `飛行を持つ...トークン１体を生成する` -> 生成トークンの能力。Kayaの保有ではない。

日本語パーサーの最小対応:

- 改行で段落分割。
- `（...）` を reminder として分離。
- `：` を起動型能力のコロンとして扱う。
- `―` / `—` / `-` を能力語・キーワード能力の区切りとして正規化。
- `持つ` / `得る` の主語を読む。主語が `クリーチャー`, `それ`, `トークン`, `あなたは`, `紋章` などの場合、ソースカード保有にしない。
- `生成する`, `追放する`, `打ち消す`, `唱える`, `引く` などは行動/効果として別分類。

## 6. 推奨パースアルゴリズム仕様

### 6.1 入力単位

1. `card_faces` があり face に `oracle_text` がある場合は face 単位で処理する。
2. それ以外は card-level `oracle_text` を1 face として処理する。
3. 分類結果は `cardId + faceIndex` に紐づける。
4. `printed_text` は日本語表示/補助検証用であり、英語Oracle正本の代替にしない。

### 6.2 正規化

1. 改行は保持する。
2. 空白は比較時だけ畳む。
3. 英語は大文字小文字を無視する。
4. 日本語は全角/半角コロン、ダッシュ、括弧を正規化する。
5. 括弧内 reminder を `reminder` セグメントとして分離する。EN `(...)`、JA `（...）` の両方。
6. 引用符内の能力文は `quotedAbility` として別コンテキストに入れる。引用を直接ソースカードの保有能力にしない。

### 6.3 段落分割

1. face text を `\n` で段落分割する。
2. CR 113.2c により、段落は原則として能力単位。
3. 例外として、CR 702 のキーワード能力は同一行に複数連結されうる。

### 6.4 純キーワード行検出器

1. 段落から reminder を除去する。
2. ability word / flavor word 形式 `Label - rules text` は、`Label` が CR 702 のキーワード能力でない限り純キーワード行にしない。
3. カンマで節分割する。ただし `protection from white and from blue` の `and` は節内パラメータとして保持する。
4. 各節が CR 702 辞書に一致するか、CR 702 の定義済み変種に一致する場合のみ純キーワード行。
5. 一節でも失敗したら、その段落全体を文能力として扱う。

疑似仕様:

```text
parseFace(face):
  paragraphs = split(face.oracle_text, "\n")
  for paragraph in paragraphs:
    segments = splitReminderAndQuotes(paragraph)
    core = segments.outsideReminderOutsideQuote
    if isPureKeywordLine(core):
      emit owned_printed_keyword for each keyword clause
      continue
    classifyAbilitySentence(core, segments)
```

`isPureKeywordLine` の認識対象:

- CR 702 の正規名: `Flying`, `Ward`, `Protection`, `Cycling`, ...
- 小文字/大文字差: `first strike` -> `First Strike`
- 変種: `Islandwalk` -> `Landwalk(value=Island)`, `Basic landcycling` -> `Cycling(variant=Basic landcycling)`
- コスト: mana symbol列、tap symbol、life payment、discard/sacrifice等の可変コスト文字列
- 数値: `N`, `X`, 数字
- ダッシュ: `-`, `—`, `―`

### 6.5 非保有パターン

優先順位は reminder/quote/context を先に判定し、最後に語彙一致を行う。

| 分類 | ENパターン | JAパターン | 例 | 結果 |
|---|---|---|---|---|
| reminder | inside `(...)` | inside `（...）` | `Storm Crow` reminder | ignore for ownership |
| count | `number of abilities from among ...` | `能力/種類数`, `中から` | `Odric` | `countOperand` |
| grant-have | `[objects] have [keyword list]` | `[対象]は...を持つ` | `Akroma's Memorial` | recipient grant |
| grant-gain | `[object] gains [keyword]` | `[対象]は...を得る` | `Acrobatic Leap` | recipient grant |
| created token | `create ... token with [keyword]` | `...を持つ...トークンを生成する` | `Abzan Ascendancy`, `Kaya` | token ability |
| reference | `creature with flying`, `object that has ...` | `...を持つクリーチャー` | `Airship Crash` | filter/reference |
| uncounterable | `can't be countered` | `打ち消されない` | `Abrupt Decay` | static/spell ability, not keyword |

### 6.6 能力種別テンプレート

英語:

- Triggered: `^(When|Whenever|At)\b.+,`
- ETB: `\b(When|Whenever)\b.+\benters\b`
- Activated: colon outside reminder/quote, with cost-like text on the left
- Static: not activated/triggered, includes pure keyword line and declarative sentences
- Replacement: `would ... instead`, `as ... enters`, `enters with`, `enters as`
- Keyword action: CR 701 verb dictionary

日本語:

- Triggered: `とき`, `たび`, `開始時`
- Activated: `：` outside reminder/quote
- Static: `〜である`, `〜できない`, `〜持つ`, 純キーワード行
- Replacement: `代わりに`, `戦場に出るに際し`, `状態で戦場に出る`
- Keyword action: `生成する`, `生け贄に捧げる`, `追放する`, `探す`, `切り直す`, `破壊する`, `切削する`, `占術`

### 6.7 Odric トレース

推奨アルゴリズムでの結果:

```json
{
  "card": "Odric, Blood-Cursed",
  "ownedKeywords": [],
  "keywordMentions": {
    "countOperand": [
      "flying",
      "first strike",
      "double strike",
      "deathtouch",
      "haste",
      "hexproof",
      "indestructible",
      "lifelink",
      "menace",
      "reach",
      "trample",
      "vigilance"
    ]
  },
  "abilityTypes": ["triggered:enters"],
  "keywordActions": ["create token"]
}
```

## 7. 検証と限界

### 7.1 ローカル照合結果

ローカルファイルの集計:

- cards: 17,491
- faces: 18,134
- oracle text を持つ faces: 18,077
- `printed_text` を持つ cards: 30
- `lang=ja` かつ `printed_text` を持つ cards: 6
- 既存CR語彙抽出: CR 702 keyword abilities 191件、CR 701 keyword actions 67件

試作の構造スキャン結果:

- 純キーワード段落: 約8,012段落
- 純キーワード段落を持つ faces: 約6,991
- 純キーワード段落を持つ cards: 約6,908
- 純キーワード節: 約8,933
- `have` 系の付与候補: 約254 cards
- `gains` 系の付与候補: 約1,303 cards
- `number of abilities from among` 検出: `Odric, Blood-Cursed` のみ
- `with [keyword]` 系の参照/トークン候補: 約904 cards
- `can't be countered`: 約75 cards
- `create ... token(s)`: 約2,624 cards
- ETB trigger候補: 約3,736 cards

これらは調査用の正規表現スキャンであり、最終実装の受け入れ値ではない。ただし、素朴な語彙一致と比べて、Odric 型の誤検出を排除する方向性は確認できた。

### 7.2 必須サンプル判定

| サンプル | Oracle断片 | 期待分類 |
|---|---|---|
| バニラ飛行: `Ornithopter` | `Flying` | `ownedKeywords=["Flying"]` |
| アンセム: `Akroma's Memorial` | `Creatures you control have flying, ...` | sourceの `ownedKeywords=[]`; recipient grant |
| can't be countered: `Abrupt Decay` | `This spell can't be countered.` | keyword保有0; static/spell ability |
| Odric | `number of abilities from among ...` | keyword保有0; countOperand; ETB + create-token |

### 7.3 既知の誤検出と扱い

- Scryfall `keywords` には、CR 702キーワード能力以外に `Treasure`, `Food`, `Landfall`, `Magecraft`, `Role token`, `Transform`, Universes Beyondの flavor words などが混ざる。これは所有判定には使わない。
- `protection from` は、純キーワード行なら保有、`Creatures you control have protection from ...` なら付与、`You have protection from ...` ならプレイヤー能力、`with protection from ...` なら参照になる。
- `with flying` は、生成トークンの能力、対象条件、reminder text の説明の3種類がある。名詞句のヘッドを読む必要がある。
- `has` は自己保有、他オブジェクト付与、状態参照の3通りがある。主語なしでは判定しない。
- 引用符内の能力は、その引用を得るオブジェクトの能力であり、ソースカード自身の能力ではないことが多い。
- ability word / flavor word はダッシュで始まるため、`Boast -` などのCR 702キーワード能力と混同しやすい。必ずCR 702辞書で判別する。
- `Scryfall keywords` はカード単位であり、face単位ではない。両面/分割/当事者カードで誤集約が起きる。

### 7.4 残存曖昧性

- Oracle本文だけでは、ゲーム中の継続効果・レイヤー・タイムスタンプにより「現在そのオブジェクトが能力を持つか」を完全には決められない。
- `This creature has ... as long as ...` のような自己条件付き保有は、常時保有とは別に扱う必要がある。
- `becomes a ... with flying` は、その効果解決後のオブジェクトへの付与であり、カード印刷キーワードではない。MTG_OneDeck がどの時点をUI表示したいかで分類ラベルを分ける必要がある。
- 日本語ローカル例は6件しかなく、網羅的な日本語文法検証は不可能。日本語は公式和訳CRのテンプレートと英語Oracle分類の補助表示として扱うのが安全。
- 特殊レイアウト、Attraction、Station、Class、Saga、Leveler、Prototype などは本文だけでなくレイアウト情報を併用した方が安全。
- Un-系、Universes Beyond固有の flavor word、acorn要素、代替名印刷は Scryfall `keywords` をさらに汚すため、CR 702/701辞書とローカル本文構造を優先する。

## 実装担当への短い仕様メモ

1. `keywords` フィールドを「候補語」以上に使わない。
2. face単位で `oracle_text` を段落分割する。
3. reminder/quote を先に除去・分離する。
4. CR 702辞書 + パラメータ形で純キーワード行を検出する。
5. `have/gain/with/from among/can't be countered/create token` を別分類にする。
6. Odric の受け入れ条件は `ownedKeywords=[]`, `triggered:enters=true`, `createToken=true`。
