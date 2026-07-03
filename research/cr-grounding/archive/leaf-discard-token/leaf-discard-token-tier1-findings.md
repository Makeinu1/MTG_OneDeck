# Tier-1 findings: cr-701 discard leaf + cr-111 predefined token leaf

Status: independent Codex Tier-1 audit, findings-only. Final judgment remains Fable.

## Scope / raw git evidence

`git diff --name-only`:

```text
src/components/playmat/Playmat.tsx
src/engine/grammar/compile.ts
src/store/gameStore.ts
```

`git status --short` before writing this report:

```text
 M src/components/playmat/Playmat.tsx
 M src/engine/grammar/compile.ts
 M src/store/gameStore.ts
?? research/cr-grounding/cr-111-predefined-token-leaf.draft.md
?? research/cr-grounding/cr-701-discard-leaf.draft.md
?? research/mydeck-scoring/
?? scripts/mydeck-scoring/
?? src/engine/__tests__/cr111PredefinedTokenCompiler.test.ts
?? src/engine/__tests__/cr701DiscardCompiler.test.ts
?? src/store/__tests__/cr111PredefinedTokenAuto.test.ts
?? src/store/__tests__/cr701DiscardGuided.test.ts
?? src/store/__tests__/review.leaf-discard-token.test.ts
```

Notes:

- No tracked diffs in `docs/`, `CLAUDE.md`, `AGENTS.md`, `eslint.config.js`, `research/cr-grounding/cr-backbone-ledger.json`, or `research/cr-grounding/golden-cases.json`.
- `src/store/__tests__/review.leaf-discard-token.test.ts` is present as untracked reviewer-owned acceptance; per brief, I do not attribute it to the implementer.
- Scope hygiene red flag candidate: untracked `research/mydeck-scoring/` and `scripts/mydeck-scoring/` are outside the requested leaf lane. Do not include them in a leaf ship unless Fable separately owns them.

## Machine checks raw results

### `npm run lint`

Exit: 0

```text
> mtg-onedeck@0.0.0 lint
> eslint .
```

### `npx tsc --noEmit`

Exit: 0

```text
```

### `npx vitest run`

Exit: 0

```text
 RUN  v4.1.8 /Users/shumpeiabe/Desktop/MTG_OneDeck


 Test Files  114 passed (114)
      Tests  1171 passed (1171)
   Start at  07:44:06
   Duration  19.24s (transform 3.75s, setup 3.40s, import 10.26s, tests 19.25s, environment 81.88s)
```

### `npm run build`

Exit: 0

```text
> mtg-onedeck@0.0.0 build
> tsc -b && vite build

vite v8.0.16 building client environment for production...
transforming...✓ 77 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.26 kB │ gzip:   0.55 kB
dist/assets/index-Cd1X7s80.css   73.12 kB │ gzip:  12.61 kB
dist/assets/index-DVx9bxM3.js   502.22 kB │ gzip: 148.60 kB

✓ built in 128ms
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

`rm -rf dist` was rejected by the sandbox policy, then `find dist -type f -delete` and `find dist -type d -empty -delete` succeeded. `find dist -maxdepth 2 -print` then returned `find: dist: No such file or directory`, confirming cleanup.

## Review checks

`npx vitest run src/store/__tests__/review.leaf-discard-token.test.ts`

```text
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

`npx vitest run src/store/__tests__/review.activated-envelope.test.ts src/store/__tests__/review.mana-write.test.ts src/store/__tests__/review.sba-defeat.test.ts src/store/__tests__/review.903-10a.test.ts src/store/__tests__/review.s-events-envelope.test.ts`

```text
 Test Files  5 passed (5)
      Tests  50 passed (50)
```

Verbose rerun confirmed:

- `review.activated-envelope.test.ts`: 11 passed.
- `review.mana-write.test.ts`: 6 passed.
- `review.sba-defeat.test.ts`: 10 passed.
- `review.903-10a.test.ts`: 11 passed.
- `review.s-events-envelope.test.ts`: 12 passed.

## CR anchors

- `rule/Magic_The_Gathering_Comprehensive_Rules.txt:3313`: CR 701.7a requires the specified number of tokens with specified characteristics.
- `rule/Magic_The_Gathering_Comprehensive_Rules.txt:3329`: CR 701.9a discard moves from owner's hand to that player's graveyard.
- `rule/Magic_The_Gathering_Comprehensive_Rules.txt:3331`: CR 701.9b affected player chooses by default.
- `rule/Magic_The_Gathering_Comprehensive_Rules.txt:2030`: CR 404.1 graveyard is the discard pile.
- `rule/Magic_The_Gathering_Comprehensive_Rules.txt:667`, `:671`, `:679`, `:681`: CR 111.10 and Food/Clue/Blood definitions.

