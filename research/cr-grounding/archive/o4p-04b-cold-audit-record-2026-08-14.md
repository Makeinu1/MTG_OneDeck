# O4P-04B cold audit record

Milestone: `O4P-04B` Table Display

Base SHA: `36237478838695e4cb1753bafaba0bc1aa4fa8f4`

Audit authority:

- `research/cr-grounding/o4p-04b-table-display.contract.draft.md`
- `research/cr-grounding/o4p-04b-acceptance-brief.draft.md`
- `research/cr-grounding/o4p-04b-cold-audit-brief.draft.md`

Independent read-only auditor: `/root/o4p04b_cold_auditor` using
`gpt-5.6-sol` with `xhigh` reasoning. The auditor made no file or git write and
did not run the release full check.

## Implementer boundary

The user requested Luna at extreme-high effort. The collaboration runtime did
not expose `gpt-5.6-luna`; the attempted model selection was rejected before an
implementer task existed. The Judge transparently selected the closest
available token-economic implementation alternative, persistent
`/root/o4p04b_terra_implementer` on `gpt-5.6-terra` with `xhigh` reasoning.
That implementer changed only additive source and ordinary tests, performed no
git operation, and used two bounded correction returns.

## Initial audit

- semantic fingerprint:
  `2e195eedf79eff1d1034301d4dd18197980d0348e21b7fb956272949c89eb46d`
- tree/context fingerprint:
  `721de7d09c8e634ce6ccf6f32eb64b3ce0cace1bcea601e4f0601eb58567418e`
- verdict: `AUDIT-FIX-REQUIRED`
- totals: BLOCKER 0 / HIGH 1 / MEDIUM 1 / LOW 0

The audit reproduced:

- `O4P04B-HIGH-001`: a descriptor-switching Proxy returned a canonical `game`
  for validation and a noncanonical value during the later display copy, which
  could expose a private sentinel name;
- `O4P04B-MEDIUM-001`: the architecture review did not prove reverse imports
  from all other production source or enumerate the complete base-relative
  candidate scope.

## Final repaired-candidate audit

- semantic fingerprint:
  `0ea1cbcae45d799640d5fc82a380238450c80ad32eb29c23fa18ae468d6847ee`
- tree/context fingerprint:
  `1bf04b14069a2179aa33dd83f81bd9cbe231942a96ebc7791bcbb35a6419b314`
- verdict: `AUDIT-OK-PENDING-FULL-CHECK`
- totals: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0

Both findings closed non-vacuously. `buildTableDisplayViewV1` validates the
input, validates the first frozen canonical value again, and consumes only the
second canonical result. The independent descriptor-switching probe returned
`TableDisplayProjectionErrorV1` after exactly two `game` reads, and the Judge
DOM regression rendered only the generic unavailable state without the private
sentinel. Architecture evidence now scans all other non-test production source
for reverse reachability and checks the complete tracked plus untracked
candidate against a base-relative allowlist.

The final targeted run passed 4 files / 20 tests. Scoped ESLint, `npx tsc -b`,
`npm run check:docs`, and `git diff --check` passed. The auditor independently
re-ran the targeted suite, descriptor-switching probe, production reverse scan,
base-relative scope check, scoped ESLint, and no-index whitespace check.

## Fingerprint-matched browser evidence

After correction 2, the Sol Judge used one stable in-app browser session on the
deterministic development fixture:

| Viewport | Horizontal overflow | Required elements outside width | Fixed or absolute tested elements | Action elements | Console errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| 375x812 | 0 | 0 | 0 | 0 | 0 |
| 812x375 | 0 | 0 | 0 | 0 | 0 |
| 1440x900 | 0 | 0 | 0 | 0 | 0 |

All viewports showed four Player summaries, the active-turn display, the
explicit Japanese priority-unavailable status, shared battlefield/stack/exile/
command surfaces, and no action control. The 1440x900 viewport fit completely;
the narrower viewports remained vertically reachable without horizontal
overflow.

Judge adjudication: the repaired candidate is eligible for metadata
confirmation and then the single fingerprint-matched release full check. CI,
Pages HTTP evidence, terminal ledger state, and clean worktree remain pending.

## First full-check result and bounded architecture repair

The first sandbox invocation stopped at the second verifier because the
environment denied the `tsx` local IPC socket with `listen EPERM`; it did not
inspect or reject candidate behavior. The same fingerprint was rerun outside
the sandbox. That run passed every verifier, docs, lint, and Core 226 files /
2,086 tests. DOM passed 288 of 293 files and 2,046 of 2,051 tests; exactly five
older architecture tests encoded the pre-O4P-04B Online module topology or
classified every `src/components/**` module as Solo.

The Sol Judge applied only the bounded repair authorized by
`research/cr-grounding/o4p-04b-full-check-repair-1.draft.md`: add
`tableDisplay` to three fixed Online-root enumerations and allow only
`src/components/online/TableDisplay.tsx` importing the public
`src/online/tableDisplay/index.ts` from two Solo/Online gates. Production
source, ordinary tests, O4P-04B review assertions, dependencies, configuration,
and deferred behavior did not change. Focused tests and independent repair
re-audit remain pending before the final full-check rerun.

The focused run passed all five repaired architecture files plus all four
O4P-04B targeted files: 9 files / 39 tests. Scoped ESLint and
`git diff --check` passed. Independent focused repair re-audit remains pending.

The independent focused repair re-audit at semantic fingerprint
`060e235cdf90bbb105c4eeb1f548f32bd34d437a8e40803295deefb51c73fdf7`
and context fingerprint
`347b3ffa81e7c3c6a343821466b5a7c34dc12fa4c1bcc7f6bbb2d4dcd2abb7d8`
returned `AUDIT-CLEAR`: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0.

## Contract verification reanchor

Audited candidate commit `f6322eb03b08688dcd862b9899d1330e8ff0a096`
contains the repaired `soloOnlineBoundary.test.ts` evidence blob
`a0d66b8cba007079cba690655738e66875a5f018`. The Judge reanchored only
`CONTRACT-ENGINE-MULTIPLAYER.lastVerifiedCommit` to that candidate under
`research/cr-grounding/o4p-04b-contract-verification-reanchor-1.draft.md`.
Contract clauses, traceability, product source, test assertions, dependency,
version, and workflow semantics are unchanged. `npm run check:docs` passed,
the O4P-04B scope gate passed 1 file / 5 tests, the candidate evidence blob
matched exactly, and `git diff --check` passed. Independent metadata
confirmation remains pending.

The independent metadata confirmation at semantic fingerprint
`10b14afc80bed4956f797a58e9743cbbc8392281db5490594afb1a2559de7edc`
and context fingerprint
`5ae39c6dc795712bbf180caf7478365a7b3431ce3f9bd71182fef9984da64952`
returned `AUDIT-OK-PENDING-FULL-CHECK`: BLOCKER 0 / HIGH 0 / MEDIUM 0 /
LOW 0.

## Final local full check

The same fingerprint then passed the final release `npm run check` without any
candidate change:

- every verifier, docs contract, and lint gate passed;
- Core: 226 files / 2,086 tests passed;
- DOM: 293 files / 2,051 tests passed;
- TypeScript project build and Vite production build passed;
- emitted assets: `index-DYJZmvM4.js` and `index-JeU5vEot.css`;
- total duration: 284,870 ms.

Exact-head CI, forbidden-scope adjudication, Pages HTTP evidence, terminal
ledger state, and clean worktree remain pending.
