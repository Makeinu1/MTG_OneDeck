# GOV-CODEX-58A Supervisor Enforcement Contract

Date: 2026-08-28
Base SHA: `74d24c0311e0d58112b15c58d6f8546449a5b01a`
Risk: R3 / BROAD
Source policy: Codex task `01a039eb-44d8-70b2-80b0-443aaf97568e`

## Normalized request

- Intent: change + end-to-end release.
- Program: GOV-CODEX-58A, then a separately frozen GOV-CODEX-58B. O4P-09F
  remains unstarted until 58A reaches a clean terminal.
- Goal: make one outcome-level authorization carry a bounded milestone to the
  requested result without numeric approval loops, while keeping authority,
  role separation, audit, guard-impact, and release quality fail closed.
- Constraints: preserve product and CR bytes; one candidate, one fresh
  implementer lineage, one fresh cold-auditor lineage, and one logical audit
  and CI wait chain; do not weaken any existing release gate.
- Done when: the user's outcome is stated as the primary contract; usage
  watchdogs route work without becoming permission; the two final cold-audit
  HIGH findings are closed; context, preflight, review, a final release full check,
  and the authorized terminal action are green.
- Budget objective: minimize wall time, uncached tokens, calls, repeated
  context, and human interruptions after acceptance and safety are satisfied.
- Authority: the user's 2026-08-28 instruction authorizes local writes, commit,
  release full check, push, deploy, and ship for GOV-CODEX-58A. It grants no
  GOV-CODEX-58B or O4P-09F authority.

## Outcome definition

The required result is not a larger governance system. It is the requested
player/product outcome, correct and usable at the authorized terminal, reached
with the least practical elapsed time and economic token/call cost. The order
of optimization is observable outcome and acceptance quality, scope/authority
safety, wall time, uncached-token/call cost, then process artifacts and human
interruptions.

The user decides Goal, Done when, scope, quality principles, and external or
irreversible authority. The supervisor decides reversible implementation,
model/effort, tools, parallelism, context, fixed-scope repair, and evidence
selection. It asks again only when the next step changes the outcome, scope,
quality principle, or ungranted external authority. A token, cycle, correction,
compaction, continuation, or candidate number is never itself a user decision.

Use OpenAI capabilities by task shape: programmatic tool calling for bounded
deterministic batches, multi-agent for independent work and role separation,
Skills plus compact canonical packets for reusable context, low-cost models for
routine work, and Sol/high for the single cold audit or genuinely hard
integration. Web/GitHub, browser/computer use, image/audio, or automation are
used only when their evidence or modality is part of Done when.

## Canonical executable gates

The repository exposes these commands:

1. `npm run codex:program-step -- --domain <id> --action <action>`
2. `npm run check:budget -- --domain <id>`
3. `npm run check:guard-impact -- --base <sha> --domain <id>`

The existing `mtg-onedeck-development` skill calls them at the corresponding
phase. The skill chooses the workflow; the CLIs enforce it. A missing,
malformed, stale, or contradictory supervisor record is a nonzero STOP, never a
warning-only green.

## Active candidate and permission contract

`codex:context` and `codex:program-step` project one nested
`activeCandidate` object with at least:

- `id`, `domainId`, `state`, immutable candidate `baseSha`, optional
  `releaseHeadSha`, and `treeFingerprint`;
- exact candidate-specific authority and its tracked source, falling back to
  `goalPolicy.activeProgram.authority` only when no override exists;
- cumulative counters, implementer/auditor lineage slots, audit/CI wait-chain
  slots, and guard-impact state;
- `permissionRequired` for `localWrites`, `commit`, `push`, `deploy`,
  and `ship`.

Candidate authority overrides are allowed only when synchronized in
`domains` and `plannedSequence` and backed by an exact tracked
`authoritySource`. Conversation intent, autonomy, notes, and loop-state text
cannot grant permission.

