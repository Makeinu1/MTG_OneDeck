# batch2 (cr-118-costs / cr-110-permanents / cr-115-targets) — Tier-1 adversarial audit

Auditor: independent Tier-1 (Sonnet), no prior authorship of this diff. Scope: uncommitted working
tree diff across `src/engine/grammar/compile.ts`, `src/engine/commands.ts`, `src/store/gameStore.ts`,
`src/components/playmat/Playmat.tsx`, plus judge-owned `review.*` and impl-side test files.

## Machine checks (all four, exact results)

1. `npm run lint` — **PASS**, 0 errors/warnings (eslint exited clean, no output).
2. `npx tsc --noEmit` — **PASS**, no output, exit clean.
3. `npx vitest run` — **PASS**. `Test Files 130 passed (130)`, `Tests 1230 passed (1230)`. No failing tests.
4. `npm run build` — **PASS** (`tsc -b && vite build` succeeded, `dist/` produced then removed per instructions). Only a pre-existing chunk-size advisory (>500kB), not an error.

No blockers surfaced from the four machine gates.

## Adversarial findings

### Auto over-claim (cr-118-costs)

Tested against `compileAbilityCost` directly (not just the shipped test suite) with hand-built adversarial cost strings not present in either `review.grammar-cost.test.ts` or `cr118CostsCompiler.test.ts`:

| Input | Result | Correct? |
|---|---|---|
| `Pay 2 life or {2}: Draw a card.` | `manual` / `unmodeled-cost` | Correct — choice cost, residual `or` text is non-empty after life/self-move stripping, forces manual. |
| `{T}, Exile two cards from your graveyard: Add {C}.` | `manual` / `unmodeled-cost` | Correct — `two` count leaves residual text unstripped (only strict self-exile phrases are removed), forces manual. |
| `Exile another creature: Draw a card.` | `manual` / `unmodeled-cost` | Correct — `another` is in `NON_SELF_SACRIFICE_PREFIXES`, so `isSelfExileCostElement` rejects it and the residual "another creature" text stays unmodeled. |
| `Sacrifice this creature, Exile it: Draw a card.` | `manual` / `unmodeled-cost` | Correct — both `sacrificesSelf` and `exilesSelf` fire, and `compile.ts:254-256` explicitly forces `unmodeled-cost` when both are true (conflicting self-zone-move guard). |
| `Pay X life: Draw a card.` | `manual` / `variable-x` | Correct — `\bX\b` regex on `cost.raw` catches it before life-amount parsing runs. |
| `Pay a life: Draw a card.` | `auto`, `{type:'adjustLife', delta:-1}` | Correct — `a`/`an` map to 1 via `MANA_AMOUNT_WORDS`; no NaN, no sign-flip. |
| `Pay 11 life: Draw a card.` | `auto`, `delta:-11` | Correct — decimal-digit fallback via `Number.parseInt` works for values above the word-list ceiling (ten). |
| `Exile another card named <self-name>: Draw a card.` | `manual` / `unmodeled-cost` | Correct — `another` prefix rejects self-match even though the name matches. |
| `Sacrifice a creature named <self-name>: Draw a card.` | `manual` / `unmodeled-cost` | Correct — leading `a` is in `NON_SELF_SACRIFICE_PREFIXES`, so a self-named-but-indefinite-article phrasing is not misread as guaranteed-self. |
| `Sacrifice <self-name>: Draw a card.` (exact name, no article) | `auto`, self-sacrifice to graveyard | Correct — exact-name match with no article/prefix is unambiguous self-reference, matches existing (pre-batch) self-sacrifice behavior. |
| `Discard a card, Pay 3 life: Draw a card.` | `manual` / `unmodeled-cost` | Correct — `discard` is not stripped by the residual-removal pass, so its literal text survives the `[A-Za-z]` check and forces manual even though the life amount is separately recognized. |

I could not get any choice/X/multi-count/other-object cost to reach `decision:'auto'`. The `sortedReasons.length > 0` short-circuit at `compile.ts:259-266` returns `commands: []` for the *whole* cost the moment any manual reason is flagged — there is no partial-auto leak (e.g. a composite `Pay X life, {T}` cost does not silently auto-pay the `{T}` part and post commands while leaving X manual; the entire cost stays `manual` with empty commands). This matches the spec's atomicity intent for `compileAbilityCost` as an all-or-nothing decision.

