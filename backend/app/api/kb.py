import fnmatch
import re
from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.kb import LsResponse, TreeResponse, GrepResponse, GlobResponse

router = APIRouter(prefix="/kb", tags=["kb"])


def _fetch_visible_folders(supabase: Client, user_id: str) -> list[dict]:
    """Fetch all folders visible to user (owned + global), deduplicated."""
    result = (
        supabase.table("folders")
        .select("id, user_id, name, parent_id, is_global")
        .or_(f"user_id.eq.{user_id},is_global.eq.true")
        .execute()
    )
    seen = set()
    folders = []
    for row in result.data:
        if row["id"] not in seen:
            seen.add(row["id"])
            folders.append(row)
    return folders


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


def ls_path(path: str, user_id: str, supabase: Client) -> dict:
    """Core ls logic callable outside the HTTP layer (e.g. from the agent tool loop)."""
    all_folders = _fetch_visible_folders(supabase, user_id)
    nodes, roots = _build_tree_map(all_folders)

    if path.strip("/") == "":
        folder_entries = [
            {"id": r["id"], "name": r["name"], "is_global": r["is_global"]}
            for r in roots
        ]
        doc_result = (
            supabase.table("documents")
            .select("id, filename, status, created_at")
            .is_("folder_id", "null")
            .eq("user_id", user_id)
            .execute()
        )
        return {"path": "/", "folders": folder_entries, "documents": doc_result.data}

    target = _resolve_path(path, roots)
    if target is None:
        return {"error": f"Path '{path}' not found"}

    folder_entries = [
        {"id": c["id"], "name": c["name"], "is_global": c["is_global"]}
        for c in target["children"]
    ]
    doc_result = (
        supabase.table("documents")
        .select("id, filename, status, created_at")
        .eq("folder_id", target["id"])
        .eq("user_id", user_id)
        .execute()
    )
    return {"path": path, "folders": folder_entries, "documents": doc_result.data}


def tree_path(path: str, depth: int | None, user_id: str, supabase: Client) -> dict:
    """Core tree logic callable outside the HTTP layer (e.g. from the agent tool loop)."""
    all_folders = _fetch_visible_folders(supabase, user_id)
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
        doc_result = (
            supabase.table("documents")
            .select("id, filename, folder_id, status, created_at")
            .in_("folder_id", all_ids)
            .eq("user_id", user_id)
            .execute()
        )
        docs_by_folder: dict[str, list[dict]] = {}
        for doc in doc_result.data:
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
    supabase: Client = Depends(get_supabase),
):
    result = ls_path(path, current_user["id"], supabase)
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
            "is_global": node["is_global"],
            "truncated": has_content,
            "children": [],
            "documents": [],
        }
    return {
        "id": node["id"],
        "name": node["name"],
        "type": "folder",
        "is_global": node["is_global"],
        "truncated": False,
        "children": [_serialize_tree(c, current_depth + 1, max_depth) for c in node["children"]],
        "documents": node["documents"],
    }


@router.get("/tree", response_model=TreeResponse)
async def tree(
    path: str = Query(default="/", description="Folder path, e.g. /reports"),
    depth: int | None = Query(default=None, ge=1, description="Max depth below target; omit for unlimited"),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    result = tree_path(path, depth, current_user["id"], supabase)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return TreeResponse(**result)


def _inject_user_id_for_grep(sql: str, user_id: str) -> str:
    """Inject user_id filter into grep SQL. Always targets documents table."""
    condition = f"documents.user_id = '{user_id}'"
    if re.search(r"\bwhere\b", sql, re.IGNORECASE):
        return re.sub(r"\b(where)\b", f"WHERE {condition} AND", sql, count=1, flags=re.IGNORECASE)
    return sql + f" WHERE {condition}"


def grep_path(pattern: str, path: str | None, user_id: str, supabase: Client) -> dict:
    """Search document full_markdown for regex pattern, optionally scoped to a folder subtree."""
    # Determine folder scoping
    folder_ids: list[str] | None = None
    if path and path.strip("/") != "":
        all_folders = _fetch_visible_folders(supabase, user_id)
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
        result = supabase.rpc("query_user_documents", {"sql_query": _inject_user_id_for_grep(sql, user_id)}).execute()
    except Exception as e:
        return {"error": f"Grep failed: {e}"}

    rows = result.data or []
    matches = [{"document_id": r["id"], "filename": r["filename"], "folder_id": r.get("folder_id")} for r in rows]
    return {"pattern": pattern, "path": path, "matches": matches, "total": len(matches)}


@router.get("/grep", response_model=GrepResponse)
async def grep(
    pattern: str = Query(description="Regex pattern to search in document content"),
    path: str | None = Query(default=None, description="Optional folder path to scope search, e.g. /reports"),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    result = grep_path(pattern, path, current_user["id"], supabase)
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


def glob_path(pattern: str, user_id: str, supabase: Client) -> dict:
    """Match document filenames against a glob pattern, path-aware.

    Patterns like '*.pdf' match any PDF. Patterns like 'reports/**/*.pdf'
    match PDFs under /reports at any depth. Supports *, ?, and ** (recursive).
    """
    all_folders = _fetch_visible_folders(supabase, user_id)
    nodes, roots = _build_tree_map(all_folders)
    folder_paths = _build_folder_path_map(nodes, roots)

    # Fetch all user's documents
    result = (
        supabase.table("documents")
        .select("id, filename, folder_id")
        .eq("user_id", user_id)
        .execute()
    )
    docs = result.data or []

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
    supabase: Client = Depends(get_supabase),
):
    result = glob_path(pattern, current_user["id"], supabase)
    return GlobResponse(**result)
