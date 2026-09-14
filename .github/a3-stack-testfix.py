from pathlib import Path


def replace_one(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one fixture match, found {count}")
    p.write_text(text.replace(old, new))

for path in [
    'src/components/game/CockpitStackControls.test.tsx',
    'src/components/game/cockpitStackDetail.test.ts',
    'src/components/game/CockpitStackLki.test.ts',
]:
    replace_one(
        path,
        "import { applyTableOperation, createCockpitTable",
        "import { applyTableOperation, createCockpitTable, tableActivationPayment",
    )

manual = """    manualCosts: {
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
    paymentPlan: [],"""

# The engine now requires the exact server-side payment proposal, even for manual fixtures.
for path in [
    'src/components/game/CockpitStackControls.test.tsx',
    'src/components/game/cockpitStackDetail.test.ts',
    'src/components/game/CockpitStackLki.test.ts',
]:
    p = Path(path)
    text = p.read_text()
    source_var = 'sourceId'
    proposal = """    manualCosts,
    paymentPlan: proposal.paid,"""
    count = text.count(manual)
    if count != 1:
        raise SystemExit(f"{path}: expected one manual fixture, found {count}")
    # Insert the proposal immediately before the activate operation in each dedicated fixture.
    marker = "  table = applyTableOperation(table, {\n    type: 'activate'," if 'CockpitStackLki' in path or 'cockpitStackDetail' in path else "  return applyTableOperation(table, {\n    type: 'activate',"
    prefix = """  const manualCosts = {
    manaCost: '',
    life: 0,
    tapIds: [],
    sacrificeIds: [],
    discardIds: [],
    returnIds: [],
    exileIds: [],
    counters: [],
    note: '',
  };
  const proposal = tableActivationPayment(table, sourceId, 'manual', manualCosts);
"""
    if marker not in text:
        raise SystemExit(f"{path}: activate marker missing")
    text = text.replace(marker, prefix + marker, 1)
    text = text.replace(manual, proposal, 1)
    p.write_text(text)

print('A3 fixture payment alignment complete')
