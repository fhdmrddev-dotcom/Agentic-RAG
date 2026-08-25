"""Phase 209 browser drive - SC#1 (the node face names service + tool) and SC#3 (an MCP
connection is findable through the Connections filter).

WHY THIS EXISTS AT ALL. Phase 209 shipped two defects that every unit gate passed over,
both of the same shape: a resolver that worked and a caller that never fed it. Wire-level and
unit evidence cannot see that join. Only a real browser can.

AND IT DRIVES SC#2's POSITIVE ARM, which the phase recorded as undrivable. That was true of
DeepWiki - measured 2026-08-25, it ships NO annotations on any of its 3 tools, so it can only
exercise the fail-closed path. This script SEEDS a connection whose discovered_tools carries
an explicit readOnlyHint: true, which is what a compliant server would send. What it proves is
OUR rendering of a declared hint; it does not prove any particular server declares one.
"""
import asyncio
import json
import uuid
import urllib.request
import urllib.error

import asyncpg
from playwright.async_api import async_playwright
from supabase import create_client

SUPABASE_URL = "http://[::1]:54321"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzM2NzM0OTUsImV4cCI6MjA4OTAzMzQ5NX0.H-ZHqezteHdwd19_PQtoKrwX_B5c_RRvoy8Ir7K-P1o"
FRONTEND_URL = "http://localhost:5173"
ADMIN_EMAIL = "fhdmrd@gmail.com"

MARK = uuid.uuid4().hex[:6]
CONN_NAME = "DriveWiki " + MARK
READ_TOOL = "read_wiki_structure"      # seeded WITH readOnlyHint: true
WRITE_TOOL = "get_and_purge_records"   # read-VERB name, NO hint - the fail-closed control

results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("  PASS  " if ok else "  FAIL  ") + name + (("  - " + detail) if detail else ""))


async def seed(pg):
    row = await pg.fetchrow(
        "select id, org_id from connector_connections where mcp_server_url is not null limit 1"
    )
    if not row:
        raise RuntimeError("no MCP connection present to borrow an org_id from")
    org_id = row["org_id"]
    user = await pg.fetchrow("select id from auth.users where email=$1", ADMIN_EMAIL)

    tools = [
        {
            "name": READ_TOOL,
            "description": "List wiki pages",
            "inputSchema": {"type": "object", "properties": {}},
            "annotations": {"readOnlyHint": True},
        },
        # THE CONTROL: its NAME starts with a read verb and it declares NOTHING.
        {
            "name": WRITE_TOOL,
            "description": "Fetch then purge",
            "inputSchema": {"type": "object", "properties": {}},
        },
    ]
    conn_id = await pg.fetchval(
        """insert into connector_connections (org_id, created_by, name, mcp_server_url,
             config, is_enabled, tool_grants, discovered_tools)
           values ($1,$2,$3,'https://mcp.deepwiki.com/mcp','{}'::jsonb,true,$4::jsonb,$5::jsonb)
           returning id""",
        org_id,
        user["id"],
        CONN_NAME,
        json.dumps({READ_TOOL: True, WRITE_TOOL: True}),
        json.dumps(tools),
    )
    print("seeded connection " + CONN_NAME + " (" + str(conn_id) + ")")

    slug = "drive209-" + MARK
    definition = {
        "slug": slug,
        "version": 1,
        "name": "Drive209 " + MARK,
        "status": "draft",
        "business_requirement": "Prove the node face names the real action.",
        "phases": [
            {
                "slug": "reads",
                "phase_index": 0,
                "config": {
                    "phase_type": "external_action",
                    "connection_id": str(conn_id),
                    "tool_name": READ_TOOL,
                },
            },
            {
                "slug": "writes",
                "phase_index": 1,
                "config": {
                    "phase_type": "external_action",
                    "connection_id": str(conn_id),
                    "tool_name": WRITE_TOOL,
                },
            },
        ],
    }
    wf_id = await pg.fetchval(
        """insert into workflow_definitions (org_id, created_by, slug, name, status, definition)
           values ($1,$2,$3,$4,'draft',$5::jsonb) returning id""",
        org_id,
        user["id"],
        slug,
        definition["name"],
        json.dumps(definition),
    )
    print("seeded workflow " + definition["name"] + " (" + str(wf_id) + ")")
    return conn_id, wf_id, definition["name"]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


