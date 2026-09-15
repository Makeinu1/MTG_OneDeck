import fs from 'node:fs';

const path = 'scripts/r3-1/fix-final-audit.mjs';
let source = fs.readFileSync(path, 'utf8');
source = source
  .replaceAll('${label(ability)}', '\\${label(ability)}')
  .replaceAll('${index + 1}', '\\${index + 1}');
fs.writeFileSync(path, source);
await import('./fix-final-audit.mjs?escaped=1');
