# O4P-09 Roadmap Registration Context-Free Cold Audit Brief

Date: 2026-08-25
Base SHA: `629de59eb244e6c9eeb78c3bdab29cfd15596b48`
Risk: R3 / BROAD

Read `AGENTS.md`, the development skill and document-governance reference,
`docs/judge-protocol.md` section 2, the O4P-09 roadmap contract, registration
acceptance, planned-sequence draft, ledger-update draft, live ledger,
registration cold-audit record, and registration review test. Audit the frozen
candidate without implementation context. Do not edit, stage, commit, push,
deploy, publish, use secrets/network, or run full `npm run check`.

Adversarially verify:

- the user-approved shared-table product intent is preserved without importing
  the rejected takeback-vote proposal;
- A-J are unique, synchronized, ordered, dependency-closed, and `pending`;
- A/B, D/E, and F/H avoid duplicate implementation ownership;
- shipped GameScreen/Core/visibility/combat/reconnect/TableDisplay substrate is
  reused rather than falsely claimed missing;
- hidden information fails closed until E and Spectator Table cannot receive
  audience-limited state;
- Core priority remains authoritative while assisted UI compresses procedure;
- only the steward can Resolve/Advance/UNDO, HOLD remains universal, Host is not
  promoted to game master, and takeback has no vote UI;
- O4P-08 and all earlier ledger history are unchanged;
- `GOV-CODEX-56R2-2026-08` remains audited and unchanged;
- exact historical guards admit O4P-09 without wildcarding arbitrary
  successors;
- the archived audit record exactly and honestly records the initial rejection,
  repair, clean semantic verdict, and no-ship boundary, and every O4P-09 entry
  references the exact record and semantic audit fingerprint;
- registration makes no implementation, release, deployment, or external-write
  claim and product/configuration/dependency/CR bytes are untouched;
- `codex:context` projects O4P-09A as the active-program selection.

Run the bounded O4P-09 registration review, affected historical reviews,
`npm run check:docs`, TypeScript for affected tests, affected ESLint, JSON parse,
`npm run check:forbidden -- --diff 629de59eb244e6c9eeb78c3bdab29cfd15596b48`,
and `git diff --check`. Return findings only with BLOCKER/HIGH/MEDIUM/LOW counts
and the final tree fingerprint. Use `AUDIT-OK-PENDING-FULL-CHECK` only when
BLOCKER/HIGH are zero.

## Judge preflight before cold audit

- HEAD and `origin/main` both equal the declared base SHA.
- The live ledger parses with 144 `domains` entries and 123
  `plannedSequence` entries; the ten O4P-09 entries are the only additions to
  both collections and O4P-09A is the healthy active-program selection.
- The exact seven-file registration review set passes: 7 files / 37 tests.
- Affected ESLint, `npm run check:docs`, JSON parsing, `git diff --check`, and
  the O4P-05D frozen-authority verifier pass.
- `npm run check:fast` conservatively escalated this Judge-owned roadmap change
  to the first full `npm run check`; lint, Core, DOM, build, and terminal
  verifiers all completed with exit 0. This pre-audit run is not final audited
  candidate evidence.
- `check:forbidden` reports only the expected Judge re-ownership set: O4P-09
  research/ledger files as `NEEDS-REAUTH` and exact `review.*` files as
  `FORBIDDEN`; it identifies no product-source, configuration, dependency, or
  unrelated path.
- The canonical candidate fingerprint from
  `node scripts/checks/fingerprint.mjs` is supplied separately at audit
  dispatch. The distinct `codex:context` fingerprint is used only to refresh
  the ignored loop-state checkpoint.

## Terminal CI ownership reauthorization supplement

Role: read-only R3/BROAD terminal ownership reauthorization auditor.

Audit only this supplement, semantic candidate HEAD
`a39609e3e93ce015d9849e515951cc5a122fb706`, its parent/diff base
`629de59eb244e6c9eeb78c3bdab29cfd15596b48`, GitHub Actions run
`32799606198` / build job `97657741793`, and the proposed one-file diff to
this brief. Do not edit, stage, commit, push, deploy, access secrets, or run
the full `npm run check`.

The semantic candidate was frozen before commit at canonical tree fingerprint
`905034ab6ba1cd45622bd744e1ac155e00b8f3764898331205cda3aec062c6e6`.
The exact-head workflow checked out that semantic HEAD and passed the complete
`npm run check -- --build-base=/MTG_OneDeck/` step:

- Core: 227 files / 2,093 tests passed;
- DOM: 358 files / 2,410 passed and 1 skipped (2,411 total);
- all declared verifiers, docs checks, lint, TypeScript/Vite build, and the
  production-runtime graph verifier passed;
- built assets were `index-BGLulJi3.js` and `index-B9TjsUJs.css`;
- machine-check total was 758,987 ms.

The workflow resolved the exact parent as diff base, then stopped only at the
Judge ownership scan. Pages configure, artifact upload, and deploy were
skipped. The executable classifier partitions the fifteen changed paths as
exactly seven `NEEDS-REAUTH`, seven `FORBIDDEN`, and one unclassified verifier:

