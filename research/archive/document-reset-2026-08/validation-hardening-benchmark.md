# VALIDATION-HARDENING-2026-08 fast-check benchmark

測定は同一マシンのtemporary git repositoryで、旧`git status --short`収集と新`collectChangedFiles`+domain resolverのdry-run選択を比較した。Vitest/buildの実行時間ではなく、変更検出・選択計算の時間であり、選択漏れがないことを主目的とする。

| case | before files / plan | after files | after domains | escalation | test files | before ms | after ms |
|---|---|---|---|---|---:|---:|---:|
| A docs-only | docs/ / none | docs/change.md | docs | targeted | 2 | 7.90 | 54.52 |
| B engine single file | src/ / none | src/engine/changed.ts | engine-state<br>engine-zones<br>store<br>engine-turn<br>engine-stack<br>engine-mana | targeted | 207 | 7.32 | 331.39 |
| C UI single file | src/ / none | src/components/Changed.tsx | ui-interaction<br>ui-responsive<br>audio-visual<br>store<br>engine-state<br>engine-zones<br>engine-turn<br>engine-stack<br>engine-mana | targeted | 298 | 7.65 | 471.68 |
| D store/shared state | src/ / none | src/store/changed.ts | store<br>engine-state<br>engine-zones<br>engine-turn<br>engine-stack<br>engine-mana | targeted | 207 | 7.05 | 320.61 |
| E scripts/checks | scripts/ / dom: scripts/__tests__ | scripts/checks/changed.mjs | build-tooling<br>docs | full | 29 | 7.09 | 80.74 |
| F package/build config | package.json / none | package.json | build-tooling<br>docs | full | 29 | 7.61 | 80.26 |
| G committed clean worktree | none / none | src/engine/committed.ts | engine-state<br>engine-zones<br>store<br>engine-turn<br>engine-stack<br>engine-mana | targeted | 207 | 7.09 | 330.86 |
| H unknown path | vendor/ / none | vendor/unknown.mjs | release | full | 0 | 7.89 | 25.19 |

結論: 旧方式はGのcommit済みclean差分を0件、F/Hをtestなしとして扱う。新方式はGをbase-awareで検出し、Fをfullへ、Hをrelease/fullへ昇格する。A〜Dはdomain dependencyを展開し、同じtest fileはSetで一度だけ選択する。
