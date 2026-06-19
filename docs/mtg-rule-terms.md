# MTGルール用語まとめ

この文書は MTG_OneDeck のルール補助を設計するための用語整理である。完全なルール解説ではなく、「どの用語をアプリの状態・コマンド・警告・候補提示に落とすか」を決めるための分類表として使う。

参照:
- Magic公式 Rules ページ: `https://magic.wizards.com/en/rules`
- Magic: The Gathering Comprehensive Rules TXT: `https://media.wizards.com/2026/downloads/MagicCompRules%2020260417.txt`
- 参照CR版: 2026-04-17 effective
- ローカル分析: `research/scryfall-rules/2026-06-19/analysis/cr-term-analysis.md`

## 1. 最重要の分け方

MTGの本文は、似た単語でもルール上の性質が違う。分類器はまず次の層に分ける。

| 層 | 例 | アプリでの扱い |
|---|---|---|
| ゲーム状態 | object, card, permanent, token, spell, ability, counter, mana, life | `GameState` / `CardInstance` / `ManaPool` に対応 |
| ゾーン | library, hand, battlefield, graveyard, stack, exile, command | `zones` と `moveCard` 系コマンドに対応 |
| ターン/タイミング | phase, step, priority, special action, state-based action | 原則は警告/表示。完全な優先権処理はしない |
| コスト | mana cost, additional cost, alternative cost, cost reduction | 自動適用せず、支払いUI/警告/強行に接続 |
| 能力種別 | activated, triggered, static, mana, loyalty | activated/triggered は stack候補、static は助言中心 |
| 効果種別 | one-shot, continuous, replacement, prevention, copy, text-changing | one-shotのみ自動化候補。continuous/replacement は助言 |
| キーワード処理 | create, sacrifice, search, shuffle, mill, scry, surveil | 既存/追加コマンドに接続しやすい |
| キーワード能力 | flying, haste, equip, cycling, flashback等 | 表示/警告/候補。能力ごとに扱いを変える |
| 能力語 | landfall, magecraft, revolt等 | ルール意味は本文側。誘発候補のラベルとして扱う |

## 2. GameStateに落とす用語

以下はアプリが明示的な状態として持つ価値が高い。

| 用語 | 意味の要点 | 現状/方針 |
|---|---|---|
| card | 実カード。トークンや能力オブジェクトと区別する | `CardDef` / `CardInstance` |
| object | スタック上の呪文、戦場のパーマネント、能力などを含む広い概念 | UIではカード/能力/コピーに分けて扱う |
| permanent | 戦場にある artifact/creature/enchantment/land/planeswalker/battle等 | `zone === 'battlefield'` |
| token | カードでないパーマネント | battlefield外へ移動時に消滅 |
| spell | スタック上のカード/コピー | `zone === 'stack'` |
| ability | 起動/誘発/常在など | stack上の能力オブジェクトは `isAbility` |
| counter | カード上/プレイヤー上のカウンター | `counters` / poison/energy/experience |
| mana | マナプール内の支払い資源 | `ManaPool` |
| damage | ライフ/統率者ダメージ/戦闘補助 | 完全なダメージ記録は未実装。必要時に手動反映 |

## 3. ゾーン用語

| ゾーン | 実装対応 | 備考 |
|---|---|---|
| library | `zones.library` | top = index 0 |
| hand | `zones.hand` | 手札表示/キャスト候補 |
| battlefield | `zones.battlefield` | パーマネント、トークン、カウンター、タップ状態 |
| graveyard | `zones.graveyard` | リアニメイト/回収候補 |
| stack | `zones.stack` | 呪文/能力/コピーをLIFOで扱う |
| exile | `zones.exile` | 追放から唱える/戻す候補 |
| command | `zones.command` | 統率者、統率税 |

outside the game, ante, sideboard, attraction/planar等は M6 の自動化対象外。必要なら手動ゾーン/助言で扱う。

## 4. 能力種別

