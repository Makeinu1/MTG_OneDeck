import { describe, expect, it } from 'vitest';
import {
  claimOnlineLobbyAdmissionV3,
  closeOnlineLobbyAdmissionV3,
  createOnlineFormingLobbyV1,
  createOnlineLobbyAdmissionV3,
  encodeOnlineSharedInviteCodeV3,
  parseOnlineSharedInviteCodeV3,
  rotateOnlineLobbyAdmissionV3,
  validateOnlineLobbyAdmissionV3,
} from '../index';

const ROOM = 'room-o4p08a-shared-review';
const HOST = 'participant-o4p08a-host';
const SEATS = [
  `seat_${'a'.repeat(40)}`,
  `seat_${'b'.repeat(40)}`,
  `seat_${'c'.repeat(40)}`,
  `seat_${'d'.repeat(40)}`,
] as const;
const HIDDEN_INVITES = [
  `invite_${'e'.repeat(40)}`,
  `invite_${'f'.repeat(40)}`,
  `invite_${'g'.repeat(40)}`,
] as const;
const SHARED = `admission_${'h'.repeat(40)}`;

function lobby() {
  return createOnlineFormingLobbyV1({
    roomId: ROOM,
    serverBuildId: 'build-o4p08a-shared-review',
    hostParticipantId: HOST,
    seatCapabilities: SEATS,
    inviteCapabilities: HIDDEN_INVITES,
  });
}

describe('O4P-08A Judge: shared admission model', () => {
  it('round-trips one canonical invite code and rejects alternate encodings', () => {
    const code = encodeOnlineSharedInviteCodeV3(ROOM, SHARED);
    expect(code).toMatch(/^v3\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{32,128}$/);
    expect(parseOnlineSharedInviteCodeV3(code)).toEqual({
      roomId: ROOM,
      admissionCapability: SHARED,
    });

    const encodedRoom = code.split('.')[1];
    expect(parseOnlineSharedInviteCodeV3(`${code}=`)).toBeNull();
    expect(parseOnlineSharedInviteCodeV3(`v3.${encodedRoom}=.${SHARED}`)).toBeNull();
    expect(parseOnlineSharedInviteCodeV3(`${code}.extra`)).toBeNull();
    expect(parseOnlineSharedInviteCodeV3(`v2.${encodedRoom}.${SHARED}`)).toBeNull();
    expect(parseOnlineSharedInviteCodeV3(`v3.${encodedRoom}.short`)).toBeNull();
  });

  it('fills the lowest empty seats without consuming the shared admission', () => {
    let forming = lobby();
    const admission = createOnlineLobbyAdmissionV3({
      roomId: ROOM,
      currentCapability: SHARED,
    });
    expect(validateOnlineLobbyAdmissionV3(admission)).toEqual({ ok: true, value: admission });

    for (let index = 1; index < 4; index += 1) {
      const result = claimOnlineLobbyAdmissionV3(forming, admission, {
        participantId: `participant-o4p08a-${index}`,
        admissionCapability: SHARED,
      });
      expect(result.seatCapability).toBe(SEATS[index]);
      expect(result.lobby.seats[index]?.participantId).toBe(`participant-o4p08a-${index}`);
      expect(result.admission).toEqual(admission);
      forming = result.lobby;
    }
    expect(() => claimOnlineLobbyAdmissionV3(forming, admission, {
      participantId: 'participant-o4p08a-full',
      admissionCapability: SHARED,
    })).toThrow(/ROOM_FULL/);
    expect(JSON.stringify(forming)).not.toContain(SHARED);
  });

  it('distinguishes rotated, closed, and unknown admission without leaking secrets', () => {
    const initial = createOnlineLobbyAdmissionV3({ roomId: ROOM, currentCapability: SHARED });
    const nextCapability = `admission_${'i'.repeat(40)}`;
    const rotated = rotateOnlineLobbyAdmissionV3(lobby(), initial, {
      hostParticipantId: HOST,
      seatCapability: SEATS[0],
      nextCapability,
    });
    expect(rotated).toMatchObject({ generation: 2, currentCapability: nextCapability, open: true });
    expect(rotated.retiredCapabilities).toEqual([SHARED]);
    expect(() => claimOnlineLobbyAdmissionV3(lobby(), rotated, {
      participantId: 'participant-old-code', admissionCapability: SHARED,
    })).toThrow(/INVITE_ROTATED/);
    expect(() => claimOnlineLobbyAdmissionV3(lobby(), rotated, {
      participantId: 'participant-unknown-code', admissionCapability: `admission_${'z'.repeat(40)}`,
    })).toThrow(/INVITE_INVALID/);

    const closed = closeOnlineLobbyAdmissionV3(lobby(), rotated, {
      hostParticipantId: HOST,
      seatCapability: SEATS[0],
    });
    expect(closed.open).toBe(false);
    expect(() => claimOnlineLobbyAdmissionV3(lobby(), closed, {
      participantId: 'participant-closed', admissionCapability: nextCapability,
    })).toThrow(/ADMISSION_CLOSED/);
    expect(JSON.stringify(validateOnlineLobbyAdmissionV3(closed))).not.toContain(SEATS[0]);
  });

  it('fails closed on getters, surplus fields, invalid generations, and oversized retirement', () => {
    let reads = 0;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, 'kind', { enumerable: true, get: () => { reads += 1; return 'online-lobby-admission-v3'; } });
    for (const [key, value] of Object.entries({
      schemaVersion: 3, roomId: ROOM, currentCapability: SHARED,
      generation: 1, open: true, retiredCapabilities: [],
    })) Object.defineProperty(hostile, key, { enumerable: true, value });
    expect(validateOnlineLobbyAdmissionV3(hostile).ok).toBe(false);
    expect(reads).toBe(0);
    expect(validateOnlineLobbyAdmissionV3({ ...createOnlineLobbyAdmissionV3({ roomId: ROOM, currentCapability: SHARED }), extra: true }).ok).toBe(false);
    expect(validateOnlineLobbyAdmissionV3({ ...createOnlineLobbyAdmissionV3({ roomId: ROOM, currentCapability: SHARED }), generation: 0 }).ok).toBe(false);
    expect(validateOnlineLobbyAdmissionV3({ ...createOnlineLobbyAdmissionV3({ roomId: ROOM, currentCapability: SHARED }), retiredCapabilities: Array(5).fill(`admission_${'r'.repeat(40)}`) }).ok).toBe(false);
  });
});
