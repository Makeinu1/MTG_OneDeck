# D5 祝祭感 — Tier-1 独立監査 findings

**監査対象**: `src/components/game/{motion.ts, sound.ts, StackBand.tsx, StatusBand.tsx, ThumbZone.tsx, HandRibbon.tsx, gameController.tsx, game.css}` + `src/components/game/__tests__/review.d5-motion.test.ts`
**契約**: `docs/design-playbook.md` §3 D5 / `docs/design-system.md` §7(L0-L4)・§9(Do/Don't)
**判定**: 別セッション・冷たい監査(findings only、契約は変更しない)

## 1. 機械4点 — 全緑

| チェック | 結果 |
|---|---|
| `npm run lint` | clean(出力なし) |
| `npx tsc -b` | clean(出力なし) |
| `npx vitest run` | 177 files / 1555 tests 全passed |
| `npm run build` | 成功(`tsc -b && vite build`、chunk size警告のみ=既存・D5と無関係) |

## 2. 禁止ファイル整合性(要石) — clean

- `git status --short`: 変更6ファイル(HandRibbon/StackBand/StatusBand/ThumbZone/game.css/gameController)+新規3ファイル(motion.ts/sound.ts/review.d5-motion.test.ts)。
- `src/components/playmat/Playmat.tsx`: **UNCHANGED**。`git diff --stat HEAD -- src/components/playmat/Playmat.tsx` は空、最終変更コミットは D1(`ea661bc`)のまま。ロールバック経路は健全。
- `review.*`: 新規は `review.d5-motion.test.ts` のみ。他の `review.*` に変更なし。
- `src/engine/**` / `src/store/**`: 変更なし(`git diff --stat HEAD -- src/engine src/store` は空)。

## 3. React hooks safety — clean

`StackBand.tsx` (17-29行目) と `StatusBand.tsx` (23-40行目) の `useRef`/`useState`/`useEffect` は両ファイルとも早期 `return null`(`if (!state) return null`)より**前**に無条件で呼ばれている。オプショナルチェイニング(`controller.state?.zones.stack.length ?? 0`)で state 未確定時もフック自体は必ず実行される設計になっており、条件付きフックの実行順不整合は無い。フック呼び出し順は安定。

## 4. モーション適用範囲(§9) — 4種のみ・スコープも正しい

`game.css` 296-342行目に4つの `@keyframes` のみ追加: `celebrate-draw` / `celebrate-etb` / `celebrate-stack-flash` / `celebrate-life-gain` / `celebrate-life-loss`(ライフは gain/loss で2キーフレームに分割、ブリーフの「④ライフ・ダメージ」1種に相当・許容範囲)。
- ドロー = `.hand-ribbon__cards .game-card`(手札カードのみ)。
- ETB = `.board-shelf .game-card`(`Board.tsx` の creature/others シェルフのみ。`Board.tsx:62` で `tl.includes('Land')` を除外しており LandRow には及ばない。スタック帯にも及ばない)。
- 解決閃き = `.stack-band--flash`(JSが length 減少時のみ付与)。
- ライフ = `.status-band__life--gain/--loss`。
それ以外の装飾モーション追加は無い。

## 5. reduced-motion完全性 — clean

`game.css` 333-342行目の `@media (prefers-reduced-motion: reduce)` ブロックは4種全てのアニメ適用セレクタ(`.hand-ribbon__cards .game-card, .board-shelf .game-card, .stack-band--flash, .status-band__life--gain, .status-band__life--loss`)を `animation: none !important` で停止し、加えて `.game-card` の `transition: none !important` も停止している。`sound.ts` の `celebrate()` は `reducedMotion()` (`window.matchMedia('(prefers-reduced-motion: reduce)')`) でハプティクスをガードしている(76-84行目)。音は意図通り opt-in のままガードなし(仕様通り)。

## 6. 音の安全性(§7b / STOP③) — clean

- 外部アセット/依存なし: `sound.ts` は `OscillatorNode` + `GainNode` の純WebAudio合成のみ(`TONE` テーブルの周波数/波形/長さのみ)。
- 既定OFF: `motion.ts` `isSoundEnabled()` は未設定時 `false`(localStorage値が `'on'` の時のみ true)。
- AudioContext は遅延生成: `sound.ts:16-30` の `audioContext()` はモジュールインポート時でなく初回 `playTone()` 呼び出し時(=ユーザージェスチャ由来のクリックハンドラ内)にのみ `new Ctor()` する。全呼び出し元(HandRibbon library-tile onClick / gameController.requestResolveTop / ThumbZone.runPrimary)はクリック/キー操作起点。
- `any` 不使用: `webkitAudioContext` 分岐は `(window as unknown as { webkitAudioContext?: typeof AudioContext })` で型ガード、`unknown` 経由(プロジェクトの `any` 禁止規約に整合)。
- 音数: `TONE` は `primary`/`draw`/`resolve` の3種のみ(≤3・各 ≤0.24s、ブリーフの「3音以下」を満たす)。

## 7. 装飾層/非ブロッキング — clean

`celebrate()` (`sound.ts:76`) と各呼び出し元は同期発火のみで `await` なし。`requestResolveTop()`(後述の findings #2 を除き)も `celebrate('resolve')` の直後に同期的に `store.resolveTop()` を呼ぶ。ボタンの `disabled` 制御は既存のロジック(canUndo/canRedo/stackActive)のみで、演出中に操作を止める新規の disable は追加されていない。

## Findings(重大度順)

### [HIGH] #1 — resume(再開)時に celebrate-draw / celebrate-etb が既存カード全体へ誤発火(因果違反)
- **file**: `src/components/game/game.css:302`, `src/components/game/game.css:310`(併せて `HandRibbon.tsx` / `Board.tsx` のマウント構造)
- **failure_scenario**: `App.tsx:97-108` の「中断したゲームが見つかりました」→「ゲームを再開」(`restoreGame(snapshot)`)を押すと `GameScreen` がまっさら再マウントされる。`celebrate-draw`/`celebrate-etb` は `.hand-ribbon__cards .game-card` / `.board-shelf .game-card` という**静的CSSセレクタ**に紐づいており、JS側で「今引いた/今出た」かどうかの判定は一切していない(単純にDOM要素がマウントされた瞬間に再生される)。そのため、再開時にすでに手札にある全カードがドロー・スライドインを、すでに戦場にある全パーマネントがETBバウンス+金縁を、**何もプレイされていないのに**一斉再生する。design-system §7「因果の可視化…ただの装飾アニメは禁止」および §9 Don't に反する。対照的に `StackBand`/`StatusBand` の解決閃き・ライフフラッシュは前回値との差分をJSで比較しており、この誤発火は起きない(mount時は `prevLen.current`/`prevLife.current` が初期値と一致するため)。
- **verdict**: CONFIRMED(コード読解で機械的に再現可能。resume機能は `App.tsx` に実装済みの一次機能で、edge caseではない)

### [HIGH] #2 — `requestResolveTop()` がフェッチダイアログ分岐でも「解決」を先撃ちし、キャンセルされても取り消せない
- **file**: `src/components/game/gameController.tsx:274-283`
- **failure_scenario**: `requestResolveTop()` は先頭で無条件に `celebrate('resolve')` を呼んだ後、`fetchDialogForTop(s)` が非nullなら `setFetchDialog(dialog)` して **`store.resolveTop()` を呼ばずに return** する(まだ何も解決されていない)。ユーザーがそのままフェッチダイアログを `onClose`(`gameController.tsx:790`)でキャンセルすると、状態は一切変化しないにもかかわらず「解決」のハプティクス+音は既に鳴っている。「演出は状態変化を祝う装飾層」という契約(design-system §7 因果原則・playbook §3 D5(f))に反し、起きていない/起きるかどうか未確定のイベントを祝ってしまう。`ThumbZone.tsx:112` と `StackBand.tsx:55` の両呼び出し元がこの経路を共有する。
- **verdict**: CONFIRMED

### [MEDIUM] #3 — `shouldCompress`/`motionLevelFor`/`motionDuration` が未配線(連続ドロー自動圧縮が実装されていない)
- **file**: `src/components/game/motion.ts:35-52`
- **failure_scenario**: `grep -rn "shouldCompress\|motionLevelFor\|motionDuration" src/` した結果、3関数とも `motion.ts` 自身の定義と `review.d5-motion.test.ts` 以外どこからも呼ばれていない。ブリーフ (a)(1) が明示する「連続ドローは自動圧縮(~120ms級)」は実装されておらず、`HandRibbon` のドローアニメは常に固定 `--dur-move`(240ms)で、`shouldCompress` を使った圧縮判定も `motionDuration` による reduced-motion分岐もCSS側(静的 `@media` ブロック)で別途処理されており、これらのpure関数はテストのためだけに存在する死コード。実害(体感のブロッキング)は各カード要素のCSSアニメが並列実行されるため薄いと推測されるが、review.\*でピン留めされた契約項目が実行時コードに反映されていない。
- **verdict**: CONFIRMED(未配線を確認済み)。実プレイでの体感悪化は未検証(実機確認事項として残る)。

### [LOW] #4 — celebrate-etb/celebrate-stack-flash の一部キーフレームがトークンでなく生rgba値
- **file**: `src/components/game/game.css:306`, `src/components/game/game.css:315`
- **failure_scenario**: `box-shadow: 0 0 0 0 rgba(240, 207, 140, 0)`(`--gold-bright` と同色を意図しているが変数参照でなく直書き)、`0 0 34px rgba(159, 212, 255, 0.6)`(`--stack-glow-c` と同色を直書き)。値自体は既存トークンと同一色で「新規」の色ではないが、design-system §9 Do/Don't「新規の生hex/px禁止(トークン外)」の字面には抵触する。box-shadowのアルファ0→開始状態を表現するための技術的必要性はあるが、`color-mix()`等でトークン参照にできた可能性がある。実害は無し(視覚は正しい)。
- **verdict**: PLAUSIBLE(字面違反・実害なし)

### [LOW] #5 — 山札が空でも `celebrate('draw')` が発火する
- **file**: `src/components/game/HandRibbon.tsx:32-35`
- **failure_scenario**: `library-tile` の `onClick` は `celebrate('draw')` を `store.draw(1)` の**前に**無条件で呼ぶ。ライブラリが0枚で実際には1枚も引けない(ミル/敗北条件のみ発生)場合でも、ハプティクス+音は鳴る。DOM上は新規カードがマウントされないためCSSアニメ自体は再生されず視覚的実害は無いが、成功していない操作を祝う点で#2と同種の軽微な因果違反。
- **verdict**: PLAUSIBLE(実害は最小)

## まとめ

機械4点・禁止ファイル整合性・hooks安全性・4種スコープ限定・reduced-motion完全性・音の安全性(WebAudio合成/既定OFF/遅延生成/`any`不使用)は**すべてclean**。赤旗は2件(HIGH #1 resume時の誤発火、HIGH #2 フェッチダイアログでの解決先撃ち)——いずれもクラッシュやデータ破損はないが、design-system §7の「因果を持たない装飾アニメ禁止」契約に対する具体的な違反であり、判定者裁定が必要。MEDIUM #3(未配線の圧縮ロジック)は契約未充足のギャップとして記録。LOW 2件は軽微。
