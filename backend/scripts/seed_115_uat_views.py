"""Phase 115 UAT — seed two GROUNDED saved views on the real local data and verify
the agent tool handler resolves them (catalog + saved-view + inline-filter) leak-safely.

Idempotent: deletes any prior same-name view for the UAT user before inserting.
Run: cd backend && venv/Scripts/python scripts/seed_115_uat_views.py
"""
import asyncio
import json
import sys
from types import SimpleNamespace

# reuse the test helper that reads SUPABASE_URL + SERVICE_ROLE_KEY from backend/.env
sys.path.insert(0, ".")
from tests.integration.test_115_tool_global_leak import _read_local_supabase_env  # noqa: E402

UAT_USER = "d8a54002-6a29-4b88-b918-cff2aa4a06d5"  # owns all 36 local docs

VIEWS = [
    {"name": "Reports",
     "filter_expr": {"op": "and", "conditions": [{"field": "document_type", "op": "eq", "value": "report"}]}},
    {"name": "Dana's Docs",
     "filter_expr": {"op": "and", "conditions": [{"field": "author", "op": "eq", "value": "Dana Whitfield"}]}},
]


def build_client():
    creds = _read_local_supabase_env()
    if creds is None:
        print("FATAL: local SUPABASE_URL / SERVICE_ROLE_KEY not found in backend/.env")
        sys.exit(1)
    from supabase import create_client
    return create_client(*creds)


def seed(client):
    for v in VIEWS:
        # idempotent: drop prior same-name own view
        client.table("document_views").delete().eq("user_id", UAT_USER).eq("name", v["name"]).execute()
        client.table("document_views").insert({
            "user_id": UAT_USER, "name": v["name"],
            "filter_expr": v["filter_expr"], "is_global": False,
        }).execute()
        print(f"seeded view: {v['name']}")


async def verify(client):
    from app.services.tool_dispatcher import _handle_query_documents_by_view
    ctx = SimpleNamespace(supabase=client, current_user={"id": UAT_USER}, phase_whitelist=None)

    async def call(label, args):
        out = json.loads((await _handle_query_documents_by_view(args, ctx)).result)
        keys = list(out.keys())
        total = out.get("total")
        refs = out.get("source_refs") or out.get("documents") or []
        files = [r.get("filename") for r in refs][:5]
        views = out.get("views") or out.get("saved_views")
        ff = out.get("filterable_fields")
        print(f"\n[{label}] keys={keys}")
        if ff is not None:
            print(f"  filterable_fields={ff}")
        if views is not None:
            print(f"  saved_views={[ (vv.get('name') if isinstance(vv,dict) else vv) for vv in views]}")
        if total is not None:
            print(f"  total={total}  shown_files={files}")
        return out

    await call("CATALOG (empty args)", {})
    await call("SAVED-VIEW 'Reports'", {"view": "Reports"})
    await call("SAVED-VIEW 'Dana's Docs'", {"view": "Dana's Docs"})
    await call("INLINE-FILTER document_type=financial report",
               {"filter": {"op": "and", "conditions": [{"field": "document_type", "op": "eq", "value": "financial report"}]}})
    await call("UNKNOWN view -> catalog (no leak)", {"view": "Nonexistent View 12345"})


def main():
    client = build_client()
    seed(client)
    asyncio.run(verify(client))
    print("\nDONE — views seeded + handler verified on real data.")


if __name__ == "__main__":
    main()
