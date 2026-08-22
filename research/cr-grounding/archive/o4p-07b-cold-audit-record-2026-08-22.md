# O4P-07B Cold Audit Record

Date: 2026-08-22
Risk: R3 / BROAD
Auditor: fresh-context `gpt-5.6-luna` / xhigh
Audit brief: `research/cr-grounding/o4p-07b-cold-audit-brief.draft.md`
Authority:

- `research/cr-grounding/o4p-07b-arbitrary-deck-ui-dynamic-genesis.contract.draft.md`
- `research/cr-grounding/o4p-07b-acceptance-brief.draft.md`

## Audit waves

1. `b92bdf166a005f608452e937b81809e2e5cfce02fc6fad5850d623ffc9fb3cac`
   — BLOCKER 0 / HIGH 5 / MEDIUM 0 / LOW 0; failed.
2. `3bdd57df240bad3ecafc4f9eef4fa5ad8f328803b966daef5779bff67e64c088`
   — BLOCKER 0 / HIGH 2 / MEDIUM 1 / LOW 0; failed.
3. `1e64c6f492cb3ab5b7ab6d39e04ad238991acd3ca5df63fe223af7e8f1c30027`
   — BLOCKER 0 / HIGH 2 / MEDIUM 0 / LOW 0; failed.
4. `5f4730538fccf47738bcb1b4b12566ce0e3bccf68086ff9abb8fecfa38251692`
   — BLOCKER 0 / HIGH 1 / MEDIUM 0 / LOW 0; failed.
5. `e0b93e4062ca03bf07f74430b4fe0a5fe5ac8693018b3b4aea937e06ee39b47c`
   — BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0.

## Closed findings

- import cancel/unmount invalidation and selection safety;
- nested wrong-Room and mutation-result relation checks;
- bounded, closed, bearer-aware saved-deck and owner-label handling;
- ready/start lobby, participant, head, snapshot, and CAS relations;
- table capability collision checks across lobby, snapshots, heads, and history;
- mixed v1/v2 fail-closed behavior with the narrow invalidated-head recovery case;
- dynamic genesis fixed-catalog independence, deterministic copies/definitions,
  replay equality, and bounded size failure;
- real post-start player/table browser surfaces and truthful connection states.

## Final semantic verdict

`AUDIT-OK-PENDING-FULL-CHECK`

The semantic candidate above is approved for the unchanged-fingerprint release
verification sequence. This record itself requires a metadata-only fingerprint
recheck before full check.

## Full-check repair audits

1. Canonical record-bearing candidate
   `0fa743d977a9f60da6cf4f71d1b4199a28b4b3c4c244267d4b4d0b88fbdfd1d9`
   reproduced semantic fingerprint
   `e0b93e4062ca03bf07f74430b4fe0a5fe5ac8693018b3b4aea937e06ee39b47c`;
   BLOCKER/HIGH/MEDIUM/LOW 0/0/0/0.
2. Full-check repair 1 fingerprint
   `2e1e280efda5a58fd1fe315ce6d6973a921ed9566f9702743d4656cc1869efa1`;
   exact `../genesis/index` admission and O4P-03A/B/C/D -> O4P-05C -> O4P-05D
   hash chain; BLOCKER/HIGH/MEDIUM/LOW 0/0/0/0.
3. Full-check repair 2 fingerprint
   `31be8d096c5a034b85ccbe2a78df7c6c9330cce5bea210f74c2c8a312bcbce19`;
   exact genesis module/Core registration, reverse boundaries, immutable O4P-07A
   history, and verifier chain; BLOCKER/HIGH/MEDIUM/LOW 0/0/0/0.

## Final release verification

- The initial sandbox-only `tsx` IPC `EPERM` did not execute the check and is
  classified as environment noise.
- Effective check 1 stopped at historical O4P-03A frozen-hash drift.
- Effective check 2 passed all verifiers, lint, and Core, then detected nine
  historical architecture registrations that repair 2 closed.
- The user-authorized exceptional check ran on the unchanged repair-2 semantic
  fingerprint and passed: Core 227 files / 2093 tests; DOM 336 files / 2263
  tests; all machine verifiers, docs, lint, TypeScript, and Vite build PASS.
- Built assets: `assets/index-CGysoqXi.js` and
  `assets/index-DB7TO263.css`.

