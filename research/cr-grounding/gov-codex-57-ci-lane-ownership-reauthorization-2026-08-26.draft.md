# GOV-CODEX-57 CI lane and ownership reauthorization

Date: 2026-08-26
Semantic candidate: `d6d57a68af77b0551671f4894ae4886131022afe`
Initial Actions run: `32886044234` / build job `97926634141`
Independent auditor: `/root/gov57_cold_audit`

## Initial exact-head result

The push event resolved the correct diff base
`027aed8b152421f0aa101c81eefcf766fbfc803b` and stopped at the expected
Judge-ownership scan. The scan classified exactly 11 `NEEDS-REAUTH` paths and
16 `FORBIDDEN` Judge paths. Pages configuration, artifact upload, and deploy
were skipped.

The run also exposed a separate release-lane defect before the ownership stop:
the lane step redirected ordinary `npm run` output to a JSON file. The npm
banner made `jq` fail with `Invalid numeric literal`; the failure occurred
inside command substitution, so the outer `echo` succeeded with an empty lane.
Both semantic full check and terminal verification were therefore skipped.
This is not an acceptable ownership-only stop and must be repaired before the
replacement push.

## Frozen semantic ownership bytes

| Class | Path | SHA-256 at `d6d57a68` |
| --- | --- | --- |
| NEEDS-REAUTH | `docs/judge-protocol.md` | `cab10340988e15ec38d1b33f7b746fc4ebc2684677f3bc16ce2416d3a7cafedb` |
| NEEDS-REAUTH | `package.json` | `c953459950fbf0b10faceef4268ebb9cddfe27f43cc889ec02f40361bcd8ebad` |
| NEEDS-REAUTH | `research/cr-grounding/cr-backbone-ledger.json` | `c03e16f96fa1f5772130666a336f2754a109e84f88d504981567841ed8c14457` |
| NEEDS-REAUTH | `research/cr-grounding/gov-codex-57-autonomy-player-journey-acceptance.draft.md` | `4a0b9e2425afdd109e4f71f459bdca5bed0eed78d689b660f4c9a435e752b8aa` |
| NEEDS-REAUTH | `research/cr-grounding/gov-codex-57-autonomy-player-journey-cold-audit-brief.draft.md` | `1309e2395139652a35d251aad00f3596c5b0afe1b31b58cc95da85b121e265ae` |
| NEEDS-REAUTH | `research/cr-grounding/gov-codex-57-autonomy-player-journey-implementation-brief.draft.md` | `db790b60293f12662eb1a1801f963a60ac770c7db2de84b0601207e6dae12da6` |
| NEEDS-REAUTH | `research/cr-grounding/gov-codex-57-autonomy-player-journey.contract.draft.md` | `f97b7349ff35873fd63b80d68b824bfb94ff267ad10390cb2ee2ce503601a1ad` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-09-roadmap-ledger-update.draft.json` | `a2964422c88b1d72f8c6d29aa10a950315648b4d97b851ef12a80ecac6ee1aca` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-09-roadmap-registration-acceptance.draft.md` | `187de0c32de2a252a159d70dfd04e269238a8b5901ae4cc5bd11307001374b99` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-09-shared-table-playable-roadmap.contract.draft.md` | `773af2306d49bf8f8d34f86fb58adcbd04a65253b29c0d6c8d0ad7d8a09fee61` |
| NEEDS-REAUTH | `research/cr-grounding/planned-sequence-batch-o4p-09.draft.md` | `973d54ef63d9ed1eac918bcbc667efb837b478a4a95291179c285b54be5d3b40` |
| FORBIDDEN | `AGENTS.md` | `d158dace2aa45e8b0725c2007b62c6132a94f01070b600fac42886b7e3f98181` |
| FORBIDDEN | `scripts/__tests__/review.codex-ops.test.mjs` | `3a983557143281c2df7634dbf2b93abf1e280f3e675f76762a7825f5470ae66a` |
| FORBIDDEN | `src/test/architecture/review.gov-codex-56-program-orchestration.test.ts` | `d9a7ebf462bbd7561d64dcbb14ec0403c75a16ad7b5a7162588844771315e815` |
| FORBIDDEN | `src/test/architecture/review.gov-codex-56r2-request-normalization.test.ts` | `bd237ac0be69082296cfbcdf7d0d6bdf488cd529907bbf29296c6571a85633b6` |
| FORBIDDEN | `src/test/architecture/review.gov-codex-57-autonomy-player-journey.test.ts` | `ee9628519e85cacf552b9e7d08a3a381f3ae315fa29cf6813b2fc2c78ed57c4a` |
| FORBIDDEN | `src/test/architecture/review.o4p-04b-table-display-boundary.test.ts` | `0362010c4e785a508ca73da6d9c4bf5ae6cc7aa64af2c0905196b9a7202e4b47` |
| FORBIDDEN | `src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts` | `f9469689c18e6580873efa56106e04455bf73fb95a339afef259fb39586698c2` |
| FORBIDDEN | `src/test/architecture/review.o4p-04d-guided-actions-boundary.test.ts` | `013bf2bd88b094f2c7a437ae908ab99fda636636e4b95e46487111720484f484` |
| FORBIDDEN | `src/test/architecture/review.o4p-05d-production-release-closure.test.ts` | `d8ecf72193ce55ae28e70af7d6de3ddfd5d50ceada757778f7284d2088ccde39` |
| FORBIDDEN | `src/test/architecture/review.o4p-06-roadmap-registration.test.ts` | `15b222ce9f67de83db34696db501a6f84eff2269b15d375b3b2fa01f5a75508a` |
| FORBIDDEN | `src/test/architecture/review.o4p-06f-four-browser-production-release.test.ts` | `da0a9ed2e0536b258cb801197525ecc049304c5ca174c6edb078ac9fa2f967ea` |
| FORBIDDEN | `src/test/architecture/review.o4p-07-roadmap-registration.test.ts` | `5271fac0e86c3828a18cb176fdd9a00d61a6ad9e30be8a5a8021009b89c93f51` |
| FORBIDDEN | `src/test/architecture/review.o4p-08-roadmap-registration.test.ts` | `41c5c08c5c25231044c5cd422dd7a92c26838c8c26179d91d93a76e679e9bf61` |
| FORBIDDEN | `src/test/architecture/review.o4p-08c-variable-roster-boundary.test.ts` | `d96f5f70b89efe867154d2e68022a32e183a5cb3096df9a845f7186dbd6cec26` |
| FORBIDDEN | `src/test/architecture/review.o4p-09-roadmap-registration.test.ts` | `d3fa1a0558151a9569bb84cbdfd7f2a946146cf69c1783edce3d70050c5df8b7` |
| FORBIDDEN | `src/test/architecture/review.o4p-09c-pregame-lifecycle.test.ts` | `f4b79b5f6874f0cce770015372827b65da86c4527d4162377c889be1c1a93f9f` |

## Bounded release-lane repair

| Path | SHA-256 |
| --- | --- |
| `.github/workflows/deploy-pages.yml` | `c2c3d75d5816547db13a835ba9c9ffec921ab5620caf5192daacbeff579ecb19` |
| `scripts/checks/verify-o4p-05d-production-release-closure.ts` | `e7e48c22544d54d04c6bd760a663b14c3b2c58a9970dc1fc0f1ccb7a5858e351` |
| `scripts/checks/release-preflight.mjs` | `1b968d5ad9e632cd826e3b42aa95f4ce60cd3090d1f83b4b39a73d029be01d1f` |
| `src/test/architecture/deployPagesGates.test.ts` | `adc633958d378545657f51c6bb68b77337f9ec5ac5307633b4c55bcddc08356a` |

The repair replaces only the JSON-producing invocation with direct `node`,
retains the npm script for ordinary use, teaches preflight to recognize that
exact direct-node form, freezes the new workflow byte in the historical release
verifier, and adds a regression assertion that the redirected command cannot
use the noisy npm wrapper. The lane value is validated as exactly `semantic`
or `terminal` with `jq -e`; malformed, empty, or unknown output fails the lane
step before any conditional verification can be skipped. It does not change
product, contract, ledger meaning, dependencies, or the original audited
semantic bytes.

The replacement push must diff from `d6d57a68` and contain only these four
repair paths plus this record and its adjacent cold-audit brief. Its ownership
scan must therefore contain only the two informational research paths and zero
`FORBIDDEN` paths. The replacement Actions run must execute the semantic full
check, upload/deploy Pages, and finish success before terminal promotion.
