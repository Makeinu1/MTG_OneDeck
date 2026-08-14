# O4P-04A CI Judge reauthorization

Milestone: `O4P-04A`

Published candidate HEAD: `b9f85870efe8614ea4547eeb27720c03e843a5ab`

GitHub Actions run: `31778875119`

The candidate run passed `npm run check -- --build-base=/MTG_OneDeck/`: every
verifier, docs, lint, Core 226 files / 2,086 tests, DOM 289 files / 2,031
tests, TypeScript, and Vite build passed. It emitted
`index-CyZgN26K.js` and `index-JeU5vEot.css`.

The run then stopped only at the governance ownership scanner. All
`NEEDS-REAUTH` paths are Judge-owned contract, ledger, audit, brief, or design
fixture evidence. The five hard `FORBIDDEN` paths are Judge-authored or
Judge-surgically-updated review evidence, not implementer writes:

| Path | SHA-256 |
| --- | --- |
| `src/components/online/__tests__/review.o4p-04a-personal-workbench.test.tsx` | `9a68250a4631af6928b71c178b8928a6d9e935d3b27aefb0a9940b1fdbd2de6d` |
| `src/test/architecture/review.o4p-01h-core-boundary.test.ts` | `efaf613ccec0490b4690a5f49812852807e16d26e76e7117eed39b631676157c` |
| `src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts` | `020b3224ac4561f5b30a85c92ce46ab7893de29938a5bb5707b8205001c6dddd` |
| `src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts` | `e478164c6c8d2bb6f53caca77b965c245dd71661381d5d5563bb934948db9cfc` |
| `src/test/architecture/review.o4p-04a-personal-workbench-boundary.test.ts` | `48e461a691d0e0159cff085fb147851b5a3b493524a0781c756ff0a472642721` |

The same independent auditor must verify these paths and hashes, that no other
hard forbidden path exists, and that the candidate run's full check passed.
After confirmation, the Judge may commit only this authority evidence, the
audit record, and the two O4P-04A ledger entries. The next Actions diff must use
the published candidate as its base; no review, product, test, contract, or
workflow byte may change in the reownership commit.
