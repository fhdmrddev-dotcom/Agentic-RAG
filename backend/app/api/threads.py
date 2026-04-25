import asyncio
import base64
import io
import json
import os
import time as time_mod
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from app.responses import sse_response
from openai import APIError
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.message import MessageCreate, MessageResponse
from app.models.thread import ThreadCreate, ThreadResponse, ThreadUpdate
from app.services.audit_service import write_audit_entry
from app.utils.folder_utils import fetch_visible_folders
from app.models.user_settings import load_user_settings, override_provider
from app.config import settings
from app.services.openai_service import create_streaming_chat, get_llm_client, get_explorer_tools, EXPLORER_SYSTEM_PROMPT, _uses_max_completion_tokens

# Lazy sandbox import — only if enabled
if settings.sandbox_enabled:
    from app.services.sandbox_service import sandbox_manager, harvest_output_files
from app.services.context_window import trim_messages_to_fit, estimate_messages_tokens, resolve_context_budget
from app.services.retrieval_service import search_documents, resolve_document_id, fetch_full_document
from app.services.web_search_service import web_search
from app.services.sql_service import query_documents
from app.services.sub_agent_service import run_sub_agent, _SUB_AGENT_MODEL_DEFAULTS
from app.api.kb import ls_path, tree_path, grep_path, glob_path, read_path

router = APIRouter(prefix="/threads", tags=["threads"])


def _is_transient_provider_error(e: APIError) -> bool:
    """Return True if this is a transient provider failure safe to retry.

    Checks status code, structured body (OpenRouter puts real code in e.body),
    and message text. Never retries auth, billing, or parameter errors.
    """
    if e.status_code in (502, 503, 529):
        return True
    try:
        code = e.body.get("error", {}).get("code")
        if code in (502, 503, 529):
            return True
    except (AttributeError, TypeError):
        pass
    msg_lower = str(getattr(e, "message", "") or e).lower()
    return any(kw in msg_lower for kw in (
        "provider returned error", "upstream", "bad gateway", "service unavailable",
    ))


SYSTEM_PROMPT = (
    "You are a helpful AI assistant with access to the user's document library.\n\n"

    "## CRITICAL: Stop when you have the answer\n"
    "After EVERY tool call, check: do I now have enough to answer? If yes — STOP and respond.\n"
    "Do NOT call more tools to 'verify' or 'confirm' an answer you already have.\n"
    "Most questions need 1 tool call. Complex questions need 2-3. Never more than necessary.\n\n"

    "## Tool selection guide\n"
    "Pick the ONE tool that best fits the task:\n"
    "- **search_documents** → reading passage content: finding facts, quotes, figures, or explanations *inside* documents. "
    "The returned chunks are pre-extracted relevant passages — read them carefully. If they contain the answer, stop there. "
    "Use `metadata_filter` to scope by author, date, or document type when the user specifies a source.\n"
    "- **query_documents** → metadata/structural questions: counts, lists, date-range filters, folder membership, file sizes "
    "(e.g. 'how many PDFs from 2023?', 'list all documents by John', 'which files are in the Reports folder'). "
    "These are SQL-style questions about document attributes, not about what documents say.\n"
    "- **analyze_document** → full-document tasks: summarize, compare, or extract all key points from an entire document. "
    "If the target document is ambiguous (user says 'the report' without specifying which), call search_documents or "
    "query_documents first to identify it, then call analyze_document.\n"
    "- **ls / tree** → browse folder structure and navigate the knowledge base\n"
    "- **grep** → find documents containing a specific phrase or regex pattern\n"
    "- **glob** → find documents by filename pattern (*.pdf, report-*, etc.)\n"
    "- **read_document** → read a specific section when search chunks are cut off or incomplete; use start_line/end_line; "
    "do NOT call more than once per document per question\n"
    "- **web_search** → current events, software versions, or topics not covered in uploaded documents\n"
    "- **execute_code** → calculations, data analysis, chart generation, file creation "
    "(always pass `libraries` for non-stdlib packages; pass `skill_files` to inject skill attachment files into the sandbox at /sandbox/{filename})\n"
    "- **load_skill** → activate a skill; call silently and then follow the skill's instructions exactly\n"
    "- **save_skill / read_skill_file** → skill management\n"
    "- **query_tables** → structured table data from documents: 'show me the revenue table from Q3 Report', "
    "'find rows where Region is APAC', 'what are the column headers in the summary table?'. "
    "Use when the question is about specific values inside a document's tabular data.\n\n"

    "**Tiebreaker — search_documents vs query_documents:** If the question is about *what a document says* (content), "
    "use search_documents. If it's about *which documents exist or their attributes* (counts, dates, folders, authors), "
    "use query_documents.\n\n"

    "**Multi-document comparison:** Call analyze_document once per document, then synthesize across them in your response. "
    "Do not call search_documents separately for each.\n\n"

    "## Rules\n"
    "- Always cite which document your answer comes from.\n"
    "- Never call the same tool twice with the same arguments.\n"
    "- If search_documents returns relevant chunks, answer from those — do NOT also call read_document on the same document.\n"
    "- **Zero results from search_documents:** If the tool returns no chunks at all, try grep (if the user referenced a "
    "specific phrase) or query_documents (to check whether the document exists). If still nothing, tell the user directly "
    "— do not fabricate.\n"
    "- **read_document out of bounds:** If a line range returns nothing or is out of bounds, fall back to analyze_document "
    "on that document rather than answering from nothing — unless analyze_document was already called this turn.\n"
    "- **Web vs documents conflict:** If web_search results conflict with content in your documents, prioritize the "
    "document content and flag the discrepancy explicitly to the user.\n\n"

    "## Confidence & hedging\n"
    "search_documents results include a `similarity` score (0–1). If ALL returned chunks have "
    "similarity below 0.4, the answer is likely not in the documents — say so explicitly: "
    "\"I couldn't find reliable information about this in your documents. The closest match was "
    "[document name] but the similarity was low.\" Do not fabricate an answer from weak matches.\n\n"

    "## Citation format\n"
    "When citing document content, use this format:\n"
    "**[Document Name]** — [section or chapter if identifiable, otherwise omit]\n"
    "Example: **Fahed Mrad Chapters 1-4.docx** — Chapter 3.4\n"
    "Never cite a document you did not retrieve in this response.\n\n"

    "## execute_code output\n"
    "- Inline output (stdout/stderr) is shown in the terminal panel — summarize key findings in your text response; "
    "do not repeat raw output verbatim.\n"
    "- Output files (.pptx, .docx, .pdf, .png, etc.) are automatically shown as download cards in the UI — "
    "do NOT write markdown links or URLs for them. Mention the filename naturally: "
    "'I've created `report.pptx` with 8 slides covering...' — never '[filename](url)' or 'Download: link'.\n"
)


