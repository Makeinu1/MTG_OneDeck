import { Script } from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  O4P09I_DEFAULT_TIMEOUT_MS_V1,
  O4P09I_MAX_TRANSPORT_TIMELINE_ENTRIES_V1,
  O4P09I_PAGES_ORIGIN_V1,
  O4P09I_PUBLIC_DECK_TEXTS_V1,
  O4P09I_START_SURFACE_TIMEOUT_MS_V1,
  O4P09I_WORKER_ORIGIN_V1,
  classifyO4p09iProductionFailureV1,
  resolveO4p09iJourneyResultPathV1,
  writeO4p09iJourneyFailureV1,
  runO4p09iFullMatchEvidenceV1 as runO4p09iFullMatchEvidenceProductionV1,
  runO4p09iFullMatchEvidenceTestDriverV1 as runO4p09iFullMatchEvidenceV1,
  runO4p09iReliabilityEvidenceTestDriverV1,
  validateO4p09iFullMatchEvidenceV1,
  validateO4p09iReliabilityEvidenceV1,
  type O4p09iBrowserV1,
  type O4p09iContextV1,
  type O4p09iPageV1,
} from '../../../../scripts/online/o4p-09i-full-match-evidence';

type FakeOptions = Readonly<{
  readonly missingControl?: string;
  readonly savedStateError?: boolean;
  readonly savedResolutionPending?: boolean;
  readonly savedResolutionError?: boolean;
  readonly missingSaveNotification?: boolean;
  readonly freshCreateRemount?: boolean;
  readonly savedImportRuntimeFailure?: boolean;
  readonly savedImportRuntimeError?: boolean;
  readonly alreadyOnline?: boolean;
  readonly productErrorBoundary?: boolean;
  readonly importSurfaceDisappeared?: boolean;
  readonly invalidWorkflow?: boolean;
  readonly hiddenControl?: string;
  readonly overflow?: number;
  readonly stagnantRevision?: boolean;
  readonly stagnantPhase?: boolean;
  readonly twoPlayerActionsBeforeMain?: number;
  readonly fourPlayerActionsBeforeMain?: number;
  readonly missingWinner?: boolean;
  readonly missingWorker?: boolean;
  readonly leak?: boolean;
  readonly privateChoiceLeak?: boolean;
  readonly privateChoiceCandidateLeak?: boolean;
  readonly privateChoiceCandidateLeakBeyondBound?: boolean;
  readonly privateChoiceScanBoundExceeded?: boolean;
  readonly privateChoiceCandidateTokenLeak?: boolean;
  readonly privateChoiceCaptureBoundExceeded?: boolean;
  readonly leakScanBoundExceeded?: boolean;
  readonly geometryFailure?:
    | 'vertical-collision' | 'offscreen-panel' | 'inaccessible-scroll' | 'non-scrollable' | 'focus-inaccessible' | 'obscured-battlefield' | 'clipped-primary';
  readonly consoleErrors?: number;
  readonly consoleWarnings?: number;
  readonly consoleSecretViolations?: number;
  readonly consoleWarningContext?: number;
  readonly consoleSecretContext?: number;
  readonly consoleWarningReplacement?: boolean;
  readonly consoleSecretReplacement?: boolean;
  readonly closeFailure?: boolean;
  readonly asyncInviteRender?: boolean;
  readonly roomCreationRetryableError?: boolean;
  readonly asyncStartProbe?: boolean;
  readonly pregameReadyRevisionMissing?: boolean;
  readonly pregameTerminalSurfaceFailure?: boolean;
  readonly delayedDetailsMount?: boolean;
  readonly manualStackEnabledSeat?: number;
  readonly manualStackEnabledSeats?: readonly number[];
  readonly manualResolveEnabledSeats?: readonly number[];
  readonly manualStackEnabledProbeNeverSettles?: boolean;
  readonly advanceEnabledSeat?: number;
  readonly advanceEnabledSeats?: readonly number[];
  readonly sbaEnabledSeats?: readonly number[];
  readonly progressRejected?: boolean;
  readonly actorRevisionOffsetSeat?: number;
  readonly actorRevisionUnsafeSeat?: number;
  readonly priorityHoldEnabledSeats?: readonly number[];
  readonly priorityPassEnabledSeats?: readonly number[];
  readonly priorityResolveEnabledSeats?: readonly number[];
  readonly priorityActorRevisionOffsetSeat?: number;
  readonly priorityActorRevisionUnsafeSeat?: number;
  readonly priorityEnvironmentFailure?: boolean;
  readonly priorityHoldStuck?: 'off' | 'on';
  readonly missingPriorityReceipt?: boolean;
  readonly missingResolutionEvidence?: boolean;
  readonly missingRejoined?: boolean;
  readonly peerPresenceStuck?: boolean;
  readonly reconnectDigestDivergentSeat?: number;
  readonly reconnectPrivateLeakSeat?: number;
  readonly missingPriorityDomAttribute?: 'public-seat-ids' | 'local-player-id' | 'window-kind';
  readonly divergentPhaseSeat?: number;
  readonly startedSurfaceFailure?:
    | 'game-screen-missing/count' | 'horizontal-overflow' | 'opponent-leak' | 'console-error' | 'host-revision-missing' | 'start-rejected' | 'start-pending' | 'start-not-accepted';
  readonly lobbyReadyProbe?: 'delayed' | 'never';
  readonly progressStuckAfterClick?: boolean;
  readonly actorReadinessBlock?: 'not-open' | 'pending' | 'revision-lag' | 'app-busy';
  readonly transportSurfaceMissing?: boolean;
  readonly actorWindowDivergentSeat?: number;
  readonly postPregameResyncProbes?: number;
  readonly postMutationHostLagProbes?: number;
  readonly postMutationTransportRevisionLagThenTimeout?: boolean;
}>;

