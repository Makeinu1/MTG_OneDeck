import { describe, expect, it } from 'vitest';

import {
  addCorePlayPermissionV1,
  consumeCorePlayPermissionV1,
  coreCanPlayerAttemptPlayObjectV1,
  createModeNeutralCorePlayPermissionSliceV1,
  findCorePlayPermissionsV1,
  removeCorePlayPermissionV1,
  validateModeNeutralCorePlayPermissionSliceV1,
} from '../playPermissionV1';
import type { ModeNeutralCoreObjectRegistryStateV2 } from '../../object/objectRegistryStateV2';

const objectId = 'PC1:0';
const empty = () =>
  createModeNeutralCorePlayPermissionSliceV1({ permissionOrder: [], byPermission: {} });
const permission = (subject: unknown, duration: unknown = { kind: 'indefinite' }) =>
  ({
    allowedPlayerId: 'P2',
    action: 'play-card',
    subject,
    sourceObjectId: null,
    duration,
  }) as never;
const registry = {
  turnOrder: ['P1'],
  zones: {
    byPlayer: { P1: { library: [objectId], hand: [], graveyard: [] } },
    shared: { battlefield: [], stack: [], exile: [], command: [] },
  },
} as unknown as ModeNeutralCoreObjectRegistryStateV2;

describe('playPermissionV1', () => {
  it('validates strictly, preserves input, and freezes canonical output', () => {
    const input = {
      permissionOrder: ['p'],
      byPermission: { p: permission({ kind: 'top-of-library', playerId: 'P1' }) },
    };
    const before = JSON.stringify(input);
    const result = validateModeNeutralCorePlayPermissionSliceV1({
      ...input,
      kind: 'mode-neutral-core-play-permission-slice-v1',
    });
    expect(result.ok).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
    if (result.ok) expect(Object.isFrozen(result.value.byPermission.p.subject)).toBe(true);
    expect(validateModeNeutralCorePlayPermissionSliceV1({ ...input, kind: 'wrong' }).ok).toBe(
      false,
    );
  });

  it('adds, finds, removes, and consumes without moving objects', () => {
    let slice = addCorePlayPermissionV1(
      empty(),
      'object',
      permission({
        kind: 'object',
        objectId,
        expectedZone: { kind: 'player-zone', playerId: 'P1', zone: 'library' },
      } as never),
    ).value;
    slice = addCorePlayPermissionV1(
      slice,
      'top',
      permission({ kind: 'top-of-library', playerId: 'P1' }, { kind: 'single-use' }),
    ).value;
    expect(findCorePlayPermissionsV1(slice, 'P2' as never, 'play-card')).toHaveLength(2);
    expect(removeCorePlayPermissionV1(slice, 'object').value.permissionOrder).toEqual(['top']);
    const consumed = consumeCorePlayPermissionV1(slice, 'top').value;
    expect(consumed.permissionOrder).toEqual(['object']);
    expect(registry.zones.byPlayer['P1' as never].library).toEqual([objectId]);
  });

  it('checks only permission subject, expected zone, top position, and visibility', () => {
    const objectSlice = addCorePlayPermissionV1(
      empty(),
      'object',
      permission({
        kind: 'object',
        objectId,
        expectedZone: { kind: 'player-zone', playerId: 'P1', zone: 'library' },
      } as never),
    ).value;
    expect(
      coreCanPlayerAttemptPlayObjectV1(
        registry,
        { byGrant: {} },
        objectSlice,
        'P2' as never,
        objectId as never,
      ),
    ).toBe(true);
    expect(
      coreCanPlayerAttemptPlayObjectV1(
        registry,
        { byGrant: {} },
        objectSlice,
        'P1' as never,
        objectId as never,
      ),
    ).toBe(false);
    const faceDown = addCorePlayPermissionV1(
      empty(),
      'exile',
      permission({ kind: 'face-down-exile', objectId }),
    ).value;
    const exileRegistry = {
      ...registry,
      zones: {
        ...registry.zones,
        byPlayer: { P1: { library: [], hand: [], graveyard: [] } },
        shared: { ...registry.zones.shared, exile: [objectId] },
      },
    } as unknown as ModeNeutralCoreObjectRegistryStateV2;
    expect(
      coreCanPlayerAttemptPlayObjectV1(
        exileRegistry,
        { byGrant: {} },
        faceDown,
        'P2' as never,
        objectId as never,
      ),
    ).toBe(false);
    expect(
      coreCanPlayerAttemptPlayObjectV1(
        exileRegistry,
        {
          byGrant: {
            reveal: {
              subject: { kind: 'object', objectId },
              audience: { kind: 'players', playerIds: ['P2'] },
            },
          },
        },
        faceDown,
        'P2' as never,
        objectId as never,
      ),
    ).toBe(true);
  });
});
