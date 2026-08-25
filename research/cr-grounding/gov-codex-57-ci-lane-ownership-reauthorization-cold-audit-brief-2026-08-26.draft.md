# GOV-CODEX-57 CI lane and ownership reauthorization cold-audit brief

Role: fresh-context findings-only R3/BROAD repair and ownership auditor
Base: `d6d57a68af77b0551671f4894ae4886131022afe`
Record: `research/cr-grounding/gov-codex-57-ci-lane-ownership-reauthorization-2026-08-26.draft.md`

Read the standing audit rules, this brief, the adjacent record, and the actual
candidate diff only. Do not edit files and do not run the release full check.

Verify all of the following:

1. Actions run `32886044234`, job `97926634141`, resolved base `027aed8b`,
   skipped both lane-gated verification steps, failed only at ownership, and
   logged the stated `jq` parse error from the npm banner.
2. Recompute every recorded SHA-256 from semantic commit `d6d57a68`; confirm
   exactly 11 `NEEDS-REAUTH` and 16 `FORBIDDEN` paths under
   `scripts/checks/forbidden-files.mjs`.
3. The live diff from `d6d57a68` contains only the four bounded repair paths,
   this record, and this brief. Recompute the four repair hashes.
4. The workflow uses direct `node scripts/checks/terminal-metadata.mjs` only for
   the redirected JSON classifier; it still executes full `npm run check` and
   Pages upload/deploy for `semantic`, and strict terminal verification for
   `terminal`. Preflight must accept that exact direct-node form while retaining
   executable diff-base ordering. Reject empty/unknown lane fail-open behavior.
5. The new regression assertion would fail on the shipped noisy npm-wrapper
   line, and the O4P-05D frozen workflow hash matches the repaired byte.
6. Targeted workflow/review tests, O4P-05D verifier, preflight, context, secret
   scan, and `git diff --check` are green. `npm run check:forbidden -- --diff
   d6d57a68` must report only the two new research files as informational and no
   `FORBIDDEN` path.

Return `BLOCKER/HIGH/MEDIUM/LOW` counts and either
`AUDIT-OK-PENDING-EXACT-HEAD-CI` or findings. Do not infer shipment from this
audit; replacement exact-head CI and Pages remain mandatory.