| 種別 | 典型表記 | 自動化方針 |
|---|---|---|
| activated ability | `cost: effect` | ユーザー操作で stack に積む。コスト支払いは候補/警告 |
| triggered ability | `when`, `whenever`, `at` | 自動解決しない。イベント後に「誘発候補」として出す |
| static ability | 文として常時効く | M6では助言/警告。レイヤー計算はしない |
| mana ability | マナを加える能力 | 既存 `tapForMana` / `addMana` に接続 |
| loyalty ability | プレインズウォーカーの忠誠度能力 | 忠誠カウンター増減 + ability stack候補 |
| spell ability | instant/sorcery resolving text | 解決時の候補アクションとして扱う。自動解決はしない |

## 5. 効果種別

| 種別 | 例 | 扱い |
|---|---|---|
| one-shot effect | draw, create, destroy, exile, search | もっとも自動化しやすい |
| continuous effect | `gets +1/+1`, `creatures you control have...` | 原則助言。パワー計算など限定補助のみ |
| replacement effect | `if ... would`, `instead`, `as ... enters` | 自動適用しない。警告/選択肢表示 |
| prevention effect | `prevent damage` | 自動適用しない |
| copy effect | copy spell/permanent/token | 既存コピー補助に接続。ただしコピー可能値の厳密処理はしない |
| text-changing effect | text box/name/type変更 | M6では対象外 |
| control-changing effect | gain control/exchange control | 手動移動/助言。所有者・コントローラ分離は未実装 |

## 6. キーワード処理(701系)

保存済み17,491枚の分析では、EDH上位3000で特に重いキーワード処理は以下。

| 処理 | CR | 件数 | EDH上位3000 | 扱い |
|---|---|---:|---:|---|
| Cast | 701.5 | 3,781 | 571 | 半自動。通常キャスト/ゾーン外キャスト/代替コストを分ける |
| Create | 701.7 | 2,965 | 422 | 半自動。トークン内容はユーザー確定 |
| Sacrifice | 701.21 | 2,487 | 403 | 半自動。対象選択が必要 |
| Exile | 701.13 | 2,500 | 304 | 半自動。戻る期限や追放元に注意 |
| Shuffle | 701.24 | 785 | 214 | 自動化しやすい |
| Search | 701.23 | 675 | 199 | 半自動。フィルタ/公開/移動先をユーザー確定 |
| Destroy | 701.8 | 995 | 179 | 半自動。破壊不能/再生は警告 |
| Discard | 701.9 | 999 | 140 | 自動化しやすいがランダム/選択を分ける |
| Activate | 701.2 | 943 | 131 | stack候補。コスト支払いは別処理 |
| Reveal | 701.20 | 712 | 118 | 表示補助 |
| Play | 701.18 | 386 | 76 | 土地プレイ/呪文キャストに分岐 |
| Counter | 701.6 | 225 | 50 | stack上の呪文/能力を取り除く候補 |
| Scry | 701.22 | 299 | 41 | 既存占術UIに接続 |
| Mill | 701.17 | 268 | 36 | 既存 `mill` に接続 |
| Attach | 701.3 | 322 | 34 | 既存 `attach` に接続 |
| Proliferate | 701.34 | 82 | 31 | 既存 `proliferateAll` を候補化 |

注意:
- `counter` は「打ち消す」と「カウンター」の両方に出る。分類器では `counter target spell` 等と `+1/+1 counter` を必ず分離する。
- `play` は「土地をプレイ」と「カードをプレイ(唱える/土地)」を分ける。
- `create` は数・色・タイプ・P/T・タップ状態・攻撃状態を解析できない場合、トークン生成ダイアログへ渡す。

## 7. キーワード能力(702系)

Scryfall `keywords` で拾える。アプリでは能力ごとに扱いを変える。

