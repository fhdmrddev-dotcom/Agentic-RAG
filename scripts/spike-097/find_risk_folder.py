"""Discover candidate risk-content KB folders for the test user (THROWAWAY spike).

Phase 097 Wave 0 (SEED-051). Lists the dev test user's KB folders, counts the
documents in each folder's subtree, ranks them by likely risk content, and writes
the ranked candidates to out/kb-folders.json for the operator to choose from in
Task 3. It DOES NOT pick a folder — that is the operator's human judgment call.

Security (threat T-097-01): builds a SERVICE-ROLE Supabase client (bypasses RLS),
so EVERY query is filtered by the test user's resolved user_id. The service-role
key is loaded name-only from backend/.env and is NEVER printed or written to out/.

Mirrors (read-only, never imported/modified):
  - backend/app/dependencies.py get_supabase()  -> create_client(url, service_role_key)
  - backend/app/api/kb.py:186 _collect_folder_ids() -> BFS subtree collection

Run from the repo root:
    backend/venv/Scripts/python.exe scripts/spike-097/find_risk_folder.py
"""

from __future__ import annotations

import json
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

# scripts/spike-097/find_risk_folder.py -> parents[2] == repo root
REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = REPO_ROOT / "backend"
OUT_PATH = Path(__file__).resolve().parent / "out" / "kb-folders.json"

# Add backend/ to sys.path so `settings` (and anything it needs) resolves, per plan.
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402

# Load backend/.env into the environment (secrets stay name-only — never echoed).
load_dotenv(BACKEND_DIR / ".env")

from supabase import Client, create_client  # noqa: E402  (mirrors dependencies.get_supabase)

TEST_EMAIL = "fhdmrd@gmail.com"

# Folder-name heuristic for "likely holds risk/project content suitable for a
# risk register" — ranked ahead of pure doc count.
RISK_NAME_RE = re.compile(r"risk|register|project|charter|status", re.IGNORECASE)


def get_supabase() -> Client:
    """Mirror backend/app/dependencies.get_supabase() — service-role client.

    Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY name-only from the loaded
    backend/.env. The key value is never printed (T-097-01).
    """
    url = os.environ.get("SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_role_key:
        missing = [n for n, v in (("SUPABASE_URL", url),
                                  ("SUPABASE_SERVICE_ROLE_KEY", service_role_key)) if not v]
        raise SystemExit(f"Missing required env var(s) in backend/.env: {', '.join(missing)}")
    return create_client(url, service_role_key)


def resolve_user_id(supabase: Client) -> str | None:
    """Resolve the test user's UUID for TEST_EMAIL.

    Primary: Supabase admin API (paginated). Fallback: direct auth.users query
    against local Postgres (:54322) via psycopg2.
    """
    # Primary — Supabase admin API.
    try:
        page = 1
        while page <= 50:  # hard cap — dev DB has a handful of users
            resp = supabase.auth.admin.list_users(page=page, per_page=200)
            users = resp if isinstance(resp, list) else (getattr(resp, "users", None) or [])
            if not users:
                break
            for u in users:
                email = (getattr(u, "email", "") or "").lower()
                if email == TEST_EMAIL.lower():
                    return str(getattr(u, "id"))
            if len(users) < 200:
                break
            page += 1
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] admin.list_users() failed ({type(exc).__name__}: {exc}); trying Postgres fallback")

    # Fallback — direct local Postgres query.
    try:
        import psycopg2  # noqa: PLC0415

        dsn = os.environ.get("POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
        conn = psycopg2.connect(dsn)
        try:
            cur = conn.cursor()
            cur.execute("select id from auth.users where lower(email) = lower(%s) limit 1", (TEST_EMAIL,))
            row = cur.fetchone()
            if row:
                return str(row[0])
        finally:
            conn.close()
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] psycopg2 auth.users fallback failed ({type(exc).__name__}: {exc})")

    return None


def build_subtree_index(folders: list[dict]) -> dict[str, list[str]]:
    """For each folder id, the list of folder ids in its subtree (BFS, self-first).

    Mirrors backend/app/api/kb.py:186 _collect_folder_ids() over a flat folder list.
    """
    children: dict[str | None, list[str]] = defaultdict(list)
    for f in folders:
        children[f.get("parent_id")].append(f["id"])

    def subtree(root_id: str) -> list[str]:
        ids = [root_id]
        queue = list(children.get(root_id, []))
        while queue:
            cur = queue.pop(0)
            ids.append(cur)
            queue.extend(children.get(cur, []))
        return ids

    return {f["id"]: subtree(f["id"]) for f in folders}


def main() -> int:
    supabase = get_supabase()

    user_id = resolve_user_id(supabase)
    if not user_id:
        print(f"[error] Could not resolve a user_id for {TEST_EMAIL}. "
              f"Confirm the test user exists in local Supabase (auth.users).")
        return 1
    print(f"resolved user_id for {TEST_EMAIL}: {user_id}")

    # User-owned folders ONLY (T-097-01: never read other users'/global folders).
    folders = (
        supabase.table("folders")
        .select("id,name,parent_id,user_id")
        .eq("user_id", user_id)
        .execute()
        .data
    ) or []

    # Latest documents owned by the user (is_latest=True avoids counting old versions).
    docs = (
        supabase.table("documents")
        .select("id,folder_id,is_latest")
        .eq("user_id", user_id)
        .eq("is_latest", True)
        .execute()
        .data
    ) or []

    doc_counts: Counter[str] = Counter(d["folder_id"] for d in docs if d.get("folder_id"))
    root_doc_count = sum(1 for d in docs if not d.get("folder_id"))

    if not folders:
        print(f"[warn] test user {TEST_EMAIL} has NO folders. "
              f"Ingest a small risk corpus (manual upload) into a folder, then re-run.")

    subtree_index = build_subtree_index(folders)

    candidates: list[dict] = []
    for f in folders:
        subtree_ids = subtree_index[f["id"]]
        dc = sum(doc_counts.get(fid, 0) for fid in subtree_ids)
        candidates.append({
            "folder_id": f["id"],
            "name": f["name"],
            "subtree_folder_ids": subtree_ids,
            "doc_count": dc,
            "name_match": bool(RISK_NAME_RE.search(f["name"] or "")),
        })

    # Rank: name-matched first, then by subtree doc count desc, then name.
    candidates.sort(key=lambda c: (not c["name_match"], -c["doc_count"], (c["name"] or "").lower()))

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(candidates, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\nwrote {OUT_PATH} ({len(candidates)} candidate folders; "
          f"{root_doc_count} latest docs at root with no folder)")

    grounded = [c for c in candidates if c["doc_count"] >= 1]
    if not grounded:
        print("\n[warn] NO candidate folder has any documents (doc_count >= 1).")
        print("       The experiments cannot ground on an empty folder — ingest a small")
        print(f"       risk corpus for {TEST_EMAIL} first, then re-run find_risk_folder.py.")

    print("\nTop candidates (operator picks one in Task 3):")
    print(f"  {'doc_count':>9}  {'name_match':>10}  {'subtree':>7}  name  (folder_id)")
    for c in candidates[:5]:
        print(f"  {c['doc_count']:>9}  {str(c['name_match']):>10}  "
              f"{len(c['subtree_folder_ids']):>7}  {c['name']!r}  ({c['folder_id']})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
