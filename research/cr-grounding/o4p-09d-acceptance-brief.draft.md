# O4P-09D acceptance brief

Date: 2026-08-26
Base SHA: `9adc0851cd520aa09f1c50cfa266d6dbc610d9a5`

Authority boundary: the active program grants local writes for O4P-09D but
does not grant commit, push, deploy, or ship. The semantic candidate must make
the generated API bytes current and pass release preflight before cold audit.
`GENERATED-ENGINE-API.lastVerifiedCommit`, the release full check, ledger
promotion, and external shipment remain fail-closed terminal gates until a
separate O4P-09D commit/ship authority exists; their absence is not permission
to create a checkpoint commit in this cycle.

1. The D public request is an exact, versioned, prototype-safe manual intent
   with required `structured` or `freeform` mode and one member of the finite
   primitive vocabulary. Unknown fields, accessors, sparse arrays, symbols,
   unsafe text, arbitrary patches, and non-canonical IDs fail closed.
2. Move/Draw, Shuffle/Random/Reorder, Tap, Counter, Life/Mana/player counter,
   Token, Controller, Attach, Damage, Note, Manual Stack, and Manual Resolve
   have ordinary executable Core tests. Structured and Freeform replays retain
   distinct provenance while producing equal state for equal primitives.
3. The application derives actor/decision maker/sequence from the authorized
   connected seat and current revision. Self-player facts and currently
   controlled public objects are operable; another seat's facts/objects,
   unprojected IDs, invalid attachment/control targets, and non-top resolve do
   not mutate any state.
4. Own projected hand moves, own draw, and own library shuffle work without
   disclosing library order. Another hand/library, hidden identity/index, and
   executable Look/Reveal/Choose are rejected with unchanged digest, revision,
   journal, and projections.
5. A public shuffle request contains no seed, entropy, order, permutation, or
   decision ID. The server binds the authoritative current order to one
   recorded result; exact retry does not draw entropy twice; reconstruction
   replays to the exact same Core digest and projections.
6. Accepted mutations and journal persistence are atomic and consume SQLite
   mutation cursors before awaits. Stale, command-ID reuse mismatch,
   unauthorized, invalid, and persistence-failure paths never partially apply.
7. Participant and table projections validate after every primitive and show
   only allowed public facts/own identities. Capabilities, invite/Room material,
   private errors, entropy, hidden orders, raw roots, journals, and other-player
   identities are absent from transport, DOM, console, fixtures, and evidence.
8. Temporary Notes are public, normalized, bounded, capability-scanned,
   replayed/projected, and author-removable. Manual Stack entries are bounded
   public records; Manual Resolve is top-only and never claims Oracle effects.
9. The production post-Pregame path is rooted in the existing `GameScreen` and
   exposes both manual modes and all executable families through typed Japanese
   controls. Busy/offline/rejection states block duplicate accidental submits
   and provide bounded recovery guidance.
10. No `OnlineGameScreen`, `OnlineBoard`, `OnlineHand`, `OnlineStack`, second
    game reducer, optimistic Core state, client-side Core apply, or O4P-09E-J
    product behavior exists. Existing Solo and pre-D online behavior remain
    green.
11. Ordinary tests cover 2p/4p end-to-end primitive journals, final-state replay,
    entropy-once idempotency, reconstruction, hostile authority/descriptor and
    leak attacks, UI mode/choice gating, keyboard/button alternatives, and
    bounded labels.
12. The frozen local candidate passes focused tests, affected lint/type/build,
    generated-doc byte verification, release preflight, independent R3/BROAD
    cold audit with BLOCKER/HIGH zero, and 375x812, 812x375, 1440x900 browser
    evidence with overflow 0 and console error 0. The manifest reanchor,
    fingerprint-matched `npm run check`, and ledger promotion remain the
    explicitly unauthorized terminal gates described above.

Browser evidence record:
`research/cr-grounding/o4p-09d-browser-evidence.draft.md`.
