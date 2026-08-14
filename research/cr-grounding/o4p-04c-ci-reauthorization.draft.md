# O4P-04C CI Judge reauthorization

Milestone: `O4P-04C`

Published candidate HEAD: `1d8bffc3e39fb5be2b1fa2e0997c45848c3856af`

GitHub Actions run: `31797116892`

The exact-head candidate run passed
`npm run check -- --build-base=/MTG_OneDeck/`, including every verifier, docs,
lint, Core 226 files / 2,086 tests, DOM 296 files / 2,065 tests, TypeScript,
and Vite build. The run then stopped only at the governance ownership scanner;
Pages was therefore skipped.

All `NEEDS-REAUTH` paths are Judge-owned contract, audit, brief, or evidence
records. The six hard `FORBIDDEN` review paths are Judge-authored or
Judge-surgically updated rather than unauthorized implementer writes. The
listed design HTML is separately a Judge-owned `NEEDS-REAUTH` evidence path:

| Path | SHA-256 |
| --- | --- |
| `src/components/online/__tests__/review.o4p-04c-display-pairing.test.tsx` | `a47b0e8d1f2a1873eeb6029f077533aa9ae264002430e4459c0b538048df353d` |
| `src/test/architecture/review.o4p-01h-core-boundary.test.ts` | `88207a989680f9edd38cc0e87ee48769d53bbe92d76e44c71ada71f0adec64d9` |
| `src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts` | `cbf9e61c0b9d8b64d00206364c1bb284c989dd53061519f97584c38764fb8e5b` |
| `src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts` | `baf7964e532fd7c966389fbae6b347c33d75c75597a1f55a2219a1af80aeaa94` |
| `src/test/architecture/review.o4p-04b-table-display-boundary.test.ts` | `50b5e82265d9ecb0b0e622b35133e48a3c7425e787d7ab8b7e7c06932a6e8c88` |
| `src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts` | `c78cc1399d8cd934b44e92b0d93a868b88c5a0ff7ff17f71d1b22512d76b6f05` |
| `research/design/display-pairing/index.html` | `e463258089e957b6fa1fa12a1172587d21b283ac12e982da505c49d0ece1e074` |

The same independent auditor must verify all seven listed paths and hashes, confirm the
candidate run's exact-head full check passed, and confirm no unlisted hard
forbidden path exists. After that confirmation, the Judge may commit only this
authority evidence and the audit-record append. The next Actions diff must use
the published candidate as its base; no review, product, test, contract,
ledger, workflow, package, or design byte may change in the reownership commit.
