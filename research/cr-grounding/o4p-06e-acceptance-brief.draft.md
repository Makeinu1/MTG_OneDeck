# O4P-06E acceptance brief

Base SHA: `affb28de31ab562238b74199d0469a5bacef3d73`

Contract:
`research/cr-grounding/o4p-06e-public-online-app.contract.draft.md`

## Required acceptance

1. Default public App performs no Online network/socket/timer work and preserves
   the current Solo deck library, import, resume, and active-game paths.
2. Online create and join use the exact fixed workers.dev origin and exact
   route/method/body matrix; invite material never enters a URL or persistence.
3. Create yields exactly four lobby seats, three host-visible invite codes, one
   hidden Player seat capability, and one hidden Table identity/capability.
4. Join clears its invite input after one successful exact claim. Invalid,
   stale, duplicate, accessor, sparse, oversized, and cross-Room responses fail
   with one fixed Japanese error and retain no raw/secret value.
5. A saved deck's exact ID/text can be submitted, ready can be toggled, and
   host start is unavailable until all four projected seats are complete.
6. The additive start-with-table request produces the same four-deck Core root
   plus exactly four Players and one Table with one observer authorization.
   Legacy start behavior remains green; failed initialize is retryable.
7. Player and Table browser clients use WSS paths containing only Room ID.
   Credentials remain volatile and out of snapshot, DOM (except host invite
   codes), attributes, keys, errors, storage, logs, history, and projection.
8. The host renders shipped Display Pairing/Personal/Table/Guided surfaces only
   for matching validated revisions. Other Players render the real Personal
   and Guided surfaces without a fabricated Table projection.
9. Workbench/guided automated actions enter only the shipped browser outbox;
   manual-only actions visibly remain `手動記録（未送信）`; no optimistic
   authoritative mutation or pre-ACK success claim occurs.
10. Leaving Online/unmount cancels poll/fetch, fences late callbacks, closes
    sockets, clears credentials/snapshots, and returns to unchanged Solo UI.
11. All primary controls are native keyboard-operable controls with labels,
    focus and disabled state; no pointer-only operation is introduced.
12. One stable browser session passes 375x812, 812x375, and 1440x900 with all
    required surfaces reachable, document horizontal overflow zero, and
    console error/warning zero.
13. Judge DOM and architecture reviews plus ordinary hostile tests pass. No
    production change exists outside the contract's exact write boundary.
14. Solo preservation, predecessor Online projection/protocol/browser/lobby,
    Cloudflare security, docs generator, TypeScript, ESLint, and diff checks
    remain green.
15. Independent cold audit reports BLOCKER/HIGH zero before the one release
    full check. O4P-06F production/four-browser/replay claims remain absent.
