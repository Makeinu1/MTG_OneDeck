# Cold Audit Brief: cr-605-mana-choice-ui

## 監査対象

- **domain id**: `cr-605-mana-choice-ui`
- **claimed status**: `implemented-not-audited`
- **CR refs**: 605.1, 605.3b, 106.7
- **frozen contract**: `docs/engine-spec.md` §33.10
- **acceptance**: `docs/acceptance.md` G6-1 through G6-13

## Evidence テスト一覧

| ファイル | 役割 |
|----------|------|
| `src/store/__tests__/review.cr605-mana-choice-ui.test.ts` | 判定者専有 review テスト(13 cases) |

## 変更ファイル(3 files)

- `docs/acceptance.md` (G6-1..13 追加)
- `docs/engine-spec.md` (§33.10 追加)
- `src/store/__tests__/review.cr605-mana-choice-ui.test.ts` (新規・判定者専有)

## 性質

本マイルストーンは**検証ピン**(verification pinning)である。エンジンコード(`src/engine/`)・ストアコード(`src/store/gameStore.ts`)・UIコード(`src/components/`)の変更はゼロ。既存の guided mana prompt フロー(`guidedManaPrompt` → `pendingGuided` → `confirmGuidedMana` → `ManaChoiceDialog`)と `tapForMana` ショートカットフロー(`needs-choice` → `manaChoice` state → `ManaChoiceDialog`)が CR 605.1/605.3b/106.7 を正しく満たしていることを review テストで固定し、契約を spec/acceptance に文書化した。

## 監査手順

### 1. テスト実行

```sh
npx vitest run src/store/__tests__/review.cr605-mana-choice-ui.test.ts
npx tsc -b
npx eslint src/store/__tests__/review.cr605-mana-choice-ui.test.ts
```

全緑であることを確認する。1件でも失敗すれば BLOCKER。

### 2. Boundary 検証

- **guided mana prompt**: "Add N mana of any color" / "any one color" / "any combination" / "the chosen color" / "that color" が guided prompt へコンパイルされること。
- **commander color identity**: `manaOptions` が commander の色に制限されること。
- **用途制限**: "Spend this mana only to..." は manual のまま(fake guided 禁止)。
- **可変数**: "Add X mana..." は manual のまま。
- **buildGuidedCommands**: mana answer → `addMana` command。`manaOptions` 外の色は空配列(拒否)。
- **tapForMana**: 単色=自動解決、多色=`needs-choice`、色指定=producedMana にあれば `ok`。
- **CR 605.3b no-stack**: マナ能力の guided prompt 解決後にスタック長不変。

### 3. Spot-check(CR 照合)

`rule/Magic_The_Gathering_Comprehensive_Rules.txt` の以下条項と実装を突き合わせる:

- CR 605.1: マナ能力の定義
- CR 605.3b: マナ能力はスタックを使わない
- CR 106.7: 選択された色のマナ生成

### 4. Adversarial check

- review テストが既存の compiler/store コードの挙動を正しく固定しているか(テストが甘すぎないか)
- spec §33.10 の契約が CR と矛盾していないか
- acceptance G6 の期待結果が CR と矛盾していないか
- `as never` 型アサーションが除去されているか(lint clean)

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
