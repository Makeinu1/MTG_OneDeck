/**
 * review.s0-contrast — S0 テーマparity基礎のコントラスト契約(判定者専有)。
 * tokens.css のライトテーマ override が最低コントラストを満たすことを検証する。
 * jsdom は cascade を解決しないため、tokens.css を直接パースして hex 値を抽出し計算する。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const tokensPath = path.resolve(here, '../tokens.css');

function relativeLuminance(hex: string): number {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.substring(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg: string, bg: string): number {
  const [l1, l2] = [relativeLuminance(fg), relativeLuminance(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Extract hex values from the :root[data-theme='light'] block in tokens.css. */
function lightTokens(): Record<string, string> {
  const css = readFileSync(tokensPath, 'utf-8');
  const match = /:root\[data-theme='light'\]\s*\{([^}]+)\}/.exec(css);
  if (!match) throw new Error('light theme block not found in tokens.css');
  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const m = /--([\w-]+):\s*(#[0-9a-fA-F]{6})/.exec(line);
    if (m) result[m[1]] = m[2];
  }
  return result;
}

describe('S0 light theme contrast contract', () => {
  const t = lightTokens();

  it('action-primary + action-primary-text ≥ 7:1', () => {
    expect(t['action-primary']).toBeDefined();
    expect(t['action-primary-text']).toBeDefined();
    expect(contrastRatio(t['action-primary'], t['action-primary-text'])).toBeGreaterThanOrEqual(7);
  });

  it('text-dim on surface-0 ≥ 4.5:1', () => {
    expect(t['text-dim']).toBeDefined();
    expect(t['surface-0']).toBeDefined();
    expect(contrastRatio(t['text-dim'], t['surface-0'])).toBeGreaterThanOrEqual(4.5);
  });

  it('warn on surface-0 ≥ 4.5:1', () => {
    expect(t['warn']).toBeDefined();
    expect(t['surface-0']).toBeDefined();
    expect(contrastRatio(t['warn'], t['surface-0'])).toBeGreaterThanOrEqual(4.5);
  });

  it('stack-glow-c on surface-0 ≥ 4.5:1 (text use)', () => {
    expect(t['stack-glow-c']).toBeDefined();
    expect(t['surface-0']).toBeDefined();
    expect(contrastRatio(t['stack-glow-c'], t['surface-0'])).toBeGreaterThanOrEqual(4.5);
  });

  it('white on stack-glow-c ≥ 4.5:1 (badge text)', () => {
    expect(t['stack-glow-c']).toBeDefined();
    expect(contrastRatio('#ffffff', t['stack-glow-c'])).toBeGreaterThanOrEqual(4.5);
  });

  it('stack-glow light override exists (not inherited from dark)', () => {
    const css = readFileSync(tokensPath, 'utf-8');
    const lightBlock = /:root\[data-theme='light'\]\s*\{([^}]+)\}/.exec(css)?.[1] ?? '';
    expect(lightBlock).toContain('--stack-glow:');
  });
});
