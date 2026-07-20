import fnmatch
import re
from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from app.dependencies import get_current_user, get_user_supabase_client, get_user_pg_connection
from app.models.kb import LsResponse, TreeResponse, GrepResponse, GlobResponse, ReadResponse
from app.utils.folder_utils import (
    fetch_visible_folders as _fetch_all_visible_folders,
    get_globally_visible_folder_ids,
    _null_foreign_global_owner,
)

router = APIRouter(prefix="/kb", tags=["kb"])


async def _fetch_visible_folders(supabase: Client, user_id: str) -> list[dict]:
    """Fetch all folders visible to user (owned + in global subtree), deduplicated."""
    return await _fetch_all_visible_folders(supabase, user_id)


def _build_tree_map(folders: list[dict]) -> tuple[dict[str, dict], list[dict]]:
    """Build id->node map and return (nodes_by_id, roots)."""
    nodes: dict[str, dict] = {}
    for f in folders:
        if f["id"] not in nodes:
            nodes[f["id"]] = {**f, "children": [], "documents": []}
    roots = []
    for node in nodes.values():
        pid = node["parent_id"]
        if pid and pid in nodes:
            nodes[pid]["children"].append(node)
        else:
            roots.append(node)
    return nodes, roots


def _resolve_path(path: str, roots: list[dict]) -> dict | None:
    """Walk path segments case-insensitively through the tree. Returns node or None."""
    segments = [s for s in path.strip("/").split("/") if s]
    if not segments:
        return None  # root — callers handle directly
    current_level = roots
    current_node = None
    for segment in segments:
        match = next((n for n in current_level if n["name"].lower() == segment.lower()), None)
        if match is None:
            return None
        current_node = match
        current_level = match["children"]
    return current_node


async def ls_path(path: str, user_id: str, supabase: Client) -> dict:
    """Core ls logic callable outside the HTTP layer (e.g. from the agent tool loop)."""
    from app.utils.db import aexec  # noqa: PLC0415

    all_folders = await _fetch_visible_folders(supabase, user_id)
    nodes, roots = _build_tree_map(all_folders)

    if path.strip("/") == "":
        folder_entries = [
            {"id": r["id"], "name": r["name"], "is_org_shared": r["is_org_shared"]}
            for r in roots
        ]
        doc_result = await aexec(
            supabase.table("documents")
            .select("id, filename, status, created_at")
            .is_("folder_id", "null")
            .eq("user_id", user_id)
        )
        return {"path": "/", "folders": folder_entries, "documents": doc_result.data}

    target = _resolve_path(path, roots)
    if target is None:
        return {"error": f"Path '{path}' not found"}

    folder_entries = [
        {"id": c["id"], "name": c["name"], "is_org_shared": c["is_org_shared"]}
        for c in target["children"]
    ]
    # Docs in the target folder visible to this user
    own_docs_resp = await aexec(
        supabase.table("documents")
        .select("id, filename, status, created_at")
        .eq("folder_id", target["id"])
        .eq("user_id", user_id)
    )
    own_docs_in_folder = own_docs_resp.data or []
    global_folder_ids = await get_globally_visible_folder_ids(supabase, user_id)
    global_docs_in_folder = []
    if target["id"] in global_folder_ids:
        _gd_resp = await aexec(
            supabase.table("documents")
            .select("id, filename, status, created_at")
            .eq("folder_id", target["id"])
        )
        global_docs_in_folder = _gd_resp.data or []
    # Merge, dedup
    seen_ids: set[str] = set()
    doc_data: list[dict] = []
    for d in own_docs_in_folder + global_docs_in_folder:
        if d["id"] not in seen_ids:
            seen_ids.add(d["id"])
            doc_data.append(d)
    return {"path": path, "folders": folder_entries, "documents": doc_data}


