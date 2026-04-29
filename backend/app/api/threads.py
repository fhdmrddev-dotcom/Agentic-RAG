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
import openai
from openai import APIError
try:
    from anthropic import APIError as AnthropicAPIError
except ImportError:
    AnthropicAPIError = Exception  # fallback if SDK not installed
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.message import MessageCreate, MessageResponse
from app.models.thread import ThreadCreate, ThreadResponse, ThreadUpdate
from app.services.audit_service import write_audit_entry
from app.utils.folder_utils import fetch_visible_folders
from app.models.user_settings import load_user_settings, override_provider
from app.config import settings, _SUB_AGENT_MODEL_DEFAULTS
from app.services.openai_service import create_adaptive_streaming_chat, get_llm_client, get_explorer_tools, EXPLORER_SYSTEM_PROMPT, _uses_max_completion_tokens, CallingMode, get_tools, resolve_calling_mode, normalize_finish_reason
from app.services.anthropic_service import stream_anthropic
from app.services.tool_parser import parse_structured_tool_calls, ToolCall

# Lazy sandbox import — only if enabled
if settings.sandbox_enabled:
    from app.services.sandbox_service import sandbox_manager, harvest_output_files
from app.services.context_window import trim_messages_to_fit, estimate_messages_tokens, resolve_context_budget
from app.services.retrieval_service import search_documents, resolve_document_id, fetch_full_document
from app.services.web_search_service import web_search
from app.services.sql_service import query_documents
from app.services.sub_agent_service import run_sub_agent
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

    "## CRITICAL: Two operating modes\n"
    "**Q&A / retrieval** (DEFAULT — use this unless the user explicitly requests a file): "
    "The user asks a question and wants a text answer. Search or analyze documents, then respond with text. "
    "After each tool call, check: do I have enough to answer? If yes — respond directly. "
    "Do NOT call more tools to verify what you already have.\n"
    "**File generation** (ONLY when the user explicitly asks you to CREATE, GENERATE, BUILD, or MAKE a downloadable file): "
    "The user uses action verbs like 'create a PowerPoint', 'generate a PDF report', 'build me an Excel sheet', "
    "'make a Word document'. Retrieve/analyze the required content, then call execute_code to produce the file.\n\n"

    "**Disambiguation — when in doubt, default to Q&A.** "
    "If the user says 'summarize the report' or 'what does the report say?' — that is Q&A, respond with text. "
    "If the user says 'create a summary report as a Word doc' — that is file generation, use execute_code. "
    "The presence of words like 'report', 'summary', 'analysis' does NOT mean file generation. "
    "Only trigger execute_code when the user explicitly asks for a downloadable file.\n\n"

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
    "query_documents first to identify it, then call analyze_document. "
    "**Once analyze_document returns, never call read_document on that same document — the full content has already been processed.**\n"
    "- **ls / tree** → browse folder structure and navigate the knowledge base\n"
    "- **grep** → find documents containing a specific phrase or regex pattern\n"
    "- **glob** → find documents by filename pattern (*.pdf, report-*, etc.)\n"
    "- **read_document** → read a specific section when search chunks are cut off or incomplete; use start_line/end_line; "
    "do NOT call more than once per document per question\n"
    "- **web_search** → current events, software versions, or topics not covered in uploaded documents\n"
    "- **execute_code** → create downloadable files (PowerPoint, PDF, Word, Excel, charts) when the user explicitly asks "
    "for file creation. Also for calculations and data analysis that require Python. "
    "Always pass `libraries` for non-stdlib packages. "
    "Pass `skill_files` to inject skill attachment files into the sandbox at /sandbox/{filename}. "
    "Write output files to /sandbox/output/ and list them in `output_files`.\n"
    "- **load_skill** → activate a skill; call silently and then follow the skill's instructions exactly\n"
    "- **save_skill / read_skill_file** → skill management\n"
    "- **query_tables** → structured table data from documents: 'show me the revenue table from Q3 Report', "
    "'find rows where Region is APAC', 'what are the column headers in the summary table?'. "
    "Use when the question is about specific values inside a document's tabular data.\n\n"

    "**DO NOT use execute_code for:** answering questions, summarizing documents, explaining concepts, "
    "listing information, comparing documents, or any task where a text response is appropriate. "
    "Only use it when the user wants a downloadable file or needs Python computation.\n\n"

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
    "- **Never loop on read_document:** If two consecutive read_document calls on the same document return no results, stop — do not call it a third time. Answer from what you have or use analyze_document once.\n"
    "- **Web vs documents conflict:** If web_search results conflict with content in your documents, prioritize the "
    "document content and flag the discrepancy explicitly to the user.\n"
    "- **Tool call brevity:** When calling tools, do NOT narrate your plan or reasoning. Just call the tool. "
    "Verbalizing your intent wastes output tokens and can cause the tool call to be cut off mid-stream.\n"
    "- **After analyze_document (file generation task):** If the user asked for a downloadable file, call execute_code "
    "with complete Python code. Do not write long preambles before the tool call — keep text minimal to preserve "
    "output token budget for the code.\n"
    "- **After analyze_document (Q&A task):** Respond with your findings in text. Do not call execute_code.\n"
    "- **Never call execute_code in the same response as search_documents, analyze_document, read_document, or web_search.** "
    "Retrieve content first; call execute_code only in the NEXT iteration after you have received the retrieved data. "
    "Calling execute_code before reading documents produces fabricated content.\n"
    "- **Keep execute_code scripts under 200 lines.** Use data-driven loops and helper functions instead of hardcoding "
    "each slide, section, or page. Monolithic scripts are slow to generate and error-prone. "
    "If the task requires more than 200 lines, split into multiple execute_code calls.\n\n"

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


