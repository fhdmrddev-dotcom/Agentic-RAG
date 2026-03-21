import json
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
from app.services.openai_service import create_streaming_chat, get_llm_client
from app.services.retrieval_service import search_documents, resolve_document_id, fetch_full_document
from app.services.web_search_service import web_search
from app.services.sql_service import query_documents
from app.services.sub_agent_service import run_sub_agent

router = APIRouter(prefix="/threads", tags=["threads"])

SYSTEM_PROMPT = (
    "You are a helpful AI assistant. You have four tools — use the RIGHT one for each question:\n\n"
    "1. query_documents — ALWAYS use this for questions about the user's file library: "
    "'how many documents', 'list my files', 'which documents', 'how many PDFs', etc. "
    "Do NOT add a user_id filter. Example SQL: SELECT COUNT(*) FROM documents\n\n"
    "2. search_documents — use this to find information INSIDE document contents. "
    "Use metadata_filter to narrow by document_type, author, language, or date.\n\n"
    "3. web_search — use this for current events, software versions, news, sports results, prices, "
    "or general world knowledge that is UNLIKELY to be in the user's uploaded documents. "
    "If the question could be answered from uploaded documents, try search_documents FIRST. "
    "Always include the source URL in your answer.\n\n"
    "4. analyze_document — use this for tasks requiring the FULL content of a specific document: "
    "summarization, detailed analysis, comparison, extracting all key points, critiquing arguments. "
    "You can use a partial or approximate filename (e.g. 'Elitefooty PRD') — it will be matched "
    "automatically. If you need to confirm the exact filename first, call query_documents. "
    "Do NOT use search_documents for whole-document analysis tasks.\n\n"
    "Key rules:\n"
    "- Questions about file counts/lists → query_documents\n"
    "- Questions about document contents/excerpts → search_documents\n"
    "- Deep analysis/summary of a whole document → analyze_document (you may chain query_documents "
    "first to confirm the filename, then call analyze_document)\n"
    "- Questions about the world/internet (not in documents) → web_search\n"
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
    response = (
        supabase.table("threads")
        .insert({"user_id": current_user["id"], "title": body.title})
        .execute()
    )
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

        # Load full message history (includes just-inserted user message)
        history_resp = (
            supabase.table("messages")
            .select("role, content")
            .eq("thread_id", thread_id)
            .eq("user_id", current_user["id"])
            .order("created_at")
            .execute()
        )

        messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
        for msg in history_resp.data:
            messages.append({"role": msg["role"], "content": msg["content"]})

        full_content = ""
        persisted_tool_calls: list[dict] = []
        MAX_ITERATIONS = 5

        try:
            for iteration in range(MAX_ITERATIONS):
                # On the final iteration force a text response to avoid an infinite loop
                force_no_tools = (iteration == MAX_ITERATIONS - 1)
                tool_choice = "none" if force_no_tools else "auto"
                stream = create_streaming_chat(
                    messages,
                    model=body.model,
                    user_settings=user_settings,
                    tool_choice=tool_choice,
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
                        if tool_name == "search_documents":
                            metadata_filter = args.get("metadata_filter") or None
                            results = search_documents(args["query"], current_user["id"], supabase, metadata_filter=metadata_filter, user_settings=user_settings)
                            tool_result = json.dumps(results) if results else "No relevant documents found."
                        elif tool_name == "query_documents":
                            tool_result = query_documents(args["query"], current_user["id"], supabase)
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

                    yield f"data: {json.dumps({'type': 'tool_end', 'name': tool_name})}\n\n"
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": tool_result,
                    })
                    persisted_tool_calls.append({
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
