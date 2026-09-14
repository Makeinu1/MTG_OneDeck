from pathlib import Path

path = Path('src/online/cloudflare/__tests__/cockpitSession.test.ts')
text = path.read_text()
old = "{ type: 'addMana', color: 'G', amount: 1, playerId: 'P1' }"
new = "{ type: 'addMana', color: 'G', amount: 1 }"
assert text.count(old) == 1
path.write_text(text.replace(old, new, 1))
