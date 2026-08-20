import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  bootstrapFourDeckGenesisV1,
  evaluateO4P06ASizeGateV1,
  type FourDeckBootstrapInputV1,
} from '../index';
import { deserializeOnlineCloudflareProtocolStateV1 } from '../../cloudflare/codec';
import type { OnlineProtocolStateV1 } from '../../protocol/index';

function input(): FourDeckBootstrapInputV1 {
  const decks = ['Celes', 'Gogo', 'Kefka', 'Muldrotha'] as const;
  return {
    roomId: 'o4p06a-room',
    serverBuildId: 'o4p06a-build',
    seats: decks.map((deck, seatIndex) => ({
      seatIndex,
      corePlayerId: `P${seatIndex + 1}`,
      participantId: seatIndex === 0 ? 'host' : `player-${seatIndex + 1}`,
      seatCapability: `seat_capability_${String.fromCharCode(65 + seatIndex).repeat(16)}`,
      deckId: `deck-${deck.toLowerCase()}`,
      deckText: readFileSync(`Mydeck/${deck}.txt`, 'utf8'),
    })),
  };
}

describe('O4P-06A four-real-deck bootstrap', () => {
  it('constructs a deterministic active revision-zero genesis and replay', () => {
    const original = input();
    const before = JSON.stringify(original);
    const first = bootstrapFourDeckGenesisV1(original);
    const second = bootstrapFourDeckGenesisV1(input());
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.coreCanonical).toBe(second.coreCanonical);
    expect(first.coreDigest).toBe(second.coreDigest);
    expect(first.protocolState.revision).toBe(0);
    expect(JSON.stringify(original)).toBe(before);
    expect(first.room.lifecycle).toBe('active');
    expect(first.replay.ok).toBe(true);
    if (first.replay.ok) expect(first.replay.events).toHaveLength(0);
    expect(first.coreRoot.ruleAuthority.turnPriorityBundle.lifecycle).toMatchObject({
      turnNumber: 1,
      positionSequence: 0,
      position: { phase: 'beginning', step: 'untap' },
      window: { kind: 'turn-based-action-required', action: 'untap-step-actions', playerId: 'P1' },
    });
    expect(first.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.zones.shared.command).toHaveLength(4);
    expect(first.coreRoot.playerLifecycle.players.map((player) => player.playerId)).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(first.coreRoot.commanders.map((commander) => commander.ownerPlayerId)).toEqual(['P1', 'P2', 'P3', 'P4']);
    const registry = first.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
    expect(Object.keys(registry.physicalCards).filter((id) => id.startsWith('P1-'))).toHaveLength(100);
    expect(Object.keys(registry.physicalCards).filter((id) => id.startsWith('P2-'))).toHaveLength(100);
    expect(Object.keys(registry.physicalCards).filter((id) => id.startsWith('P3-'))).toHaveLength(104);
    expect(Object.keys(registry.physicalCards).filter((id) => id.startsWith('P4-'))).toHaveLength(100);
    const zones = registry.zones.byPlayer as Record<string, { readonly library: readonly string[] }>;
    expect(zones.P1?.library).toHaveLength(99);
    expect(zones.P2?.library).toHaveLength(99);
    expect(zones.P3?.library).toHaveLength(103);
    expect(zones.P4?.library).toHaveLength(99);
    expect(first.measurements.map((measurement) => measurement.id)).toEqual(['canonical-core-root', 'online-protocol-state', 'cloudflare-initialize-envelope']);
    expect(first.measurements.every((measurement) => measurement.withinLimit)).toBe(true);
    expect(evaluateO4P06ASizeGateV1.length).toBe(2);
    expect(first.sizeEvidence.artifacts[2]?.bytes).toBe(new TextEncoder().encode(JSON.stringify({
      kind: 'online-cloudflare-room-initialize-v1',
      schemaVersion: 1,
      state: first.protocolState,
    })).length);
    const legacyCall = evaluateO4P06ASizeGateV1 as unknown as (root: string, state: OnlineProtocolStateV1, ignoredEnvelope: string) => ReturnType<typeof evaluateO4P06ASizeGateV1>;
    const legacyResult = legacyCall(first.coreCanonical, first.protocolState, '{}');
    expect(legacyResult.ok).toBe(true);
    if (legacyResult.ok) expect(legacyResult.serialized.initializeEnvelope).not.toBe('{}');
    expect(deserializeOnlineCloudflareProtocolStateV1(JSON.stringify(first.protocolState))).toEqual(first.protocolState);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.coreRoot)).toBe(true);
    expect(Object.isFrozen(first.protocolState)).toBe(true);
  }, 60000);

  it('fails closed for an unknown card without exposing partial state', () => {
    const broken = input();
    const seats = broken.seats.slice();
    seats[0] = { ...seats[0], deckText: `${seats[0]?.deckText ?? ''}\n1 Not A Real Card\n` };
    const result = bootstrapFourDeckGenesisV1({ ...broken, seats });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result).not.toHaveProperty('coreRoot');
  });

  it('returns sorted complete deterministic issues for structural failures', () => {
    const broken = input();
    const seats = broken.seats.slice();
    seats[0] = { ...seats[0], seatCapability: 'bad', deckText: 'Commander\n2 Celes, Rune Knight\nDeck\n0 Missing\n' };
    seats[1] = { ...seats[1], deckId: seats[0]?.deckId ?? 'deck' };
    const result = bootstrapFourDeckGenesisV1({ ...broken, seats });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const sorted = [...result.issues].sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code) || left.message.localeCompare(right.message));
      expect(result.issues).toEqual(sorted);
      expect(result.issues.some((issue) => issue.code === 'INVALID_CAPABILITY')).toBe(true);
      expect(result.issues.some((issue) => issue.code === 'DUPLICATE_DECK_ID')).toBe(true);
      expect(result.issues.some((issue) => issue.code === 'COMMANDER_QUANTITY_INVALID')).toBe(true);
    }
  });

  it('rejects capability-shaped externally visible identifiers before construction', () => {
    const broken = input();
    const capability = broken.seats[0]?.seatCapability ?? '';
    const seats = broken.seats.map((seat, index) => index === 0
      ? { ...seat, participantId: capability, deckId: capability }
      : seat);
    const result = bootstrapFourDeckGenesisV1({ ...broken, roomId: capability, serverBuildId: capability, seats });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.path)).toEqual(['/roomId', '/seats/0/deckId', '/seats/0/participantId', '/serverBuildId']);
      expect(result.issues.every((issue) => !issue.message.includes(capability) && !issue.path.includes(capability))).toBe(true);
      expect(result.issues.some((issue) => issue.code === 'BOOTSTRAP_CONSTRUCTION_FAILED')).toBe(false);
    }
  });
});
