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
import { migrateCockpitSnapshot } from '../../engine/cockpitMigration';
import type { GameSnapshot } from '../../data/gameSnapshot';
import {
  applyTableOperation,
  createCockpitTable,
  type CockpitTable,
  type TableOperation,
} from '../../engine/cockpitTable';
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
}
export interface CockpitSessionView {
  multiplayer?: CockpitMultiplayerView;
  table: CockpitTable;
  revision: number;
  expiresAt: number;
  canUndo: boolean;
  canRedo: boolean;
  receipt: 'committed' | 'unseen' | null;
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
      operation: TableOperation | { type: 'undo' } | { type: 'redo' };
    }
) & { connectionId?: string };

const response = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
function sameHistoryBoundary(current: CockpitTable, candidate: CockpitTable | undefined): boolean {
  return Boolean(
    candidate &&
    !current.ended &&
    candidate.turn === current.turn &&
    candidate.ended === current.ended &&
    current.seats.every(
      (seat) =>
        candidate.seats.find((other) => other.id === seat.id)?.eliminated === seat.eliminated,
    ),
  );
}
function view(
  record: SessionRecord,
  receipt: CockpitSessionView['receipt'],
  actor = 'P1',
  now = record.lastUsed,
): CockpitSessionView {
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
      sameHistoryBoundary(record.table, record.undo.at(-1)),
    canRedo: !record.multiplayer && sameHistoryBoundary(record.table, record.redo.at(-1)),
    receipt,
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
  for (const table of [record.table, ...record.undo, ...record.redo]) backfillTable(table);
  return record;
}
function backfillTable(table: CockpitTable): void {
  table.modifiers ??= [];
  table.linkedExiles ??= [];
  table.visibility ??= {};
  table.combat ??= null;
  table.hold ??= false;
  for (const seat of table.seats) {
    seat.commanderDamage ??= {};
    if (seat.maximumHandSize === undefined) seat.maximumHandSize = 7;
  }
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
        backfillTable(table);
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
          body.type === 'commit' ? body.operation : body.control,
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
                multi.borrowedFrom = actor;
                multi.masterId = control.seatId;
                multi.holds = multi.holds.filter((id) => id !== control.seatId);
                break;
              case 'return':
                if (actor !== multi.masterId || !multi.borrowedFrom)
                  return response({ error: 'NOT_AUTHORIZED' }, 403);
                multi.masterId = multi.borrowedFrom;
                multi.borrowedFrom = null;
                break;
              case 'reclaim':
                if (actor !== 'P1') return response({ error: 'NOT_AUTHORIZED' }, 403);
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
                multi.members[actor].peek = control.zone
                  ? { seatId: control.seatId, zone: control.zone }
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
                record.undo = [];
                record.redo = [];
                break;
              default:
                return response({ error: 'INVALID_REQUEST' }, 400);
            }
            for (const [id, member] of Object.entries(multi.members))
              if (id !== multi.masterId) member.peek = null;
          } else {
            if (
              record.multiplayer &&
              (!authorizeCockpitOperation(before, record.multiplayer, actor, body.operation, now) ||
                body.operation.type === 'eliminate')
            )
              return response({ error: 'NOT_AUTHORIZED' }, 403);
            if (body.operation.type === 'undo') {
              const previous = record.undo.pop();
              if (!previous || !sameHistoryBoundary(before, previous))
                return response({ error: 'NO_UNDO' }, 409);
              record.redo.push(before);
              record.table = previous;
            } else if (body.operation.type === 'redo') {
              const next = record.redo.pop();
              if (!next || !sameHistoryBoundary(before, next))
                return response({ error: 'NO_REDO' }, 409);
              record.undo.push(before);
              record.table = next;
            } else {
              record.table = applyTableOperation(before, body.operation);
              if (body.operation.type === 'turn') record.undo = [];
              else {
                if (record.undo.length >= 200)
                  return response({ error: 'TURN_HISTORY_LIMIT' }, 409);
                record.undo.push(before);
              }
              record.redo = [];
            }
          }
          record.revision += 1;
          storage.sql.exec(
            'INSERT INTO cockpit_receipts (id, operation) VALUES (?, ?)',
            receiptKey(record, body.requestId, actor),
            encodedOperation,
          );
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
      if (!record.multiplayer || cockpitOwnerPresent(record.multiplayer, now))
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
