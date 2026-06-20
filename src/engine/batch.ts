import { applyCommand, type ApplyResult, type GameCommand } from './commands';
import type { GameState } from './types';

export interface CommandBatch {
  commands: readonly GameCommand[];
  label?: string;
}

export function applyCommands(
  state: GameState,
  commands: readonly GameCommand[]
): ApplyResult {
  let next = state;
  const warnings: string[] = [];

  for (const cmd of commands) {
    const result = applyCommand(next, cmd);
    next = result.state;
    warnings.push(...result.warnings);
  }

  return { state: next, warnings };
}

export function applyCommandBatch(state: GameState, batch: CommandBatch): ApplyResult {
  return applyCommands(state, batch.commands);
}