## Findings

### 1. HIGH red flag: mixed auto + guided effects drop the auto commands

CR / contract: CR 701.9b requires guided choice for the discard card; §34.19 status discipline forbids half-automation/fake green. The engine may either preserve deterministic commands around the guided choice or fall manual, but it must not claim guided support and silently omit other supported effects in the same resolution.

Evidence:

- `src/engine/grammar/compile.ts:310-326` accumulates both `commands` and `prompts`, and returns `decision: 'guided'` when prompts exist.
- `src/engine/grammar/compile.ts:411-416` adds a discard prompt for supported one-card discard.
- `src/engine/commands.ts:2421-2462` `guidedPlanForStackTop` returns only `{ sourceId, prompts }`, dropping `compiled.commands`.
- `src/store/gameStore.ts:2398-2408` creates `pendingGuided` with `commands: []`.
- `src/store/gameStore.ts:952-958` finishes by applying only accumulated guided commands plus `resolveStackTop`.
- `src/engine/commands.ts:2859-2872` skips guided compiled effects during `resolveStackTop` except stored target commands, so non-target guided discard never replays the dropped auto commands.

Adversarial probe:

```text
{"text":"Draw a card. Discard a card.","decision":"guided","reasons":[],"commands":[{"type":"draw","count":1}],"prompts":["discard"]}
{"text":"Create a Food token. Discard a card.","decision":"guided","reasons":[],"commands":[{"type":"createToken","name":"食物","typeLine":"Token Artifact — Food","quantity":1,"tokenKind":"food"}],"prompts":["discard"]}
```

Store execution then omits the draw/token:

```text
{"text":"Draw a card. Discard a card.","beforeHand":7,"beforeLib":13,"afterHand":6,"afterLib":13,"beforeFood":0,"afterFood":0,"discardZone":"graveyard","sourceZone":"graveyard"}
{"text":"Create a Food token. Discard a card.","beforeHand":7,"beforeLib":13,"afterHand":6,"afterLib":13,"beforeFood":0,"afterFood":0,"discardZone":"graveyard","sourceZone":"graveyard"}
```

Impact: any oracle line combining an already-supported auto effect with `Discard a card.` is reported as guided but resolves only the discard. This is a behavioral loss not covered by the 6-pin review test.

Expected repair shape: either carry `compiled.commands` into `pendingGuided` with deterministic order, or force mixed auto+guided lines to `manual` until ordered guided batches are modeled.

### 2. GREEN: standalone CR 701.9b guided discard does not auto-pick

CR: `rule/Magic_The_Gathering_Comprehensive_Rules.txt:3331`.

Evidence:

- `src/engine/grammar/compile.ts:516-527` only returns a discard prompt for count exactly 1 and self-discard shape.
- `src/engine/grammar/compile.ts:529-541` rejects random/target/each/opponent/other-player wording.
- `src/store/gameStore.ts:2395-2408` `resolveTop` opens `pendingGuided` instead of mutating state.
- Review pin 1 passed: hand count unchanged before confirm.

No red flag for standalone `Discard a card.`.

### 3. GREEN: CR 701.9a destination and invalid hand ID rejection

CR: `rule/Magic_The_Gathering_Comprehensive_Rules.txt:3329`, `:2030`.

Evidence:

- `src/engine/grammar/compile.ts:762-765` builds `{ type: 'discard', cardIds: [...] }`.
- `src/engine/commands.ts:1569-1580` `applyDiscard` moves discarded cards to `graveyard`.
- `src/store/gameStore.ts:2455-2458` rejects IDs not currently in `state.zones.hand`.

Adversarial invalid-ID probe preserved hand/graveyard/stack and left the prompt pending:

```text
"invalidPreserved": true
"warnings": ["《不明なカード》は現在の手札にありません。"]
```

No red flag for standalone invalid-ID handling.

### 4. GREEN: fixed-count predefined token creation preserves count and kind

CR: `rule/Magic_The_Gathering_Comprehensive_Rules.txt:3313`, `:667`, `:671`, `:679`, `:681`.

Evidence:

