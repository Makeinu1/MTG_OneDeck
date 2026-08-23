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