| 能力 | CR | 件数 | EDH上位3000 | 扱い |
|---|---|---:|---:|---|
| Flying | 702.9 | 1,844 | 211 | 表示/戦闘助言 |
| Trample | 702.19 | 616 | 77 | 表示/戦闘助言 |
| Equip | 702.6 | 411 | 75 | 装備候補 |
| Enchant | 702.5 | 458 | 49 | 付与先候補 |
| Flash | 702.8 | 423 | 46 | タイミング助言 |
| Vigilance | 702.20 | 508 | 45 | 攻撃時タップ回避に利用済み/拡張 |
| Cycling | 702.29 | 224 | 43 | 既存サイクリングを拡張 |
| Lifelink | 702.15 | 283 | 41 | 戦闘後ライフ調整候補 |
| Indestructible | 702.12 | 81 | 38 | destroy時警告 |
| Haste | 702.10 | 399 | 36 | 召喚酔い判定に利用 |
| Deathtouch | 702.2 | 251 | 31 | 戦闘/破壊助言 |
| Ward | 702.21 | 182 | 20 | 対象時警告 |
| Flashback | 702.34 | 137 | 17 | 墓地から唱える候補 |
| Crew | 702.122 | 158 | 10 | タップ/搭乗候補 |
| Kicker | 702.33 | 109 | 9 | 追加コスト警告/選択 |
| Overload | 702.96 | 17 | 9 | 代替コスト警告/選択 |
| Convoke | 702.51 | 79 | 8 | コスト支払い助言。自動タップは慎重に |
| Prowess | 702.108 | 57 | 6 | 誘発候補 |
| Unearth | 702.84 | 41 | 3 | 墓地から戦場へ + 遅延追放候補 |
| Plot | 702.170 | 39 | 3 | 追放/後続キャスト候補 |

## 8. 能力語

能力語はCR上の能力そのものではなく、本文パターンのラベルとして扱う。Scryfall `keywords` には能力語も入るため、分類器は `keyword ability` と混ぜない。

| 能力語 | 実装方針 |
|---|---|
| Landfall | land battlefield entry後の誘発候補 |
| Magecraft | instant/sorcery cast/copy後の誘発候補 |
| Revolt | このターンに自分のパーマネントが離れたかの状態が必要。M6では助言 |
| Morbid | このターンにクリーチャー死亡が必要。M6では助言/候補 |
| Delirium / Threshold | 墓地状態の集計が必要。表示/助言から開始 |
| Domain | 基本土地タイプ数の集計。比較的実装可能 |
| Constellation | enchantment ETB後の誘発候補 |
| Raid / Battalion / Pack tactics | 攻撃状態が必要。戦闘補助と合わせる |

## 9. 自動化リスク分類

| リスク | 例 | 方針 |
|---|---|---|
| A: 決定的プリミティブ | draw, mill, discard, shuffle, add/remove counters | 既存コマンドで実行候補 |
| B: 対象選択つき一括処理 | create, sacrifice, destroy, exile, search, attach | ユーザー確定後に単一undoで実行 |
| C: 誘発候補 | ETB, attack, death, upkeep, landfall, prowess | 自動で積まず、候補から stack へ |
| D: コスト/タイミング警告 | kicker, overload, flashback, convoke, ward | 自動適用しない。警告/選択UI |
| E: 助言のみ | target legality, replacement, continuous effects, layers, APNAP | 盤面変更しない。LLMジャッジも助言のみ |

## 10. M6分析への反映

以後の分析は次の順に行う。

1. この文書の分類に沿って、公式CRの概念、701キーワード処理、702キーワード能力を正規タグ化する。
2. Scryfall `keywords` を keyword ability / keyword action / ability word / resource token へ分離する。
3. Oracle text からETB、死亡誘発、唱えた時誘発、対象依存、置換/継続効果を補助検出する。
4. 現在デッキ内カードを `CardDef` 単位で分類し、`edhrec_rank` で重み付けする。
5. 自動化リスク A-E を付け、M6実装候補を並べる。

優先順位は「件数」ではなく「現在デッキで出るか」「EDHでよく使うか」「安全に既存コマンドへ落とせるか」で決める。
