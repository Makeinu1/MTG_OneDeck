from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected 1 match, found {count}")
    target.write_text(text.replace(old, new, 1))


replace_once(
    "src/online/browser/cockpitClient.ts",
    """import type { TableOperation } from '../../engine/cockpitTable';
import type {
  ExpectedInteractionContext,
  R31TableOperation,
} from '../../engine/cockpitR31';
""",
    """import type { TableOperation } from '../../engine/cockpitTable';
import type { ExpectedInteractionContext } from '../../engine/cockpitR31';
import type { R4TableOperation } from '../../engine/cockpitR4';
""",
)
replace_once(
    "src/online/browser/cockpitClient.ts",
    """  async commit(
    operation: TableOperation | R31TableOperation | { type: 'undo' } | { type: 'redo' },
    context?: ExpectedInteractionContext,
  ): Promise<void> {
""",
    """  async commit(
    operation: TableOperation | R4TableOperation | { type: 'undo' } | { type: 'redo' },
    context?: ExpectedInteractionContext,
  ): Promise<void> {
""",
)
replace_once(
    "src/online/browser/cockpitClient.ts",
    """  private async submit(
    operation: TableOperation | R31TableOperation | { type: 'undo' } | { type: 'redo' } | CockpitControl,
    control: boolean,
""",
    """  private async submit(
    operation: TableOperation | R4TableOperation | { type: 'undo' } | { type: 'redo' } | CockpitControl,
    control: boolean,
""",
)

replace_once(
    "src/components/game/cockpitPresentation.ts",
    """import type { CockpitTable, TableOperation } from '../../engine/cockpitTable';
""",
    """import type { CockpitTable, TableOperation } from '../../engine/cockpitTable';
import type { R4TableOperation } from '../../engine/cockpitR4';
""",
)
replace_once(
    "src/components/game/cockpitPresentation.ts",
    """  operation: TableOperation | { type: 'undo' | 'redo' },
""",
    """  operation: TableOperation | R4TableOperation | { type: 'undo' | 'redo' },
""",
)
replace_once(
    "src/components/game/cockpitPresentation.ts",
    """  switch (operation.type) {
    case 'cast': {
""",
    """  switch (operation.type) {
    case 'playLand':
      presentationRuntime.publish({
        action: 'play-land',
        status,
        cardId: operation.cardId,
        sourceZone: 'hand',
        destinationZone: 'battlefield',
      });
      break;
    case 'cast': {
""",
)
