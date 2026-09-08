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

2026-09-09: exercised the local app at 1440×900 through the normal import and game controls, using a 100-card test list resolved from public card names (duplicates used for repeatable sampling; not a singleton legality fixture).

- Import, keep, draw, land play, mana payment, commander cast/resolve and the existing commander presentation worked. Undo returned the commander to Stack; redo restored the battlefield.
- Scry destination and library search selection survived board peek/return without confirming. Search moved the selected Sol Ring to hand, then normal casting and resolution placed it on the resource row.
- The manual Beast Within journey kept its source pending while moving Sol Ring to the graveyard and creating a 3/3 Beast; returning and completing resolution moved the spell to the graveyard. This is manual evidence, not automatic rules coverage.
- A 17-card hand opened in the existing full hand workspace and returned to the board. Turn advance, contextual counters, dark/light themes and snapshot reload/resume were exercised.
- 375×812 and 812×375 showed PC guidance. A key-time guard prevents a hidden draw during a viewport transition. Small-screen gameplay remains outside MVP.
- Relevant DOM, solo preservation, shared/remote surface, dialogs, land layout, presentation, public-client and boundary tests passed, together with TypeScript, targeted ESLint and a Pages-base production build. Two new behavior tests cover pending-choice retention and hidden-shortcut rejection.

The final-main integration exposed an existing barrel cycle: v3 called the realm resolver before Vite had initialized the barrel's import.meta.env. Moving the identical resolver/constants to runtimeRealm.ts removed the startup cycle. The production/rehearsal behavior is unchanged; independent review and the existing sensitive-file boundary scan include the extracted file. The corrected fresh reload showed no new console errors.

Publication is gated by the matching exact-SHA deploy-pages CI. Local checks and the prototype's previous PASS are not publication evidence; the task's release report supplies the matching run and public URL.
