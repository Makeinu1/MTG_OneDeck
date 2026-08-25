# O4P-09A Unified Game Surface seam contract

Date: 2026-08-25
Base SHA: `0c0c7a533fffd8e3495cf74bb7d86b827f222c2e`
Risk: R3 / STANDARD UI architecture and public interaction-port boundary

## Goal

Keep `GameScreen` as the single adaptive player root while extracting the
mode-neutral interaction and presentation seam that O4P-09B can later bind to
Local or Remote application adapters. O4P-09A preserves Solo behavior and does
not add Remote execution.

## Required architecture

1. `GameScreen` remains the only exported player-screen root. Portrait,
   landscape, and desktop continue to render one adaptive tree controlled by
   existing CSS; no viewport-specific JSX tree is introduced.
2. `GameScreenInteractionPort` is an explicit UI-facing contract. It exposes
   immutable `GameState` projection, presentation state, and named semantic
   interaction methods. It must not expose `GameStore`, Zustand, `useGameStore`,
   a generic `dispatch`, transport, protocol, Room, revision, or capability.
3. `useGameController` is the Local adapter and returns the port. Store-only
   state/actions used by current presentation components are promoted to
   explicit port fields or methods. Production components under
   `src/components/game/` must not reach through `controller.store`.
4. `GameScreen` accepts an optional injected `interactionPort` while retaining
   the current keybindings/default Local path. Both Local and injected paths
   render the same internal surface component and the same `Board`, `StackBand`,
   `SupportRow`, `HandRibbon`, `ThumbZone`, overlays, DnD, presentation, audio,
   ambient, toast, and focus-restoration layers. The dev-only UX research
   recorder is a Local diagnostic adapter, not part of the mode-neutral player
   surface: it preserves the existing Local checkpoint payload and must not be
   mounted or subscribe to Local state when an injected port is used.
5. Existing `CardView`, `TabletopSurface`, `Board`, `HandRibbon`, `StackBand`,
   `StatusBand`, and presentation primitives are reused. O4P-09A does not clone
   card, hand, board, stack, mana, target, combat, or effect rendering.
6. The default `App` call remains the Solo route and supplies no injected port.
   Solo action results, undo/redo, guided decisions, mulligan, shortcuts, drag
   intent, overlays, audiovisual events, and accessibility labels remain
   behaviorally unchanged.

## Port closure required in this slice

The port must cover the current surface without a local-store escape hatch,
including mulligan state, resolution-session presentation, trigger candidates,
guided zero-choice confirmation, ability/mana requests, stack removal/manual
completion, trigger placement, commander-ritual cue resolution at event time,
and existing `GameController` interactions.
`GameController` may remain as a compatibility type alias to the new port, but
it must not retain a `store` member.

## Non-goals

- No Remote adapter, `GameIntent`, server submission, receipt, projection,
  protocol, Worker, Room, revision, replay, or capability change.
- No Pregame lifecycle, tabletop primitive algebra, hidden-information action,
  assisted-priority policy, shared checkpoint, spectator surface, or release
  claim for O4P-09B-J.
- No `OnlineGameScreen`, `OnlineBoard`, `OnlineHand`, `OnlineStack`, alternate
  player root, visual redesign, copy of `CardView`, dependency update, CR pin
  change, `GameState` schema change, or engine semantic change.

## Verification boundary

- Judge-owned architecture review proves the explicit store-free port, one
  root/tree, Local default, anti-fork names, shared primitives, allowed paths,
  and absence of `controller.store` in production game components.
- Ordinary component tests prove injected-port rendering and current high-
  frequency interactions through explicit port methods.
- Existing Solo/UI/AV/review suites stay green. Responsive browser verification
  covers 375x812, 812x375, and 1440x900 with overflow 0 and console error 0.
- The dev-only research recorder may subscribe directly to the Local store only
  to preserve its existing checkpoint schema and `pendingGuided` payload. That
  exception must not enter `GameScreenInteractionPort`, production game
  components, or the injected-port path.
- `CommanderRitualLayer` must resolve `commander-cast` cues through an explicit
  semantic port method. It must not read the Local store, and the injected path
  must render the same cue using its own adapter projection.
- A fresh-context R3/STANDARD cold audit must return BLOCKER/HIGH zero before
  the fingerprint-matched release full check.
