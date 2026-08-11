# O4P-01N cold audit brief

Role: independent cold auditor. Read-only. Do not edit any file and do not
perform git writes.

Milestone: O4P-01N Mode-Neutral Core Closure

Base SHA: `435b691b63492ebb66389cfa37c8a5a3d6d102b4`

Frozen authority:

- `research/cr-grounding/o4p-01n-mode-neutral-core-closure.contract.draft.md`
- `research/cr-grounding/o4p-01n-acceptance-brief.draft.md`
- shipped O4P-01J/K/L/M source, contracts, and public exports

Candidate implementation and ordinary evidence:

- `src/engine/core/closure/**`
- `src/engine/core/fixtures/o4p-01n-mode-neutral-core-closure-v1.json`
- `src/engine/core/index.ts`

Judge integration and acceptance evidence:

- `scripts/checks/verify-mode-neutral-core-closure.ts`
- `src/test/architecture/review.o4p-01n-mode-neutral-core-closure-boundary.test.ts`
- O4P-01N additions in
  `src/test/architecture/modeNeutralCoreBoundary.test.ts`
- O4P-01N additions in `package.json`,
  `scripts/checks/machine-checks.mjs`, and `scripts/checks/tsconfig.json`
- generated `docs/generated/engine-api.md`

## Required audit

Independently inspect the candidate against every frozen clause. At minimum,
attempt to falsify:

1. command reducer as sole state authority and events as derived evidence;
2. exact hostile-safe root, command, journal, package, and canonical
   validation, including accessors, proxies, sparse/extra arrays, unsafe keys,
   and deep freeze;
3. four independent closure versions without Solo snapshot or future protocol
   coupling;
4. actor/decision-maker separation and every payload authority binding;
5. all 15 closed adapters, atomic rejection, real unchanged digests, and no
   falsely claimed DEFER;
6. four-player Commander closure with four physical Commander identities,
   multiplayer combat, non-active player exit, stable lifecycle history,
   active Object Registry subset, and Commander damage/provenance history;
7. physical-Commander/combat-object provenance matching;
8. deterministic player-library permutation with no PRNG, clock, seed, redraw,
   or shared-zone reorder;
9. typed correction with exact untrimmed reason retained only in the journal
   command and absent from event/warning/error metadata;
10. rejected-command sequence reuse, JSON save/load, deterministic replay,
    first divergence, exact final state digest, and exact event transcript
    digest;
11. no Room, protocol, projection, network, Cloudflare, UI, React, Zustand,
    Solo `GameState`, `GameCommand`, or `SNAPSHOT_VERSION` dependency;
12. verifier and review tests are non-vacuous and derive their claims from
    public APIs/runtime values rather than self-authored constants alone.

## Evidence already produced for this frozen tree

- closure ordinary tests: 4 files, 11 tests PASS
- review plus Core architecture tests: 2 files, 10 tests PASS
- targeted ESLint: PASS
- production build: PASS, existing chunk-size warning only
- standalone verifier: PASS with 4 players, 4 Commanders, all 15 payload kinds,
  16 accepted commands, separated authority, recorded library permutation,
  correction privacy, replay state/event equality, stable history, and 6 DEFERs
- `git diff --check`: PASS
- generated API content: current

`check:docs` is intentionally prepublication-blocked only because
`GENERATED-ENGINE-API.lastVerifiedCommit` still names the O4P-01M candidate.
The user has not authorized an O4P-01N candidate commit or manifest promotion.
Do not treat lack of that later publication step as implementation acceptance;
do report any other docs or manifest defect.

## Return format

- Candidate fingerprint observed from `node scripts/checks/fingerprint.mjs`.
- Findings sorted by severity: BLOCKER, HIGH, MEDIUM, LOW.
- For each finding: stable ID, exact path/line or symbol, violated clause,
  reproduction/evidence, impact, and smallest safe correction.
- Explicit totals for each severity.
- Explicit verdict: `AUDIT-CLEAR` only when BLOCKER/HIGH are zero; otherwise
  `AUDIT-FIX-REQUIRED`.
- List commands actually run and exact outcomes.

Do not modify tests, source, contract, ledger, docs, git state, or candidate
fingerprint. A timeout or incomplete read is no verdict.
