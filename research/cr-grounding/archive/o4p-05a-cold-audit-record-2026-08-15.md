# O4P-05A cold audit record

Date: 2026-08-15

Milestone: `O4P-05A`

Auditor: `/root/o4p05a_cold_auditor` (`gpt-5.6-sol`, independent cold context)

Base SHA: `17965786dba01a15770e19437b9456ca81c0f18b`

Brief: `research/cr-grounding/o4p-05a-cold-audit-brief.draft.md`

Final semantic fingerprint:
`9abc4a64ae63f84df5092c1f59fac42a624dd68a9d8a0a6aed896f29cc2545b3`

Final context fingerprint:
`8a2053765676d25754d07e0be2a7a1e7a8a258ec94f4de466ef8556b1e0c63bd`

## Verdict

`AUDIT-OK-PENDING-FULL-CHECK`

Final severity totals: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0.

The first audit returned BLOCKER 0 / HIGH 2 / MEDIUM 0 / LOW 0. Both findings
were Judge-owned review fake-greens: an incomplete public-export/environment
guard and spoofable raw-text verifier-order checks. The Judge closed them by
pinning the exact public module/barrel surface and source bytes and by executing
the exported machine-check plan structurally. The complete refrozen candidate
was then re-audited at the final fingerprints above.

The first release full check later exposed three predecessor O4P-04B/C/D
base-relative successor-registration failures and no product failure: Core
226/2086 passed; DOM 299/302 files and 2088/2091 tests passed. The Judge added
only the exact declared O4P-05A brief, audit, and versioning paths to those
three allowlists. The repair target passed 4 files / 18 tests and the complete
candidate was re-audited again at the final fingerprints with severity
0/0/0/0. The final second full check remains the release gate.

## Final verified evidence

- versioning target: 3 files / 59 tests PASS;
- Judge review: 1 file / 5 tests PASS;
- `verify:cr`: local `mtg-cr-2026-06-19` exact raw SHA PASS;
- `verify:versions`: all shipped versions remain `1` and metadata sync PASS;
- copied-vector, unfrozen-descriptor, CR-SHA, alias/builder,
  `import.meta.env`, and disabled-verifier probes all turned the relevant
  evidence red;
- no CR body/metadata, existing version vector, verifier, machine-check,
  package/dependency, engine, Store, Solo/Online, Cloudflare, or UI drift;
- no deleted assertion, skip, relaxed expectation, or predecessor-test edit;
- exact successor registration rejects an extra versioning file, an arbitrary
  O4P-05A brief, and a wrong-date audit record in all three predecessor tests;
- forbidden scan reported only Judge-owned ledger/briefs and Judge-owned
  `review.*` paths, pending Judge re-ownership.

This record is findings evidence only. Ship still requires the single
fingerprint-matched release full check, commit/push, exact-head CI, Pages, and
clean-worktree gates.
