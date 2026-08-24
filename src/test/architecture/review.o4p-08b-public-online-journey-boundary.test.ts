import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('O4P-08B public Online journey architecture review', () => {
  it('moves equal Solo/Online actions beside the selected saved deck', () => {
    const app = source('src/App.tsx');
    expect(app).toContain('data-testid="play-choice"');
    expect(app).toContain('data-testid="open-solo-mode"');
    expect(app).toContain('data-testid="open-online-mode"');
    expect(app).toContain('オンライン対戦');
    expect(app).not.toContain('4人オンライン');
    expect(app).not.toContain('<nav className="app__mode-choice"');
  });

  it('uses shared admission only and never asks the participant for Room ID', () => {
    const component = source('src/components/online/PublicOnlineApp.tsx');
    expect(component).toContain('controller.createShared(roomConfiguration)');
    expect(component).toContain('controller.joinShared(joinCode.trim())');
    expect(component).toContain('readAndScrubPublicOnlineInviteFragmentV3');
    expect(component).not.toMatch(/Room ID|online-room-id|controller\.join\(roomId/);
    expect(component).not.toMatch(/4人オンライン/);
    expect(component).toMatch(/from '\.\.\/\.\.\/online\/publicApp'/);
    expect(component).not.toMatch(/online\/publicApp\/(?:v2|recoveryV1|types)/);
  });

  it('keeps moderation pre-start, host-only in presentation, and actionably structured', () => {
    const component = source('src/components/online/PublicOnlineApp.tsx');
    const controller = source('src/online/publicApp/v3.ts');
    const types = source('src/online/publicApp/types.ts');
    for (const operation of ['rotateInvite', 'closeAdmission', 'kick', 'recover', 'leave']) {
      expect(component).toContain(`controller.${operation}`);
      expect(types).toContain(operation);
    }
    expect(component).toContain('snapshot.isHost');
    expect(component).toContain('!started');
    expect(component).toContain('aria-current');
    expect(component).toContain('照会 ID:');
    expect(controller).toContain('online-forming-lobby-admission-rotate-v3');
    expect(controller).toContain('online-forming-lobby-admission-close-v3');
    expect(controller).toContain('online-forming-lobby-kick-v3');
  });

  it('preserves the O4P-08B fixed predecessor while O4P-08D adds a separate variable controller', () => {
    const predecessor = source('src/online/publicApp/v2.ts');
    const successor = source('src/online/publicApp/v3.ts');
    expect(predecessor).not.toContain("kind: 'online-forming-lobby-create-v5'");
    expect(successor).toContain("kind: 'online-forming-lobby-create-v5'");
    expect(successor).toMatch(/playerCount[\s\S]*startingLife/);
  });
});
