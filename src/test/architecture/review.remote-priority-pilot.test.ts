import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

describe('Remote HOLD/pass/resolve canonical route', () => {
  it('routes the production pass surface through tabletop intent, server authority, and Core priority', () => {
    const rail = read('src/components/online/remoteGameScreen.tsx');
    const app = read('src/components/online/PublicOnlineApp.tsx');
    const types = read('src/online/tabletopManual/types.ts');
    const binder = read('src/online/tabletopManual/binding.ts');
    const server = read('src/online/tabletopManual/server.ts');
    const closure = read('src/engine/core/closure/applyCommandV1.ts');

    expect(rail).toContain("buildIntent(projection, { kind: 'priority-pass' })");
    expect(rail).toContain('online-remote-priority-result');
    expect(`${app}\n${rail}`).not.toContain('onSubmitPersonalAction');
    expect(rail).not.toContain('bindPersonalWorkbenchActionV1');
    expect(types).toContain("| 'priority-hold' | 'priority-pass' | 'priority-advance'");
    expect(binder).toContain("case 'priority-pass': payload = { kind: 'priority-pass', playerId: binding.actorPlayerId }");
    expect(server).toContain("if (primitive.kind === 'priority-pass')");
    expect(server).toContain('Only the current priority holder may pass');
    expect(closure).toContain("payload.kind === 'priority-pass'");
    expect(closure).toContain("adapterFailure('PRIORITY_HOLD_ACTIVE', '/payload', 'Active priority HOLD blocks priority pass')");
  });

  it('rejects the retired ordinary-command bypass and keeps one converged browser proof', () => {
    const runtime = read('src/online/cloudflare/runtime.ts');
    const evidence = read('scripts/online/o4p-09i-full-match-evidence.ts');
    const validator = read('scripts/online/remote-priority-journey-evidence.ts');
    const visualMain = read('src/dev/visualFixtures/main.tsx');
    const visualFixture = read('src/dev/visualFixtures/RemoteGameScreenFixture.tsx');

    expect(runtime).toContain("if (payload.kind === 'priority-pass') return true");
    expect(evidence).toContain("'online-remote-pass'");
    expect(evidence).toContain("'online-remote-resolve'");
    expect(validator).toContain("['priority-hold', 'priority-hold', 'priority-pass', 'priority-pass', 'priority-resolve']");
    expect(validator).toContain("failure('CAPTURED_TOP_NOT_RESOLVED')");
    expect(visualMain).toContain("requestedScenario === 'remote-game'");
    expect(visualFixture).toContain('<GameScreen');
    expect(visualFixture).toContain('<RemoteGameScreenActionRail');
    expect(visualFixture).not.toMatch(/PublicOnlineApp|PUBLIC_ONLINE_ENDPOINT|fetch\(|WebSocket/u);
  });
});
