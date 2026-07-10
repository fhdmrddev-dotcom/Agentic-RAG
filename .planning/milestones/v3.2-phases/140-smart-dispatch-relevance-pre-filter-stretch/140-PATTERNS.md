# Phase 140: Smart-Dispatch Relevance Pre-Filter (STRETCH) - Pattern Map

**Mapped:** 2026-07-07
**Files analyzed:** 6 code/schema + 5 test files
**Analogs found:** 6 / 6 (every new/modified file has an exact or role-match in-repo analog)

> This phase is a **recombination of proven substrates**, not a greenfield build. Every
> new file mirrors an existing one closely enough that plan tasks can cite exact
> signatures, table/column/RPC names, and analog line numbers below — no "match the
> existing pattern" hand-waving needed.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/agent_loop.py` (MODIFY) | service (hot-path orchestration) | request-response / transform | itself (lines 1197-1225) + `context_window.py` CTX-03 substrate | exact (in-file) |
| `backend/app/services/skill_embedding_service.py` (NEW) | service (background job + pure builders) | batch / transform | `backend/app/services/reembed_service.py` | exact (role + data flow) |
| `supabase/migrations/091_skill_embeddings.sql` (NEW) | migration (table + triggers + RPC + app_settings col) | CRUD / schema | `073` (RPC) + `002` (vector table) + `079` (content trigger) + `086` (app_settings col) | exact (4 composed analogs) |
| `backend/app/config.py` (MODIFY) | config | config-resolution | `context_window.resolve_context_budget` + `embedding_model`/`harness_judge_model` fields | exact |
| `backend/app/models/user_settings.py` (MODIFY) | model (settings loader) | config-resolution | `harness_judge_model` field @174 + readback @539 | exact |
| `supabase/full-schema.sql` (REGENERATE) | build artifact | — | (regen via `scripts/regenerate-full-schema.sh`, no `--reset`) | n/a — generated |

**Test files (all Wave 0 gaps unless noted):**

| Test File | Type | Analog to mirror |
|-----------|------|------------------|
| `backend/tests/test_140_catalog_trim.py` (NEW) | unit (pure fn) | any pure-fn unit test; drives `build_skill_catalog_block` directly (no DB/LLM) |
| `backend/tests/integration/test_140_escape_hatch.py` (NEW) | integration | proves existing `_handle_load_skill` (`tool_dispatcher.py:666`) loads a menu-absent skill |
| `backend/tests/integration/test_140_migration_091.py` (NEW) | DB-CHECK (psycopg2 → :54322) | mirror `tests/integration/test_111_1_reembed_*` DB-check style |
| `backend/tests/integration/test_140_skill_embedding_service.py` (NEW) | integration | mirror `tests/integration/test_111_1_reembed_{resume,rls}.py` |
| `backend/tests/test_agent_loop_catalog_override.py` (EXTEND) | integration | **exists** — add fits-budget byte-identical + over-budget-trim cases |

---

## Pattern Assignments

### `backend/app/services/agent_loop.py` (MODIFY — hot-path catalog injection)

**Analog:** itself. The pre-filter slots INTO the existing `skill_catalog_override is None`
branch ONLY (D-06). Do not touch the `else` (eval-tuple) branch.

**Current catalog-injection block to modify** (`agent_loop.py:1197-1225`, verbatim):
```python
# Inject enabled skills catalog (General Mode only) — SKIL-09
if body.agent_mode != "explorer":
    if skill_catalog_override is None:
        _skills_resp = await aexec(
            supabase.table("skills")
            .select("name, description")                                 # ← ADD "id": select "id, name, description"
            .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")   # ← the EXACT scope match_skills MUST reproduce (V4)
            .eq("is_enabled", True)
            .order("name")
        )
        enabled_skills = _skills_resp.data or []
    else:
        enabled_skills = list(skill_catalog_override)

    if enabled_skills:
        catalog_lines = "\n".join(
            f"- **{s['name']}**: {s['description']}" for s in enabled_skills
        )
        catalog_note = (
            f"\n\n## Available Skills\n"
            f"The following skills are available. {LOAD_SKILL_POLICY}\n{catalog_lines}"
        )
        active_system_prompt = active_system_prompt + catalog_note
```

