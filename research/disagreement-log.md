# Disagreement Log(批評者 = もう一つの物差し)

> `engine-design-method.md` §8.2-5 の規定。decorrelated な批評(別主体・cold)とその Fable 処分を
> 蓄積し、批評者の**軸別信頼度を較正**する(=§4-4 物差し校正を批評者へ適用)。
> 一致は弱い陽性、不一致が発見。狙いは合意でなく不一致の表出。

## 凡例
- **分類**: `{correctness / consistency / scope-gap / strategic}`(§8.2-2)
- **処分**: 採用 / 却下 / 保留(+理由)
- **自信度**: 批評側が示した確度(High/Med/Low)。接地(artifact 引用)の有無も記す。

---

## DL-001(2026-06-24)— iter3 実行中 decorrelated 別 LLM の戦略批評

**起動点**: §8.1「このプログラム全体の資源配分は誤っている、と論証せよ」を別主体へ出した(M-CONTRACT 凍結判定の直前=重い高度レビューのゲート)。**批評者 = 別 LLM(peer 級・cold)**。原文と本ログは `docs/` の改訂で受領。

| # | 異議(要約) | 接地 | 分類 | 自信度 | Fable 処分 | 理由 |
|---|---|---|---|---|---|---|
| 1 | 分類の収束と**実行意味論**が未接続。「初期盤面+コマンド列→イベント→誘発→スタック→SBA→盤面」を測る golden replay が要る | method.md:77(yardstick #4 名のみ)・harness 全て分類専用 | strategic | High | **採用** | 全計測器が分類のみ=実行の正しさを誰も測っていない。method §5-5・spec §34.7 に実行計測を契約化。Codex B1 で器を建てる |
| 2 | 「低 churn = 収束」は危険。**独立物差しを当てても崩れない低 churn**だけが収束 | engine-state-ontology.md churn 0.05%→13.55% 崩壊 | correctness | High | **採用(最重要)** | 構造的 FN(ability-word)は毎反復同一に取りこぼし churn が立たない。method §4 churn 定義を改訂し precedent 化・凍結条件3へ反映 |
| 3 | 非LLM参照物差し(Forge/XMage・人間 gold)が弱い。LLM-oracle が唯一の独立物差し=相関リスク | method.md:75(名のみ未使用)・81-83(自己警告) | scope-gap | High | **採用** | method §3 で「凍結前は非LLM物差し必須(助言→要件)」へ昇格。凍結条件4。Codex B3 で Forge 差分の現実性調査 or 人間 gold 雛形 |
| 4 | 研究分類器と runtime 分類器が分離・別々に劣化。parity テスト 0 | eventClassify.ts ⇄ ruleClassifier.ts(parity 0 件確認) | consistency | High | **採用** | method §3「分類器 parity」節新設・凍結条件6(乖離=0)。Codex B2 で parity 計測器 |
| 5 | 変数増減モデルは不十分。MTG の本体は**いつ読むか/オブジェクト同一性/置換前後/タイムスタンプ** | ESO 列が値中心 | correctness | Med | **採用** | architecture §2.1 を新設(read-timing/object-identity を第一級属性へ)。Slice3/4 設計指針 |
| 6 | Slice2 observer 6.40% を閉じよ | event-oracle report(批評時点) | scope-gap | Med(陳腐化) | **陳腐化(却下せず)** | 批評は iter3 実行*中*に書かれた。iter3 完了(commit bcec4ed)で observer **0.00%**/family 0.49%。指摘自体は正しく、既に解決済み |

**処分集計**: 採用 5 / 陳腐化 1 / 却下 0 / 保留 0。

**批評者較正(軸別)**: correctness 2/2 採用・strategic 1/1 採用・consistency 1/1 採用・scope-gap 1 採用+1 陳腐化。
**全異議が接地あり(artifact 引用)**=捏造なし。この批評者の**信頼度は全軸で高**(初回サンプル)。
特に correctness 軸(#2 churn・#5 read-timing)は自己計測の盲点を正面から突いており、§8.1 の decorrelated レビューが
機能した実例。次回以降も M-CONTRACT 凍結ゲート前に同型の批評を別主体へ発注する。

**産んだ歯(§8.1-150 義務=閾値/ゲートを最低1つ動かす)**: 凍結ゲート 3条件 → **7条件**、churn 定義の改訂、
非LLM物差しの要件昇格、分類器 parity の契約化。**演劇ではない**(数値とゲートが動いた)。
