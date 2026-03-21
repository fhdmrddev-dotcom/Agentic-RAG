from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.kb import LsResponse, TreeResponse

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


@router.get("/ls", response_model=LsResponse)
async def ls(
    path: str = Query(default="/", description="Folder path, e.g. /reports/q1"),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    all_folders = _fetch_visible_folders(supabase, current_user["id"])
    nodes, roots = _build_tree_map(all_folders)

    if path.strip("/") == "":
        # Root: list root folders + root documents (folder_id IS NULL)
        folder_entries = [
            {"id": r["id"], "name": r["name"], "is_global": r["is_global"]}
            for r in roots
        ]
        doc_result = (
            supabase.table("documents")
            .select("id, filename, status, created_at")
            .is_("folder_id", "null")
            .eq("user_id", current_user["id"])
            .execute()
        )
        return LsResponse(path="/", folders=folder_entries, documents=doc_result.data)

    # Subfolder path
    target = _resolve_path(path, roots)
    if target is None:
        raise HTTPException(status_code=404, detail="Path not found")

    folder_entries = [
        {"id": c["id"], "name": c["name"], "is_global": c["is_global"]}
        for c in target["children"]
    ]
    doc_result = (
        supabase.table("documents")
        .select("id, filename, status, created_at")
        .eq("folder_id", target["id"])
        .eq("user_id", current_user["id"])
        .execute()
    )
    return LsResponse(path=path, folders=folder_entries, documents=doc_result.data)


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
    all_folders = _fetch_visible_folders(supabase, current_user["id"])
    nodes, roots = _build_tree_map(all_folders)

    if path.strip("/") == "":
        # Root tree: all root nodes
        target_nodes = roots
    else:
        target = _resolve_path(path, roots)
        if target is None:
            raise HTTPException(status_code=404, detail="Path not found")
        target_nodes = [target]

    # Collect all folder IDs in the target subtree(s) for document fetch
    all_ids = []
    for tn in target_nodes:
        all_ids.extend(_collect_folder_ids(tn))

    # Fetch documents in the subtree (guard against empty list — avoids in_() empty list error)
    if all_ids:
        doc_result = (
            supabase.table("documents")
            .select("id, filename, folder_id, status, created_at")
            .in_("folder_id", all_ids)
            .eq("user_id", current_user["id"])
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

    # Attach documents to nodes (mutates the in-memory tree)
    for fid, doc_list in docs_by_folder.items():
        if fid in nodes:
            nodes[fid]["documents"] = doc_list

    # For root tree, also fetch root-level documents (folder_id IS NULL)
    if path.strip("/") == "":
        root_doc_result = (
            supabase.table("documents")
            .select("id, filename, status, created_at")
            .is_("folder_id", "null")
            .eq("user_id", current_user["id"])
            .execute()
        )
        root_docs = root_doc_result.data  # noqa: F841 — available for future use
    else:
        root_docs = []  # noqa: F841

    # Serialize with depth limit
    serialized = [_serialize_tree(tn, 0, depth) for tn in target_nodes]

    return TreeResponse(path=path, depth=depth, tree=serialized)
