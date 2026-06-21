# Phase 114: Virtual Folders — Range/Date Filters + View Builder + Sidebar - Research

**Researched:** 2026-06-19
**Domain:** Metadata-filter compiler extension (range/date operators) + Postgres GENERATED STORED typed-column promotion + a no-DSL React filter/view builder UI + sidebar "Views" group
**Confidence:** HIGH (the two hard unknowns R-114-A/B are pre-resolved in CONTEXT and confirmed against the live codebase; every file:line claim below was read this session)

## Summary

Phase 114 completes virtual folders by widening three already-shipped seams, not by inventing new architecture. The Phase 113 compiler (`view_filter_compiler.py`) was built as a closed `OPERATOR_REGISTRY` precisely so 114 registers `gte`/`lte`/`one_of`/`contains`/`is_empty`/relative-date operators additively. The one genuine schema change is two `GENERATED ALWAYS AS (...) STORED` typed columns (`document_type` → `lower()` text, `date` → ISO-regex-guarded `::date`) plus btree indexes — a pure derivation over existing `documents.metadata` that auto-backfills every row at `ALTER TABLE` time with no backfill job, no dual-write, and no re-extraction. The frontend is net-new but composes existing primitives: the inline chip-strip filter bar (sketch 029-A), the operator-encodes-direction relative-date control (030-A), a "Views" sidebar group built from a shared `NavRow` extracted from `FolderNode` (031-A + 033-A), and the sidebar→rail layout collapse (032-A).

The one place the Phase 113 "purely additive" promise bends is R-114-A: case-insensitive text matching (D-114-10) forces the compiler output to widen from "one `metadata @> $1::jsonb` containment dict" to "an ordered list of bound WHERE-fragment descriptors." This is a deliberate, tested contract change. Crucially the resolution is mostly query-value-side: `document_type`/`language` are *already* stored lowercase at both write paths (ingest `documents.py:1579-1582`, manual edit `:1422-1426`) and the extraction prompt asks for a lowercase noun (`embedding_service.py:147-148`), exactly mirroring the chat path that already lowercases its query value (`retrieval_service.py:265-267`) — which the view-resolve path (`document_views.py:251-254`) does NOT yet do. So most of the fix is "lowercase the view query value, like chat does"; full `lower()=lower()`/`ILIKE`-on-both-sides is reserved for the genuinely un-normalized free-text fields (`title`/`author`/`summary`). The three Phase 113 containment-dict unit tests get rewritten to the fragment shape; the SC#4 injection test stays byte-for-byte green.

**Primary recommendation:** Register the new operators via the documented `view_filter_compiler.py:79` seam, emitting **bound WHERE-fragment descriptors** (not a containment dict) that `resolve_view._apply` consumes across two legs — promoted typed columns via supabase-py PostgREST builders (`.eq`/`.gte`/`.lte`/`.ilike`/`.is_`/`.or_`), custom-field casts/`ILIKE` via a whitelisted parameterized leg with field names sourced ONLY from the live whitelist. Ship the two GENERATED STORED columns + btree indexes in one new migration. Add a count-only resolve mode (`select("id", count="exact") + head=True`, own+global DISTINCT dedupe) for the live builder count and the per-view sidebar badges. Derive relative-date "today" from the server clock inside the resolve function so Phase 115 inherits live-recompute for free.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Operator → WHERE-fragment compilation | API/Backend (`view_filter_compiler.py`) | — | Pure transform; closed registry; no I/O. Belongs at the compiler, never the client. |
| Typed-column promotion + indexing | Database (migration + GENERATED STORED) | — | Derivation must be at write-time in Postgres so all 3 write paths (upload/reingest/reextract) inherit it for free; no app dual-write. |
| Case-insensitive matching | API/Backend (resolve value-lowercasing) + DB (`ILIKE`/`lower()`) | — | Mirrors `retrieval_service.py:265-267`; the security boundary (field-name whitelist, bound literals) is server-only. |
| Relative-date "today" derivation | API/Backend (`resolve_view`, server clock) | — | D-114-16: server-side at resolve time so a saved view drifts with the calendar AND Phase 115's agent-tool reuses the same resolver. Never client-baked, never save-time-baked. |
| Live match-count + per-view count badges | API/Backend (count-only resolve mode) | Frontend (debounce + cache) | Count correctness (own+global DISTINCT dedupe, leak-safety) is server-owned; debouncing/caching is a client concern. |
| Inline filter-bar builder | Frontend (Documents page) | API (resolve/count endpoints) | Pure UI composition over the resolve endpoint; no business logic client-side. |
| Sidebar "Views" group + shared `NavRow` | Frontend | API (`GET /document-views`) | Render + selection state; the leak-safe data already comes from 113's list endpoint. |
| Sidebar→rail layout collapse | Frontend (Browser, session-persisted) | — | Pure layout/UX; session-storage persisted; shared shell inherited by 117/118. |
| "Move to folder" row action | Frontend (reuse `MoveToFolderDialog`) | API (`PATCH /documents/{id}/move`) | Existing endpoint + existing dialog; zero net-new backend. |

## Standard Stack

This phase adds **zero new third-party packages**. Everything composes the already-installed stack.

### Core (already installed — verified in codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `supabase` (supabase-py) | (pinned in `backend/requirements.txt`) | PostgREST query builder: `.eq`/`.gte`/`.lte`/`.ilike`/`.in_`/`.or_`/`.is_`/`.contains`/`count="exact"` | Already the sole DB access layer; all new operator legs are builder calls, not raw SQL. `[VERIFIED: codebase grep — backend/app/api/*.py]` |
| FastAPI | (pinned) | Resolve/count routes on the existing `/document-views` router | Existing router; additive endpoints only. `[VERIFIED: document_views.py]` |
| Pydantic v2 | (pinned) | AST model widening (`ViewCondition.op` Literal, optional `value2`/`values`/`unit`) | `Literal`-discriminated reject-unknown-op is the existing parse-time guard. `[VERIFIED: document_view.py]` |
| React + Vite + Tailwind + shadcn/ui | (pinned) | Filter bar, relative-date control, Views sidebar, NavRow | Aether Deep Midnight design system; existing primitives (`DropdownMenu`, `Tooltip`, `Select`, `Dialog`). `[VERIFIED: FolderNode.tsx, MoveToFolderDialog.tsx]` |
| `lucide-react` | (pinned) | Funnel icon (Views), existing folder icons | `Filter`/`Funnel` icon already in the lucide set used by `FolderNode.tsx`. `[CITED: lucide.dev]` |

