---
phase: 140-smart-dispatch-relevance-pre-filter-stretch
reviewed: 2026-07-07T14:01:19Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - backend/app/services/skill_embedding_service.py
  - backend/app/services/skill_catalog_filter.py
  - backend/app/services/agent_loop.py
  - backend/app/models/user_settings.py
  - backend/app/config.py
  - supabase/migrations/091_skill_embeddings.sql
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 140: Code Review Report

**Reviewed:** 2026-07-07T14:01:19Z
**Depth:** standard
**Files Reviewed:** 6 (note: `backend/app/config.py` was in the scope list but the diff `cb9fef39..HEAD` shows no Phase-140 change to it — nothing to review there)
**Status:** issues_found

## Summary

Reviewed the Phase 140 smart-dispatch relevance pre-filter: the pure catalog
assembler (`skill_catalog_filter.py`), the embed-source + reembed-shaped backfill
+ fire-and-forget self-heal (`skill_embedding_service.py`), the hot-path wiring
inside `agent_loop.py`'s `skill_catalog_override is None` branch, the settings field
(`user_settings.py`), and migration `091_skill_embeddings.sql`.

The phase-specific invariants that were explicitly called out are, on the whole,
**correctly implemented**:

- **Fail-open (D-05):** `_score` is genuinely None-safe (guards `-(None)`), and
  `build_skill_catalog_block` runs OUTSIDE the agent-loop try/except and cannot
  raise on a mixed float/None sim map. The D-10 model-tag filter in `match_skills`
  additionally prevents any cross-dimension `<=>` crash. Verified.
- **Eval/Deep seam (D-06):** the pre-filter lives strictly in the inner
  `skill_catalog_override is None` branch; the else branch is byte-identical to the
  pre-phase code (no embed/rank/kick). Verified.
- **Cross-user scope (V4):** the `match_skills` WHERE clause is the byte-exact
  catalog-scope clone with no widening; the backfill hand-scopes `.eq("user_id")`
  on both read and write. Verified — but see WR-02, where that strict scoping has a
  functional side effect.
- **run_in_threadpool (D-v2.5-01):** every blocking call (`embed_texts`, the skills
  read, the `match_skills` RPC via `aexec`, and every backfill read/upsert) is
  threadpool-wrapped. Verified.
- **Self-heal kick (Blocker-1):** `kick_skill_backfill` is fire-and-forget, never
  awaited, double-wraps fail-open (job + spawn), closes the coro on spawn failure,
  and strong-refs the task in `_BACKFILL_TASKS`. Verified.

No blockers found. Three warnings concern feature-degradation gaps that silently
disable smart-dispatch ranking for real, supported configurations (non-1536-dim
embeddings; shared global skills) and a byte-identity deviation. Four info items
note fragile coupling and edge behaviors.

## Warnings

### WR-01: Hardcoded `vector(1536)` column silently disables smart-dispatch for any non-1536-dim embedding model

**File:** `supabase/migrations/091_skill_embeddings.sql:46`
**Issue:** `skill_embeddings.embedding` is fixed at `public.vector(1536)`, yet the
app treats embedding dimensions as a configurable setting
(`UserEffectiveSettings.embedding_dimensions`, default 1536) and `document_chunks`
even ships a `resize_embedding_column` RPC (`reembed_service.py:100`) precisely so
dims can change. The skill backfill (`skill_embedding_service.py:203-229`) embeds
with the *currently-configured* model via `embed_texts(..., user_settings=app_settings)`
and stores `embedding_dimensions: dims`, but there is **no resize path** for this
column. If an admin selects an embedding model that produces non-1536 vectors (e.g.
`text-embedding-3-large` at its native 3072 dims), every `upsert` raises a
`vector` dimension error → the whole backfill pass throws → caught by the outer
`except` → returns `{"status": "failed"}`. No vectors are ever written. Because the
D-10 model-tag filter then excludes any stale-model rows, `match_skills` returns all
NULL similarities, and the pre-filter silently degrades to name-only trimming.

