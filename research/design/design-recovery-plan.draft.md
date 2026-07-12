# デザイン／プロジェクト正常化計画(J0 draft, 2026-07-12)

## 目的

「D番号を進めること」ではなく、ユーザーが再びPC版を信頼して一人回しでき、次のスライスを
選ぶ根拠が一意になる状態へ戻す。新しいテーマや演出を足す前に、既に失った可読性・直接性・
操作の主導権を回復する。

## 正常な状態の定義

正常化完了は、次の全条件を満たすこととする。

1. **現在地が一意**: ledger、loop-state、design docsが同じ次スライスを指す。
2. **文書の時制が明確**: baseline、現行契約、実装結果、未完了が混ざらない。
3. **PC版の理解ループが回復**: 画面を見るだけで「現在フェーズ・直前の変化・可能な操作・
   デッキの展開」が分かる。
4. **入力の同等性**: hover、通常クリック、右クリック、ダブルクリック、DnD、キーボードの役割が
   定義され、代替経路がある。
5. **削除は最後**: 旧Playmatを消す前に、新UIでの機能同等性とロールバック不要を独立検証する。
6. **独立監査**: J0が作った契約・テスト・docsは復帰判定者が再検証して再オーナー化する。

## 腐敗の原因

### 1. 計画と状態が別文書に重複した

vision、design-system、playbook、ui-architecture、ledgerの全てがD0〜D7の状態やDEFERを持ち、
実装後の乖離を各所へ追記した。結果として「最初の計画」「途中裁定」「実装結果」が同時に現役に見える。

### 2. 実装順の例外をロードマップへ戻さなかった

D4を飛ばしてD5を出荷したが、文書はD0→D5順次完了を前提にしたまま。D5後のユーザー再採点・
D6/D7 gateも実施されず、CRトラックへ戻った。

### 3. モバイル成功をデスクトップ成功と誤認した

D2はportrait-firstとして成功したが、1440pxを「表示崩れなし」で通し、デスクトップでの可読性・
入力・空間利用を受け入れ条件にしなかった。暫定状態が公開版になった。

### 4. 大きなD4に異質な仕事を詰め込んだ

D4は、PCレイアウト、DnD移植、保存デッキ一覧、依存解消、旧Playmat大量削除を一度に扱う。
ユーザー価値の回復とstrangler完了が結合し、blast radiusが大きいため延期され続けた。

### 5. 期限付き規則が自動失効しない

Codex枯渇規則やscore.ts暫定則が、終了条件達成後も現役本文に残った。日付だけのルールは掃除されない。

## 確認済み腐敗レジスタ

| 箇所 | 文書上の主張 | 実際／問題 | 処置 |
|---|---|---|---|
| `judge-protocol.md` §2 | score.ts修復まで9 familyを信用しない | 修復は8476488で出荷済み | 判定者が暫定段落を退役 |
| `design-playbook.md` §6 | Codex枯渇は2026-07-11まで | CodexはChatGPT.app内で復帰済み | `expired`表示。履歴へ移す候補 |
| `design-vision.md` §1 | 「現状55点」、縦持ち拒否・全操作無演出 | D2/D3/D5後の現行製品には該当しない | historical baselineと表示 |
| `design-vision.md` | 「6原則」 | 7項目存在 | 見出しを7原則へ訂正 |
| `design-system.md` 冒頭 | mockup v3が視覚正本 | HTMLはv4。PC退行を含まない | v4の比較材料へ降格 |
| `design-playbook.md` §7 | D0→D5を順にship | D4未完のままD5出荷 | playbook実行停止、D4分割 |
| `ui-architecture-v2.md` §5 | D2でDnDをGameScreenへ移植 | `GameCard`は`draggable={false}` | D4aの明示回復項目 |
| `ui-architecture-v2.md` §2 | `PrimaryAction.tsx` / `game/sheets/` | 実体なし。状態機械は`primaryAction.ts`、dialogsは別構成 | targetと現行を分ける |
| `ui-architecture-v2.md` | Playmat 1,735行 | 現在1,826行 | 行数を契約根拠に使わない |
| `acceptance.md` | 右クリック中心＋最終DnD確認 | 既定GameScreenではDnD不可、新旧UI条件が未分離 | D4a受け入れ再照合 |
| ledger D4 | 3カラム・保存デッキ・DnD・大量削除を一括 | 大きすぎて延期し、PC価値回復を阻害 | J2がD4a/b/cへ分割 |
| 旧loop-state | CR-121が次作業 | 最新ユーザー指示はPC／文書回復 | loop-stateを整理、CRは保留 |

## 回復フェーズ

### R0 — これ以上悪化させない(現在)

- D6/D7、旧Playmat削除、CR-121実装を一時保留。
- `docs/README.md`を入口とし、古い計画を現行状態と誤読しない。
- 現行PC退行の実測を `pc-ui-regression-diagnosis.draft.md` に固定。

