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
    // \b 境界必須: .playmat__handrow を .playmat__hand の誤検出にしない。
    // 注(2026-07-19): 旧 Playmat 削除で .playmat*/.hand__*/.stack__*/.mobile-* は全て死CSS化した。
    // この pin は旧3カラム 6 クラスの不在のみを見る。残る死CSS(~580行)の一掃は
    // docs/ui-architecture-v2.md §6 の D4 App.css purge 追跡項目。
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
