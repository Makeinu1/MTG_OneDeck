from pathlib import Path


def replace_one(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}")
    p.write_text(text.replace(old, new))


# 1) One contextual primary action for the visible button and Enter.
path = "src/components/game/CockpitTableSurface.tsx"
replace_one(
    path,
    "import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';",
    "import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';",
)
replace_one(
    path,
    "  const [fetchEntry, setFetchEntry] = useState<string | null>(null);\n  const [reviewTurn, setReviewTurn] = useState(false);",
    "  const [fetchEntry, setFetchEntry] = useState<string | null>(null);\n  const activeFetchEntry = fetchEntry\n    ? table.stack.find((entry) => entry.id === fetchEntry) ?? null\n    : null;\n  useEffect(() => {\n    if (fetchEntry && !activeFetchEntry) setFetchEntry(null);\n  }, [fetchEntry, activeFetchEntry]);\n  const [reviewTurn, setReviewTurn] = useState(false);",
)
replace_one(
    path,
    "    !!fetchEntry ||\n    handWorkspace ||",
    "    !!activeFetchEntry ||\n    handWorkspace ||",
)
replace_one(
    path,
    "  useShortcuts({\n    keybindings,\n    isDialogOpen: dialogOpen,\n    onNextTurn: () => {\n      if (!dialogOpen) prepareTurn();\n    },",
    "  function runPrimaryAction() {\n    if (disabled || opening || table.hold || boardChoice || dialogOpen) return;\n    if (resolution) setWork(true);\n    else if (triggersReady) setFeed(true);\n    else if (top) resolveTop();\n    else if (table.combat) setWork(true);\n    else if (table.phase === 'untap' || table.startProgress) prepareTurn();\n    else advancePhase();\n  }\n  useShortcuts({\n    keybindings,\n    isDialogOpen: dialogOpen,\n    onNextTurn: runPrimaryAction,",
)
replace_one(
    path,
    "  const resolveLabel = resolution\n    ? '効果の処理に戻る'\n    : fetchable\n      ? '解決して土地を探す'\n      : permanent\n        ? '解決して戦場に出す'\n        : '効果を処理する';",
    "  const resolveLabel = resolution\n    ? '効果の処理に戻る'\n    : fetchable\n      ? '解決して土地を探す'\n      : permanent\n        ? '解決して戦場に出す'\n        : '効果を処理する';\n  const primaryActionLabel = resolution\n    ? '処理に戻る'\n    : triggersReady\n      ? '誘発を確認'\n      : top\n        ? '解決'\n        : table.combat\n          ? '戦闘に戻る'\n          : table.phase === 'untap' || table.startProgress\n            ? 'ターン開始'\n            : table.phase === 'main1'\n              ? '戦闘'\n              : '次へ';",
)
replace_one(
    path,
    "                aria-label={\n                  resolution\n                    ? '処理に戻る'\n                    : triggersReady\n                      ? '誘発を確認'\n                      : top\n                        ? '解決'\n                        : table.combat\n                          ? '戦闘に戻る'\n                          : table.phase === 'untap' || table.startProgress\n                            ? 'ターン開始'\n                            : table.phase === 'main1'\n                              ? '戦闘'\n                              : '次へ'\n                }\n                disabled={disabled || opening || table.hold || !!boardChoice || dialogOpen}\n                onClick={() => {\n                  if (resolution) setWork(true);\n                  else if (triggersReady) setFeed(true);\n                  else if (top) resolveTop();\n                  else if (table.combat) setWork(true);\n                  else if (table.phase === 'untap' || table.startProgress) prepareTurn();\n                  else advancePhase();\n                }}",
    "                aria-label={primaryActionLabel}\n                title={`${primaryActionLabel} (${keyHint(keybindings.nextTurn)})`}\n                disabled={disabled || opening || table.hold || !!boardChoice || dialogOpen}\n                onClick={runPrimaryAction}",
)
replace_one(
    path,
    "              <button\n                className=\"restored-resolve\"\n                disabled={disabled || table.hold}\n                onClick={() => resolveTop()}\n              >",
    "              <button\n                className=\"restored-resolve\"\n                title={`${resolveLabel} (${keyHint(keybindings.nextTurn)})`}\n                disabled={disabled || table.hold}\n                onClick={() => resolveTop()}\n              >",
)
replace_one(
    path,
    "      {fetchEntry && table.stack.find((entry) => entry.id === fetchEntry) && (\n        <CockpitFetchSearch\n          key={fetchEntry}\n          table={table}\n          entry={table.stack.find((entry) => entry.id === fetchEntry)!}",
    "      {activeFetchEntry && (\n        <CockpitFetchSearch\n          key={activeFetchEntry.id}\n          table={table}\n          entry={activeFetchEntry}",
)

