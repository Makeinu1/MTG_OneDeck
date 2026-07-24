# Cold Audit Brief: cr-121-cross-player-draw

## 監査対象

- **domain id**: `cr-121-cross-player-draw`
- **claimed status**: `implemented-not-audited`
- **CR refs**: 121.1, 121.2, 121.2c, 121.4, 704.5b
- **frozen contract**: `docs/engine-spec.md` §33.9
- **acceptance**: `docs/acceptance.md` G5-1 through G5-8

## Evidence テスト一覧

| ファイル | 役割 |
|----------|------|
| `src/store/__tests__/review.cr121-cross-player-draw.test.ts` | 判定者専有 review テスト(8 cases) |

## 変更ファイル(3 files)

- `docs/acceptance.md` (G5-1..8 追加)
- `docs/engine-spec.md` (§33.9 追加)
- `src/store/__tests__/review.cr121-cross-player-draw.test.ts` (新規・判定者専有)

## 性質

本マイルストーンは**検証ピン**(verification pinning)である。エンジンコード(`src/engine/`)の変更はゼロ。既存の `applyPlayerEffect` + `orderedRecipients` + `drawCards` + `markEmptyLibraryDrawAttempt` 基盤が CR 121 の cross-player draw 要件を正しく満たしていることを review テストで固定し、契約を spec/acceptance に文書化した。

## 監査手順

### 1. テスト実行

```sh
npx vitest run src/store/__tests__/review.cr121-cross-player-draw.test.ts
npx tsc -b
npx eslint src/store/__tests__/review.cr121-cross-player-draw.test.ts
```

全緑であることを確認する。1件でも失敗すれば BLOCKER。

### 2. Boundary 検証

- **APNAP ordering**: `orderedRecipients` が active player を先頭に APNAP 順で返すこと。`eachPlayer` は全プレイヤー、`eachOpponent` は controller 除外。
- **per-player ordinals**: `drawOrdinal` がプレイヤーごとに独立に 1 から始まること。
- **empty library**: 空ライブラリからの draw 試行が `empty-library-attempt` イベントを記録し、SBA が defeat advisory を生成すること。フラグは SBA 後にクリアされること。
- **partial library**: 不足分だけ empty-library-attempt が記録されること。
- **old draw command**: `playerId` 指定で対象プレイヤーのライブラリから引き、省略時は `localPlayerId` にフォールバックすること。
- **purity**: `applyCommand` が入力 state を変更しないこと。

### 3. Spot-check(CR 照合)

`rule/Magic_The_Gathering_Comprehensive_Rules.txt` の以下条項と実装を突き合わせる:

- CR 121.1: draw = top card of library → hand
- CR 121.2: cards drawn one at a time
- CR 121.2c: active player draws first, then APNAP
- CR 121.4 / 704.5b: empty library draw → SBA loss

### 4. Adversarial check

- review テストが既存の engine コードの挙動を正しく固定しているか(テストが甘すぎないか)
- `seedOpponentLibrary` ヘルパーが GameState の不変条件を壊していないか
- spec §33.9 の契約が CR と矛盾していないか
- acceptance G5 の期待結果が CR と矛盾していないか

## 出力形式

domain ごとに verdict を1つ:

- **SHIPPED-OK**: BLOCKER/HIGH = 0。昇格可能。
- **BLOCKER**: 実装修正→再監査が必須。
- **HIGH**: boundary/note 修正必須。修正後に昇格可。
- **MEDIUM**: boundary/note 修正推奨。修正後に昇格可。
- **LOW**: 参考情報。昇格を阻害しない。

## 制約

- **ファイル編集禁止**。findings only。
- 契約・盤面・台帳を変更しない。
- CR 参照先: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`(2026-06-19 版)

## 指示

**この status 主張(`implemented-not-audited` → `shipped` 昇格の正当性)を敵対的に検証せよ。** review テストが既存エンジンの挙動を正しく固定しているか、spec/acceptance が CR と矛盾していないかを積極的に検証せよ。確認バイアスを避け、通らない条件を通ったことにするな。
