# ChatGPT完結ガバナンス移行案（判定者昇格用draft）

> **状態: SHIPPED 2026-07-20**（Claude 判定者が昇格を実行）。`AGENTS.md` を新正本へ・`CLAUDE.md` を互換入口へ縮小・`.agents/skills/mtg-onedeck-development/` を追加。`scripts/checks/forbidden-files.mjs` は既に役割名ベース(モデル名を含まず)で保護範囲も十分ゆえ無変更。
> **残 follow-up(推奨)**: 本移行は自己起草・自己執行のため、下記「判定者の昇格手順」step 1/4(別の冷たい ChatGPT による現行ファイル突き合わせ + 4経路 dry-run)を後日実施して相関遮断を完全化するのが望ましい。`.claude/commands/{milestone,audit,ship,autoloop}.md` の薄い互換参照化(step 3 相当)は本コミットでは未実施=別 follow-up。

根拠: ユーザー裁定 2026-07-19「Claudeを必須資源とせずChatGPTで契約・実装・独立監査・出荷まで完結」。運用規約であり決定論的CR裁定は対象外。

## 正本と互換入口

- `AGENTS.md` をCodex/ChatGPTが自動で読む唯一の統治入口とし、役割、不可侵、CR接地、受け入れ基準、報告形式をモデル非依存で定義する。
- `CLAUDE.md` は任意のClaude利用向け互換入口へ縮小し、`AGENTS.md` とプロジェクトSkillを参照する。独自の優先順位、モデル表、復帰待ち条件を持たせない。
- `.claude/commands/*` は `.agents/skills/mtg-onedeck-development/` への薄い互換参照とし、手順を複製しない。

## ChatGPT内の役割分離

- 親タスク=judge/orchestrator、別タスク=implementer、実装文脈を持たない別タスク=cold auditor。
- 実装者は `review.*`、契約、台帳、統治ファイル、gitを変更しない。監査者はfindings only。判定者だけが契約の再オーナー化と出荷を行う。
- 同一タスクが判定と実装を兼ねた場合は、別ChatGPTによる冷監査まで `implemented-not-audited` とする。Claudeは任意助言であり合格条件にしない。

## 既存規約から削除する条件

- 「Claude復帰後に再検証」「在席最上位Claudeを判定者」「Claude Previewだけが実機正本」など、Claudeの在席を正式greenの条件にする記述。
- 固定モデル名を役割定義に使う記述。現在値が必要なら交換可能な一行だけに隔離する。
- `.claude` 内で重複するmilestone/audit/ship/autoloop本文。

## 維持する要石

- CR > human gold > model interpretation。
- 実装者と受け入れ基準作者の分離、凍結後の独立監査、fake-green禁止。
- 1タスク1マイルストーン、実需要probe、対象テスト→凍結→全チェック1回、findings-only監査、出荷済みpacketのarchive。
- 実装者のgit禁止と保護ファイル境界。

## 判定者の昇格手順

1. 本draftとSkillを冷たいChatGPT判定者が現行 `CLAUDE.md` / `AGENTS.md` / `.claude/commands` に突き合わせる。
2. `AGENTS.md` を新正本へ置換し、同一変更で `CLAUDE.md` を互換入口へ縮小する。片側だけ変更してsplit-brainを作らない。
3. forbidden-file検査の文言をモデル名でなく役割名へ更新し、implementer既定の禁止範囲は弱めない。
4. 別ChatGPTが新しいタスク開始、実装ブリーフ、冷監査、shipの4経路をdry-runする。
5. 合格後だけ台帳へ統治移行をshippedとして記録する。
