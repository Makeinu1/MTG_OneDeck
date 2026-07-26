/**
 * review.av3-legacy-removal — 旧celebrationのproduction callerを残さない判定者専有ピン。
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function productionFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return productionFiles(path);
    if (!/\.(ts|tsx)$/.test(entry) || /\.test\./.test(entry)) return [];
    return [path];
  });
}

describe('AV3 legacy-celebration removal', () => {
  it('has no production callers for primary/draw/resolve/chain celebration sounds', () => {
    const source = productionFiles(resolve(ROOT, 'src')).map((path) =>
      readFileSync(path, 'utf8'),
    ).join('\n');
    for (const effect of ['primary', 'draw', 'resolve', 'chain']) {
      expect(source).not.toContain(`celebrate('${effect}')`);
    }
    expect(source).not.toContain('game-card--celebrate');
    expect(source).not.toContain('stack-band--flash');
    expect(source).not.toContain('chain-celebration');
  });
});
