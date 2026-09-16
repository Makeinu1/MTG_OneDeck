import {
  addCockpitDeck,
  authorizeCockpitOperation,
  cockpitActor,
  cockpitOwnerPresent,
  projectCockpit,
  type CockpitControl,
  type CockpitMultiplayer,
  type CockpitMultiplayerView,
} from './cockpitMultiplayer';
import {
  R4B_PROTOCOL_VERSION,
  applyPreparedR4bCommit,
  prepareR4bCommit,
  type PreparedR4bCommit,
  type R4bCommitEnvelope,
} from './cockpitR4bSession';
import {
  appendR4bSemanticAction,
  projectR4bSemanticActions,
  semanticActionForR4bCommit,
  semanticHistoryAction,
  type R4bInternalSemanticAction,
  type R4bPublicSemanticAction,
} from './cockpitR4bAudit';
import { migrateCockpitSnapshot, backfillCockpitTable } from '../../engine/cockpitMigration';
import type { GameSnapshot } from '../../data/gameSnapshot';
import {
  applyTableOperation,
  createCockpitTable,
  type CockpitTable,
  type TableOperation,
} from '../../engine/cockpitTable';
import type { ExpectedInteractionContext } from '../../engine/cockpitR31';
import type { R4bDeclaredCause, R4bOperation } from '../../engine/cockpitR4b';
import type { R4TableOperation } from '../../engine/cockpitR4';
import type { InitDeckCard } from '../../engine/init';
import type { OnlineCloudflareSqlStorage } from './types';

export const COCKPIT_TTL_MS = 6 * 60 * 60 * 1000;
interface SessionRecord {
  multiplayer?: CockpitMultiplayer;
  table: CockpitTable;
  generation: string;
  revision: number;
  lastUsed: number;
  ownerToken: string;
  undo: CockpitTable[];
  redo: CockpitTable[];
  /** Monotonic trust boundary; contains no private card data. */
  knowledgeEpoch?: number;
  undoKnowledgeEpochs?: number[];
  redoKnowledgeEpochs?: number[];
  /** Bounded semantic audit. Raw operation/card payloads are never stored here. */
  recentActions?: R4bInternalSemanticAction[];
}
export interface CockpitSessionView {
  multiplayer?: CockpitMultiplayerView;
  table: CockpitTable;
  revision: number;
  expiresAt: number;
  canUndo: boolean;
  canRedo: boolean;
  receipt: 'committed' | 'unseen' | null;
  /** Optional during the compatible rollout; R4b servers always populate it. */
  recentActions?: R4bPublicSemanticAction[];
}
export interface CockpitCheckpoint {
  version: 1;
  sessionAddress: string;
  table: CockpitTable;
  revision: number;
  savedAt: number;
  signature: string;
}
export type CockpitSessionRequest = (
  | { type: 'join'; token: string; invitation: string; deck: InitDeckCard[] }
  | { type: 'connect'; token: string }
  | { type: 'control'; token: string; requestId: string; revision: number; control: CockpitControl }
  | {
      type: 'create';
      token: string;
      deck: InitDeckCard[];
      seed: number;
      seats?: 2 | 4;
      connectionId?: string;
    }
  | { type: 'import'; token: string; snapshot: GameSnapshot }
  | { type: 'checkpoint'; token: string }
  | { type: 'restore'; token: string; checkpoint: CockpitCheckpoint }
  | { type: 'read'; token: string; requestId?: string }
  | {
      type: 'commit';
      token: string;
      requestId: string;
      revision: number;
      operation:
        | TableOperation
        | R4TableOperation
        | R4bOperation
        | { type: 'undo' }
        | { type: 'redo' };
      context?: ExpectedInteractionContext;
      protocolVersion?: typeof R4B_PROTOCOL_VERSION;
      declaredCause?: R4bDeclaredCause;
    }
) & { connectionId?: string };

