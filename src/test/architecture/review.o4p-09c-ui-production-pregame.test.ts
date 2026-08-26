import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative: string): string => fs.readFileSync(path.join(root, relative), 'utf8');

describe('O4P-09C-UI production Pregame architecture', () => {
  it('keeps one GameScreen and forbids online player-surface forks', () => {
    const files = fs.readdirSync(path.join(root, 'src/components'), { recursive: true })
      .map(String);
    expect(files.filter((file) => /Online(GameScreen|Board|Hand|Stack)/u.test(file))).toEqual([]);
    const app = read('src/components/online/PublicOnlineApp.tsx');
    const gameScreen = read('src/components/game/GameScreen.tsx');
    expect(app).toContain('GameScreen');
    expect(app).toContain('OnlinePregameLayer');
    expect(fs.existsSync(path.join(root, 'src/components/online/OnlinePregameLayer.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'src/components/game/PregameLayer.tsx'))).toBe(false);
    expect(gameScreen).not.toMatch(/online\/pregame|OnlinePregame/iu);
  });

  it('routes production UI through the shipped Pregame public boundary', () => {
    const app = read('src/components/online/PublicOnlineApp.tsx');
    const client = read('src/online/publicApp/types.ts');
    const runtime = read('src/online/cloudflare/runtime.ts');
    expect(app).toMatch(/pregame/iu);
    expect(client).toMatch(/OnlinePregameProjectionV1/u);
    expect(runtime).toMatch(/online-pregame-command-envelope-v1/u);
    expect(runtime).toMatch(/projectOnlinePregameV1/u);
  });

  it('does not move Pregame authority or secret material into UI code', () => {
    const ui = [
      read('src/components/online/PublicOnlineApp.tsx'),
      read('src/components/game/GameScreen.tsx'),
    ].join('\n');
    expect(ui).not.toMatch(/createOnlinePregameLifecycleV1|handleOnlinePregameCommandEnvelopeV1|randomPlan|participantCapability/iu);
  });
});