function fakeBrowser(expressions: string[], options: FakeOptions = {}): O4p09iBrowserV1 {
  let contextIndex = 0;
  const sharedRevisions = [0, 0];
  const disconnectedSeats = [new Set<number>(), new Set<number>()];
  const recoveredScenarios = [false, false];
  const sharedPhases = ['beginning', 'beginning'];
  const progressWindows: Array<'advance' | 'sba'> = ['advance', 'advance'];
  const progressCompletions = [0, 0];
  const progressActionCounts = [0, 0];
  const priorityActors = [0, 0];
  const priorityPassCounts = [0, 0];
  const priorityHoldSeats = [new Set<number>(), new Set<number>()];
  const castStates: Array<{ topObjectId: string | null; acceptedRevision: number | null; senderSeat: number | null }> = [
    { topObjectId: null, acceptedRevision: null, senderSeat: null },
    { topObjectId: null, acceptedRevision: null, senderSeat: null },
  ];
  const prioritySettlements: Array<{
    operation: 'priority-hold' | 'priority-pass' | 'priority-resolve';
    baseRevision: number;
    acceptedRevision: number;
    senderSeat: number;
  } | null> = [null, null];
  const postResolutions: Array<string | null> = [null, null];
  const pregameStates = [{ phaseIndex: 0, actorIndex: 0 }, { phaseIndex: 0, actorIndex: 0 }];
  const postPregameResyncProbeCounts = [0, 0];
  const postMutationHostLagProbeCounts = [0, 0];
  const pregameControls = ['pregame-confirm-commanders', 'pregame-keep', 'pregame-complete-actions', 'pregame-ready'];
  const page = (contextOrdinal: number, pageOrdinal: number): O4p09iPageV1 => {
    let revealButtonProbes = 0;
    let inviteReads = 0;
    let startClicks = 0;
    let startedSurfaceProbes = 0;
    let lobbyReadyProbes = 0;
    let detailsProbes = 0;
    let settlementTransportProbes = 0;
    let authoritativeRejoined = false;
    let recoveryRequested = false;
    const scenarioIndex = contextOrdinal >= 2 ? 1 : 0;
    const seatIndex = scenarioIndex === 0 ? contextOrdinal : contextOrdinal - 2;
    const manualStackEnabledSeats = options.manualStackEnabledSeats ?? [
      options.manualStackEnabledSeat ?? 0
    ];
    const manualResolveEnabledSeats = options.manualResolveEnabledSeats ?? manualStackEnabledSeats;
    const advanceEnabledSeats = options.advanceEnabledSeats ?? [options.advanceEnabledSeat ?? 0];
    const actorControlRevision = (): number =>
      options.actorRevisionUnsafeSeat === seatIndex
        ? Number.NaN
        : sharedRevisions[scenarioIndex] + (options.actorRevisionOffsetSeat === seatIndex ? 1 : 0);
    const priorityControlRevision = (): number =>
      options.priorityActorRevisionUnsafeSeat === seatIndex
        ? Number.NaN
        : actorControlRevision() + (options.priorityActorRevisionOffsetSeat === seatIndex ? 1 : 0);
    const actorReadiness = () => {
      const transientPregameResync = seatIndex === 1
        && pregameStates[scenarioIndex].phaseIndex >= pregameControls.length
        && postPregameResyncProbeCounts[scenarioIndex]++ < (options.postPregameResyncProbes ?? 0);
      return ({
      playerPhase: options.actorReadinessBlock === 'not-open' || transientPregameResync ? 'resyncing' : 'open',
      pendingCount: options.actorReadinessBlock === 'pending' || (options.progressStuckAfterClick === true && progressActionCounts[scenarioIndex] > 0) ? 1 : 0,
      knownRevision: actorControlRevision() + (options.actorReadinessBlock === 'revision-lag' ? 1 : 0),
      projectionRevision: actorControlRevision(),
      appBusy: options.actorReadinessBlock === 'app-busy' ? 'tabletop' : '',
      projectionRequestsSent: 1,
      projectionFramesReceived: options.actorReadinessBlock === 'not-open' ? 0 : 1,
      projectionFramesAccepted: options.actorReadinessBlock === 'not-open' ? 0 : 1,
      projectionFramesRejected: 0,
    });
    };
    let viewportWidth = 1440;
    let viewportHeight = 900;
    return {
    navigate: () => Promise.resolve(),
    evaluate: <T>(expression: string, argument?: unknown): Promise<T> => {
      expressions.push(expression);
      const missingControl = options.missingControl ?? '__missing__';
      if (expression.includes(`data-testid="${missingControl}"`) && !(missingControl === 'open-online-mode' && expression.includes('savedDeckProbe'))) return Promise.reject(new Error('visible control missing'));
      const hiddenControl = options.hiddenControl ?? '__hidden__';
      if (expression.includes(`data-testid="${hiddenControl}"`)) return Promise.reject(new Error('visible control hidden'));
      if (expression.includes('visibleControlProbe:online-invite-link-copy')) return Promise.resolve((options.roomCreationRetryableError !== true) as T);
      if (expression.includes('visibleControlProbe:')) return Promise.resolve(true as T);
      if (expression.includes('visibleFailureStateProbe:online-error')) return Promise.resolve((options.roomCreationRetryableError === true ? 'retryable-error' : 'none') as T);
      if (expression.includes('import-screen__save-status--error') && !expression.includes('savedDeckProbe')) return Promise.resolve((options.savedStateError === true ? 'storage-error' : 'ready') as T);
      if (expression.includes('savedDeckProbe')) {
        if (options.savedStateError === true) return Promise.resolve('storage-error' as T);
        if (options.savedResolutionError === true) return Promise.resolve('resolution-error' as T);
        if (options.missingSaveNotification === true) return Promise.resolve('notification-missing' as T);
        if (options.productErrorBoundary === true) return Promise.resolve('error-boundary' as T);
        if (options.alreadyOnline === true) return Promise.resolve('already-online' as T);
        if (options.freshCreateRemount === true) return Promise.resolve('ready' as T);
        if (options.savedImportRuntimeFailure === true || options.savedImportRuntimeError === true || options.importSurfaceDisappeared === true || options.invalidWorkflow === true) return Promise.resolve('pending' as T);
        return Promise.resolve((options.savedResolutionPending === true ? 'pending' : 'ready') as T);
      }
      if (expression.includes('savedDeckTerminalProbe')) {
        if (options.savedImportRuntimeFailure === true) return Promise.resolve('import-runtime-failed' as T);
        if (options.productErrorBoundary === true) return Promise.resolve('error-boundary' as T);
        if (options.importSurfaceDisappeared === true) return Promise.resolve('import-surface-disappeared' as T);
        if (options.invalidWorkflow === true) return Promise.resolve('invalid-workflow' as T);
        if (options.savedResolutionPending === true) return Promise.resolve('resolution-pending' as T);
        return Promise.resolve('saved-state' as T);
      }
      if (expression.includes('pregameTerminalSurfaceProbe')) {
        return Promise.resolve((options.pregameReadyRevisionMissing === true && options.pregameTerminalSurfaceFailure !== true) as T);
      }
      if (expression.includes('playerTransportSurfaceProbe')) {
        return Promise.resolve((options.transportSurfaceMissing !== true) as T);
      }
      if (expression.includes('detailsPanelReadyProbe:')) {
        detailsProbes += 1;
        return Promise.resolve((options.delayedDetailsMount !== true || detailsProbes > 1) as T);
      }
      if (expression.includes('priorityControlProbe:online-tabletop-submit-stack-entry')) {
        if (options.manualStackEnabledProbeNeverSettles === true) return new Promise<T>(() => {});
          return Promise.resolve({
            enabled: manualStackEnabledSeats.includes(seatIndex),
            revision: actorControlRevision(),
            holdState: 'not-applicable'
          } as T);
        }
        if (expression.includes('priorityControlProbe:online-tabletop-submit-manual-resolve')) {
          if (options.manualStackEnabledProbeNeverSettles === true) return new Promise<T>(() => {});
          return Promise.resolve({
            enabled: manualResolveEnabledSeats.includes(seatIndex),
            revision: actorControlRevision(),
            holdState: 'not-applicable'
          } as T);
        }
        if (
          expression.includes('priorityControlProbe:online-remote-') &&
          options.priorityEnvironmentFailure === true
        )
          return Promise.reject(new Error('CDP command timeout'));
        if (expression.includes('priorityControlProbe:online-remote-hold')) {
          const enabledSeats =
            options.priorityHoldEnabledSeats ??
            Array.from({ length: scenarioIndex === 0 ? 2 : 4 }, (_entry, index) => index);
          return Promise.resolve({
            enabled: enabledSeats.includes(seatIndex),
            revision: priorityControlRevision(),
            holdState: priorityHoldSeats[scenarioIndex].has(seatIndex)
              ? 'own'
              : priorityHoldSeats[scenarioIndex].size > 0 ? 'peer' : 'none'
          } as T);
        }
        if (expression.includes('priorityControlProbe:online-remote-pass')) {
          const enabledSeats = options.priorityPassEnabledSeats ?? [priorityActors[scenarioIndex]];
          return Promise.resolve({
            enabled: enabledSeats.includes(seatIndex),
            revision: priorityControlRevision(),
            holdState: 'not-applicable'
          } as T);
        }
        if (expression.includes('priorityControlProbe:online-remote-resolve')) {
          const playerCount = scenarioIndex === 0 ? 2 : 4;
          const enabledSeats =
            options.priorityResolveEnabledSeats ??
            (priorityPassCounts[scenarioIndex] >= playerCount ? [0] : []);
          return Promise.resolve({
            enabled: enabledSeats.includes(seatIndex),
            revision: priorityControlRevision(),
            holdState: 'not-applicable'
          } as T);
        }
        if (expression.includes('settlementTransportProbe')) {
          const revisionLagThenTimeout = options.postMutationTransportRevisionLagThenTimeout === true
            && progressActionCounts[scenarioIndex] > 0
            && settlementTransportProbes++ > 0;
          const transport = {
            revision: actorControlRevision(),
            ...actorReadiness(),
            ...(options.postMutationTransportRevisionLagThenTimeout === true && progressActionCounts[scenarioIndex] > 0
              ? { knownRevision: actorControlRevision() - 1 }
              : {}),
          } as T;
          return revisionLagThenTimeout
            ? new Promise<T>(() => {})
            : Promise.resolve(transport);
        }
        if (expression.includes('priorityControlProbe:online-remote-advance')) {
          const authoritySeat = advanceEnabledSeats[0] ?? 0;
          return Promise.resolve({
            enabled: progressWindows[scenarioIndex] === 'advance' && advanceEnabledSeats.includes(seatIndex),
            present: true,
            visible: true,
            revision: actorControlRevision(),
            holdState: 'not-applicable',
            outcome: options.progressRejected === true && progressActionCounts[scenarioIndex] > 0 ? 'rejected' : 'none',
            acceptedRevision: null,
            errorVisible: options.progressRejected === true && progressActionCounts[scenarioIndex] > 0,
            operation: '',
            issueCode: options.progressRejected === true ? 'CLIENT_SERVER_INTERNAL_ERROR' : options.progressStuckAfterClick === true && progressActionCounts[scenarioIndex] > 0 ? 'CLIENT_INVALID_FRAME' : '',
            commandId: options.progressRejected === true && progressActionCounts[scenarioIndex] > 0 ? 'progress-settlement' : '',
            localPlayerId: `P${String(seatIndex + 1)}`,
            holderPlayerId: null,
            stewardPlayerId: `P${String(authoritySeat + 1)}`,
            windowKind: options.actorWindowDivergentSeat === seatIndex ? 'priority' : progressWindows[scenarioIndex] === 'sba' ? 'sba-check-required' : 'turn-based-action-required',
            holds: [],
            ...actorReadiness(),
          } as T);
        }
        if (expression.includes('priorityControlProbe:online-remote-sba-stable')) {
          const enabledSeats = options.sbaEnabledSeats ?? advanceEnabledSeats;
          const authoritySeat = advanceEnabledSeats[0] ?? 0;
          return Promise.resolve({
            enabled: progressWindows[scenarioIndex] === 'sba' && enabledSeats.includes(seatIndex),
            present: true,
            visible: true,
            revision: actorControlRevision(),
            holdState: 'not-applicable',
            outcome: options.progressRejected === true && progressActionCounts[scenarioIndex] > 0 ? 'rejected' : 'none',
            acceptedRevision: null,
            errorVisible: options.progressRejected === true && progressActionCounts[scenarioIndex] > 0,
            operation: '',
            issueCode: options.progressRejected === true ? 'CLIENT_SERVER_INTERNAL_ERROR' : options.progressStuckAfterClick === true && progressActionCounts[scenarioIndex] > 0 ? 'CLIENT_INVALID_FRAME' : '',
            commandId: options.progressRejected === true && progressActionCounts[scenarioIndex] > 0 ? 'progress-settlement' : '',
            localPlayerId: `P${String(seatIndex + 1)}`,
            holderPlayerId: null,
            stewardPlayerId: `P${String(authoritySeat + 1)}`,
            windowKind: options.actorWindowDivergentSeat === seatIndex ? 'priority' : progressWindows[scenarioIndex] === 'sba' ? 'sba-check-required' : 'turn-based-action-required',
            holds: [],
            ...actorReadiness(),
          } as T);
        }
      if (expression.includes('startedSurfaceTerminalProbe')) return Promise.resolve((options.startedSurfaceFailure ?? 'game-screen-missing/count') as T);
      const pregameControlIndex = pregameControls.findIndex((control) => expression.includes(`data-testid="${control}"`));
      if (pregameControlIndex >= 0) {
        const state = pregameStates[scenarioIndex];
        const playerCount = scenarioIndex === 0 ? 2 : 4;
        const actorControl = state.phaseIndex === pregameControlIndex && state.actorIndex === seatIndex;
        if (expression.includes('pregameActorControlProbe')) {
          if (!actorControl) return Promise.resolve(false as T);
          const terminalReadyWithoutRevision = options.pregameReadyRevisionMissing === true
            && pregameControlIndex === pregameControls.length - 1
            && state.actorIndex === playerCount - 1;
          if (!terminalReadyWithoutRevision) sharedRevisions[scenarioIndex] += 1;
          state.actorIndex += 1;
          if (state.actorIndex >= playerCount) { state.actorIndex = 0; state.phaseIndex += 1; }
          return Promise.resolve(true as T);
        }
        if (!actorControl) return Promise.reject(new Error('pregame actor mismatch'));
        sharedRevisions[scenarioIndex] += 1;
        state.actorIndex += 1;
        if (state.actorIndex >= playerCount) { state.actorIndex = 0; state.phaseIndex += 1; }
        return Promise.resolve(true as T);
      }
      if (expression.includes('alreadyOnlineSurfaceProbe')) return Promise.resolve((options.alreadyOnline === true) as T);
      if (expression.includes('cast control unavailable') && expression.includes('data-object-id')) return Promise.resolve('PC3:0' as T);
      if (expression.includes("status.includes('提出済み')") && expression.includes("status.includes('準備完了')")) {
        if (options.lobbyReadyProbe === 'never' || (options.lobbyReadyProbe === 'delayed' && lobbyReadyProbes++ === 0)) return Promise.resolve(false as T);
        return Promise.resolve(true as T);
      }
      if (expression.includes('data-testid="online-start-game"') && expression.includes('node.click(); return true')) startClicks += 1;
      if (expression.includes('data-testid="online-remote-hold"') && expression.includes('node.click(); return true')
        ) {
          const enabledSeats =
            options.priorityHoldEnabledSeats ??
            Array.from({ length: scenarioIndex === 0 ? 2 : 4 }, (_entry, index) => index);
          if (!enabledSeats.includes(seatIndex))
            return Promise.reject(new Error('HOLD actor mismatch'));
          const heldSeats = priorityHoldSeats[scenarioIndex];
          if (!heldSeats.has(seatIndex) && options.priorityHoldStuck !== 'off') heldSeats.add(seatIndex);
          else if (heldSeats.has(seatIndex) && options.priorityHoldStuck !== 'on') heldSeats.delete(seatIndex);
        }
        if (
          expression.includes('data-testid="online-remote-pass"') &&
          expression.includes('node.click(); return true')
        ) {
          const enabledSeats = options.priorityPassEnabledSeats ?? [priorityActors[scenarioIndex]];
          if (!enabledSeats.includes(seatIndex))
            return Promise.reject(new Error('pass actor mismatch'));
          priorityPassCounts[scenarioIndex] += 1;
          priorityActors[scenarioIndex] =
            (priorityActors[scenarioIndex] + 1) % (scenarioIndex === 0 ? 2 : 4);
        }
        if (
          expression.includes('data-testid="online-remote-resolve"') &&
          expression.includes('node.click(); return true')
        ) {
          const playerCount = scenarioIndex === 0 ? 2 : 4;
          const enabledSeats =
            options.priorityResolveEnabledSeats ??
            (priorityPassCounts[scenarioIndex] >= playerCount ? [0] : []);
          if (!enabledSeats.includes(seatIndex))
            return Promise.reject(new Error('resolve actor mismatch'));
        }
        if (expression.includes('data-testid="online-remote-advance"') && expression.includes('node.click(); return true') &&
          !advanceEnabledSeats.includes(seatIndex)
        )
          return Promise.reject(new Error('advance actor mismatch'));
        if (expression.includes('data-testid="online-remote-sba-stable"') && expression.includes('node.click(); return true') &&
          !(options.sbaEnabledSeats ?? advanceEnabledSeats).includes(seatIndex)
        )
          return Promise.reject(new Error('SBA actor mismatch'));
        if (
          expression.includes('data-testid="online-tabletop-submit-stack-entry"') &&
          expression.includes('node.click(); return true') &&
          !manualStackEnabledSeats.includes(seatIndex)
        )
          return Promise.reject(new Error('manual stack actor mismatch'));
        if (
          expression.includes('data-testid="online-tabletop-submit-manual-resolve"') &&
          expression.includes('node.click(); return true') &&
          !manualResolveEnabledSeats.includes(seatIndex)
        )
          return Promise.reject(new Error('manual resolve actor mismatch'));
      const recoveryNavigation =
        pageOrdinal > 0 && (expression.includes('data-testid="open-online-mode"') || expression.includes('data-testid="online-recover"'));
      if (expression.includes('data-testid="online-recover"') && expression.includes('node.click(); return true')) {
        if (pageOrdinal === 0 || recoveryRequested) return Promise.reject(new Error('unexpected recovery action'));
        recoveryRequested = true;
      }
      if (
        (expression.includes('node.click(); return true') ||
          expression.includes('target.click(); return true')) &&
        !recoveryNavigation &&
        !(options.progressRejected === true && (expression.includes('data-testid="online-remote-advance"') || expression.includes('data-testid="online-remote-sba-stable"'))) &&
        !(options.progressStuckAfterClick === true && expression.includes('data-testid="online-remote-advance"'))
      )
        sharedRevisions[scenarioIndex] += 1;
      const priorityOperation = expression.includes('data-testid="online-remote-hold"')
        ? 'priority-hold' as const
        : expression.includes('data-testid="online-remote-pass"')
          ? 'priority-pass' as const
          : expression.includes('data-testid="online-remote-resolve"')
            ? 'priority-resolve' as const
            : null;
      if (priorityOperation !== null && expression.includes('node.click(); return true')) {
        prioritySettlements[scenarioIndex] = {
          operation: priorityOperation,
          baseRevision: sharedRevisions[scenarioIndex] - 1,
          acceptedRevision: sharedRevisions[scenarioIndex],
          senderSeat: seatIndex,
        };
        if (priorityOperation === 'priority-resolve') {
          const capturedTopObjectId = castStates[scenarioIndex]?.topObjectId ?? null;
          if (capturedTopObjectId !== null) {
            postResolutions[scenarioIndex] = `直近の変化: 解決: オーナーの墓地 (${capturedTopObjectId}) / 更新 ${String(sharedRevisions[scenarioIndex])}`;
            castStates[scenarioIndex] = { ...castStates[scenarioIndex], topObjectId: null };
          }
        }
      }
      if (expression.includes('data-testid="online-remote-cast"') && expression.includes('node.click(); return true')) {
        castStates[scenarioIndex] = {
          topObjectId: 'PC3:1',
          acceptedRevision: sharedRevisions[scenarioIndex],
          senderSeat: seatIndex,
        };
      }
      if (expression.includes('data-testid="online-remote-advance"') && expression.includes('node.click(); return true')) {
        progressActionCounts[scenarioIndex] += 1;
        progressWindows[scenarioIndex] = 'sba';
      }
      if (expression.includes('data-testid="online-remote-sba-stable"') && expression.includes('node.click(); return true')) {
        progressActionCounts[scenarioIndex] += 1;
        progressWindows[scenarioIndex] = 'advance';
        const actionsRequired = progressCompletions[scenarioIndex] === 0
          ? scenarioIndex === 0
            ? options.twoPlayerActionsBeforeMain ?? 2
            : options.fourPlayerActionsBeforeMain ?? 2
          : 2;
        if (options.stagnantPhase !== true && progressActionCounts[scenarioIndex] >= actionsRequired) {
          sharedPhases[scenarioIndex] = progressCompletions[scenarioIndex] === 0 ? 'main1' : 'combat';
          progressCompletions[scenarioIndex] += 1;
          progressActionCounts[scenarioIndex] = 0;
        }
      }
      if (expression.includes('privateHandPayload')) {
        const tokens = [`private-hand-object-${scenarioIndex}-${seatIndex}`];
        const serialized = JSON.stringify(tokens);
        return Promise.resolve({ tokens, serialized, complete: true, bytes: serialized.length } as T);
      }
      if (expression.includes('privateChoicePayload')) {
        const hostContext = contextOrdinal === 0 || contextOrdinal === 2;
        if (options.privateChoiceCaptureBoundExceeded === true && hostContext && pageOrdinal === 0) return Promise.resolve({ identifiers: [], candidateHandles: [], serialized: '', complete: false, roots: 129, attributes: 0, values: 0, tokens: 0, bytes: 0 } as T);
        const payload = options.privateChoiceLeak === true || (hostContext && pageOrdinal === 0)
          ? { identifiers: ['visibility-choose-fixture'], candidateHandles: [options.privateChoiceCandidateTokenLeak === true ? 'non-handle-public-token' : 'private-card-handle'], serialized: 'private-choice-host-payload', complete: true, roots: 1, attributes: 2, values: 1, tokens: 4, bytes: 64 }
          : { identifiers: [], candidateHandles: [], serialized: 'private-choice-empty-payload', complete: true, roots: 0, attributes: 0, values: 0, tokens: 0, bytes: 0 };
        return Promise.resolve(payload as T);
      }
      if (expression.includes('privateChoiceIdentifiers')) {
        // The harness runs the two-player scenario first (contexts 0/1) and
        // the four-player scenario second (contexts 2/3/4/5); only each
        // scenario's host is authorized to render the private choice.
        const hostContext = contextOrdinal === 0 || contextOrdinal === 2;
        const identifiers = options.privateChoiceLeak === true || (hostContext && pageOrdinal === 0) ? ['visibility-choose-fixture'] : [];
        return Promise.resolve(identifiers as T);
      }
      if (expression.includes('privateChoiceDomSurfaces')) {
        const leaked = options.privateChoiceCandidateLeak === true && contextOrdinal !== 0 && contextOrdinal !== 2;
        let surfaces = leaked ? ['private-card-handle'] : [];
        if (options.reconnectPrivateLeakSeat === seatIndex && recoveredScenarios[scenarioIndex]) {
          surfaces = [`private-hand-object-${scenarioIndex}-0`];
        }
        if ((options.privateChoiceCandidateLeakBeyondBound === true || options.privateChoiceCandidateTokenLeak === true) && contextOrdinal !== 0 && contextOrdinal !== 2) surfaces = Array.from({ length: options.privateChoiceCandidateLeakBeyondBound === true ? 2_049 : 1 }, (_entry, index) => index === (options.privateChoiceCandidateLeakBeyondBound === true ? 2_048 : 0) ? options.privateChoiceCandidateTokenLeak === true ? 'non-handle-public-token' : 'private-card-handle' : `surface-${index}`);
        expect(Object.keys(argument as object)).toEqual(['offset']);
        const serialized = JSON.stringify(surfaces);
        const offset = (argument as { offset: number }).offset;
        return Promise.resolve({ chunk: serialized.slice(offset, offset + 8192), length: serialized.length, digest: createHash('sha256').update(serialized).digest('hex'), complete: options.privateChoiceScanBoundExceeded !== true } as T);
      }
      if (expression.includes('コードを表示')) {
        const delayed = options.asyncInviteRender === true && revealButtonProbes++ === 0;
        return Promise.resolve(!delayed as T);
      }
      if (expression.includes('invite span')) {
        const delayed = options.asyncInviteRender === true && inviteReads++ === 0;
        return Promise.resolve((delayed ? null : 'fixture-invite') as T);
      }
      if (expression.includes('inviteFingerprintProbe')) return Promise.resolve('0d4a7e5bd65dbfd5c46b1d6a579fa5384ca7d9cc4cd6591e58da18bc087b3a77' as T);
      if (expression.includes('gameScreens')) {
        if (pageOrdinal > 0 && disconnectedSeats[scenarioIndex].has(seatIndex)) {
          if (!recoveryRequested) return Promise.reject(new Error('recovery action missing'));
          disconnectedSeats[scenarioIndex].delete(seatIndex);
          recoveredScenarios[scenarioIndex] = true;
          authoritativeRejoined = options.missingRejoined !== true;
        }
        const waitingForStartedSurface = options.asyncStartProbe === true && startClicks > 0 && startedSurfaceProbes++ === 0;
        const forcedStartedSurfaceFailure = options.startedSurfaceFailure !== undefined && startClicks > 0;
        const gameScreenMissing = options.startedSurfaceFailure === 'game-screen-missing/count' || options.startedSurfaceFailure === 'start-rejected' || options.startedSurfaceFailure === 'start-pending' || options.startedSurfaceFailure === 'start-not-accepted';
        const gameScreenCount = forcedStartedSurfaceFailure && gameScreenMissing ? 0 : waitingForStartedSurface ? 0 : 1;
        const overflow = forcedStartedSurfaceFailure && options.startedSurfaceFailure === 'horizontal-overflow' ? 1 : (options.overflow ?? 0);
        const opponentLeak = forcedStartedSurfaceFailure && options.startedSurfaceFailure === 'opponent-leak' ? true : options.leak === true;
        const consoleErrors = forcedStartedSurfaceFailure && options.startedSurfaceFailure === 'console-error' ? 1 : (options.consoleErrors ?? 0);
        const revision = options.stagnantRevision ? 0 : sharedRevisions[scenarioIndex] +
              (options.actorRevisionOffsetSeat === seatIndex ? 1 : 0);
        const transientHostLag = seatIndex === 0
          && progressActionCounts[scenarioIndex] > 0
          && postMutationHostLagProbeCounts[scenarioIndex]++ < (options.postMutationHostLagProbes ?? 0);
        const probeRevision = forcedStartedSurfaceFailure && options.startedSurfaceFailure === 'host-revision-missing'
          ? Number.NaN
          : revision - (transientHostLag ? 1 : 0);
        const handHeight = Math.min(80, Math.max(40, viewportHeight * 0.12));
        const handY = viewportHeight - handHeight - 5;
        const railY = Math.max(8, handY - Math.min(300, viewportHeight * 0.5));
        const railHeight = Math.max(1, handY - 5 - railY);
        const boardY = 8;
        const boardBottom = Math.max(boardY + 1, railY - 8);
        const panelHeight = Math.min(220, Math.max(80, viewportHeight * 0.45));
        const geometryFailure = options.geometryFailure;
        const geometry = {
          viewport: { x: 0, y: 0, width: viewportWidth, height: viewportHeight, right: viewportWidth, bottom: viewportHeight },
          rail: { x: 8, y: railY, width: Math.max(1, viewportWidth - 16), height: railHeight, right: viewportWidth - 8, bottom: railY + railHeight },
          hand: { x: 8, y: handY, width: Math.max(1, viewportWidth - 16), height: handHeight, right: viewportWidth - 8, bottom: handY + handHeight },
          battlefield: { x: 8, y: boardY, width: Math.max(1, viewportWidth - 16), height: boardBottom - boardY, right: viewportWidth - 8, bottom: boardBottom },
          seatRects: Array.from({ length: (scenarioIndex === 0 ? 2 : 4) - 1 }, (_entry, index) => ({ x: 16 + index * 8, y: railY + 8, width: 120, height: 32, right: 136 + index * 8, bottom: railY + 40 })),
          boardRects: Array.from({ length: (scenarioIndex === 0 ? 2 : 4) - 1 }, (_entry, index) => ({ x: 16 + index * 8, y: boardY + 8, width: 120, height: 64, right: 136 + index * 8, bottom: boardY + 72 })),
          primaryAction: { rect: { x: 16, y: railY + 8, width: 120, height: 32, right: 136, bottom: railY + 40 }, enabled: true as const },
          panel: { x: 16, y: 16, width: Math.max(1, viewportWidth - 32), height: Math.min(panelHeight, viewportHeight - 20), right: viewportWidth - 16, bottom: 16 + Math.min(panelHeight, viewportHeight - 20) },
          scroll: { rect: { x: 8, y: railY, width: Math.max(1, viewportWidth - 16), height: railHeight, right: viewportWidth - 8, bottom: railY + railHeight }, scrollWidth: viewportWidth, scrollHeight: railHeight * 2, clientWidth: Math.max(1, viewportWidth - 16), clientHeight: railHeight, scrollMoved: geometryFailure !== 'non-scrollable', focusReachable: geometryFailure !== 'focus-inaccessible' },
          clippedPrimaryAction: geometryFailure === 'clipped-primary',
          railHandCollision: geometryFailure === 'vertical-collision',
          panelOutsideViewport: geometryFailure === 'offscreen-panel',
          scrollAccessible: geometryFailure !== 'inaccessible-scroll',
          battlefieldObscured: geometryFailure === 'obscured-battlefield',
        };
          const projectedPhase =
            options.divergentPhaseSeat === seatIndex ? 'stale' : sharedPhases[scenarioIndex];
          const castState = castStates[scenarioIndex];
          const castSettlement = castState !== undefined && castState.acceptedRevision !== null && castState.senderSeat === seatIndex
            ? { commandId: 'remote-cast-pilot-1', operation: 'cast-spell', outcome: 'accepted', baseRevision: castState.acceptedRevision - 1, currentRevision: castState.acceptedRevision, acceptedRevision: castState.acceptedRevision }
            : null;
          const priorityState = prioritySettlements[scenarioIndex];
          const prioritySettlement = options.missingPriorityReceipt !== true && priorityState !== null && priorityState.senderSeat === seatIndex
            ? { commandId: `remote-${priorityState.operation}-${String(priorityState.baseRevision)}`, operation: priorityState.operation, outcome: 'accepted', baseRevision: priorityState.baseRevision, currentRevision: priorityState.acceptedRevision, acceptedRevision: priorityState.acceptedRevision }
            : null;
          const playerIds = scenarioIndex === 0 ? ['P1', 'P2'] : ['P1', 'P2', 'P3', 'P4'];
          const publicPlayerIds = options.missingPriorityDomAttribute === 'public-seat-ids' ? undefined : playerIds;
          const localPlayerId = options.missingPriorityDomAttribute === 'local-player-id' ? undefined : playerIds[seatIndex] ?? null;
          const stackCount = castState?.topObjectId === null ? 0 : 1;
          const resolved = priorityState?.operation === 'priority-resolve' && stackCount === 0;
          const priorityHolderPlayerId = resolved || priorityPassCounts[scenarioIndex] >= (scenarioIndex === 0 ? 2 : 4)
            ? null
            : `P${String(priorityActors[scenarioIndex] + 1)}`;
          const priorityHolds = priorityHoldSeats[scenarioIndex].size === 0
            ? []
            : [...priorityHoldSeats[scenarioIndex]].map((index) => `P${String(index + 1)}`);
          const priorityWindowKind = options.missingPriorityDomAttribute === 'window-kind'
            ? undefined
            : resolved ? 'sba-check-required' : priorityHolderPlayerId === null ? 'resolution-ready' : 'priority';
          const recentResolutionObjectId = options.missingResolutionEvidence === true || !resolved ? null : castStates[scenarioIndex]?.topObjectId === null ? 'PC3:1' : null;
          const recentResolutionRevision = recentResolutionObjectId === null ? null : priorityState?.acceptedRevision ?? null;
          const disconnectedPlayerIds = [...disconnectedSeats[scenarioIndex]].sort((left, right) => left - right).map((index) => `P${String(index + 1)}`);
          const digestPrefix = `${scenarioIndex.toString(16)}${(probeRevision % 16).toString(16)}${disconnectedPlayerIds.map((id) => id.slice(1)).join('')}`;
          const baseDigest = digestPrefix.padEnd(64, 'a').slice(0, 64);
          const sharedPublicDigest = options.reconnectDigestDivergentSeat === seatIndex && recoveredScenarios[scenarioIndex]
            ? `${baseDigest[0] === 'f' ? 'e' : 'f'}${baseDigest.slice(1)}`
            : baseDigest;
          return Promise.resolve({ gameScreens: gameScreenCount, overflow, geometry, revision: probeRevision, phase: projectedPhase, winner: options.missingWinner !== true, outcomeVisible: options.missingWinner !== true, activeSeatCount: 3, eliminatedSeats: options.missingWinner === true ? [] : ['P2'], opponentLeak, leakScanComplete: options.leakScanBoundExceeded !== true, privateLookControl: true, chooseControl: true, manualStackControl: true, manualResolveControl: true, stackCount, stackTopObjectId: castState?.topObjectId ?? null, castSettlement, prioritySettlement, publicPlayerIds, localPlayerId, disconnectedPlayerIds, recoveryOutcome: authoritativeRejoined ? 'rejoined' : null, sharedPublicDigest, priorityHolds, priorityHolderPlayerId, priorityStewardPlayerId: 'P1', priorityWindowKind, recentResolutionObjectId, recentResolutionRevision, postResolution: options.missingResolutionEvidence === true ? null : postResolutions[scenarioIndex], consoleErrors, workerObserved: options.missingWorker !== true } as T);
      }
      return Promise.resolve(true as T);
    },
    setViewport: (viewport) => { viewportWidth = viewport.width; viewportHeight = viewport.height; },
    close: () => {
      if (pageOrdinal === 0 && options.peerPresenceStuck !== true) disconnectedSeats[scenarioIndex].add(seatIndex);
      return Promise.resolve();
    },
    consoleCounts: () => ({
      errors: options.consoleErrors ?? (options.savedImportRuntimeError === true || (options.startedSurfaceFailure === 'console-error' && startClicks > 0) ? 1 : 0),
      warnings: options.consoleWarningContext === contextOrdinal || (options.consoleWarningReplacement === true && contextOrdinal === 0 && pageOrdinal > 0) ? 1 : (options.consoleWarnings ?? 0),
      secretViolations: options.consoleSecretContext === contextOrdinal || (options.consoleSecretReplacement === true && contextOrdinal === 0 && pageOrdinal > 0) ? 1 : (options.consoleSecretViolations ?? 0)
      }),
    setSecretFragments: () => undefined,
    };
  };
  const context = (): O4p09iContextV1 => {
    const contextOrdinal = contextIndex++;
    const id = `fixture-context-${String(contextOrdinal)}`;
    let pageOrdinal = 0;
    return { browserContextId: id, createPage: () => Promise.resolve(page(contextOrdinal, pageOrdinal++)), close: () => Promise.resolve() };
  };
  return {
    chromeVersion: 'fixture-chrome',
    createBrowserContext: () => Promise.resolve(context()),
    close: () => options.closeFailure ? Promise.reject(new Error('cleanup failed')) : Promise.resolve(),
  };
}

