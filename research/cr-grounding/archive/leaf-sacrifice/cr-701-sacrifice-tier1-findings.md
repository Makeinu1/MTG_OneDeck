# CR 701.21 sacrifice leaf Tier-1 findings

Status: Tier-1 independent audit findings only. Final judgment remains Fable.

Authority:
- CR 701.21a (`rule/Magic_The_Gathering_Comprehensive_Rules.txt:3451`): controller moves a permanent from battlefield directly to its owner's graveyard; a player cannot sacrifice a non-permanent or a permanent they do not control; sacrifice is not destruction.
- Approved design draft: `research/cr-grounding/cr-701-sacrifice-leaf.draft.md:7`, `research/cr-grounding/cr-701-sacrifice-leaf.draft.md:30`.
- Review pins: `src/store/__tests__/review.leaf-sacrifice.test.ts:47` (4), `src/store/__tests__/review.leaf-discard-token.test.ts:53` (7).

## Raw machine results

### `npm run lint`

```text
> mtg-onedeck@0.0.0 lint
> eslint .
```

Exit: 0.

### `npx tsc --noEmit`

```text
```

Exit: 0. No stdout/stderr.

### `npx vitest run src/store/__tests__/review.leaf-sacrifice.test.ts`

```text
 RUN  v4.1.8 /Users/shumpeiabe/Desktop/MTG_OneDeck


 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  08:18:58
   Duration  976ms (transform 178ms, setup 35ms, import 200ms, tests 25ms, environment 619ms)
```

Exit: 0. `review.leaf-sacrifice`: 4/4 green.

### `npx vitest run src/store/__tests__/review.leaf-discard-token.test.ts`

```text
 RUN  v4.1.8 /Users/shumpeiabe/Desktop/MTG_OneDeck


 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  08:19:03
   Duration  630ms (transform 153ms, setup 21ms, import 175ms, tests 17ms, environment 336ms)
```

Exit: 0. `review.leaf-discard-token`: 7/7 green.

### `npx vitest run`

```text
 RUN  v4.1.8 /Users/shumpeiabe/Desktop/MTG_OneDeck


 Test Files  117 passed (117)
      Tests  1183 passed (1183)
   Start at  08:19:07
   Duration  18.40s (transform 3.61s, setup 3.21s, import 10.21s, tests 18.38s, environment 77.49s)
```

Exit: 0.

### `npx vitest run $(find src -path '*__tests__/review.*.test.ts' -print)`

```text
 RUN  v4.1.8 /Users/shumpeiabe/Desktop/MTG_OneDeck


 Test Files  63 passed (63)
      Tests  777 passed (777)
   Start at  08:21:15
   Duration  10.65s (transform 2.21s, setup 1.64s, import 5.38s, tests 15.93s, environment 41.53s)
```

Exit: 0. Existing `review.*` group green: 63 files / 777 tests.

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
dist/assets/index-CIl5TtGD.js   504.59 kB │ gzip: 149.05 kB

✓ built in 127ms
[plugin builtin:vite-reporter]
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

Exit: 0. Non-failing Vite chunk-size warning only.

`dist/` cleanup: `rm -rf dist` was blocked by environment policy; generated files were removed with a Python `shutil.rmtree` fallback. `find . -maxdepth 2 -name 'dist' -type d -print` returned no output.

## Scope / forbidden-file findings

Finding SCOPE-1: GREEN for tracked sacrifice diff; YELLOW for unrelated untracked files.

Severity: Medium repository hygiene, not a CR correctness blocker.

Evidence:
- Tracked diff names are only:
  - `src/components/playmat/Playmat.tsx`
  - `src/engine/commands.ts`
  - `src/engine/grammar/compile.ts`
  - `src/store/gameStore.ts`
- Cached diff names: none.
- Forbidden tracked diff scan for `docs/`, `research/cr-grounding/cr-backbone-ledger.json`, `research/cr-grounding/golden-cases.json`, `AGENTS.md`, `CLAUDE.md`, `eslint.config.js`, and `:**/review.*`: no output.
- Untracked files include sacrifice lane files:
  - `research/cr-grounding/cr-701-sacrifice-leaf.draft.md`
  - `src/engine/__tests__/cr701SacrificeCompiler.test.ts`
  - `src/store/__tests__/cr701SacrificeGuided.test.ts`
  - `src/store/__tests__/review.leaf-sacrifice.test.ts` (Fable-owned acceptance pin per brief)
- Untracked files also include out-of-lane `research/mydeck-scoring/*` and `scripts/mydeck-scoring/*`. If those are part of the intended ship set, they are a scope red flag for this sacrifice leaf. If pre-existing unrelated work, exclude them from the sacrifice commit.

CR link: none; this is process/scope hygiene.

## CR 701.21a control and battlefield findings

Finding CR701-SAC-1: GREEN.

Severity: None.

