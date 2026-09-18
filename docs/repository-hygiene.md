# Repository lifecycle / retention / retirement policy

Status: M5 supporting process policy  
Semantic authority: none  
Project NOW authority: none  
External-write authority: none

This document defines how repository assets are classified and what proof is required before retirement. It does not own Product Truth, Project State, semantic identity, verification verdicts, compatibility promises, or permission to commit/push/merge/deploy.

## 1. Asset model

An asset is the smallest unit whose existence reason, owner, consumers, lifecycle, and retirement conditions can be explained. An asset may be a file, document section, generated chain, test family, workflow bundle, branch/PR, evidence journey, persisted format, research fixture, or compatibility surface.

M5 inventories are derived views. They must not become a second source of semantic or Project State truth.

## 2. Lifecycle is separate from health

Primary lifecycle vocabulary:

- `ACTIVE` — current operational/authority responsibility.
- `SUPPORTING` — current input/rationale/methodology that is not upper authority.
- `COMPATIBILITY` — retained for supported historical paths or persisted consumers.
- `GENERATED` — machine-owned derivative with an explicit generator/freshness rule.
- `HISTORICAL` — non-current record retained for history.
- `PROVENANCE` — evidence of why/how a current state was reached.
- `DEPRECATED` — current-looking use is forbidden; retirement may still require closure.
- `RETIRE_CANDIDATE` — all known current roles are closing, subject to proof below.
- `RETIRED` — removed after the proof was satisfied.
- `UNKNOWN` — insufficient evidence; destructive action is blocked.

Health findings such as stale claim, broken locator, duplicate gate, targeting orphan, broken bundle, or latent automation are a separate axis. `HISTORICAL` is not itself a defect.

## 3. Prohibited shortcuts

None of the following is retirement proof by itself:

- old filename/date/milestone;
- no runtime import/reference;
- `review.*` prefix;
- validation-domain non-membership;
- historical/provenance location;
- generated output;
- branch age;
- green CI;
- apparent duplicate file/test name.

Current executable, verifier, generator, evidence, compatibility, persistence, recovery, and provenance consumers must be considered.

## 4. Retirement proof

A destructive retirement is allowed only when all applicable questions are answered:

1. **Authority** — no current Product, semantic, Project State, verification, or execution authority is owned by the asset.
2. **Runtime consumer** — current production/runtime consumers are absent or migrated.
3. **Verification consumer** — current tests/checkers/workflows/evidence no longer depend on it, or an equivalent floor is already active.
4. **Compatibility** — no supported stable path, persisted format, localStorage/IndexedDB record, old room/session, or migration path still requires it.
5. **Recovery** — interruption/reconstruction does not require the asset.
6. **Provenance** — unique historical source/review/decision/evidence is preserved elsewhere when retention is required.
7. **Generated chain** — the asset is not an input needed to regenerate or validate a retained output.
8. **Hash pin** — no current verifier freezes the asset bytes.
9. **Locator** — retained assets no longer point to the retired asset, or locators move in the same reviewed unit.
10. **Auditability** — a fresh reader can reconstruct why the replacement/current state is authoritative.

If any required answer is unknown, the terminal state is `RETIRE_CANDIDATE_PENDING_PROOF`, not deletion.

## 5. Historical authorization is non-replayable

A dated plan, decision, CI reauthorization record, prior chat authorization, Work Order, PR body, or evidence packet may accurately record past commit/push/deploy permission. That record never creates present permission.

Historical records that contain executable-looking authorization must state that they are non-current/non-replayable unless a stronger current wrapper already makes that impossible to misread.

Current external writes remain governed by `AGENTS.md` and the applicable repository Skill plus current explicit user instruction.

## 6. Generated and human judgment

Machine-generated discovery must not be the durable store for human/judge dispositions unless the generator round-trips those decisions by contract.

The legacy contract migration uses:

- machine discovery/suggestions in `research/archive/document-reset-2026-08/legacy-contract-inventory.json`;
- durable judge decisions in `research/archive/document-reset-2026-08/legacy-contract-decisions.json`.

A stale judge binding fails closed; it is never fuzzy-carried to a changed source item.

## 7. Verification and evidence retirement

A test/evidence/workflow may retire only after its unique fault model has a named current owner. A shared substrate imported by current evidence remains active even when its filename contains an old milestone.

Workflow retirement must preserve unique static/architecture guards as well as runnable tests. Removing an obsolete trigger shell does not by itself prove the underlying evidence is redundant.

## 8. Compatibility retirement

Compatibility cleanup is consumer- and persistence-driven, not source-age-driven. Local persisted records and dormant server objects can outlive ordinary releases.

A compatibility surface may retire only after current consumers close and an explicit migration, expiry, reset, or retention policy covers still-possible persisted state. Runtime compatibility cleanup must not be bundled into ordinary branch/work-artifact cleanup merely for convenience.

## 9. Git / PR retirement

Closing a stale PR ends a work surface; it does not delete its historical PR record.

Deleting a branch ref is separate from closing its PR and separate from deleting provenance. If a branch contains unique provenance, archive the minimum durable packet first. If accepted implementation/history already provides superior provenance, no extra archive should be created merely to preserve a one-off staging recipe.

## 10. Recovery boundary

Recovery reconstructs current reality and whether work can continue. It does not authorize rollback, ref mutation, deployment rollback, persisted-state rollback, or external writes.

Recovery metadata should store pointers/fingerprints, not independent claims of NOW, semantic PASS, compatibility ownership, or write authority.
