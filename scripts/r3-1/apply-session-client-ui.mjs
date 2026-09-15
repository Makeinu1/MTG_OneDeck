import fs from 'node:fs';

function patch(path, changes) {
  let text = fs.readFileSync(path, 'utf8');
  for (const [from, to] of changes) {
    if (!text.includes(from)) {
      if (text.includes(to)) continue;
      throw new Error(`missing patch anchor in ${path}: ${from.slice(0, 120)}`);
    }
    text = text.replace(from, to);
  }
  fs.writeFileSync(path, text);
}

patch('src/online/cloudflare/cockpitSession.ts', [
  [
`import {
  applyTableOperation,
  createCockpitTable,
  type CockpitTable,
  type TableOperation,
} from '../../engine/cockpitTable';`,
`import {
  applyTableOperation,
  createCockpitTable,
  type CockpitTable,
  type TableOperation,
} from '../../engine/cockpitTable';
import {
  applyR31TableOperation,
  type ExpectedInteractionContext,
  type R31TableOperation,
} from '../../engine/cockpitR31';`,
  ],
  [
`      operation: TableOperation | { type: 'undo' } | { type: 'redo' };
    }`,
`      operation: TableOperation | R31TableOperation | { type: 'undo' } | { type: 'redo' };
      context?: ExpectedInteractionContext;
    }`,
  ],
  [
`        const encodedOperation = JSON.stringify(
          body.type === 'commit' ? body.operation : body.control,
        );`,
`        const encodedOperation = JSON.stringify(
          body.type === 'commit'
            ? { operation: body.operation, ...(body.context ? { context: body.context } : {}) }
            : body.control,
        );`,
  ],
  [
`              record.table = applyTableOperation(before, body.operation, body.requestId);
              const operation = body.operation;`,
`              record.table = body.context
                ? applyR31TableOperation(
                    before,
                    { operation: body.operation as R31TableOperation, context: body.context },
                    body.requestId,
                  )
                : applyTableOperation(before, body.operation, body.requestId);
              const operation = body.operation;`,
  ],
]);

patch('src/online/browser/cockpitClient.ts', [
  [
`import type { TableOperation } from '../../engine/cockpitTable';`,
`import type { TableOperation } from '../../engine/cockpitTable';
import type {
  ExpectedInteractionContext,
  R31TableOperation,
} from '../../engine/cockpitR31';`,
  ],
  [
`  async commit(operation: TableOperation | { type: 'undo' } | { type: 'redo' }): Promise<void> {
    await this.submit(operation, false);
  }
  private async submit(
    operation: TableOperation | { type: 'undo' } | { type: 'redo' } | CockpitControl,
    control: boolean,
  ): Promise<void> {`,
`  async commit(
    operation: TableOperation | R31TableOperation | { type: 'undo' } | { type: 'redo' },
    context?: ExpectedInteractionContext,
  ): Promise<void> {
    await this.submit(operation, false, context);
  }
  private async submit(
    operation: TableOperation | R31TableOperation | { type: 'undo' } | { type: 'redo' } | CockpitControl,
    control: boolean,
    context?: ExpectedInteractionContext,
  ): Promise<void> {`,
  ],
  [
`      ...(control ? { control: operation } : { operation }),
    } as CockpitSessionRequest & { requestId: string };`,
`      ...(control
        ? { control: operation }
        : { operation, ...(context ? { context } : {}) }),
    } as CockpitSessionRequest & { requestId: string };`,
  ],
  [
`        digest: await inputDigest(operation),`,
`        digest: await inputDigest({ operation, ...(context ? { context } : {}) }),`,
  ],
]);

patch('src/components/game/CockpitSessionScreen.tsx', [
  [
`import type { ZoneId } from '../../engine/types';`,
`import type { ZoneId } from '../../engine/types';
import {
  captureExpectedInteractionContext,
  type R31TableOperation,
} from '../../engine/cockpitR31';`,
  ],
  [
`  async function send(operation: TableOperation | { type: 'undo' } | { type: 'redo' }) {`,
`  async function send(
    operation: TableOperation | R31TableOperation | { type: 'undo' } | { type: 'redo' },
  ) {`,
  ],
  [
`      await clientRef.current?.commit(operation);`,
`      const context =
        operation.type === 'undo' || operation.type === 'redo' || !before
          ? undefined
          : captureExpectedInteractionContext(before);
      await clientRef.current?.commit(operation, context);`,
  ],
]);

patch('src/components/game/CockpitTableSurface.tsx', [
  [
`import type { ZoneId } from '../../engine/types';`,
`import type { ZoneId } from '../../engine/types';
import type { R31TableOperation } from '../../engine/cockpitR31';`,
  ],
  [
`  send: (op: TableOperation | { type: 'undo' } | { type: 'redo' }) => Promise<boolean>;`,
`  send: (
    op: TableOperation | R31TableOperation | { type: 'undo' } | { type: 'redo' },
  ) => Promise<boolean>;`,
  ],
  [
`    void send({ type: 'resolve.begin' }).then((saved) => {
      if (saved) setWork(true);
    });`,
`    void send({ type: 'resolve.begin', entryId: top.id }).then((saved) => {
      if (saved) setWork(true);
    });`,
  ],
  [
`                  void send({ type: 'resolve.end', to: destination }).then((saved) => {
                    if (saved) setStack(false);
                  })`,
`                  table.resolution &&
                  void send({
                    type: 'resolve.end',
                    entryId: table.resolution.id,
                    to: destination,
                  }).then((saved) => {
                    if (saved) setStack(false);
                  })`,
  ],
]);

console.log('R3.1 session/client/UI patch applied');
