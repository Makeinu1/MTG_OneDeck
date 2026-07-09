# D1「デザインシステム+カードシート」独立 Tier-1 監査 findings

**監査主体**: 冷たい Sonnet サブエージェント(実装文脈なし)。findings only・契約/コード変更なし。
**対象コミット前差分**: `git status --short` 時点(未コミット作業ツリー)。
```
 M docs/design-playbook.md
 M docs/design-system.md
 M src/components/playmat/Playmat.test.tsx
 M src/components/playmat/Playmat.tsx
 M src/index.css
?? src/components/game/  (actionCatalog.ts, CardActionSheet.tsx, CardActionSheet.css, __tests__/review.d1-action-catalog.test.ts)
?? src/ui/tokens.css
```
**契約参照**: `docs/design-playbook.md` §3 D1 実行カード + §4 裁量境界表 / `docs/ui-architecture-v2.md` §2〜§4 / `docs/design-system.md` §2〜§8。

---

## 0. 機械4点(独立再実行)

| チェック | 結果 |
|---|---|
| `npm run lint` | ✅ green(exit 0・エラー/警告出力なし) |
| `npm run build`(`tsc -b && vite build`) | ✅ green(exit 0・81 modules・255ms) |
| `npx vitest run` | ✅ green — **174 test files / 1504 tests 全通過**(review.d1-action-catalog.test.ts 含む) |

確認済み: 機械4点は異常なし。

---

## 1. 🔴 赤旗 — 統率者税ラベルが実際の UI に反映されない(actionCatalog の label が死コード)

**severity: 赤旗(契約違反・実装バグ)**
**該当**: `src/components/playmat/Playmat.tsx:1125-1162`(`buildSheetModel`)・`src/components/game/actionCatalog.ts:256-267`(`buildCardActionCatalog` 統率領域ブロック)

`design-playbook.md` §3 D1(a)(3) の**判定者確定済み**優先度表(「変更はJ2」)は明記している:
> 優先1: 統率領域の統率者→「唱える(統率者税+n)」

`actionCatalog.ts:257` は正しくこれを計算する:
```ts
const taxLabel = commanderTax > 0 ? `唱える(統率者税 +${commanderTax})` : '唱える(スタック)';
specs.push({ id: 'cast-to-stack', label: taxLabel, ... });
```
しかし `buildSheetModel`(Playmat.tsx:1132-1151)は次のように **spec の `label` を一切使わず、`id` だけで旧 `buildMenuItems` の `MenuItem` に "join" している**:
```ts
const { title, items } = buildMenuItems(cardId);       // ← items[].label は旧ロジックのまま
const specs = buildCardActionCatalog({ ... }).specs;    // ← specs[].label は taxLabel 込みだが未使用
const itemByKey = new Map(items.map((item) => [item.key, item]));
const rankedItems = rankActions(specs)
  .map((spec) => itemByKey.get(spec.id))                // ← label は itemByKey 側(旧buildMenuItems)から来る
  .filter((item): item is MenuItem => item !== undefined);
```
`buildMenuItems`(Playmat.tsx:988-1000)の統率領域ブロックは**税を含まない固定文字列**を返す:
```ts
if (card.zone === 'command' && isCommander(state!, cardId)) {
  items.push({ key: 'cast-to-stack', label: '唱える(スタック)', ... }); // ← タックス表示なし・固定
```
`CardActionSheet.tsx` の `ActionRow` は `item.label`(= `rankedItems[i].label`)をそのまま描画する(`{item.label}`)。したがって **実際にユーザーへ表示されるボタン文言は常に「唱える(スタック)」であり、統率者税がいくらであっても「唱える(統率者税 +n)」にはならない**。`actionCatalog.ts` の `taxLabel` 計算はコード上は存在するが、レンダリングパスには到達しない**死コード**。

**なぜ review.d1 が緑でも検出できないか**: `review.d1-action-catalog.test.ts:120-134` は `buildCardActionCatalog` を**直接**呼び出して `ranked[0]?.label` を検証しており(`expect(ranked[0]?.label).toContain('統率者税 +4')` は単体では正しく通る)、`buildSheetModel` を経由した統合パス(実際の label 差し替え)を一切検証していない。純関数の孤立テストが「実装は正しい」という偽の安心感を与えている。

