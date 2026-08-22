import { describe, expect, it } from 'vitest';
import { validatePublicOnlineProjectionV2 } from './v2';

function projection(): Record<string, unknown> {
  return {
    kind: 'online-forming-lobby-projection-v2',
    schemaVersion: 2,
    lifecycle: 'forming',
    roomId: 'room-v2',
    serverBuildId: 'build-v2',
    hostParticipantId: 'player-1',
    seats: [0, 1, 2, 3].map((index) => ({
      seatIndex: index,
      corePlayerId: `P${index + 1}`,
      participantId: index === 0 ? 'player-1' : null,
      deckState: 'none',
      ready: false,
    })),
  };
}

describe('public online v2 client boundary', () => {
  it('accepts the closed projection while allowing duplicate deck identities implicitly', () => {
    expect(validatePublicOnlineProjectionV2(projection()).ok).toBe(true);
  });

  it('rejects legacy deck fields, sparse seats, and ready before acceptance', () => {
    expect(
      validatePublicOnlineProjectionV2({
        ...projection(),
        seats: (projection().seats as unknown[]).map((seat, index) =>
          index === 0 ? { ...(seat as Record<string, unknown>), deckId: 'secret' } : seat,
        ),
      }).ok,
    ).toBe(false);
    const sparse = projection();
    const seats = new Array(4) as unknown[];
    seats.length = 4;
    sparse.seats = seats;
    expect(validatePublicOnlineProjectionV2(sparse).ok).toBe(false);
    expect(
      validatePublicOnlineProjectionV2({
        ...projection(),
        seats: (projection().seats as unknown[]).map((seat, index) =>
          index === 0
            ? { ...(seat as Record<string, unknown>), deckState: 'resolving', ready: true }
            : seat,
        ),
      }).ok,
    ).toBe(false);
  });
});
