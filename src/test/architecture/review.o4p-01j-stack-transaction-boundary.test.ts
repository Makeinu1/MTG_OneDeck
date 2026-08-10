import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

type SourceFile = Readonly<{ path: string; text: string }>;

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const transactionRoot = resolve(repositoryRoot, 'src/engine/core/stack/transaction');
const coreRoot = resolve(repositoryRoot, 'src/engine/core');

function sourceFiles(root: string): SourceFile[] {
  if (!existsSync(root)) return [];
  const result: SourceFile[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...sourceFiles(path));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      result.push({ path, text: readFileSync(path, 'utf8') });
    }
  }
  return result;
}

function relativePath(path: string): string {
  return relative(repositoryRoot, path).split('\\').join('/');
}

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const pattern = /(?:from\s*|import\s*\()(['"])([^'"\n]+)\1/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) specifiers.push(match[2]);
  return specifiers;
}

function forbiddenText(source: SourceFile): string[] {
  const forbidden = [
    'Date.now',
    'Math.random',
    'crypto.',
    'fetch(',
    'WebSocket',
    'Cloudflare',
    'CURRENT_CONTRACT_VERSIONS',
    'SNAPSHOT_VERSION',
    'package-lock',
    'Solo',
    'GameState',
    'src/online',
    '/online/',
    '/solo/',
    'o4p-01g',
    'o4p-01h',
    'o4p-01i',
  ];
  return forbidden.filter((token) => source.text.includes(token)).map((token) => `${relativePath(source.path)} contains ${token}`);
}

describe('O4P-01J stack transaction architecture boundary', () => {
  it('requires the additive Core transaction module and keeps it inside the pure Core tree', () => {
    const transactionExists = existsSync(transactionRoot);
    expect(transactionExists).toBe(true);
    if (!transactionExists) return;
    expect(statSync(transactionRoot).isDirectory()).toBe(true);
    const sources = sourceFiles(transactionRoot).filter((source) => !source.path.includes('/__tests__/'));
    expect(sources.some((source) => source.path.endsWith('/index.ts'))).toBe(true);
    for (const source of sources) {
      expect(relativePath(source.path).startsWith('src/engine/core/stack/transaction/')).toBe(true);
      for (const specifier of importSpecifiers(source.text)) {
        expect(specifier.startsWith('.')).toBe(true);
        expect(specifier.includes('online')).toBe(false);
        expect(specifier.includes('solo')).toBe(false);
        expect(specifier.includes('src/engine/')).toBe(false);
        expect(specifier.includes('o4p-01g')).toBe(false);
        expect(specifier.includes('o4p-01h')).toBe(false);
        expect(specifier.includes('o4p-01i')).toBe(false);
      }
      expect(forbiddenText(source)).toEqual([]);
    }
  });

  it('does not add a reverse dependency from existing G/H/I, Solo, or Online source trees into the transaction module', () => {
    const existingCoreSources = sourceFiles(coreRoot).filter((source) =>
      !source.path.startsWith(`${transactionRoot}/`)
      && !source.path.endsWith('/stack/index.ts')
      && !source.path.endsWith('/core/index.ts'));
    const violations = existingCoreSources.flatMap((source) =>
      importSpecifiers(source.text)
        .filter((specifier) => specifier.includes('/transaction') || specifier.endsWith('/transaction'))
        .map((specifier) => `${relativePath(source.path)} imports ${specifier}`),
    );
    expect(violations).toEqual([]);
  });

  it('keeps the acceptance boundary free of production/package/network mutation mechanisms', () => {
    const productionFiles = sourceFiles(transactionRoot).filter((source) => !source.path.includes('/__tests__/'));
    const violations = productionFiles.flatMap((source) => forbiddenText(source));
    expect(violations).toEqual([]);
    expect(productionFiles.some((source) => source.text.includes('npm install'))).toBe(false);
    expect(productionFiles.some((source) => source.text.includes('writeFile'))).toBe(false);
  });
});
