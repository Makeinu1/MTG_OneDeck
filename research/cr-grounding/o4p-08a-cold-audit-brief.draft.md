# O4P-08A Context-Free Cold Audit Brief

Date: 2026-08-23
Base SHA: `2c338a69f41eb693696db12c086e706423679aa6`
Risk: R3 / BROAD

Read `AGENTS.md`, the development skill/workflow, O4P-08 roadmap, O4P-08A
contract and acceptance, then audit the supplied frozen candidate fingerprint.
Do not read implementer rationale. Do not edit, stage, commit, push, deploy, use
network/secrets, or run full `npm run check`.

Adversarially test shared admission versus unique seat authority, rotation/
close/full/started/duplicate behavior, host-only kick and atomic deck cleanup,
stale resolver non-resurrection, leave/host close, durable recovery retention
and clearing, fragment scrubbing, structured-error closure/status/retryability,
host/non-host secret separation, hostile records/descriptors, restart and
SQLite persistence, v1/v2 compatibility, security limits, and absence of any
two-player/layout claim. Verify exact changed-path ownership and no dependency,
config, Core, docs, ledger, or review drift beyond Judge files.

Run bounded target-domain evidence only. Return findings with
BLOCKER/HIGH/MEDIUM/LOW counts and final fingerprint. Use
`AUDIT-OK-PENDING-FULL-CHECK` only when BLOCKER/HIGH are zero.

## Terminal CI ownership reauthorization supplement

After the audited semantic commit, audit only the appended terminal evidence in
the adjacent archived audit record against local git bytes and the recorded
exact-head workflow facts. Do not edit, stage, commit, push, deploy, access
secrets, or run the full check.

Confirm semantic HEAD `050090564a91f59669357c2e1ea2fee6e03fa3f1`
equals its recorded candidate, its parent/diff base is
`2c338a69f41eb693696db12c086e706423679aa6`, and workflow run `32651781070`
job `97224417215` passed the exact-head full check before stopping only on the
five Judge `review.*` paths. Recompute every candidate SHA-256 in the record and
reject a missing or additional ownership-classified path. Confirm Pages was
skipped and the proposed metadata commit changes only this brief and the
adjacent audit record, with no product, ledger, review, dependency, workflow,
or configuration change. Return counts, the two-file candidate fingerprint,
and an exact approval identifier only when exact.
