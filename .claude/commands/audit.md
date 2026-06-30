---
description: Codexの成果を独立監査(review採点+機械チェック4点+要所の実機)
---

直近の Codex 実装を**独立に**監査する。実装側の「テスト通過」報告は合否に使わない。監査は **Tier-1(委譲・機械的・findings only)** と **Tier-2(Fable・薄い裁定+再オーナー化)** に二分する。トークン経済の本丸=Tier-1 を Opus から剥がす。

**冒頭ゲート(必ず最初に)**: `git diff --name-only` に**未監査の `review.*`/`docs/` 変更**があれば赤旗。独立監査・再オーナー化を強制する(実装者が受け入れ基準を書いて循環させない=要石)。

## Tier-1(委譲=別 Codex/Sonnet・契約を変えない)
**実装の文脈を持たない別の冷たいセッション**(別 Codex セッション or `Agent` `model: sonnet`)へ、**自己批判的・敵対的プロンプト**で渡す。**外部権威(CR 真理テーブル・Fable 作 `review.*`・機械チェック)にアンカー**し、監査者の主観でなく外部真理で叩く。委譲先がやること:
1. **diff 走査**: `git status --short` / `git diff --name-only` で変更禁止侵害(`src/engine/`不要変更/`review.*`/`docs/`/`CLAUDE.md`/`eslint.config.js`/`CACHE_SCHEMA_VERSION`)を検出。
2. **テスト weakening 検出**: 変更テストの diff でアサーション削除/緩和(`expect` 弱化・`skip`化・閾値緩和)が無いか敵対的に検査。
3. **レビュー採点**: Fable 作 `review.<key>` を実行(`npx vitest run <path>`)。FP/FN ガード(`review.m66` 等)も巻き込んで壊れていないか。
4. **機械チェック4点(各個に・&&連結しない)**: `npm run lint` / `npx tsc --noEmit` / `npx vitest run`(全通過) / `npm run build`。`dist/` は生成したら削除。
5. **golden 配線確認**: ブリーフ指定の golden が実行可能テストに繋がっているか。
6. **scope 漏れ**: ブリーフの defer/隔離(例=「full SBA を引き込まない」「型のみ未配線」)を破っていないか。
出力 = `research/cr-grounding/<key>-tier1-findings.md`(各項目 PASS/赤旗 + 根拠)。**契約・コードは変更しない(findings only)**。

## Tier-2(Fable・薄)
1. findings の**赤旗だけ**読み、`{substrate誤り/compiler誤訳/物差し誤り/曖昧/誤検出}` に帰属裁定。**raw diff を行読みしない**。赤旗ゼロなら設計健全性のみ薄く確認。
2. **再オーナー化**: 草稿 docs(`*.draft`)を独立に CR へ当てて承認し `docs/` へ昇格(commit 前の必須1回)。
3. **実機は要所だけ**: UI に見える変化がある時のみ Claude Preview(`.claude/launch.json` の mtg-onedeck・**コンソールエラー0件**)。ロジックのみは省き `review.*`+CI に委ねる。
4. 分類精度に関わる変更なら `npm run accuracy` の before/after と `review.classifier-corpus` 緑を確認(委譲先に測らせ Fable は数値だけ判定)。
5. 全緑なら `/ship` へ。赤旗があれば Codex に差し戻し(理由明示)、直してから**最初から**再実行。

> 自律ループ中は Tier-1 を必ず委譲する(Fable が機械チェックを自走したら委譲漏れ)。`/autoloop` 参照。
