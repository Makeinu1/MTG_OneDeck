# Codex brief draft — cr-110 permanent tap status

- Role: implementer.
- Do not use git.
- Do not edit `review.*`, `docs/`, `CLAUDE.md`, `AGENTS.md`, `eslint.config.js`, or `CACHE_SCHEMA_VERSION` unless J0 is explicitly declared.
- CR source: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`, fixed to 2026-06-19.
- This draft is not judge-approved; judge must re-own scope and tests before ship.

## Goal

Turn the next ledger item (`cr-110-permanents`) into a narrow, executable tap-status slice:

- Preserve existing `CardInstance.tapped` / `setTapped` substrate.
- Pin existing land ETB tapped behavior.
- Pin existing guided single-permanent `tap` / `untap` resolution behavior.
- Do not implement broad replacement effects, mass untap, tapped tokens, "taps for mana" observers, or tapped-and-attacking.

The product value is MyDeck `tap-state:write=108`, but the first safe slice is not all 108 rows. It should close only deterministic/guided single-permanent status writes and leave explicit boundaries.

## CR grounding

Required refs in any promoted contract/tests:

- CR 110.1: permanent = card/token on battlefield.
- CR 110.5: status includes tapped/untapped.
- CR 110.5b: permanents enter untapped unless a spell/ability says otherwise.
- CR 110.5c: status is retained until changed.
- CR 110.5d / 403.3: only battlefield permanents have status.
- CR 701.26a: tap a permanent; only untapped permanents can be tapped.
- CR 701.26b: untap a permanent; only tapped permanents can be untapped.

## Measurement source

Use `research/cr-grounding/cr-110-permanents-tap-status.draft.md`.

Measured MyDeck rows with `tap-state:write`: 108.

Bucket counts:

- conditional ETB tapped: 28
- untap target or mass untap: 27
- put/return onto battlefield tapped: 20
- static ETB tapped: 18
- reads tapped/untapped or replacement-like untapped text: 5
- tap target or tap another permanent: 4
- create tapped token: 3
- other event around tapping for mana: 2
- tapped and attacking: 1

## Current code substrate

Relevant existing files:

- `src/engine/types.ts`: `CardInstance.tapped`.
- `src/engine/commands.ts`: `setTapped`, `playLand(entersTapped?)`.
- `src/engine/status.ts`: `landEntersTapped`, `fetchAbility`.
- `src/store/gameStore.ts`: `playLand` conditional tap choice, fetch `entersTapped`, guided target confirmation.
- `src/engine/grammar/compile.ts`: `effect.tap` and `effect.untap` map to `setTapped`.

Existing implementer pin added before judge approval:

- `src/store/__tests__/cr110TapStatus.test.ts`
  - guided single-target `tap` / `untap` writes
  - warning-only CR 701.26a/b checks for already-tapped / already-untapped selections

## Proposed implementation scope

### In scope

1. Reviewer-owned tests should pin existing land play ETB tapped behavior:
   - `This land enters tapped.` -> `landEntersTapped === 'always'`; `playLand` results in `tapped === true`.
   - `This land enters tapped unless ...` -> `landEntersTapped === 'conditional'`; store asks for tap choice; selected `entersTapped` is honored.
2. Reviewer-owned tests should pin existing guided tap/untap behavior:
   - `Tap target permanent.` -> prompt target -> `setTapped true`.
   - `Untap target artifact or creature.` -> prompt target -> `setTapped false`.
3. Implementer-side code now adds warning-only legality checks for CR 701.26a/b when guided tap tries to tap an already tapped permanent or guided untap tries to untap an untapped permanent. It does not hard-block; project sandbox philosophy normally warns rather than blocks.

### Out of scope / defer

- Conditional ETB evaluation beyond existing tap-choice UI.
- Generic `put/return ... onto/to the battlefield tapped` effect compiler support. This needs destination modifiers in target/zone effect envelopes.
- Mass/all untap.
- Tapping another permanent as activation cost. This belongs to guided cost-subject work, not the pure status-write leaf.
- Tapped token creation. Current `createToken` has no created-id return channel and no `entersTapped` option.
- "Whenever a player taps [object] for mana" observers.
- `tapped and attacking`, which depends on combat state.
- Replacement/layer text such as "Lands you control enter untapped."

## Suggested judge-owned review tests

Do not edit these from implementer seat without explicit J0.

Potential files:

- `src/store/__tests__/review.cr110-tap-status.test.ts`
- or extend existing reviewer-owned grammar/guided tests if judge prefers consolidation.

Expected cases:

1. `cr110-land-static-etb-tapped`
   - Setup: land with `oracleText: 'This land enters tapped.'`
   - `playLand(id)` returns `ok`; card on battlefield with `tapped === true`.
   - CR refs: 110.5, 110.5b.

2. `cr110-land-conditional-etb-choice`
   - Setup: land with `oracleText: 'This land enters tapped unless you control a Plains.'`
   - `playLand(id)` returns `needs-tap-choice`.
   - `playLand(id, { entersTapped: true })` sets tapped.
   - CR refs: 110.5b; sandbox choice boundary.

3. `cr110-guided-tap-target`
   - Setup: spell/ability `Tap target permanent.`
   - Resolution opens target prompt; selecting a battlefield permanent sets `tapped === true`.
   - CR refs: 110.5, 701.26a.

4. `cr110-guided-untap-target`
   - Setup: tapped artifact creature and spell/ability `Untap target artifact or creature.`
   - Resolution opens target prompt; selecting it sets `tapped === false`.
   - CR refs: 110.5, 701.26b.

5. Manual boundary pin:
   - `Tap an untapped legendary creature you control: Add one mana of any color.` remains outside this slice.
   - `Create a tapped 2/2 ... token` remains outside this slice.
   - `Return target creature ... to the battlefield tapped and attacking` remains outside this slice.

## Acceptance checks

After judge-owned test/doc promotion and implementation, run individually:

- `npm run lint`
- `npx tsc --noEmit`
- `npx vitest run`
- `npm run build`

Delete generated `dist/` after confirming build output.

Expected known dependency:

- If `cr-118-costs` re-owner patch is not promoted first, full `npx vitest run` still fails the old `review.grammar-cost` fixed-life pin. Judge should either promote `cr-118` first or account for that unrelated red when reviewing this slice.
