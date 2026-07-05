# plannedSequence batch2-4 draft: fetch composite appears already satisfied

Status: implementer-lane draft only. J0 mode is not active, so this file does not update
`docs/`, `review.*`, or `research/cr-grounding/cr-backbone-ledger.json`.

## Ledger item

Current plannedSequence head:

`cr-701-keyword-actions-frequent` / batch2-4: fetch composite = search + shuffle +
put onto battlefield tapped. The ledger note cites CR 701.23h / 701.24b and expected
goldens such as Evolving Wilds, Fabled Passage, and Nature's Lore.

## Finding

The fetch-land portion of this planned item appears already satisfied by the existing
M4.15/M4.28 implementation and reviewer-owned pins:

- `fetchAbility(def)` detects Evolving Wilds / Fabled Passage / Prismatic Vista /
  Polluted Delta style English Oracle fetch text and derives `lifeCost`, `entersTapped`,
  and the library filter.
- `activateFetch(sourceId, ...)` pays fixed life costs, sacrifices the source, and puts
  an activated fetch ability object on the stack.
- `resolveFetch(abilityId, targetId, ...)` moves the selected library card from library
  to battlefield, applies tapped status when required, shuffles the remaining library
  order with the found card excluded, and removes the stack ability.
- `resolveAll()` stops before fetch abilities instead of silently resolving a target/search
  choice.
- Legacy `fetchLand(sourceId, targetId, ...)` still exists and is reviewer-pinned; do
  not remove it in this slice, even though the stack-fetch UI is now the primary user flow.

This draft does not implement generic Nature's Lore / Rampant Growth style library-search
guidance. That broader interpretation should wait for judge resolution because it would
promote currently manual search text into guided behavior and needs reviewer-owned pins.

## CR grounding

- CR 701.23a/d: searching a library means looking in that zone and finding a card matching
  the stated description; simple quantity searches must find the required number or as
  many as possible.
- CR 701.23h: repeated search instructions before a shuffle collapse into a single search
  of that library.
- CR 701.24a: shuffling randomizes the library.
- CR 701.24b: when an effect searches, shuffles, then moves found cards elsewhere, the
  found cards are not included in the shuffle.
- CR 118.3b: fixed life payment subtracts the indicated amount from the player's life total.

## Existing evidence

- `src/store/__tests__/review.m415.test.ts`
  - Parses Fabled Passage, Prismatic Vista, Polluted Delta, and Evolving Wilds.
  - Pins direct `fetchLand` composition, including life payment, source sacrifice,
    battlefield destination, tapped option, library conservation, shuffle-minus-target
    behavior, and single undo.
- `src/store/__tests__/review.m428.test.ts`
  - Pins stack-based fetch activation.
  - Pins resolution of a fetch ability into battlefield tapped plus ability removal.
  - Pins `resolveAll()` stopping at the fetch ability.
- `src/engine/__tests__/cr701SearchShuffleCompiler.test.ts`
  - Pins that search+shuffle remains manual rather than half-executing the shuffle.
- `docs/engine-spec.md §11` and `§13.5`
  - Already describe fetch detection and stack-based fetch resolution.
- `docs/acceptance.md FZ1-FZ5`
  - Already describe the user-facing stack fetch flow.

## Proposed judge decision

Treat `plannedSequence[0]` (`cr-701-keyword-actions-frequent` batch2-4 fetch composite)
as likely stale/satisfied if the judge reads the planned item narrowly as fetch-land support.

If the judge intended this item to include generic one-card ramp/tutor search composites
such as Nature's Lore or Rampant Growth, keep it active and issue a separate implementation
brief. That work should include new reviewer-owned pins before promotion.

## Defer / non-claims

- This draft does not claim arbitrary tutor/search support.
- This draft does not add or modify code.
- This draft does not add new review pins, because `review.*` is judge-owned and J0 mode is
  not active.
- This draft does not claim the domain was shipped by Codex.
