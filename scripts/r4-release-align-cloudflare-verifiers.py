from pathlib import Path

FILES = [
    Path('scripts/checks/verify-online-cloudflare-websocket-recovery.ts'),
    Path('scripts/checks/verify-online-cloudflare-capability-abuse-control.ts'),
    Path('scripts/checks/verify-online-cloudflare-production-gate.ts'),
]

inventory_old = "  'src/online/cloudflare/cockpitMultiplayer.ts',  'src/online/cloudflare/cockpitSession.ts',\n"
inventory_new = """  'src/online/cloudflare/cockpitMultiplayer.ts',
  'src/online/cloudflare/cockpitR4Authority.ts',
  'src/online/cloudflare/cockpitSession.ts',
"""

imports_old = """    const cockpitMultiplayerImport = normalized(path) === 'src/online/cloudflare/cockpitMultiplayer.ts' && ['../../engine/cockpitCardIdentity', '../../engine/cockpitTable', '../../engine/init', '../../engine/types'].includes(specifier);
    const cockpitImport = normalized(path) === 'src/online/cloudflare/cockpitSession.ts' &&
      ['../../engine/cockpitTable', '../../engine/cockpitMigration', '../../engine/init', '../../data/gameSnapshot'].includes(specifier);
    assert.equal(local || allowedImports.has(specifier) || cockpitImport || cockpitMultiplayerImport, true, `${normalized(path)} -> ${specifier}`);
"""
imports_new = """    const cockpitMultiplayerImport = normalized(path) === 'src/online/cloudflare/cockpitMultiplayer.ts' && ['../../engine/cockpitCardIdentity', '../../engine/cockpitTable', '../../engine/init', '../../engine/types'].includes(specifier);
    const cockpitR4AuthorityImport = normalized(path) === 'src/online/cloudflare/cockpitR4Authority.ts' &&
      ['../../engine/cockpitR4', '../../engine/cockpitTable', '../../engine/commands'].includes(specifier);
    const cockpitImport = normalized(path) === 'src/online/cloudflare/cockpitSession.ts' &&
      ['../../engine/cockpitTable', '../../engine/cockpitMigration', '../../engine/cockpitR31', '../../engine/cockpitR4', '../../engine/init', '../../data/gameSnapshot'].includes(specifier);
    assert.equal(
      local || allowedImports.has(specifier) || cockpitImport || cockpitMultiplayerImport || cockpitR4AuthorityImport,
      true,
      `${normalized(path)} -> ${specifier}`,
    );
"""

for path in FILES:
    text = path.read_text()
    if text.count(inventory_old) != 1:
        raise SystemExit(f'{path}: production inventory anchor changed unexpectedly')
    if text.count(imports_old) != 1:
        raise SystemExit(f'{path}: import boundary anchor changed unexpectedly')
    text = text.replace(inventory_old, inventory_new, 1)
    text = text.replace(imports_old, imports_new, 1)
    path.write_text(text)
