# TC-08: Settings Dashboard

## TC-08-01 — Settings page loads

**GIVEN** I am signed in
**WHEN** I click "Settings" in the sidebar navigation
**THEN**
- The Settings page loads without error
- Sections are visible: LLM Provider, Embedding, Reranking, Retrieval

---

## TC-08-02 — LLM provider info shown

**GIVEN** `LLM_API_KEY`, `LLM_MODEL`, and optionally `LLM_BASE_URL` are set in backend/.env
**WHEN** I view the Settings page
**THEN**
- The active model name is displayed (e.g., "gpt-4o" or "openai/gpt-4o")
- `has_api_key: true` is shown (key is never exposed, only its presence)
- Base URL is shown if set (e.g., for OpenRouter or local models)

---

## TC-08-03 — Embedding config shown

**GIVEN** `EMBEDDING_MODEL` and `EMBEDDING_DIMENSIONS` are set
**WHEN** I view the Settings page
**THEN**
- The embedding model name is displayed (e.g., "text-embedding-3-small")
- The dimension count is shown (e.g., 1536)

---

## TC-08-04 — Hybrid search status

**GIVEN** `HYBRID_SEARCH_ENABLED=true` in backend/.env
**WHEN** I view the Settings → Retrieval section
**THEN**
- Hybrid search shows as "Enabled"
- Vector weight, keyword weight, RRF k-value are displayed

---

## TC-08-05 — Reranking status

**GIVEN** `RERANK_ENABLED=false` in backend/.env
**WHEN** I view the Settings → Reranking section
**THEN**
- Reranking shows as "Disabled"
- No Cohere key is required or shown

---

## TC-08-06 — Settings are read-only

**GIVEN** I am on the Settings page
**WHEN** I look for input fields or edit buttons
**THEN**
- All values are display-only (no editable inputs)
- The page is an inspection dashboard, not a configuration panel
- This is by design: all config is via backend/.env