CONFIDENCE_DISCLAIMER = (
    "This answer is based on limited or weakly-matched evidence. "
    "Please verify with the source documents."
)


def _compute_confidence(avg_similarity: float) -> str:
    """Map average cosine similarity to confidence level (D-10).

    Thresholds are calibrated for text-embedding-3-small, where typical
    top-5 average scores are 0.50–0.70 for prose and 0.35–0.55 for
    structured/tabular content. The previous 0.7/0.5 thresholds caused
    almost all correct answers to show as "low" confidence.
    """
    if avg_similarity >= 0.55:
        return "high"
    elif avg_similarity >= 0.40:
        return "medium"
    return "low"


def _deduplicate_citations(citations: list[dict]) -> list[dict]:
    """Deduplicate citations by (document_id, chunk_index), preserving order (D-14)."""
    seen: set[tuple] = set()
    unique: list[dict] = []
    for c in citations:
        key = (c["document_id"], c.get("chunk_index"))
        if key not in seen:
            seen.add(key)
            unique.append(c)
    return unique


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
    background_tasks: BackgroundTasks,
    body: ThreadCreate = ThreadCreate(),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    insert_data: dict = {"user_id": current_user["id"], "title": body.title}
    if body.folder_id:
        insert_data["folder_id"] = str(body.folder_id)
    response = supabase.table("threads").insert(insert_data).execute()
    new_thread = response.data[0]
    background_tasks.add_task(
        write_audit_entry,
        user_id=current_user["id"],
        action_type="thread.create",
        metadata={"thread_id": new_thread["id"]},
        supabase=supabase,
    )
    return new_thread


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
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Close sandbox session if sandbox is enabled (SAND-10)
    if settings.sandbox_enabled:
        from app.services.sandbox_service import sandbox_manager
        sandbox_manager.close_session(thread_id)

    # Clean up sandbox output files from storage before cascade deletes DB rows
    try:
        exec_rows = (
            supabase.table("code_executions")
            .select("id")
            .eq("thread_id", thread_id)
            .eq("user_id", current_user["id"])
            .execute()
        ).data or []
        if exec_rows:
            exec_ids = [r["id"] for r in exec_rows]
            file_rows = (
                supabase.table("sandbox_files")
                .select("storage_path")
                .in_("execution_id", exec_ids)
                .execute()
            ).data or []
            if file_rows:
                paths = [f["storage_path"] for f in file_rows]
                supabase.storage.from_("sandbox-outputs").remove(paths)
    except Exception:
        pass  # Best-effort cleanup — don't block thread deletion

    supabase.table("threads").delete().eq("id", thread_id).eq("user_id", current_user["id"]).execute()
    background_tasks.add_task(
        write_audit_entry,
        user_id=current_user["id"],
        action_type="thread.delete",
        metadata={"thread_id": thread_id},
        supabase=supabase,
    )


