#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SOURCE_EXTENSIONS = /\.(?:js|jsx|ts|tsx)$/;
const RAW_MUTATION_COMMIT = /\.commit\([^)]{0,500}?type:\s*['"](move|life|tap|counter|draw)['"]/gs;
const LEGACY_DAMAGE_CORRECTION = '          記録ダメージを訂正';
const DRAG_CONTEXT_CAPTURE = 'dragContextRef.current = captureExpectedInteractionContext(table)';
const DRAG_CONTEXT_USE = 'dragContext ?? captureExpectedInteractionContext(table)';

function walkSourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkSourceFiles(path));
    else if (SOURCE_EXTENSIONS.test(entry.name)) files.push(path);
  }
  return files;
}

function countOccurrences(text, needle) {
  let count = 0;
  let offset = 0;
  while ((offset = text.indexOf(needle, offset)) !== -1) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

export function auditCockpitMutationIngress({ root = process.cwd() } = {}) {
  const findings = [];
  const components = resolve(root, 'src/components');
  for (const path of walkSourceFiles(components)) {
    const text = readFileSync(path, 'utf8');
    RAW_MUTATION_COMMIT.lastIndex = 0;
    const match = RAW_MUTATION_COMMIT.exec(text);
    if (match) {
      findings.push({
        kind: 'RAW_MUTATION_COMMIT',
        path: path.slice(root.length + 1).replaceAll('\\', '/'),
        operation: match[1],
      });
    }
  }

  const gameComponents = resolve(root, 'src/components/game');
  for (const path of walkSourceFiles(gameComponents)) {
    const text = readFileSync(path, 'utf8');
    if (text.includes(LEGACY_DAMAGE_CORRECTION)) {
      findings.push({
        kind: 'SOURCELESS_DAMAGE_CORRECTION',
        path: path.slice(root.length + 1).replaceAll('\\', '/'),
      });
    }
  }

  const tableSurfacePath = resolve(root, 'src/components/game/CockpitTableSurface.tsx');
  const tableSurface = readFileSync(tableSurfacePath, 'utf8');
  if (!tableSurface.includes(DRAG_CONTEXT_CAPTURE)) {
    findings.push({ kind: 'MISSING_DRAG_CONTEXT_CAPTURE', path: 'src/components/game/CockpitTableSurface.tsx' });
  }
  const dragUseCount = countOccurrences(tableSurface, DRAG_CONTEXT_USE);
  if (dragUseCount < 2) {
    findings.push({
      kind: 'INSUFFICIENT_DRAG_CONTEXT_USE',
      path: 'src/components/game/CockpitTableSurface.tsx',
      observed: dragUseCount,
      required: 2,
    });
  }

  return findings;
}

function runCli() {
  const findings = auditCockpitMutationIngress();
  if (findings.length === 0) {
    console.log('cockpit-mutation-ingress: PASS');
    return;
  }
  console.error('cockpit-mutation-ingress: FAIL');
  for (const finding of findings) console.error(JSON.stringify(finding));
  process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli();
