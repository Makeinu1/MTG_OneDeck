import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as Core from '../../engine/core/index';
import * as Application from '../../online/application/index';
import { buildVariableRoomGenesisV3 } from '../../online/genesis/index';
import {
  handleOnlineVariableCommandEnvelopeV2,
  type OnlineVariableProtocolStateV2,
} from '../../online/protocol/index';
import {
  projectOnlineVariableProtocolV3,
  validateOnlineParticipantProjectionV3,
} from '../../online/projection/index';
import type { CardDef } from '../../types/card';

const ROOT = resolve(import.meta.dirname, '../../..');
const BASE_SHA = 'ce06a17b123cb6684090b48f9350df085e98ec54';
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');
const gitLines = (args: string[]): string[] => execFileSync('git', args, {
  cwd: ROOT,
  encoding: 'utf8',
}).trim().split(/\r?\n/u).filter(Boolean);

const PRODUCT_PATHS = [
  'src/online/application/index.ts',
  'src/online/application/types.ts',
  'src/online/application/gameIntentV1.ts',
  'src/online/application/applicationV1.ts',
  'src/online/application/localAdapterV1.ts',
  'src/online/application/remoteAdapterV1.ts',
] as const;

const ALLOWED_PATHS = new Set([
  '.claude/loop-state.md',
  'docs/contracts/manifest.json',
  'research/cr-grounding/cr-backbone-ledger.json',
  'research/cr-grounding/archive/o4p-09b-shared-intent-application-cold-audit-record-2026-08-25.md',
  'research/cr-grounding/o4p-09b-shared-intent-application.contract.draft.md',
  'research/cr-grounding/o4p-09b-acceptance-brief.draft.md',
  'research/cr-grounding/o4p-09b-implementation-brief.draft.md',
  'research/cr-grounding/o4p-09b-cold-audit-brief.draft.md',
  ...PRODUCT_PATHS,
  'src/online/application/__tests__/gameApplicationV1.test.ts',
  'src/test/architecture/review.o4p-09a-unified-game-surface.test.ts',
  'src/test/architecture/review.o4p-09b-shared-intent-application.test.ts',
  'src/test/architecture/review.gov-codex-56-program-orchestration.test.ts',
  'src/test/architecture/review.gov-codex-56r2-request-normalization.test.ts',
  'src/test/architecture/review.o4p-06-roadmap-registration.test.ts',
  'src/test/architecture/review.o4p-07-roadmap-registration.test.ts',
  'src/test/architecture/review.o4p-08-roadmap-registration.test.ts',
  'src/test/architecture/review.o4p-09-roadmap-registration.test.ts',
]);

const CARD_ID = '8d991178-1f2e-4d69-8ea3-5c3ac23cf565';
const ORACLE_ID = '60ac5965-e827-480f-a9a2-61c8138bb010';

function definition(): CardDef {
  return Object.freeze({
    scryfallId: CARD_ID,
    oracleId: ORACLE_ID,
    name: 'O4P-09B Review Card',
    lang: 'en',
    layout: 'normal',
    cmc: 1,
    colorIdentity: [],
    typeLine: 'Artifact',
    faces: [{ name: 'O4P-09B Review Card', typeLine: 'Artifact', oracleText: '' }],
  });
}

function genesis() {
  const seats = Object.freeze(Array.from({ length: 2 }, (_, index) => {
    const entries = Object.freeze([Object.freeze({
      index: 0,
      section: 'main' as const,
      quantity: 40,
      scryfallId: CARD_ID,
      oracleId: ORACLE_ID,
      definition: definition(),
    })]);
    const serialized = JSON.stringify({ entries });
    return Object.freeze({
      seatIndex: index as 0 | 1,
      corePlayerId: `P${String(index + 1)}` as 'P1' | 'P2',
      participantId: `participant-o4p09b-${String(index + 1)}`,
      seatCapability: `seat_${String(index + 1).repeat(40)}`,
      snapshot: Object.freeze({
        entries,
        serialized,
        digest: Core.coreSha256HexV1(serialized),
      }),
    });
  }));
  const result = buildVariableRoomGenesisV3(Object.freeze({
    roomId: 'room-o4p09b-review',
    serverBuildId: 'o4p09b-review-build',
    configuration: Object.freeze({ playerCount: 2 as const, startingLife: 20 as const }),
    seats,
    tableParticipantId: 'table-o4p09b-review',
    tableCapability: `observer_${'T'.repeat(40)}`,
  }));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('O4P-09B requires variable genesis');
  return result;
}

function authority(state: OnlineVariableProtocolStateV2) {
  const seat = state.room.seats[0];
  if (seat === undefined || seat.participantId === null) {
    throw new Error('O4P-09B requires the first player seat');
  }
  return Object.freeze({
    protocolVersion: state.protocolVersion,
    roomId: state.room.roomId,
    participantId: seat.participantId,
    participantCapability: seat.seatCapability,
  });
}