async def tree_path(path: str, depth: int | None, user_id: str, supabase: Client) -> dict:
    """Core tree logic callable outside the HTTP layer (e.g. from the agent tool loop)."""
    from app.utils.db import aexec  # noqa: PLC0415

    all_folders = await _fetch_visible_folders(supabase, user_id)
    # D-165-05 (WR-01): the caller's non-owned-visible folder id set — the org-shared rows AND any
    # NON-shared descendants visible via a shared ancestor (get_globally_visible_folder_ids already
    # walks the shared subtree, org-scoped per D-165-04). Resolved once here, reused for doc scoping.
    non_owned_visible_ids = set(await get_globally_visible_folder_ids(supabase, user_id))
    # SEED-091 / D-164-05 (TEN-06) + D-165-05 (WR-01): null the seeding owner on EVERY non-owned
    # visible folder — the shared row AND its non-shared subtree descendants — BEFORE they are copied
    # into tree nodes (the shared uniform rule; folders/skills/views cannot diverge). The current
    # /tree serialize output omits user_id, so this is defense-in-depth + contract uniformity: any
    # node that later exposes user_id is already nulled for non-owners.
    _null_foreign_global_owner(all_folders, user_id, non_owned_visible_ids)
    nodes, roots = _build_tree_map(all_folders)

    if path.strip("/") == "":
        target_nodes = roots
    else:
        target = _resolve_path(path, roots)
        if target is None:
            return {"error": f"Path '{path}' not found"}
        target_nodes = [target]

    all_ids = []
    for tn in target_nodes:
        all_ids.extend(_collect_folder_ids(tn))

    if all_ids:
        global_folder_ids_set = non_owned_visible_ids  # reuse the D-165-05 set (no duplicate fetch)
        # Fetch own docs in subtree
        _own_resp = await aexec(
            supabase.table("documents")
            .select("id, filename, folder_id, status, created_at")
            .in_("folder_id", all_ids)
            .eq("user_id", user_id)
        )
        own_docs = _own_resp.data or []
        # Fetch docs in globally visible folders within subtree
        global_ids_in_subtree = [fid for fid in all_ids if fid in global_folder_ids_set]
        global_docs: list[dict] = []
        if global_ids_in_subtree:
            _glob_resp = await aexec(
                supabase.table("documents")
                .select("id, filename, folder_id, status, created_at")
                .in_("folder_id", global_ids_in_subtree)
            )
            global_docs = _glob_resp.data or []
        # Merge, dedup
        seen_ids: set[str] = set()
        all_docs: list[dict] = []
        for d in own_docs + global_docs:
            if d["id"] not in seen_ids:
                seen_ids.add(d["id"])
                all_docs.append(d)
        docs_by_folder: dict[str, list[dict]] = {}
        for doc in all_docs:
            fid = doc["folder_id"]
            if fid not in docs_by_folder:
                docs_by_folder[fid] = []
            docs_by_folder[fid].append({
                "id": doc["id"],
                "filename": doc["filename"],
                "status": doc["status"],
                "created_at": doc["created_at"],
            })
    else:
        docs_by_folder = {}

    for fid, doc_list in docs_by_folder.items():
        if fid in nodes:
            nodes[fid]["documents"] = doc_list

    serialized = [_serialize_tree(tn, 0, depth) for tn in target_nodes]
    return {"path": path, "depth": depth, "tree": serialized}