Before the semantic commit, the candidate base, loop base, and HEAD must agree.
The one post-commit exception is `push-ready` with no `releaseHeadSha`: the
declared base must be an ancestor of HEAD, HEAD and the semantic working tree
must equal the audited tree fingerprint, and no nonterminal semantic drift may
exist. The push-record transition then binds current HEAD once as
`releaseHeadSha` without changing `baseSha`. CI wait, CI pass, deploy, and ship
require exact `HEAD === releaseHeadSha`; even a same-tree metadata commit is a
different release head. A repair candidate declares the then-current HEAD as
its new immutable base and clears `releaseHeadSha`.

On a clean checkout where ignored `.claude/loop-state.md` is absent, context
recovers the candidate only from the latest candidate in the tracked supervisor
authority at the current HEAD and verifies that hash/receipt/counter/state chain
offline before synthesizing the compact loop packet. It never treats a missing
local-only file as missing canonical authority. Dirty, absent, unreadable,
rewritten, malformed, or HEAD-mismatched authority remains a nonzero STOP; a
checkout with a real loop packet continues to require live receipt verification.

Outside that narrow transition, the active candidate is conflicting and
execution stops when its ID/domain, selected domain, base SHA, release head,
fingerprint, tracked authority, or loop-state record disagree. Multiple
unshipped implementation candidates also stop; one cannot be hidden by
choosing an explicit domain.

## State and STOP semantics

Supported states distinguish at least clean baseline, contract frozen,
implementing, audit ready, audit failed but repairable, `audit-failed-stop`,
audited, full-check passed, repair required, push ready, CI passed, and shipped.
Actions outside the allowed transition return nonzero.

`audit-failed-stop` preserves the failed event and cannot be renamed or reset.
It is outcome-terminal only after two bounded attempts at the same root cause
make no progress and continuation requires a Goal/scope/quality tradeoff. A new
fixed-scope finding, different root cause, usage-watchdog crossing, or
meaning-preserving release defect may be resumed by the supervisor under
complete autonomy, preserving acceptance, authority, history, and cumulative
usage. No numeric approval is requested.

## Budget, role, and wait contract

`goalPolicy.supervisionPolicy` is the machine-readable source for structural
limits and usage watchdog objectives. From its enforcement domain:

- implementer lineages: 1; cold-auditor lineages: 1;
- audit wait chains: 1; CI wait chains: 1;
- release full-check attempt objective: 2;
- semantic pushes: 1 structural initial push;
- replacement pushes: cumulative watchdog objective 1;
- full checks, compactions, continuations, correction waves, and replacement
  pushes retain measured watchdogs;
- supervisor: 160 model cycles and 1,000,000 uncached input tokens;
- team: 400 model cycles and 1,600,000 uncached input tokens.

Lineage, wait, and initial semantic-push limits are structural and fail closed.
A replacement push always requires the explicit push authority and a
same-acceptance repair that has passed the ordinary audit/full-check/commit
path, but its cumulative objective is a watchdog rather than a new permission
boundary. Valid cumulative replacement-push, full-check, model-cycle,
uncached-token, correction, compaction, and continuation watchdog crossings are
reported as advisories and trigger an internal routing review; they do not
grant or revoke authority and do not block a progressing fixed-scope repair.
Every attempt remains counted, and a final green `npm run check` on the audited
exact tree is still mandatory. Prior
candidate-specific numeric rulings remain history only and are not an active
permission mechanism. All cumulative counters remain unchanged.

The executable counter keys are `supervisorUncachedInputTokens` and
`teamUncachedInputTokens`. Cached and total input tokens remain required
terminal telemetry and may not be relabeled as uncached usage. This definition
is the user's 2026-08-28 ruling after the first fail-closed budget observation;
the prior total-input observation remains recorded and no counter is reset.

Counters are nonnegative, cumulative, and nondecreasing across a candidate and
its repair candidates. Missing or platform-unavailable fields cannot become a
green zero. `audit-failed-stop` requires a structured usage snapshot and stop
reason. Malformed, missing, relabeled, decreasing, or reset telemetry fails
closed; a valid watchdog crossing remains visible but does not request human
permission.

The final repair must also anchor supervisor events outside ignored loop state,
validate actual session identities and measured usage receipts, bind guard
acknowledgements to current bytes and the candidate fingerprint, enforce guard
validation inside every gated transition, and reject explicit-domain attempts
to bypass the one active supervised candidate.

