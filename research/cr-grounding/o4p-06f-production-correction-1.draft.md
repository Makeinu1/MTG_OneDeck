# O4P-06F production correction 1

Date: 2026-08-21
Milestone: `O4P-06F`
Base HEAD: `6a12b8e0f139547a2d1f336c2f612ec0db20aed3`
Production diagnostic: exact shipped Pages returned HTTP 200 and rendered all
required controls, but the evidence harness exited before its first Worker
request with `public Online controls/document mismatch`.

The harness clicked `[data-testid="open-online-mode"]` and inspected the React
Online subtree in the same JavaScript turn, before the state update committed.
After that timing correction exposed the next stage, the browser-evaluated
asset collector was also found to contain a TypeScript-only
`as HTMLLinkElement` assertion, which Chrome correctly rejected as invalid
JavaScript before the first Worker request. Once the previously deferred
Cloudflare Worker deployment was brought to the audited source version, a
secret-free rejection diagnostic then proved that the harness's three
projection-request call sites omitted the validator-required
`decisionContext: null` field used by the shipped browser client. These are
evidence-harness defects; product UI, Worker, protocol, and credentials were
not involved.

The next secret-free frame-kind diagnostic showed that every command succeeded
but later participant sockets legitimately retained revision notices broadcast
for earlier participants. The harness only tolerated the next exact revision,
so it rejected an older queued notice before reading the matching ACK. This is
the expected multi-socket broadcast order, not a protocol or Worker failure.

Authorized Judge correction is confined to
`scripts/online/o4p-06f-four-browser-evidence.ts`: separate the exact entry
click from control inspection and use one browser-owned, five-second bounded
poll for the existing seven exact controls, and keep browser-evaluated source
valid plain JavaScript by using explicit DOM class narrowing for asset URLs.
Make all three projection requests exact validator-compatible messages by
adding only `decisionContext: null`.
Consume only canonical non-negative revision notices no newer than the bounded
expected revision while waiting for ACK/snapshot frames; continue to reject
future revisions and every other unsolicited frame.
Before each seat command, drain at most 64 already-queued canonical revision
notices no newer than the current revision, so an older participant broadcast
cannot race the following ACK. Reject an invalid count, excess queue, unknown
frame, or future revision.

Cold-audit Judge surgery closes the word “canonical” exactly: a tolerated
notice has only `kind`, `schemaVersion`, `roomId`, and `revision`, with the
frozen kind, schema version 1, the same Room, and a non-negative safe integer no
newer than the expected revision. The drain loop consumes strictly at most 64
frames; a remaining 65th frame fails closed.
Preserve exact Pages URL/origin, CDP timeout, zero fabricated success, safe
missing-control diagnostics, and all cleanup/secret boundaries. Add no
dependency, product/test/review/config/package/lock/workflow/docs/generated/
manifest/ledger change.

Run scripts TypeScript, affected ESLint, O4P-06F ordinary/Judge reviews, docs,
diff checks, and one secret-free production diagnostic that must reach the
operator deployment barrier. Then freeze and obtain context-free Luna xhigh
cold audit before commit/push and exact-head CI. Do not deploy during the
diagnostic and do not expose Room credentials or raw protocol JSON.
