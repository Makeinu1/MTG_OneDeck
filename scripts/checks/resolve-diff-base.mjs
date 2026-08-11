import { execFileSync } from 'node:child_process';

const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const ALL_ZERO_SHA = /^0{40}$/;

function resolveCommit(ref, cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function isAncestor(base, head, cwd) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', base, head], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function resolveDiffBase({ before = '', head = 'HEAD', cwd = process.cwd() } = {}) {
  const headSha = resolveCommit(head, cwd);
  if (!headSha) {
    throw new Error(`invalid head commit: ${head || '<empty>'}`);
  }

  const normalizedBefore = before.trim();
  if (normalizedBefore && !ALL_ZERO_SHA.test(normalizedBefore)) {
    const beforeSha = resolveCommit(normalizedBefore, cwd);
    if (!beforeSha) {
      throw new Error(`invalid before commit: ${normalizedBefore}`);
    }
    if (!isAncestor(beforeSha, headSha, cwd)) {
      throw new Error(`before commit is not an ancestor of head: ${normalizedBefore}`);
    }
    return { base: beforeSha, head: headSha, reason: 'event.before' };
  }

  if (ALL_ZERO_SHA.test(normalizedBefore)) {
    return { base: EMPTY_TREE_SHA, head: headSha, reason: 'all-zero-before' };
  }

  const parentSha = resolveCommit(`${headSha}^`, cwd);
  return {
    base: parentSha ?? EMPTY_TREE_SHA,
    head: headSha,
    reason: parentSha ? 'head-parent' : 'empty-tree-fallback',
  };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--before' || argument === '--head') {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error(`${argument} requires a value`);
      }
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = resolveDiffBase(parseArgs(process.argv.slice(2)));
    process.stdout.write(`base=${result.base}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
