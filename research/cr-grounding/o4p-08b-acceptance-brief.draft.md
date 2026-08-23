# O4P-08B Acceptance Brief

Date: 2026-08-24
Base: `2cde9a6d69eaa12c54ca60ef1c63444c24486b1a`

## Prototype acceptance before product edits

- Dedicated dev fixture only; production `App` and `PublicOnlineApp` bytes are
  unchanged.
- Deterministic states: deck choice, Online entry, recovery offer, host lobby,
  guest lobby, and localized actionable error.
- Human-readable screenshot evidence at 375x812, 812x375, and 1440x900;
  document overflow 0 and console errors 0.
- Human approval explicitly freezes hierarchy, copy, and density before the
  production implementation brief is authorized.

## Product acceptance after approval

1. A saved deck is selected before `一人回し` and `オンライン対戦` appear as
   equal actions; `4人オンライン` no longer appears.
2. Normal joining requests one invitation only and never renders or inputs a
   Room ID. A fragment invite is scrubbed before exchange.
3. Entry/create/join controls disappear after admission. The lobby advances
   through the four named steps and puts the current action next to its state.
4. Reload/browser restart exposes `進行中の対戦に戻る`; recover rejoins the
   same participant/seat. Explicit leave, kick, expiry, and terminal invalid
   credentials clear recovery.
5. Host can copy link/code, rotate/close admission, kick a non-host before
   start, and start only when exact blockers are empty. Non-host moderation and
   post-start kick are not rendered and fail authoritatively if invoked.
6. Kick clears the seat projection to empty. The old client receives the
   localized credential-kicked cause/recovery action without secret material.
7. Each server failure displays cause, recovery action, retryability behavior,
   and correlation ID beside the relevant action. Offline, timeout, invalid
   response, and client upgrade remain distinguishable.
8. Seat cards render stable display labels, membership, deck state, and ready
   state without participant/Room IDs, capabilities, or private card details.
9. Existing four-player arbitrary-deck submit/ready/start and started
   workbench/table/guided surfaces regress green.
10. Keyboard, focus, 44px targets, 375x812, 812x375, 1440x900, overflow 0,
    console errors 0, and no drag/double-click-only operation are verified in
    one stable browser session after implementation.

Any failed scenario reruns from its first step after repair. O4P-08B cannot
claim variable roster or two-player play.
