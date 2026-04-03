import asyncio
import json
import time as time_mod
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from openai import APIError
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.message import MessageCreate, MessageResponse
from app.models.thread import ThreadCreate, ThreadResponse, ThreadUpdate
from app.models.user_settings import load_user_settings
from app.config import settings
from app.services.openai_service import create_streaming_chat, get_llm_client, get_explorer_tools, EXPLORER_SYSTEM_PROMPT

# Lazy sandbox import — only if enabled
if settings.sandbox_enabled:
    from app.services.sandbox_service import sandbox_manager, harvest_output_files
from app.services.retrieval_service import search_documents, resolve_document_id, fetch_full_document
from app.services.web_search_service import web_search
from app.services.sql_service import query_documents
from app.services.sub_agent_service import run_sub_agent
from app.api.kb import ls_path, tree_path, grep_path, glob_path, read_path

router = APIRouter(prefix="/threads", tags=["threads"])

SYSTEM_PROMPT = (
    "You are a helpful AI assistant. You have twelve tools — use the RIGHT one for each question:\n\n"
    "1. ls — List the immediate contents (subfolders and documents) at a folder path. "
    "Use for browsing and navigation: 'what folders do I have?', 'what's in my Reports folder?', "
    "'list documents in /Finance/Q1', 'show me the subfolders of Research'. "
    "Use path='/' for the root level.\n\n"
    "2. tree — Show the full folder hierarchy as a tree with documents attached. "
    "Use when the user wants a structural overview: 'show me my folder structure', "
    "'what's the hierarchy?', 'show everything in Research as a tree'. "
    "Optionally pass depth to limit expansion (e.g. depth=2).\n\n"
    "3. grep — Search inside document contents using a regex pattern. Returns document names "
    "where the extracted markdown matches. Use for finding specific text or patterns: "
    "'find documents mentioning budget', 'which files contain Python code?'. "
    "Optionally scope to a folder path.\n\n"
    "4. glob — Find documents by filename pattern using glob syntax. Use for locating files by "
    "name or extension: 'find all PDFs', 'find files named report*', 'find .docx files in reports'. "
    "Supports *, ?, **.\n\n"
    "5. read_document — Read the full markdown content of a document (or a specific line range) by its document_id. "
    "Use AFTER grep or glob to inspect actual content. Pass start_line/end_line for a targeted section. "
    "Line-range output includes line numbers for orientation. document_id is a UUID from grep/glob/ls results.\n\n"
    "6. query_documents — Run a SQL SELECT against the documents or folders tables. "
    "Use for analytical/structured questions: 'how many documents do I have?', "
    "'list all PDFs', 'which files were uploaded in 2024?', 'which folder is X in?'. "
    "Do NOT add a user_id filter. "
    "Example: SELECT d.filename FROM documents d JOIN folders f ON d.folder_id = f.id "
    "WHERE f.name = 'Research'.\n\n"
    "7. search_documents — Find information INSIDE document contents using semantic search. "
    "Use metadata_filter to narrow by document_type, author, language, or date.\n\n"
    "8. analyze_document — Read the FULL content of a specific document for tasks requiring "
    "the entire document: summarization, detailed analysis, comparison, extracting all key points. "
    "You can use a partial or approximate filename — it will be matched automatically. "
    "Do NOT use search_documents for whole-document analysis tasks.\n\n"
    "9. web_search — Search the web for current events, software versions, news, or general world "
    "knowledge UNLIKELY to be in the user's uploaded documents. Always include the source URL.\n\n"
    "10. load_skill — Load full instructions for a skill from your skill catalog. "
    "Use when the user's request matches a skill description shown in the Available Skills section.\n\n"
    "11. save_skill — Create or update a skill with a name, description, and instructions. "
    "Use when the user asks to save, create, or define a new skill.\n\n"
    "12. read_skill_file — Read the content of a building-block file attached to a skill. "
    "Use after load_skill shows available files.\n\n"
    "13. execute_code - Execute Python code in a sandboxed Docker container. "
    "Variables and packages persist within the same thread. Write files to /sandbox/output/ "
    "for download links. Use for calculations, data analysis, chart generation, or any coding task.\n\n"
    "Key rules:\n"
    "- Browse/navigate folders → ls or tree\n"
    "- Find documents by content pattern → grep\n"
    "- Find documents by filename pattern → glob\n"
    "- Read full document content or a line range → read_document\n"
    "- Analytical questions about the library (counts, filters, joins) → query_documents\n"
    "- Find information inside documents → search_documents\n"
    "- Deep analysis/summary of a whole document → analyze_document\n"
    "- World/internet knowledge → web_search\n"
    "- Load/use a skill from the catalog → load_skill\n"
    "- Create or update a skill → save_skill\n"
    "- Read a file attached to a skill → read_skill_file\n"
    "- Run Python code, generate charts, do calculations -> execute_code\n"
    "- Always say where the information came from."
)


