from pathlib import Path

path = Path('src/online/cloudflare/cockpitSession.ts')
text = path.read_text()
old = "  if (code === 'R4B_NOT_AUTHORIZED') return response({ error: code }, 403);\n"
new = "  if (code === 'R4B_NOT_AUTHORIZED') return response({ error: 'NOT_AUTHORIZED' }, 403);\n"
count = text.count(old)
if count != 1:
    raise SystemExit(f'authorization error anchor changed: {count}')
path.write_text(text.replace(old, new, 1))
