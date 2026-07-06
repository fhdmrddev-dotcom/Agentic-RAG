# Phase 140: Smart-Dispatch Relevance Pre-Filter (STRETCH) - Research

**Researched:** 2026-07-07
**Domain:** Backend system-prompt shaping — pgvector semantic pre-filter + settings-resolved token budget over the `## Available Skills` catalog block
**Confidence:** HIGH (every mechanism this phase needs already exists and is verified in-repo; the phase is a recombination of proven substrates, not new infra)

## Summary

This phase adds a relevance pre-filter and a settings-resolved token budget to the `## Available Skills`
catalog block injected at `agent_loop.py:1197-1225`. The good news, confirmed by reading the actual code:
**every primitive this phase needs already exists and is battle-tested in the repo.** The embedding call
path (`embed_texts` → `get_embedding_client`, `text-embedding-3-small`/1536-dim, L2-normalized), the
pgvector cosine RPC pattern (`match_document_chunks` with `<=>`), the re-embed lifecycle
(`reembed_service.py` — batched/resumable/RLS-scoped/non-destructive), the honest-truncation + budget
vocabulary (`context_window.py` `_TRIM_MARKER` / `resolve_context_budget` / `PIN_BUDGET_FRACTION`), the
tiktoken token estimator (`estimate_tokens`), the global `app_settings` knob pattern (`harness_judge_model`
precedent), and the pinned-skill substrate (`_pinned_skill` tags from `load_skill` calls) are all present.
The phase is a **recombination** of these, not a greenfield build.

Two findings sharpen the plan. First, **D-02's escape hatch is already satisfied**: `_handle_load_skill`
(`tool_dispatcher.py:666-683`) queries `skills` by exact `name` + `is_enabled` completely independent of the
injected catalog — so a model that names a trimmed skill already loads it. That half of SC#3 needs a
*verification test*, not new code. Second, the **fast path must not embed at all**: when the full catalog
fits budget (D-03), inject byte-identical to today with zero embedding call — so the common case (small
catalogs, D-04 "safe by construction") pays nothing and is trivially D-05 fail-open. Relevance ranking is
the *rare, over-budget* branch only.

**Primary recommendation:** Store skill vectors in a **new sibling table `skill_embeddings`** (mirrors
`documents`→`document_chunks`), keep them fresh with **DB triggers that mark-stale-by-deletion on skill
content or test-case change** (zero-app-code, all-write-paths-safe — the Phase 139 CR-01 lesson), re-embed
via a **`reembed_service`-shaped background job** (never on the hot path), and do the cosine ranking in
**Postgres via a `match_skills` RPC** modeled byte-for-byte on `match_document_chunks` (no new numerical
dependency, called only when over budget). The trim algorithm and honest marker are a **direct reuse of the
`context_window.py` CTX-03 vocabulary** so the two budget surfaces feel like one system.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Relevance mechanism: semantic (embedding) match**
- Compare the user's current turn against each skill using **embeddings** (reuse
  `embedding_service.py` / `embed_texts`). Cheap + fast per turn, scales to hundreds of skills, catches
  paraphrases.
- Rejected — keyword/lexical (misses paraphrases).
- Rejected — per-turn LLM classifier (`classify_fires`): adds seconds + $ to EVERY hot-path turn, behaves
  per-provider; stays the Trigger Tuner's **offline** concern only.
- **Skill embedding source text:** the skill `description` + its owner-authored `should_fire` test-case
  prompts (from `skill_test_cases`, migration 079) when present; fall back to `description` (+ `name`) when
  a skill has no test cases. Exact fields/weighting = planner/researcher detail; the signal set is locked.
- **Query embedding source text:** the user's latest turn is the primary signal (planner may add a small
  preceding-context window for follow-ups — sensible default, not a hard requirement).