**docs 側の乖離記録の有無**: 同差分中の `docs/design-system.md` §8 追記(D1・2026-07-10 実装ノート)は「マナ支払可否は既定 true」の乖離のみ記録しており、この税ラベル欠落については**一切言及がない**。playbook §4「モック⇄実装乖離の規則」(黙認乖離の禁止)に反する未記載の乖離。

**再現手順**(静的トレースで確定・実行不要なほど明確だが実機確認を推奨): 統率者税>0のデッキで統率領域から《任意の統率者》を右クリック/タップしシートを開く→先頭ボタンの文言が「唱える(スタック)」のままであることを確認。

---

## 2. 🔴 赤旗 — フラグ OFF 経路(ContextMenu ロールバック)が自動テストで一切検証されていない

**severity: 赤旗(design-playbook §3 D1(f) リスク処方の不履行)**
**該当**: `src/components/playmat/Playmat.tsx:82`(`USE_V2_SHEET = import.meta.env.VITE_UI_V2_SHEET !== 'false'`)・`Playmat.test.tsx` 全体

design-playbook §3 D1(f)は明記: 「フラグOFF経路の回帰→review.\*はフラグ両値で回す」。

`grep -rn "VITE_UI_V2_SHEET"` を `Playmat.test.tsx` / `review.d1-action-catalog.test.ts` / vite.config / .env* に対して実行した結果、**テストコード中に `VITE_UI_V2_SHEET` への言及が一件も無い**。vitest 実行環境では `import.meta.env.VITE_UI_V2_SHEET` は未設定(`undefined`)であり、`undefined !== 'false'` は常に `true` と評価される。つまり **`Playmat.test.tsx` の全テスト(既存+D1適応6件を含む)は常に `USE_V2_SHEET=true`(シート経路)のみを通り、`ContextMenu` への切り戻し経路(`VITE_UI_V2_SHEET=false`)は自動テストで一度も踏まれていない**。

これは D1 が明示的に要求したリスク対策の不履行であり、もし旧 `ContextMenu` 経路(Playmat.tsx:1396-1403)に D1 の変更(`buildMenuItems` はそのまま維持されているため直接的な破壊は考えにくいが、周辺の import/型変更等)による回帰が入っていても、機械4点は検出できない状態。実際に壊れているという証拠はないが、**検証ギャップそのものが契約違反**。

**処方(Tier-2への提案。Tier-1はfindings onlyにつき実施せず)**: `Playmat.test.tsx` の `dispatchContextMenu` を使うテスト群のうち最低1〜2件を `vi.stubEnv('VITE_UI_V2_SHEET', 'false')` 等で複製し、ContextMenu 経路でも同じ操作が到達可能なことを確認するテストを追加。

---

## 3. 🔴 赤旗(要 J2 確認) — ロック済み優先度表「優先5」が無断で別ルールに置換されている

**severity: 赤旗(判定者確定済みテーブルの無承認変更)**
**該当**: `src/components/game/actionCatalog.ts:36-43`(`ACTION_PRIORITY`)・`docs/design-playbook.md` §3 D1(a)(3)

design-playbook §3 D1(a)(3) は明記(このブロックは「判定者確定済み・変更はJ2」と明記):
> 優先5: 戦場の起動型能力持ち→先頭の能力起動 / 優先6: タップ済み土地・その他→「タップ/アンタップ」。

実装の `ACTION_PRIORITY` は:
```ts
export const ACTION_PRIORITY = {
  commanderCast: 100, tapForMana: 90, playLand: 80,
  handCast: 70, fetchActivate: 60, untapLand: 55,
} as const;
```
優先5に割り当てられているのは `fetchActivate`(フェッチ起動)であり、`ability-activate`(起動型能力)には**どこにも `priority` が付与されていない**(`grep -n priority actionCatalog.ts` で確認済み。`ability-activate` は Playmat.tsx/actionCatalog.ts の両方で全戦場パーマネントに無条件で push されるだけの項目で、昇格ロジックの対象になっていない)。

