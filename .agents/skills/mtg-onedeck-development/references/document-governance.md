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

Automatic selection may apply a machine-readable `goalPolicy.activeProgram`.
`domainIds` is the complete, ordered program boundary. `authority` stores the
separately normalized local-write, commit, push, deploy, and ship bits; missing
bits are false. `autonomy.mode: complete` suppresses repeat permission prompts
only inside that envelope. `journeyPolicy` and `usagePolicy` govern
player-outcome cadence and terminal measurement but grant no authority.
Narrative `nextGate`, notes, drafts, and thread text do not activate, order, or
authorize a program. If an explicit user program and the
automatic projection disagree, use `--domain` for the adjudicated milestone and
schedule a judge-owned active-program ledger update; never substitute the
automatic result silently.

One worktree owns one active milestone candidate only. A normal user task ends
when that milestone ships or reaches a true outcome-level STOP. A candidate
boundary, usage watchdog, continuation count, or new fixed-scope finding does
not ask the user for another quota. Preserve cumulative usage and derive or
resume a same-acceptance, same-authority repair automatically under
`autonomy.mode: complete`. `audit-failed-stop` is reserved for two bounded
attempts at the same root cause with no progress where continuation now requires
a Goal, scope, or quality tradeoff; do not launder that decision by renaming the
candidate. Release-full-check, CI-environment, or exact guard-impact defects use
the same automatic repair rule. When the user explicitly authorizes completion of the ordered
`goalPolicy.activeProgram`, the same judge task may supervise serial milestone
cycles. Shipping still ends the current cycle. Before the next cycle, require
exact-head release evidence, a clean worktree, a new verified `codex:context
-- --domain <next-id>` projection, a refreshed base/fingerprint, and a new
six-field envelope. The supervisor keeps only the normalized request, live
authority, counters, and a terminal packet no larger than 4 KiB; it does not
absorb worker transcripts or raw logs. A true STOP ends the whole program.

Only a failure of the current milestone acceptance or a critical regression may
interrupt active implementation. Record every other addition compactly for a
later milestone; do not expand the active candidate.

## Roles and write ownership

The judge owns contracts, manifest, acceptance registry, `review.*`, ledger,
git, and release decisions. An implementer changes only assigned source and
ordinary tests. A cold auditor receives only the frozen audit brief, edits
nothing, and returns findings.

Use at most one implementer and one cold auditor lineage per milestone. Reuse
the same implementer for bounded corrections. Do not create
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
- At two compactions or one fresh same-role continuation, the supervisor must
  review prompt/tool size, model routing, and whether the next action is still
  bounded. Continue the same logical role lineage only with a compact packet
  and cumulative counters; the watchdog is not a human permission request.
- Run `npm run codex:usage -- --session <id>` at every task terminal. Record
  `modelCycles`, `cachedInputTokens`, `uncachedInputTokens`, `compactions`,
  `repairWaves`, `fullChecks`, `ciRuns`, and `elapsedMs`; when
  platform counters are available, also record subagent and wait counts. Never
  copy prompts or double-count inherited fork history. Quality gates never
  weaken to improve these metrics.

## Candidate execution counters and autonomous repair

Counters belong to the milestone ID and candidate lineage, not a task name.
They are cumulative telemetry and internal admission inputs, not authority and
not permission prompts. Renaming a repair, metadata commit, continuation, or
thread never resets them.

- structural limits: one implementer lineage, one cold-auditor lineage, one
  logical audit wait chain, one logical CI wait chain, one semantic push, and
  one replacement push
- internal watchdogs: two release full-check attempts, two compactions, one
  same-role continuation, two correction waves, supervisor 1.0M uncached input
  tokens / 160 model cycles, and team 1.6M uncached input tokens / 400 model
  cycles
- watchdog crossings produce explicit advisories and force prompt/tool/model/
  repair-boundary review; they do not fail an otherwise authorized fixed-scope
  action and do not request a larger number from the user
- cached input tokens and total input tokens remain mandatory terminal telemetry;
  they are never silently substituted for uncached usage
- release full check: one normally; the second is the repair objective, and any
  later attempt remains a cumulative advisory that never substitutes for the
  mandatory final green check or asks the user for a larger number
- production browser verification: once on the final release HEAD

Known sandbox or IPC restrictions use the already approved execution path on
the first attempt. Do not repeat a known-failing probe for every milestone. A
fixed-scope audit, acceptance, full-check, CI-environment, or exact guard-impact
defect resumes or derives a same-acceptance, same-authority repair without
resetting cumulative usage. Stop only after two attempts at the same root cause
make no progress and the next action requires an outcome/scope/quality ruling,
or when the contract is contradictory, a true value/scope/North-Star decision
is missing, or the next action lacks authority. Never ask for a numeric budget
extension.

## OpenAI capability routing

Use the smallest relevant OpenAI capability set for the task shape. A feature
is useful only when it improves outcome quality, latency, or measured cost.