- `src/engine/grammar/compile.ts:174-196` defines token specs for treasure/clue/food/blood.
- `src/engine/grammar/compile.ts:389-400` only compiles fixed-count recognized single-kind token clauses.
- `src/engine/grammar/compile.ts:477-490` emits `quantity: count` and the selected `tokenKind`.
- `src/engine/commands.ts:3053-3095` creates exactly `Math.floor(quantity)` token instances on the battlefield.
- Review pin 4 passed: `Create two Clue tokens.` creates exactly 2 Clue tokens.

No red flag for fixed-count Food/Clue/Blood token creation.

### 5. GREEN: variable/mixed token and unsupported discard shapes fall manual

Contract: §34.19 status discipline, no fake automation.

Evidence:

```text
{"text":"Discard two cards.","decision":"manual","reasons":["needs-choice"],"commands":[],"prompts":[]}
{"text":"Discard your hand.","decision":"manual","reasons":["needs-choice"],"commands":[],"prompts":[]}
{"text":"Discard a card at random.","decision":"manual","reasons":["needs-choice"],"commands":[],"prompts":[]}
{"text":"Target player discards a card.","decision":"manual","reasons":["needs-choice"],"commands":[],"prompts":[]}
{"text":"Create X Blood tokens.","decision":"manual","reasons":["variable-count"],"commands":[],"prompts":[]}
{"text":"Create a Clue token and a Food token.","decision":"manual","reasons":["needs-parse"],"commands":[],"prompts":[]}
```

No red flag for these explicitly deferred shapes.

### 6. LOW red flag candidate: Treasure helper changed emitted typeLine bytes

Contract: draft says Treasure remains on the existing `effect.treasure` path and shares the predefined-token helper.

Evidence:

- New helper spec uses `typeLine: 'Token Artifact — Treasure'` at `src/engine/grammar/compile.ts:175-179`.
- The pre-change `effect.treasure` path emitted `typeLine: 'Artifact — Treasure'` in the removed hunk (`git diff -- src/engine/grammar/compile.ts`).
- `src/engine/grammar/compile.ts:463-464` still routes `effect.treasure` through the shared helper.
- `src/engine/commands.ts:3009-3024` `crackTreasure` keys on `tokenKind === 'treasure'`, and produced mana remains WUBRG, so the important behavior still passes existing tests.

Impact: likely non-blocking and arguably more consistent with the manual token preset (`src/components/playmat/dialogs.tsx:582-588`), but it is not byte-identical existing compiler output. If "existing treasure behavior" meant exact command payload stability, Fable should decide.

### 7. GREEN with INFO: stack order for standalone guided discard is coherent; cancel is skip, not abort

Contract: CR701-DISCARD-I4 draft says selected discard command is applied, then stack item resolves normally.

Evidence:

- `src/store/gameStore.ts:952-958` applies guided commands before `resolveStackTop`.
- `src/engine/commands.ts:2879-2898` resolves the stack item after commands.
- Review pin 2 passed: chosen card moves to graveyard and source leaves stack.

Cancel behavior:

- `src/store/gameStore.ts:2616-2623` resolution cancel advances with no commands.
- Probe result: cancel leaves hand unchanged, moves the source to graveyard, clears stack/prompt.

This is state-consistent and matches existing guided-resolution skip behavior, but it is not an abort. If UX requires cancel = no resolution, that is outside the current draft and should be separately specified.

### 8. GREEN: Playmat discard prompt wiring calls `confirmGuidedDiscard`

Evidence:

- `src/components/playmat/Playmat.tsx:1125-1135` derives `guidedDiscardIds` from `state.zones.hand`.
- `src/components/playmat/Playmat.tsx:1468-1475` renders `TargetPickerDialog` and wires `onPick` to `store.confirmGuidedDiscard(cardId)`.
- `src/components/playmat/TargetPickerDialog.tsx:27-38` accepts missing `playerIds` and renders without requiring target-specific fields.

No render-throw red flag from code reading.

## Ship recommendation

NO-SHIP recommended for the leaf slice until Finding 1 is fixed or Fable explicitly narrows the contract to reject mixed auto+guided clauses as manual. The 4 machine checks and review pins are green, but the mixed-effect guided path silently drops deterministic commands, which is a CR/status-discipline red flag.

If Fable accepts a fix, also keep the leaf ship staging clean: include the three implementation files, four implementer tests, two drafts, and reviewer-owned `review.leaf-discard-token.test.ts` as appropriate; exclude or separately own the out-of-scope `research/mydeck-scoring/` and `scripts/mydeck-scoring/` directories.