`confirmGuidedSacrifice` recomputes legal candidates from `eligibleTargets(cur, prompt.filter ?? { types: ['permanent'], controller: 'you' })` before building commands, and refuses non-members with a warning (`src/store/gameStore.ts:2475`, `src/store/gameStore.ts:2482`, `src/store/gameStore.ts:2485`). `eligibleTargets` enumerates only `state.zones.battlefield`, ignores ability stack items, and enforces `card.controllerId === 'P1'` when `controller: 'you'` (`src/engine/commands.ts:2669`, `src/engine/commands.ts:2676`, `src/engine/commands.ts:2678`, `src/engine/commands.ts:2681`).

This covers both adversarial cases:
- Opponent-controlled battlefield permanent: refused by `controllerId !== 'P1'`.
- Hand/graveyard/card id outside battlefield: refused because it is absent from `state.zones.battlefield`.

Review coverage: opponent-control rejection is pinned at `src/store/__tests__/review.leaf-sacrifice.test.ts:78`. The battlefield-outside rejection is not separately pinned, but follows from the same `eligibleTargets` battlefield-only implementation.

CR link: `rule/Magic_The_Gathering_Comprehensive_Rules.txt:3451`.

## Sacrifice is not destruction

Finding CR701-SAC-2: GREEN.

Severity: None.

No new destroy command/regeneration/destruction replacement hook is introduced. The auto self path emits `moveCard` directly to `graveyard` (`src/engine/grammar/compile.ts:566`, `src/engine/grammar/compile.ts:568`). The guided sacrifice answer emits `moveCard` directly to `graveyard` (`src/engine/grammar/compile.ts:884`, `src/engine/grammar/compile.ts:888`). Store resolution passes those commands through `applyCommands` and existing `moveCardInternal` (`src/store/gameStore.ts:949`, `src/store/gameStore.ts:958`; `src/engine/commands.ts:2701`, `src/engine/commands.ts:2705`).

The only adjacent destroy branch remains the pre-existing generic target atom switch (`src/engine/grammar/compile.ts:898`), separate from the new sacrifice-specific branch. Grep found no regeneration/destruction replacement path tied to sacrifice.

CR link: `rule/Magic_The_Gathering_Comprehensive_Rules.txt:3451`.

## Auto self exactness

Finding CR701-SAC-3: GREEN.

Severity: None.

`Sacrifice this ...` and exact CARDNAME self-reference compile to a single command whose `cardId` is `ctx.sourceId` (`src/engine/grammar/compile.ts:590`, `src/engine/grammar/compile.ts:595`, `src/engine/grammar/compile.ts:598`, `src/engine/grammar/compile.ts:566`, `src/engine/grammar/compile.ts:568`). `isThisSelfReference` rejects compound/qualified `this` phrases such as `another`, `other`, `target`, and `you control` (`src/engine/grammar/compile.ts:995`, `src/engine/grammar/compile.ts:999`). CARDNAME matching is exact via `sameCardNameReference` (`src/engine/grammar/compile.ts:1012`).

Spot check raw output:

```text
Sacrifice this creature. => auto {"commands":[{"type":"moveCard","cardId":"source-1","to":"graveyard","position":"bottom"}],"prompts":[],"reasons":[]}
Sacrifice Plague Myr. => auto {"commands":[{"type":"moveCard","cardId":"source-1","to":"graveyard","position":"bottom"}],"prompts":[],"reasons":[]}
Sacrifice Other Name. => manual {"commands":[],"prompts":[],"reasons":["needs-parse"]}
```

Review/self-test coverage: `src/engine/__tests__/cr701SacrificeCompiler.test.ts:65`; store behavior for triggered self sacrifice at `src/store/__tests__/cr701SacrificeGuided.test.ts:92`.

CR link: `rule/Magic_The_Gathering_Comprehensive_Rules.txt:3451`.

## Manual-fall honesty

Finding CR701-SAC-4: GREEN.

Severity: None.

Unsupported sacrifice clauses are rejected before auto/guided compilation for `unless`, `target`, `each`, opponent/player-model words, `that player`, `their`, and `controller` (`src/engine/grammar/compile.ts:562`, `src/engine/grammar/compile.ts:586`). Multi-count object phrases return `needs-choice` (`src/engine/grammar/compile.ts:647`, `src/engine/grammar/compile.ts:649`). Qualified unsupported objects such as `another creature` and `a nontoken creature` fail `sacrificeEffectFilter`, because the guided filter accepts only exact `creature`, `artifact`, `enchantment`, `land`, `planeswalker`, or `permanent` (`src/engine/grammar/compile.ts:632`, `src/engine/grammar/compile.ts:634`, `src/engine/grammar/compile.ts:644`).

Spot check raw output:

```text
Sacrifice two creatures. => manual {"commands":[],"prompts":[],"reasons":["needs-choice"]}
Each player sacrifices a creature. => manual {"commands":[],"prompts":[],"reasons":["needs-parse"]}
You may sacrifice a creature. => manual {"commands":[],"prompts":[],"reasons":["optional"]}
Sacrifice a creature unless you pay {1}. => manual {"commands":[],"prompts":[],"reasons":["needs-parse"]}
Sacrifice another creature. => manual {"commands":[],"prompts":[],"reasons":["needs-parse"]}
Sacrifice a nontoken creature. => manual {"commands":[],"prompts":[],"reasons":["needs-parse"]}
```

