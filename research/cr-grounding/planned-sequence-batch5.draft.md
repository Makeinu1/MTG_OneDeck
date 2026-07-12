# plannedSequence batch5 候補ドラフト(スコーピング担当=Sonnet、2026-07-12)

不可侵ゆえ本ファイルは新規作成のみ。`docs/`・`review.*`・台帳・`src/` は無変更(読取のみ)。**選定・裁定はしない**——判定者(判定者席)が優先度式で選ぶための根拠付き候補列挙。

## 0. 前提: demand計器の信頼性(spot-check結果)

`research/mydeck-scoring/summary.md`/`report.json`/`gaps.json` は 2026-07-12 08:26 生成(commit 8476488 score-ts修復後の再生成物であることを `git log -1 --format=%ci -- research/mydeck-scoring/summary.md` で確認=repair後の数値)。ただし repair 後も `missingDemandCounts` の絶対数(`tap-state:write` 85 / `mana:write` 56 等)は依然高い——これは **repair が「9 family の coverage 判定精度」を直したのであって「絶対 count が真の gap」であることを意味しない**(ledger 既知 follow-up `score-ts-credit-nonability-paths` = fetch/keyword/mana-ability 等の別 engine 経路が引き続き未 credit)。

本ドラフトは `research/cr-grounding/score-ts-demand-catalog-repair.draft.md` §8(2026-07-07 Sonnet監査)が抽出した **5つの genuine gap クラスタ**(demand-first・cross-cutting)を基礎にし、各クラスタについて `src/engine/grammar/compile.ts`(および `src/engine/commands.ts`)を実際に読んで**コード上の欠落を確認**(spot-check)した上で `gaps.json`(398行)から実例件数を数え直した。数値は「MyDeck 4デッキ内の実例件数」であり compile.ts 直読で裏取り済み=classifier-backed 相当の信頼度として扱ってよい(絶対数の上限性はなお残るため、より広い17,491枚コーパスでは各クラスタの実件数はこれより大きい可能性が高い、特にクラスタ5)。

---

## 候補1(最優先): 自己完結ループ効果の可変数(cluster2・自己限定"discard any number/that many"型)

- **domainId**: `cr-121-drawing`(draw側)+ `cr-701-keyword-actions-frequent`(discard側)の共有プリミティブ拡張。CR条番号: 121.1/121.2(draw)・701.9(discard)・**608.2h**(X/可変値の解決タイミング)。
- **現status/lane**: `cr-121-drawing`=implemented-not-green / backbone。`cr-701-keyword-actions-frequent`=shipped / leaf-compiler。
- **demand数値**: `gaps.json` 実例19件(Celes, Rune Knight/Tersa Lightshatter/Fable of the Mirror-Breaker/Naktamun Lorespinner 等の "discard N, draw that many"系loot)。**信頼度=compiler直読で確認済み**(`src/engine/grammar/compile.ts:1149-1157` の `resolveCount` は `count.kind==='one'|'fixed'` のみを解決し `variable`/`that-many`/`up-to` はすべて `null`→`needs-choice`→manual に落ちることをソースで確認。over-report ではなく真の gap)。全体 `missingDemandCounts.action:draw`(39)/`action:discard`(31)の一部を構成。
- **edhValue**: high(loot効果はEDHで最頻出の自己完結パターンの一つ)。
- **依存の解放状況**: **依存なし=即着手可**。自己(P1)完結の効果のみで、`cr-player-specific-zones`/opponent系のいかなる未解放依存にも触れない。既存の guided prompt 機構(discard選択 + 選んだ枚数を draw count に反映)を組み合わせるだけ。
- **スコープ提案**: `resolveCount` に `variable-self-referential` 種別を追加(新 `CountSpec.kind`。既存 `GameCommand` 型は無変更=discard は既存 `discard` command の cardIds 選択、draw は既存 `draw` command の count に選択枚数を代入)。パターン=「discard {up to} N cards, then draw that many {plus/minus} K cards」の厳密文字列一致のみ auto詐称なし対応。「for each」「X where X=」等のより一般的な可変値は honest manual のまま(次イテレーション)。新規GameState/GameCommand不要=分解可能性テストPASS。
- **judge種別**: `deterministic-cr`(CR608.2hを引けば裁定可。J3で自走可)。

---

## 候補2: クロスプレイヤー効果の実行(cluster1・"each opponent/each player/that player"型)

