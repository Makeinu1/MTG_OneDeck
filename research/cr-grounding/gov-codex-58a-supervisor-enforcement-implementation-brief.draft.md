# GOV-CODEX-58A Implementer Brief

- Milestone ID: `GOV-CODEX-58A-2026-08`
- Base SHA: `74d24c0311e0d58112b15c58d6f8546449a5b01a`
- Brief path: `research/cr-grounding/gov-codex-58a-supervisor-enforcement-implementation-brief.draft.md`
- Goal: implement the contract's executable candidate, permission, budget,
  guard-impact, lineage, wait, STOP, and preflight gates.
- Constraints: edit only assigned scripts, package scripts, ordinary script
  tests, and expressly assigned skill integration; do not edit AGENTS.md,
  docs/, ledger, contracts/briefs, `review.*`, product/Core/online/UI,
  dependencies, git, or external state. You are not alone in the codebase;
  preserve and accommodate Judge changes.
- Done when: all acceptance behavior has executable ordinary tests, affected
  tests/lint/docs/diff checks pass, and the implementer reports changed files,
  acceptance results, deferrals, and unresolved points without claiming audit
  or shipment.

## Outcome-first final repair

- Preserve the existing STOP snapshot, candidate ID, authority, counters,
  lineages, findings, tracked event history, and all completed implementation.
- Close only the final cold-audit HIGH findings:
  1. Anchor the receipt baseline and exact ordered session-role allowlist to the
     first tracked event. Every later receipt plan must match it byte-for-byte in
     meaning; shifted baseline, swapped role/session, omission, or addition
     fails before mutation.
  2. Make the canonical `runProgramStep` release-derived `derive-repair` path
     reachable from a verified `repair-required` record. Malformed tracked
     authority must remain fail closed.
- Treat full-check, model-cycle, uncached-token, correction, compaction, and
  continuation thresholds as cumulative watchdog advisories, not action
  authority. Keep lineage, wait, and push limits structural, and retain the
  mandatory final exact-tree green check. Add an exact
  same-scope supervisor repair-resume from `audit-failed-stop`; it preserves the
  failed event and may return only to correction under complete autonomy.
- Add focused adversarial ordinary tests for baseline/allowlist mutations,
  advisory-versus-structural limits, same-scope repair-resume, and the canonical
  derive-repair path. Do not add a new framework or broad abstraction.
- Preserve post-bootstrap fail-closed tree/authority/acceptance checks and the
  append-only `refresh-fingerprint` transition. Do not change product/Core/UI,
  dependencies, Judge-owned files, review tests, git, or external state.
