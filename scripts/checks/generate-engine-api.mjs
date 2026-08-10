#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../..');
const outputPath = join(root, 'docs/generated/engine-api.md');

function sourceFiles(directory) {
  const files = [];
  for (const name of readdirSync(directory)) {
    const file = join(directory, name);
    if (statSync(file).isDirectory()) files.push(...sourceFiles(file));
    else if (file.endsWith('.ts')) files.push(file);
  }
  return files;
}

function exportedLines(file) {
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line, index) => ({ line, index: index + 1 }))
    .filter(({ line }) => /^export\s+(?:declare\s+)?(?:type|interface|const|function|class|enum|abstract\s+class)\b/.test(line.trim()));
}

export function renderEngineApi() {
  const files = [...sourceFiles(join(root, 'src/engine')), join(root, 'src/store/gameStore.ts')]
    .filter(existsSync)
    .sort();
  const lines = [
    '# Generated engine API index',
    '',
    'This index is generated from TypeScript export declarations. Semantic meaning is defined by the domain contracts in `docs/contracts/engine/`.',
    '',
  ];
  for (const file of files) {
    const exports = exportedLines(file);
    if (exports.length === 0) continue;
    lines.push(`## \`${relative(root, file)}\``);
    lines.push('');
    for (const item of exports) lines.push(`- line ${item.index}: \`${item.line.trim()}\``);
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

function run() {
  const rendered = renderEngineApi();
  if (process.argv.includes('--check')) {
    const current = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '';
    if (current !== rendered) {
      console.error(`Generated API is stale: ${relative(root, outputPath)}`);
      process.exitCode = 1;
    } else console.log(`OK: ${relative(root, outputPath)} is current`);
    return;
  }
  writeFileSync(outputPath, rendered);
  console.log(`Wrote ${relative(root, outputPath)}`);
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) run();
