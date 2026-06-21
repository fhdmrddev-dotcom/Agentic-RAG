# Phase 115: Virtual Folders — Agent Tool - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Make saved views and metadata queries **answerable in chat** — the agent runs a saved
view (or an ad-hoc metadata query) as a registered tool to answer a question, extending
the M-Files folderless story into the conversational surface.

**Backend only** (ROADMAP "UI hint: no" — no UI, no G-2 sketch). This phase adds **one new
agent tool** that composes the **already-shipped Phase 113/114 resolve path + closed filter
compiler** — it does NOT build a new query path, a new compiler, or a new migration. The
view/filter builder UI + sidebar are Phase 114 (done); document relationships are Phase 116.

**Requirement:** VIEW-07 (from ROADMAP — **no SPEC.md** for this phase). ROADMAP Success
Criteria SC#1–3 are the authoritative acceptance bar — see `.planning/ROADMAP.md` §"Phase 115":
1. The tool runs a saved view / ad-hoc metadata query in chat; registered in `_TOOL_REGISTRY`
   **AND** advertised in `get_tools` (the Phase 101 `render_template` visibility bug guarded —
   verify the model **actually calls it**).
2. Resolves over the **caller's** visible set (own-or-global), never leaks; respects
   `ctx.phase_whitelist` for free via the `dispatch_tool` guard.
3. **SC#10 4-axis cross-provider UAT** (native-7 × multi-tool × parallel-thread × long-message),
   authored in VALIDATION.md.

</domain>

<decisions>
## Implementation Decisions

### Tool surface & modes
- **D-115-1 (One tool, two modes — saved-view OR ad-hoc filter):** A **single** agent tool
  accepts EITHER a **saved view by NAME** (not UUID — the model never sees UUIDs) OR an **inline
  metadata filter** (the Phase 113/114 `ViewFilter` AST: flat `op:"and"` + list of
  `{field, op, value}` conditions). Both modes resolve through the **SAME** 113/114 resolve
  function + closed `OPERATOR_REGISTRY` compiler — no new query path, no compiler fork. *Rejected:*
  two separate tools (+2 toolbox slots — costs the Google/MiniMax `max_tools` budget); saved-views-only
  (drops the ad-hoc capability ROADMAP SC#1 explicitly names "*or an ad-hoc metadata query*").
  - **Cross-provider arg design (load-bearing):** the polymorphic "view name XOR filter" argument
    must be a CLEAR discriminated shape weak models can fill — see the OPEN `minimax-m3-invalid-tool-args-400`
    report. Prefer an explicit either/or (a `view` field XOR a `filter` field, with a mode hint)
    over one overloaded field. Researcher/planner own the exact schema.

### Discoverability
- **D-115-2 (Self-listing "catalog" mode — the SAME tool, blank/unknown call):** Called with **no
  concrete selection** (no view name AND no filter), or with an **unknown view name**, the tool
  returns a **catalog**: the caller's saved views (name + description + live count) **+** the
  filterable fields (built-ins ∪ enabled custom defs, own+global; `_`-prefixed keys excluded per
  D-111-9 / D-113-8). The model then re-calls with a concrete choice. Discovery lives **inside the
  tool** → **no system-prompt seam, no per-turn token bloat, no touch to the shared chat path**, and
  it is robust cross-provider. The catalog is a **mode of the one tool, not a second tool** (+1 to the
  toolbox, not +2).
  - The catalog's field list reuses the **SAME whitelist source the 113 compiler validates against**
    (`metadata_field_service` / `metadata_field.py` `_BUILTINS`), so "what the catalog advertises" ≡
    "what the compiler accepts" — no drift.

### Result shape for chat
- **D-115-3 (Newest-N + TRUE total count + compact rows):** A concrete resolve returns up to **N**
  (default ~20; hard-capped, e.g. ≤50; **N as an optional tool arg**) **newest-first** matching
  documents as **compact rows** — `filename` + `document_id` + a small set of key metadata
  (e.g. `document_type`, `date`, `author`/`title`) — **plus the true total count** and an honest
  truncation note ("47 match; 20 newest shown"). `document_id` MUST be present so the agent can chain
  to `read_document`/`analyze_document` and **cite**. *Rejected:* count+filenames-only (forces a second
  call to actually answer); full-listing-every-row (context blowout, risky cross-provider). Reuses the
  Phase 114 additive **count-only resolve mode** (D-114-15) for the total; rows reuse the 113/114
  listing materialization.
- **D-115-4 (Citable answers):** the tool surfaces `source_refs` (`{document_id, filename}`) for the
  returned docs, mirroring `_handle_search_documents`, so a view-answer renders as citable in chat. A
  listing has no chunk passage, so `source_refs` (not full chunk-`citations`) is the honest shape —
  planner confirms richness.

### Boundary vs existing tools
- **D-115-5 (Distinct exhaustive-listing lane):** the tool is **named + described** as "**list /
  enumerate ALL documents matching a saved view or exact metadata criteria — complete, deterministic,
  no semantic ranking, no query string.**" The description explicitly contrasts it with
  `search_documents` (semantic, ranked, needs an NL query, top-K) and `query_documents` (free
  text-to-SQL), so the model picks it for "show me all X" / "how many X" / "open my Invoices view." This
  is **additive** — `search_documents`' existing `metadata_filter` arg STAYS (shared path untouched, no
  cross-provider regression — [[feedback-no-cross-provider-regressions]]).

