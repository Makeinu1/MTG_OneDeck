# cr-605 mana:write catalog Tier-1 findings

Scope: mana generation catalog expansion (literal auto / any-color guided / restriction manual). Contract unchanged. External authority: CR 605/106/107/602, engine-spec §34.11/§34.19, reviewer-owned `review.*`.

## Machine checks (raw)

### `npm run lint`
```text
> mtg-onedeck@0.0.0 lint
> eslint .
```
Result: PASS (exit 0)

### `npx tsc --noEmit`
```text
```
Result: PASS (exit 0; no output)

### `npx vitest run`
```text
 RUN  v4.1.8 /Users/shumpeiabe/Desktop/MTG_OneDeck


 Test Files  109 passed (109)
      Tests  1155 passed (1155)
   Start at  22:31:21
   Duration  19.93s (transform 3.95s, setup 3.34s, import 10.20s, tests 20.89s, environment 84.77s)
```
Result: PASS

### `npm run build`
```text
> mtg-onedeck@0.0.0 build
> tsc -b && vite build

vite v8.0.16 building client environment for production...
transforming...✓ 77 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.26 kB │ gzip:   0.55 kB
dist/assets/index-Cd1X7s80.css   73.12 kB │ gzip:  12.61 kB
dist/assets/index-yKUbaqn-.js   500.08 kB │ gzip: 148.09 kB

✓ built in 136ms
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```
Result: PASS. `dist/` was generated, inspected, then removed (`dist absent`).

## Review pins (raw)

### `npx vitest run src/store/__tests__/review.mana-write.test.ts`
```text
 RUN  v4.1.8 /Users/shumpeiabe/Desktop/MTG_OneDeck


 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  22:32:15
   Duration  679ms (transform 160ms, setup 22ms, import 182ms, tests 18ms, environment 364ms)
```
Result: GREEN (4 pins)

### `npx vitest run src/store/__tests__/review.activated-envelope.test.ts`
```text
 RUN  v4.1.8 /Users/shumpeiabe/Desktop/MTG_OneDeck


 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  22:32:19
   Duration  684ms (transform 158ms, setup 23ms, import 181ms, tests 36ms, environment 357ms)
```
Result: GREEN (11 pins)

### `npx vitest run src/store/__tests__/review.mana-transaction.test.ts`
```text
 RUN  v4.1.8 /Users/shumpeiabe/Desktop/MTG_OneDeck


 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  22:32:23
   Duration  747ms (transform 162ms, setup 22ms, import 185ms, tests 97ms, environment 356ms)
```
Result: GREEN (5 pins)

### `npx vitest run src/engine/__tests__/review.g4-activate.test.ts`
```text
 RUN  v4.1.8 /Users/shumpeiabe/Desktop/MTG_OneDeck


 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  22:32:27
   Duration  732ms (transform 113ms, setup 22ms, import 124ms, tests 28ms, environment 373ms)
```
Result: GREEN (11 pins)

## Findings by adversarial point

1. 禁止ファイル改変: GREEN / severity none.
   - `git diff --name-only` raw:
```text
src/components/playmat/Playmat.tsx
src/engine/commands.ts
src/engine/grammar/compile.ts
src/engine/grammar/index.ts
src/store/gameStore.ts
```
   - No tracked `review.*`, `docs/`, ledger, or `golden-cases/*.draft` changes in `git diff --name-only`.
   - `git status --short` shows untracked `src/store/__tests__/review.mana-write.test.ts`; brief marks it Fable-owned and not attributed to the implementer. It must remain judge-owned before commit.

2. Literal count exactness: GREEN / severity none.
   - CR 106.1b / 107.4: mana has exact types; `{C}` represents one colorless mana (rule file lines 410, 494, 500).
   - `literalManaCommands` counts each symbol and emits one `addMana` command per color in first-seen order: `src/engine/grammar/compile.ts:490`.
   - Direct probe:
```text
{"line":"{T}: Add {C}.","decision":"auto","commands":[{"type":"addMana","color":"C","amount":1}],"prompts":[],"reasons":[]}
{"line":"{T}: Add {G}{G}.","decision":"auto","commands":[{"type":"addMana","color":"G","amount":2}],"prompts":[],"reasons":[]}
{"line":"{T}: Add {W}{U}.","decision":"auto","commands":[{"type":"addMana","color":"W","amount":1},{"type":"addMana","color":"U","amount":1}],"prompts":[],"reasons":[]}
```

3. Any-color guided atomicity (pre-confirm/cancel): GREEN for the requested pin / severity none.
   - CR 602.2 requires illegal/incomplete activation to return to pre-activation state; reviewer pin confirms no mutation before color confirm and cancel is non-event.
   - Store creates `pendingGuided.mode='mana-ability'` without commit: `src/store/gameStore.ts:2255`.
   - Confirm appends chosen `addMana` then resolves through `resolveManaAbilityTransaction`: `src/store/gameStore.ts:2532`, `src/store/gameStore.ts:1068`.
   - Cancel clears only `pendingGuided`: `src/store/gameStore.ts:2566`.

