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
from app.services.retrieval_service import search_documents
from app.services.web_search_service import web_search
from app.services.sql_service import query_documents

router = APIRouter(prefix="/threads", tags=["threads"])

SYSTEM_PROMPT = (
    "You are a helpful AI assistant. You have three tools — use the RIGHT one for each question:\n\n"
    "1. query_documents — ALWAYS use this for questions about the user's file library: "
    "'how many documents', 'list my files', 'which documents', 'how many PDFs', etc. "
    "Do NOT add a user_id filter. Example SQL: SELECT COUNT(*) FROM documents\n\n"
    "2. search_documents — use this to find information INSIDE document contents. "
    "Use metadata_filter to narrow by document_type, author, language, or date.\n\n"
    "3. web_search — use this DIRECTLY (without searching documents first) for: "
    "current events, software versions, news, sports results, prices, or any general world knowledge. "
    "Always include the source URL in your answer.\n\n"
    "Key rules:\n"
    "- Questions about file counts/lists → query_documents\n"
    "- Questions about document contents → search_documents\n"
    "- Questions about the world/internet → web_search (call it first, do not try search_documents)\n"
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
        tool_calls_buffer: dict = {}
        finish_reason: str | None = None

        try:
            stream = create_streaming_chat(messages, model=body.model, user_settings=user_settings)

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

            elif finish_reason == "tool_calls" and tool_calls_buffer:
                tool_calls = list(tool_calls_buffer.values())

                # Append assistant tool_calls message
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

                # Execute each tool call
                import logging
                logger = logging.getLogger(__name__)
                for tc in tool_calls:
                    tool_name = tc["name"]
                    try:
                        args = json.loads(tc["arguments"])
                        if tool_name == "search_documents":
                            metadata_filter = args.get("metadata_filter") or None
                            results = search_documents(args["query"], current_user["id"], supabase, metadata_filter=metadata_filter, user_settings=user_settings)
                            tool_result = json.dumps(results) if results else "No relevant documents found."
                        elif tool_name == "query_documents":
                            tool_result = query_documents(args["query"], current_user["id"], supabase)
                        elif tool_name == "web_search":
                            tool_result = web_search(args["query"], settings.tavily_api_key, settings.web_search_max_results)
                        else:
                            tool_result = f"Unknown tool: {tool_name}"
                    except json.JSONDecodeError:
                        tool_result = "Error parsing tool arguments"
                    except (ValueError, RuntimeError) as e:
                        logger.error("Tool %s failed: %s", tool_name, e)
                        tool_result = f"Tool error: {e}"
                    except Exception as e:
                        logger.error("Tool %s unexpected error: %s", tool_name, e)
                        tool_result = f"Tool execution failed: {e}"

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": tool_result,
                    })

                # Second streaming call — no tools to prevent recursion
                stream2 = create_streaming_chat(messages, tool_choice="none", model=body.model, user_settings=user_settings)
                for chunk in stream2:
                    if not chunk.choices:
                        continue
                    choice = chunk.choices[0]
                    delta = choice.delta
                    if delta.content:
                        full_content += delta.content
                        yield f"data: {json.dumps({'type': 'delta', 'content': delta.content})}\n\n"

        except APIError as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            yield "data: [DONE]\n\n"
            return

        # Persist assistant message
        if full_content:
            supabase.table("messages").insert({
                "thread_id": thread_id,
                "user_id": current_user["id"],
                "role": "assistant",
                "content": full_content,
            }).execute()

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
