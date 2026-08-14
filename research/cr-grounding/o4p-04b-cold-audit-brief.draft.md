# O4P-04B cold audit brief

Milestone: `O4P-04B`

Base SHA: `36237478838695e4cb1753bafaba0bc1aa4fa8f4`

Audit class / budget: `STANDARD R2 / one bounded 30-minute wait`

Read only:

- `research/cr-grounding/o4p-04b-table-display.contract.draft.md`
- `research/cr-grounding/o4p-04b-acceptance-brief.draft.md`
- the frozen candidate diff from base recorded in `.claude/loop-state.md`

Do not read implementation rationale or prior agent messages. Do not edit any
file and do not run the release full `npm run check`.

Candidate scope is the complete tracked and untracked diff from the Base SHA,
including the Judge contract/acceptance/review fixture and tests, additive pure
Table Display model, React/CSS, dev fixture, and design entry. Confirm that no
existing production file, config, dependency, version, cache schema, root
barrel, App entry, Personal Workbench, transport, Room, protocol, Cloudflare,
headless, Store, or Core file changed.

Recompute the semantic fingerprint from the repository root with
`node scripts/checks/fingerprint.mjs`. Recompute the context fingerprint with
`node --input-type=module -e "import {computeTreeFingerprint} from
'./scripts/codex-context.mjs'; console.log(computeTreeFingerprint(process.cwd()))"`.
Match both values supplied in the launch packet before inspecting claims and
again before returning the verdict.

Frozen Judge evidence before launch: four targeted files / 18 tests PASS;
scoped ESLint and `git diff --check` PASS; one browser session at 375x812,
812x375, and 1440x900 reported horizontal overflow 0, fixed/absolute tested
elements 0, required surfaces visible/reachable, action elements 0, and console
errors 0.

## Falsify

1. unvalidated/partially validated projection consumption, non-Table role
   acceptance, audience/seat drift, and previous-projection retention;
2. hand/library/graveyard entry identity, hidden/concealed definition, face,
   owner/controller, accessible-text, DOM-attribute, error, or object-ID leakage;
3. input mutation, alias retention, missing deep freeze, sorting/defaulting,
   nondeterminism, and hostile descriptor/getter/prototype handling;
4. active-turn-to-priority inference, stack-order claims, legality/success
   claims, or any interactive/action/transport surface;
5. Store/Solo/Core reducer/workbench/Room/protocol/headless/Cloudflare/network/
   storage imports, reverse dependencies, existing-file edits, or production
   fixture coupling;
6. missing Japanese labels/test IDs, inaccessible status semantics, CSS
   overflow/overlay failures, and divergence across the three viewports;
7. vacuous review assertions or browser evidence, console errors, and any
   behavior claimed beyond O4P-04B's explicit DEFER.

## Return format

- observed semantic and context fingerprints;
- findings sorted BLOCKER, HIGH, MEDIUM, LOW;
- stable ID, exact path/symbol, violated clause, reproduction, impact, and
  smallest safe correction;
- explicit severity totals and commands/outcomes;
- `AUDIT-CLEAR` only when BLOCKER/HIGH are zero; otherwise
  `AUDIT-FIX-REQUIRED`.

Timeout or incomplete inspection is no verdict.
