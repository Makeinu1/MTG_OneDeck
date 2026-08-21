# Codex 5.6 Program Orchestration & Context Economy Contract

Milestone: `GOV-CODEX-56-2026-08`
Base SHA: `592bcc7ed69266f0b078bb8a4e3a3d4103113e1a`
Risk: `R3 / BROAD` because this changes task lifetime, selection, role routing,
and audit policy without changing product behavior.

## Goal

Let one explicit user authorization finish a machine-readable serial program
without mixing milestone candidates or repeatedly importing old task
transcripts. Use GPT-5.6 Sol for ambiguous judgment and GPT-5.6 Luna for clear,
bounded work, with the lowest reasoning effort that meets measured quality.

## Evidence and diagnosis

The live ledger and exact `HEAD` show that O4P-06A through O4P-06F are already
`shipped`; this milestone must not reopen O4P-06 implementation. The O4P-06
completion chain preserved quality, but the prior rule that a top-level task
must end after every milestone prevented the user's single A-through-F
authorization from acting as a durable program authorization. It also made the
first context compaction a mandatory stop even when canonical state was
healthy.

OpenAI's current official guidance establishes the following design inputs:

- Sol is the default for complex, open-ended, high-value work; Luna is for
  clear, repeatable, high-volume work.
- Use the lowest reasoning effort that produces the required result. Higher
  effort and subagents consume more time and tokens.
- Subagents inherit model and reasoning settings unless an explicit spawn,
  project default, or custom agent overrides them.
- `AGENTS.md` is loaded once per run and uses a 32 KiB combined default budget;
  Skills use progressive disclosure and are the proper home for detailed
  reusable workflows.

Official sources, fetched 2026-08-22:

- <https://developers.openai.com/api/docs/guides/latest-model>
- <https://learn.chatgpt.com/docs/agent-configuration/subagents>
- <https://learn.chatgpt.com/docs/agent-configuration/agents-md>
- <https://learn.chatgpt.com/docs/build-skills>

## Frozen decisions

### 1. One active candidate, not one user thread

Only one milestone candidate may be active in a worktree. By default, one user
task still owns one milestone. When the user explicitly authorizes completion
of a machine-readable `goalPolicy.activeProgram`, the same judge task may act
as a **program supervisor** and start the next milestone only after the current
milestone is shipped and closed.

Every milestone transition must re-run `npm run codex:context -- --domain
<next-id>`, require a clean exact-head worktree, refresh the base SHA and tree
fingerprint, and create a new six-field task envelope. No downstream source,
test, contract, or audit work may begin before this gate.

### 2. Fresh worker context

Implementers receive only milestone ID, base SHA, brief path, Goal,
Constraints, and Done when. Cold auditors receive only the frozen audit-brief
path and candidate fingerprint. Neither inherits the program supervisor's
transcript or the implementer's rationale. On the current Codex collaboration
surface this means `fork_turns: "none"`; on another surface use its equivalent
fresh-context option. Reports return conclusions, changed paths, tests,
deferred work, and findings, not raw tours or full logs.

### 3. Model and effort routing

Repository defaults use Sol at `high` for the judge and Luna at `medium` for a
spawned worker. Explicit user model/effort requests override these defaults
when the runtime supports them. The judge raises a worker to `high` or `xhigh`
only for a demanding, bounded implementation or audit claim; `max` is reserved
for unresolved R3 ambiguity. A requested unavailable model or effort is
reported exactly and is never silently substituted.

Model routing is a starting policy, not release evidence. Targeted tests,
independent audit where required, and exact fingerprints decide quality.

### 4. Serial-by-default delegation

Subagents are used for role separation or genuinely independent work, not as a
default search strategy. Repository reads and deterministic checks that fit one
bounded programmatic tool stage stay in the judge task. Parallel agents require
disjoint write ownership or read-only questions, a stated latency benefit, and
a bounded result schema. A milestone uses at most one implementer and one cold
auditor unless the user explicitly expands the budget.

### 5. Compaction and durable recovery

Context compaction is a recovery checkpoint, not an automatic task ending. The
judge closes the current atomic action, writes or refreshes the compact
continuation packet, and recovers from `AGENTS.md`, verified `codex:context`, the
active brief, the applicable `docs/judge-protocol.md` section, and the workflow
reference. A stale loop-state, transcript summary, or remembered next step
never overrides those authorities. No new milestone starts until the
transition gate in Decision 1 passes.

### 6. Proportionate audit

R2/R3 semantic changes, public behavior, protocol, CR meaning, selection
policy, and human-authored ownership reauthorization retain independent cold
audit. R0 terminal metadata may omit a new LLM cold audit only when all changed
fields are deterministically derived from already audited immutable evidence,
an executable verifier checks the exact bytes or hashes, and no authority,
allowlist, acceptance claim, or meaning changes. "Metadata-only" by itself is
never an exemption.

### 7. Release efficiency without fake green

Before the first push, the judge runs the local forbidden scan against the
declared base and prepares exact protected-path ownership evidence. An expected
red CI run is not a routine progress gate. If repository policy genuinely
requires a first exact-head result before reauthorization, preserve the
candidate bytes and perform the separate green flow; otherwise publish only
the fully authorized exact-head candidate. Full `npm run check` remains once
per release fingerprint, with the existing two-run defect ceiling.

## Non-goals

- No GameState, GameCommand, UI, Online, Cloudflare, CR pin, dependency, or
  production behavior changes.
- No parallel milestone implementation and no shared dirty candidate.
- No weakening of BLOCKER/HIGH, replay, browser, CI, Pages, or production
  evidence requirements.
- No automatic external publication without the authority in `AGENTS.md` and
  `.claude/commands/ship.md`.
