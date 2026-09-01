import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = (relative: string): string => fs.readFileSync(path.join(root, relative), 'utf8');

describe('O4P-08D Judge: program completion boundary', () => {
  it('keeps the public selector additive and derives lobby seats from projection length', () => {
    const app = source('src/components/online/PublicOnlineApp.tsx');
    const types = source('src/online/publicApp/types.ts');
    const index = source('src/online/publicApp/index.ts');
    expect(app).toContain('online-player-count-2');
    expect(app).toContain('online-player-count-4');
    expect(app).toContain('online-starting-life-20');
    expect(app).toContain('開始ライフ 40（固定）');
    expect(app).toContain('snapshot.configuration');
    expect(app).toMatch(/playerCount.*開始ライフ|開始ライフ.*startingLife/su);
    expect(app).not.toContain('Array.from({ length: 4 }');
    expect(types).toContain('PublicOnlineControllerV3');
    expect(index).toContain('createPublicOnlineControllerV3');
  });

  it('adds a full variable projection generation without changing v1/v2 literals', () => {
    const variable = source('src/online/projection/variable.ts');
    const validationV1 = source('src/online/projection/validation.ts');
    expect(variable).toContain("'online-participant-projection-v2'");
    expect(variable).toContain("'online-participant-projection-v3'");
    expect(variable).toContain('projectOnlineVariableProtocolV3');
    expect(variable).toContain('validateOnlineParticipantProjectionV3');
    expect(validationV1).toContain("'online-participant-projection-v1'");
  });

  it('retains the hardened public client and real browser-action transport', () => {
    const client = source('src/online/publicApp/v3.ts');
    expect(client).toContain('parsePublicOnlineErrorV3');
    expect(client).toContain('createOnlineBrowserWebSocketClientV1');
    expect(client).toContain('online-forming-lobby-ready-v4');
    expect(client).toContain('online-forming-lobby-start-v4');
    expect(client).toContain('/websocket');
    expect(client).toContain('bindOnlineGuidedCommandActionV1');
    expect(client).toContain('submitGuidedAction');
    expect(client).not.toContain('bindPersonalWorkbenchActionV1');
    expect(client).not.toContain('submitPersonalAction');
    expect(client).not.toContain('Math.random');
    expect(client).not.toMatch(/submitPersonalAction:\s*\(\)\s*=>\s*undefined/u);
    expect(client).not.toMatch(/submitGuidedAction:\s*\(\)\s*=>\s*undefined/u);
  });

  it('does not widen the program into excluded product or governance scope', () => {
    const relevant = [
      source('src/components/online/PublicOnlineApp.tsx'),
      source('src/online/publicApp/types.ts'),
      source('src/online/publicApp/index.ts'),
      source('src/online/projection/variable.ts'),
    ].join('\n');
    expect(relevant).not.toMatch(/Duel Commander|デュエルコマンダー|matchmaking|マッチメイキング/iu);
    expect(relevant).not.toMatch(/ban[-_ ]?list|禁止リスト|accountId|teamId/iu);
    expect(source('package.json')).not.toContain('o4p-08d-dependency');
  });
});