**Load-bearing facts the planner must preserve:**
- **The scope predicate `.or_(f"user_id.eq.{current_user['id']},is_global.eq.true").eq("is_enabled", True)`** is the *exact* WHERE clause the new `match_skills` RPC must reproduce (Pitfall 3 / V4 cross-user leak). Never widen it.
- **The line format** `f"- **{s['name']}**: {s['description']}"` and header `f"\n\n## Available Skills\nThe following skills are available. {LOAD_SKILL_POLICY}\n{catalog_lines}"` are the **byte-identical fast-path target** (D-03). The pure trim fn must emit exactly this when the catalog fits.
- **`LOAD_SKILL_POLICY`** is imported from `skill_lint.py:57` (see Shared Patterns). Reuse the same constant — do not re-template.
- The catalog is injected at line 1225, **before** history is reconstructed into `messages` (line 1273) — so the pin-scan (Pattern 4) reads raw `history_resp.data`, not `messages`.

**History source for the pin-scan (D-02 always-keep)** — `history_resp` already fetched at `agent_loop.py:1166-1173`:
```python
_history_q = (
    supabase.table("messages")
    .select("role, content, tool_calls, reasoning_content")   # tool_calls carries load_skill calls
    .eq("thread_id", thread_id)
    .eq("user_id", current_user["id"])
)
_history_q = _apply_origin_filter(_history_q, body.agent_mode)
history_resp = await aexec(_history_q.order("created_at"))
```

**Pinned-skill provenance** (`agent_loop.py:915-917`, inside `_reconstruct_history`) — how a `load_skill` call is identified. The pin-scan helper mirrors this identification (tool_call `name == "load_skill"`, read `args.skill_name`):
```python
if tc.get("name") == "load_skill":
    skill_name = (tc.get("args") or {}).get("skill_name") or tc["tool_call_id"]
    tool_msg["_pinned_skill"] = skill_name
```

**Embedding hot-path call must be threadpool-wrapped** (D-05 / SEED-065). Verbatim analog from `retrieval_service.py:42-44`:
```python
query_embedding = (
    await run_in_threadpool(embed_texts, [query], user_settings=user_settings)
)[0]
```
Import: `from starlette.concurrency import run_in_threadpool` and `from app.services.openai_service import embed_texts`.

**RPC call shape** to model `match_skills` on (`retrieval_service.py:50-65`):
```python
current_model = (getattr(user_settings, "embedding_model", "") or "text-embedding-3-small")
params = {
    "query_embedding": query_embedding,
    "match_user_id": user_id,
    ...
    "p_embedding_model": current_model,   # D-10 stale-model guard, LAST param, NULL-defaulted
}
result = await aexec(supabase.rpc("match_document_chunks", params))
return result.data or []
```

---

### `backend/app/services/skill_embedding_service.py` (NEW — embed-source builder + backfill job)

**Analog:** `backend/app/services/reembed_service.py` (the full lifecycle — read its module docstring lines 1-31 for the batched / resumable / RLS-scoped / non-destructive / non-blocking contract to replicate).

**Job-shape excerpt to mirror** (`reembed_service.py:73-166`, key structural beats):
```python
async def reembed_job(supabase, user_id, app_settings, dims_changed, max_batches=None, batch_size=None) -> dict:
    limit = batch_size if batch_size is not None else BATCH   # BATCH = 64 (module const)
    current = _current_model(app_settings)                    # (getattr(app_settings,"embedding_model","") or DEFAULT_MODEL)
    ...
    while True:
        # RESUMABLE READ: re-select still-stale rows each pass, RLS-scoped by hand (service-role bypasses RLS, V4)
        batch = await run_in_threadpool(
            lambda: supabase.table("document_chunks")            # → skill_embeddings staleness for 140
              .select("id, content")
              .eq("user_id", user_id)                            # V4 hand-scope
              .or_(f'embedding_model.is.null,embedding_model.neq."{current}"')  # IS DISTINCT FROM current (D-10)
              .limit(limit).execute()
        )
        rows = batch.data or []
        if not rows: break
        # embed_texts wrapped in run_in_threadpool (SEED-065 — sync HTTP off the loop)
        vectors = await run_in_threadpool(embed_texts, [r["content"] for r in rows], user_settings=app_settings)
        # NON-DESTRUCTIVE WRITE: one update, scoped eq(id) AND eq(user_id)
        for row, vec in zip(rows, vectors):
            await run_in_threadpool(lambda row=row, vec=vec: supabase.table(...)
              .update({"embedding": vec, "embedding_model": current, "embedding_dimensions": dims})
              .eq("id", row["id"]).eq("user_id", user_id).execute())
    ...
    except Exception:   # noqa: BLE001 — a failed run must leave an HONEST, resumable state
        logger.warning("...failed...; marking partial", exc_info=True)
```

