import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}
function write(path, content) {
  fs.writeFileSync(path, content);
}
function replaceOnce(path, from, to) {
  const source = read(path);
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, got ${count}`);
  write(path, source.replace(from, to));
}

const client = 'src/online/browser/cockpitClient.ts';
replaceOnce(
  client,
  "import type { R4bDeclaredCause, R4bOperation } from '../../engine/cockpitR4b';",
  "import {\n  classifyR4bOperation,\n  type R4bDeclaredCause,\n  type R4bOperation,\n} from '../../engine/cockpitR4b';",
);
replaceOnce(
  client,
  "  async commit(\n    operation: TableOperation | R4TableOperation | { type: 'undo' } | { type: 'redo' },\n    context?: ExpectedInteractionContext,\n  ): Promise<void> {\n    if (\n      context &&\n      operation.type !== 'undo' &&\n      operation.type !== 'redo' &&\n      R4B_CONTEXTUAL_FORMAL_TYPES.has(operation.type)\n    ) {\n      await this.commitV2(operation as R4bOperation, context);\n      return;\n    }\n    await this.submit(operation, false, context);\n  }",
  "  async commit(\n    operation:\n      | TableOperation\n      | R4TableOperation\n      | R4bOperation\n      | { type: 'undo' }\n      | { type: 'redo' },\n    context?: ExpectedInteractionContext,\n  ): Promise<void> {\n    if (context && operation.type !== 'undo' && operation.type !== 'redo') {\n      const r4bOperation = operation as R4bOperation;\n      const gate = classifyR4bOperation(r4bOperation);\n      if (gate.kind === 'repair') {\n        await this.commitV2(r4bOperation, context, {\n          kind: 'correction',\n          groupId: crypto.randomUUID(),\n        });\n        return;\n      }\n      if (R4B_CONTEXTUAL_FORMAL_TYPES.has(r4bOperation.type)) {\n        await this.commitV2(r4bOperation, context);\n        return;\n      }\n      if (gate.kind === 'effect' && gate.manualEventCapable) {\n        await this.commitV2(\n          r4bOperation,\n          context,\n          context.kind === 'unbound' ? { kind: 'manual-event' } : undefined,\n        );\n        return;\n      }\n    }\n    await this.submit(operation, false, context);\n  }",
);

const screen = 'src/components/game/CockpitSessionScreen.tsx';
replaceOnce(
  screen,
  "} from '../../engine/cockpitR4';\nimport type { CockpitSessionView }",
  "} from '../../engine/cockpitR4';\nimport type { R4bOperation } from '../../engine/cockpitR4b';\nimport type { CockpitSessionView }",
);
replaceOnce(
  screen,
  "import { CockpitSelectionTools } from './CockpitSelectionTools';",
  "import { CockpitSelectionTools } from './CockpitSelectionTools';\nimport { CockpitCorrectionTools } from './CockpitCorrectionTools';",
);
replaceOnce(
  screen,
  "      | R4TableOperation\n      | { type: 'undo' }",
  "      | R4TableOperation\n      | R4bOperation\n      | { type: 'undo' }",
);
replaceOnce(
  screen,
  "      <span>選択 {selected.length}枚</span>",
  "      <span>Manual Event（今ゲーム中に行う操作）</span>\n      <span>選択 {selected.length}枚</span>",
);
replaceOnce(
  screen,
  "            />\n            <CockpitTokenTools\n              table={table}",
  "            />\n            <CockpitCorrectionTools\n              table={table}\n              seatId={seatId}\n              selected={selected}\n              disabled={disabled}\n              shared={Boolean(multi)}\n              holdActive={Boolean(multi?.holds.length)}\n              send={send}\n            />\n            <CockpitTokenTools\n              table={table}",
);
replaceOnce(
  screen,
  '<summary>カードを移動</summary>',
  '<summary>ゲーム中にカードを移動（Manual Event）</summary>',
);

const presentation = 'src/components/game/cockpitPresentation.ts';
replaceOnce(
  presentation,
  "import type { R4TableOperation } from '../../engine/cockpitR4';",
  "import type { R4TableOperation } from '../../engine/cockpitR4';\nimport type { R4bOperation } from '../../engine/cockpitR4b';",
);
replaceOnce(
  presentation,
  "  operation: TableOperation | R4TableOperation | { type: 'undo' | 'redo' },",
  "  operation: TableOperation | R4TableOperation | R4bOperation | { type: 'undo' | 'redo' },",
);

const selection = 'src/components/game/CockpitSelectionTools.tsx';
replaceOnce(
  selection,
  '<summary>山札・カウンター・ライフ</summary>',
  '<summary>ゲーム中に今行う操作（Manual Event）</summary>',
);
replaceOnce(
  selection,
  "          の山札・手札・ライフを操作します。カードへの変更は、選択中のカードに適用します。",
  "          の効果・手動処理を今ゲーム上で行います。既に起きた現実へ盤面を合わせる場合は「盤面訂正」を使ってください。",
);
replaceOnce(
  selection,
  `        <button\n          disabled={disabled || !selected.length}\n          onClick={() => void send({ type: 'damage', ids: selected, delta })}\n        >\n          記録ダメージを訂正\n        </button>\n`,
  '',
);

write(
  'src/components/game/CockpitCorrectionTools.tsx',
  `import { useState } from 'react';\nimport { tableZones, type CockpitTable } from '../../engine/cockpitTable';\nimport {\n  captureExpectedInteractionContext,\n  type ExpectedInteractionContext,\n} from '../../engine/cockpitR31';\nimport type { R4bOperation, R4bRepairOperation } from '../../engine/cockpitR4b';\nimport { objectIdOf, type ZoneId } from '../../engine/types';\n\nconst zoneLabels: Record<Exclude<ZoneId, 'stack'>, string> = {\n  hand: '手札',\n  library: '山札',\n  battlefield: '戦場',\n  graveyard: '墓地',\n  exile: '追放',\n  command: '統率領域',\n};\n\ninterface CorrectionDraft {\n  context: ExpectedInteractionContext;\n  objects: { cardId: string; objectId: string }[];\n  to: Exclude<ZoneId, 'stack'>;\n  position: 'top' | 'bottom';\n  lifeValue: number;\n  counterName: string;\n  counterValue: number;\n  damageMarked: number;\n  deathtouchDamage: boolean;\n}\n\nexport function CockpitCorrectionTools({\n  table,\n  seatId,\n  selected,\n  disabled,\n  shared,\n  holdActive,\n  send,\n}: {\n  table: CockpitTable;\n  seatId: string;\n  selected: string[];\n  disabled: boolean;\n  shared: boolean;\n  holdActive: boolean;\n  send: (operation: R4bOperation, context?: ExpectedInteractionContext) => Promise<boolean>;\n}) {\n  const [draft, setDraft] = useState<CorrectionDraft | null>(null);\n  const seat = table.seats.find((entry) => entry.id === seatId)!;\n  const correctionUnavailable = disabled || (shared && !holdActive);\n  const cards = draft?.objects.map((ref) => table.cards[ref.cardId]).filter(Boolean) ?? [];\n  const movable = Boolean(\n    draft?.objects.length &&\n      cards.length === draft.objects.length &&\n      cards.every((card) => card.zone !== 'stack' && !card.isToken),\n  );\n  const battlefieldOnly = Boolean(\n    draft?.objects.length &&\n      cards.length === draft.objects.length &&\n      cards.every((card) => card.zone === 'battlefield'),\n  );\n  const oneBattlefield =\n    draft?.objects.length === 1 && cards[0]?.zone === 'battlefield' ? draft.objects[0] : null;\n\n  function begin() {\n    const objects = selected.flatMap((cardId) => {\n      const card = table.cards[cardId];\n      return card ? [{ cardId, objectId: objectIdOf(card) }] : [];\n    });\n    const first = objects.length === 1 ? table.cards[objects[0].cardId] : undefined;\n    setDraft({\n      context: captureExpectedInteractionContext(table),\n      objects,\n      to: 'graveyard',\n      position: 'top',\n      lifeValue: seat.life,\n      counterName: '+1/+1',\n      counterValue: first?.counters['+1/+1'] ?? 0,\n      damageMarked: first?.damageMarked ?? 0,\n      deathtouchDamage: first?.hasDeathtouchDamage ?? false,\n    });\n  }\n\n  async function repair(operation: R4bRepairOperation) {\n    if (!draft) return false;\n    return send(operation, draft.context);\n  }\n\n  return (\n    <details className=\"cockpit-session__tools\">\n      <summary>盤面訂正（Correction）</summary>\n      <p>\n        既に現実で成立している状態とOneDeckが食い違う場合だけ使います。新しいゲームイベントや誘発は発生させません。\n      </p>\n      {shared && !holdActive && (\n        <p role=\"status\">共有卓の盤面訂正はHOLD中だけ開始できます。</p>\n      )}\n      {!draft ? (\n        <button disabled={correctionUnavailable} onClick={begin}>\n          盤面訂正を始める\n        </button>\n      ) : (\n        <fieldset>\n          <legend>訂正内容</legend>\n          <p>開始時の処理Contextとカードobject identityに固定して確定します。</p>\n          <label>\n            {seat.label}の正しいライフ\n            <input\n              type=\"number\"\n              value={draft.lifeValue}\n              onChange={(event) => setDraft({ ...draft, lifeValue: Number(event.target.value) })}\n            />\n          </label>\n          <button\n            disabled={disabled}\n            onClick={() => void repair({ type: 'repair.lifeTotal', seatId, value: draft.lifeValue })}\n          >\n            ライフ値を訂正\n          </button>\n\n          <label>\n            正しい移動先\n            <select\n              value={draft.to}\n              onChange={(event) =>\n                setDraft({ ...draft, to: event.target.value as Exclude<ZoneId, 'stack'> })\n              }\n            >\n              {tableZones\n                .filter((zone): zone is Exclude<ZoneId, 'stack'> => zone !== 'stack')\n                .map((zone) => (\n                  <option key={zone} value={zone}>\n                    {zoneLabels[zone]}\n                  </option>\n                ))}\n            </select>\n          </label>\n          <select\n            aria-label=\"訂正時の移動順\"\n            value={draft.position}\n            onChange={(event) =>\n              setDraft({ ...draft, position: event.target.value as 'top' | 'bottom' })\n            }\n          >\n            <option value=\"top\">上へ</option>\n            <option value=\"bottom\">下へ</option>\n          </select>\n          <button\n            disabled={disabled || !movable}\n            onClick={() =>\n              void repair({\n                type: 'repair.location',\n                objects: draft.objects,\n                to: draft.to,\n                position: draft.position,\n              })\n            }\n          >\n            選択カードの所在を訂正\n          </button>\n\n          <button\n            disabled={disabled || !battlefieldOnly}\n            onClick={() =>\n              void repair({\n                type: 'repair.tapState',\n                objects: draft.objects.map((object) => ({ object, value: true })),\n              })\n            }\n          >\n            選択カードを「タップ状態」に訂正\n          </button>\n          <button\n            disabled={disabled || !battlefieldOnly}\n            onClick={() =>\n              void repair({\n                type: 'repair.tapState',\n                objects: draft.objects.map((object) => ({ object, value: false })),\n              })\n            }\n          >\n            選択カードを「アンタップ状態」に訂正\n          </button>\n\n          <label>\n            カウンター名\n            <input\n              value={draft.counterName}\n              onChange={(event) => setDraft({ ...draft, counterName: event.target.value })}\n            />\n          </label>\n          <label>\n            正しい個数\n            <input\n              type=\"number\"\n              min=\"0\"\n              value={draft.counterValue}\n              onChange={(event) => setDraft({ ...draft, counterValue: Number(event.target.value) })}\n            />\n          </label>\n          <button\n            disabled={disabled || !oneBattlefield || !draft.counterName.trim()}\n            onClick={() =>\n              oneBattlefield &&\n              void repair({\n                type: 'repair.counterCount',\n                target: { kind: 'card', object: oneBattlefield },\n                name: draft.counterName,\n                value: draft.counterValue,\n              })\n            }\n          >\n            選択1枚のカウンター数を訂正\n          </button>\n\n          <label>\n            正しい記録ダメージ\n            <input\n              type=\"number\"\n              min=\"0\"\n              value={draft.damageMarked}\n              onChange={(event) => setDraft({ ...draft, damageMarked: Number(event.target.value) })}\n            />\n          </label>\n          <label>\n            <input\n              type=\"checkbox\"\n              checked={draft.deathtouchDamage}\n              onChange={(event) =>\n                setDraft({ ...draft, deathtouchDamage: event.target.checked })\n              }\n            />\n            接死ダメージを受けた記録\n          </label>\n          <button\n            disabled={disabled || !oneBattlefield}\n            onClick={() =>\n              oneBattlefield &&\n              void repair({\n                type: 'repair.damageState',\n                object: oneBattlefield,\n                value: {\n                  damageMarked: draft.damageMarked,\n                  hasDeathtouchDamage: draft.deathtouchDamage,\n                },\n              })\n            }\n          >\n            選択1枚の記録ダメージを訂正\n          </button>\n\n          <p>既に引いたカードの所在違いは「所在を訂正」で手札へ移します。新しく1枚引く操作はManual Eventです。</p>\n          <button onClick={() => setDraft(null)}>盤面訂正を終える</button>\n        </fieldset>\n      )}\n    </details>\n  );\n}\n`,
);

write(
  'src/online/browser/__tests__/cockpitClientR4bNormalUi.test.ts',
  `import { afterEach, expect, it, vi } from 'vitest';\nimport type { TableOperation } from '../../../engine/cockpitTable';\nimport { CockpitClient } from '../cockpitClient';\n\nconst key = 'mtg-onedeck:cockpit-connection-v1';\nconst clients: CockpitClient[] = [];\n\nafterEach(() => {\n  clients.splice(0).forEach((client) => client.dispose());\n  vi.unstubAllGlobals();\n  localStorage.removeItem(key);\n});\n\nfunction connectState() {\n  localStorage.setItem(\n    key,\n    JSON.stringify({\n      id: crypto.randomUUID(),\n      token: 'a'.repeat(64),\n      connectionId: crypto.randomUUID(),\n      pending: null,\n    }),\n  );\n}\n\nit('routes Normal move/life/tap/counter/draw through protocol v2 Manual Event instead of legacy commit', async () => {\n  connectState();\n  const requests: Record<string, unknown>[] = [];\n  let revision = 0;\n  vi.stubGlobal(\n    'fetch',\n    vi.fn((_url: string, init: RequestInit) => {\n      const body = JSON.parse(init.body as string) as Record<string, unknown>;\n      requests.push(body);\n      if (body.type === 'commit') revision += 1;\n      return Promise.resolve(\n        Response.json({\n          table: { seats: [] },\n          revision,\n          receipt: 'committed',\n          canUndo: false,\n          canRedo: false,\n          expiresAt: 0,\n          recentActions: [],\n        }),\n      );\n    }),\n  );\n\n  const client = new CockpitClient(vi.fn());\n  clients.push(client);\n  await client.reconnect();\n  const operations: TableOperation[] = [\n    { type: 'move', ids: ['c1'], to: 'graveyard', position: 'top' },\n    { type: 'life', seatIds: ['P1'], delta: -1 },\n    { type: 'tap', ids: ['c1'], tapped: true },\n    { type: 'counter', ids: ['c1'], seatIds: [], name: '+1/+1', delta: 1 },\n    { type: 'draw', seatId: 'P1', count: 1 },\n  ];\n  for (const operation of operations) await client.commit(operation, { kind: 'unbound' });\n\n  const commits = requests.filter((body) => body.type === 'commit');\n  expect(commits).toHaveLength(operations.length);\n  for (const commit of commits) {\n    expect(commit).toMatchObject({\n      protocolVersion: 2,\n      context: { kind: 'unbound' },\n      declaredCause: { kind: 'manual-event' },\n    });\n  }\n});\n`,
);

write(
  'src/components/game/CockpitCorrectionTools.r4b.test.tsx',
  `import { act } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport { expect, it, vi } from 'vitest';\nimport { applyTableOperation, createCockpitTable } from '../../engine/cockpitTable';\nimport { makeDeck } from '../../engine/__tests__/helpers';\nimport { CockpitCorrectionTools } from './CockpitCorrectionTools';\n\nit('sends explicit repair operations with the Context captured when Correction starts', async () => {\n  let table = createCockpitTable(makeDeck(20), 45);\n  table = applyTableOperation(table, { type: 'keep', seatId: 'P1', bottom: [] });\n  const cardId = table.seats[0].zones.hand[0];\n  table = applyTableOperation(table, {\n    type: 'move',\n    ids: [cardId],\n    to: 'battlefield',\n    position: 'top',\n  });\n  const send = vi.fn(() => Promise.resolve(true));\n  const host = document.createElement('div');\n  document.body.append(host);\n  const root = createRoot(host);\n\n  act(() =>\n    root.render(\n      <CockpitCorrectionTools\n        table={table}\n        seatId=\"P1\"\n        selected={[cardId]}\n        disabled={false}\n        shared={false}\n        holdActive={false}\n        send={send}\n      />,\n    ),\n  );\n  try {\n    const begin = [...host.querySelectorAll('button')].find(\n      (button) => button.textContent === '盤面訂正を始める',\n    );\n    expect(begin).toBeTruthy();\n    act(() => begin!.click());\n    const repair = [...host.querySelectorAll('button')].find(\n      (button) => button.textContent === 'ライフ値を訂正',\n    );\n    expect(repair).toBeTruthy();\n    await act(async () => {\n      repair!.click();\n      await Promise.resolve();\n    });\n    expect(send).toHaveBeenCalledWith(\n      { type: 'repair.lifeTotal', seatId: 'P1', value: 40 },\n      { kind: 'unbound' },\n    );\n  } finally {\n    act(() => root.unmount());\n    host.remove();\n  }\n});\n\nit('requires HOLD before shared Correction can start', () => {\n  const table = createCockpitTable(makeDeck(20), 46);\n  const host = document.createElement('div');\n  document.body.append(host);\n  const root = createRoot(host);\n  act(() =>\n    root.render(\n      <CockpitCorrectionTools\n        table={table}\n        seatId=\"P1\"\n        selected={[]}\n        disabled={false}\n        shared\n        holdActive={false}\n        send={vi.fn(() => Promise.resolve(true))}\n      />,\n    ),\n  );\n  try {\n    const begin = [...host.querySelectorAll('button')].find(\n      (button) => button.textContent === '盤面訂正を始める',\n    ) as HTMLButtonElement | undefined;\n    expect(begin?.disabled).toBe(true);\n    expect(host.textContent).toContain('HOLD中だけ開始');\n  } finally {\n    act(() => root.unmount());\n    host.remove();\n  }\n});\n`,
);

const workflow = '.github/workflows/r4b-verification.yml';
replaceOnce(
  workflow,
  "          src/components/game/CockpitManaBatch.r4b.test.tsx\n",
  "          src/components/game/CockpitManaBatch.r4b.test.tsx\n          src/components/game/CockpitCorrectionTools.r4b.test.tsx\n          src/online/browser/__tests__/cockpitClientR4bNormalUi.test.ts\n",
);
replaceOnce(
  workflow,
  "          src/components/game/CockpitManaBatch.r4b.test.tsx\n",
  "          src/components/game/CockpitManaBatch.r4b.test.tsx\n          src/components/game/CockpitCorrectionTools.tsx\n          src/components/game/CockpitCorrectionTools.r4b.test.tsx\n          src/components/game/CockpitSelectionTools.tsx\n          src/components/game/CockpitSessionScreen.tsx\n          src/components/game/cockpitPresentation.ts\n          src/online/browser/__tests__/cockpitClientR4bNormalUi.test.ts\n",
);