This does not crash a user turn (it is fail-open), but it means the entire smart-dispatch
feature is silently inert for a supported configuration, with no signal to the operator
beyond a backend warning log.
**Fix:** Either resize the column to match `embedding_dimensions` (add a
`resize_embedding_column`-style RPC for `skill_embeddings`, or size it to the max
supported dim), or explicitly assert/guard the configured dims against 1536 in the
backfill and surface a clear operator warning. At minimum, document the 1536-only
constraint next to the column and in `.env.example`:
```sql
-- skill_embeddings.embedding is FIXED at vector(1536). Non-1536 embedding models are
-- NOT supported by smart-dispatch until a resize path (mirroring resize_embedding_column)
-- is added; the backfill upsert will fail-open to name-only trimming otherwise.
embedding public.vector(1536),
```

### WR-02: Strict V4 `.eq(user_id)` backfill scope means global skills owned by other users never self-heal — they perpetually rank last and are trimmed first even when relevant

**File:** `backend/app/services/skill_embedding_service.py:173` (read scope) and `backend/app/services/agent_loop.py:1284-1295` (kick)
**Issue:** The catalog scope is `(user_id = me OR is_global) AND is_enabled`, so a
chatting user B sees global skills whose `user_id` is a *different* owner — confirmed
by `018_skill_creator_seed.sql`, where the shipped global skill-creator skill is owned
by a seed **system** user. When such a global skill has no vector, `match_skills`
returns NULL similarity, so it is added to `_stale_ids` and `kick_skill_backfill` is
fired. But the backfill read is hand-scoped `.eq("user_id", user_id)` (V4), so
`only_skill_ids=[global_skill]` resolves to `.eq("user_id", B).in_("id", [global_skill])`
→ **empty** (the global skill's `user_id` is the seed/other user, not B). The kick is a
silent no-op for every non-owner.

Consequence: a global skill's vector is only ever populated if its *owner* chats and
exceeds budget. For seed/system-owned global skills (e.g. skill-creator) that never
happens, so those skills carry NULL similarity forever → `_score` returns the `-1.0`
sentinel → they sort last and are **cut first** when the catalog is over budget, even
when semantically the most relevant to the turn. This directly defeats the phase's
core goal for the exact skills that are shared to everyone, and violates the
Blocker-1 "re-vectorizes within ~one turn" guarantee for cross-user global skills.
(The never-starve escape hatch — marker + load-by-name — does still hold, so it is a
relevance-quality gap, not a hard starvation.)

Note the tension with the V4 invariant: reading global skills is **not** a privacy leak
(their descriptions are already injected into every user's catalog), so a read scoped to
the *catalog* scope `(user_id = me OR is_global)` — not a widening of any private-skill
access — would close the gap. The current strict `.eq(user_id)` is what produces it.
**Fix:** Scope the backfill read to mirror the catalog scope rather than owner-only, e.g.
```python
q = (
    supabase.table("skills")
    .select("id, name, description, skill_test_cases(prompt), "
            "skill_embeddings(source_text_hash, embedding_model)")
    .or_(f"user_id.eq.{coerce_uid(user_id)},is_global.eq.true")  # catalog scope, not owner-only
    .eq("is_enabled", True)
)
```
(use `coerce_uid` for the DSL-injection-safe interpolation), keeping the WRITE payload's
`user_id` as-is. If the strict V4 read scope must be preserved instead, add a proactive/
owner-side or scheduled full backfill for global skills and document that non-owner
turns cannot self-heal them.

### WR-03: Fast-path (D-03) byte-identity can diverge from pre-phase output because Python `sorted(by name)` may not match Postgres `.order("name")` collation

**File:** `backend/app/services/skill_catalog_filter.py:147` and `backend/app/services/agent_loop.py:1252-1254`
**Issue:** The phase claims the fits-budget path is byte-identical to today (D-03). The
pre-phase code emitted lines in the DB order from `.order("name")` (Postgres collation).
The new fast path re-sorts with Python `sorted(enabled, key=lambda s: s["name"])`
(Unicode codepoint order). For skill names that are not uniformly lowercase-ASCII
(mixed case or non-ASCII), a locale-aware DB collation (e.g. `en_US.UTF-8`) orders
differently from Python's codepoint sort — so the injected `## Available Skills` block
can be reordered versus pre-phase. Functional impact is limited to the ordering of a
bulleted list in the system prompt, but it is a real deviation from the stated
byte-identity contract and would surface in any prompt-snapshot / golden test.
**Fix:** If exact byte-identity matters, keep the DB order on the fast path (don't
re-sort when the catalog fits), or make the ordering explicitly deterministic and
document that DISPLAY order is now Python-codepoint (updating any D-03 byte-identity
claim accordingly).

## Info

### IN-01: Cross-module import of a private `_block` helper couples the fast-path gate to the pure module's internals

**File:** `backend/app/services/agent_loop.py:64-70` (`_block as _skill_catalog_block`)
**Issue:** `agent_loop.py` imports the underscore-prefixed `_block` from
`skill_catalog_filter` to compute `_full_block` for the embed-skip gate, so the gate
matches `build_skill_catalog_block`'s internal `full` exactly. This is deliberate
(documented Pitfall-1 fidelity) but fragile: any change to `_block`'s signature or
formatting silently changes the gate with no type/interface contract to catch drift.
**Fix:** Expose a small public helper (e.g. `render_full_catalog(enabled) -> str`) or a
`fits_budget(enabled, budget, model) -> bool` on `skill_catalog_filter` and call that
from `agent_loop`, so the gate and the assembler share a supported public seam.

### IN-02: Pin resolution by name over-pins same-named owner+global skills

**File:** `backend/app/services/agent_loop.py:1243-1246`
**Issue:** `pinned_recent_ids = {s["id"] for s in enabled_skills if s["name"] in _pinned_names}`
resolves the D-02 pin set from `load_skill` history, which only records `skill_name`.
When an owner skill and a global skill share the same name (the SEED-102 collision the
id-keying was meant to avoid), loading one pins **both** ids. The sim map is id-keyed
and safe, but this name→id resolution is not collision-safe, contrary to the
"SEED-102-safe" comment. Impact is minor over-pinning (an extra same-named skill stays
listed); no crash.
**Fix:** Acknowledge the limitation in the comment, or persist the loaded skill's id in
the `load_skill` tool-call args so pins can be resolved by id.

### IN-03: A very small admin budget yields a "The following skills are available" header with zero skills listed

**File:** `backend/app/services/skill_catalog_filter.py:162-178`
**Issue:** If `budget` is tiny (admin misconfiguration) and no pins and no single skill
line fits, `kept` stays empty and `out` is the header + trim marker with no bullet lines
— an odd "The following skills are available." followed by none, though the honest
marker + load-by-name escape hatch is present.
**Fix:** Optionally short-circuit to a minimal message when `kept` is empty, or document
a sane minimum for `skill_catalog_max_tokens` in the Settings UI / migration comment.

### IN-04: Greedy fill does not strictly "cut least-relevant first"

**File:** `backend/app/services/skill_catalog_filter.py:163-172`
**Issue:** The over-budget loop continues past a skipped item, so a shorter,
lower-ranked skill can be kept after a longer, higher-ranked one was skipped for size —
the docstring's "cut the least-relevant first" is a knapsack approximation, not a strict
guarantee. Acceptable behavior; noted so it isn't mistaken for a strict invariant.
**Fix:** Either `break` on the first non-pin that doesn't fit (strict relevance order,
possibly wasting budget) or update the docstring to describe the greedy-fill semantics.

---

_Reviewed: 2026-07-07T14:01:19Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
