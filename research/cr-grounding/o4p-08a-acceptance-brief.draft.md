# O4P-08A Acceptance Brief

Date: 2026-08-23
Base SHA: `2c338a69f41eb693696db12c086e706423679aa6`
Risk: R3 / BROAD

1. One v3 create returns one shared invite code while per-seat invite values are
   absent from every public response. Three distinct claims with that code fill
   P2-P4 in order and receive distinct seat capabilities; a fourth is
   `ROOM_FULL`.
2. Close, rotate, current/retired/unknown invite, started lifecycle, duplicate
   participant, malformed envelope, rate/service failure, and exact HTTP status
   mappings are distinct, closed, deterministic, and secret-free.
3. Host-only rotation/close/kick rejects cross-seat and non-host credentials.
   Kick cannot target host or started Room, atomically frees/rekeys the seat,
   clears all old deck/readiness bytes, and old recovery yields
   `CREDENTIAL_KICKED`.
4. Non-host leave rekeys/frees the seat. Host leave deletes the forming lobby,
   admission, and deck state. Started leave remains rejected.
5. Recover after repository/DO/controller recreation returns the same seat and
   private authority. Wrong credentials never adopt projection. Host recovery
   receives current invite and Table credentials; non-host recovery does not.
6. Recovery storage survives controller recreation/reload simulation; ordinary
   disconnect retains it; leave/close/kick/terminal authority rejection clears
   it; transient offline/service failure retains it; hostile storage is ignored
   and cleared without executing getters.
7. Fragment invite parsing is canonical, scrubs before fetch, and no shared/
   seat/Table capability or eight-character fragment appears in URL after
   exchange, projection, errors, facts, logs, deck metadata, or serialized Core.
8. Existing O4P-07 v2 submit, ready, dynamic start, four-browser, replay,
   security, and public-app tests remain green; no two-player or layout claim is
   made.
9. Targeted lobby, Cloudflare runtime/persistence, public-app/recovery, security,
   and architecture reviews pass; fresh Sol/high BROAD audit reports
   BLOCKER/HIGH zero before one fingerprint-matched full `npm run check`.
