# O4P-07A Acceptance Brief

Date: 2026-08-22
Base SHA: `55fe011700bd6bb10a699e1bd431f0bf12cc40cb`
Authority: `o4p-07a-dynamic-card-resolution.contract.draft.md`

## Executable acceptance

1. Closed parser rejects empty/sparse/hostile/extra-field entries, invalid
   section/quantity/UUID/identifier, oversized canonical input, and performs
   zero resolver/SQLite mutation for each rejection.
2. An injected resolver accepts an ordered non-empty list with zero or multiple
   commanders, arbitrary totals, duplicate entries/quantities, DFC definitions,
   and more than 75 unique print IDs without reordering.
3. Production resolver batches at 75 unique IDs, maps exact print IDs, and
   classifies not-found, returned print-ID mismatch, Oracle-ID mismatch,
   malformed/non-success/network responses as contracted private issues with no
   client-definition fallback.
4. A fresh submission atomically clears legacy deck metadata and ready, sets
   `resolving`, deletes the old snapshot, and increments one seat revision.
   Transaction failure rolls all four facts back.
5. Identical content under the same submission ID is persistent/idempotent;
   different content conflicts. Concurrent duplicates share one resolution.
   Retry after outage uses a fresh submission ID.
6. Completion CAS rejects an older in-flight result after a newer submission.
   Accepted/failed outcomes and stored canonical input survive a new Durable
   Object instance; a persisted resolving submission can resume.
7. Accepted snapshot is complete, ordered, seat-scoped, immutable, digest
   checked, and limited to 262,144 bytes. Two seats may store the same deck and
   digest without sharing a row or capability.
8. Default GET remains exact v1. `?schemaVersion=2` and every v2 result expose
   only safe seat state publicly. Owner issues have code/index/retryable only.
   Other responses, DOM-independent serialized projections, SQL, and logs leak
   no entry, name, ID, definition, issue detail, deck text, or capability.
9. A later v1 submission invalidates the seat's v2 head/snapshot. v1-only room
   creation, four deck submission, ready, and start regression remains green.
10. No public app, fixed catalog/bootstrap, start/genesis, dependencies,
    configuration, ledger selection, or CR authority changes in O4P-07A.

## Verification order

Run implementation-owned unit/integration tests and scoped type/lint first.
The Judge then supplies adversarial `review.o4p-07a*` and architecture checks,
freezes one candidate fingerprint, obtains a fresh Luna/xhigh BROAD audit, and
runs one unchanged-fingerprint `npm run check`. Exact-head CI, Pages asset
smoke, Worker compatibility smoke, ledger shipment, and clean worktree close
the milestone before O4P-07B begins.
