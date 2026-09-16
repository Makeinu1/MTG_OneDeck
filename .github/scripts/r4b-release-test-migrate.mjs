import { readFileSync, writeFileSync } from 'node:fs';

function update(path, transform) {
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after !== before) writeFileSync(path, after);
}

const requestHelper = `
const R4B_MANUAL_EVENT_TYPES = new Set(['move', 'draw', 'tap', 'life', 'counter']);
function r4bTestRequestBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const value = body as Record<string, unknown>;
  if (value.type !== 'commit') return body;
  const operation = value.operation as { type?: string; sourceId?: string } | undefined;
  const history = operation?.type === 'undo' || operation?.type === 'redo';
  const manualEvent =
    Boolean(operation?.type && R4B_MANUAL_EVENT_TYPES.has(operation.type)) ||
    (operation?.type === 'damage' && typeof operation.sourceId === 'string');
  return {
    ...value,
    protocolVersion: 2,
    ...(!history ? { context: value.context ?? { kind: 'unbound' } } : {}),
    ...(manualEvent && value.declaredCause === undefined
      ? { declaredCause: { kind: 'manual-event' } }
      : {}),
  };
}
`;

for (const path of [
  'src/online/cloudflare/__tests__/cockpitSession.test.ts',
  'src/online/cloudflare/__tests__/cockpitTtlPolicy.test.ts',
  'src/online/cloudflare/__tests__/cockpitLibraryPeekSession.test.ts',
  'src/online/cloudflare/__tests__/cockpitR4ActivateSession.test.ts',
  'src/online/cloudflare/__tests__/cockpitR4EntrySession.test.ts',
  'src/online/cloudflare/__tests__/cockpitR4ManualTriggerSession.test.ts',
  'src/online/cloudflare/__tests__/cockpitR4StateSession.test.ts',
]) {
  update(path, (source) => {
    if (source.includes('function r4bTestRequestBody(')) return source;
    const marker = 'function request(body: unknown): Request {';
    const index = source.indexOf(marker);
    if (index < 0) throw new Error(`request helper missing: ${path}`);
    let next = source.slice(0, index) + requestHelper + '\n' + source.slice(index);
    const old = 'body: JSON.stringify(body),';
    if (!next.includes(old)) throw new Error(`JSON body anchor missing: ${path}`);
    return next.replace(old, 'body: JSON.stringify(r4bTestRequestBody(body)),');
  });
}

update('src/components/game/CockpitPrimaryAction.test.tsx', (source) =>
  source.replace(
    "expect(screen.send).toHaveBeenLastCalledWith({ type: 'resolve.begin' });",
    "expect(screen.send).toHaveBeenLastCalledWith({ type: 'resolve.begin', entryId: 'primary-stack-entry' });",
  ),
);

update('src/components/game/CockpitSelectionToolsLibrary.test.tsx', (source) =>
  source.replace(
    "      to: 'graveyard',\n      position: 'top',\n    });",
    "      to: 'graveyard',\n      position: 'top',\n      reason: 'mill',\n    }, { kind: 'unbound' });",
  ),
);

update('src/test/architecture/review.o4p-06f-four-browser-production-release.test.ts', (source) =>
  source.replace(
    "      './remote-priority-journey-evidence.ts',\n    ]);",
    "      './remote-priority-journey-evidence.ts',\n      './r4-ui-browser-evidence.ts',\n      './r4-ui-evidence-harness.tsx',\n    ]);",
  ),
);

const architectureFiles = [
  'src/test/architecture/review.o4p-03a-cloudflare-runtime-persistence-boundary.test.ts',
  'src/test/architecture/review.o4p-03b-websocket-recovery-boundary.test.ts',
  'src/test/architecture/review.o4p-03c-capability-abuse-control-boundary.test.ts',
  'src/test/architecture/review.o4p-06d-browser-websocket-recovery-boundary.test.ts',
  'src/test/architecture/review.o4p-07a-dynamic-card-resolution-boundary.test.ts',
];

for (const path of architectureFiles) {
  update(path, (source) => {
    let next = source;
    if (!next.includes("'src/online/cloudflare/cockpitR4bAudit.ts'")) {
      next = next.replace(
        "      'src/online/cloudflare/cockpitMultiplayer.ts',\n",
        "      'src/online/cloudflare/cockpitMultiplayer.ts',\n      'src/online/cloudflare/cockpitR4Authority.ts',\n      'src/online/cloudflare/cockpitR4bAudit.ts',\n      'src/online/cloudflare/cockpitR4bSession.ts',\n",
      );
    }
    next = next.replace(
      "            '../../engine/cockpitMigration',\n            '../../engine/init',",
      "            '../../engine/cockpitMigration',\n            '../../engine/cockpitR31',\n            '../../engine/cockpitR4',\n            '../../engine/cockpitR4b',\n            '../../engine/init',",
    );
    if (!next.includes('const cockpitR4AuthorityImport =')) {
      const cockpitImportIndex = next.indexOf('        const cockpitImport =');
      if (cockpitImportIndex < 0) throw new Error(`cockpitImport missing: ${path}`);
      const expectIndex = next.indexOf('        expect(', cockpitImportIndex);
      if (expectIndex < 0) throw new Error(`import assertion missing: ${path}`);
      const prefix = next.slice(0, cockpitImportIndex);
      const iterator = prefix.includes('for (const filePath of productionFiles')
        ? 'filePath'
        : prefix.includes('for (const path of productionFiles')
          ? 'path'
          : 'file';
      const predicates = `        const cockpitR4AuthorityImport =\n          normalized(${iterator}) === 'src/online/cloudflare/cockpitR4Authority.ts' &&\n          ['../../engine/cockpitTable', '../../engine/commands', '../../engine/cockpitR4'].includes(specifier);\n        const cockpitR4bAuditImport =\n          normalized(${iterator}) === 'src/online/cloudflare/cockpitR4bAudit.ts' &&\n          ['../../engine/cockpitTable', '../../engine/cockpitR4b'].includes(specifier);\n        const cockpitR4bSessionImport =\n          normalized(${iterator}) === 'src/online/cloudflare/cockpitR4bSession.ts' &&\n          ['../../engine/cockpitR31', '../../engine/cockpitR4', '../../engine/cockpitR4b', '../../engine/cockpitTable', '../../engine/cockpitTriggers', '../../engine/types'].includes(specifier);\n`;
      next = next.slice(0, expectIndex) + predicates + next.slice(expectIndex);
    }
    next = next.replace(
      /local \|\| allowed(?:Imports)?\.has\(specifier\) \|\| cockpitImport \|\| cockpitMultiplayerImport/g,
      (match) => `${match} || cockpitR4AuthorityImport || cockpitR4bAuditImport || cockpitR4bSessionImport`,
    );
    return next;
  });
}
