# GOV-CODEX-57 acceptance

1. `activeProgram` projects explicit authority, complete autonomy, journey
   policy, and usage policy without granting any false authority bit.
2. O4P-09 active order is A, B, C, C-UI, D, E, F, G, H, I, J; C-UI is the
   first pending selection and D depends on it in both ledger collections.
3. O4P-09A/B/C remain shipped substrate and carry honest historical usage
   records; C is not described as a production UI outcome.
4. C-UI and D-J are `player-outcome` entries with non-empty production journey
   evidence and exact outcome descriptions. The historical three-substrate debt
   is the only grandfathered exception.
5. `codex:context` returns `nextTechnicalSlice` and `nextPlayerOutcome` and fails
   malformed authority/autonomy/journey/usage policy closed.
6. `check:release-preflight` catches the three O4P-09 regressions: fixed next-ID
   Judge guards, forbidden/diff-base mismatch, and stale generated API.
7. `check:terminal-metadata` rejects product, contract, generated, workflow, and
   review changes; it accepts only meaning-preserving synchronized terminal
   fields and emits separate semantic/terminal fingerprints.
8. CI selects semantic or terminal lane from the verifier. Terminal-only CI
   does not run full check, build, artifact upload, or Pages deploy.
9. Request normalization and operative governance state that authorized program
   transitions and bounded repairs do not re-prompt, while missing external
   authority remains false.
10. New terminal entries without complete structured usage fail closed; only
    pre-policy shipped entries may say `historical-unavailable`.
11. Targeted tests, `check:docs`, `git diff --check`, cold audit, and one local
    `npm run check` pass on the same frozen candidate fingerprint.

## Release evidence addendum

- Semantic commit: `d6d57a68af77b0551671f4894ae4886131022afe`.
- Independent semantic audit: `/root/gov57_cold_audit`, findings
  `BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0`, fingerprint
  `8b721872752b778d1aae93008af1a241aa4bf655f48bf3d7ffb881074c6db174`.
- Local full check: Core 228 files / 2,097 tests and DOM 366 files / 2,462
  tests, lint, build, and all verifiers passed in 509,061 ms.
- Initial Actions run `32886044234`, build job `97926634141`, resolved the
  exact base `027aed8b152421f0aa101c81eefcf766fbfc803b`, classified 11
  `NEEDS-REAUTH` and 16 `FORBIDDEN` semantic paths, and correctly stopped
  before Pages. It also exposed an invalid empty lane caused by redirecting the
  `npm run` banner into the classifier JSON.
- The exact semantic ownership path/hash table and first repair record remain
  immutable in commit `dc0bf5c7e6cfb4688f8ba1da6dbdd01d4a43d5c6` at
  `research/cr-grounding/gov-codex-57-ci-lane-ownership-reauthorization-2026-08-26.draft.md`.
- Replacement commit `dc0bf5c7e6cfb4688f8ba1da6dbdd01d4a43d5c6` replaced the JSON-producing
  command with direct `node`, validated the lane as exactly `semantic` or
  `terminal` with `jq -e`, updated preflight and frozen release bytes, and was
  independently audited by `/root/gov57_cold_audit` at fingerprint
  `0949bbe728d30b5c41135d1210272c0a29f0238e5ae72f85723c5f5f0d6d938f`
  with findings `0/0/0/0`.
- Replacement Actions run `32887781212`, build job `97932186357`, proved the
  corrected classifier selected the semantic lane and executed the full check.
  That full check passed every verifier, lint, all 228 Core files / 2,097 tests,
  and 365 of 366 DOM files before one historical candidate-path assertion
  rejected the temporary standalone release record. Pages was therefore not
  deployed.
- The final bounded repair keeps the candidate-path assertion unchanged. It
  consolidates this release evidence and the adjacent audit instructions into
  the already-authorized GOV-CODEX-57 acceptance/audit paths, then removes only
  the two temporary standalone records. Their exact bytes remain recoverable
  from `dc0bf5c7`; no product, contract meaning, workflow, generated, or review
  byte changes in this repair.
