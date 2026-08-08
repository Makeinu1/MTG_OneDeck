# feel-8 land bundle tap-for-mana implementation brief

## Goal

Change the collapsed same-name basic-land bundle interaction so it behaves like
using all of the newly available basic lands for mana at once. A bundle click
remains one semantic operation: if any card is untapped, tap every card and
produce one intrinsic mana unit for each card that was untapped before the
click; if every card is already tapped, untap every card without removing mana.
This supersedes feel-5's temporary "tap without mana" behavior.

## Constraints

- Scope the automatic mana shortcut to the existing collapsed same-name basic-land bundle only.
- Use each card's existing intrinsic/basic-land mana color and amount logic; do not infer mana from the bundle name.
- Apply all tap and mana commands in one transaction/commit so undo reverts the whole bundle operation as one step.
- Preserve one `tap-changed` presentation event containing the bundle card ids.
- Preserve the expanded `×n` route, individual card click/tap-for-mana behavior, right-click menu, and drag/drop guard.
- Special/non-basic lands, color-choice or costed activated abilities, and cards outside the bundle remain on their existing individual/guided routes.
- Implementer may edit source and ordinary tests only. Do not edit `review.*`, docs, ledger, git, or this brief.

## Acceptance

1. A collapsed mixed or all-untapped basic-land bundle click taps every card and adds one mana unit per card that was untapped before the click.
2. A collapsed all-tapped bundle click untaps every card and leaves the mana pool unchanged.
3. The whole operation is one commit/undo step; undo restores both tap state and mana pool.
4. One `tap-changed` presentation event contains all bundle card ids; no duplicate event is emitted.
5. Expanded bundle cards still use the individual route, including individual mana production and context-menu access.
6. Non-basic/special lands are not auto-bundled or auto-resolved by this path.
7. Existing target tests plus `review.feel-5-land-bundle-bulk-tap.test.tsx` pass without weakening assertions; add ordinary store coverage for per-card mana and atomic undo if needed.
8. Browser evidence is collected at 375×812, 812×375, and 1440×900 with console errors/warnings empty.
