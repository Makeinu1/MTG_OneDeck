# Tier-1 adversarial audit — cr-400-408 reanimation leaf (batch2-8)

Auditor: independent Tier-1 session (no memory of implementation). Findings only — no docs/review.*/source files modified.

## Scope reviewed

- `src/engine/grammar/compile.ts` diff (TargetFilter.zone/owner, exact-phrase `effect.return` guided leaf)
- `src/engine/commands.ts` diff (`eligibleTargets` graveyard branch, activation target filter, resolution zone recheck)
- `src/engine/__tests__/cr400ReanimationGuided.test.ts` (implementer-authored, informative only)
- `src/engine/types.ts` — confirmed **zero diff** (no new persisted field; `git diff --stat -- src/engine/types.ts` empty)

## Required checks — results

1. `npm run lint` — **PASS** (no output, 0 errors/warnings)
2. `npx tsc --noEmit` — **PASS** (0 errors)
3. `npx vitest run` — **PASS**, 145 test files / 1310 tests, 0 failures
4. `npm run build` — **PASS**, built in 180ms, `dist/` removed after (`rm -rf dist`)
5. Isolation re-run of the two reviewer-owned pins:
   `npx vitest run src/engine/__tests__/review.grammar-guided.test.ts src/engine/__tests__/review.cr400-linked-exile.test.ts`
   — **PASS**, 2 files / 34 tests, 0 failures. Confirmed by reading the assertions directly (not just the pass/fail count):
   - `review.grammar-guided.test.ts:117-123` — `"Return target creature card from your graveyard to the battlefield under your control."` → `expect(...).not.toBe('guided')`. Still passes; this diff's exact-phrase regex correctly excludes the `under your control` suffix.
   - `review.cr400-linked-exile.test.ts:91-94` — `"Exile target creature, then return that card to its owner's hand."` → `expect(r.decision).toBe('manual')`. Still passes.

No BLOCKER or HIGH findings. Detail below.

## Adversarial probes performed and results

### 1. Priest self-targeting (CR 601.2c/602.2b/400.7) — the highest-value probe

