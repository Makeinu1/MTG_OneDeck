# O4P-06F production corrections cold-audit brief

Date: 2026-08-21
Milestone: `O4P-06F`
Base HEAD: `6a12b8e0f139547a2d1f336c2f612ec0db20aed3`

You are a context-free cold auditor. Read only this brief first, then fully read
`AGENTS.md`, the governed development skill/document-governance,
`docs/judge-protocol.md`, the O4P-06F contract/acceptance, the prior O4P-06F
product/recovery audit records, and both correction authorities:

- `research/cr-grounding/o4p-06f-production-correction-1.draft.md`;
- `research/cr-grounding/o4p-06f-production-correction-2.draft.md`.

Audit findings only. Do not edit files, mutate git, run full `npm run check`,
use Chrome/network/Cloudflare/GitHub, deploy, publish, or expose credentials,
Room identifiers, raw frames, request bodies, account data, or secrets.

## Exact candidate boundary

The staged candidate relative to Base HEAD is limited to:

- `scripts/online/o4p-06f-four-browser-evidence.ts`;
- `src/online/browser/__tests__/fourBrowserProductionEvidenceV1.test.ts`;
- `src/online/cloudflare/persistence.ts`;
- `src/online/cloudflare/__tests__/persistenceV1.test.ts`;
- `src/online/cloudflare/__tests__/securitySqlFixture.ts`;
- `src/test/architecture/modeNeutralCoreBoundary.test.ts`;
- the two correction authority drafts above;
- this cold-audit brief.

No runtime/Worker/protocol/Core implementation/UI/public-client/route/credential format,
dependency, package/lock/workflow, Wrangler, version, docs/generated, manifest,
ledger, or historical `review.*` byte may change.

## Required hostile audit

1. Reproduce the original harness failures source-faithfully: React Online
   activation and seven-control inspection are separated and bounded; every
   browser-evaluated string is valid plain JavaScript; all three projection
   requests include exact `decisionContext: null`.
2. Revision-notice handling drains at most 64 already-queued canonical
   non-negative notices no newer than the current revision before a command,
   tolerates only non-future canonical notices while awaiting ACK/snapshot,
   and still rejects future/negative/noninteger/unknown/oversized/storm frames.
   No debug detail, ID, issue payload, capability, or raw frame reaches errors.
3. The new SQLite marker is exact singleton, bounded, contains only canonical
   Worker version, Room relation, integer revision/checkpoint/journal count, and
   the exact lowercase SHA-256 digest of the serialized checkpoint bytes,
   and cannot carry credentials. Missing, duplicate, malformed, stale-version,
   stale-revision, wrong-room/checkpoint/journal/digest rows never create a cache
   hit. A valid but byte-different checkpoint with the same room and revision
   cannot forge a hit. The one Core SHA-256 import is exact to the public barrel,
   symbol and Cloudflare persistence file through a non-vacuous architecture gate.
4. Same-version initialization and accepted command atomically update marker
   with room/journal/checkpoint. Any failed room/journal/checkpoint/marker CAS
   rolls back all related writes. Presence-only writes cannot advance it.
5. A same-version marker hit still performs existing closed stored-state and
   journal validation, skips only checkpoint replay, emits no fabricated
   `recovery-verification` fact, and survives Durable Object reconstruction.
6. A distinct canonical version performs the complete existing checkpoint
   replay and final comparable-state equality exactly once across
   `migrateApplicationSchema()` followed by `load()`, transactionally replaces
   the marker only after success, and emits exactly one actual recovery fact.
   Revision 5/checkpoint 0 must report replay count 5. Failed replay must not
   update marker or emit success.
7. Migration-time invalid-checkpoint rejection remains real; no dead comment,
   inert branch, regex bait, test weakening, lowered bound, or fake-green is
   accepted. The known historical production-gate verifier may honestly stop
   on its stale exact source regex and is Judge-owned follow-up, not permission
   to alter the candidate.
8. Re-run bounded ordinary Cloudflare/O4P-06F tests, affected O4P-03D and
   architecture reviews, TypeScript, affected ESLint, docs/generator, relevant
   runtime-persistence/WebSocket verifiers, and staged/unstaged diff checks.
   Do not run the full check.

Report exact staged fingerprint, changed scope, hostile probes, and findings as
`BLOCKER n / HIGH n / MEDIUM n / LOW n`. Authorize
`AUDIT-OK-PENDING-HISTORICAL-GATE-REPAIR` only with BLOCKER/HIGH zero and no
unadjudicated semantic gap.
