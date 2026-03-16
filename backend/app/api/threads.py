import json
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.message import MessageCreate, MessageResponse
from app.models.thread import ThreadCreate, ThreadResponse
from app.services.openai_service import create_streaming_response
from app.config import settings

router = APIRouter(prefix="/threads", tags=["threads"])


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
        .insert({"user_id": current_user["id"], "title": body.title, "openai_thread_id": ""})
        .execute()
    )
    return response.data[0]


@router.get("/{thread_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    thread_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Verify thread ownership
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
    # Verify thread ownership and get current openai_thread_id
    thread_resp = (
        supabase.table("threads")
        .select("*")
        .eq("id", thread_id)
        .eq("user_id", current_user["id"])
        .single()
        .execute()
    )
    if not thread_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    thread = thread_resp.data

    # Insert user message
    supabase.table("messages").insert({
        "thread_id": thread_id,
        "user_id": current_user["id"],
        "role": "user",
        "content": body.content,
    }).execute()

    previous_response_id = thread["openai_thread_id"] or None

    async def event_stream() -> AsyncGenerator[str, None]:
        full_content = ""
        new_response_id = None

        stream = create_streaming_response(
            message=body.content,
            previous_response_id=previous_response_id,
            vector_store_id=settings.openai_vector_store_id,
        )

        for event in stream:
            event_type = getattr(event, "type", None)

            if event_type == "response.output_text.delta":
                delta = event.delta
                full_content += delta
                yield f"data: {json.dumps({'type': 'delta', 'content': delta})}\n\n"

            elif event_type == "response.completed":
                new_response_id = event.response.id

        # Update thread with new response ID
        if new_response_id:
            supabase.table("threads").update({
                "openai_thread_id": new_response_id,
            }).eq("id", thread_id).execute()

        # Insert assistant message
        supabase.table("messages").insert({
            "thread_id": thread_id,
            "user_id": current_user["id"],
            "role": "assistant",
            "content": full_content,
        }).execute()

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