出口: ledgerを変更せずとも、loop-stateがPC回復を現在作業として指している。

### R1 — 事実のベースラインを作る

**状態(2026-07-12 J0)**: 比較完了。結果=`r1-pc-ui-baseline.draft.md`。決定論的visual fixtureで
土地6／盤面10／stack2／graveyard10も補完済み。未完はBrowserホスト制約による812x375実寸のみ。

同一デッキ・同一状態で旧PlaymatとGameScreenを比較する。

- 画面: 375x812 / 812x375 / 1280x800 / 1440x900 / 1920x1080
- 場面: マリガン、8枚手札、土地6枚、盤面10枚、スタック2件、墓地10枚
- 操作: inspect、play/cast、tap、move、zone view、phase、undo/redo、DnD、keyboard
- 記録: 必要クリック数、スクロール発生、カード可読幅、中央盤面幅、コンソールエラー

出口: 「前の方が良かった」を操作・視認単位で再現できる。

### R2 — D4を3つへ分割する(J2再承認対象)

**状態(2026-07-12 J0)**: D4a受け入れ草稿=`d4a-pc-affordance-recovery.draft.md`を作成。
J2再承認前のため実装未着手。

#### D4a PC affordance recovery

hover preview、マリガン構図、フェーズ可読性、8枚手札、墓地導線、全幅利用、土地の段階圧縮、
通常クリック、DnDを回復する。旧Playmatは残す。

#### D4b desktop composition

同じcomponent treeのままデスクトップ配置を再構成する。3カラムは手段であり契約ではない。
1280/1440で中央舞台を狭めないことを先に数値化する。左右railは利用幅に応じて縮退可能にする。

#### D4c strangler completion

actionCatalog、dialogs、DnD、shortcuts、全ゾーン操作の同等性がreviewと実機で証明された後だけ、
Playmat・旧sidebar・旧ContextMenu・死CSSを削除する。D4a/bと同じshipに含めない。

出口: ユーザー価値回復が大量削除にブロックされない。

### R3 — 受け入れ契約をユーザーの悩みへ合わせる

最低限、以下をreview草稿と実機チェックへ落とす。

- 1280pxで手札8枚が横スクロールなし。
- 1440pxで中央プレイ領域の有効幅が後退しない。
- フェーズは現在・完了済み・次を文字で識別でき、遷移結果が分かる。
- 土地は空間がある間は個別、容量接近後にのみ段階圧縮。
- hoverでカード本文が読め、通常クリックの意味が発見可能。
- DnDと右クリック代替が同じ状態変化を作る。
- 墓地は常時見つけられる1アクション導線。
- マリガン判断と対象手札が同一視野にある。
- feedはエンジンの実行結果を説明するが、中央舞台を奪わない。

出口: 「部品が存在する」ではなく「ユーザーが迷わない」を失敗条件にできる。

### R4 — 小さく実装し、各段階で止まれるようにする

推奨順は、hover/inspect → opening hand/mulligan → phase model → hand/land responsive density →
desktop composition → feed/zone rail → DnD parity。各単位は独立ship可能にし、3形態回帰を毎回見る。

出口: 1回の失敗でPC回復全体が止まらない。

### R5 — 再オーナー化して通常運転へ戻す

- 冷たいTier-1が禁止ファイル、scope、機械4点、review、5 viewportを監査。
- 復帰判定者がJ0 docs/reviewをユーザー指摘と実機へ照合。
- ledgerでD4a/b/cとCR-121の順序を再確定。
- D6/D7はPC回復後のユーザー再採点を経て初めて再度gateする。

## 今後の文書構造

- `CLAUDE.md` / `AGENTS.md`: 統治。不変。
- `judge-protocol.md`: 汎用判断規則。期限付き障害の履歴を置かない。
- `cr-backbone-ledger.json`: スライス状態・順序・証跡の唯一の正本。
- `design-vision.md`: WHYと不変原則。過去の製品診断はbaselineと明示。
- `design-system.md`: WHAT。実装済みtokenと未実装componentを状態分離。
- `ui-architecture-v2.md`: HOW。目標と現行差分を明示。
- `design-playbook.md`: 再利用可能な実行手順だけ。出荷履歴はledger/archiveへ。
- `docs/README.md`: 読む順序と文書lifecycle。

## 判定者へ残す未決事項

1. D4a/b/c分割はIA・スライス契約変更なのでJ2承認が必要。
2. デスクトップの通常クリックをinspectにするかaction popoverにするかはユーザー体験判断。
3. 3カラムを維持するか、2カラム＋可変drawerにするかはR1実測後に決める。
4. `design-vision`原則7の「常設ゾーン列廃止」はmobile限定へ狭めるか再裁定が必要。
5. PC回復後のD6/D7とCR-121の優先順位はユーザー再裁定が必要。
