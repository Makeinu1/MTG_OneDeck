# O4P-06C Acceptance Brief

Base SHA: `c33bc609449df906e3521f8d5568b2a1cfd3621e`
Contract: `research/cr-grounding/o4p-06c-browser-safe-lobby.contract.draft.md`

O4P-06C is accepted only when all of the following are executable:

1. An allowed-origin create request produces a four-seat forming lobby, creator
   seat capability, and exactly three distinct one-time invite capabilities;
   public/query/loggable values contain none of them.
2. Three claims consume only their matching invites and return three distinct
   seat capabilities. Wrong/replayed/cross-seat claims and hostile closed-shape
   inputs reject without changing the prior canonical state.
3. Each claimant can submit only its own bounded deck. A replacement resets that
   seat's ready state. Wrong capability, capability fragments in metadata,
   oversized UTF-8, malformed/accessor/sparse inputs, and invalid transitions are
   write-free failures.
4. Readiness derives `forming`/`ready` exactly. Only the immutable host can start;
   start uses the four stored real deck submissions to derive O4P-06A genesis,
   persists exactly revision 0, and returns no Core/private/bearer material.
5. Invalid deck/catalog/bootstrap/size/replay inputs leave the lobby recoverable.
   Same-genesis recovery is idempotent; conflicting genesis is rejected.
6. Lobby GET is a projection only: no invite/seat capability, deck text, private
   Core state, or configured capability fragment. Existing active room,
   command/capability, and WebSocket behavior remains compatible.
7. Exact-origin CORS and `OPTIONS` pass for the three frozen origins. Unknown,
   `null`, credentialed, alternate-port, prefix/suffix, invalid method/header,
   and malformed path cases reject before namespace lookup. No wildcard or
   credential CORS response exists. Browser-origin full-state PUT is `405`.
8. The Judge-owned
   `src/online/cloudflare/__tests__/review.o4p-06c-browser-safe-lobby.test.ts`,
   affected ordinary lobby/Cloudflare/bootstrap/protocol tests, architecture
   tests, TypeScript build, ESLint, and diff check pass.
9. A context-free cold audit reports BLOCKER/HIGH 0 on the frozen fingerprint;
   its findings record exists before the one permitted same-fingerprint full
   `npm run check`, exact-head CI/Pages, ledger shipment, and clean closure.

Expected defers: accounts/discovery/matchmaking/chat, arbitrary external decks,
O4P-06D browser socket recovery, O4P-06E public UI, and O4P-06F four-browser
production completion.
