# Document governance workflow

This is the sole operative workflow for DOC-GOV-RESET-2026-08 and later
OneDeck milestones. `AGENTS.md` owns permanent boundaries; this document owns
execution order, task lifetime, token economy, and lane selection. Compatibility
pointers must not restate these rules.

## Request normalization and authority

Before grounding a non-trivial request, normalize the user's prose exactly once
with `request-normalization.md`. The LLM performs this conversion; never ask the
user to learn or rewrite the schema. Show it once for `change`, `goal`, or any
external authority, then use the compact record instead of replaying the raw
conversation.

`Intent` selects work shape and never grants an `Authority` bit. `inspect` and
`plan` are read-only shapes; `change` selects one milestone; `goal` selects only
an explicitly named or accepted ordered milestone program. Local writes,
commit, push, deploy/publish, and release/ship are separate permissions and
remain false unless the original request grants each one. Reserve `+ ship` for
an explicit end-to-end release workflow; it is not required for a commit-only,
push-only, or deploy-only request. Persistence language such as “finish” or “do
not stop” does not broaden program or external authority.
Normalization may resolve reversible details from live authority, but it cannot
invent scope, milestones, dependencies, success criteria, destructive actions,
secrets, purchases, or external writes.

## Task envelope and cold start

Start with exactly one milestone ID, base SHA, brief path, goal, constraints,
and done-when. Read `AGENTS.md`, the verified output of
`npm run codex:context -- [--domain <id>]`, the active brief,
`docs/judge-protocol.md` for the applicable ruling, and this workflow. Read the
matching contract/manifest or full ledger entry only when the projection and
brief do not establish the required claim. Do not
import a prior task transcript. Read the full ledger or history only when the
projection reports an integrity error or true ambiguity, the requested domain
cannot be projected, or an explicit ruling must be recovered.

Before editing, require a clean task worktree at the declared base SHA. If
another milestone has uncommitted or unshipped changes, use an isolated
worktree or stop; do not mix candidates. Stop on an integrity error, missing or
conflicting authority, or a value decision not fixed by the pinned CR and an
explicit user ruling.

Automatic selection may apply a machine-readable
`goalPolicy.activeProgram = { id, domainIds }`. `domainIds` is the complete,
ordered program boundary. Narrative `nextGate`, notes, drafts, and thread text
do not activate or order a program. If an explicit user program and the
automatic projection disagree, use `--domain` for the adjudicated milestone and
schedule a judge-owned active-program ledger update; never substitute the
automatic result silently.

One worktree owns one active milestone candidate only. A normal user task ends
when that milestone ships, reaches a terminal STOP, or exhausts its repair
budget. When the user explicitly authorizes completion of the ordered
`goalPolicy.activeProgram`, the same judge task may supervise serial milestone
cycles. Shipping still ends the current cycle. Before the next cycle, require
exact-head release evidence, a clean worktree, a new verified `codex:context
-- --domain <next-id>` projection, a refreshed base/fingerprint, and a new
six-field envelope. The supervisor keeps only the normalized request, live
authority, counters, and a terminal packet no larger than 4 KiB; it does not
absorb worker transcripts or raw logs. A STOP or exhausted repair budget ends
the whole program.

Only a failure of the current milestone acceptance or a critical regression may
interrupt active implementation. Record every other addition compactly for a
later milestone; do not expand the active candidate.

## Roles and write ownership

The judge owns contracts, manifest, acceptance registry, `review.*`, ledger,
git, and release decisions. An implementer changes only assigned source and
ordinary tests. A cold auditor receives only the frozen audit brief, edits
nothing, and returns findings.

Use at most one implementer and one cold auditor lineage per milestone. Reuse
the same implementer within the two total correction waves. Do not create
general explorer agents or research future milestones while the active
milestone is unresolved.
Parallel code writes require explicitly disjoint paths, a frozen shared
contract, and a stated latency benefit; otherwise keep implementation serial.
Start implementers and auditors with no inherited supervisor transcript. On the
current Codex surface use `fork_turns: "none"`; on other surfaces use the
equivalent fresh-context option. Give auditors only the frozen brief path and
candidate fingerprint, never the implementer's rationale.

