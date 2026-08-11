# O4P-01N serial judge integration brief

Role: Sol judge/orchestrator only. Start after the final Luna implementation
packet passes independent source review and targeted checks.

Base SHA: `435b691b63492ebb66389cfa37c8a5a3d6d102b4`

Frozen authority:

- `research/cr-grounding/o4p-01n-mode-neutral-core-closure.contract.draft.md`
- `research/cr-grounding/o4p-01n-acceptance-brief.draft.md`

## Reserved judge write set

- `src/engine/core/index.ts`
- one O4P-01N fixture under `src/engine/core/fixtures/`
- `scripts/checks/verify-mode-neutral-core-closure.ts`
- `src/test/architecture/review.o4p-01n-mode-neutral-core-closure-boundary.test.ts`
- the bounded O4P-01N additions to
  `src/test/architecture/modeNeutralCoreBoundary.test.ts`
- `package.json`
- `scripts/checks/machine-checks.mjs`
- `docs/generated/engine-api.md` through the generator only
- candidate fingerprint, cold-audit brief/record, manifest, ledger, and
  loop-state only at their governed stages

No Luna implementer edits any path in this set.

## Integration order

1. Export `./closure` once from the Core root; do not enumerate a duplicate
   hand-maintained symbol list.
2. Add a deterministic serialized fixture that contains the exact four-player
   initial root and ordered typed commands or an equivalent input packet. It
   must contain no Room, protocol, projection, transport, or UI field.
3. Add a standalone verifier that imports only the public Core root and proves:
   all four closure versions are 1; all 15 payload kinds are represented;
   rejected commands do not advance accepted count; actor/decision-maker
   separation; recorded random permutation; both correction warnings without
   reason metadata; stable player roster after exit; save/load/replay final
   state and event transcript equality; and the exact DEFER boundary.
4. Add the review/architecture test that pins the public export, verifier
   registration, pure dependency boundary, absence of runtime randomness and
   network/Solo types, closed payload union, and no event reducer or generic
   mutation API.
5. Register exactly one package verifier script and one machine-check step.
   Extend the existing Core-boundary verifier allowlist for the new script.
6. Run targeted ordinary, review, architecture, verifier, lint, and build
   checks. Generate `docs/generated/engine-api.md`, then run `check:docs`.
7. Freeze the semantic fingerprint and create a cold-audit brief containing
   only paths, contract clauses, commands, fingerprint, and finding schema.

## Candidate gates

- `git diff --check`
- `npm run check:forbidden -- --diff 435b691b63492ebb66389cfa37c8a5a3d6d102b4`
  interpreted under judge ownership for review/contract/generated paths
- BLOCKER/HIGH zero from a fresh `fork_context:false` Luna cold auditor
- no candidate edits after audit without a new fingerprint and required
  re-audit
- one full `npm run check` only after `AUDIT-OK-PENDING-FULL-CHECK`
- no O4P-01N commit, manifest promotion, ledger shipment, push, CI, or Pages
  publication without explicit user authorization for this milestone
