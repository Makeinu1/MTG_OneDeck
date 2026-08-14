# O4P-04A cold audit record

Milestone: `O4P-04A` Personal Workbench

Base SHA: `64ac8c6de1bc62262154cebf5419ae82d13bc3cb`

Audit authority:

- `research/cr-grounding/o4p-04a-personal-workbench.contract.draft.md`
- `research/cr-grounding/o4p-04a-acceptance-brief.draft.md`
- `research/cr-grounding/o4p-04a-cold-audit-brief.draft.md`

Independent read-only auditor: `/root/o4p04a_cold_auditor` using
`gpt-5.6-sol` with `xhigh` reasoning. The auditor made no file or git write and
did not run the release full check.

## Implementer boundary

The user requested Luna at extreme-high effort. The collaboration runtime did
not expose `gpt-5.6-luna`; the attempted model selection was rejected before an
implementer task existed. The Judge transparently selected the closest
available token-economic implementation alternative, persistent
`/root/o4p04a_terra_implementer` on `gpt-5.6-terra` with `xhigh` reasoning.
That implementer changed only additive source and ordinary tests, performed no
git operation, and used two bounded correction returns.

## Initial audit

- semantic fingerprint:
  `7709d75be1f7d3de3f89e4ac3d300a0de7885057243de19bf1d2d987f5fd9013`
- tree/context fingerprint:
  `af214cca10ad0c086fcea924dec1466ad7e2a5c24a1009ef6f36bde946974175`
- verdict: `AUDIT-FIX-REQUIRED`
- totals: BLOCKER 0 / HIGH 2 / MEDIUM 2 / LOW 1

The audit reproduced:

- `O4P-04A-CA-H001`: validator-accepted activated/triggered ability and spell
  copy stack objects made the entire workbench unavailable because they have
  no card runtime;
- `O4P-04A-CA-H002`: a P1/revision-12 concede confirmation survived a valid
  P2/revision-13 projection and could authorize the new Player;
- `O4P-04A-CA-M001`: concealed nonzero marked damage was omitted;
- `O4P-04A-CA-M002`: Judge review lacked real getter/descriptor/Proxy/
  hostile-prototype and native keyboard/focus evidence;
- `O4P-04A-CA-L001`: raw `active` protocol text was rendered in Japanese UI.

## Final repaired-candidate audit

- semantic fingerprint:
  `2b12350e8682c3e73299e355182e6ad1f47a8e35e8e804c11e82668dab058a7d`
- tree/context fingerprint:
  `9a814e4e4b7457a55fb09ec72977fcb5b27f9b6df24462abc9c575234bc5940f`
- context health: `ok` / `current`
- verdict: `AUDIT-OK-PENDING-FULL-CHECK`
- totals: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0

Every finding closed non-vacuously. All three synthetic stack kinds now use a
deeply frozen closed kind-label view without reconstructed definition, runtime,
source, target, choice, or legality data; synthetic objects outside stack fail
closed. Concede confirmation binds to Player/revision and disappears on drift.
Concealed damage is rendered in Japanese. Judge review exercises trap-safe
inputs, native focus/Enter/Space flows, focus-visible CSS, and no pointer-only
surface. Lifecycle status is displayed as `プレイ中` / `退席済み`.

The final targeted run passed 4 files / 23 tests. Scoped ESLint, `npx tsc -b`,
Vite build, and `git diff --check` passed. The auditor independently passed its
model/architecture and component/review splits and reported no regression.

## Fingerprint-matched browser evidence

After correction 2, the Sol Judge used one stable in-app browser session on the
deterministic dev fixture:

| Viewport | Horizontal overflow | Required elements outside width | Actions reachable | Workbench fixed elements | Console errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| 375x812 | 0 | 0 | yes | 0 | 0 |
| 812x375 | 0 | 0 | yes | 0 | 0 |
| 1440x900 | 0 | 0 | yes | 0 | 0 |

