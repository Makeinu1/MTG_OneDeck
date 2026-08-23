import { describe, expect, it } from 'vitest';
import worker from '../worker';

describe('O4P-08C public create v5', () => {
  it.each([[2, 20], [2, 40], [4, 40]] as const)('creates an exact %i/%i variable lobby without unused seat credentials', async (playerCount, startingLife) => {
    let forwarded: Request | null = null;
    const binding = { getByName: () => ({ fetch: (request: Request) => { forwarded = request; return Promise.resolve(new Response(JSON.stringify({ kind: 'online-forming-lobby-created-v4', schemaVersion: 4 }), { status: 200, headers: { 'content-type': 'application/json' } })); } }) };
    const response = await worker.fetch(new Request('https://worker.test/api/online/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online-forming-lobby-create-v5', schemaVersion: 5, participantId: 'host-v5', playerCount, startingLife }) }), { ONLINE_ROOMS: binding });
    expect(response.status).toBe(200);
    const value = await response.json() as Record<string, unknown>;
    expect(value.kind).toBe('online-forming-lobby-created-v5');
    expect(value.playerCount).toBe(playerCount);
    expect(value.startingLife).toBe(startingLife);
    expect(typeof value.inviteCode).toBe('string');
    const projection = value.projection as Record<string, unknown>;
    expect(JSON.stringify(projection)).not.toContain('seat_');
    expect(forwarded).not.toBeNull();
    const initializer = JSON.parse(await (forwarded as unknown as Request).text()) as Record<string, unknown>;
    expect(initializer.kind).toBe('online-forming-lobby-initialize-v4');
    expect(initializer.schemaVersion).toBe(4);
  });

  it('rejects unsupported configurations and extra fields', async () => {
    const binding = { getByName: () => ({ fetch: () => Promise.resolve(new Response(null, { status: 200 })) }) };
    for (const body of [
      { kind: 'online-forming-lobby-create-v5', schemaVersion: 5, participantId: 'host-v5', playerCount: 4, startingLife: 20 },
      { kind: 'online-forming-lobby-create-v5', schemaVersion: 5, participantId: 'host-v5', playerCount: 3, startingLife: 20 },
      { kind: 'online-forming-lobby-create-v5', schemaVersion: 5, participantId: 'host-v5', playerCount: 2, startingLife: 20, extra: true },
    ]) {
      expect((await worker.fetch(new Request('https://worker.test/api/online/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { ONLINE_ROOMS: binding })).status).toBe(400);
    }
  });
});
