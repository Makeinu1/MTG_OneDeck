# GOV-CODEX-56R2 Request Normalization and Bounded Execution Contract

Date: 2026-08-25
Authority: user-ruling-2026-08-25
Base SHA: `2a50db07f3962a11ec5a77b93bedc74ca4f628b6`
Risk: R3 / BROAD governance

## Goal

Rewrite the active Codex governance so an LLM converts ordinary user prose into
a compact execution request before work begins, while preserving OneDeck's
existing contract, audit, release, production, and secret-safety evidence.

The normalized request has exactly these fields:

1. `Intent`
2. `Program`
3. `Goal`
4. `Constraints`
5. `Done when`
6. `Budget objective`
7. `Authority`

The LLM performs the conversion. The user is not required to learn or manually
write the schema. Normalization is an interpretation aid, not authority to add
scope, shipping permission, destructive action, dependency changes, or external
writes absent from the original request. Commit, push, deploy/publish, and
release/ship are independent permissions; `+ ship` is reserved for explicit
end-to-end release. Intent selects the work shape and grants no authority bit.

## Constraints

- Governance only: no GameState, GameCommand, UI, Online, Cloudflare, dependency,
  CR pin, or production behavior change.
- The release-blocking fixed-seed zone-transition property tests may receive one
  explicit 15-second per-test budget. Do not change the global timeout, Core
  parallelism, generators, seeds, run counts, or assertions.
- The full-check repair may make only two historical governance reviews
  future-extensible: `AGENTS.md` must point to the sole operative workflow, and
  the O4P-08 path guard must inspect its frozen closure commit rather than later
  milestones or the current worktree. Do not weaken O4P-08 evidence assertions.
- Preserve Judge / Implementer / Cold Auditor separation and all current release
  evidence.
- State each standing rule once. Keep `AGENTS.md` compact and route execution
  detail through progressive disclosure.
- Default normal intake to Sol/medium. Use high/xhigh only for measured complex
  implementation, audit, or ship judgment; max only for unresolved R3 ambiguity.
- A multi-milestone supervisor retains only compact envelopes and terminal
  packets. Workers and auditors receive fresh context.
- Counters are per milestone and cannot be reset by renaming a repair, metadata
  commit, task, or continuation.
- Each logical role lineage permits at most two compactions and one same-role
  continuation. The continuation shares its role slot and every existing
  counter; the token and model-cycle ceilings remain hard when visible.
- A user budget replaces `Budget objective` only. Hard ceilings change only
  through a separate explicit governance ruling.
- Every external action remains false without its own explicit authority bit.
  Commit, push, or deploy/publish may be authorized without granting
  release/ship or permission to mark the milestone `shipped`.

## Done when

- `AGENTS.md` routes every request through the normalization contract without
  duplicating its schema.
- The development Skill and document-governance workflow define normalization,
  intent/authority inference, context limits, hard counters, wait discipline,
  and the release-preflight boundary.
- A dedicated progressive-disclosure reference contains the canonical schema,
  inference rules, and examples.
- Project defaults use Sol/medium for ordinary intake while preserving the
  explicit Sol/high R3/BROAD auditor.
- Executable review tests fail if the exact schema, representative
  inspect/change/goal/commit/push/deploy/ship classifications, authority
  boundary, compact packet, scope-interruption rule, fresh-context rule, changed
  path union, or hard counters disappear.
- The review fails if the bounded property timeout disappears, changes from
  15 seconds, becomes global, or is paired with reduced property coverage.
- Historical review tests accept later governed ledger entries while still
  proving the exact ordered O4P-08 entries, evidence, and frozen closure diff;
  the audit-order test proves the compact root contract routes to the one
  workflow that owns the exact audit verdict.
- Targeted checks pass and an independent fresh-context R3/BROAD cold auditor
  reports `BLOCKER/HIGH = 0` for the frozen candidate fingerprint.

## Exclusions

- No automatic prompt rewriting service or product UI.
- No weakening of targeted tests, cold audit, full check, exact-head CI, Pages,
  Worker, browser, clean-worktree, or secret-free evidence.
- No claim that `check:release-preflight` already exists unless this candidate
  implements it. Until then, the workflow requires one equivalent bounded
  preflight stage and records its result in the milestone packet.
