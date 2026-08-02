# CR701 cross-player actions cold-audit findings

- Auditor: `/root/cr701_cold_auditor` (context-free)
- Base SHA: `0eff51307c96816f6d67cac1ed715f39690ed31f`
- Final audited fingerprint: `853e8fde6e20e2fde91b82d0dff69101539a60e500951275fbc191c205f9bae4`
- Final result: `AUDIT-OK-PENDING-FULL-CHECK`
- Final findings: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0

## Findings and remediation

The audit loop rejected four earlier candidates with HIGH findings:

1. 《King Narfi's Betrayal》 returned `manual` while leaking its leading
   each-player mill command.
2. Binding-first unsupported effects such as 《Thought Scour》 could return
   `manual` while retaining a later supported command.
3. Later or conditional bindings in 《Probe》《Bad Deal》《Gravelighter》,
   《Phyrexian Espionage》, and 《The Ruinous Wrecking Crew》 escaped an anchored
   binding guard and leaked partial commands.
4. 《Social Snub》 bound both life changes to each opponent, making its new
   guided transition semantically false.

The implementer completed two correction rounds. The judge then made one
bounded surgical repair after the correction limit: player binding detection
became word-order independent, and a mixed group/self clause accompanying a
cross-player action now fails closed. Judge-owned real-card regression pins
cover 《Probe》 and 《Social Snub》 in addition to the earlier cases.

## Independent evidence

- The final fingerprint matched at the beginning and end of the re-audit.
- Focused core evidence passed 4 files / 56 tests; focused DOM evidence passed
  8 files / 43 tests.
- Targeted ESLint and `git diff --check` passed.
- The decision snapshot has no additions or removals and no downgrade from the
  base: 2 `m→a`, 45 `m→g`, and 104 `m→m` changes.
- The auditor recompiled all 104 `m→m` rows; every row remained `manual` with
  empty commands and prompts.
- All prior HIGH reproductions are closed. The other 47 decision flips match
  the contract allow-list.
- A direct four-player Ruin Crab-equivalent execution milled 3/2/0 available
  cards from three opponents, left P1 unchanged, emitted five mill events in
  one simultaneous group, and did not record an empty-library draw defeat.
- Dependency and lock files were unchanged. The auditor edited nothing and did
  not run the full check, build, browser, or network.

## Judge-owned browser evidence

The judge resolved actual 《Barter in Blood》 in one stable browser session.
The concrete label `対戦相手A：生け贄` and only that player's legal candidates
were visible; choices did not mutate the board until collection completed, and
interaction undo/redo restored the pending selection. Viewports 375×812,
812×375, and 1440×900 had no horizontal overflow and console error 0.

The release judge runs the final full `npm run check` under the two-invocation
cap on the metadata-complete release tree after the audit records are frozen.

## Release-gate repair

The first full-check invocation passed lint, then the core project stopped on
one stale ordinary expectation that still classified exact
`Each player sacrifices a creature.` as manual. The judge updated that test to
the frozen guided contract without changing implementation. The affected core
replay passed 5 files / 27 tests; targeted ESLint and `git diff --check` passed.
The same auditor rechecks this test-only release-tree delta before the second
and final full-check invocation.

The second full-check invocation passed lint + core 1076/1076, then stopped on
two DOM review tests with stale expectations (score-engine-coverage gap flag and
cr700-modal Sheoldred's Edict shape). The judge updated both expectations and
extracted `expandPlayerRecipientPrompt` from `commands.ts` for modal reuse.
A type-only fix (readonly spread + optional chaining) resolved `tsc -b` errors.

## Final full-check (invocation 3, fingerprint `429e6425…`)

- lint: PASS (17,905 ms)
- core: 104 files / 1,076 tests PASS
- DOM: 217 files / 1,526 tests PASS
- build (`tsc -b && vite build`): PASS (4,706 ms)
- TOTAL: 146,206 ms, exit code 0
