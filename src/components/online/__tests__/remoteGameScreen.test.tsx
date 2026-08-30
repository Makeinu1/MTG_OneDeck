// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import fixture from '../../../online/workbench/fixtures/o4p-04a-personal-workbench-v1.json';
import type { OnlineParticipantProjectionV1 } from '../../../online/projection';
import type { OnlineTabletopIntentEnvelopeV1 } from '../../../online/tabletopManual';
import { projectionToGameState, remoteHandActionAllowed, RemoteGameScreenActionRail, useRemoteGameScreenInteractionPort } from '../remoteGameScreen';
import type { GameScreenInteractionPort } from '../../game/gameScreenInteractionPort';
import { GameScreen } from '../../game/GameScreen';
import { DEFAULT_KEYBINDINGS } from '../../../data/keybindings';

const projection = fixture as unknown as OnlineParticipantProjectionV1;

function portFor(state: ReturnType<typeof projectionToGameState>): GameScreenInteractionPort {
  return {
    state,
    warnings: [], triggerCandidates: [], resolutionSession: null,
    guidedDecisionActive: false, mulliganDecisionPending: false, autoAdvanceToMain: false,
    openCardMenu: vi.fn(), handleCardDoubleClick: vi.fn(), requestTapForMana: vi.fn(),
    requestActivateAbility: vi.fn(), requestDraw: vi.fn(), requestShuffleLibrary: vi.fn(),
    requestMulligan: vi.fn(), requestKeepHand: vi.fn(), requestToggleTap: vi.fn(),
    requestSetAllTapped: vi.fn(), requestResolveTop: vi.fn(), requestResolveAll: vi.fn(),
    advancePhase: vi.fn(), advanceTurn: vi.fn(), undo: vi.fn(), redo: vi.fn(),
    canUndo: false, canRedo: false, setManualTargets: vi.fn(), confirmGuidedZeroChoice: vi.fn(),
    removeStackItem: vi.fn(), completeManualResolution: vi.fn(), placePendingTriggersForPriority: vi.fn(),
    putPendingTriggerOnStack: vi.fn(), addAbilityToStack: vi.fn(), resolveCommanderRitualCue: vi.fn(() => null),
    adjustLife: vi.fn(), adjustMana: vi.fn(), clearManaPool: vi.fn(), adjustPlayerCounter: vi.fn(),
    setMaximumHandSizeOverride: vi.fn(), adjustOpponentLife: vi.fn(), adjustCommanderDamage: vi.fn(),
    proliferateAll: vi.fn(), rollDie: vi.fn(), flipCoin: vi.fn(), setAutoAdvance: vi.fn(),
    dismissTriggerCandidates: vi.fn(), clearWarnings: vi.fn(), openLibraryActions: vi.fn(),
    libraryActionsOpen: false, openZoneViewer: vi.fn(), opponentBoardOpen: false,
    openOpponentBoard: vi.fn(), closeOpponentBoard: vi.fn(), openTokenDialog: vi.fn(),
    openAttackDialog: vi.fn(), openArrangeTop: vi.fn(), openCountDialog: vi.fn(), requestConfirm: vi.fn(),
    triggerCandidateCount: 0, triggerSheetOpen: false, processTriggers: vi.fn(), closeTriggerSheet: vi.fn(),
    motionArmed: false, feedOpen: false, openFeed: vi.fn(), closeFeed: vi.fn(), overlays: null,
    shortcutsBlocked: true, transitionCue: null, dismissTransitionCue: vi.fn(), performDrop: vi.fn(), closeTransientUi: vi.fn(),
  };
}

