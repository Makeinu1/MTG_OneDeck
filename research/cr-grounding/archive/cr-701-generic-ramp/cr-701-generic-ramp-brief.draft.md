# CR 701 generic single-card ramp search composite draft

Status: implementer-lane draft only. J0 mode is not active, so this file does not update
`docs/`, `review.*`, or `research/cr-grounding/cr-backbone-ledger.json`.

## Scope implemented

This slice promotes only narrow self-library, single-card ramp search text to guided
resolution:

- `Search your library for a Forest card, put that card onto the battlefield, then shuffle.`
- `Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.`

The generated resolution remains a sequence of existing commands:

1. `moveCard` from library to battlefield.
2. `setTapped` only when the Oracle text says the card enters tapped.
3. `shuffle` with a precomputed order for the remaining library, excluding the found card.

No new `GameCommand` type is introduced.

## Scope boundaries

The compiler intentionally leaves these manual:

- Two-or-more-card searches, including `up to two`.
- Broad tutor text such as `any card` or plain `a card`.
- Target-player library searches.
- Searches from zones other than your library.
- Conditional, modal, or optional searches.
- Compound land-subtype criteria such as Farseek (`Plains, Island, Swamp, or Mountain`).
- Search-to-hand or other non-battlefield destinations.

Fetch-land activations such as Evolving Wilds/Fabled Passage remain covered by the existing
M4.15/M4.28 fetch implementation and were not reworked here.

## CR grounding

- CR 701.23a: a search means looking in the instructed zone and finding a card that matches
  the stated description. This supports filtering library choices by `basic land` or a
  single land subtype such as `Forest`.
- CR 701.23d: simple quantity searches must find the requested number or as many as possible.
  This slice only models a single-card guided choice; explicit multi-card quantities stay manual.
- CR 701.23h: multiple library search instructions before a shuffle are treated as one search.
  This slice does not yet implement multi-search collapse beyond the single-card composite.
- CR 701.24a: shuffle randomizes the library. The store precomputes the deterministic order
  before dispatching the `shuffle` command.
- CR 701.24b: found cards moved by the effect are excluded from the shuffle. The guided store
  path computes the shuffle order from `library - foundCardId`.

## Test coverage added

- `src/engine/__tests__/cr701LibrarySearchGuided.test.ts`
  - Nature's Lore style Forest-card search compiles to `library-search` guided prompt.
  - Rampant Growth style basic-land search compiles to `library-search` guided prompt with
    `entersTapped: true`.
  - `any card`, `up to two`, and Farseek-style compound land subtype searches remain manual.
- `src/store/__tests__/cr701LibrarySearchGuided.test.ts`
  - Nature's Lore moves a nonbasic Forest land to battlefield untapped, excludes it from the
    shuffle, and resolves the source to graveyard.
  - Rampant Growth rejects a nonbasic Forest for the basic-land filter, then moves a basic
    Forest to battlefield tapped and shuffles without it.

## Reviewer golden candidates

- `Nature's Lore`: `Forest card` -> battlefield untapped -> shuffle.
- `Three Visits`: same text shape as Nature's Lore.
- `Rampant Growth`: `basic land card` -> battlefield tapped -> shuffle.
- `Search for Tomorrow`: `basic land card` -> battlefield untapped -> shuffle.
- `Sakura-Tribe Elder`: activated ability body uses `basic land card` -> battlefield tapped
  -> shuffle; useful as a stack-resolution check after the existing cost path.

## Non-claims

- This draft does not claim arbitrary tutor support.
- This draft does not claim Farseek/basic-land-type compound support.
- This draft does not update reviewer-owned docs, review tests, or the CR ledger.