**D-02 — Never-starve safety net (SC#3): honest marker + name-load escape hatch**
- When skills are trimmed to fit budget, append an **honest truncation marker** ("N additional skills exist
  that weren't listed — ask me to list all skills or name one to load"), mirroring Phase 123 CTX-03's
  never-silent `_TRIM_MARKER` (decision D-14).
- `load_skill` must remain able to load **any enabled skill by exact name** even if it was NOT in the
  filtered menu (escape hatch).
- **Always-kept in the menu:** recently-loaded / pinned skills (the CTX-03 pin substrate) stay listed
  regardless of relevance rank, so an in-use skill never vanishes mid-thread.

**D-03 — Small-catalog bypass: budget is the ONLY gate**
- If the user's FULL catalog fits the token budget, inject everything exactly like today (**byte-identical**,
  zero starvation risk). Relevance ranking/trimming only activates when the catalog **exceeds** the budget.
- **No separate skill-count cutoff.**
- **SC#1 interpretation (locked):** "clearly-irrelevant skills are not injected" is satisfied by the trim
  path — when over budget, the skills that get **cut first are the least-relevant** ones. There is **no
  always-on minimum-relevance floor**. Verification must test SC#1 with an **over-budget** catalog, not a
  small one.

**D-04 — Config & rollout: global app setting, default ON, with an off switch**
- The token budget is a **global `app_settings` value** (admin-tunable), with a sane default. Budget `0` /
  a disable flag = today's inject-all behavior (built-in kill switch).
- **Default ON** is safe by construction (D-03's bypass leaves small catalogs untouched).
- **Per-user budget override is deferred** — start global.
- **Default budget value:** planner picks a sane default; CTX-03 language (a fraction of `max_tokens`, or a
  modest absolute for the catalog block) is the reference. Resolve via settings like `context_window.py`
  does — **no hardcoded magic number in the hot path.**

**D-05 — Fail-open principle (locked, not a user choice)**
- If the embedding call fails or is slow, the filter **fails open to today's behavior** (inject all up to
  budget) rather than blocking the turn or starving skills. The pre-filter must never break the chat path.

**D-06 — Preserve the eval-override seam (locked)**
- The `skill_catalog_override` parameter (Phase 133 EVAL-02) MUST stay intact: `None` = the live DB path
  (now with the pre-filter), a tuple = the eval arms drive exactly those skills. The pre-filter slots INTO
  the `None` branch only.

### Claude's Discretion
- Exact embedding field weighting (description vs test-case prompts), the preceding-turn context window for
  the query embedding, the default budget number, where the honest marker text is templated, and whether
  skill vectors live in a new column on `skills` vs a sibling table — all planner/researcher calls within
  the locked decisions above.

### Deferred Ideas (OUT OF SCOPE)
- **Per-user budget override** — start global (`app_settings`); per-user knob later via the standard
  app→user override pattern. (D-04.)
- **Always-on minimum-relevance floor** — explicitly rejected for this phase (D-03).
- **SEED-093 — Trigger Tuner scoring-honesty residuals (WR-04/05/06)** — NOT folded here; route to a
  dedicated tuner-polish phase. They are Trigger Tuner *offline scoring/UI* concerns, a different surface.
- **Preceding-turn context window for the query embedding** — default to latest-turn-only, revisit if
  recall suffers.

### Hard scope fences (out of scope)
- NO growth of `backend/app/api/threads.py` (G-5 hot file). The catalog-injection path lives in
  `agent_loop.py` + `context_window.py`.
- NO new eval runtime; only honor the existing eval override seam.
- NO Trigger Tuner UI/scoring changes.
- NO per-skill "trigger" schema field, NO skills-tab redesign.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRIG-02 | Only plausibly-relevant skills are surfaced to the model for a given query, keeping the active catalog within a configurable token budget; a should-trigger skill is never starved, verified cross-provider (SC#10). | SC#1 → the budget-trim algorithm (§Architecture Pattern 3): over-budget → cut least-relevant first via the `match_skills` cosine RPC. SC#2 → settings-resolved budget (`resolve_skill_catalog_budget`, mirrors `resolve_context_budget`) + `estimate_tokens` accounting. SC#3 → honest `_CATALOG_TRIM_MARKER` (mirrors `_TRIM_MARKER`) + always-keep pinned/recent (from `_pinned_skill` history scan) + the already-present `load_skill`-by-name escape hatch (`tool_dispatcher.py:666-683`). Cross-provider proof → §Validation Architecture 4-axis UAT. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Query-turn embedding (per turn) | API / Backend (`agent_loop.py` hot path) | Embedding provider (OpenAI-compat via `embed_texts`) | The pre-filter shapes the system prompt *before* chat-provider dispatch; the query embed is a backend service call, provider-agnostic w.r.t. the chat model. |
| Skill-vector storage + staleness | Database / Storage (`skill_embeddings` table + triggers) | — | Vectors and their freshness are persistence concerns; DB triggers mark-stale uniformly across all write paths (safe-by-construction). |
| Skill-vector re-embedding | API / Backend (background job, `reembed_service`-shaped) | Embedding provider | A batched, resumable, non-blocking job — never the request thread. |
| Cosine ranking | Database / Storage (`match_skills` pgvector RPC) | — | Keep vector math in pgvector (`<=>`); no numerical dependency in Python; owner+global scoping baked into a SECURITY DEFINER function. |
| Budget resolution | API / Backend (`resolve_skill_catalog_budget`, reads `app_settings`) | Database (`app_settings.skill_catalog_max_tokens`) | Settings-resolved, never a hot-path magic number (CTX-03 discipline). |
| Trim / honest-marker assembly | API / Backend (pure function in `agent_loop.py`) | — | Deterministic string shaping; unit-testable in isolation. |
| Escape hatch (name-load any enabled skill) | API / Backend (`_handle_load_skill`, already present) | Database (`skills` by name+is_enabled) | Already independent of the catalog — no change, only verification. |

## Standard Stack

### Core (all already in-repo — this phase adds NO new packages)
| Library / Asset | Version | Purpose | Why Standard |
|-----------------|---------|---------|--------------|
| `embed_texts` / `get_embedding_client` (`openai_service.py:1641`, `:1166`) | in-repo | Query + skill embedding via the configured provider | `[VERIFIED: codebase]` The single embed entrypoint; resolves `embedding_model` from settings, honors a dedicated embedding key/base_url. |
| `text-embedding-3-small` (default `embedding_model`, `config.py:811`) | 1536 dims | Embedding model | `[VERIFIED: codebase config.py:811-815]` + `[CITED: developers.openai.com/api/docs/models/text-embedding-3-small]` — L2-normalized to length 1, so cosine == dot product; identical rankings under `<=>`. |
| pgvector `vector(1536)` + `<=>` cosine operator | Postgres ext | Cosine distance in the DB | `[VERIFIED: codebase migration 002/073]` `match_document_chunks` uses `1 - (embedding <=> q)` — the exact pattern to mirror for `match_skills`. |
| `tiktoken` (`context_window.py:16`, `estimate_tokens`) | cl100k_base | Token counting for the budget check | `[VERIFIED: codebase]` OpenAI models → cl100k; other providers → chars/4 heuristic. Already warmed at module load. |
| `reembed_service.py` shape | in-repo | Batched, resumable, RLS-scoped, non-destructive re-embed | `[VERIFIED: codebase]` The template for `skill_embeddings` backfill/refresh. |
| `app_settings` global-knob pattern (`harness_judge_model`, mig 086) | in-repo | The budget setting home | `[VERIFIED: codebase]` env_attr=None readback; config.py field + user_settings loader + migration column. |

### Supporting
| Asset | Purpose | When to Use |
|-------|---------|-------------|
| `_TRIM_MARKER` / `PIN_BUDGET_FRACTION` / `resolve_context_budget` (`context_window.py:65,76,79`) | Honest-truncation + budget-fraction vocabulary | Clone the vocabulary for `_CATALOG_TRIM_MARKER` + `resolve_skill_catalog_budget` + the pinned-cap so both budget surfaces read as one system. |
| `_pinned_skill` tags (`agent_loop.py:915-917`) | Which skills were `load_skill`-ed in this thread | Derive "recently-loaded/pinned always kept" (D-02) by scanning `history_resp.data` for `load_skill` tool calls. |
| `run_in_threadpool` (starlette) | Keep the sync `embed_texts` HTTP call off the event loop | `[VERIFIED: codebase]` mandatory — `retrieval_service.py:42-44` + `reembed_service` both wrap `embed_texts`; running it on the loop froze serving (SEED-065 / D-v2.5-01). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sibling table `skill_embeddings` | A `description_embedding vector(1536)` column on `skills` | Column is simpler (no join) but couples the vector to every hot `skills` read and pins the dims at column-creation. Sibling table mirrors `documents`→`document_chunks`, keeps the frequently-read `skills` row lean, and isolates the vector lifecycle. **Recommend the sibling table.** |
| `match_skills` pgvector RPC | Python cosine (numpy) over fetched vectors | numpy is importable (v2.2.4) but **NOT a declared backend dependency** — relying on a transitive import is fragile. The RPC needs no numerical dep, mirrors `match_document_chunks`, and keeps vector math in the DB. Python cosine would require adding numpy as an explicit dep. **Recommend the RPC.** |
| DB triggers mark-stale-by-deletion | App-code re-embed hook on every skill write path | Hooking each write path (save_skill tool, skills CRUD API, import, tuner, self-improve) is exactly the Phase 139 CR-01 "kind-blind" trap — a missed sibling route ships a stale vector. A trigger fires uniformly on ALL paths (mirrors `capture_skill_version`). **Recommend triggers.** |

**Installation:** No new packages. `pip install` is a no-op for this phase.

**Version verification:**
```bash
# Confirmed in-session:
python -c "import numpy; print(numpy.__version__)"   # 2.2.4 — present but NOT a declared dep (do not rely on)
# text-embedding-3-small = 1536 dims, L2-normalized — codebase config.py:811-815 + OpenAI docs
```

## Package Legitimacy Audit

> This phase installs **no external packages**. It reuses `embed_texts`, `tiktoken`, pgvector, and
> `run_in_threadpool` — all already present and proven in the repo. No slopcheck / registry verification
> is required.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| *(none)* | — | — | — | — | — | No new packages installed by this phase |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**Note:** If the planner chooses the Python-cosine alternative over the recommended pgvector RPC, `numpy`
must be **added as an explicit backend dependency** (it is currently only transitively importable) and would
then require the audit. The recommended RPC path avoids this entirely.

## Architecture Patterns

### System Architecture Diagram

```
                 user turn (body.content)
                          │
                          ▼
   agent_loop.py:1197  ── General mode? ──no──► (explorer: no catalog, unchanged)
                          │ yes
                          ▼
              skill_catalog_override is None ?
                 │                          │
             no  │ (eval tuple)             │ yes  (LIVE path — pre-filter lives HERE only, D-06)
                 ▼                          ▼
        inject exactly those        ① fetch enabled owner+global skills
        (byte-identical, D-06)          .or_(user_id.eq,is_global.eq.true).eq(is_enabled).order(name)
                                         [id, name, description]     ← same query as today
                                            │
                                            ▼
                                     ② resolve_skill_catalog_budget(app_settings)
                                        (skill_catalog_max_tokens; 0/disable = inject-all)
                                            │
                              ┌─────────────┴───────────────┐
                     full block fits budget?          over budget
                     (estimate_tokens ≤ B)                 │
                              │ YES                          ▼
                              ▼                    ③ embed query turn (embed_texts,
                    inject BYTE-IDENTICAL             run_in_threadpool)  ──fail/slow──►┐
                    to today (NO embed call,             │                              │ D-05
                    NO marker) — D-03 fast path          ▼                              ▼
                                              ④ match_skills RPC (pgvector <=>,     fail-open:
                                                 owner+global scoped, current           inject-all-up-
                                                 embedding_model filter)                to-budget by
                                                 → [id, name, description, sim|NULL]     name order +
                                                     │                                   marker; kick
                                                     ▼                                   background embed
                                        ⑤ trim/assemble (pure fn):
                                           - always-keep pinned/recent (from history
                                             _pinned_skill scan; capped like PIN_BUDGET_FRACTION)
                                           - greedy fill by sim desc (NULL sim = fail-open keep)
                                           - name-sorted DISPLAY
                                           - append _CATALOG_TRIM_MARKER (N cut) — never silent
                                                     │
                                                     ▼
                              active_system_prompt += "## Available Skills\n…"
                                                     │
                     (background, decoupled)         ▼
        skill create/update ─trigger─► DELETE skill_embeddings row (mark stale)
        skill_test_cases change ─trigger─► DELETE skill_embeddings row (mark stale)
        reembed-shaped job ──► embed stale skills (batched, RLS-scoped, non-blocking) ──► skill_embeddings
```

The provider-agnostic boundary is the whole diagram: it produces a system-prompt string **before** any
chat provider is chosen, so OpenAI/Anthropic/Google/OpenRouter all receive the same shaped catalog.

### Recommended Project Structure (files touched — all within the G-5 fence)
```
backend/app/services/
├── agent_loop.py            # ① fetch, ② budget gate, ⑤ trim-assembly (pure helper), pin-scan;
│                            #   pre-filter INSIDE the `skill_catalog_override is None` branch ONLY (D-06)
├── skill_embedding_service.py   # NEW — embed-source builder + reembed-shaped backfill/refresh job
├── context_window.py        # reference-only (clone _TRIM_MARKER / budget-fraction vocabulary)
└── openai_service.py        # embed_texts (reuse, no change)

backend/app/config.py                 # + skill_catalog_max_tokens field + resolve_skill_catalog_budget
backend/app/models/user_settings.py   # + skill_catalog_max_tokens loader readback (env_attr=None)

supabase/migrations/091_skill_embeddings.sql   # NEW table + triggers + match_skills RPC + app_settings col
supabase/full-schema.sql                        # regenerated (never hand-edited)
```
> `backend/app/api/threads.py` is **NOT** in this list — the catalog path lives in `agent_loop.py` /
> `context_window.py` (G-5 red line). Confirm `files_modified` never includes `threads.py`.

### Pattern 1: The `match_skills` cosine RPC (mirror `match_document_chunks`)
**What:** A `SECURITY DEFINER` Postgres function that LEFT JOINs the owner+global enabled skill set to
`skill_embeddings` (filtered to the current embedding model) and returns each skill with a similarity score
(NULL when it has no current-model vector).
**When to use:** Only on the over-budget branch (step ④). Never on the fits-budget fast path.
```sql
-- Source: modeled byte-for-byte on migration 073 match_document_chunks
-- [VERIFIED: codebase supabase/migrations/073_embedding_provider_and_chunk_tags.sql:34-60]
CREATE OR REPLACE FUNCTION public.match_skills(
  query_embedding    public.vector,
  match_user_id      uuid,
  p_embedding_model  text DEFAULT NULL
) RETURNS TABLE(id uuid, name text, description text, similarity double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, s.description,
         CASE WHEN se.embedding IS NULL THEN NULL
              ELSE 1 - (se.embedding <=> query_embedding) END AS similarity
  FROM public.skills s
  LEFT JOIN public.skill_embeddings se
         ON se.skill_id = s.id
        AND (p_embedding_model IS NULL OR se.embedding_model = p_embedding_model)  -- D-10 stale-model guard
  WHERE (s.user_id = match_user_id OR s.is_global = true)   -- SAME scope as today's catalog query (V4)
    AND s.is_enabled = true
  ORDER BY similarity DESC NULLS LAST, s.name;   -- NULL sim (no vector) = fail-open, ranked last-but-kept
END;
$$;
```
**Key correctness note:** the `WHERE (user_id = ... OR is_global)` + `is_enabled` clause is **identical** to
today's catalog query (`agent_loop.py:1206-1209`) — the RPC must never widen scope. Because `text-embedding-3`
vectors are L2-normalized, `<=>` (cosine) ranks identically to a dot product `[CITED: OpenAI embeddings docs]`.

### Pattern 2: The `skill_embeddings` sibling table + mark-stale triggers
**What:** A one-row-per-skill vector table with a `source_text_hash` for staleness detection, plus triggers
that delete the row when the skill's content or its test cases change (mirrors `capture_skill_version`).
**When to use:** The persistence + lifecycle foundation.
```sql
-- Source: mirrors documents→document_chunks (mig 002) + capture_skill_version trigger (mig 079)
CREATE TABLE public.skill_embeddings (
  skill_id             uuid PRIMARY KEY REFERENCES public.skills(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  embedding            public.vector(1536),           -- matches text-embedding-3-small default
  embedding_model      text,                          -- D-10 tag (cross-vector-space guard)
  embedding_dimensions integer,
  source_text_hash     text NOT NULL,                 -- hash(description + should_fire prompts + name)
  updated_at           timestamptz NOT NULL DEFAULT now()
);
-- NO HNSW/IVF index: skills are tens–hundreds of rows; a seq scan over the LEFT JOIN is sub-millisecond.
-- (match_document_chunks uses HNSW because a corpus is 100k+ chunks — skills are 3 orders smaller.)

ALTER TABLE public.skill_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own skill embeddings"
  ON public.skill_embeddings FOR SELECT USING (auth.uid() = user_id);
-- Writes are service-role (bypass RLS); the job scopes .eq("user_id",…) by hand (reembed precedent, V4).

-- Mark-stale trigger on skills content change (name/description) — mirrors capture_skill_version D-02 gate
CREATE OR REPLACE FUNCTION public.stale_skill_embedding() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NOT (
       NEW.name        IS DISTINCT FROM OLD.name
    OR NEW.description IS DISTINCT FROM OLD.description
  ) THEN RETURN NEW; END IF;      -- instructions/toggle-only change → vector stays valid
  DELETE FROM public.skill_embeddings WHERE skill_id = NEW.id;
  RETURN NEW;
END; $$;
CREATE TRIGGER skills_stale_embedding AFTER UPDATE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.stale_skill_embedding();

-- Mark-stale trigger on test-case change (D-01: should_fire prompts are part of the embed source)
CREATE OR REPLACE FUNCTION public.stale_skill_embedding_from_case() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  DELETE FROM public.skill_embeddings
   WHERE skill_id = COALESCE(NEW.skill_id, OLD.skill_id);
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER skill_test_cases_stale_embedding
  AFTER INSERT OR UPDATE OR DELETE ON public.skill_test_cases
  FOR EACH ROW EXECUTE FUNCTION public.stale_skill_embedding_from_case();
```
> No SQL backfill INSERT is possible (SQL cannot call the embedding API) — the migration creates the table
> **empty**; the background job (Pattern 3 / step ④-adjacent) populates it. "Absence of a row" == stale, so
> an empty table degenerates cleanly to D-05 fail-open until the job runs. This differs from mig 079's
> `INSERT … SELECT` backfill precisely because vectors require a network call.

### Pattern 3: The budget-trim assembly (pure function — clone the CTX-03 vocabulary)
**What:** Deterministic string builder: fits-budget → byte-identical; over-budget → keep pinned/recent +
top-similarity, name-sorted display, honest marker.
**When to use:** Step ⑤; keep it a **pure function** (`build_skill_catalog_block(...) -> str`) so it is
unit-testable without a DB or LLM (SC#1/SC#3 tests drive it directly).
```python
# Source: mirrors context_window.py _TRIM_MARKER (line 65) + PIN_BUDGET_FRACTION (line 76) discipline
_CATALOG_TRIM_MARKER_TMPL = (
    "\n- _[{n} additional skill(s) exist that weren't listed here to fit the catalog "
    "budget. Ask me to list all skills, or name one directly and I'll load it.]_"
)  # honest, never-silent (D-02 / CTX-03 D-14). The escape hatch is REAL: load_skill works by name.

def build_skill_catalog_block(
    enabled: list[dict],            # [{id,name,description}] — today's ordered query result
    budget: int,                    # resolve_skill_catalog_budget(app_settings); 0 => inject-all
    model: str,                     # for estimate_tokens (tiktoken vs chars/4)
    pinned_recent_ids: set[str],    # from the history _pinned_skill scan (D-02 always-keep)
    sim_by_id: dict[str, float | None] | None,  # from match_skills; None on the fast path
) -> str:
    header = f"\n\n## Available Skills\nThe following skills are available. {LOAD_SKILL_POLICY}\n"
    def line(s): return f"- **{s['name']}**: {s['description']}"
    def block(rows): return header + "\n".join(line(s) for s in rows)

    full = block(sorted(enabled, key=lambda s: s["name"]))   # today's exact name-sorted format
    if budget <= 0 or estimate_tokens(full, model) <= budget:
        return full                                          # D-03 byte-identical fast path — NO marker

    # Over budget: pinned/recent first (capped so pins can't starve the whole menu — PIN_BUDGET_FRACTION
    # mirror), then by similarity desc (None => fail-open, ranked after scored ones but still eligible).
    pinned = [s for s in enabled if s["id"] in pinned_recent_ids]
    rest   = [s for s in enabled if s["id"] not in pinned_recent_ids]
    def _score(s):                                   # None-SAFE: a present-but-None value (real LEFT-JOIN
        v = (sim_by_id or {}).get(s["id"])           # shape) resolves to the sentinel, NOT via dict.get's
        return v if v is not None else -1.0          # default -- .get(id, -1.0) returns None when the key
    rest.sort(key=lambda s: -_score(s))              # maps to None, and -(None) would TypeError (Blocker-3)
    kept: list[dict] = []
    for s in _cap_pins(pinned, budget, model) + rest:        # _cap_pins evicts least-recent over the pin cap
        trial = kept + [s]
        n_cut = len(enabled) - len(trial)
        candidate = block(sorted(trial, key=lambda x: x["name"])) + \
                    (_CATALOG_TRIM_MARKER_TMPL.format(n=n_cut) if n_cut > 0 else "")
        if estimate_tokens(candidate, model) <= budget or s["id"] in pinned_recent_ids:  # pins forced (D-02)
            kept.append(s)                                   # pins forced in (D-02), capped upstream
        # else: skip this skill (least-relevant cut first — SC#1)
    n_cut = len(enabled) - len(kept)
    return block(sorted(kept, key=lambda s: s["name"])) + \
           (_CATALOG_TRIM_MARKER_TMPL.format(n=n_cut) if n_cut > 0 else "")
```
**Display order is name-sorted in BOTH paths** — selection is by relevance, presentation stays stable. This
keeps the fast-path byte-identical assertion clean and avoids leaking the ranking to the model.

### Pattern 4: The pinned/recent scan (D-02 always-keep), from raw history
**What:** Derive "recently-loaded" skill names from `history_resp.data` (available at `agent_loop.py:1173`,
*before* `_reconstruct_history`). Scan for `load_skill` tool calls and collect `args.skill_name`.
**Why here:** the catalog is injected (line 1215) before history is reconstructed into `messages` (line
1273), so read the raw rows' `tool_calls`.
```python
# Source: _pinned_skill provenance — agent_loop.py:915-917 (load_skill tool-call args.skill_name)
def _recently_loaded_skill_names(history_rows: list[dict]) -> set[str]:
    names: set[str] = set()
    for row in history_rows or []:
        for tc in (row.get("tool_calls") or []):
            if tc.get("name") == "load_skill":
                nm = (tc.get("args") or {}).get("skill_name")
                if nm: names.add(nm)
    return names
# Map names→ids against the enabled set to build pinned_recent_ids (id-keyed avoids the
# owner/global name-collision SEED-102 issue).
```

### Anti-Patterns to Avoid
- **Embedding on the fast path.** If the catalog fits, do NOT embed the query. Embedding only on the
  over-budget branch keeps the common case free and D-05-trivial.
- **Hooking every skill write path in app code to refresh vectors.** That is the Phase 139 CR-01 kind-blind
  trap. Use the DB triggers — they fire uniformly on all paths.
- **Widening scope in `match_skills`.** The RPC must reproduce today's `.or_(user_id.eq,is_global.eq.true)
  .eq(is_enabled)` scope exactly — a cross-user skill leak is an info-disclosure boundary (V4).
- **A minimum-relevance floor.** D-03 forbids dropping skills while budget remains. Only trim when over
  budget.
- **A second skill-count knob.** D-03 — the token budget already expresses "small enough."
- **Silent truncation.** Any cut MUST append the honest marker (CTX-03 D-14).
- **Running `embed_texts` on the event loop.** Always `run_in_threadpool` (SEED-065).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | A custom estimator | `estimate_tokens` (`context_window.py:102`) | Already handles tiktoken-vs-chars/4 per provider + is warmed at load. |
| Cosine similarity | Python dot-product/norm loop | `match_skills` pgvector RPC (`<=>`) | No numerical dep; vectors already L2-normalized; mirrors `match_document_chunks`. |
| Budget resolution | A hardcoded constant | `resolve_skill_catalog_budget` reading `app_settings` (mirror `resolve_context_budget`) | D-04 — no magic number in the hot path; admin-tunable + kill switch. |
| Honest truncation marker | New bespoke wording/mechanism | Clone `_TRIM_MARKER` idiom → `_CATALOG_TRIM_MARKER` | CTX-03 D-14 — one honesty vocabulary across both budget surfaces. |
| Re-embed lifecycle | New batching/resume logic | `reembed_service.py` shape (batched, resumable, RLS-scoped, non-destructive, threadpool) | Proven live; already solves cross-vector-space + resume + non-blocking. |
| Vector staleness detection | App-code diffing on write | DB triggers (`stale_skill_embedding*`) + `source_text_hash` | Fires on ALL write paths uniformly (safe-by-construction). |
| Name-load escape hatch | New "load hidden skill" path | `_handle_load_skill` (already name+is_enabled, catalog-independent) | Already satisfies D-02 part 2 — verify, don't build. |

**Key insight:** The single most important realization from reading the code is that **this phase builds
almost nothing new** — it wires five already-proven substrates into the one `skill_catalog_override is None`
branch. The genuinely new surface is small: one sibling table + two triggers + one RPC + one settings knob
+ one pure trim function.

## Runtime State Inventory

> Included because this phase introduces **new persisted runtime state + a data-population step** (a table,
> triggers, a settings row, and a vector backfill) that must reach cloud by hand (CLAUDE.md deploy parity).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | NEW `skill_embeddings` table — one vector row per skill, created empty by migration 091. Existing skills have NO vector until the backfill job runs. | **Data migration:** run the `reembed`-shaped backfill job once after applying mig 091 (local + cloud). Absence of a row = D-05 fail-open until then, so this is non-blocking but recall-degraded until backfilled. |
| Live service config | Global budget value lives in `app_settings.skill_catalog_max_tokens` (a DB row value, admin-tunable — NOT in git). | **Manual/parity:** the default ships in the migration column default (`DEFAULT 1500`) and the config.py field default; a non-default operator value must be re-applied to cloud `app_settings` by hand (the `harness_judge_model` / mig 078 precedent). |
| OS-registered state | None — no OS-level registration, cron, or scheduler involved. | None. |
| Secrets/env vars | None new. Embedding credentials already resolve via `get_embedding_client` (`embedding_api_key` / `embedding_base_url`, falling back to LLM creds). | None — reuse the existing embedding SPOF. |
| Build artifacts | `supabase/full-schema.sql` becomes stale after mig 091 lands. | Regenerate via `bash scripts/regenerate-full-schema.sh` (no `--reset`); commit BOTH the migration and the regenerated `full-schema.sql` (CLAUDE.md). |

**The canonical question — after every code file ships, what runtime state still needs touching?**
(1) apply migration 091 to the live local DB via the Supabase SQL editor (never `db push`/`db reset`),
(2) run the vector backfill job once, (3) regen + commit `full-schema.sql`, and at deploy time (4) apply
mig 091 to cloud Supabase by hand + (5) run the cloud backfill + (6) re-apply any non-default budget value
to cloud `app_settings`. Items 4-6 are the deploy-parity non-code half — flag them at execute/deploy time.

## Common Pitfalls

### Pitfall 1: Embedding the query on the fits-budget fast path
**What goes wrong:** Every turn pays an embedding round-trip even when the catalog trivially fits, and a
transient embed failure could perturb a case that should be byte-identical.
**Why it happens:** Ordering the embed before the budget check.
**How to avoid:** Budget-gate FIRST (steps ②→fits). Embed only inside the over-budget branch (③). The
fits-path returns the byte-identical block with no embed call.
**Warning signs:** A latency bump or an embedding log line on small-catalog turns; a fast-path test that
needs the embedder mocked.

### Pitfall 2: Comparing across vector spaces after an embedding-model change
**What goes wrong:** A skill vector embedded with model A is cosine-compared to a query embedded with model
B → garbage similarity.
**Why it happens:** Ignoring the D-10 stale-model guard that `match_document_chunks` already implements.
**How to avoid:** Tag `skill_embeddings.embedding_model`; the `match_skills` RPC filters
`se.embedding_model = current` (NULL similarity for stale/absent → fail-open keep). The triggers already
invalidate on content change; the re-embed job re-populates for the new model.
**Warning signs:** Wildly wrong ranking right after a Settings embedding-model switch.

### Pitfall 3: Cross-user skill leak via the RPC / JOIN
**What goes wrong:** `match_skills` returns another user's private skill because the scope predicate was
dropped in translation.
**Why it happens:** A `SECURITY DEFINER` function bypasses RLS; the function body is the only gate.
**How to avoid:** Copy today's exact scope into the RPC WHERE clause: `(s.user_id = match_user_id OR
s.is_global) AND s.is_enabled`. RLS on `skill_embeddings` is owner-only defense-in-depth; the app/RPC scope
is the real gate (the mig 079 / reembed V4 precedent).
**Warning signs:** A skill appearing for a user who doesn't own it and it isn't global.

### Pitfall 4: A loaded skill vanishing mid-thread
**What goes wrong:** A skill the user is actively using gets trimmed out on a later turn because its
similarity to the *current* turn is low.
**Why it happens:** Ranking purely by current-turn similarity without the D-02 always-keep set.
**How to avoid:** Scan history for `load_skill` calls (Pattern 4) → `pinned_recent_ids` are force-kept
(capped like `PIN_BUDGET_FRACTION` so pins can't starve the menu).
**Warning signs:** Second-turn "I no longer see that skill" behavior in a thread.

### Pitfall 5: Blocking the event loop on `embed_texts`
**What goes wrong:** The sync OpenAI HTTP embed call runs on the loop and freezes all request serving under
concurrency (the documented SEED-065 incident).
**Why it happens:** Calling `embed_texts` directly in the async hot path.
**How to avoid:** `await run_in_threadpool(embed_texts, [query], user_settings=...)` — the
`retrieval_service.py:42-44` pattern verbatim.
**Warning signs:** p95 idle-request latency spikes during search/embed-heavy load.

### Pitfall 6: Growing `threads.py` or breaking the eval seam
**What goes wrong:** The catalog logic leaks into `threads.py` (G-5 violation) or the pre-filter changes the
`skill_catalog_override` tuple branch (breaks eval A/B + Deep byte-identical).
**How to avoid:** All new logic in `agent_loop.py` / a new service + `context_window.py`-style helper. The
pre-filter lives strictly inside `if skill_catalog_override is None:`; the `else` (tuple) branch is
untouched. Extend `tests/test_agent_loop_catalog_override.py` to prove both.
**Warning signs:** `files_modified` lists `threads.py`; the existing catalog-override tests go red.

## Code Examples

### Resolve the budget (mirror `resolve_context_budget`)
```python
# Source: config.py resolve_context_budget pattern (context_window.py:79) + harness_judge_model app_settings precedent
# app_settings-only knob (env_attr=None readback), like harness_judge_model / context_window_max_tokens.
def resolve_skill_catalog_budget(app_settings) -> int:
    """Global token budget for the ## Available Skills block. 0 => disabled (inject-all, the kill switch).
    Default 1500 tokens ≈ ~45–55 skills at ~28–32 tok/line — small catalogs stay byte-identical (D-04)."""
    return int(getattr(app_settings, "skill_catalog_max_tokens", 1500))
```
```sql
-- migration 091 app_settings column (mirror mig 086 harness_judge_model)
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS skill_catalog_max_tokens integer NOT NULL DEFAULT 1500;  -- 0 = disable (inject-all)
```
```python
# user_settings.py — field + loader readback (mirror harness_judge_model at :174 / :539)
skill_catalog_max_tokens: int = 1500   # app_settings-only; 0 = inject-all kill switch (D-04)
# in _build_effective_settings(...):
skill_catalog_max_tokens=int(_val(row, "skill_catalog_max_tokens", None, 1500)),
```

### Build the embed source text (D-01 signal set)
```python
# Source: D-01 — description + should_fire test-case prompts; fall back to description (+ name)
def build_skill_embed_source(skill: dict, test_case_prompts: list[str]) -> str:
    parts = [skill.get("description", "").strip()]
    parts += [p.strip() for p in test_case_prompts if p and p.strip()]   # skill_test_cases.prompt
    text = "\n".join(p for p in parts if p)
    if not text:                                   # no description AND no cases
        text = (skill.get("name") or "").strip()   # last-resort name fallback
    return text[:4000]                             # modest cap so a huge test-suite can't dominate one embed
# source_text_hash = hashlib.sha256(text.encode()).hexdigest()  — non-crypto use, just staleness detection
```

### Over-budget hot-path wiring (inside `skill_catalog_override is None`)
```python
# Source: agent_loop.py:1203-1225 — the branch this phase modifies
enabled_skills = _skills_resp.data or []          # existing query, now also selecting id
if enabled_skills:
    budget = resolve_skill_catalog_budget(app_settings)
    pinned_ids = _recently_loaded_skill_names(history_resp.data)  # → mapped to ids
    sim_by_id = None
    full_block = _build_full_block(enabled_skills)                # today's name-sorted format
    if budget > 0 and estimate_tokens(full_block, user_settings.llm_model) > budget:
        try:
            q_vec = (await run_in_threadpool(
                embed_texts, [body.content], user_settings=user_settings))[0]     # D-05: wrapped
            ranked = await aexec(supabase.rpc("match_skills", {
                "query_embedding": q_vec,
                "match_user_id": current_user["id"],
                "p_embedding_model": getattr(user_settings, "embedding_model", "")
                                     or "text-embedding-3-small",
            }))
            sim_by_id = {r["id"]: r["similarity"] for r in (ranked.data or [])}
            kick_skill_backfill(supabase, current_user["id"], app_settings,   # Blocker-1: REQUIRED self-heal --
                only_skill_ids=[sid for sid, sim in sim_by_id.items() if sim is None])  # fire-and-forget, fail-open
        except Exception:
            logger.warning("skill pre-filter embed/rank failed; failing open", exc_info=True)  # D-05
            sim_by_id = None                         # None => build_skill_catalog_block trims by name only
    catalog_note = build_skill_catalog_block(
        enabled_skills, budget, user_settings.llm_model, pinned_ids, sim_by_id)
    active_system_prompt = active_system_prompt + catalog_note
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inject ALL enabled skills, name-sorted, unbounded (`agent_loop.py:1216-1225`) | Budget-gated inject: byte-identical when it fits, relevance-trim when over (this phase) | Phase 140 | Catalog can't balloon; small catalogs unchanged. |
| Per-turn LLM classifier considered for triggering | Embedding pre-filter on hot path; LLM classifier stays offline (Tuner only) | Phase 123/140 | No per-turn $/latency; provider-uniform. |
| Document search only uses pgvector | Skills reuse the *same* pgvector + re-embed machinery | Phase 140 | One embedding lifecycle, two consumers. |

**Deprecated/outdated:** none relevant. The `classify_fires` LLM classifier is explicitly retained as the
Trigger Tuner's *offline* mechanism and is NOT to be placed on the live path (D-01).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Default budget of **1500 tokens** is a sane starting point (~45–55 skills fit byte-identical). | §Code Examples / D-04 | Low — it's admin-tunable and 0 disables; a wrong default only shifts where trimming begins. Planner may pick a fraction of `max_tokens` instead. |
| A2 | Embedding **description + `skill_test_cases.prompt`** as the skill signal (concatenated, single vector). `skill_test_cases` has no `should_fire` boolean column (mig 079) — CONTEXT treats stored case `prompt`s as the should-fire signal. | §Code Examples / D-01 | Low-Medium — if a skill's cases are adversarial `should_not` prompts the vector could drift; mitigated because auto-seeded cases are should-fire paraphrases (`auto_seed_cases`). Planner may weight description higher. |
| A3 | The **lazy/opportunistic backfill kick** (fire-and-forget on the over-budget path) + an explicit deploy backfill is sufficient; no per-write-path app hook needed. | §Pattern 2 / §Anti-Patterns | Low — triggers guarantee staleness detection; worst case is one turn of fail-open until the job runs. Planner may instead add an explicit backfill endpoint kicked from skill CRUD. |
| A4 | **No ANN index** on `skill_embeddings` (seq scan over tens–hundreds of rows is sub-ms). | §Pattern 2 | Low — if a tenant ever has thousands of global+owned skills, add an HNSW index later (additive). |
| A5 | numpy being importable (2.2.4) is **transitive, not guaranteed** — hence the pgvector RPC over Python cosine. | §Standard Stack | Low — the RPC path sidesteps this entirely. |

**If the planner disagrees with any A#, it is a discuss-phase confirmation point, not a research gap.**

## Open Questions (RESOLVED)

1. **Should the query embedding include a small preceding-turn window for follow-ups ("do that again")?**
   - What we know: D-01 marks this discretionary; latest-turn-only is the sensible default.
   - What's unclear: whether recall suffers on terse follow-ups.
   - Recommendation: ship latest-turn-only; the always-keep pinned/recent set (D-02) already covers the
     "continue using the loaded skill" case, so follow-up recall is largely handled without multi-turn embed.
   - **RESOLVED:** ship **latest-turn-only** (no preceding-turn window). The always-keep pinned/recent set
     (D-02) covers follow-ups; revisit only if live recall on terse follow-ups suffers.

2. **Backfill trigger point for the vector job (lazy vs explicit endpoint).**
   - What we know: triggers detect staleness; the job embeds.
   - What's unclear: whether operators want a visible "backfill now" control (like the re-embed card) or
     silent self-heal.
   - Recommendation: implement the reembed-shaped job with a callable entrypoint; wire an opportunistic kick
     for self-heal now, leave an explicit admin control as a trivial later addition (A3).
   - **RESOLVED:** the **opportunistic self-heal kick** is the chosen mechanism -- `kick_skill_backfill`
     (Plan 02) is fired fire-and-forget from the Plan 04 over-budget branch whenever `match_skills` returns
     an in-scope skill with a missing/NULL-similarity vector (Blocker-1). It is off-the-hot-path and
     fail-open, so a newly-created/edited skill self-heals within ~one turn instead of being silently
     starved. An explicit admin "backfill now" control (like the re-embed card) is DEFERRED as a trivial
     later addition.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pgvector (`vector`, `<=>`) | `match_skills` RPC + `skill_embeddings` | ✓ | in-repo (mig 001 `create extension vector`) | — |
| Embedding provider (`text-embedding-3-small` via `embed_texts`) | query + skill embedding | ✓ | configured default | D-05 fail-open to inject-all if unreachable |
| `tiktoken` | `estimate_tokens` budget check | ✓ | cl100k_base (warmed at load) | chars/4 heuristic (already built-in) |
| Supabase local (SQL editor) | apply migration 091 | ✓ | CLI-managed | — |
| numpy | (only if Python-cosine alternative chosen) | ~ (transitive 2.2.4, not declared) | 2.2.4 | Use the recommended pgvector RPC (no numpy) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the embedding provider (D-05 fail-open); numpy (avoided by the RPC).

## Validation Architecture

> `workflow.nyquist_validation` is not disabled — this section is included so VALIDATION.md can be derived.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (`asyncio_mode = auto`) `[VERIFIED: backend/pytest.ini]` |
| Config file | `backend/pytest.ini` (`testpaths = tests`) |
| Quick run command | `cd backend && python -m pytest tests/test_140_*.py -x` |
| Full suite command | `cd backend && python -m pytest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRIG-02 (SC#1) | Over-budget catalog → least-relevant cut first (highest-sim kept) | unit (pure fn) | `pytest tests/test_140_catalog_trim.py::test_over_budget_cuts_least_relevant -x` | ❌ Wave 0 |
| TRIG-02 (SC#1) | Fits-budget catalog → **byte-identical** to today (no embed, no marker) | unit + integration | `pytest tests/test_140_catalog_trim.py::test_fits_budget_byte_identical -x` | ❌ Wave 0 |
| TRIG-02 (SC#2) | Budget resolved from `app_settings`; `0`/disable = inject-all | unit | `pytest tests/test_140_catalog_trim.py::test_budget_zero_injects_all -x` | ❌ Wave 0 |
| TRIG-02 (SC#3) | Honest `_CATALOG_TRIM_MARKER` appended with correct N when trimmed | unit | `pytest tests/test_140_catalog_trim.py::test_marker_appended_with_count -x` | ❌ Wave 0 |
| TRIG-02 (SC#3) | Pinned/recent (from history `load_skill` scan) always kept even at low sim | unit | `pytest tests/test_140_catalog_trim.py::test_pinned_always_kept -x` | ❌ Wave 0 |
| TRIG-02 (SC#3) | `load_skill` loads a skill NOT in the filtered menu (escape hatch) | integration | `pytest tests/integration/test_140_escape_hatch.py -x` | ❌ Wave 0 (verifies existing `_handle_load_skill`) |
| TRIG-02 (D-05) | Embedding error/timeout → fail-open inject-all-up-to-budget, never crash/empty | unit | `pytest tests/test_140_catalog_trim.py::test_fail_open_on_embed_error -x` | ❌ Wave 0 |
| TRIG-02 (D-06) | `skill_catalog_override` tuple/`()`/`None` branches unchanged | integration | `pytest tests/test_agent_loop_catalog_override.py -x` | ✅ (extend existing) |
| TRIG-02 (schema) | mig 091 applied: `skill_embeddings` table + triggers + `match_skills` + `skill_catalog_max_tokens` col exist | DB-CHECK | `pytest tests/integration/test_140_migration_091.py -x` (psycopg2 to `:54322`) | ❌ Wave 0, autonomous:false (blocking-human apply) |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_140_*.py -x`
- **Per wave merge:** `cd backend && python -m pytest tests/test_140_*.py tests/test_agent_loop_catalog_override.py tests/integration/test_140_*.py`
- **Phase gate:** full suite green (`cd backend && python -m pytest`) before `/gsd:verify-work`; then the 4-axis UAT below.

### 4-axis Cross-Provider UAT (SC#10 — authored in VALIDATION.md, NOT PLAN.md)
Per CLAUDE.md "UAT scoreboard recipe" — an over-budget catalog with one planted should-fire skill:
| Axis | Required row |
|------|--------------|
| Cross-provider | The planted should-fire skill still reaches the model AND `load_skill` fires — on **OpenAI, Anthropic, Google, OpenRouter** (one representative model each). |
| Multi-tool | 1 row: a prompt that triggers the skill + a second tool (e.g. `search_documents` + `load_skill`) in one turn, with the catalog over budget. |
| Parallel-thread | 1 row: Thread A streaming (over-budget catalog) while Thread B accepts a new prompt — the pinned-set of A doesn't bleed into B (owner/thread scope holds). |
| Long-message | 1 row: ≥ 50 prior messages OR ≥ 5 KB prompt with an over-budget catalog — trimming + pinned-keep still correct, no context-budget interaction regression with `trim_messages_to_fit`. |

### Wave 0 Gaps
- [ ] `tests/test_140_catalog_trim.py` — unit tests for `build_skill_catalog_block` (SC#1/SC#2/SC#3, fail-open). Pure function → no DB/LLM needed.
- [ ] `tests/integration/test_140_escape_hatch.py` — proves `load_skill`-by-name loads a menu-absent skill.
- [ ] `tests/integration/test_140_migration_091.py` — psycopg2 DB-CHECK for table/triggers/RPC/column.
- [ ] `tests/integration/test_140_skill_embedding_service.py` — embed-source builder + reembed-shaped job (staleness predicate, RLS scope, non-destructive) mirroring `test_111_1_reembed_*`.
- [ ] Extend `tests/test_agent_loop_catalog_override.py` — add a fits-budget byte-identical case + an over-budget-trim case (mock `match_skills` + `embed_texts`), reusing the existing `_capture_system_prompt` harness.

## Security Domain

> `security_enforcement` is not disabled — included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface. |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | `match_skills` RPC reproduces today's owner+global scope (`user_id = uid OR is_global`) in a `SECURITY DEFINER` body; `skill_embeddings` RLS owner-only; the re-embed job scopes `.eq("user_id",…)` by hand (service-role bypasses RLS — reembed/mig 079 V4 precedent). |
| V5 Input Validation | **yes** | The user turn is used only as embedding input (no SQL/eval); the query vector is bound as an RPC param (never string-interpolated). Skill descriptions are already model-visible today — no new injection surface. |
| V6 Cryptography | no | `source_text_hash` is a non-security staleness fingerprint (sha256/any fast hash) — not a crypto boundary. |

### Known Threat Patterns for {pgvector RPC + system-prompt shaping}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user skill disclosure via `match_skills` LEFT JOIN losing scope | Information Disclosure | Bake `(s.user_id = match_user_id OR s.is_global) AND s.is_enabled` into the RPC body; RLS owner-only on `skill_embeddings` as defense-in-depth (Pitfall 3). |
| Fail-open leaking another user's skills | Information Disclosure | Fail-open injects **this** user's enabled set (the same set today's query returns) up to budget — never a wider set. |
| Stale-vector mis-ranking hides a should-fire skill | Tampering / Denial (of correct behavior) | D-10 model filter + NULL-sim fail-open keep + always-keep pinned/recent → a should-fire skill is never starved (SC#3, proven cross-provider). |
| Embedding call on every turn as a soft DoS / latency amplifier | Denial of Service | Embed only on the over-budget branch; `run_in_threadpool`; fail-open on timeout — the hot path never blocks on the embedder. |
| Malicious skill description as prompt injection into the catalog | Tampering | Pre-existing surface (the catalog already injects descriptions); unchanged by this phase — no new exposure. |

## Sources

### Primary (HIGH confidence)
- Codebase `[VERIFIED]`: `backend/app/services/agent_loop.py` (catalog injection 1197-1225; override seam 195-210; `_pinned_skill` 915-917; history query 1166-1173).
- Codebase `[VERIFIED]`: `backend/app/services/context_window.py` (`_TRIM_MARKER` 65, `PIN_BUDGET_FRACTION` 76, `resolve_context_budget` 79, `estimate_tokens` 102).
- Codebase `[VERIFIED]`: `backend/app/services/openai_service.py` (`embed_texts` 1641, `get_embedding_client` 1166); `retrieval_service.py:42-58` (query-embed hot path + D-10 model filter); `reembed_service.py` (full lifecycle).
- Codebase `[VERIFIED]`: `supabase/migrations/002_module2_byo_retrieval.sql` (`vector(1536)` + HNSW + `match_document_chunks`), `073_embedding_provider_and_chunk_tags.sql` (model tag + stale-model RPC filter), `017_skills.sql` (skills shape, no embedding col), `079_skill_versions_and_test_cases.sql` (`skill_test_cases`, `capture_skill_version` trigger), `086_app_settings_harness_judge_model.sql` (app_settings knob precedent).
- Codebase `[VERIFIED]`: `backend/app/services/tool_dispatcher.py:666-683` (`_handle_load_skill` name+is_enabled escape hatch), `skill_lint.py:57` (`LOAD_SKILL_POLICY`), `skill_tuner_service.py:318` (`classify_fires` — rejected for hot path).
- Codebase `[VERIFIED]`: `backend/app/config.py:809-815` (embedding defaults), `backend/app/models/user_settings.py:174,539` (`harness_judge_model` app_settings readback pattern), `backend/pytest.ini`, `backend/tests/test_agent_loop_catalog_override.py` (D-06 seam test to extend).

### Secondary (MEDIUM confidence)
- OpenAI embeddings docs `[CITED: developers.openai.com/api/docs/models/text-embedding-3-small; developers.openai.com/api/docs/guides/embeddings]` — text-embedding-3-small = 1536 dims, **L2-normalized to length 1** (cosine == dot product; identical rankings under pgvector `<=>`); `dimensions` param supports truncation (not used here).

### Tertiary (LOW confidence)
- None — every load-bearing claim is verified in-repo or cited from official OpenAI docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every asset is present and verified in the repo; no new packages.
- Architecture: HIGH — a recombination of `match_document_chunks` + `reembed_service` + `context_window`
  CTX-03, each proven live.
- Pitfalls: HIGH — drawn from concrete in-repo incidents (SEED-065 loop-block, D-10 cross-vector-space, V4
  service-role scoping, Phase 139 CR-01 kind-blind).
- Defaults (budget number, embed weighting): MEDIUM — flagged in the Assumptions Log as discuss-phase
  confirmation points, not gaps.

**Research date:** 2026-07-07
**Valid until:** ~2026-08-07 (stable — pins to in-repo substrates; the only external fact is the OpenAI
embedding model spec, which is stable).
