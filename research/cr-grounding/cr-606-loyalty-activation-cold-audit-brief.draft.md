# Cold Audit Brief: cr-606-loyalty-activation

## 監査対象

- **domain**: `cr-606-loyalty-activation`
- **claimed status**: `implemented-not-audited`
- **CR 根拠**: CR 606.2 / 606.3 / 606.4 / 606.6
- **契約**: `docs/engine-spec.md` §33.11、`docs/acceptance.md` G7

## evidence テスト

- `src/store/__tests__/review.cr606-loyalty-activation.test.ts`(7 cases)
- `src/engine/grammar/__tests__/decisionSnapshot.test.ts`(corpus snapshot — planeswalker loyalty m→a/g 遷移)

## 変更ファイル

- `src/engine/grammar/ir.ts` — `AbilityCost.loyaltyDelta` + `parseLoyaltyDelta()`
- `src/engine/grammar/index.ts` — `isCostLikeActivatedPrefix()` loyalty pattern
- `src/engine/commands.ts` — `activationPlanForSource()` loyalty cost stripping + `addCounters` command 生成
- `src/store/gameStore.ts` — CR 606.6 insufficient loyalty block + CR 606.3 once-per-turn ledger + `commitActivation` ledger 記録
- `src/store/__tests__/review.cr606-loyalty-activation.test.ts` — review テスト 7 cases
- `docs/engine-spec.md` — §33.11 契約
- `docs/acceptance.md` — G7 受け入れ基準
- `research/grammar-compile/decision-snapshot.json` — corpus snapshot 更新(m→a 24件, m→g 13件)

## 監査手順

### 1. テスト実行

```bash
npx vitest run src/store/__tests__/review.cr606-loyalty-activation.test.ts
```

7/7 緑を確認せよ。

### 2. boundary 検証

- **CR 606.4 正確数**: `+1` で loyalty 3→4、`-2` で 4→2、`-7` で 7→0(counter key 削除)
- **CR 606.6 境界**: loyalty=1 で `-2` はブロック(警告あり)、loyalty=2 で `-2` は成功(0 になる)
- **CR 606.3 正確種別**: 同一 PW の2つ目の忠誠度能力は同ターンにブロック(警告あり)。別 PW は影響しない
- **undo/redo 原子性**: 忠誠度起動 → undo → redo で忠誠度が正しく復元・再適用される
- **force bypass**: CR 606.6/606.3 は `force: true` でバイパス可能(サンドボックス哲学)

### 3. spot-check(CR 参照)

CR 正本: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`(2026-06-19 版固定)

- **CR 606.2**: "A loyalty ability is an activated ability with a loyalty symbol in its cost." → `isCostLikeActivatedPrefix` が `+N`/`-N`/`−N` を起動型として分類することを確認
- **CR 606.3**: "A player may activate a loyalty ability of a permanent they control any time they have priority and the stack is empty during a main phase of their turn, but only if no player has previously activated a loyalty ability of that permanent that turn." → `oncePerTurnTriggerLedger.consumedKeys` に `loyalty-activation:{sourceId}` を記録・検査することを確認
- **CR 606.4**: "The cost of activating a loyalty ability of a permanent is to add or remove loyalty counters from that permanent." → `addCounters` command が `counterType: 'loyalty'` で正しい delta を持つことを確認
- **CR 606.6**: "A loyalty ability with a negative loyalty cost can be activated only if the permanent has at least that many loyalty counters on it." → store が `loyaltyDelta < 0` かつ `currentLoyalty < |delta|` でブロックすることを確認

### 4. adversarial check

- **部分支払い漏洩**: loyalty コストが `addCounters` として生成され、`commitActivation` で他のコストコマンドと原子的に適用されること。loyalty だけ先に適用されて起動が失敗する経路がないこと
- **undo 非可逆**: undo 後に `oncePerTurnTriggerLedger` の `loyalty-activation:{sourceId}` キーも除去されること(undo は snapshot 復元なので自動的に戻るはず。確認せよ)
- **旧 snapshot 破壊**: `restoreGame` が `oncePerTurnTriggerLedger` を backfill すること(既存の `normalizeOncePerTurnTriggerLedger` で対応済みのはず。確認せよ)
- **unicode minus**: `−`(U+2212)と `-`(ASCII)の両方が `parseLoyaltyDelta` と `isCostLikeActivatedPrefix` で正しく処理されること
- **非 loyalty 能力への干渉**: `{T}: Add {G}.` や `{2},{T}: Draw a card.` 等の非 loyalty 起動型能力が影響を受けないこと(`loyaltyDelta: null` でスキップされる)
- **corpus snapshot 遷移の正当性**: `decision-snapshot.json` の m→a 24件 + m→g 13件が全て planeswalker の loyalty ability 行であること。非 planeswalker 行の遷移がないこと

## 出力形式

domain ごとに verdict を1つ:

- **SHIPPED-OK**: BLOCKER/HIGH = 0。出荷可能
- **BLOCKER**: 出荷不可。実装修正→再監査が必要
- **HIGH**: 修正必須。修正後に shipped 昇格
- **MEDIUM**: boundary/note 修正後に shipped 昇格
- **LOW**: 参考情報。出荷を妨げない

findings は以下の形式で列挙:

```
### Finding N: [title]
- severity: BLOCKER / HIGH / MEDIUM / LOW
- location: [file:line or CR rule]
- description: [what was found]
- recommendation: [what to do]
```

## 制約

- **ファイル編集禁止**。findings only
- CR 参照先: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`(2026-06-19 版固定)
- テスト実行は許可(`npx vitest run`、`npx tsc -b`、`npx eslint src/`)
- ソースコードの読み取りは許可

## 禁止

- 「shipped 相当か確認して」等の確認バイアスを誘発する判断はしない
- **status 主張を敵対的に検証せよ**。claimed status = `implemented-not-audited` が正しいか、実装が CR 606.2/606.3/606.4/606.6 を忠実に満たしているかを敵対的に検証せよ
