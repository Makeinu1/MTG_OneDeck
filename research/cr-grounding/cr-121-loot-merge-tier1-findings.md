# Tier-1 独立監査 findings — cr-121 可変数 loot の main 回収マージ

監査対象: `git diff HEAD`（`HEAD=d981c39068f45265a57705e4ad616a6305ab892a`、`MERGE_HEAD=b8aaa333d316efc8e90676452ee14f231827d04f`、merge-base=`bae39228fd81bc0de284062a16612f15a8045389`）。監査時点は未コミットのマージ継続中で、`docs/engine-spec.md` と `src/store/gameStore.ts` は index 上 `UU`、working tree に判定者の解消結果がある。

## Findings

### HIGH-1 — RED — MP controller の private hand / draw recipient が variableLoot 終端へ伝搬されていない

- **場所**: `src/store/gameStore.ts:3399`, `src/store/gameStore.ts:3403`, `src/store/gameStore.ts:3675`
- **根拠**:
  - `confirmGuidedDiscard` の選択カード membership は `cur.zonesByPlayer[controllerId].hand` へ正しく合成されたが、同じ branch 由来ブロックの `remainingHand` は `cur.zones.hand.length` のまま。これは MP-STATE 後の P1 compatibility view であり、能力 controller の手札ではない。
  - max/hand-empty 確定時の `{ type: 'draw', count: drawCount }` と cancel/完了時の同 command はどちらも `playerId` を持たない。`src/engine/commands.ts:4033` は省略時を `state.localPlayerId` とするため、相手 controller の self-loot でも P1 が引く。
  - 一方、同関数の discard は main 側の `CompileContext.controllerId` 合成により `buildGuidedCommands` が `{type:'discard', playerId:'OPPONENT_A'}` を生成する。結果として「相手が捨て、P1が引く」という分裂した解決になる。
- **CR/契約**: CR 109.5 の “you/your” は object/ability controller。CR 701.9a はその player の hand から discard、CR 121.1 はその player の library からその player の hand へ draw。engine-spec §34.43 I30/I31 と §34.45 の controller actor 伝搬にも反する。CR608.2h の実捨て枚数自体が正しくても、実行主体が違えば MP 環境で誠実ではない。
- **到達可能性・実証**: 内部値の直接注入ではなく、現行の公開 store API だけを使う一時 probe を作成した。`newGame` → `dispatch(setController, OPPONENT_A)` → `dispatch(createScenarioDummy, playerId=OPPONENT_A)` → `moveCard` で相手 hand/library を構成 → `resolveTop` → `confirmGuidedDiscard` / `cancelGuidedPrompt` の順。3件すべて red:
  1. P1 hand は残っているが相手 hand が1枚で尽きる `up to two` は、1枚捨てた後も `pendingGuided` が残った（実出力の pending commands は opponent discard 1件、prompt は `discarded:1/max:2`）。
  2. `up to one` の max 到達後、相手 library は `1→1` のままで相手が引かなかった。
  3. `any number ... plus one` を0枚で完了しても、相手 library は `1→1` のままで相手が引かなかった。
  command trace 上、後二者の draw は `playerId` 省略により P1 へ送られる。
- **失敗シナリオ**: opponent-controlled Tersa/Celes 型 source を解決する → opponent の card を discard → P1 hand 枚数で終了判定される／確定 draw が P1 library→P1 hand へ移る。controller 間の zone isolation とイベント subject が破れる。
- 一時 probe `src/store/__tests__/__audit.cr121-merge-mp-probe.test.ts` は実行後に削除し、`git status --short` が監査開始時の対象一覧へ戻ったことを確認した。

### MEDIUM-1 — RED — judge-owned 5 pin は P1 誠実性には非 vacuous だが、今回最重要の MP 合成を拘束しない

