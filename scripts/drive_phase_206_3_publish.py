"""Phase 206.3 Browser Drive: Drive publishing an MCP workflow end-to-end in real Chromium.

Uses Playwright + Chromium (headless), logs in as org admin, opens the builder,
publishes an MCP-shaped external action workflow, asserts on the verdict modal,
and verifies the governance receipts in harness_audit.
"""
import asyncio
import json
import uuid
import asyncpg
from playwright.async_api import async_playwright
from supabase import create_client

SUPABASE_URL = "http://[::1]:54321"
SUPABASE_SERVICE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzM2NzM0OTUsImV4cCI6MjA4OTAzMzQ5NX0.H-ZHqezteHdwd19_PQtoKrwX_B5c_RRvoy8Ir7K-P1o"
)
FRONTEND_URL = "http://localhost:5173"
ADMIN_EMAIL = "fhdmrd@gmail.com"


async def setup_or_get_mcp_workflow(conn: asyncpg.Connection, user_id: uuid.UUID, org_id: uuid.UUID):
    # Check if a connection exists
    conn_row = await conn.fetchrow(
        "select id, name, tool_grants from connector_connections where mcp_server_url is not null and is_enabled = true limit 1"
    )
    if not conn_row:
        raise RuntimeError("No enabled MCP connection found in connector_connections")
    
    connection_id = conn_row["id"]
    print(f"Using MCP connection: {conn_row['name']} ({connection_id})")

    # Ensure tool_grants has read_wiki_structure: true
    grants = conn_row["tool_grants"]
    if isinstance(grants, str):
        grants = json.loads(grants)
    grants = dict(grants or {})
    grants["read_wiki_structure"] = True
    await conn.execute(
        "update connector_connections set tool_grants = $1 where id = $2",
        json.dumps(grants), connection_id
    )

    wf_slug = f"mcp-publish-drive-{uuid.uuid4().hex[:8]}"
    definition = {
        "slug": wf_slug,
        "version": 1,
        "name": f"MCP Publish Drive {uuid.uuid4().hex[:4]}",
        "status": "draft",
        "business_requirement": "Provide a comprehensive overview of React repository architecture.",
        "phases": [
            {
                "slug": "mcp-lookup",
                "phase_index": 0,
                "name": "Lookup DeepWiki",
                "config": {
                    "phase_type": "external_action",
                    "connection_id": str(connection_id),
                    "tool_name": "read_wiki_structure",
                    "tool_args": {"repo": "facebook/react"},
                },
                "validators": [],
            },
            {
                "slug": "final-report",
                "phase_index": 1,
                "name": "Produce Final Report",
                "config": {
                    "phase_type": "llm_single",
                    "prompt": "Write a detailed explanation of React architecture covering JSX, component lifecycle, virtual DOM, and hooks.",
                },
                "validators": [],
            },
        ],
    }

    wf_id = uuid.uuid4()
    await conn.execute(
        """
        insert into workflow_definitions (id, slug, version, name, status, definition, created_by, org_id, updated_at)
        values ($1, $2, $3, $4, $5, $6, $7, $8, now())
        """,
        wf_id, wf_slug, 1, definition["name"], "draft", json.dumps(definition), user_id, org_id
    )
    print(f"Created MCP workflow draft: {wf_id} ({definition['name']})")
    return wf_id, definition["name"]


