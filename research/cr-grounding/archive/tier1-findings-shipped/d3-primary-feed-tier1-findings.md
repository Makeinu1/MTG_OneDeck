# D3 プライマリアクション+フィード — Tier-1 独立監査 findings

監査日: 2026-07-10 / 監査者: 冷たい Sonnet セッション(実装者と別主体)
対象契約: `docs/design-playbook.md` §3 D3 実行カード / `docs/ui-architecture-v2.md` §2-§6
対象diff: `git diff HEAD` (7 modified + 5 new files, 変更なしファイル一切なし以外は本文参照)

## 0. 機械4点(全部個別実行・green)

| チェック | 結果 |
|---|---|
| `npm run lint` | ✅ エラー0 |
| `npx tsc -b` | ✅ エラー0 |
| `npx vitest run` | ✅ 176 files / 1542 tests 全passed |
| `npm run build` | ✅ ビルド成功(chunk-size警告のみ、既存の許容範囲) |

## 1. 禁止ファイル整合性(要石)

- `src/components/playmat/Playmat.tsx`: `git diff HEAD -- ...` の出力行数 = **0**(未変更確認)。ロールバック経路は保全されている。
- `review.*` 変更: 新規 `src/components/game/__tests__/review.d3-primary-feed.test.ts` **のみ**。既存 review.* に変更なし。
- `src/engine/**` / `src/store/**`: `git diff --stat` に一切登場せず。**変更なし確認**。
- 実際に変更されたファイル: `GameCard.tsx`(+6/-2)・`GameScreen.tsx`(+2)・`HandRibbon.tsx`(+9/-1)・`StatusBand.tsx`(+22/-8)・`ThumbZone.tsx`(+29/-7)・`game.css`(+47)・`gameController.tsx`(+11)。新規: `Feed.tsx`・`affordability.ts`・`feedProjection.ts`・`primaryAction.ts`・`review.d3-primary-feed.test.ts`。契約通り。

## 2. ランク付き findings

### [HIGH] primaryActionModel の③「攻撃を確定」分岐が実エンジンでは到達不能(dead code)

- `src/components/game/primaryAction.ts:38` — `if (state.combat && state.combat.step === 'declareAttackers')`
- 実エンジンの `CombatState.step` に `'declareAttackers'` という値が**代入される箇所が存在しない**。`applyEnterCombat`(`src/engine/commands.ts:1517-1542`)は `step: 'beginningOfCombat'` をセットし、直後に `applyDeclareAttackers`(`src/engine/commands.ts:1577-1582`)が `step: 'declareBlockers'` に**即座に**書き換える。しかも `enterCombat` コマンドの唯一の呼び出し元は `store.declareAttack()`(`src/store/gameStore.ts:3158-3174`)で、`enterCombat→declareAttackers→declareBlockers→resolveCombatDamage` を**1回の atomic コマンド列として同時発行**する(このアプリはAI対戦相手なしの一人回しゆえ攻撃側の宣言が確定した時点で戦闘が一括解決される設計)。`nextPhase()`(`dispatchTurnTransition`)側からも `enterCombat` は一切呼ばれない。
- 結果: `state.combat.step === 'declareAttackers'` は**ゲーム中一度も真になり得ない**。実マッチ = 文字列 `'declareAttackers'` の唯一の使用箇所は (a) 型定義 (b) コマンド `type` 名(状態値ではない) (c) golden replay テストデータ (d) 本ファイル自身。
- `review.d3-primary-feed.test.ts:45-54` の該当テストは `{ ...baseState(), combat }` で `CombatState` を**手動合成**して検証しており、実エンジンの遷移関数を一切経由していないため、この分岐が実際に到達可能かどうかを検証できていない(green だが偽陽性)。ユーザーの過去知見 [[review-test-authoring-pitfalls]] に該当する典型パターン。
- 影響: 契約の4分岐優先順位のうち③が実運用では常にスキップされ、実質②→④の2分岐マシンとして動作する。攻撃自体は ≡ メニュー→「攻撃」→ `AttackDialog` 経由で可能(機能欠落ではない)が、契約で明記された「プライマリボタンが『攻撃を確定』に変わる」体験は一切発生しない。

### [HIGH] `canAfford` の monoHybrid `{2/W}` 扱いが under-claim を引き起こす