- **domainId**: 主 `cr-121-drawing`(draw)。cross-cutting で `cr-701-keyword-actions-frequent`(discard/sacrifice)・`cr-119-life`(life-loss)・`cr-120-damage`(damage)にも同型ギャップあり。CR条番号: 608.2(効果解決・プレイヤー参照)・121.2c(draw順序)・701.9/701.21a・119/120。
- **現status/lane**: 上記4 domain とも shipped または implemented-not-green(backbone/leaf-compiler混在)。
- **demand数値**: `gaps.json` 実例48件(Tataru Taru "target opponent may draw"/Accursed Marauder "each player sacrifices"/Magus of the Wheel・Naktamun Lorespinner "each player discards, draws seven"/Gau "Gau deals damage to each opponent" 等)。**信頼度=compiler直読で確認済み**: `src/engine/grammar/compile.ts:995-1019` の `hasSupportedPlayerSubject` は draw/gain-life/lose-life/mill/poison/energy/experience いずれも「you」主語のみ許可し、`DRAW_UNSUPPORTED_RECIPIENT_OR_CONDITION` 正規表現(`opponents?|target players?|each players?|that players?|any players?|may`)が真の場合は honest manual 化する設計(cr121.2c honesty guardが直近で強化)。
- **edhValue**: high。
- **依存の解放状況**: **部分的に解放済み・台帳に不整合あり(要判定者確認)**。`src/engine/types.ts:62-63` で `PlayerId = 'P1' | 'OPPONENT_A'` かつ `ZonesByPlayer`(`zonesByPlayer.OPPONENT_A`)が既に実体を持つ(`cr-102-players` の S-ZONES 出荷=2026-07-05・engine-spec §34.17)ことを確認。しかし別 domain `cr-player-specific-zones`(status=`drafted`・lane=late-backbone)の boundary は「実装(zonesByPlayer 実体)未着手ゆえ status=drafted」と記述——これは **cr-102-players で実際に出荷済みの内容と矛盾しており stale の疑い**(fetchland-slice-shipped の教訓と同型=台帳の複数箇所に同じ実体の記述が分岐)。実コード側は `src/engine/commands.ts:3515` の `draw` command ハンドラが `drawCards(draft, count)` で **P1固定**(playerId引数なし)、`applyPlayerLifeDelta`(commands.ts:1378)も `draft.state.life` P1固定であることを確認=**OPPONENT_A への draw/discard/life-loss command 実行経路は未実装**(zonesByPlayerという「保存形」はあるが「書き込み経路」がない)。つまり `cr-player-specific-zones` の nextGate が言う I22(per-player draw/mill/search isolation)は依然未着手が正しく、この候補はまさにその第一歩に当たる。
- **スコープ提案**: `draw`/`discard`/`mill`/`adjustLife` の各 `GameCommand` に **既存型への additive `playerId?: PlayerId`**(省略時 P1 = 後方互換)を追加し、`hasSupportedPlayerSubject` を「対象が P1 または単一の識別可能な OPPONENT_A のときのみ auto/guided」まで拡張。複数対戦相手・"each opponent"の N>1 一般化は 2-entity モデルの範囲外ゆえ honest manual のまま(engine が元々 2-entity=P1+ダミー対戦相手 のサンドボックスである既存境界に収まる)。**分解可能性テスト**: 既存コマンド型へのフィールド追加のみ(新規コマンド型・新規GameStateフィールドではない=zonesByPlayer実体は既存)ため J3 相当と考えられるが、「GameCommand の意味変更(P1固定→プレイヤー可変)」という性質上、判定者が§5.1の基準に照らして J2 相当と判断する可能性もある=**要判定者確認**。
- **judge種別**: `deterministic-cr` だが、上記の台帳矛盾(`cr-player-specific-zones` stale)の裁定と、コマンド意味拡張の抽象昇格テスト適用は判定者確認を推奨。

---

## 候補3: 非search型reanimation/returnのtapped修飾子(cluster3の残渣)

