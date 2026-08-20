# O4P-06A Cold-Audit Record — 2026-08-20

Milestone: `O4P-06A`
Base SHA: `04dd0575388d3aa5a09f63ef6123f67b63933fe3`
Implementer: `/root/o4p06a_luna_implementer` (`gpt-5.6-luna`, `xhigh`)
Cold auditor: `/root/o4p06a_cold_auditor` (`gpt-5.5`, `xhigh`)

## Candidate and evidence

- Initial semantic fingerprint:
  `45490e546083701af542442517e2ca84f8b0eb62b2374bdfb4e9fba0f265725d`.
- Final repaired semantic fingerprint:
  `60de4071b387a14ec6b8a4437a6bcbef8b63c81d5f78adde8980698a8aad164b`.
- Release semantic fingerprint after Markdown hygiene:
  `6962744adcca1557aeda20c36db151df59fbc042165b4057000549facc7cf3da`.
- Judge review: four tests over the real Celes/Gogo/Kefka/Muldrotha inputs.
- Final size evidence (`TextEncoder-UTF-8`, limit `1,048,576`):
  Core `405,521`; Protocol `406,753`; initialize envelope `406,827`.
- Target lane correction: the repository's existing `core` Vitest project
  collects only `src/engine/**`; additive online tests are correctly collected
  by the existing `dom` project. This factual correction changed no product
  meaning.

## Audit cycle

The initial BROAD cold audit reproduced the initial fingerprint and returned:

`BLOCKER 0 / HIGH 1 / MEDIUM 1 / LOW 0` (`AUDIT-FAIL`).

1. HIGH: a valid Room ID equal to a configured seat capability reached
   Protocol secrecy validation and was collapsed to a generic bootstrap issue.
2. MEDIUM: the production size-gate helper accepted a caller-supplied
   initialize envelope and could return fake production-shaped evidence.

Correction return 1 reused the shipped capability-fragment detector for Room,
Build, participant, and deck identifiers and removed the production envelope
override. Cold re-audit 1 closed the HIGH but found that the exported serialized
boundary probe could still mint production-shaped evidence:

`BLOCKER 0 / HIGH 0 / MEDIUM 1 / LOW 0` (`AUDIT-FAIL`).

Correction return 2 separated the boundary probe into the explicit
`o4p-06a-size-probe-v1` shape with no `evidence` or `serialized` fields. The
two-argument production gate remains the sole producer of
`o4p-06a-size-evidence-v1` and exact serialized artifacts.

Cold re-audit 2 reproduced the final fingerprint and returned:

`BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0`
`AUDIT-OK-PENDING-FULL-CHECK`

Final re-audit evidence:

- targeted DOM Vitest: 3 files / 10 tests pass;
- scoped ESLint: pass;
- `npx tsc -b`: pass;
- `git diff --check`: pass;
- no `npm run check` was run by the auditor.

After staging, `git diff --cached --check` exposed trailing-space and EOF-only
issues in Judge-owned Markdown. The Judge removed only that whitespace. Cold
re-audit 3 reproduced release fingerprint `6962744a…f3da`, confirmed the
source/test candidate was unchanged, reran the four-test Judge review, and
returned `BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0`. The prior
`AUDIT-OK-PENDING-FULL-CHECK` verdict remains valid for the release
fingerprint.

The first effective full release check then exposed only historical-gate drift:
O4P-05D and four related reviews compared their old milestone bases to current
`HEAD`, so the first authorized successor source was misclassified. The bounded
Judge repair pins those guards to their exact closure SHAs, preserves live
reverse-reachability/untracked/active-program checks, and re-anchors the frozen
hash chain. No O4P-06A runtime, fixture, ordinary test, public API, dependency,
version, workflow, or UI byte changed.

The same cold auditor reproduced repair fingerprint
`88ffe26e5728f93db79d15132d99b1228489da271d6ee5acc84ed13a6d93bf2b`,
verified both predecessor verifiers, 32 affected reviews, seven machine-check
tests, scoped lint/typecheck/diff checks, and vacuity probes, then returned:

`BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0`
`AUDIT-OK-PENDING-FINAL-FULL-CHECK`

The initial forbidden scan reported expected Judge re-ownership paths and the
Judge-authored `review.*` file. It was not adjudicated as a semantic product
finding. Before external release, the Judge must explicitly stage intended
paths, run the fingerprint-matched full check, and follow the established CI
re-authorization workflow if the first exact-head run stops only on review
ownership.

## Verdict

`AUDIT-OK-PENDING-FULL-CHECK`. This record is not ship approval by itself.
