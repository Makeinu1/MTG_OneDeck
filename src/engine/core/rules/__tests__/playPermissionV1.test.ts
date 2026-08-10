import { describe, expect, it } from 'vitest';
import fixture from '../../turn/fixtures/turn-priority-lifecycle-v1.json';

import {
  addCorePlayPermissionV1,
  consumeCorePlayPermissionV1,
  coreCanPlayerAttemptPlayObjectV1,
  createModeNeutralCorePlayPermissionSliceV1,
  findCorePlayPermissionsV1,
  removeCorePlayPermissionV1,
  validateModeNeutralCorePlayPermissionSliceV1,
} from '../playPermissionV1';
import { createModeNeutralCoreVisibilitySliceV1 } from '../visibilityGrantV1';
import type { ModeNeutralCoreObjectRegistryStateV2 } from '../../object/objectRegistryStateV2';

const objectId = 'PC1:0';
const empty = () =>
  createModeNeutralCorePlayPermissionSliceV1({ permissionOrder: [], byPermission: {} });
const permission = (
  subject: unknown,
  duration: unknown = { kind: 'indefinite' },
  allowedPlayerId = 'P2',
) =>
  ({
    allowedPlayerId,
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
      }),
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

  it('requires visibility for an actual face-down Exile object and honors both audiences', () => {
    const objectSlice = addCorePlayPermissionV1(
      empty(),
      'object',
      permission({
        kind: 'object',
        objectId,
        expectedZone: { kind: 'player-zone', playerId: 'P1', zone: 'library' },
      }),
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
    const faceDownObjectId = 'PC4:0' as never;
    const faceDown = addCorePlayPermissionV1(
      empty(),
      'exile',
      permission({
        kind: 'object',
        objectId: faceDownObjectId,
        expectedZone: { kind: 'shared-zone', zone: 'exile' },
      }),
    ).value;
    const exileRegistry = fixture.bundle.stackBundle
      .objectRegistry as unknown as ModeNeutralCoreObjectRegistryStateV2;
    const exileRuntime = fixture.bundle.stackBundle.objectRuntime as unknown as {
      readonly byObject: Readonly<Record<string, unknown>>;
    };
    expect(exileRegistry.zones.shared.exile).toContain(faceDownObjectId);
    expect(JSON.stringify(exileRuntime.byObject[faceDownObjectId])).toContain('"faceDown":true');
    expect(
      coreCanPlayerAttemptPlayObjectV1(
        exileRegistry,
        { byGrant: {} },
        faceDown,
        'P2' as never,
        faceDownObjectId,
      ),
    ).toBe(false);
    const specificPlayerVisibility = createModeNeutralCoreVisibilitySliceV1({
      grantOrder: ['exile-specific'],
      byGrant: {
        'exile-specific': {
          subject: { kind: 'object', objectId: faceDownObjectId },
          audience: { kind: 'players', playerIds: ['P2' as never] },
          mode: 'look',
          sourceObjectId: null,
          duration: { kind: 'indefinite' },
        },
      },
    });
    expect(
      coreCanPlayerAttemptPlayObjectV1(
        exileRegistry,
        specificPlayerVisibility,
        faceDown,
        'P2' as never,
        faceDownObjectId,
      ),
    ).toBe(true);
    const allPlayersVisibility = createModeNeutralCoreVisibilitySliceV1({
      grantOrder: ['exile-all'],
      byGrant: {
        'exile-all': {
          subject: { kind: 'object', objectId: faceDownObjectId },
          audience: { kind: 'all-players' },
          mode: 'reveal',
          sourceObjectId: null,
          duration: { kind: 'indefinite' },
        },
      },
    });
    const allPlayersFaceDown = addCorePlayPermissionV1(
      empty(),
      'exile-all',
      permission(
        {
          kind: 'object',
          objectId: faceDownObjectId,
          expectedZone: { kind: 'shared-zone', zone: 'exile' },
        },
        { kind: 'indefinite' },
        'P4',
      ),
    ).value;
    expect(
      coreCanPlayerAttemptPlayObjectV1(
        exileRegistry,
        allPlayersVisibility,
        allPlayersFaceDown,
        'P4' as never,
        faceDownObjectId,
      ),
    ).toBe(true);
  });
});