- **場所**: `src/store/__tests__/review.cr121-loot-variable-count.test.ts:60-67`, `:75-161`
- 5 pin はすべて `newGame` の P1 source と `state.zones.hand/library`（P1 compatibility view）だけを使う。opponent-controlled source、`zonesByPlayer[controllerId]`、draw/discard command の `playerId` を1件も観測しない。このため HIGH-1 が存在しても復元後 `5 passed (5)`。
- ただし P1 範囲での拘束力は実証済み。監査前に次を記録:
  - `gameStore.ts` SHA-256=`8be1b0ddfe35661390cfe0c5fc3e7f0ffadbe4100b19a5bacdd066212db1ff79`
  - `git diff HEAD -- gameStore.ts` SHA-256=`907b5021666496d12ce27c629f484f122ecb30a8256076d3ae8a56a07726b308`
  - review file SHA-256=`e179c666da50f7ff793b4b725e21b24349bc26927408f486204229114ef87e9d`
  - `git diff HEAD -- review...` SHA-256=`7f22f746b642278f03e485c3ef670c9523d4ca706d19adf6f2af3d8672ef8aa1`
- **vacuity 実測**: `cancelGuidedPrompt` の variableLoot draw を一時的に `discarded` 由来から `max` 由来へ破壊して review file 単独実行 → `2 failed | 3 passed (5)`。HONESTY pin は実測 `2` 対 expected `1`、0-discard pin は実測 `2` 対 expected `0` で red。
- 直後に一時変更を復元し同テストを再実行 → `5 passed (5)`。上記4つの SHA-256 が監査前後ですべて一致したため、対象実装・review file・両 `git diff` は byte-identical。review file 自体は一度も変更していない。
- MERGE_HEAD 上の review blob と working tree の `git hash-object` もともに `51862584ad58c7517afce9b10294c7611939bc65`。マージによる assertion weakening、`skip`/`only`、削除行はゼロ。

### MEDIUM-2 — RED — 台帳が未完了の main 着地を完了済みとして記録している

- **場所**: `research/cr-grounding/cr-backbone-ledger.json` plannedSequence[11] `status` / `evidence`（ファイル上 `:127-132` 付近）
- JSON parse は成功し、idx11 の契約参照は §34.47、archive path も実在し、2026-07-18 の節番号振替説明は docs 実体と一致する。
- しかし監査時点の実 git 状態は `MERGE_HEAD` が存在し、2ファイル `UU`、merge commit 未作成、main push/Pages deploy 未実施。にもかかわらず `status:"shipped"` かつ `**2026-07-18 main着地完了**` と断定している。さらに HIGH-1 が実証されており、同 evidence の「gameStore衝突…合成で解消」も正しい解消を示す記録になっていない。
- **失敗シナリオ**: 台帳 reader が idx11 を出荷済みとして後続へ進める → main/Pages 未反映または MP controller 破損を見落とす。出荷状態の正本として事実不一致。
- 台帳内容は判定者専有のため、本監査では変更していない。

## 固有検査項目の結果

1. **gameStore.ts 衝突解消 — RED / HIGH-1**: membership guard の MP 合成は正しいが、branch 由来追加行に `cur.zones.hand` 直参照1件と `playerId` 無し draw 2件が残存。既存 main の P1 local-view 参照ではなく、今回追加された variableLoot ブロックそのもの。
2. **variableLoot 誠実性 / review 5 pin — RED / HIGH-1 + MEDIUM-1**: P1 では実捨て枚数・cancel完了・floor・cross-player wording fail-closed が緑かつ非vacuous。MP の “you=controller” 経路では hand-empty と draw recipient が壊れる。`VARIABLE_DISCARD_EXCLUSION_RE` は `Target player ...` を manual に保つが、opponent-controlled self-loot は除外対象ではなく正当に到達するため fail-closed guard では救えない。
3. **engine-spec 衝突解消 — PASS**: §34.42〜34.46 は各1件で HEAD の該当末尾と SHA-256 `ac199327f6f18bd9878b8e4963b9da4de4e68ca2ee9736adfe2a528d2f0f27e2` が一致。branch §34.42 は見出しを §34.47 に正規化すると working tree §34.47 と `diff -u` 差分ゼロ。節42〜47の重複/欠落なし、対象全ファイルの conflict marker ゼロ。
4. **台帳 — RED / MEDIUM-2**: valid JSON、idx11 evidence の §34.47 振替・archive 移設は一致。2026-07-18 main着地完了/ship の事実記録は現状と不一致。
5. **compile.ts / ir.ts と 7/15以降 main の意味衝突 — RED / HIGH-1**: recognizer の厳密2節・optional拒否・完全一致・除外語自体には新たな over-fire を発見せず、main の library-search/temporary-return/destroy composite と形が重ならない。一方 main は `CompileContext.controllerId` を count-driven/guided command へ伝搬する意味変更を導入しており、branch の store 内生成 draw がその新前提を取り込んでいない。auto-merge が構文成功しても controller actor 意味論が落ちた実例。
6. **countSpec() 回帰中立 — PASS**: `git diff HEAD -- ir.ts` は union member/comment の additive hunkのみ。`countSpec()` 本体差分なし、`resolveCount()` 本体差分なし。非test `src` 全走査で `{kind:'up-to'}` / `{kind:'that-many'}` の producer はゼロ（宣言2箇所のみ）で inert。Lammasu/Tolsimir 回帰pinを含む全suiteも緑。
7. **機械4点 — PASS（ただし HIGH-1 を検出しない）**:
   - `npm run lint` → exit 0。
   - `npx tsc --noEmit` → exit 0、出力なし（root config 上 no-op であり型の正は build）。
   - `npx vitest run` → exit 0、`Test Files 234 passed (234)` / `Tests 1964 passed (1964)`。
   - `npm run build` → exit 0、`tsc -b && vite build` 成功（150 modules、chunk-size warningのみ）。生成 `dist/` は確認後削除し不存在を確認。
