import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { auditCockpitMutationIngress } from '../checks/check-cockpit-mutation-ingress.mjs';

function fixture(tableSurface, extra = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cockpit-ingress-'));
  mkdirSync(join(root, 'src/components/game'), { recursive: true });
  writeFileSync(join(root, 'src/components/game/CockpitTableSurface.tsx'), tableSurface);
  for (const [path, text] of Object.entries(extra)) {
    const full = join(root, path);
    mkdirSync(full.slice(0, full.lastIndexOf('/')), { recursive: true });
    writeFileSync(full, text);
  }
  return root;
}

const validSurface = `
dragContextRef.current = captureExpectedInteractionContext(table);
send(operation, dragContext ?? captureExpectedInteractionContext(table));
send(operation, dragContext ?? captureExpectedInteractionContext(table));
`;

describe('Cockpit mutation ingress guard', () => {
  test('accepts the current authority pattern', () => {
    expect(auditCockpitMutationIngress({ root: fixture(validSurface) })).toEqual([]);
  });

  test('rejects legacy raw mutation commits from UI components', () => {
    const root = fixture(validSurface, {
      'src/components/Unsafe.tsx': "client.commit({ type: 'move', ids: ['x'] })",
    });
    expect(auditCockpitMutationIngress({ root })).toContainEqual(
      expect.objectContaining({ kind: 'RAW_MUTATION_COMMIT', operation: 'move' }),
    );
  });

  test('rejects the retired source-less damage correction surface', () => {
    const root = fixture(validSurface, {
      'src/components/game/Legacy.tsx': '          記録ダメージを訂正',
    });
    expect(auditCockpitMutationIngress({ root })).toContainEqual(
      expect.objectContaining({ kind: 'SOURCELESS_DAMAGE_CORRECTION' }),
    );
  });

  test('fails closed when drag interaction context capture regresses', () => {
    const root = fixture('send(operation);');
    const kinds = auditCockpitMutationIngress({ root }).map((finding) => finding.kind);
    expect(kinds).toContain('MISSING_DRAG_CONTEXT_CAPTURE');
    expect(kinds).toContain('INSUFFICIENT_DRAG_CONTEXT_USE');
  });
});
