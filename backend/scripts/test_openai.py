"""Quick smoke test for OpenAI service + LangSmith tracing."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.openai_service import create_streaming_response

stream = create_streaming_response("Hello, who are you?", None, "")
for event in stream:
    event_type = getattr(event, "type", None)
    if event_type == "response.output_text.delta":
        print(event.delta, end="", flush=True)
    elif event_type == "response.completed":
        print(f"\n\n[response_id: {event.response.id}]")