8. **禁止ファイル走査 — PASS（brief 明示対象は別記）**: `CLAUDE.md` / `AGENTS.md` / `eslint.config.js` / `package.json` / `rule/` の混入なし。`docs/`・`research/`・`src/engine/`・`review.*` は standing 上の要注意領域だが、今回の brief 明示対象と一致。review blob は branch と同一、docs は上記三者照合済み、台帳は読み取りのみ（本 findings ファイル以外は監査変更なし）。

## Ship 推奨

**ship 不可 — HIGH-1 の MP controller hand/draw routing を実装側で修正し、MP opponent-controlled variableLoot の review pin を追加してから再監査すべき。**

---

# Round 2 再監査（2026-07-18）

監査対象は同じ進行中マージ（`HEAD=d981c39068f45265a57705e4ad616a6305ab892a`、`MERGE_HEAD=b8aaa333d316efc8e90676452ee14f231827d04f`、`origin/claude/autoloop-ropx9v=b8aaa333d316efc8e90676452ee14f231827d04f`、merge-base=`bae39228fd81bc0de284062a16612f15a8045389`）。前回の HIGH-1 / MEDIUM-1 / MEDIUM-2 の修正後 working tree を findings only で再監査した。

## Findings

**新規 finding なし。前回の HIGH-1 / MEDIUM-1 / MEDIUM-2 はすべて PASS。**

## 前回 finding の再判定

### HIGH-1 — PASS — controller の private hand と draw recipient が3箇所とも伝搬された

- `src/store/gameStore.ts:3401`: 手札尽き判定は `cur.zonesByPlayer[controllerId].hand.length`。前回の `cur.zones.hand` 直参照は消失。
- `src/store/gameStore.ts:3407`: max/hand-empty 確定 draw は `{ type: 'draw', count: drawCount, playerId: controllerId }`。
- `src/store/gameStore.ts:3681-3686`: cancel 確定 draw は state が存在する通常到達経路で `playerId: guidedControllerId(cur, pending)` を合成する。`cur` が null の防御分岐だけは構文上 `playerId` を省略するが、同条件では `finishGuidedResolution` が `src/store/gameStore.ts:1554-1555` で return し command は適用されない。実ユーザー操作から到達する playerId 無し draw は残っていない。
- `git diff HEAD -- src/store/gameStore.ts` の variableLoot ブロックを再走査し、到達可能な `zones.hand` 直参照・playerId 無し draw はゼロ。opponent-controlled source の到達可能性は round 1 の公開 store API probe で既に実証済みで、round 2 の MP pin でも同じ controller 分離を観測した。

### MEDIUM-1 — PASS — MP 2 pin は非 vacuous で、前回 HIGH の3原因を拘束する

