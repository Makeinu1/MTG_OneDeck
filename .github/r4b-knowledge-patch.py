from pathlib import Path

# Reuse the frozen R4 knowledge-barrier semantics for the R4 Formal subset now routed via R4b.
path = Path('src/online/cloudflare/cockpitR4bSession.ts')
text = path.read_text()
old_import = "import { authorizeR4FormalOperation } from './cockpitR4Authority';\n"
new_import = """import {
  authorizeR4FormalOperation,
  isR4FormalOperation,
  r4OperationCreatesKnowledgeBarrier,
} from './cockpitR4Authority';
"""
if text.count(old_import) != 1:
    raise SystemExit(f'R4 authority import anchor changed: {text.count(old_import)}')
text = text.replace(old_import, new_import, 1)
old_fn = """function operationCreatesKnowledgeBarrier(
  table: CockpitTable,
  operation: R4bOperation,
): boolean {
  switch (operation.type) {
"""
new_fn = """function operationCreatesKnowledgeBarrier(
  table: CockpitTable,
  operation: R4bOperation,
): boolean {
  if (isR4FormalOperation(operation as never))
    return r4OperationCreatesKnowledgeBarrier(table, operation as never);
  switch (operation.type) {
"""
if text.count(old_fn) != 1:
    raise SystemExit(f'knowledge barrier function anchor changed: {text.count(old_fn)}')
text = text.replace(old_fn, new_fn, 1)
path.write_text(text)

# HOLD is a state conflict in R4b, not an authorization failure.
path = Path('src/online/cloudflare/__tests__/cockpitR4Session.test.ts')
text = path.read_text()
old = """    expect(held.status).toBe(403);
    expect(held.value.error).toBe('NOT_AUTHORIZED');
"""
new = """    expect(held.status).toBe(409);
    expect(held.value.error).toBe('R4B_HOLD_BLOCKS_OPERATION');
"""
if text.count(old) != 1:
    raise SystemExit(f'HOLD expectation anchor changed: {text.count(old)}')
path.write_text(text.replace(old, new, 1))
