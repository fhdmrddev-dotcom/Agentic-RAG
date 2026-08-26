"""Phase 207 live smoke — prove the `api.ts` split works in a REAL BROWSER.

⚠ WHY THIS EXISTS. `207-VERIFICATION.md` recorded, under Owed:

    "Asserted, not driven: that no runtime behaviour changed. No application was
     launched and no browser drive was run for this phase. The argument is
     structural ... but that is an argument, not an observation."

`tsc` type-checks; it does not RESOLVE modules the way Vite does at runtime. A
circular import between the 12 new modules, a barrel that re-exports a name no
module actually declares, or an `import.meta.env` read that moved into a module
evaluated in a different order — none of those is a type error, and all of them
are blank-page-at-runtime.

WHAT IT PROVES, per surface: that the api functions in that surface's modules were
CALLED and came back 200. A rendered page is not enough on its own (a cached shell
renders too), so every surface is scored on its own NETWORK EVIDENCE.

Run:  C:/Python312/python.exe scripts/smoke_phase_207_api_split.py
      (playwright lives in system Python 3.12, not backend/venv — see 207 finding 2)
"""
import asyncio
import json
import re
import sys
import urllib.error
import urllib.request

import asyncpg
from playwright.async_api import async_playwright
from supabase import create_client

SUPABASE_URL = "http://[::1]:54321"
SUPABASE_SERVICE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzM2NzM0OTUsImV4cCI6MjA4OTAzMzQ5NX0.H-ZHqezteHdwd19_PQtoKrwX_B5c_RRvoy8Ir7K-P1o"
)
FRONTEND_URL = "http://localhost:5173"
ADMIN_EMAIL = "fhdmrd@gmail.com"

# Each surface names the api MODULE(S) it exercises and at least one backend path
# that only those modules call. `_core` is exercised by every row (getAuthHeaders).
SURFACES = [
    dict(name="Chat",         nav="Chat",        modules=["threads", "settings"],
         expect=[r"/threads", r"/settings"]),
    dict(name="Documents",    nav="Documents",   modules=["documents"],
         expect=[r"/documents", r"/folders"]),
    dict(name="Workflows",    nav="Workflows",   modules=["workflows", "schedules"],
         expect=[r"/workflows"]),
    dict(name="Skills",       nav="Skills",      modules=["skills"],
         expect=[r"/skills"]),
    dict(name="Settings",     nav="Settings",    modules=["settings", "admin", "connectors"],
         expect=[r"/settings|/providers|/models"]),
]