- 修正版 baseline: `npx vitest run src/store/__tests__/review.cr121-loot-variable-count.test.ts` → `7 passed (7)`。
- MERGE_HEAD の5 pinからの diff は MP 2 pinの純追加88行だけ。既存 assertion の削除・`skip`/`only`・期待値緩和はゼロ。
- 一時破壊A（前回 HIGH-1 の旧状態を3箇所同時復元）: hand判定を `cur.zones.hand`、confirm/cancel draw の `playerId` を削除して同 review を実行 → exit 1、`2 failed | 5 passed (7)`。cancel pin は相手 hand が expected 2 / actual 1、hand-exhaustion pin は `pendingGuided` が null にならず red。
- 一時破壊B（confirm の確定 draw の `playerId` だけ削除）: 同 review → exit 1、`1 failed | 6 passed (7)`。hand-exhaustion pin は相手 hand が expected 1 / actual 0 となり、3件目の修正も単独で拘束することを確認。
- 各破壊を直後に復元し、最終 review は再び `7 passed (7)`。監査開始前後で次が一致したため byte-identical:
  - `gameStore.ts` SHA-256=`488c48276c51b76579237b2120e30dd8156408222527f6f47ba4dfb303ca78fa`
  - `git diff HEAD -- gameStore.ts` SHA-256=`0b2d2002c9ef7a460c3b06cae6f4c0b49e430a9ddad0ecd1692273bda914f0da`
  - review file SHA-256=`ba46743e90e273b6adc93662a6198fe9ef6c84504e3fab453d1b21cd921a912c`
  - `git diff HEAD -- review...` SHA-256=`2d86ec4c4d72bf201d6af479b95e7b8c758143449abeede9843c41ef1f54a2d6`

### MEDIUM-2 — PASS — idx11 evidence は valid JSON かつ実経緯と一致

- `research/cr-grounding/cr-backbone-ledger.json` は `JSON.parse` 成功。
- idx11 evidence は round 1 の冷Codex HIGH（単一プレイヤー API 残骸3箇所）→判定者の外科修正→MP review pin 2件追加→破壊で2 red / 復元で7 green、という実ファイル・実測と一致。
- 参照 commit `4ee804b` / `0fbceef` は双方実在し、archive draft と round 1 findings も実在。契約参照は working tree の `docs/engine-spec.md` §34.47 と一致し、§34.42〜34.47 は各1節。
- 前回の事実不一致だった「main着地完了」の完了済み断定はなく、現在は進行中マージ自身を指す「main着地(本コミット)」として修正経緯を記録している。merge commit / push / Pages deploy がまだ未実施であることを、過去に完了した外部事実としては主張していない。

## 固有検査項目

1. **非 variableLoot cancel — PASS**: activation/mana pending の `set({ pendingGuided: null })` と、通常 guided cancel の `advanceGuidedResolution([])` は HEAD と同一。追加された variableLoot truthy 分岐の偽側は従来処理へそのまま到達する。全suiteも緑。
2. **前回 PASS 項目 — PASS**: engine-spec §34.42〜34.47 は各1件、CountSpec の `countSpec()` / `resolveCount()` 本体差分なし、非test producer は型宣言2件だけで inert。対象全ファイルの conflict marker と `git diff --check HEAD` の警告はゼロ。
3. **機械4点 — PASS**（各コマンドを単独実行）:
   - `npm run lint` → exit 0。
   - `npx tsc --noEmit` → exit 0、出力なし（root config 上 no-op。型の正は build）。
   - `npx vitest run` → exit 0、`Test Files 234 passed (234)` / `Tests 1966 passed (1966)`。期待値どおり round 1 の1964から MP pin +2。
   - `npm run build` → exit 0、`tsc -b && vite build` 成功（150 modules、既知の chunk-size warning のみ）。生成 `dist/` は削除し不存在を確認。
4. **禁止ファイル / scope — PASS（brief 明示対象は除外して精査）**: `git status --short` 全件を確認。`review.*`、`docs/`、`research/`、`src/engine/` は今回の明示対象と一致し、weakening・marker残骸・scope漏れなし。`rule/`、`CLAUDE.md`、`AGENTS.md`、`eslint.config.js`、`package.json` の混入なし。index の `UU` 2件は進行中マージの未stage状態で、working tree の conflict marker はゼロ。

## Ship 推奨

**ship 可 — round 1 の HIGH-1 / MEDIUM-1 / MEDIUM-2 は解消され、独立再監査の赤旗はゼロ。判定者が解消済み2ファイルを stage して進行中マージを完了してよい。**