## Execution and context budget

- Batch independent local reads and read-only checks in one bounded tool stage.
  Keep approvals, waits, adaptive investigation, and conflicting writes
  sequential.
- Subagents are a latency/role-separation tool, not a token-saving default;
  every worker performs its own model and tool work. Keep deterministic reads,
  extraction, and checks in one programmatic judge stage when they fit.
- Send the judge conclusions, exact clauses, compact diffs, and findings—not
  raw tours, transcripts, or full test logs.
- Keep each continuation and terminal packet at or below 4 KiB. A bounded tool
  stage normally returns at most 12 KiB to the model; filter or summarize larger
  output before it re-enters context.
- Resolve model and effort from an explicit user request, then the project
  config, then the parent. Default to the lowest effort that meets evidence:
  medium for clear bounded work, high/xhigh for difficult multi-step
  implementation or audit, and max only for unresolved R3 ambiguity. Never
  silently substitute an unavailable requested model or effort.
- An R3/BROAD cold audit must not inherit the generic worker default. Its spawn
  or selected custom-agent file must explicitly set both model and reasoning
  effort; the repository baseline is Sol/high unless an explicit supported
  user request selects another capable configuration.
- A cold audit gets one logical bounded wait chain: NARROW 15 minutes, STANDARD
  30 minutes, or BROAD 45 minutes. CI gets one logical wait chain. Do not replace
  either with repeated short waits, raw transcript polling, or timed status
  reads. A timeout is no verdict and remains
  `implemented-not-audited`.
- Do not issue a new wait or repository read merely to produce a status update.
  Report phase changes, findings, approvals, and terminal evidence. A
  platform-required heartbeat stays one line and starts no new investigation.
- Context compaction is a recovery checkpoint. Finish the current atomic
  action, update the compact continuation packet, and recover from `AGENTS.md`,
  verified `codex:context`, active brief, the applicable
  `docs/judge-protocol.md` section, and this workflow. Do not start another
  agent, repair wave, full check, or adjacent
  milestone until that recovery is current; an authorized program may continue
  after the normal transition gate.
- Each logical role lineage may compact at most twice. The first compaction
  resumes from the compact packet. A second compaction ends that task and
  requires the single allowed fresh-context same-role continuation. That
  continuation shares the original implementer or auditor slot and all counters;
  a third compaction or second continuation is forbidden.
- Run `npm run codex:usage -- --session <id>` at every task terminal. Record
  its model cycles, cached/uncached input, compactions, and full checks; when
  platform counters are available, also record subagent and wait counts. Never
  copy prompts or double-count inherited fork history. Quality gates never
  weaken to improve these metrics.

## Hard execution counters

Counters belong to the milestone ID and candidate lineage, not a task name.
Renaming a repair, metadata commit, continuation, or thread never resets them.

- implementer: one
- cold auditor: one; reuse it for affected-claim re-audit and exact-byte review
- logical role lineage compactions: at most two
- fresh same-role continuations: at most one; it is not another role slot
- correction waves: at most two total; a return to the same implementer or a
  bounded judge-owned surgical correction consumes one wave
- supervisor visible usage: 1.0M-token hard ceiling and 160 model-cycle hard
  ceiling per lineage when platform counters are available
- team visible usage: 1.6M-token hard ceiling and 400 model-cycle hard ceiling
  per milestone when platform counters are available
- release full check: one normally, two absolute maximum
- semantic push: one normally
- replacement push/exact-head CI: at most one
- audit wait: one logical chain
- CI wait: one logical chain
- production browser verification: once on the final release HEAD