async def main():
    pg = await asyncpg.connect("postgresql://postgres:postgres@localhost:54322/postgres")
    conn_id, wf_id, wf_name = await seed(pg)

    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    link = sb.auth.admin.generate_link(
        {"type": "magiclink", "email": ADMIN_EMAIL, "options": {"redirect_to": FRONTEND_URL}}
    ).properties.action_link
    link = link.replace("http://127.0.0.1:54321", SUPABASE_URL).replace(
        "http://localhost:54321", SUPABASE_URL
    )
    try:
        loc = urllib.request.build_opener(NoRedirect).open(link).headers.get("Location")
    except urllib.error.HTTPError as e:
        loc = e.headers.get("Location")
    if not loc or "#access_token=" not in loc:
        raise RuntimeError("auth unwrap failed: " + str(loc))

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            ctx = await browser.new_context(viewport={"width": 1600, "height": 1000})
            page = await ctx.new_page()
            await page.goto(FRONTEND_URL + loc[loc.index("#"):], wait_until="networkidle")
            await page.wait_for_timeout(3000)

            # SC#1 - the canvas node face
            await page.locator(
                '[aria-label="Workflows"], button:has-text("Workflows"), a:has-text("Workflows")'
            ).first.click()
            await page.wait_for_timeout(2500)

            # Isolate the card through the library's OWN search box - a real user path, and
            # far more robust than guessing which wrapper div is the card. A bare
            # div:has-text() matched an ancestor and the Open click landed on nothing, which
            # failed all five canvas assertions at once and looked exactly like an app defect.
            search = page.locator(
                'input[placeholder*="Search by name"], input[placeholder*="Search"]'
            ).first
            await search.fill(wf_name)
            await page.wait_for_timeout(1500)

            open_btn = page.locator('[data-testid="draft-open"], button:has-text("Open"), a:has-text("Open")').first
            await open_btn.wait_for(state="visible", timeout=15000)
            await open_btn.click()
            await page.wait_for_timeout(5000)
            print("  (builder url: " + page.url + ")")

            body = await page.inner_text("body")
            check("SC#1 - node face names the CONNECTION", CONN_NAME in body, "wanted " + CONN_NAME)
            check("SC#1 - node face names the TOOL", READ_TOOL in body, "wanted " + READ_TOOL)
            check("SC#1 - the second step names its own tool", WRITE_TOOL in body)
            check("SC#2 POSITIVE - a declared read tool says ONLY READS", "ONLY READS" in body)
            check(
                "SC#2 FAIL-CLOSED - a read-VERB name with no hint still warns",
                "CHANGES SOMETHING OUTSIDE" in body,
            )
            await page.screenshot(path="scripts/209-sc1-spine.png", full_page=True)

            # The builder opens on SPINE. SC#1 names the CANVAS node specifically, and the two
            # are different components (PhaseSpineGraph vs PhaseNodeCard) that resolve the face
            # through the same vocabulary - so both must be driven or half the criterion is
            # asserted from the other half's evidence.
            canvas_tab = page.locator('button:has-text("Canvas"), [role="tab"]:has-text("Canvas")').first
            if await canvas_tab.count():
                await canvas_tab.click()
                await page.wait_for_timeout(3000)
                cbody = await page.inner_text("body")
                check("SC#1 CANVAS - node face names the CONNECTION", CONN_NAME in cbody)
                check("SC#1 CANVAS - node face names the TOOL", READ_TOOL in cbody)
                check("SC#2 CANVAS - ONLY READS on the declared read tool", "ONLY READS" in cbody)
                check(
                    "SC#2 CANVAS - fail-closed on the read-VERB tool with no hint",
                    "CHANGES SOMETHING OUTSIDE" in cbody,
                )
                await page.screenshot(path="scripts/209-sc1-canvas.png", full_page=True)
            else:
                check("SC#1 CANVAS - the Canvas tab is reachable", False, "tab not found")

            # SC#3 - the Connections filter
            await page.locator(
                '[aria-label="Settings"], button:has-text("Settings"), a:has-text("Settings")'
            ).first.click()
            await page.wait_for_timeout(2500)
            tab = page.locator(
                'button:has-text("Connections"), [role="tab"]:has-text("Connections")'
            ).first
            if await tab.count():
                await tab.click()
                await page.wait_for_timeout(2500)

            sbody = await page.inner_text("body")
            check("SC#3 - the MCP connection is listed at all", CONN_NAME in sbody)
            for chip in ("All", "Connected", "Not connected"):
                found = await page.locator('button:has-text("' + chip + '")').first.count()
                check("SC#3 - chip " + chip + " exists", found > 0)

            # THE REGRESSION THAT STARTED THE PHASE, stated as the property that actually
            # matters: All / Connected / Not connected is a PARTITION, so the MCP row must be
            # visible under All and under EXACTLY ONE of the other two. It may never vanish
            # from all of them, which is what the old capability chips did to it.
            #
            # (This connection is seeded with last_check_verdict NULL => `not_checked`, so
            # `Not connected` is its CORRECT home. Asserting it under `Connected` would have
            # been asserting a bug into existence - the first draft of this script did exactly
            # that and reported the app as failing.)
            seen_under = []
            for chip in ("All", "Connected", "Not connected"):
                c = page.locator('button:has-text("' + chip + '")').first
                if not await c.count():
                    continue
                await c.click()
                await page.wait_for_timeout(1500)
                if CONN_NAME in await page.inner_text("body"):
                    seen_under.append(chip)
            check("SC#3 - MCP row visible under All", "All" in seen_under, str(seen_under))
            check(
                "SC#3 - and under EXACTLY ONE state chip (never vanishes)",
                len([c for c in seen_under if c != "All"]) == 1,
                "seen under " + str(seen_under),
            )

            check(
                "SC#3 - no capability verb chips remain",
                ("Tickets" not in sbody) and ("Messages" not in sbody),
                "Email/Tickets/Messages must be gone",
            )
            await page.screenshot(path="scripts/209-sc3-connections.png", full_page=True)
            await browser.close()
    finally:
        await pg.execute("delete from workflow_definitions where id=$1", wf_id)
        await pg.execute("delete from connector_connections where id=$1", conn_id)
        await pg.close()
        print("cleaned up seeded rows")

    print("=" * 66)
    ok = sum(1 for _, o, _ in results if o)
    print("  " + str(ok) + "/" + str(len(results)) + " passed")
    for n, o, d in results:
        if not o:
            print("  FAILED: " + n + " " + d)
    print("=" * 66)


asyncio.run(main())
