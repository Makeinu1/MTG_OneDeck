# cr-702-194-teamwork 契約草稿(判定者所有)

## CR根拠(pinned 2026-06-19)

- 702.194a: "Teamwork N" = "As an additional cost to cast this spell, you may tap any number of creatures you control with total power N or more." 601.2b/601.2f-h の追加コスト規則に従う。
- 702.194b: "using teamwork" = cast時にteamworkコストを支払う意図を宣言したかどうか。
- 702.194c: teamwork条件付き効果の対象は、teamwork使用時のみ選択する(CR 601.2c)。

## Oracle文パターン(コーパス実測16枚)

```
Teamwork N (As an additional cost to cast this spell, you may tap any number of creatures you control with total power N or more.)
[Effect text. "If this spell was cast using teamwork, ..." 条件文を含む]
```

N は 1〜5 の整数。全カードが Instant/Sorcery。効果本体の "if cast using teamwork" 条件分岐は本スライスでは manual のまま。

## 実装範囲

### 1. キーワード認識(keywordGrammar.ts)

- `KEYWORD_DEFINITIONS` に `{ id: 'teamwork', name: 'teamwork', label: 'チームワーク', ruleRef: '702.194' }` を追加。
- 既存の `KEYWORD_PREFIX_PATTERNS` が `teamwork 4` 等を自動認識する(`\d` パターン)。
- `parseTeamworkThreshold(oracleText: string): number | null` を新規エクスポート。先頭段落の `Teamwork N` から N を抽出。リマインダーテキスト括弧内は除去済みでマッチする。

### 2. GameState / CardInstance 拡張(types.ts)

- `CardInstance` に `usingTeamwork?: boolean` を追加。stack上のspellのみ意味を持つ。
- `restoreGame` の backfill で `usingTeamwork` は undefined のまま(旧snapshot互換)。

### 3. castToStack コマンド拡張(commands.ts)

- `castToStack` variant に `teamworkTappedIds?: string[]` を追加。
- `applyCastToStack` で:
  - `teamworkTappedIds` が非空の場合、各クリーチャーをタップし(`tapped: true`)、stack上のカードに `usingTeamwork: true` を設定。
  - タップ対象は battlefield に存在し、controllerId が caster と一致し、未タップのクリーチャーであること。違反時は EngineError。
  - 合計パワーの検証は store 側で行い、engine は受け取った id リストをそのままタップする(信頼境界)。

### 4. Store 統合(gameStore.ts)

- `PendingCastTransaction` に `teamworkTappedIds?: string[]` と `teamworkThreshold?: number` を追加。
- `castToStack()` 内で `parseTeamworkThreshold(face.oracleText)` を呼び、非nullなら pendingCast を設定する(直接dispatchしない)。
  - prompts に `{ kind: 'cost-tap', atom: null, count: 0, raw: 'Teamwork N — 合計パワーN以上のクリーチャーをタップ' }` を追加。
  - `teamworkThreshold` を設定。
- 新アクション `answerPendingCastTeamwork(cardIds: string[])`:
  - 選択されたクリーチャーの合計 `effectivePower` が threshold 以上であることを検証。
  - 0件選択 = teamwork不使用(合法)。
  - 検証OKなら `pendingCast.teamworkTappedIds` を設定し、prompts から teamwork prompt を除去。
- `confirmPendingCast()` で `teamworkTappedIds` を castToStack コマンドに含める。
- `cancelPendingCast()` は既存のまま(全キャンセル)。

### 5. UI 統合(gameController.tsx)

- pendingCast の prompts[0] が `cost-tap` kind の場合、teamwork選択UIを表示。
  - 自分がコントロールする未タップクリーチャーを一覧表示。
  - 合計パワーのリアルタイム表示。
  - 「チームワークする」(threshold以上で有効化) / 「チームワークしない」(0件で確認) ボタン。
  - 既存の cost-tap prompt handling パターンを再利用。

### 6. 効果本体の条件分岐

- "If this spell was cast using teamwork" 条件文は本スライスでは compiler が manual のまま扱う。
- `usingTeamwork` フラグは stack item に記録されるため、後続スライスで条件分岐 compiler が参照可能。
- 効果本体が manual になっても、teamwork コストのタップとキャストは一つの transaction として原子実行される。

## 受け入れ基準

- A1: `parseTeamworkThreshold` が `Teamwork 4 (...)` から 4 を抽出。Teamwork なしテキストは null。
- A2: `KEYWORD_DEFINITIONS` に teamwork が存在し、`possessedKeywords` が Teamwork カードを認識。
- A3: store の `castToStack` が Teamwork カードで pendingCast を設定し、teamwork prompt を含む。
- A4: `answerPendingCastTeamwork` が合計パワー検証を行い、threshold 未満を拒否。
- A5: `confirmPendingCast` が `teamworkTappedIds` 付き castToStack コマンドを dispatch し、クリーチャーがタップされ、stack item に `usingTeamwork: true` が記録される。
- A6: teamwork 不使用(0件選択)でもキャストは成功し、`usingTeamwork` は undefined のまま。
- A7: undo でタップとキャストが同時に巻き戻る。
- A8: 既存の non-teamwork カードのキャストフローに影響なし。

## スコープ外

- "if cast using teamwork" 条件効果の auto/guided コンパイル(後続スライス)。
- Agent Maria Hill の "tapped to pay a teamwork cost" 誘発型能力。
- Quantum Reduction の "cast as though it had flash if using teamwork" 条件。
- convoke/improvise との同時使用(teamwork は任意追加コストなので共存可能だが本スライスでは検証しない)。

## review.* テスト(判定者所有)

- `src/engine/__tests__/review.cr702-194-teamwork.test.ts`: A1-A2(キーワード認識・パース)
- `src/store/__tests__/review.cr702-194-teamwork.test.ts`: A3-A8(store統合・golden replay)
