from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:80]!r}")
    p.write_text(text.replace(old, new, 1))

surface = "src/components/game/CockpitTableSurface.tsx"
session = "src/components/game/CockpitSessionScreen.tsx"

replace_once(
    surface,
    "import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';",
    "import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';",
)
replace_once(
    surface,
    "  const [fetchEntry, setFetchEntry] = useState<string | null>(null);\n  const [reviewTurn, setReviewTurn] = useState(false);",
    "  const [fetchEntry, setFetchEntry] = useState<string | null>(null);\n  const fetchTarget = fetchEntry\n    ? table.stack.find((entry) => entry.id === fetchEntry)\n    : undefined;\n  useEffect(() => {\n    if (fetchEntry && !fetchTarget) setFetchEntry(null);\n  }, [fetchEntry, fetchTarget]);\n  const [reviewTurn, setReviewTurn] = useState(false);",
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
    "                              : '次へ'}\n                </span>\n                <kbd>{keyHint(keybindings.nextTurn)}</kbd>\n              </button>\n              <button\n                className=\"thumb-zone__icon-btn\"",
)
replace_once(
    session,
    "          setCast((current) => (current && sameObject(current.cardId) ? current : null));\n          viewRef.current = next;",
    "          setCast((current) => (current && sameObject(current.cardId) ? current : null));\n          setStackDetail((current) =>\n            current &&\n            (next.table.stack.some((entry) => entry.id === current) ||\n              next.table.resolution?.id === current)\n              ? current\n              : null,\n          );\n          viewRef.current = next;",
)
replace_once(session, "          !!stackDetail ||\n", "          Boolean(stackEntry) ||\n")
