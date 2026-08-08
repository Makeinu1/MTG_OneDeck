# feel-5 land bundle bulk tap implementation brief

## Goal

Close the UI friction where a same-name basic-land bundle requires tapping cards one at a time. A collapsed multi-card bundle click is one semantic operation: if any card is untapped, tap every card; if all are tapped, untap every card.

## Constraints

- Preserve the expanded `×n` route and each card's normal click/right-click menu.
- Use existing `setTapped` commands through one `applyCommands` call and one store commit, so undo is exactly one snapshot.
- Do not produce mana. Publish one `tap-changed` event with all changed card ids through the existing controller presentation boundary.
- Do not change card dimensions, land grouping, drag/drop behavior, or audio allowlist.
- Implementer may edit source and ordinary tests only. Do not edit `review.*`, docs, ledger, git, or this brief.

## Acceptance

1. Collapsed multi-card bundle click toggles all cards using one commit/undo step.
2. Mixed state resolves to all tapped; all-tapped resolves to all untapped.
3. One `tap-changed` presentation event contains all affected ids; no event for a no-op.
4. Mana pool is unchanged.
5. Expanded bundle leaves individual card click and context-menu paths intact.
6. Existing target tests plus `review.feel-5-land-bundle-bulk-tap.test.tsx` pass; no review assertion is weakened.
7. Browser evidence is collected at 375×812, 812×375, and 1440×900 with console errors/warnings empty.
