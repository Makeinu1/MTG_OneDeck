import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as Core from '../../engine/core/index';
import { buildVariableRoomGenesisV3 } from '../../online/genesis/index';
import * as Pregame from '../../online/pregame/index';
import { validateOnlineParticipantProjectionV3 } from '../../online/projection/index';
import type { OnlineVariableProtocolStateV2 } from '../../online/protocol/index';
import type { CardDef } from '../../types/card';

const ROOT = resolve(import.meta.dirname, '../../..');
const BASE_SHA = '5f62a8f6730fd7a758d8b284ba818cf19f09c347';
const COMMANDER_SID = '7ca8654a-683f-4c35-94b8-27afa05e57f8';
const COMMANDER_OID = 'ef2531a6-02f7-41b4-866b-93b538789e06';
const MAIN_SID = '5d8c9cfe-b0aa-4454-a54a-98b67a8b328b';
const MAIN_OID = 'a6cc60cc-36e8-4a1b-902e-d5362da173ab';

const ONLINE_PRODUCT_PATHS = [
  'src/online/pregame/index.ts',
  'src/online/pregame/types.ts',
  'src/online/pregame/validation.ts',
  'src/online/pregame/operations.ts',
  'src/online/pregame/projection.ts',
  'src/online/pregame/__tests__/pregameLifecycleV1.test.ts',
] as const;
const CORE_PREGAME_PATHS = [
  'src/engine/core/pregame/index.ts',
  'src/engine/core/pregame/typesV1.ts',
  'src/engine/core/pregame/operationsV1.ts',
  'src/engine/core/pregame/__tests__/pregameOperationsV1.test.ts',
] as const;
const CORE_DRAW_SKIP_PATHS = [
  'src/engine/core/index.ts',
  'src/engine/core/turn/index.ts',
  'src/engine/core/turn/turnAdvanceV1.ts',
  'src/engine/core/tabletop/commandV1.ts',
  'src/engine/core/closure/commandV1.ts',
  'src/engine/core/closure/applyCommandV1.ts',
  'src/engine/core/closure/rootValidationV1.ts',
  'src/engine/core/closure/__tests__/repairWave1.test.ts',
] as const;
const PROJECTION_COMPAT_PATHS = [
  'src/online/projection/validation.ts',
  'src/online/projection/__tests__/projectionV1.test.ts',
] as const;
const O4P_09C_UI_SUCCESSOR_PATHS = new Set([
  'research/cr-grounding/o4p-09c-ui-acceptance-brief.draft.md',
  'research/cr-grounding/o4p-09c-ui-cold-audit-brief.draft.md',
  'research/cr-grounding/o4p-09c-ui-implementation-brief.draft.md',
  'research/cr-grounding/o4p-09c-ui-production-pregame.contract.draft.md',
  'research/cr-grounding/o4p-09c-ui-repair-1-implementation-brief.draft.md',
  'research/cr-grounding/o4p-09c-ui-repair-1-correction-1-brief.draft.md',
  'research/cr-grounding/o4p-09c-ui-ci-timeout-repair-brief.draft.md',
  'research/cr-grounding/archive/o4p-09c-ui-production-pregame-cold-audit-record-2026-08-26.md',
  'scripts/checks/verify-online-cloudflare-runtime-persistence.ts',
  'scripts/checks/verify-online-cloudflare-websocket-recovery.ts',
  'scripts/checks/verify-online-cloudflare-capability-abuse-control.ts',
  'scripts/checks/verify-online-cloudflare-production-gate.ts',
  'scripts/checks/verify-o4p-05c-release-gates.ts',
  'scripts/checks/verify-o4p-05d-production-release-closure.ts',
  'src/components/game/GameScreen.tsx',
  'src/components/game/game.css',
  'src/components/online/OnlinePregameLayer.tsx',
  'src/components/online/__tests__/OnlinePregameLayer.test.tsx',
  'src/components/online/__tests__/PublicOnlineApp.test.tsx',
  'src/components/online/PublicOnlineApp.tsx',
  'src/dev/visualFixtures/PregameFixture.tsx',
  'src/dev/visualFixtures/main.tsx',
  'src/online/cloudflare/persistence.ts',
  'src/online/cloudflare/runtime.ts',
  'src/online/cloudflare/support.ts',
  'src/online/cloudflare/worker.ts',
  'src/online/cloudflare/__tests__/variableRuntimeV4.test.ts',
  'src/online/cloudflare/__tests__/review.o4p-08c-variable-runtime.test.ts',
  'src/online/publicApp/publicAppClientV3.test.ts',
  'src/online/publicApp/review.o4p-08d-variable-public-client.test.ts',
  'src/online/publicApp/recoveryV1.ts',
  'src/online/publicApp/types.ts',
  'src/online/publicApp/v3.ts',
  'src/test/architecture/review.o4p-09c-ui-production-pregame.test.ts',
  'src/test/architecture/review.o4p-03a-cloudflare-runtime-persistence-boundary.test.ts',
  'src/test/architecture/review.o4p-03b-websocket-recovery-boundary.test.ts',
  'src/test/architecture/review.o4p-03c-capability-abuse-control-boundary.test.ts',
  'src/test/architecture/review.o4p-07a-dynamic-card-resolution-boundary.test.ts',
]);
const O4P_09D_SUCCESSOR_PATHS = new Set([
  'research/cr-grounding/o4p-09d-acceptance-brief.draft.md',
  'research/cr-grounding/o4p-09d-browser-evidence.draft.md',
  'research/cr-grounding/o4p-09d-cold-audit-brief.draft.md',
  'research/cr-grounding/o4p-09d-full-check-repair-1-cold-audit-brief.draft.md',
  'research/cr-grounding/o4p-09d-full-check-repair-1.draft.md',
  'research/cr-grounding/o4p-09d-full-check-repair-2-cold-audit-brief.draft.md',
  'research/cr-grounding/o4p-09d-full-check-repair-2.draft.md',
  'research/cr-grounding/o4p-09d-full-check-repair-3-cold-audit-brief.draft.md',
  'research/cr-grounding/o4p-09d-full-check-repair-3.draft.md',
  'research/cr-grounding/o4p-09d-implementation-brief.draft.md',
  'research/cr-grounding/o4p-09d-tabletop-primitives.contract.draft.md',
  'src/components/online/OnlineTabletopManual.tsx',
  'src/components/online/__tests__/OnlineTabletopManual.test.tsx',
  'src/components/online/onlineTabletopManual.css',
  'src/components/online/tabletopManualViewTypes.ts',
  'src/dev/visualFixtures/TabletopManualFixture.test.tsx',
  'src/dev/visualFixtures/TabletopManualFixture.tsx',
  'src/dev/visualFixtures/fixtureBuilder.ts',
  'src/dev/visualFixtures/tabletopManualFixture.css',
  'src/engine/core/closure/domainEventV1.ts',
  'src/engine/core/closure/rootV1.ts',
  'src/engine/core/tabletop/__tests__/tabletopCommandsV1.test.ts',
  'src/engine/core/tabletop/index.ts',
  'src/engine/core/tabletop/manualStateV1.ts',
  'src/engine/core/tabletop/operationsV1.ts',
  'src/online/browser/__tests__/browserClientV1.test.ts',
  'src/online/browser/client.ts',
  'src/online/browser/index.ts',
  'src/online/browser/types.ts',
  'src/online/cloudflare/__tests__/tabletopRuntimeV1.test.ts',
  'src/online/cloudflare/projectionBudgetV1.ts',
  'src/online/projection/project.ts',
  'src/online/projection/support.ts',
  'src/online/projection/types.ts',
  'src/online/tabletopManual/__tests__/serverV1.test.ts',
  'src/online/tabletopManual/__tests__/validationV1.test.ts',
  'src/online/tabletopManual/binding.ts',
  'src/online/tabletopManual/index.ts',
  'src/online/tabletopManual/server.ts',
  'src/online/tabletopManual/types.ts',
  'src/online/tabletopManual/validation.ts',
  'src/test/architecture/review.o4p-01h-core-boundary.test.ts',
  'src/test/architecture/review.o4p-01j-stack-transaction-boundary.test.ts',
  'src/test/architecture/review.o4p-09d-tabletop-primitives.test.ts',
]);
const O4P_09E_SUCCESSOR_PATHS = new Set([
  'research/cr-grounding/o4p-09e-acceptance-brief.draft.md',
  'research/cr-grounding/o4p-09e-browser-evidence.draft.md',
  'research/cr-grounding/o4p-09e-cold-audit-brief.draft.md',
  'research/cr-grounding/o4p-09e-full-check-repair-1-cold-audit-brief.draft.md',
  'research/cr-grounding/o4p-09e-full-check-repair-1.draft.md',
  'research/cr-grounding/o4p-09e-full-check-repair-2-cold-audit-brief.draft.md',
  'research/cr-grounding/o4p-09e-full-check-repair-2.draft.md',
  'research/cr-grounding/o4p-09e-implementation-brief.draft.md',
  'research/cr-grounding/o4p-09e-repair-record.draft.md',
  'research/cr-grounding/o4p-09e-visibility-decisions.contract.draft.md',
  'src/components/online/OnlineVisibilityDecisions.tsx',
  'src/components/online/__tests__/OnlineVisibilityDecisions.test.tsx',
  'src/components/online/onlineVisibilityDecisions.css',
  'src/engine/core/closure/__tests__/commandV1.test.ts',
  'src/engine/core/closure/applyCommandV1.ts',
  'src/engine/core/closure/commandV1.ts',
  'src/engine/core/rules/__tests__/searchSessionV1.test.ts',
  'src/engine/core/rules/__tests__/visibilityGrantOperationsV1.test.ts',
  'src/engine/core/rules/index.ts',
  'src/engine/core/rules/ruleDurationV1.ts',
  'src/engine/core/rules/searchSessionOperationsV1.ts',
  'src/engine/core/rules/visibilityGrantOperationsV1.ts',
  'src/engine/core/rules/visibilityGrantV1.ts',
  'src/engine/core/turn/__tests__/turnPriorityBundleValidationV1.test.ts',
  'src/online/cloudflare/__tests__/journalMigrationV1.test.ts',
  'src/online/cloudflare/__tests__/review.o4p-03d-cloudflare-production-gate.test.ts',
  'src/online/cloudflare/__tests__/securitySqlFixture.ts',
  'src/online/projection/__tests__/review.o4p-02d-audience-projection.test.ts',
  'src/online/projection/index.ts',
  'src/online/projection/requestTypes.ts',
  'src/online/projection/variable.ts',
  'src/online/protocol/variable.ts',
  'src/online/protocol/variableCommand.ts',
  'src/online/visibilityDecisions/__tests__/binding.test.ts',
  'src/online/visibilityDecisions/__tests__/validation.test.ts',
  'src/online/visibilityDecisions/binding.ts',
  'src/online/visibilityDecisions/index.ts',
  'src/online/visibilityDecisions/sessionHandle.ts',
  'src/online/visibilityDecisions/types.ts',
  'src/online/visibilityDecisions/validation.ts',
  'src/test/architecture/review.o4p-09e-visibility-decisions.test.ts',
  'src/test/architecture/review.o4p-01l-rule-authority-boundary.test.ts',
  'src/test/architecture/review.o4p-02c-in-memory-protocol-boundary.test.ts',
  'src/test/architecture/soloOnlineBoundary.test.ts',
]);
const JUDGE_PATHS = new Set([
  '.agents/skills/mtg-onedeck-development/SKILL.md',
  '.agents/skills/mtg-onedeck-development/references/document-governance.md',
  '.agents/skills/mtg-onedeck-development/references/request-normalization.md',
  '.claude/loop-state.md',
  '.github/workflows/deploy-pages.yml',
  'AGENTS.md',
  'docs/judge-protocol.md',
  'docs/contracts/manifest.json',
  'docs/generated/engine-api.md',
  'package.json',
  'research/cr-grounding/archive/governance/gov-codex-58a-cold-audit-record-2026-08-29.md',
  'research/cr-grounding/cr-backbone-ledger.json',
  'research/cr-grounding/gov-codex-58a-supervisor-enforcement-acceptance.draft.md',
  'research/cr-grounding/gov-codex-58a-supervisor-enforcement-cold-audit-brief.draft.md',
  'research/cr-grounding/gov-codex-58a-supervisor-enforcement-implementation-brief.draft.md',
  'research/cr-grounding/gov-codex-58a-supervisor-enforcement.contract.draft.md',
  'research/cr-grounding/supervisor-events/GOV-CODEX-58A-2026-08.json',
  'research/cr-grounding/gov-codex-57-autonomy-player-journey-acceptance.draft.md',
  'research/cr-grounding/gov-codex-57-autonomy-player-journey-cold-audit-brief.draft.md',
  'research/cr-grounding/gov-codex-57-autonomy-player-journey-implementation-brief.draft.md',
  'research/cr-grounding/gov-codex-57-autonomy-player-journey.contract.draft.md',
  'research/cr-grounding/o4p-09-roadmap-ledger-update.draft.json',
  'research/cr-grounding/o4p-09-roadmap-registration-acceptance.draft.md',
  'research/cr-grounding/o4p-09-shared-table-playable-roadmap.contract.draft.md',
  'research/cr-grounding/planned-sequence-batch-o4p-09.draft.md',
  'research/cr-grounding/archive/o4p-09c-pregame-lifecycle-cold-audit-record-2026-08-26.md',
  'research/cr-grounding/archive/o4p-09d-tabletop-primitives-cold-audit-record-2026-08-26.md',
  'research/cr-grounding/o4p-09c-pregame-lifecycle.contract.draft.md',
  'research/cr-grounding/o4p-09c-acceptance-brief.draft.md',
  'research/cr-grounding/o4p-09c-implementation-brief.draft.md',
  'research/cr-grounding/o4p-09c-cold-audit-brief.draft.md',
  'research/cr-grounding/o4p-09d-full-check-repair-4.draft.md',
  'research/cr-grounding/o4p-09d-full-check-repair-4-implementation-brief.draft.md',
  'research/cr-grounding/o4p-09d-full-check-repair-4-cold-audit-brief.draft.md',
  'scripts/__tests__/codexContext.test.mjs',
  'scripts/__tests__/codexUsage.test.mjs',
  'scripts/__tests__/forbidden-policy.test.mjs',
  'scripts/__tests__/governanceSupervisor.test.mjs',
  'scripts/__tests__/governanceReleaseTools.test.mjs',
  'scripts/__tests__/review.codex-ops.test.mjs',
  'scripts/checks/budget.mjs',
  'scripts/checks/forbidden-files.mjs',
  'scripts/checks/guard-impact.mjs',
  'scripts/checks/ownership.mjs',
  'scripts/checks/release-preflight.mjs',
  'scripts/checks/terminal-metadata.mjs',
  'scripts/checks/verify-o4p-05c-release-gates.ts',
  'scripts/checks/verify-o4p-05d-production-release-closure.ts',
  'scripts/codex-context.mjs',
  'scripts/codex-program-step.mjs',
  'scripts/codex-usage.mjs',
  'scripts/lib/supervisor-authority.mjs',
  'scripts/lib/supervisor-state.mjs',
  'src/online/headless/__tests__/review.o4p-02e-local-room-gate.test.ts',
  'src/online/headless/__tests__/review.o4p-05b-four-player-release-scenario.test.ts',
  'src/online/headless/__tests__/review.o4p-06b-playable-table-command-surface.test.ts',
  'src/test/architecture/deployPagesGates.test.ts',
  'src/test/architecture/modeNeutralCoreBoundary.test.ts',
  'src/test/architecture/o4p01iStackAnnouncementBoundary.test.ts',
  'src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts',
  'src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts',
  'src/test/architecture/review.o4p-09-roadmap-registration.test.ts',
  'src/test/architecture/review.o4p-09a-unified-game-surface.test.ts',
  'src/test/architecture/review.o4p-09b-shared-intent-application.test.ts',
  'src/test/architecture/review.o4p-09c-pregame-lifecycle.test.ts',
  'src/test/architecture/review.gov-codex-56-program-orchestration.test.ts',
  'src/test/architecture/review.gov-codex-56r2-request-normalization.test.ts',
  'src/test/architecture/review.gov-codex-57-autonomy-player-journey.test.ts',
  'src/test/architecture/review.gov-codex-58a-supervisor-enforcement.test.ts',
  'src/test/architecture/review.o4p-04b-table-display-boundary.test.ts',
  'src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts',
  'src/test/architecture/review.o4p-04d-guided-actions-boundary.test.ts',
  'src/test/architecture/review.o4p-04a-personal-workbench-boundary.test.ts',
  'src/test/architecture/review.o4p-05d-production-release-closure.test.ts',
  'src/test/architecture/review.o4p-06-roadmap-registration.test.ts',
  'src/test/architecture/review.o4p-06d-browser-websocket-recovery-boundary.test.ts',
  'src/test/architecture/review.o4p-06f-four-browser-production-release.test.ts',
  'src/test/architecture/review.o4p-07-roadmap-registration.test.ts',
  'src/test/architecture/review.o4p-08-roadmap-registration.test.ts',
  'src/test/architecture/review.o4p-08c-variable-roster-boundary.test.ts',
]);

