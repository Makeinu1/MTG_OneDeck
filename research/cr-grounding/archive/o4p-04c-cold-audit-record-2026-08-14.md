# O4P-04C cold audit record

Milestone: `O4P-04C` Display Pairing

Base SHA: `4b2f4ac534c489ce92d2f3dfce4774679c597502`

Implementer: `/root/o4p04c_luna_implementer` (`gpt-5.6-luna`, xhigh)

Cold auditor: `/root/o4p04c_cold_auditor_retry` (`gpt-5.5`, xhigh,
`fork_turns: none`)

The first cold-auditor process was terminated by an environment update before
returning a verdict. It contributed no release evidence. The replacement
auditor received only the frozen audit brief and authority paths.

## Candidate and targeted evidence

Initial candidate commit:
`dac39a199d233a95738be07044afd3baa9d8d3cf`

Judge security repair commit:
`891f52825bdcc1647278e0947623ccf113d48ce0`

The Luna implementer used both allowed correction returns:

1. removed an unauthorized legacy pairing-input alias and restored the exact
   contract root;
2. stacked the paired child surfaces at widths through 1100px, eliminating the
   measured 812x375 horizontal overflow while preserving 1440px two-column
   layout.

Before initial audit, the Judge independently passed the complete targeted
suite (8 files / 33 tests), scoped ESLint, `npx tsc -b`, `check:docs`, and
`git diff --check`.

One stable browser session rendered the deterministic dev fixture at 375x812,
812x375, and 1440x900. Every viewport had horizontal overflow 0, app-owned
fixed elements 0, Personal Workbench/Table Display/pairing status/three focus
controls present and reachable by ordinary scrolling, and console errors 0.
Selecting P3 emitted exactly
`{ "kind": "focus-opponent", "playerId": "P3", "revision": 12 }` and rendered
only its public Table-derived summary. The browser's own
`codex-browser-sidebar-comments-root` overlay was excluded from app-owned fixed
element counts.

## Initial cold audit

Frozen semantic fingerprint:
`49e1bc84c1f6a21361a06495e26f2c9d4634d61df13808f82ee7a5068a5f55bf`

Frozen context fingerprint:
`518121e654574e9f56973bd39181da132a7aa720de89a55b3c50ba885efa0f07`

Verdict: BLOCKER 0 / HIGH 2 / MEDIUM 0 / LOW 0,
`AUDIT-FIX-REQUIRED`.

- `O4P-04C-HIGH-001`: a bound bearer or bearer fragment could be copied into
  `commandId` and Core decision context.
- `O4P-04C-HIGH-002`: the original session record did not prove a validated
  Player projection/participant/Core-player/revision binding, so a
  Table/observer identity could construct a Player command frame.

The Judge sustained both findings and applied only the bounded repair recorded
in `research/cr-grounding/o4p-04c-judge-surgery-1.draft.md` after the two Luna
returns were exhausted. No Projection, Room, protocol, Core, Cloudflare, UI,
dependency, config, version, or deferred behavior changed.

## Repair evidence and final re-audit

The repaired tree passed:

- targeted O4P-04C: 8 files / 33 tests;
- multiplayer domain: Core 106 files / 699 tests and DOM 104 files / 671 tests;
- ui-responsive domain: Core 103 files / 677 tests and DOM 201 files / 1,342
  tests;
- scoped ESLint, `npx tsc -b`, `npm run check:docs`, and `git diff --check`.

Final repaired semantic fingerprint:
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`

Final repaired context fingerprint:
`87d543971fb9d5a56c1296fdc574305e30960446dd819775e3643f2fb56b8f95`

The same independent auditor directly probed valid pass/concede, full bearer
and 8+ character fragment rejection for both command families, a 7-character
non-leak control, Table/observer session, participant/Core-player/Room/revision
mismatch, and refresh revision mismatch. Final verdict:

```text
BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0
AUDIT-CLEAR
```

Release state at this record creation is `AUDIT-OK-PENDING-FULL-CHECK`.
`npm run check`, commit/push, exact-head CI, Pages evidence, terminal ledger
promotion, and clean-worktree evidence remain pending and must be appended only
after they actually pass. O4P-04D is not started.

## Final full-check repair and local release gate

The first release `npm run check` passed every verifier, docs, lint, and Core
226 files / 2,086 tests, then exposed two stale DOM architecture
registrations. The global Core boundary had not frozen the exact approved
O4P-04C public-Core imports, and the frozen O4P-04B scope had not registered
its approved O4P-04C successor composition. The check stopped before build.

The bounded Judge repair is recorded in
`research/cr-grounding/o4p-04c-full-check-repair-1.draft.md`. It changed only
three Judge-owned architecture tests and added the repair/cold-audit briefs;
runtime, product entry points, contracts, dependencies, and DEFERs did not
change. Invalidated plus O4P-04C targeted evidence passed 10 files / 48 tests,
and both domain checks passed again at multiplayer Core 106/699 + DOM 104/671
and ui-responsive Core 103/677 + DOM 201/1,342.

The same independent cold auditor inspected the frozen repair candidate and
ran direct adversarial probes. Repair-audit fingerprints were:

- semantic: `acf6b80b31afd7712d568aff9d274ed03710a6a15516c6839491f32a7baa3d3e`;
- context: `d3ebad98742d4a5e1e6c911c8fc7facb2c2c5a28ba1ed6f0483988453af2d5b9`.

Repair-audit verdict:

```text
BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0
AUDIT-CLEAR
```

The second and final local `npm run check` ran on that exact audited context
fingerprint and passed every verifier, docs, lint, Core 226 files / 2,086
tests, DOM 296 files / 2,065 tests, TypeScript, and Vite build. No third local
full check is permitted or required. Candidate commit/push, exact-head CI,
Pages, ledger promotion, and clean-worktree evidence remain pending.

## Candidate CI and Judge reownership

Candidate commit `1d8bffc3e39fb5be2b1fa2e0997c45848c3856af` was
published to `main`. Exact-head GitHub Actions run `31797116892` passed
`npm run check -- --build-base=/MTG_OneDeck/`: all verifiers, docs, lint,
Core 226 files / 2,086 tests, DOM 296 files / 2,064 passed + 1 skipped =
2,065 total, TypeScript, and Vite build were green.

The run stopped only at `check:forbidden` before Pages. The scanner reported
six Judge-owned `review.*` paths as hard `FORBIDDEN` and the design HTML plus
contract/audit/brief evidence as `NEEDS-REAUTH`. Exact path hashes and the
bounded metadata-only next commit are recorded in
`research/cr-grounding/o4p-04c-ci-reauthorization.draft.md`.

The same independent auditor verified run/head identity, the successful full
check, all seven listed hashes, and absence of unlisted hard forbidden paths.
An initial LOW wording finding misclassifying the design HTML as hard
`FORBIDDEN` was corrected to its actual `NEEDS-REAUTH` classification and
rechecked closed. Final reownership verdict:

```text
BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0
AUDIT-CLEAR
```

The next commit is authorized to contain only this audit-record append and the
CI reauthorization record. Product, review, test, contract, ledger, workflow,
package, and design bytes remain frozen. Exact-head successful CI, Pages,
terminal ledger promotion, and clean-worktree evidence are still pending.