Final verdict: `AUDIT-OK-FULL-CHECK-PASS`.

## Candidate exact-head CI

Candidate `02c3bf9b9575774b26bc65bae23b7b15ba603ef1` / Actions
`32588291754` checked out the exact HEAD and passed the full check: Core
227/2,093; DOM 336 files with 2,262 passed + 1 skipped; all verifiers, docs,
lint, TypeScript, and Vite build; total 769,685 ms. CI assets were
`index-m9P-2onj.js` and `index-DB7TO263.css`.

The run then stopped only at nine `NEEDS-REAUTH` research paths and eleven
`FORBIDDEN` Judge-owned review paths. Pages and Worker success are not claimed;
the deploy job was skipped pending ownership reauthorization.

The exact three-file ownership metadata candidate was independently audited by
`/root/o4p07b_luna_cold_auditor` at fingerprint
`315ff8e646b716d94e79c0ba688e442c53143d94c5a1caefb3d2b33d8a83e4a9`.
All twenty hashes and CI facts matched with findings 0/0/0/0;
`O4P-07B-CI-REAUTHORIZATION-APPROVED`.

## Production-acceptance repair audit

The exact-head Pages/Worker production exercise found one release-blocking
Cloudflare SQLite difference after the first four-seat dynamic start succeeded:
a fresh explicit deck submission after readiness remained ready in production.
The candidate was reopened instead of claiming shipment.

The bounded repair consumes and validates the
`UPDATE online_deck_submission_ready_v2 ... RETURNING` cursor synchronously
before Scryfall resolution. It also closes adjacent authenticated failure
boundaries found by adversarial audit: malformed cursor rows roll back; fresh
parse-invalid submissions become immutable `needs-attention` heads;
same-ID/same-content retries are idempotent; same-ID/different-content requests
return `SUBMISSION_CONFLICT` without mutating the accepted deck; and the public
client preserves that accepted projection while showing the owner-local
conflict instead of the generic transport error.

Fresh-context Luna/xhigh auditor `/root/o4p07b_resubmit_cold_audit` recomputed
semantic fingerprint
`91b69b0657e83f88b503d3791e19de91363b08ed1067525b162609d765b8e005`.
It verified malformed non-array and custom-prototype cursor rollback, ready
clearing before external resolution, raw-canonical issue history,
idempotence/conflict separation, capability-fragment rejection, public result
shape closure, and accepted/resolving compatibility. Targeted evidence was
four files / 27 tests plus O4P-07A dynamic-resolution and persistence-v1 19/19,
affected ESLint, TypeScript, and diff-check green.

Findings: BLOCKER/HIGH/MEDIUM/LOW = `0/0/0/0`.

Verdict: `AUDIT-OK-PENDING-EXACT-HEAD-CI`.

## Production-repair full-check hash-chain audit

Exact-head Actions `32605787278` checked out repair commit
`71f63ba07a08c63717f4e239fa1e72cafb05a18b`. It passed every machine verifier
through O4P-03D, then stopped at the O4P-05C frozen SHA for the intentionally
changed `src/online/cloudflare/persistence.ts`. Lint, tests, build, ownership,
and Pages did not run; no green full-check or deployment claim is made for this
attempt.

The Judge-only mechanical repair changes exactly two hash literals: O4P-05C
pins the audited persistence SHA
`2073be8c2731f2ecf283cc4f8273799e125896f03a81eff4ae69791f32d6883c`,
and O4P-05D pins the resulting O4P-05C verifier SHA
`1efda4e5e96dacf2e91dff11fc146ab83e8735e9d38c1f491ed3503b28e379fa`.
The resulting O4P-05D verifier SHA is
`d7038df2efaadddcf932a783541df9a5825a8a1b76502383294165e27188b40c`.

Read-only Luna/xhigh auditor `/root/o4p07b_resubmit_cold_audit` recomputed
repair fingerprint
`c73646f61a3ae094690b2d0aceab4a58a770233b6ecb02007521137476963f33`,
verified the exact two-line chain, unchanged product/review bytes, direct green
O4P-05C/O4P-05D verifiers, affected ESLint, and diff-check. Findings were
BLOCKER/HIGH/MEDIUM/LOW = `0/0/0/0`.

Verdict: `AUDIT-OK-PENDING-FINAL-EXACT-HEAD-CI`.
