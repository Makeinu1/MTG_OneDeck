# S-SBA: damage-marked substrate — 実装ブリーフ(Codex 自己完結)

発行: Fable / 2026-06-30
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
対象CR: 704.5g / 704.5h / 120.1 / 120.3 / 120.6 / 510.2 / 514.2

## 目的(1行)

creature に **damage-marked state** を導入し、CR 704.5g(lethal damage)/ 704.5h(deathtouch damage)を `performStateBasedActionsOnce` の SBA として実装する。combat phase の自動化はしない=state + command + SBA の substrate だけ。

## アーキ判断(Fable 確定・固定制約。変更不可)

1. **state**: `CardInstance` に `damageMarked: number`(既定 0・常に >= 0)を追加。deathtouch 由来の致死を別途追跡するため `hasDeathtouchDamage: boolean`(既定 false)も追加(CR 704.5h は「damage from a source with deathtouch」を要件にするため、量でなく「deathtouch 由来の damage が1点でもマークされたか」で十分)。
2. **command**: `markDamage`(`{ type:'markDamage'; cardId; amount; deathtouch?: boolean }`)= `damageMarked += max(0,amount)`、`deathtouch` 真なら `hasDeathtouchDamage = true`(amount>0 のとき)。`clearMarkedDamage`(`{ type:'clearMarkedDamage'; cardId? }`)= 指定カード(無指定なら全 battlefield creature)の `damageMarked=0`/`hasDeathtouchDamage=false`(CR 514.2 cleanup)。
3. **SBA**(`performStateBasedActionsOnce`・commands.ts:527 付近、既存 704.5f/i/d/e と同じ枠組み):
   - **704.5g**: `typeLine` が creature かつ toughness が定義され `> 0` かつ `damageMarked >= toughness` → owner's graveyard へ(`sbaApplied:'704.5g'`)。
   - **704.5h**: creature かつ toughness `> 0` かつ `hasDeathtouchDamage` かつ `damageMarked >= 1` → owner's graveyard へ(`sbaApplied:'704.5h'`)。
   - **既存 704.5f(toughness <= 0)との非二重化**: toughness<=0 は 704.5f が先取りするので、704.5g/h は `toughness > 0` のみを対象にする(上記条件で担保)。同一 SBA pass で同一カードを二重に graveyard へ送らない。
   - toughness は実効値(`face.toughness` ベース。+1/+1・-1/-1 counter があれば既存の実効計算に合わせる。既存 704.5f がどう toughness を読むかに揃えること)。
4. **前方互換**: 旧 snapshot 復元(`restoreGame` 系・gameStore)で `damageMarked`/`hasDeathtouchDamage` 欠落を backfill(0/false)。これを怠ると旧 snapshot 復元でクラッシュ。

## スコープ境界(厳守・DEFER=実装しない)

- **full combat phase orchestration**(declare attackers / declare blockers / combat damage step の自動進行)は実装しない。damage は `markDamage` command でマークされる(手動/将来の combat compiler 由来)。本 Phase は「damage がマークされたら SBA が正しく動く」ことだけ保証する。
- **regeneration replacement**(CR 704.5g の「unless ... regenerated」/ CR 701.18 regenerate)は実装しない。regeneration shield state が無いので 704.5g は無条件に destroy(graveyard)する。これは scope-boundary として engine-spec に明記。
- **first/double strike の damage step 分割**は実装しない。
- damageMarked の auto-clear は `clearMarkedDamage` command を提供する。**もし既存に turn cleanup / end-of-turn の通る箇所があればそこへ配線**(CR 514.2)。**無ければ command 提供のみとし、auto-clear-at-cleanup は scope-boundary に明記**(turn/phase orchestration が未モデルのため)。既存コードを調べて判断し、判断結果を draft に記す。

## 対象ファイル(調査して確定すること)

- `src/engine/types.ts` — `CardInstance` に `damageMarked`/`hasDeathtouchDamage`。
- `src/engine/commands.ts` — `GameCommand` union に `markDamage`/`clearMarkedDamage`、`applyCommand` の case、`performStateBasedActionsOnce` に 704.5g/h。既存 704.5f/i の destroy ヘルパ(graveyard 送り + ZoneChangeEvent + `sbaApplied`)を再利用する。
- `src/store/gameStore.ts` — snapshot 復元 backfill。end-of-turn/cleanup があれば `clearMarkedDamage` 配線。
- 初期化(`init.ts`)で新カードの `damageMarked=0`/`hasDeathtouchDamage=false`。
- テスト: golden(下記)+ `commands.test.ts` 等の unit。

## golden ケース(`golden-cases.json` 追記 → `crGroundingGoldenCases.test.ts` 実行可能化)

1. `cr-sba-lethal-damage-destroys-creature`(704.5g/120.6): 2/2 creature に `markDamage amount=2` → SBA で graveyard。`sbaApplied:'704.5g'`。
2. `cr-sba-sublethal-damage-survives`(704.5g): 3/3 に `markDamage amount=2` → 残存(graveyard 行きでない)。
3. `cr-sba-deathtouch-any-damage-destroys`(704.5h): 4/4 に `markDamage amount=1, deathtouch=true` → graveyard。`sbaApplied:'704.5h'`。
4. `cr-cleanup-clears-marked-damage`(514.2): `markDamage` 後 `clearMarkedDamage` → `damageMarked=0` で SBA destroy されない。

## 変更禁止 / 規律

- **`review.*` を名に含むテストは変更禁止**(レビュー担当専有)。
- **`docs/` を直接編集しない**。型契約草稿は `research/cr-grounding/damage-marked-engine-spec.draft`(CR 条番号併記)へ。Fable が監査後に engine-spec §34.12 へ昇格・commit。
- **git 操作禁止**。`CLAUDE.md` に触れない。
- エンジンは純粋関数・GameState イミュータブル・`applyCommand` 決定的。
- I1〜I7 不変条件を維持。新 state(`damageMarked`)を足したので、必要なら不変条件(例: damageMarked>=0)を追加し fast-check に反映。
- ルール本文読み取りは英語 `oracleText` 正本。deathtouch 判定は既存のキーワード保有判定を使う(実カード由来の場合)。ただし本 Phase の golden は合成カードで `markDamage` の `deathtouch` フラグを直接使うので、実カードの deathtouch 検出配線は不要(combat compiler 側)。

## 受け入れ条件(全て緑)

- 機械チェック4点: `npm run lint` / `npx tsc --noEmit` / `npx vitest run` / `npm run build`。
- 上記4 golden が通る。
- 704.5g/h が `performStateBasedActionsOnce` の固定点で動き、既存 704.5f(toughness<=0)と二重に destroy しない。
- 旧 snapshot 復元が緑(backfill 効いている)。
- 既存テスト回帰なし。

## 中断時

「実装済み/残作業」を明示して再実行(最大2回)。それでも未完なら Fable が仕上げる。
