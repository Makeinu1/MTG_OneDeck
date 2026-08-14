# O4P-04C judge-owned acceptance brief

Milestone: `O4P-04C`

Base SHA: `4b2f4ac534c489ce92d2f3dfce4774679c597502`

Authority:
`research/cr-grounding/o4p-04c-display-pairing.contract.draft.md`

The Judge owns this brief and every `review.*` assertion. The implementer must
not edit them.

## Required executable scenarios

1. Pair a synchronized Player projection and Table projection for one Room.
   Assert exact revision/seat context, three turn-ordered opponents, no default
   focus, fresh deep freeze, no input alias, and no Room/participant/capability
   data in the paired view.
2. Focus each live opponent and assert one controlled, public Table-derived
   summary plus exact frozen `{ kind, playerId, revision }` actions. Assert the
   own Player is absent, exited opponents cannot become a new focus, and focus
   changes neither projection nor authority.
3. Reject role, Room, protocol, revision, lifecycle, participant/seat, turn,
   public Player fact/count, shared-zone, self/unknown/exited-focus, and private
   Table relaxation drift. Render only the generic Japanese unavailable state.
4. Re-render after same-reference mutation and assert the pair is recomputed;
   no valid or secret prior state remains visible.
5. Exercise getters, descriptors, hostile prototypes, symbols, sparse arrays,
   throwing/revoked Proxies, and caller error strings. Require trap-safe generic
   failure without input mutation or diagnostic/secret reflection.
6. Bind refresh to the exact accepted Projection request and pass/concede to
   exact accepted command envelopes. Assert actor, decision maker, sequence,
   decision key, payload, revision, command-ID rules, deep freeze, deterministic
   output, and source non-mutation.
7. Reject malformed session/action roots, capability/participant/Core-player
   mismatch, revision mismatch, invalid command IDs, and wrong nullability.
   Assert fixed generic errors contain no capability or caller value.
8. Render the real Workbench and Table Display under the pairing surface.
   Assert exact audience placement, Japanese sync/focus status, native keyboard
   controls, no false priority/legality/acknowledgement claim, and no hidden
   identity in DOM, labels, attributes, focus actions, or errors.
9. Architecture evidence permits only the five public barrels in the pure
   module and exact component composition. It rejects Store/Solo/GameScreen,
   Room internals, Cloudflare/headless/private files, network/storage/timer/RNG,
   reverse imports, root App/Online integration, dependency/config/version
   changes, and any unregistered Online root.
10. In one browser session, inspect the deterministic fixture at 375x812,
    812x375, and 1440x900. Assert horizontal overflow zero, no fixed overlay,
    pairing/focus/Personal/Table surfaces reachable, and console errors zero.
11. Run only affected checks before freeze. After independent BROAD audit has
    BLOCKER/HIGH zero, run one `npm run check` on the same release fingerprint.

## Judge-owned evidence paths

- `src/components/online/__tests__/review.o4p-04c-display-pairing.test.tsx`
- `src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts`

These files and the contract/audit evidence are outside implementer write
scope.
