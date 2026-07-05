# cr-400-408-zones-lki batch2-8 return-to-battlefield scoping draft

Status: implementer draft only. This file does not claim docs/review/ledger ownership.
No code changes are made or claimed in this draft.

## Scope Summary

This sub-scope should target the narrow reanimation shape:

- `return target creature card from your graveyard to the battlefield`
- one target only
- source/controller/owner all effectively P1
- no tapped/attacking/haste/delayed-exile/attached/counter/variable-value modifier
- no other player's graveyard

Positive implementation target, if the judge approves:

- compile a guided target prompt for a P1-owned card currently in `graveyard`
- candidate filter: creature card only
- resolution command: `moveCard(cardId, 'battlefield', 'bottom')`
- rely on existing zone-change reset/new-object substrate for CR 400.7

Keep `return ... to hand`, library search/fetch results, linked-exile blink, and owner-routing generalization as separate sub-scopes unless the judge explicitly folds them in.

## Demand Measurement

`research/mydeck-scoring/gaps.json` exists and was measured with `jq`.

- Remaining rows whose `missingReadWrite` includes `action:return`: 31.
- By deck: Celes 18, Gogo 2, Kefka 4, Muldrotha 7.
- Rows matching `return target ... from your graveyard to the battlefield`: 12.

Representative rows in the 12:

- Celes / Priest of Fell Rites: activated; exact target creature-card self-graveyard return.
- Celes / Karmic Guide: triggered; exact target creature-card self-graveyard return.
- Celes / Extraction Specialist: creature card plus mana-value cap and later restriction.
- Celes / Terra, Herald of Hope: power cap plus tapped modifier and reflexive/conditional payment.
- Celes / Alesha variants: variable power or tapped-and-attacking modifier.
- Celes / Sun Titan: optional target permanent card plus mana-value cap.
- Celes / Sevinne's Reclamation: permanent-card cap plus graveyard-cast copy branch.
- Celes and Muldrotha / Chthonian Nightmare: variable `X`.

There are also self-graveyard-to-hand rows, e.g. Eternal Witness and Defiled Crypt // Cadaver Lab. They likely need the same non-battlefield target substrate, but this draft scopes the battlefield-return slice only.

## CR Grounding

Primary local authority: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`, metadata `effectiveAsOf: 2026-06-19`.

- CR 108.1: Oracle card reference is used to determine wording.
- CR 109.2: bare card-type descriptions default to permanents on the battlefield unless a zone or the word `card`/`spell`/etc. says otherwise.
- CR 109.2a: a description with `card` and a zone means a matching card in that stated zone. This grounds `target creature card from your graveyard`.
- CR 110.1: a permanent exists on the battlefield; a card stops being a permanent when moved elsewhere.
- CR 110.4a: `permanent card` means artifact, battle, creature, enchantment, land, or planeswalker card. This matters for Sun Titan, but is not needed for the exact creature-card first slice.
- CR 115.1/115.1c/115.1d: activated and triggered abilities with `target [something]` require target selection.
- CR 115.2: targets are permanents unless the spell/ability specifies another zone or a non-battlefield object; `from your graveyard` is such a zone specification.
- CR 601.2c, 602.2b, 603.3d: targets are chosen as spells are cast / abilities are activated / triggered abilities are put on the stack. Priest of Fell Rites must not be allowed to target itself after paying its sacrifice cost.
- CR 400.6: the zone-change event, replacement effects, and mutually exclusive effects are determined before the object moves. This is the basis for deferring replacement/alternative handling such as "exile it instead".
- CR 400.7: zone movement creates a new object with no memory of prior existence except listed exceptions. Existing `zoneChangeCounter`/reset behavior is the relevant substrate.
- CR 404.1/404.2: graveyard is each player's discard pile and is face-up/examinable. Note: the task prompt mentioned CR 401 for graveyard, but in the pinned 2026-06-19 CR, 401 is Library and Graveyard is 404.
- CR 608.2b: on resolution, targets are rechecked; a target no longer in its original zone is illegal. Stored target object identity plus expected zone must be preserved through resolution.

## Oracle Text Check

External Scryfall API/card-page fetch was attempted in this environment but did not return usable content. The project-local Scryfall snapshot was used instead:
`research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json`.

The snapshot records these Scryfall URIs:

- Karmic Guide: `https://scryfall.com/card/soc/151/karmic-guide?utm_source=api`
- Priest of Fell Rites: `https://scryfall.com/card/fic/328/priest-of-fell-rites?utm_source=api`
- Sun Titan: `https://scryfall.com/card/soc/178/sun-titan?utm_source=api`

