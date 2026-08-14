# O4P-04B judge-owned acceptance brief

Milestone: `O4P-04B`

Base SHA: `36237478838695e4cb1753bafaba0bc1aa4fa8f4`

Authority:
`research/cr-grounding/o4p-04b-table-display.contract.draft.md`

The judge owns this brief, the frozen fixture, and every `review.*` assertion.
The implementer must not edit them.

## Required executable scenarios

1. Validate and render one active four-player Table projection. Assert Table
   presence/Room state/turn, four public Player summaries, public battlefield,
   stack/exile/command zones, Japanese lifecycle/presence labels, and Japanese
   `《card name》` treatment.
2. Add valid spell-copy, activated-ability, and triggered-ability stack entries
   and assert their closed generic Japanese labels without definition/runtime/
   source/target/choice/legality reconstruction.
3. Put hidden cards in every hand/library and a concealed object in a public
   zone. Assert the view and DOM retain only private-zone counts, omit every
   private-zone entry, and expose only generic public concealed facts.
4. Pass Player/Spectator projections, relation drift, a hidden shared-zone
   value, misplaced synthetic stack object, and unauthorized hidden fields.
   Assert one generic unavailable state and no caller value, raw issue, path,
   error, ID, or stack in serialized DOM.
5. Assert input non-mutation, deterministic fresh deep-frozen view models, and
   preservation of projected Player/shared-zone/card order without sort, trim,
   deduplication, merge, or previous-state retention.
6. Assert the UI labels the active Player only as the turn player and states
   that priority-holder information is absent. It must not claim or infer a
   priority holder.
7. Assert the component has exactly one `projection` prop and renders no
   button, form, editable control, callback-driven action, drag/drop, or
   double-click behavior.
8. Exercise getter, descriptor, Proxy, and hostile-prototype inputs and require
   the same generic trap-safe unavailable state.
9. Architecture evidence permits only the projection barrel in the pure model
   and the Table Display barrel in React. It rejects Store/Solo/GameScreen/Core
   reducer/workbench/Room/protocol/headless/Cloudflare/network/storage
   dependencies, reverse imports, root Online barrel, dependency/version/config
   changes, and production fixture reachability.
10. In one browser session, inspect the deterministic dev fixture at 375x812,
    812x375, and 1440x900. Assert no overlap/cutoff hiding status, priority
    boundary, Players, or public zones; all content remains reachable; browser
    console error count is zero.
11. Run affected tests and checks only before candidate freeze. After independent
    audit clears BLOCKER/HIGH, run one `npm run check` on the same fingerprint.

## Judge-owned evidence paths

- `src/online/tableDisplay/fixtures/o4p-04b-table-display-v1.json`
- `src/components/online/__tests__/review.o4p-04b-table-display.test.tsx`
- `src/test/architecture/review.o4p-04b-table-display-boundary.test.ts`

These files are outside implementer write scope.