- `src/components/game/affordability.ts:81-83` — `case 'monoHybrid': colorReqs.push(new Set<ManaColor>([pip.color]));`
- モノハイブリッド `{2/W}` は「W1つ **or** 汎用2つ」の代替払いだが、実装は常に厳格な色要求(W必須)として扱っている。W源が無く汎用源のみ十分にある場合、実際は castable なのに `canAfford` は `false` を返す。
- 実行検証(`npx tsx`):
  ```
  parseManaCost('{2/W}') → { generic:0, x:0, pips:[{kind:'monoHybrid',color:'W'}] }
  canAfford(cost, [U,U,U])  → false   ← 誤り(汎用2つで支払い可能なので正解は true)
  canAfford(cost, [W])      → true
  ```
- エンジン本体の `solvePayment`(`src/engine/mana.ts:161-181`)は同じ pip を `{ options: [color, 'GEN2'] }` のバックトラック選択として正しくモデル化済み。affordability.ts はこれを再利用せず、独自に(誤って)簡略化している。
- 影響: 「プレイ可能ハイライト」は under-claim(=光らない)側に倒れる。タスクの明記通り「under-claim の方が悪い失敗」に該当する具体的な反例。

### [HIGH/MEDIUM] D0 で契約済みの `viewStore`(feedItems/unseenCount/markSeen)がD3で未配線のまま——並行実装が発生

- `src/store/viewStore.ts` は本diffで**一切変更されていない**(`git diff --stat` に登場せず)。同ファイルの既存コメント(D0時点)は「`feedItems` の実投影(gameStore の warnings/triggerCandidates/log 購読)は **D3 で配線する**。」と明記(`src/store/viewStore.ts:7`)。
- `docs/ui-architecture-v2.md §3`(viewStore契約)・`docs/design-playbook.md §3 D3(a)` の対象行(「対象=PrimaryAction.tsx/Feed.tsx/**viewStore(feedItems合成)**/プレイ可能ハイライトselector」)双方が viewStore を D3 の対象物として明示している。
- 実装は viewStore を一切使わず、`gameController.tsx:158`(`useState<boolean>` for `feedOpen`)・`Feed.tsx:20`(`projectFeed` を直接呼ぶ)・`StatusBand.tsx:26`(`feedUnseenCount` を直接呼ぶ)という**並行の自前状態**を新設している。
- 結果: viewStore の `feedItems`/`unseenCount`/`markSeen`/`toggleFeed` は**恒久的に未使用の死んだAPI**になっている。契約が明記する「既読は markSeen」(`docs/design-playbook.md` D3(a) item4)も未実装——現状はベルバッジがトリガー/警告の**未処理件数**をそのまま表示し続け、フィードを開いても消えない(=「未読(unseen since last view)」ではなく「要対応件数」の意味に事実上すり替わっている)。
- CLAUDE.md の「モック⇄実装乖離の規則」(§4)は乖離時に理由をdesign-systemへ1行追記後の承認を求めるが、本diffに docs 変更は皆無——無断の暗黙乖離。

### [MEDIUM] `.feed__act`(スタックへ/無視ボタン)が 44px ヒット領域規約に違反

- `src/components/game/game.css:118-122` — `.feed__act { min-height: 36px; ... }`(幅の保証もなし)。擬似要素によるヒット領域拡張も無し。
- `docs/design-system.md:93,103,222` は「全インタラクティブ要素の最小ヒット領域44px」「見た目が44pxより小さい要素も擬似要素でヒット領域を44pxに拡張する」を明記し、§9 Don'ts に「44px未満のヒット領域」を明示的に禁止している。
- 同じ diff 内の `.status-band__bell`(見た目28px、`::after { inset: -8px }` で44px相当に拡張済み)は正しくパターンに従っているが、`.feed__act`/`.feed__act--primary` には同種の拡張がない。

### [MEDIUM] Feed の「無視」ボタンが誘発項目ごとに複製され、グローバル副作用と乖離・testid重複

