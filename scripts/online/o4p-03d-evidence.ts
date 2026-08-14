#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import * as Core from '../../src/engine/core/index';
import turnPriorityFixture from '../../src/engine/core/turn/fixtures/turn-priority-lifecycle-v1.json';
import { activateOnlineRoomV1, createOnlineRoomV1, joinOnlineRoomV1, setOnlineRoomPlayerReadyV1, startOnlineRoomV1 } from '../../src/online/room/index';
import { createOnlineProtocolStateV1, type OnlineCommandEnvelopeV1, type OnlineProtocolStateV1 } from '../../src/online/protocol/index';
import { createCoreCommandV1 } from '../../src/engine/core/index';

const EXPECTED_ORIGIN = 'https://mtg-onedeck-online.makeinu1.workers.dev';
const LOCAL_ORIGINS = new Set(['http://127.0.0.1:8787', 'http://localhost:8787']);
const PARTICIPANTS = ['host', 'player-2', 'player-3', 'player-4'] as const;
const CORE_PLAYERS = ['P1', 'P2', 'P3', 'P4'] as const;
const COMMANDER_IDS = ['PC1', 'PC3', 'PC6', 'PC5'] as const;

export type EvidencePhase = 'init-load' | 'hibernation' | 'deployment-reconnect';
export type EvidencePlatformFacts = Readonly<{
  readonly kind: 'o4p-03d-platform-evidence-v1';
  readonly phase: 'hibernation' | 'deployment-reconnect';
  readonly roomCorrelationId: string;
  readonly checkpointRevision: 64;
  readonly currentRevision: 96;
  readonly replaySuffixLength: 32;
  readonly preDeployVersionIdentifier: string;
  readonly postDeployVersionIdentifier: string;
  readonly preDeployRuntimeStartCount: number;
  readonly postDeployRuntimeStartCount: number;
  readonly recoveryFactCount: number;
  readonly tailEventCount: number;
  readonly tailErrorCount: 0;
  readonly tailExceptionCount: 0;
  readonly tailParseFailureCount: 0;
  readonly tailFactViolationCount: 0;
}>;
export type EvidenceSummary = Readonly<{
  readonly phase: EvidencePhase;
  readonly origin: string;
  readonly roomCorrelationId: string;
  readonly status: number;
  readonly revision: number;
  readonly acceptedCommandCount: number;
  readonly checkpointRevision: number | null;
  readonly replaySuffixLength: number | null;
  readonly tailEvidenceSource: 'wrangler-tail-recovery-fact' | null;
  readonly hibernationObserved: boolean;
  readonly preDeployVersionIdentifier: string | null;
  readonly postDeployVersionIdentifier: string | null;
  readonly socketCount: number;
  readonly artifactHashes: readonly string[];
}>;

type SafeResponse = Readonly<{ readonly status: number; readonly text: () => Promise<string> }>;
type SocketMessage = Readonly<{ readonly data: unknown }>;
export type EvidenceSocket = {
  addEventListener(type: string, listener: (event: SocketMessage) => void): void;
  send(data: string): void;
  close(): void;
};

export type EvidenceDeps = Readonly<{
  readonly fetch: (input: string, init?: RequestInit) => Promise<SafeResponse>;
  readonly openSocket: (url: string) => Promise<EvidenceSocket>;
  readonly sleep: (milliseconds: number) => Promise<void>;
  readonly barrier: (summary?: Readonly<Record<string, string | number>>) => Promise<void>;
  readonly observePlatformEvidence: (summary: Readonly<Record<string, string | number>>) => Promise<unknown>;
  readonly messageTimeoutMs?: number;
  readonly requestTimeoutMs?: number;
  readonly operatorTimeoutMs?: number;
}>;

function runtimeSecret(bytes = 32): string { return randomBytes(bytes).toString('base64url'); }
function roomCorrelationId(): string { return `o4p03d-${randomBytes(18).toString('hex')}`; }
function safeHash(value: string): string { return createHash('sha256').update(value).digest('hex'); }

function originFromArgs(): string {
  const value = process.argv.find((arg) => arg.startsWith('--origin='))?.slice('--origin='.length) ?? EXPECTED_ORIGIN;
  const url = new URL(value);
  if (value !== EXPECTED_ORIGIN && !LOCAL_ORIGINS.has(`${url.protocol}//${url.host}`)) throw new Error('invalid origin');
  if (url.pathname !== '/' || url.search || url.hash) throw new Error('invalid origin');
  return value;
}

