# feel-6 stack spatial presence implementation brief

## Frozen C1 values

The user requested the unfinished UI thread be carried through. Treat that request as approval to freeze the planned C1 values: front-card scale about `1.06`, shallow `±2px` bob over `2600ms`, transform-only motion, a restrained shadow, and a `300ms` source-zone→stack arrival ghost. Card layout dimensions and existing stack controls stay unchanged.

## Goal

Give the stack a calm focal presence and a short causal arrival cue when a spell commits from hand/command/library to stack.

## Constraints

- Keep stack card width/height and mobile layout unchanged; only transform/opacity/filter/box-shadow may animate.
- Preserve stack expansion, target lines, overflow menu, resolution lock, and existing AV3 spell pulse/audio.
- Reduced motion must remove bob/flight and leave a static, legible stack card.
- Ghost is non-interactive and must not block or delay GameState.
- Implementer may edit source and ordinary tests only; do not edit review.*, docs, ledger, git, or this brief.

## Acceptance

1. Front stack card has restrained shadow, scale≈1.06, and shallow bob; back cards keep existing offsets.
2. Successful `spell-cast` renders one non-interactive arrival ghost with source-zone and card id, completing in 260–320ms.
3. Reduced-motion CSS disables bob/flight while retaining the front card.
4. Existing stack interaction tests remain green; review pin checks CSS/source boundaries.
5. Browser evidence at 375×812, 812×375, and 1440×900 has exact root/document viewport and console errors/warnings empty.