function intent(): Application.GameIntentV1 {
  return Object.freeze({
    kind: 'game-intent-v1',
    schemaVersion: 1,
    commandId: 'o4p09b-mana-1' as Application.GameIntentV1['commandId'],
    baseRevision: 0,
    command: Core.createCoreCommandV1({
      schemaVersion: 1,
      sequence: 1,
      actorPlayerId: 'P1' as Core.CorePlayerId,
      decisionMakerPlayerId: 'P1' as Core.CorePlayerId,
      decisionContext: { kind: 'decision', decisionKey: 'o4p09b-application' },
      payload: { kind: 'table-mana-adjust', color: 'G', delta: 1 },
    }),
  });
}

function liveCandidatePaths(): string[] {
  const ledger = JSON.parse(read('research/cr-grounding/cr-backbone-ledger.json')) as {
    domains: Array<{ id: string; status: string; evidence?: string[] }>;
  };
  const domain = ledger.domains.find((entry) => entry.id === 'O4P-09B');
  if (domain?.status === 'shipped') {
    const semantic = domain.evidence?.find((entry) => /^semantic-head:[0-9a-f]{7,40}$/u.test(entry));
    if (semantic === undefined) throw new Error('Shipped O4P-09B requires semantic-head evidence');
    return gitLines(['diff', '--name-only', BASE_SHA, semantic.slice('semantic-head:'.length)]);
  }
  return [
    ...gitLines(['diff', '--name-only', BASE_SHA]),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ];
}

