# Phase 140: Smart-Dispatch Relevance Pre-Filter (STRETCH) - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a **relevance pre-filter + configurable token budget** to the `## Available Skills`
catalog block that is injected into the agent's system prompt (`agent_loop.py:1197-1225`).

**Today:** every enabled skill (the user's own + all `is_global`) is injected
unconditionally, sorted by name, with no size limit. As a user's skill count grows,
the menu balloons — it eats context budget and dilutes the model's attention, making
it *worse* at picking the right skill.

**This phase (TRIG-02):**
1. Only *plausibly-relevant* skills are surfaced to the model for a given turn.
2. The injected catalog stays within a **configurable token budget** even as skill
   count grows.
3. A genuinely-relevant skill is **never starved** (a should-trigger skill still
   reaches the model), verified cross-provider (SC#10).

**Explicitly OUT of scope (belongs in other phases / red lines):**
- No growth of `backend/app/api/threads.py` (G-5 hot file — extraction still due).
- No new eval runtime, no changes to the eval-runner override seam beyond honoring it.
- No Trigger Tuner UI/scoring changes (SEED-093 residuals — see Deferred).
- No per-skill "trigger" schema field or a full skills-tab redesign.

</domain>

<decisions>
## Implementation Decisions

### D-01 — Relevance mechanism: semantic (embedding) match
- **Chosen:** Compare the meaning of the user's current turn against each skill using
  **embeddings** (reuse `backend/app/services/embedding_service.py` — the same infra
  that powers document search). Cheap + fast per turn, scales to hundreds of skills,
  catches paraphrases.
- **Rejected — keyword/lexical:** zero-infra but misses paraphrases (e.g. "summarize
  this" vs a skill described as "condense a document").
- **Rejected — per-turn LLM classifier (`classify_fires`):** most accurate but adds
  seconds + $ to EVERY hot-path turn and behaves differently per provider — unacceptable
  on the main chat path. (Its `classify_fires` prompt/policy stays the Trigger Tuner's
  offline concern, not a live pre-filter.)
- **Skill embedding source text:** the skill `description` + its owner-authored
  `should_fire` test-case prompts (from `skill_test_cases`, migration 079) when present;
  fall back to `description` (+ `name`) when a skill has no test cases. (Which exact
  fields/weighting → planner/researcher detail, but the signal set is locked here.)
- **Query embedding source text:** the user's latest turn is the primary signal
  (planner may add a small preceding-context window for follow-ups like "do that again"
  — sensible default, not a hard requirement).

### D-02 — Never-starve safety net (SC#3): honest marker + name-load escape hatch
- **Chosen (both parts):**
  1. When skills are trimmed to fit budget, append an **honest truncation marker**
     ("N additional skills exist that weren't listed — ask me to list all skills or name
     one to load"), mirroring Phase 123 CTX-03's never-silent `_TRIM_MARKER` (decision
     **D-14** — never silently drop).
  2. `load_skill` must remain able to load **any enabled skill by exact name** even if
     it was NOT in the filtered menu (escape hatch — a user/model that names a skill is
     never blocked by the pre-filter).
- **Always-kept in the menu:** recently-loaded / pinned skills (the CTX-03 pin substrate)
  stay listed regardless of relevance rank, so an in-use skill never vanishes mid-thread.

### D-03 — Small-catalog bypass: budget is the ONLY gate
- **Chosen:** If the user's FULL catalog fits the token budget, inject everything exactly
  like today (**byte-identical**, zero starvation risk). Relevance ranking/trimming only
  activates when the catalog **exceeds** the budget.
- **No separate skill-count cutoff** — the token budget already expresses "small enough,"
  a second count knob would be redundant.
- **SC#1 interpretation (locked):** "clearly-irrelevant skills are not injected" is
  satisfied by the trim path — when the catalog is too big to fit, the skills that get
  **cut first are the least-relevant** ones. There is **no always-on minimum-relevance
  floor** that drops skills while there is still budget room. (This keeps small-catalog
  behavior unchanged and removes any similarity-threshold to tune. Verification must test
  SC#1 with an over-budget catalog, not a small one.)

### D-04 — Config & rollout: global app setting, default ON, with an off switch
- **Chosen:** The token budget is a **global `app_settings` value** (admin-tunable, per
  the admin-panel direction), with a sane default. Setting budget to `0` / a disable flag
  = today's inject-all behavior (the built-in kill switch).
- **Default ON** is safe *by construction* because D-03's bypass leaves small catalogs
  untouched — only over-budget power users are affected.
- **Per-user budget override is deferred** — start global; a per-user knob can come later
  without rework (same app_settings→user_settings override pattern used elsewhere).
- **Default budget value:** planner picks a sane default; the CTX-03 language (a fraction
  of `max_tokens`, or a modest absolute for the catalog block) is the reference. Not a
  hardcoded magic number in the hot path — resolve via settings like `context_window.py`
  already does.

### D-05 — Fail-open principle (locked, not a user choice)
- If the embedding call fails or is slow, the filter **fails open to today's behavior**
  (inject all up to budget) rather than blocking the turn or starving skills — mirroring
  the honest-fail floor in `classify_fires` (`would_load=False` never crashes). The
  pre-filter must never be able to break the chat path.

### D-06 — Preserve the eval-override seam (locked)
- The `skill_catalog_override` parameter (Phase 133 EVAL-02) MUST stay intact: `None` =
  the live DB path (now with the pre-filter), a tuple = the eval arms drive exactly those
  skills. The pre-filter slots INTO the `None` branch only — it must not change how the
  override tuple is honored, so the eval runner + Deep Mode stay correct.

### Claude's Discretion
- Exact embedding field weighting (description vs test-case prompts), the preceding-turn
  context window for the query embedding, the default budget number, where the honest
  marker text is templated, and whether skill vectors live in a new column on `skills`
  vs a sibling table — all planner/researcher calls within the locked decisions above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement & roadmap
- `.planning/REQUIREMENTS.md` (TRIG-02, line 46) — the requirement + its dependency on
  Phase 123 CTX-03 pin substrate; SC#10 mandate.
- `.planning/ROADMAP.md` §"Phase 140" (lines 351-362) — goal + 3 success criteria.
- `.planning/ROADMAP.md` §"Guardrails firing (v3.2)" (line 440) — G-5 hot-file ledger:
  catalog-injection path lives in `agent_loop.py` + `context_window.py`; do NOT grow
  `threads.py`.

### Code to touch / mirror
- `backend/app/services/agent_loop.py:1197-1225` — the CURRENT catalog-injection path
  (`## Available Skills` block, the `skill_catalog_override` seam, `LOAD_SKILL_POLICY`).
  This is the injection point the pre-filter modifies.
- `backend/app/services/context_window.py:70-99` — Phase 123 CTX-03 pin substrate:
  `PIN_BUDGET_FRACTION`, `_TRIM_MARKER`, `resolve_context_budget()`, least-recently-used
  eviction, decision D-14 (never-silent truncation). **The honest-truncation + budget-
  fraction design language to reuse.**
- `backend/app/services/embedding_service.py` — the embedding infra (document search) to
  reuse for skill + query embeddings (D-01).
- `backend/app/services/skill_tuner_service.py:318` (`classify_fires`) — the LLM
  relevance-classification precedent that was **rejected** for the live path (offline/
  Tuner only). Read to understand what NOT to put on the hot path.
- `supabase/migrations/017_skills.sql` — `skills` table shape (name/description/
  instructions/is_enabled/is_global; NO embedding column yet).
- `supabase/migrations/079_skill_versions_and_test_cases.sql` — `skill_test_cases`
  (`should_fire` prompts) = the relevance signal source (D-01).

### Convention refs
- `CLAUDE.md` — Settings/dynamic-config convention (everything dynamic → `app_settings`/
  `user_settings`, secrets only in env); SC#10 UAT 4-axis recipe; G-5 guardrail; migration
  discipline (numbered SQL, apply via SQL editor, regen full-schema).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`embedding_service.py`** — existing embed infra (documents/pgvector). Reuse for both
  skill-description embedding (precompute/backfill) and the per-turn query embedding.
- **`context_window.py` CTX-03 substrate** — `resolve_context_budget()` +
  `PIN_BUDGET_FRACTION` + `_TRIM_MARKER` give a ready template for a settings-resolved
  budget and an honest overflow marker. Don't reinvent the eviction/marker pattern.
- **`skill_catalog_override` param** (agent_loop.py:202/1111) — the seam the eval runner
  already uses; the pre-filter must live inside the `override is None` branch.
- **`skill_test_cases`** (mig 079) — owner-authored `should_fire` prompts, a strong,
  already-curated relevance signal.

### Established Patterns
- **Honest truncation over silent drop (D-14)** — any trimming surfaces a marker; the
  model/user is never left blind to skills that exist.
- **Fail-open on the hot path** — `classify_fires` honest-fail floor precedent: a filter
  failure degrades to "inject all," never breaks chat.
- **Settings-resolved budgets** — `resolve_context_budget()` reads env/settings, never
  hardcodes; TRIG-02's budget follows the same resolution style via `app_settings`.
- **Cross-provider parity at the service boundary** — the pre-filter is provider-agnostic
  (it shapes the system prompt before provider dispatch); SC#10 UAT proves a should-fire
  skill still reaches OpenAI / Anthropic / Google / OpenRouter.

### Integration Points
- Skill embedding lifecycle: a NEW migration adds skill vectors (column or sibling table)
  + a backfill; re-embed on skill description/test-case change (mirror the document
  re-embed trigger, `reembed_service.py`). Cloud parity = apply migration by hand +
  regen `full-schema.sql` (per CLAUDE.md).
- The budget `app_settings` row is a non-code deploy artifact (seed/settings parity
  checklist) — flag at execute/deploy time.

</code_context>

<specifics>
## Specific Ideas

- Mirror **exactly** the CTX-03 honest-truncation vocabulary (a `_TRIM_MARKER`-style note)
  so the two budget surfaces (loaded-skill pins vs the catalog menu) feel like one system,
  not two bolt-ons.
- The pre-filter is fundamentally a **budget-management tool**, not an aggressive
  irrelevance remover — small-catalog users should not be able to tell it exists.
- SC#3 ("never starved") is the phase's honesty red line, exactly like Phase 139's
  approve-door and Phase 138's run-end honesty: the system must be honest about what it
  hid, and must always leave a path to the hidden thing.

</specifics>

<deferred>
## Deferred Ideas

- **Per-user budget override** — start global (`app_settings`); a per-user Settings knob
  can be added later via the standard app→user override pattern. (D-04.)
- **Always-on minimum-relevance floor** (drop clearly-irrelevant skills even under budget)
  — explicitly rejected for this phase (D-03); revisit only if real usage shows small
  catalogs still confusing the model.
- **SEED-093 — Trigger Tuner scoring-honesty residuals (WR-04/05/06).** REQUIREMENTS.md
  tags these "fold into TRIG-02 or a dedicated tuner-polish phase." Routing decision:
  **NOT folded here** — they are Trigger Tuner *offline scoring/UI* concerns, a different
  surface from this live backend dispatch filter. Route to a dedicated tuner-polish phase.
- **Preceding-turn context window for the query embedding** — a richer multi-turn relevance
  signal for follow-ups; default to latest-turn-only, revisit if recall suffers.

### Reviewed Todos (not folded)
None — no pending todos matched this phase (todo.match-phase returned no scope overlap).

*Reported-bugs cross-check:* swept all `status: open` + `surface: Agentic-RAG` reports;
none overlap this phase's domain (skill-catalog filtering / token budget). Closest skills
bug (BUG-260706-01) is a Phase 139 SI-02 version-pointer UI issue — unrelated. Nothing to
fold.

</deferred>

---

*Phase: 140-smart-dispatch-relevance-pre-filter-stretch*
*Context gathered: 2026-07-07*
