# GOV-CODEX-57 R3/BROAD cold-audit brief

Audit only the frozen working tree identified by the candidate fingerprint
supplied by the Judge. Edit nothing.

Authority:

- `research/cr-grounding/gov-codex-57-autonomy-player-journey.contract.draft.md`
- `research/cr-grounding/gov-codex-57-autonomy-player-journey-acceptance.draft.md`
- user ruling: complete autonomy inside explicit authority, player journey as
  the progress unit, preserve O4P-09A-C, register C-UI before D

Adversarial claims:

1. No missing authority bit is inferred or smuggled through complete autonomy.
2. Historical usage and journey debt are honest, bounded, and cannot become a
   general grandfathering escape hatch.
3. Context and ledger choose C-UI and expose distinct technical/player outcome.
4. Preflight really catches fixed next-ID guards, diff-base/ownership mismatch,
   generated API drift, unhealthy ledger, and secret-like changed text.
5. Terminal-only classification cannot accept product, contract, workflow,
   generated, or review bytes and fingerprints are reproducible.
6. CI terminal lane cannot build/deploy and semantic lane retains the full
   release gate.
7. Counter exhaustion preserves cumulative cost and quality evidence without
   silently resetting the same candidate.
8. O4P-09C-UI is registration/acceptance only; no player UI is falsely claimed.
9. All changed paths fit this one milestone and no unrelated user work changed.

Return only findings grouped BLOCKER/HIGH/MEDIUM/LOW, exact evidence, and a
verdict. A clean verdict is `AUDIT-OK-PENDING-FULL-CHECK`.

## Exact-head release repair addendum

Audit the final repair from base
`dc0bf5c7e6cfb4688f8ba1da6dbdd01d4a43d5c6` independently and edit nothing.
The candidate fingerprint is supplied separately by the Judge.

Verify all of the following:

1. Actions run `32887781212`, job `97932186357`, selected `semantic`, ran the
   full check, and failed only because the temporary standalone reauthorization
   record was not a frozen O4P-09C `JUDGE_PATHS` member.
2. The net repair changes only this brief and the adjacent acceptance file and
   deletes the two temporary
   `gov-codex-57-ci-lane-ownership-reauthorization*` records. Their substantive
   release evidence is preserved in the acceptance addendum and their exact
   prior bytes remain available at `dc0bf5c7`.
3. No review allowlist, executable source, workflow, generated API, product,
   contract meaning, dependency, or ledger byte changes in this repair.
4. `review.o4p-09c-pregame-lifecycle.test.ts` passes without modification, so
   the frozen O4P-09C scope remains closed rather than being widened for a
   one-off evidence path.
5. `npm run check:forbidden -- --diff dc0bf5c7` reports only research paths as
   informational with zero `FORBIDDEN`, and targeted review tests,
   `check:release-preflight`, context, secret scan, and `git diff --check` pass.

Return `BLOCKER/HIGH/MEDIUM/LOW` counts and either
`AUDIT-OK-PENDING-EXACT-HEAD-CI` or findings. Do not infer shipment from this
audit; replacement exact-head CI and Pages remain mandatory.

## Candidate-tree fingerprint stability addendum

Audit only the bounded diff from
`9ba58f36e14e8f51879e9c742c0237279d8262e9`. The Judge supplies the exact
candidate fingerprint separately. Edit nothing and do not run the full release
check.

Verify that:

1. only `scripts/checks/terminal-metadata.mjs`, its normal regression test, and
   this audit addendum changed;
2. `computeCandidateFingerprints` hashes the files and symlinks present in the
   candidate tree, but does not retain a tombstone for a tracked path absent
   from that tree;
3. terminal change classification still sees and rejects non-terminal
   deletions, and semantic-ledger terminal-field stripping is unchanged;
4. the isolated regression proves the semantic and terminal fingerprints are
   identical immediately before and after committing the same tracked-file
   deletion;
5. focused tests, scoped lint, preflight, context, forbidden scan, secret scan,
   and `git diff --check` are green.

Return `BLOCKER/HIGH/MEDIUM/LOW` and
`AUDIT-OK-PENDING-EXACT-HEAD-CI` or findings. Shipment still requires the
replacement exact-head semantic CI and Pages proof.