All viewports showed four Player summaries and the Japanese lifecycle label.
Browser interaction emitted exact refresh and priority-pass intents, opened and
canceled concede confirmation, and retained console error count zero.

Judge adjudication: the repaired candidate is eligible for metadata
confirmation and then the single fingerprint-matched release full check. CI,
Judge reownership, Pages HTTP evidence, terminal ledger state, and clean
worktree remain pending.

## First full-check result and architecture repair audit

The first candidate-inspecting `npm run check` passed every verifier, docs,
lint, and Core 226 files / 2,086 tests. DOM passed 284 of 289 files and 2,026 of
2,031 tests; exactly five older architecture tests still encoded the
pre-O4P-04A Online module topology or classified every `src/components/**`
module as Solo. Build was skipped after those five failures.

The Sol Judge applied the bounded repair authorized by
`research/cr-grounding/o4p-04a-full-check-repair-1.draft.md`: add only
`workbench` to three fixed Online module enumerations, and exempt only
`src/components/online/PersonalWorkbench.tsx` importing the public
`src/online/workbench/index.ts` from two Solo/Online gates. Production source,
ordinary tests, and O4P-04A review tests did not change.

- repaired semantic fingerprint:
  `d7b922e0e8762d686873ad52b4b7a301c88a2db192098212eb040d7f5e4771d5`
- repaired tree/context fingerprint:
  `ac2de5528a8453745fb15bc72685b7fae81575e68298afae20d75501205b4d65`
- focused evidence: 5 architecture files / 19 tests passed; O4P-04A remained
  4 files / 23 tests passed; scoped ESLint and `git diff --check` passed
- independent focused re-audit: `/root/o4p04a_cold_auditor`, `AUDIT-CLEAR`
- focused re-audit totals: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0

The auditor confirmed that wrong source files, other Online targets,
engine/store/snapshot/server/runtime imports, alias/namespace/dynamic-import
probes, and all pre-existing negative boundaries remain rejected. The final
release full-check rerun remains pending on the metadata-frozen fingerprint.

## Contract verification reanchor

The next full-check invocation stopped in `check:docs` before Online
verifiers, lint, tests, or build because the changed
`src/test/architecture/soloOnlineBoundary.test.ts` no longer matched the old
`CONTRACT-ENGINE-MULTIPLAYER.lastVerifiedCommit`. This is a fail-closed
pre-publication metadata guard: the manifest requires an existing ancestor
commit with the exact audited verification-evidence blob.

The Judge therefore created candidate commit
`945f3d657df3d48313a2d9b2377f9b86984ce013` with the auditor identifier, then
reanchored only that contract's `lastVerifiedCommit` to the candidate SHA under
`research/cr-grounding/o4p-04a-contract-verification-reanchor-1.draft.md`.
No clause, traceability item, product source, test assertion, version,
dependency, workflow, or release boundary changed. Independent metadata
confirmation and the final full-check remain pending.

The same independent auditor verified the reanchor at semantic fingerprint
`27703d5133e40e4f5973a1bb17018f7def3bf6f9b6cc3308c1c57ea478d45c4b`
and tree/context fingerprint
`9d151c14a41552d58acd2b8fa39be8ee23e4a3585631f59f123f7d4922dacda8`.
It confirmed the candidate/working-tree boundary-test blob ID
`147f7fd845dc6f9fa8595996b9089907136508c1`, `check:docs` PASS, and totals
BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0.

## Final local full check

The fingerprint-matched final `npm run check` completed successfully without
any candidate change:

- every pinned-CR, version, docs, architecture, Core, Solo compatibility, and
  Online/Cloudflare verifier passed;
- lint passed;
- Core: 226 files / 2,086 tests passed;
- DOM: 289 files / 2,031 tests passed;
- TypeScript project build and Vite production build passed;
- emitted assets: `index-DYJZmvM4.js` and `index-JeU5vEot.css`;
- total duration: 602,398 ms.

CI, Judge reownership of review evidence, Pages HTTP evidence, terminal ledger
state, and clean worktree remain pending.
