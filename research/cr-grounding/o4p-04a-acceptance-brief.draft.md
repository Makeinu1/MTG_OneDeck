# O4P-04A judge-owned acceptance brief

Milestone: `O4P-04A`

Base SHA: `64ac8c6de1bc62262154cebf5419ae82d13bc3cb`

Authority:
`research/cr-grounding/o4p-04a-personal-workbench.contract.draft.md`

The judge owns this brief, the frozen fixture, and every `review.*` assertion.
The implementer must not edit them.

## Required executable scenarios

1. Validate and render one active four-player Player projection. Assert the own
   seat/status/turn, four public player summaries, own hand, public battlefield,
   stack/public-zone counts, Japanese lifecycle labels, and Japanese
   `《card name》` treatment. Add valid spell-copy, activated-ability, and
   triggered-ability stack entries and assert their closed generic labels.
2. Put a named visible card in the own hand, a `hidden-card` in each opponent
   hand/library, and a concealed public object on the battlefield. Assert the
   own name is visible, hidden entries expose only generic placeholders, and
   concealed entries expose no definition/owner/controller/face/Oracle data.
3. Add unauthorized fields/text to a hidden entry, pass Table/Spectator and
   invalid Player projections, and trigger a trap-safe validation failure.
   Assert one generic unavailable state and no caller value, raw issue, path,
   error, ID, or stack in serialized DOM.
4. Assert input non-mutation, deterministic fresh deep-frozen view models, and
   preservation of projected player/zone/card order without sort/trim/dedup.
5. Trigger refresh and eligible priority-pass. Assert exact fresh frozen
   intents with only the contract fields and no Room/participant/capability/
   command/decision data.
6. Assert priority-pass and concede are disabled for updating/offline,
   inactive/finished/non-pending states. Assert a non-active-turn Player may
   still request a server-authorized pass because priority holder is omitted.
   Concede emits nothing before explicit confirmation, emits exactly once, and
   cannot emit again for the same player/revision. Open confirmation, replace
   the projection with a different Player/revision, and assert the stale
   confirmation disappears and cannot authorize the new Player.
7. Keyboard activate every action, cancel confirmation, inspect focus-visible
   labels, and assert there is no drag/double-click-only action. Exercise
   getter, descriptor, Proxy, and hostile-prototype inputs and require the same
   generic trap-safe unavailable state.
8. Architecture evidence permits only the projection barrel in the pure model
   and the workbench barrel in React. It rejects Store/Solo/GameScreen/Core
   reducer/Room/protocol/headless/Cloudflare/network/storage dependencies,
   reverse imports, root Online barrel, dependency/version/config changes, and
   production fixture reachability.
9. In one browser session, inspect the deterministic dev fixture at 375x812,
   812x375, and 1440x900. Assert no overlap/cutoff hiding the status, turn,
   players, own hand, public zones, or actions; all content remains reachable;
   browser console error count is zero.
10. Run affected tests and checks only before candidate freeze. After independent
    audit clears BLOCKER/HIGH, run one `npm run check` on the same fingerprint.

## Judge-owned evidence paths

- `src/online/workbench/fixtures/o4p-04a-personal-workbench-v1.json`
- `src/components/online/__tests__/review.o4p-04a-personal-workbench.test.tsx`
- `src/test/architecture/review.o4p-04a-personal-workbench-boundary.test.ts`

These files are outside implementer write scope.