**Key deltas for the skill version of the job:**
- Reads `skills` (owner+global enabled) LEFT JOIN `skill_embeddings`, selecting skills whose vector row is **absent OR `source_text_hash` mismatched OR `embedding_model != current`** — "absence of a row == stale" (RESEARCH Pattern 2; degrades cleanly to D-05 fail-open until backfilled).
- Embed source is NOT the raw content — it is `build_skill_embed_source(skill, test_case_prompts)` (D-01: `description` + `skill_test_cases.prompt`, fall back to `name`). See the RESEARCH §Code Examples signature.
- **staleness fingerprint:** `source_text_hash = hashlib.sha256(text.encode()).hexdigest()` (non-crypto, staleness only — ASVS V6 confirms no crypto boundary).
- Constants to reuse verbatim: `BATCH: int = 64`, `DEFAULT_MODEL = "text-embedding-3-small"`, `_current_model(app_settings)` (`reembed_service.py:51,53,67-68`).

**Embed entrypoint signature** (`openai_service.py:1641-1652`) — call, don't re-implement:
```python
def embed_texts(texts: list[str], model: str | None = None, user_settings: UserEffectiveSettings | None = None) -> list[list[float]]:
    client = get_embedding_client(user_settings)   # resolves embedding_api_key/base_url, falls back to LLM creds
    effective_model = model or (user_settings.embedding_model if user_settings else None) or settings.embedding_model
    response = client.embeddings.create(model=effective_model, input=texts)
    return [item.embedding for item in response.data]
```

---

### `supabase/migrations/091_skill_embeddings.sql` (NEW — table + triggers + RPC + app_settings col)

**Migration number confirmed:** highest existing is `090_skill_proposals_description_kind.sql`; **`091` is the correct next number** (no letter suffixes — CLAUDE.md).

**Analog A — the `match_skills` cosine RPC → mirror `match_document_chunks`** (`073_embedding_provider_and_chunk_tags.sql:34-60`, verbatim reference):
```sql
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding public.vector,
  match_user_id uuid,
  ...
  p_embedding_model text DEFAULT NULL       -- LAST param, NULL-defaulted, additive
) RETURNS TABLE(id uuid, document_id uuid, content text, chunk_index integer, similarity double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
         1 - (dc.embedding <=> query_embedding) AS similarity   -- <=> = cosine; L2-normalized vectors
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.user_id = match_user_id          -- RLS scope (V4 — keep)
    ...
    AND (p_embedding_model IS NULL OR dc.embedding_model = p_embedding_model)  -- D-10 stale-model filter
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```
> **`match_skills` differences (RESEARCH Pattern 1):** `LEFT JOIN skill_embeddings` (so a skill with no vector returns `similarity = NULL` → fail-open kept last), scope `WHERE (s.user_id = match_user_id OR s.is_global = true) AND s.is_enabled = true` (the **exact** clone of `agent_loop.py:1207-1208`), `ORDER BY similarity DESC NULLS LAST, s.name`. No `match_count`/`match_threshold` — the trim happens in Python, the RPC just ranks.