const response = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
function sameHistoryBoundary(
  current: CockpitTable,
  candidate: CockpitTable | undefined,
  multiplayer = true,
): boolean {
  return Boolean(
    candidate &&
    !current.ended &&
    (!multiplayer || candidate.turn === current.turn) &&
    candidate.ended === current.ended &&
    current.seats.every(
      (seat) =>
        candidate.seats.find((other) => other.id === seat.id)?.eliminated === seat.eliminated,
    ),
  );
}
function ensureKnowledgeHistory(record: SessionRecord): void {
  record.knowledgeEpoch ??= 0;
  record.undoKnowledgeEpochs ??= [];
  record.redoKnowledgeEpochs ??= [];
  while (record.undoKnowledgeEpochs.length < record.undo.length)
    record.undoKnowledgeEpochs.push(record.knowledgeEpoch);
  while (record.redoKnowledgeEpochs.length < record.redo.length)
    record.redoKnowledgeEpochs.push(record.knowledgeEpoch);
  record.undoKnowledgeEpochs.length = record.undo.length;
  record.redoKnowledgeEpochs.length = record.redo.length;
}
function pushUndoSnapshot(record: SessionRecord, table: CockpitTable, epoch = record.knowledgeEpoch ?? 0): void {
  ensureKnowledgeHistory(record);
  record.undo.push(table);
  record.undoKnowledgeEpochs!.push(epoch);
}
function pushRedoSnapshot(record: SessionRecord, table: CockpitTable, epoch = record.knowledgeEpoch ?? 0): void {
  ensureKnowledgeHistory(record);
  record.redo.push(table);
  record.redoKnowledgeEpochs!.push(epoch);
}
function knowledgeSafeUndo(record: SessionRecord): boolean {
  ensureKnowledgeHistory(record);
  return (
    !record.multiplayer ||
    record.undoKnowledgeEpochs!.at(-1) === (record.knowledgeEpoch ?? 0)
  );
}
function view(
  record: SessionRecord,
  receipt: CockpitSessionView['receipt'],
  actor = 'P1',
  now = record.lastUsed,
): CockpitSessionView {
  ensureKnowledgeHistory(record);
  // Multiplayer replies contain only the authenticated seat's audience projection.
  return {
    ...(record.multiplayer
      ? projectCockpit(record.table, record.multiplayer, actor, now)
      : { table: record.table }),
    revision: record.revision,
    expiresAt: record.lastUsed + COCKPIT_TTL_MS,
    canUndo:
      (!record.multiplayer ||
        (record.multiplayer.masterId === actor &&
          cockpitOwnerPresent(record.multiplayer, now) &&
          !record.multiplayer.holds.length)) &&
      knowledgeSafeUndo(record) &&
      sameHistoryBoundary(record.table, record.undo.at(-1), Boolean(record.multiplayer)),
    canRedo:
      !record.multiplayer &&
      sameHistoryBoundary(record.table, record.redo.at(-1), Boolean(record.multiplayer)),
    receipt,
    recentActions: projectR4bSemanticActions(record.recentActions, actor),
  };
}

