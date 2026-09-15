import fs from 'node:fs';

function patch(path, changes) {
  let text = fs.readFileSync(path, 'utf8');
  for (const [from, to] of changes) {
    if (!text.includes(from)) {
      if (text.includes(to)) continue;
      throw new Error(`missing patch anchor in ${path}: ${from.slice(0, 140)}`);
    }
    text = text.replace(from, to);
  }
  fs.writeFileSync(path, text);
}

patch('src/components/game/CockpitSessionScreen.tsx', [
  [
`import {
  captureExpectedInteractionContext,
  type R31TableOperation,
} from '../../engine/cockpitR31';`,
`import {
  captureExpectedInteractionContext,
  type ExpectedInteractionContext,
  type R31TableOperation,
} from '../../engine/cockpitR31';`,
  ],
  [
`  const [ability, setAbility] = useState<string | null>(null);
  const [abilityChoice, setAbilityChoice] = useState<string | undefined>();`,
`  const [ability, setAbility] = useState<string | null>(null);
  const [abilityChoice, setAbilityChoice] = useState<string | undefined>();
  const [abilityContext, setAbilityContext] = useState<ExpectedInteractionContext | null>(null);`,
  ],
  [
`    targetLost?: boolean;
  } | null>(null);`,
`    targetLost?: boolean;
    context: ExpectedInteractionContext;
  } | null>(null);`,
  ],
  [
`    paymentPlan: GameCommand[];
    error: string;
  } | null>(null);`,
`    paymentPlan: GameCommand[];
    error: string;
    context: ExpectedInteractionContext;
  } | null>(null);`,
  ],
  [
`  async function send(
    operation: TableOperation | R31TableOperation | { type: 'undo' } | { type: 'redo' },
  ) {`,
`  async function send(
    operation: TableOperation | R31TableOperation | { type: 'undo' } | { type: 'redo' },
    expectedContext?: ExpectedInteractionContext,
  ) {`,
  ],
  [
`      const context =
        operation.type === 'undo' || operation.type === 'redo' || !before
          ? undefined
          : captureExpectedInteractionContext(before);`,
`      const context =
        operation.type === 'undo' || operation.type === 'redo'
          ? undefined
          : expectedContext ?? (before ? captureExpectedInteractionContext(before) : undefined);`,
  ],
  [
`    if (attachment && attachment.source !== source) return;
    setAttachment({ source, version: card.zoneChangeCounter, target: null });`,
`    if (attachment && attachment.source !== source) return;
    setAttachment({
      source,
      version: card.zoneChangeCounter,
      target: null,
      context: attachment?.context ?? captureExpectedInteractionContext(table),
    });`,
  ],
  [
`      paymentPlan,
      error,
    });`,
`      paymentPlan,
      error,
      context:
        cast?.cardId === cardId ? cast.context : captureExpectedInteractionContext(table),
    });`,
  ],
  [
`                  void send({
                    type: 'attach',
                    cardId: attachment.source,
                    targetId: attachment.target,
                  }).then((saved) => {`,
`                  void send(
                    {
                      type: 'attach',
                      cardId: attachment.source,
                      targetId: attachment.target,
                    },
                    attachment.context,
                  ).then((saved) => {`,
  ],
  [
`        activate={(id, choice) => {
          setAbilityChoice(choice);
          setAbilityPeek(false);
          setAbility(id);
        }}`,
`        activate={(id, choice) => {
          setAbilityChoice(choice);
          setAbilityContext(captureExpectedInteractionContext(table));
          setAbilityPeek(false);
          setAbility(id);
        }}`,
  ],
  [
`          title={\`《${label(ability)}》の能力\`}
          onClose={() => setAbility(null)}`, 
`          title={\`《${label(ability)}》の能力\`}
          onClose={() => {
            setAbility(null);
            setAbilityContext(null);
          }}`,
  ],
  [
`            send={async (operation) => {
              const saved = await send(operation);
              if (saved) setAbility(null);
              return saved;
            }}`,
`            send={async (operation) => {
              const saved = await send(
                operation,
                abilityContext ?? captureExpectedInteractionContext(table),
              );
              if (saved) {
                setAbility(null);
                setAbilityContext(null);
              }
              return saved;
            }}`,
  ],
  [
`          <button onClick={() => setAbility(null)}>能力の使用をやめる</button>`,
`          <button
            onClick={() => {
              setAbility(null);
              setAbilityContext(null);
            }}
          >
            能力の使用をやめる
          </button>`,
  ],
  [
`                  void send({
                    type: 'cast',
                    cardId: cast.cardId,
                    targets: cast.targets,
                    x: cast.x,
                    excludedSourceIds: cast.excludedSourceIds,
                    manualManaCost: cast.manualManaCost,
                    costNote: cast.costNote,
                    paymentPlan: cast.paymentPlan,
                  }).then((saved) => {`,
`                  void send(
                    {
                      type: 'cast',
                      cardId: cast.cardId,
                      targets: cast.targets,
                      x: cast.x,
                      excludedSourceIds: cast.excludedSourceIds,
                      manualManaCost: cast.manualManaCost,
                      costNote: cast.costNote,
                      paymentPlan: cast.paymentPlan,
                    },
                    cast.context,
                  ).then((saved) => {`,
  ],
]);

