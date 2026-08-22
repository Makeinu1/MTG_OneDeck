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