### Leak-safety, whitelist & visibility (carried from 113/114 — reaffirmed, reached via the SAME resolve fn)
- **D-115-6 (Per-viewer leak-safe resolution):** the tool resolves over the **caller's** visible set
  (own docs + globally-visible-folder docs), applies the filter, returns the caller's matches. A seeded
  global view yields **different results per caller**. A view the caller can't see → routed to the
  catalog / "no such view" path, **never an existence leak**. This is the D-113-4 contract — **verified
  LIVE in secure-phase** (the real two-user leak test, not the RLS/DEFINER label — the D-102 / D-110-5
  "static would false-green" lesson).
- **D-115-7 (`phase_whitelist` is FREE — SC#2):** the `dispatch_tool` guard
  (`tool_dispatcher.py:2424`) already refuses a non-whitelisted tool; `None` in Deep Mode = a literal
  no-op (byte-identical). **No new whitelist code** — the tool simply must NOT be special-cased around
  the guard.
- **D-115-8 (Registry + advertised schema — guard the Phase 101 visibility bug — SC#1):** the tool MUST
  be in `_TOOL_REGISTRY` (`tool_dispatcher.py:2353`) **AND** in the default `get_tools()` assembly list
  (`openai_service.py:876-882`) so the **Deep-mode** model actually sees + calls it. This is the INVERSE
  of `render_template`, which is deliberately harness-only (in the registry but NOT in `get_tools`).
  Acceptance = the model **actually invokes it live**, not just "it's registered."

### Relative dates (carried from 114)
- **D-115-9 (Reuse the 114 server-clock resolver; do NOT re-derive windows):** relative-date operators
  ("expiring within N days") recompute "today" from the **server clock at resolve time** inside the SAME
  resolve function (D-114-16). The agent tool inherits live recompute **for free** by reusing that
  resolver — it MUST NOT re-implement window derivation.

### Audit, migration, naming (Claude's discretion — locked)
- **D-115-10 (Audit via reuse — no new action, no migration):** a tool call writes the **existing
  `search.query`** audit action, tagged with metadata (`via:"view"`, the `view_id`/filter summary,
  matched `document_ids`) via the same fire-and-forget `ctx.spawn(write_audit_entry(...))` pattern as
  `_handle_search_documents`. This avoids a new audit-enum migration + the Phase 110 frozenset-sync /
  boot-guard dance. (A first-class `view.run` audit signal for Phase 119 governance can land later as a
  deliberate additive migration if product asks.)
- **D-115-11 (No new SQL migration):** the tool composes the LIVE 113/114 resolve path + compiler + the
  live `document_views` table. **Zero schema change.**
- **D-115-12 (Tool name = planner discretion within the distinct-lane spirit):** working name
  `query_documents_by_view`; final name + description wording set by planner/researcher per
  cross-provider tool-selection research (D-115-5). Whatever the name, it must read as "exhaustive
  metadata listing," never "search."

### SC#10 4-axis UAT (locked by ROADMAP SC#3 — flagged for VALIDATION.md authoring)
- **D-115-13 (UAT axes the researcher/planner MUST cover):** native-7 cross-provider (OpenAI, Anthropic,
  Google, DeepSeek, Moonshot, Z.ai-GLM, MiniMax + OpenRouter — [[feedback-cross-provider-full-native-roster]]);
  **multi-tool** (e.g. the view tool + `search_documents` in one prompt); **parallel-thread**;
  **long-message**. **Watch item:** the OPEN `minimax-m3-invalid-tool-args-400` report — the MiniMax row
  is where it reproduces or is confirmed (this phase doesn't fix it, but the new polymorphic arg must not
  make it worse — D-115-1).

### Claude's Discretion
- Exact tool name + JSON-schema arg shape (the view-name-XOR-filter discriminator), the **N** default +
  hard cap, **which** key metadata fields ride each compact row, and whether catalog mode is the same
  call with empty args vs an explicit `list_views:true` flag — all planner/researcher discretion within
  the decisions above.
- Whether the catalog returns per-view counts **eagerly** (a resolve per view) or **lazily/omitted** at
  scale (mirror D-114-8 lazy/cached) — researcher confirms cost at ~10k docs.
- `source_refs` vs richer citation objects (D-115-4).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & success criteria (read FIRST — no SPEC.md for this phase)
- `.planning/ROADMAP.md` §"Phase 115: Virtual Folders — Agent Tool" — authoritative goal, VIEW-07, and
  SC#1–3 (registry + advertised `get_tools` schema + verify-the-model-calls-it; caller-scoped leak-safe;
  SC#10 4-axis cross-provider UAT).
- `.planning/REQUIREMENTS.md` — VIEW-07.
- `CLAUDE.md` §"UAT scoreboard recipe (MANDATORY)" — the SC#10 4-axis bandwidth table (cross-provider /
  multi-tool / parallel-thread / long-message); UAT rows authored under VALIDATION.md, not PLAN tasks.

### The agent-tool seam (the net-new wiring — read before touching it)
- `backend/app/services/tool_dispatcher.py` — `_TOOL_REGISTRY` (line **2353** — add one handler line),
  `dispatch_tool` (line **2417**, the `phase_whitelist` guard at **2424** = SC#2 for free), the
  `ToolContext` dataclass (lines 59-114 — `current_user`, `folder_subtree_ids`, `user_settings`,
  `supabase`, `pool`, `spawn` for audit), and `ToolResult` (118 — `result`/`source_refs`/`citations`).
- `backend/app/services/tool_dispatcher.py:173` `_handle_search_documents` — **the closest handler
  analog**: caller-scoped query, the Phase 098 scope-clip + `scope_violation` emit, `source_refs`/
  `citations` accumulation, and the fire-and-forget `search.query` audit (the D-115-10 reuse target).
- `backend/app/services/tool_dispatcher.py:1515` `_handle_render_template` (+ the registry note at
  **1160-1175**) — the **G-5 "new tool = handler + ONE `_TOOL_REGISTRY` line; threads.py untouched"**
  contract; ALSO the Phase 101 visibility-bug exemplar (registered but NOT in `get_tools` → harness-only).
  D-115-8 is the INVERSE: this tool MUST be in `get_tools`.
- `backend/app/services/openai_service.py:873` `get_tools()` — the advertised default tool-schema list
  (assembly at **876-882**). **Add the new tool's schema here** (SC#1). `SEARCH_DOCUMENTS_TOOL` schema at
  `openai_service.py:20`, `RENDER_TEMPLATE` schema at `:528` are the schema-shape analogs.
  `apply_tool_budget` (**892**) + `get_explorer_tools` (**965**) show the harness/explorer filters.

### The Phase 113/114 resolve path the tool REUSES (do NOT fork)
- `backend/app/api/document_views.py` — CRUD + `GET /document-views/{id}/resolve` (`_build_whitelist`
  ~:72, `resolve_view` ~:201, `_apply` query builder ~:251, the count-only path from D-114-15). The agent
  tool calls **this same resolution logic** (extract the shared resolver if needed for in-process reuse,
  rather than HTTP self-call — planner's call).
- `backend/app/services/view_filter_compiler.py` — the closed `OPERATOR_REGISTRY` + `@register_operator`
  + `compile_filter` + `validate_fields` (the "Phase 114 SEAM" at line 79; full operator set after 114).
  The ad-hoc-filter mode compiles through this.
- `backend/app/models/document_view.py` — the `ViewFilter` / `ViewCondition` AST (flat `op:"and"` +
  `{field, op, value}`). The tool's inline-filter arg IS this shape (D-113-6 — no new AST).
- `backend/app/services/document_view_service.py` — view CRUD service (own-scoped; `is_global=false`
  forced) — the saved-view lookup-by-name source.
- `backend/app/models/metadata_field.py` (`_BUILTINS` ~:17, `field_type` ~:26) +
  `backend/app/services/metadata_field_service.py` — the **field-whitelist + types** the catalog
  advertises and the compiler validates against (own+global; `_`-keys excluded).

### Prior-phase decisions to honor
- `.planning/phases/113-virtual-folders-filter-compiler-equality-views-backend/113-CONTEXT.md` — D-113-1
  (complete listing newest-first + count), D-113-4 (per-viewer leak-safe; 404-not-403), D-113-6/7/8 (AST
  shape fixed; flat AND; closed registry + whitelist + bound literals, no eval/interpolation).
- `.planning/phases/114-virtual-folders-range-date-filters-view-builder-sidebar/114-CONTEXT.md` — D-114-10
  (case-insensitive text matching), D-114-15 (additive count-only resolve), **D-114-16 (relative-date
  "today" derived server-side at resolve time — the explicit 114→115 handoff; reuse, don't re-derive)**.
- STATE.md / `.planning/phases/110-dm-foundations/110-CONTEXT.md` — the DM RLS shape + the "static would
  false-green → verify leak-safety LIVE" lesson (applies to the secure-phase leak test).

### Reported bug (watch item, not folded)
- `.planning/reported-bugs/minimax-m3-invalid-tool-args-400.md` — OPEN; `backend/provider-minimax`,
  `backend/tool-dispatch`. The new polymorphic tool arg must not worsen it; the SC#10 MiniMax row is the
  observation point.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`_handle_search_documents` (`tool_dispatcher.py:173`)** — clone the handler shape: caller-scoped
  resolution, `source_refs`/`citations`, and the fire-and-forget `search.query` audit (D-115-10 reuse).
- **`document_views.py` resolve + `_apply` + count-only path** — the exact resolution the tool runs;
  reuse in-process (extract a shared resolver if the logic lives only in the route).
- **`view_filter_compiler.py` (`OPERATOR_REGISTRY`)** — compiles the ad-hoc-filter mode; the full 114
  operator set is already registered.
- **`metadata_field_service` / `metadata_field.py` `_BUILTINS`** — the catalog's field list + the
  compiler's whitelist (single source — no drift).
- **`get_tools()` assembly (`openai_service.py:876`)** + a `*_TOOL` schema constant (mirror
  `SEARCH_DOCUMENTS_TOOL` `:20`) — where the new tool becomes Deep-visible (SC#1).
- **`ToolResult.source_refs`** — the citable-answer channel.

### Established Patterns
- **G-5 extension contract** — new tool = one `_handle_*` + one `_TOOL_REGISTRY` line; `threads.py`
  untouched (Phase 083/101 precedent).
- **`dispatch_tool` whitelist guard** — `phase_whitelist`-None = byte-identical Deep dispatch (SC#2 free).
- **Per-viewer leak-safe resolution; 404/not-found-not-403; `_`-keys excluded; bound literals, no
  f-string SQL** (D-113-4/8 — the SC#4 injection invariant stays green by reusing the 113/114 compiler).
- **`run_in_threadpool` / `aexec`** around every sync supabase-py call in the async handler (D-v2.5-01).
- **One UX, N adapters** — the tool surfaces in the shared SSE/tool vocabulary; **no per-provider branch**
  ([[feedback-provider-uniform-ux]]).

### Integration Points
- `_TOOL_REGISTRY` (+1 line) and `get_tools()` (+1 schema) — the ONLY two wiring sites; `threads.py`
  stays untouched.
- The handler delegates to the **existing** 113/114 resolver + compiler — additive, no new query path,
  no migration.

</code_context>

<specifics>
## Specific Ideas

- **The M-Files folderless story lands in chat** — "open my Invoices view" / "how many contracts expire
  in 90 days" answered conversationally is the headline value; the tool is the conversational mouth of the
  113/114 virtual-folders work.
- **One tool, two modes, one resolve path** — saved-view-by-name OR ad-hoc filter, both through the SAME
  compiler/resolver; minimal toolbox growth, zero new query surface.
- **Honesty is load-bearing** — newest-N + the TRUE total + an explicit truncation note (never imply the
  listing is complete when capped); caller-scoped results only; `source_refs` so the answer is citable.
- **Self-documenting** — the catalog mode means the model discovers views + fields by calling the tool,
  not by prompt injection or guessing.

</specifics>

<deferred>
## Deferred Ideas

- **First-class `view.run` audit action** (for Phase 119 Document Governance Health "most-run views" /
  usage signals) — deferred; v1 reuses `search.query` tagged `via:"view"` (D-115-10). Re-open if
  governance wants a distinct usage metric → additive migration + frozenset sync.
- **Nested OR/NOT boolean trees + metadata→pseudo-folder grouping** — out per 113/114 / REQUIREMENTS
  ("flat AND-list first"); `one_of` covers OR-over-one-field.
- **User-created shared/global views ("share my view")** — out of v3.0 (globals stay seed-only; D-113-3).
- **A dedicated UI affordance for the agent tool** — none; backend-only phase (Phase 119 surfaces
  governance views, Phase 114 owns the sidebar).
- **Fixing `minimax-m3-invalid-tool-args-400`** — a pre-existing MiniMax tool-arg-parsing issue, NOT this
  phase's scope; left OPEN. The SC#10 MiniMax UAT row observes it.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` (todo.match-phase score 0.6, matched only on the keywords
  "template/run/schema") — an NL→workflow-authoring spike, unrelated to the virtual-folders agent tool.
  **Not folded** (same call as Phases 113 and 114).

</deferred>

---

*Phase: 115-virtual-folders-agent-tool*
*Context gathered: 2026-06-20*
