import { readFileSync, writeFileSync } from 'node:fs';

function update(path, transform) {
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`no migration applied: ${path}`);
  writeFileSync(path, after);
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
    next = next.replace(old, 'body: JSON.stringify(r4bTestRequestBody(body)),');
    return next;
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