- **domainId**: `cr-400-408-zones-lki`(reanimation leaf拡張)。関連=`cr-110-permanents`(tap status write、既存プリミティブとして再利用)。CR条番号: 400.7・701.17(return)・服カード個別。
- **現status/lane**: `cr-400-408-zones-lki`=shipped / backbone。`cr-110-permanents`=shipped / backbone。
- **demand数値**: `gaps.json` で `tapped`/`battlefield tapped` 系実例46件だが、その大半(Fabled Passage×3/Path to Exile/Grixis Panorama等)は **既に `cr-701-fetchland-search`(shipped)で解決済みのはずのカード**——census が fetch専用経路を未creditする既知盲点(follow-up `score-ts-credit-nonability-paths`)に一致。純粋な残渣は「target/all の graveyard→battlefield tapped」型のみ=実例約8-10件(Skeleton Crew "Return this card...to the battlefield tapped"/Alesha, Who Smiles at Death "return target creature card with power 2 or less...tapped and attacking"/Terra, Herald of Hope 同型/Aftermath Analyst "Return all land cards...tapped")。**信頼度=fetch経路の既知over-report分をspot-checkで除外した後の推定値**(exact件数はカード個別にfetchAbility経路と重複していないか要確認だが、これらは fetchland 起動型能力でなく別カードの起動/誘発能力ゆえ fetch経路とは無関係=genuine gap)。
- **edhValue**: high(Reanimator系戦略の頻出パターン)。
- **依存の解放状況**: **解放済み**。既存 reanimation guided leaf(`isExactGraveyardCreatureReturn`)+ 既存 tap-status write(`setTapped`)を組み合わせるだけで、新規依存なし。
- **スコープ提案**: 既存 `isExactGraveyardCreatureReturn` の厳密一致パターンに「... to the battlefield tapped」「... to the battlefield tapped and attacking(attacking部分は manual 継続)」variant を追加し、guided prompt 確定時に `moveCard` の後続で `setTapped(true)` を additive 発行(**新規GameCommand型なし**=既存2コマンドの合成)。"return all land cards"(mass変種)は候補4と重複するため本候補では対象外(単体targetのみ)。
- **judge種別**: `deterministic-cr`(既存2leafの合成=分解可能性テスト即PASS)。

---

## 候補4: 自己参照(非"target"文言)の+1/+1系カウンター付与(cluster5)

- **domainId**: `cr-122-counters`(guided counter-plus leaf拡張)。CR条番号: 122.1。
- **現status/lane**: implemented-not-green / backbone。
- **demand数値**: `gaps.json` 実例4件(Gau, Feral Youth "Rage — Whenever Gau attacks, put a +1/+1 counter on it."/Alesha, Who Laughs at Fate 同型)。**信頼度=compiler直読で確認済み**: `src/engine/grammar/compile.ts:1349`(`isSingleTargetClause`)は `\btarget\b` の出現を必須としており、"put a +1/+1 counter on it"(it=自身)は正規表現不一致で `guidedTargetPrompt` が `null` を返し manual に落ちることをソースで確認。**MyDeck census内は4件だが、"Rage"型の自己参照keyword能力は17,491枚コーパス全体では非常に頻出な慣用句(Ferocious/self-buff系)と推定され、絶対数の下限として扱ってよい**(over-reportでなくunder-representedの可能性)。
- **edhValue**: high(生物中心の攻撃的デッキで頻出する自己強化パターン)。
- **依存の解放状況**: **解放済み・依存なし**。既存 `counterDescriptorForRaw`(符号/量解析は既にshipped済み・±1/+1のみ対応=cr-122の既知境界のまま)をそのまま再利用。
- **スコープ提案**: `effect.counter-plus` に限定した自己参照検出(パターン=「put a/an <count> <±1/+1> counter(s) on it」で `it` が同一クローズ内に他の対象名詞句を持たない=ability sourceへの自己適用と確定できる厳密形のみ)を `guidedTargetPrompt` に追加し、target選択なしで直接 `addCounters(sourceCardId, ...)` を emit。「it」が他オブジェクト参照の曖昧ケース(修飾節を挟む等)は honest manual に fail closed。新規GameCommand/GameStateなし(既存 `addCounters` command 再利用)。
- **judge種別**: `deterministic-cr`(CR122.1一致・低リスク=分解可能性テスト即PASS)。

---

## 候補5(優先度低め): 質量/盤面全体効果(cluster4・destroy all/each 等)