patch('src/components/game/CockpitSelectionTools.tsx', [
  [
`import type { CockpitTable, TableOperation } from '../../engine/cockpitTable';`,
`import type { CockpitTable, TableOperation } from '../../engine/cockpitTable';
import {
  captureExpectedInteractionContext,
  type ExpectedInteractionContext,
} from '../../engine/cockpitR31';`,
  ],
  [
`  send: (operation: TableOperation) => Promise<boolean>;`,
`  send: (
    operation: TableOperation,
    context?: ExpectedInteractionContext,
  ) => Promise<boolean>;`,
  ],
  [
`    peekOwned?: boolean;
    rows: { id: string; to: 'top' | 'bottom' | 'graveyard' }[];`,
`    peekOwned?: boolean;
    context: ExpectedInteractionContext;
    rows: { id: string; to: 'top' | 'bottom' | 'graveyard' }[];`,
  ],
  [
`  const [proliferate, setProliferate] = useState<string[] | null>(null);`,
`  const [proliferate, setProliferate] = useState<{
    ids: string[];
    context: ExpectedInteractionContext;
  } | null>(null);`,
  ],
  [
`  function openArrange(source: CockpitTable, kind: '占術' | '諜報', peekOwned = false): boolean {`,
`  function openArrange(
    source: CockpitTable,
    kind: '占術' | '諜報',
    context: ExpectedInteractionContext,
    peekOwned = false,
  ): boolean {`,
  ],
  [
`      rows: examined.map((id) => ({ id, to: 'top' })),
      peekOwned,`,
`      rows: examined.map((id) => ({ id, to: 'top' })),
      peekOwned,
      context,`,
  ],
  [
`  async function startArrange(kind: '占術' | '諜報'): Promise<void> {
    if (!libraryAccess || hasCockpitLibraryAccess(libraryAccess, count)) {
      openArrange(table, kind);`,
`  async function startArrange(kind: '占術' | '諜報'): Promise<void> {
    const context = captureExpectedInteractionContext(table);
    if (!libraryAccess || hasCockpitLibraryAccess(libraryAccess, count)) {
      openArrange(table, kind, context);`,
  ],
  [
`    if (!openArrange(next, kind, true)) await libraryAccess.release();`,
`    if (!openArrange(next, kind, context, true)) await libraryAccess.release();`,
  ],
  [
`  async function mill(): Promise<void> {
    let source = table;`,
`  async function mill(): Promise<void> {
    const context = captureExpectedInteractionContext(table);
    let source = table;`,
  ],
  [
`    await send({ type: 'move', ids, to: 'graveyard', position: 'top', reason: 'mill' });`,
`    await send(
      { type: 'move', ids, to: 'graveyard', position: 'top', reason: 'mill' },
      context,
    );`,
  ],
  [
`        <button disabled={disabled} onClick={() => setProliferate([])}>
          増殖の候補を選ぶ
        </button>`,
`        <button
          disabled={disabled}
          onClick={() =>
            setProliferate({ ids: [], context: captureExpectedInteractionContext(table) })
          }
        >
          増殖の候補を選ぶ
        </button>`,
  ],
  [
`              void send({
                type: 'arrange',
                seatId: arrange.seatId,
                examined: arrange.examined,
                top: arrange.rows.filter((row) => row.to === 'top').map((row) => row.id),
                bottom: arrange.rows.filter((row) => row.to === 'bottom').map((row) => row.id),
                graveyard: arrange.rows
                  .filter((row) => row.to === 'graveyard')
                  .map((row) => row.id),
              }).then((saved) => {`,
`              void send(
                {
                  type: 'arrange',
                  seatId: arrange.seatId,
                  examined: arrange.examined,
                  top: arrange.rows.filter((row) => row.to === 'top').map((row) => row.id),
                  bottom: arrange.rows.filter((row) => row.to === 'bottom').map((row) => row.id),
                  graveyard: arrange.rows
                    .filter((row) => row.to === 'graveyard')
                    .map((row) => row.id),
                },
                arrange.context,
              ).then((saved) => {`,
  ],
  [
`                checked={proliferate.includes(entry.id)}
                onChange={() =>
                  setProliferate(
                    proliferate.includes(entry.id)
                      ? proliferate.filter((id) => id !== entry.id)
                      : [...proliferate, entry.id],
                  )
                }`,
`                checked={proliferate.ids.includes(entry.id)}
                onChange={() =>
                  setProliferate({
                    ...proliferate,
                    ids: proliferate.ids.includes(entry.id)
                      ? proliferate.ids.filter((id) => id !== entry.id)
                      : [...proliferate.ids, entry.id],
                  })
                }`,
  ],
  [
`            disabled={disabled || !proliferate.length}
            onClick={() =>
              void send({
                type: 'proliferate',
                ids: proliferate.filter((id) => Object.hasOwn(table.cards, id)),
                seatIds: proliferate.filter((id) => table.seats.some((entry) => entry.id === id)),
              }).then((saved) => {`,
`            disabled={disabled || !proliferate.ids.length}
            onClick={() =>
              void send(
                {
                  type: 'proliferate',
                  ids: proliferate.ids.filter((id) => Object.hasOwn(table.cards, id)),
                  seatIds: proliferate.ids.filter((id) =>
                    table.seats.some((entry) => entry.id === id),
                  ),
                },
                proliferate.context,
              ).then((saved) => {`,
  ],
]);

