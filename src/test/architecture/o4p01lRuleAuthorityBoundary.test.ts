import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const rulesRoot = resolve(repositoryRoot, 'src/engine/core/rules');
const forbiddenImportFragments = [
  '/store',
  '/components',
  '/online',
  'react',
  'zustand',
  'cloudflare',
  'websocket',
  'indexeddb',
  'scryfall',
];

function sourceFiles(root: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

function violationsForFiles(files: readonly string[]): string[] {
  const violations: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    function visit(node: ts.Node): void {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const specifier = node.moduleSpecifier;
        if (specifier && ts.isStringLiteral(specifier)) {
          const value = specifier.text.toLowerCase();
          if (forbiddenImportFragments.some((fragment) => value.includes(fragment))) {
            violations.push(`${file}:import:${specifier.text}`);
          }
        }
      }
      if (ts.isCallExpression(node)) {
        const callee = node.expression.getText(source);
        if (callee === 'Date.now' || callee === 'Math.random')
          violations.push(`${file}:call:${callee}`);
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword)
          violations.push(`${file}:dynamic-import`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    if (/\bGameState\b|\bCardInstance\b/.test(text)) violations.push(`${file}:solo-alias`);
  }
  const objectFiles = sourceFiles(resolve(repositoryRoot, 'src/engine/core/object'));
  const turnFiles = sourceFiles(resolve(repositoryRoot, 'src/engine/core/turn'));
  for (const file of [...objectFiles, ...turnFiles]) {
    const text = readFileSync(file, 'utf8');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    ts.forEachChild(source, (node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        if (node.moduleSpecifier.text.replaceAll('\\', '/').includes('/rules')) {
          violations.push(`${file}:reverse-import:${node.moduleSpecifier.text}`);
        }
      }
    });
  }
  return violations.sort();
}

describe('O4P-01L rules architecture boundary', () => {
  it('keeps the rules slice mode-neutral and compiler-inspected', () => {
    expect(violationsForFiles(sourceFiles(rulesRoot))).toEqual([]);
  });

  it('detects a synthetic forbidden call with the same Compiler API walker', () => {
    const file = resolve(repositoryRoot, 'src/engine/core/rules/__synthetic-boundary-test.ts');
    const source = ts.createSourceFile(
      file,
      'export const value = Date.now() + Math.random();',
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const calls: string[] = [];
    function visit(node: ts.Node): void {
      if (ts.isCallExpression(node)) calls.push(node.expression.getText(source));
      ts.forEachChild(node, visit);
    }
    visit(source);
    expect(calls).toEqual(['Date.now', 'Math.random']);
  });

  it('does not require a product runtime or mutable browser boundary', () => {
    expect(
      readFileSync(
        resolve(repositoryRoot, 'src/engine/core/rules/ruleAuthorityBundleV1.ts'),
        'utf8',
      ),
    ).not.toMatch(/GameState|CardInstance|Date\.now|Math\.random/);
  });
});
