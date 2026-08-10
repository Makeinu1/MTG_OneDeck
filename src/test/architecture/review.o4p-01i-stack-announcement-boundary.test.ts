import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

type SourceUnit = { readonly filePath: string; readonly sourceText: string };
type ImportReference = { readonly filePath: string; readonly specifier: string; readonly kind: string };

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const sourceRoot = resolve(repositoryRoot, 'src');
const coreRoot = resolve(sourceRoot, 'engine/core');
const stackRoot = resolve(coreRoot, 'stack');
const objectRoot = resolve(coreRoot, 'object');

function sourceUnits(root: string): SourceUnit[] {
  const units: SourceUnit[] = [];
  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', 'coverage', '__tests__'].includes(entry.name)) visit(resolve(directory, entry.name));
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
        const filePath = resolve(directory, entry.name);
        units.push({ filePath, sourceText: readFileSync(filePath, 'utf8') });
      }
    }
  }
  visit(root);
  return units;
}

function refs(unit: SourceUnit): ImportReference[] {
  const file = ts.createSourceFile(unit.filePath, unit.sourceText, ts.ScriptTarget.Latest, true);
  const result: ImportReference[] = [];
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      result.push({ filePath: unit.filePath, specifier: node.moduleSpecifier.text, kind: node.importClause?.isTypeOnly ? 'import-type' : 'import' });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      result.push({ filePath: unit.filePath, specifier: node.moduleSpecifier.text, kind: 're-export' });
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      result.push({ filePath: unit.filePath, specifier: node.arguments[0].text, kind: 'dynamic-import' });
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return result;
}

function resolveRelative(filePath: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(filePath), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

function rel(path: string): string {
  return relative(repositoryRoot, path).split('\\').join('/');
}

describe('O4P-01I isolated stack core boundary', () => {
  it('parses static, type-only, dynamic, and re-export imports and rejects forbidden runtime edges', () => {
    const probeRefs = refs({
      filePath: resolve(stackRoot, 'probe.ts'),
      sourceText: [
        "import value from './value';",
        "import type { Value } from './types';",
        "export { value as reExported } from './value';",
        "void import('./lazy');",
      ].join('\n'),
    });
    expect(probeRefs.map((reference) => reference.kind)).toEqual([
      'import', 'import-type', 're-export', 'dynamic-import',
    ]);
    const forbidden = /^(react|react-dom|zustand|idb|fake-indexeddb|jsdom|cloudflare:|ws|websocket|node:)/i;
    const forbiddenWords = /Cloudflare|WebSocket|IndexedDB|Scryfall|Date\.now|Math\.random|\b(?:React|Zustand|window|document)\b/;
    const violations: string[] = [];
    for (const unit of sourceUnits(stackRoot)) {
      if (forbiddenWords.test(unit.sourceText)) violations.push(`${rel(unit.filePath)}|forbidden-symbol`);
      for (const reference of refs(unit)) {
        const target = resolveRelative(unit.filePath, reference.specifier);
        if (forbidden.test(reference.specifier)) violations.push(`${rel(unit.filePath)}|${reference.kind}|${reference.specifier}`);
        if (target && (rel(target).startsWith('src/store/') || rel(target).startsWith('src/components/') || rel(target).startsWith('src/online/'))) {
          violations.push(`${rel(unit.filePath)}|${reference.kind}|${rel(target)}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('rejects Object Registry reverse imports while allowing the isolated stack directory', () => {
    const violations: string[] = [];
    for (const unit of sourceUnits(objectRoot)) {
      for (const reference of refs(unit)) {
        const target = resolveRelative(unit.filePath, reference.specifier);
        if (target && (target === resolve(stackRoot, 'index.ts') || target.startsWith(`${stackRoot}/`))) {
          violations.push(`${rel(unit.filePath)}|${reference.kind}|${rel(target)}`);
        }
      }
    }
    expect(violations).toEqual([]);
    expect(existsSync(stackRoot)).toBe(true);
  });

  it('keeps stack core absent from Online runtime, UI, persistence, and transport source trees', () => {
    expect(existsSync(resolve(sourceRoot, 'online'))).toBe(true);
    for (const directory of ['domain', 'server', 'transport', 'ui']) {
      expect(existsSync(resolve(sourceRoot, 'online', directory))).toBe(false);
    }
    expect(existsSync(resolve(sourceRoot, 'online/index.ts'))).toBe(false);
  });

  it('does not add command/event/protocol or payment lifecycle symbols to the isolated stack core', () => {
    const text = sourceUnits(stackRoot).map((unit) => unit.sourceText).join('\n');
    expect(text).not.toMatch(/\b(?:GameCommand|GameEvent|DecisionAuthority|CommandEnvelope|pendingPayment|paymentComplete|readyToResolve)\b/);
  });
});