- `src/components/game/Feed.tsx:66-73` — `items.map(...)` ループ内で trigger item ごとに `無視` ボタンを描画するが、onClick は毎回 `store.dismissTriggerCandidates()`(引数なし=**全誘発候補を一括破棄**)を呼ぶ。
- 旧 `src/components/playmat/TriggerCandidatePanel.tsx:92-99` はヘッダに**1個だけ**の「無視」ボタンを置き、意味(全体無視)と見た目(単一ボタン)が一致していた。新実装は「この誘発だけを無視する」ように見えるアフォーダンスで実際は全件無視——同時に2件以上の誘発候補が並ぶ場面(複数ETB等)でユーザーの意図と異なる結果になる。
- 副次的に `data-testid="feed-trigger-ignore"`(`Feed.tsx:69`)が**固定文字列**のため、誘発候補が2件以上ある場合 DOM 内に同一 testid が複数出現し、ブラウザ自動操作(CLAUDE.md「主要UI要素には data-testid を付与…レビューのブラウザ自動操作で使用」)のセレクタ一意性が壊れる。

### [MEDIUM] `availableManaUnits` が複数マナ産出パーマネントを1ユニットとして過小評価(EDH特有の実害)

- `src/components/game/affordability.ts:28-35` — 戦場の未タップ mana source を無条件に「1ユニット=1マナ」として数える(ファイル冒頭コメントで明示的に許容された近似「2マナ源の過小評価は許容」)。
- しかし `src/store/gameStore.ts:1101` の `manaProductionAmount(def, color)` は同じ `CardDef` から oracle text を解析し Sol Ring 等の実際の産出量(例: 2)を正しく算出しており、`tapForMana` はこれを使って正しい量のマナを追加している(`gameStore.ts:2228`)。affordability.ts はこの既存のより正確なロジックを再利用せず、意図的に切り捨てている。
- 本プロジェクトはEDH(統率者戦)一人回し特化であり、Sol Ring / Mana Vault / Grim Monolith 等の2マナ以上を産出するアーティファクトは統率者デッキの定番(ほぼ皆勤)。これらが盤面にある状態は「プレイ可能ハイライト」が**日常的に under-claim**する具体的なシナリオになる。文書化された近似ではあるが、既存のより正確な計算ロジックが手の届く所にあり、かつ本プロジェクトの主戦場(EDH)で頻発するケースであるため、Tier-2 裁定(許容継続 or 修正)の価値がある。

### [LOW] 複数誘発候補の APNAP 順序付けUI(旧「この順でスタックへ」)が新Feedに引き継がれていない

- 旧 `TriggerCandidatePanel.tsx:36-67,82-91` は複数の pending trigger を ↑↓ で並べ替えて `store.placePendingTriggersForPriority(orderedIds)` により一括配置する UI を持っていたが、`Feed.tsx` にはこの機能がない(各誘発項目ごとに個別の「スタックへ」ボタンのみ)。
- 機能的な喪失ではない(ユーザーがクリック順を選べば同じ結果を達成できる)が、UXの退行であり、`docs/design-playbook.md` D3(a) の scope には明記されていない静かな機能縮小。CLAUDE.md「旧機能の削除は新経路で同じ操作が全て可能を確認してから」原則には抵触しない(操作は可能)が、便宜性の低下は記録推奨。

### [LOW / 参考・スコープ外] `next-turn` ボタンの `disabled={stackActive}` はD3以前からの既存パターン

- `src/components/game/ThumbZone.tsx:149` の `disabled={stackActive}` は D2 (`commit 40dbe8b`) 由来で本diffでは不変更(`git diff` に対象行なし)。ただし「スタック未解決中はフェイズ移動禁止を無効化グレーで表現しない」という D3 契約の精神(プライマリボタンに限定した記述だが)と、隣接する「次のターン」ボタンの disabled 表現は緊張関係にある。今回の変更範囲外だが、将来のD4/整合レビューで一考の価値あり。

## 3. まとめ

- 機械4点: 全green。禁止ファイル境界: 完全遵守(Playmat.tsx byte-unmodified・review.*境界・engine/store非接触)。
- 実質的な correctness bug 2件(HIGH): ③分岐 dead code、monoHybrid under-claim。
- アーキ契約からの無断乖離1件(HIGH/MEDIUM): viewStore 未配線・並行実装。
- 実害のある近似1件(MEDIUM): 複数マナ産出源の過小評価(EDH頻出)。
- UI/a11y・testid品質のMEDIUM 2件・UX退行のLOW 1件・スコープ外参考1件。