Review coverage: multi-count no-half-execution pin at `src/store/__tests__/review.leaf-sacrifice.test.ts:130`.

CR link: `rule/Magic_The_Gathering_Comprehensive_Rules.txt:3451`; status-discipline link: `research/cr-grounding/cr-701-sacrifice-leaf.draft.md:38`.

## Mixed carry / existing leaf preservation

Finding CR701-SAC-5: GREEN.

Severity: None.

The existing §32.8 carry rule remains intact. `guidedPlanForStackTop` still carries deterministic commands from guided lines into `pendingGuided.commands` (`src/engine/commands.ts:2421`, `src/engine/commands.ts:2433`, `src/engine/commands.ts:2453`). `resolveTop` stores those commands before presenting prompts (`src/store/gameStore.ts:2399`, `src/store/gameStore.ts:2402`, `src/store/gameStore.ts:2407`). `advanceGuidedResolution` appends the chosen sacrifice/discard/mana/etc. command to the carried commands, and `finishGuidedResolution` applies all commands before resolving the stack item (`src/store/gameStore.ts:970`, `src/store/gameStore.ts:977`, `src/store/gameStore.ts:949`, `src/store/gameStore.ts:958`).

Regression evidence:
- `review.leaf-discard-token`: 7/7 green.
- All `review.*`: 63 files / 777 tests green.
- Full suite: 117 files / 1183 tests green.

CR/status link: CR 608.2c carry rationale in existing comment at `src/engine/commands.ts:2434`; draft invariant `research/cr-grounding/cr-701-sacrifice-leaf.draft.md:34`.

## Type filter

Finding CR701-SAC-6: GREEN.

Severity: None.

`Sacrifice an artifact.` compiles to a sacrifice prompt with `filter: { types: ['artifact'], controller: 'you' }` (`src/engine/grammar/compile.ts:601`, `src/engine/grammar/compile.ts:610`, `src/engine/grammar/compile.ts:614`, `src/engine/grammar/compile.ts:618`). UI candidates and store confirmation both route through `eligibleTargets`, which filters battlefield permanents by type line after the controller check (`src/components/playmat/Playmat.tsx:1136`, `src/components/playmat/Playmat.tsx:1138`; `src/store/gameStore.ts:2482`; `src/engine/commands.ts:2687`, `src/engine/commands.ts:2690`).

Spot check raw output:

```text
Sacrifice an artifact. => guided {"commands":[],"prompts":[{"atom":"effect.sacrifice","kind":"sacrifice","count":1,"filter":{"types":["artifact"],"controller":"you"},"raw":"Sacrifice an artifact."}],"reasons":[]}
```

Review coverage: artifact prompt rejects creature at `src/store/__tests__/review.leaf-sacrifice.test.ts:109`.

CR link: `rule/Magic_The_Gathering_Comprehensive_Rules.txt:3451`.

## UI wiring

Finding CR701-SAC-7: GREEN by code read.

Severity: None.

`Playmat` derives `guidedSacrificeIds` only for `guidedPrompt.kind === 'sacrifice'` and uses the same `eligibleTargets` filter as store confirmation (`src/components/playmat/Playmat.tsx:1125`, `src/components/playmat/Playmat.tsx:1136`, `src/components/playmat/Playmat.tsx:1138`). The prompt renders a `TargetPickerDialog` titled `生け贄を選択`, passes `cardIds={guidedSacrificeIds}`, and wires `onPick` to `store.confirmGuidedSacrifice(cardId)` (`src/components/playmat/Playmat.tsx:1482`, `src/components/playmat/Playmat.tsx:1487`). The store interface exposes `confirmGuidedSacrifice` (`src/store/gameStore.ts:589`, `src/store/gameStore.ts:592`).

No render-type issue was found by static code read, `npx tsc --noEmit`, full vitest, and `npm run build`. Browser console was not run in this Tier-1 pass; the brief asked UI wiring by code read.

CR link: `rule/Magic_The_Gathering_Comprehensive_Rules.txt:3451`.

## SHIP recommendation

Recommendation: SHIP the sacrifice leaf implementation, with scoped staging only.

Reasoning: No CR 701.21a correctness red flags found. The implementation enforces controller and battlefield legality at both candidate enumeration and store confirmation, uses `moveCard` rather than destruction, keeps self-sacrifice exact, leaves unsupported shapes manual, preserves mixed carry, and passes the required machine/review gates.

Condition: Fable should exclude or separately classify the out-of-lane untracked `research/mydeck-scoring/*` and `scripts/mydeck-scoring/*` files before any ship commit. If those files are accidentally included in the sacrifice ship set, treat that as a scope red flag, not a sacrifice-engine defect.
