#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { collectChangedFiles } from './change-detector.mjs';

const excluded = new Set([
  'research/archive/document-reset-2026-08/audit-brief.md',
  'research/archive/document-reset-2026-08/cold-audit-findings.md',
]);

function hashField(hash, label, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  hash.update(`${label}\0${bytes.byteLength}\0`);
  hash.update(bytes);
  hash.update('\0');
}

export function candidateFingerprint({ cwd = process.cwd(), base, head = 'HEAD' } = {}) {
  const changes = collectChangedFiles({ cwd, base, head });
  const checkoutHead = execFileSync('git', ['rev-parse', '--verify', 'HEAD^{commit}'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  if (changes.head !== checkoutHead) throw new Error('fingerprint head must match checkout HEAD');
  const files = changes.files.filter((file) => !excluded.has(file));
  const hash = createHash('sha256');
  hashField(hash, 'schema', 'candidate-fingerprint-v3');
  hashField(hash, 'mode', changes.mode);
  hashField(hash, 'base', changes.base ?? 'working-tree-only');
  hashField(hash, 'head', changes.head);
  for (const file of files) {
    hashField(hash, 'path', file);
    const indexEntry = execFileSync('git', ['ls-files', '--stage', '-z', '--', file], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    hashField(hash, 'index-entry', indexEntry.length === 0 ? 'untracked' : indexEntry);
    try {
      const absolutePath = resolve(cwd, file);
      const stat = lstatSync(absolutePath);
      hashField(hash, 'mode-bits', stat.mode.toString(8));
      if (stat.isSymbolicLink()) {
        hashField(hash, 'kind', 'symlink');
        hashField(hash, 'target', readlinkSync(absolutePath));
      } else if (stat.isFile()) {
        hashField(hash, 'kind', 'file');
        hashField(hash, 'bytes', readFileSync(absolutePath));
      } else {
        hashField(hash, 'kind', 'unsupported');
      }
    } catch (error) {
      if (error && typeof error === 'object' && error.code === 'ENOENT') {
        hashField(hash, 'kind', 'deleted');
        continue;
      }
      throw error;
    }
  }
  return hash.digest('hex');
}

const entryPath =
  process.argv[1] === undefined ? null : pathToFileURL(resolve(process.argv[1])).href;
if (entryPath === import.meta.url) console.log(candidateFingerprint());
