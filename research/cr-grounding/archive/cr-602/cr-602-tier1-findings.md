# cr-602 activation envelope Tier-1 findings

監査日: 2026-07-03
対象: engine-spec §34.19 / `s-activated-ability-envelope.draft.md` / `review.activated-envelope`
結論: **NO SHIP 推奨**。review pin と機械4点は green だが、forced targeted activation が target 未選択の stack object を作れる赤旗あり。最終判定は Fable。

## Mechanical Checks Raw

### `git diff --name-only` (pre-report implementation diff)

```text
src/components/playmat/Playmat.tsx
src/components/playmat/TargetPickerDialog.tsx
src/engine/commands.ts
src/engine/grammar/compile.ts
src/engine/types.ts
src/store/gameStore.ts
```

### `npm run lint`

Exit: 0

```text

> mtg-onedeck@0.0.0 lint
> eslint .

```

### `npx tsc --noEmit`

Exit: 0

```text
```

### `npx vitest run`

Exit: 0

```text

 RUN  v4.1.8 /Users/shumpeiabe/Desktop/MTG_OneDeck


 Test Files  106 passed (106)
      Tests  1131 passed (1131)
   Start at  09:25:46
   Duration  17.81s (transform 5.00s, setup 3.20s, import 11.97s, tests 17.30s, environment 75.40s)

```

### `npm run build`

Exit: 0

```text

> mtg-onedeck@0.0.0 build
> tsc -b && vite build

vite v8.0.16 building client environment for production...
transforming...✓ 77 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.26 kB │ gzip:   0.55 kB
dist/assets/index-Cd1X7s80.css   73.12 kB │ gzip:  12.61 kB
dist/assets/index-eTJtnYDP.js   488.28 kB │ gzip: 145.16 kB

✓ built in 123ms
```

Build artifact cleanup:

```text
find dist -maxdepth 2 -type f
dist/index.html
dist/apple-touch-icon.png
dist/manifest.webmanifest
dist/assets/index-Cd1X7s80.css
dist/assets/index-eTJtnYDP.js
dist/icons.svg
dist/favicon.svg

find dist -maxdepth 2 -type f
find: dist: No such file or directory
```

### Targeted reviewer pins

Command:

```text
npx vitest run src/store/__tests__/review.activated-envelope.test.ts src/engine/__tests__/review.g4-activate.test.ts src/store/__tests__/review.mana-transaction.test.ts
```

Exit: 0

```text

 RUN  v4.1.8 /Users/shumpeiabe/Desktop/MTG_OneDeck


 Test Files  3 passed (3)
      Tests  21 passed (21)
   Start at  09:26:44
   Duration  789ms (transform 386ms, setup 108ms, import 453ms, tests 136ms, environment 1.25s)

```

明示: `review.activated-envelope` 5 pin、既存 `review.g4-activate`、既存 `review.mana-transaction` は green。

## Findings

### 1. 禁止ファイル改変

Severity: GREEN with ownership note

実装差分は `src/components/playmat/Playmat.tsx`、`TargetPickerDialog.tsx`、`src/engine/commands.ts`、`src/engine/grammar/compile.ts`、`src/engine/types.ts`、`src/store/gameStore.ts` の6ファイルのみ。`src/**/__tests__/review.*`、`docs/`、`research/cr-grounding/cr-backbone-ledger.json`、`golden-cases.json`、`*.draft.md` の実装者差分なし。根拠: 上記 `git diff --name-only`。

補足の `git status --short` では `src/store/__tests__/review.activated-envelope.test.ts` が未追跡として見えるが、ブリーフが Fable 専有の外部権威として指定している review pin なので、この Tier-1 では実装者差分に帰属させない。もしこの未追跡 review file が実装者生成物なら赤旗に反転する。

### 2. Atomicity (CR 602.2 / 118.3 / 601.2h)

Severity: GREEN

rules-legal の unpayable modeled cost は commit 前に止まる。`activationCostWarnings` が mana shortfall と既tap `{T}` を検出し、rules-legal では `commitActivation` 前に return する (`src/store/gameStore.ts:1046`, `src/store/gameStore.ts:1064`, `src/store/gameStore.ts:1106`, `src/store/gameStore.ts:2064`)。target confirm 前も `pendingGuided` だけで state は不変 (`src/store/gameStore.ts:2070`)。CR 根拠は `rule/Magic_The_Gathering_Comprehensive_Rules.txt:2527`, `:972`, `:2472`。

補足: `applyCommands` は内部 rollback 機構を持たないが、store は `cur` から純粋に結果を作り、例外時は `commit` しないため、store 経路では部分 commit しない (`src/engine/batch.ts:9`, `src/store/gameStore.ts:1125`)。

### 3. Forced 境界

Severity: GREEN for cost boundary