function phaseFromArgs(): EvidencePhase {
  const phase = process.argv.find((arg) => arg.startsWith('--phase='))?.slice('--phase='.length) ?? 'init-load';
  if (phase === 'init-load' || phase === 'hibernation' || phase === 'deployment-reconnect') return phase;
  throw new Error('invalid phase');
}

function makeCoreRoot(): Core.ModeNeutralCoreRootV1 {
  const source = Core.createCoreTurnPriorityBundleV1(turnPriorityFixture.bundle as never);
  const registry = source.stackBundle.objectRegistry;
  const turnPriorityBundle = Core.createCoreTurnPriorityBundleV1({
    stackBundle: source.stackBundle,
    pendingTriggers: Core.createModeNeutralCorePendingTriggerSliceV1(registry, { pendingObjectIds: [], byObject: {} }),
    lifecycle: source.lifecycle,
  });
  const authority = Core.createCoreRuleAuthorityBundleV1({
    turnPriorityBundle,
    control: Core.createModeNeutralCoreControlSliceV1({ effectOrder: [], byEffect: {}, continuityByObject: { 'PC6:0': { controllerPlayerId: 'P3', continuousSinceMostRecentTurnBegan: false } } as never }),
    visibility: Core.createModeNeutralCoreVisibilitySliceV1({ grantOrder: [], byGrant: {} }),
    searchSessions: Core.createModeNeutralCoreSearchSessionSliceV1({ sessionOrder: [], bySession: {} }),
    playPermissions: Core.createModeNeutralCorePlayPermissionSliceV1({ permissionOrder: [], byPermission: {} }),
    decisionAuthorities: Core.createModeNeutralCoreDecisionAuthoritySliceV1({ authorityOrder: [], byAuthority: {} }),
  });
  const commanders = [
    Core.createCoreCommanderIdentityV1({ physicalCardId: 'PC1', ownerPlayerId: 'P1' }),
    Core.createCoreCommanderIdentityV1({ physicalCardId: 'PC3', ownerPlayerId: 'P2' }),
    Core.createCoreCommanderIdentityV1({ physicalCardId: 'PC6', ownerPlayerId: 'P3' }),
    Core.createCoreCommanderIdentityV1({ physicalCardId: 'PC5', ownerPlayerId: 'P4' }),
  ];
  return Core.createModeNeutralCoreRootV1({
    versions: Core.CORE_CLOSURE_VERSION_VECTOR_V1,
    acceptedCommandCount: 0,
    ruleAuthority: authority,
    playerLifecycle: Core.createCorePlayerLifecycleStateV1({ players: registry.turnOrder.map((playerId) => ({ playerId, status: 'active', exitCause: null })) }),
    commanders,
    commanderCastLedgers: commanders.map((commander) => Core.createCoreCommanderCastLedgerV1({ commander, castCount: 0 })),
    commanderDamage: Core.createCoreCommanderDamageStateV1({ commanders, defendingPlayerIds: registry.turnOrder, entries: [] }),
    commanderDamageProvenance: Core.createCoreCommanderDamageProvenanceLedgerV1({ commanders, defendingPlayerIds: registry.turnOrder, records: [] }),
    combatContext: null,
  });
}

function protocolState(roomId: string, capabilities: readonly string[]): OnlineProtocolStateV1 {
  let room = createOnlineRoomV1({ roomId, seatAssignments: CORE_PLAYERS.map((corePlayerId, seatIndex) => ({ seatIndex, corePlayerId, seatCapability: capabilities[seatIndex] ?? '' })), host: { participantId: PARTICIPANTS[0], seatCapability: capabilities[0] ?? '' } });
  for (let index = 1; index < PARTICIPANTS.length; index += 1) room = joinOnlineRoomV1(room, { participantId: PARTICIPANTS[index], role: 'player', seatCapability: capabilities[index] ?? '' });
  for (let index = 0; index < PARTICIPANTS.length; index += 1) room = setOnlineRoomPlayerReadyV1(room, { participantId: PARTICIPANTS[index], seatCapability: capabilities[index] ?? '', ready: true });
  const root = makeCoreRoot();
  return createOnlineProtocolStateV1({ serverBuildId: 'o4p-03d-evidence', room: activateOnlineRoomV1(startOnlineRoomV1(room, PARTICIPANTS[0]), { hostParticipantId: PARTICIPANTS[0], coreRoot: root }), coreRoot: root, observerAuthorizations: [] });
}