# 2) A stack-detail ID that disappears must no longer own the global shortcut lock.
path = "src/components/game/CockpitSessionScreen.tsx"
replace_one(
    path,
    "import { CockpitTableSurface } from './CockpitTableSurface';\nimport { CardView } from '../CardView';",
    "import { CockpitTableSurface } from './CockpitTableSurface';\nimport { cockpitStackDetailEntry } from './cockpitStackDetail';\nimport { CardView } from '../CardView';",
)
replace_one(
    path,
    "          setDetail((current) => (current && sameObject(current) ? current : null));\n          setAbility((current) => (current && sameObject(current) ? current : null));\n          setCast((current) => (current && sameObject(current.cardId) ? current : null));",
    "          setDetail((current) => (current && sameObject(current) ? current : null));\n          setAbility((current) => (current && sameObject(current) ? current : null));\n          setCast((current) => (current && sameObject(current.cardId) ? current : null));\n          setStackDetail((current) =>\n            cockpitStackDetailEntry(next.table, current) ? current : null,\n          );",
)
replace_one(
    path,
    "  const stackEntry =\n    table.stack.find((entry) => entry.id === stackDetail) ??\n    (table.resolution?.id === stackDetail ? table.resolution : null);",
    "  const stackEntry = cockpitStackDetailEntry(table, stackDetail);",
)
replace_one(path, "          !!stackDetail ||\n          confirmEnd", "          !!stackEntry ||\n          confirmEnd")

# 3) Keep public last-known target snapshots, while present() still masks snapshots that were private.
path = "src/online/cloudflare/cockpitMultiplayer.ts"
replace_one(
    path,
    "  const publicStackIds = new Set(projected.stack.map((entry) => entry.id));\n  for (const entry of [",
    "  for (const entry of [",
)
replace_one(
    path,
    "    if (entry.targetSnapshots)\n      entry.targetSnapshots = Object.fromEntries(\n        Object.entries(entry.targetSnapshots)\n          .filter(([id]) => visible.has(id) || publicStackIds.has(id))\n          .map(([id, snapshot]) => [id, present(snapshot)]),\n      );",
    "    if (entry.targetSnapshots)\n      entry.targetSnapshots = Object.fromEntries(\n        Object.entries(entry.targetSnapshots).map(([id, snapshot]) => [id, present(snapshot)]),\n      );",
)

# Use the registered snapshot identity in the stack UI when the physical card is now hidden or a new object.
path = "src/components/game/stackWorkspaceModel.ts"
replace_one(
    path,
    "  const cardId = target.selection.physicalCardId;\n  const current = state.cards[cardId];\n  const isSameObject = current && objectIdOf(current) === target.selection.objectId;\n  return {\n    label: `《${cardName(state, cardId)}》${isSameObject ? '' : '（以前のオブジェクト）'}`,
",
    "  const cardId = target.selection.physicalCardId;\n  const current = state.cards[cardId];\n  const isSameObject = current && objectIdOf(current) === target.selection.objectId;\n  const snapshot = target.selection.snapshot;\n  const snapshotDef = state.defs[snapshot.defId];\n  const snapshotFace = snapshotDef?.faces[snapshot.faceIndex] ?? snapshotDef?.faces[0];\n  const historicalName =\n    snapshot.defId === 'cockpit-hidden'\n      ? '非公開カード'\n      : snapshotFace?.printedName ??\n        snapshotFace?.name ??\n        snapshotDef?.printedName ??\n        snapshotDef?.name ??\n        cardId;\n  return {\n    label: `《${isSameObject ? cardName(state, cardId) : historicalName}》${isSameObject ? '' : '（以前のオブジェクト）'}`,
",
)