A live transition derives its receipt atomically inside the transition process
from an exact baseline and an allowlisted session/role plan. Caller-supplied
byte lengths, hashes, observed counters, or an already stale receipt cannot be
used to advance. The receipt proves the session prefix at the action boundary;
after it is persisted as a hash-chained historical event, normal later JSONL
growth must not retroactively invalidate that event. Every later gated action
derives and appends a new current receipt before any long guard scan.

The first tracked authority event is the canonical receipt-plan authority. Its
baseline and ordered supervisor/participant session-role identities are
immutable. Every later `--receipt-plan` must match them exactly; a shifted
baseline, omitted/extra/swapped session, or changed role fails before mutation.

After tracked bootstrap, repository-byte drift is recoverable only through the
supervisor-only `refresh-fingerprint` action. It first verifies the prior event
chain and loop candidate, then derives a current receipt, recomputes the tree
and exact base/current guard report, rejects insufficient ownership or any
acceptance/authority change, and appends the new candidate as the next tracked
event. Ordinary actions may not silently absorb tree drift.

The tracked event log is excluded from the ordinary tree fingerprint to avoid
self-reference. The exact cold-audit candidate is therefore frozen as the
SHA-256 of stable JSON containing both treeFingerprint and the tracked
authority's latest eventHash. The auditor verifies both components and the
derived envelope before returning findings; after the first commit, the same
event-prefix is additionally anchored by HEAD.

Reading the HEAD authority is bounded but fail closed: an existing oversized,
unreadable, or malformed file is an explicit integrity error, never treated as
an absent predecessor. After the semantic release commit, only the exact
active-domain authority file may join the terminal lane. Its HEAD event list
must be an immutable prefix and every appended event must pass sequence,
previous/event hash, receipt-plan anchor, actor/usage, counter/state,
authority/acceptance, lineage/wait, and ledger consistency checks. A verified
authority append is excluded from the semantic fingerprint and contributes its
exact path and latest event hash to the terminal fingerprint. Wildcards,
another domain, truncation, rewrite, or damaged receipts remain semantic or
fail closed. The R0 terminal metadata commit is a successor of the already
checked and deployed semantic release head: its `releaseHeadSha` must equal the
terminal diff base, not the metadata successor HEAD, and that successor may
contain only the verified terminal paths. This exception is available only
after ship evidence; it does not relax the live exact-HEAD checks for CI,
deploy, or ship.

For every verified session in the receipt history, prefix byte lengths are
nondecreasing and an identical byte length has one immutable SHA-256. A shorter
later prefix or same-length/different-hash receipt is corrupt even when its
outer event hash is recomputed. The predecessor existence probe distinguishes
confirmed absence from command, permission, object-integrity, and read errors;
all fail closed, but only confirmed absence uses the missing-predecessor code.

## Guard-impact contract

`check:guard-impact` uses the same base-aware changed-path collector as
preflight and deterministically emits:

- every changed path and ownership class;
- every repository guard, explicit allowlist/import/path assertion, and
  frozen SHA-256 predecessor that references those bytes;
- exact reauthorization-required paths and owners;
- a stable report fingerprint and an exact, wildcard-free acknowledgement
  state.

Absent or stale acknowledgement blocks audit, release full check, commit, and
push. A plan may acknowledge only the exact emitted paths, guards, hashes, and
fingerprint. It cannot authorize new product meaning, review assertions,
contracts, dependencies, workflows, or secrets. Release preflight consumes the
same report and cannot disagree with the standalone command.

## Compatibility and deferred scope

- Existing active-program order, journey cadence, terminal-only lane,
  fingerprints, forbidden scan, generated API, and O4P-09 product behavior stay
  green.
- GOV-CODEX-58A is one substrate slice between shipped O4P-09E and O4P-09F;
  its player-outcome deadline is O4P-09F.
- Typed journey evidence, a centralized historical-guard manifest, terminal
  artifact reuse redesign, fingerprint implementation unification, and a
  standalone reusable supervisor skill/package are GOV-CODEX-58B scope.
- No new supervisor framework, approval schema, or product feature is added by
  this outcome-first correction.