@router.get("", response_model=list[ThreadResponse])
async def list_threads(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    response = (
        supabase.table("threads")
        .select("*")
        .eq("user_id", current_user["id"])
        .order("updated_at", desc=True)
        .execute()
    )
    return response.data


@router.post("", response_model=ThreadResponse, status_code=status.HTTP_201_CREATED)
async def create_thread(
    body: ThreadCreate = ThreadCreate(),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    insert_data: dict = {"user_id": current_user["id"], "title": body.title}
    if body.folder_id:
        insert_data["folder_id"] = str(body.folder_id)
    response = supabase.table("threads").insert(insert_data).execute()
    return response.data[0]


@router.patch("/{thread_id}", response_model=ThreadResponse)
async def rename_thread(
    thread_id: str,
    body: ThreadUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    supabase.table("threads").update({"title": body.title.strip() or "New Chat"}).eq("id", thread_id).eq("user_id", current_user["id"]).execute()
    result = supabase.table("threads").select("*").eq("id", thread_id).eq("user_id", current_user["id"]).single().execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    return result.data


@router.delete("/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_thread(
    thread_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Close sandbox session if sandbox is enabled (SAND-10)
    if settings.sandbox_enabled:
        from app.services.sandbox_service import sandbox_manager
        sandbox_manager.close_session(thread_id)
    supabase.table("threads").delete().eq("id", thread_id).eq("user_id", current_user["id"]).execute()


def generate_thread_title(first_user_message: str, user_settings=None) -> str:
    """Call LLM to produce a short thread title from the first user message."""
    try:
        client = get_llm_client(user_settings)
        model = user_settings.llm_model if user_settings else settings.llm_model
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "Generate a concise chat title (4-6 words max) for the following message. Respond with only the title, no punctuation, no quotes.",
                },
                {"role": "user", "content": first_user_message[:500]},
            ],
            max_tokens=20,
            stream=False,
        )
        return response.choices[0].message.content.strip() or "New Chat"
    except Exception:
        return first_user_message[:40].strip() or "New Chat"


@router.get("/{thread_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    thread_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    thread = (
        supabase.table("threads")
        .select("id")
        .eq("id", thread_id)
        .eq("user_id", current_user["id"])
        .single()
        .execute()
    )
    if not thread.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    response = (
        supabase.table("messages")
        .select("*")
        .eq("thread_id", thread_id)
        .eq("user_id", current_user["id"])
        .order("created_at")
        .execute()
    )
    return response.data


def _reconstruct_history(history_rows: list[dict]) -> list[dict]:
    """
    Reconstruct an OpenAI-compatible multi-turn message list from stored DB rows.

    For assistant messages that have tool_calls with tool_call_id:
      Emits 3 entries: (1) assistant+tool_calls, (2) tool result(s), (3) assistant text.
    For old assistant messages without tool_call_id (backward compat) or with no
    tool_calls: emits a plain {"role": "assistant", "content": ...}.
    User messages pass through unchanged.
    """
    messages: list[dict] = []
    for msg in history_rows:
        tool_calls_data = msg.get("tool_calls")
        if (
            msg["role"] == "assistant"
            and tool_calls_data
            and isinstance(tool_calls_data, list)
            and len(tool_calls_data) > 0
        ):
            # Only reconstruct if all entries have tool_call_id (new format)
            if all(tc.get("tool_call_id") for tc in tool_calls_data):
                # 1. Assistant message announcing tool calls
                messages.append({
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": tc["tool_call_id"],
                            "type": "function",
                            "function": {
                                "name": tc["name"],
                                "arguments": json.dumps(tc.get("args", {})),
                            },
                        }
                        for tc in tool_calls_data
                    ],
                })
                # 2. Tool result messages (one per tool call)
                for tc in tool_calls_data:
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc["tool_call_id"],
                        "content": tc.get("result") or "",
                    })
                # 3. Assistant text response (only if content is non-empty)
                if msg.get("content"):
                    messages.append({"role": "assistant", "content": msg["content"]})
            else:
                # Old message without tool_call_id — emit as plain assistant message
                messages.append({"role": msg["role"], "content": msg.get("content") or ""})
        else:
            # User messages, plain assistant messages, or messages with null/empty tool_calls
            messages.append({"role": msg["role"], "content": msg.get("content") or ""})
    return messages


