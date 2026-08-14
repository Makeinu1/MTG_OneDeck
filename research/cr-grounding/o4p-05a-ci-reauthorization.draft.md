# O4P-05A CI Judge reauthorization

Milestone: `O4P-05A`

Published candidate HEAD: `04587deb7d5ceee136f35b7190554b94394f94f0`

GitHub Actions run: `31825432893`

The exact-head candidate run passed
`npm run check -- --build-base=/MTG_OneDeck/`, including every verifier, docs,
lint, Core 226 files / 2,086 tests, DOM 302 files / 2,090 passed + 1 skipped,
TypeScript, and the Vite build. The run then stopped only at the governance ownership
scanner; Pages was therefore skipped.

All `NEEDS-REAUTH` paths are Judge-owned ledger, contract, brief, or audit
evidence. The five hard `FORBIDDEN` paths below are Judge-authored or
Judge-surgically updated review/contract evidence rather than unauthorized
implementer writes.

| Path | SHA-256 |
| --- | --- |
| `research/cr-grounding/o4p-05a-public-release-ruleset.contract.draft.md` | `18e026aa7d98b6c2f132ec25c5793a1ebb956f12d2c4f7f9a025414faf97966b` |
| `src/test/architecture/review.o4p-04b-table-display-boundary.test.ts` | `65fab13cb09cf1078eaad649268e8b90d14e2a84899b9c80c2f2587d1c4a06e4` |
| `src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts` | `9642cf3966805d0d5bec46d4deb8878e20b2f16257a387abd8aae51d0151e216` |
| `src/test/architecture/review.o4p-04d-guided-actions-boundary.test.ts` | `5b449daecdfd2a82ce5708ececa23b6467cc26640fadf74baca8a86bb6810a40` |
| `src/versioning/review.o4p-05a-public-release-ruleset.test.ts` | `f03727f31a64a3b4555e7707ab2e7b4bae7ff82748045a22c915a8060c8a335f` |

The same independent auditor must verify the candidate run/head identity, the
successful complete check, all five listed hashes, and absence of any unlisted
hard forbidden path. After that confirmation, the Judge may commit only this
authority evidence, its audit brief, the cold-audit-record append, and the two
existing O4P-05A ledger objects promoted in place. Product, review, test,
contract, workflow, package, and script bytes remain frozen. The next Actions
diff must use the published candidate as its base.

Independent reauthorization audit:
`/root/o4p05a_cold_auditor`, `O4P-05A-CI-REAUTHORIZATION-APPROVED`,
BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0.