# 4) The detail-panel attachment target is an object-version choice, not only a physical card id.
path = "src/components/game/CockpitCardTools.tsx"
replace_one(
    path,
    "  const card = table.cards[cardId];\n  const [target, setTarget] = useState('');\n  const [source, setSource] = useState(table.resolution?.source.id ?? '');",
    "  const card = table.cards[cardId];\n  const [attachmentTarget, setAttachmentTarget] = useState<{ id: string; version: number } | null>(\n    null,\n  );\n  const attachmentTargetCard = attachmentTarget ? table.cards[attachmentTarget.id] : undefined;\n  const attachmentTargetCurrent = Boolean(\n    attachmentTargetCard &&\n      attachmentTargetCard.zone === 'battlefield' &&\n      attachmentTargetCard.zoneChangeCounter === attachmentTarget?.version,\n  );\n  const [source, setSource] = useState(table.resolution?.source.id ?? '');",
)
replace_one(
    path,
    "            <select value={target} onChange={(event) => setTarget(event.target.value)}>",
    "            <select\n              aria-label=\"取り付け先\"\n              value={attachmentTarget?.id ?? ''}\n              onChange={(event) => {\n                const next = table.cards[event.target.value];\n                setAttachmentTarget(\n                  next?.zone === 'battlefield'\n                    ? { id: next.id, version: next.zoneChangeCounter }\n                    : null,\n                );\n              }}\n            >",
)
replace_one(
    path,
    "          <button\n            disabled={disabled || !target}\n            onClick={() => void send({ type: 'attach', cardId, targetId: target })}\n          >\n            取り付けする\n          </button>",
    "          {attachmentTarget && !attachmentTargetCurrent && (\n            <p role=\"status\">選んだ対象が変わりました。選び直してください。</p>\n          )}\n          <button\n            disabled={disabled || !attachmentTargetCurrent}\n            onClick={() => {\n              if (!attachmentTarget || !attachmentTargetCurrent) return;\n              void send({ type: 'attach', cardId, targetId: attachmentTarget.id }).then((saved) => {\n                if (saved) setAttachmentTarget(null);\n              });\n            }}\n          >\n            取り付けする\n          </button>",
)

Path("src/components/game/cockpitStackDetail.ts").write_text("""import type { CockpitTable } from '../../engine/cockpitTable';

export type CockpitStackDetailEntry = CockpitTable['stack'][number];

/** Resolve only a currently visible stack/resolution item; stale ids must not own input. */
export function cockpitStackDetailEntry(
  table: CockpitTable,
  id: string | null,
): CockpitStackDetailEntry | null {
  if (!id) return null;
  return (
    table.stack.find((entry) => entry.id === id) ??
    (table.resolution?.id === id ? table.resolution : null)
  );
}
""")

Path("src/components/game/cockpitStackDetail.test.ts").write_text("""import { expect, it } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { cockpitStackDetailEntry } from './cockpitStackDetail';

function withStack() {
  let table = createCockpitTable(makeDeck(20), 1);
  table.seats[0].kept = true;
  const sourceId = table.seats[0].zones.hand[0];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [sourceId],
    to: 'battlefield',
    position: 'top',
  });
  table = applyTableOperation(table, {
    type: 'activate',
    id: 'detail-stack',
    sourceId,
    choice: 'manual',
    text: 'Draw a card.',
    targets: [],
    manualCosts: {
      manaCost: '',
      life: 0,
      tapIds: [],
      sacrificeIds: [],
      discardIds: [],
      returnIds: [],
      exileIds: [],
      counters: [],
      note: '',
    },
    paymentPlan: [],
  });
  return table;
}

it('keeps a visible stack/resolution detail and releases a removed stale id', () => {
  let table = withStack();
  expect(cockpitStackDetailEntry(table, 'detail-stack')?.id).toBe('detail-stack');
  table = applyTableOperation(table, { type: 'resolve.begin' });
  expect(cockpitStackDetailEntry(table, 'detail-stack')?.id).toBe('detail-stack');
  table = { ...table, resolution: null };
  expect(cockpitStackDetailEntry(table, 'detail-stack')).toBeNull();
});
""")