const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');
const gitLines = (args: string[]): string[] => execFileSync('git', args, {
  cwd: ROOT,
  encoding: 'utf8',
}).trim().split(/\r?\n/u).filter(Boolean);

function card(
  scryfallId: string,
  oracleId: string,
  name: string,
  typeLine: string,
): CardDef {
  return Object.freeze({
    scryfallId,
    oracleId,
    name,
    lang: 'en',
    layout: 'normal',
    cmc: 2,
    colorIdentity: [],
    typeLine,
    faces: [{ name, typeLine, oracleText: '' }],
  });
}

function genesis(
  playerCount: 2 | 4,
  startingLife: 20 | 40 = 40,
  mainQuantity = 20,
) {
  const entries = Object.freeze([
    Object.freeze({
      index: 0,
      section: 'commander' as const,
      quantity: 1,
      scryfallId: COMMANDER_SID,
      oracleId: COMMANDER_OID,
      definition: card(COMMANDER_SID, COMMANDER_OID, 'Pregame Commander', 'Legendary Creature'),
    }),
    Object.freeze({
      index: 1,
      section: 'main' as const,
      quantity: mainQuantity,
      scryfallId: MAIN_SID,
      oracleId: MAIN_OID,
      definition: card(MAIN_SID, MAIN_OID, 'Pregame Main Card', 'Artifact'),
    }),
  ]);
  const serialized = JSON.stringify({ entries });
  const snapshot = Object.freeze({
    entries,
    serialized,
    digest: Core.coreSha256HexV1(serialized),
  });
  const result = buildVariableRoomGenesisV3(Object.freeze({
    roomId: `o4p09c-review-${String(playerCount)}-${String(startingLife)}-${String(mainQuantity)}`,
    serverBuildId: 'o4p09c-review-build',
    configuration: Object.freeze({ playerCount, startingLife }),
    seats: Object.freeze(Array.from({ length: playerCount }, (_, index) => Object.freeze({
      seatIndex: index as 0 | 1 | 2 | 3,
      corePlayerId: `P${String(index + 1)}` as 'P1' | 'P2' | 'P3' | 'P4',
      participantId: `participant-o4p09c-${String(index + 1)}`,
      seatCapability: `seat_${String(index + 1).repeat(40)}`,
      snapshot,
    }))),
    tableParticipantId: 'table-o4p09c-review',
    tableCapability: `observer_${'T'.repeat(40)}`,
  }));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('O4P-09C requires variable genesis');
  return result;
}

function rotate<T>(values: readonly T[], offset: number): readonly T[] {
  const normalized = offset % values.length;
  return Object.freeze([...values.slice(normalized), ...values.slice(0, normalized)]);
}

function physicalLibraryIds(
  state: OnlineVariableProtocolStateV2,
  playerId: Core.CorePlayerId,
): readonly Core.CorePhysicalCardId[] {
  const registry = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
  return Object.freeze(registry.zones.byPlayer[playerId].library.map((objectId) => {
    const object = registry.objects[objectId];
    if (object?.kind !== 'card') throw new Error('Pregame library requires cards');
    return object.physicalCardId;
  }));
}

