# O4P-06E local browser evidence

- Date: 2026-08-21
- Base SHA: `affb28de31ab562238b74199d0469a5bacef3d73`
- URL: `http://127.0.0.1:5173/`
- Browser: Codex in-app browser, one stable tab/session
- Scope: local public-app composition only; no create, join, Cloudflare deploy,
  production four-browser, or replay claim

## Solo and explicit Online entry

- The initial App rendered the existing Solo deck/import/resume surface.
- No Online create/join action or external request was performed by the
  evidence run.
- Activating `4人オンライン` rendered the Online root, Room/invite inputs,
  saved-deck selector, and native create/join/refresh/deck/ready/start controls.
- `一人回しに戻る` is an enabled, focusable native `button type="button"`;
  activating it returned to the Solo entry and removed the Online root.

## Stable-session viewport matrix

| Viewport | Client width | Scroll width | Horizontal overflow | Scroll height | Smallest present control | Missing controls | Console warning/error |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 375x812 | 365 | 365 | 0 | 889 | 44px | 0 | 0 |
| 812x375 | 802 | 802 | 0 | 689 | 44px | 0 | 0 |
| 1440x900 | 1440 | 1440 | 0 | 900 | 44px | 0 | 0 |

At every viewport, the Online back/create/join/refresh/deck/ready/start controls
were present and reachable by ordinary scrolling. The back control measured
44px high at all three sizes. No fixed overlay or horizontal document overflow
was observed. The same browser tab remained in use across the matrix, and its
viewport was reset after the run.

## Boundary

This evidence proves only the local O4P-06E public shell, responsive reachability,
native-control semantics, Solo return, and console/overflow observations. Exact
production Cloudflare deployment, four simultaneous real browsers, all four real
decks, reconnect/exit/replay, and final-state comparison remain O4P-06F.
