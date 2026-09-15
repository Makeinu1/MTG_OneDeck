import fs from 'node:fs';

const path = 'scripts/r3-1/fix-final-audit.mjs';
let source = fs.readFileSync(path, 'utf8');
source = source
  .replaceAll('${label(ability)}', '\\${label(ability)}')
  .replaceAll('${index + 1}', '\\${index + 1}');
fs.writeFileSync(path, source);
await import('./fix-final-audit.mjs?escaped=1');

const uatPath = 'scripts/online/r31-resolution-uat.mjs';
let uat = fs.readFileSync(uatPath, 'utf8');
const from = `    pages.push(page);\n    await page.goto(origin);`;
const to = `    pages.push(page);\n    await page.route('https://api.scryfall.com/**', async (route) => {\n      await route.fulfill({\n        status: 200,\n        contentType: 'application/json',\n        headers: { 'access-control-allow-origin': '*' },\n        body: JSON.stringify({ object: 'list', has_more: false, data: [] }),\n      });\n    });\n    await page.goto(origin);`;
if (uat.includes(from)) uat = uat.replace(from, to);
else if (!uat.includes(to)) throw new Error('missing R3.1 UAT network-isolation anchor');
fs.writeFileSync(uatPath, uat);