Path("src/components/game/CockpitStackControls.test.tsx").write_text("""import { act, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { applyTableOperation, createCockpitTable, type CockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { CockpitTableSurface } from './CockpitTableSurface';

function withStack(text: string): CockpitTable {
  let table = createCockpitTable(makeDeck(30), 42);
  table.seats[0].kept = true;
  const sourceId = table.seats[0].zones.hand[0];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [sourceId],
    to: 'battlefield',
    position: 'top',
  });
  return applyTableOperation(table, {
    type: 'activate',
    id: 'primary-stack',
    sourceId,
    choice: 'manual',
    text,
    targets: [],
    manualCosts: {
      manaCost: '',
      life: 0,
      tapIds: [],
      sacrificeIds: [],
      discardIds: [],
      returnIds: [],
      exileIds: [],
      counters: [],
      note: '',
    },
    paymentPlan: [],
  });
}

function mount(initial: CockpitTable) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const send = vi.fn<ComponentProps<typeof CockpitTableSurface>['send']>(() => Promise.resolve(true));
  const render = (table: CockpitTable) =>
    act(() =>
      root.render(
        <CockpitTableSurface
          view={{ table, canUndo: false, canRedo: false }}
          disabled={false}
          pending={false}
          selected={[]}
          select={vi.fn()}
          inspect={vi.fn()}
          cast={vi.fn()}
          send={send}
          openMenu={vi.fn()}
          seatId="P1"
          chooseSeat={vi.fn()}
          peek={vi.fn(async () => {})}
        >
          <span />
        </CockpitTableSurface>,
      ),
    );
  render(initial);
  return {
    host,
    send,
    rerender: render,
    close() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

it('routes Enter and the visible primary button through the same contextual stack action', async () => {
  const screen = mount(withStack('Draw a card.'));
  try {
    const primary = screen.host.querySelector<HTMLButtonElement>('[data-testid="primary-action"]')!;
    expect(primary.title).toContain('↵');
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
      await Promise.resolve();
    });
    expect(screen.send).toHaveBeenLastCalledWith({ type: 'resolve.begin' });
    screen.send.mockClear();
    await act(async () => {
      primary.click();
      await Promise.resolve();
    });
    expect(screen.send).toHaveBeenLastCalledWith({ type: 'resolve.begin' });
  } finally {
    screen.close();
  }
});

it('releases a vanished fetch workspace so the next-phase key works again', async () => {
  const screen = mount(
    withStack('Search your library for a basic land card, put it onto the battlefield, then shuffle your library.'),
  );
  try {
    act(() => screen.host.querySelector<HTMLButtonElement>('[data-testid="primary-action"]')!.click());
    expect(screen.send).not.toHaveBeenCalled();
    const cleared = structuredClone(withStack('Draw a card.'));
    cleared.stack = [];
    screen.rerender(cleared);
    screen.send.mockClear();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp', bubbles: true }));
      await Promise.resolve();
    });
    expect(screen.send).toHaveBeenLastCalledWith({ type: 'phase' });
  } finally {
    screen.close();
  }
});
""")

Path("src/components/game/CockpitCardTools.test.tsx").write_text("""import { act, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { applyTableOperation, createCockpitTable, type CockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { CockpitCardTools } from './CockpitCardTools';

it('invalidates a detail-panel attachment target after that physical card blinks', async () => {
  let table = createCockpitTable(makeDeck(30), 1);
  const [sourceId, targetId] = table.seats[0].zones.hand;
  table = applyTableOperation(table, {
    type: 'move',
    ids: [sourceId, targetId],
    to: 'battlefield',
    position: 'top',
  });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const send = vi.fn<ComponentProps<typeof CockpitCardTools>['send']>(() => Promise.resolve(true));
  const render = (next: CockpitTable) =>
    act(() => root.render(<CockpitCardTools table={next} cardId={sourceId} disabled={false} send={send} />));
  try {
    render(table);
    const select = host.querySelector<HTMLSelectElement>('[aria-label="取り付け先"]')!;
    act(() => {
      select.value = targetId;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const attach = [...host.querySelectorAll('button')].find((button) => button.textContent === '取り付けする')!;
    expect(attach.disabled).toBe(false);

    table = applyTableOperation(table, { type: 'move', ids: [targetId], to: 'exile', position: 'top' });
    table = applyTableOperation(table, {
      type: 'move',
      ids: [targetId],
      to: 'battlefield',
      position: 'top',
    });
    render(table);
    expect(attach.disabled).toBe(true);
    expect(host.textContent).toContain('選んだ対象が変わりました。選び直してください。');
    act(() => attach.click());
    expect(send).not.toHaveBeenCalled();

    const currentSelect = host.querySelector<HTMLSelectElement>('[aria-label="取り付け先"]')!;
    act(() => {
      currentSelect.value = targetId;
      currentSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(attach.disabled).toBe(false);
    await act(async () => {
      attach.click();
      await Promise.resolve();
    });
    expect(send).toHaveBeenLastCalledWith({ type: 'attach', cardId: sourceId, targetId });
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
""")