TOOL_USAGE_INSTRUCTIONS = """

## Tool Usage Format

When you need to use a tool, output a JSON block in this exact format:

```json
{{"tool": "TOOL_NAME", "arguments": {{"arg1": "value1", "arg2": "value2"}}}}
```

Available tools:
{tool_list}

Rules:
1. Output ONLY the JSON block — do not describe your plan or say "Now I'll search..."
2. Use the exact tool name from the list above
3. Include ALL required arguments
4. If you don't need a tool, respond normally with text
"""


def _format_tool_list(tools: list[dict]) -> str:
    """Format tool schemas as a human-readable list for structured mode prompts."""
    lines = []
    for tool in tools:
        fn = tool.get("function", {})
        name = fn.get("name", "unknown")
        desc = fn.get("description", "")
        params = fn.get("parameters", {})
        props = params.get("properties", {})
        required = params.get("required", [])
        
        lines.append(f"- **{name}**: {desc}")
        if props:
            arg_lines = []
            for arg_name, arg_info in props.items():
                req_flag = " (required)" if arg_name in required else ""
                arg_desc = arg_info.get("description", "")
                arg_type = arg_info.get("type", "any")
                arg_lines.append(f"  - `{arg_name}` ({arg_type}){req_flag}: {arg_desc}")
            lines.extend(arg_lines)
    return "\n".join(lines)


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