async function promptLine(question: string, timeoutMs = 300_000): Promise<string> {
  const line = createInterface({ input, output });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      line.question(question),
      new Promise<string>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('operator timeout')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    line.close();
  }
}

function defaultDeps(): EvidenceDeps {
  const fetcher = globalThis.fetch;
  const Socket = (globalThis as unknown as { WebSocket?: new (url: string) => EvidenceSocket }).WebSocket;
  if (fetcher === undefined || Socket === undefined) throw new Error('network APIs unavailable');
  return {
    fetch: async (url, init) => fetcher(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(10_000) }),
    openSocket: (url) => new Promise<EvidenceSocket>((resolve, reject) => {
      const socket = new Socket(url);
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { socket.close(); } catch { /* timeout cleanup is non-semantic */ }
        reject(new Error('socket open timeout'));
      }, 10_000);
      socket.addEventListener('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(socket);
      });
      socket.addEventListener('error', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error('socket error'));
      });
    }),
    sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    barrier: async (summary) => {
      if (summary !== undefined) output.write(`${JSON.stringify({ kind: 'ready-for-deploy', ...summary })}\n`);
      await promptLine('Deployment barrier: press Enter after the operator completes the identical-code deployment.');
    },
    observePlatformEvidence: async (summary) => {
      output.write(`${JSON.stringify({ kind: 'ready-for-platform-evidence', ...summary })}\n`);
      const value = await promptLine('Paste the secret-free tail summary JSON and press Enter: ');
      return JSON.parse(value) as unknown;
    },
  };
}

async function json(response: SafeResponse): Promise<Record<string, unknown>> {
  const text = await response.text();
  const parsed: unknown = JSON.parse(text);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid response');
  return parsed as Record<string, unknown>;
}

function assertSafe(value: string, forbidden: readonly string[]): void {
  if (forbidden.some((needle) => value.includes(needle))) throw new Error('secret-bearing output');
}

function capabilityFragments(capability: string): readonly string[] {
  return Object.freeze(Array.from(
    { length: capability.length - 7 },
    (_value, start) => capability.slice(start, start + 8),
  ));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
    }),
  ]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

type MessageInbox = Readonly<{
  readonly next: (timeoutMs?: number) => Promise<Record<string, unknown>>;
  readonly nextMatching: (predicate: (message: Record<string, unknown>) => boolean, timeoutMs?: number) => Promise<Record<string, unknown>>;
  readonly assertHealthy: () => void;
}>;

