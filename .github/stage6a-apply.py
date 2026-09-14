from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


surface = "src/components/game/CockpitTableSurface.tsx"
session = "src/components/game/CockpitSessionScreen.tsx"
card_tools = "src/components/game/CockpitCardTools.tsx"
multiplayer = "src/online/cloudflare/cockpitMultiplayer.ts"

# 1/2. One contextual primary action owns both the visible button and Enter, and a
# disappeared fetch entry cannot continue owning input. The stale local id is cleared
# during render under the same guarded pattern already used for turn-local UI state.
replace_once(
    surface,
    "  const [fetchEntry, setFetchEntry] = useState<string | null>(null);\n  const [reviewTurn, setReviewTurn] = useState(false);",
    "  const [fetchEntry, setFetchEntry] = useState<string | null>(null);\n  const fetchTarget = fetchEntry\n    ? table.stack.find((entry) => entry.id === fetchEntry)\n    : undefined;\n  if (fetchEntry && !fetchTarget) setFetchEntry(null);\n  const [reviewTurn, setReviewTurn] = useState(false);",
)
replace_once(surface, "    !!fetchEntry ||\n", "    !!fetchTarget ||\n")
replace_once(
    surface,
    "  useShortcuts({\n    keybindings,\n    isDialogOpen: dialogOpen,\n    onNextTurn: () => {\n      if (!dialogOpen) prepareTurn();\n    },",
    "  function runPrimaryAction() {\n    if (dialogOpen || disabled || opening || table.hold || boardChoice) return;\n    if (table.resolution) setWork(true);\n    else if (triggersReady) setFeed(true);\n    else if (table.stack[0]) resolveTop();\n    else if (table.combat) setWork(true);\n    else if (table.phase === 'untap' || table.startProgress) prepareTurn();\n    else advancePhase();\n  }\n  useShortcuts({\n    keybindings,\n    isDialogOpen: dialogOpen,\n    onNextTurn: runPrimaryAction,",
)
replace_once(
    surface,
    "      {fetchEntry && table.stack.find((entry) => entry.id === fetchEntry) && (\n        <CockpitFetchSearch\n          key={fetchEntry}\n          table={table}\n          entry={table.stack.find((entry) => entry.id === fetchEntry)!}",
    "      {fetchTarget && (\n        <CockpitFetchSearch\n          key={fetchTarget.id}\n          table={table}\n          entry={fetchTarget}",
)
replace_once(
    surface,
    "                data-testid=\"primary-action\"\n                aria-label={",
    "                data-testid=\"primary-action\"\n                title={`主操作 (${keyHint(keybindings.nextTurn)})`}\n                aria-label={",
)
replace_once(
    surface,
    "                onClick={() => {\n                  if (resolution) setWork(true);\n                  else if (triggersReady) setFeed(true);\n                  else if (top) resolveTop();\n                  else if (table.combat) setWork(true);\n                  else if (table.phase === 'untap' || table.startProgress) prepareTurn();\n                  else advancePhase();\n                }}",
    "                onClick={runPrimaryAction}",
)
replace_once(
    surface,
    "                              : '次へ'}\n                </span>\n              </button>\n              <button\n                className=\"thumb-zone__icon-btn\"",
    "                              : '次へ'}\n                </span>\n                <kbd aria-hidden=\"true\">{keyHint(keybindings.nextTurn)}</kbd>\n              </button>\n              <button\n                className=\"thumb-zone__icon-btn\"",
)

# 2. Stack-detail state is live only while that exact stack/resolution entry exists.
replace_once(
    session,
    "import { CockpitManaBatch } from './CockpitManaBatch';\nimport './cockpitSession.css';",
    "import { CockpitManaBatch } from './CockpitManaBatch';\nimport { liveStackDetail } from './cockpitTransientSelections';\nimport './cockpitSession.css';",
)
replace_once(
    session,
    "          setCast((current) => (current && sameObject(current.cardId) ? current : null));\n          viewRef.current = next;",
    "          setCast((current) => (current && sameObject(current.cardId) ? current : null));\n          setStackDetail((current) =>\n            current && liveStackDetail(next.table, current) ? current : null,\n          );\n          viewRef.current = next;",
)
replace_once(
    session,
    "  const stackEntry =\n    table.stack.find((entry) => entry.id === stackDetail) ??\n    (table.resolution?.id === stackDetail ? table.resolution : null);",
    "  const stackEntry = liveStackDetail(table, stackDetail);",
)
replace_once(session, "          !!stackDetail ||\n", "          Boolean(stackEntry) ||\n")

# 3. Preserve LKI that was public when captured; the presenter still masks face-down/private snapshots.
replace_once(
    multiplayer,
    "  const publicStackIds = new Set(projected.stack.map((entry) => entry.id));\n  for (const entry of [",
    "  const publicStackIds = new Set(projected.stack.map((entry) => entry.id));\n  const snapshotWasPublic = (snapshot: CardInstance) =>\n    !['hand', 'library'].includes(snapshot.zone);\n  for (const entry of [",
)
replace_once(
    multiplayer,
    "        Object.entries(entry.targetSnapshots)\n          .filter(([id]) => visible.has(id) || publicStackIds.has(id))\n          .map(([id, snapshot]) => [id, present(snapshot)]),",
    "        Object.entries(entry.targetSnapshots)\n          .filter(\n            ([id, snapshot]) =>\n              visible.has(id) || publicStackIds.has(id) || snapshotWasPublic(snapshot),\n          )\n          .map(([id, snapshot]) => [id, present(snapshot)]),",
)

# 4. Detail-screen attachment choice is tied to the selected object's zone-change version.
replace_once(
    card_tools,
    "  const [target, setTarget] = useState('');",
    "  const [target, setTarget] = useState<{ id: string; version: number } | null>(null);",
)
replace_once(
    card_tools,
    "  const name = (id: string) => {\n    const def = table.defs[table.cards[id]?.defId];\n    return def?.printedName ?? def?.name ?? id;\n  };\n  return (",
    "  const name = (id: string) => {\n    const def = table.defs[table.cards[id]?.defId];\n    return def?.printedName ?? def?.name ?? id;\n  };\n  const liveAttachmentTargetId =\n    target &&\n    target.id !== cardId &&\n    table.cards[target.id]?.zone === 'battlefield' &&\n    table.cards[target.id]?.zoneChangeCounter === target.version\n      ? target.id\n      : '';\n  return (",
)
replace_once(
    card_tools,
    "            <select value={target} onChange={(event) => setTarget(event.target.value)}>\n              <option value=\"\">対象を選択</option>",
    "            <select\n              aria-label=\"取り付けする対象\"\n              value={liveAttachmentTargetId}\n              disabled={disabled}\n              onChange={(event) => {\n                const candidate = table.cards[event.target.value];\n                setTarget(\n                  candidate && candidate.zone === 'battlefield' && candidate.id !== cardId\n                    ? { id: candidate.id, version: candidate.zoneChangeCounter }\n                    : null,\n                );\n              }}\n            >\n              <option value=\"\">対象を選択</option>",
)
replace_once(
    card_tools,
    "          <button\n            disabled={disabled || !target}\n            onClick={() => void send({ type: 'attach', cardId, targetId: target })}\n          >",
    "          <button\n            disabled={disabled || !liveAttachmentTargetId}\n            onClick={() => {\n              if (liveAttachmentTargetId)\n                void send({ type: 'attach', cardId, targetId: liveAttachmentTargetId });\n            }}\n          >",
)
