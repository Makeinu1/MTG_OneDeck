import { describe, expect, it } from 'vitest';
import { createCoreCommandV1 } from '../../../engine/core/index';
import { CAPABILITIES, PARTICIPANTS } from '../../room/__tests__/testHelpers';
import type { OnlineCommandEnvelopeV1 } from '../../protocol/index';
import {
  createOnlineCloudflareOutboxV1,
  enqueueOnlineCloudflareOutboxV1,
  replayOnlineCloudflareOutboxV1,
  settleOnlineCloudflareOutboxV1,
} from '../index';

function envelope(commandId: string, sequence: number): OnlineCommandEnvelopeV1 {
  return {
    kind: 'online-command-envelope-v1',
    protocolVersion: 1,
    roomId: 'room-02b' as never,
    participantId: PARTICIPANTS[0] as never,
    participantCapability: CAPABILITIES[0] as never,
    commandId: commandId as never,
    baseRevision: sequence - 1,
    command: createCoreCommandV1({
      schemaVersion: 1,
      sequence,
      actorPlayerId: 'P1' as never,
      decisionMakerPlayerId: 'P1' as never,
      decisionContext: { kind: 'decision', decisionKey: `outbox-${commandId}` },
      payload: { kind: 'commander-cast-record', physicalCardId: 'PC1' as never, origin: 'command-zone', accepted: true },
    }),
  };
}

describe('O4P-03B immutable client outbox', () => {
  it('keeps insertion order, idempotently enqueues byte-equivalent replay, rejects reuse, and settles exact responses', () => {
    const first = envelope('outbox-command-1', 1);
    const second = envelope('outbox-command-2', 2);
    const initial = createOnlineCloudflareOutboxV1('room-02b', PARTICIPANTS[0]);
    const queued = enqueueOnlineCloudflareOutboxV1(enqueueOnlineCloudflareOutboxV1(initial, first), second);
    expect(initial.entries).toEqual([]);
    expect(queued.entries.map((entry) => entry.commandId)).toEqual(['outbox-command-1', 'outbox-command-2']);
    expect(enqueueOnlineCloudflareOutboxV1(queued, JSON.parse(JSON.stringify(first)))).toBe(queued);
    expect(() => enqueueOnlineCloudflareOutboxV1(queued, { ...first, command: { ...first.command, sequence: 99 } })).toThrow();
    const replay = replayOnlineCloudflareOutboxV1(queued);
    expect(replay).not.toBe(queued.entries);
    expect(replay.map((entry) => JSON.stringify(entry))).toEqual(queued.entries.map((entry) => JSON.stringify(entry)));

    const unknown = { kind: 'online-command-ack-v1', roomId: 'other', participantId: PARTICIPANTS[0], commandId: first.commandId, duplicate: false } as never;
    expect(settleOnlineCloudflareOutboxV1(queued, unknown)).toBe(queued);
    const reject = {
      kind: 'online-command-reject-v1',
      protocolVersion: 1,
      roomId: 'room-02b',
      participantId: PARTICIPANTS[0],
      commandId: first.commandId,
      baseRevision: 0,
      currentRevision: 0,
      duplicate: false,
      resyncRequired: true,
      issues: [{ code: 'INVALID_TYPE', path: '/command', message: 'Invalid command' }],
    };
    const settled = settleOnlineCloudflareOutboxV1(queued, reject);
    expect(settled.entries.map((entry) => entry.commandId)).toEqual(['outbox-command-2']);
    expect(queued.entries.map((entry) => entry.commandId)).toEqual(['outbox-command-1', 'outbox-command-2']);

    expect(settleOnlineCloudflareOutboxV1(queued, { ...reject, extra: true })).toBe(queued);
    expect(settleOnlineCloudflareOutboxV1(queued, { ...reject, issues: [{ code: 'INVALID_TYPE' }] })).toBe(queued);
    expect(settleOnlineCloudflareOutboxV1(queued, { kind: 'online-command-ack-v1', roomId: 'room-02b', participantId: PARTICIPANTS[0], commandId: first.commandId })).toBe(queued);
    const accessorResponse = Object.create(Object.prototype) as Record<string, unknown>;
    Object.defineProperty(accessorResponse, 'kind', { get: () => 'online-command-reject-v1' });
    expect(settleOnlineCloudflareOutboxV1(queued, accessorResponse)).toBe(queued);
  });
});
