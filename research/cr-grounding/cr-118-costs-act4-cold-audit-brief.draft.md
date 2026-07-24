# Cold Audit Brief: cr-118-costs-act4

## 監査対象

- **domain id**: `cr-118-costs-act4`
- **claimed status**: `implemented-not-audited`
- **CR refs**: 107.1, 107.3, 107.5, 118.3, 118.4, 601.2f, 601.2g, 601.2h, 602.2, 605.3b, 701.26a, 733.1
- **frozen contract**: `docs/engine-spec.md` §33.8
- **acceptance**: `docs/acceptance.md` G4-9 through G4-17

## Evidence テスト一覧

| ファイル | 役割 |
|----------|------|
| `src/store/__tests__/review.cr118-act4.test.ts` | 判定者専有 review テスト(10 cases) |
| `src/engine/__tests__/act4CostVocabulary.test.ts` | 実装者通常テスト |

## 変更ファイル(9 files, +1170/−175)

- `docs/acceptance.md` (G4-9..17 追加)
- `docs/engine-spec.md` (§33.8 追加)
- `src/engine/types.ts` (型拡張)
- `src/engine/commands.ts` (tap-object/counter-removal/X コスト支払いロジック)
- `src/engine/grammar/compile.ts` (コンパイラ配線)
- `src/engine/__tests__/act4CostVocabulary.test.ts` (通常テスト)
- `src/store/gameStore.ts` (pending-guided answers, UI workspace)
- `src/components/game/dialogs.tsx` (counter amount dialog, x-cost-cancel)
- `src/components/game/gameController.tsx` (handler 配線)
- `src/store/__tests__/review.cr118-act4.test.ts` (判定者専有・新規)

## 監査手順

### 1. テスト実行

```sh
npx vitest run src/store/__tests__/review.cr118-act4.test.ts
npx vitest run src/engine/__tests__/act4CostVocabulary.test.ts
npm run check
```

全緑であることを確認する。1件でも失敗すれば BLOCKER。

### 2. Boundary 検証

以下の境界条件がコードとテストで正しく扱われているか検証する:

- **tap-other**: 正確な数(例: "Tap two untapped creatures you control")のパーマネントが必要。不足時は支払い不可。ソース自身をタップ対象に含めない(ただし oracle 本文が許可する場合は除外しない)。
- **counter removal**: 正確な種別のカウンターを除去。`addCounters` のクランプを partial payment に使わない。1-or-more は具体的整数を記録し、不正な回答は原子的に拒否。
- **{X} コスト**: X=0 は合法(Pernicious Deed 型)。繰り返し X は同一値。announced X はスタックオブジェクトに保存。
- **複合コスト(未対応)**: 未解析の可変非マナ複合コストは wholly manual に留まる。認識済みサブコンポーネントの部分支払いは起きない。
- **CR605 no-stack**: マナ能力はスタックに乗らない。
- **cancel/no-op**: キャンセルは GameState を変更しない。
- **undo/redo**: 1 transaction = 1 undo スナップショット。旧スナップショットは破壊されない。

### 3. Spot-check(CR 照合)

`rule/Magic_The_Gathering_Comprehensive_Rules.txt` の以下条項と実装を突き合わせる:

- CR 118.3-4: コストの支払い順序・原子性
- CR 601.2f-h: マナ支払い・X の決定
- CR 602.2: 起動型能力の活性化
- CR 701.26a: tap の定義
- CR 733.1: カウンターの除去

### 4. Adversarial check

以下の敵対的シナリオを検証する:

- 部分支払い漏洩: 認識済みコストの一部だけ支払って残りを manual に落とす経路はないか
- undo 非可逆: undo 後に GameState が元に戻らない経路はないか
- 旧 snapshot 破壊: 履歴スタックの既存エントリが変更される経路はないか
- auto 詐称: 未対応の複合コストを「解決済み」と表示する経路はないか
- 型安全性: `any` の使用はないか

## 出力形式

domain ごとに verdict を1つ:

- **SHIPPED-OK**: BLOCKER/HIGH = 0。昇格可能。
- **BLOCKER**: 実装修正→再監査が必須。
- **HIGH**: boundary/note 修正必須。修正後に昇格可。
- **MEDIUM**: boundary/note 修正推奨。修正後に昇格可。
- **LOW**: 参考情報。昇格を阻害しない。

各 finding には:
- 重要度(BLOCKER/HIGH/MEDIUM/LOW)
- 分類(implementation / compiler / substrate / contract / ambiguity)
- 根拠(CR 条番号 or テスト名 or コード位置)
- 推奨アクション

## 制約

- **ファイル編集禁止**。findings only。
- 契約・盤面・台帳を変更しない。
- CR 参照先: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`(2026-06-19 版)

## 指示

**この status 主張(`implemented-not-audited` → `shipped` 昇格の正当性)を敵対的に検証せよ。** 実装が契約と CR に忠実である証拠を求め、不一致・境界漏洩・auto 詐称・部分支払い・undo 非可逆を積極的に探せ。確認バイアスを避け、通らない条件を通ったことにするな。