### Supporting (no install — Postgres native features)
| Feature | Purpose | When to Use |
|---------|---------|-------------|
| Postgres `GENERATED ALWAYS AS (...) STORED` | Derive typed `document_type`/`date` columns from `metadata` jsonb at write time | The R-114-B answer — auto-backfills existing rows, no job/trigger/dual-write. `[CITED: postgresql.org/docs/current/ddl-generated-columns.html]` |
| Postgres btree index on a generated column | Index the promoted columns so range/date comparisons use an index (SC#3) | Generated STORED columns are physically materialized → standard btree applies. `[CITED: richyen.com/postgres/2026/05/11/generated_columns_jsonb.html]` |
| PostgREST `count="exact"` + `head=True` | Count-only resolve mode (D-114-15) — Content-Range header, no row materialization | Live builder count + per-view sidebar badges at ~10k docs. `[VERIFIED: codebase — reembed_service.py:194-200, audit.py:128]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff (why rejected) |
|------------|-----------|-------------------------|
| GENERATED STORED columns | AFTER INSERT/UPDATE trigger | Trigger needs a backfill UPDATE over all rows + maintenance; generated column auto-backfills at ALTER and self-maintains. Rejected per R-114-B resolution. |
| GENERATED STORED columns | Application dual-write in all 3 write paths | Triplicated write logic + drift risk + a backfill job; the audit explicitly rejected this. |
| `citext` extension for `document_type` | `lower()` generated column + btree | `citext` needs the extension enabled and changes column type semantics app-wide; `lower()` generated column is local, indexable, and the data is already lowercase. Use `lower()`. |
| A parameterized RPC for the custom-field cast leg | Whitelisted supabase-py builder leg (`.gte`/`.lte`/`.ilike` on `metadata->>'field'`) | An RPC is heavier and needs its own migration; the builder leg with field-names-from-whitelist-only is sufficient and stays SC#4-safe. **Pick the builder leg unless a cast (`(metadata->>'f')::numeric`) cannot be expressed via PostgREST — see Open Questions Q1.** |

**Installation:** None. (Verify no version drift before planning: `cd backend && pip show supabase | grep Version`.)

## Package Legitimacy Audit

> Phase 114 installs **no external packages**. No legitimacy gate required.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none) | — | N/A — phase is additive over the installed stack |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────── FRONTEND (Documents page) ───────────────────────┐
                        │                                                                          │
 user composes filter   │   FilterBar (chip strip, 029-A)                                          │
 ──────────────────────▶│     row: field ▾ → type-aware operator ▾ → value (+ relative stepper)    │
                        │     ─ debounced (300ms) ──▶ GET /document-views/resolve?count_only=1 ────┼──┐
                        │     "N documents match" (amber at zero)                                  │  │
                        │     [Save as view] ──▶ POST /document-views {name, filter_expr} ─────────┼──┼─┐
                        │                                                                          │  │ │
                        │   Sidebar (FolderTree + NavRow, 031-A/033-A)                             │  │ │
                        │     Folders group  · NavRow(amber folder, count, New-sub/Rename/Delete)  │  │ │
                        │     Views   group  · NavRow(funnel, lazy count badge, Edit/Rename/Del) ──┼──┤ │   per-view count
                        │       click view ──▶ load filter_expr back into FilterBar ───────────────┼──┘ │   (count_only)
                        │   panel open? sidebar→50px rail (032-A, session-persisted)               │    │
                        └──────────────────────────────────────────────────────────────────────────┘    │
                                                                                                         │
 ┌───────────────────────────────────── API / BACKEND (document_views.py) ──────────────────────────────┘
 │
 │   POST/PATCH /document-views ──▶ validate_fields(filter_expr, whitelist)  ── unknown/_field → 422
 │                                  (whitelist = DocumentMetadata.model_fields ∪ enabled custom defs)
 │
 │   GET /document-views/{id}/resolve  (+ optional count_only)
 │     1. get_view(id, caller) ── own-OR-global → 404-not-403 on miss (D-113-4)
 │     2. compile_filter(AST) ──▶ [WHERE-fragment descriptors]   ◀── NEW: widened output (R-114-A)
 │            relative-date ops read SERVER CLOCK here (D-114-16)  ◀── 115 reuses this resolver
 │     3. resolve folder_scope → caller-visible subtree list (D-113-5, Pitfall 1: list not set)
 │     4. _apply(q): two legs
 │          ├─ promoted typed-col leg: q.eq/.gte/.lte/.is_/.or_  on document_type_norm / date_typed
 │          └─ custom-field leg: q on metadata->>'field' (field from whitelist ONLY), ILIKE/cast
 │        applied to BOTH: own leg  .eq(user_id, caller) .eq(is_latest, True)
 │                         global leg .in_(folder_id, global_folder_ids) .eq(is_latest, True)
 │     5. merge own+global, DISTINCT dedupe by id (VIEW-06), newest-first  ── OR count via count="exact"
 │
 └───────────────────────────────────── DATABASE (migration NNN) ───────────────────────────────────────
        documents.metadata jsonb  (GIN idx, migration 007 — unchanged)
        + document_type_norm  GENERATED ALWAYS AS (lower(metadata->>'document_type')) STORED   + btree
        + date_typed          GENERATED ALWAYS AS (CASE WHEN metadata->>'date' ~ '<iso>'
                                                   THEN (metadata->>'date')::date ELSE NULL END) STORED + btree
        (auto-backfills every existing row at ALTER TABLE; no job, no re-extraction)
```

### Recommended Project Structure (net-new files)
```
backend/app/services/
├── view_filter_compiler.py        # EXISTING — widen output to fragment descriptors
└── view_operators_extra.py        # NEW — @register_operator gte/lte/one_of/contains/is_empty/relative-date
backend/app/api/
└── document_views.py              # EXISTING — _apply two-leg; count_only mode; relative-date server clock
backend/app/models/
└── document_view.py               # EXISTING — widen ViewCondition.op Literal; add optional value2/values/unit
supabase/migrations/
└── NNN_view_typed_columns.sql     # NEW — 2 GENERATED STORED cols + 2 btree indexes
frontend/src/components/ingestion/
├── NavRow.tsx                     # NEW — shared row primitive (extracted from FolderNode)
├── FilterBar.tsx                  # NEW — chip-strip builder (029-A)
├── ConditionPopover.tsx           # NEW — field→operator→value editor (030-A)
├── RelativeDateControl.tsx        # NEW — [N][unit] stepper + resolved-window readout
├── ViewsGroup.tsx                 # NEW — Views sidebar group (built from NavRow)
├── FolderNode.tsx / FolderTree.tsx# EXISTING — refactor onto NavRow (033-A)
├── DocumentList.tsx               # EXISTING — net-new responsive column-shedding (032-A)
└── (pages/IngestionPage.tsx)      # EXISTING — sidebar→rail collapse on panel open (032-A)
```

### Pattern 1: Widened compiler output — bound WHERE-fragment descriptors (R-114-A)

**What:** `compile_filter` no longer folds everything into one `{field: value}` containment dict. It returns an ordered list of typed descriptors that `_apply` translates into supabase-py builder calls. The descriptor is a plain dataclass/dict (no SQL), so the compiler stays a pure module (no I/O, no f-string SQL).

**When to use:** Every operator. Even `eq` becomes a descriptor (so a single dispatch path handles all operators).

**Example (descriptor shape — illustrative contract, planner finalizes the dataclass):**
```python
# Source: derived from view_filter_compiler.py + supabase-py builder semantics
# Each operator fn returns a Fragment, not a dict-contribution.
@dataclass
class Fragment:
    leg: Literal["typed", "custom", "containment"]  # which _apply leg consumes it
    field: str           # whitelisted field name (NEVER interpolated into raw SQL)
    builder: str         # "eq" | "gte" | "lte" | "ilike" | "is_" | "or_" | "contains"
    value: object        # bound literal (rides as a PostgREST param, SC#4)
    value2: object = None # for "between"
```
The compiler maps each AST condition through the registry to a `Fragment` (or list, for `one_of` → an `.or_(...)` group); `_apply` walks the list and chains the builder calls. Containment (`.contains`) survives only for promoted typed-column exact + boolean/number `eq` where case-sensitive exact is correct.

### Pattern 2: Relative-date "today" derived server-side at resolve (D-114-16 — the 114→115 handoff)

**What:** Relative operators carry `value` = N and `unit` ∈ {days, weeks, months}; the window is computed from `datetime.now(timezone.utc).date()` **inside `resolve_view`**, never at save and never on the client.
**When to use:** `within next N` and `older than N`.
**Example:**
```python
# Source: D-114-5 semantics + retrieval_service window-cutoff idiom
from datetime import date, timedelta
def _relative_window(op: str, n: int, unit: str) -> tuple[str, str] | tuple[str, None]:
    today = date.today()  # server clock; recompute every resolve (drifts with calendar)
    span = n * {"days": 1, "weeks": 7, "months": 30}[unit]  # months ≈ 30d (per sketch 030)
    if op == "within_next":   # D-114-5: today → today+N, EXCLUDE already-overdue
        return (today.isoformat(), (today + timedelta(days=span)).isoformat())  # date >= today AND date <= today+N
    if op == "older_than":    # document age: date < today-N
        return (None, (today - timedelta(days=span)).isoformat())              # date <= today-N
```
`within_next` compiles to TWO fragments on `date_typed`: `.gte(today)` AND `.lte(today+N)` — the `.gte(today)` lower bound is what excludes overdue (D-114-5). **Document for Phase 115:** the agent-tool MUST call this same `resolve_view`/`_relative_window` so windows recompute live; it must NOT re-derive its own window math.

### Pattern 3: Count-only resolve mode (D-114-15)

**What:** An additive `count_only` flag on the resolve path that runs `.select("id", count="exact").limit(1)` per leg instead of `.select("*")`, then returns the DISTINCT-deduped count — never full-row materialization.
**When to use:** The live builder "N match" preview + per-view sidebar count badges.
**Subtlety (Pitfall 4 below):** the own leg and global leg can overlap (a caller's own doc living in a globally-visible folder appears in both legs). The full-resolve path dedupes by id across both leg result sets. A naive `own.count + global.count` double-counts the overlap. See Pitfall 4 for the correct approach.

### Anti-Patterns to Avoid
- **Baking the relative-date window at save time** — a saved "expiring within 90 days" view would freeze its dates. Must recompute server-side every resolve (D-114-16). `[from CONTEXT D-114-16]`
- **`(metadata->>'date')::timestamptz` in a generated column** — `text::timestamptz` is NOT immutable (reads session timezone) and Postgres rejects it in a generation expression. Use `(...)::date` which IS immutable. `[CITED: postgresql.org message-id CA+bJJbz — "Cast to timestamp uses current session time zone... not immutable"]`
- **Cloning the flawed `FolderNode` for Views** — D-114-13 / sketch 033: extract ONE `NavRow` and build BOTH from it; cloning amplifies the verified debt (no counts, opaque G pill, touch-invisible actions).
- **Materializing full listings for the live count** — use the count-only mode (SC#3 at ~10k docs × N views × keystrokes).
- **An on-screen operator/type matrix** — deleted in sketch 030; the control adapts, one quiet hint suffices.
- **Interpolating a field name into raw SQL on the custom-field leg** — field names come ONLY from the live whitelist; values are bound params (SC#4 invariant). `[from D-113-8 / CONTEXT R-114-A]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Typed-column sync with metadata | A trigger + backfill job, or app dual-write | `GENERATED ALWAYS AS (...) STORED` | Auto-backfills + self-maintains; the R-114-B resolution. `[CITED: postgresql.org generated-columns]` |
| Range/`ILIKE`/`IN` SQL | f-string SQL fragments | supabase-py `.gte`/`.lte`/`.ilike`/`.in_`/`.or_`/`.is_` builders | Bound params by construction (SC#4); already the codebase idiom. `[VERIFIED: audit.py:34, knowledge_health.py]` |
| Counting at scale | `len(.select("*").execute().data)` | `.select("id", count="exact").limit(1)` | Plain select caps at PostgREST max-rows (1000) → silent undercount; the exact `reembed_service.py:189-201` lesson. `[VERIFIED]` |
| Folder-subtree resolution for `folder_scope` | New BFS | `resolve_project_subtree` (harness/scope.py) | Cycle-guarded, owner-scoped, returns a list (not a set — Pitfall 1). `[VERIFIED: scope.py:51-89]` |
| Move-doc-to-folder UI | New dialog | `MoveToFolderDialog` + `PATCH /documents/{id}/move` | Both already exist (Health page); D-114-14 reuses them. `[VERIFIED: MoveToFolderDialog.tsx, documents.py:1304]` |
| Inline name editing | New input component | `FolderNode` inline-rename pattern / `InlineEdit.tsx` | UX-01 named reuse; identical mental model. `[VERIFIED: FolderNode.tsx:151-170]` |
| Per-viewer leak-safe resolution | New scoping | The existing `resolve_view` own+global two-leg | The single most dangerous boundary — already verified live in 113 secure-phase. Extend, don't rewrite. `[VERIFIED: document_views.py:259-290]` |

**Key insight:** Every "hard" piece of Phase 114 already has a shipped, tested analog. The net-new surface area is the operator fragment-mapping + the GENERATED columns + the React builder UI — and even the UI composes shadcn/lucide/`MoveToFolderDialog`/`FolderNode` primitives.

## Operator → Fragment Mapping (DELIVERABLE 1)

The widened compiler emits, per AST condition, one or more `Fragment` descriptors. `_apply` translates each to a supabase-py builder call applied identically on the own leg and the global leg (so VIEW-06 own+global DISTINCT dedupe is preserved). Field-type comes from `metadata_field.py` (`field_type ∈ {string, date, number, boolean, enum}`; built-ins via `DocumentMetadata`).

| Operator | AST shape (additive) | Hot/indexed field (`document_type`, `date`) | Free-text (`title`/`author`/`summary`) | Custom number/date/enum | Survives as `@>` containment? |
|----------|---------------------|---------------------------------------------|----------------------------------------|--------------------------|-------------------------------|
| `eq` | `{op:eq, value}` | `document_type`: `.eq(document_type_norm, lower(v))` (typed col, indexed); `language`: lowercase value, `.eq` on `metadata->>'language'` | `lower(metadata->>'f') = lower(v)` → `.ilike(field, v)` with no wildcards is case-insensitive exact; OR a parameterized `lower()=lower()` leg | bool/number: `.contains("metadata",{f:v})` (exact, **keeps `@>`**); enum: case-insensitive eq | **YES** for bool/number eq + promoted typed-col exact |
| `gte` / `lte` | `{op:gte, value}` | `date`: `.gte/.lte(date_typed, isodate)` (indexed) | n/a (text fields don't get range) | number: `.gte/.lte` on `(metadata->>'f')::numeric` cast (non-indexed); date: cast `::date` | NO — range needs an operator, not containment |
| `one_of` | `{op:one_of, values:[...]}` | `document_type`: `.or_(document_type_norm.eq.v1,document_type_norm.eq.v2,...)` with lowercased values; OR `.in_(document_type_norm, [lowered])` | `.or_(metadata->>f.ilike.v1, ...)` case-insensitive (one OR group over one field, D-113-7) | enum: `.in_` lowercased | NO — multi-value OR |
| `contains` | `{op:contains, value}` | `document_type`: `.ilike(document_type_norm, %v%)` | `.ilike(metadata->>'f', %v%)` — substring, case-insensitive (D-114-11) | string custom: same | NO — `ILIKE %v%` |
| `is_empty` | `{op:is_empty}` | `.or_(metadata->>'f'.is.null, metadata->>'f'.eq.'', metadata->>'f'.eq.'[]')` (absent OR `''`/`[]`, D-114-12) | same | same | NO — null/empty test |
| relative `within_next` | `{op:within_next, value:N, unit}` | `date_typed`: `.gte(today).lte(today+N)` — `.gte(today)` excludes overdue (D-114-5) | n/a | custom date: cast leg, non-indexed | NO |
| relative `older_than` | `{op:older_than, value:N, unit}` | `date_typed`: `.lte(today-N)` | n/a | custom date: cast leg | NO |
| fixed `before`/`after` | (= `lte`/`gte` on a fixed ISO date) | `date_typed`: `.lte/.gte(isodate)` | n/a | cast leg | NO |
| `between` | `{op:between, value, value2}` | `date_typed`: `.gte(value).lte(value2)`; number: cast `.gte/.lte` | n/a | cast leg | NO |

**Two-leg split in `_apply` (preserves VIEW-06 dedupe + SC#4):**
- **Typed/promoted leg** — `document_type_norm`, `date_typed`: native indexed columns; supabase-py `.eq/.gte/.lte/.in_/.or_/.ilike` on the column name (a constant, never user input). Indexed → satisfies SC#3 `EXPLAIN`.
- **Custom-field / free-text leg** — `metadata->>'field'` where `field` ∈ whitelist ONLY (validated at save by `validate_fields`, re-checked at resolve against the same whitelist). Values are bound PostgREST params. Number casts: `(metadata->>'f')::numeric` — **if PostgREST cannot express the cast via `.gte` on a `->>'f'::numeric` selector, fall back to a single parameterized RPC whose ONLY interpolation is the whitelisted field name (Open Q1).**
- **AND across conditions** — chained builder calls on the same query leg (PostgREST ANDs filters), preserving the flat-AND AST (D-113-7). Applied to BOTH the own leg and the global leg, then merged + DISTINCT-deduped exactly as today (`document_views.py:280-286`).

**Compiler purity preserved:** `compile_filter` returns `list[Fragment]` (data only, no SQL). `_apply` is the sole place builder calls happen — keeping the "no f-string SQL anywhere in the compiler" SC#4 invariant. The injection test asserts a payload value rides as a bound literal in the Fragment (and resolves to 0 matches live) — unchanged in spirit, updated to the fragment shape.

## Migration Design (DELIVERABLE 2)

**File:** `supabase/migrations/NNN_view_typed_columns.sql` (next free number; current max is `073`). Apply via **Supabase SQL editor** (or psycopg2 to local :54322 per the 071/072/073 precedent), then `bash scripts/regenerate-full-schema.sh` (no `--reset`). **Never `db push`/`db reset`** (CLAUDE.md). Wrap in `BEGIN; ... COMMIT;`.

**DDL pattern:**
```sql
BEGIN;

-- document_type → lowercased generated column (lower() is immutable → valid in a generation expr)
ALTER TABLE public.documents
  ADD COLUMN document_type_norm text
  GENERATED ALWAYS AS (lower(metadata->>'document_type')) STORED;

-- date → ISO-regex-guarded typed date column. (text::date IS immutable; text::timestamptz is NOT.)
-- A malformed stored date string yields NULL — it breaks neither this ALTER (auto-backfill) nor any future insert.
ALTER TABLE public.documents
  ADD COLUMN date_typed date
  GENERATED ALWAYS AS (
    CASE
      WHEN metadata->>'date' ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (metadata->>'date')::date
      ELSE NULL
    END
  ) STORED;

CREATE INDEX idx_documents_document_type_norm ON public.documents USING btree (document_type_norm);
CREATE INDEX idx_documents_date_typed         ON public.documents USING btree (date_typed);

COMMIT;
```

**ISO regex:** `^\d{4}-\d{2}-\d{2}$` matches the extraction prompt's "ISO 8601 YYYY-MM-DD preferred" contract (`embedding_service.py:147`). It is intentionally strict (date-only) — the typed column is a `date`, not a timestamp. A stored value like `2026-13-99` passes the regex shape but would still fail `::date`; **the regex is necessary but NOT sufficient** — see Pitfall 2. Consider a stricter guard or accept that a regex-passing-but-invalid date would error the generated-column evaluation on that row's next write. Safest: keep the regex AND verify the bad-date test (below) covers a regex-passing-invalid value. *(Open Q2 — the planner decides regex strictness vs. a `to_date`-with-error-tolerance approach.)*

**Immutability facts (load-bearing):**
- `lower(text)` — immutable. ✅ valid in a generation expression. `[CITED: postgresql.org/docs ddl-generated-columns — "only immutable functions"]`
- `(text)::date` — immutable (no session-timezone dependency). ✅ valid. `[ASSUMED — pg_proc marks text→date cast immutable; VERIFY with the bad-date migration test below before shipping]`
- `(text)::timestamptz` — NOT immutable (session timezone). ❌ would be rejected. `[CITED: postgresql.org message-id "Cast to timestamp uses current session time zone... not immutable"]`

**Auto-backfill verification:** Generated STORED columns are computed for every existing row at `ALTER TABLE` time (the column is physically materialized). After applying, confirm:
```sql
SELECT count(*) FILTER (WHERE document_type_norm IS NOT NULL) AS typed_dt,
       count(*) FILTER (WHERE date_typed IS NOT NULL)        AS typed_date,
       count(*)                                              AS total
FROM public.documents;
```
Expect `typed_dt` ≈ rows with a `document_type` and `typed_date` ≈ rows with an ISO `date`. No backfill UPDATE needed.

**EXPLAIN proof (SC#3, ~10k docs):**
```sql
EXPLAIN ANALYZE
SELECT id FROM public.documents
WHERE user_id = '<caller>' AND is_latest = true
  AND date_typed >= CURRENT_DATE AND date_typed <= CURRENT_DATE + 90;
-- Expect: Index Scan / Bitmap Index Scan using idx_documents_date_typed (NOT Seq Scan)
EXPLAIN ANALYZE
SELECT id FROM public.documents
WHERE user_id = '<caller>' AND is_latest = true AND document_type_norm = 'invoice';
-- Expect: Index Scan using idx_documents_document_type_norm
```
**Caveat:** the planner picks a seq scan on a tiny table regardless of indexes — the SC#3 EXPLAIN test MUST run against a ~10k-row seed (the dev DB has ~19 docs). See Validation Architecture → SC#3.

## Relative-Date Server-Side Derivation (DELIVERABLE 3)

- **"today" source:** `datetime.now(timezone.utc).date()` (or `date.today()`), read **inside `resolve_view`** at call time — not at save, not on the client (D-114-16). UTC is the server clock; document this so 115 matches.
- **"expiring within N days" window (D-114-5):** `date_typed >= today AND date_typed <= today + N`. The lower bound `>= today` is the overdue-exclusion — a document whose `date` is in the past (already due) is excluded. "Coming due soon," not "overdue + soon."
- **"older than N days":** `date_typed <= today - N` (document age).
- **fixed before/after:** `date_typed <= D` / `date_typed >= D` for a fixed ISO date `D`.
- **between:** `date_typed >= D1 AND date_typed <= D2`.
- **unit handling:** days / weeks (×7) / months (×30, per sketch 030 — "months count as ≈30 days; the headline dates are the contract").
- **Phase 115 handoff (MUST document in PLAN):** Phase 115's agent-tool resolves a saved view (or ad-hoc metadata query) by calling the **same** `resolve_view` resolver. Because the window is computed inside that function from the server clock, 115 inherits live-recompute for free and MUST NOT re-derive windows. Put a one-line contract note in the resolver docstring: *"Relative-date windows are computed here from the server clock; callers (Phase 115 agent-tool) must reuse this resolver, never re-derive."*

## Count-Only Resolve Path (DELIVERABLE 4)

**Where it slots in:** `document_views.py` — an additive branch in `resolve_view` (or a sibling `resolve_view_count`) gated by a `count_only`/`head` query param. The compiled fragments + folder-scope + `_apply` are identical; only the `.select` differs.

**Per-leg count:**
```python
# own leg
own_count = _apply(
    supabase.table("documents")
    .select("id", count="exact")
    .eq("user_id", caller).eq("is_latest", True)
).limit(1)
# .execute().count gives the exact own-leg count
```
**The dedupe problem (Pitfall 4):** `own_count + global_count` double-counts any caller-owned doc that lives in a globally-visible folder (it matches BOTH `.eq(user_id, caller)` and `.in_(folder_id, global_folder_ids)`). The full-resolve path dedupes by id across legs. Two correct options:
1. **Select ids, dedupe, count in Python** — `.select("id")` on both legs (NOT full `*`), union the id sets, `len(union)`. Cheaper than `*` (one column, no metadata blob) but still transfers ids. Simplest, exactly mirrors the resolve dedupe.
2. **Single-query count** — issue ONE count query over `(own OR in-global-folder)` via `.or_(f"user_id.eq.{caller},folder_id.in.(...)")` + `count="exact" + head=True`, eliminating cross-leg overlap at the DB. Fastest, no Python set. **Recommended** if the `.or_` composes with the fragment filters (verify the PostgREST `.or_` + filter precedence — Open Q3).

**Recommendation:** ship option 1 first (id-set dedupe, provably correct, mirrors the resolve path), measure at ~10k docs; promote to option 2 only if the id transfer is the bottleneck. Either way: NEVER `.select("*")` for a count.

## Frontend (DELIVERABLE 5)

Design contract = sketches 029–033 (all winner A) + the SKILL.md Phase 114 section + the three reference docs. Each piece mapped to its closest existing analog:

| New component | Closest existing analog (file:line) | What to reuse |
|---------------|-------------------------------------|---------------|
| `NavRow.tsx` (shared row primitive, D-114-13) | `FolderNode.tsx:110-256` (the row div: selected styling, icon slot, name/inline-rename, `G` pill at `:183`, hover `MoreHorizontal` menu `:209-253`) | Extract icon-slot · name · count · reachable hover-menu. Folders pass amber folder icon + New-subfolder/Rename/Delete; Views pass funnel icon + Edit/Rename/Delete. **Fix the debt while extracting:** add counts everywhere, tooltip-label the `G` pill, make actions keyboard/touch-reachable, one soft indent guide, ~3-level indent cap (sketch 033-A). |
| `FilterBar.tsx` (chip strip, 029-A) | none direct — compose shadcn `Button`/`Popover` + the chip CSS in `references/virtual-folder-filter-builder.md` | `Where [chip][chip] ＋condition … N match · Save as view`. Save-as-view → inline name input (reuse `FolderNode` inline-rename idiom) → `POST /document-views`. Live count debounced 300ms → count-only resolve. Amber at zero. |
| `ConditionPopover.tsx` (field→op→value, 030-A) | shadcn `DropdownMenu` (as in `FolderNode.tsx:209`) + `Select` (as in `MoveToFolderDialog.tsx:69`) | Type-aware operator menu (operators per `metadata_field.py` field_type — see the mapping table). NO on-screen type matrix (deleted in 030). |
| `RelativeDateControl.tsx` ([N][unit] stepper) | none — net-new; CSS in `references/virtual-folder-filter-builder.md` | `[N][unit ▾]` stepper + live resolved-window readout (`→ Jun 19 – Sep 17`) + "updates automatically" line + overdue-excluded note for `within next`. The readout is computed client-side for PREVIEW only; the server is authoritative at resolve. |
| `ViewsGroup.tsx` (Views sidebar, 031-A) | `FolderTree.tsx:112-196` (the group header + node list) | "Views" header below "Folders"; rows are `NavRow` with funnel icon + lazy/cached count badge (count-only resolve) + Edit/Rename/Delete. Click → load `filter_expr` into `FilterBar`. Empty state: "filter documents and Save as view." `G` pill on seeded globals. |
| "Move to folder" row action (D-114-14) | `MoveToFolderDialog.tsx` (whole) + `HealthDocumentRow.tsx` usage | Add the action to the Documents-page document-row menu; reuse the dialog + `PATCH /documents/{id}/move`. No drag-drop. |
| Sidebar→rail collapse (032-A, D-114-17) | `IngestionPage.tsx:133-151` (the `flex` sidebar + `grid` panel layout) | When the Phase-112 detail panel opens (`selectedDoc`), collapse the `w-72` sidebar to a ~50px icon rail; user-pinnable + `sessionStorage`-persisted. Filter bar → summary chip. **SHARED-SHELL — inherited by 117/118; degrade gracefully for their panel content.** |
| Responsive column-shedding (032-A) | `DocumentList.tsx:266-276` (static 7-column `<table>`) | **Net-new** — the table has no responsive logic. Drop Date/Author columns as the list narrows under panel-open. Flag as net-new (not reuse). |

**State-based nav (UX-01):** the Documents page uses `ActiveView`/`selectedFolderId` state, **no react-router**. Views selection joins this state (e.g. a `selectedViewId` alongside `selectedFolderId`), mutually exclusive with a folder selection.

## Runtime State Inventory

> Phase 114 is **additive over existing `documents.metadata`** — no rename, no rebrand, no stored-data backfill, no re-extraction (CONTEXT audit headline). This section confirms nothing hidden bites.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | The two new typed columns are GENERATED STORED — Postgres auto-computes them for every existing `documents` row at `ALTER TABLE`. No app-side migration of data. Existing `document_views.filter_expr` rows are all `{op:and, eq}` — they parse unchanged under the widened AST (new operators are additive Literal members; optional `value2`/`values`/`unit` default absent). | None beyond running the migration. Verify auto-backfill via the count query above. |
| Live service config | None — no n8n/Datadog/external service holds a Phase-114 string. | None — verified by scope (this is an in-app DB + UI change). |
| OS-registered state | None — no Task Scheduler / pm2 / systemd involvement. | None. |
| Secrets/env vars | None — no new secret or env var. (`document_management_enabled` flag already exists, migration 071:198.) | None. |
| Build artifacts | Frontend net-new components compile via Vite (no stale artifact). Backend: no package install → no egg-info drift. After the migration, regenerate `supabase/full-schema.sql` via `scripts/regenerate-full-schema.sh`. | Run regenerate-full-schema.sh after applying the migration (CLAUDE.md). |

**Nothing found in 3 of 5 categories — verified explicitly above.**

## Common Pitfalls

### Pitfall 1: Counting own+global legs by addition double-counts the overlap
**What goes wrong:** the live count / sidebar badge over-reports because a caller-owned doc in a globally-visible folder matches both `.eq(user_id, caller)` and `.in_(folder_id, global_folder_ids)`.
**Why it happens:** the full-resolve path dedupes by id across legs (`document_views.py:280-286`); a count path that sums leg counts skips that dedupe.
**How to avoid:** dedupe ids across legs (count-only option 1) or issue one `.or_(user_id.eq, folder_id.in)` count (option 2). NEVER `own.count + global.count`.
**Warning signs:** the badge count exceeds the actual resolved-listing length for a user with global folders.

### Pitfall 2: ISO regex passes but `::date` still fails on an impossible date
**What goes wrong:** `2026-13-99` matches `^\d{4}-\d{2}-\d{2}$` but `(...)::date` raises, failing the generated-column evaluation for that row on its next write.
**Why it happens:** the regex validates SHAPE, not calendar validity.
**How to avoid:** the migration backfill itself is safe (the `CASE` guards the cast; but a regex-passing-invalid value reaching the cast WOULD error the ALTER if such a row exists). Test a regex-passing-but-invalid stored date against the full dataset BEFORE shipping (Validation → bad-date test). If found, tighten the regex or wrap in a `to_date`/exception-tolerant path (Open Q2).
**Warning signs:** `ALTER TABLE` errors on a specific row; a later insert errors with "date/time field value out of range."

### Pitfall 3: Case-insensitivity applied where the data is already normalized (wasted ILIKE)
**What goes wrong:** using `ILIKE`/`lower()=lower()` for `document_type`/`language` when those are ALREADY stored lowercase — defeats the indexed `.eq` fast path.
**Why it happens:** over-applying D-114-10 uniformly.
**How to avoid:** for `document_type` (now `document_type_norm` generated `lower()` + btree) and `language`, just **lowercase the query value** (mirror `retrieval_service.py:265-267`) and use `.eq` — indexed, exact, case-insensitive because both sides are lowercase. Reserve `lower()=lower()`/`ILIKE`-on-both-sides for `title`/`author`/`summary`.
**Warning signs:** EXPLAIN shows a seq scan on a `document_type` filter (the indexed column was bypassed by an `ILIKE`).

### Pitfall 4: `folder_scope` subtree passed as a set
**What goes wrong:** supabase-py JSON-serializes the `.in_` channel; a `set` raises in `json.dumps`.
**Why it happens:** intuition reaches for a set for membership.
**How to avoid:** `resolve_project_subtree` already returns a `list[str]` (scope.py:89) — keep it a list end to end.
**Warning signs:** a serialization error on a folder-scoped view resolve.

### Pitfall 5: An unknown operator must still fail closed after the widening
**What goes wrong:** after adding operators, a forged AST op (bypassing Pydantic) could slip if the registry-miss guard is dropped.
**Why it happens:** refactoring the dispatch.
**How to avoid:** keep `compile_filter`'s `KeyError` on a registry miss (`view_filter_compiler.py:97-99`) AND the `Literal` discriminator on `ViewCondition.op`. The widened Literal just gains members; the closed dispatch stays closed.
**Warning signs:** `test_unknown_op_rejected` (the smuggled-op KeyError test) goes green incorrectly or is deleted.

### Pitfall 6: Relative-date window baked at save or computed on the client
**What goes wrong:** a saved relative view freezes its dates; or the client and server disagree on "today."
**How to avoid:** compute the window in `resolve_view` from the server clock every resolve (D-114-16). The client readout is preview-only.
**Warning signs:** "expiring within 90 days" returns the same rows next month.

## Code Examples

### Registering a new operator additively (the seam)
```python
# Source: view_filter_compiler.py:79 seam + harness @register_validator pattern
# backend/app/services/view_operators_extra.py  (imported ONCE from view_filter_compiler.py)
from app.services.view_filter_compiler import register_operator

@register_operator("gte")
def _op_gte(field: str, value: object) -> Fragment:
    return Fragment(leg="typed" if field in PROMOTED else "custom",
                    field=field, builder="gte", value=value)  # bound literal, SC#4
```

### Two-leg `_apply` (widened) — preserves own+global dedupe
```python
# Source: document_views.py:251-290 extended to fragments
def _apply(q):
    for frag in fragments:               # ordered list from compile_filter (AND-chained)
        col = TYPED_COL[frag.field] if frag.leg == "typed" else f"metadata->>{frag.field!r}"
        q = getattr(q, frag.builder)(col, frag.value)  # .eq/.gte/.lte/.ilike — bound param
        if frag.value2 is not None:      # between
            q = q.lte(col, frag.value2)
    if subtree:
        q = q.in_("folder_id", subtree)  # list, never set (Pitfall 4)
    return q
# own leg .eq(user_id, caller); global leg .in_(folder_id, global_folder_ids); merge+dedupe unchanged
```

### Count-only mode (id-set dedupe — option 1)
```python
# Source: reembed_service.py:194-201 count idiom + document_views dedupe
own_ids   = {d["id"] for d in (await aexec(_apply(sb.table("documents").select("id").eq("user_id", caller).eq("is_latest", True)))).data or []}
glob_ids  = {d["id"] for d in (await aexec(_apply(sb.table("documents").select("id").in_("folder_id", gfids).eq("is_latest", True)))).data or []} if gfids else set()
total = len(own_ids | glob_ids)          # DISTINCT across legs — no double-count
```

## State of the Art

| Old (Phase 113) | Current (Phase 114) | When Changed | Impact |
|-----------------|---------------------|--------------|--------|
| `eq` → one `metadata @> $1::jsonb` containment dict | `compile_filter` → ordered bound WHERE-fragment descriptors | 114 (R-114-A) | Containment survives only for bool/number eq + promoted typed-col exact; 3 unit tests rewritten |
| Case-SENSITIVE exact equality (D-113-11) | Case-INSENSITIVE (lowercase query value; `ILIKE` for free-text) (D-114-10) | 114 | Views "just work" on real extracted metadata |
| No typed columns — `metadata` jsonb + GIN only (migration 007) | `document_type_norm` + `date_typed` GENERATED STORED + btree | 114 (R-114-B) | Range/date comparisons use an index (SC#3) |
| Full-row resolve only | + count-only mode (`count="exact"`, head) | 114 (D-114-15) | Live count + sidebar badges scale to ~10k docs |
| `FolderNode` row (clone candidate) | Shared `NavRow` primitive; Folders + Views built from it | 114 (D-114-13) | Folders/Views read as peers; debt fixed once |
| `eq` only in AST | + `gte`/`lte`/`one_of`/`contains`/`is_empty`/relative-date; optional `value2`/`values`/`unit` | 114 | Additive Literal members; existing rows parse unchanged |

**Deprecated/outdated:** none — Phase 113 code is extended, not replaced. The 007 GIN index and the `@>` path remain valid for the cases that still use containment.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `(text)::date` is marked immutable in `pg_proc` and therefore valid inside a GENERATED STORED expression | Migration Design | If wrong, the `date_typed` column ALTER fails. **Mitigated:** the bad-date migration test (below) runs the ALTER against the full dataset and will surface this immediately; `text::date` immutability is well-established (only `::timestamptz` is stable). LOW risk. |
| A2 | A regex-passing-but-calendar-invalid stored date (e.g. `2026-13-99`) does not currently exist in the dev/prod `documents` rows | Migration Design / Pitfall 2 | If one exists, the ALTER errors. **Mitigated:** the dataset bad-date test + the `CASE` guard; planner may tighten the regex or use an exception-tolerant cast (Open Q2). MEDIUM risk → test gates it. |
| A3 | PostgREST `.or_(...)` composes correctly with the fragment AND-filters for the single-query count (option 2) | Count-Only Path | If wrong, fall back to count option 1 (id-set dedupe) which is provably correct. LOW risk (fallback exists). |
| A4 | A custom number field range (`(metadata->>'f')::numeric` `.gte`) is expressible via the supabase-py builder without an RPC | Operator Mapping / Open Q1 | If not, the custom-number leg needs a small parameterized RPC (whitelisted field name only). LOW risk (RPC fallback, still SC#4-safe). |
| A5 | "months ≈ 30 days" is acceptable for relative-date units in v1 | Relative-Date Derivation | If calendar-accurate months are required, swap to `today + interval 'N months'`. LOW risk — sketch 030 explicitly locks "months count as ≈30 days; the headline dates are the contract." |

## Open Questions

1. **Custom-number/date cast leg — builder vs. RPC.**
   - What we know: range on `metadata->>'f'` for custom number/date fields needs a cast (`::numeric`/`::date`).
   - What's unclear: whether supabase-py PostgREST can express `(metadata->>'f')::numeric >= v` directly, or whether a small parameterized RPC is needed.
   - Recommendation: try the builder leg first; if PostgREST can't cast in a filter, add ONE RPC `resolve_custom_cast(field text, op text, val text)` with the field name validated against the whitelist before the call (SC#4-safe). Planner decides at Plan time.

2. **ISO-regex strictness vs. calendar validity.**
   - What we know: `^\d{4}-\d{2}-\d{2}$` is shape-only; `2026-13-99` passes the regex but fails `::date`.
   - What's unclear: whether any stored date is regex-passing-but-invalid.
   - Recommendation: run the bad-date dataset test (below) BEFORE shipping; if it fails, tighten the regex (e.g. month `0[1-9]|1[0-2]`) or accept the documented edge. Default: the strict-shape regex + the dataset test as the gate.

3. **Single-query count `.or_` precedence.**
   - Recommendation: validate option-2 `.or_` against a folder-scoped + multi-condition view; if precedence is ambiguous, ship count option 1 (id-set dedupe).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase Postgres :54322 | Migration apply + live integration tests | ✓ (per project infra; tests skip cleanly if down) | Postgres 15+ (Supabase CLI) | Tests `pytest.skip` when unreachable (test_113_view_resolve.py:61-65) |
| `asyncpg` (test seeding) | Live integration + EXPLAIN/bad-date tests | ✓ (used by test_113_view_resolve.py) | (pinned) | — |
| `slopcheck` | Package legitimacy gate | n/a — no packages installed this phase | — | N/A |
| Vite/Node | Frontend build | ✓ (project infra) | (pinned) | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the live Postgres — all live tests skip cleanly when :54322 is unreachable (existing harness pattern).

## Validation Architecture

> Nyquist validation is ENABLED (no `workflow.nyquist_validation:false` in config). This section drives VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (`asyncio_mode=auto`), `backend/pytest.ini`; asyncpg for live-DB seeding; Vitest + React Testing Library (frontend) |
| Config file | `backend/pytest.ini`; frontend `vitest` config (existing) |
| Quick run command | `cd backend && pytest tests/unit/test_114_*.py -x` |
| Full suite command | `cd backend && pytest tests/unit tests/integration -q` (frontend: `cd frontend && npm run test`) |

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| VIEW-03 / SC#1 | Each operator (`gte`/`lte`/`one_of`/`contains`/`is_empty`/relative) compiles to the correct Fragment | unit | `pytest tests/unit/test_114_operators.py -x` | ❌ Wave 0 |
| SC#1 (case) | Case-insensitive matching: `document_type` lowercased-value eq; free-text `ILIKE`; "Invoice"==="invoice" | unit + integration | `pytest tests/unit/test_114_case_insensitive.py tests/integration/test_114_resolve_case.py -x` | ❌ Wave 0 |
| R-114-A | The 3 Phase-113 containment-dict unit tests REWRITTEN to the fragment shape | unit | `pytest tests/unit/test_113_view_filter_compiler.py -x` (modified) | ✅ exists — rewrite |
| SC#4 | Injection/SSTI payload value stays a bound literal in the Fragment AND resolves to 0 / table intact | unit + integration | `pytest tests/unit/test_113_view_filter_compiler.py::test_injection_value_neutralized tests/integration/test_113_view_resolve.py::test_injection_value_neutralized_live -x` | ✅ exists — **stays byte-for-byte green** |
| R-114-B | Bad/malformed stored date does not break the migration ALTER nor a future insert (run against full dataset) | integration (live :54322) | `pytest tests/integration/test_114_bad_date_migration.py -x` | ❌ Wave 0 |
| SC#3 | `EXPLAIN` shows Index Scan (not Seq Scan) on `date_typed` / `document_type_norm` at ~10k seeded docs | integration (live, ~10k seed) | `pytest tests/integration/test_114_explain_index.py -x` | ❌ Wave 0 |
| D-114-15 | Count-only path equals full-resolve listing length (incl. own+global overlap dedupe) | integration | `pytest tests/integration/test_114_count_only.py -x` | ❌ Wave 0 |
| D-114-5/16 | Relative-date boundary correctness: "within next 90d" crosses month/day boundaries; excludes overdue; server-clock derivation | unit + integration | `pytest tests/unit/test_114_relative_date.py tests/integration/test_114_relative_resolve.py -x` | ❌ Wave 0 |
| VIEW-06 | own+global DISTINCT dedupe identical on both legs after widening; per-viewer leak-safety preserved | integration (+ secure-phase live two-user) | `pytest tests/integration/test_114_resolve_widened.py -x` | ❌ Wave 0 |
| SC#2 (UI) | Filter bar composes/edits/removes conditions; live count; Save-as-view → POST | frontend unit | `npm run test -- FilterBar` | ❌ Wave 0 |
| SC#2 (UI) | Views sidebar group renders from `NavRow`; funnel icon; count badge; Edit/Rename/Delete; click loads filter | frontend unit | `npm run test -- ViewsGroup NavRow` | ❌ Wave 0 |
| D-114-13 | `NavRow` extraction: Folders still render counts + actions (no regression) | frontend unit | `npm run test -- FolderNode FolderTree` | ✅ exists — extend |
| D-114-17 | Sidebar→rail collapse on panel open; user-pin persists | frontend unit / manual | `npm run test -- IngestionPage` + manual | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && pytest tests/unit/test_114_*.py -x` (+ `npm run test -- <touched component>` for frontend tasks)
- **Per wave merge:** `cd backend && pytest tests/unit tests/integration -q` (full backend) + `cd frontend && npm run test`
- **Phase gate:** full suite green before `/gsd:verify-work`; the SC#3 EXPLAIN test + bad-date dataset test run live on :54322.

### Wave 0 Gaps
- [ ] `tests/unit/test_114_operators.py` — per-operator Fragment compilation (gte/lte/one_of/contains/is_empty/relative)
- [ ] `tests/unit/test_114_case_insensitive.py` — value-lowercasing + ILIKE fragment shape
- [ ] `tests/unit/test_114_relative_date.py` — window math, month/day boundaries, overdue exclusion, server-clock
- [ ] `tests/integration/test_114_bad_date_migration.py` — bad/invalid date vs ALTER + insert, against full dataset
- [ ] `tests/integration/test_114_explain_index.py` — ~10k-row seed + EXPLAIN index-use assertion
- [ ] `tests/integration/test_114_count_only.py` — count-only == full-resolve length, own+global overlap dedupe
- [ ] `tests/integration/test_114_resolve_widened.py` — each operator end-to-end + VIEW-06 dedupe + leak-safety
- [ ] Rewrite `tests/unit/test_113_view_filter_compiler.py` 3 containment tests → fragment shape (keep injection test green)
- [ ] Frontend: `FilterBar.test.tsx`, `ConditionPopover.test.tsx`, `RelativeDateControl.test.tsx`, `ViewsGroup.test.tsx`, `NavRow.test.tsx`
- [ ] Framework: already installed (pytest, vitest) — no install needed.

**Automatable vs manual-only:**
- **Automatable:** all operator/compiler unit tests, case-insensitive matching, the rewritten 113 tests, SC#4 injection (unit + live), the bad-date migration test, the EXPLAIN-index test (live ~10k seed), the count-only correctness test, relative-date boundary tests, frontend component tests.
- **Manual-only:** the lived-experience UX (UX-01/SC#4) — the filter bar "reads in 3 seconds," the amber-at-zero honesty, the relative-date readout legibility, the sidebar→rail collapse feel, mobile responsiveness, WCAG 2.1 AA contrast/keyboard — operator G-4 Chrome-MCP UAT at phase verification. (No SC#10 4-axis cross-provider UAT here — that lives in Phase 115; D-114 / CONTEXT.)

## Security Domain

> `security_enforcement` not disabled in config → included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Existing JWT `get_current_user`; unchanged |
| V3 Session Management | no | Unchanged |
| V4 Access Control | **yes** | Per-viewer leak-safe resolve (own+global, 404-not-403, D-113-4); the widened `_apply` MUST preserve caller-scoping on BOTH legs — never `view["user_id"]`. Field-name whitelist at save + resolve. |
| V5 Input Validation | **yes** | Field names validated against the live whitelist (`validate_fields`); operator set is a closed Literal-discriminated registry; values bound as PostgREST params. |
| V6 Cryptography | no | None |

### Known Threat Patterns for {Python/FastAPI/Postgres + supabase-py}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL/SSTI injection in a filter value | Tampering | Values bound as PostgREST params via `.eq/.gte/.lte/.ilike` builders; NO f-string SQL in the compiler. The SC#4 injection test (unit + live) stays green. |
| Field-name injection on the custom-field leg | Tampering | Field names sourced ONLY from the live whitelist (built-ins ∪ enabled custom defs); never from raw user input. `_`-prefixed keys unconditionally rejected. |
| Cross-user document leak via a global view | Information Disclosure | Both resolve legs scoped from the CALLER; folder_scope intersected with caller-visible folders (D-113-5). Verified LIVE two-user in secure-phase (the "static would false-green" lesson) — the widening must not break this; re-run `test_113_view_global_leak.py`-style coverage against the new operators. |
| Count-path leak (count reveals existence of unseeable docs) | Information Disclosure | The count-only path uses the SAME own+global caller-scoping as full resolve — a count over another user's docs is impossible by construction. Test count-only leak-safety alongside resolve. |
| Malformed stored date breaks inserts (DoS) | Denial of Service | ISO-regex-guarded `CASE` in the generated column → NULL on non-ISO; a bad date never blocks a write (R-114-B). Bad-date test gates it. |

## Sources

### Primary (HIGH confidence)
- Codebase (read this session): `view_filter_compiler.py`, `document_view.py`, `document_views.py`, `document_view_service.py`, `metadata_field.py`, `test_113_view_filter_compiler.py`, `test_113_view_resolve.py`, `retrieval_service.py:240-299`, `embedding_service.py:130-163`, `documents.py:1410-1448 / :1565-1594 / :1304-1342`, `harness/scope.py`, `reembed_service.py:185-209`, `audit.py:122-139`, `FolderNode.tsx`, `FolderTree.tsx`, `MoveToFolderDialog.tsx`, `IngestionPage.tsx:120-180`, `DocumentList.tsx:255-285`, migrations `007_document_metadata.sql`, `071_dm_foundations.sql`.
- `.planning/phases/114-*/114-CONTEXT.md` (D-114-1..17, R-114-A/B resolved), `113-CONTEXT.md`, `.planning/ROADMAP.md` §Phase 114 (SC#1–4), `.planning/REQUIREMENTS.md` (VIEW-03, UX-01/02, Deferred).
- Sketches 029–033 READMEs (all winner A) + `.claude/skills/sketch-findings-agentic-rag/SKILL.md` §Phase 114 + `references/virtual-folder-filter-builder.md`.
- [postgresql.org/docs/current/ddl-generated-columns.html](https://www.postgresql.org/docs/current/ddl-generated-columns.html) — generated columns must use immutable functions; STORED materialization.

### Secondary (MEDIUM confidence)
- [richyen.com/postgres/2026/05/11/generated_columns_jsonb.html](https://richyen.com/postgres/2026/05/11/generated_columns_jsonb.html) — STORED generated columns extracting/casting jsonb values; btree index on a generated column.
- [postgresql.org message-id CA+bJJbz…](https://www.postgresql.org/message-id/CA+bJJbzK751sab2sVhvimP1v3VCk0fD7QN=JSiKDTeZQP6HgTw@mail.gmail.com) — `text::timestamptz` is NOT immutable (session timezone) → not allowed in a generation expression (confirms `::date` over `::timestamptz`).

### Tertiary (LOW confidence)
- Training knowledge that `text::date` is immutable (A1) — VERIFIED at migration-apply time by the bad-date test, not assumed for shipping.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; every reuse confirmed at file:line.
- Architecture (R-114-A/B): HIGH — pre-resolved in CONTEXT and cross-checked against live code (write-path lowercasing, no typed columns today, GIN-only).
- Operator mapping: HIGH — derived from the established supabase-py builder idioms already in the codebase.
- Migration immutability detail: MEDIUM-HIGH — `::date` immutability gated by a live test (A1).
- Pitfalls: HIGH — derived from shipped code (count undercount, set-vs-list, fail-closed) and verified Postgres facts.

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (stable stack; re-verify supabase-py version + the `::date` immutability test result before shipping the migration)
