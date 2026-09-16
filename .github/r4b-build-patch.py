from pathlib import Path

# The request union still names R4TableOperation even though legacy R4 apply logic is gone.
path = Path('src/online/cloudflare/cockpitSession.ts')
text = path.read_text()
anchor = "import type { R4bDeclaredCause, R4bOperation } from '../../engine/cockpitR4b';\n"
addition = anchor + "import type { R4TableOperation } from '../../engine/cockpitR4';\n"
if text.count(anchor) != 1:
    raise SystemExit(f'R4b import anchor changed: {text.count(anchor)}')
text = text.replace(anchor, addition, 1)
path.write_text(text)

# Representative trigger.dismiss Formal operation requires an explicit reason.
path = Path('src/online/browser/__tests__/cockpitClientR4bSunset.test.ts')
text = path.read_text()
old = "    { type: 'trigger.dismiss' as const, candidateId: 'candidate-1' },\n"
new = "    { type: 'trigger.dismiss' as const, candidateId: 'candidate-1', reason: 'test' },\n"
if text.count(old) != 1:
    raise SystemExit(f'trigger.dismiss test anchor changed: {text.count(old)}')
path.write_text(text.replace(old, new, 1))
