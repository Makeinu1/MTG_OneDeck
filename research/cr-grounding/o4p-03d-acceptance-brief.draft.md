# O4P-03D Judge-owned acceptance brief

Milestone: `O4P-03D`

Base SHA: `9ab8449aa7b7a4ab729f5d9acb752417c686e07b`

Contract:
`research/cr-grounding/o4p-03d-cloudflare-headless-production-gate.contract.draft.md`

## Acceptance ownership

The Sol Judge owns `review.*`, architecture review, the registered verifier,
the frozen fingerprints, external Cloudflare commands, git, CI, Pages, ledger,
and terminal shipment metadata. Luna must not edit those artifacts.

## Required Judge tests

The Judge review suite must independently prove:

1. exact `wrangler.jsonc` production name, workers.dev, declarative SQLite
   export, observability, and version metadata with no account/route/secret or
   legacy migration;
2. empty, pre-O4P-03C, and already-O4P-03C databases reach one application
   schema version and one canonical checkpoint;
3. legacy grant migration is exact and current security state is unchanged;
4. forced failure rolls back tables, rows, tokens, clocks, and version record;
5. recovery replay accepts a valid suffix, advances its checkpoint at revision
   64, and never replays more than 63 rows;
6. missing, duplicate, reordered, malformed, relation-invalid, or state-divergent
   journal/checkpoint data fails closed without writes;
7. structured facts are exact allowlisted JSON and reject/omit all prohibited
   secret, body, identity, network, exception, and environment data;
8. the evidence harness generates capabilities at runtime, has no literal
   bearer fixture, prints only safe summaries, and cannot deploy or mutate
   Cloudflare/GitHub; and
9. O4P-03A/B/C review suites and ordinary runtime/security/hibernation behavior
   remain green.

The architecture review must prove no dependency, CI deploy, UI/Solo/Core,
custom route/domain, account ID, token, destructive PITR, or lower-layer
semantic leakage.

## Targeted gate order

1. Luna ordinary O4P-03D tests and existing Cloudflare ordinary tests.
2. Judge O4P-03A/B/C/D review and architecture files.
3. Registered O4P-03A/B/C/D verifiers and machine-check registration.
4. Scoped ESLint, TypeScript/Vite production build, Wrangler dry run, and
   `git diff --check`.
5. Freeze semantic/context fingerprints and write the cold-audit brief.
6. Fresh context-free Luna cold audit; repair and re-audit until
   BLOCKER/HIGH zero within the standing two-return limit.
7. Metadata-only confirmation, then exactly one fingerprint-matched release
   `npm run check`.
8. Real Cloudflare deploy/evidence; no Cloudflare deploy is allowed earlier.
9. Candidate commit/push, exact-head Actions and Pages, terminal metadata
   commit/push, terminal exact-head Actions/Pages, clean worktree.

## External evidence stop conditions

Stop shipment on any of:

- OAuth not authenticated to the intended account without exposing its ID;
- dry-run or deploy config mismatch;
- unexpected origin or non-200 evidence response;
- any capability/account/token material in source, output, tail, or archive;
- four-player, revision-96, checkpoint-64, replay-32, audience, hibernation,
  deploy-reconnect, or structured-log clause not observed;
- Worker exception or unexpected 4xx/5xx in the bounded evidence window;
- Cloudflare CLI requires CI-originated credentials or a human secret action;
- fingerprint drift before full check or deploy; or
- audit BLOCKER/HIGH nonzero.

## Completion claim

O4P-03D remains `implemented-not-audited` until cold audit, full check,
Cloudflare evidence, commit/push, exact-head CI, GitHub Pages, terminal metadata,
and clean-worktree gates all close. Only then may both ledger entries become
`shipped` and the active O4P-03 program close.