Traced the real call path end-to-end (not the implementer's test in isolation):

- UI flow: `src/store/gameStore.ts:2563` `activateAbility` calls `activationPlanForSource(cur, ...)` and `activationTargetPromptsForSource(cur, ...)` against `cur = get().state`, i.e. **state before any cost commands are applied**. Target selection (`confirmGuidedTarget` → `targetSelectionForCard`, `gameStore.ts:1561-1586`) calls `eligibleTargets(state, ...)` against that same pre-cost state.
- Because Priest is still on the battlefield at that point (`filter.zone === 'graveyard'`, `commands.ts:3059-3090`), Priest's own id is **not enumerated** in the graveyard candidate list — it isn't a UI-level filter after the fact, it's structurally absent from the candidate zone.
- Cost commands (including the self-sacrifice) are applied only later, at `commitActivation` (`gameStore.ts:1532`: `applyCommands(cur, [...pending.commands, addCmd])`), after targets are already locked into `addCmd.targetSelections`.
- **Independent defense in depth at resolution** (`commands.ts:3258-3311`, `applyStoredTargetCommands`): even if a caller bypassed the UI and force-constructed a `TargetSelection` naming Priest itself (exactly what the implementer's adversarial test at `cr400ReanimationGuided.test.ts:193-222` does, using `legalityMode: 'forced'`), resolution independently rejects it via `cardIdForStoredObjectTarget` (`commands.ts:3238-3247`): Priest's own zone change (battlefield→graveyard as its sac cost) increments `zoneChangeCounter` (`commands.ts:451`), which changes `objectIdOf(card)` (`types.ts:56-58`, `` `${id}:${zoneChangeCounter}` ``) — so the stored `objectId` snapshot no longer matches current Priest, and the stored-target lookup fails *before* the new `expectedZone` check even runs. This is a correct, CR-400.7-grounded implementation of "a zone change creates a new object with no memory of prior existence."
- Verified this independently: reproduced the exact scenario (Priest of Fell Rites activation, illegal self-selection, `legalityMode: 'forced'`) live via vitest and confirmed `resolved.state.cards.c1.zone === 'graveyard'` (i.e. Priest does NOT return to battlefield) and a warning is emitted. Matches `cr400ReanimationGuided.test.ts:218-222`.
- Verdict: **sound, doubly defended** (structural absence from candidate list + independent object-identity recheck at resolution). No finding.

### 2. Modifier-word rejection (exact-phrase gate)

Ran `isExactGraveyardCreatureReturn` standalone against 11 adversarial variants (extracted verbatim from `compile.ts`/`commands.ts`, executed in isolation via node):

| input | result | expected | ok? |
|---|---|---|---|
| exact phrase + period | `true` | true | yes |
| `... under your control.` | `false` | false | yes |
| `You may return ...` prefix | `false` | false | yes |
| `... tapped creature card ...` | `false` | false | yes |
| `... with mana value 3 or less.` | `false` | false | yes |
| `Return target permanent card ...` | `false` | false | yes |
| `... from an opponent's graveyard ...` | `false` | false | yes |
| lowercase, no trailing period | `true` | true (case-insensitive OK) | yes |
| irregular internal whitespace | `true` | true (`\s+` normalized) | yes |
| trailing whitespace after period | `true` | true | yes |
| two-clause line (`...battlefield. Untap it.`) | per-clause: `effect.return` clause = `true`, `effect.untap` clause independently parsed | correct | yes — confirmed clause splitting in `parseAbilityIR`/`splitEffectClauses` isolates the exact-phrase clause from a trailing sentence before the regex ever sees it (verified live via `parseAbilityIR`, output: `effects: [{atom:'effect.return', raw:'Return target creature card from your graveyard to the battlefield'}, {atom:'effect.untap', raw:'Untap it.'}]`) |

No modifier word slips through. The regex is anchored (`^...$`) against the full normalized clause, not a substring match, so no partial-match escape is possible. No finding.

### 3. Owner boundary (`owner: 'you'` = P1 only)

- `commands.ts:3073-3076`: `filter.owner === 'you' && card.ownerId !== 'P1'` → excluded; `filter.owner === 'opponent' && card.ownerId === 'P1'` → excluded. Hardcodes `'P1'` exactly as the pre-existing `filter.controller === 'you'` battlefield-targeting branch already does (`commands.ts:3104`, unchanged by this diff). This is consistent with the existing one-seat-per-player, solitaire-sandbox architecture (`PlayerId = 'P1' | 'OPPONENT_A'`, `types.ts:60`) — not a new architectural gap introduced by this slice.
- The new `cr400ReanimationGuided.test.ts` test explicitly constructs a graveyard with a P1-owned creature and an `OPPONENT_A`-owned creature (`withOwner(state, 'c4', 'OPPONENT_A')`) and asserts `eligibleTargets(...)` returns only `['c2']` (P1-owned), not `c4`. Reproduced this pattern's logic by reading `commands.ts:3073-3076` directly — the exclusion is unconditional on the `TargetFilter`, no code path can add an opponent-owned card to the returned list when `owner: 'you'` is set.
- No finding.

### 4. CR 608.2b resolution recheck — target removed from graveyard before resolution (general case, not just self-sacrifice)

Constructed and ran an independent live adversarial scenario (not present in the implementer's test file): Priest activates targeting a graveyard creature (`c2`), then **before resolution**, `c2` is moved to `exile` by a simulated intervening effect (`applyCommand(state, {type:'moveCard', cardId:'c2', to:'exile', ...})`). Result: `resolveStackTop` correctly leaves `c2` in `exile` (does NOT move it to battlefield), driven by the `expectedZone` check at `commands.ts:3285-3291` (`draft.state.cards[targetCardId]?.zone !== expectedZone` → reject with warning). This is the general-purpose CR 608.2b recheck, independent of the Priest-self-target case, and it holds. No finding.

### 5. Existing hand-return non-regression

- Only two call sites in the entire diff set `filter.zone === 'graveyard'` (`compile.ts:1148`, `commands.ts:2640`), and both are gated behind `isExactGraveyardCreatureReturn(...)`. No other code path can produce a prompt with `filter.zone === 'graveyard'`, so the shared resolution branch `to: prompt.filter?.zone === 'graveyard' ? 'battlefield' : 'hand'` (`compile.ts` `buildGuidedCommands`, `effect.return` case) is unreachable-regression-free for all pre-existing bounce-to-hand call sites by construction, not just by test coverage. Confirmed additionally by the `bounce` sub-case in `cr400ReanimationGuided.test.ts:239-246` and the untouched `review.grammar-guided.test.ts` pin. No finding.

### 6. Determinism / purity

- `isExactGraveyardCreatureReturn` (both copies, `compile.ts` and `commands.ts` — note: duplicated verbatim in two files, see LOW finding below) is a pure `string → boolean` function: normalize whitespace/trailing period, one regex test, no mutation, no I/O. Confirmed by reading both definitions.
- The graveyard-enumeration branch in `eligibleTargets` (`commands.ts:3059-3090`) filters `state.zones.graveyard` (a plain ordered `string[]`, not an object-key iteration), preserving insertion order deterministically via `Array.prototype.filter`. No `Object.keys`/`Object.values` non-deterministic ordering risk. No finding.

### 7. Snapshot / forward-compat

- `git diff --stat -- src/engine/types.ts` is **empty** — zero diff. No new persisted `GameState`/`CardInstance` field. Purely a compiler/target-filter + resolution-branch-logic change, consistent with the stated contract. No finding.

### 8. Test honesty (`cr400ReanimationGuided.test.ts`)

The implementer's test file goes beyond happy-path smoke tests for the two golden cards:
- Asserts exact-phrase-only compilation (the "keeps approved manual boundaries" test at lines 224-257 checks `under your control`, linked-exile-to-hand, plain bounce, Sun Titan mana-value generalization, and opponent-graveyard variants all resolve to non-`guided`/`manual` as required).
- Explicitly tests Priest self-target exclusion with a forced illegal selection (lines 193-222) and asserts the resolution-time rejection warning text.
- Explicitly tests owner boundary via a 4-card multi-owner graveyard scenario (lines 80-133).
- Does **not** explicitly test the CR 608.2b "target removed between selection and resolution by an unrelated effect" case (only the self-sacrifice-causes-zone-change variant is covered) — this is a coverage gap, not a false claim (I verified the underlying code correctly handles the general case in probe #4 above). See MEDIUM note below.

## Summary of findings by severity

**BLOCKER: none.**
**HIGH: none.**

**MEDIUM:**
- M1 — `cr400ReanimationGuided.test.ts` does not include a case where the graveyard target is removed by an *unrelated* effect (not self-sacrifice) between selection and resolution. The engine code handles it correctly (verified live in probe #4), but the implementer's own test suite doesn't pin this general CR 608.2b path, only the Priest-specific self-referential variant. Recommend adding this case if/when `review.*` pins for this slice are authored, so the general recheck is asserted by a judge-owned test rather than only by this audit's throwaway probe.

**LOW:**
- L1 — `isExactGraveyardCreatureReturn` is defined twice, verbatim, in `src/engine/grammar/compile.ts` (line ~1200) and `src/engine/commands.ts` (line ~2699). Not a correctness bug (both copies are byte-identical and independently correct per probe #2), but a maintenance/DRY smell — a future edit to one copy without the other would silently desync the compile-time guided decision from the activation-time target filter. Consider extracting to a shared module if this slice is extended (e.g. to add "permanent card" or mana-value generalizations later).
- L2 — The working tree bundles unrelated process-documentation changes (`.claude/commands/autoloop.md`, `.gitignore`, `docs/judge-protocol.md`) alongside the engine diff. These are out of scope for this engine audit and don't touch `review.*`/source files, but flagging so they aren't accidentally swept into the same commit as the reanimation leaf without separate review, per the project's contract-reference-before-exclusion discipline.
