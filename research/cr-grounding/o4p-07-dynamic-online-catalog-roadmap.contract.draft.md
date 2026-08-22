# O4P-07 Dynamic Online Catalog Roadmap Contract

Date: 2026-08-22
Authority: user-ruling-2026-08-22
Base SHA: `20064643cd2a3e25c2bf80f12a538028720664f2`
Risk: R3 / BROAD
Status: Judge-owned roadmap registration; product behavior remains unchanged

## Goal

Remove the shipped four-deck/336-card catalog from the Online product boundary.
Any non-empty ordered `commander`/`main` list that can be resolved by Scryfall
and fits the existing technical size limits can be submitted without a code
release. The server freezes the resolved card definitions per Room so all four
seats share one deterministic genesis and later Scryfall changes cannot mutate
an active game.

The fixed O4P-06A catalog and four decks become regression fixtures only. They
must not remain an allowlist, production bootstrap dependency, or public deck
selector after O4P-07 completes.

## Frozen serial sequence

```text
O4P-06F (shipped)
  -> O4P-07A Dynamic Scryfall Resolution & Room Snapshots
  -> O4P-07B Arbitrary-Deck Public UI & Dynamic Genesis
  -> O4P-07C Fixed Runtime Path Removal & Production Release
```

Only one parent may be active. O4P-07A through C are registered `pending` in
both ledger collections and each depends directly on its predecessor. Product
completion is O4P-07C, not the presence of a v2 endpoint in O4P-07A.

## Frozen product semantics

- Accepted lists contain one or more entries, preserve input order, use only
  `commander` and `main`, and carry positive safe-integer quantities.
- Commander count, total size, singleton, color identity, and other EDH
  legality are not enforced by this program. Sideboards remain unsupported.
- Identical decks and identical card definitions may appear in multiple seats.
  Physical card IDs remain seat-scoped and distinct.
- The browser sends Scryfall ID, Oracle ID, section, and quantity. It never
  supplies authoritative `CardDef`, Oracle text, or a complete Core root.
- The Worker re-fetches exact Scryfall IDs and verifies returned IDs and Oracle
  IDs. No client-definition fallback exists when Scryfall is unavailable.
- The Room snapshot, ordered entry list, and digest are immutable authority for
  genesis and replay after acceptance.
- Public projections expose only `none`, `resolving`, `accepted`, or
  `needs-attention`. Structured card-specific issues are returned only to the
  authenticated submitting seat.
- Existing 262,144-byte per-seat input protection and the 1,048,576-byte
  genesis/initialization envelope remain fail-closed product limits.

## Milestone boundaries

### O4P-07A — Dynamic Scryfall Resolution & Room Snapshots

Add `online-forming-lobby-deck-submit-v2`, closed validation, idempotent
`submissionId`, server-side Scryfall resolution, seat resolution states,
private structured issues, and SQLite-backed accepted snapshots. Submitting a
replacement clears ready before external resolution; stale completion cannot
overwrite a newer submission.

Done when deterministic injected-resolver tests cover validation, 75+ IDs,
duplicates, mismatch/not-found/outage, retry, stale completion, persistence,
restart, secrecy, and size rejection. O4P-07A does not change the public deck
selector or production start path.

### O4P-07B — Arbitrary-Deck Public UI & Dynamic Genesis

Expose every locally saved/imported deck and an in-context import action in the
Online app. Submit structured v2 entries, show owner-only Japanese correction
details, derive ready/start only from four accepted snapshots, and construct
Core genesis directly from those snapshots without raw deck-text parsing or
fixed-catalog lookup.

Done when four arbitrary catalog-external decks and repeated identical decks
can reach the same deterministic revision-0 root, while zero/multiple
commanders, arbitrary totals, DFC definitions, reconnect, responsive viewports,
and console-error zero are executable. Single-operator seat switching remains
out of scope.

### O4P-07C — Fixed Runtime Path Removal & Production Release

After the served Pages client is confirmed on v2, reject legacy v1 deck submit
with an upgrade-required response, remove every production import/runtime path
from the fixed catalog, and retain the catalog only under regression-fixture
ownership. Release the exact audited fingerprint through CI, Pages, Worker,
four isolated browser contexts, served-asset inspection, and production smoke.

Done when production can start with four catalog-external decks, at least two
seats may use the same deck, the built client/Worker graphs contain no fixed
catalog, known failures are actionable only to their owner, and all terminal
release evidence is green.

## Failure and privacy boundary

Known private issue codes are `EMPTY_LIST`, `INVALID_SECTION`,
`INVALID_QUANTITY`, `INVALID_CARD_ID`, `CARD_NOT_FOUND`,
`IDENTITY_MISMATCH`, `SCRYFALL_UNAVAILABLE`, `SUBMISSION_CONFLICT`,
`STALE_RESOLUTION`, `SNAPSHOT_TOO_LARGE`, and `ROOM_GENESIS_TOO_LARGE`.
Public state never includes issue codes, entry indexes, names, IDs, deck text,
resolved definitions, capabilities, or bearer fragments. Unknown transport or
protocol failures retain the generic public message.

## Governance

Registration changes selection policy and requires a context-free BROAD audit.
Each R3 parent then receives its own frozen contract, Judge review, fresh
implementer, fresh BROAD auditor, targeted evidence, fingerprint-matched full
check, exact-head CI, and applicable Pages/Worker/browser proof. No successor
work begins until its predecessor is shipped and the worktree is clean.