forced cost commit には「CR-legalとして扱いません」警告が付く (`src/store/gameStore.ts:1089`, `src/store/gameStore.ts:1142`)。forced log は「強行起動」とだけ表示し、CR-legal と表示していない (`src/store/gameStore.ts:1131`)。CR 根拠は CR 602.2 / 118.3。

ただし target 未選択 forced path は Finding 4 の赤旗。

### 4. Activation 時 target (CR 115.1c / 602.2b)

Severity: RED (High)

rules-legal 経路は green: targeted ability は activation 時に `pendingGuided.mode='activation'` になり、confirm 前は stack object も cost mutation も commit しない (`src/store/gameStore.ts:2070`)。confirm 後は `targetSelections` と `activationEnvelope` を `addAbilityToStack` に渡し、stack ability object に保存する (`src/store/gameStore.ts:1112`, `src/engine/commands.ts:1765`, `src/engine/commands.ts:1825`)。解決時も保存済み target を優先し、silent re-enumerate を避ける構造になっている (`src/engine/commands.ts:2147`, `src/engine/commands.ts:2481`)。CR 根拠は `rule/...:845`, `:2527`, `:2531`。

赤旗: forced mode では target prompt があっても picker を出さず、空 `targetSelections` のまま stack object を作れる。`activateAbility` は target picker を rules-legal に限定し (`src/store/gameStore.ts:2070`)、forced では `commitActivation(pendingActivation, targetPrompts, [])` へ進む (`src/store/gameStore.ts:2083`)。`commitActivation` は forced なら missing-target warning を止めず (`src/store/gameStore.ts:1106`)、空 target を stack object/envelope に保存する (`src/store/gameStore.ts:1112`)。これは「target は activation 時に選ぶ」CR 115.1c / 602.2b、および §34.19 の target envelope に対する赤旗。UI から force activation は現状露出していないが、store action API は `opts.force` を公開しており、review でも forced activation を API 経由で使っている。

### 5. Mana isolation (CR 605.1a / 605.5a / 605.3b / 405.6c)

Severity: GREEN

targetless `{T}: Add {G}.` は `activatedManaAbilityPlanForSource` 経由で `resolveManaAbilityTransaction` に入り、stack object を作らず即時解決する (`src/store/gameStore.ts:1995`, `src/store/gameStore.ts:2011`, `src/engine/commands.ts:2268`)。target を含む add-mana は `isActivatedManaAbilityIR` が `construct.target` で除外するため no-stack mana transaction に乗らない (`src/engine/commands.ts:2325`)。review pin も green。CR 根拠は `rule/...:2683`, `:2694`, `:2705`, `:2054`。

### 6. Scope creep

Severity: GREEN

cost auto 対応は mana / tap-self / sacrifice-self に限定されている (`src/engine/types.ts:149`, `src/engine/grammar/compile.ts:188`)。residual alphabetic cost は manual へ落ちるため、pay-life / discard / non-self sacrifice / complex cost を auto 済みと偽っていない (`src/engine/grammar/compile.ts:160`, `src/engine/grammar/compile.ts:174`)。loyalty ability は mana ability 判定から除外 (`src/engine/commands.ts:2293`)。CR608 illegal target resolution や complex cost は leaf/defer のままで、PASS 条件に混入していない。

### 7. 既存経路非破壊

Severity: GREEN

全体 vitest 106 files / 1131 tests pass。指定 review pin 3系統も単独で 3 files / 21 tests pass。既存 G4 cost (`review.g4-activate`) と mana transaction (`review.mana-transaction`) は union/envelope 拡張後も green。G3 guided resolution は保存済み target を持たない通常 stack item では従来通り prompt を返す構造 (`src/engine/commands.ts:2147`)。

### 8. UI wiring

Severity: GREEN

`Playmat` は guided target prompt を card targets と player targets に分け、`TargetPickerDialog` から `store.confirmGuidedTarget` / `store.confirmGuidedPlayerTarget` へ配線している (`src/components/playmat/Playmat.tsx:1125`, `src/components/playmat/Playmat.tsx:1431`)。`TargetPickerDialog` は empty target list、player target list、card target list の各 branch で null deref しない (`src/components/playmat/TargetPickerDialog.tsx:36`)。コード読み上の render throw 候補なし。

実機ブラウザ確認は未実施。ブリーフどおり最終の console error 0 件確認は判定者側の実機確認待ち。

## Ship Recommendation

Tier-1 推奨: **NO SHIP as-is**。

理由: 機械4点と reviewer pins は green だが、forced targeted activation が target 未選択の stack object/envelope を commit できる。これは CR 115.1c / 602.2b と §34.19 target envelope の明示観点に引っかかる。Fable が forced sandbox の許容範囲として裁定しない限り、修正または明示裁定なしの ship は推奨しない。
