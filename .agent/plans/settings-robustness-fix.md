# Settings Robustness Fix — Global App Settings

⚠️ **Medium** - Two targeted file changes, no migration needed

## Context

After migrating to a global `app_settings` table (single row, no user_id), retrieval still fails with `BadRequestError: you must provide a model parameter` after the user modifies settings in the UI.

**Root cause:** The save handlers in `settings.py` use partial updates — they only write fields that were explicitly sent in the request body. Unset fields remain `NULL` in the DB and fall back to `.env` via `_v()`. If the `.env` value for a critical field (e.g. `embedding_model`) is empty or missing, all three layers fail simultaneously: DB is NULL, `_v()` returns env default which is `""`, and the `or settings.embedding_model` belt-and-suspenders is also `""`.

**Secondary issue:** `get_embedding_client()` falls back to `llm_api_key` (e.g. OpenRouter key) when `embedding_api_key` is empty, but doesn't set the corresponding `base_url` — this sends an OpenRouter key to `api.openai.com`, which will be rejected.

**Architectural decision:**
- **Do NOT sync DB↔.env** — risk of system-wide outage from a single bad value.
- **Correct pattern:** `.env` = immutable deployment defaults. `app_settings` = mutable runtime overrides. Merge at runtime: DB value → env fallback.
- **The fix:** Write complete sections (not partial updates) when saving, so the DB always has all values for any touched section — no runtime reliance on env fallback.

---

## Changes

### 1. `backend/app/api/settings.py` — Write complete sections on save

When saving any section, load current effective settings first, merge new values on top, write **all** fields for that section to DB. No more partial null state.

**`update_embedding` handler pattern:**
```python
effective = load_app_settings(supabase)
update = {
    "embedding_model": (body.embedding_model or None) if body.embedding_model is not None else (effective.embedding_model or None),
    "embedding_base_url": (body.embedding_base_url or None) if body.embedding_base_url is not None else (effective.embedding_base_url or None),
    "embedding_dimensions": body.embedding_dimensions if body.embedding_dimensions is not None else effective.embedding_dimensions,
}
if body.embedding_api_key:
    update["embedding_api_key"] = body.embedding_api_key
elif effective.embedding_api_key:
    update["embedding_api_key"] = effective.embedding_api_key
_update_row(update, supabase)
```

Apply same pattern to `update_reranking` and `update_retrieval`.

### 2. `backend/app/services/openai_service.py` — Fix embedding client fallback

When `embedding_api_key` is empty, fall back to `llm_api_key` AND `llm_base_url` together:

```python
def get_embedding_client(user_settings=None):
    if user_settings is not None:
        if user_settings.embedding_api_key:
            api_key = user_settings.embedding_api_key
            base_url = user_settings.embedding_base_url or None
        else:
            # No explicit embedding key — use LLM provider credentials
            api_key = user_settings.llm_api_key
            base_url = user_settings.embedding_base_url or user_settings.llm_base_url or None
    else:
        api_key = settings.embedding_api_key or settings.llm_api_key
        base_url = settings.embedding_base_url or settings.llm_base_url or None

    kwargs = {"api_key": api_key}
    if base_url:
        kwargs["base_url"] = base_url
    return OpenAI(**kwargs)
```

### 3. `backend/app/models/user_settings.py` — No changes needed
`_v()` already handles NULL and empty strings correctly.

---

## Critical Files
- `backend/app/api/settings.py` — `update_embedding`, `update_reranking`, `update_retrieval`
- `backend/app/services/openai_service.py` — `get_embedding_client()`

---

## Verification

1. Open Settings UI → Embedding section → click Save without changing anything
2. Check `app_settings` row in Supabase — all embedding fields should have explicit non-null values
3. Send a chat message that triggers retrieval → should succeed
4. Check LangSmith trace → `user_settings.embedding_model` should never be `""`
5. Test with an active LLM provider (OpenRouter) and no explicit embedding key → embedding should use OpenRouter base_url too
6. Test reranking enabled with bad Cohere key → should degrade gracefully (existing try/except in rerank_service)