@router.get("/ls", response_model=LsResponse)
async def ls(
    path: str = Query(default="/", description="Folder path, e.g. /reports/q1"),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    result = await ls_path(path, current_user["id"], supabase)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return LsResponse(**result)


def _collect_folder_ids(node: dict) -> list[str]:
    """Collect all folder IDs in the subtree (BFS) including the node itself."""
    ids = [node["id"]]
    queue = list(node["children"])
    while queue:
        current = queue.pop(0)
        ids.append(current["id"])
        queue.extend(current["children"])
    return ids


def _serialize_tree(node: dict, current_depth: int, max_depth: int | None) -> dict:
    """Recursively serialize a folder node. Truncate at max_depth."""
    if max_depth is not None and current_depth >= max_depth:
        has_content = len(node["children"]) + len(node["documents"]) > 0
        return {
            "id": node["id"],
            "name": node["name"],
            "type": "folder",
            "is_org_shared": node["is_org_shared"],
            "truncated": has_content,
            "children": [],
            "documents": [],
        }
    return {
        "id": node["id"],
        "name": node["name"],
        "type": "folder",
        "is_org_shared": node["is_org_shared"],
        "truncated": False,
        "children": [_serialize_tree(c, current_depth + 1, max_depth) for c in node["children"]],
        "documents": node["documents"],
    }


@router.get("/tree", response_model=TreeResponse)
async def tree(
    path: str = Query(default="/", description="Folder path, e.g. /reports"),
    depth: int | None = Query(default=None, ge=1, description="Max depth below target; omit for unlimited"),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    result = await tree_path(path, depth, current_user["id"], supabase)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return TreeResponse(**result)


async def grep_path(pattern: str, path: str | None, user_id: str, supabase: Client) -> dict:
    """Search document full_markdown for regex pattern, optionally scoped to a folder subtree.

    Phase 164 (D-164-04): the cross-user WHERE-injection grep regex is DELETED — the
    query_user_documents INVOKER RPC now runs over the asyncpg user-context (get_user_pg_connection),
    so RLS scopes the arbitrary SELECT to the caller's org (RESEARCH Pitfall 4). The passed-in
    ``supabase`` client is still used for folder-tree resolution below; the folder-subtree
    narrowing + pattern-escaping (relevance, not a cross-user gate) are retained.
    """
    # Determine folder scoping
    folder_ids: list[str] | None = None
    if path and path.strip("/") != "":
        all_folders = await _fetch_visible_folders(supabase, user_id)
        nodes, roots = _build_tree_map(all_folders)
        target = _resolve_path(path, roots)
        if target is None:
            return {"error": f"Path '{path}' not found"}
        folder_ids = _collect_folder_ids(target)

    # Build SQL query using Postgres regex operator ~
    escaped_pattern = pattern.replace("'", "''")
    sql = f"SELECT id, filename, folder_id FROM documents WHERE full_markdown ~ '{escaped_pattern}'"
    if folder_ids is not None:
        ids_list = ", ".join(f"'{fid}'" for fid in folder_ids)
        sql += f" AND folder_id IN ({ids_list})"

    try:
        async with get_user_pg_connection(None, {"id": user_id}) as conn:
            data = await conn.fetchval("SELECT public.query_user_documents($1)", sql)
    except Exception as e:
        return {"error": f"Grep failed: {e}"}

    rows = data or []
    matches = [{"document_id": r["id"], "filename": r["filename"], "folder_id": r.get("folder_id")} for r in rows]
    return {"pattern": pattern, "path": path, "matches": matches, "total": len(matches)}


@router.get("/grep", response_model=GrepResponse)
async def grep(
    pattern: str = Query(description="Regex pattern to search in document content"),
    path: str | None = Query(default=None, description="Optional folder path to scope search, e.g. /reports"),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    result = await grep_path(pattern, path, current_user["id"], supabase)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return GrepResponse(**result)


def _build_folder_path_map(nodes: dict[str, dict], roots: list[dict]) -> dict[str, str]:
    """Build folder_id -> full_path mapping by walking the tree."""
    paths: dict[str, str] = {}

    def _walk(node: dict, parent_path: str):
        node_path = f"{parent_path}/{node['name']}" if parent_path else f"/{node['name']}"
        paths[node["id"]] = node_path
        for child in node["children"]:
            _walk(child, node_path)

    for root in roots:
        _walk(root, "")
    return paths


def _glob_pattern_to_regex(pattern: str) -> re.Pattern:
    """Convert a glob pattern with ** support into a compiled regex.

    ** matches any number of path segments (including zero or one).
    * matches any characters except path separators.
    ? matches any single character except a path separator.
    """
    # Replace **/ and ** with a placeholder, then escape, then restore as .*
    p = pattern.replace("**/", "\x00DSTAR\x00").replace("**", "\x00DSTAR\x00")
    p = re.escape(p)
    p = p.replace(re.escape("\x00DSTAR\x00"), ".*")
    p = p.replace(r"\*", "[^/]*")
    p = p.replace(r"\?", "[^/]")
    return re.compile("^" + p + "$")


async def glob_path(pattern: str, user_id: str, supabase: Client) -> dict:
    """Match document filenames against a glob pattern, path-aware.

    Patterns like '*.pdf' match any PDF. Patterns like 'reports/**/*.pdf'
    match PDFs under /reports at any depth. Supports *, ?, and ** (recursive).
    """
    from app.utils.db import aexec  # noqa: PLC0415

    all_folders = await _fetch_visible_folders(supabase, user_id)
    nodes, roots = _build_tree_map(all_folders)
    folder_paths = _build_folder_path_map(nodes, roots)

    # Fetch all visible documents (own + in globally visible folders)
    _own_resp = await aexec(
        supabase.table("documents")
        .select("id, filename, folder_id")
        .eq("user_id", user_id)
    )
    own_docs = _own_resp.data or []
    global_folder_ids_set = set(await get_globally_visible_folder_ids(supabase, user_id))
    global_docs: list[dict] = []
    if global_folder_ids_set:
        _glob_resp = await aexec(
            supabase.table("documents")
            .select("id, filename, folder_id")
            .in_("folder_id", list(global_folder_ids_set))
        )
        global_docs = _glob_resp.data or []
    seen_ids: set[str] = set()
    docs: list[dict] = []
    for d in own_docs + global_docs:
        if d["id"] not in seen_ids:
            seen_ids.add(d["id"])
            docs.append(d)

    compiled = _glob_pattern_to_regex(pattern)

    matches = []
    for doc in docs:
        fid = doc.get("folder_id")
        if fid and fid in folder_paths:
            doc_full_path = f"{folder_paths[fid]}/{doc['filename']}"
        else:
            doc_full_path = f"/{doc['filename']}"

        # Strip leading slash for comparison with pattern
        matchable = doc_full_path.lstrip("/")
        # Match against full path or just filename (for simple patterns like *.pdf)
        if compiled.match(matchable) or fnmatch.fnmatch(doc["filename"], pattern):
            matches.append({
                "document_id": doc["id"],
                "filename": doc["filename"],
                "path": doc_full_path,
                "folder_id": fid,
            })

    return {"pattern": pattern, "matches": matches, "total": len(matches)}


@router.get("/glob", response_model=GlobResponse)
async def glob_search(
    pattern: str = Query(description="Glob pattern for filename matching, e.g. *.pdf or reports/**/*.pdf"),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    result = await glob_path(pattern, current_user["id"], supabase)
    return GlobResponse(**result)


async def read_path(
    document_id: str,
    user_id: str,
    supabase: Client,
    start_line: int | None = None,
    end_line: int | None = None,
) -> dict:
    """Fetch full_markdown for a document, optionally sliced to a line range."""
    from app.utils.db import aexec  # noqa: PLC0415

    try:
        # Try fetching as owner first
        result = await aexec(
            supabase.table("documents")
            .select("id, filename, full_markdown")
            .eq("id", document_id)
            .eq("user_id", user_id)
            .maybe_single()
        )
        if not result or not result.data:
            # Check if document is in a globally visible folder
            global_folder_ids = await get_globally_visible_folder_ids(supabase, user_id)
            if global_folder_ids:
                result = await aexec(
                    supabase.table("documents")
                    .select("id, filename, full_markdown")
                    .eq("id", document_id)
                    .in_("folder_id", global_folder_ids)
                    .maybe_single()
                )
        if not result or not result.data:
            return {"error": f"Document '{document_id}' not found or access denied."}
    except Exception:
        return {"error": f"Document '{document_id}' not found or access denied."}

    doc = result.data
    markdown = doc.get("full_markdown") or ""

    if not markdown:
        return {"error": "No content available for this document."}

    lines = markdown.splitlines()
    total_lines = len(lines)

    if start_line is not None and end_line is not None:
        if start_line < 1 or end_line < start_line or start_line > total_lines:
            return {"error": f"Line range {start_line}-{end_line} is out of bounds. Document has {total_lines} lines."}
        end_line = min(end_line, total_lines)
        sliced = lines[start_line - 1 : end_line]
        numbered = "\n".join(f"{start_line + i}: {line}" for i, line in enumerate(sliced))
        return {
            "document_id": document_id,
            "filename": doc["filename"],
            "start_line": start_line,
            "end_line": end_line,
            "total_lines": total_lines,
            "content": numbered,
        }

    return {
        "document_id": document_id,
        "filename": doc["filename"],
        "total_lines": total_lines,
        "content": markdown,
    }


@router.get("/read", response_model=ReadResponse)
async def read(
    document_id: str = Query(description="UUID of the document to read"),
    start_line: int | None = Query(default=None, ge=1, description="First line to return (1-based, inclusive)"),
    end_line: int | None = Query(default=None, ge=1, description="Last line to return (1-based, inclusive)"),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    result = await read_path(document_id, current_user["id"], supabase, start_line, end_line)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return ReadResponse(**result)