@router.post("/{thread_id}/messages")
async def send_message(
    thread_id: str,
    body: MessageCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    thread_resp = (
        supabase.table("threads")
        .select("id")
        .eq("id", thread_id)
        .eq("user_id", current_user["id"])
        .single()
        .execute()
    )
    if not thread_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    # Insert user message
    supabase.table("messages").insert({
        "thread_id": thread_id,
        "user_id": current_user["id"],
        "role": "user",
        "content": body.content,
    }).execute()

    async def event_stream() -> AsyncGenerator[str, None]:
        import logging
        logger = logging.getLogger(__name__)

        # Load user settings for this request
        user_settings = load_user_settings(current_user["id"])

        # Load thread's folder scope
        thread_data = (
            supabase.table("threads")
            .select("folder_id")
            .eq("id", thread_id)
            .single()
            .execute()
        )
        thread_folder_id: str | None = thread_data.data.get("folder_id") if thread_data.data else None

        # Resolve folder subtree if scoped
        folder_subtree_ids: list[str] | None = None
        scoped_folder_path: str | None = None
        if thread_folder_id:
            all_folders = (
                supabase.table("folders")
                .select("id, parent_id, name")
                .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
                .execute()
            ).data or []

            def _get_subtree(root_id: str, folders: list[dict]) -> list[str]:
                result = [root_id]
                for f in folders:
                    if f["parent_id"] == root_id:
                        result.extend(_get_subtree(f["id"], folders))
                return result

            folder_subtree_ids = _get_subtree(thread_folder_id, all_folders)

            # Build scoped folder path for ls/tree/grep default path
            folder_map = {f["id"]: f for f in all_folders}
            path_parts = []
            current_fid: str | None = thread_folder_id
            while current_fid:
                f = folder_map.get(current_fid)
                if not f:
                    break
                path_parts.append(f.get("name", ""))
                current_fid = f.get("parent_id")
            scoped_folder_path = "/" + "/".join(reversed(path_parts))

        # Load full message history (includes just-inserted user message)
        history_resp = (
            supabase.table("messages")
            .select("role, content, tool_calls")
            .eq("thread_id", thread_id)
            .eq("user_id", current_user["id"])
            .order("created_at")
            .execute()
        )

        # Select system prompt, tools, and iteration limit based on agent mode
        if body.agent_mode == "explorer":
            active_system_prompt = EXPLORER_SYSTEM_PROMPT
            active_tools = get_explorer_tools()
            max_iterations = 8
        else:
            active_system_prompt = SYSTEM_PROMPT
            active_tools = None  # None = use default get_tools() in create_streaming_chat
            max_iterations = 5

        # Augment system prompt with folder scope context so LLM generates scoped queries
        if scoped_folder_path:
            folder_scope_note = (
                f"\n\n**IMPORTANT: This chat is scoped to the folder '{scoped_folder_path}'. "
                f"All tool calls should be restricted to this folder and its subfolders. "
                f"When using ls, tree, or grep, default the path to '{scoped_folder_path}'. "
                f"When using query_documents, always include a folder filter (e.g., "
                f"JOIN folders or WHERE folder_id IN ...) to restrict to this folder scope. "
                f"When the user asks 'what documents do you have?' or similar, they mean within this folder scope only.**"
            )
            active_system_prompt = active_system_prompt + folder_scope_note

        # Inject enabled skills catalog (General Mode only) — SKIL-09
        if body.agent_mode != "explorer":
            enabled_skills = (
                supabase.table("skills")
                .select("name, description")
                .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
                .eq("is_enabled", True)
                .order("name")
                .execute()
            ).data or []

            if enabled_skills:
                catalog_lines = "\n".join(
                    f"- **{s['name']}**: {s['description']}" for s in enabled_skills
                )
                catalog_note = (
                    f"\n\n## Available Skills\n"
                    f"The following skills are enabled. Call `load_skill(skill_name)` when the user's "
                    f"request matches a skill description:\n{catalog_lines}"
                )
                active_system_prompt = active_system_prompt + catalog_note

        messages: list[dict] = [{"role": "system", "content": active_system_prompt}]
        messages.extend(_reconstruct_history(history_resp.data))

        full_content = ""
        persisted_tool_calls: list[dict] = []

        try:
            for iteration in range(max_iterations):
                # On the final iteration force a text response to avoid an infinite loop
                force_no_tools = (iteration == max_iterations - 1)
                tool_choice = "none" if force_no_tools else "auto"
                stream = create_streaming_chat(
                    messages,
                    model=body.model,
                    user_settings=user_settings,
                    tool_choice=tool_choice,
                    tools_override=active_tools,
                )

                tool_calls_buffer: dict = {}
                finish_reason: str | None = None

                for chunk in stream:
                    if not chunk.choices:
                        continue
                    choice = chunk.choices[0]
                    delta = choice.delta

                    if choice.finish_reason:
                        finish_reason = choice.finish_reason

                    if delta.content:
                        full_content += delta.content
                        yield f"data: {json.dumps({'type': 'delta', 'content': delta.content})}\n\n"

                    if delta.tool_calls:
                        for tc in delta.tool_calls:
                            idx = tc.index
                            if idx not in tool_calls_buffer:
                                tool_calls_buffer[idx] = {"id": "", "name": "", "arguments": ""}
                            if tc.id:
                                tool_calls_buffer[idx]["id"] = tc.id
                            if tc.function and tc.function.name:
                                tool_calls_buffer[idx]["name"] = tc.function.name
                            if tc.function and tc.function.arguments:
                                tool_calls_buffer[idx]["arguments"] += tc.function.arguments

                if finish_reason == "length":
                    truncation_note = "\n\n*[Response truncated due to length limit]*"
                    full_content += truncation_note
                    yield f"data: {json.dumps({'type': 'delta', 'content': truncation_note})}\n\n"
                    break

                # No tool calls → natural stop, we're done
                if finish_reason != "tool_calls" or not tool_calls_buffer:
                    break

                # --- Tool execution round ---
                tool_calls = list(tool_calls_buffer.values())

                messages.append({
                    "role": "assistant",
                    "tool_calls": [
                        {
                            "id": tc["id"],
                            "type": "function",
                            "function": {"name": tc["name"], "arguments": tc["arguments"]},
                        }
                        for tc in tool_calls
                    ],
                })

                for tc in tool_calls:
                    tool_name = tc["name"]
                    sub_agent_record: dict | None = None
                    try:
                        args = json.loads(tc["arguments"])
                        yield f"data: {json.dumps({'type': 'tool_start', 'name': tool_name, 'args': args})}\n\n"
                        if tool_name == "ls":
                            path = args.get("path") or (scoped_folder_path if scoped_folder_path else "/")
                            result = ls_path(path, current_user["id"], supabase)
                            tool_result = json.dumps(result)
                        elif tool_name == "tree":
                            path = args.get("path") or (scoped_folder_path if scoped_folder_path else "/")
                            result = tree_path(path, args.get("depth"), current_user["id"], supabase)
                            tool_result = json.dumps(result)
                        elif tool_name == "grep":
                            path = args.get("path") or scoped_folder_path
                            result = grep_path(args.get("pattern", ""), path, current_user["id"], supabase)
                            tool_result = json.dumps(result)
                        elif tool_name == "glob":
                            result = glob_path(args.get("pattern", ""), current_user["id"], supabase)
                            # Scope glob results to folder subtree if thread is folder-scoped
                            if folder_subtree_ids is not None and "matches" in result:
                                result["matches"] = [
                                    m for m in result["matches"]
                                    if m.get("folder_id") in folder_subtree_ids
                                ]
                                result["total"] = len(result["matches"])
                            tool_result = json.dumps(result)
                        elif tool_name == "read_document":
                            result = read_path(
                                args["document_id"],
                                current_user["id"],
                                supabase,
                                args.get("start_line"),
                                args.get("end_line"),
                            )
                            tool_result = json.dumps(result)
                        elif tool_name == "search_documents":
                            metadata_filter = args.get("metadata_filter") or None
                            results = search_documents(
                                args["query"], current_user["id"], supabase,
                                metadata_filter=metadata_filter,
                                user_settings=user_settings,
                                folder_ids=folder_subtree_ids,
                            )
                            tool_result = json.dumps(results) if results else "No relevant documents found."
                        elif tool_name == "query_documents":
                            tool_result = query_documents(args["query"], current_user["id"], supabase, folder_ids=folder_subtree_ids)
                        elif tool_name == "web_search":
                            tool_result = web_search(args["query"], settings.tavily_api_key, settings.web_search_max_results)
                        elif tool_name == "analyze_document":
                            doc_id = resolve_document_id(args["filename"], current_user["id"], supabase)
                            if not doc_id:
                                tool_result = f"Document '{args['filename']}' not found."
                            else:
                                doc = fetch_full_document(doc_id, current_user["id"], supabase)
                                if not doc:
                                    tool_result = f"Could not retrieve content for '{args['filename']}'."
                                else:
                                    yield f"data: {json.dumps({'type': 'sub_agent_start', 'filename': doc['filename'], 'task': args['task']})}\n\n"
                                    sub_agent_content = ""
                                    try:
                                        for text_chunk in run_sub_agent(doc["content"], doc["filename"], args["task"], model=body.model, user_settings=user_settings):
                                            sub_agent_content += text_chunk
                                            yield f"data: {json.dumps({'type': 'sub_agent_delta', 'content': text_chunk})}\n\n"
                                    except Exception as sa_err:
                                        logger.error("Sub-agent failed: %s", sa_err)
                                        if not sub_agent_content:
                                            sub_agent_content = f"Sub-agent analysis failed: {sa_err}"
                                    yield f"data: {json.dumps({'type': 'sub_agent_done'})}\n\n"
                                    tool_result = sub_agent_content
                                    sub_agent_record = {"filename": doc["filename"], "task": args["task"], "content": sub_agent_content}
                        elif tool_name == "load_skill":
                            skill_name = args.get("skill_name", "")
                            # Emit skill_activated SSE event immediately (SKIL-12)
                            yield f"data: {json.dumps({'type': 'skill_activated', 'skill_name': skill_name})}\n\n"
                            # Resolve skill — prefer user-owned over global when names conflict
                            skill_row = (
                                supabase.table("skills")
                                .select("id, name, description, instructions, user_id")
                                .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
                                .eq("name", skill_name)
                                .eq("is_enabled", True)
                                .order("is_global")
                                .execute()
                            ).data
                            if not skill_row:
                                tool_result = json.dumps({"error": f"Skill '{skill_name}' not found or not enabled."})
                            else:
                                row = skill_row[0] if isinstance(skill_row, list) else skill_row
                                # Fetch attached filenames (FILE-04)
                                files_data = (
                                    supabase.table("skill_files")
                                    .select("filename")
                                    .eq("skill_id", row["id"])
                                    .order("filename")
                                    .execute()
                                ).data or []
                                file_names = [f["filename"] for f in files_data]
                                tool_result = json.dumps({
                                    "name": row["name"],
                                    "instructions": row["instructions"],
                                    "files": file_names,
                                })
                        elif tool_name == "save_skill":
                            name = args.get("name", "").strip()
                            description = args.get("description", "")
                            instructions = args.get("instructions", "")
                            if not name:
                                tool_result = json.dumps({"error": "Skill name is required."})
                            else:
                                # Check if user already owns a skill with this name
                                existing_resp = (
                                    supabase.table("skills")
                                    .select("id")
                                    .eq("user_id", current_user["id"])
                                    .eq("name", name)
                                    .limit(1)
                                    .execute()
                                )
                                existing = existing_resp.data[0] if existing_resp.data else None
                                if existing:
                                    row = existing
                                    supabase.table("skills").update({
                                        "description": description,
                                        "instructions": instructions,
                                    }).eq("id", row["id"]).eq("user_id", current_user["id"]).execute()
                                    tool_result = json.dumps({"status": "updated", "name": name})
                                else:
                                    supabase.table("skills").insert({
                                        "user_id": current_user["id"],
                                        "name": name,
                                        "description": description,
                                        "instructions": instructions,
                                    }).execute()
                                    tool_result = json.dumps({"status": "created", "name": name})
                        elif tool_name == "read_skill_file":
                            skill_name = args.get("skill_name", "")
                            filename = args.get("filename", "")
                            # Resolve skill to get owner's user_id for storage path
                            skill_row = (
                                supabase.table("skills")
                                .select("id, user_id")
                                .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
                                .eq("name", skill_name)
                                .maybe_single()
                                .execute()
                            ).data
                            if not skill_row:
                                tool_result = json.dumps({"error": f"Skill '{skill_name}' not found."})
                            else:
                                row = skill_row[0] if isinstance(skill_row, list) else skill_row
                                storage_path = f"{row['user_id']}/{row['id']}/{filename}"
                                try:
                                    raw_bytes = supabase.storage.from_("skill-files").download(storage_path)
                                    tool_result = raw_bytes.decode("utf-8", errors="replace")
                                except Exception as e:
                                    tool_result = json.dumps({"error": f"File '{filename}' not found: {e}"})
                        elif tool_name == "execute_code":
                            code = args.get("code", "")
                            libraries = args.get("libraries") or []
                            # Emit start event (SAND-04)
                            yield f"data: {json.dumps({'type': 'code_execution_start', 'code_preview': code[:200]})}\n\n"

                            try:
                                session = sandbox_manager.get_or_create(thread_id)
                                loop = asyncio.get_event_loop()
                                queue: asyncio.Queue = asyncio.Queue()

                                def on_stdout(chunk: str):
                                    loop.call_soon_threadsafe(
                                        queue.put_nowait,
                                        {"type": "code_stdout", "content": chunk}
                                    )

                                def on_stderr(chunk: str):
                                    loop.call_soon_threadsafe(
                                        queue.put_nowait,
                                        {"type": "code_stderr", "content": chunk}
                                    )

                                # Prepend output dir creation and chdir so relative file writes
                                # land in /sandbox/output/ and get harvested (Pitfall 5)
                                wrapped_code = "import os; os.makedirs('/sandbox/output', exist_ok=True); os.chdir('/sandbox/output')\n" + code

                                start_time = time_mod.time()

                                def _run_sync():
                                    exec_result = session.run(
                                        wrapped_code,
                                        libraries=libraries,
                                        on_stdout=on_stdout,
                                        on_stderr=on_stderr,
                                    )
                                    loop.call_soon_threadsafe(
                                        queue.put_nowait,
                                        {"type": "_done", "result": exec_result}
                                    )
                                    return exec_result

                                fut = loop.run_in_executor(None, _run_sync)

                                # Drain queue, streaming SSE events (SAND-05)
                                while True:
                                    item = await queue.get()
                                    if item["type"] == "_done":
                                        break
                                    yield f"data: {json.dumps(item)}\n\n"

                                exec_result = await fut
                                end_time = time_mod.time()
                                duration_ms = int((end_time - start_time) * 1000)

                                # Emit stdout/stderr lines from result (on_stdout callbacks
                                # are no-ops in InteractiveSandboxSession — output only
                                # available after execution completes)
                                if exec_result.stdout:
                                    for line in exec_result.stdout.splitlines():
                                        yield f"data: {json.dumps({'type': 'code_stdout', 'content': line})}\n\n"
                                if exec_result.stderr:
                                    for line in exec_result.stderr.splitlines():
                                        yield f"data: {json.dumps({'type': 'code_stderr', 'content': line})}\n\n"

                                # Log execution to DB (SAND-09)
                                exec_row = supabase.table("code_executions").insert({
                                    "thread_id": thread_id,
                                    "user_id": current_user["id"],
                                    "code": code,
                                    "exit_code": 0,
                                    "duration_ms": duration_ms,
                                }).execute()
                                execution_id = exec_row.data[0]["id"] if exec_row.data else None

                                # Harvest output files from container (SAND-07, SAND-08)
                                output_file_list = []
                                if execution_id:
                                    output_file_list = harvest_output_files(
                                        session, execution_id, current_user["id"], supabase
                                    )

                                # Emit completion event (SAND-06) with file list
                                yield f"data: {json.dumps({'type': 'code_execution_complete', 'exit_code': 0, 'duration_ms': duration_ms, 'execution_id': execution_id, 'output_files': output_file_list})}\n\n"

                                tool_result = json.dumps({
                                    "status": "completed",
                                    "exit_code": 0,
                                    "duration_ms": duration_ms,
                                    "execution_id": execution_id,
                                    "output_files": output_file_list,
                                })
                            except Exception as exec_err:
                                logger.error("execute_code failed: %s", exec_err)
                                yield f"data: {json.dumps({'type': 'code_execution_complete', 'exit_code': 1, 'error': str(exec_err), 'duration_ms': 0, 'output_files': []})}\n\n"
                                tool_result = json.dumps({"status": "error", "error": str(exec_err)})
                        else:
                            tool_result = f"Unknown tool: {tool_name}"
                    except json.JSONDecodeError:
                        tool_result = "Error parsing tool arguments"
                        args = {}
                    except (ValueError, RuntimeError) as e:
                        logger.error("Tool %s failed: %s", tool_name, e)
                        tool_result = f"Tool error: {e}"
                    except Exception as e:
                        logger.error("Tool %s unexpected error: %s", tool_name, e)
                        tool_result = f"Tool execution failed: {e}"

                    yield f"data: {json.dumps({'type': 'tool_end', 'name': tool_name, 'result': tool_result[:2000]})}\n\n"
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": tool_result,
                    })
                    persisted_tool_calls.append({
                        "tool_call_id": tc["id"],
                        "name": tool_name,
                        "args": args,
                        "result": tool_result[:2000],  # trim large results
                        "status": "done",
                        **({"sub_agent": sub_agent_record} if sub_agent_record else {}),
                    })
                # Continue to next iteration to let LLM respond with tool results in context

        except APIError as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            yield "data: [DONE]\n\n"
            return

        # Persist assistant message
        if full_content:
            row: dict = {
                "thread_id": thread_id,
                "user_id": current_user["id"],
                "role": "assistant",
                "content": full_content,
            }
            if persisted_tool_calls:
                row["tool_calls"] = persisted_tool_calls
            supabase.table("messages").insert(row).execute()

        # Touch thread so it rises in updated_at ordering
        supabase.table("threads").update({"updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", thread_id).execute()

        # Auto-title: generate on first exchange (history had exactly 1 message = first user msg)
        if len(history_resp.data) == 1 and history_resp.data[0]["role"] == "user":
            first_user_msg = history_resp.data[0]["content"]
            title = generate_thread_title(first_user_msg, user_settings=user_settings)
            supabase.table("threads").update({"title": title}).eq("id", thread_id).execute()
            yield f"data: {json.dumps({'type': 'title', 'content': title})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
