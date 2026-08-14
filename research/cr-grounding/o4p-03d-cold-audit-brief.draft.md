# O4P-03D independent cold-audit brief

Milestone: `O4P-03D`

Base SHA: `9ab8449aa7b7a4ab729f5d9acb752417c686e07b`

Risk/lane: `R3`, `BROAD`, Online Cloudflare production and release lane

Time budget: 45 minutes

## Role and hard boundaries

You are the independent cold auditor. Begin from this brief only. Do not use or
request implementation chat, rationale, prior-agent summaries, or secrets.
Read-only work is mandatory: do not edit files, apply patches, create tracked
artifacts, stage, commit, push, deploy, tail production, or mutate Cloudflare or
GitHub. Do not run `npm run check`; the release full check is authorized only
after a clean audit and metadata confirmation.

The candidate worktree must remain at the declared base plus the bounded
O4P-03D diff. Recompute semantic and context fingerprints before and after the
audit and report both. Any unexplained drift is a BLOCKER.

## Authority to read

Read these completely before judging the candidate:

- `AGENTS.md`
- `docs/judge-protocol.md`
- `.claude/audit-standing.md`
- `.agents/skills/mtg-onedeck-development/references/document-governance.md`
- `research/cr-grounding/o4p-03d-cloudflare-headless-production-gate.contract.draft.md`
- `research/cr-grounding/o4p-03d-acceptance-brief.draft.md`
- the complete candidate diff from the declared base
- every changed/new production, ordinary-test, Judge-review, architecture,
  verifier, evidence-harness, configuration, and TypeScript file in that diff
- any unchanged lower-layer source required to validate a claimed transition

Use only the Cloudflare primary documentation linked by the frozen contract for
platform semantics. Do not infer a capability from a Wrangler example or a
test double when the primary platform contract says otherwise.

## Required adversarial audit

Audit the complete candidate, not merely the green tests. At minimum:

1. Prove `wrangler.jsonc` has the exact workers.dev Worker, declarative SQLite
   Durable Object export, observability, and version-metadata binding, and no
   account identifier, route, secret, legacy migration, dependency, CI deploy,
   custom domain, or unrelated publication mutation.
2. Exercise empty, valid pre-O4P-03C, partial-security, already-current, invalid
   migration-ledger, SQL-failure, validation-failure, and clock-failure paths.
   Confirm one synchronous transaction, idempotence, exact generation-zero
   grants, byte preservation of existing O4P-03C data, and complete rollback.
3. Adversarially reproduce checkpoint creation/advancement and recovery from a
   nonzero migration boundary and revision 64. Corrupt or reorder checkpoint,
   state, journal, receipt, participant, base revision, accepted revision, and
   commands. Confirm canonical validation, replay at most 63, atomic CAS, no
   write on failure, and only the frozen same-revision presence/lifecycle
   comparison exemption.
4. Audit every Worker and Durable Object success/failure/constructor/WebSocket
   event path. Confirm structured facts are schema-allowlisted, version IDs are
   canonical, logging failure cannot affect semantics, WebSocket error does not
   persist disconnect, and no raw exception, URL/query/header/body/frame,
   identity, state, command, receipt, journal, account, credential, capability,
   or environment material can be emitted.
5. Inspect and run the evidence harness locally with hostile/mock responses.
   Confirm four distinct seats, exactly 96 sequential accepted commands evenly
   distributed, per-bearer rate safety, revision/status/fresh-socket/audience
   checks, at least 70 seconds of real idle in the production phase, an
   orchestrator-only deploy barrier, a new post-deploy socket, finite timeouts,
   nonzero failure, runtime-only secret generation, and secret-free summaries.
   It must not deploy, rollback, create resources/secrets, change DNS/routes,
   or mutate GitHub.
6. Audit the O4P-03A/B/C successor compatibility and all re-owned Judge hashes.
   Confirm no Core, Room, protocol, projection, headless, Solo, UI, audio,
   dependency, workflow, or lower-layer semantic drift.
7. Independently verify the exact Wrangler 4.122.0 dry-run contract without a
   real deploy. Do not print an account ID or OAuth material.
8. Run the registered O4P-03A/B/C/D verifiers, all changed `review.*` and
   architecture tests, machine-check registration, relevant ordinary
   Cloudflare tests, scoped lint/TypeScript, and `git diff --check`. A sandbox
   `tsx` IPC `listen EPERM` is a non-execution; rerun the identical command in
   an allowed local environment before using it as evidence.

## Finding policy and return format

Treat secret disclosure, fail-open migration/recovery, state loss/corruption,
invalid shipment evidence, wrong Cloudflare resource/origin, or a false
hibernation/deployment claim as BLOCKER. Treat remotely reachable contract or
authorization violations and materially incomplete recovery/observability as
HIGH. Report MEDIUM/LOW normally; do not hide them to reach a gate.

Return:

- before/after semantic and context fingerprints;
- findings grouped by BLOCKER/HIGH/MEDIUM/LOW with exact file/line and a minimal
  reproduction or proof;
- independently executed test/verifier/dry-run evidence and any non-execution;
- explicit closure status for every required adversarial area above; and
- one verdict: `AUDIT-FAILED` or `AUDIT-OK-PENDING-FULL-CHECK`.

Do not authorize a real Cloudflare deploy, commit, push, shipment status, or
release full check beyond the verdict. The Sol Judge owns those gates.
