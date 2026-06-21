---
description: Codexの成果を独立監査(review採点+機械チェック4点+要所の実機)
---

直近の Codex 実装を **Fable が独立に**監査する。実装側の「テスト通過」報告は合否に使わない。

1. **diff 精査**: `git status --short` と `git diff <変更ファイル>` を読み、契約(`docs/engine-spec.md`)どおりか・変更禁止(`src/engine/`不要変更/`review.*`/`docs/`/`CLAUDE.md`/`eslint.config.js`/`CACHE_SCHEMA_VERSION`)を侵していないか確認。**おかしい設計は外科的に直すか Codex に差し戻す**(理由を明示)。
2. **レビュー採点**: 自分が書いた `review.<key>` を実行(`npx vitest run <path>`)。FP/FN ガード(`review.m66` 等)も巻き込んで壊れていないか。
3. **機械チェック4点(各個に・&&連結しない)**: `npm run lint` / `npx tsc --noEmit` / `npx vitest run`(全通過) / `npm run build`。`dist/` は生成したら削除。
4. **実機は要所だけ**(トークン節約): UIに見える変化があるときのみ Claude Preview(`.claude/launch.json` の mtg-onedeck)。**コンソールエラー0件**が合格。eval は「contextmenu発火」「読み取り」を別evalに分ける(async描画のため)。ロジックのみの変更は実機を省き `review.*`+CIに委ねる。
5. 分類精度に関わる変更なら `npm run accuracy` でハーネス再実行し before/after を確認、`review.classifier-corpus` 緑を確認。
6. 全部緑なら `/ship` へ。1項目でも落ちたら直してから**最初から**再実行。
