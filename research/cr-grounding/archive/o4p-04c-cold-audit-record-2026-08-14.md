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