async def main() -> int:
    pg = await asyncpg.connect("postgresql://postgres:postgres@localhost:54322/postgres")
    user = await pg.fetchrow("select id from auth.users where email = $1", ADMIN_EMAIL)
    if not user:
        print(f"FATAL: {ADMIN_EMAIL} not found in auth.users")
        return 2

    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    link = sb.auth.admin.generate_link({
        "type": "magiclink", "email": ADMIN_EMAIL,
        "options": {"redirect_to": FRONTEND_URL},
    }).properties.action_link
    link = link.replace("http://127.0.0.1:54321", SUPABASE_URL).replace(
        "http://localhost:54321", SUPABASE_URL)

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k):
            return None

    try:
        loc = urllib.request.build_opener(NoRedirect).open(link).headers.get("Location")
    except urllib.error.HTTPError as e:
        loc = e.headers.get("Location")
    if not loc or "#access_token=" not in loc:
        print(f"FATAL: could not unwrap access token: {loc}")
        return 2
    auth_url = FRONTEND_URL + loc[loc.index("#"):]

    console_errors: list[str] = []
    page_errors: list[str] = []
    requests: list[tuple[str, int]] = []
    failed: list[tuple[str, int]] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1600, "height": 1000})
        page = await ctx.new_page()

        def on_console(m):
            if m.type == "error":
                console_errors.append(m.text.encode("ascii", "replace").decode("ascii")[:300])

        def on_pageerror(e):
            page_errors.append(str(e).encode("ascii", "replace").decode("ascii")[:400])

        async def on_response(r):
            if "/api" in r.url or re.search(r":8000", r.url):
                requests.append((r.url, r.status))
                if r.status >= 400:
                    failed.append((r.url, r.status))

        page.on("console", on_console)
        page.on("pageerror", on_pageerror)
        page.on("response", lambda r: asyncio.ensure_future(on_response(r)))

        print("Authenticating and loading the app ...")
        await page.goto(auth_url, wait_until="networkidle")
        await page.wait_for_timeout(4000)

        body = (await page.locator("body").inner_text())[:200].replace("\n", " ")
        print(f"  URL   : {page.url}")
        print(f"  body  : {body!r}")
        if len(body.strip()) < 10:
            print("  FATAL: the app rendered an EMPTY BODY — the classic split failure")
            await browser.close()
            return 1

        # ⚠ CHAT IS THE DEFAULT VIEW AND IS ALREADY LOADED. Its api calls happen during
        # the initial load above, so clicking its nav re-selects an active view and
        # issues NOTHING NEW. Scoring it on the post-click window measured the harness,
        # not the app — so it is scored against the INITIAL-LOAD window instead. That is
        # a stronger reading, not a weaker one: those calls are the very first thing the
        # split has to survive.
        initial = list(requests)
        print(f"  (initial load issued {len(initial)} backend calls before any nav click)")

        results = []
        for s in SURFACES:
            if s["name"] == "Chat":
                hits = [pat for pat in s["expect"]
                        if any(re.search(pat, u) for u, _ in initial)]
                bad = [(u, c) for u, c in initial if c >= 400]
                verdict = "OK" if hits and not bad else ("NO-CALLS" if not hits else "HTTP-ERROR")
                results.append((s["name"], verdict, len(initial), bad[:3]))
                print(f"  {'Chat':<11} via initial-load {len(initial):>3} calls  "
                      f"matched {len(hits)}/{len(s['expect'])}  {verdict}")
                continue
            before = len(requests)
            btn = page.locator(f'[aria-label="{s["nav"]}"]')
            how = "aria-label"
            if await btn.count() == 0:
                btn = page.locator(
                    f'button:has-text("{s["nav"]}"), a:has-text("{s["nav"]}")').first
                how = "text"
            if await btn.count() == 0:
                results.append((s["name"], "NAV-NOT-FOUND", 0, []))
                continue
            try:
                await btn.first.click()
            except Exception as exc:
                results.append((s["name"], f"CLICK-FAILED {exc}"[:60], 0, []))
                continue
            await page.wait_for_timeout(3500)

            new = requests[before:]
            hits = [pat for pat in s["expect"]
                    if any(re.search(pat, u) for u, _ in new)]
            bad = [(u, c) for u, c in new if c >= 400]
            verdict = "OK" if hits and not bad else ("NO-CALLS" if not hits else "HTTP-ERROR")
            results.append((s["name"], verdict, len(new), bad[:3]))
            print(f"  {s['name']:<11} via {how:<10} {len(new):>3} calls  "
                  f"matched {len(hits)}/{len(s['expect'])}  {verdict}")

        await browser.close()

    await pg.close()

    print("\n" + "=" * 70)
    print(f"backend calls observed : {len(requests)}")
    print(f"HTTP >= 400            : {len(failed)}")
    for u, c in failed[:8]:
        print(f"    {c}  {u}")
    print(f"console errors         : {len(console_errors)}")
    for e in console_errors[:8]:
        print(f"    {e}")
    print(f"uncaught page errors   : {len(page_errors)}")
    for e in page_errors[:8]:
        print(f"    {e}")

    # ⚠ THE SPLIT-SPECIFIC FAILURE SIGNATURES. A module-resolution or circular-import
    # fault surfaces as one of these, and none of them is a type error.
    split_sigs = [s for s in console_errors + page_errors if re.search(
        r"Failed to fetch dynamically imported|does not provide an export|"
        r"Cannot access .* before initialization|is not a function|"
        r"Failed to resolve import|circular", s, re.I)]
    print(f"\nsplit-specific signatures: {len(split_sigs)}")
    for s in split_sigs:
        print(f"    {s}")

    ok = (not failed and not page_errors and not split_sigs
          and all(v == "OK" for _, v, _, _ in results))
    print("\n" + ("SMOKE PASS — every surface called its api modules and got 200."
                  if ok else "SMOKE FAILED — see above."))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
