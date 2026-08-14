# O4P-04B CI Judge reauthorization

Milestone: `O4P-04B`

Published candidate HEAD: `310c7e437177b66c5916039e326836471806f4e1`

GitHub Actions run: `31787116951`

The exact-head candidate run passed
`npm run check -- --build-base=/MTG_OneDeck/`, including every verifier, docs,
lint, Core, DOM, TypeScript, and Vite build gate.

The run then stopped only at the governance ownership scanner. All
`NEEDS-REAUTH` paths are Judge-owned contract, ledger, audit, brief, or design
fixture evidence. The five hard `FORBIDDEN` paths are Judge-authored or
Judge-surgically-updated review evidence, not implementer writes:

| Path | SHA-256 |
| --- | --- |
| `src/components/online/__tests__/review.o4p-04b-table-display.test.tsx` | `e63f25234de2d227c96a6f0017e1b1a505e8accd719aa97ec0d1001ee257b968` |
| `src/test/architecture/review.o4p-01h-core-boundary.test.ts` | `156db398d38eef2b652259eae0982e9abfe4bcc8ca91e91bfdcd10ae66a667a2` |
| `src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts` | `9cd2a6f87730870d663f2b3681f8b2c1d2db47a49a4377dcdf829f10fa94563b` |
| `src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts` | `2f1bab647713193804447d3a3ad2e533a8165b7c066974b790caeedf9af49f67` |
| `src/test/architecture/review.o4p-04b-table-display-boundary.test.ts` | `e6a7da475279cfc9be8f68b1c1b20319db9e1e030d879c89146c2ef2e2b1a78a` |

The same independent auditor must verify these paths and hashes, that no other
hard forbidden path exists, and that the candidate run's full check passed.
After confirmation, the Judge may commit only this authority evidence and the
audit record. The next Actions diff must use the published candidate as its
base; no review, product, test, contract, ledger, or workflow byte may change in
the reownership commit.
