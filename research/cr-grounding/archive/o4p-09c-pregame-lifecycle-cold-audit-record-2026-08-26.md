# O4P-09C Pregame lifecycle cold-audit record

Date: 2026-08-26
Base SHA: `5f62a8f6730fd7a758d8b284ba818cf19f09c347`
Generated-API checkpoint: `6432fa4853575cb844a66ca466cee2304e201ea6`
Risk: R3 / BROAD
Judge: `/root`
Implementer: `/root/o4p09c_luna_implementer` (`gpt-5.6-luna`, `xhigh`)
Cold auditor: `/root/o4p09c_cold_audit` (fresh-context Sol/high, read-only)

## Frozen scope

The candidate adds the headless Core and Online Pregame lifecycle, the exact
two-player first-turn draw skip, and the narrow rotated-turn-order projection
compatibility correction frozen by the O4P-09C contract. Judge ownership
covers the contract packet, generated API checkpoint, protected reviews, exact
architecture registrations, this record, and later terminal ledger metadata.
No Cloudflare, Browser, transport, public UI/store, dependency, configuration,
CR, or O4P-09D-J product byte entered the candidate.

## Audit history and exception ruling

1. Candidate
   `87402bbe7c8d14814c4dfb7aefc68e722f7dd6fcb7ff98b0b538ef44dfd89a02`
   was rejected at BLOCKER 0 / HIGH 2 / MEDIUM 0 / LOW 0. External state could
   diverge from the recorded library relation, and virgin admission omitted
   player mana and turn-resource checks.
2. The bounded repair closed both findings and extended validation to the
   persisted Core card and virgin-root relations. Candidate
   `2376874dd0a9e8eca074dd63293101656b193aa952a7adf12c3ef10f3009045e`
   was rejected at BLOCKER 0 / HIGH 3 / MEDIUM 0 / LOW 0: partial bottom IDs
   were compared only by count, plan authority was not exactly bound to Core
   turn authority, and creation enforced a narrower virgin root than state
   validation.
3. The user had expressly approved the exception set for this active candidate.
   The Judge therefore authorized the additional bounded repair wave rather
   than promoting a rejected candidate or silently resetting its counters.
   Exact pending-bottom replay equality, exact plan/Core starting authority,
   and full creation-time virgin-root validation were added with Judge
   regressions.
4. Final candidate
   `e641bbf45fbce0a8e13e7da9439bb0780327d37c5f779bcc98625340405b1bac`
   was independently reaudited at BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0 and
   received `AUDIT-OK-PENDING-FULL-CHECK`.

## Accepted bounded evidence

- Judge O4P-09C review: 1 file / 7 tests passed.
- Judge Core focus: 4 files / 25 tests passed.
- Judge Online, Projection, and architecture focus: 6 files / 42 tests passed.
- Cold-auditor Core evidence: 14/14 passed.
- Cold-auditor Judge/Pregame/Protocol/Projection evidence: 32/32 passed.
- Repository ESLint, `tsc -b`, `check:docs`, and diff checks passed.
- Secret-pattern scanning passed; no evidence contains live room, invitation,
  capability, or private-error material.
- Ownership scanning returned the expected Judge reauthorization
  classifications. The seated Judge re-owns the exact protected paths; no
  implementer-owned forbidden path changed.

## Release state

Cold audit is closed at BLOCKER/HIGH zero. Semantic commit, the single release
`npm run check`, terminal ledger and loop-state closure, exact-head CI, Pages
asset verification, `HEAD == origin/main`, and clean-worktree proof remain
pending. This headless slice claims no public UI scenario or Cloudflare Worker
deployment.

## Release full-check finding

The first sandboxed launch stopped before product evaluation because the `tsx`
runner could not create its temporary IPC socket (`EPERM`). The authorized
environment retry at semantic head
`5317c09996abf04b784c6502aa2c831393621844` was the first actual release full
check. It passed every machine verifier, docs, lint, and Core `228 files / 2,097
tests`. DOM completed `362 passed / 2 failed` files and `2,434 passed / 2
failed` tests. Both failures were the same O4P-01K reverse-layer finding:
`src/engine/core/pregame/operationsV1.ts` directly imported the Turn priority
bundle factory.

The bounded correction removes that one direct Turn import. It constructs the
same structural bundle and relies on `createModeNeutralCoreRootV1` and its
existing rule-authority validation to canonicalize and fail closed. No guard,
assertion, state shape, command, plan, projection, or public behavior is
weakened. Focused O4P-01K plus O4P-09C Judge evidence passed 3 files / 14 tests;
Core Pregame passed 1 file / 4 tests; affected ESLint, `tsc -b`, and diff checks
passed. Independent affected-claim reaudit and the one authorized replacement
release full check remain required.