Known sandbox or IPC restrictions use the already approved execution path on
the first attempt. Do not repeat a known-failing probe for every milestone. If a
counter is exhausted, do not add a third repair wave, compaction, or
continuation, weaken evidence, or silently open a new candidate. Leave the
milestone unshipped and require an explicit repair milestone or user ruling.

## Contract and migration rules

Active contracts state current meaning only. History, implementation evidence,
audit records, volatile state, and work notes belong in the ledger, decisions,
or archive. Every active contract has one authority in
`docs/contracts/manifest.json`; every scenario has a globally unique ID and a
traceable test or manual lane.

A document migration preserves the original before replacing a pointer. The
migration map gives every former heading exactly one destination and one
classification. Unresolved meaning conflicts remain outside active-green
scenarios until explicit adjudication and current executable evidence agree.

## Risk lanes

- R0: spelling, links, indexes, archive movement, or terminal metadata derived
  only from already audited immutable evidence. Run docs lint and self-review.
  A new cold audit may be omitted only when an executable verifier checks exact
  bytes/hashes and no authority, allowlist, acceptance claim, or meaning changes.
- R1: non-semantic script/refactor or fixture organization. Run the affected
  check and peer review.
- R2: UI behavior, store wiring, or ordinary engine behavior. Run the domain
  lane and an independent audit.
- R3: CR semantics, `GameState` schema, public API, protocol, selection policy,
  or migration meaning. Freeze the contract, run an independent cold audit,
  then the release lane.

Metadata-only work is not automatically R3. A meaning change is R3 even when
only documents changed.

## Affected, domain, and release lanes

`npm run check:docs` validates manifest shape, unique authority, links,
scenario IDs, supersedes, verifiedBy paths, volatile vocabulary, generated API,
and migration completeness.

`npm run check:fast` runs docs validation, affected lint, incremental
typecheck, and selected offline affected tests. It never runs a production
build, network lane, or manual browser check.

`npm run check:domain -- <domain>` runs one named domain. Unknown or
cross-domain changes fall back to a wider domain rather than being ignored.

`npm run check` is the release gate: static verifiers, docs validation, lint,
both Vitest projects, and exactly one production build. Pages passes the base
path to that build and uploads its `dist` output; it does not build again. The
forbidden-file guard receives an explicit diff base in CI.

## Freeze, audit, correction, and release

Iterate with targeted checks. Freeze the candidate tree and record its
fingerprint before audit. R2/R3 select NARROW, STANDARD, or BROAD from actual risk;
cross-document workflow or selection-policy changes are BROAD. The auditor
runs target-domain adversarial evidence, not the release full check.

Before the audit freeze, run one bounded release preflight. It must confirm the
declared base/ancestor, ledger collection parity, loop-state/resume consistency,
protected ownership, review hash chain, candidate fingerprint, planned terminal
metadata, invalidated claims, known execution environment, and secret-free
evidence. If no dedicated command exists, perform the equivalent checks in one
batched read-only stage and record the structured result; never claim an
unimplemented command exists. A failed preflight forbids the audit/full-check/
push sequence until repaired.

The clean semantic verdict is `AUDIT-OK-PENDING-FULL-CHECK`. Close findings,
re-run only invalidated evidence, freeze the release tree again, and require the
same fingerprint as the audited tree. Run the full check once. If that full
check itself exposes a defect, make the smallest correction, re-run invalidated
evidence and affected audit claims, and run one final full check. Never exceed
two full-check invocations in one task.

The release full check command is `npm run check`; no narrower command can
substitute for it.

Ship only with the authority defined in `AGENTS.md` and `.claude/commands/ship.md`.
On ship, record audit and release evidence, archive the completion packet, and
run the terminal usage measurement. A normal task resets loop-state to
`milestone: complete` and ends. An explicitly authorized program supervisor may
instead transition to the next domain only after the exact-head clean-worktree
gate above; the final program cycle resets loop-state and ends. Without ship
authority, leave a verified candidate and make no external write.