describe('remote GameScreen adapter', () => {
  it('projects the participant view into the shared card/board state without exposing hidden cards', () => {
    const state = projectionToGameState(projection);
    expect(state?.localPlayerId).toBe('P1');
    expect(state?.zones.hand).toEqual(['PC3:0', 'PC4:0']);
    expect(state?.zones.battlefield).toContain('PC1:0');
    expect(state?.cards['PC2:0']?.faceDown).toBe(true);
    expect(state?.zones.library).toEqual([]);
  });

  it('exposes land/cast/HOLD/resolve controls through the shared surface rail', () => {
    const state = projectionToGameState(projection);
    const port = portFor(state);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(
      <RemoteGameScreenActionRail
        projection={projection}
        interactionState="ready"
        busy={false}
        onSubmitTabletopIntent={vi.fn()}
        onSubmitPersonalAction={vi.fn()}
        port={port}
      />,
    ));
    expect(container.querySelector('[data-testid="online-remote-game-rail"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="online-remote-hold"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="online-remote-pass"]')).not.toBeNull();
    act(() => root.unmount());
    container.remove();
  });

  it('keeps the remote cockpit status and manual fallback discoverable while a participant holds priority', () => {
    const projected = {
      ...projection,
      game: {
        ...projection.game,
        assistedPriority: {
          holderPlayerId: 'P1',
          stewardPlayerId: 'P1',
          windowKind: 'position-advance-ready',
          holds: ['P2'],
          responseWindow: 'after-stack-addition',
          topStackObjectId: null,
        },
      },
    } as unknown as OnlineParticipantProjectionV1;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(
      <RemoteGameScreenActionRail
        projection={projected}
        interactionState="ready"
        busy={false}
        onSubmitTabletopIntent={vi.fn()}
        onSubmitPersonalAction={vi.fn()}
        port={portFor(projectionToGameState(projected))}
      />,
    ));
    expect(container.querySelector('[data-testid="online-remote-state"]')?.textContent).toContain('優先権: あなた');
    expect(container.querySelector('[data-testid="online-remote-hold-status"]')?.textContent).toContain('他プレイヤーがHOLD中');
    expect(container.querySelector('[data-testid="online-remote-manual-fallback"]')?.textContent).toContain('Manual Resolve');
    expect(container.querySelector('a[href="#online-remote-manual-overlay"]')).not.toBeNull();
    act(() => root.unmount());
    container.remove();
  });

  it('opens and focuses the guided/manual panels from cockpit links, closing the other panel', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const guided = document.createElement('details');
    guided.id = 'online-remote-guided-overlay';
    const guidedSummary = document.createElement('summary');
    guidedSummary.textContent = 'guided';
    guided.append(guidedSummary);
    const manual = document.createElement('details');
    manual.id = 'online-remote-manual-overlay';
    const manualSummary = document.createElement('summary');
    manualSummary.textContent = 'manual';
    manual.append(manualSummary);
    act(() => root.render(<RemoteGameScreenActionRail projection={projection} interactionState="ready" busy={false} onSubmitTabletopIntent={vi.fn()} onSubmitPersonalAction={vi.fn()} port={portFor(projectionToGameState(projection))} />));
    container.append(guided, manual);
    const links = container.querySelectorAll<HTMLAnchorElement>('.online-remote-rail__manual-link');
    act(() => links[0]?.click());
    expect(guided.open).toBe(true);
    expect(document.activeElement).toBe(guidedSummary);
    act(() => links[1]?.click());
    expect(manual.open).toBe(true);
    expect(guided.open).toBe(false);
    expect(document.activeElement).toBe(manualSummary);
    act(() => root.unmount());
    container.remove();
  });

  it('mounts the production GameScreenSurface with the remote interaction port', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onSubmitTabletopIntent = vi.fn();
    const onSubmitPersonalAction = vi.fn();
    function Harness() {
      const port = useRemoteGameScreenInteractionPort({
        projection,
        interactionState: 'ready',
        busy: false,
        onSubmitTabletopIntent,
        onSubmitPersonalAction,
      });
      return (
        <GameScreen
          keybindings={DEFAULT_KEYBINDINGS}
          interactionPort={port}
          surfaceOverlay={(
            <RemoteGameScreenActionRail
              projection={projection}
              interactionState="ready"
              busy={false}
              onSubmitTabletopIntent={onSubmitTabletopIntent}
              onSubmitPersonalAction={onSubmitPersonalAction}
              port={port}
            />
          )}
        />
      );
    }
    act(() => root.render(<Harness />));
    expect(container.querySelector('[data-testid="board"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="hand-ribbon"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="online-remote-game-rail"]')).not.toBeNull();
    act(() => root.unmount());
    container.remove();
  });

  it.each([
    ['2p', projection.game.players.slice(0, 2), projection.game.zones.byPlayer.slice(0, 2)],
    ['4p', projection.game.players, projection.game.zones.byPlayer],
  ] as const)('keeps %s opponent seats as fixed public lanes', (_label, players, byPlayer) => {
    const projected = {
      ...projection,
      game: { ...projection.game, players, turnOrder: players.map((player) => player.playerId), zones: { ...projection.game.zones, byPlayer } },
    } as unknown as OnlineParticipantProjectionV1;
    const state = projectionToGameState(projected);
    const port = portFor(state);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RemoteGameScreenActionRail projection={projected} interactionState="ready" busy={false} onSubmitTabletopIntent={vi.fn()} onSubmitPersonalAction={vi.fn()} port={port} />));
    expect(container.querySelectorAll('.online-remote-rail__opponent-lane')).toHaveLength(players.length - 1);
    act(() => root.unmount());
    container.remove();
  });

  it('gates every advance/resolve path when another player holds priority and scopes command ids to a session revision', () => {
    const heldProjection = {
      ...projection,
      game: {
        ...projection.game,
        assistedPriority: { holderPlayerId: 'P1', stewardPlayerId: 'P1', windowKind: 'resolution-ready', holds: ['P2'], responseWindow: null, topStackObjectId: null },
      },
    } as unknown as OnlineParticipantProjectionV1;
    const state = projectionToGameState(heldProjection);
    const port = portFor(state);
    const onSubmitTabletopIntent = vi.fn();
    const onSubmitPersonalAction = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RemoteGameScreenActionRail projection={heldProjection} interactionState="ready" busy={false} onSubmitTabletopIntent={onSubmitTabletopIntent} onSubmitPersonalAction={onSubmitPersonalAction} port={port} />));
    expect(container.querySelector<HTMLButtonElement>('[data-testid="online-remote-advance"]')?.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('[data-testid="online-remote-resolve"]')?.disabled).toBe(true);
    act(() => root.unmount());
    container.remove();

    const commandSpy = vi.fn<(intent: OnlineTabletopIntentEnvelopeV1) => void>();
    const commandContainer = document.createElement('div');
    document.body.appendChild(commandContainer);
    const commandRoot = createRoot(commandContainer);
    act(() => commandRoot.render(<RemoteGameScreenActionRail projection={projection} interactionState="ready" busy={false} onSubmitTabletopIntent={commandSpy} onSubmitPersonalAction={vi.fn()} port={portFor(projectionToGameState(projection))} />));
    act(() => commandContainer.querySelector<HTMLButtonElement>('[data-testid="online-remote-hold"]')?.click());
    const emitted = commandSpy.mock.calls[0]?.[0];
    expect(emitted?.baseRevision).toBe(12);
    expect(emitted?.commandId).toMatch(/^remote-surface-[A-Za-z0-9]+-12-/u);
    act(() => commandRoot.unmount());
    commandContainer.remove();
  });

  it('resolves only the projected top stack item and preserves hold, busy, and steward gates', () => {
    const stackSeed = projection.game.zones.battlefield.entries.find((entry) => entry.kind === 'visible-object');
    if (stackSeed === undefined || stackSeed.kind !== 'visible-object') throw new Error('fixture needs one visible stack seed');
    const lowerId = 'STACK-LOW:0';
    const topId = 'STACK-TOP:0';
    const projected = {
      ...projection,
      game: {
        ...projection.game,
        zones: {
          ...projection.game.zones,
          stack: { count: 2, entries: [{ ...stackSeed, objectId: lowerId }, { ...stackSeed, objectId: topId }] },
        },
        assistedPriority: {
          holderPlayerId: 'P1',
          stewardPlayerId: 'P1',
          windowKind: 'resolution-ready',
          holds: [],
          responseWindow: null,
          topStackObjectId: topId,
        },
      },
    } as unknown as OnlineParticipantProjectionV1;
    const onSubmitTabletopIntent = vi.fn();
    let currentPort: GameScreenInteractionPort | null = null;
    function Harness({ candidate, busy }: Readonly<{ candidate: OnlineParticipantProjectionV1; busy: boolean }>) {
      currentPort = useRemoteGameScreenInteractionPort({
        projection: candidate,
        interactionState: 'ready',
        busy,
        onSubmitTabletopIntent,
        onSubmitPersonalAction: vi.fn(),
      });
      return null;
    }
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<Harness candidate={projected} busy={false} />));
    act(() => currentPort?.removeStackItem(lowerId));
    expect(onSubmitTabletopIntent).not.toHaveBeenCalled();
    act(() => currentPort?.removeStackItem(topId));
    expect(onSubmitTabletopIntent).toHaveBeenCalledTimes(1);
    expect(onSubmitTabletopIntent.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ primitive: { kind: 'priority-resolve' } }));

    const heldProjection = {
      ...projected,
      game: { ...projected.game, assistedPriority: { ...projected.game.assistedPriority, holds: ['P2'] } },
    } as unknown as OnlineParticipantProjectionV1;
    act(() => root.render(<Harness candidate={heldProjection} busy={false} />));
    act(() => currentPort?.removeStackItem(topId));
    expect(onSubmitTabletopIntent).toHaveBeenCalledTimes(1);

    act(() => root.render(<Harness candidate={projected} busy />));
    act(() => currentPort?.removeStackItem(topId));
    expect(onSubmitTabletopIntent).toHaveBeenCalledTimes(1);

    const otherStewardProjection = {
      ...projected,
      game: { ...projected.game, assistedPriority: { ...projected.game.assistedPriority, stewardPlayerId: 'P2' } },
    } as unknown as OnlineParticipantProjectionV1;
    act(() => root.render(<Harness candidate={otherStewardProjection} busy={false} />));
    act(() => currentPort?.removeStackItem(topId));
    expect(onSubmitTabletopIntent).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    container.remove();
  });

  it('keeps ordinary main-phase hand cast available without an alternative play-permission row and submits it', () => {
    expect(remoteHandActionAllowed(projection, 'PC3:0', 'cast-spell')).toBe(true);
    const onSubmitTabletopIntent = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    function Harness() {
      const port = useRemoteGameScreenInteractionPort({ projection, interactionState: 'ready', busy: false, onSubmitTabletopIntent, onSubmitPersonalAction: vi.fn() });
      return <RemoteGameScreenActionRail projection={projection} interactionState="ready" busy={false} onSubmitTabletopIntent={onSubmitTabletopIntent} onSubmitPersonalAction={vi.fn()} port={port} />;
    }
    act(() => root.render(<Harness />));
    const cast = container.querySelector<HTMLButtonElement>('[data-testid="online-remote-cast"]');
    expect(cast?.disabled).toBe(false);
    act(() => cast?.click());
    expect(onSubmitTabletopIntent).toHaveBeenCalledWith(expect.objectContaining({ primitive: { kind: 'cast-spell', objectId: 'PC3:0' } }));
    act(() => root.unmount());
    container.remove();
  });

  it('allows instant response on a nonempty stack but keeps other spells to active main phases', () => {
    const responseProjection = {
      ...projection,
      game: {
        ...projection.game,
        turn: { ...projection.game.turn, activePlayerId: 'P2' },
        zones: { ...projection.game.zones, stack: { ...projection.game.zones.stack, count: 1 } },
        assistedPriority: { holderPlayerId: 'P1', stewardPlayerId: 'P2', windowKind: 'priority', holds: [], responseWindow: 'after-stack-addition', topStackObjectId: 'PC1:0' },
      },
    } as unknown as OnlineParticipantProjectionV1;
    expect(remoteHandActionAllowed(responseProjection, 'PC4:0', 'cast-spell')).toBe(true);
    expect(remoteHandActionAllowed(responseProjection, 'PC3:0', 'cast-spell')).toBe(false);
  });

  it('routes a concealed public permanent to its projected controller seat', () => {
    const battlefield = projection.game.zones.battlefield.entries.map((entry) => (
      entry.kind === 'concealed-object' ? { ...entry, controllerPlayerId: 'P2' } : entry
    ));
    const projected = { ...projection, game: { ...projection.game, zones: { ...projection.game.zones, battlefield: { ...projection.game.zones.battlefield, entries: battlefield } } } } as unknown as OnlineParticipantProjectionV1;
    const state = projectionToGameState(projected);
    expect(state?.cards['PC2:0']?.controllerId).toBe('P2');
  });

  it('focuses the causal opponent and labels projected source, target, and post-resolution change', () => {
    const battlefield = projection.game.zones.battlefield.entries.map((entry) => (
      entry.kind === 'concealed-object' ? { ...entry, controllerPlayerId: 'P2' } : entry
    ));
    const projected = {
      ...projection,
      game: {
        ...projection.game,
        zones: { ...projection.game.zones, battlefield: { ...projection.game.zones.battlefield, entries: battlefield } },
        assistedPriority: {
          ...(projection.game.assistedPriority ?? {}),
          sourceObjectId: 'PC2:0',
          targetObjectIds: ['PC1:0'],
          targetPlayerIds: ['P2'],
          recentResolution: { objectId: 'PC2:0', destination: 'battlefield', acceptedRevision: 4 },
          undoAuthorizedPlayerId: 'P1',
        },
      },
    } as unknown as OnlineParticipantProjectionV1;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RemoteGameScreenActionRail projection={projected} interactionState="ready" busy={false} onSubmitTabletopIntent={vi.fn()} onSubmitPersonalAction={vi.fn()} port={portFor(projectionToGameState(projected))} />));
    expect(container.querySelector('.online-remote-rail__opponent-lane[data-focused="true"]')?.textContent).toContain('P2');
    expect(container.querySelector('[data-testid="online-remote-causal"]')?.textContent).toContain('裏向きの公開オブジェクト');
    expect(container.querySelector('[data-testid="online-remote-causal"]')?.textContent).toContain('対象:');
    expect(container.querySelector('[data-testid="online-remote-post-resolution"]')?.textContent).toContain('戦場');
    act(() => root.unmount());
    container.remove();
  });

  it('shows projected combat/damage/checkpoint facts and invokes guarded shared undo', () => {
    const projected = {
      ...projection,
      game: {
        ...projection.game,
        assistedPriority: {
          holderPlayerId: 'P1',
          stewardPlayerId: 'P1',
          windowKind: 'turn-based-action-required',
          holds: [],
          responseWindow: 'before-combat',
          topStackObjectId: null,
          undoAuthorizedPlayerId: 'P1',
        },
        combat: {
          step: 'declare-attackers',
          attackingPlayerId: 'P1',
          attacks: [{ attackerObjectId: 'PC1:0', defendingPlayerId: 'P2' }],
          blocks: [{ blockerObjectId: 'PC2:0', attackedObjectId: 'PC1:0', defendingPlayerId: 'P2' }],
        },
        commanderDamage: [{ commanderOwnerPlayerId: 'P1', commanderSlot: 0, defendingPlayerId: 'P2', damage: 7 }],
        winnerPlayerId: null,
        checkpoint: { available: true, informationExposureWarning: true },
      },
    } as unknown as OnlineParticipantProjectionV1;
    const onSubmitSharedUndo = vi.fn();
    const onSubmitTabletopIntent = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    function Harness() {
      const port = useRemoteGameScreenInteractionPort({ projection: projected, interactionState: 'ready', busy: false, onSubmitTabletopIntent, onSubmitPersonalAction: vi.fn(), onSubmitSharedUndo });
      return <RemoteGameScreenActionRail projection={projected} interactionState="ready" busy={false} onSubmitTabletopIntent={onSubmitTabletopIntent} onSubmitPersonalAction={vi.fn()} onSubmitSharedUndo={onSubmitSharedUndo} port={port} />;
    }
    act(() => root.render(<Harness />));
    expect(container.querySelector('[data-testid="online-remote-combat"]')?.textContent).toContain('攻撃指定');
    expect(container.querySelector('[data-testid="online-remote-manual-damage-link"]')?.textContent).toContain('Manual Damage');
    expect(container.querySelector('[data-testid="online-remote-commander-damage"]')?.textContent).toContain('P1 #1');
    expect(container.querySelector('[data-testid="online-remote-exposure-warning"]')?.textContent).toContain('公開情報');
    const undo = container.querySelector<HTMLButtonElement>('[data-testid="online-remote-undo"]');
    expect(undo?.disabled).toBe(false);
    act(() => undo?.click());
    expect(onSubmitSharedUndo).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    container.remove();
  });

  it('presents a two-player lethal winner and keeps three other seats visible after a four-player elimination', () => {
    const twoPlayer = {
      ...projection,
      game: {
        ...projection.game,
        players: projection.game.players.slice(0, 2).map((player) => player.playerId === 'P2' ? { ...player, life: 0, status: 'exited', exitCause: 'defeat' } : player),
        turnOrder: ['P1', 'P2'],
        winnerPlayerId: 'P1',
        combat: { step: 'declare-attackers', attackingPlayerId: 'P1', attacks: [{ attackerObjectId: 'PC1:0', defendingPlayerId: 'P2' }], blocks: [] },
      },
      room: { ...projection.room, lifecycle: 'finished', seats: projection.room.seats.slice(0, 2).map((seat) => seat.corePlayerId === 'P2' ? { ...seat, outcome: 'defeated' } : seat) },
    } as unknown as OnlineParticipantProjectionV1;
    const twoContainer = document.createElement('div');
    document.body.appendChild(twoContainer);
    const twoRoot = createRoot(twoContainer);
    act(() => twoRoot.render(<RemoteGameScreenActionRail projection={twoPlayer} interactionState="ready" busy={false} onSubmitTabletopIntent={vi.fn()} onSubmitPersonalAction={vi.fn()} port={portFor(projectionToGameState(twoPlayer))} />));
    expect(twoContainer.querySelector('[data-testid="online-remote-outcome"]')?.textContent).toContain('勝者: P1');
    expect(twoContainer.querySelectorAll('.online-remote-rail__opponent-lane')).toHaveLength(1);
    act(() => twoRoot.unmount());
    twoContainer.remove();

    const fourPlayer = {
      ...projection,
      room: { ...projection.room, seats: projection.room.seats.map((seat) => seat.corePlayerId === 'P2' ? { ...seat, outcome: 'defeated' } : seat) },
    } as unknown as OnlineParticipantProjectionV1;
    const fourContainer = document.createElement('div');
    document.body.appendChild(fourContainer);
    const fourRoot = createRoot(fourContainer);
    act(() => fourRoot.render(<RemoteGameScreenActionRail projection={fourPlayer} interactionState="ready" busy={false} onSubmitTabletopIntent={vi.fn()} onSubmitPersonalAction={vi.fn()} port={portFor(projectionToGameState(fourPlayer))} />));
    expect(fourContainer.querySelector('[data-testid="online-remote-outcome"]')?.textContent).toContain('P2: 敗北');
    expect(fourContainer.querySelectorAll('.online-remote-rail__opponent-lane')).toHaveLength(3);
    act(() => fourRoot.unmount());
    fourContainer.remove();
  });
});
