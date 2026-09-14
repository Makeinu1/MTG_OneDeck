from pathlib import Path


def replace_one(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one fixture match, found {count}")
    p.write_text(text.replace(old, new))

# The stale fetch id does not need an effect-driven state reset.  Rendering and
# shortcut ownership are derived from whether the referenced stack entry still
# exists, so a vanished entry immediately stops owning input without a cascading
# render solely to clean the inert local id.
replace_one(
    'src/components/game/CockpitTableSurface.tsx',
    "import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';",
    "import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';",
)
replace_one(
    'src/components/game/CockpitTableSurface.tsx',
    "  useEffect(() => {\n    if (fetchEntry && !activeFetchEntry) setFetchEntry(null);\n  }, [fetchEntry, activeFetchEntry]);\n",
    "",
)

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

# The engine requires the exact server-side activation payment proposal, even in
# these deliberately small manual-stack fixtures.
for path in [
    'src/components/game/CockpitStackControls.test.tsx',
    'src/components/game/cockpitStackDetail.test.ts',
    'src/components/game/CockpitStackLki.test.ts',
]:
    p = Path(path)
    text = p.read_text()
    proposal = """    manualCosts,
    paymentPlan: proposal.paid,"""
    count = text.count(manual)
    if count != 1:
        raise SystemExit(f"{path}: expected one manual fixture, found {count}")
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

replace_one(
    'src/components/game/cockpitStackDetail.test.ts',
    "  table = { ...table, resolution: null };",
    "  table = { ...table, resolution: null, stack: [] };",
)

print('A3 post-transform validation adjustments complete')