def generate_thread_title(
    first_user_message: str,
    user_settings=None,
) -> tuple[str, dict | None]:
    """Call LLM to produce a short thread title from the first user message.

    Returns (title, fallback_info). fallback_info is None unless a 404 retry occurred.
    """
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
        title_messages = [
            {
                "role": "system",
                "content": "Generate a concise chat title (4-6 words max) for the following message. Respond with only the title, no punctuation, no quotes.",
            },
            {"role": "user", "content": first_user_message[:500]},
        ]
        response = client.chat.completions.create(
            model=model,
            messages=title_messages,
            stream=False,
            **{token_param: 20},
        )
        return response.choices[0].message.content.strip() or "New Chat", None
    except openai.NotFoundError:
        provider = user_settings.active_provider if user_settings else ""
        fallback = (
            _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
            or (user_settings.llm_model if user_settings else settings.llm_model)
        )
        if not fallback or fallback == model:
            return first_user_message[:40].strip() or "New Chat", None
        fallback_info = {"original_model": model, "fallback_model": fallback}
        token_param2 = "max_completion_tokens" if _uses_max_completion_tokens(fallback) else "max_tokens"
        title_messages = [
            {
                "role": "system",
                "content": "Generate a concise chat title (4-6 words max) for the following message. Respond with only the title, no punctuation, no quotes.",
            },
            {"role": "user", "content": first_user_message[:500]},
        ]
        response = client.chat.completions.create(
            model=fallback,
            messages=title_messages,
            stream=False,
            **{token_param2: 20},
        )
        return response.choices[0].message.content.strip() or "New Chat", fallback_info
    except Exception:
        return first_user_message[:40].strip() or "New Chat", None


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

    _stop_event = asyncio.Event()

    async def event_stream(stop_event: asyncio.Event = _stop_event) -> AsyncGenerator[str, None]:
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
            max_iterations = 8   # GEN-04: was 6
        else:
            active_system_prompt = SYSTEM_PROMPT
            active_tools = None  # None = use default get_tools() in create_streaming_chat
            max_iterations = 15  # GEN-04: was 8

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
                    f"The following skills are available. ONLY call `load_skill(skill_name)` when the user "
                    f"explicitly names a skill or says 'use [skill name]'. Never auto-load based on "
                    f"description similarity — wait for an explicit request:\n{catalog_lines}"
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

        # GEN-03: Tool results stored in full — no character caps.
        # Context budget managed by trim_messages_to_fit() which drops OLDER messages
        # when total context exceeds the model's budget.

        try:  # outer try/finally — guarantees persist even on GeneratorExit (client disconnect)
          try:
            # Pre-inject tool instructions only for OpenRouter XML strategy — the one
            # deterministic structured-mode path. All other providers use native tool
            # calling; unknown models get post-creation injection (next iteration).
            _needs_pre_injection = (
                getattr(user_settings, "active_provider", "") == "openrouter"
                and getattr(user_settings, "openrouter_tool_strategy", "quality") == "xml"
            )
            _structured_tools_injected = False

            for iteration in range(max_iterations):
                if stop_event.is_set():
                    return
                # D-04 (Phase 56): emit iteration_start at the top of every iteration.
                # Frontend uses this to increment the "Step N" counter (D-03).
                # iteration is 0-indexed; frontend adds +1 for display (Pitfall 1).
                yield f"data: {json.dumps({'type': 'iteration_start', 'iteration': iteration})}\n\n"
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

                # OpenRouter XML: inject tool-format instructions BEFORE stream creation
                # so the model sees them on the very first call.
                if _needs_pre_injection and not _structured_tools_injected and tool_choice == "auto":
                    _tl_text = _format_tool_list(active_tools if active_tools is not None else get_tools(user_settings))
                    for _si, _sm in enumerate(messages):
                        if _sm.get("role") == "system":
                            messages[_si] = {
                                "role": "system",
                                "content": _sm["content"] + TOOL_USAGE_INSTRUCTIONS.format(tool_list=_tl_text),
                            }
                            _structured_tools_injected = True
                            break

                while True:
                    try:
                        active_provider_name = getattr(user_settings, "active_provider", "") or ""

                        if active_provider_name == "anthropic":
                            # --- Anthropic native SDK path (GEN-02) ---
                            from app.services.openai_service import _resolve_max_tokens
                            _ant_max_tokens = _resolve_max_tokens(None, user_settings)
                            _ant_api_key = user_settings.llm_api_key or settings.llm_api_key or ""
                            _ant_tools = active_tools if active_tools is not None else get_tools(user_settings)
                            _ant_gen = stream_anthropic(
                                messages=messages,
                                tools=_ant_tools,
                                system_prompt=active_system_prompt,
                                model=body.model or user_settings.llm_model,
                                api_key=_ant_api_key,
                                max_tokens=_ant_max_tokens,
                                force_no_tools=force_no_tools,
                            )
                            tool_calls_buffer = {}
                            finish_reason = None
                            for _ant_event in _ant_gen:
                                if stop_event.is_set():
                                    return
                                _etype = _ant_event.get("type")
                                if _etype == "delta":
                                    _text = _ant_event.get("content", "")
                                    if _text:
                                        full_content += _text
                                        yield f"data: {json.dumps({'type': 'delta', 'content': _text})}\n\n"
                                elif _etype == "tool_start":
                                    # D-01 (Phase 56.1): Anthropic delivers complete tool calls via tool_start,
                                    # so emit tool_preparing immediately — fires before buffer assignment.
                                    _idx = len(tool_calls_buffer)
                                    yield f"data: {json.dumps({'type': 'tool_preparing', 'name': _ant_event['name'], 'index': _idx})}\n\n"
                                    # Map to tool_calls_buffer format (same as OpenAI path)
                                    tool_calls_buffer[_idx] = {
                                        "id": _ant_event["id"],
                                        "name": _ant_event["name"],
                                        "arguments": json.dumps(_ant_event.get("args", {})),
                                    }
                                elif _etype == "finish":
                                    finish_reason = _ant_event.get("finish_reason", "stop")
                            break  # stream completed

                        else:
                            # --- OpenAI / Google / OpenRouter / Ollama path (unchanged) ---
                            stream, calling_mode = create_adaptive_streaming_chat(
                                messages=messages,
                                model=body.model,
                                user_settings=user_settings,
                                tool_choice=tool_choice,
                                tools_override=active_tools,
                            )

                            # Fallback: inject for other structured-mode models (unknown models).
                            # Happens after the first call; subsequent iterations will have instructions.
                            if calling_mode == CallingMode.STRUCTURED and tool_choice == "auto" and not _structured_tools_injected:
                                _tl_fb = _format_tool_list(active_tools if active_tools is not None else get_tools(user_settings))
                                for _fi, _fm in enumerate(messages):
                                    if _fm.get("role") == "system":
                                        messages[_fi] = {
                                            "role": "system",
                                            "content": _fm["content"] + TOOL_USAGE_INSTRUCTIONS.format(tool_list=_tl_fb),
                                        }
                                        _structured_tools_injected = True
                                        break

                            tool_calls_buffer: dict = {}
                            finish_reason: str | None = None
                            _announced_tools: set[int] = set()

                            for chunk in stream:
                                if stop_event.is_set():
                                    return
                                if not chunk.choices:
                                    continue
                                choice = chunk.choices[0]
                                delta = choice.delta

                                if choice.finish_reason:
                                    finish_reason = normalize_finish_reason(choice.finish_reason)

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
                                            # D-01 (Phase 56.1): emit tool_preparing as soon as name is known,
                                            # before arguments finish streaming. Fires exactly once per tool index.
                                            if idx not in _announced_tools:
                                                _announced_tools.add(idx)
                                                yield f"data: {json.dumps({'type': 'tool_preparing', 'name': tc.function.name, 'index': idx})}\n\n"
                                        if tc.function and tc.function.arguments:
                                            tool_calls_buffer[idx]["arguments"] += tc.function.arguments

                            # Parse tool calls based on calling mode
                            if calling_mode == CallingMode.STRUCTURED:
                                structured_calls = parse_structured_tool_calls(full_content)
                                if structured_calls:
                                    # Convert to tool_calls_buffer format for uniform execution
                                    for idx, call in enumerate(structured_calls):
                                        tool_calls_buffer[idx] = {
                                            "id": call.id,
                                            "name": call.function.name,
                                            "arguments": call.function.arguments,
                                        }
                                    # D-05 (Phase 56.1): emit tool_preparing for each structured call.
                                    # Structured mode has no streaming name delivery; this fires immediately
                                    # after parse returns, before the tool execution loop.
                                    for idx, call in enumerate(structured_calls):
                                        yield f"data: {json.dumps({'type': 'tool_preparing', 'name': call.function.name, 'index': idx})}\n\n"
                                    # Clear content since it was a tool call, not a user-facing response
                                    full_content = ""
                                    finish_reason = "tool_calls"
                                elif full_content.strip():
                                    # Log parse failure for observability
                                    logger.warning(
                                        "structured_tool_parse_failed",
                                        extra={
                                            "model": body.model,
                                            "provider": user_settings.active_provider if user_settings else "unknown",
                                            "content_preview": full_content[:200],
                                        }
                                    )

                            break  # stream completed successfully

                    except (APIError, AnthropicAPIError) as provider_err:
                        # Detect "request too large" 429 — distinct from a rate-limit 429.
                        # This fires when the account's TPM ceiling (e.g. OpenAI Tier-1: 30k)
                        # is smaller than the single request size. This is an account plan
                        # limitation, not a model or app issue — do NOT trim content.
                        _err_str = str(provider_err).lower()
                        _is_request_too_large = (
                            getattr(provider_err, "status_code", None) == 429
                            and ("request too large" in _err_str or "tokens per min" in _err_str)
                        )
                        if _is_request_too_large:
                            _tpm_msg = (
                                "*This document is too large for your current OpenAI account plan. "
                                "gpt-4.1 supports up to 1M tokens, but your account's TPM limit "
                                "rejected this request. To fix: upgrade to OpenAI Tier 2 at "
                                "platform.openai.com/account/rate-limits, switch to Anthropic "
                                "(claude-sonnet-4-6), or use OpenRouter which has higher limits.*"
                            )
                            full_content += _tpm_msg
                            yield f"data: {json.dumps({'type': 'delta', 'content': _tpm_msg})}\n\n"
                            break

                        if _is_transient_provider_error(provider_err) and _provider_retries < _MAX_PROVIDER_RETRIES:
                            _provider_retries += 1
                            delay = _retry_delays[_provider_retries - 1]
                            logger.warning(
                                "Transient provider error on iteration %d (thread %s), "
                                "attempt %d/%d — retrying in %.1fs. status=%s",
                                iteration, thread_id,
                                _provider_retries, _MAX_PROVIDER_RETRIES + 1,
                                delay, getattr(provider_err, "status_code", "unknown"),
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
                    err_msg = "*The conversation grew too large for this model's context window. Start a new chat and try the generation request again.*"
                    full_content += err_msg
                    yield f"data: {json.dumps({'type': 'delta', 'content': err_msg})}\n\n"
                    yield f"data: {json.dumps({'type': 'error', 'message': 'finish_reason=length during tool streaming'})}\n\n"
                    break

                if finish_reason == "length":
                    # Detect "prose-before-code" anti-pattern: model wrote text instead of calling
                    # execute_code, consumed the full token budget, and never made the tool call.
                    # Recovery: inject a corrective user message and continue the loop so the model
                    # can call execute_code on the next iteration.
                    _generation_keywords = ("powerpoint", "pptx", "ppt", "presentation", "pdf",
                                            "word", "excel", "report", "chart", "generate", "create",
                                            "build", "python", "execute_code")
                    _content_lower = full_content.lower()
                    _looks_like_prose_not_code = (
                        iteration > 0
                        and not tool_calls_buffer
                        and any(kw in _content_lower for kw in _generation_keywords)
                        and len(full_content) > 500
                    )
                    if _looks_like_prose_not_code:
                        # Strip the truncated prose — inject a recovery prompt instead
                        full_content = ""
                        _recovery = (
                            "You wrote a text response but hit the output token limit before calling execute_code. "
                            "Do NOT write any more text. Call execute_code NOW with complete Python code to produce the file."
                        )
                        messages.append({"role": "assistant", "content": "[Response truncated — token limit reached before execute_code was called]"})
                        messages.append({"role": "user", "content": _recovery})
                        logger.warning("prose_before_code_recovery: iteration %d hit length limit without tool call — injecting recovery prompt", iteration)
                        continue  # retry this iteration
                    truncation_note = "\n\n*[Response truncated — output token limit reached. Start a new chat or reduce document length.]*"
                    full_content += truncation_note
                    yield f"data: {json.dumps({'type': 'delta', 'content': truncation_note})}\n\n"
                    break

                # Execute tools if any were buffered, regardless of finish_reason.
                # Anthropic's compat layer sends "end_turn" (not "tool_calls") even when
                # tool calls are present — checking finish_reason alone would silently drop them.
                if not tool_calls_buffer:
                    if finish_reason not in ("tool_calls", "stop", "end_turn", None):
                        logger.warning(
                            "Unexpected finish_reason %r on iteration %d — treating as stop",
                            finish_reason, iteration,
                        )
                    # Guard: if LLM returned stop with no content and no tools at any
                    # iteration, retry once — handles transient hiccups and reasoning
                    # models (e.g. Kimi K2.5) that exhaust output budget on thinking
                    # tokens and return empty content after a tool call.
                    if not full_content and _empty_retries < 1:
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
                                            # Detect fallback sentinel emitted by sub_agent_service
                                            if text_chunk.startswith('{"__type": "fallback_model"'):
                                                try:
                                                    sentinel = json.loads(text_chunk)
                                                    yield f"data: {json.dumps({'type': 'fallback_model', 'original_model': sentinel['original_model'], 'fallback_model': sentinel['fallback_model']})}\n\n"
                                                except (json.JSONDecodeError, KeyError):
                                                    pass
                                                continue
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
                            _sr_resp = (
                                supabase.table("skills")
                                .select("id, user_id")
                                .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
                                .eq("name", skill_name)
                                .maybe_single()
                                .execute()
                            )
                            skill_row = _sr_resp.data if _sr_resp is not None else None
                            if not skill_row:
                                # Retry with normalized name for agent display-name mismatches
                                _sr_norm = skill_name.lower().replace(" ", "-")
                                if _sr_norm != skill_name:
                                    _sr_resp2 = (
                                        supabase.table("skills")
                                        .select("id, user_id")
                                        .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
                                        .eq("name", _sr_norm)
                                        .maybe_single()
                                        .execute()
                                    )
                                    skill_row = _sr_resp2.data if _sr_resp2 is not None else None
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
                                    _sf_resp = (
                                        supabase.table("skills")
                                        .select("id, user_id")
                                        .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
                                        .eq("name", sf_skill_name)
                                        .maybe_single()
                                        .execute()
                                    )
                                    sf_skill = _sf_resp.data if _sf_resp is not None else None
                                    if not sf_skill:
                                        # Retry with normalized name: agent often uses display name
                                        # ("Weekly Report Writer") instead of stored slug ("weekly-report-writer")
                                        _sf_norm = sf_skill_name.lower().replace(" ", "-")
                                        if _sf_norm != sf_skill_name:
                                            _sf_resp2 = (
                                                supabase.table("skills")
                                                .select("id, user_id")
                                                .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
                                                .eq("name", _sf_norm)
                                                .maybe_single()
                                                .execute()
                                            )
                                            sf_skill = _sf_resp2.data if _sf_resp2 is not None else None
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

                    # GEN-03: Store full tool result — no character cap.
                    # trim_messages_to_fit() drops OLDER messages when context budget is exceeded.
                    full_content = llm_tool_content if llm_tool_content is not None else tool_result
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": full_content,
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
                # GEN-07: two distinct messages — context overflow vs empty model response
                # Context overflow is caught earlier (finish_reason == "length").
                # This branch = model returned empty content after all iterations/retries.
                fallback = (
                    f"*The model returned an empty response after {max_iterations} iterations. "
                    "Try breaking the request into smaller steps or switching to a different model.*"
                )
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
              logger.error("Unexpected error in event stream (thread %s): %s [%s]", thread_id, e, type(e).__name__, exc_info=True)
              user_msg = f"*An unexpected error occurred ({type(e).__name__}). Please try again.*"
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
              title, title_fallback = generate_thread_title(first_user_msg, user_settings=user_settings)
              if title_fallback:
                  yield f"data: {json.dumps({'type': 'fallback_model', **title_fallback})}\n\n"
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
              questions, sugg_fallback = generate_suggestions(
                  user_message=body.content,       # the user's message
                  assistant_response=full_content,  # accumulated full response text
                  user_settings=user_settings,
              )
              if sugg_fallback:
                  yield f"data: {json.dumps({'type': 'fallback_model', **sugg_fallback})}\n\n"
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
            # asyncio.shield() ensures the DB write completes even if the ASGI task
            # is cancelled (CancelledError) before the finally block finishes.
            async def _shielded_persist():
                _persist_assistant_message()
            try:
                await asyncio.shield(_shielded_persist())
            except asyncio.CancelledError:
                pass

    return sse_response(event_stream(_stop_event), stop_event=_stop_event)
