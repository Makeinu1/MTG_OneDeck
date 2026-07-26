# AV contract cold audit — 2026-07-26

**auditor**: `av_contract_cold_audit` (Pasteur、親の実装文脈を継承しない別主体)  
**mode**: findings only / file editsなし  
**target**: AVドキュメント契約の整合性。UI/音源実装の完了主張ではない。  
**final verdict**: `SHIPPED-OK` — BLOCKER/HIGH/MEDIUM/LOW = 0

## 監査で検出し、最終契約へ反映した事項

1. transport未準備・音源失敗時は成功音を鳴らさず、即時因果視覚と背景fallbackだけを残す。
2. engine eventIdはundo分岐で再利用されうるため、browser-session単調増加のpresentation idと分離する。
3. legacy sound callerの移行表へ `gameController.tsx`、`ThumbZone.tsx`、`HandRibbon.tsx`、`CelebrationLayer.tsx`を明記し、直接caller 0件を受け入れ条件化する。
4. hover/focus/preview/scroll/drag開始/並べ替え/対象探索の無音・無装飾イベント境界を受け入れ条件化する。
5. musical-event OFFとMusicTransport readinessを分離し、Music ON + event OFFでも背景のTrackManifest同期を維持する。
6. 拍細分をTUNABLEにし、疎なanchor間は `beatSpan * quantizeStepsPerBeat` 区間へ補間する。16拍・初期値4 = 64区間のfixtureを固定する。
7. superseded議論ドラフトを実装仕様のないpointerへ縮退し、撤回済み候補の検索流入を防ぐ。

## 最終敵対チェック

- 同じ意味イベントの反復で自動高揚しない。
- event allowlist外、失敗、入力操作、combat、stack解決、history再生は無音境界を持つ。
- commanderはgeneric castを置換し、cast時・nonblocking・BGM duckである。
- GameStateと即時因果表示は拍待ちしない。
- snap window、最大遅延、疎anchor補間が同じ式と受け入れfixtureを持つ。
- master / Music / musical-event / background-motionの組合せに矛盾がない。
- 現行sourceの旧挙動を「実装済み」と誤記していない。

## 機械証拠

- `npm run check`: PASS
  - lint PASS
  - 286 test files / 2282 tests PASS
  - build PASS
- `git diff --check`: PASS
- M-AV IDs: 33件、重複0
- `cr-backbone-ledger.json`: JSON parse PASS