**One documented, intentional edge case worth flagging (not a bug, but worth the judge's awareness — MEDIUM/LOW, not contradicting any review pin):**

`Exile it` (bare pronoun, no preceding "this/self" establishing referent in the same clause) and `Exile this card from your graveyard` both compile to `auto` self-exile (`compile.ts:1068`, `isThisSelfReference` path). This is explicitly grounded in `research/cr-grounding/cr-118-costs.draft.md` (lines 74-82) as intentional standard-templating self-reference ("it" as an ability's own source in a cost clause is unambiguous MTG templating, e.g. Fiery Islet-style or graveyard-recursion costs), and the pattern is corpus-measured (102 occurrences). Verified this is a **pre-existing possible engine limitation, not new in this batch**: `activateAbility`'s ability-line resolution (`abilityLineIndexForKind`, `gameStore.ts:2314`) does not gate on the source's current zone before compiling/offering an activated ability, so a "graveyard-only" activated ability like `Exile this card from your graveyard: ...` could theoretically be reachable from a UI surface that lets a player attempt to activate an ability on a card not on the battlefield. This is the same class of gap that already existed for the pre-batch self-sacrifice-from-graveyard pattern (flashback-like costs) — batch2 does not introduce a new hole, it extends an existing one symmetrically (graveyard exile mirrors graveyard sacrifice). No review.* pin covers zone-gating of ability activation eligibility, so this is not a contract violation, just a residual scope note.

### Self-exile / self-sacrifice conflict detection

Confirmed `removeNamedSelfZoneMoveElements` (per-name loop over `Sacrifice <name>` / `Exile <name>`) and the inline `Sacrifice`/`Exile` per-element loop both feed into the same `sacrificesSelf`/`exilesSelf` booleans, and `compile.ts:254` (`if (sacrificesSelf && exilesSelf) reasons.add('unmodeled-cost')`) catches the conflict regardless of which detection path (named-reference vs. `this`/`it` self-reference) tripped each flag. Verified with `Sacrifice this creature, Exile it` above — correctly manual.

### Target filter soundness (cr-115)

- **`noncreature artifact` does not pollute positive `types`.** Verified via judge-owned `review.cr115-target-filter.test.ts` (already green) and by re-reading `targetFilterForRaw` (compile.ts:892-914) and its mirror `targetFilterForActivationRaw` (commands.ts:2304-2333): `excludedTypes` is computed as a **separate filter pass** over `TARGET_TYPES`/`supportedTypes` using the `non<type>` regex, independent of the `types` positive-match pass. `creature` never enters `types` for a `noncreature artifact` clause — confirmed both statically and by the passing test `filter.types).not.toContain('creature')`.
- **`excludeSource` is enforced at both prompt-candidate time and confirm time**, and additionally at **cost-commit atomicity time**. Traced the full path:
  - Prompt-candidate list: `Playmat.tsx:1125-1131` calls `eligibleTargets(state, guidedPrompt.filter ?? {}, { sourceId: store.pendingGuided?.sourceId })` — UI-side candidate highlighting now threads `sourceId`.
  - Confirm time (spell-resolution guided path): `gameStore.ts` `confirmGuidedTarget` computes `legalIds = new Set(eligibleTargets(cur, prompt.filter ?? {}, { sourceId: pending.sourceId }))` before accepting the click.
  - Confirm time (activation path): `targetSelectionForCard(state, prompt, cardId, forced, fallbackIndex, sourceId)` now takes `sourceId` and passes it into `eligibleTargets(...,{sourceId})` to compute `legalityMode` (`checked` vs `forced`/`unchecked-warning`), and rules-legal mode still requires `legal` before `commitActivation` proceeds without warnings.
  - `eligibleTargets` itself (commands.ts:2685-2716): `if (filter.excludeSource && context.sourceId === cardId) return false;` is evaluated unconditionally before the `acceptsAnyPermanent` early-return, so a source that would otherwise pass the "accepts any permanent" fast path is still correctly excluded.
  - Confirmed end-to-end by the judge-owned `review.cr115-target-legality.test.ts` "another target" scenario (already green): selecting the source itself leaves `stack` empty and `sourceId` untapped; only selecting the other permanent commits.
- **Opponent controller filter is not literally `P1`-only in a way that breaks the type system**: `filter.controller === 'opponent'` checks `card.controllerId === 'P1'` (exclude) at `commands.ts:2705`, which is consistent with the project's actual `PlayerId` union (`'P1' | 'OPPONENT_A'`, `src/engine/types.ts:60`) — this is a genuinely 2-player-only engine today (pre-existing, not introduced by this batch), so "opponent" == "not P1" is a correct and complete predicate under the current type system, not an incomplete multiplayer shortcut. If/when `PlayerId` grows a third entity, this line and its sibling in `grammar/compile.ts`'s `eligibleTargets`-adjacent logic would need revisiting, but that is out of scope for this batch and not a regression it introduces.
- **Snapshot forward-compat**: `controllerId` and `isToken` are pre-existing `CardInstance` fields (present already in `src/engine/types.ts` and `src/engine/init.ts` before this diff), confirmed via `git diff` showing no new field added to `CardInstance`/`GameState`. No `restoreGame` gap risk from this batch.

### Atomicity (illegal activation-time target)

Traced `activateAbility` → builds `pendingActivation` (an in-memory `PendingActivation` object, not yet applied to `GameState`) → if there are target/cost prompts, stores it under `pendingGuided` and returns, **without calling `applyCommands`**. Only `commitActivation` (reached after all prompts are satisfied, or the forced/rules-legal branches) calls `applyCommands(cur, [...pending.commands, addCmd])` as a **single combined command list** (tap + cost + stack-add all in one `applyCommands` call). `confirmGuidedTarget`'s illegal-target branch (`gameStore.ts`, `if (!legalIds.has(cardId)) { set({warnings...}); return; }`) returns *before* calling `advanceActivationTarget`, so `pendingGuided`/`pendingActivation` state is untouched and no partial cost or stack mutation ever occurs. Verified concretely (not just by reading) via the already-green `review.cr115-target-legality.test.ts`, which asserts `stack` length 0 and source `tapped === false` after an illegal-target click, then asserts commit only on the subsequent legal click.

### Purity / engine invariants

- **No new `GameCommand` variant added.** `git diff src/engine/commands.ts` shows only behavioral changes to `targetFilterForActivationRaw` and `eligibleTargets`, plus a new `lifeCost` field on the *return type* of `activatedManaAbilityPlanForSource` (a plain function-return interface, not a `GameCommand` or `GameState` shape). No `GameState` field added.
- **No new `GameState` field.** Confirmed via grep: `controllerId`/`isToken` predate this diff. `PendingGuidedResolution.warnings?` is a new optional field on the **store-only** `PendingGuidedResolution` interface (`gameStore.ts`), which is transient UI/session state, not part of persisted `GameState`/snapshot — no `restoreGame` forward-compat exposure.
- **`compileAbilityCost` remains deterministic and non-mutating.** It takes `(cost: AbilityCost | null, ctx: CompileContext)` and only reads `ctx.def.name`/`ctx.sourceId`; no `GameState` parameter, no closures over mutable state, no `Date.now()`/`Math.random()` calls introduced. Confirmed by direct re-read of the full diff.

### Contract weakening check

- `review.grammar-cost.test.ts`: the only pre-existing assertion that *changed* is the `"{T}, Pay 3 life: Draw a card."` case, which moved from expecting `manual` to expecting `auto` — this is the **documented, intended behavior change** of this batch (fixed pay-life promotion), not a silent weakening. The diff **adds** two new manual-boundary pins (`Pay X life` → manual/variable-x, and `Exile seven cards from your graveyard` → manual/unmodeled-cost) that did not exist before, strictly *expanding* contract coverage. No existing manual-pin assertion (`Sacrifice another creature`, ability-word label, `{X}`) was deleted or loosened.
- `activatedAbilityEnvelope.test.ts` / `manaWriteActivatedAbility.test.ts`: diffs are pure additions (new `it(...)` blocks for self-exile envelope and fixed-life-cost mana-ability paths, including one negative test — "blocks unpayable fixed life costs... in rules-legal mode" — which is a **new adversarial assertion**, not a relaxed one). No existing test body was modified or removed.
- All four `review.*` files relevant to this batch (`review.grammar-cost.test.ts`, `review.cr115-target-filter.test.ts`, `review.cr110-tap-status.test.ts`, `review.cr115-target-legality.test.ts`) are present, green, and — per the task framing — the two cr-115/cr-110 ones are net-new judge-owned files (not modifications to pre-existing pins), so there is nothing to have weakened there; they are new contract, not amended contract.

### Docs vs. behavior

- `docs/engine-spec.md` §33.6 additions (cr-115 filter fields, cr-110 tap/untap warning-only policy) match the implemented behavior: `excludedTypes`/`excludeTokens`/`excludeSource`/`controller:'opponent'` all appear in `TargetFilter` exactly as documented, and CR 701.26a/b are warning-only (verified `guidedTapStatusWarnings` in `gameStore.ts` produces a warning string but does not block the `setTapped` command).
- §33.6's cost-catalog note (fixed `Pay N life` → CR118.1/118.3b/119.4, strict self-exile → CR701.13a/400.7j) matches `compileAbilityCost`'s implementation precisely, including the `Pay X life` manual carve-out via CR107.3a.
- `docs/acceptance.md` G4-6 was correctly edited to remove `Pay 3 life` (now auto, no longer belongs in the manual-boundary example list) and add `Pay X life` + `Exile seven cards from your graveyard` as new manual examples. G4-8 was added as a new scenario for the promoted auto paths. This is a faithful, non-weakening update — verified by reading the full diff hunk, not just the presence of the line.

## Residual notes (no BLOCKER, no HIGH found)

- **MEDIUM (documented, not a code defect)**: `Exile it` / `Exile this card from your graveyard` self-exile auto-promotion assumes standard MTG "it = ability's own source" pronoun templating within a single cost clause. This is corpus-grounded and CR-consistent, but is the single most "trust the templating convention" inference in the batch — flag for the judge's own awareness, not something requiring rework. No review.* pin is violated by it, and the draft (`cr-118-costs.draft.md`) explicitly reasoned about and scoped this case.
- **LOW (pre-existing, not introduced by this batch)**: activated-ability compilation does not gate on the source's current zone (battlefield vs. graveyard) before offering/compiling an ability line. Graveyard-triggered self-exile costs extend this pre-existing gap symmetrically with graveyard self-sacrifice; not a new regression.
- **LOW (scope note, not a defect)**: `filter.controller === 'opponent'` is implemented as `controllerId !== 'P1'`, which is complete and correct under the current 2-entity `PlayerId` type (`'P1' | 'OPPONENT_A'`) but will need revisiting if the engine ever grows a true N-player model. Out of scope for this batch.
- Unrelated-but-present working-tree changes (`docs/judge-protocol.md`, `.claude/commands/autoloop.md`, `.gitignore`, `research/mydeck-scoring/`, `scripts/mydeck-scoring/`, various `research/cr-grounding/*.draft.md`) are operational/process artifacts and out-of-scope draft/measurement lanes, not part of the cr-118/cr-110/cr-115 code contract; they do not affect this audit's pass/fail determination. `research/grammar-compile/report.{json,md}` changes are a regenerated measurement artifact whose manual-cost-row delta (1385 → 1218, i.e. -167) is consistent with the draft's claimed contribution (+168 rows), so it is not a stray/unrelated diff.

## Bottom line

No BLOCKER or HIGH findings. The three slices (cr-118-costs, cr-110-permanents, cr-115-targets) hold up under adversarial testing of choice/X/count/other-object cost inputs, target-filter soundness (including the "noncreature X shouldn't add creature to positive types" trap and the excludeSource-at-both-times trap), and cost/target atomicity on illegal-target rejection. No new `GameCommand`/`GameState` fields were added, `compileAbilityCost` remains pure, and no existing `review.*`/acceptance pin was weakened — only extended.
