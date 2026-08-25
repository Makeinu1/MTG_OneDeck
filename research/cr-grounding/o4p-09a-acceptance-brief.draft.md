# O4P-09A acceptance brief

Date: 2026-08-25
Base SHA: `0c0c7a533fffd8e3495cf74bb7d86b827f222c2e`

1. `GameScreenInteractionPort` exists as an explicit store-free interface and
   contains every state/action needed by the existing player surface.
2. `useGameController` implements that port as the Local adapter; no production
   game component uses `controller.store`.
3. `GameScreen` remains the sole exported adaptive player root. Its default
   `App` path is unchanged and an injected port uses the same internal surface.
   The dev-only Local research recorder retains exact checkpoint payloads but
   is not mounted and does not subscribe when the port is injected.
4. Existing CardView/board/hand/stack/status/support/presentation/AV/DnD layers
   are reused. No `OnlineGameScreen`, `OnlineBoard`, `OnlineHand`, or
   `OnlineStack` source is added.
5. Explicit port methods preserve ability activation, tap-for-mana, guided zero
   choice, manual stack removal/completion, trigger placement, mulligan display,
   and resolution-session display.
6. Ordinary port/surface and HUD tests pass; all existing protected review tests
   stay green without implementer edits. Judge-owned protected fixture changes
   are projection-only migrations and preserve their prior assertions.
7. The diff changes only the frozen Judge packet, the named game-surface seam,
   the dev-only Local research adapter, ordinary tests, and Judge-owned
   protected fixture/review evidence. No engine, store semantics, online
   runtime, protocol, dependencies, configuration, CR, or unrelated product
   path changes.
8. Required responsive viewports retain the same player tree, overflow 0, and
   console error 0. Cold audit is 0/0 at BLOCKER/HIGH before full check.
