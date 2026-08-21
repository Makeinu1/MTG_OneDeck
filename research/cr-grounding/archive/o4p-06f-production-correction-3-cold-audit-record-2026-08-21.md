# O4P-06F production correction 3 cold-audit record

Date: 2026-08-21
Milestone: `O4P-06F`
Base HEAD: `57caa976987b499f222d0489ef1be890d3219e70`
Auditor: `/root/o4p06f_luna_correction3_cold_auditor`
Authority: `research/cr-grounding/o4p-06f-production-correction-3.draft.md`

## Production finding and scope

The exact-head CI/Pages candidate and first fixed-Wrangler Worker deployment
passed, but the first secret-isolated four-browser run stopped before its
deployment barrier at the P2 reconnect proof. Chrome cleanup completed and no
Room identifier, capability, credential, account data, or raw frame was
retained in this record.

The authorized correction changed only the O4P-06F evidence harness and its
ordinary non-review test. It added a bounded read-only revision-4 projection
observation from surviving P1 before the fresh P2 connection. Worker, protocol,
browser product, Core, UI, package/dependency/lock, Wrangler, workflow,
docs/generated, manifest, ledger, version, and frozen review bytes did not
change.

## Cold-audit history

The initial frozen candidate fingerprint was
`f367e48d47587238d8701946bcea2a7bcb5da1ee04d0b436f7e402173c33f145`.
The auditor returned `BLOCKER 1 / HIGH 0 / MEDIUM 0 / LOW 0`: the observer
request mixed target P2 identity with P1 capability and would be rejected by
the runtime attachment identity gate.

Round 1 separated observer P1 identity/capability from target P2 identity,
required the target to be the exact Player at seat 1, and rejected malformed
timeout values. Re-audit also identified that raw observer send awaiting could
escape the injected deadline and that the existing `reason=rejoined` assertion
was unreachable: accepted hello reconnects P2 before the subsequent stale
projection request. The intermediate candidate was not approved.

Round 2 timeout-wrapped the observer send. The Judge then made two bounded
authority-aligned surgeries: recompute the remaining outer deadline after a
delayed send, and require the canonical later projection result
`reason=snapshot-required` at revision 4. Disconnect is independently proven
before hello; the governing contract requires a fresh socket, stale resync,
and exactly one current snapshot, not repetition of hello's internal reconnect
transition.

## Final frozen evidence

Final candidate fingerprint:
`d4c34e164977edd95b13b0ee7894d16e7e566dbf749cb642978c1e53f010c805`.

- exact staged boundary: authority draft, evidence harness, ordinary test;
- no unstaged changes at freeze;
- observer uses exact P1 identity and capability; target is exact P2 Player at
  seat 1;
- presence rows are closed, descriptor/proxy safe, unique, complete, and reject
  missing, duplicate, malformed, wrong-role, or wrong-seat values;
- observation is read-only at revision 4, permits only canonical nonfuture
  revision notices, and rejects unexpected or secret-bearing frames;
- maximum eight attempts, timeout range 1 through 60000 milliseconds, and one
  cumulative injected deadline across queue, send, and snapshot receive;
- fresh P2 socket, accepted hello, stale known revision 2,
  `snapshot-required`, revision 4, one current snapshot, and zero unsolicited
  queued frames remain required;
- ordinary plus Judge and predecessor review lanes: 43 tests passed;
- scripts TypeScript, affected ESLint, docs, diff checks, and predecessor
  verifiers passed;
- ownership scan reported only the expected Judge authority reauthorization.

No local full `npm run check`, production browser retry, second deployment,
tail collection, shipment, ledger promotion, or git publication was performed
by the auditor.

## Findings and verdict

Final findings: `BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0`.

Verdict: `AUDIT-OK-PENDING-EXACT-HEAD-CI`.

This authorizes exact-head CI and a new bounded production-evidence run only;
it is not production evidence or shipment approval.