- Use programmatic tool calling to batch deterministic reads, filtering,
  joining, and validation into one bounded result.
- Use multi-agent only for independent parallel work or required role
  separation. Reuse the same implementer and cold auditor instead of spawning
  replacement lineages.
- Use the project Skill and compact canonical context as the reusable prompt;
  do not replay transcripts. Prefer Luna/low-medium for routine bounded work,
  Terra/medium for balanced implementation, and Sol/high for genuinely hard
  integration or cold audit. Raise effort only when evidence shows a quality
  gain.
- Use web/GitHub retrieval only for unstable or external facts, and browser or
  computer-use only for observable UI evidence. Do not call image, audio,
  automation, or other modalities when the product outcome does not need them.

## Executable supervisor gates

From `goalPolicy.supervisionPolicy.enforceFromDomainId`, prose is not enough.
At milestone start and every state transition run
`npm run codex:program-step -- --domain <id> --action <action>`. Before audit
and every release full check run `npm run check:budget -- --domain <id>` and
`npm run check:guard-impact -- --base <sha> --domain <id>`. Release preflight
must consume the same candidate, permission, budget, lineage/wait, and
guard-impact result. Missing or contradictory state, unavailable required
telemetry, a stale acknowledgement, a duplicate structural role/wait slot, a
counter reset, or an exceeded structural limit is a nonzero STOP. A valid
cumulative usage watchdog crossing is an advisory and internal routing event,
not a permission failure.

## Player-journey cadence

An active-program domain declares `deliveryClass`, `playerOutcome`,
`journeyEvidence`, and `outcomeDeadlineDomainId`. A `player-outcome` milestone
names executable production journey evidence. A `substrate` milestone names the
later outcome that pays its debt. From
`activeProgram.journeyPolicy.enforceFromDomainId`, three consecutive substrate
milestones are invalid. Older debt may be listed only in the exact
`legacyDebtDomainIds` array; the exception cannot grow after activation.

From `activeProgram.usagePolicy.enforceFromDomainId`, a terminal milestone must
contain the complete structured usage record. Earlier shipped milestones may
use only `measurementStatus: historical-unavailable`; never invent zero usage.

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

Before the audit freeze, run the three executable supervisor gates above, then
`npm run check:release-preflight -- --base <sha> --domain <id> --owner <judge|implementer>`.
This bounded release preflight must confirm the
declared base/ancestor, ledger collection parity, loop-state/resume consistency,
protected ownership, review hash chain, candidate fingerprint, planned terminal
metadata, invalidated claims, known execution environment, and secret-free
evidence. It also rejects fixed active-program next-ID guards, stale generated
API, secret-like changed text, and a CI diff-base/ownership mismatch. A failed
preflight forbids the audit/full-check/push sequence until repaired.

Semantic and terminal fingerprints are separate. A terminal-only successor may
change synchronized terminal fields in the ledger and loop-state plus the exact
active-domain supervisor event file. `npm run check:terminal-metadata` must
prove that the HEAD event list is an immutable prefix and that every append has
valid event/receipt hashes, actor/usage, counter/state, authority/acceptance,
lineage/wait, and ledger agreement. Another domain, wildcard path, truncation,
rewrite, unreadable HEAD authority, or extra file fails closed. Product,
contract, workflow, generated, and `review.*` bytes force the semantic lane.
Receipt prefixes are monotonic per session: lengths never decrease and the
hash at the same byte length is immutable. Confirmed absence is reported
separately from probe, object-integrity, permission, and read failures.
For the terminal metadata commit, the candidate release head remains the
already checked and deployed semantic diff base; the successor HEAD may differ
only by those verified terminal paths and never rebinds the release artifact.
Exact terminal-only CI reuses the already deployed semantic artifact by leaving
Pages untouched; it does not repeat full Vitest/build or redeploy identical
product bytes.

The clean semantic verdict is `AUDIT-OK-PENDING-FULL-CHECK`. Close findings,
re-run only invalidated evidence, freeze the release tree again, and require the
same fingerprint as the audited tree. Run the full check once. If that full
check itself exposes a defect, make the smallest correction, re-run invalidated
evidence and affected audit claims, and run the exact final full check. Keep
every invocation cumulative. Crossing the two-attempt objective is an internal
watchdog, not authority or a permission prompt; stop only under the common
same-root-cause/no-progress outcome rule above. A final green `npm run check` on the audited release tree remains mandatory.

The release full check command is `npm run check`; no narrower command can
substitute for it.

Ship only with the authority defined in `AGENTS.md` and `.claude/commands/ship.md`.
On ship, record audit and release evidence, archive the completion packet, and
run the terminal usage measurement. A normal task resets loop-state to
`milestone: complete` and ends. An explicitly authorized program supervisor may
instead transition to the next domain only after the exact-head clean-worktree
gate above; the final program cycle resets loop-state and ends. Without ship
authority, leave a verified candidate and make no external write.
