# v0.41 Cockpit — playable solo migration

User authorization: 2026-09-09, this task. Implement and publish the solo Cockpit before expanding to two/four-player play. Preserve the existing command, choice, history, deck and audiovisual capabilities, especially the commander ritual.

- Goal: play an actual imported deck through the v0.41 composition using the existing GameScreen/controller.
- Non-goals: new rules, new storage format, multiplayer orchestration, new HOLD semantics, mobile gameplay, a second game engine.
- Acceptance: import/start/mulligan; draw, land and commander cast/resolve; contextual and manual operations; Stack/board return; undo/redo; saved-game resume; existing 50 capability groups remain reachable; desktop composition and small-screen PC guidance; targeted checks and exact-SHA release CI/Pages.
- Untouched: original checkout's uncommitted online work, Core, store, persistence schemas, remote projection/protocol, the isolated prototype.

The reference is the final v0.41 prototype and UI constitution in the `モックアップ作成` task (01a05df1-4c8a-7f61-bb08-de5808d67ac2). Its fixed card data and simulated commands are not product code. The solo migration reuses real card identity, action catalog, controller overlays and presentation runtime.

## Preserved capabilities

The original 50-group inventory is traced through these unchanged owners. Capability preservation does not imply all-card rule automation.

| Groups | Live owner |
| --- | --- |
| 01–05 import, saved decks, snapshot resume, mulligan, deck analysis/keys | App, ImportScreen, SavedDeckLibrary, MulliganStage |
| 06–14 inspection, hand workspace, draw/library, arrange/search/fetch | GameCard/CardPreview, HandRibbon, gameController/dialogs |
| 15–24 actions, mana/tap, bundles, zone moves, counters/faces/attachments, drag | actionCatalog, gameController, Board/LandRow, dragIntent |
| 25–34 cast/payment/targets/choices, abilities, Stack, triggers/manual resolution | gameController and existing overlays, StackBand, DecisionBar, TriggerSheet |
| 35–41 commanders, life/mana/player counters, tokens, combat, opponent setup | CommanderAltar, LifeSheet, dialogs, OpponentSetupScreen |
| 42–50 progress, cleanup, both histories, feed, manual effects, tools, preferences and feedback | ThumbZone, CleanupDiscardDialog, gameController, Feed, AudioVisualProvider and presentation layers |

## Evidence

In progress. Do not interpret the prototype's previous PASS or this connection plan as shipped evidence.