patch('src/components/game/CockpitTableSurface.tsx', [
  [
`import type { R31TableOperation } from '../../engine/cockpitR31';`,
`import {
  canLifecycleResolveWithoutManual,
  defaultResolutionDestination,
  type R31TableOperation,
} from '../../engine/cockpitR31';`,
  ],
  [
`  const permanent =
    top?.kind === 'spell' &&
    /Creature|Artifact|Enchantment|Planeswalker|Battle/.test(
      table.defs[top.source.defId]?.faces[top.source.faceIndex]?.typeLine ?? '',
    );`,
`  const lifecycleOnly = Boolean(top && canLifecycleResolveWithoutManual(table, top));`,
  ],
  [
`      : permanent
        ? '解決して戦場に出す'`,
`      : lifecycleOnly
        ? '解決して戦場に出す'`,
  ],
  [
`    if (!manual && permanent) {`,
`    if (!manual && lifecycleOnly) {`,
  ],
  [
`    setDestination(permanent ? 'battlefield' : 'graveyard');`,
`    setDestination(defaultResolutionDestination(table, top));`,
  ],
  [
`              <li key={entry.id} className={index === 0 ? 'is-next' : ''}>`,
`              <li
                key={entry.id}
                className={
                  resolution?.id === entry.id || (!resolution && index === 0) ? 'is-next' : ''
                }
              >`,
  ],
  [
`                    {index === 0 ? (resolution ? '解決中' : '次に解決') : \`${index + 1}番目\`} ·{' '}`, 
`                    {resolution?.id === entry.id
                      ? '解決中'
                      : index === 0
                        ? resolution
                          ? '解決待ち'
                          : '次に解決'
                        : \`${index + 1}番目\`}{' '}
                    ·{' '}`,
  ],
  [
`              <label>
                処理後の行き先{' '}
                <select
                  value={destination}
                  onChange={(event) => setDestination(event.target.value as ZoneId)}
                >
                  {(
                    ['battlefield', 'graveyard', 'exile', 'hand', 'command', 'library'] as const
                  ).map((item) => (
                    <option key={item} value={item}>
                      {zoneNames[item]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={disabled}
                onClick={() =>
                  table.resolution &&
                  void send({
                    type: 'resolve.end',
                    entryId: table.resolution.id,
                    to: destination,
                  }).then((saved) => {
                    if (saved) setStack(false);
                  })
                }
              >
                解決を終える
              </button>`,
`              <button
                disabled={disabled}
                onClick={() =>
                  table.resolution &&
                  void send({
                    type: 'resolve.end',
                    entryId: table.resolution.id,
                    to: defaultResolutionDestination(table, table.resolution),
                  }).then((saved) => {
                    if (saved) setStack(false);
                  })
                }
              >
                処理完了
              </button>
              <details>
                <summary>終了方法…</summary>
                <label>
                  例外的な行き先{' '}
                  <select
                    value={destination}
                    onChange={(event) => setDestination(event.target.value as ZoneId)}
                  >
                    {(
                      ['battlefield', 'graveyard', 'exile', 'hand', 'command', 'library'] as const
                    ).map((item) => (
                      <option key={item} value={item}>
                        {zoneNames[item]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  disabled={disabled}
                  onClick={() =>
                    table.resolution &&
                    void send({
                      type: 'resolve.end',
                      entryId: table.resolution.id,
                      to: destination,
                    }).then((saved) => {
                      if (saved) setStack(false);
                    })
                  }
                >
                  指定した領域で処理完了
                </button>
              </details>`,
  ],
]);

patch('scripts/online/r31-resolution-uat.mjs', [
  [
`  await host.getByRole('button', { name: '解決を終える', exact: true }).click();`,
`  await host.getByRole('button', { name: '処理完了', exact: true }).click();`,
  ],
]);

console.log('R3.1 final audit fixes applied');
