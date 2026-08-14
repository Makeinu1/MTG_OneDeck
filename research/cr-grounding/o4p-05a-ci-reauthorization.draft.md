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
| `src/test/architecture/review.o4p-04b-table-display-boundary.test.ts` | `c92b0b2fb066cca3e3a2ec888b12361d3bc98802f7d5129efdaf046e367d89e5` |
| `src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts` | `cebf6dfcfc971921c0839ba6e1556fa119633e53db12242c980bdb8c629151c9` |
| `src/test/architecture/review.o4p-04d-guided-actions-boundary.test.ts` | `3c74e538c1dc9cc657e41c4b42ff68a5b77a6a72fd01e440613d96c48b1ff0b9` |
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

The first reauthorization run, `31826746573` at
`3145950cd45d7bfa4a1de1690973bb0ab7edd4d1`, correctly failed only because
the two reauthorization evidence paths above had not yet been registered in
the three predecessor O4P-04B/C/D base-relative candidate allowlists. The
Judge added exactly those two basenames to the existing O4P-05A anchored
alternation in each review test. Targeted verification passed 3 files / 13
tests plus ESLint. The three current hashes above replace their pre-repair
hashes; the contract and O4P-05A review bytes remain unchanged.

The exact-head repaired run, `31844771445` at
`45fb786441c29cd79358fc0466d35eb1ecf0394a`, passed the complete
`npm run check -- --build-base=/MTG_OneDeck/`. Its governance scan then
reported only the three repaired O4P-04B/C/D review paths as hard forbidden;
the authority/audit evidence paths were `NEEDS-REAUTH` information only.
Pages was skipped. A final independent identity/hash check is required before
this authority-only update is committed.