Relevant oracle-backed findings:

- Karmic Guide has a triggered ability whose relevant clause is exactly the simple target creature-card self-graveyard battlefield return. Positive golden candidate.
- Priest of Fell Rites has a normal activated ability with the same relevant return clause after costs. Positive golden candidate only for that normal activated ability. Its Unearth line has haste plus delayed/alternative exile handling and must remain manual/defer.
- Sun Titan has an optional triggered ability that returns a target permanent card with mana value 3 or less. It is a good boundary or phase-2 golden, not a first positive unless the judge also approves optional target effects and `manaValue <= N` filters.

## Existing Substrate Findings

### `TargetFilter` / compiler

Current `TargetFilter` in `src/engine/grammar/compile.ts` only has:

- `types`
- `excludedTypes`
- `excludeTokens`
- `excludeSource`
- `controller`

There is no zone dimension and no owner dimension. `controller` is meaningful for battlefield permanents, but is the wrong primary axis for cards in a graveyard.

Current `guidedTargetPrompt` also has two blockers for this slice:

- `isSingleTargetClause` rejects any clause matching `target ... card`, so graveyard card targets are fail-closed.
- For `effect.return`, it only allows raw text returning to hand; battlefield return is intentionally manual per current `docs/engine-spec.md` note around the existing return zone gate.

Current `buildGuidedCommands` maps `effect.return` to `moveCard(..., to: 'hand')` unconditionally. A battlefield return prompt therefore needs either:

- an explicit prompt destination field, e.g. `targetMove?: { to: ZoneId; entersTapped?: boolean; attacking?: boolean }`; or
- a narrower `returnDestination?: 'hand' | 'battlefield'` field for `effect.return`.

The explicit destination field is cleaner because future tapped/attacking boundaries can remain represented but rejected until implemented.

### `eligibleTargets`

Current `eligibleTargets` in `src/engine/commands.ts` enumerates only `state.zones.battlefield`.
It defaults to `types = ['permanent']` and treats `permanent` as "accept any current battlefield object", which is valid for battlefield candidate enumeration but invalid for graveyard cards.

Minimum extension:

- Add `zone?: 'battlefield' | 'graveyard'` to `TargetFilter`, defaulting to `battlefield` for existing behavior.
- Prefer also adding `owner?: 'any' | 'you' | 'opponent'`, using `ownerId` for graveyard filtering. For the first slice, compile only `owner: 'you'`.
- For `zone: 'graveyard'`, enumerate `state.zones.graveyard` and require `card.zone === 'graveyard'`.
- For `zone: 'graveyard'`, ignore `controller` or fail closed if a prompt tries to combine graveyard zone with controller filtering.
- For `types: ['permanent']` in a graveyard, match CR 110.4a permanent-card types rather than accepting all cards. This is needed before Sun Titan can be positive.
- Keep `excludeTokens`; tokens should normally be absent from graveyards, but keeping the guard is harmless.
- Preserve `excludeSource`, but it should not make Priest able to target itself after costs. Target selection timing must still be activation-time, before sacrifice cost payment (CR 602.2b/601.2c).

Resolution recheck:

- Existing `TargetSelection` stores `physicalCardId`, `objectId`, and `snapshot`.
- Existing `cardIdForStoredObjectTarget` checks current object identity, which catches zone changes because `zoneChangeCounter` changes on true zone moves.
- The graveyard extension should also check the current card is still in the expected zone (`selection.snapshot.zone` or `prompt.filter.zone`) before applying `moveCard`, to make the CR 608.2b zone requirement explicit.
- Full characteristic revalidation on resolution is broader than this slice; for the first simple creature-card slice, current type changes in graveyard are rare, but a judge may require filter revalidation for exact CR 608.2b conformance.

## Proposed Positive Golden Set

1. Karmic Guide
   - Triggered ability, nonoptional.
   - Target: P1 creature card in P1 graveyard.
   - Expected guided flow: choose one eligible graveyard creature card; resolution moves it to battlefield.
   - No tapped/attacking/control modifier in the relevant return instruction.

2. Priest of Fell Rites, normal activated ability only
   - Costs use already shipped cost/tap/sacrifice substrate.
   - Target must be chosen while Priest is still on battlefield; a card that only becomes a graveyard card because Priest is sacrificed as a cost is not a legal target for that activation.
   - Expected guided flow: pay costs through existing activation flow; choose one eligible graveyard creature card selected at activation/stack time; resolution moves it to battlefield.
   - Unearth line remains manual/defer.

3. Sun Titan
   - Recommend boundary golden for this first slice, not positive.
   - Reasons: `you may`, `permanent card`, `mana value 3 or less`, and attack-trigger test limitations are all outside the exact creature-card first slice.
   - If judge wants it positive, add `manaValueMax?: number`, CR 110.4a permanent-card matching, optional target effect semantics, and an ETB-only golden before attack-trigger coverage.

## High-Risk Manual / Defer Boundaries

Keep these manual/defer:

- any other player's graveyard or `a graveyard` / `target player's graveyard`
- any effect that returns under another player/controller or requires general owner routing before §34.17 is implemented
- multiple targets, `up to`, `each`, `any number`, or variable target count
- variable filters such as `mana value X`, source power, source power at resolution, or chosen value
- Sun Titan-like `mana value N or less` unless a judge expands the filter model
- tapped, attacking, tapped-and-attacking, haste-granting, or "can't attack/block" modifiers
- attached Aura returns, attach-this-Aura follow-up, or returning with counters/attachments restored
- replacement or alternative handling such as "exile it instead", delayed exile, Unearth leave-battlefield replacement, or next-end-step delayed triggers
- self-returning from graveyard without a target, e.g. `Return this card from your graveyard...`
- all-creatures/all-lands mass return
- library search/fetch results. Existing CR 701 search/shuffle composite already owns self-library search-to-battlefield for narrow land cases via `effect.search`, so this slice should not reclassify search as `effect.return`.
- linked-exile blink. Same-resolution blink has already shipped under the linked-exile sub-scope and should remain separate.

## Judge Decision Points

1. Approve the first positive scope as exact `return target creature card from your graveyard to the battlefield`, P1-only, no modifiers.
2. Decide whether `TargetFilter` should add only `zone`, or `zone + owner`. I recommend `zone + owner` so `your graveyard` is not encoded by abusing `controller`.
3. Decide whether prompt destination should be generic `targetMove.to` or return-specific `returnDestination`. I recommend a generic move destination field with modifier fields present but unsupported until later.
4. Decide whether CR 608.2b resolution recheck must re-run the full filter or whether current object identity plus expected-zone check is enough for the first slice.
5. Decide Sun Titan status: first-slice boundary vs expanded positive golden requiring `permanent card`, `manaValueMax`, and optional handling.
6. Decide Priest status in review coverage: positive for normal activated ability only, with a negative assertion that the sacrificed Priest cannot become its own target.
7. Confirm that existing reviewer-owned tests asserting reanimation is not guided should be updated only by the judge/reviewer when this scope is approved.
8. Confirm no ledger/docs/review changes should be made by implementer in this draft-only task.