def generate_thread_title(first_user_message: str, user_settings=None) -> str:
    """Call LLM to produce a short thread title from the first user message."""
    try:
        client = get_llm_client(user_settings)
        # Use cheapest model per provider — same resolution as sub_agent_service/suggestion_service.
        # Avoids burning the main (expensive) model on a 20-token title call.
        override = (
            (user_settings.sub_agent_model if user_settings else "")
            or settings.sub_agent_model
        )
        if override:
            model = override
        else:
            provider = user_settings.active_provider if user_settings else ""
            model = (
                _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
                or (user_settings.llm_model if user_settings else settings.llm_model)
            )
        token_param = "max_completion_tokens" if _uses_max_completion_tokens(model) else "max_tokens"
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "Generate a concise chat title (4-6 words max) for the following message. Respond with only the title, no punctuation, no quotes.",
                },
                {"role": "user", "content": first_user_message[:500]},
            ],
            stream=False,
            **{token_param: 20},
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

        # Load user settings for this request (apply per-request provider override if sent)
        user_settings = load_user_settings(current_user["id"])
        if body.provider and body.provider != user_settings.active_provider:
            user_settings = override_provider(user_settings, body.provider)

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
            all_folders = fetch_visible_folders(supabase, current_user["id"])

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
            # Only set a meaningful path — if traversal found nothing, leave as None
            # so the scope note is not injected with a confusing "/" root path.
            scoped_folder_path = ("/" + "/".join(reversed(path_parts))) if path_parts else None

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
            max_iterations = 6
        else:
            active_system_prompt = SYSTEM_PROMPT
            active_tools = None  # None = use default get_tools() in create_streaming_chat
            max_iterations = 8

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
                    f"The following skills are enabled. When the user's request matches a skill description, "
                    f"call `load_skill(skill_name)` silently (no announcement) then follow the skill's "
                    f"instructions exactly:\n{catalog_lines}"
                )
                active_system_prompt = active_system_prompt + catalog_note

            # Inject cross-thread user memory (General Mode only) — MEM-03, D-05, D-06, D-07
            memory_rows = (
                supabase.table("user_memory")
                .select("key, value")
                .eq("user_id", current_user["id"])
                .order("updated_at", desc=True)
                .limit(10)
                .execute()
            ).data or []

            if memory_rows:
                memory_lines = "\n".join(
                    f"- {r['key']}: {r['value']}" for r in memory_rows
                )
                memory_note = (
                    "\n\n## User Memory\n"
                    "(Preferences and facts you've remembered about this user across conversations)\n"
                    f"{memory_lines}"
                )
                active_system_prompt = active_system_prompt + memory_note

            # Inform the agent about tools disabled via user settings so it
            # doesn't attempt to call them or ask clarifying questions about them.
            disabled_tools: list[str] = []
            if not user_settings.web_search_enabled:
                disabled_tools.append("web_search (disabled in Settings › Integrations › Web Search)")
            if not user_settings.sandbox_enabled:
                disabled_tools.append("execute_code (disabled in Settings › Integrations › Code Execution)")
            if disabled_tools:
                disabled_note = (
                    "\n\n## Disabled Tools\n"
                    "The following tools are currently disabled by the user and are NOT available. "
                    "Do not attempt to call them. If a task requires one of these tools, "
                    "clearly tell the user it is disabled and how to enable it:\n"
                    + "\n".join(f"- {t}" for t in disabled_tools)
                )
                active_system_prompt = active_system_prompt + disabled_note

        messages: list[dict] = [{"role": "system", "content": active_system_prompt}]
        messages.extend(_reconstruct_history(history_resp.data))

        # Trim conversation history to fit context window before the first LLM call
        messages = trim_messages_to_fit(
            messages,
            max_tokens=resolve_context_budget(user_settings.active_provider, user_settings.llm_model),
            reserve_recent=settings.context_window_reserve_recent,
        )
        logger.debug(
            "Pre-loop trim: ~%d tokens in %d messages",
            estimate_messages_tokens(messages),
            len(messages),
        )

        full_content = ""
        persisted_tool_calls: list[dict] = []
        source_refs: list[dict] = []  # {"document_id": str, "filename": str}
        unique_sources: list[dict] = []
        retrieved_citations: list[dict] = []    # Full citation objects per D-04
        similarity_scores: list[float] = []     # Per-call avg cosine values for confidence
        unique_citations: list[dict] = []       # Deduplicated citations (closure-accessible)
        _confidence_slot: list[dict] = []       # Confidence result (closure-accessible for persist)
        _message_persisted = False  # guard against double-insert
        _empty_retries = 0  # tracks empty-response retries across all iterations

        def _persist_assistant_message() -> None:
            """Insert the assistant message row. Idempotent — only runs once."""
            nonlocal _message_persisted
            if _message_persisted:
                return
            _message_persisted = True
            if not full_content and not persisted_tool_calls:
                logger.warning(
                    "Agent loop produced no content for thread %s — persisting empty assistant message",
                    thread_id,
                )
            row: dict = {
                "thread_id": thread_id,
                "user_id": current_user["id"],
                "role": "assistant",
                "content": _strip_nul(full_content),
            }
            if persisted_tool_calls:
                completed_tools = [tc for tc in persisted_tool_calls if tc.get("status") == "done"]
                if completed_tools:
                    row["tool_calls"] = _strip_nul(completed_tools)
            if unique_citations:
                row["source_refs"] = unique_citations   # Full citation objects (D-13)
            elif unique_sources:
                row["source_refs"] = unique_sources     # Backward compat for non-RAG turns
            if _confidence_slot:
                c = _confidence_slot[0]
                row["confidence_level"] = c["level"]
                row["confidence_avg_similarity"] = c["avg_similarity"]
                row["confidence_disclaimer"] = c["disclaimer"]
            try:
                supabase.table("messages").insert(row).execute()
            except Exception as e:
                logger.error("Failed to persist assistant message: %s", e)

        def _strip_nul(obj):
            """Recursively strip PostgreSQL-illegal null bytes (\\x00) from strings."""
            if isinstance(obj, str):
                return obj.replace('\x00', '')
            if isinstance(obj, dict):
                return {k: _strip_nul(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [_strip_nul(item) for item in obj]
            return obj

        # Option B context budget: cap tool result size in the messages array.
        # The LLM consumed the full result in the iteration it ran — subsequent
        # iterations only need a condensed version. This keeps the context window
        # from growing unbounded across many tool calls.
        # analyze_document results are longer by nature; everything else caps lower.
        _CTX_LIMIT_DEFAULT = 3000    # chars in messages[] for most tools
        _CTX_LIMIT_SUBAGENT = 10000  # chars for analyze_document (rich synthesis)

        try:  # outer try/finally — guarantees persist even on GeneratorExit (client disconnect)
          try:
            for iteration in range(max_iterations):
                # Between tool-call rounds: signal to the frontend that the agent
                # is deciding its next action (all prior tools are done).
                if iteration > 0:
                    yield f"data: {json.dumps({'type': 'planning', 'iteration': iteration})}\n\n"

                # Re-trim after tool results have been appended (context grows each iteration)
                messages = trim_messages_to_fit(
                    messages,
                    max_tokens=resolve_context_budget(user_settings.active_provider, user_settings.llm_model),
                    reserve_recent=settings.context_window_reserve_recent,
                )
                logger.debug(
                    "Agent iteration %d: ~%d tokens in %d messages",
                    iteration,
                    estimate_messages_tokens(messages),
                    len(messages),
                )

                # On the final iteration force a text response to avoid an infinite loop
                force_no_tools = (iteration == max_iterations - 1)
                tool_choice = "none" if force_no_tools else "auto"
                _provider_retries = 0
                _MAX_PROVIDER_RETRIES = 2
                _retry_delays = [0.5, 1.5]

                while True:
                    try:
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

                        break  # stream completed successfully

                    except APIError as provider_err:
                        if _is_transient_provider_error(provider_err) and _provider_retries < _MAX_PROVIDER_RETRIES:
                            _provider_retries += 1
                            delay = _retry_delays[_provider_retries - 1]
                            logger.warning(
                                "Transient provider error on iteration %d (thread %s), "
                                "attempt %d/%d — retrying in %.1fs. status=%s",
                                iteration, thread_id,
                                _provider_retries, _MAX_PROVIDER_RETRIES + 1,
                                delay, provider_err.status_code,
                            )
                            await asyncio.sleep(delay)
                            continue
                        raise  # non-retryable or retries exhausted → caught by outer except APIError

                logger.debug(
                    "Iteration %d finish_reason=%r tool_calls_buffered=%d",
                    iteration, finish_reason, len(tool_calls_buffer),
                )

                if finish_reason == "length" and tool_calls_buffer:
                    # length limit hit while streaming tool arguments — discard partial call
                    err_msg = "*Response cut off mid-tool-call (output length limit). Please try a shorter request.*"
                    full_content += err_msg
                    yield f"data: {json.dumps({'type': 'delta', 'content': err_msg})}\n\n"
                    yield f"data: {json.dumps({'type': 'error', 'message': 'finish_reason=length during tool streaming'})}\n\n"
                    break

                if finish_reason == "length":
                    truncation_note = "\n\n*[Response truncated — output token limit reached. Try a shorter request or increase LLM_MAX_OUTPUT_TOKENS.]*"
                    full_content += truncation_note
                    yield f"data: {json.dumps({'type': 'delta', 'content': truncation_note})}\n\n"
                    break

                # No tool calls → natural stop (stop / end_turn / None), we're done
                if finish_reason != "tool_calls" or not tool_calls_buffer:
                    if finish_reason not in ("tool_calls", "stop", "end_turn", None):
                        logger.warning(
                            "Unexpected finish_reason %r on iteration %d — treating as stop",
                            finish_reason, iteration,
                        )
                    # Guard: if LLM returned stop with no content and no tools at any
                    # iteration, retry once — handles transient hiccups and reasoning
                    # models (e.g. Kimi K2.5) that exhaust output budget on thinking
                    # tokens and return empty content after a tool call.
                    if not full_content and not tool_calls_buffer and _empty_retries < 1:
                        _empty_retries += 1
                        logger.warning(
                            "LLM returned empty response on iteration %d (thread %s) — retrying once",
                            iteration, thread_id,
                        )
                        continue
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
                    llm_tool_content: str | None = None  # overridden per-tool to strip URLs from LLM context
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
                            results, avg_sim = search_documents(
                                args["query"], current_user["id"], supabase,
                                metadata_filter=metadata_filter,
                                user_settings=user_settings,
                                folder_ids=folder_subtree_ids,
                            )
                            tool_result = json.dumps(results) if results else "No relevant documents found."
                            # Accumulate full citation objects for citations event (D-04, D-14)
                            if results and isinstance(results, list):
                                for hit in results:
                                    doc_id = hit.get("document_id") or hit.get("id")
                                    filename = hit.get("filename") or hit.get("document_name")
                                    if doc_id and filename:
                                        source_refs.append({"document_id": doc_id, "filename": filename})
                                        retrieved_citations.append({
                                            "document_id": doc_id,
                                            "filename": filename,
                                            "chunk_index": hit.get("chunk_index"),
                                            "passage": hit.get("content"),  # Full text for persistence
                                            "similarity": hit.get("similarity"),
                                            "is_full_doc": False,
                                            "version_number": hit.get("version_number", 1),
                                        })
                                if avg_sim > 0.0:
                                    similarity_scores.append(avg_sim)
                            # Audit: fire-and-forget inside async generator (AUDIT-02)
                            _audit_doc_ids = list({
                                h.get("document_id") or h.get("id")
                                for h in (results or [])
                                if h.get("document_id") or h.get("id")
                            })
                            asyncio.create_task(write_audit_entry(
                                user_id=current_user["id"],
                                action_type="search.query",
                                metadata={"query_text": args["query"], "document_ids": _audit_doc_ids},
                                supabase=supabase,
                            ))
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
                                    # Track this document as a source reference
                                    source_refs.append({"document_id": doc_id, "filename": doc["filename"]})
                                    retrieved_citations.append({
                                        "document_id": doc_id,
                                        "filename": doc["filename"],
                                        "chunk_index": None,
                                        "passage": None,
                                        "similarity": None,
                                        "is_full_doc": True,
                                        "version_number": doc.get("version_number", 1),
                                    })
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
                                asyncio.create_task(write_audit_entry(
                                    user_id=current_user["id"],
                                    action_type="skill.load",
                                    metadata={"skill_id": row["id"], "skill_name": row["name"]},
                                    supabase=supabase,
                                ))
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
                                    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

                                    if ext == "docx":
                                        import docx as _docx  # python-docx
                                        doc = _docx.Document(io.BytesIO(raw_bytes))
                                        tool_result = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
                                    elif ext == "xlsx":
                                        import openpyxl as _openpyxl
                                        wb = _openpyxl.load_workbook(io.BytesIO(raw_bytes), read_only=True, data_only=True)
                                        rows = []
                                        for sheet in wb.worksheets:
                                            for row in sheet.iter_rows(values_only=True):
                                                line = "\t".join(str(c) if c is not None else "" for c in row)
                                                if line.strip():
                                                    rows.append(line)
                                        tool_result = "\n".join(rows)
                                    elif ext == "pptx":
                                        from pptx import Presentation as _Presentation  # python-pptx
                                        prs = _Presentation(io.BytesIO(raw_bytes))
                                        slides = []
                                        for slide in prs.slides:
                                            for shape in slide.shapes:
                                                if hasattr(shape, "text") and shape.text.strip():
                                                    slides.append(shape.text)
                                        tool_result = "\n".join(slides)
                                    elif ext in {"txt", "md", "py", "csv", "json", "yaml", "yml", "toml", "html", "xml", "rst", "log"}:
                                        tool_result = raw_bytes.decode("utf-8", errors="replace").replace('\x00', '')
                                    else:
                                        # Unrecognized or binary type
                                        tool_result = json.dumps({
                                            "error": f"File '{filename}' is a binary file that cannot be read as text. "
                                                     "Upload a text-based version instead."
                                        })
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

                                # Ensure /sandbox/output exists via shell (reliable across container
                                # environments) and chdir so relative writes land there
                                try:
                                    session.execute_command("mkdir -p /sandbox/output")
                                except Exception:
                                    pass

                                # Inject skill files into sandbox by embedding bytes as base64
                                # in a preamble that runs before user code. More reliable than
                                # copy_to_runtime which can fail silently on Windows Docker setups.
                                skill_files_req = args.get("skill_files") or []
                                file_preamble = ""
                                for sf in skill_files_req:
                                    sf_skill_name = sf.get("skill_name", "")
                                    sf_filename = sf.get("filename", "")
                                    if not sf_skill_name or not sf_filename:
                                        continue
                                    sf_skill = (
                                        supabase.table("skills")
                                        .select("id, user_id")
                                        .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
                                        .eq("name", sf_skill_name)
                                        .maybe_single()
                                        .execute()
                                    ).data
                                    if not sf_skill:
                                        logger.warning("Skill file injection: skill '%s' not found", sf_skill_name)
                                        continue
                                    sf_row = sf_skill[0] if isinstance(sf_skill, list) else sf_skill
                                    sf_storage_path = f"{sf_row['user_id']}/{sf_row['id']}/{sf_filename}"
                                    try:
                                        sf_bytes = supabase.storage.from_("skill-files").download(sf_storage_path)
                                        b64 = base64.b64encode(sf_bytes).decode("ascii")
                                        safe_name = sf_filename.replace("'", "\\'")
                                        file_preamble += (
                                            f"import base64 as _b64, os as _os\n"
                                            f"_os.makedirs('/sandbox', exist_ok=True)\n"
                                            f"with open('/sandbox/{safe_name}', 'wb') as _f:\n"
                                            f"    _f.write(_b64.b64decode('{b64}'))\n"
                                            f"print('Injected skill file: {safe_name}')\n"
                                        )
                                    except Exception as sf_err:
                                        logger.warning("Failed to inject skill file %s/%s: %s", sf_skill_name, sf_filename, sf_err)

                                wrapped_code = "import os; os.chdir('/sandbox/output')\n" + file_preamble + code

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

                                # Drain queue, streaming SSE events (SAND-05).
                                # Emit keepalives every 10 s when sandbox produces no output
                                # to prevent SSE connection timeouts on long executions.
                                while True:
                                    try:
                                        item = await asyncio.wait_for(queue.get(), timeout=10.0)
                                    except asyncio.TimeoutError:
                                        yield f"data: {json.dumps({'type': 'keepalive'})}\n\n"
                                        continue
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

                                # Derive actual exit code — InteractiveSandboxSession may
                                # return 0 even when Python raises an exception.
                                # Check exec_result.exit_code first; if it's 0/None,
                                # scan stdout for Python error signatures.
                                actual_exit_code = getattr(exec_result, "exit_code", None) or 0
                                if actual_exit_code == 0:
                                    stdout_text = exec_result.stdout or ""
                                    _error_markers = (
                                        "Traceback (most recent call last)",
                                        "Error:",
                                        "Exception:",
                                        "ModuleNotFoundError",
                                        "ImportError",
                                        "SyntaxError",
                                        "NameError",
                                        "TypeError",
                                        "ValueError",
                                        "RuntimeError",
                                        "AttributeError",
                                        "KeyError",
                                        "IndexError",
                                    )
                                    if any(m in stdout_text for m in _error_markers):
                                        actual_exit_code = 1

                                # Log execution to DB (SAND-09)
                                exec_row = supabase.table("code_executions").insert({
                                    "thread_id": thread_id,
                                    "user_id": current_user["id"],
                                    "code": code,
                                    "exit_code": actual_exit_code,
                                    "duration_ms": duration_ms,
                                }).execute()
                                execution_id = exec_row.data[0]["id"] if exec_row.data else None

                                # Harvest output files from container (SAND-07, SAND-08)
                                output_file_list = []
                                if execution_id and actual_exit_code == 0:
                                    output_file_list = harvest_output_files(
                                        session, execution_id, current_user["id"], supabase
                                    )

                                # Emit completion event (SAND-06) with file list
                                yield f"data: {json.dumps({'type': 'code_execution_complete', 'exit_code': actual_exit_code, 'duration_ms': duration_ms, 'execution_id': execution_id, 'output_files': output_file_list})}\n\n"

                                exec_status = "completed" if actual_exit_code == 0 else "error"
                                tool_result = json.dumps({
                                    "status": exec_status,
                                    "exit_code": actual_exit_code,
                                    "duration_ms": duration_ms,
                                    "execution_id": execution_id,
                                    "output_files": output_file_list,
                                    "stdout": exec_result.stdout or "",
                                    "stderr": exec_result.stderr or "",
                                })
                                # Strip signed URLs from LLM context — frontend shows download cards
                                llm_tool_content = json.dumps({
                                    "status": exec_status,
                                    "exit_code": actual_exit_code,
                                    "duration_ms": duration_ms,
                                    "output_files": [{"filename": f["filename"], "size": f["size"]} for f in output_file_list],
                                    "stdout": exec_result.stdout or "",
                                    "stderr": exec_result.stderr or "",
                                })
                                asyncio.create_task(write_audit_entry(
                                    user_id=current_user["id"],
                                    action_type="code.execute",
                                    metadata={"thread_id": thread_id, "language": args.get("language", "python")},
                                    supabase=supabase,
                                ))
                            except Exception as exec_err:
                                logger.error("execute_code failed: %s", exec_err)
                                yield f"data: {json.dumps({'type': 'code_execution_complete', 'exit_code': 1, 'error': str(exec_err), 'duration_ms': 0, 'output_files': []})}\n\n"
                                tool_result = json.dumps({"status": "error", "error": str(exec_err)})
                        elif tool_name == "remember":
                            # Phase 33 MEM-01: store user preference/fact across threads
                            # D-01 upsert, D-02 case-insensitive, D-16 non-blocking, D-17 silent fail
                            key = (args.get("key", "") or "").strip().lower()
                            value = args.get("value", "") or ""

                            if not key:
                                # Pitfall 3: empty key must not reach DB
                                tool_result = json.dumps({"error": "key cannot be empty"})
                            else:
                                tool_result = json.dumps({"status": "remembered", "key": key})

                                async def _write_memory(
                                    _key: str = key,
                                    _value: str = value,
                                    _uid: str = current_user["id"],
                                ) -> None:
                                    try:
                                        supabase.table("user_memory").upsert(
                                            {
                                                "user_id": _uid,
                                                "key": _key,
                                                "value": _value,
                                            },
                                            on_conflict="user_id,key",
                                        ).execute()
                                    except Exception as exc:
                                        logger.warning(
                                            "memory.remember write failed [user=%s key=%s]: %s",
                                            _uid, _key, exc,
                                        )

                                asyncio.create_task(_write_memory())
                                asyncio.create_task(write_audit_entry(
                                    user_id=current_user["id"],
                                    action_type="memory.remember",
                                    metadata={"key": key, "value": value, "action": "upsert"},
                                    supabase=supabase,
                                ))

                        elif tool_name == "recall":
                            # Phase 33 MEM-01: retrieve stored memory entries
                            # D-09 (all), D-10 (specific), D-11 (not found), D-12 (empty)
                            key = (args.get("key", "") or "").strip().lower()

                            if key:
                                resp = (
                                    supabase.table("user_memory")
                                    .select("value")
                                    .eq("user_id", current_user["id"])
                                    .eq("key", key)
                                    .maybe_single()
                                    .execute()
                                )
                                row = resp.data if resp else None
                                # Pitfall 5: maybe_single() mock compatibility
                                if isinstance(row, list):
                                    row = row[0] if row else None
                                if row:
                                    tool_result = row["value"]
                                else:
                                    tool_result = f"No memory entry found for key: {key}"
                            else:
                                rows = (
                                    supabase.table("user_memory")
                                    .select("key, value")
                                    .eq("user_id", current_user["id"])
                                    .order("updated_at", desc=True)
                                    .execute()
                                ).data or []
                                if rows:
                                    tool_result = "\n".join(
                                        f"- {r['key']}: {r['value']}" for r in rows
                                    )
                                else:
                                    tool_result = "No memories stored yet."

                            asyncio.create_task(write_audit_entry(
                                user_id=current_user["id"],
                                action_type="memory.recall",
                                metadata={"key": key or None},
                                supabase=supabase,
                            ))
                        elif tool_name == "query_tables":
                            # MODAL-03 Phase 36: query structured table data from documents
                            from app.services.multimodal_service import handle_query_tables  # noqa: PLC0415
                            tool_result = handle_query_tables(args, current_user["id"], supabase)
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

                    # --- Option B: cap tool result size added to the LLM messages array ---
                    # Use the URL-stripped version for execute_code; raw result otherwise.
                    ctx_content = llm_tool_content if llm_tool_content is not None else tool_result
                    ctx_limit = (
                        _CTX_LIMIT_SUBAGENT if tool_name == "analyze_document"
                        else _CTX_LIMIT_DEFAULT  # cap read_document — use start_line/end_line for large docs
                    )
                    if len(ctx_content) > ctx_limit:
                        ctx_content = ctx_content[:ctx_limit] + f"\n[... truncated for context — {len(ctx_content) - ctx_limit} chars omitted]"

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": ctx_content,
                    })

                    # Persist tool call — for execute_code rebuild from tool_result
                    # so output_files (with signed URLs) are never lost by string truncation.
                    # Stdout/stderr are truncated since they're not needed for reload.
                    if tool_name == "execute_code":
                        try:
                            _r = json.loads(tool_result)
                            persisted_result = json.dumps({
                                "status": _r.get("status", "done"),
                                "exit_code": _r.get("exit_code", 0),
                                "duration_ms": _r.get("duration_ms", 0),
                                "output_files": _r.get("output_files", []),
                                "stdout": (_r.get("stdout", ""))[:800],
                                "stderr": (_r.get("stderr", ""))[:200],
                            })
                        except (json.JSONDecodeError, AttributeError):
                            persisted_result = tool_result[:2000]
                    else:
                        persisted_result = tool_result[:2000]

                    persisted_tool_calls.append({
                        "tool_call_id": tc["id"],
                        "name": tool_name,
                        "args": args,
                        "result": persisted_result,
                        "status": "done",
                        **({"sub_agent": sub_agent_record} if sub_agent_record else {}),
                    })
                # Continue to next iteration to let LLM respond with tool results in context

            # Fallback: if the loop ended with no content produced, emit a safe message
            if not full_content:
                fallback = "*I wasn't able to generate a response. Please try rephrasing your question.*"
                full_content += fallback
                yield f"data: {json.dumps({'type': 'delta', 'content': fallback})}\n\n"

          except APIError as e:
              logger.error("LLM API error in event stream (thread %s): %s", thread_id, e)
              err_str = str(e)
              err_lower = err_str.lower()
              # Map common API errors to actionable user messages
              if any(kw in err_lower for kw in ("credit balance", "billing", "quota", "insufficient_quota", "rate limit", "rate_limit")):
                  user_msg = (
                      "*API billing or rate-limit error: your account has insufficient credits "
                      "or has hit a usage limit. Please check your provider's billing dashboard.*"
                  )
              elif any(kw in err_lower for kw in ("invalid api key", "invalid_api_key", "authentication", "unauthorized", "401")):
                  user_msg = (
                      "*Authentication error: the API key for this provider is invalid or expired. "
                      "Please check your API key in Settings.*"
                  )
              elif any(kw in err_lower for kw in ("unsupported parameter", "unsupported_parameter")):
                  user_msg = (
                      f"*Model parameter error: {err_str}. "
                      "This model may not support the current configuration.*"
                  )
              elif any(kw in err_lower for kw in ("context", "maximum", "too long", "too large", "token limit", "overloaded")):
                  user_msg = (
                      "*The conversation has grown too long for this model's context window. "
                      "Please start a new chat or reduce the amount of history.*"
                  )
              elif _is_transient_provider_error(e):
                  user_msg = (
                      "*The AI provider is temporarily unavailable. Please try again in a moment.*"
                  )
              else:
                  user_msg = f"*LLM API error: {err_str}*"
              if not full_content:
                  full_content += user_msg
                  yield f"data: {json.dumps({'type': 'delta', 'content': user_msg})}\n\n"
              yield f"data: {json.dumps({'type': 'error', 'message': err_str})}\n\n"
          except Exception as e:
              logger.error("Unexpected error in event stream (thread %s): %s", thread_id, e, exc_info=True)
              user_msg = "*An unexpected error occurred. Please try again.*"
              if not full_content:
                  full_content += user_msg
                  yield f"data: {json.dumps({'type': 'delta', 'content': user_msg})}\n\n"
              yield f"data: {json.dumps({'type': 'error', 'message': 'An unexpected error occurred'})}\n\n"

          # Emit sources SSE event (deduplicated by document_id)
          if source_refs:
              unique_sources[:] = list({s["document_id"]: s for s in source_refs}.values())
              yield f"data: {json.dumps({'type': 'sources', 'sources': unique_sources})}\n\n"

          # Emit citations event (D-03, D-07: after sources, before confidence)
          unique_citations[:] = _deduplicate_citations(retrieved_citations)
          if unique_citations:
              # SSE payload truncates passage at 400 chars (D-04); full text stored in source_refs
              sse_citations = []
              for c in unique_citations:
                  sse_c = dict(c)
                  if sse_c.get("passage") and len(sse_c["passage"]) > 400:
                      sse_c["passage"] = sse_c["passage"][:400]
                  sse_citations.append(sse_c)
              yield f"data: {json.dumps({'type': 'citations', 'citations': sse_citations})}\n\n"

          # Emit confidence event (D-05, D-07: after citations, before title)
          if similarity_scores:
              final_avg = sum(similarity_scores) / len(similarity_scores)
              level = _compute_confidence(final_avg)
              disclaimer = CONFIDENCE_DISCLAIMER if level == "low" else None
              _confidence_slot[:] = [{"level": level, "avg_similarity": round(final_avg, 4), "disclaimer": disclaimer}]
              yield f"data: {json.dumps({'type': 'confidence', 'level': level, 'avg_similarity': round(final_avg, 4), 'disclaimer': disclaimer})}\n\n"

          # Persist assistant message (normal path — before [DONE])
          _persist_assistant_message()

          # Touch thread so it rises in updated_at ordering
          try:
              supabase.table("threads").update({"updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", thread_id).execute()
          except Exception:
              pass

          # Auto-title: generate on first exchange (history had exactly 1 message = first user msg)
          if len(history_resp.data) == 1 and history_resp.data[0]["role"] == "user":
              first_user_msg = history_resp.data[0]["content"]
              title = generate_thread_title(first_user_msg, user_settings=user_settings)
              try:
                  supabase.table("threads").update({"title": title}).eq("id", thread_id).execute()
                  yield f"data: {json.dumps({'type': 'title', 'content': title})}\n\n"
              except Exception:
                  pass

          # Phase 32: JSON done event signals main response complete (frontend stops streaming cursor)
          yield f"data: {json.dumps({'type': 'done'})}\n\n"

          # Phase 32: Non-blocking suggestion generation (SUG-03, SUG-04)
          try:
              from app.services.suggestion_service import generate_suggestions
              questions = generate_suggestions(
                  user_message=body.content,       # the user's message
                  assistant_response=full_content,  # accumulated full response text
                  user_settings=user_settings,
              )
              if questions:
                  yield f"data: {json.dumps({'type': 'suggestions', 'questions': questions[:3]})}\n\n"
          except Exception:
              pass  # SUG-04: failure never affects main response

          # Phase 32: True stream end — frontend returns from streamMessage
          yield f"data: {json.dumps({'type': 'stream_end'})}\n\n"

        finally:
            # Safety net: runs on GeneratorExit (client disconnect) or any
            # unhandled BaseException. The guard inside _persist_assistant_message
            # prevents a double-insert when the normal path already persisted.
            _persist_assistant_message()

    return sse_response(event_stream())