describe('O4P-09B shared GameIntent application boundary', () => {
  it('normalizes one exact versioned Core intent and rejects hostile records', () => {
    const valid = Application.validateGameIntentV1(intent());
    expect(valid).toMatchObject({ ok: true });
    if (!valid.ok) throw new Error('Expected a valid O4P-09B intent');
    expect(Object.keys(valid.value)).toEqual([
      'kind', 'schemaVersion', 'commandId', 'baseRevision', 'command',
    ]);
    expect(Object.isFrozen(valid.value)).toBe(true);
    expect(JSON.stringify(valid.value)).not.toMatch(
      /participantCapability|participantId|roomId|projection|coreRoot/u,
    );

    expect(Application.validateGameIntentV1({ ...intent(), surplus: true }))
      .toMatchObject({ ok: false });
    const hidden = { ...intent() } as Record<PropertyKey, unknown>;
    Object.defineProperty(hidden, 'hidden', { enumerable: false, value: true });
    expect(Application.validateGameIntentV1(hidden)).toMatchObject({ ok: false });
    const symbolic = { ...intent(), [Symbol('hidden')]: true };
    expect(Application.validateGameIntentV1(symbolic)).toMatchObject({ ok: false });

    let getterCalled = false;
    const accessor = { ...intent() } as Record<string, unknown>;
    Object.defineProperty(accessor, 'command', {
      enumerable: true,
      get: () => {
        getterCalled = true;
        return intent().command;
      },
    });
    expect(Application.validateGameIntentV1(accessor)).toMatchObject({ ok: false });
    expect(getterCalled).toBe(false);
  });

  it('returns equal accepted and duplicate Local/Remote receipts and projections', async () => {
    const initial = genesis().protocolState;
    const playerAuthority = authority(initial);
    const local = Application.createLocalGameApplicationAdapterV1({
      authority: playerAuthority,
      initialState: initial,
    });
    expect(Object.keys(local)).toEqual(['kind']);
    expect('authority' in local).toBe(false);
    expect('applyEnvelope' in local).toBe(false);
    expect(JSON.stringify(local)).not.toContain(playerAuthority.participantCapability);
    let remoteState = initial;
    const remote = Application.createRemoteGameApplicationAdapterV1({
      authority: playerAuthority,
      submit: (envelope) => {
        const transition = handleOnlineVariableCommandEnvelopeV2(remoteState, envelope);
        remoteState = transition.state;
        return Promise.resolve(Object.freeze({
          kind: 'game-application-exchange-v1' as const,
          receipt: transition.response,
          projection: projectOnlineVariableProtocolV3(
            remoteState,
            playerAuthority.participantId,
          ),
        }));
      },
    });

    const localAccepted = await Application.applyGameIntentV1(local, intent());
    const remoteAccepted = await Application.applyGameIntentV1(remote, intent());
    expect(localAccepted).toEqual(remoteAccepted);
    expect(localAccepted).toMatchObject({
      ok: true,
      value: {
        kind: 'game-application-exchange-v1',
        receipt: { kind: 'online-command-ack-v1', duplicate: false, status: 'accepted' },
        projection: { kind: 'online-participant-projection-v3', revision: 1 },
      },
    });
    if (!localAccepted.ok) throw new Error('Expected accepted application exchange');
    expect(validateOnlineParticipantProjectionV3(localAccepted.value.projection))
      .toMatchObject({ ok: true });
    const serialized = JSON.stringify(localAccepted.value);
    expect(serialized).not.toContain(playerAuthority.participantCapability);
    expect(serialized).not.toMatch(/requestDigest|receipts|coreRoot/u);

    const localDuplicate = await Application.applyGameIntentV1(local, intent());
    const remoteDuplicate = await Application.applyGameIntentV1(remote, intent());
    expect(localDuplicate).toEqual(remoteDuplicate);
    expect(localDuplicate).toMatchObject({
      ok: true,
      value: { receipt: { kind: 'online-command-ack-v1', duplicate: true } },
    });
  });

  it('fails before adapter invocation and redacts transport failures', async () => {
    const initial = genesis().protocolState;
    const playerAuthority = authority(initial);
    let submissions = 0;
    const remote = Application.createRemoteGameApplicationAdapterV1({
      authority: playerAuthority,
      submit: () => {
        submissions += 1;
        return Promise.reject(new Error('private-transport-detail'));
      },
    });
    const invalid = await Application.applyGameIntentV1(remote, {
      ...intent(),
      surplus: true,
    });
    expect(invalid).toMatchObject({ ok: false });
    expect(submissions).toBe(0);

    const failed = await Application.applyGameIntentV1(remote, intent());
    expect(failed).toMatchObject({ ok: false });
    expect(submissions).toBe(1);
    expect(JSON.stringify(failed)).not.toContain('private-transport-detail');

    const hostileAttempt = new Proxy(Object.create(null) as object, {
      getOwnPropertyDescriptor: () => {
        throw new Error('private-attempt-detail');
      },
    });
    expect(() => Application.validateGameApplicationAttemptV1(
      hostileAttempt,
      authority(initial),
      intent(),
    )).not.toThrow();
    expect(Application.validateGameApplicationAttemptV1(
      hostileAttempt,
      playerAuthority,
      intent(),
    )).toMatchObject({ ok: false });

    const impossibleRemote = Application.createRemoteGameApplicationAdapterV1({
      authority: playerAuthority,
      submit: (envelope) => Promise.resolve(Object.freeze({
        kind: 'game-application-exchange-v1' as const,
        receipt: Object.freeze({
          kind: 'online-command-reject-v1' as const,
          protocolVersion: playerAuthority.protocolVersion,
          roomId: playerAuthority.roomId,
          participantId: playerAuthority.participantId,
          commandId: envelope.commandId,
          baseRevision: envelope.baseRevision,
          currentRevision: initial.revision,
          duplicate: false,
          resyncRequired: true,
          issues: Object.freeze([Object.freeze({
            code: 'STALE_REVISION' as const,
            path: '',
            message: 'hostile remote detail',
          })]),
        }),
        projection: projectOnlineVariableProtocolV3(
          initial,
          playerAuthority.participantId,
        ),
      })),
    });
    const impossible = await Application.applyGameIntentV1(impossibleRemote, intent());
    expect(impossible).toMatchObject({ ok: false });
    expect(JSON.stringify(impossible)).not.toContain('hostile remote detail');
  });

  it('keeps the candidate additive and prevents a second Core/UI path', () => {
    const changed = new Set(liveCandidatePaths());
    for (const path of PRODUCT_PATHS) expect(changed, path).toContain(path);
    expect(changed).toContain('src/online/application/__tests__/gameApplicationV1.test.ts');
    for (const path of changed) {
      expect(ALLOWED_PATHS.has(path), `unexpected O4P-09B path: ${path}`).toBe(true);
      expect(path).not.toMatch(/(?:OnlineGameScreen|OnlineBoard|OnlineHand|OnlineStack)/u);
      expect(path).not.toMatch(
        /^src\/(?:engine|store|components|online\/(?:browser|cloudflare|genesis|projection|protocol|room))\//u,
      );
    }

    const sources = PRODUCT_PATHS.map(read).join('\n');
    expect(sources).not.toContain('applyCoreCommandV1');
    expect(sources).not.toMatch(/\bGameState\b|useGameStore|zustand|GameScreen/u);
    expect(read('src/online/application/localAdapterV1.ts'))
      .toContain('handleOnlineVariableCommandEnvelopeV2');
    expect(read('src/online/application/localAdapterV1.ts'))
      .toContain('projectOnlineVariableProtocolV3');
    expect(read('src/online/application/remoteAdapterV1.ts'))
      .not.toMatch(/handleOnlineVariableCommandEnvelopeV2|projectOnlineVariableProtocolV3/u);
    expect(read('src/online/application/applicationV1.ts'))
      .toContain('validateGameIntentV1');
    expect(read('src/online/application/applicationV1.ts'))
      .toContain('validateOnlineCommandEnvelopeV1');
    expect(() => execFileSync('git', ['diff', '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
    })).not.toThrow();
  });
});
