# Phase 46: Smart Skill Dispatch - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current skill catalog injection (which blasts ALL enabled skills into every system prompt) with relevance-based filtering. Only skills whose descriptions match the user's current message appear in the agent's context. Non-relevant skills are never triggered. This is purely a backend change — no frontend modifications required.

Requirements: SKILL-01 (relevance-based filtering), SKILL-02 (non-relevant skills never triggered).

</domain>

<decisions>
## Implementation Decisions

### Relevance Matching Approach (SKILL-01)
- **D-01:** Use embedding similarity to determine which skills match the user's message. Reuse the existing `text-embedding-3-small` model and `embedding_service` infrastructure — same model and dimension (1536) as document embeddings.
- **D-02:** Embed each skill's `name + ": " + description` as the matching text. For example, skill "PPTX Generator" with description "Generate PowerPoint presentations from data" embeds as "PPTX Generator: Generate PowerPoint presentations from data".
- **D-03:** Use cosine similarity with a threshold of 0.5. Skills scoring >= 0.5 against the embedded user message are considered relevant. This is stricter than the RAG document threshold (0.4) — skills should be clearly relevant, not loosely related.
- **D-04:** Cap matched skills at 5 per message. If more than 5 skills score above the threshold, take the top 5 by similarity score.
- **D-05:** Explicit name bypass — if the user's message explicitly contains a skill's name (case-insensitive substring match), include that skill regardless of similarity score. This guarantees intentional skill activation always works.

### Tool Definition Filtering (SKILL-02)
- **D-06:** Skill tools are conditional based on whether matching skills exist:
  - **When skills match (1+ relevant skills):** Include `load_skill`, `read_skill_file`, and the filtered skill catalog in system prompt. `save_skill` is also included.
  - **When no skills match (0 relevant, 0 explicit mentions):** Do NOT include `load_skill` or `read_skill_file`. No skill catalog in system prompt. Only `save_skill` remains available (users can create new skills anytime).
  - Rationale: If there's no skill catalog to reference, `load_skill` has nothing to load. Including it would invite hallucinated skill names. `save_skill` is for creating skills — always useful.
- **D-07:** In Explorer Mode, no change — skills are already excluded from Explorer mode entirely.

### Catalog Format & Prompt Design
- **D-08:** Keep the same system prompt format for the skill catalog (`- **SkillName**: description`), but only include matching entries. The existing prompt text "The following skills are enabled..." changes to "The following skills are available" to reflect filtering.
- **D-09:** Same injection point in `backend/app/api/threads.py` (lines 472-493). Replace the `fetch all enabled skills` query with a `fetch relevant skills via embedding match` query. The rest of the system prompt injection flow (folder scope, memory, etc.) stays unchanged.

### Embedding Storage
- **D-10:** Add an `embedding` column of type `vector(1536)` to the existing `public.skills` table via a database migration. This reuses the same pgvector dimension as `document_chunks.embedding`.
- **D-11:** Store skill embeddings directly in the skills table (not a separate table). A `NULL` embedding means the skill hasn't been embedded yet — backfill will be needed.
- **D-12:** Create a cosine similarity index on the skills embedding column for efficient matching: `CREATE INDEX skills_embedding_idx ON public.skills USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);` (or hnsw — planner decides).
- **D-13:** Compute skill embeddings on create, update (when name/description changes), and delete. Embed in the same API call that saves the skill row — not a background task.

### Edge Cases & Fallback
- **D-14:** When no skills match the user's message (similarity < 0.5 for all skills, no explicit name mentions): no catalog injection, no `load_skill`/`read_skill_file` tools. Only `save_skill` remains available.
- **D-15:** If the embedding service fails or times out, fall back to the current behavior (include all enabled skills in the system prompt). This degrades gracefully — over-triggering protection is lost but skills remain functional.
- **D-16:** The similarity match runs on the user's latest message only (not the full conversation history). Each API call rebuilds the system prompt and re-matches skills per message.

### Frontend
- **D-17:** No frontend changes. The existing `skill_activated` SSE event already fires when `load_skill` is called. Skill matching is entirely backend logic.

### Claude's Discretion
- Exact pgvector index type (IVFFlat vs HNSW) — planner/researcher decides based on skill count expectations
- Whether to batch-embed existing skills in a migration script or on-demand — planner decides backfill strategy
- Exact embedding call placement in the skill CRUD endpoints — reuses embed_chunks from embedding_service
- Whether `read_skill_file` should also be available without matching skills (currently tied to `load_skill` in D-06)
- Similarity threshold fine-tuning — 0.5 is the starting default, may need adjustment in testing

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §SKILL — SKILL-01 and SKILL-02: full acceptance criteria for this phase

