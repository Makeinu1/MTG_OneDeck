import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPublicOnlineRecoveryStoreV1,
  parsePublicOnlineErrorV3,
  publicOnlineErrorMessageV3,
  readAndScrubPublicOnlineInviteFragmentV3,
} from './recoveryV1';
import { createPublicOnlineControllerV2 } from './v2';

const RECORD = {
  kind: 'public-online-recovery-v1' as const,
  schemaVersion: 1 as const,
  roomId: 'room-o4p08a-browser-review',
  participantId: 'participant-o4p08a-browser-review',
  seatCapability: `seat_${'s'.repeat(40)}`,
  isHost: false,
  tableParticipantId: null,
  tableCapability: null,
};

class MemoryStorage {
  value: string | null = null;
  getItem(key: string): string | null { expect(key).toBe('mtg-onedeck:online-recovery-v1'); return this.value; }
  setItem(key: string, value: string): void { expect(key).toBe('mtg-onedeck:online-recovery-v1'); this.value = value; }
  removeItem(key: string): void { expect(key).toBe('mtg-onedeck:online-recovery-v1'); this.value = null; }
}

function projection(participantId: string | null, hostParticipantId = 'participant-o4p08a-browser-host', roomId = RECORD.roomId) {
  return {
    kind: 'online-forming-lobby-projection-v2' as const,
    schemaVersion: 2 as const,
    lifecycle: 'forming' as const,
    roomId,
    serverBuildId: 'build-o4p08a-browser-review',
    hostParticipantId,
    seats: [
      { seatIndex: 0 as const, corePlayerId: 'P1' as const, participantId: hostParticipantId, deckState: 'none' as const, ready: false },
      { seatIndex: 1 as const, corePlayerId: 'P2' as const, participantId, deckState: 'none' as const, ready: false },
      { seatIndex: 2 as const, corePlayerId: 'P3' as const, participantId: null, deckState: 'none' as const, ready: false },
      { seatIndex: 3 as const, corePlayerId: 'P4' as const, participantId: null, deckState: 'none' as const, ready: false },
    ],
  };
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('O4P-08A Judge: recovery, fragment, and structured client errors', () => {
  it('round-trips canonical recovery and clears hostile or invalid storage', () => {
    const storage = new MemoryStorage();
    const store = createPublicOnlineRecoveryStoreV1(storage);
    expect(store.load()).toBeNull();
    expect(store.save(RECORD)).toBe(true);
    expect(storage.value).toBe(JSON.stringify(RECORD));
    expect(store.load()).toEqual(RECORD);
    store.clear();
    expect(storage.value).toBeNull();

    storage.value = JSON.stringify({ ...RECORD, extra: `seat_${'x'.repeat(40)}` });
    expect(store.load()).toBeNull();
    expect(storage.value).toBeNull();
    storage.value = '{';
    expect(store.load()).toBeNull();
    expect(storage.value).toBeNull();
    storage.value = 'x'.repeat(4_097);
    expect(store.load()).toBeNull();
    expect(storage.value).toBeNull();
  });

  it('is exception-safe when private storage is unavailable', () => {
    const unavailable = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('quota'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    const store = createPublicOnlineRecoveryStoreV1(unavailable);
    expect(store.load()).toBeNull();
    expect(store.save(RECORD)).toBe(false);
    expect(() => store.clear()).not.toThrow();
  });

  it('scrubs the invite fragment before returning it to the caller', () => {
    const code = `v3.cm9vbS1vNHAwOGEtYnJvd3Nlci1yZXZpZXc.admission_${'a'.repeat(40)}`;
    const calls: Array<readonly [unknown, string, string]> = [];
    const result = readAndScrubPublicOnlineInviteFragmentV3(
      { href: `https://makeinu1.github.io/MTG_OneDeck/#online-invite=${encodeURIComponent(code)}`, hash: `#online-invite=${encodeURIComponent(code)}` },
      { state: { safe: true }, replaceState: (state: unknown, title: string, url: string) => { calls.push([state, title, url]); } },
    );
    expect(calls).toEqual([[{ safe: true }, '', '/MTG_OneDeck/']]);
    expect(result).toEqual({ roomId: 'room-o4p08a-browser-review', admissionCapability: `admission_${'a'.repeat(40)}` });
    expect(JSON.stringify(calls)).not.toContain('admission_');
    expect(readAndScrubPublicOnlineInviteFragmentV3(
      { href: `https://makeinu1.github.io/MTG_OneDeck/#online-invite=${encodeURIComponent(code)}`, hash: `#online-invite=${encodeURIComponent(code)}` },
      { state: null, replaceState: () => { throw new Error('blocked'); } },
    )).toBeNull();
  });

  it.each([
    ['ROOM_NOT_FOUND', false, '部屋が見つかりません。招待を確認してください。'],
    ['INVITE_ROTATED', false, '招待が更新されています。ホストから新しい招待を受け取ってください。'],
    ['ROOM_FULL', false, '部屋は満席です。空席ができてから参加してください。'],
    ['PARTICIPANT_RECOVERABLE', true, 'このブラウザには復帰できる参加情報があります。「対戦に戻る」を選んでください。'],
    ['CREDENTIAL_KICKED', false, 'ホストによりロビーから退出しました。再参加するには現在の招待が必要です。'],
    ['HOST_REQUIRED', false, 'この操作はホストだけが行えます。'],
    ['PLAYERS_NOT_READY', true, '準備が完了していない参加者がいます。ロビーの状態を確認してください。'],
    ['SERVICE_UNAVAILABLE', true, 'サーバーに接続できません。しばらく待って再試行してください。'],
  ] as const)('maps %s to a cause and next action', (code, retryable, message) => {
    const parsed = parsePublicOnlineErrorV3({
      kind: 'online-public-error-v3', schemaVersion: 3, code, retryable,
      correlationId: 'correlation-o4p08a-review',
    });
    expect(parsed).not.toBeNull();
    expect(publicOnlineErrorMessageV3(parsed!)).toEqual({ code, retryable, message, correlationId: 'correlation-o4p08a-review' });
  });

  it('rejects surplus, unknown, secret-bearing, or contradictory error envelopes', () => {
    const base = { kind: 'online-public-error-v3', schemaVersion: 3, code: 'ROOM_FULL', retryable: false, correlationId: 'correlation-safe' };
    expect(parsePublicOnlineErrorV3({ ...base, extra: true })).toBeNull();
    expect(parsePublicOnlineErrorV3({ ...base, code: 'SECRET_FAILURE' })).toBeNull();
    expect(parsePublicOnlineErrorV3({ ...base, correlationId: `seat_${'x'.repeat(40)}` })).toBeNull();
    expect(parsePublicOnlineErrorV3({ ...base, retryable: true })).toBeNull();
  });

  it('recovers an exact echoed seat and clears storage only after a verified non-host leave', async () => {
    localStorage.setItem('mtg-onedeck:online-recovery-v1', JSON.stringify(RECORD));
    const calls: string[] = [];
    const fetcher: typeof fetch = (_input, init) => {
      if (typeof init?.body !== 'string') throw new Error('missing body');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      const kind = typeof body.kind === 'string' ? body.kind : '';
      calls.push(kind);
      if (kind === 'online-forming-lobby-recover-v3') return Promise.resolve(new Response(JSON.stringify({
        kind: 'online-forming-lobby-recovered-v3', schemaVersion: 3,
        roomId: RECORD.roomId, participantId: RECORD.participantId,
        seatCapability: RECORD.seatCapability, projection: projection(RECORD.participantId),
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
      if (kind === 'online-forming-lobby-leave-v3') return Promise.resolve(new Response(JSON.stringify({
        kind: 'online-forming-lobby-left-v3', schemaVersion: 3,
        roomId: RECORD.roomId, projection: projection(null),
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
      throw new Error(`unexpected request: ${kind}`);
    };
    vi.stubGlobal('fetch', fetcher);
    const controller = createPublicOnlineControllerV2();
    await controller.recover();
    expect(controller.getSnapshot()).toMatchObject({ roomId: RECORD.roomId, ownSeatIndex: 1, isHost: false });
    expect(localStorage.getItem('mtg-onedeck:online-recovery-v1')).not.toBeNull();
    await controller.leave();
    expect(controller.getSnapshot()).toMatchObject({ mode: 'entry', roomId: null });
    expect(localStorage.getItem('mtg-onedeck:online-recovery-v1')).toBeNull();
    expect(calls).toEqual(['online-forming-lobby-recover-v3', 'online-forming-lobby-leave-v3']);
  });

  it('does not adopt or clear recovery from a surplus success envelope', async () => {
    localStorage.setItem('mtg-onedeck:online-recovery-v1', JSON.stringify(RECORD));
    const fetcher: typeof fetch = () => Promise.resolve(new Response(JSON.stringify({
      kind: 'online-forming-lobby-recovered-v3', schemaVersion: 3,
      roomId: RECORD.roomId, participantId: RECORD.participantId,
      seatCapability: RECORD.seatCapability, projection: projection(RECORD.participantId),
      leaked: `seat_${'x'.repeat(40)}`,
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);
    const controller = createPublicOnlineControllerV2();
    await controller.recover();
    expect(controller.getSnapshot().roomId).toBeNull();
    expect(localStorage.getItem('mtg-onedeck:online-recovery-v1')).toBe(JSON.stringify(RECORD));
    controller.disconnect();
  });

  it('saves recovery only after authoritative shared create and claim success', async () => {
    const hostSeat = `seat_${'h'.repeat(40)}`;
    const guestSeat = `seat_${'g'.repeat(40)}`;
    const admission = `admission_${'a'.repeat(40)}`;
    const tableCapability = `observer_${'t'.repeat(40)}`;
    const inviteCode = `v3.${btoa('room-shared-client').replaceAll('=', '')}.${admission}`;
    const fetcher: typeof fetch = (_input, init) => {
      if (typeof init?.body !== 'string') throw new Error('missing body');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      const participantId = String(body.participantId);
      if (body.kind === 'online-forming-lobby-create-v3') return Promise.resolve(new Response(JSON.stringify({
        kind: 'online-forming-lobby-created-v3', schemaVersion: 3, roomId: 'room-shared-client', participantId,
        seatCapability: hostSeat, inviteCode, tableParticipantId: 'table-shared-client', tableCapability,
        projection: projection(null, participantId, 'room-shared-client'),
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
      if (body.kind === 'online-forming-lobby-shared-claim-v3') return Promise.resolve(new Response(JSON.stringify({
        kind: 'online-forming-lobby-shared-claimed-v3', schemaVersion: 3, roomId: 'room-shared-client', participantId,
        seatCapability: guestSeat, projection: projection(participantId, 'participant-shared-host', 'room-shared-client'),
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
      throw new Error('unexpected request');
    };
    vi.stubGlobal('fetch', fetcher);
    const host = createPublicOnlineControllerV2();
    await host.createShared();
    const hostRecord = JSON.parse(String(localStorage.getItem('mtg-onedeck:online-recovery-v1'))) as Record<string, unknown>;
    expect(hostRecord).toMatchObject({ roomId: 'room-shared-client', seatCapability: hostSeat, isHost: true, tableCapability });
    host.disconnect();
    localStorage.clear();
    const guest = createPublicOnlineControllerV2();
    await guest.joinShared(inviteCode);
    const guestRecord = JSON.parse(String(localStorage.getItem('mtg-onedeck:online-recovery-v1'))) as Record<string, unknown>;
    expect(guestRecord).toMatchObject({ roomId: 'room-shared-client', seatCapability: guestSeat, isHost: false, tableCapability: null });
    guest.disconnect();
  });

  it('clears terminal leave authority and displays a structured start blocker', async () => {
    const hostRecord = { ...RECORD, participantId: 'participant-structured-host', seatCapability: `seat_${'q'.repeat(40)}`, isHost: true, tableParticipantId: 'table-structured-host', tableCapability: `observer_${'w'.repeat(40)}` };
    localStorage.setItem('mtg-onedeck:online-recovery-v1', JSON.stringify(hostRecord));
    const admission = `admission_${'e'.repeat(40)}`;
    const inviteCode = `v3.${btoa(RECORD.roomId).replaceAll('=', '')}.${admission}`;
    const readyProjection = { ...projection(null, hostRecord.participantId), lifecycle: 'ready' as const, seats: projection(null, hostRecord.participantId).seats.map((seat, index) => ({ ...seat, participantId: index === 0 ? hostRecord.participantId : `participant-ready-${index}`, deckState: 'accepted' as const, ready: true })) };
    let startRejected = false;
    const fetcher: typeof fetch = (_input, init) => {
      if (typeof init?.body !== 'string') throw new Error('missing body');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      if (body.kind === 'online-forming-lobby-recover-v3') return Promise.resolve(new Response(JSON.stringify({ kind: 'online-forming-lobby-recovered-v3', schemaVersion: 3, roomId: RECORD.roomId, participantId: hostRecord.participantId, seatCapability: hostRecord.seatCapability, admissionOpen: true, inviteCode, tableParticipantId: hostRecord.tableParticipantId, tableCapability: hostRecord.tableCapability, projection: readyProjection }), { status: 200, headers: { 'content-type': 'application/json' } }));
      if (body.kind === 'online-forming-lobby-start-with-table-v2') { startRejected = true; return Promise.resolve(new Response(JSON.stringify({ kind: 'online-public-error-v3', schemaVersion: 3, code: 'PLAYERS_NOT_READY', retryable: true, correlationId: 'correlation-start-review' }), { status: 409, headers: { 'content-type': 'application/json' } })); }
      if (body.kind === 'online-forming-lobby-leave-v3') return Promise.resolve(new Response(JSON.stringify({ kind: 'online-public-error-v3', schemaVersion: 3, code: 'ROOM_EXPIRED', retryable: false, correlationId: 'correlation-leave-review' }), { status: 410, headers: { 'content-type': 'application/json' } }));
      throw new Error('unexpected request');
    };
    vi.stubGlobal('fetch', fetcher);
    const controller = createPublicOnlineControllerV2();
    await controller.recover();
    await controller.start();
    expect(startRejected).toBe(true);
    expect(controller.getSnapshot().error).toBe('準備が完了していない参加者がいます。ロビーの状態を確認してください。');
    await controller.leave();
    expect(localStorage.getItem('mtg-onedeck:online-recovery-v1')).toBeNull();
    controller.disconnect();
  });
});
