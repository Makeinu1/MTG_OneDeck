# M5 Recovery / Reconciliation Protocol

Status: M5 supporting process protocol  
Semantic authority: none  
Project NOW authority: none  
External-write / rollback authority: none

## Purpose

Recover the current repository/work state after interruption **from canonical repository sources**, not from chat memory or a stored second NOW registry.

Recovery answers:

1. what canonical state exists now;
2. what exact candidate exists now;
3. whether a supplied Work Order still applies;
4. what verification/review/generated-state evidence must be recomputed;
5. whether the next safe disposition is `RESUME`, `REPLAN`, `BLOCKED`, or `RESCUE`.

Recovery never authorizes ref mutation, rollback, deployment, persisted-state rollback, commit, push, merge, or publish.

## Reconstruction order

Read/recompute in this order:

1. `docs/project-state/index.json` and its watched-root freshness;
2. `docs/project-state/production-map.json` and its watched-path freshness;
3. optional Work Order pointer/hash;
4. M4 planningBase/reference/candidate/delegation validation;
5. current main, current HEAD, merge-base and candidate fingerprint;
6. M3/M3.1 candidate verification impact;
7. PR/review pointers supplied by the caller;
8. generated output/generator blob identities;
9. repository hygiene;
10. classify `RESUME / REPLAN / BLOCKED / RESCUE`.

No stored receipt may shortcut these reads.

## Pointer/hash receipt

A recovery receipt may contain only bounded observations/pointers such as:

- observed main SHA;
- Project State path and blob SHA;
- production-map path and blob SHA;
- optional Work Order path and SHA-256;
- candidate branch/head/merge-base/diff fingerprint;
- verification base/head and evidence references;
- PR identifier and unresolved review references supplied as pointers;
- generated output and generator path/blob pairs.

The receipt must **not** persist independent claims of:

- current milestone / next gate;
- semantic verdict;
- verification PASS/freshness;
- compatibility ownership;
- external-write/deploy/rollback authority.

Those facts are re-read or recomputed.

## Dispositions

### RESUME

The canonical state/hygiene is valid, the supplied Work Order still validates at planningBase and candidate HEAD, and the candidate remains a descendant of the relevant main lineage.

### REPLAN

The repository is healthy, but there is no current Work Order or the supplied packet is stale/materially drifted. Reconstruct a new bounded packet before mutation.

### BLOCKED

Canonical Project State, production-map freshness, repository hygiene, or the recovery receipt itself cannot be validated. Do not infer around the missing proof.

### RESCUE

A candidate branch has diverged from current main such that ordinary Work Order continuation cannot be proven. Preserve evidence and perform a separately bounded rescue/reconciliation; do not silently rebase or reset.

## Recovery is not rollback

A valid recovery receipt has no rollback semantics. Any reset, force-push, deployment rollback, or persisted-state rollback requires a separate authorized operation with its own compatibility and migration checks.
