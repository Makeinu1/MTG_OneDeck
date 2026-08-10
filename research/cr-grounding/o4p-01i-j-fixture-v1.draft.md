# O4P-01I-J Fixture and Round-Trip Assets

Status: implemented-not-integrated.

## Scope

This additive fixture slice exercises the frozen O4P-01I stack announcement
contract at `research/cr-grounding/o4p-01i-stack-announcement.contract.draft.md`.
It does not add production APIs, indexes, review evidence, ledger state, or
integration wiring. The registry input is the existing O4P-01H-compatible
four-player fixture at
`src/engine/core/object/fixtures/object-registry-v2.json`.

## Fixture pins

- `stack-announcement-v1.json` uses the exact O4P-01H stack order from bottom to
  top: card spell, spell copy, activated ability, triggered ability; the record
  key tail is the stack top.
- The four records cover card mode, spell-copy player target, activated and
  triggered ability text snapshots, repeated mode keys, multiple target groups,
  X equal to zero and positive X, object and player targets, a historical object
  target, an alternative cost, repeated additional costs, and distribution.
- Oracle text is intentionally short fixture text and contains no secrets or
  long card text. Historical references are structural snapshots only.

## Verification

`stackAnnouncementFixtureV1.test.ts` independently asserts valid JSON,
four-player registry compatibility, exact stack-key order, exact kind parity,
and the required choice categories.

`stackAnnouncementRoundTripV1.test.ts` validates canonical JSON round-trip,
deep-freeze of returned values, input nonmutation, factory parity, and explicit
acceptance of a historical object target.

## Deferred

This slice does not integrate the announcement root into a production state,
command, event, UI, review, ledger, or release workflow. O4P-01J owns atomic
stack commit, retarget, and removal.