`actionCatalog.ts` 冒頭のコメント(29-35行)は独自に「優先5 フェッチ起動」と書き換えており、playbook の「戦場の起動型能力持ち→先頭の能力起動」とは異なるルールを実装していることを implementer 自身は認識しているように見えるが、**この変更が J2 の承認を経たという記録がどこにもない**(`docs/design-system.md`・`docs/design-playbook.md` の当差分中の追記2箇所は felt エイリアスと canAffordCast 既定 true の2件のみで、優先5の置換には触れていない)。

**判定者への論点**: (a) 「起動型能力を持つか」を判定する既存分類器が無く実装困難だったための実務的代替か、(b) 単なる見落としか。いずれにせよ playbook の該当行自体が「変更はJ2」と明記した凍結事項である以上、**Tier-2(J2)による追認 or 元ルールへの是正の裁定が必要**。

---

## 4. 🟡 黄 — canAffordCast が本番経路で常に `true` 固定(D1 受け入れ基準「マナ不足の唱えるは昇格しない」が実質未達)

**severity: 黄(記録済み乖離だが影響範囲の確認要)**
**該当**: `src/components/playmat/Playmat.tsx:1143`

```ts
// 精密なマナ支払判定は D3(プレイ可能ハイライト selector)へ委譲。D1 は昇格既定 true。
canAffordCast: true,
```
`grep -rn "canAffordCast"` で確認した唯一の本番呼び出し箇所がこれであり、実ゲーム状態に基づくマナ計算を行う関数はコードベース中どこにも存在しない(既存の `canPay`/`canAffordCast` 系ユーティリティは無し)。

design-playbook §3 D1(a)(3)・D1(b) は「マナ不足の呪文→昇格されない」ことを review.\* 検証対象として明記しているが、review.d1 のテストは `canAffordCast: false` を**手動で注入**した場合のみ正しく振る舞うことを確認しており(pure function 単体では正しい)、**実際のゲーム画面では `canAffordCast` は常に `true` としてしか渡らないため、この受け入れ基準はプロダクションでは事実上検証不能かつ機能していない**(マナが足りない手札の呪文でも常に「唱える」が先頭に昇格し、`warn` 装飾も出ない)。

この乖離は `docs/design-system.md` §8 に**記録・自己承認済み**(「マナ支払可否…は D1 では既定true…精密なマナ計算はD3へ委譲」)であり、design-playbook §4 の J3 裁量範囲(「モックとの軽微乖離の記録承認」)に形式的には該当する。ただし影響が D1 の主要受け入れ基準1件を丸ごと無効化する規模であるため、「軽微」と言えるかは Tier-2 の判断を仰ぐべき。機能的な実害(誤操作)は無い(強行キャストは元々サンドボックス許容のため危険はない)。

---

## 5. 🟡 黄 — actionCatalog は「抽出+re-export」ではなく「独立した重複実装」

**severity: 黄(構造契約からの逸脱・ドリフトの根本原因)**
**該当**: `docs/ui-architecture-v2.md` §2 vs `src/components/playmat/Playmat.tsx:744-1118`(`buildMenuItems` 現存)+ `src/components/game/actionCatalog.ts:111-330`(`buildCardActionCatalog`)

`ui-architecture-v2.md` §2 の規律:
> カードシートのアクション列挙は既存 `buildMenuItems` のロジックを `src/components/game/actionCatalog.ts` に**純関数として抽出**して共用(Playmat からは当面 **re-export** で互換維持)。

実装では `buildMenuItems`(374行、Playmat.tsx:744-1118)は**そのまま丸ごと現存**しており、`actionCatalog.ts` の `buildCardActionCatalog` は同じ分岐ロジックを**独立に書き直した並行実装**(id/label/separator/danger/disabled を手で再現)である。「抽出して re-export」ではなく「複製して手動同期」になっている。`buildSheetModel` は両方を呼び、`id` だけで結合している(§1参照)。

このアーキテクチャ上の逸脱こそが finding #1(統率者税ラベルの死コード化)を生んだ直接の構造的原因であり、design-playbook §3 D1(f)が名指しで警告していた最大リスク「buildMenuItems 抽出時のクロージャ依存(store直参照)→引数化を徹底」とは異なる形だが、**同種の "2実装ドリフト" リスクが既に現実化している**ことを示す。今後 D2〜D4 でこの二重実装のどちらかにのみ手を入れる変更があれば同種の乖離が繰り返し得る。