function initializeStorage(storage: OnlineCloudflareSqlStorage): void {
  storage.sql.exec(
    'CREATE TABLE IF NOT EXISTS cockpit_session (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL)',
  );
  storage.sql.exec(
    'CREATE TABLE IF NOT EXISTS cockpit_receipts (id TEXT PRIMARY KEY, operation TEXT NOT NULL)',
  );
  storage.sql.exec(
    'CREATE TABLE IF NOT EXISTS cockpit_checkpoint_key (id INTEGER PRIMARY KEY CHECK(id = 1), secret TEXT NOT NULL)',
  );
}
function loadRecord(storage: OnlineCloudflareSqlStorage): SessionRecord | null {
  const row = storage.sql
    .exec<{ data: string }>('SELECT data FROM cockpit_session WHERE id = 1')
    .toArray()[0];
  if (!row) return null;
  const record = JSON.parse(row.data) as SessionRecord;
  for (const table of [record.table, ...record.undo, ...record.redo]) backfillCockpitTable(table);
  ensureKnowledgeHistory(record);
  record.recentActions ??= [];
  return record;
}
function receiptKey(record: SessionRecord, requestId: string, actor = 'P1'): string {
  // Pre-generation local sessions used bare receipt IDs. Keep that namespace
  // until their six-hour expiry; restore always starts a new generation.
  return record.generation
    ? `${record.generation}:${record.multiplayer ? actor + ':' : ''}${requestId}`
    : requestId;
}
async function checkpointSignature(
  storage: OnlineCloudflareSqlStorage,
  payload: Omit<CockpitCheckpoint, 'signature'>,
  create = false,
): Promise<string> {
  let row = storage.sql
    .exec<{ secret: string }>('SELECT secret FROM cockpit_checkpoint_key WHERE id = 1')
    .toArray()[0];
  if (!row && !create) throw new Error('INVALID_CHECKPOINT');
  if (!row) {
    const secret = [...crypto.getRandomValues(new Uint8Array(32))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    storage.transactionSync(() =>
      storage.sql.exec('INSERT INTO cockpit_checkpoint_key (id, secret) VALUES (1, ?)', secret),
    );
    row = { secret };
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(row.secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  return [...new Uint8Array(signed)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function r4bFailure(error: unknown): Response | null {
  const code = error instanceof Error ? error.message : '';
  if (code === 'R4B_NOT_AUTHORIZED') return response({ error: 'NOT_AUTHORIZED' }, 403);
  if (
    code === 'R4B_CORRECTION_REQUIRES_HOLD' ||
    code === 'R4B_HOLD_BLOCKS_OPERATION' ||
    code === 'R4B_BLOCKING_TRIGGER' ||
    code === 'R4B_STACK_EFFECT_REQUIRES_RESOLUTION' ||
    code === 'STALE_INTERACTION_CONTEXT'
  )
    return response({ error: code }, 409);
  if (
    code.startsWith('R4B_') ||
    code.startsWith('INVALID_R4B_') ||
    code === 'STALE_R4B_OBJECT'
  )
    return response({ error: code }, 422);
  return null;
}

/** One SQLite transaction owns board, history, revision and receipt. No client apply. */
export async function handleCockpitSession(
  request: Request,
  storage: OnlineCloudflareSqlStorage,
  now: number,
): Promise<Response> {
  if (
    request.method !== 'POST' ||
    !request.headers.get('content-type')?.startsWith('application/json')
  )
    return response({ error: 'INVALID_REQUEST' }, 400);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 2_000_000)
    return response({ error: 'REQUEST_TOO_LARGE' }, 413);
  let body: CockpitSessionRequest;
  try {
    body = JSON.parse(text) as CockpitSessionRequest;
  } catch {
    return response({ error: 'INVALID_REQUEST' }, 400);
  }
  if (!body || typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token))
    return response({ error: 'AUTHENTICATION_REQUIRED' }, 403);
  try {
    initializeStorage(storage);
    if (body.type === 'checkpoint') {
      const record = loadRecord(storage);
      if (record?.multiplayer)
        return response({ error: 'MULTIPLAYER_CHECKPOINT_UNAVAILABLE' }, 409);
      if (!record || record.ownerToken !== body.token)
        return response({ error: 'AUTHENTICATION_REQUIRED' }, 403);
      if (now >= record.lastUsed + COCKPIT_TTL_MS)
        return response({ error: 'SESSION_EXPIRED' }, 410);
      // Explicit solo checkpoint is deliberate user activity. Automatic read/connect is not.
      record.lastUsed = now;
      storage.transactionSync(() =>
        storage.sql.exec(
          'UPDATE cockpit_session SET data = ? WHERE id = 1',
          JSON.stringify(record),
        ),
      );
      const payload: Omit<CockpitCheckpoint, 'signature'> = {
        version: 1,
        sessionAddress: new URL(request.url).pathname,
        table: record.table,
        revision: record.revision,
        savedAt: now,
      };
      return response({ ...payload, signature: await checkpointSignature(storage, payload, true) });
    }
    if (body.type === 'restore') {
      const checkpoint = body.checkpoint;
      if (
        !checkpoint ||
        checkpoint.version !== 1 ||
        checkpoint.sessionAddress !== new URL(request.url).pathname ||
        typeof checkpoint.signature !== 'string'
      )
        return response({ error: 'INVALID_CHECKPOINT' }, 400);
      const { signature, ...payload } = checkpoint;
      if (signature !== (await checkpointSignature(storage, payload)))
        return response({ error: 'INVALID_CHECKPOINT' }, 403);
      return storage.transactionSync(() => {
        const existing = loadRecord(storage);
        // A retry after a lost restore response returns the newly created session.
        if (existing?.ownerToken === body.token) return response(view(existing, null));
        if (existing && now < existing.lastUsed + COCKPIT_TTL_MS)
          return response({ error: 'SESSION_STILL_ACTIVE' }, 409);
        const table = structuredClone(checkpoint.table);
        backfillCockpitTable(table);
        table.ended ||= existing?.table.ended ?? false;
        for (const seat of table.seats)
          seat.eliminated ||=
            existing?.table.seats.find((current) => current.id === seat.id)?.eliminated ?? false;
        const restored: SessionRecord = {
          table,
          generation: crypto.randomUUID(),
          revision: 0,
          lastUsed: now,
          ownerToken: body.token,
          undo: [],
          redo: [],
          recentActions: [],
        };
        storage.sql.exec(
          'INSERT INTO cockpit_session (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
          JSON.stringify(restored),
        );
        return response(view(restored, null));
      });
    }
    return storage.transactionSync(() => {
      let record = loadRecord(storage);
      // Only a newly accepted user mutation extends the six-hour session TTL.
      // Presence reads/connects still update member.lastSeen, but do not move lastUsed.
      let extendTtl = false;
      let actor = record?.multiplayer ? cockpitActor(record.multiplayer, body.token) : 'P1';
      if (record?.multiplayer && body.type === 'join') {
        const multi = record.multiplayer;
        if (!actor) {
          if (
            multi.started ||
            body.invitation !== multi.invitation ||
            !cockpitOwnerPresent(multi, now)
          )
            return response({ error: 'ADMISSION_CLOSED' }, 403);
          actor = record.table.seats.find((seat) => !multi.members[seat.id])?.id;
          if (!actor) return response({ error: 'ROOM_FULL' }, 409);
          record.table = addCockpitDeck(
            record.table,
            body.deck,
            actor,
            crypto.getRandomValues(new Uint32Array(1))[0],
          );
          multi.members[actor] = {
            token: body.token,
            connectionId: body.connectionId ?? '',
            lastSeen: now,
            kicked: false,
            peek: null,
          };
          record.revision += 1;
          extendTtl = true;
        }
      }
      if (record && (record.multiplayer ? !actor : record.ownerToken !== body.token))
        return response({ error: 'AUTHENTICATION_REQUIRED' }, 403);
      actor ??= 'P1';
      if (record?.multiplayer) {
        const member = record.multiplayer.members[actor];
        if (!body.connectionId || !/^[a-zA-Z0-9-]{16,80}$/.test(body.connectionId))
          return response({ error: 'CONNECTION_REQUIRED' }, 403);
        if (body.type === 'connect') member.connectionId = body.connectionId;
        if (member.connectionId !== body.connectionId)
          return response({ error: 'CONNECTION_REPLACED' }, 403);
        member.lastSeen = now;
      }
      if (record && now >= record.lastUsed + COCKPIT_TTL_MS)
        return response({ error: 'SESSION_EXPIRED' }, 410);
      if (body.type === 'create' || body.type === 'import') {
        if (!record) {
          if (body.type === 'create' && !Number.isSafeInteger(body.seed))
            return response({ error: 'INVALID_REQUEST' }, 400);
          if (
            body.type === 'create' &&
            body.seats !== undefined &&
            (![2, 4].includes(body.seats) ||
              !body.connectionId ||
              !/^[a-zA-Z0-9-]{16,80}$/.test(body.connectionId))
          )
            return response({ error: 'INVALID_REQUEST' }, 400);
          record = {
            ...(body.type === 'create' && body.seats
              ? {
                  multiplayer: {
                    invitation: crypto.randomUUID() + crypto.randomUUID(),
                    members: {
                      P1: {
                        token: body.token,
                        connectionId: body.connectionId!,
                        lastSeen: now,
                        kicked: false,
                        peek: null,
                      },
                    },
                    started: false,
                    masterId: 'P1',
                    holds: [],
                    borrowedFrom: null,
                  },
                }
              : {}),
            table:
              body.type === 'create'
                ? createCockpitTable(
                    body.deck,
                    body.seed,
                    body.seats
                      ? Array.from({ length: body.seats }, (_, index) =>
                          index === 0 ? body.deck : [],
                        )
                      : undefined,
                  )
                : migrateCockpitSnapshot(body.snapshot),
            generation: crypto.randomUUID(),
            revision: 0,
            lastUsed: now,
            ownerToken: body.token,
            undo: [],
            redo: [],
            recentActions: [],
          };
        }
      } else if (!record) return response({ error: 'SESSION_NOT_FOUND' }, 404);
      if (!record) return response({ error: 'SESSION_NOT_FOUND' }, 404);
      let receipt: CockpitSessionView['receipt'] = null;
      if (body.type === 'read' && body.requestId !== undefined) {
        receipt = storage.sql
          .exec(
            'SELECT id FROM cockpit_receipts WHERE id = ?',
            receiptKey(record, body.requestId, actor),
          )
          .toArray().length
          ? 'committed'
          : 'unseen';
      } else if (body.type === 'commit' || body.type === 'control') {
        if (
          typeof body.requestId !== 'string' ||
          !/^[a-zA-Z0-9-]{16,80}$/.test(body.requestId) ||
          !Number.isSafeInteger(body.revision) ||
          !(body.type === 'commit' ? body.operation : body.control)
        )
          return response({ error: 'INVALID_REQUEST' }, 400);
        const encodedOperation = JSON.stringify(
          body.type === 'commit'
            ? {
                ...(body.protocolVersion !== undefined
                  ? { protocolVersion: body.protocolVersion }
                  : {}),
                operation: body.operation,
                ...(body.context ? { context: body.context } : {}),
                ...(body.declaredCause ? { declaredCause: body.declaredCause } : {}),
              }
            : body.control,
        );
        const existing = storage.sql
          .exec<{
            operation: string;
          }>(
            'SELECT operation FROM cockpit_receipts WHERE id = ?',
            receiptKey(record, body.requestId, actor),
          )
          .toArray()[0];
        if (existing) {
          if (existing.operation !== encodedOperation)
            return response({ error: 'REQUEST_ID_CONFLICT' }, 409);
          receipt = 'committed';
        } else {
          if (body.type === 'commit' && body.protocolVersion !== R4B_PROTOCOL_VERSION)
            return response({ error: 'CLIENT_UPDATE_REQUIRED' }, 409);
          if (body.revision !== record.revision)
            return response({ error: 'REVISION_CONFLICT' }, 409);
          const before = record.table;
          if (body.type === 'control') {
            const multi = record.multiplayer;
            if (!multi || (!cockpitOwnerPresent(multi, now) && actor !== 'P1'))
              return response({ error: 'OWNER_ABSENT' }, 409);
            const control = body.control;
            if (record.table.ended) return response({ error: 'SESSION_ENDED' }, 409);
            const ownSeat = record.table.seats.find((seat) => seat.id === actor)!;
            if (
              ownSeat.eliminated &&
              !(['kick', 'reclaim'].includes(control.type) && actor === 'P1')
            )
              return response({ error: 'NOT_AUTHORIZED' }, 403);
            switch (control.type) {
              case 'start':
                if (
                  actor !== 'P1' ||
                  multi.started ||
                  record.table.seats.some(
                    (seat) =>
                      !multi.members[seat.id] || multi.members[seat.id].kicked || !seat.kept,
                  )
                )
                  return response({ error: 'PREGAME_INCOMPLETE' }, 409);
                multi.started = true;
                record.undo = [];
                record.redo = [];
                break;
              case 'hold':
                multi.holds = multi.holds.filter((id) => id !== actor);
                if (control.held) multi.holds.push(actor);
                break;
              case 'grant':
                if (
                  actor !== multi.masterId ||
                  !multi.holds.includes(control.seatId) ||
                  !multi.members[control.seatId] ||
                  multi.members[control.seatId].kicked ||
                  record.table.seats.find((seat) => seat.id === control.seatId)?.eliminated ||
                  multi.borrowedFrom
                )
                  return response({ error: 'NOT_AUTHORIZED' }, 403);
                multi.members[actor].peek = null;
                multi.members[control.seatId].peek = null;
                multi.borrowedFrom = actor;
                multi.masterId = control.seatId;
                multi.holds = multi.holds.filter((id) => id !== control.seatId);
                break;
              case 'return':
                if (actor !== multi.masterId || !multi.borrowedFrom)
                  return response({ error: 'NOT_AUTHORIZED' }, 403);
                multi.members[actor].peek = null;
                multi.members[multi.borrowedFrom].peek = null;
                multi.masterId = multi.borrowedFrom;
                multi.borrowedFrom = null;
                break;
              case 'reclaim':
                if (actor !== 'P1') return response({ error: 'NOT_AUTHORIZED' }, 403);
                for (const member of Object.values(multi.members)) member.peek = null;
                multi.masterId =
                  record.table.seats.find(
                    (seat) =>
                      !seat.eliminated && multi.members[seat.id] && !multi.members[seat.id].kicked,
                  )?.id ?? 'P1';
                multi.borrowedFrom = null;
                break;
              case 'peek':
                if (
                  actor !== multi.masterId ||
                  !record.table.seats.some((seat) => seat.id === control.seatId) ||
                  !['hand', 'library', null].includes(control.zone)
                )
                  return response({ error: 'NOT_AUTHORIZED' }, 403);
                if (
                  control.count !== undefined &&
                  (control.zone !== 'library' ||
                    !Number.isSafeInteger(control.count) ||
                    control.count < 1 ||
                    control.count > 500)
                )
                  return response({ error: 'INVALID_REQUEST' }, 400);
                if (control.zone) record.knowledgeEpoch = (record.knowledgeEpoch ?? 0) + 1;
                multi.members[actor].peek = control.zone
                  ? {
                      seatId: control.seatId,
                      zone: control.zone,
                      ...(control.zone === 'library' && control.count !== undefined
                        ? { count: control.count }
                        : {}),
                    }
                  : null;
                break;
              case 'kick':
              case 'eliminate':
                if (
                  (control.type === 'kick' ? actor !== 'P1' : actor !== multi.masterId) ||
                  (control.type === 'kick' && control.seatId === 'P1') ||
                  !multi.members[control.seatId]
                )
                  return response({ error: 'NOT_AUTHORIZED' }, 403);
                if (!multi.started && control.type === 'kick') {
                  const seat = record.table.seats.find((seat) => seat.id === control.seatId)!;
                  for (const [id, card] of Object.entries(record.table.cards))
                    if (card.ownerId === seat.id) delete record.table.cards[id];
                  for (const zone of Object.keys(seat.zones) as (keyof typeof seat.zones)[])
                    seat.zones[zone] = [];
                  seat.kept = false;
                  delete multi.members[control.seatId];
                  multi.invitation = crypto.randomUUID() + crypto.randomUUID();
                  multi.holds = multi.holds.filter((id) => id !== seat.id);
                  record.undo = [];
                  record.redo = [];
                  break;
                }
                if (
                  Object.values(record.table.cards).some(
                    (card) =>
                      card.controllerId === control.seatId && card.ownerId !== control.seatId,
                  )
                )
                  return response({ error: 'ELIMINATION_REQUIRES_CONTROL_REVIEW' }, 409);
                if (control.type === 'kick') multi.members[control.seatId].kicked = true;
                if (!record.table.seats.find((seat) => seat.id === control.seatId)?.eliminated)
                  record.table = applyTableOperation(record.table, {
                    type: 'eliminate',
                    seatId: control.seatId,
                  });
                multi.holds = multi.holds.filter((id) => id !== control.seatId);
                if (multi.masterId === control.seatId) {
                  multi.masterId =
                    record.table.seats.find(
                      (seat) => !seat.eliminated && !multi.members[seat.id]?.kicked,
                    )?.id ?? 'P1';
                  multi.borrowedFrom = null;
                }
                if (multi.borrowedFrom === control.seatId) multi.borrowedFrom = null;
                for (const member of Object.values(multi.members)) member.peek = null;
                record.undo = [];
                record.redo = [];
                break;
              default:
                return response({ error: 'INVALID_REQUEST' }, 400);
            }
            for (const [id, member] of Object.entries(multi.members))
              if (id !== multi.masterId) member.peek = null;
          } else {
            const isHistoryOperation =
              body.operation.type === 'undo' || body.operation.type === 'redo';
            let preparedR4b: PreparedR4bCommit | undefined;

            if (!isHistoryOperation) {
              if (!body.context) return response({ error: 'INVALID_REQUEST' }, 400);
              try {
                preparedR4b = prepareR4bCommit(
                  before,
                  record.multiplayer,
                  actor,
                  {
                    protocolVersion: R4B_PROTOCOL_VERSION,
                    operation: body.operation as R4bOperation,
                    context: body.context,
                    ...(body.declaredCause ? { declaredCause: body.declaredCause } : {}),
                  } satisfies R4bCommitEnvelope,
                  body.requestId,
                  now,
                );
              } catch (error) {
                const mapped = r4bFailure(error);
                if (mapped) return mapped;
                throw error;
              }
            } else if (record.multiplayer) {
              const authorized = authorizeCockpitOperation(
                before,
                record.multiplayer,
                actor,
                body.operation as { type: 'undo' } | { type: 'redo' },
                now,
              );
              if (!authorized) return response({ error: 'NOT_AUTHORIZED' }, 403);
            }

            if (body.operation.type === 'undo') {
              ensureKnowledgeHistory(record);
              const previous = record.undo.at(-1);
              const previousEpoch = record.undoKnowledgeEpochs!.at(-1);
              if (
                !previous ||
                (record.multiplayer && previousEpoch !== (record.knowledgeEpoch ?? 0)) ||
                !sameHistoryBoundary(before, previous, Boolean(record.multiplayer))
              )
                return response({ error: 'NO_UNDO' }, 409);
              record.undo.pop();
              record.undoKnowledgeEpochs!.pop();
              pushRedoSnapshot(record, before);
              record.table = previous;
              record.recentActions = appendR4bSemanticAction(
                record.recentActions,
                semanticHistoryAction('undo', actor, record.revision + 1),
              );
            } else if (body.operation.type === 'redo') {
              ensureKnowledgeHistory(record);
              const next = record.redo.at(-1);
              if (!next || !sameHistoryBoundary(before, next, Boolean(record.multiplayer)))
                return response({ error: 'NO_REDO' }, 409);
              record.redo.pop();
              record.redoKnowledgeEpochs!.pop();
              pushUndoSnapshot(record, before);
              record.table = next;
              record.recentActions = appendR4bSemanticAction(
                record.recentActions,
                semanticHistoryAction('redo', actor, record.revision + 1),
              );
            } else {
              const knowledgeEpochBefore = record.knowledgeEpoch ?? 0;
              if (!preparedR4b) return response({ error: 'INVALID_REQUEST' }, 400);
              const crossesKnowledgeBarrier = Boolean(
                record.multiplayer && preparedR4b.crossesKnowledgeBarrier,
              );
              try {
                record.table = applyPreparedR4bCommit(before, preparedR4b, body.requestId);
              } catch (error) {
                const mapped = r4bFailure(error);
                if (mapped) return mapped;
                throw error;
              }
              record.recentActions = appendR4bSemanticAction(
                record.recentActions,
                semanticActionForR4bCommit(before, preparedR4b, actor, record.revision + 1),
              );
              const operation = body.operation;
              if (crossesKnowledgeBarrier)
                record.knowledgeEpoch = knowledgeEpochBefore + 1;
              if (
                operation.type === 'trigger.place' ||
                operation.type === 'trigger.link' ||
                operation.type === 'trigger.dismiss'
              ) {
                const candidateId = operation.candidateId;
                const candidate = record.table.triggers?.candidates.find(
                  (c) => c.pendingTriggerId === candidateId,
                );
                if (candidate) candidate.operatorId = actor;
              }
              if (record.multiplayer && record.table.turn !== before.turn) record.undo = [];
              else {
                if (record.undo.length >= 200) {
                  if (record.multiplayer) return response({ error: 'TURN_HISTORY_LIMIT' }, 409);
                  record.undo.shift();
                  record.undoKnowledgeEpochs?.shift();
                }
                pushUndoSnapshot(record, before, knowledgeEpochBefore);
              }
              record.redo = [];
              record.redoKnowledgeEpochs = [];
            }
          }
          record.revision += 1;
          storage.sql.exec(
            'INSERT INTO cockpit_receipts (id, operation) VALUES (?, ?)',
            receiptKey(record, body.requestId, actor),
            encodedOperation,
          );
          // A receipt created in this transaction is a newly accepted action.
          // Replaying an existing receipt above is recovery, not new activity.
          extendTtl = true;
          receipt = 'committed';
        }
      } else if (
        body.type !== 'read' &&
        body.type !== 'create' &&
        body.type !== 'import' &&
        body.type !== 'join' &&
        body.type !== 'connect'
      )
        return response({ error: 'INVALID_REQUEST' }, 400);
      if (extendTtl && (!record.multiplayer || cockpitOwnerPresent(record.multiplayer, now)))
        record.lastUsed = now;
      const data = JSON.stringify(record);
      // Fail before success; throwing also rolls back any new receipt.
      if (new TextEncoder().encode(data).length > 25_000_000) throw new Error('SESSION_SIZE_LIMIT');
      storage.sql.exec(
        'INSERT INTO cockpit_session (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
        data,
      );
      return response(view(record, receipt, actor, now));
    });
  } catch (error) {
    // No private card text, session credential or raw runtime error escapes.
    if (error instanceof Error && error.message === 'SESSION_SIZE_LIMIT')
      return response({ error: 'SESSION_SIZE_LIMIT' }, 422);
    return response({ error: 'OPERATION_NOT_SAVED' }, 422);
  }
}
