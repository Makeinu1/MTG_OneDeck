import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);
function replaceOnce(path, from, to) {
  const source = read(path);
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one anchor, got ${count}`);
  write(path, source.replace(from, to));
}

const surface = 'src/components/game/CockpitTableSurface.tsx';
replaceOnce(
  surface,
  "import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';",
  "import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';",
);
replaceOnce(
  surface,
  "  canLifecycleResolveWithoutManual,\n  defaultResolutionDestination,",
  "  canLifecycleResolveWithoutManual,\n  captureExpectedInteractionContext,\n  defaultResolutionDestination,",
);
replaceOnce(
  surface,
  "  const [activeDrag, setActiveDrag] = useState<ActiveDragVisual | null>(null);\n  const activeDragId = activeDrag?.cardId ?? null;",
  "  const [activeDrag, setActiveDrag] = useState<ActiveDragVisual | null>(null);\n  const dragContextRef = useRef<ExpectedInteractionContext | null>(null);\n  const activeDragId = activeDrag?.cardId ?? null;",
);
replaceOnce(
  surface,
  "      onDragStart={(event) => {\n        const id = String(event.active.id);\n        const instance = displayState.cards[id];\n        const def = instance && displayState.defs[instance.defId];\n        if (!instance || !def || disabled || opening) return;\n        setHover(null);",
  "      onDragStart={(event) => {\n        dragContextRef.current = null;\n        const id = String(event.active.id);\n        const instance = displayState.cards[id];\n        const def = instance && displayState.defs[instance.defId];\n        if (!instance || !def || disabled || opening) return;\n        dragContextRef.current = captureExpectedInteractionContext(table);\n        setHover(null);",
);
replaceOnce(
  surface,
  "      onDragCancel={() => {\n        setActiveDrag(null);",
  "      onDragCancel={() => {\n        dragContextRef.current = null;\n        setActiveDrag(null);",
);
replaceOnce(
  surface,
  "      onDragEnd={({ active, over }) => {\n        setActiveDrag(null);\n        document.dispatchEvent(new Event(DRAG_UI_END_EVENT));",
  "      onDragEnd={({ active, over }) => {\n        const dragContext = dragContextRef.current;\n        dragContextRef.current = null;\n        setActiveDrag(null);\n        document.dispatchEvent(new Event(DRAG_UI_END_EVENT));",
);
replaceOnce(
  surface,
  "          void send({ type: 'playLand', cardId: id });",
  "          void send(\n            { type: 'playLand', cardId: id },\n            dragContext ?? captureExpectedInteractionContext(table),\n          );",
);
replaceOnce(
  surface,
  "        else void send({ type: 'move', ids: [id], to, position: 'top' });",
  "        else\n          void send(\n            { type: 'move', ids: [id], to, position: 'top' },\n            dragContext ?? captureExpectedInteractionContext(table),\n          );",
);

const correction = 'src/components/game/CockpitCorrectionTools.tsx';
replaceOnce(
  correction,
  "  async function repair(operation: R4bRepairOperation) {\n    if (!draft) return false;",
  "  async function repair(operation: R4bRepairOperation) {\n    if (!draft || correctionUnavailable) return false;",
);
for (const [from, to] of [
  ['disabled={disabled}\\n            onClick={() => void repair', 'disabled={correctionUnavailable}\\n            onClick={() => void repair'],
  ['disabled={disabled || !movable}', 'disabled={correctionUnavailable || !movable}'],
  ['disabled={disabled || !battlefieldOnly}', 'disabled={correctionUnavailable || !battlefieldOnly}'],
  ['disabled={disabled || !oneBattlefield || !draft.counterName.trim()}', 'disabled={correctionUnavailable || !oneBattlefield || !draft.counterName.trim()}'],
  ['disabled={disabled || !oneBattlefield}', 'disabled={correctionUnavailable || !oneBattlefield}'],
]) {
  let source = read(correction);
  const literalFrom = from.replaceAll('\\n', '\n');
  const literalTo = to.replaceAll('\\n', '\n');
  if (!source.includes(literalFrom)) throw new Error(`${correction}: missing ${from}`);
  source = source.replaceAll(literalFrom, literalTo);
  write(correction, source);
}

const test = 'src/components/game/CockpitCorrectionTools.r4b.test.tsx';
const source = read(test);
if (source.includes("disables an open shared Correction if HOLD is released")) {
  throw new Error(`${test}: regression already exists`);
}
write(
  test,
  source + `\n\nit('disables an open shared Correction if HOLD is released', () => {\n  const table = createCockpitTable(makeDeck(20), 47);\n  const send = vi.fn(() => Promise.resolve(true));\n  const host = document.createElement('div');\n  document.body.append(host);\n  const root = createRoot(host);\n  const render = (holdActive: boolean) =>\n    root.render(\n      <CockpitCorrectionTools\n        table={table}\n        seatId=\"P1\"\n        selected={[]}\n        disabled={false}\n        shared\n        holdActive={holdActive}\n        send={send}\n      />,\n    );\n\n  act(() => render(true));\n  try {\n    const begin = [...host.querySelectorAll('button')].find(\n      (button) => button.textContent === '盤面訂正を始める',\n    );\n    expect(begin).toBeTruthy();\n    act(() => begin!.click());\n    act(() => render(false));\n\n    const repair = [...host.querySelectorAll('button')].find(\n      (button) => button.textContent === 'ライフ値を訂正',\n    );\n    expect(repair?.disabled).toBe(true);\n    expect(host.textContent).toContain('HOLD中だけ開始');\n    expect(send).not.toHaveBeenCalled();\n  } finally {\n    act(() => root.unmount());\n    host.remove();\n  }\n});\n`,
);
