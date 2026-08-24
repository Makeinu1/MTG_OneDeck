# O4P-08D Two-Player Surfaces and Production Release Contract

Date: 2026-08-24
Milestone: `O4P-08D`
Base SHA: `bfedd42099d1d315ba13d9ace7da2498f47909fe`
Risk: `R3 / BROAD public UI + projection compatibility`

## Goal

Connect the shipped O4P-08A/B lobby journey and O4P-08C variable room/genesis
foundation into one public production flow:

`デッキ登録・選択 → 一人回し / オンライン対戦 → 2人 / 4人の部屋作成または招待参加 → デッキ提出 → 準備完了 → ホスト開始 → exact-roster対戦画面`

O4P-08D is the O4P-08 program completion boundary. It does not add a Magic
variant, deck-legality gate, account, matchmaking, team, or ban.

## Public room configuration

- The create card exposes `2人` and `4人`. Selection is explicit before create;
  the default is `2人` because it is the smallest complete Online session.
- A two-player room exposes starting life `20` and `40`, defaulting to `40`.
  A four-player room renders `開始ライフ 40（固定）`; no enabled 20-life
  control exists for four players.
- Creation uses the shipped exact public v5 request and accepts only `(2,20)`,
  `(2,40)`, `(4,40)`. The configuration becomes immutable after admission.
- Lobby and started headers show `2人・開始ライフ20` / `2人・開始ライフ40` /
  `4人・開始ライフ40`. Joiners learn this only from the secret-free
  authoritative projection, never from invitation text supplied by the sender.
- The normal join path remains one shared invitation and never asks for Room ID.

## Additive client and recovery boundary

- Preserve public controller v1/v2, create v3, recovery v3/v4, and projection
  v1/v2 bytes. Add a public variable-room controller/projection boundary that
  validates lobby projection v4 and create/recover v5 exactly.
- New rooms created by this UI always use create v5. Existing v1 recovery
  records remain readable through the legacy v4 recovery path. Variable-room
  recovery stores an exact versioned record so reload/restart chooses recover
  v5 without probing credentials against unrelated schemas.
- Recovery storage contains only room, participant, seat authority, host/table
  authority when applicable, and the wire-generation discriminator. It never
  stores an invitation bearer or private card projection.
- Create/join/recover/refresh/moderation/deck/ready/start responses are closed,
  bounded, secret-checked, and configuration-consistent. A response cannot
  change player count or starting life mid-session.

## Full exact-roster game projection

- O4P-08C's minimal variable projection v2 remains byte-compatible. Add a full
  variable participant projection for browser play rather than widening v2.
- The full variable projection carries the same public/private game facts and
  hidden-information guarantees required by projection v1, plus immutable
  configuration and an exact dense roster of length 2 or 4.
- Player and table WebSocket clients validate either legacy full projection v1
  or the new full variable projection. Unknown versions, sparse arrays,
  configuration/room/Core mismatches, surplus fields, and secret fragments fail
  closed.
- Personal Workbench, Table Display, Display Pairing, and Guided Actions accept
  both validated full projection generations. They derive all player/opponent,
  defender, correction, zone, focus, and status rows from `turnOrder` and the
  exact roster. A two-player view has one opponent and no P3/P4 state or copy.
- Existing four-player display order and hidden-information behavior remain
  unchanged.

## Lobby and started-surface behavior

- Lobby seat cards iterate the authoritative configured seats. Two-player rooms
  render exactly two seat cards; four-player rooms exactly four.
- Empty-seat/start blockers count only configured seats. A ready two-player
  room enables host start after P1/P2 are accepted and ready.
- The selected deck summary remains cardinality-based and accepts the already
  shipped arbitrary positive list sizes, including 40/60/100 and zero commander.
- After start, the exact-roster pairing remains keyboard/touch operable. Focus,
  guided choices, life/correction targets, and table summaries never fabricate
  absent players. Existing explicit action buttons remain the alternative to
  drag/double-click/right-click interactions.

## Responsive and production release gate

- One stable browser session proves 375x812, 812x375, and 1440x900 for create,
  two-player lobby, four-player lobby, and started exact-roster surfaces with
  horizontal document overflow 0 and console errors 0.
- Isolated browser contexts prove two-player 20, two-player 40, and four-player
  40 create/join/submit/ready/start. At least one two-player flow also proves
  reload recovery, host kick, invitation rotation, actionable error, and old
  credential invalidation.
- Judge review, fresh-context R3/BROAD cold audit, fingerprint-matched full
  check, Worker-first compatibility, exact-head Actions/Pages, served asset
  checks, production smoke, and clean worktree are all required.

## Exclusions

No Duel Commander, construction legality, ban list, sideboard rules, accounts,
matchmaking, teams, persistent ban, post-start kick, or guaranteed persistence
after every private window closes.