function plan(
  state: OnlineVariableProtocolStateV2,
  startingPlayerId: Core.CorePlayerId,
): Pregame.OnlinePregameRandomPlanV1 {
  const seatOrder = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle
    .objectRegistry.turnOrder;
  const start = seatOrder.indexOf(startingPlayerId);
  if (start < 0) throw new Error('Starting player must be seated');
  const orderCount = seatOrder.length === 2 ? 8 : 9;
  return Object.freeze({
    kind: 'online-pregame-random-plan-v1',
    schemaVersion: 1,
    decisionId: `o4p09c-plan-${String(seatOrder.length)}`,
    startingPlayerId,
    turnOrder: rotate(seatOrder, start),
    libraryPlans: Object.freeze(seatOrder.map((playerId, playerIndex) => {
      const ids = physicalLibraryIds(state, playerId);
      return Object.freeze({
        playerId,
        orders: Object.freeze(Array.from({ length: orderCount }, (_, round) =>
          rotate(ids, round + playerIndex + 1))),
      });
    })),
  });
}

function createPregame(
  initialState: OnlineVariableProtocolStateV2,
  randomPlan: Pregame.OnlinePregameRandomPlanV1,
): Pregame.OnlinePregameStateV1 {
  const result = Pregame.createOnlinePregameLifecycleV1({ initialState, randomPlan });
  expect(result).toMatchObject({ ok: true });
  if (!result.ok) throw new Error('Expected valid Pregame creation');
  return result.value;
}

function seatFor(state: Pregame.OnlinePregameStateV1, playerId: Core.CorePlayerId) {
  const seat = state.protocolState.room.seats.find((entry) => entry.corePlayerId === playerId);
  if (seat === undefined || seat.participantId === null) {
    throw new Error('Pregame player seat is required');
  }
  return Object.freeze({ ...seat, participantId: seat.participantId });
}

function envelope(
  state: Pregame.OnlinePregameStateV1,
  playerId: Core.CorePlayerId,
  commandId: string,
  command: Pregame.OnlinePregameCommandV1,
  baseRevision = state.revision,
): Pregame.OnlinePregameCommandEnvelopeV1 {
  const seat = seatFor(state, playerId);
  return Object.freeze({
    kind: 'online-pregame-command-envelope-v1',
    schemaVersion: 1,
    roomId: state.protocolState.room.roomId,
    participantId: seat.participantId,
    participantCapability: seat.seatCapability,
    commandId,
    baseRevision,
    command,
  });
}

function accept(
  state: Pregame.OnlinePregameStateV1,
  playerId: Core.CorePlayerId,
  commandId: string,
  command: Pregame.OnlinePregameCommandV1,
): Pregame.OnlinePregameStateV1 {
  const transition = Pregame.handleOnlinePregameCommandEnvelopeV1(
    state,
    envelope(state, playerId, commandId, command),
  );
  expect(transition.response).toMatchObject({
    kind: 'online-pregame-command-ack-v1',
    commandId,
    acceptedRevision: state.revision + 1,
    duplicate: false,
  });
  return transition.state;
}

function player(
  state: Pregame.OnlinePregameStateV1,
  playerId: Core.CorePlayerId,
) {
  const value = state.players.find((entry) => entry.playerId === playerId);
  if (value === undefined) throw new Error('Pregame player state is required');
  return value;
}

function handObjectIds(
  state: Pregame.OnlinePregameStateV1,
  playerId: Core.CorePlayerId,
): readonly Core.CoreObjectId[] {
  return state.protocolState.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle
    .objectRegistry.zones.byPlayer[playerId].hand;
}

function completeKeptPregame(
  playerCount: 2 | 4,
  startingPlayerId: Core.CorePlayerId,
): Pregame.OnlinePregameStateV1 {
  const initial = genesis(playerCount).protocolState;
  let state = createPregame(initial, plan(initial, startingPlayerId));
  for (const playerId of state.randomPlan.turnOrder) {
    state = accept(state, playerId, `confirm-${playerId}`, { kind: 'confirm-commanders' });
  }
  for (const playerId of state.randomPlan.turnOrder) {
    state = accept(state, playerId, `keep-${playerId}`, {
      kind: 'declare-mulligan',
      decision: 'keep',
    });
  }
  for (const playerId of state.randomPlan.turnOrder) {
    state = accept(state, playerId, `actions-${playerId}`, {
      kind: 'complete-pregame-actions',
    });
  }
  for (const playerId of state.randomPlan.turnOrder) {
    state = accept(state, playerId, `ready-${playerId}`, {
      kind: 'set-ready',
      ready: true,
    });
  }
  expect(state.phase).toBe('complete');
  return state;
}

function upkeepReadyRoot(root: Core.ModeNeutralCoreRootV1): Core.ModeNeutralCoreRootV1 {
  const current = root.ruleAuthority.turnPriorityBundle;
  const lifecycle = Core.createModeNeutralCoreTurnLifecycleSliceV1({
    turnNumber: 1,
    positionSequence: 1,
    position: { phase: 'beginning', step: 'upkeep' },
    window: { kind: 'position-advance-ready' },
  });
  const turnPriorityBundle = Core.createCoreTurnPriorityBundleV1({
    stackBundle: current.stackBundle,
    pendingTriggers: current.pendingTriggers,
    lifecycle,
  });
  return Core.createModeNeutralCoreRootV1({
    ...root,
    ruleAuthority: Core.createCoreRuleAuthorityBundleV1({
      ...root.ruleAuthority,
      turnPriorityBundle,
    }),
  });
}

function turnCommand(
  root: Core.ModeNeutralCoreRootV1,
  transition: Core.CoreTabletopTurnTransitionV1,
): Core.CoreCommandV1 {
  const activePlayerId = root.ruleAuthority.turnPriorityBundle.stackBundle
    .objectRegistry.activePlayerId;
  if (activePlayerId === null) throw new Error('Active player is required');
  return Core.createCoreCommandV1({
    schemaVersion: 1,
    sequence: root.acceptedCommandCount + 1,
    actorPlayerId: activePlayerId,
    decisionMakerPlayerId: activePlayerId,
    decisionContext: { kind: 'decision', decisionKey: 'o4p09c-first-draw' },
    payload: { kind: 'table-turn-progress', transition },
  });
}

type LiveCandidatePathScope = {
  changed: Set<string>;
  current: Set<string>;
  historicalJudge: Set<string>;
  guardedJudge: Set<string>;
};

