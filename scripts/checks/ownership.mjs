const isReviewPath = (path) => /(^|\/|\.)review\./.test(path);

export function requiredOwner(path) {
  if (isReviewPath(path)) return 'judge';
  if (/^(?:AGENTS|CLAUDE|QWEN)\.md$/.test(path)) return 'judge';
  if (/^(?:docs|research|rule)\//.test(path)) return 'judge';
  if (path.startsWith('.agents/') || path.startsWith('.claude/')) return 'judge';
  if (path === 'package.json' || path === 'package-lock.json') return 'judge';
  if (path === 'eslint.config.js' || path.startsWith('.github/')) return 'judge';
  return 'implementer';
}

export function ownerViolation(path, owner) {
  const required = requiredOwner(path);
  if (owner === required || owner === 'judge') return null;
  return `${required === 'judge' ? 'Judge' : 'Implementer'}-owned path`;
}

export { isReviewPath };
