# O4P-06F production corrections cold-audit record

Date: 2026-08-21
Milestone: `O4P-06F`
Base HEAD: `6a12b8e0f139547a2d1f336c2f612ec0db20aed3`
Cold auditor: `/root/o4p06f_luna_production_corrections_auditor`
(Luna xhigh, context-free, findings-only)
Audited fingerprint:
`a9637c2a7e3777ae3280d69fcdb5b93f68af27354d829895e22ca057667a7447`

## Production findings and corrections

The production four-real-deck scenario first exposed two release defects. The
evidence harness mixed the React entry activation with control inspection and
did not tolerate the bounded backlog of canonical revision notices. The
Durable Object also repeated checkpoint-suffix replay on same-version ordinary
loads until the four-real-deck state crossed the production CPU ceiling before
revision 5.

The frozen correction separates and bounds the browser steps, sends exact
`decisionContext: null`, accepts only exact same-room/schema nonnegative
nonfuture revision notices, drains at most 64 queued notices, and fails closed
on a remaining backlog. No diagnostic payload, identifier, capability, or raw
frame was added to errors.

Cloudflare persistence now maintains one closed recovery-verification marker.
Initialization and accepted commits atomically bind the canonical Worker
version, room, verified revision, checkpoint revision, journal count, and the
lowercase SHA-256 digest of the exact bounded checkpoint string. A same-version
hit still validates the stored state and journal but skips only suffix replay
and emits no recovery fact. A distinct canonical version performs the full
existing replay once across migration and load, compare-and-set replaces the
marker after success, and emits one real recovery-verification fact. Failed
transactions, stale migration handoffs, presence-only writes, malformed rows,
and mismatched checkpoint bytes cannot advance or hit the marker.

The final Judge surgery closed the last cold-audit gap: a semantically valid,
same-room/same-revision but byte-different checkpoint had previously passed the
relation-only cache marker. The marker now compares the exact raw checkpoint
SHA-256 before deserialization. The pure hash helper is imported through the
public Core barrel and an exact, non-vacuous architecture allowance limited to
`src/online/cloudflare/persistence.ts` and `coreSha256HexV1`.

## Final evidence

- staged-only candidate with no unstaged changes and clean diff checks;
- exact fingerprint and current O4P-06F context/loop-state matched;
- targeted seven Vitest files: 59/59 tests passed;
- full `npx tsc -b`, affected ESLint, docs, and generated API checks passed;
- O4P-03A runtime-persistence and O4P-03B WebSocket recovery verifiers passed;
- same-room/revision byte-different valid checkpoint independently rejected,
  full replay failed closed, and no success fact was emitted;
- marker digest shape, previous-digest CAS, transaction rollback, canonical
  revision-notice validation, 64-frame bound, plain browser JavaScript, and all
  three null decision contexts were independently reproduced;
- the only remaining expected stops are the historical O4P-03D source regex
  and O4P-06F changed-source list; both are Judge-owned gate reauthorization,
  not product findings;
- the auditor did not run full `npm run check`, Chrome, network, deployment,
  git mutation, or publication.

Final findings: `BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0`.

Verdict: `AUDIT-OK-PENDING-HISTORICAL-GATE-REPAIR`.