describe('O4P-09I full-match production evidence', () => {
  it('normalizes failures into a secret-free structured result', () => {
    expect(
      classifyO4p09iProductionFailureV1(
        new Error('production scenario stage failed: advance/private-token')
      )
    ).toEqual({ class: 'IMPLEMENTATION', code: 'PLAYER_JOURNEY_STAGE_FAILED', stage: 'advance' });
    expect(
      classifyO4p09iProductionFailureV1(
        new Error('production scenario stage failed: advance/four-player-main1/revision-ack')
      )
    ).toEqual({ class: 'IMPLEMENTATION', code: 'PLAYER_JOURNEY_STAGE_FAILED', stage: 'advance/four-player-main1/revision-ack' });
    expect(
      classifyO4p09iProductionFailureV1(
        new Error('production scenario stage failed: start-probe/start-pending')
      )
    ).toEqual({ class: 'IMPLEMENTATION', code: 'PLAYER_JOURNEY_STAGE_FAILED', stage: 'start-probe/start-pending' });
    expect(
      classifyO4p09iProductionFailureV1(
        new Error('production scenario stage failed: post-actions/revision-divergence')
      )
    ).toEqual({ class: 'IMPLEMENTATION', code: 'PLAYER_JOURNEY_STAGE_FAILED', stage: 'post-actions/revision-divergence' });
    expect(
      classifyO4p09iProductionFailureV1(
        new Error('production scenario stage failed: post-actions/revision-not-advanced')
      )
    ).toEqual({ class: 'IMPLEMENTATION', code: 'PLAYER_JOURNEY_STAGE_FAILED', stage: 'post-actions/revision-not-advanced' });
    expect(
      classifyO4p09iProductionFailureV1(
        new Error('production scenario stage failed: post-actions/probe-timeout')
      )
    ).toEqual({ class: 'EVIDENCE', code: 'EVIDENCE_HARNESS_FAILED', stage: 'post-actions/probe-timeout' });
    expect(
      classifyO4p09iProductionFailureV1(
        new Error('production scenario stage failed: post-actions/session-probe-type-error')
      )
    ).toEqual({ class: 'EVIDENCE', code: 'EVIDENCE_HARNESS_FAILED', stage: 'post-actions/session-probe-type-error' });
    expect(
      classifyO4p09iProductionFailureV1(
        new Error('production scenario stage failed: post-actions/private-token')
      )
    ).toEqual({ class: 'IMPLEMENTATION', code: 'PLAYER_JOURNEY_STAGE_FAILED', stage: 'post-actions' });
    expect(
      classifyO4p09iProductionFailureV1(
        new Error('production scenario stage failed: import/private-token', {
          cause: new Error('production UI stage failed: deck resolution pending'),
        })
      )
    ).toEqual({ class: 'IMPLEMENTATION', code: 'PLAYER_ENTRY_STAGE_FAILED', stage: 'import/resolution-pending' });
    expect(
      classifyO4p09iProductionFailureV1(new Error('Chrome launcher unavailable: private-token'))
    ).toEqual({ class: 'ENVIRONMENT', code: 'BROWSER_ENVIRONMENT_UNAVAILABLE', stage: 'setup' });
    expect(
      classifyO4p09iProductionFailureV1(new Error('production environment failure: priority-probe'))
    ).toEqual({ class: 'ENVIRONMENT', code: 'BROWSER_ENVIRONMENT_UNAVAILABLE', stage: 'priority-probe' });
    expect(
      classifyO4p09iProductionFailureV1(new Error('production environment failure: private-token'))
    ).toEqual({ class: 'ENVIRONMENT', code: 'BROWSER_ENVIRONMENT_UNAVAILABLE', stage: 'setup' });
    expect(
      classifyO4p09iProductionFailureV1(
        new Error('console secret privacy violation: private-token')
      )
    ).toEqual({ class: 'IMPLEMENTATION', code: 'PRIVACY_OR_CONSOLE_FAILED', stage: 'privacy' });
    const unknown = classifyO4p09iProductionFailureV1(new Error('unknown private-token'));
    expect(unknown).toEqual({
      class: 'EVIDENCE',
      code: 'EVIDENCE_HARNESS_FAILED',
      stage: 'harness'
    });
    expect(JSON.stringify(unknown)).not.toContain('private-token');
    expect(
      classifyO4p09iProductionFailureV1(new Error('browser profile cleanup incomplete'))
    ).toEqual({ class: 'EVIDENCE', code: 'EVIDENCE_HARNESS_FAILED', stage: 'harness' });
    expect(classifyO4p09iProductionFailureV1(new Error('browser console error'))).toEqual({
      class: 'IMPLEMENTATION',
      code: 'PRIVACY_OR_CONSOLE_FAILED',
      stage: 'privacy'
    });
  });

  it('accepts only the harness-owned temporary failure path shape', () => {
    expect(
      resolveO4p09iJourneyResultPathV1('/private/tmp/root/failure.json', '/private/tmp/root')
    ).toBe('/private/tmp/root/failure.json');
    expect(
      resolveO4p09iJourneyResultPathV1(
        '/private/tmp/root/onedeck-journey-Ab12/failure.json',
        '/private/tmp/root'
      )
    ).toBeNull();
    expect(
      resolveO4p09iJourneyResultPathV1(
        '/private/tmp/root/arbitrary/failure.json',
        '/private/tmp/root'
      )
    ).toBeNull();
    expect(
      resolveO4p09iJourneyResultPathV1('/private/tmp/outside/failure.json', '/private/tmp/root')
    ).toBeNull();
  });
  it('writes only a direct temporary failure file with safe permissions', () => {
    const root = mkdtempSync(join(tmpdir(), 'o4p09i-writer-'));
    try {
      expect(
        writeO4p09iJourneyFailureV1(
          `${root}/nested/failure.json`,
          new Error('private-token'),
          root
        )
      ).toBe(false);
      const target = `${root}/failure.json`;
      expect(
        writeO4p09iJourneyFailureV1(
          target,
          new Error('production environment failure: browser'),
          root
        )
      ).toBe(true);
      expect(JSON.parse(readFileSync(target, 'utf8'))).toEqual({
        class: 'ENVIRONMENT',
        code: 'BROWSER_ENVIRONMENT_UNAVAILABLE',
        stage: 'browser'
      });
      expect(statSync(target).mode & 0o777).toBe(0o600);
      expect(writeO4p09iJourneyFailureV1(target, new Error('unknown'), root)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it('keeps injected harness output separate from production attestation', async () => {
    const synthetic = await runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([]), readDeck: () => 'fixture deck', timeoutMs: 250 });
    expect(synthetic.kind).toBe('o4p-09i-full-match-test-evidence-v1');
    await expect(runO4p09iFullMatchEvidenceProductionV1({ browser: fakeBrowser([]), readDeck: () => 'fixture deck', timeoutMs: 250 })).rejects.toThrow('production evidence does not accept injected seams');
  });

  it('waits for a delayed production panel mount within the existing deadline', async () => {
    const expressions: string[] = [];
    await runO4p09iFullMatchEvidenceV1({
      browser: fakeBrowser(expressions, { delayedDetailsMount: true }),
      readDeck: () => 'fixture deck',
      timeoutMs: 250
    });
    expect(expressions.filter((expression) => expression.includes('detailsPanelReadyProbe:')).length).toBeGreaterThan(1);
    expect(expressions.some((expression) => expression.includes("details.querySelector('summary')"))).toBe(true);
    expect(expressions.some((expression) => expression.includes('visibleControlProbe:online-remote-guided-overlay'))).toBe(false);
    expect(expressions.some((expression) => expression.includes('visibleControlProbe:online-remote-manual-overlay'))).toBe(false);
  });

  it('provides four distinct non-sensitive 100-card public deck inputs', () => {
    expect(O4P09I_PUBLIC_DECK_TEXTS_V1).toHaveLength(4);
    const commanders = O4P09I_PUBLIC_DECK_TEXTS_V1.map((text) => text.match(/Commander\n1 ([^\n]+)/u)?.[1] ?? '');
    expect(commanders).toEqual(['Celes, Rune Knight', 'Gogo, Master of Mimicry', 'Kefka, Court Mage', 'Muldrotha, the Gravetide']);
    const lands = ['Plains', 'Island', 'Mountain', 'Forest'];
    const creatures = ['Mother of Runes', 'Omen Hawker', 'Ragavan, Nimble Pilferer', 'Spore Frog'];
    for (const [index, text] of O4P09I_PUBLIC_DECK_TEXTS_V1.entries()) {
      const main = text.match(/Deck\n(\d+) ([^\n]+)\n(\d+) ([^\n]+)/u);
      expect(main).not.toBeNull();
      expect(main?.[2]).toBe(lands[index]);
      expect(main?.[4]).toBe(creatures[index]);
      expect(Number(main?.[1]) + Number(main?.[3]) + 1).toBe(100);
    }
  });

  it('keeps the production timeout bounded above the 100-card import budget', () => {
    expect(O4P09I_DEFAULT_TIMEOUT_MS_V1).toBeGreaterThan(15_000);
    expect(O4P09I_DEFAULT_TIMEOUT_MS_V1).toBeLessThanOrEqual(120_000);
    expect(O4P09I_START_SURFACE_TIMEOUT_MS_V1).toBeGreaterThan(O4P09I_DEFAULT_TIMEOUT_MS_V1);
    expect(O4P09I_START_SURFACE_TIMEOUT_MS_V1).toBeLessThanOrEqual(120_000);
  });

  it.each([
    ['deck-input', 'production scenario stage failed: import'],
    ['import-button', 'production scenario stage failed: import'],
    ['deck-save-status', 'production scenario stage failed: import'],
    ['open-online-mode', 'production scenario stage failed: import'],
  ] as const)('classifies the %s import/open stage without exposing browser errors', async (missingControl, message) => {
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], { missingControl }), readDeck: () => 'fixture deck', timeoutMs: 250 })).rejects.toThrow(message);
  });

  it('classifies a visible deck storage error without exposing its page text', async () => {
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], { savedStateError: true }), readDeck: () => 'fixture deck', timeoutMs: 250 })).rejects.toThrow('production scenario stage failed: import');
  });

  it.each([
    [{ savedResolutionError: true }, 'production scenario stage failed: import'],
    [{ missingSaveNotification: true }, 'production scenario stage failed: import'],
    [{ savedResolutionPending: true }, 'production scenario stage failed: import'],
  ] as const)('classifies saved-state control failures without exposing page content', async (options, message) => {
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], options), readDeck: () => 'fixture deck', timeoutMs: 250 })).rejects.toThrow(message);
  });

  it.each([
    [{ savedImportRuntimeFailure: true }, 'production scenario stage failed: import'],
    [{ savedImportRuntimeError: true }, 'production scenario stage failed: import'],
  ] as const)('classifies import runtime failures without exposing browser details', async (options, message) => {
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], options), readDeck: () => 'fixture deck', timeoutMs: 250 })).rejects.toThrow(message);
  });

  it('accepts an already-online surface when the import remount completed earlier', async () => {
    const summary = await runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], { alreadyOnline: true }), readDeck: () => 'fixture deck', timeoutMs: 250 });
    expect(summary.scenarios.twoPlayer.playerCount).toBe(2);
  });

  it.each([
    [{ productErrorBoundary: true }, 'production scenario stage failed: import'],
    [{ importSurfaceDisappeared: true }, 'production scenario stage failed: import'],
    [{ invalidWorkflow: true }, 'production scenario stage failed: import'],
  ] as const)('classifies terminal app surfaces without exposing page content', async (options, message) => {
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], options), readDeck: () => 'fixture deck', timeoutMs: 250 })).rejects.toThrow(message);
  });

  it('accepts the visible Online entry after a fresh-create remount clears save status', async () => {
    const summary = await runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], { freshCreateRemount: true }), readDeck: () => 'fixture deck', timeoutMs: 250 });
    expect(summary.scenarios.twoPlayer.playerCount).toBe(2);
    expect(summary.scenarios.fourPlayer.playerCount).toBe(4);
  });

  it('runs an injected UI-only harness for both player-count scenarios', async () => {
    const expressions: string[] = [];
    const summary = await runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser(expressions), readDeck: () => 'fixture deck' });
    expect(summary.pagesOrigin).toBe(O4P09I_PAGES_ORIGIN_V1);
    expect(summary.workerOrigin).toBe(O4P09I_WORKER_ORIGIN_V1);
    expect(summary.scenarios.twoPlayer.playerCount).toBe(2);
    expect(summary.scenarios.twoPlayer.outcome).toBe('winner');
    expect(summary.scenarios.twoPlayer.revision.start).toBeGreaterThan(0);
    expect(summary.scenarios.twoPlayer.revision.start).toBeLessThanOrEqual(summary.scenarios.twoPlayer.revision.afterSharedMutation);
    expect(summary.scenarios.fourPlayer.playerCount).toBe(4);
    expect(summary.scenarios.fourPlayer.outcome).toBe('three-continue');
    expect(summary.scenarios.twoPlayer.eliminatedSeats).toHaveLength(1);
    expect(summary.scenarios.fourPlayer.eliminatedSeats).toHaveLength(1);
    for (const viewport of summary.scenarios.fourPlayer.viewportFacts) {
      expect(viewport.pageGeometries).toHaveLength(4);
      for (const pageGeometry of viewport.pageGeometries) {
        expect(pageGeometry.seatRects).toHaveLength(3);
        expect(pageGeometry.boardRects).toHaveLength(3);
      }
    }
    expect(expressions.some((expression) => expression.includes('document.querySelector'))).toBe(true);
    const firstDeckInput = expressions.findIndex((expression) => expression.includes('data-testid="deck-input"'));
    const firstImport = expressions.findIndex((expression) => expression.includes('data-testid="import-button"'));
    const firstSaved = expressions.findIndex((expression) => expression.includes('data-testid="deck-save-status"'));
    const firstOnline = expressions.findIndex((expression) => expression.includes('data-testid="open-online-mode"') && !expression.includes('savedDeckProbe'));
    expect(firstDeckInput).toBeGreaterThanOrEqual(0);
    expect(firstImport).toBeGreaterThan(firstDeckInput);
    expect(firstSaved).toBeGreaterThan(firstImport);
    expect(firstOnline).toBeGreaterThan(firstSaved);
    expect(expressions.some((expression) => expression.includes('priorityControlProbe:online-remote-sba-stable'))).toBe(true);
    expect(expressions.some((expression) => expression.includes('data-testid="online-remote-sba-stable"') && expression.includes('node.click(); return true'))).toBe(true);
    expect(expressions.some((expression) => expression.includes('applyCommand') || /\bdispatch\s*\(/u.test(expression) || /\bfetch\s*\(/u.test(expression))).toBe(false);
  });

  it('runs the bounded two-player reliability profile through a post-reconnect mutation', async () => {
    const expressions: string[] = [];
    const summary = await runO4p09iReliabilityEvidenceTestDriverV1({
      browser: fakeBrowser(expressions, { advanceEnabledSeat: 1, postPregameResyncProbes: 2, postMutationHostLagProbes: 2 }),
      readDeck: () => 'fixture deck',
      timeoutMs: 250,
    });
    expect(summary.scenario.phases).toEqual([
      'room/decks', 'pregame', 'shared mutation', 'disconnect/reconnect',
      'post-reconnect mutation',
    ]);
    expect(summary.scenario.revision.afterReconnect).toBe(summary.scenario.revision.beforeReconnect);
    expect(summary.scenario.revision.afterPostReconnectMutation).toBeGreaterThan(summary.scenario.revision.afterReconnect);
    expect(expressions.filter((expression) => expression.includes('data-testid="online-recover"') && expression.includes('node.click(); return true'))).toHaveLength(1);
    const mutationClick = expressions.findIndex((expression) =>
      expression.includes('data-testid="online-remote-advance"')
      && expression.includes('node.click(); return true')
    );
    const firstSessionProbeAfterMutation = expressions.findIndex((expression, index) =>
      index > mutationClick && expression.includes('gameScreens')
    );
    expect(mutationClick).toBeGreaterThanOrEqual(0);
    expect(firstSessionProbeAfterMutation).toBeGreaterThan(mutationClick);
    expect(expressions[firstSessionProbeAfterMutation]).toContain('sessionPageProbe');
    expect(expressions[firstSessionProbeAfterMutation]).toContain('opponentLeak');
    expect(expressions[firstSessionProbeAfterMutation]).toContain('workerObserved');
    expect(expressions[firstSessionProbeAfterMutation]).not.toContain('getBoundingClientRect');
    expect(expressions[firstSessionProbeAfterMutation]).not.toContain('.focus()');
    expect(expressions[firstSessionProbeAfterMutation]).not.toContain('scrollTop');
    expect(expressions.slice(mutationClick + 1, firstSessionProbeAfterMutation).filter((expression) =>
      expression.includes('priorityControlProbe:online-remote-advance')
    )).toHaveLength(1);
    const transportProbes = expressions.slice(mutationClick + 1, firstSessionProbeAfterMutation).filter((expression) =>
      expression.includes('settlementTransportProbe')
    );
    expect(transportProbes).toHaveLength(2);
    expect(transportProbes.every((expression) => !expression.includes('getBoundingClientRect'))).toBe(true);
    for (const attribute of [
      'data-projection-revision', 'data-player-phase', 'data-player-pending-count',
      'data-player-known-revision', 'data-player-projection-revision', 'data-online-busy',
      'data-player-connection-epoch', 'data-player-recovery-attempt', 'data-player-issue-code',
      'data-player-projection-requests-sent', 'data-player-projection-frames-received',
      'data-player-projection-frames-accepted', 'data-player-projection-frames-rejected',
    ]) expect(transportProbes.every((expression) => expression.includes(attribute))).toBe(true);
    expect(validateO4p09iReliabilityEvidenceV1({
      ...summary,
      kind: 'o4p-09i-b-reliable-session-production-evidence-v1',
      scenario: {
        ...summary.scenario,
        revision: {
          ...summary.scenario.revision,
          afterPostReconnectMutation: summary.scenario.revision.afterReconnect,
        },
      },
    })).toMatchObject({ ok: false });
  });

  it('reports the exact safe session checkpoint when shared mutation convergence never settles', async () => {
    let failure: unknown;
    try {
      await runO4p09iReliabilityEvidenceTestDriverV1({
        browser: fakeBrowser([], {
          advanceEnabledSeat: 1,
          postMutationHostLagProbes: Number.MAX_SAFE_INTEGER,
        }),
        readDeck: () => 'fixture deck',
        timeoutMs: 250,
      });
    } catch (error) {
      failure = error;
    }
    expect(classifyO4p09iProductionFailureV1(failure)).toEqual({
      class: 'IMPLEMENTATION',
      code: 'PLAYER_JOURNEY_STAGE_FAILED',
      stage: 'post-actions/revision-lag',
    });
  });

  it('keeps the last safe transport checkpoint when the deadline wins a later probe', async () => {
    let failure: unknown;
    try {
      await runO4p09iReliabilityEvidenceTestDriverV1({
        browser: fakeBrowser([], {
          advanceEnabledSeat: 1,
          postMutationTransportRevisionLagThenTimeout: true,
        }),
        readDeck: () => 'fixture deck',
        timeoutMs: 250,
      });
    } catch (error) {
      failure = error;
    }
    expect(classifyO4p09iProductionFailureV1(failure)).toEqual({
      class: 'IMPLEMENTATION',
      code: 'PLAYER_JOURNEY_STAGE_FAILED',
      stage: 'post-actions/actor-selection-player-revision-lag',
    });
  });

  it('reports the exact safe checkpoint when the reliability mutation stays pending', async () => {
    let failure: unknown;
    try {
      await runO4p09iReliabilityEvidenceTestDriverV1({
        browser: fakeBrowser([], { progressStuckAfterClick: true }),
        readDeck: () => 'fixture deck',
        timeoutMs: 250,
      });
    } catch (error) {
      failure = error;
    }
    expect(classifyO4p09iProductionFailureV1(failure)).toEqual({
      class: 'IMPLEMENTATION',
      code: 'PLAYER_JOURNEY_STAGE_FAILED',
      stage: 'advance/two-player-shared-mutation/revision-ack-advance-unsettled-pending-invalid-frame',
    });
  });

  it('advances from the enabled current actor page when the host does not hold the turn', async () => {
    const expressions: string[] = [];
    const summary = await runO4p09iFullMatchEvidenceV1({
      browser: fakeBrowser(expressions, { advanceEnabledSeat: 1 }),
      readDeck: () => 'fixture deck',
      timeoutMs: 250
    });
    expect(summary.scenarios.twoPlayer.playerCount).toBe(2);
    expect(
      expressions.some((expression) =>
        expression.includes('priorityControlProbe:online-remote-advance')
      )
    ).toBe(true);
  });

  it('keeps bounded production progress running through ten two-player and fourteen four-player actions before main', async () => {
    const expressions: string[] = [];
    const summary = await runO4p09iFullMatchEvidenceV1({
      browser: fakeBrowser(expressions, { twoPlayerActionsBeforeMain: 10, fourPlayerActionsBeforeMain: 14 }),
      readDeck: () => 'fixture deck',
      timeoutMs: 250
    });
    expect(summary.scenarios.twoPlayer.playerCount).toBe(2);
    expect(summary.scenarios.fourPlayer.playerCount).toBe(4);
    const firstProgressClick = expressions.findIndex((expression) =>
      expression.includes('data-testid="online-remote-advance"') && expression.includes('node.click(); return true')
    );
    const lastActorProbe = expressions.slice(0, firstProgressClick).findLastIndex((expression) =>
      expression.includes('priorityControlProbe:online-remote-')
    );
    expect(firstProgressClick).toBeGreaterThan(lastActorProbe);
    expect(expressions.slice(lastActorProbe + 1, firstProgressClick).some((expression) =>
      expression.includes('const root = document.documentElement')
    )).toBe(false);
    expect(expressions[firstProgressClick + 1]).toContain('priorityControlProbe:online-remote-advance');
    expect(expressions[firstProgressClick + 1]).toContain('data-projection-revision');
  });

  it('fails closed when more than one seat exposes the advance actor control', async () => {
    await expect(
      runO4p09iFullMatchEvidenceV1({
        browser: fakeBrowser([], { advanceEnabledSeats: [0, 1] }),
        readDeck: () => 'fixture deck',
        timeoutMs: 250
      })
    ).rejects.toThrow('production scenario stage failed: advance/two-player-main1/actor-selection-ambiguous');
  });

  it('classifies a rejected visible progress operation without exposing its error', async () => {
    await expect(
      runO4p09iFullMatchEvidenceV1({
        browser: fakeBrowser([], { progressRejected: true }),
        readDeck: () => 'fixture deck',
        timeoutMs: 250
      })
    ).rejects.toThrow('production scenario stage failed: advance/two-player-main1/action-rejected-priority-advance-server-internal');
  });

  it('classifies an unsettled disabled progress operation without retrying it', async () => {
    await expect(runO4p09iFullMatchEvidenceV1({
      browser: fakeBrowser([], { progressStuckAfterClick: true }),
      readDeck: () => 'fixture deck',
      timeoutMs: 250,
    })).rejects.toThrow('production scenario stage failed: advance/two-player-main1/revision-ack-advance-unsettled-pending-invalid-frame');
  });

  it('fails before cast when the explicit stable-SBA operation is unavailable', async () => {
    const expressions: string[] = [];
    await expect(
      runO4p09iFullMatchEvidenceV1({
        browser: fakeBrowser(expressions, { sbaEnabledSeats: [] }),
        readDeck: () => 'fixture deck',
        timeoutMs: 250,
      })
    ).rejects.toThrow('production scenario stage failed: advance/two-player-main1/actor-selection-disabled');
    expect(expressions.some((expression) => expression.includes('priorityControlProbe:online-remote-sba-stable'))).toBe(true);
    expect(expressions.some((expression) => expression.includes('data-testid="online-remote-cast"') && expression.includes('node.click(); return true'))).toBe(false);
  });

  it('classifies a visible authority control blocked by the player transport', async () => {
    await expect(runO4p09iFullMatchEvidenceV1({
      browser: fakeBrowser([], { advanceEnabledSeats: [], actorReadinessBlock: 'not-open' }),
      readDeck: () => 'fixture deck',
      timeoutMs: 250,
    })).rejects.toThrow('production scenario stage failed: advance/two-player-main1/actor-selection-player-resyncing');
  });

  it('fails before actor selection when the current player transport surface is missing', async () => {
    const missingSurfaceExpressions: string[] = [];
    await expect(runO4p09iFullMatchEvidenceV1({
      browser: fakeBrowser(missingSurfaceExpressions, { transportSurfaceMissing: true }),
      readDeck: () => 'fixture deck',
      timeoutMs: 250,
    })).rejects.toThrow('production scenario stage failed: advance/two-player-main1/player-transport-surface-missing');
    expect(missingSurfaceExpressions.some((expression) => expression.includes('playerTransportSurfaceProbe'))).toBe(true);
    expect(missingSurfaceExpressions.some((expression) => expression.includes('data-testid="online-remote-advance"') && expression.includes('node.click(); return true'))).toBe(false);

    const normalExpressions: string[] = [];
    await runO4p09iFullMatchEvidenceV1({
      browser: fakeBrowser(normalExpressions),
      readDeck: () => 'fixture deck',
      timeoutMs: 250,
    });
    const transportSurfaceProbe = normalExpressions.findIndex((expression) => expression.includes('playerTransportSurfaceProbe'));
    const convergenceProbe = normalExpressions.findIndex((expression) => expression.includes('priorityControlProbe:online-remote-advance'));
    expect(transportSurfaceProbe).toBeGreaterThan(convergenceProbe);
  });

  it('records a bounded secret-free transport timeline on actor-selection failure', async () => {
    let failure: unknown;
    try {
      await runO4p09iFullMatchEvidenceV1({
        browser: fakeBrowser([], { advanceEnabledSeats: [], actorReadinessBlock: 'not-open' }),
        readDeck: () => 'fixture deck',
        timeoutMs: 250,
      });
    } catch (error) {
      failure = error;
    }
    const classified = classifyO4p09iProductionFailureV1(failure);
    expect(classified.stage).toBe('advance/two-player-main1/actor-selection-player-resyncing');
    expect(classified.transportTimeline).toBeDefined();
    expect(classified.transportTimeline?.length).toBeGreaterThan(0);
    expect(classified.transportTimeline?.length).toBeLessThanOrEqual(O4P09I_MAX_TRANSPORT_TIMELINE_ENTRIES_V1);
    const progressPolls = (classified.transportTimeline ?? []).filter((entry) => entry.checkpoint === 'progress-poll');
    expect(progressPolls.length).toBeGreaterThan(0);
    expect(progressPolls.some((entry) => entry.projectionRequestsSent > 0)).toBe(true);
    expect(progressPolls.some((entry) => (
      entry.projectionRequestsSent > entry.projectionFramesReceived
      && entry.projectionFramesReceived >= entry.projectionFramesAccepted
      && entry.projectionFramesRejected === 0
    ))).toBe(true);
    const allowedKeys = [
      'checkpoint', 'elapsedMs', 'pageRole', 'phase', 'pendingCount', 'knownRevision',
      'projectionRevision', 'onlineBusy', 'connectionEpoch', 'recoveryAttempt', 'issueCode',
      'projectionRequestsSent', 'projectionFramesReceived', 'projectionFramesAccepted', 'projectionFramesRejected',
    ].sort();
    for (const entry of classified.transportTimeline ?? []) {
      expect(Object.keys(entry).sort()).toEqual(allowedKeys);
      expect(['pregame-converged', 'before-advance', 'actor-selection-start', 'progress-poll', 'failure']).toContain(entry.checkpoint);
      expect(['player', 'table']).toContain(entry.pageRole);
      expect(entry.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(entry.issueCode === null || /^[A-Z][A-Z0-9_]+$/u.test(entry.issueCode)).toBe(true);
    }
    expect(JSON.stringify(classified)).not.toMatch(/P\d|fixture deck|private-token/u);
    const root = mkdtempSync(join(tmpdir(), 'o4p09i-timeline-'));
    try {
      expect(writeO4p09iJourneyFailureV1(`${root}/failure.json`, failure, root)).toBe(true);
      expect(JSON.parse(readFileSync(`${root}/failure.json`, 'utf8'))).toEqual(classified);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('classifies divergent public actor windows without choosing a control', async () => {
    await expect(runO4p09iFullMatchEvidenceV1({
      browser: fakeBrowser([], { advanceEnabledSeats: [], actorWindowDivergentSeat: 1 }),
      readDeck: () => 'fixture deck',
      timeoutMs: 250,
    })).rejects.toThrow('production scenario stage failed: advance/two-player-main1/actor-selection-contract-window-divergence');
  });

  it('rediscovers the unique priority holder and steward after every converged mutation', async () => {
    const expressions: string[] = [];
    await runO4p09iFullMatchEvidenceV1({
      browser: fakeBrowser(expressions),
      readDeck: () => 'fixture deck',
      timeoutMs: 250
    });
    const clicked = (testId: string): number =>
      expressions.filter(
        (expression) =>
          expression.includes(`data-testid="${testId}"`) &&
          expression.includes('node.click(); return true')
      ).length;
    expect(clicked('online-remote-hold')).toBe(4);
    expect(clicked('online-remote-pass')).toBe(6);
    expect(clicked('online-remote-resolve')).toBe(2);
    expect(expressions.some((expression) => expression.includes('priorityControlProbe:online-remote-hold') && expression.includes("getAttribute('aria-pressed')") && expression.includes('online-remote-hold-status'))).toBe(true);
  });

  it.each(['off', 'on'] as const)('fails closed when HOLD is stuck %s despite revision advances', async (priorityHoldStuck) => {
    const expressions: string[] = [];
    await expect(runO4p09iFullMatchEvidenceV1({
      browser: fakeBrowser(expressions, { priorityHoldStuck }),
      readDeck: () => 'fixture deck',
      timeoutMs: 250
    })).rejects.toThrow('production scenario stage failed: HOLD-pass-resolve');
    expect(expressions.some((expression) => expression.includes('data-testid="online-remote-pass"') && expression.includes('node.click(); return true'))).toBe(false);
  });

  it.each([
    ['pass', { priorityPassEnabledSeats: [0, 1] }],
    ['resolve', { priorityResolveEnabledSeats: [0, 1] }]
  ] as const)('fails closed when %s authority is ambiguous', async (_label, options) => {
    await expect(
      runO4p09iFullMatchEvidenceV1({
        browser: fakeBrowser([], options),
        readDeck: () => 'fixture deck',
        timeoutMs: 250
      })
    ).rejects.toThrow('production scenario stage failed: HOLD-pass-resolve');
  });

  it.each([
    ['accepted priority receipt', { missingPriorityReceipt: true }],
    ['resolved-top projection', { missingResolutionEvidence: true }],
    ['public-seat DOM contract', { missingPriorityDomAttribute: 'public-seat-ids' }],
    ['local-seat DOM contract', { missingPriorityDomAttribute: 'local-player-id' }],
    ['priority-window DOM contract', { missingPriorityDomAttribute: 'window-kind' }],
  ] as const)('fails closed when the %s evidence is missing', async (_label, options) => {
    await expect(
      runO4p09iFullMatchEvidenceV1({
        browser: fakeBrowser([], options),
        readDeck: () => 'fixture deck',
        timeoutMs: 250,
      })
    ).rejects.toThrow('production scenario stage failed: HOLD-pass-resolve');
  });

  it.each([
    ['not universal', { priorityHoldEnabledSeats: [0] }],
    ['revision divergent', { priorityActorRevisionOffsetSeat: 1 }],
    ['revision unsafe', { priorityActorRevisionUnsafeSeat: 1 }]
  ] as const)('does not click HOLD while the all-seat contract is %s', async (_label, options) => {
    const expressions: string[] = [];
    await expect(
      runO4p09iFullMatchEvidenceV1({
        browser: fakeBrowser(expressions, options),
        readDeck: () => 'fixture deck',
        timeoutMs: 250
      })
    ).rejects.toThrow('production scenario stage failed: HOLD-pass-resolve');
    expect(
      expressions.some(
        (expression) =>
          expression.includes('data-testid="online-remote-hold"') &&
          expression.includes('node.click(); return true')
      )
    ).toBe(false);
  });

  it('preserves an in-scenario browser outage as a secret-free environment failure', async () => {
    let failure: unknown;
    try {
      await runO4p09iFullMatchEvidenceV1({
        browser: fakeBrowser([], { priorityEnvironmentFailure: true }),
        readDeck: () => 'fixture deck',
        timeoutMs: 250
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe('production environment failure: two-player/advance/progress-probe/command-timeout');
    expect(classifyO4p09iProductionFailureV1(failure)).toEqual({
      class: 'ENVIRONMENT',
      code: 'BROWSER_ENVIRONMENT_UNAVAILABLE',
      stage: 'two-player/advance/progress-probe/command-timeout'
    });
    expect((failure as Error).message).not.toContain('CDP');
  });

  it('retains only allowlisted environment context and drops private error suffixes', () => {
    const safe = 'two-player/reconnect/command-failed';
    expect(classifyO4p09iProductionFailureV1(new Error(`production environment failure: ${safe}`)).stage).toBe(safe);
    expect(classifyO4p09iProductionFailureV1(new Error(`production environment failure: ${safe}/private-token`)).stage).toBe('setup');
    expect(classifyO4p09iProductionFailureV1(new Error('CDP command failed: private-token')).stage).toBe('setup');
    expect(classifyO4p09iProductionFailureV1(new Error('CDP command failed')).stage).toBe('command-failed');
  });

  it('distinguishes reconnect evidence failures from product convergence without exposing raw details', () => {
    const classify = (detail: string) => classifyO4p09iProductionFailureV1(new Error(`production scenario stage failed: reconnect/${detail}`));
    expect(classify('private choice surface snapshot changed')).toEqual({ class: 'EVIDENCE', code: 'EVIDENCE_HARNESS_FAILED', stage: 'reconnect/dom-snapshot-changed' });
    expect(classify('pre-reconnect private audience leak').stage).toBe('reconnect/before-private-leak');
    expect(classify('reconnect convergence not observed/rejoined=false,revision=true,presence=true,digest=true,priority=true').stage).toBe('reconnect/convergence-01111');
    expect(classify('private choice surface snapshot changed/private-token').stage).toBe('reconnect');
  });

  it('fails closed until every seat observes the same target phase', async () => {
    await expect(
      runO4p09iFullMatchEvidenceV1({
        browser: fakeBrowser([], { divergentPhaseSeat: 1 }),
        readDeck: () => 'fixture deck',
        timeoutMs: 250
      })
    ).rejects.toThrow('production scenario stage failed: advance');
  });

  it('waits for the host to observe every seat ready before starting', async () => {
    const expressions: string[] = [];
    await runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser(expressions), readDeck: () => 'fixture deck' });
    const readiness = expressions.findIndex((expression) => expression.includes("status.includes('提出済み')") && expression.includes("status.includes('準備完了')"));
    const startClick = expressions.findIndex((expression) => expression.includes('data-testid="online-start-game"') && expression.includes('node.click(); return true'));
    expect(readiness).toBeGreaterThanOrEqual(0);
    expect(startClick).toBeGreaterThan(readiness);
  });

  it('does not start until a delayed lobby readiness probe turns true', async () => {
    const expressions: string[] = [];
    await runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser(expressions, { lobbyReadyProbe: 'delayed' }), readDeck: () => 'fixture deck', timeoutMs: 250 });
    const readinessProbes = expressions.filter((expression) => expression.includes("status.includes('提出済み')") && expression.includes("status.includes('準備完了')"));
    const startClicks = expressions.filter((expression) => expression.includes('data-testid="online-start-game"') && expression.includes('node.click(); return true'));
    expect(readinessProbes.length).toBeGreaterThan(2);
    expect(startClicks.length).toBe(2);
  });

  it('fails closed without a start click when lobby readiness never arrives', async () => {
    const expressions: string[] = [];
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser(expressions, { lobbyReadyProbe: 'never' }), readDeck: () => 'fixture deck', timeoutMs: 250 })).rejects.toThrow('production scenario stage failed: start-game');
    expect(expressions.some((expression) => expression.includes('data-testid="online-start-game"') && expression.includes('node.click(); return true'))).toBe(false);
  });

  it('syntax-compiles every browser evaluate payload collected by the injected harness', async () => {
    const expressions: string[] = [];
    await runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser(expressions), readDeck: () => 'fixture deck' });
    for (const [index, expression] of expressions.entries()) {
      try {
        new Script(`(async () => { const argument = undefined; return (${expression}); })()`);
      } catch (error) {
        throw new Error(`browser evaluate payload ${index} is not valid JavaScript: ${error instanceof Error ? error.message : 'syntax error'}`, { cause: error });
      }
    }
  });

  it('reads a DOM larger than a CDP frame in bounded consistent chunks without sending private tokens', async () => {
    const expressions: string[] = [];
    await runO4p09iReliabilityEvidenceTestDriverV1({ browser: fakeBrowser(expressions), readDeck: () => 'fixture deck' });
    const expression = expressions.find((value) => value.includes('privateChoiceDomSurfaces'));
    expect(expression).toBeDefined();
    const nodes = Array.from({ length: 2_050 }, () => ({ childNodes: [{ nodeType: 3, nodeValue: '' }], attributes: [{ name: 'data-fixture', value: '' }] }));
    nodes[0].childNodes[0].nodeValue = 'x'.repeat(70_000);
    nodes[2_049].attributes[0].value = 'private-fixture-token';
    const scan = (offset: number) => new Script(expression!).runInNewContext({
      document: { querySelectorAll: () => nodes }, TextEncoder, crypto: webcrypto,
      argument: { offset },
    }) as Promise<{ complete: boolean; chunk: string; digest: string; length: number }>;
    let serialized = '';
    const first = await scan(0);
    do {
      const part = await scan(serialized.length);
      expect(part.complete).toBe(true);
      expect(part.digest).toBe(first.digest);
      expect(new TextEncoder().encode(JSON.stringify(part)).length).toBeLessThan(65_536);
      serialized += part.chunk;
    } while (serialized.length < first.length);
    expect(createHash('sha256').update(serialized).digest('hex')).toBe(first.digest);
    expect(JSON.parse(serialized)).toContain('private-fixture-token');
    nodes[2_049].attributes[0].value = 'changed';
    expect((await scan(0)).digest).not.toBe(first.digest);
    nodes[0].childNodes[0].nodeValue = 'x'.repeat(262_144);
    expect((await scan(0)).complete).toBe(false);
  });

  it('rejects malformed, secret-bearing, and incomplete cleanup summaries', async () => {
    const summary = await runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([]), readDeck: () => 'fixture deck' });
    expect(validateO4p09iFullMatchEvidenceV1({ ...summary, schemaVersion: 2 })).toMatchObject({ ok: false });
    expect(validateO4p09iFullMatchEvidenceV1({ ...summary, chromeVersion: 'seat_secret_12345678' })).toMatchObject({ ok: false });
    expect(validateO4p09iFullMatchEvidenceV1({ ...summary, cleanup: { ...summary.cleanup, pagesClosed: 1 } })).toMatchObject({ ok: false });
    expect(validateO4p09iFullMatchEvidenceV1({ ...summary, consoleCounts: { errors: 1, warnings: 0, secretViolations: 0 } })).toMatchObject({ ok: false });
    expect(validateO4p09iFullMatchEvidenceV1({
      ...summary,
      scenarios: {
        ...summary.scenarios,
        twoPlayer: { ...summary.scenarios.twoPlayer, revision: { ...summary.scenarios.twoPlayer.revision, afterReconnect: 0 } },
      },
    })).toMatchObject({ ok: false });
    expect(validateO4p09iFullMatchEvidenceV1({
      ...summary,
      scenarios: {
        ...summary.scenarios,
        twoPlayer: { ...summary.scenarios.twoPlayer, reconnect: { ...summary.scenarios.twoPlayer.reconnect, recoveredSeatRejoined: false } },
      },
    })).toMatchObject({ ok: false });
    expect(validateO4p09iFullMatchEvidenceV1({
      ...summary,
      scenarios: {
        ...summary.scenarios,
        twoPlayer: { ...summary.scenarios.twoPlayer, reconnect: { ...summary.scenarios.twoPlayer.reconnect, privateAudienceIsolated: false } },
      },
    })).toMatchObject({ ok: false });
    expect(validateO4p09iFullMatchEvidenceV1({
      ...summary,
      scenarios: {
        ...summary.scenarios,
        twoPlayer: { ...summary.scenarios.twoPlayer, revision: { ...summary.scenarios.twoPlayer.revision, start: summary.scenarios.twoPlayer.revision.afterSharedMutation + 1 } },
      },
    })).toMatchObject({ ok: false });
    expect(validateO4p09iFullMatchEvidenceV1({
      ...summary,
      scenarios: { ...summary.scenarios, twoPlayer: { ...summary.scenarios.twoPlayer, priority: null } },
    })).toMatchObject({ ok: false });
    expect(validateO4p09iFullMatchEvidenceV1({
      ...summary,
      scenarios: {
        ...summary.scenarios,
        twoPlayer: {
          ...summary.scenarios.twoPlayer,
          priority: { ...summary.scenarios.twoPlayer.priority!, resolvedRevision: summary.scenarios.twoPlayer.priority!.startRevision + 4 },
        },
      },
    })).toMatchObject({ ok: false });
  });

  it.each([
    ['missing authoritative rejoined', { missingRejoined: true }],
    ['missing peer disconnected presence', { peerPresenceStuck: true }],
    ['divergent shared public digest', { reconnectDigestDivergentSeat: 1 }],
    ['private audience leak after reconnect', { reconnectPrivateLeakSeat: 1 }],
  ] as const)('fails reconnect evidence for %s', async (_label, options) => {
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], options), readDeck: () => 'fixture deck', timeoutMs: 250 }))
      .rejects.toThrow('production scenario stage failed: reconnect');
  });

  it.each([
    ['missing visible control', { missingControl: 'online-remote-hold' }],
    ['hidden visible control', { hiddenControl: 'online-remote-hold' }],
    ['horizontal overflow', { overflow: 4 }],
    ['stagnant revision', { stagnantRevision: true }],
    ['phase never advances', { stagnantPhase: true }],
    ['missing winner', { missingWinner: true }],
    ['missing worker origin observation', { missingWorker: true }],
    ['opponent leak', { leak: true }],
    ['cross-seat private choice leak', { privateChoiceLeak: true }],
    ['private choice candidate leak without choose testid', { privateChoiceCandidateLeak: true }],
    ['private choice candidate leak beyond legacy scan bound', { privateChoiceCandidateLeakBeyondBound: true }],
    ['private choice scan bound exhaustion', { privateChoiceScanBoundExceeded: true }],
    ['authorized private capture bound exhaustion', { privateChoiceCaptureBoundExceeded: true }],
    ['private choice non-handle attribute/text token leak', { privateChoiceCandidateTokenLeak: true }],
    ['probe leak scan bound exhaustion', { leakScanBoundExceeded: true }],
    ['vertical geometry collision', { geometryFailure: 'vertical-collision' }],
    ['offscreen active panel', { geometryFailure: 'offscreen-panel' }],
    ['inaccessible scroll region', { geometryFailure: 'inaccessible-scroll' }],
    ['non-scrollable region', { geometryFailure: 'non-scrollable' }],
    ['focus-inaccessible region', { geometryFailure: 'focus-inaccessible' }],
    ['obscured battlefield', { geometryFailure: 'obscured-battlefield' }],
    ['clipped primary action', { geometryFailure: 'clipped-primary' }],
    ['console error', { consoleErrors: 1 }],
    ['console warning before reconnect', { consoleWarnings: 1 }],
    ['secret violation before reconnect', { consoleSecretViolations: 1 }],
    ['peer-only console warning before reconnect', { consoleWarningContext: 1 }],
    ['peer-only secret violation before reconnect', { consoleSecretContext: 1 }],
    ['replacement-only console warning', { consoleWarningReplacement: true }],
    ['replacement-only secret violation', { consoleSecretReplacement: true }],
  ] as const)('fails closed for %s', async (_label, options) => {
    const shortFailure = ('stagnantRevision' in options && options.stagnantRevision === true) || ('stagnantPhase' in options && options.stagnantPhase === true) || ('missingWinner' in options && options.missingWinner === true);
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], options), readDeck: () => 'fixture deck', timeoutMs: shortFailure ? 250 : undefined })).rejects.toThrow();
  });

  it.each([
    [{ missingControl: 'online-create-shared' }, 'production scenario stage failed: create-room'],
    [{ missingControl: 'online-invite-link-copy' }, 'production scenario stage failed: create-room'],
    [{ missingControl: 'online-remote-hold' }, 'production scenario stage failed: HOLD-pass-resolve'],
  ] as const)('reports only the finite scenario stage for a UI failure', async (options, message) => {
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], options), readDeck: () => 'fixture deck', timeoutMs: 250 })).rejects.toThrow(message);
  });

  it('waits for asynchronously rendered invite controls and values', async () => {
    const expressions: string[] = [];
    const summary = await runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser(expressions, { asyncInviteRender: true }), readDeck: () => 'fixture deck', timeoutMs: 250 });
    expect(summary.scenarios.twoPlayer.playerCount).toBe(2);
    expect(expressions.filter((expression) => expression.includes('コードを表示')).length).toBeGreaterThan(1);
    expect(expressions.filter((expression) => expression.includes('invite span')).length).toBeGreaterThan(1);
  });

  it('classifies a visible retryable room creation failure as an environment stop', async () => {
    await expect(runO4p09iFullMatchEvidenceV1({
      browser: fakeBrowser([], { roomCreationRetryableError: true }),
      readDeck: () => 'fixture deck',
      timeoutMs: 250,
    })).rejects.toThrow('production environment failure: two-player/create-room/visible-ui-operation');
  });

  it('waits for the shared game surface after start before recording host revision', async () => {
    const expressions: string[] = [];
    const summary = await runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser(expressions, { asyncStartProbe: true }), readDeck: () => 'fixture deck', timeoutMs: 250 });
    expect(summary.scenarios.twoPlayer.revision.afterSharedMutation).toBeGreaterThan(0);
    const gameScreenProbes = expressions.filter((expression) => expression.includes('gameScreens'));
    expect(gameScreenProbes.length).toBeGreaterThan(4);
  });

  it('accepts the terminal ready transition when the pregame revision marker unmounts', async () => {
    const expressions: string[] = [];
    const summary = await runO4p09iFullMatchEvidenceV1({
      browser: fakeBrowser(expressions, { pregameReadyRevisionMissing: true }),
      readDeck: () => 'fixture deck',
      timeoutMs: 250,
    });
    expect(summary.scenarios.twoPlayer.playerCount).toBe(2);
    expect(expressions.some((expression) => expression.includes('pregameTerminalSurfaceProbe'))).toBe(true);
  });

  it('fails closed when terminal ready has neither a revision nor a started surface', async () => {
    const expressions: string[] = [];
    await expect(runO4p09iFullMatchEvidenceV1({
      browser: fakeBrowser(expressions, { pregameReadyRevisionMissing: true, pregameTerminalSurfaceFailure: true }),
      readDeck: () => 'fixture deck',
      timeoutMs: 250,
    })).rejects.toThrow('production scenario stage failed: pregame-control');
    expect(expressions.some((expression) => expression.includes('pregameTerminalSurfaceProbe'))).toBe(true);
  });

  it('drives manual stack and resolve from the seat whose current actor control is enabled', async () => {
    const expressions: string[] = [];
    const summary = await runO4p09iFullMatchEvidenceV1({
      browser: fakeBrowser(expressions, { manualStackEnabledSeat: 1 }),
      readDeck: () => 'fixture deck',
      timeoutMs: 250,
    });
    expect(summary.scenarios.twoPlayer.playerCount).toBe(2);
    expect(expressions.some((expression) => expression.includes('priorityControlProbe:online-tabletop-submit-stack-entry'))).toBe(true);
    expect(
      expressions.some((expression) =>
        expression.includes('priorityControlProbe:online-tabletop-submit-manual-resolve')
      )
    ).toBe(true);
  });

  it('fails closed when more than one seat exposes the manual stack actor control', async () => {
    await expect(
      runO4p09iFullMatchEvidenceV1({
        browser: fakeBrowser([], { manualStackEnabledSeats: [0, 1] }),
        readDeck: () => 'fixture deck',
        timeoutMs: 250
      })
    ).rejects.toThrow('production scenario stage failed: manual-stack/entry');
  });

  it('fails closed when manual resolve has duplicate actors', async () => {
    await expect(
      runO4p09iFullMatchEvidenceV1({
        browser: fakeBrowser([], {
          manualStackEnabledSeats: [0],
          manualResolveEnabledSeats: [0, 1]
        }),
        readDeck: () => 'fixture deck',
        timeoutMs: 250
      })
    ).rejects.toThrow('production scenario stage failed: manual-stack/resolve');
  });

  it('does not select an actor while seat revisions diverge', async () => {
    const expressions: string[] = [];
    await expect(
      runO4p09iFullMatchEvidenceV1({
        browser: fakeBrowser(expressions, { actorRevisionOffsetSeat: 1 }),
        readDeck: () => 'fixture deck',
        timeoutMs: 250
      })
    ).rejects.toThrow('production scenario stage failed: advance');
    expect(
      expressions.some(
        (expression) =>
          expression.includes('node.click(); return true') &&
          expression.includes('online-remote-advance')
      )
    ).toBe(false);
  });

  it('does not select an actor from an incomplete safe-revision probe set', async () => {
    const expressions: string[] = [];
    await expect(
      runO4p09iFullMatchEvidenceV1({
        browser: fakeBrowser(expressions, { actorRevisionUnsafeSeat: 1 }),
        readDeck: () => 'fixture deck',
        timeoutMs: 250
      })
    ).rejects.toThrow('production scenario stage failed: advance');
    expect(
      expressions.some(
        (expression) =>
          expression.includes('node.click(); return true') &&
          expression.includes('online-remote-advance')
      )
    ).toBe(false);
  });

  it('fails closed when no seat exposes an enabled manual stack actor control', async () => {
    const expressions: string[] = [];
    await expect(runO4p09iFullMatchEvidenceV1({
      browser: fakeBrowser(expressions, { manualStackEnabledSeat: 9 }),
      readDeck: () => 'fixture deck',
      timeoutMs: 250,
    })).rejects.toThrow('production scenario stage failed: manual-stack/entry');
    expect(expressions.some((expression) => expression.includes('priorityControlProbe:online-tabletop-submit-stack-entry'))).toBe(true);
  });

  it('bounds a manual stack actor probe that never settles', async () => {
    const expressions: string[] = [];
    await expect(runO4p09iFullMatchEvidenceV1({
      browser: fakeBrowser(expressions, { manualStackEnabledProbeNeverSettles: true }),
      readDeck: () => 'fixture deck',
      timeoutMs: 250,
    })).rejects.toThrow('production scenario stage failed: manual-stack/entry');
    expect(expressions.some((expression) => expression.includes('priorityControlProbe:online-tabletop-submit-stack-entry'))).toBe(true);
  });

  it.each([
    'game-screen-missing/count', 'horizontal-overflow', 'opponent-leak', 'console-error', 'host-revision-missing',
  ] as const)('reports only the bounded start-probe subreason: %s', async (reason) => {
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], { startedSurfaceFailure: reason }), readDeck: () => 'fixture deck', timeoutMs: 250 })).rejects.toThrow(`production scenario stage failed: start-probe/${reason}`);
  });

  it.each([
    'start-rejected', 'start-pending', 'start-not-accepted',
  ] as const)('classifies a missing game surface from visible start controls: %s', async (reason) => {
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], { startedSurfaceFailure: reason }), readDeck: () => 'fixture deck', timeoutMs: 250 })).rejects.toThrow(`production scenario stage failed: start-probe/${reason}`);
  });

  it('fails closed when the browser profile cannot be cleaned up', async () => {
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], { closeFailure: true }), readDeck: () => 'fixture deck' })).rejects.toThrow('cleanup failed');
  });
});
