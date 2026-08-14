import { describe, expect, it } from 'vitest';
import fixture from '../../workbench/fixtures/o4p-04a-personal-workbench-v1.json';
import {
  OnlineGuidedActionBindingErrorV1,
  OnlineGuidedActionsErrorV1,
  bindOnlineGuidedCommandActionV1,
  buildOnlineGuidedActionsViewV1,
  createOnlineGuidedActionV1,
} from '../index';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('guided actions', () => {
  it('builds an ordered, deeply frozen player view without hidden values', () => {
    const view = buildOnlineGuidedActionsViewV1(clone(fixture));
    expect(view.kind).toBe('online-guided-actions-view-v1');
    expect(view.actorPlayerId).toBe('P1');
    expect(view.revision).toBe(12);
    expect(view.controlCandidates.map((candidate) => candidate.objectId)).toEqual(['PC1:0']);
    expect(view.faceDownItems.map((item) => item.objectId)).toEqual(['PC2:0']);
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.turn)).toBe(true);
    expect(Object.isFrozen(view.controlCandidates)).toBe(true);
  });

  it('fails closed for non-player and trap-shaped roots', () => {
    expect(() => buildOnlineGuidedActionsViewV1({})).toThrow(OnlineGuidedActionsErrorV1);
    const hostile = { ...clone(fixture), get game() { throw new Error('trap'); } };
    expect(() => buildOnlineGuidedActionsViewV1(hostile)).toThrow(OnlineGuidedActionsErrorV1);
  });

  it('creates a fresh frozen action and rejects unknown or manual binding', () => {
    const projection = clone(fixture);
    const action = createOnlineGuidedActionV1({
      projection,
      action: {
        kind: 'apply-control',
        actorPlayerId: 'P1',
        baseRevision: 12,
        effectKey: 'control-1',
        targetObjectId: 'PC1:0',
        gainingControllerPlayerId: 'P1',
        sourceObjectId: null,
        duration: { kind: 'manual' },
      },
    });
    expect(action).toEqual({
      kind: 'apply-control', actorPlayerId: 'P1', baseRevision: 12,
      effectKey: 'control-1', targetObjectId: 'PC1:0', gainingControllerPlayerId: 'P1',
      sourceObjectId: null, duration: { kind: 'manual' },
    });
    expect(Object.isFrozen(action)).toBe(true);
    expect(() => createOnlineGuidedActionV1({ projection, action: { ...action, extra: true } })).toThrow(OnlineGuidedActionsErrorV1);
    expect(() => bindOnlineGuidedCommandActionV1({
      session: {
        protocolVersion: 1,
        roomId: 'room-o4p-04a-fixture',
        participantId: 'player-p1',
        participantCapability: 'seat_capability_AAAAAAAAAAAAAAAA',
        clientBuildId: 'o4p-04d-client-build',
        corePlayerId: 'P1',
        personalProjection: projection,
      },
      action: { kind: 'note-face-down', actorPlayerId: 'P1', baseRevision: 12, objectId: 'PC6:0', note: 'manual' },
      commandId: 'guided-1',
    })).toThrow(OnlineGuidedActionBindingErrorV1);
  });
});