| Category | Semantic candidate SHA-256 | Path |
| --- | --- | --- |
| NEEDS-REAUTH | `ff852d8e36c9a5ac44bec8403669e7b7e92ff7ea3c0fb0983caa80f3400787b2` | `research/cr-grounding/archive/o4p-09-roadmap-registration-cold-audit-record-2026-08-25.md` |
| NEEDS-REAUTH | `41bd768b70b8033221190a9bf41fadde3adeb4282b8d8d032bb1630dee6b8226` | `research/cr-grounding/cr-backbone-ledger.json` |
| NEEDS-REAUTH | `a8213070231d88c2c68515db12ee45e8bfac5c0214b67a564fb1d4275e64f55a` | `research/cr-grounding/o4p-09-roadmap-ledger-update.draft.json` |
| NEEDS-REAUTH | `1f0ce30cf0d21b03de45f00923f00833a162f16c59e7c82167aaede0a6cd70a1` | `research/cr-grounding/o4p-09-roadmap-registration-acceptance.draft.md` |
| NEEDS-REAUTH | `5161e789ce16166c406c68b40529e39ad661406f86b58221d57012226bf70166` | `research/cr-grounding/o4p-09-roadmap-registration-cold-audit-brief.draft.md` |
| NEEDS-REAUTH | `509ac5d406a8da9dbd0795edb9011574c86ac972f045198c191d70c7e5047899` | `research/cr-grounding/o4p-09-shared-table-playable-roadmap.contract.draft.md` |
| NEEDS-REAUTH | `8a74bcc9c2586db762796396f91dd4f1ddd3191960e45fd1e1cb9d886dc8267e` | `research/cr-grounding/planned-sequence-batch-o4p-09.draft.md` |
| UNCLASSIFIED | `a47cc5220b96b719253f36edbd9d729c4bd2dd32dac9079ba754b4ac509103a7` | `scripts/checks/verify-o4p-05d-production-release-closure.ts` |
| FORBIDDEN | `0f06a0f40d21d2f900a7669a5818f46be51aebe7eaf8c2ed4909c4746c40eaa0` | `src/test/architecture/review.gov-codex-56-program-orchestration.test.ts` |
| FORBIDDEN | `27dae1e0e4ca189bf0d3bbe323ea796354ef933973f0e8f6260ef7c7dc21b3f3` | `src/test/architecture/review.gov-codex-56r2-request-normalization.test.ts` |
| FORBIDDEN | `72ed70e7eddd1651d7e89a6930623e709a02704e45bcd740383ed1322eb39b56` | `src/test/architecture/review.o4p-05d-production-release-closure.test.ts` |
| FORBIDDEN | `cf01521dfa09f9137e48c45f243f2de2d12c39b305abcab397e497cb37221674` | `src/test/architecture/review.o4p-06-roadmap-registration.test.ts` |
| FORBIDDEN | `29b394b2243c73444889198921dea59d1d322472e92726f74f8a5e20eee2141b` | `src/test/architecture/review.o4p-07-roadmap-registration.test.ts` |
| FORBIDDEN | `b56cc4decb734a6e21d383f98d7daae253aaa574828603534c2cb1fe1906e594` | `src/test/architecture/review.o4p-08-roadmap-registration.test.ts` |
| FORBIDDEN | `a1a149406c1b8b335617d90512d9f533c32e66eb71aedf8a96b3355bdd566c39` | `src/test/architecture/review.o4p-09-roadmap-registration.test.ts` |

Recompute every hash and the authoritative classification; GitHub's combined
stdout/stderr ordering is not classification authority. Confirm the proposed
replacement candidate changes only this already-allowlisted brief, so its
parent-only ownership scan contains one `NEEDS-REAUTH` path and zero
`FORBIDDEN` paths. Reject any product, ledger, review, dependency, workflow,
configuration, generated, or second-path change.

Return BLOCKER/HIGH/MEDIUM/LOW counts, the candidate fingerprint, and
`O4P-09-REGISTRATION-TERMINAL-CI-REAUTHORIZATION-APPROVED` only if exact.
Approval is limited to this one-file metadata commit and its replacement
exact-head CI/Pages flow; it is not shipment evidence by itself.

## Terminal CI ownership reauthorization verdict

Auditor: `/root/o4p09_registration_cold_audit` (fresh-context Sol/high,
read-only R3/BROAD)

Audited candidate fingerprint:
`61f6a0d7ae774cad3c4fb5f0d95908acff07071fc826546db459aa703e8d807d`

Findings: `BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0`.

The auditor independently verified the semantic fingerprint, all fifteen
semantic hashes, the exact `7 NEEDS-REAUTH / 7 FORBIDDEN / 1 unclassified`
partition, the one-file replacement boundary, parent-only
`1 NEEDS-REAUTH / 0 FORBIDDEN`, and clean diff hygiene.

`O4P-09-REGISTRATION-TERMINAL-CI-REAUTHORIZATION-APPROVED`