- **domainId**: 新規サブスコープが必要——既存 `cr-115-targets`(target legality)や `cr-506-510-combat` とは別軸。ledger内に直接対応するdomainIdなし=**判定者が新規domain新設 or 既存domainへの吸収を判断する必要**(候補としてのみ提示。私は新規domain作成の裁定権を持たない)。CR条番号: **609**(一回性効果・定義済み集合への適用)。
- **現status/lane**: 該当なし(未着手領域)。
- **demand数値**: `gaps.json` 実例5件(Ruinous Ultimatum "Destroy all nonland permanents your opponents control"/Culling Ritual/Pernicious Deed/Ascend from Avernus/Aftermath Analyst一部)。**信頼度=compiler直読で確認済み**: `src/engine/grammar/compile.ts:157-169` の `TARGET_REQUIRED_ATOMS` に `effect.destroy` が含まれ、"all"/"each" 文言は単一target前提の経路を通れず manual に落ちる設計を確認。件数は少ないが**EDHの定番ボードワイプ(除去)カテゴリ**ゆえ製品価値は高いと推測されるが、MyDeck 4デッキでの実測は5件のみ=demand軸としては他候補より弱い。
- **edhValue**: high(ただし実測demand数が最小)。
- **依存の解放状況**: 解放済み(既存 `moveCard`/`applyDealDamage` 等プリミティブへ、コンパイル時に判明する対象集合(filter一致する現battlefield object群)に対して**複数個の既存単体effectコマンドを生成時に展開**すれば新規コマンド型は不要=分解可能性テストPASS の見込みだが、「フィルタ一致集合を盤面状態から求めてN個のコマンドを生成時に確定する」設計は他candidateより設計コストが高い。
- **judge種別**: `deterministic-cr`(CR609一致)だが、**新規domain新設の要否自体はSTOP①相当ではないが判定者確認を推奨**(scope新設は軽微な価値判断を含みうる)。

---

## 依存グラフの要点

```
cr-102-players (shipped: zonesByPlayer 保存形 + P1/OPPONENT_A 実体)
   └─ blocks(部分的に解除済み)→ cr-player-specific-zones (status=drafted; ただしI17-I21相当はcr-102-playersで実は出荷済み=stale記述の疑い)
         └─ nextGate I22(per-player draw/mill/search isolation) ← 候補2 がまさにこの一歩
         └─ nextGate I23(per-opponent commander damage exact) ← 候補2の範囲外(別途)

候補1(自己完結loot可変数) ─ 依存なし・即着手可
候補3(reanimation tapped) ─ 依存なし(cr-400-408 + cr-110 既存プリミティブのみ)
候補4(自己参照カウンター) ─ 依存なし(cr-122 既存プリミティブのみ)
候補2(クロスプレイヤー) ─ zonesByPlayer実体はcr-102-playersで解放済みだが、
                          draw/discard/life command側のplayerId配線は未実装
                          =「保存形はある・書込み経路がない」を判定者が確認要
候補5(mass effects) ─ 依存なし・ただし新規domain新設要否が判定者マター
```

## 同点判定

demand数値(19/48/8-10/4/5)はいずれも異なり、真の同点は無し。edhValueは全候補 `high` で同値だが、demand降順で優先度式は一意に決まる(候補2[48] > 候補1[19] > 候補3[8-10] > 候補5[5] > 候補4[4])。**ただし候補1は依存皆無・低リスクで候補2より着手が容易**なため、「demand降順」を機械的に適用すると候補2が最優先になるが、候補2には未解決の台帳矛盾(stale `cr-player-specific-zones`)と抽象昇格テストの要確認事項があるため、**判定者が候補1を先に処理し候補2は依存確認後に着手する順序も選択肢としてありうる**——これは価値判断ではなく実行順序の技術的判断であり、判定者(J3)の裁量内と考えられる。

## 既存低優先項目(再掲・新規起草不要)

- `score-ts-credit-nonability-paths`(既存plannedSequence末尾・tooling-fix・低優先=北極星③メタ)。本ドラフトの候補2・候補3の census 数値がこの計器欠陥の影響を受けている(fetch/keyword経路over-report)ことを再確認したのみで、対応不要・現状維持。

## 除外(user-stop・候補外)

以下は`judge:user-stop`マーク済みの pruned lane domain。母集団から除外(判定者は単独裁定しない):
`cr-20260619-new-vocabulary-boundary` / `cr-123-stickers` / `cr-309-dungeons` / `cr-311-315-variant-objects` / `cr-407-ante` / `cr-717-attractions` / `cr-901-904-905-casual-variants` / `cr-subgames-restart-sideboard` / `cr-810-two-headed-giant` / `cr-310-battles-deferred-by-demand` / `cr-731-day-night-deferred-by-demand` / `cr-725-726-monarch-initiative-deferred-by-demand` / `cr-303-704-roles-deferred-by-demand` / `cr-714-sagas-deferred-by-demand` / `cr-716-719-720-721-722-new-card-frames-deferred-by-demand` / `cr-728-rad-counters-deferred-by-demand`。**計14件を候補外としてフラグ**。
