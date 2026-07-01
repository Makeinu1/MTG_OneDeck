# Tier-1 findings: 判定者ラダー化(モデル非依存化)

対象変更: `CLAUDE.md` / `.claude/commands/{autoloop,audit,milestone,ship}.md` / `research/cr-grounding/cr-backbone-ledger.json`
実行者: 別 Codex/Sonnet セッション(冷たいセッション・実装文脈なし)想定の Tier-1 監査。`.claude/commands/audit.md` Tier-1 節 + 本タスク固有チェック(A〜E)に従い実行。
実行日: 2026-07-02

## A. 変更ファイル境界チェック — PASS

`git status --short` / `git diff --name-only` の出力は以下6件のみ。それ以外のファイル(`src/` を含む)への変更は検出されなかった。

```
.claude/commands/audit.md
.claude/commands/autoloop.md
.claude/commands/milestone.md
.claude/commands/ship.md
CLAUDE.md
research/cr-grounding/cr-backbone-ledger.json
```

staged 変更なし(working tree のみ)。

## B. 機械チェック4点 — PASS(4/4)

各個実行(`&&` 非連結)。

| チェック | コマンド | 結果 |
|---|---|---|
| lint | `npm run lint` | PASS(出力なし=エラー0件) |
| 型検査 | `npx tsc --noEmit` | PASS(出力なし) |
| テスト | `npx vitest run` | PASS — Test Files 102 passed (102) / Tests 1102 passed (1102) |
| build | `npm run build` | PASS — `tsc -b && vite build` 成功、`dist/` 生成確認後 `rm -rf dist` で削除済み |

コード変更が無いこと(項目A)と整合。テスト内容自体も無変更のため weakening 検出(diff上のテストファイル変更なし)は該当なし。

## C. cr-backbone-ledger.json 構造検査 — PASS

- JSON パース: 有効(`python3 -m json.tool` で確認)。
- **既存 domain 50件のうち、削除・追加は0件**(old 50 / new 50、id 集合が完全一致)。
- 保護フィールド `id`/`crRefs`/`lane`/`edhValue`/`status`/`evidence`/`nextGate` は **50件全てで変更なし**(diffなし)。
- 各 domain に追加されたのは `judge`(50件全件)と `judgeNote`(3件: `cr-903-9-commander-zone-choice` / `cr-604-611-612-613-layers-continuous` / `cr-614-615-616-replacement-prevention`)の**追加フィールドのみ**(意図された変更と一致)。
- 新規トップレベルキー `judgePolicy` を1件追加(`crVersion`/`status`/`object`/`purpose`/`domains`/`laneDefinitions`/`statusDefinitions` は無変更)。
- `plannedSequence` は既存4件を保持したまま、`type` フィールドを新規付与(`domain-slice`)、かつ新規3件(`cr-119-life` domain-slice、`checkpoint-mydeck-design-scoring` checkpoint、`cr-102-players`/`cr-500-514-turn-structure`/`cr-703-704-sba-turn-based` domain-slice)を追加。既存4件のうち唯一残った `cr-player-specific-zones` エントリの `note` 内容は変更なし(`type` 追加のみ)。
- `selectionRule` は文言拡張(STOP①フォールバック文言を追加)。既存の「plannedSequence優先→フォールバック→同点はSTOP」という骨格は保持。
- `provenance` は末尾に2026-07-02 の変更履歴を追記(既存文言は保持)。

いずれも意図された加筆的変更の範囲内であり、契約の実体(50 domain の分類・レーン・証跡)を書き換える変更は検出されなかった。

## D. 統制弱化の敵対検査(CLAUDE.md + コマンド4本) — PASS(弱化なし)

diff は主に **「Fable」→「判定者」の機械的な呼称置換**、および新設の「判定者ラダー」節(J1/J2/J3/J0 ティア表+judgePolicyへの参照)。以下の既存統制条項を1つずつ突き合わせ、全て**文言・意味とも保持**を確認:

- 独立監査の要石(「実装は誰が書いても凍結・信頼・最終コミット前に必ず独立監査を1回通す」) — 保持(CLAUDE.md「役割は能力で定義する」節、文言変更なし)。
- `/audit` 冒頭ゲート(未監査 `review.*`/`docs/` 変更の赤旗) — 保持(audit.md 冒頭、文言変更なし)。
- Codex の git 操作禁止 — 保持(CLAUDE.md「実装エージェント(Codex 含む)の git 操作は禁止」、milestone.md/autoloop.md の「Codex は…git 不可侵」)。
- Codex の `docs/`/`review.*`/`CLAUDE.md` 直接変更禁止(判定者在席時) — 保持。「`CLAUDE.md` は在席する最上位の Claude 判定者専有(判定者不在時でも Codex は触らない)」に更新されたのみで、禁止範囲は不変(むしろ主体をモデル名からラダーの席へ一般化=範囲は同一)。
- `/ship` の再委譲禁止ゲート(ステップ0「サブエージェントは `Agent` を呼ばない」「BLOCKED」報告義務) — 保持、文言不変。
- `/ship` no-op 失敗判定(再委譲・待機報告・commit SHA/`HEAD==origin/main`/CI/Pages 200/worktree clean 欠落) — 保持、文言不変。
- `-A` 禁止・明示ステージング・`git grep` による契約参照確認(除外前) — 保持、文言不変。
- pre-push gate 再検証・push後 SHA一致確認・CI監視(対象SHA一致)・Pages 200確認・完了条件(commit SHA等の報告必須) — ship.md 該当箇所は今回のdiffに含まれず(無変更)。
- autoloop STOP条件4類(①ロードマップ分岐 ②CR解釈の真の曖昧 ③不可逆・外部書込 ④Codex2連敗+外科修正/CI失敗) — 保持。番号・内容とも不変(主語が「Fable」→「判定者」に置換されたのみ)。
- 監査 Tier-1/Tier-2 の分業(委譲・findings only・契約は変えない・赤旗だけ裁定) — 保持、文言不変(主語置換のみ)。

**弱化方向の変更は検出されなかった**。むしろ新設の「判定者ラダー」表は「契約変更承認・凍結判定・アーキ判断」を明示的に「在席最上位の Claude 判定者」に固定し、「照合に還元できず確信が持てなければ STOP→ユーザー」という統制強化の文言を追加している。

軽微な指摘(統制ではなくテキスト品質。findings only につき本監査では修正しない):
- `CLAUDE.md:39` 「コミットはレビュー合格後に 判定者が行う」に機械置換由来の二重スペースが残存。
- `CLAUDE.md:46` 「ship 後に 判定者が実 git/CI/Pages を独立検証し」に同様の二重スペース。
- `.claude/commands/audit.md:23` 「委譲先に測らせ 判定者は数値だけ判定」に同様の二重スペース。
  いずれも意味・統制に影響しない書式上の残留物。

## E. 手順書の自己完結性(後継判定者=Sonnet 目線) — PASS(重大な曖昧・循環・実行不能なし)

- `judgePolicy.reference` は CLAUDE.md「判定者ラダー」節を指し、CLAUDE.md 側のラダー定義(J1/J2/J3/J0)と ledger 側の `judgePolicy.reference` 文言が完全一致(J1 Fable〜2026-07-07 / J2 Opus 4.8 / J3 Sonnet 5 / J0 不在)。相互参照は一方向(ledger→CLAUDE.md)で、循環参照ではない。
- `judgePolicy.values.deterministic-cr` は CLAUDE.md の判断種別表「決定論的CR裁定…| J3」と整合。`user-stop` は同表「価値判断…| ユーザー」/autoloop.md STOP条件1と整合。
- autoloop.md の手順0〜7は、判定者不在時の代替主体(Codex)、委譲先(別Codex/Sonnet、Sonnet subagent)を明示しており、Sonnet が単独で読んでも次に取るべき行動(台帳lookup→Codex起動→Tier-1委譲→Tier-2裁定→ship委譲→独立検証→handoff)を機械的に辿れる。
- audit.md Tier-1/Tier-2 は「判定者=CLAUDE.md『判定者ラダー』の在席最上位 Claude(Tier-2 の最低ティアは J3=Sonnet で足りる)」と明記しており、Sonnet 自身が Tier-2 を実行してよい根拠が自己完結している(CLAUDE.md 未読でも「J3=Sonnet」の一文で足りる)。
- ship.md は判定者の呼称変更のみで、実行手順(0〜7)自体は無変更(diff確認済み)。既存の自己完結性(具体的コマンド・成功条件の列挙)がそのまま維持されている。
- 軽微な観察: `plannedSequence` に `type: "checkpoint"` エントリ(`checkpoint-mydeck-design-scoring`)が今回初めて登場するが、`selectionRule` は「type=checkpoint はコード無しマイルストーンとして同様に消費する」と明記しており、後継判定者が読んでも扱いに迷わない。曖昧なし。

## 総括

| 項目 | 結果 |
|---|---|
| A. 変更ファイル境界 | PASS |
| B. 機械チェック4点 | PASS(4/4) |
| C. ledger構造(既存フィールド不可侵) | PASS |
| D. 統制弱化の敵対検査 | PASS(弱化なし) |
| E. 手順書の自己完結性 | PASS(重大な問題なし) |

**赤旗: 0件。** 軽微指摘(二重スペース3箇所、修正不要・findings only)のみ。契約・コードへの変更はこの監査では一切行っていない。
