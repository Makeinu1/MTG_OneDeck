# O4P-08B Public Online Journey Contract

Date: 2026-08-24
Milestone: `O4P-08B`
Base SHA: `2cde9a6d69eaa12c54ca60ef1c63444c24486b1a`
Risk: R3 / BROAD UI

## Goal

Make the chosen deck the start of play and expose one legible sequence:

`デッキ登録・選択 → 一人回し / オンライン対戦 → 部屋作成 / 招待で参加 → デッキ提出 → 準備完了 → ホストが開始`

O4P-08B binds the shipped O4P-08A shared-admission, recovery, moderation, and
structured-error capabilities to the public UI. It does not change the fixed
four-player game roster or genesis.

## Deck-first entry

- The saved-deck library remains the primary page. The global top-right
  `一人回し / 4人オンライン` mode switch is removed.
- Once a saved deck is selected, a nearby play-choice panel identifies that
  deck and offers equal primary actions `一人回し` and `オンライン対戦`.
- With no valid saved deck, neither play action pretends to be available; the
  page points to deck registration/import.
- `4人オンライン` is renamed `オンライン対戦`. O4P-08B still creates only
  four-player rooms; two/four selection remains O4P-08D after variable roster
  lands in O4P-08C.

## Online entry state machine

The public Online surface has mutually exclusive states:

1. `entry`: show `部屋を作る` and `招待で参加`. If a valid same-browser
   recovery record exists, show `進行中の対戦に戻る` before those choices.
2. `join`: accept exactly one shared invitation code. Never request Room ID.
   A valid `#online-invite=` fragment is scrubbed before use and pre-fills or
   immediately enters this path without retaining the secret in the address.
3. `lobby`: hide create/join inputs and show membership, selected deck,
   submission, ready, blockers, host controls, and leave.
4. `started`: retain the existing personal/table/guided surfaces.

Back/cancel returns one step without discarding a valid recovery record.
Explicit leave clears the record through the shipped authoritative flow.

## Staged lobby

- A persistent step indicator uses the labels `入室済み`, `デッキ提出`,
  `準備完了`, `対戦開始`. Exactly one current step is announced with
  `aria-current="step"`.
- The selected deck is shown by display name and card count. `デッキを提出`
  is the primary local action until accepted. Resolving and needs-attention are
  distinct, with retry placed beside the failing deck step.
- After acceptance, `準備完了にする` / `準備完了を取り消す` is the local
  primary action. Resubmission remains available and truthfully clears ready.
- Host start is visible only to the host. It is disabled with an adjacent exact
  blocker list such as `空席 1`, `プレイヤー2: デッキ未提出`,
  `プレイヤー3: 未準備`. Non-hosts see `ホストの開始を待っています`.
- Lobby seat cards expose only `あなた`, `ホスト`, and stable seat display
  labels `プレイヤー2` through `プレイヤー4`, plus membership, deck state,
  and readiness. Participant IDs, Room IDs, capabilities, and private deck/card
  details are never rendered.
- The local browser may show its truthful transport state (`接続中`,
  `再接続中`, `接続失敗`). Remote forming-lobby membership is labelled
  `入室済み`, not `オンライン`; O4P-08A has no remote heartbeat contract.

## Shared invitation and host controls

- The host sees one shared invitation, rendered as non-secret helper text plus
  controls `招待リンクをコピー` and `招待コードをコピー`. The raw code may
  be revealed only on an explicit `コードを表示` action and is never included
  in ordinary status/error text.
- The link uses the current Pages route plus `#online-invite=<encoded-code>`.
  Copy success/failure is announced without echoing the secret.
- Host controls call the shipped authoritative operations: `招待を再発行`,
  `参加受付を締める`, and `ロビーから外す` for occupied non-host seats.
- Kick requires an explicit confirmation naming only the seat display label.
  It is absent after start and absent for the host seat.
- Leave is available to every participant before start. Host leave warns that
  it closes the lobby; non-host leave describes only that participant's exit.

### Recovery wire compatibility

- The shipped exact `online-forming-lobby-recover-v3` request/response remains
  byte-shape compatible for cached clients and never gains a surplus field.
- O4P-08B adds `online-forming-lobby-recover-v4` / schema 4. Its guest response
  retains the v3 guest fields. Its host response retains the v3 host fields and
  adds the required non-secret boolean `admissionOpen` so the recovered UI can
  distinguish active and closed admission authoritatively.
- Deployment is Worker first, then Pages. A new client must not be published
  before the Worker accepts v4; cached v3 clients continue using the preserved
  v3 response after the Worker upgrade.

## Actionable errors

- The controller snapshot preserves structured public error fields: code,
  retryability, Japanese cause/recovery message, and correlation ID. It does
  not collapse recognized v3 failures into the old generic string.
- Errors are placed beside the responsible entry, deck, ready, start, invite,
  recovery, or moderation action. A summary alert may link/focus the field but
  does not replace the local message.
- Retry is present only when the structured result is retryable. The label
  states the recovery action (`もう一度接続`, `デッキを再確認`, `ロビーを更新`),
  not a context-free `再試行`.
- Client-side offline/timeout/invalid-response failures use distinct local
  codes/messages and a generated correlation ID when no server ID exists.
- No error, clipboard notice, analytics/debug output, rendered attribute, or
  test snapshot contains an invite, seat/table capability, private card data,
  or raw response body.

## Accessibility and responsive behavior

- All flows are keyboard reachable with visible focus. Buttons remain at least
  44px high. No essential operation depends on drag, double-click, hover, or
  right-click.
- Status is not color-only; each badge has Japanese text and an icon or shape.
- At 375x812 the lobby is one column, seat cards stack, and the local next
  action remains before host utilities. At 812x375 compact controls remain
  reachable without horizontal document overflow. At 1440x900 the content
  stays within the established 82.5rem shell.

## Prototype gate

- Before product-component edits, a production-disconnected dev fixture must
  render deck choice, online entry, recovery, host lobby, guest lobby, and
  actionable error states using the real design tokens.
- Freeze screenshots at 375x812, 812x375, and 1440x900 with console error 0.
  Product implementation begins only after the human approves the shown
  hierarchy, wording, and density.

## Exclusions

No variable roster, two-player room, 20-life option, Duel Commander rules,
deck legality enforcement, account, matchmaking, ban, remote lobby heartbeat,
or post-start kick is added in O4P-08B.
