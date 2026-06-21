"""Diagnostic — surface the REAL exception the gateway hits against LM Studio
(forced_emit swallows it as provider_error). Replicates the gateway call shape
directly and drains, printing the full traceback."""
import os
import sys
import traceback
from pathlib import Path

BACKEND = Path(r"C:/Vibe Apps/Agentic RAG/backend")
sys.path.insert(0, str(BACKEND))
for line in (BACKEND / ".env").read_text(encoding="utf-8", errors="ignore").splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

LMS = "http://127.0.0.1:1234/v1"
MODEL = os.environ.get("TEST_LMS_MODEL", "google/gemma-4-e4b")


def main():
    from app.models.user_settings import load_app_settings
    from app.services.embedding_service import build_metadata_model
    from app.services.openai_service import create_adaptive_streaming_chat

    base = load_app_settings()
    eff = base.model_copy(update={
        "active_provider": "lmstudio",
        "llm_base_url": LMS,
        "llm_api_key": "lm-studio",
        "llm_model": MODEL,
    })
    DynModel = build_metadata_model([])
    emit_tool = {
        "type": "function",
        "function": {
            "name": "emit_document_metadata",
            "description": "Emit structured metadata with per-field 0-1 confidence.",
            "parameters": DynModel.model_json_schema(),
        },
    }
    from app.config import get_model_capability
    from app.services.openai_service import resolve_calling_mode, get_llm_client
    cap = get_model_capability(MODEL)
    cm = resolve_calling_mode(MODEL, eff)
    print(f"model={MODEL} base_url={LMS}")
    print(f"cap.provider={cap.get('provider')} cap.native_tools={cap.get('native_tools')} "
          f"supports_parallel={cap.get('supports_parallel_tools')}")
    print(f"calling_mode={cm}  openrouter_tool_strategy={getattr(eff,'openrouter_tool_strategy','<none>')}")

    # Capture the EXACT kwargs the SDK is called with.
    client = get_llm_client(eff)
    orig = client.chat.completions.create
    def spy(**kwargs):
        printable = {k: (v if k != 'messages' else f'<{len(v)} msgs>') for k, v in kwargs.items()}
        print(f"\n--- SDK create() kwargs ---\n{printable}\n")
        return orig(**kwargs)
    client.chat.completions.create = spy
    import app.services.openai_service as oss
    oss.get_llm_client = lambda *a, **k: client

    try:
        stream, mode = create_adaptive_streaming_chat(
            messages=[{"role": "user", "content": "Document text:\n\nTitle: Test\nAuthor: X\nDate: 2024-01-01"}],
            model=MODEL,
            user_settings=eff,
            tool_choice="auto",
            tools_override=[emit_tool],
            force_tool_name=None,
            strict_response_format=False,
        )
        print(f"calling_mode={mode}; draining stream ...")
        n = 0
        for chunk in stream:
            n += 1
            if n <= 3:
                print(f"  chunk[{n}]: {str(chunk)[:200]}")
        print(f"drained {n} chunks OK")
    except Exception as e:
        print(f"\n!!! EXCEPTION: {type(e).__name__}: {e}\n")
        traceback.print_exc()


if __name__ == "__main__":
    main()