**Analog B — the `skill_embeddings` sibling table → mirror `document_chunks`** (`002_module2_byo_retrieval.sql:24-37`):
```sql
CREATE TABLE public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  ...
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX document_chunks_embedding_idx ON public.document_chunks
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
```
> **`skill_embeddings` differences (RESEARCH Pattern 2):** PK is `skill_id uuid REFERENCES public.skills(id) ON DELETE CASCADE` (one vector per skill), add `user_id`, `embedding vector(1536)`, `embedding_model text`, `embedding_dimensions integer`, `source_text_hash text NOT NULL`, `updated_at timestamptz`. **NO HNSW/IVF index** — skills are tens–hundreds of rows; seq scan over the LEFT JOIN is sub-ms (that's why `document_chunks` needs HNSW and `skill_embeddings` does not). RLS: `ENABLE ROW LEVEL SECURITY` + owner-only `SELECT USING (auth.uid() = user_id)`; writes are service-role (bypass RLS, hand-scoped by the job).

**Analog C — mark-stale content trigger → mirror `capture_skill_version`** (`079_skill_versions_and_test_cases.sql:101-144`). This is the **safe-by-construction, kind-blind** pattern (Phase 139 CR-01 lesson — a DB trigger fires on ALL write paths uniformly; do NOT hook app code per write path):
```sql
CREATE OR REPLACE FUNCTION public.capture_skill_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp   -- definer-function hardening (T-132-05)
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT (
         NEW.name         IS DISTINCT FROM OLD.name
      OR NEW.description  IS DISTINCT FROM OLD.description
      OR NEW.instructions IS DISTINCT FROM OLD.instructions   -- ← content-trifecta gate
    ) THEN
      RETURN NEW;  -- toggle-only (is_enabled/is_global) → no version
    END IF;
  END IF;
  ...
END; $$;
DROP TRIGGER IF EXISTS skills_capture_version ON public.skills;
CREATE TRIGGER skills_capture_version
  AFTER INSERT OR UPDATE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.capture_skill_version();
```
> **`stale_skill_embedding` differences (RESEARCH Pattern 2):** gate on `name`/`description` changing (NOT `instructions` — instructions aren't in the embed source), body `DELETE FROM public.skill_embeddings WHERE skill_id = NEW.id`. Add a SECOND trigger `stale_skill_embedding_from_case` on `skill_test_cases` (`AFTER INSERT OR UPDATE OR DELETE`, uses `COALESCE(NEW.skill_id, OLD.skill_id)`) because `should_fire` prompts are part of the D-01 embed source. `skill_test_cases` table shape is in `079:76-87` (`skill_id`, `prompt`, `expected_behavior`).

**Analog D — the `app_settings` budget column → mirror `harness_judge_model`** (`086_app_settings_harness_judge_model.sql:13-14`):
```sql
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS harness_judge_model text NOT NULL DEFAULT '';
```
> **140 differences:** `ADD COLUMN IF NOT EXISTS skill_catalog_max_tokens integer NOT NULL DEFAULT 1500;  -- 0 = disable (inject-all kill switch, D-04)`. Also note the 073 header discipline: apply via SQL editor (never `db push`/`db reset`), then regen `full-schema.sql` (no `--reset`), commit BOTH.

> **No SQL backfill INSERT** — SQL cannot call the embedding API, so unlike `079:215-217` (`INSERT … SELECT` v1 backfill), migration 091 creates the table **empty**; the `skill_embedding_service` job populates it. Absence of a row == D-05 fail-open until the job runs.

---

### `backend/app/config.py` (MODIFY — budget field + resolver)

**Analog:** `context_window.resolve_context_budget` (`context_window.py:79-99`) for the resolver shape, and the `embedding_model` field (`config.py:811`) / `harness_judge_model` field for the field declaration.

**Resolver analog** (`context_window.py:79-99`):
```python
def resolve_context_budget(active_provider: str, model: str = "") -> int:
    """Return context budget for main agent based on active model and provider."""
    if settings.context_window_max_tokens > 0:
        return settings.context_window_max_tokens
    ...
    return PROVIDER_CONTEXT_DEFAULTS.get(active_provider, 100_000)
```
> **`resolve_skill_catalog_budget(app_settings) -> int` (RESEARCH §Code Examples):** reads `getattr(app_settings, "skill_catalog_max_tokens", 1500)`; `0` => disabled (inject-all). Default `1500` (A1 — admin-tunable, not load-bearing). No magic number in the hot path (D-04 / CTX-03 discipline).

**Field-declaration analog** (`config.py:811-815`):
```python
embedding_model: str = "text-embedding-3-small"
embedding_dimensions: int = 1536
```
Add `skill_catalog_max_tokens: int = 1500` alongside (or on `Settings` as appropriate — mirror how `harness_judge_model` is declared).

---

### `backend/app/models/user_settings.py` (MODIFY — field + loader readback)

**Analog:** `harness_judge_model` — field declaration @174, loader readback @539. This is the **`env_attr=None` app_settings-only knob** pattern (DB-only, no env fallback — a value, not a secret).

**Field declaration analog** (`user_settings.py:171-174`):
```python
# app_settings-only (env_attr=None readback below; a model id is a VALUE, not a secret). ...
harness_judge_model: str = ""
```
Add: `skill_catalog_max_tokens: int = 1500   # app_settings-only; 0 = inject-all kill switch (D-04)`

**Loader readback analog** (`user_settings.py:539`) inside `_build_effective_settings`:
```python
harness_judge_model=str(_val(row, "harness_judge_model", None, "")),
```
Add: `skill_catalog_max_tokens=int(_val(row, "skill_catalog_max_tokens", None, 1500)),`

**`_val` helper contract** (`user_settings.py:334-346`): `_val(row, key, env_attr=None, default)` returns the DB value if non-None; with `env_attr=None` there is **no env fallback** — DB-or-default only (exactly the app_settings-only semantics D-04 wants).

---

### The pure trim function (lands in `agent_loop.py` or a co-located helper)

**Analog:** `context_window.py` CTX-03 vocabulary. Clone the `_TRIM_MARKER` (line 65) and `PIN_BUDGET_FRACTION` (line 76) idioms so both budget surfaces read as one system.

**`_TRIM_MARKER` analog** (`context_window.py:65-68`) — the honest-never-silent marker to clone as `_CATALOG_TRIM_MARKER`:
```python
_TRIM_MARKER = (
    "[Earlier conversation history was trimmed to fit context window. "
    "Some prior context may be missing.]"
)
```
> `_CATALOG_TRIM_MARKER_TMPL` (RESEARCH Pattern 3): `"\n- _[{n} additional skill(s) exist that weren't listed here to fit the catalog budget. Ask me to list all skills, or name one directly and I'll load it.]_"` — the escape hatch is REAL (`load_skill` works by name).

**`PIN_BUDGET_FRACTION` analog** (`context_window.py:70-76`) — the pin-cap that prevents pins from starving the menu:
```python
# ... capped at this fraction of max_tokens so pinning can never starve the recent-message
# budget ... Over budget → evict the least-recently-loaded pinned skill + insert the honest _TRIM_MARKER (never silent — D-14).
PIN_BUDGET_FRACTION = 1.0 / 3
```

**Token counting** — call `estimate_tokens` (`context_window.py:102-125`), don't hand-roll:
```python
def estimate_tokens(text: str | None, model: str = "") -> int:
    if not text: return 0
    if model and get_model_capability(model).get("provider") == "openai":
        enc = _get_cl100k()
        if enc is not None: return max(1, len(enc.encode(text)))
    return max(1, len(text) // 4)   # chars/4 heuristic for non-OpenAI
```
The `build_skill_catalog_block(enabled, budget, model, pinned_recent_ids, sim_by_id) -> str` signature and full algorithm are in RESEARCH §Pattern 3 — keep it a **pure function** so SC#1/SC#2/SC#3/fail-open unit tests drive it with no DB or LLM.

---

## Shared Patterns

### `LOAD_SKILL_POLICY` (the catalog-note policy string — ONE source of truth)
**Source:** `backend/app/services/skill_lint.py:57-60`
**Apply to:** the trim fn's header (must reuse, not re-template — `agent_loop.py` and the Tuner classifier already both import this constant so both surfaces tell one story).
```python
LOAD_SKILL_POLICY: str = (
    "Call `load_skill(skill_name)` when the user's request clearly matches one of "
    "these skill descriptions. Match on intent, not just exact names. Do not load a "
    "skill for an unrelated request."
)
```
Import in `agent_loop.py` already exists (`from ... skill_lint import LOAD_SKILL_POLICY`).

### Threadpool-wrap every sync embed / supabase-py call on the hot path (D-05 / SEED-065 / D-v2.5-01)
**Source:** `retrieval_service.py:42-44` (query embed) + `reembed_service.py` (whole job)
**Apply to:** the over-budget embed call in `agent_loop.py` AND every DB call in `skill_embedding_service.py`.
```python
from starlette.concurrency import run_in_threadpool
q_vec = (await run_in_threadpool(embed_texts, [query], user_settings=user_settings))[0]
```
Never call `embed_texts` or `supabase-py` directly on the event loop — SEED-065 froze all serving.

### V4 hand-scope under service-role (RLS bypass)
**Source:** `reembed_service.py:19` + `079` RLS comment + `embedding_service.read_enabled_field_defs` (`embedding_service.py:270-296`)
**Apply to:** the `match_skills` RPC body AND every read/write in the backfill job.
- Background jobs / service-role clients bypass RLS → the app/RPC body is the ONLY scope gate.
- `match_skills` WHERE clause must be the byte-exact clone of `agent_loop.py:1207-1208`: `(s.user_id = match_user_id OR s.is_global = true) AND s.is_enabled = true`.
- Every job DB call carries `.eq("user_id", user_id)` (on reads AND writes).
- RLS on `skill_embeddings` (owner-only SELECT) is defense-in-depth, not the primary gate.

### D-10 cross-vector-space guard (stale-model filter)
**Source:** `retrieval_service.py:45-58` + `073:56`
**Apply to:** `match_skills` (`p_embedding_model` filter → NULL similarity for stale/absent → fail-open keep) and the job's staleness predicate. Default model when unset: `"text-embedding-3-small"` (`retrieval_service.py:50`).

### Fail-open honesty (D-05)
**Source:** `reembed_service.py:168-176` (`except Exception: ... marking partial`)
**Apply to:** the over-budget branch in `agent_loop.py` — an embed/RPC failure logs `warning(..., exc_info=True)` and sets `sim_by_id = None`, so `build_skill_catalog_block` trims by name only (inject-all-up-to-budget). Never crash, never empty the catalog.

### Migration discipline (CLAUDE.md — every schema change)
**Source:** `073` / `079` / `086` file headers
**Apply to:** migration 091 — apply via Supabase SQL editor (NEVER `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no `--reset`), commit BOTH the migration and regenerated `full-schema.sql`. The `skill_catalog_max_tokens` default ships in the column default (`1500`) + the config.py/user_settings.py field default; a non-default cloud value is a hand-applied deploy-parity artifact (the mig 078 / `harness_judge_model` precedent).

---

## No Analog Found

None. Every new/modified file has a concrete in-repo analog with cited line numbers.

The only "genuinely new surface" (per RESEARCH) is small and each piece maps to a composed analog:
- `skill_embeddings` table → `document_chunks` (002)
- `match_skills` RPC → `match_document_chunks` (073)
- `stale_skill_embedding*` triggers → `capture_skill_version` (079)
- `skill_catalog_max_tokens` col → `harness_judge_model` col (086)
- `resolve_skill_catalog_budget` → `resolve_context_budget` (context_window.py)
- `build_skill_catalog_block` pure fn → `_TRIM_MARKER`/`PIN_BUDGET_FRACTION` vocabulary (context_window.py)
- backfill job → `reembed_job` (reembed_service.py)

## Metadata

**Analog search scope:** `backend/app/services/` (agent_loop, context_window, embedding_service, reembed_service, retrieval_service, openai_service, tool_dispatcher, skill_lint), `backend/app/config.py`, `backend/app/models/user_settings.py`, `supabase/migrations/{002,017,073,079,086,090}.sql`
**Files scanned:** 15
**Migration number verified:** next = `091` (highest existing = `090`)
**Pattern extraction date:** 2026-07-07

## PATTERN MAPPING COMPLETE
