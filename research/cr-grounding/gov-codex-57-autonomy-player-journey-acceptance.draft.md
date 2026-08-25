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
