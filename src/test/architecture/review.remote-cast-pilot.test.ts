import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

describe('Remote cast pilot canonical route', () => {
  it('keeps one player-facing cast surface and the server-authoritative route', () => {
    const rail = read('src/components/online/remoteGameScreen.tsx');
    const manual = read('src/components/online/OnlineTabletopManual.tsx');
    const controller = read('src/online/publicApp/v3.ts');
    const runtime = read('src/online/cloudflare/runtime.ts');
    const binder = read('src/online/tabletopManual/server.ts');
    const closure = read('src/engine/core/closure/applyCommandV1.ts');

    expect(rail).toContain("submit({ kind: 'cast-spell'");
    expect(rail).toContain('remoteHandActionEligibility');
    expect(rail).toContain("remoteHandActionAllowed(projection, objectId, 'cast-spell')");
    expect(manual).not.toMatch(/online-journey-cast-spell|online-journey-spell/u);
    expect(controller).toContain('client.submitTabletop');
    expect(runtime).toContain('bindOnlineTabletopIntentOnServerV1');
    expect(binder).toContain("kind: 'stack-commit-card-spell'");
    expect(binder).toContain('Active priority HOLD blocks land play or spell cast');
    expect(closure).toContain("payload.kind === 'stack-commit-card-spell'");
    expect(closure).toContain("adapterFailure('PRIORITY_HOLD_ACTIVE', '/payload', 'Active priority HOLD blocks spell cast')");
  });

  it('does not reconnect the player surface to retired application or ordinary-command adapters', () => {
    const app = read('src/components/online/PublicOnlineApp.tsx');
    const rail = read('src/components/online/remoteGameScreen.tsx');
    const playerSurface = `${app}\n${rail}`;

    expect(playerSurface).not.toMatch(/createRemoteGameApplicationAdapterV1|applyGameIntentV1/u);
    expect(rail).not.toMatch(/bindPersonalWorkbenchActionV1|bindOnlineGuidedCommandActionV1/u);
  });

  it('keeps the prerequisite SBA confirmation explicit and on the same Core turn-progress route', () => {
    const rail = read('src/components/online/remoteGameScreen.tsx');
    const binder = read('src/online/tabletopManual/binding.ts');
    const server = read('src/online/tabletopManual/server.ts');
    const closure = read('src/engine/core/closure/applyCommandV1.ts');
    const evidence = read('scripts/online/o4p-09i-full-match-evidence.ts');

    expect(rail).toContain('online-remote-sba-stable');
    expect(rail).toContain('適用すべきSBAなし（卓で確認）');
    expect(binder).toContain("kind: 'table-turn-progress', transition: { kind: 'sba-check-outcome'");
    expect(server).toContain('window.priorityRecipientPlayerId !== actorPlayerId');
    expect(closure).toContain('recordCoreSbaCheckOutcomeV1');
    expect(evidence).toContain("['online-remote-advance', 'online-remote-sba-stable']");
  });
});