**参考**: golden id 集合テスト(review.d1-action-catalog.test.ts:149-176)は `buildMenuItems` の実出力とは突き合わせておらず、**手書きの期待値リテラル**である(`buildMenuItems` が Playmat コンポーネント内のクロージャで外部からテストできないため)。したがって「actionCatalog が旧 buildMenuItems の全アクション id を保存している」という golden テストの主張は、真の並行比較ではなく**実装者が両方を目視で合わせ込んだ結果を書き写しただけ**であり、将来のドリフトを機械的に検出できない。

---

## 6. 🟡 黄 — CardActionSheet.css に生 px / 生 rgba が残存(トークン未定義の穴)

**severity: 黄(design-system.md §1「新規CSSに生hex/px禁止」への軽微違反)**
**該当**: `src/components/game/CardActionSheet.css`

```
16:  background: rgba(0, 0, 0, 0.4);          /* overlay scrim。design-system にトークン無し */
42:  min-width: 232px;                         /* popover 幅。--popover-w 等のトークン無し */
43:  max-width: 300px;
```
`border: 1px solid ...`(45/105/147行)の `1px` は一般的な hairline 慣行で許容範囲内と判断(design-system 自身も `--shadow-*` 等で生値を許容する前例あり)。しかし overlay scrim 色とポップオーバー幅は **design-system.md に対応トークンが存在しない**(仕様側の抜け)。実装者が生値で埋めたこと自体は妥当な現場判断だが、`docs/design-system.md` への1行追記(playbook §4 の乖離記録規則)が無い。

**確認済み**: `tokens.css` 自体は生 hex を含むが、これはトークン定義ファイルという性質上正しい(トークンの「正本」が生値を持つのは契約通り)。

---

## 7. 🟡 黄(将来リスク・情報) — actionCatalog.ts が `playmat/` 配下を import(D4 削除時の隠れ依存)

**severity: 黄/情報(現時点でバグではないが D4 リスク)**
**該当**: `src/components/game/actionCatalog.ts:20`

```ts
import { ruleActionCandidatesFromTags } from '../playmat/ruleActionCandidates';
```
`ui-architecture-v2.md` §2 の目標構造では `game/` は新ツリー、`playmat/` は D4 で削除予定の旧ツリーである。`game/actionCatalog.ts` が `playmat/ruleActionCandidates` を直接 import しているため、**D4 で `playmat/` を丸ごと削除すると `game/` 側がビルド不能になる**隠れ依存。design-playbook §D4(f)が名指しで警告する「削除起因の隠れ依存」に該当する実例。D1 時点では実害なし(`playmat/` はまだ現役)だが、D4 実行カードの「Tier-1へ参照グラフの残存を明示監査項目として渡す」対象に含めるべき。

---

## 8. 確認済み: 異常なし(網羅性のための記録)

