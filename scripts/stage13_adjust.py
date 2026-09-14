from pathlib import Path

path = Path('src/online/cloudflare/__tests__/cockpitSession.test.ts')
text = path.read_text()
old = "{ type: 'addMana', color: 'G', amount: 1, playerId: 'P1' }"
new = "{ type: 'addMana', color: 'G', amount: 1 }"
assert text.count(old) == 1
text = text.replace(old, new, 1)
old_mana = "producedMana: ['G'] as const,"
new_mana = "producedMana: ['G'] as ['G'],"
assert text.count(old_mana) == 1
path.write_text(text.replace(old_mana, new_mana, 1))
