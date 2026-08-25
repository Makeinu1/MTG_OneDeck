# GOV-CODEX-57 complete-autonomy and player-journey governance contract

Date: 2026-08-26
Authority: user-ruling-2026-08-26-complete-autonomy-player-journey
Base SHA: `027aed8b152421f0aa101c81eefcf766fbfc803b`
Risk: R3 / BROAD governance and selection-policy meaning

## Goal

One explicit active-program authority envelope controls the whole serial
program. Inside that envelope, reversible implementation, audit corrections,
meaning-preserving release repair, and milestone transitions do not ask the
user for formal permission again. Authority is never inferred from persistence
language, and missing commit, push, deploy, or ship authority remains false.

Program progress is measured in production player outcomes as well as technical
substrate. From the policy activation point onward, no active program may ship
three consecutive substrate-only milestones. Historical O4P-09A through C are
recorded as one explicit legacy journey debt and are not relabelled as visible
outcomes.

## Machine-readable active-program policy

`goalPolicy.activeProgram` has these required fields:

- `id` and ordered `domainIds` remain the sole program-selection authority.
- `authority` has exact booleans `localWrites`, `commit`, `push`, `deploy`, and
  `ship`. An omitted or false bit grants nothing.
- `autonomy.mode` is `complete`. It suppresses repeat questions only for work
  allowed by `authority` and never grants a missing bit.
- `journeyPolicy.maxConsecutiveSubstrate` is `2`.
- `journeyPolicy.enforceFromDomainId` identifies the first non-grandfathered
  program member.
- `journeyPolicy.legacyDebtDomainIds` records the immutable historical debt.
- `usagePolicy.enforceFromDomainId` identifies the first milestone whose
  terminal promotion requires measured structured usage.

Every active-program domain declares `deliveryClass`, `playerOutcome`,
`journeyEvidence`, and `outcomeDeadlineDomainId`. A `player-outcome` entry must
name executable production journey evidence. A `substrate` entry must name the
later program member that closes its user-visible debt.

## Autonomous repair

Execution counters are cost telemetry and per-candidate safety bounds, not
permission prompts. Exhausting a candidate correction/full-check allowance
does not reset its counters and does not weaken acceptance. The Judge closes
that candidate as `repair-required`, records the cause and cumulative usage,
and derives one repair candidate with the same acceptance and authority. This
transition is automatic within the active-program envelope. A repair candidate
may change only invalidated claims. A contradictory contract, true product
value choice, scope or North Star change, secret/purchase, irreversible action,
or missing external-write authority still stops.

## Release preflight

`npm run check:release-preflight -- --base <sha> --domain <id> --owner <judge|implementer>`
is the executable audit-freeze gate. It returns a bounded JSON report and fails
closed on:

- invalid/non-ancestor base or an unhealthy ledger/context projection;
- domain/plannedSequence collection mismatch or dependency mismatch;
- stale generated engine API;
- protected-path changes inconsistent with the declared owner;
- a fixed active-program `nextDomainId` expectation in historical Judge guards;
- an incorrect CI diff base, missing terminal plan, or secret-like changed text;
- missing candidate semantic and terminal fingerprints.

The preflight reports environment identity and exact changed paths. It never
runs the release full check.

## Semantic and terminal lanes

The semantic fingerprint hashes every tracked candidate byte except the narrow
terminal metadata set. The terminal fingerprint hashes only that set. The
`npm run check:terminal-metadata` lane accepts only `.claude/loop-state.md` and the two synchronized
ledger copies, and verifies that removing terminal fields leaves the base and
candidate ledger equal. Product, contract, workflow, generated, and `review.*`
changes make the lane fail closed.

GitHub Pages CI runs the full release/build/deploy lane for semantic changes.
For a verified terminal-only successor it runs the terminal verifier and
forbidden-path check, reuses the already deployed semantic artifact by leaving
Pages untouched, and does not rebuild or redeploy identical product bytes.

## Structured usage

Every newly terminal milestone records `modelCycles`, `cachedInputTokens`,
`uncachedInputTokens`, `compactions`, `repairWaves`, `fullChecks`, `ciRuns`, and
`elapsedMs`. Missing or non-finite non-negative values fail terminal promotion.
Older shipped entries may use `measurementStatus: historical-unavailable` only
when they precede `usagePolicy.enforceFromDomainId`; invented zeroes are
forbidden.

## O4P-09 journey correction

O4P-09A and B are substrate. O4P-09C is a shipped headless lifecycle substrate,
not a delivered Pregame player journey. `O4P-09C-UI` is inserted next and owns
the production GameScreen Pregame journey for two and four players. O4P-09D
through J remain serial and each lands the player outcome named by the roadmap.
No O4P-09C-UI product byte is part of GOV-CODEX-57.
