# Document governance workflow

This is the canonical workflow for DOC-GOV-RESET-2026-08 and later OneDeck milestones. `AGENTS.md` owns the permanent boundaries; this document owns execution order and lane selection.

## Bootstrap and roles

Start with exactly one milestone ID, base SHA, brief path, goal, constraints, and done-when. Read `AGENTS.md`, the active brief, the contract manifest, the matching ledger entry when one exists, and this workflow. Stop on integrity error, a missing/conflicting authority, or a value decision that is not determined by the pinned CR and explicit user ruling.

The judge owns contracts, manifest, acceptance registry, review evidence, ledger, and release decision. An implementer may change only its assigned source and ordinary tests. A cold auditor receives only the frozen audit brief, edits nothing, and returns findings.

## Contract and migration rules

Active contracts state current meaning only. History, implementation evidence, audit records, volatile state, and work notes belong in the ledger, decisions, or archive. Every active contract has one authority in `docs/contracts/manifest.json`; every scenario has a globally unique ID and a traceable test or manual lane.

A document migration preserves the original before replacing a pointer. The migration map gives every former heading exactly one destination and one classification. Unresolved meaning conflicts remain outside active-green scenarios until explicit adjudication and current executable evidence agree.

## Risk lanes

- R0: spelling, links, indexes, or archive movement. Run docs lint and self-review.
- R1: non-semantic script/refactor or fixture organization. Run the affected check and peer review.
- R2: UI behavior, store wiring, or ordinary engine behavior. Run the domain lane and an independent audit.
- R3: CR semantics, `GameState` schema, public API, protocol, or migration meaning. Freeze the contract, run an independent cold audit, then the release lane.

Metadata-only work is not automatically R3. A meaning change is R3 even when only documents changed.

## Affected, domain, and release lanes

`npm run check:docs` validates manifest shape, unique authority, links, scenario IDs, supersedes, verifiedBy paths, volatile vocabulary, generated API, and migration completeness.

`npm run check:fast` runs docs validation, affected lint, incremental typecheck, and the selected offline affected tests. It never runs a production build, network lane, or manual browser check.

`npm run check:domain -- <domain>` runs one named domain. Unknown or cross-domain changes fall back to a wider domain rather than being ignored.

`npm run check` is the release gate: static verifiers, docs validation, lint, both Vitest projects, and exactly one production build. Pages passes the base path to that build and uploads its `dist` output; it does not build again. The forbidden-file guard receives an explicit diff base in CI.

## Freeze, audit, and correction

Iterate with targeted checks. Freeze the candidate tree and record its fingerprint before audit. Governance reset uses the `BROAD` audit profile because it spans documents, checks, CI, and workflow. The audit wait is a maximum budget, not a minimum sleep. A timeout is `implemented-not-audited`, never a green verdict.

The clean semantic verdict is `AUDIT-OK-PENDING-FULL-CHECK`. Close findings, re-run invalidated evidence, freeze the release tree again, and require the same fingerprint as the audited tree. Run the full check once. If that full check itself fails, make only the smallest correction, re-run invalidated evidence and affected audit claims, and run one final full check; never exceed two full-check invocations.

No push, merge, release, Pages publication, product behavior change, rules-semantic change, test weakening, or dependency change is part of this reset.
