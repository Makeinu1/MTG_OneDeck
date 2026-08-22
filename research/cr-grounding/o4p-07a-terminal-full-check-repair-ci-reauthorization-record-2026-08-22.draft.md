# O4P-07A terminal full-check repair CI reauthorization record

Date: 2026-08-22
Candidate HEAD: `4824e01dbcfdf7e5b7618379370b6f740e0dd7ce`
Candidate parent / resolved workflow diff base:
`c2a22caa84ab477f79188c5f6848e6a6c4279460`
GitHub Actions run: `32569165758`
Build job: `97022035581`
Deploy job: `97023352652` (`skipped`)

## Immutable exact-head result

The workflow checked out the exact candidate HEAD. Its full `npm run check --
--build-base=/MTG_OneDeck/` step passed before the ownership stop:

- Core: 227 files / 2,093 tests passed;
- DOM: 330 files / 2,236 passed + 1 skipped = 2,237 tests;
- every verifier, docs check, lint, TypeScript, and Vite build passed;
- machine-check total: 726,085 ms;
- built assets: `index-B8jI0XI3.js` and `index-DNaejTHC.css`;
- diff-base resolution selected the exact candidate parent above.

The next step failed only at `check:forbidden`. Pages configuration, artifact
upload, and deployment were skipped. This record makes no new Pages or Worker
deployment claim.

## Exact ownership stop

The executable classifier separated the candidate from its exact parent into
exactly two `NEEDS-REAUTH` research paths and two `FORBIDDEN` Judge-owned
review paths, with no fifth classified path:

| Category | SHA-256 at candidate HEAD | Path |
| --- | --- | --- |
| NEEDS-REAUTH | `eebdf5cec1ae8c700938e4039108ef2427c6d2693ef4536a5a3d8d7f1f6d9041` | `research/cr-grounding/archive/o4p-07a-completion-packet-2026-08-22.md` |
| NEEDS-REAUTH | `c2003c53ea98ebba2c5ae69f0f34083f3ca556e36502bc45fb6bcfcae1178fcd` | `research/cr-grounding/o4p-07a-terminal-full-check-repair-cold-audit-brief-2026-08-22.draft.md` |
| FORBIDDEN | `f7f2d79331589e12c4683c41eb3b675d338c872e87748019d64603b6c5f5a659` | `src/test/architecture/review.gov-codex-56-program-orchestration.test.ts` |
| FORBIDDEN | `51a0a725f65c8048d0891b7a2e308fdd5c31d835db690c9f3b465569a107f866` | `src/test/architecture/review.o4p-06-roadmap-registration.test.ts` |

## Reauthorization boundary

The prior R3/BROAD repair audit and the exact-head full check remain
applicable. A follow-up commit may contain only this record, its adjacent
reauthorization audit brief, and an append-only CI/reauthorization entry in the
existing completion packet. It may not alter product, review, test, ledger,
policy, workflow, dependency, configuration, generated, CR, catalog, or
acceptance bytes. The follow-up exact-head CI must independently pass before
Pages or transition claims are made.

## Auditor authorization

Independent read-only auditor `/root/o4p07a_luna_cold_auditor`
(`gpt-5.6-luna`, xhigh) verified the exact staged metadata candidate at
canonical fingerprint
`db37ea4b7dd908b6303ffd8d31082a97b95705a08500b3964d5210f0970d57a5`.
The staged diff was exactly the three declared metadata paths; the exact-head
full-check result, ownership classifier, all four candidate hashes, skipped
Pages boundary, and unchanged candidate/review bytes matched. Findings were
`BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0`.

`O4P-07A-TERMINAL-REPAIR-CI-REAUTHORIZATION-APPROVED`

This approval authorizes only the three-file metadata commit/push and its
exact-head CI/Pages closure. It does not authorize product changes or begin
O4P-07B.
