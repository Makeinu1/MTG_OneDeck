from pathlib import Path

path = Path('src/online/cloudflare/cockpitR4bSession.ts')
text = path.read_text()
old = """  if (multi) {
    if (!baseMultiplayerAuthority(table, multi, actor, now))
      throw new Error('R4B_NOT_AUTHORIZED');

    if (cause.kind === 'correction') {
      if (!multi.holds.length) throw new Error('R4B_CORRECTION_REQUIRES_HOLD');
      if (gate.kind !== 'repair' || !authorizeRepair(table, multi, actor, envelope.operation as R4bRepairOperation))
        throw new Error('R4B_NOT_AUTHORIZED');
    } else {
      if (multi.holds.length) throw new Error('R4B_HOLD_BLOCKS_OPERATION');
      if (gate.kind === 'effect' && !authorizeEffectObjects(table, multi, actor, envelope.operation))
        throw new Error('R4B_NOT_AUTHORIZED');
      if (gate.kind === 'formal' && !existingOperationAuthority(table, multi, actor, envelope.operation, now))
        throw new Error('R4B_NOT_AUTHORIZED');
    }
  }
"""
new = """  if (multi) {
    const pregameFormal =
      !multi.started &&
      gate.kind === 'formal' &&
      (envelope.operation.type === 'keep' || envelope.operation.type === 'mulligan');
    if (pregameFormal) {
      if (!existingOperationAuthority(table, multi, actor, envelope.operation, now))
        throw new Error('R4B_NOT_AUTHORIZED');
    } else {
      if (!baseMultiplayerAuthority(table, multi, actor, now))
        throw new Error('R4B_NOT_AUTHORIZED');
      if (cause.kind === 'correction') {
        if (!multi.holds.length) throw new Error('R4B_CORRECTION_REQUIRES_HOLD');
        if (
          gate.kind !== 'repair' ||
          !authorizeRepair(table, multi, actor, envelope.operation as R4bRepairOperation)
        )
          throw new Error('R4B_NOT_AUTHORIZED');
      } else {
        if (multi.holds.length) throw new Error('R4B_HOLD_BLOCKS_OPERATION');
        if (
          gate.kind === 'effect' &&
          !authorizeEffectObjects(table, multi, actor, envelope.operation)
        )
          throw new Error('R4B_NOT_AUTHORIZED');
        if (
          gate.kind === 'formal' &&
          !existingOperationAuthority(table, multi, actor, envelope.operation, now)
        )
          throw new Error('R4B_NOT_AUTHORIZED');
      }
    }
  }
"""
count = text.count(old)
if count != 1:
    raise SystemExit(f'pregame authority anchor changed: {count}')
path.write_text(text.replace(old, new, 1))
