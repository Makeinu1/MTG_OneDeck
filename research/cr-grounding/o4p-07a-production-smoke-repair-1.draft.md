# O4P-07A Production Smoke Repair 1

Date: 2026-08-22
Base SHA: `3d2cc04f77cb4db1fd9ed0caa47e26b95d936f32`
Owner: Judge bounded surgery
Risk: R3 / BROAD

## Trigger

The first deployed Worker production smoke submitted one real Scryfall print
identity through the v2 endpoint. Room creation and both lobby projections
succeeded, but the valid submission deterministically completed as
`needs-attention/SCRYFALL_UNAVAILABLE`. O4P-07A therefore remains unshipped and
O4P-07B must not begin.

## Bounded repair

1. A secret-free remote Worker probe proved Scryfall named and collection
   requests both return HTTP 200 with the expected field types. The production
   resolver then reproduced the failure: storing native `fetch` and invoking it
   as `this.fetcher(...)` supplied the resolver instance as receiver. Wrapping
   that same native function in an unbound arrow resolved one definition in the
   same remote environment.
2. Correct only this demonstrated native-fetch receiver defect. Preserve strict
   rejection of malformed non-null optional fields, the server-authoritative
   no-fallback boundary, sequential 75-ID batching, and private issue shape.
3. Add ordinary and Judge-owned adversarial regression coverage for the exact
   live response shape and the adjacent malformed boundary.
4. Re-run the invalidated targeted evidence, freeze a new fingerprint, and
   obtain a fresh Luna/xhigh read-only R3/BROAD audit before any release check.
5. After a fingerprint-matched release check and exact-head CI, redeploy the
   Worker and repeat the real Scryfall production smoke. Shipment remains
   prohibited until the valid card is `accepted` without public/private leaks.

No UI, start/genesis, fixed catalog, dependency, CR authority, or O4P-07B/C
behavior changes in this repair.
