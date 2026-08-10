#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const excluded = new Set([
  'research/archive/document-reset-2026-08/audit-brief.md',
  'research/archive/document-reset-2026-08/cold-audit-findings.md',
]);

const tracked = execFileSync('git', ['diff', '--name-only', 'HEAD'], { encoding: 'utf8' })
  .split(/\r?\n/).filter(Boolean);
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split(/\r?\n/).filter(Boolean);
const files = [...new Set([...tracked, ...untracked])]
  .filter((file) => !excluded.has(file))
  .sort();
const material = files
  .map((file) => `${createHash('sha256').update(readFileSync(file)).digest('hex')}  ${file}`)
  .join('\n');
console.log(createHash('sha256').update(material).digest('hex'));