function liveCandidatePathScope(): LiveCandidatePathScope {
  const contextRun = spawnSync(process.execPath, ['scripts/codex-context.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  expect(contextRun.error).toBeUndefined();
  expect(contextRun.signal).toBeNull();
  expect(contextRun.stderr).toBe('');
  expect(contextRun.status).toBe(0);
  const context = JSON.parse(contextRun.stdout) as {
    health?: { ok?: boolean; errors?: unknown[] };
    trackedSupervisor?: { ok?: boolean };
    activeCandidate?: {
      id?: string;
      domainId?: string;
      baseSha?: string;
      repairOf?: string;
      treeFingerprint?: string;
      acceptanceFingerprint?: string;
      authority?: Record<string, boolean>;
      authoritySource?: string;
      counters?: { semanticPushes?: number; replacementPushes?: number };
      releaseHeadSha?: string | null;
      guardImpact?: { reportFingerprint?: string | null };
    } | null;
  };
  expect(context.health).toEqual({ ok: true, errors: [] });
  expect(context.trackedSupervisor?.ok).toBe(true);
  const candidate = context.activeCandidate;
  if (candidate?.id === undefined || candidate.domainId === undefined
    || candidate.baseSha === undefined || candidate.treeFingerprint === undefined) {
    throw new Error('Verified live candidate is required for frozen path classification');
  }

  let guardBase = candidate.baseSha;
  if (candidate.repairOf !== undefined) {
    const authority = JSON.parse(readFileSync(resolve(
      ROOT,
      `research/cr-grounding/supervisor-events/${candidate.domainId}.json`,
    ), 'utf8')) as {
      events?: Array<{ reason?: string | null; candidate?: typeof candidate & { state?: string } }>;
    };
    const predecessor = [...(authority.events ?? [])].reverse()
      .find((event) => event.candidate?.id === candidate.repairOf)?.candidate;
    const pushes = (value: typeof candidate) =>
      (value?.counters?.semanticPushes ?? -1) + (value?.counters?.replacementPushes ?? -1);
    const repairEvent = [...(authority.events ?? [])].reverse().find((event) =>
      event.candidate?.id === candidate.repairOf && event.candidate?.state === 'repair-required');
    if (
      predecessor?.state === 'repair-required' && repairEvent?.reason === 'ci-environment' &&
      predecessor.releaseHeadSha == null && pushes(predecessor) === 0 &&
      [0, 1].includes(pushes(candidate)) &&
      predecessor.acceptanceFingerprint === candidate.acceptanceFingerprint &&
      JSON.stringify(predecessor.authority) === JSON.stringify(candidate.authority) &&
      predecessor.authoritySource === candidate.authoritySource
    ) guardBase = predecessor.baseSha ?? guardBase;
  }

  const guardRun = spawnSync(process.execPath, [
    'scripts/checks/guard-impact.mjs',
    '--base', guardBase,
    '--domain', candidate.domainId,
  ], { cwd: ROOT, encoding: 'utf8' });
  expect(guardRun.error).toBeUndefined();
  expect(guardRun.signal).toBeNull();
  expect(guardRun.stderr).toBe('');
  expect(guardRun.status).toBe(0);
  const guard = JSON.parse(guardRun.stdout) as {
    ok?: boolean;
    candidateId?: string;
    candidateTreeFingerprint?: string;
    reportFingerprint?: string;
    errors?: unknown[];
    acknowledgementRequired?: {
      candidateId?: string;
      candidateTreeFingerprint?: string;
      reportFingerprint?: string;
      paths?: Array<{ path?: string; owner?: string }>;
    };
  };
  expect(guard).toMatchObject({
    ok: true,
    candidateId: candidate.id,
    candidateTreeFingerprint: candidate.treeFingerprint,
    errors: [],
  });
  expect(guard.reportFingerprint).toBe(candidate.guardImpact?.reportFingerprint);
  expect(guard.acknowledgementRequired).toMatchObject({
    candidateId: candidate.id,
    candidateTreeFingerprint: candidate.treeFingerprint,
    reportFingerprint: guard.reportFingerprint,
  });

  const current = new Set([
    ...gitLines(['diff', '--name-only', candidate.baseSha, 'HEAD']),
    ...gitLines(['diff', '--cached', '--name-only']),
    ...gitLines(['diff', '--name-only']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ]);
  const historical = new Set(gitLines(['diff', '--name-only', BASE_SHA, candidate.baseSha]));
  const historicalOnly = [...historical].filter((path) => !current.has(path));
  const ownerProgram = [
    'import { requiredOwner } from "./scripts/checks/ownership.mjs";',
    'const paths = JSON.parse(process.argv[1]);',
    'process.stdout.write(JSON.stringify(paths.filter((path) => requiredOwner(path) === "judge")));',
  ].join('\n');
  const historicalJudge = new Set(JSON.parse(execFileSync(process.execPath, [
    '--input-type=module', '--eval', ownerProgram, JSON.stringify(historicalOnly),
  ], { cwd: ROOT, encoding: 'utf8' })) as string[]);
  const guardedJudge = new Set((guard.acknowledgementRequired?.paths ?? [])
    .filter((entry) => entry.owner === 'judge' && typeof entry.path === 'string')
    .map((entry) => entry.path as string));
  guardedJudge.add(`research/cr-grounding/supervisor-events/${candidate.domainId}.json`);

  return {
    changed: new Set([...historical, ...current]),
    current,
    historicalJudge,
    guardedJudge,
  };
}

describe('O4P-09C server-authoritative Pregame lifecycle', () => {
  it('validates one exact server plan and creates a virgin started state', { timeout: 30000 }, () => {
    const initial = genesis(2).protocolState;
    const initialBefore = JSON.stringify(initial);
    const randomPlan = plan(initial, 'P2' as Core.CorePlayerId);
    expect(Pregame.validateOnlinePregameRandomPlanV1(randomPlan, initial))
      .toMatchObject({ ok: true });

    let proxyGetCalled = false;
    const proxiedPlan = new Proxy({ ...randomPlan }, {
      get: () => {
        proxyGetCalled = true;
        throw new Error('PRIVATE-PROXY-GET');
      },
    });
    let proxiedPlanResult: ReturnType<typeof Pregame.validateOnlinePregameRandomPlanV1>
      | undefined;
    expect(() => {
      proxiedPlanResult = Pregame.validateOnlinePregameRandomPlanV1(proxiedPlan, initial);
    }).not.toThrow();
    expect(proxiedPlanResult).toMatchObject({ ok: true });
    expect(proxyGetCalled).toBe(false);

    const state = createPregame(initial, randomPlan);
    expect(Object.keys(state)).toEqual([
      'kind', 'schemaVersion', 'protocolState', 'randomPlan', 'phase',
      'currentPlayerId', 'mulliganRound', 'players', 'revision', 'journal',
    ]);
    expect(state).toMatchObject({
      kind: 'online-pregame-state-v1',
      schemaVersion: 1,
      phase: 'commander-reveal',
      currentPlayerId: 'P2',
      revision: 0,
      protocolState: { room: { lifecycle: 'started' } },
    });
    expect(
      state.protocolState.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle
        .objectRegistry.turnOrder,
    ).toEqual(['P2', 'P1']);
    expect(
      state.protocolState.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle
        .objectRegistry.activePlayerId,
    ).toBe('P2');
    const authorityDiverged = JSON.parse(JSON.stringify(state)) as unknown as {
      protocolState: {
        coreRoot: {
          ruleAuthority: {
            turnPriorityBundle: {
              lifecycle: { window: { playerId: string } };
              stackBundle: {
                objectRegistry: {
                  turnOrder: string[];
                  activePlayerId: string;
                };
              };
            };
          };
        };
      };
    };
    const divergentTurn = authorityDiverged.protocolState.coreRoot.ruleAuthority
      .turnPriorityBundle;
    divergentTurn.stackBundle.objectRegistry.turnOrder.splice(0, 2, 'P1', 'P2');
    divergentTurn.stackBundle.objectRegistry.activePlayerId = 'P1';
    divergentTurn.lifecycle.window.playerId = 'P1';
    expect(Pregame.validateOnlinePregameStateV1(authorityDiverged))
      .toMatchObject({ ok: false });
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.randomPlan.libraryPlans[0]?.orders)).toBe(true);
    expect(JSON.stringify(initial)).toBe(initialBefore);
    expect(Pregame.validateOnlinePregameCommandEnvelopeV1({
      ...envelope(state, 'P2' as Core.CorePlayerId, 'valid-command', {
        kind: 'confirm-commanders',
      }),
      commandId: `c${'x'.repeat(80)}`,
    })).toMatchObject({ ok: false });
    const sparseBottomIds = new Array<Core.CoreObjectId>(1);
    expect(Pregame.validateOnlinePregameCommandV1({
      kind: 'submit-mulligan-bottom',
      objectIds: sparseBottomIds,
    })).toMatchObject({ ok: false });
    const repeatedObjectId = state.protocolState.coreRoot.ruleAuthority.turnPriorityBundle
      .stackBundle.objectRegistry.zones.byPlayer['P1' as Core.CorePlayerId]?.library[0];
    if (repeatedObjectId === undefined) throw new Error('Pregame library object is required');
    expect(Pregame.validateOnlinePregameCommandV1({
      kind: 'submit-mulligan-bottom',
      objectIds: [repeatedObjectId, repeatedObjectId],
    })).toMatchObject({ ok: false });
    let bottomGetterCalled = false;
    const accessorBottomIds: Core.CoreObjectId[] = [];
    Object.defineProperty(accessorBottomIds, '0', {
      enumerable: true,
      get: () => {
        bottomGetterCalled = true;
        return repeatedObjectId;
      },
    });
    Object.defineProperty(accessorBottomIds, 'length', { value: 1 });
    expect(Pregame.validateOnlinePregameCommandV1({
      kind: 'submit-mulligan-bottom',
      objectIds: accessorBottomIds,
    })).toMatchObject({ ok: false });
    expect(bottomGetterCalled).toBe(false);
    let commandProxyGetCalled = false;
    const proxiedCommand = new Proxy({ kind: 'declare-mulligan', decision: 'keep' }, {
      get: () => {
        commandProxyGetCalled = true;
        throw new Error('PRIVATE-COMMAND-PROXY');
      },
    });
    expect(() => Pregame.validateOnlinePregameCommandV1(proxiedCommand)).not.toThrow();
    expect(Pregame.validateOnlinePregameCommandV1(proxiedCommand))
      .toMatchObject({ ok: true });
    expect(commandProxyGetCalled).toBe(false);
    const descriptorTrapCommand = new Proxy(
      { kind: 'declare-mulligan', decision: 'keep' },
      {
        getOwnPropertyDescriptor: () => {
          throw new Error('PRIVATE-COMMAND-DESCRIPTOR');
        },
      },
    );
    let trappedCommandResult: ReturnType<typeof Pregame.validateOnlinePregameCommandV1>
      | undefined;
    expect(() => {
      trappedCommandResult = Pregame.validateOnlinePregameCommandV1(descriptorTrapCommand);
    }).not.toThrow();
    expect(trappedCommandResult).toMatchObject({ ok: false });

    expect(Pregame.validateOnlinePregameRandomPlanV1(
      { ...randomPlan, surplus: true },
      initial,
    )).toMatchObject({ ok: false });
    expect(Pregame.validateOnlinePregameRandomPlanV1(
      { ...randomPlan, turnOrder: ['P2', 'P2'] },
      initial,
    )).toMatchObject({ ok: false });
    expect(Pregame.validateOnlinePregameRandomPlanV1(
      { ...randomPlan, libraryPlans: randomPlan.libraryPlans.slice(0, 1) },
      initial,
    )).toMatchObject({ ok: false });

    const hostileState = new Proxy({}, {
      ownKeys: () => {
        throw new Error('PRIVATE-HOSTILE-STATE');
      },
      get: () => {
        throw new Error('PRIVATE-HOSTILE-STATE');
      },
    });
    let hostileTransition: Pregame.OnlinePregameTransitionV1 | undefined;
    expect(() => {
      hostileTransition = Pregame.handleOnlinePregameCommandEnvelopeV1(hostileState, {});
    }).not.toThrow();
    expect(hostileTransition?.response).toMatchObject({
      kind: 'online-pregame-command-reject-v1',
      currentRevision: 0,
      resyncRequired: false,
      issues: [{ code: 'INVALID_STATE', path: '' }],
    });
    expect(JSON.stringify(hostileTransition?.response)).not.toContain('PRIVATE-HOSTILE-STATE');

    let getterCalled = false;
    const accessor = { ...randomPlan } as Record<string, unknown>;
    Object.defineProperty(accessor, 'startingPlayerId', {
      enumerable: true,
      get: () => {
        getterCalled = true;
        return 'P2';
      },
    });
    expect(Pregame.validateOnlinePregameRandomPlanV1(accessor, initial))
      .toMatchObject({ ok: false });
    expect(getterCalled).toBe(false);

    const twentyLife = genesis(2, 20).protocolState;
    expect(Pregame.createOnlinePregameLifecycleV1({
      initialState: twentyLife,
      randomPlan: plan(twentyLife, 'P1' as Core.CorePlayerId),
    })).toMatchObject({ ok: false });

    const alreadyStarted = Object.freeze({
      ...initial,
      room: Object.freeze({ ...initial.room, lifecycle: 'started' as const }),
    });
    expect(Pregame.createOnlinePregameLifecycleV1({
      initialState: alreadyStarted,
      randomPlan,
    })).toMatchObject({ ok: false });

    const shortLibrary = genesis(2, 40, 6).protocolState;
    expect(Pregame.createOnlinePregameLifecycleV1({
      initialState: shortLibrary,
      randomPlan: plan(shortLibrary, 'P1' as Core.CorePlayerId),
    })).toMatchObject({ ok: false });

    const nonVirginResources = JSON.parse(JSON.stringify(initial)) as unknown as {
      coreRoot: {
        ruleAuthority: {
          turnPriorityBundle: {
            stackBundle: {
              objectRegistry: {
                players: Record<string, {
                  manaPool: Record<string, number>;
                  landsPlayedThisTurn: number;
                  spellsCastThisTurn: number;
                }>;
              };
            };
          };
        };
      };
    };
    const nonVirginPlayer = nonVirginResources.coreRoot.ruleAuthority.turnPriorityBundle
      .stackBundle.objectRegistry.players.P1;
    if (nonVirginPlayer === undefined) throw new Error('Pregame player resource state required');
    nonVirginPlayer.manaPool.W = 1;
    nonVirginPlayer.landsPlayedThisTurn = 1;
    nonVirginPlayer.spellsCastThisTurn = 1;
    const nonVirginProtocol = nonVirginResources as unknown as OnlineVariableProtocolStateV2;
    expect(Pregame.createOnlinePregameLifecycleV1({
      initialState: nonVirginProtocol,
      randomPlan: plan(nonVirginProtocol, 'P1' as Core.CorePlayerId),
    })).toMatchObject({ ok: false });

    const nonVirginHandSize = JSON.parse(JSON.stringify(initial)) as unknown as {
      coreRoot: {
        ruleAuthority: {
          turnPriorityBundle: {
            stackBundle: {
              objectRegistry: {
                players: Record<string, { maximumHandSizeOverride: number | 'none' }>;
              };
            };
          };
        };
      };
    };
    const handSizePlayer = nonVirginHandSize.coreRoot.ruleAuthority.turnPriorityBundle
      .stackBundle.objectRegistry.players.P1;
    if (handSizePlayer === undefined) throw new Error('Pregame hand-size state required');
    handSizePlayer.maximumHandSizeOverride = 8;
    const handSizeProtocol = nonVirginHandSize as unknown as OnlineVariableProtocolStateV2;
    expect(Pregame.createOnlinePregameLifecycleV1({
      initialState: handSizeProtocol,
      randomPlan: plan(handSizeProtocol, 'P1' as Core.CorePlayerId),
    })).toMatchObject({ ok: false });
  });

  it('keeps commands idempotent and completes the two-player mulligan path privately', { timeout: 30000 }, () => {
    const initial = genesis(2).protocolState;
    const initialPlan = plan(initial, 'P2' as Core.CorePlayerId);
    const zero = createPregame(initial, initialPlan);
    const firstEnvelope = envelope(zero, 'P2' as Core.CorePlayerId, 'confirm-p2', {
      kind: 'confirm-commanders',
    });
    const first = Pregame.handleOnlinePregameCommandEnvelopeV1(zero, firstEnvelope);
    expect(first.response).toMatchObject({
      kind: 'online-pregame-command-ack-v1',
      duplicate: false,
      acceptedRevision: 1,
    });
    expect(Object.keys(first.response)).toEqual([
      'kind', 'schemaVersion', 'commandId', 'acceptedRevision',
      'currentRevision', 'duplicate',
    ]);
    const duplicate = Pregame.handleOnlinePregameCommandEnvelopeV1(first.state, firstEnvelope);
    expect(duplicate.response).toMatchObject({
      kind: 'online-pregame-command-ack-v1',
      duplicate: true,
      acceptedRevision: 1,
    });
    expect(duplicate.state).toBe(first.state);

    const externalFrozen = Object.freeze(JSON.parse(JSON.stringify(first.state)) as
      Pregame.OnlinePregameStateV1);
    const externalDuplicate = Pregame.handleOnlinePregameCommandEnvelopeV1(
      externalFrozen,
      firstEnvelope,
    );
    expect(externalDuplicate.response).toMatchObject({
      kind: 'online-pregame-command-ack-v1',
      duplicate: true,
      acceptedRevision: 1,
    });
    expect(externalDuplicate.state).not.toBe(externalFrozen);
    expect(Object.isFrozen(externalDuplicate.state.players)).toBe(true);

    const reused = Pregame.handleOnlinePregameCommandEnvelopeV1(first.state, {
      ...firstEnvelope,
      command: { kind: 'declare-mulligan', decision: 'keep' },
    });
    expect(reused.response).toMatchObject({ kind: 'online-pregame-command-reject-v1' });
    expect(reused.state).toBe(first.state);
    const stale = Pregame.handleOnlinePregameCommandEnvelopeV1(first.state, envelope(
      first.state,
      'P1' as Core.CorePlayerId,
      'stale-p1',
      { kind: 'confirm-commanders' },
      0,
    ));
    expect(stale.response).toMatchObject({
      kind: 'online-pregame-command-reject-v1',
      resyncRequired: true,
    });
    expect(Object.keys(stale.response)).toEqual([
      'kind', 'schemaVersion', 'commandId', 'currentRevision',
      'resyncRequired', 'issues',
    ]);
    if (stale.response.kind !== 'online-pregame-command-reject-v1') {
      throw new Error('Expected a stale Pregame rejection');
    }
    expect(stale.response.issues).toEqual([{ code: 'STALE_REVISION', path: '/baseRevision' }]);
    expect(stale.state).toBe(first.state);

    const roomMismatch = Pregame.handleOnlinePregameCommandEnvelopeV1(first.state, {
      ...envelope(first.state, 'P1' as Core.CorePlayerId, 'wrong-room-p1', {
        kind: 'confirm-commanders',
      }),
      roomId: 'another-valid-room',
    });
    expect(roomMismatch.response).toMatchObject({
      kind: 'online-pregame-command-reject-v1',
      resyncRequired: false,
      issues: [{ code: 'ROOM_MISMATCH', path: '/roomId' }],
    });
    expect(roomMismatch.state).toBe(first.state);

    const wrongCapability = {
      ...firstEnvelope,
      participantCapability: `seat_${'X'.repeat(40)}`,
    };
    const unauthorized = Pregame.handleOnlinePregameCommandEnvelopeV1(
      first.state,
      wrongCapability,
    );
    expect(unauthorized.response).toMatchObject({
      kind: 'online-pregame-command-reject-v1',
      resyncRequired: false,
      issues: [{ code: 'AUTHORIZATION_REJECTED' }],
    });
    expect(JSON.stringify(unauthorized.response)).not.toContain('X'.repeat(16));

    let state = accept(first.state, 'P1' as Core.CorePlayerId, 'confirm-p1', {
      kind: 'confirm-commanders',
    });
    expect(state.phase).toBe('mulligan-declaration');
    for (const playerId of ['P1', 'P2'] as const) {
      expect(handObjectIds(state, playerId as Core.CorePlayerId)).toHaveLength(7);
      expect(player(state, playerId as Core.CorePlayerId).mulligansTaken).toBe(0);
    }

    const coreDiverged = JSON.parse(JSON.stringify(state)) as unknown as {
      protocolState: {
        coreRoot: {
          ruleAuthority: {
            turnPriorityBundle: {
              stackBundle: {
                objectRegistry: {
                  zones: { byPlayer: Record<string, { library: string[] }> };
                };
              };
            };
          };
        };
      };
    };
    const divergentLibrary = coreDiverged.protocolState.coreRoot.ruleAuthority
      .turnPriorityBundle.stackBundle.objectRegistry.zones.byPlayer.P1?.library;
    const divergentFirst = divergentLibrary?.[0];
    const divergentSecond = divergentLibrary?.[1];
    if (divergentLibrary === undefined || divergentFirst === undefined
      || divergentSecond === undefined) {
      throw new Error('Pregame library divergence fixture requires two cards');
    }
    divergentLibrary[0] = divergentSecond;
    divergentLibrary[1] = divergentFirst;
    expect(Pregame.validateOnlinePregameStateV1(coreDiverged))
      .toMatchObject({ ok: false });

    const resourceDiverged = JSON.parse(JSON.stringify(state)) as unknown as {
      protocolState: {
        coreRoot: {
          acceptedCommandCount: number;
          ruleAuthority: {
            turnPriorityBundle: {
              stackBundle: {
                objectRegistry: {
                  players: Record<string, { life: number }>;
                };
              };
            };
          };
        };
      };
    };
    resourceDiverged.protocolState.coreRoot.acceptedCommandCount = 1;
    const resourcePlayer = resourceDiverged.protocolState.coreRoot.ruleAuthority
      .turnPriorityBundle.stackBundle.objectRegistry.players.P1;
    if (resourcePlayer === undefined) throw new Error('Pregame resource player required');
    resourcePlayer.life = 39;
    expect(Pregame.validateOnlinePregameStateV1(resourceDiverged))
      .toMatchObject({ ok: false });

    const runtimeDiverged = JSON.parse(JSON.stringify(state)) as unknown as {
      protocolState: {
        coreRoot: {
          ruleAuthority: {
            turnPriorityBundle: {
              stackBundle: {
                objectRuntime: {
                  byObject: Record<string, { orientation: { tapped: boolean } }>;
                };
              };
            };
          };
        };
      };
    };
    const runtimeHandId = handObjectIds(state, 'P1' as Core.CorePlayerId)[0];
    if (runtimeHandId === undefined) throw new Error('Pregame runtime object required');
    const runtimeEntry = runtimeDiverged.protocolState.coreRoot.ruleAuthority
      .turnPriorityBundle.stackBundle.objectRuntime.byObject[runtimeHandId];
    if (runtimeEntry === undefined) throw new Error('Pregame runtime entry required');
    runtimeEntry.orientation.tapped = true;
    expect(Pregame.validateOnlinePregameStateV1(runtimeDiverged))
      .toMatchObject({ ok: false });

    const p1Projection = Pregame.projectOnlinePregameV1(
      state,
      seatFor(state, 'P1' as Core.CorePlayerId).participantId,
    );
    const tableProjection = Pregame.projectOnlinePregameV1(state, 'table-o4p09c-review');
    expect(Pregame.validateOnlinePregameProjectionV1(p1Projection)).toMatchObject({ ok: true });
    expect(Pregame.validateOnlinePregameProjectionV1(tableProjection)).toMatchObject({ ok: true });

    const mutableProjection = JSON.parse(JSON.stringify(p1Projection)) as
      Pregame.OnlinePregameProjectionV1;
    const normalizedProjection = Pregame.validateOnlinePregameProjectionV1(mutableProjection);
    expect(normalizedProjection).toMatchObject({ ok: true });
    if (normalizedProjection.ok) {
      expect(normalizedProjection.value).not.toBe(mutableProjection);
      expect(Object.isFrozen(normalizedProjection.value)).toBe(true);
      expect(Object.isFrozen(normalizedProjection.value.players)).toBe(true);
      expect(Object.isFrozen(normalizedProjection.value.protocol)).toBe(true);
    }
    let projectionGetterCalled = false;
    const projectionAccessor = { ...p1Projection } as Record<string, unknown>;
    Object.defineProperty(projectionAccessor, 'kind', {
      enumerable: true,
      get: () => {
        projectionGetterCalled = true;
        return 'online-pregame-projection-v1';
      },
    });
    expect(() => Pregame.validateOnlinePregameProjectionV1(projectionAccessor)).not.toThrow();
    expect(Pregame.validateOnlinePregameProjectionV1(projectionAccessor))
      .toMatchObject({ ok: false });
    expect(projectionGetterCalled).toBe(false);
    expect(Pregame.validateOnlinePregameProjectionV1(Object.assign(
      { ...p1Projection },
      { [Symbol('private')]: true },
    ))).toMatchObject({ ok: false });
    expect(Pregame.validateOnlinePregameProjectionV1({
      ...p1Projection,
      phase: 'ready',
      currentPlayerId: 'P1',
    })).toMatchObject({ ok: false });
    expect(Pregame.validateOnlinePregameProjectionV1({
      ...p1Projection,
      turnOrder: [...p1Projection.turnOrder].reverse(),
    })).toMatchObject({ ok: false });
    expect(Pregame.validateOnlinePregameProjectionV1({
      ...p1Projection,
      startingPlayerId: p1Projection.turnOrder[1],
    })).toMatchObject({ ok: false });
    expect(validateOnlineParticipantProjectionV3(p1Projection.protocol))
      .toMatchObject({ ok: true });
    expect(validateOnlineParticipantProjectionV3(tableProjection.protocol))
      .toMatchObject({ ok: true });
    type ZoneView = Readonly<{
      readonly playerId: string;
      readonly zones: Readonly<{
        readonly hand: Readonly<{
          readonly count: number;
          readonly entries: readonly Readonly<{ readonly kind: string }>[];
        }>;
      }>;
    }>;
    const p1Zones = (p1Projection.protocol.game.zones as unknown as {
      readonly byPlayer: readonly ZoneView[];
    }).byPlayer;
    const tableZones = (tableProjection.protocol.game.zones as unknown as {
      readonly byPlayer: readonly ZoneView[];
    }).byPlayer;
    expect(p1Zones.find((entry) => entry.playerId === 'P1')?.zones.hand.entries)
      .toSatisfy((entries: readonly Readonly<{ readonly kind: string }>[]) =>
        entries.every((entry) => entry.kind === 'visible-object'));
    expect(p1Zones.find((entry) => entry.playerId === 'P2')?.zones.hand.entries)
      .toSatisfy((entries: readonly Readonly<{ readonly kind: string }>[]) =>
        entries.every((entry) => entry.kind === 'hidden-card'));
    expect(tableZones.flatMap((entry) => entry.zones.hand.entries))
      .toSatisfy((entries: readonly Readonly<{ readonly kind: string }>[]) =>
        entries.every((entry) => entry.kind === 'hidden-card'));
    for (const projection of [p1Projection, tableProjection]) {
      const serialized = JSON.stringify(projection);
      expect(serialized).not.toMatch(
        /randomPlan|libraryPlans|pendingBottomObjectIds|journal|requestDigest|seatCapability|observerCapability|coreRoot/u,
      );
      for (const seat of state.protocolState.room.seats) {
        expect(serialized).not.toContain(seat.seatCapability);
      }
    }

    state = accept(state, 'P2' as Core.CorePlayerId, 'keep-p2', {
      kind: 'declare-mulligan',
      decision: 'keep',
    });
    state = accept(state, 'P1' as Core.CorePlayerId, 'mulligan-p1', {
      kind: 'declare-mulligan',
      decision: 'mulligan',
    });
    expect(state).toMatchObject({ phase: 'mulligan-bottom', currentPlayerId: 'P1' });
    expect(player(state, 'P1' as Core.CorePlayerId)).toMatchObject({
      mulligansTaken: 1,
      bottomCountRequired: 1,
    });
    const bottom = handObjectIds(state, 'P1' as Core.CorePlayerId)[0];
    if (bottom === undefined) throw new Error('Mulligan bottom card is required');
    state = accept(state, 'P1' as Core.CorePlayerId, 'bottom-p1', {
      kind: 'submit-mulligan-bottom',
      objectIds: [bottom],
    });
    expect(state).toMatchObject({ phase: 'mulligan-declaration', currentPlayerId: 'P1' });
    expect(handObjectIds(state, 'P1' as Core.CorePlayerId)).toHaveLength(6);
    state = accept(state, 'P1' as Core.CorePlayerId, 'keep-p1', {
      kind: 'declare-mulligan',
      decision: 'keep',
    });
    expect(state).toMatchObject({ phase: 'pregame-actions', currentPlayerId: 'P2' });

    const beforeManual = Core.coreCanonicalDigestFromValueV1(state.protocolState.coreRoot);
    state = accept(state, 'P2' as Core.CorePlayerId, 'manual-p2', {
      kind: 'record-manual-pregame-action',
    });
    expect(Core.coreCanonicalDigestFromValueV1(state.protocolState.coreRoot)).toBe(beforeManual);
    expect(player(state, 'P2' as Core.CorePlayerId).manualActionCount).toBe(1);
    state = accept(state, 'P2' as Core.CorePlayerId, 'actions-p2', {
      kind: 'complete-pregame-actions',
    });
    state = accept(state, 'P1' as Core.CorePlayerId, 'actions-p1', {
      kind: 'complete-pregame-actions',
    });
    expect(state.phase).toBe('ready');
    state = accept(state, 'P1' as Core.CorePlayerId, 'ready-p1', {
      kind: 'set-ready',
      ready: true,
    });
    state = accept(state, 'P2' as Core.CorePlayerId, 'ready-p2', {
      kind: 'set-ready',
      ready: true,
    });
    expect(state).toMatchObject({
      phase: 'complete',
      currentPlayerId: null,
      protocolState: { revision: 0, room: { lifecycle: 'active' } },
    });
    expect(state.protocolState.coreRoot.acceptedCommandCount).toBe(0);
    expect(player(state, 'P1' as Core.CorePlayerId).mulligansTaken).toBe(1);
    expect(
      state.protocolState.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle
        .objectRegistry.players['P1' as Core.CorePlayerId]?.mulliganCount,
    ).toBe(1);
    expect(Pregame.validateOnlinePregameStateV1(JSON.parse(JSON.stringify(state))))
      .toMatchObject({ ok: true });
    const inconsistentJournal = JSON.parse(JSON.stringify(state)) as {
      journal: Array<{ response: { accepted: boolean; duplicate: boolean; revision: number } }>;
    };
    const lastJournal = inconsistentJournal.journal.at(-1);
    if (lastJournal === undefined) throw new Error('Pregame journal entry is required');
    lastJournal.response.duplicate = true;
    expect(Pregame.validateOnlinePregameStateV1(inconsistentJournal))
      .toMatchObject({ ok: false });
    const impossiblePhase = {
      ...JSON.parse(JSON.stringify(state)) as Pregame.OnlinePregameStateV1,
      phase: 'ready' as const,
    };
    expect(Pregame.validateOnlinePregameStateV1(impossiblePhase))
      .toMatchObject({ ok: false });
    const replay = Pregame.replayOnlinePregameLifecycleV1(initial, initialPlan, state.journal);
    expect(replay).toMatchObject({ ok: true });
    if (replay.ok) expect(replay.value).toEqual(state);
    const tamperedJournal = JSON.parse(JSON.stringify(state.journal)) as
      Pregame.OnlinePregameJournalEntryV1[];
    const tamperedEntry = tamperedJournal.at(-1);
    if (tamperedEntry === undefined) throw new Error('Pregame replay entry is required');
    (tamperedEntry as { requestDigest: string }).requestDigest = '0'.repeat(64);
    expect(Pregame.replayOnlinePregameLifecycleV1(initial, initialPlan, tamperedJournal))
      .toMatchObject({ ok: false });
  });

  it('exhausts the exact two-player plan at a locked zero-card opening hand', { timeout: 30000 }, () => {
    const initial = genesis(2).protocolState;
    let state = createPregame(initial, plan(initial, 'P1' as Core.CorePlayerId));
    state = accept(state, 'P1' as Core.CorePlayerId, 'zero-confirm-p1', {
      kind: 'confirm-commanders',
    });
    state = accept(state, 'P2' as Core.CorePlayerId, 'zero-confirm-p2', {
      kind: 'confirm-commanders',
    });
    for (let mulligan = 1; mulligan <= 7; mulligan += 1) {
      state = accept(state, 'P1' as Core.CorePlayerId, `zero-mulligan-${String(mulligan)}`, {
        kind: 'declare-mulligan',
        decision: 'mulligan',
      });
      if (mulligan === 1) {
        state = accept(state, 'P2' as Core.CorePlayerId, 'zero-keep-p2', {
          kind: 'declare-mulligan',
          decision: 'keep',
        });
      }
      expect(state).toMatchObject({ phase: 'mulligan-bottom', currentPlayerId: 'P1' });
      expect(player(state, 'P1' as Core.CorePlayerId)).toMatchObject({
        mulligansTaken: mulligan,
        bottomCountRequired: mulligan,
      });
      const bottoms = handObjectIds(state, 'P1' as Core.CorePlayerId).slice(0, mulligan);
      expect(bottoms).toHaveLength(mulligan);
      state = accept(state, 'P1' as Core.CorePlayerId, `zero-bottom-${String(mulligan)}`, {
        kind: 'submit-mulligan-bottom',
        objectIds: bottoms,
      });
      expect(handObjectIds(state, 'P1' as Core.CorePlayerId)).toHaveLength(7 - mulligan);
      if (mulligan < 7) {
        expect(state).toMatchObject({ phase: 'mulligan-declaration', currentPlayerId: 'P1' });
      }
    }
    expect(state).toMatchObject({ phase: 'pregame-actions', currentPlayerId: 'P1' });
    expect(player(state, 'P1' as Core.CorePlayerId)).toMatchObject({
      mulligansTaken: 7,
      mulliganDecision: 'keep',
    });
    const forbidden = Pregame.handleOnlinePregameCommandEnvelopeV1(state, envelope(
      state,
      'P1' as Core.CorePlayerId,
      'zero-extra-mulligan',
      { kind: 'declare-mulligan', decision: 'mulligan' },
    ));
    expect(forbidden.response).toMatchObject({
      kind: 'online-pregame-command-reject-v1',
      issues: [{ code: 'INVALID_PHASE' }],
    });
    expect(forbidden.state).toBe(state);
  });

  it('validates divergent mulligan histories, partial readiness, and journal semantics', { timeout: 30000 }, () => {
    const initial = genesis(4).protocolState;
    let state = createPregame(initial, plan(initial, 'P3' as Core.CorePlayerId));
    for (const playerId of state.randomPlan.turnOrder) {
      state = accept(state, playerId, `divergent-confirm-${playerId}`, {
        kind: 'confirm-commanders',
      });
    }
    for (const playerId of state.randomPlan.turnOrder) {
      state = accept(state, playerId, `divergent-free-${playerId}`, {
        kind: 'declare-mulligan',
        decision: playerId === 'P3' || playerId === 'P4' ? 'mulligan' : 'keep',
      });
    }
    state = accept(state, 'P3' as Core.CorePlayerId, 'divergent-paid-p3', {
      kind: 'declare-mulligan',
      decision: 'mulligan',
    });
    state = accept(state, 'P4' as Core.CorePlayerId, 'divergent-paid-p4', {
      kind: 'declare-mulligan',
      decision: 'mulligan',
    });
    const paidP3 = handObjectIds(state, 'P3' as Core.CorePlayerId)[0];
    const paidP4 = handObjectIds(state, 'P4' as Core.CorePlayerId)[0];
    if (paidP3 === undefined || paidP4 === undefined) throw new Error('Paid bottoms required');
    state = accept(state, 'P3' as Core.CorePlayerId, 'divergent-bottom-p3', {
      kind: 'submit-mulligan-bottom',
      objectIds: [paidP3],
    });
    const alternateP3 = handObjectIds(state, 'P3' as Core.CorePlayerId)[1];
    if (alternateP3 === undefined || alternateP3 === paidP3) {
      throw new Error('Alternate pending bottom required');
    }
    const pendingDiverged = JSON.parse(JSON.stringify(state)) as unknown as {
      players: Array<{
        playerId: string;
        pendingBottomObjectIds: Core.CoreObjectId[];
      }>;
    };
    const pendingP3 = pendingDiverged.players.find((entry) => entry.playerId === 'P3');
    if (pendingP3?.pendingBottomObjectIds[0] === undefined) {
      throw new Error('Persisted pending bottom required');
    }
    pendingP3.pendingBottomObjectIds[0] = alternateP3;
    expect(Pregame.validateOnlinePregameStateV1(pendingDiverged))
      .toMatchObject({ ok: false });
    const pendingDivergedState = pendingDiverged as unknown as Pregame.OnlinePregameStateV1;
    const pendingTransition = Pregame.handleOnlinePregameCommandEnvelopeV1(
      pendingDivergedState,
      envelope(pendingDivergedState, 'P4' as Core.CorePlayerId, 'divergent-pending-p4', {
        kind: 'submit-mulligan-bottom',
        objectIds: [paidP4],
      }),
    );
    expect(pendingTransition.response).toMatchObject({
      kind: 'online-pregame-command-reject-v1',
      issues: [{ code: 'INVALID_STATE' }],
    });
    state = accept(state, 'P4' as Core.CorePlayerId, 'divergent-bottom-p4', {
      kind: 'submit-mulligan-bottom',
      objectIds: [paidP4],
    });
    state = accept(state, 'P3' as Core.CorePlayerId, 'divergent-third-p3', {
      kind: 'declare-mulligan',
      decision: 'mulligan',
    });
    state = accept(state, 'P4' as Core.CorePlayerId, 'divergent-keep-p4', {
      kind: 'declare-mulligan',
      decision: 'keep',
    });
    expect(state).toMatchObject({ phase: 'mulligan-bottom', currentPlayerId: 'P3' });
    expect(handObjectIds(state, 'P4' as Core.CorePlayerId)).toHaveLength(6);
    expect(Pregame.validateOnlinePregameStateV1(JSON.parse(JSON.stringify(state))))
      .toMatchObject({ ok: true });

    const impossibleJournalState = JSON.parse(JSON.stringify(state)) as
      Pregame.OnlinePregameStateV1;
    const impossibleEntry = impossibleJournalState.journal[0];
    if (impossibleEntry === undefined) throw new Error('Journal entry required');
    const impossibleCommand = Object.freeze({ kind: 'set-ready' as const, ready: true });
    const impossibleDigest = Core.coreSha256HexV1(JSON.stringify({
      participantId: impossibleEntry.participantId,
      baseRevision: impossibleEntry.baseRevision,
      command: impossibleCommand,
    }));
    (impossibleJournalState.journal as Pregame.OnlinePregameJournalEntryV1[])[0] = {
      ...impossibleEntry,
      command: impossibleCommand,
      requestDigest: impossibleDigest,
    };
    expect(Pregame.validateOnlinePregameStateV1(impossibleJournalState))
      .toMatchObject({ ok: false });

    const thirdBottoms = handObjectIds(state, 'P3' as Core.CorePlayerId).slice(0, 2);
    state = accept(state, 'P3' as Core.CorePlayerId, 'divergent-third-bottom-p3', {
      kind: 'submit-mulligan-bottom',
      objectIds: thirdBottoms,
    });
    state = accept(state, 'P3' as Core.CorePlayerId, 'divergent-keep-p3', {
      kind: 'declare-mulligan',
      decision: 'keep',
    });
    for (const playerId of state.randomPlan.turnOrder) {
      state = accept(state, playerId, `divergent-actions-${playerId}`, {
        kind: 'complete-pregame-actions',
      });
    }
    state = accept(state, 'P3' as Core.CorePlayerId, 'divergent-ready-p3', {
      kind: 'set-ready',
      ready: true,
    });
    expect(state.phase).toBe('ready');
    expect(Pregame.validateOnlinePregameStateV1(JSON.parse(JSON.stringify(state))))
      .toMatchObject({ ok: true });
  });

  it('fail-closes the private journal at exactly 256 accepted entries', { timeout: 30000 }, () => {
    const initial = genesis(2).protocolState;
    let state = createPregame(initial, plan(initial, 'P1' as Core.CorePlayerId));
    for (const playerId of state.randomPlan.turnOrder) {
      state = accept(state, playerId, `capacity-confirm-${playerId}`, {
        kind: 'confirm-commanders',
      });
    }
    for (const playerId of state.randomPlan.turnOrder) {
      state = accept(state, playerId, `capacity-keep-${playerId}`, {
        kind: 'declare-mulligan',
        decision: 'keep',
      });
    }
    for (const playerId of state.randomPlan.turnOrder) {
      state = accept(state, playerId, `capacity-actions-${playerId}`, {
        kind: 'complete-pregame-actions',
      });
    }
    expect(state).toMatchObject({ phase: 'ready', revision: 6 });
    for (let index = 0; index < 250; index += 1) {
      state = accept(state, 'P1' as Core.CorePlayerId, `capacity-ready-${String(index)}`, {
        kind: 'set-ready',
        ready: index % 2 === 0,
      });
    }
    expect(state.revision).toBe(256);
    expect(state.journal).toHaveLength(256);
    const full = Pregame.handleOnlinePregameCommandEnvelopeV1(state, envelope(
      state,
      'P1' as Core.CorePlayerId,
      'capacity-overflow',
      { kind: 'set-ready', ready: true },
    ));
    expect(full.response).toMatchObject({
      kind: 'online-pregame-command-reject-v1',
      currentRevision: 256,
      resyncRequired: false,
      issues: [{ code: 'CAPACITY_EXCEEDED', path: '' }],
    });
    expect(full.state).toBe(state);
  });

  it('gives four players one free mulligan and keeps the first-draw policy exact', { timeout: 30000 }, () => {
    const initial = genesis(4).protocolState;
    let state = createPregame(initial, plan(initial, 'P3' as Core.CorePlayerId));
    expect(state.randomPlan.turnOrder).toEqual(['P3', 'P4', 'P1', 'P2']);
    for (const playerId of state.randomPlan.turnOrder) {
      state = accept(state, playerId, `confirm-free-${playerId}`, {
        kind: 'confirm-commanders',
      });
    }
    for (const playerId of state.randomPlan.turnOrder) {
      state = accept(state, playerId, `declare-free-${playerId}`, {
        kind: 'declare-mulligan',
        decision: playerId === 'P3' || playerId === 'P4' ? 'mulligan' : 'keep',
      });
    }
    expect(state).toMatchObject({
      phase: 'mulligan-declaration',
      currentPlayerId: 'P3',
      mulliganRound: 1,
    });
    expect(player(state, 'P3' as Core.CorePlayerId)).toMatchObject({
      mulligansTaken: 1,
      bottomCountRequired: 0,
    });
    expect(player(state, 'P4' as Core.CorePlayerId)).toMatchObject({
      mulligansTaken: 1,
      bottomCountRequired: 0,
    });
    for (const playerId of ['P3', 'P4'] as const) {
      expect(handObjectIds(state, playerId as Core.CorePlayerId)).toHaveLength(7);
    }
    state = accept(state, 'P3' as Core.CorePlayerId, 'mulligan-paid-p3', {
      kind: 'declare-mulligan',
      decision: 'mulligan',
    });
    state = accept(state, 'P4' as Core.CorePlayerId, 'mulligan-paid-p4', {
      kind: 'declare-mulligan',
      decision: 'mulligan',
    });
    expect(state).toMatchObject({ phase: 'mulligan-bottom', currentPlayerId: 'P3' });
    const p3Bottom = handObjectIds(state, 'P3' as Core.CorePlayerId)[0];
    const p4Bottom = handObjectIds(state, 'P4' as Core.CorePlayerId)[0];
    if (p3Bottom === undefined || p4Bottom === undefined) {
      throw new Error('Four-player bottom choices are required');
    }
    state = accept(state, 'P3' as Core.CorePlayerId, 'bottom-paid-p3', {
      kind: 'submit-mulligan-bottom',
      objectIds: [p3Bottom],
    });
    expect(state).toMatchObject({ phase: 'mulligan-bottom', currentPlayerId: 'P4' });
    expect(handObjectIds(state, 'P3' as Core.CorePlayerId)).toHaveLength(7);
    expect(handObjectIds(state, 'P4' as Core.CorePlayerId)).toHaveLength(7);
    state = accept(state, 'P4' as Core.CorePlayerId, 'bottom-paid-p4', {
      kind: 'submit-mulligan-bottom',
      objectIds: [p4Bottom],
    });
    expect(state).toMatchObject({ phase: 'mulligan-declaration', currentPlayerId: 'P3' });
    expect(handObjectIds(state, 'P3' as Core.CorePlayerId)).toHaveLength(6);
    expect(handObjectIds(state, 'P4' as Core.CorePlayerId)).toHaveLength(6);
    state = accept(state, 'P3' as Core.CorePlayerId, 'keep-paid-p3', {
      kind: 'declare-mulligan',
      decision: 'keep',
    });
    state = accept(state, 'P4' as Core.CorePlayerId, 'keep-paid-p4', {
      kind: 'declare-mulligan',
      decision: 'keep',
    });
    for (const playerId of state.randomPlan.turnOrder) {
      state = accept(state, playerId, `actions-free-${playerId}`, {
        kind: 'complete-pregame-actions',
      });
    }
    for (const playerId of ['P1', 'P2', 'P3', 'P4'] as const) {
      state = accept(state, playerId as Core.CorePlayerId, `ready-free-${playerId}`, {
        kind: 'set-ready',
        ready: true,
      });
    }
    expect(state.phase).toBe('complete');
    for (const playerId of ['P3', 'P4'] as const) {
      expect(handObjectIds(state, playerId as Core.CorePlayerId)).toHaveLength(6);
      expect(
        state.protocolState.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle
          .objectRegistry.players[playerId as Core.CorePlayerId]?.mulliganCount,
      ).toBe(2);
    }

    const twoComplete = completeKeptPregame(2, 'P2' as Core.CorePlayerId);
    const twoReady = upkeepReadyRoot(twoComplete.protocolState.coreRoot);
    const twoHandBefore = handObjectIds(twoComplete, 'P2' as Core.CorePlayerId).length;
    const forbiddenOrdinaryDraw = Core.applyCoreCommandV1(twoReady, turnCommand(twoReady, {
      kind: 'position',
      nextPosition: { phase: 'beginning', step: 'draw' },
    }));
    expect(forbiddenOrdinaryDraw.status).toBe('rejected');
    expect(forbiddenOrdinaryDraw.root).toBe(twoReady);
    const skipped = Core.applyCoreCommandV1(twoReady, turnCommand(twoReady, {
      kind: 'first-turn-draw-skip',
    }));
    expect(skipped.status).toBe('accepted');
    if (skipped.status === 'rejected') throw new Error('Two-player draw skip must be accepted');
    expect(
      skipped.root.ruleAuthority.turnPriorityBundle.lifecycle.position,
    ).toEqual({ phase: 'precombat-main', step: null });
    expect(skipped.root.ruleAuthority.turnPriorityBundle.lifecycle.window).toEqual({
      kind: 'turn-based-action-required',
      action: 'precombat-main-actions',
      playerId: 'P2',
    });
    const skippedRegistry = skipped.root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
    expect(skippedRegistry.zones.byPlayer['P2' as Core.CorePlayerId]?.hand)
      .toHaveLength(twoHandBefore);
    expect(skippedRegistry.players['P2' as Core.CorePlayerId]?.drawnThisTurn).toBe(0);

    const fourReady = upkeepReadyRoot(state.protocolState.coreRoot);
    const forbiddenSkip = Core.applyCoreCommandV1(fourReady, turnCommand(fourReady, {
      kind: 'first-turn-draw-skip',
    }));
    expect(forbiddenSkip.status).toBe('rejected');
    expect(forbiddenSkip.root).toBe(fourReady);
    const drawPosition = Core.applyCoreCommandV1(fourReady, turnCommand(fourReady, {
      kind: 'position',
      nextPosition: { phase: 'beginning', step: 'draw' },
    }));
    expect(drawPosition.status).toBe('accepted');
    if (drawPosition.status === 'rejected') throw new Error('Four-player draw step is required');
    const handBefore = drawPosition.root.ruleAuthority.turnPriorityBundle.stackBundle
      .objectRegistry.zones.byPlayer['P3' as Core.CorePlayerId]?.hand.length ?? -1;
    const drawCheckpoint = Core.applyCoreCommandV1(
      drawPosition.root,
      turnCommand(drawPosition.root, { kind: 'checkpoint' }),
    );
    expect(drawCheckpoint.status).toBe('accepted');
    if (drawCheckpoint.status === 'rejected') throw new Error('Four-player draw must occur');
    const drawnRegistry = drawCheckpoint.root.ruleAuthority.turnPriorityBundle.stackBundle
      .objectRegistry;
    expect(drawnRegistry.zones.byPlayer['P3' as Core.CorePlayerId]?.hand)
      .toHaveLength(handBefore + 1);
    expect(drawnRegistry.players['P3' as Core.CorePlayerId]?.drawnThisTurn).toBe(1);
  });

  it('keeps the candidate inside the frozen Core and headless Pregame paths', { timeout: 90000 }, () => {
    const scope = liveCandidatePathScope();
    const { changed } = scope;
    for (const path of ['.claude/commands/unacknowledged.md', 'docs/unrelated.md']) {
      expect(scope.guardedJudge.has(path), path).toBe(false);
    }
    for (const path of [
      ...ONLINE_PRODUCT_PATHS,
      ...CORE_PREGAME_PATHS,
      ...CORE_DRAW_SKIP_PATHS,
      ...PROJECTION_COMPAT_PATHS,
    ]) {
      expect(changed, path).toContain(path);
    }
    for (const path of changed) {
      const inheritedJudgePath = !scope.current.has(path) && scope.historicalJudge.has(path);
      const guardedJudgePath = scope.current.has(path) && scope.guardedJudge.has(path);
      const allowed = JUDGE_PATHS.has(path)
        || inheritedJudgePath
        || guardedJudgePath
        || O4P_09C_UI_SUCCESSOR_PATHS.has(path)
        || O4P_09D_SUCCESSOR_PATHS.has(path)
        || O4P_09E_SUCCESSOR_PATHS.has(path)
        || ONLINE_PRODUCT_PATHS.includes(path as typeof ONLINE_PRODUCT_PATHS[number])
        || CORE_PREGAME_PATHS.includes(path as typeof CORE_PREGAME_PATHS[number])
        || CORE_DRAW_SKIP_PATHS.includes(path as typeof CORE_DRAW_SKIP_PATHS[number])
        || PROJECTION_COMPAT_PATHS.includes(path as typeof PROJECTION_COMPAT_PATHS[number]);
      expect(allowed, `unexpected O4P-09C path: ${path}`).toBe(true);
      if (!O4P_09C_UI_SUCCESSOR_PATHS.has(path)
        && !O4P_09D_SUCCESSOR_PATHS.has(path)
        && !O4P_09E_SUCCESSOR_PATHS.has(path)
        && !PROJECTION_COMPAT_PATHS.includes(path as typeof PROJECTION_COMPAT_PATHS[number])) {
        expect(path).not.toMatch(
          /^src\/(?:components|store|online\/(?:application|browser|cloudflare|genesis|protocol|projection|publicApp|room))\//u,
        );
      }
      expect(path).not.toMatch(/(?:OnlineGameScreen|OnlineBoard|OnlineHand|OnlineStack)/u);
    }

    const onlineSources = ONLINE_PRODUCT_PATHS
      .filter((path) => !path.includes('/__tests__/'))
      .map(read)
      .join('\n');
    expect(onlineSources).not.toMatch(
      /Math\.random|Date\.now|new\s+Date|fetch\s*\(|WebSocket|applyCoreCommandV1|GameState|useGameStore|zustand/u,
    );
    expect(read('src/online/pregame/projection.ts'))
      .toContain('projectOnlineVariableProtocolV3');
    expect(read('src/online/pregame/operations.ts'))
      .toContain('activateOnlineVariableRoomV2');
    const corePregameSources = CORE_PREGAME_PATHS
      .filter((path) => !path.includes('/__tests__/'))
      .map(read)
      .join('\n');
    expect(corePregameSources).not.toMatch(
      /(?:\.\.\/){3,}(?:online|components|store)|react|zustand|fetch\s*\(|WebSocket|Math\.random|Date\.now/u,
    );
    expect(corePregameSources).not.toContain('applyCoreCommandV1');
    expect(read('src/engine/core/tabletop/commandV1.ts'))
      .toContain('first-turn-draw-skip');
    expect(read('src/engine/core/closure/commandV1.ts'))
      .toContain('first-turn-draw-skip');
    expect(read('src/engine/core/closure/applyCommandV1.ts'))
      .toContain('first-turn-draw-skip');
    expect(() => execFileSync('git', ['diff', '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
    })).not.toThrow();
  });
});