Path("src/components/game/CockpitStackLki.test.ts").write_text("""// @vitest-environment node
import { expect, it } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { projectCockpit, type CockpitMultiplayer } from '../../online/cloudflare/cockpitMultiplayer';
import { cockpitGameState } from './cockpitGameState';
import { stackItemPresentations } from './stackWorkspaceModel';

it('keeps an old public target identity after it becomes private without exposing a target that was private', () => {
  const deck = makeDeck(30);
  let table = createCockpitTable(deck, 1, [deck, deck]);
  const sourceId = table.seats[0].zones.hand[0];
  const publicTargetId = table.seats[1].zones.hand[0];
  const secretTargetId = table.seats[1].zones.hand[1];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [sourceId, publicTargetId],
    to: 'battlefield',
    position: 'top',
  });
  table = applyTableOperation(table, {
    type: 'activate',
    id: 'lki-stack',
    sourceId,
    choice: 'manual',
    text: 'Test public target history.',
    targets: [publicTargetId, secretTargetId],
    manualCosts: {
      manaCost: '',
      life: 0,
      tapIds: [],
      sacrificeIds: [],
      discardIds: [],
      returnIds: [],
      exileIds: [],
      counters: [],
      note: '',
    },
    paymentPlan: [],
  });
  const publicSnapshot = table.stack[0].targetSnapshots![publicTargetId];
  const secretSnapshot = table.stack[0].targetSnapshots![secretTargetId];
  const publicDefId = publicSnapshot.defId;
  const secretDefId = secretSnapshot.defId;
  const publicName = table.defs[publicDefId].printedName ?? table.defs[publicDefId].name;
  const secretName = table.defs[secretDefId].printedName ?? table.defs[secretDefId].name;
  table = applyTableOperation(table, {
    type: 'move',
    ids: [publicTargetId],
    to: 'hand',
    position: 'top',
  });
  const multi: CockpitMultiplayer = {
    invitation: 'test',
    started: true,
    masterId: 'P1',
    holds: [],
    borrowedFrom: null,
    members: {
      P1: { token: 'P1', connectionId: 'P1', lastSeen: 100, kicked: false, peek: null },
      P2: { token: 'P2', connectionId: 'P2', lastSeen: 100, kicked: false, peek: null },
    },
  };
  const projected = projectCockpit(table, multi, 'P1', 100).table;
  expect(projected.cards[publicTargetId]).toBeUndefined();
  expect(projected.stack[0].targetSnapshots![publicTargetId].zone).toBe('battlefield');
  expect(projected.stack[0].targetSnapshots![publicTargetId].defId).toBe(publicDefId);
  expect(projected.defs[publicDefId]).toBeDefined();
  expect(projected.stack[0].targetSnapshots![secretTargetId].defId).toBe('cockpit-hidden');
  expect(projected.defs[secretDefId]).toBeUndefined();

  const state = cockpitGameState(projected, 'P1');
  const item = stackItemPresentations(state)[0];
  expect(item.targets[0].label).toContain(publicName);
  expect(item.targets[0].label).toContain('以前のオブジェクト');
  expect(item.targets[1].label).toContain('非公開カード');
  expect(item.targets[1].label).not.toContain(secretName);
});
""")

print('A3 transform complete')
