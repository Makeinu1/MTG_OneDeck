from pathlib import Path

p = Path('src/components/game/CockpitRoomExpiry.test.tsx')
text = p.read_text()
old = "  } as CockpitSessionView;"
new = "  } as unknown as CockpitSessionView;"
if text.count(old) != 1:
    raise SystemExit(f'expected one TTL fixture cast, found {text.count(old)}')
p.write_text(text.replace(old, new))
print('stage8 TTL test fixture type aligned')
