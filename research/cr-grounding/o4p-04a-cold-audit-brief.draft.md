# O4P-04A cold audit brief

Milestone: `O4P-04A`

Audit class: STANDARD R2 private-information UI boundary

Read only:

- `research/cr-grounding/o4p-04a-personal-workbench.contract.draft.md`
- `research/cr-grounding/o4p-04a-acceptance-brief.draft.md`
- the frozen candidate diff from base recorded in `.claude/loop-state.md`

Do not read implementation rationale or prior agent messages. Do not edit any
file and do not run the release full `npm run check`.

## Falsify

1. unvalidated/partially validated projection consumption and role/seat drift;
2. hidden/concealed card identity, definition, face, owner/controller, ID,
   accessible-text, DOM-attribute, error, or retained-prior-state leakage;
3. input mutation, alias retention, missing deep freeze, sorting/defaulting,
   nondeterminism, and hostile descriptor/getter/prototype handling;
4. intents carrying session/Room/participant/capability/command/decision data,
   double submit, no concede confirmation, false legality/success claims, and
   stale/pending interaction errors;
5. Store/Solo/Core reducer/Room/protocol/headless/Cloudflare/network/storage
   imports, reverse dependencies, existing-file edits, or production fixture
   coupling;
6. inaccessible/pointer-only controls, missing Japanese labels/test IDs, CSS
   overflow/overlay failures, and divergence across the three viewports;
7. vacuous review assertions or browser evidence, console errors, and any
   behavior claimed beyond O4P-04A's explicit DEFER.

## Return format

- observed semantic and context fingerprints;
- findings sorted BLOCKER, HIGH, MEDIUM, LOW;
- stable ID, exact path/symbol, violated clause, reproduction, impact, and
  smallest safe correction;
- explicit severity totals and commands/outcomes;
- `AUDIT-CLEAR` only when BLOCKER/HIGH are zero; otherwise
  `AUDIT-FIX-REQUIRED`.

Timeout or incomplete inspection is no verdict.
