# M-OPS-SESSION-BOUNDARY implementation brief

Milestone: `M-OPS-SESSION-BOUNDARY`
Base SHA: `4829bbaa49ebdd6ccae5062ff152bcb9c15c7f99`
Role: implementer
Risk: R3 workflow-selection protocol; no game/runtime semantics

## Goal

Make `npm run codex:context` honor an optional, machine-readable active-program
order and point new sessions at the sole operative workflow. This closes the
mechanical O4P selection defect after O4P-02A shipment without changing game
semantics.

## Allowed writes

- `scripts/codex-context.mjs`
- `scripts/__tests__/codexContext.test.mjs`

## Forbidden writes

- `AGENTS.md`, `docs/**`, `.agents/**`, `review.*`, ledger, manifest,
  loop-state, archive evidence, package files, engine/UI/store code, and git.
- Do not activate or edit a program in the live ledger; that is judge-owned.
- Do not alter any O4P milestone status, evidence, timeout, or release state.

## Contract

`ledger.goalPolicy.activeProgram` is optional. When present it has exactly this
shape:

```json
{
  "id": "O4P",
  "domainIds": ["O4P-01G", "O4P-01H", "O4P-01I"]
}
```

- `id` is a non-empty string.
- `domainIds` is a non-empty ordered array of unique, non-empty domain IDs.
- Every listed ID must exist in both ledger collections after normal integrity
  validation.
- For every listed ID, `domains[].dependsOn` and
  `plannedSequence[].dependsOn` must each be a valid unique string array and
  must describe the same set. Order may differ, but a domain-only or
  planned-only dependency produces exactly
  `{ code: "ACTIVE_PROGRAM_DEPENDENCY_MISMATCH", domainId,
  domainDependencies, plannedSequenceDependencies }`, with both copied sets in
  deterministic code-unit order. Selection must be `integrity-error` and exit
  `2`; merge precedence must never hide the mismatch.
- A dependency target outside `activeProgram.domainIds` is known when it exists
  in either ledger collection. Historical shipped prerequisites are allowed to
  remain in only one collection; graph traversal uses the deterministic union
  of the available dependency edges. A target absent from both collections is
  still an integrity error.
- Every listed entry after the first must directly depend on the preceding ID;
  a missing entry, duplicate, or broken order is an integrity error.
- The existing global `implemented-not-audited` priority remains first.
- Otherwise select the first active-program entry whose status is not
  `shipped`, before normal CR-order selection.
- `pending`, `drafted`, `implemented-not-audited`, and `audited` are resumable.
  `judge-gated` and `deferred` return a nonzero, fail-closed blocked selection.
- If any dependency of the selected program entry is not `shipped`, return a
  nonzero, fail-closed blocked selection; never fall through to another task.
- When every listed program entry is `shipped`, fall back to the existing
  normal CR selection.
- Explicit `--domain` behavior remains unchanged and takes selection
  precedence, while ledger integrity validation remains mandatory.
- The projection reports a compact active-program summary and replaces the
  compatibility `cycle.md` / `token-economy.md` canonical paths with
  `references/document-governance.md`.
- Successful output remains at most 12 KiB.

## Ordinary acceptance

Add focused tests proving:

1. an active O4P entry wins over an eligible lower-`crOrder` CR entry;
2. program completion returns to normal CR order;
3. blocked dependency/status does not skip to another task and exits nonzero;
4. missing, duplicate, and non-linear program declarations fail integrity;
5. explicit `--domain` remains supported;
6. canonical paths contain `document-governance.md` and omit the two
   compatibility pointers;
7. a planned-only pending dependency and a domain-only pending dependency each
   fail integrity with both normalized sets, select nothing, and exit `2`.
8. a shipped external prerequisite present in only `domains` or only
   `plannedSequence` remains valid, while a target absent from both collections
   still fails integrity.

Run only:

```text
npx vitest run scripts/__tests__/codexContext.test.mjs
```

Return changed files, exact test result, deferrals, and unresolved findings.