4. CR 605.1a/605.5a stack discipline: GREEN / severity none.
   - CR 605.1a targetless add-mana activated abilities are mana abilities; CR 605.3b / 405.6c no stack and immediate resolution (rule file lines 2683, 2694, 2054).
   - `isActivatedManaAbilityIR` rejects any `construct.target`: `src/engine/commands.ts:2649`.
   - Mana ability path calls `resolveManaAbilityTransaction` and does not create `addAbilityToStack`: `src/store/gameStore.ts:2273`.
   - Targeted add-mana routes through ordinary activation target prompt/stack path: `src/engine/commands.ts:2352`, `src/store/gameStore.ts:2299`, `src/store/__tests__/manaWriteActivatedAbility.test.ts:171`.

5. No auto fraud for restriction/condition/or/snow: GREEN at runtime, with LOW caveat.
   - Construct-level restriction/condition are manual: `src/engine/grammar/index.ts:123`, `src/engine/grammar/index.ts:135`, `src/engine/grammar/compile.ts:300`.
   - Special mana text rejects snow/type-produced/colors-among: `src/engine/grammar/compile.ts:557`.
   - Runtime safeguard: if compiled effect is manual, `activatedManaAbilityPlanForSource` returns `commands: []` and the store only warns/manuals: `src/engine/commands.ts:2603`, `src/store/gameStore.ts:2245`.
   - Caveat: direct compiler output for literal restriction still carries a stale `addMana` command while `decision:"manual"`:
```text
{"line":"{T}: Add {G}. Spend this mana only to cast creature spells.","decision":"manual","commands":[{"type":"addMana","color":"G","amount":1}],"prompts":[],"reasons":["needs-parse"]}
```
     Current runtime does not execute it, but this is a latent footgun for any future caller that trusts `commands` without checking `decision`.

6. Commander color identity options: GREEN / severity none.
   - `commanderColorIdentityForState` derives colors from `state.commanders` and filters to WUBRG order: `src/engine/commands.ts:2631`.
   - Guided prompt uses commander options only for "commander's color identity" text: `src/engine/grammar/compile.ts:518`.
   - Direct probe with identity `['W','U']`:
```text
{"line":"{T}: Add one mana of any color in your commander's color identity.","decision":"guided","commands":[],"prompts":[{"atom":"effect.add-mana","kind":"mana","count":1,"manaOptions":["W","U"],"raw":"Add one mana of any color in your commander's color identity."}],"reasons":[]}
```

7. Existing paths non-breakage: GREEN / severity none.
   - `tapForMana` still resolves through `resolveManaAbilityTransaction`: `src/store/gameStore.ts:1842`.
   - `planAutoTap` / `payMana` paths are unchanged in cost payment surfaces and full `npx vitest run` is green: `src/engine/commands.ts:2530`, `src/store/gameStore.ts:1968`.
   - Existing review systems green: `review.mana-transaction`, `review.g4-activate`, `review.activated-envelope`.

8. UI wiring: GREEN by code-read / severity none.
   - `Playmat` renders `ManaChoiceDialog` for `guidedPrompt.kind === 'mana'`: `src/components/playmat/Playmat.tsx:1374`.
   - Choose calls `store.confirmGuidedMana(color)`, cancel calls `store.cancelGuidedPrompt()`: `src/components/playmat/Playmat.tsx:1377`.
   - Dialog maps options only and is tolerant of an empty array: `src/components/playmat/dialogs.tsx:22`.
   - Browser console verification was not run in this Tier-1 pass; this point is code-read only as requested.

## Additional red flag

RED / severity high: activated mana ability cost atomicity is not enforced for already-tapped `{T}` sources on the mana ability path.

- CR 602.2: activation is illegal and returns to before activation if a player cannot comply; CR 605.3 says activated mana abilities follow normal activation rules except no-stack exceptions (rule file lines 2527, 2690). CR 118.3 explicitly says an already-tapped permanent cannot be tapped to pay a cost (rule file line 972).
- Normal activation path checks unpayable tap cost through `activationCostWarnings`: `src/store/gameStore.ts:2327`, `src/store/gameStore.ts:1188`.
- Mana ability path bypasses that check and commits `resolveManaAbilityTransaction` directly for auto, or after color confirm for guided: `src/store/gameStore.ts:2240`, `src/store/gameStore.ts:2273`, `src/store/gameStore.ts:1039`.
- Repro probe:
```text
after activate pending mana-ability true []
after confirm { tapped: true, G: 1, stack: 0, warnings: [] }
lit { stateChanged: true, tapped: true, G: 1, stack: 0, warnings: [] }
gg { stateChanged: true, tapped: true, G: 2, stack: 0, warnings: [] }
```
- Interpretation: an already-tapped `{T}: Add ...` source can still add mana via `activateAbility`. This violates §34.19 atomicity/payment discipline even though current Fable pins do not cover the already-tapped mana-ability case.

## SHIP recommendation

NO-SHIP until the additional red flag is fixed or explicitly ruled out of this slice by Fable. Mechanical checks and reviewer pins are green, but the mana ability path currently permits an unpayable `{T}` cost to produce mana, which is a CR602.2/118.3 cost-atomicity violation on the exact no-stack mana path being extended.
