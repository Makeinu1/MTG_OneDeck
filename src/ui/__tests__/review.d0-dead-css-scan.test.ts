import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * D0(地ならし)review pin: 死CSS/Unicode偽装アイコンの残存0を恒久化する
 * ソース走査アサーション。判定者専有・実装エージェントは変更禁止。
 */
const appCssPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../App.css',
);
const appCss = readFileSync(appCssPath, 'utf-8');

describe('App.css 死CSS走査', () => {
  it('Unicode 偽装アイコン(.ti / .ti-*::before)が残存しない', () => {
    expect(appCss).not.toMatch(/\.ti\s*\{/);
    expect(appCss).not.toMatch(/\.ti-[a-z0-9-]+::before/);
    expect(appCss).not.toMatch(/\.ti::before/);
  });

  it('旧3カラム系(.playmat__sidebar/__main/__stage/__zones/__hand/__log)が残存しない', () => {
    // \b 境界必須: .playmat__handrow(現行クラス)を .playmat__hand の誤検出にしない
    for (const cls of [
      'playmat__sidebar',
      'playmat__main',
      'playmat__stage',
      'playmat__zones',
      'playmat__hand',
      'playmat__log',
    ]) {
      const re = new RegExp(`\\.${cls}\\b`);
      expect(re.test(appCss)).toBe(false);
    }
  });

  it('新アイコンラッパークラス(.icon)は存在する', () => {
    expect(appCss).toMatch(/\.icon\s*\{/);
  });
});

describe('tsx 側の ti-* 参照走査', () => {
  it('PlaymatHud/MobileControlsDrawer に ti-* クラス/プロパティが残存しない', () => {
    const targets = [
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../components/playmat/PlaymatHud.tsx',
      ),
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../components/playmat/MobileControlsDrawer.tsx',
      ),
    ];
    for (const file of targets) {
      const content = readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/ti ti-|"ti-[a-z0-9-]+"|className="ti\b/);
    }
  });
});
