from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected 1 match, found {count}")
    target.write_text(text.replace(old, new, 1))


path = ".github/workflows/r4-verification.yml"
replace_once(path, """      - name: R3.1 browser client regression tests
        run: >-
          node node_modules/vitest/vitest.mjs run --project dom
          src/online/browser/__tests__/cockpitClient.test.ts
      - name: Types and build
""", """      - name: R3.1 browser client regression tests
        run: >-
          node node_modules/vitest/vitest.mjs run --project dom
          src/online/browser/__tests__/cockpitClient.test.ts
      - name: R4 UI migration regression tests
        run: >-
          node node_modules/vitest/vitest.mjs run --project dom
          src/components/game/CockpitTableSurface.test.tsx
          src/components/game/CockpitCardTools.test.tsx
          src/components/game/CockpitCastAdditionalCosts.test.tsx
          src/components/game/cockpitPresentation.test.ts
      - name: Types and build
""")
replace_once(path, """          src/online/cloudflare/cockpitR4Authority.ts
          src/online/cloudflare/__tests__/cockpitR4Session.test.ts
          src/online/cloudflare/__tests__/cockpitR4FormalSession.test.ts
""", """          src/online/cloudflare/cockpitR4Authority.ts
          src/online/cloudflare/__tests__/cockpitR4Session.test.ts
          src/online/cloudflare/__tests__/cockpitR4FormalSession.test.ts
          src/online/browser/cockpitClient.ts
          src/components/game/CockpitSessionScreen.tsx
          src/components/game/CockpitTableSurface.tsx
          src/components/game/CockpitCardTools.tsx
          src/components/game/CockpitCastAdditionalCosts.tsx
          src/components/game/CockpitCastAdditionalCosts.test.tsx
          src/components/game/cockpitPresentation.ts
""")
