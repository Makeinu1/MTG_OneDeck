import { execFileSync } from 'node:child_process';

const DIFF_FILTER = 'ACDMRTUXB';

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function resolveCommit(cwd, ref) {
  try {
    return git(cwd, ['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  } catch {
    throw new Error(`invalid git ref: ${ref}`);
  }
}

function assertAncestor(cwd, base, head) {
  try {
    git(cwd, ['merge-base', '--is-ancestor', base, head]);
  } catch {
    throw new Error(`base is not an ancestor of head: ${base} -> ${head}`);
  }
}

function parseNameStatus(output) {
  const tokens = output.split('\0').filter(Boolean);
  const paths = [];
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index];
    index += 1;
    if (status.startsWith('R') || status.startsWith('C')) {
      if (tokens[index] !== undefined) paths.push(tokens[index]);
      if (tokens[index + 1] !== undefined) paths.push(tokens[index + 1]);
      index += 2;
    } else if (tokens[index] !== undefined) {
      paths.push(tokens[index]);
      index += 1;
    }
  }
  return paths;
}

function normalizePath(path) {
  const normalized = path.replaceAll('\\', '/').replace(/^\.\//, '');
  if (normalized.startsWith('/') || normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`unsafe changed path: ${path}`);
  }
  return normalized;
}

function diffPaths(cwd, args) {
  return parseNameStatus(git(cwd, ['diff', '--name-status', '-z', `--diff-filter=${DIFF_FILTER}`, ...args]));
}

export function collectChangedFiles({ cwd, base, head = 'HEAD' } = {}) {
  if (!cwd) throw new Error('collectChangedFiles requires cwd');
  if (head === undefined || head === '') throw new Error('head must not be empty');
  if (base !== undefined && base !== null && base !== '' && head === '') throw new Error('head must not be empty');

  const headSha = resolveCommit(cwd, head);
  const mode = base === undefined || base === null || base === '' ? 'working-tree-only' : 'base-aware';
  const baseSha = mode === 'base-aware' ? resolveCommit(cwd, base) : null;
  if (baseSha) assertAncestor(cwd, baseSha, headSha);
  const paths = [];
  if (baseSha) paths.push(...diffPaths(cwd, [`${baseSha}...${headSha}`]));
  paths.push(...diffPaths(cwd, ['--cached']));
  paths.push(...diffPaths(cwd, []));
  paths.push(...git(cwd, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean));

  const files = [...new Set(paths.map(normalizePath))].sort();
  return { mode, base: baseSha, head: headSha, files };
}

export { normalizePath, parseNameStatus };
