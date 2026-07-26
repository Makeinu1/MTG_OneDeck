/**
 * review.s2-forbidden-strings — S2 説明文廃止の恒久ガード(判定者専有)。
 * src/ 内の製品コードに操作説明・内部遷移の文章が残存しないことを機械走査する。
 * 対象外: aria-label 属性値・review.* テスト・docs/・*.draft.md・actionCatalog.ts のメニューラベル。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, '../..');

/** Forbidden patterns: user-action narration or internal-transition exposure. */
const FORBIDDEN: { pattern: RegExp; label: string }[] = [
  { pattern: /盤面へ移動して/, label: '盤面へ移動して' },
  { pattern: /土地をプレイ/, label: '土地をプレイ' },
  { pattern: /唱える\s*→\s*スタック/, label: '唱える → スタック' },
  { pattern: /対応を追加/, label: '対応を追加' },
  { pattern: /上から順に解決/, label: '上から順に解決' },
  { pattern: /ここに置くと/, label: 'ここに置くと' },
  { pattern: /ここへドロップ/, label: 'ここへドロップ' },
];

/** Files exempt from the scan (aria-label, review tests, menu labels, docs). */
function isExempt(filePath: string): boolean {
  const rel = path.relative(srcDir, filePath);
  return (
    rel.includes('review.') ||
    rel.includes('__tests__') ||
    rel.includes('.test.') ||
    rel.includes('actionCatalog.ts') ||
    rel.endsWith('.draft.md') ||
    rel.startsWith('dev/')
  );
}

function collectFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.git') continue;
      collectFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('S2 forbidden UI strings', () => {
  const files = collectFiles(srcDir).filter((f) => !isExempt(f));

  for (const { pattern, label } of FORBIDDEN) {
    it(`"${label}" does not appear in product source`, () => {
      const violations: string[] = [];
      for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          // Skip aria-label attribute values
          if (/aria-label=/.test(line)) return;
          if (pattern.test(line)) {
            violations.push(`${path.relative(srcDir, file)}:${i + 1}: ${line.trim().slice(0, 80)}`);
          }
        });
      }
      expect(violations).toEqual([]);
    });
  }
});