- **rankActions のソートアルゴリズム**(`actionCatalog.ts:336-346`): priority 降順・同 priority は入力順保持。`review.d1` のテストケース(`['c','d','b']` 期待)と一致・独立検算でも正しい。
- **優先度定数の相対順序**: `commanderCast(100) > tapForMana(90) > playLand(80) > handCast(70) > fetchActivate(60) > untapLand(55)` は playbook の優先1〜4・6の順序と数値的に整合(優先5のみ finding #3 で指摘の通りルール自体が違う)。
- **canAffordCast=false のときの `warn` 付与**: `actionCatalog.ts:242`(`warn: !ctx.canAffordCast`)は正しく実装され、review.d1 の該当テストも正しく検証している(ただし finding #4 の通り本番では到達しない)。
- **純粋性**: `buildCardActionCatalog`/`rankActions` はいずれも引数を変異しない。`Object.freeze` した `card`/`ctx` を渡しても例外なく動作(review.d1 テスト確認済み・コードレビューでも `push` は常にローカル `specs` 配列に対してのみ行われていることを確認)。外部状態(store・Date.now 等)への依存なし。
- **castCostAdvisorySpec / buildCastCostAdvisoryItem の同等性**: `CAST_COST_ADVISORY_TAG_IDS` 定数・ラベル整形ロジック(`⚠ ${labels.join('/')}(コストは手動精算)`)は actionCatalog.ts と Playmat.tsx で完全一致(タグID配列・整形フォーマットとも同一)。
- **ruleCandidateSpecs / buildRuleCandidateMenuItems**: 両者とも同一の `ruleActionCandidatesFromTags(classifyCardRules(def))` を呼んでおり、id・label・testId・separator(`index === 0`)は完全一致。
- **stack ゾーン・hand ゾーン・墓地/追放からの唱える・Planeswalker忠誠値・move ターゲット一覧・card-effects-auto・flip/facedown・counter±**: id・separator・danger・disabled の条件式を全項目突き合わせた結果、finding #1(統率者税ラベル)を除き **buildMenuItems と actionCatalog の間に分岐条件・id・separator の不一致は見つからなかった**。
- **フラグ既定値**: `VITE_UI_V2_SHEET !== 'false'` は playbook 通り「未設定=シート、'false'のみロールバック」を正しく実装。
- **tokens.css の値**: design-system.md §2〜§7 の :root 定義と1対1で一致(色・タイポ・スペーシング・モーション時間トークンすべて突き合わせ済み。差異なし)。
- **index.css の felt→ink エイリアス方式**: `--felt-1: var(--surface-0)` 等、値のみ差し替えるエイリアス方式は妥当。`docs/design-system.md` に乖離記録あり(J2承認済み)。App.css 側の `--felt-*`/`--panel*` 参照(29箇所)は無編集で新色を拾う設計であることをコードレビューで確認(エイリアス経由なので参照側の変更不要)。
- **機械4点**: 全て green(§0参照)。
- **禁止ファイル走査**: `review.*` ファイルで D1 対象外に変更があったものは無し(既存 review.\* 群は git diff 上いずれも変更なし。新規は `review.d1-action-catalog.test.ts` のみ)。`CLAUDE.md`・`AGENTS.md` は無変更。`docs/design-playbook.md`・`docs/design-system.md` は変更ありだが、内容は D1 実装乖離の自己記録(J2 承認)であり、CLAUDE.md の役割分担規約(「判定者専有」だが J2召喚時はJ2が判定者席)に照らして越権ではない(ただし finding #1・#3 の通り、記録漏れの乖離が別途存在する)。

---

## 要約(赤旗3件・黄4件)

1. 🔴 統率者税ラベルが `buildSheetModel` の id-join で捨てられ、実際のシートには常に「唱える(スタック)」しか出ない(taxLabel は死コード)。design-playbook 優先1の受け入れ基準未達。
2. 🔴 `VITE_UI_V2_SHEET=false`(ContextMenu ロールバック経路)が自動テストで一度も実行されていない。playbook §3 D1(f) の明示的リスク対策が不履行。
3. 🔴 ロック済み優先度表の「優先5: 起動型能力の起動」が無承認で「フェッチ起動」に置換されている(J2確認要)。
4. 🟡 `canAffordCast` が本番経路で恒久的に `true` 固定。「マナ不足の唱えるは昇格しない」という D1 受け入れ基準が実質検証不能(記録済み乖離だが影響範囲は要確認)。
5. 🟡 `actionCatalog.ts` は契約が指示した「抽出+re-export」ではなく「独立重複実装」。finding #1 の直接原因であり today も golden テストが実比較でなく手書きコピーのため将来ドリフトを検出できない。
6. 🟡 `CardActionSheet.css` に生 `rgba(0,0,0,0.4)` / `232px` / `300px` が残存(対応トークン未定義、design-system.md 未記録)。
7. 🟡 `game/actionCatalog.ts` が `playmat/ruleActionCandidates` を import しており、D4 の `playmat/` 削除時に隠れ依存として破綻するリスク(現時点では実害なし)。

機械4点(lint/build/vitest 1504件)はすべて green。findings は主に**「テストは通るが仕様が実際には満たされていない」統合ギャップ**に集中している——pure function 単体テストが正しくても、Playmat.tsx 側の配線(id-joinによるlabel破棄・フラグ未検証・優先度表の無断置換)で D1 の3つの明示的受け入れ基準が実際には満たされていない。
