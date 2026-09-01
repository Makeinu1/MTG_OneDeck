// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import fixture from '../../../online/workbench/fixtures/o4p-04a-personal-workbench-v1.json';
import type { OnlineParticipantProjectionV1 } from '../../../online/projection';
import type { OnlineTabletopIntentEnvelopeV1 } from '../../../online/tabletopManual';
import { projectionToGameState, remoteHandActionAllowed, remoteHandActionEligibility, RemoteGameScreenActionRail, useRemoteGameScreenInteractionPort } from '../remoteGameScreen';
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
    const onSubmitTabletopIntent = vi.fn<(intent: OnlineTabletopIntentEnvelopeV1) => void>();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(
      <RemoteGameScreenActionRail
        projection={projection}
        interactionState="ready"
        busy={false}
        onSubmitTabletopIntent={onSubmitTabletopIntent}
        port={port}
      />,
    ));
    expect(container.querySelector('[data-testid="online-remote-game-rail"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="online-remote-game-rail"]')?.getAttribute('data-shared-public-digest')).toMatch(/^[0-9a-f]{64}$/u);
    expect(container.querySelector('[data-testid="online-remote-hold"]')).not.toBeNull();
    const pass = container.querySelector<HTMLButtonElement>('[data-testid="online-remote-pass"]');
    expect(pass?.disabled).toBe(false);
    act(() => pass?.click());
    expect(onSubmitTabletopIntent).toHaveBeenCalledWith(expect.objectContaining({
      baseRevision: projection.revision,
      primitive: { kind: 'priority-pass' },
    }));
    act(() => root.unmount());
    container.remove();
  });

  it('shows only the authoritative rejoined recovery outcome', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(
      <RemoteGameScreenActionRail
        projection={projection}
        interactionState="ready"
        busy={false}
        onSubmitTabletopIntent={vi.fn()}
        recoveryOutcome="rejoined"
        port={portFor(projectionToGameState(projection))}
      />,
    ));
    const status = container.querySelector('[data-testid="online-remote-connection"]');
    expect(status?.getAttribute('data-recovery-outcome')).toBe('rejoined');
    expect(status?.textContent).toContain('再接続しました');
    act(() => root.render(
      <RemoteGameScreenActionRail
        projection={projection}
        interactionState="ready"
        busy={false}
        onSubmitTabletopIntent={vi.fn()}
        recoveryOutcome={null}
        port={portFor(projectionToGameState(projection))}
      />,
    ));
    expect(container.querySelector('[data-testid="online-remote-connection"]')?.textContent).not.toContain('再接続しました');
    const disconnectedProjection = {
      ...projection,
      room: {
        ...projection.room,
        participants: projection.room.participants.map((participant, index) => index === 1
          ? { ...participant, presence: 'disconnected' as const }
          : participant),
      },
    } as OnlineParticipantProjectionV1;
    act(() => root.render(
      <RemoteGameScreenActionRail
        projection={disconnectedProjection}
        interactionState="ready"
        busy={false}
        onSubmitTabletopIntent={vi.fn()}
        port={portFor(projectionToGameState(disconnectedProjection))}
      />,
    ));
    const presence = container.querySelector('[data-testid="online-remote-presence"]');
    expect(presence?.getAttribute('data-disconnected-player-ids')).not.toBe('');
    expect(presence?.textContent).toContain('切断中');
    act(() => root.unmount());
    container.remove();
  });

  it('reports an SBA outcome explicitly only for the projected priority recipient', () => {
    const sbaProjection = {
      ...projection,
      game: {
        ...projection.game,
        assistedPriority: {
          holderPlayerId: null,
          stewardPlayerId: 'P1',
          windowKind: 'sba-check-required',
          holds: [],
          responseWindow: null,
          topStackObjectId: null,
        },
      },
    } as unknown as OnlineParticipantProjectionV1;
    const onSubmitTabletopIntent = vi.fn<(intent: OnlineTabletopIntentEnvelopeV1) => void>();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(
      <RemoteGameScreenActionRail
        projection={sbaProjection}
        interactionState="ready"
        busy={false}
        onSubmitTabletopIntent={onSubmitTabletopIntent}
        port={portFor(projectionToGameState(sbaProjection))}
      />,
    ));
    expect(container.querySelector('[data-testid="online-remote-sba-guidance"]')?.textContent).toContain('自動判定しません');
    const stable = container.querySelector<HTMLButtonElement>('[data-testid="online-remote-sba-stable"]');
    const applied = container.querySelector<HTMLButtonElement>('[data-testid="online-remote-sba-applied"]');
    expect(stable?.disabled).toBe(false);
    expect(applied?.disabled).toBe(false);
    expect(container.querySelector<HTMLButtonElement>('[data-testid="online-remote-advance"]')?.disabled).toBe(true);
    expect(container.querySelectorAll('[data-testid="online-remote-cast"]')).toHaveLength(0);
    act(() => stable?.click());
    act(() => applied?.click());
    expect(onSubmitTabletopIntent.mock.calls.map(([intent]) => intent.primitive)).toEqual([
      { kind: 'sba-check-outcome', actionsWereApplied: false },
      { kind: 'sba-check-outcome', actionsWereApplied: true },
    ]);
    act(() => root.unmount());
    container.remove();

    const wrongRecipient = {
      ...sbaProjection,
      game: {
        ...sbaProjection.game,
        assistedPriority: { ...sbaProjection.game.assistedPriority, stewardPlayerId: 'P2' },
      },
    } as unknown as OnlineParticipantProjectionV1;
    const deniedContainer = document.createElement('div');
    document.body.appendChild(deniedContainer);
    const deniedRoot = createRoot(deniedContainer);
    act(() => deniedRoot.render(
      <RemoteGameScreenActionRail
        projection={wrongRecipient}
        interactionState="ready"
        busy={false}
        onSubmitTabletopIntent={vi.fn()}
        port={portFor(projectionToGameState(wrongRecipient))}
      />,
    ));
    expect(deniedContainer.querySelector<HTMLButtonElement>('[data-testid="online-remote-sba-stable"]')?.disabled).toBe(true);
    act(() => deniedRoot.unmount());
    deniedContainer.remove();
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
    act(() => root.render(<RemoteGameScreenActionRail projection={projection} interactionState="ready" busy={false} onSubmitTabletopIntent={vi.fn()} port={portFor(projectionToGameState(projection))} />));
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
    function Harness() {
      const port = useRemoteGameScreenInteractionPort({
        projection,
        interactionState: 'ready',
        busy: false,
        onSubmitTabletopIntent,
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
    act(() => root.render(<RemoteGameScreenActionRail projection={projected} interactionState="ready" busy={false} onSubmitTabletopIntent={vi.fn()} port={port} />));
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
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RemoteGameScreenActionRail projection={heldProjection} interactionState="ready" busy={false} onSubmitTabletopIntent={onSubmitTabletopIntent} port={port} />));
    expect(container.querySelector<HTMLButtonElement>('[data-testid="online-remote-advance"]')?.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('[data-testid="online-remote-resolve"]')?.disabled).toBe(true);
    act(() => root.unmount());
    container.remove();

    const commandSpy = vi.fn<(intent: OnlineTabletopIntentEnvelopeV1) => void>();
    const commandContainer = document.createElement('div');
    document.body.appendChild(commandContainer);
    const commandRoot = createRoot(commandContainer);
    act(() => commandRoot.render(<RemoteGameScreenActionRail projection={projection} interactionState="ready" busy={false} onSubmitTabletopIntent={commandSpy} port={portFor(projectionToGameState(projection))} />));
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
      const port = useRemoteGameScreenInteractionPort({ projection, interactionState: 'ready', busy: false, onSubmitTabletopIntent });
      return <RemoteGameScreenActionRail projection={projection} interactionState="ready" busy={false} onSubmitTabletopIntent={onSubmitTabletopIntent} port={port} />;
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
    expect(remoteHandActionEligibility(responseProjection, 'PC3:0', 'cast-spell')).toMatchObject({
      allowed: false,
      reason: 'wrong-window',
    });

    const onSubmitTabletopIntent = vi.fn();
    let currentPort: GameScreenInteractionPort | null = null;
    function Harness({ candidate = responseProjection }: Readonly<{ candidate?: OnlineParticipantProjectionV1 }>) {
      currentPort = useRemoteGameScreenInteractionPort({
        projection: candidate,
        interactionState: 'ready',
        busy: false,
        onSubmitTabletopIntent,
      });
      return <RemoteGameScreenActionRail projection={candidate} interactionState="ready" busy={false} onSubmitTabletopIntent={onSubmitTabletopIntent} port={currentPort} />;
    }
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<Harness />));
    const unavailable = [...container.querySelectorAll<HTMLButtonElement>('[data-testid="online-remote-cast-unavailable"]')]
      .find((button) => button.dataset.objectId === 'PC3:0');
    expect(unavailable?.disabled).toBe(true);
    expect(container.querySelector('[data-testid="online-remote-cast-availability"][data-availability="wrong-window"]')?.textContent).toContain('メイン・フェイズ');

    act(() => currentPort?.performDrop({ kind: 'cast', cardId: 'PC3:0' }));
    expect(onSubmitTabletopIntent).not.toHaveBeenCalled();

    const heldPermissionProjection = {
      ...projection,
      game: {
        ...projection.game,
        assistedPriority: { ...projection.game.assistedPriority, holds: ['P2'] },
        playPermissions: [{
          permissionId: 'cast-through-effect',
          allowedPlayerId: 'P1',
          action: 'cast-spell',
          subject: { kind: 'object', objectId: 'PC3:0', expectedZone: { kind: 'player-zone', playerId: 'P1', zone: 'hand' } },
          duration: { kind: 'single-use' },
        }],
      },
    } as unknown as OnlineParticipantProjectionV1;
    expect(remoteHandActionEligibility(heldPermissionProjection, 'PC3:0', 'cast-spell')).toMatchObject({
      allowed: false,
      reason: 'hold-active',
    });
    act(() => root.render(<Harness candidate={heldPermissionProjection} />));
    act(() => currentPort?.performDrop({ kind: 'cast', cardId: 'PC3:0' }));
    expect(onSubmitTabletopIntent).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
  });

  it('renders a validated cast receipt without exposing private protocol state', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(
      <RemoteGameScreenActionRail
        projection={projection}
        interactionState="ready"
        busy={false}
        onSubmitTabletopIntent={vi.fn()}
        lastCommandSettlement={{
          commandId: 'remote-cast-pilot-1',
          baseRevision: 4,
          currentRevision: 5,
          acceptedRevision: 5,
          commandKind: 'tabletop',
          operation: 'cast-spell',
          outcome: 'accepted',
          issueCode: null,
        }}
        port={portFor(projectionToGameState(projection))}
      />,
    ));
    const status = container.querySelector<HTMLElement>('[data-testid="online-remote-command-result"]');
    expect(status?.dataset).toMatchObject({
      commandId: 'remote-cast-pilot-1',
      outcome: 'accepted',
      acceptedRevision: '5',
    });
    expect(status?.textContent).toContain('唱える操作を受理');
    expect(status?.textContent).not.toMatch(/capability|coreRoot|receiptDigest/u);
    act(() => root.unmount());
    container.remove();
  });

  it('exposes public priority projection facts as explicit DOM attributes', () => {
    const projected = {
      ...projection,
      game: {
        ...projection.game,
        assistedPriority: {
          holderPlayerId: 'P1',
          stewardPlayerId: 'P1',
          windowKind: 'priority',
          holds: [],
          responseWindow: null,
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
        port={portFor(projectionToGameState(projected))}
      />,
    ));
    const rail = container.querySelector<HTMLElement>('[data-testid="online-remote-game-rail"]');
    expect(rail?.dataset).toMatchObject({
      publicSeatIds: 'P1,P2,P3,P4',
      localPlayerId: 'P1',
      priorityHolderPlayerId: 'P1',
      priorityStewardPlayerId: 'P1',
      priorityWindowKind: 'priority',
      priorityHolds: '',
      recentResolutionObjectId: '',
      recentResolutionRevision: '',
    });
    act(() => root.unmount());
    container.remove();
  });

  it('renders a safe accepted or rejected priority receipt without private protocol fields', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const render = (outcome: 'accepted' | 'rejected') => root.render(
      <RemoteGameScreenActionRail
        projection={projection}
        interactionState="ready"
        busy={false}
        onSubmitTabletopIntent={vi.fn()}
        lastCommandSettlement={{
          commandId: `remote-priority-${outcome}`,
          baseRevision: 12,
          currentRevision: outcome === 'accepted' ? 13 : 12,
          acceptedRevision: outcome === 'accepted' ? 13 : null,
          commandKind: 'tabletop',
          operation: 'priority-pass',
          outcome,
          issueCode: outcome === 'accepted' ? null : 'STALE_REVISION',
        }}
        port={portFor(projectionToGameState(projection))}
      />,
    );
    act(() => render('accepted'));
    const accepted = container.querySelector<HTMLElement>('[data-testid="online-remote-priority-result"]');
    expect(accepted?.dataset).toMatchObject({ operation: 'priority-pass', outcome: 'accepted', acceptedRevision: '13' });
    expect(accepted?.textContent).toContain('優先権のパスを共有');
    expect(accepted?.textContent).not.toMatch(/capability|coreRoot|receiptDigest|STALE_REVISION/u);

    act(() => render('rejected'));
    const rejected = container.querySelector<HTMLElement>('[data-testid="online-remote-priority-result"]');
    expect(rejected?.dataset).toMatchObject({ operation: 'priority-pass', outcome: 'rejected', acceptedRevision: '' });
    expect(rejected?.textContent).toContain('共有状態は変更されていません');
    expect(rejected?.textContent).not.toMatch(/capability|coreRoot|receiptDigest|STALE_REVISION/u);
    act(() => root.unmount());
    container.remove();
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
    act(() => root.render(<RemoteGameScreenActionRail projection={projected} interactionState="ready" busy={false} onSubmitTabletopIntent={vi.fn()} port={portFor(projectionToGameState(projected))} />));
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
      const port = useRemoteGameScreenInteractionPort({ projection: projected, interactionState: 'ready', busy: false, onSubmitTabletopIntent, onSubmitSharedUndo });
      return <RemoteGameScreenActionRail projection={projected} interactionState="ready" busy={false} onSubmitTabletopIntent={onSubmitTabletopIntent} onSubmitSharedUndo={onSubmitSharedUndo} port={port} />;
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
    act(() => twoRoot.render(<RemoteGameScreenActionRail projection={twoPlayer} interactionState="ready" busy={false} onSubmitTabletopIntent={vi.fn()} port={portFor(projectionToGameState(twoPlayer))} />));
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
    act(() => fourRoot.render(<RemoteGameScreenActionRail projection={fourPlayer} interactionState="ready" busy={false} onSubmitTabletopIntent={vi.fn()} port={portFor(projectionToGameState(fourPlayer))} />));
    expect(fourContainer.querySelector('[data-testid="online-remote-outcome"]')?.textContent).toContain('P2: 敗北');
    expect(fourContainer.querySelectorAll('.online-remote-rail__opponent-lane')).toHaveLength(3);
    act(() => fourRoot.unmount());
    fourContainer.remove();
  });
});