async def main():
    # 1. Connect to Postgres
    pg_conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:54322/postgres")
    
    user_row = await pg_conn.fetchrow("select id, email from auth.users where email = $1", ADMIN_EMAIL)
    if not user_row:
        raise RuntimeError(f"User {ADMIN_EMAIL} not found in auth.users")
    user_id = user_row["id"]
    
    org_row = await pg_conn.fetchrow("select org_id from workflow_definitions where org_id is not null limit 1")
    org_id = org_row["org_id"] if org_row else uuid.uuid4()

    wf_id, wf_name = await setup_or_get_mcp_workflow(pg_conn, user_id, org_id)

    # 2. Generate Supabase magic link and unwrap access token
    import urllib.request, urllib.error
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    res = sb.auth.admin.generate_link({
        "type": "magiclink",
        "email": ADMIN_EMAIL,
        "options": {"redirect_to": FRONTEND_URL}
    })
    action_link = res.properties.action_link
    action_link = action_link.replace("http://127.0.0.1:54321", SUPABASE_URL).replace("http://localhost:54321", SUPABASE_URL)

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener(NoRedirect)
    try:
        resp = opener.open(action_link)
        loc = resp.headers.get("Location")
    except urllib.error.HTTPError as e:
        loc = e.headers.get("Location")

    if not loc or "#access_token=" not in loc:
        raise RuntimeError(f"Failed to unwrap access token: {loc}")

    frontend_auth_url = FRONTEND_URL + loc[loc.index("#"):]
    print(f"Auth URL unwrapped successfully: {frontend_auth_url[:60]}...")

    # 3. Launch Playwright
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        # Listen to console logs safely
        def safe_log(msg):
            try:
                t = msg.text.encode("ascii", errors="replace").decode("ascii")
                print(f"[Browser Console {msg.type}] {t}")
            except Exception:
                pass

        page.on("console", safe_log)

        print("Navigating to frontend with access token...")
        await page.goto(frontend_auth_url, wait_until="networkidle")
        await page.wait_for_timeout(3000)

        print(f"Current page URL: {page.url}")

        # Navigate to Workflows rail
        workflows_btn = page.locator('[aria-label="Workflows"]')
        if await workflows_btn.count() > 0:
            print("Clicking Workflows rail button...")
            await workflows_btn.click()
            await page.wait_for_timeout(1500)
        else:
            print("Workflows rail button not found directly, looking for text 'Workflows'...")
            await page.locator('button:has-text("Workflows"), a:has-text("Workflows")').first.click()
            await page.wait_for_timeout(1500)

        # Locate our workflow card or row
        print(f"Looking for workflow card '{wf_name}'...")
        wf_card = page.locator(f'[data-testid="draft-card"]:has-text("{wf_name}"), div:has-text("{wf_name}")').first
        await wf_card.wait_for(state="visible", timeout=10000)
        print("Found workflow card! Clicking Open button...")
        open_btn = wf_card.locator('[data-testid="draft-open"], button:has-text("Open")').first
        if await open_btn.count() > 0:
            await open_btn.click()
        else:
            await wf_card.click()
        await page.wait_for_timeout(3000)

        # In builder, look for Publish trigger button
        print("Looking for Publish trigger button in Builder...")
        publish_trigger = page.locator('[data-testid="publish-trigger"]').first
        await publish_trigger.wait_for(state="visible", timeout=10000)
        print("Clicking Publish trigger button...")
        await publish_trigger.click()
        await page.wait_for_timeout(1500)

        # In the Publish dialog / modal
        print("Looking for golden input textarea...")
        golden_input = page.locator('textarea#golden_input, [data-testid="golden-input"]').first
        await golden_input.wait_for(state="visible", timeout=5000)
        print("Filling golden input...")
        await golden_input.fill("Explain React repository architecture covering virtual DOM and component lifecycle.")

        # Click the confirm / start publish button in modal
        run_checks_btn = page.locator('button:has-text("Publish — run the checks")').first
        await run_checks_btn.click()
        print("Publish run initiated. Waiting for verdict...")

        # Wait for publish completion (up to 90s)
        verdict_locator = page.locator('[data-testid="run-cta"], [data-testid="http-outcome"], [data-testid="raw-verdict"]').first
        await verdict_locator.wait_for(state="visible", timeout=90000)
        await page.wait_for_timeout(2000)

        # Get modal or page banner text
        if await page.locator('[data-testid="run-cta"]').count() > 0:
            full_modal = await page.locator('[data-testid="run-cta"]').inner_text()
        else:
            modal_text = await page.locator('[role="dialog"]').all_text_contents()
            full_modal = "\n".join(modal_text) if modal_text else await page.body().inner_text()
        print("=== PUBLISH VERDICT MODAL / CTA ===")
        print(full_modal.encode("ascii", errors="replace").decode("ascii"))
        print("=============================")

        # Check DB state
        wf_db = await pg_conn.fetchrow(
            "select id, name, status, version from workflow_definitions where id = $1", wf_id
        )
        print(f"Database workflow row: status={wf_db['status']!r}, version={wf_db['version']}")

        # Query harness_audit receipts using the string scalar format
        audit_rows = await pg_conn.fetch(
            """
            select created_at, event_type, metadata
            from harness_audit
            where (metadata #>> '{}')::jsonb ->> 'definition_id' = $1
            order by created_at desc
            """,
            str(wf_id)
        )
        print(f"Harness audit rows for definition {wf_id} ({len(audit_rows)} rows):")
        for r in audit_rows:
            meta = r["metadata"]
            if isinstance(meta, str):
                meta = json.loads(meta)
            print(f"  [{r['created_at']}] {r['event_type']}: {meta}")

        # Assertions
        assert wf_db["status"] == "published", f"Expected published, got {wf_db['status']}"
        assert wf_db["version"] >= 1, f"Expected version >= 1, got {wf_db['version']}"
        assert "golden_run_error" not in full_modal, "Modal contains golden_run_error"
        assert any(r["event_type"] == "publish_attempted" for r in audit_rows), "Missing publish_attempted audit row"
        assert any(r["event_type"] == "publish_succeeded" for r in audit_rows), "Missing publish_succeeded audit row"

        print("SUCCESS: Phase 206.3 browser drive completed successfully!")
        await browser.close()

    await pg_conn.close()


if __name__ == "__main__":
    asyncio.run(main())