function createInbox(socket: EvidenceSocket, messageTimeoutMs = 10_000, inspectMessage: (message: Record<string, unknown>) => void = () => undefined): MessageInbox {
  const queue: Record<string, unknown>[] = [];
  const waiters: Array<{ readonly resolve: (value: Record<string, unknown>) => void; readonly reject: (error: Error) => void; readonly timer: ReturnType<typeof setTimeout> }> = [];
  let fatal: Error | null = null;
  socket.addEventListener('message', (event) => {
    try {
      const value: unknown = JSON.parse(String(event.data));
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid socket response');
      inspectMessage(value as Record<string, unknown>);
      const waiter = waiters.shift();
      if (waiter !== undefined) { clearTimeout(waiter.timer); waiter.resolve(value as Record<string, unknown>); } else queue.push(value as Record<string, unknown>);
    } catch (error: unknown) {
      fatal = error instanceof Error ? error : new Error('invalid socket response');
      for (const waiter of waiters.splice(0)) {
        clearTimeout(waiter.timer);
        waiter.reject(fatal);
      }
    }
  });
  const next = (timeoutMs = messageTimeoutMs): Promise<Record<string, unknown>> => new Promise<Record<string, unknown>>((resolve, reject) => {
    if (fatal !== null) { reject(fatal); return; }
    const queued = queue.shift();
    if (queued !== undefined) { resolve(queued); return; }
    const timer = setTimeout(() => {
      const index = waiters.findIndex((entry) => entry.timer === timer);
      if (index >= 0) waiters.splice(index, 1);
      reject(new Error('socket response timeout'));
    }, timeoutMs);
    waiters.push({ resolve, reject, timer });
  });
  return Object.freeze({
    next,
    assertHealthy: () => {
      if (fatal !== null) throw fatal;
    },
    nextMatching: async (predicate, timeoutMs = messageTimeoutMs) => {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const remaining = Math.max(1, deadline - Date.now());
        const message = await next(remaining);
        if (predicate(message)) return message;
      }
    },
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function canonicalVersion(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function validatePlatformEvidence(value: unknown, roomId: string, phase: 'hibernation' | 'deployment-reconnect'): EvidencePlatformFacts {
  const candidate = record(value);
  if (candidate === null) throw new Error('invalid platform evidence');
  const expectedKeys = [
    'checkpointRevision', 'currentRevision', 'kind', 'phase', 'postDeployRuntimeStartCount',
    'postDeployVersionIdentifier', 'preDeployRuntimeStartCount', 'preDeployVersionIdentifier',
    'recoveryFactCount', 'replaySuffixLength', 'roomCorrelationId', 'tailErrorCount',
    'tailEventCount', 'tailExceptionCount', 'tailFactViolationCount', 'tailParseFailureCount',
  ].sort();
  if (JSON.stringify(Object.keys(candidate).sort()) !== JSON.stringify(expectedKeys)) throw new Error('invalid platform evidence shape');
  if (
    candidate.kind !== 'o4p-03d-platform-evidence-v1' ||
    candidate.phase !== phase ||
    candidate.roomCorrelationId !== roomId ||
    candidate.checkpointRevision !== 64 ||
    candidate.currentRevision !== 96 ||
    candidate.replaySuffixLength !== 32 ||
    !canonicalVersion(candidate.preDeployVersionIdentifier) ||
    !canonicalVersion(candidate.postDeployVersionIdentifier) ||
    !positiveInteger(candidate.preDeployRuntimeStartCount) ||
    candidate.preDeployRuntimeStartCount < 2 ||
    !positiveInteger(candidate.recoveryFactCount) ||
    !positiveInteger(candidate.tailEventCount) ||
    candidate.tailErrorCount !== 0 ||
    candidate.tailExceptionCount !== 0 ||
    candidate.tailParseFailureCount !== 0 ||
    candidate.tailFactViolationCount !== 0
  ) throw new Error('platform evidence mismatch');
  if (phase === 'deployment-reconnect') {
    if (!positiveInteger(candidate.postDeployRuntimeStartCount) || candidate.preDeployVersionIdentifier === candidate.postDeployVersionIdentifier) throw new Error('deployment transition not observed');
  } else if (candidate.postDeployRuntimeStartCount !== 0 || candidate.preDeployVersionIdentifier !== candidate.postDeployVersionIdentifier) {
    throw new Error('unexpected deployment evidence');
  }
  return Object.freeze(candidate as unknown as EvidencePlatformFacts);
}

async function authenticate(socket: EvidenceSocket, inbox: MessageInbox, state: OnlineProtocolStateV1, index: number, capability: string, expectedRevision: number): Promise<void> {
  socket.send(JSON.stringify({ kind: 'online-client-hello-v1', protocolVersion: state.protocolVersion, roomId: state.room.roomId, participantId: PARTICIPANTS[index], participantCapability: capability, clientBuildId: 'o4p-03d-evidence-client' }));
  const hello = await inbox.nextMatching((message) => message.kind === 'online-server-hello-v1');
  if (hello.status !== 'accepted' || hello.roomId !== state.room.roomId || hello.participantId !== PARTICIPANTS[index] || hello.role !== 'player' || hello.revision !== expectedRevision) throw new Error('hello mismatch');
  socket.send(JSON.stringify({ kind: 'online-projection-request-v1', protocolVersion: state.protocolVersion, roomId: state.room.roomId, participantId: PARTICIPANTS[index], participantCapability: capability, knownRevision: expectedRevision, clientBuildId: 'o4p-03d-evidence-client', decisionContext: { kind: 'decision', decisionKey: 'evidence-projection' } }));
  const projection = await inbox.nextMatching((message) => message.kind === 'online-projected-snapshot-v1');
  const audience = record(projection.projection);
  if (
    projection.status !== 'accepted' ||
    projection.roomId !== state.room.roomId ||
    projection.participantId !== PARTICIPANTS[index] ||
    projection.role !== 'player' ||
    projection.revision !== expectedRevision ||
    audience?.kind !== 'online-participant-projection-v1' ||
    audience.roomId !== state.room.roomId ||
    audience.participantId !== PARTICIPANTS[index] ||
    audience.role !== 'player' ||
    audience.corePlayerId !== CORE_PLAYERS[index] ||
    audience.revision !== expectedRevision
  ) throw new Error('projection mismatch');
}

async function runScenario(phase: EvidencePhase, origin: string, deps: EvidenceDeps): Promise<EvidenceSummary> {
  const roomId = roomCorrelationId();
  const capabilities = Object.freeze(PARTICIPANTS.map(() => runtimeSecret()));
  const state = protocolState(roomId, capabilities);
  const forbidden = [...new Set(capabilities.flatMap(capabilityFragments)), 'Authorization', 'participantCapability'];
  const requestTimeoutMs = deps.requestTimeoutMs ?? 10_000;
  const operatorTimeoutMs = deps.operatorTimeoutMs ?? 300_000;
  const inspectMessage = (message: Record<string, unknown>): void => assertSafe(JSON.stringify(message), forbidden);
  const init = await withTimeout(deps.fetch(`${origin}/api/online/rooms/${roomId}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online-cloudflare-room-initialize-v1', schemaVersion: 1, state }) }), requestTimeoutMs, 'initialization request');
  const initBody = await withTimeout(json(init), requestTimeoutMs, 'initialization response');
  assertSafe(JSON.stringify(initBody), forbidden);
  if (init.status !== 200 || initBody.roomId !== roomId || initBody.revision !== 0 || initBody.acceptedCommandCount !== 0) throw new Error('initialization mismatch');
  const sockets = await Promise.all(capabilities.map(() => withTimeout(deps.openSocket(`${origin.replace(/^http/, 'ws')}/api/online/rooms/${roomId}/websocket`), requestTimeoutMs, 'socket open')));
  const inboxes = sockets.map((socket) => createInbox(socket, deps.messageTimeoutMs, inspectMessage));
  for (let index = 0; index < sockets.length; index += 1) {
    const socket = sockets[index];
    const capability = capabilities[index];
    if (socket === undefined || capability === undefined) throw new Error('socket setup mismatch');
    const inbox = inboxes[index];
    if (inbox === undefined) throw new Error('socket inbox mismatch');
    await authenticate(socket, inbox, state, index, capability, 0);
  }
  let currentRevision = 0;
  const artifactHashes: string[] = [];
  for (let commandIndex = 0; commandIndex < 96; commandIndex += 1) {
    const seat = commandIndex % 4;
    const command = createCoreCommandV1({ schemaVersion: 1, sequence: commandIndex + 1, actorPlayerId: CORE_PLAYERS[seat] as never, decisionMakerPlayerId: CORE_PLAYERS[seat] as never, decisionContext: { kind: 'decision', decisionKey: 'evidence-command' }, payload: { kind: 'commander-cast-record', physicalCardId: COMMANDER_IDS[seat] as never, origin: 'command-zone', accepted: true } });
    const envelope: OnlineCommandEnvelopeV1 = { kind: 'online-command-envelope-v1', protocolVersion: state.protocolVersion, roomId: roomId as never, participantId: PARTICIPANTS[seat] as never, participantCapability: capabilities[seat] as never, commandId: `evidence-command-${commandIndex + 1}` as never, baseRevision: currentRevision, command };
    const socket = sockets[seat];
    if (socket === undefined) throw new Error('socket setup mismatch');
    const inbox = inboxes[seat];
    if (inbox === undefined) throw new Error('socket inbox mismatch');
    socket.send(JSON.stringify(envelope));
    let response = await inbox.next();
    while (response.kind === 'online-cloudflare-revision-v1') response = await inbox.next();
    if (response.kind !== 'online-command-ack-v1' || response.duplicate !== false || response.acceptedRevision !== currentRevision + 1) throw new Error('command mismatch');
    currentRevision += 1;
  }
  const status = await withTimeout(deps.fetch(`${origin}/api/online/rooms/${roomId}`), requestTimeoutMs, 'status request');
  const statusBody = await withTimeout(json(status), requestTimeoutMs, 'status response');
  assertSafe(JSON.stringify(statusBody), forbidden);
  if (status.status !== 200 || statusBody.revision !== 96 || statusBody.acceptedCommandCount !== 96) throw new Error('status mismatch');
  const fresh = await withTimeout(deps.openSocket(`${origin.replace(/^http/, 'ws')}/api/online/rooms/${roomId}/websocket`), requestTimeoutMs, 'fresh socket open');
  const freshInbox = createInbox(fresh, deps.messageTimeoutMs, inspectMessage);
  const allInboxes = [...inboxes, freshInbox];
  await authenticate(fresh, freshInbox, state, 0, capabilities[0] ?? '', currentRevision);
  fresh.close();
  const allSockets = [...sockets, fresh];
  let platformEvidence: EvidencePlatformFacts | null = null;
  if (phase === 'hibernation' || phase === 'deployment-reconnect') {
    await deps.sleep(70_000);
    const idleSocket = sockets[0];
    const idleInbox = inboxes[0];
    if (idleSocket === undefined || idleInbox === undefined) throw new Error('idle socket mismatch');
    await authenticate(idleSocket, idleInbox, state, 0, capabilities[0] ?? '', currentRevision);
    if (phase === 'deployment-reconnect') {
      await withTimeout(deps.barrier({ roomCorrelationId: roomId, revision: currentRevision, acceptedCommandCount: currentRevision }), operatorTimeoutMs, 'deployment barrier');
    }
    const reconnected = await withTimeout(deps.openSocket(`${origin.replace(/^http/, 'ws')}/api/online/rooms/${roomId}/websocket`), requestTimeoutMs, 'reconnected socket open');
    const reconnectedInbox = createInbox(reconnected, deps.messageTimeoutMs, inspectMessage);
    allInboxes.push(reconnectedInbox);
    await authenticate(reconnected, reconnectedInbox, state, 0, capabilities[0] ?? '', currentRevision);
    allSockets.push(reconnected);
    reconnected.close();
    const observed = await withTimeout(
      deps.observePlatformEvidence({ roomCorrelationId: roomId, revision: currentRevision, acceptedCommandCount: currentRevision, phase }),
      operatorTimeoutMs,
      'platform evidence',
    );
    assertSafe(JSON.stringify(observed), forbidden);
    platformEvidence = validatePlatformEvidence(observed, roomId, phase);
  }
  const body = JSON.stringify(statusBody);
  artifactHashes.push(safeHash(body));
  if (platformEvidence !== null) artifactHashes.push(safeHash(JSON.stringify(platformEvidence)));
  for (const socket of allSockets) socket.close();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (const inbox of allInboxes) inbox.assertHealthy();
  return Object.freeze({
    phase,
    origin,
    roomCorrelationId: roomId,
    status: status.status,
    revision: currentRevision,
    acceptedCommandCount: statusBody.acceptedCommandCount === currentRevision ? currentRevision : -1,
    checkpointRevision: platformEvidence?.checkpointRevision ?? null,
    replaySuffixLength: platformEvidence?.replaySuffixLength ?? null,
    tailEvidenceSource: platformEvidence === null ? null : 'wrangler-tail-recovery-fact',
    hibernationObserved: platformEvidence !== null,
    preDeployVersionIdentifier: platformEvidence?.preDeployVersionIdentifier ?? null,
    postDeployVersionIdentifier: platformEvidence?.postDeployVersionIdentifier ?? null,
    socketCount: sockets.length,
    artifactHashes: Object.freeze(artifactHashes),
  });
}

export async function runEvidencePhase(phase: EvidencePhase, origin = originFromArgs(), deps = defaultDeps()): Promise<EvidenceSummary> {
  return runScenario(phase, origin, deps);
}

if (process.argv[1]?.endsWith('o4p-03d-evidence.ts') === true) {
  runEvidencePhase(phaseFromArgs()).then((summary) => process.stdout.write(`${JSON.stringify(summary)}\n`)).catch(() => { process.stderr.write('evidence failed\n'); process.exitCode = 1; });
}
