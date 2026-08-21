# O4P-06E full-check repair 1 cold audit brief

- Milestone: `O4P-06E`
- Base/HEAD: `231b5e57aef87f1d66ad5a1a398bf65f5b5e2bbd`
- Repair authority: `research/cr-grounding/o4p-06e-full-check-repair-1.draft.md`
- Prior product and manifest-reanchor audits are in
  `research/cr-grounding/archive/`
- Profile: context-free, findings only

Audit the exact frozen staged repair without edits, git mutations, a full
`npm run check`, network access, or publication. The only repair semantics
permitted are four SHA-256 literal replacements:

- O4P-05C `persistence.ts`: `112db946...` -> `f4f5d383...`;
- O4P-05C `runtime.ts`: `1ce283cc...` -> `b34e45bf...`;
- O4P-05C `worker.ts`: `7eb99a1d...` -> `49f45300...`; and
- O4P-05D's O4P-05C-verifier hash: `74564d78...` -> `745acc0b...`.

Independently recompute the complete O4P-05C frozen map and prove these three
Cloudflare files are the only mismatches against the pre-repair map and the
new values equal current audited bytes. Prove the O4P-05C verifier's SHA-256 is
exactly the new O4P-05D value and every other hash-chain entry remains exact.
Verify no assertion, range, path set, production/test/review, package/config,
workflow, docs/manifest, generated file, ledger, or audit record changed.

Run both O4P-05C/O4P-05D release verifiers, their affected architecture/Judge
reviews, TypeScript, affected ESLint, docs/generator checks, and diff checks.
Prove non-vacuity by showing one old repaired hash would fail against current
bytes. `check:forbidden` may report only the expected Judge metadata/repair
ownership boundary; no implementation/product path is permitted.

Report BLOCKER/HIGH/MEDIUM/LOW. Only return
`AUDIT-OK-PENDING-FINAL-FULL-CHECK` if every count is zero on the exact final
fingerprint.
