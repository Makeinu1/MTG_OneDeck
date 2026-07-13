# Board density contract update draft

Status: judge review required. UI observation showed that the current 96/84/72px shelf leaves unused desktop space and makes the central battlefield secondary to controls.

## Proposed desktop density

- 1–3 cards: 128px
- 4–6 cards: 112px
- 7–10 cards: 96px
- 11–13 cards: 84px
- 14+ cards: 72px with overlap

The same deterministic count-to-width mapping remains; only thresholds and widths change. Narrow viewports may retain the current compact values through CSS media rules, but the selector and CSS token must not disagree.

## Required judge action

`src/components/game/__tests__/review.d2-layout-model.test.ts` currently pins 96/84/72px. Update the design contract and reviewer-owned expectations together before implementation. Validate 1280×800, 1440×900, and 1920×1080 for two independent shelves, land row, and hand fan.