### Backend — Skill Dispatch
- `backend/app/api/threads.py` lines 472-493 — current skill catalog injection (the code this phase replaces)
- `backend/app/api/threads.py` lines 446-460 — system prompt selection and tool assignment by agent mode
- `backend/app/api/threads.py` lines 846-883 — `load_skill` tool handler (resolves skill by name, emits `skill_activated` SSE)
- `backend/app/services/openai_service.py` lines 498-512 — `get_tools()` and `get_explorer_tools()` function definitions
- `backend/app/services/embedding_service.py` — existing embedding infrastructure (reuse for skill matching)
- `backend/app/api/skills.py` — skill CRUD endpoints where embedding compute hooks go
- `backend/app/models/skill.py` — SkillCreate, SkillUpdate, SkillResponse models (add embedding field)

### Backend — Config
- `backend/app/config.py` — Settings class, embedding_model config (text-embedding-3-small), potential new `skill_similarity_threshold` setting

### Database
- `supabase/migrations/017_skills.sql` — original skills table schema (where we add the embedding column)
- `supabase/migrations/000_full_schema.sql` — full schema reference (vector(1536) dimension convention)

### Frontend (reference only — no changes needed)
- `frontend/src/hooks/useSkills.ts` — skill CRUD hook (no changes expected)
- `frontend/src/hooks/useMessages.ts` line 165 — `skill_activated` SSE event handler (no changes expected)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/services/embedding_service.py` — `embed_chunks()` function for batch embedding. Reuse for skill embedding computation.
- `document_chunks.embedding vector(1536)` — existing pgvector column. Same dimension and cosine similarity patterns used for RAG retrieval.
- `match_document_chunks()` RPC — existing vector search function. Pattern to follow for skill similarity search.
- `backend/app/config.py` `embedding_model: str = "text-embedding-3-small"` — same model for skill embeddings.
- Supabase pgvector extension — already enabled and working for document_embeddings.

### Established Patterns
- Skill catalog injection appends to `active_system_prompt` string — same pattern for filtered catalog.
- System prompt assembly in `threads.py` is sequential: base prompt → folder scope → skills → memory. Filtered skills slot into existing injection point.
- All skill queries use Supabase client with `.or_()` for user-owned + global scope. Embedding queries will layer on the same pattern.
- Skills are excluded from Explorer mode (`agent_mode != "explorer"` guard). No change needed.

### Integration Points
- `backend/app/api/threads.py` line 472-493 — replace with embedding-match query + filtered catalog
- `backend/app/api/skills.py` create/update endpoints — add embedding computation after DB write
- `backend/app/services/openai_service.py` `get_tools()` — conditionally include/exclude `load_skill` and `read_skill_file` based on match results; always include `save_skill`
- `supabase/migrations/` — new migration for `skills.embedding vector(1536)` column + index
- `backend/app/config.py` — optional: `skill_similarity_threshold: float = 0.5`, `skill_match_limit: int = 5`

</code_context>

<specifics>
## Specific Ideas

- "Skill dispatch is essentially RAG for skills — embed the user's message, match against skill descriptions, return only relevant ones" (research insight from how Claude/OpenAI tool use works)
- When matching, embed "SkillName: Skill description" not just the description — this ensures name-based matching works even when description is short
- Skills are General Mode only — the existing `agent_mode != "explorer"` guard stays
- Token savings scale with the number of enabled skills — a user with 20 skills currently wastes ~20 skill descriptions per message; after filtering this drops to 0-5
- The similarity threshold should be moderate (0.5) — skills should be clearly relevant, not loosely related, because every matching skill costs context tokens and increases over-triggering risk

</specifics>

<deferred>
## Deferred Ideas

- Frontend indicator showing which skills were matched — nice-to-have but not required for SKILL-01/SKILL-02 (existing skill_activated SSE event is sufficient)
- Skill categories/tags for faster pre-filtering before embedding — over-engineering for current scale
- LLM-based pre-classification for skill matching — adds latency and cost; embedding similarity is sufficient
- Configurable skill match limit UI — config-only is fine for v2.4
- Re-embedding all skills on embedding model change — deferred; current model (text-embedding-3-small) is stable

</deferred>

---

*Phase: 46-smart-skill-dispatch*
*Context gathered: 2026-04-23*