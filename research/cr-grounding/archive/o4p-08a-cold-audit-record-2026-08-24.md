# O4P-08A Cold Audit Record — 2026-08-24

Base SHA: `2c338a69f41eb693696db12c086e706423679aa6`
Audited fingerprint: `4c61ffe2d430a16c81bd6f923bc390bc1e97afaaf0ce244af0be5ba897f2f674`
Auditor: fresh-context Sol/high R3/BROAD cold auditor
Verdict: `AUDIT-FAILED`

Counts: BLOCKER 0 / HIGH 5 / MEDIUM 1 / LOW 0.

## Findings

1. HIGH: the public Worker forwarded `online-forming-lobby-initialize-v3`,
   allowing browser-selected lobby and bearer material to reach the internal
   Durable Object initializer.
2. HIGH: fragment parsing returned the invite when `history.replaceState`
   failed, so a bearer could be exchanged while still present in the URL.
3. HIGH: the public controller had recover/leave but no authoritative v3
   create/claim operation that saved a recovery record.
4. HIGH: `finished` protocol Rooms could recover instead of clearing terminal
   recovery with `ROOM_EXPIRED`.
5. HIGH: recognized v3 forwarding failures could fall back to the generic v1
   error; `RATE_LIMITED` mapped to 400 and several declared blocker codes had
   no server emission path.
6. MEDIUM: authoritative leave rejection did not clear recovery for terminal
   Room or credential-invalidating errors.

The auditor ran the 26 O4P-08A Judge tests, 56 bounded regression tests, diff
hygiene, ownership classification, and candidate fingerprint verification.
No files were edited and no full release check was run by the auditor.

## Disposition

Remediation is required. This record is not shipment evidence. A new candidate
fingerprint and affected-claim cold re-audit are mandatory before the one
release full check.

## Remediation and clean audit

The Judge used bounded surgical remediation after the implementer correction
limit. Affected-claim audits progressed from `HIGH 1 / MEDIUM 2`, to
`HIGH 0 / MEDIUM 1`, and finally to `BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0`.
The clean semantic candidate fingerprint was
`2047804951b54e402827594df6f44cb0fe4456aba5f03bd37b0ff89e19cc631b`.
The cold auditor returned `AUDIT-OK-PENDING-FULL-CHECK` and did not run the
release full check.

The first sandboxed full-check attempt stopped before product checks because
`tsx` IPC socket creation was denied with `EPERM`; candidate bytes did not
change. The authorized retry reached the historical O4P-05C frozen-authority
guard and stopped on the expected hash reauthorization for the four changed
Cloudflare files. Exact current SHA-256 values were pinned in
`verify-o4p-05c-release-gates.ts`, and the resulting verifier SHA-256 was pinned
in `verify-o4p-05d-production-release-closure.ts`. No wildcard or path-scope
authorization was added. These reauthorization bytes require an affected-claim
audit before the final full-check retry.

The affected-claim guard reauthorization audit subsequently returned
`BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0`. The final precommit candidate
fingerprint was
`5ed88238d5d555fd111df533957650a1f67814f31ee404f6e7584f9816e6b9e3`.
The final authorized local full-check retry passed every product verifier,
documentation check, lint, Core test, and build step. Its DOM run passed 2,318
tests and stopped on exactly two stale Judge-owned literal allowlists; after
the bounded two-literal repair, the affected review set passed 10/10. The local
full-check attempt limit was therefore exhausted, so the exact-head workflow
below is the release-check authority for the repaired bytes.

## Exact-head CI ownership evidence

Semantic candidate HEAD: `050090564a91f59669357c2e1ea2fee6e03fa3f1`

Candidate parent and workflow diff base:
`2c338a69f41eb693696db12c086e706423679aa6`

Workflow run: `32651781070`

Build job: `97224417215`

The workflow checked out the exact semantic HEAD and passed the complete
`npm run check -- --build-base=/MTG_OneDeck/` step:

- Core: 227 files / 2,093 tests passed;
- DOM: 342 files / 2,319 passed and 1 skipped (2,320 total);
- all declared verifiers, docs, lint, TypeScript/Vite build, and the O4P-07C
  production-runtime graph verifier passed;
- built assets were `index-DvzndVuh.js` and `index-DB7TO263.css`.

The workflow resolved the exact parent as diff base, then stopped only at the
Judge ownership scan. Pages configuration, artifact upload, and deploy were
skipped. The classifier reported exactly five NEEDS-REAUTH research paths and
five FORBIDDEN Judge-review paths. The other eleven source/test/verifier paths
were unclassified by the ownership scanner.

| Category | Path | Semantic candidate SHA-256 |
| --- | --- | --- |
| NEEDS-REAUTH | `research/cr-grounding/archive/o4p-08a-cold-audit-record-2026-08-24.md` | `be4a74f5d6bcc53f0545e9ee00f8a014e4680a9e71ff25812c827d55869faa6d` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-08a-acceptance-brief.draft.md` | `acbb1289e720e87be6f67dc0b73b5172ff8e46d3082cb05a4ced406dbf948720` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-08a-cold-audit-brief.draft.md` | `1b4cb77fd4553a2d409fe7737714b33de803f9593774f04dd13e4e0d7e2d093e` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-08a-implementation-brief.draft.md` | `b059d5634d03a9fef34e6411a0c394f69f11102944126cec9644e8e287e0716c` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-08a-shared-membership-recovery-errors.contract.draft.md` | `8cbc4e4bf69f49c9773133a50cf4633fe6181b956cb458dcf180e84c7d0c2c07` |
| FORBIDDEN | `src/online/cloudflare/__tests__/review.o4p-08a-membership-runtime.test.ts` | `f1e773b30915438d67485cfd9960f2a37833dd1999ebe005f3614787068b2816` |
| FORBIDDEN | `src/online/lobby/__tests__/review.o4p-08a-shared-membership.test.ts` | `3b7ba34b0526cd49c852b64fb8b0db87e54514bf09d42f76191f8a3e8b8a0566` |
| FORBIDDEN | `src/online/publicApp/review.o4p-08a-recovery-client.test.ts` | `df2b654f77166bb0fedf7d95009eccbc44fa854ab90080caaf07f25dc6f3b207` |
| FORBIDDEN | `src/test/architecture/review.o4p-05d-production-release-closure.test.ts` | `4c2d7c6603676871d06b98db047a0393c3c4ab5a14dc850f247afa8d2c28d1cf` |
| FORBIDDEN | `src/test/architecture/review.o4p-08-roadmap-registration.test.ts` | `649e8f82de355fa57473dd896e2f702aac0533c32e18554872aa3dffe7b93f42` |

The proposed follow-up commit appends only this evidence and its adjacent audit
instructions. It changes no semantic candidate, source, ledger, `review.*`,
dependency, configuration, workflow, or generated byte. Its diff against the
semantic parent therefore contains no FORBIDDEN path. Final exact-head green
CI, Pages publication, Worker deployment and sanitized production acceptance
remain required.

## Terminal ownership reauthorization approval

Fresh-context cold auditor `/root/o4p08a_ci_reauth_audit` independently
recomputed the semantic and two-file fingerprints, all ten classified path
hashes, the exact five/five/eleven ownership partition, and the two-path
metadata-only diff. Findings were
`BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0`.

`O4P-08A-TERMINAL-CI-OWNERSHIP-REAUTH-OK:b2f53116f4fd01e6df65b63d12880810b14b9d97efaa2ff529a490cd45583e46`

This approval authorizes only the parent-only two-file metadata commit and its
replacement exact-head CI/Pages flow. It is not shipment evidence by itself.
