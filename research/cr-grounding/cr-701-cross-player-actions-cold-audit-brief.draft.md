# CR-701-CROSS-PLAYER-ACTIONS pre-release cold-audit brief

Read `AGENTS.md`, `.claude/audit-standing.md`, and the fixed CR source before auditing.

- Milestone: `cr-701-cross-player-actions`
- Base SHA: `0eff51307c96816f6d67cac1ed715f39690ed31f`
- Claimed status: `implemented-not-audited`
- Frozen candidate: the working tree identified by `treeFingerprint` in
  `.claude/loop-state.md`
- Frozen contract: `docs/engine-spec.md` §34.53
- Acceptance: `docs/acceptance.md` G9
- CR authority: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`
  (2026-06-19), especially 101.3, 101.4, 608.2e-f, 701.9a-b, 701.17a-b,
  and 701.21a
- Full-check state: invocation 1 passed lint, stopped on one stale ordinary
  CR701 sacrifice expectation (fixed). Invocation 2 passed lint + core 1076/1076,
  stopped on two DOM review tests: `review.score-engine-coverage` (stale gap
  expectation, now updated) and `review.cr700-modal-choice-compile` (Sheoldred's
  Edict shape now guided after `expandPlayerRecipientPrompt` extraction; both
  fixed). Invocation 3 is pending under the two-run cap exception. Do not run
  `npm run check` or a build.

Adversarially test the claims below. Do not use the implementer report as pass
evidence and do not infer correctness merely from green tests.

## Claims to test

1. The compiler recognizes only the frozen exact, fixed-count cross-player
   mill/discard/sacrifice grammar, including the real Ruin Crab Oracle line,
   and otherwise fails closed. Target/that/defending-player binding,
   random/variable/qualified choices, conditions, and unsupported same-clause
   composites yield whole-effect manual with empty commands and prompts.
2. Compiler output is roster-independent. Resolution expands `eachPlayer` and
   `eachOpponent` into concrete prompts in wrapped APNAP order, excluding the
   effect controller for each-opponent actions, including a four-player roster.
3. All required choices are collected without mutating `GameState`; the action
   is then applied as one resolution batch. Insufficient resources perform the
   available portion and zero-candidate recipients do not block progression.
4. Discard, mill, and sacrifice zone-change events use the correct semantic
   reason and one nonempty shared `simultaneousGroupId` per simultaneous action.
   Mill does not count as an empty-library draw attempt.
5. Sacrifice eligibility is evaluated against the affected player's controller
   and honors simple type/union, nontoken, and creature-token filters. A card
   cannot be selected twice while a multi-card choice is pending.
6. The blocking choice UI uses the concrete affected player's label and only
   that player's current legal candidates. Existing interaction undo/redo and
   self-discard/self-sacrifice behavior remain intact.
7. The decision snapshot has no additions, removals, or downgrades: 2 `m→a`,
   45 `m→g`, and 104 `m→m` fingerprint changes. Every `m→m` change is a safe
   fail-closed consequence, not loss of a previously valid partial command.

## Judge-owned acceptance evidence to challenge

- `src/engine/__tests__/review.cr701-cross-player-actions.test.ts`
- `src/store/__tests__/review.cr701-cross-player-actions.test.ts`
- `src/components/game/__tests__/review.cr701-cross-player-actions-ui.test.tsx`
- `research/cr-grounding/golden-cases.json`
- `research/golden-replay/cases/12-muldrotha-ruin-crab-landfall.json`

Relevant regression evidence:

- `src/engine/__tests__/review.cr701-mill-scry-surveil.test.ts`
- `src/engine/__tests__/cr701SacrificeCompiler.test.ts`
- `src/engine/grammar/__tests__/decisionSnapshot.test.ts`
- `src/store/__tests__/review.cr121-cross-player-draw.test.ts`
- `src/store/__tests__/review.mp-zones-commands.test.ts`
- `src/store/__tests__/review.leaf-discard-token.test.ts`
- `src/store/__tests__/review.leaf-sacrifice.test.ts`
- `src/store/__tests__/review.cr603-triggers-sliceC.test.ts`

Judge replay before this re-audit: core 5 files / 27 tests and DOM 11 files /
100 tests passed. Targeted ESLint and `git diff --check` passed. The delta since
the last attested fingerprint (`5d80a900…`) is exactly three files:
`scripts/mydeck-scoring/__tests__/review.score-engine-coverage.test.ts` (expectation
updated from false→true for `action:sacrifice` on each-opponent sacrifice),
`src/engine/commands.ts` (extracted `expandPlayerRecipientPrompt` as exported
function, no behavior change), and `src/store/gameStore.ts`
(`compileSelectedModalOptions` now calls `expandPlayerRecipientPrompt` for guided
modal prompts, making Sheoldred's Edict shape modes guided instead of manual).
Independently reproduce relevant evidence.

Audit history has four closed-candidate HIGH findings. The first pass found that
an unsupported cross-player composite (`King Narfi's Betrayal`) returned
`manual` while leaking its leading mill command. The first re-audit then found
that unresolved `target player` / `that player` / `defending player` composites
could leak a later supported command, reproduced with the real 《Thought Scour》
sentence. The next re-audit found the same binding later in an effect leaked
earlier commands (real 《Probe》 and four peers), and found 《Social Snub》 had
misbound both life actions to each opponent. After the implementer's two
correction rounds, the judge made a bounded surgical repair: player binding is
detected independent of word order, and mixed group/self clauses accompanying
a cross-player action fail closed. The frozen candidate includes real-card
regression assertions for both final findings. Re-audit every correction and
the full claim set; do not treat correction reports as pass evidence.

## Required audit procedure

1. Verify `npm run codex:context -- --domain cr-701-cross-player-actions`
   reports health OK and the candidate fingerprint from `.claude/loop-state.md`.
2. Inspect every changed and untracked path against the base SHA. Verify scope,
   protected-file role ownership, dependency blocks, and `git diff --check`.
3. Compare §34.53/G9 and the reviewer assertions to the fixed CR text. Check for
   missing acceptance pins, overbroad grammar, and fake-green partial commands.
4. Run the focused core and DOM tests separately; never overlap Vitest projects.
   Add temporary adversarial probes only if needed, restore them byte-identically,
   and report exact commands/results.
5. Inspect the entire decision-snapshot transition set, especially Ruin Crab,
   The Binding of the Titans, Accursed Marauder, Burglar Rat, Dusk Mangler,
   Smallpox, Death Cloud, and triggered each-other-player sacrifice cards.
6. Inspect UI/controller wiring for concrete player labels, candidate ownership,
   duplicate prevention, and history access. Browser viewport evidence is judge
   owned and is not part of this cold audit.

## Constraints and output

- Findings only. Do not edit, stage, commit, push, update snapshots, or change
  contracts, reviewer tests, ledger, briefs, or loop state.
- Do not run `npm run check`, full repository tests, build, browser, or network.
- Each finding must include severity (BLOCKER/HIGH/MEDIUM/LOW), exact path/line
  or deterministic reproduction, and impact on the claimed status.
- If and only if BLOCKER/HIGH = 0, return `AUDIT-OK-PENDING-FULL-CHECK` and list
  the evidence actually inspected/executed. This is not ship approval.
