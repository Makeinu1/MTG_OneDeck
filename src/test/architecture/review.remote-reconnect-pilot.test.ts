import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

describe('Remote reconnect canonical route', () => {
  it('keeps one same-revision server presence route and retires the variable disconnect bypass', () => {
    const room = read('src/online/room/variable.ts');
    const persistence = read('src/online/cloudflare/persistence.ts');
    const runtime = read('src/online/cloudflare/runtime.ts');

    expect(room).toContain('disconnectOnlineVariableRoomParticipantV2');
    expect(room).toContain('rejoinOnlineVariableRoomParticipantV2');
    expect(persistence).toContain('persistVariableSameRevision');
    expect(persistence).toContain('previous.value.room.lifecycle !== next.value.room.lifecycle');
    expect(runtime).toContain('this.persistVariablePresenceIfChanged(state, validation.value)');
    expect(runtime).toContain("reason = 'rejoined'");
    expect(runtime).toContain('participantNotConnectedReject');
    expect(runtime).toContain("body.seatCapability, 'projected-snapshot'");
    expect(runtime).not.toContain("if (state.kind === 'online-protocol-state-v2') return;");
  });

  it('rejects disconnected mutations and exposes only the authoritative server recovery fact', () => {
    const command = read('src/online/protocol/variableCommand.ts');
    const tabletop = read('src/online/tabletopManual/server.ts');
    const visibility = read('src/online/visibilityDecisions/binding.ts');
    const pregame = read('src/online/pregame/operations.ts');
    const browser = read('src/online/browser/client.ts');
    const app = read('src/components/online/PublicOnlineApp.tsx');
    const rail = read('src/components/online/remoteGameScreen.tsx');
    const evidence = read('scripts/online/o4p-09i-full-match-evidence.ts');
    const registry = read('scripts/journeys/registry.json');

    expect(command.match(/PARTICIPANT_NOT_CONNECTED/gu)?.length).toBeGreaterThanOrEqual(3);
    expect(tabletop).toContain("participant.presence !== 'connected'");
    expect(visibility).toContain("participant.presence !== 'connected'");
    expect(pregame).toContain("rejectValid('PARTICIPANT_NOT_CONNECTED'");
    expect(browser).toContain("if (resyncReason === 'rejoined') recoveryOutcome = 'rejoined'");
    expect(app).toContain('recoveryOutcome={snapshot.player.recoveryOutcome}');
    expect(rail).toContain('data-recovery-outcome={recoveryOutcome ??');
    expect(rail).toContain('data-disconnected-player-ids={disconnectedPlayerIds.join');
    expect(rail).toContain('data-shared-public-digest={sharedPublicDigest}');
    expect(evidence).toContain('privateAudienceIsolated');
    expect(registry).toContain('src/online/browser/__tests__/o4p09iFullMatchEvidence.test.ts');
    expect(registry).toContain('review.o4p-03c-capability-abuse-control.test.ts');
    expect(registry).toContain('review.o4p-08a-membership-runtime.test.ts');
    expect(`${app}\n${rail}`).not.toMatch(/bindPersonalWorkbenchActionV1|bindOnlineGuidedCommandActionV1|createRemoteGameApplicationAdapterV1/u);
  });
});
