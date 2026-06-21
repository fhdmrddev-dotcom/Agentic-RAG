# Phase 118: Auto-Classification - Research

**Researched:** 2026-06-21
**Domain:** Rule-driven document routing (deterministic metadata-condition → suggested-folder eval at ingest) + two UI surfaces (on-doc suggestion + dedicated rules page)
**Confidence:** HIGH (every claim below is grounded in code read this session; the one design judgment — in-Python matcher vs SQL round-trip — is argued from the actual call-site constraints)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-118-1: Folder-only v1; defer tags.** `classification_rules` has `suggest_folder_id` only; the app has NO document-tags concept anywhere in the schema. v1 suggests a folder move only. Drop the 🏷 tag radio from sketch 037's builder. Zero new classification schema needed for the action target.
- **D-118-2: Preview-only, no backfill.** Rules fire ONLY on upload (the `ingest_document` rule-eval pass). The builder's "would match N of M" live preview counts existing docs but does NOT retroactively suggest. Ship the honest line: *"existing docs aren't moved — rules suggest on new uploads only."* No backfill job, no "run across existing docs now" button.
- **D-118-3: First-match-wins → a single suggestion.** 2+ enabled rules → stop at first match → exactly one suggestion OBJECT in `metadata._classification` (NOT an array). One accept/dismiss decision per doc. No rule priority/order UI.
- **D-118-4: Deterministic eval order = owner-private rules first, then global; within each group, oldest `created_at` first.** (Planner may refine the exact ORDER BY; owner-before-global + stable-tiebreak intent is locked.)
- **D-118-5: `metadata._classification` = a single object**, e.g. `{ rule_id, rule_name, condition_summary, suggested_folder_id, suggested_folder_name, status: "suggested" }`. `condition_summary` is a human-readable rendering of the matched rule's condition (the provenance shown in the panel — NO fabricated confidence %).
- **D-118-6: Accept is reversible.** Accepting records the document's PRIOR `folder_id` so Undo moves it back; accept writes a `classification.apply` audit row (verified live) and performs the move, then clears/marks the suggestion. Dismiss just clears the suggestion. Both leave the rule untouched.
- **D-118-7: Defer the "N suggestions to review" tray to Phase 119.** Ship 118 with on-doc surfaces only (row chip + panel Classification card — sketch 036-A primary). Keep the graft note: any future tray walks doc-by-doc through the SAME panel card, NO "Accept all."
- **D-118-8: Rule-matching reads are explicitly user-scoped in app code.** The rule-eval pass runs inside `ingest_document` (a BackgroundTask context with NO `auth.uid()`), so it filters rules by the uploader's `user_id` (owner rules) + `is_global` in Python, mirroring the leak-safe global-share pattern of Phases 113/115/117. A global rule exposes its definition but is evaluated against the uploader's OWN upload only.

### Claude's Discretion
- Exact `metadata._classification` key names and the `ORDER BY` tiebreak (within D-118-4/5 intent).
- Whether `match_expr` reuses the Phase 113 compiler verbatim or a thin classification-eval wrapper over it (researcher confirms below — **a thin in-Python matcher is required**).
- The precise placement of the rule-eval call site between metadata-build and persist in `ingest_document` (researcher pins it below — **between line 1583 and line 1733**).

### Deferred Ideas (OUT OF SCOPE)
- **Document tags / 🏷 tag suggestion action** — needs a net-new tags concept the app lacks. Revisit as its own phase.
- **Opt-in backfill sweep** — explicit "run this rule across existing docs now." Deferred from D-118-2; candidate for Phase 119.
- **"N suggestions to review" triage tray** — deferred to Phase 119 per D-118-7; must reuse the same panel card with NO "Accept all."
- **Rule priority/ordering UI** — explicit user-controlled precedence beyond owner-before-global + created_at default. Only if first-match-wins proves too blunt.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLASS-01 | User can define classification rules (metadata condition → suggested folder), owner-private or global, enable/disable-able | Clone the `document_view_service.py` + `/document-views` router CRUD pattern (§Standard Stack, §Pattern 1). Table `classification_rules` already exists (migration 071); audit enum `classification.rule.create` is live. The condition AST reuses the `ViewFilter` Pydantic model + `validate_fields`/`validate_operands`. |
| CLASS-02 | On upload, matching rules produce a routing suggestion — never a silent auto-move; reads explicitly user-scoped in app code | A net-new rule-eval pass between `documents.py:1583` and `:1733`, reading rules via a sync own+global query, evaluating each rule's `match_expr` against the just-built `metadata_dict` IN PYTHON (the doc isn't persisted yet — §Pattern 2 / §Don't Hand-Roll). First-match-wins → one suggestion object attached to `metadata["_classification"]` before the single persist (D-118-3/8). |
| CLASS-03 | User can accept or dismiss a classification suggestion; accept writes `classification.apply` audit + reversible | A net-new accept/dismiss endpoint pair cloning `move_document` (`documents.py:1304`) + the metadata-PATCH audit pattern: accept records prior `folder_id`, moves, writes `classification.apply`, marks the suggestion `accepted`; dismiss clears `metadata._classification`. Undo = move-back to the recorded prior folder (§Pattern 3). |
| UX-01 | Classification UI matches Deep Midnight/Aether, mobile-responsive, WCAG 2.1 AA | Sketches 036-A + 037-A are the LOCKED contract. `ClassificationSection` clones `RelationshipsSection.tsx`; the rules page clones `ViewsGroup`/`NavRow` + the push/split panel shell; row chip on `DocumentList.tsx` (§Architecture Patterns, §Sources). |
</phase_requirements>

---

## Summary

Phase 118 is a **near-pure clone-and-compose phase with one genuinely net-new primitive**. Every surface it needs has a shipped precedent in the v3.0 DM stack: the `classification_rules` table + RLS + audit enums landed in Phase 110; the condition AST + field-whitelist + closed-operator-registry compiler landed in Phase 113/114; the leak-safe own+global service/router pattern landed in 113/115/117; the right-side push/split panel + accordion section + sidebar NavRow + count-badge UI landed in 112/114/117; the document folder-move endpoint and the audited metadata-PATCH both already exist. **No new migration is required** — the table, the `ON DELETE SET NULL` on `suggest_folder_id`, and both audit enums (`classification.apply`, `classification.rule.create`) are already live (`audit_service.py:24`, verified).

The **one net-new primitive** is an **in-Python condition matcher**. This is the load-bearing research finding and it resolves the CONTEXT "Claude's Discretion" compiler-parity question decisively: **the Phase 113/114 compiler CANNOT be reused verbatim for classification.** That compiler is a *SQL-fragment producer* — `compile_filter()` returns `list[Fragment]`, and the ONLY place those fragments turn into a predicate is the resolver's `_apply()`, which calls supabase-py PostgREST builders (`.eq`/`.gte`/`.contains`/`.in_`/`.or_`) against a **persisted DB table**. There is NO in-memory dict-vs-AST evaluator anywhere in the codebase (verified by grep — zero matches). At the rule-eval call site the document is **not yet persisted** (`metadata_dict` is a local dict; the row's `metadata` column is still its pre-ingest value, and the persist `UPDATE` happens later at `documents.py:1744`). A SQL round-trip is therefore the wrong tool: it would require writing the metadata first, then querying — inverting the "suggestion before persist" requirement and double-writing. **Classification needs a thin `match_metadata(match_expr, metadata_dict) -> bool` evaluator that REUSES the closed pieces it safely can** (the `ViewFilter` Pydantic model for parse-time op-rejection, the `validate_fields` `_`-prefix/whitelist guard, the operator NAMES) but implements the actual comparison in Python over the dict.

**Primary recommendation:** Build a net-new `classification_rule_service.py` (CRUD, clone of `document_view_service.py`) + a net-new `classification_matcher.py` (the in-Python AST evaluator, reusing `ViewFilter` + `validate_fields`) + a `/classification-rules` router (clone of `document_views.py`) + the rule-eval pass spliced into `ingest_document` between line 1583 and 1733 + an accept/dismiss endpoint pair (clone of `move_document`). Frontend: `ClassificationSection` (clone of `RelationshipsSection`) mounted as a third `PanelSection`, a row chip on `DocumentList`, and a Classification-rules page reached from a new sidebar "Automation" group (clone of `ViewsGroup` + `NavRow`) opening the builder in the existing push/split panel. Reuse the `ViewCondition` chip-strip builder from sketch 029/114. **No migration, no new package.**

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rule CRUD (define/enable/disable/scope) | API / Backend | Database (RLS) | Owner-private/global library object — same trust shape as views; hard-set `is_global=false` server-side, RLS WITH CHECK is defense-in-depth. |
| Rule-eval on upload (match → suggestion) | API / Backend (BackgroundTask) | — | Runs inside the sync `ingest_document` BackgroundTask with NO `auth.uid()`; user-scoping is app-code only (D-118-8). Deterministic, no LLM call. |
| Condition matching (AST → bool) | API / Backend (pure module) | — | A PURE in-Python function over the just-built metadata dict — no DB, no I/O, no `eval`. The doc isn't persisted yet. |
| Accept (move + audit + record prior folder) | API / Backend | Database | Owner-scoped write + audit; clones the existing `move_document` + metadata-PATCH-audit shape. |
| Dismiss (clear suggestion) | API / Backend | Database | Owner-scoped metadata write clearing `_classification`. |
| Suggestion display + accept/dismiss UI | Frontend (React) | API | On-doc surfaces: panel `ClassificationSection` (own fetch) + `DocumentList` row chip. State-based `ActiveView`, no router. |
| Rules list + builder | Frontend (React) | API | Dedicated page under a sidebar "Automation" group; builder in the shared push/split panel; live "would match N" preview via the existing ad-hoc resolve. |
| Live "would match N" preview | API / Backend | Frontend | Reuses the EXISTING `POST /document-views/resolve` (`count_only:true`) — counts existing docs WITHOUT suggesting (D-118-2). No new count endpoint. |

## Standard Stack

### Core (all already in the repo — zero new packages)
| Library / Module | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | in-repo | Router for `/classification-rules` CRUD + accept/dismiss | Every DM router uses it; clone `document_views.py`. `[VERIFIED: backend/app/api/document_views.py]` |
| Pydantic v2 | in-repo | Rule request/response models + the reused `ViewFilter`/`ViewCondition` AST | Project rule: "Use Pydantic for structured outputs." The AST's `Literal`-discriminated `op` is the parse-time reject-unknown-op layer. `[VERIFIED: backend/app/models/document_view.py:34]` |
| supabase-py (service-role client) | in-repo | DB access via `get_supabase()` DI + `aexec` threadpool wrapper | Every DM service uses it; the service-role client bypasses RLS so app-code predicates are the SOLE owner-scoping gate. `[VERIFIED: backend/app/services/document_view_service.py:51]` |
| `ViewFilter` / `ViewCondition` | in-repo | The classification condition AST (`match_expr` jsonb) | Identical metadata-condition family; reuse verbatim for parse + the `Literal` op-reject. `[VERIFIED: backend/app/models/document_view.py:34-69]` |
| `view_filter_compiler.validate_fields` / `validate_operands` | in-repo | Save-time field-whitelist + `_`-prefix reject + operand-presence checks | Reuse verbatim in the rule CRUD router (same as `document_views.py:111`). `[VERIFIED: backend/app/services/view_filter_compiler.py:214,263]` |
| `audit_service.write_audit_entry` | in-repo | `classification.apply` + `classification.rule.create` audit rows | Both enums already live in `VALID_ACTION_TYPES`. `[VERIFIED: backend/app/services/audit_service.py:24]` |
| React + Vite + Tailwind + shadcn/ui | in-repo | All three UI surfaces | Deep Midnight / Aether; clone `RelationshipsSection`, `ViewsGroup`, `NavRow`, `DocumentDetailPanel`, the push/split panel. `[VERIFIED: frontend/src/components/relationships/RelationshipsSection.tsx]` |

### Supporting (existing helpers to reuse, NOT rebuild)
| Module | Purpose | When to Use |
|--------|---------|-------------|
| `read_enabled_field_defs(supabase, uid)` (SYNC) | The enabled custom-field-key set for the whitelist | Inside the sync `ingest_document` rule-eval pass — it is sync, so no `aexec` needed there. `[VERIFIED: backend/app/services/embedding_service.py:270]` |
| `metadata_field_service.list_field_definitions` (ASYNC) | Field defs for the CRUD router's whitelist | In the async rule CRUD router (via `_build_field_meta`). `[VERIFIED: backend/app/services/document_view_resolver.py:139]` |
| `POST /document-views/resolve` (`count_only:true`) | The "would match N of M" preview count | The builder preview — no new endpoint needed; it already runs the same AST compile + caller-scoped own+global count and writes NO audit. `[VERIFIED: backend/app/api/document_views.py:263]` |
| `PATCH /documents/{id}/move` + `moveDocument` client fn | The folder move on Accept | Clone its ownership-gate + target-folder-readability check for the accept endpoint. `[VERIFIED: backend/app/api/documents.py:1304; frontend/src/lib/api.ts:1971]` |
| `get_globally_visible_folder_ids` (ASYNC) / RLS own+global | Leak-safe global-share scoping | The rule read in the BG task; the suggested-folder-name resolve. `[VERIFIED: backend/app/utils/folder_utils.py:48]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-Python matcher (`classification_matcher.py`) | The Phase 113 SQL compiler + a DB round-trip | REJECTED. The doc isn't persisted at eval time; a SQL round-trip would require writing metadata first then querying — inverts "suggestion before persist," double-writes, and needs an `id` that already exists. The compiler emits `Fragment`s consumed ONLY by `_apply()`'s PostgREST builder calls — there is no dict evaluator to call. `[VERIFIED: view_filter_compiler.py + document_view_resolver.py:226 _apply]` |
| A new `classification_rules` CRUD service | Generic table CRUD | Use a dedicated `classification_rule_service.py` cloning `document_view_service.py` so the hard-set `is_global=false`, the `_uid()` UUID-coercion guard, and the own+global 404-not-403 contract come for free. |
| A new count endpoint for "would match N" | Reuse `POST /document-views/resolve` | The ad-hoc resolve already exists (114 CR-01), is leak-safe, writes no audit, supports `count_only`. Net-zero backend work for the preview. |

**Installation:** None. No new Python or JS package. No new SQL migration.

**Version verification:** N/A — no external packages added. All modules are in-repo and read this session.

## Package Legitimacy Audit

> Not applicable — Phase 118 installs **no external packages** (backend or frontend). It composes existing in-repo modules only. No `npm install`, no `pip install`, no new migration. slopcheck/registry verification is moot.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | — | — | — | — | — | No packages added |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
CLASS-01 (define rules)
  Browser: Rules page  ──POST/PATCH/DELETE──►  /classification-rules router
   (ViewCondition chip      (clone document_views.py)        │
    strip 029/114)                                           ├─ validate_fields/validate_operands (reuse 113/114)
   builder live preview ──POST /document-views/resolve──┐    ├─ classification_rule_service.create (hard-set is_global=false)
        "would match N"     (count_only:true, EXISTS)   │    └─ write_audit_entry("classification.rule.create")
                                                         ▼
                                              counts existing docs, NO suggest (D-118-2)

CLASS-02 (suggest on upload — NEVER auto-move)
  Upload ─► ingest_document (sync BackgroundTask, NO auth.uid)
              │  [documents.py]
              │  extract metadata  →  metadata_dict (built, line ~1568)
              │  normalize doc_type/language (line 1575-1582)
              │  re-extract user-field merge guard (line 1602-1624)
              ▼  ◄────────── RULE-EVAL PASS GOES HERE (between 1583 and 1733) ──────────►
              │     read rules: user_id == uploader OR is_global   (sync .execute, D-118-8)
              │     order: owner-private first, then global; oldest created_at first (D-118-4)
              │     for each ENABLED rule:  classification_matcher.match(rule.match_expr, metadata_dict)
              │        first True  →  build suggestion object  →  metadata_dict["_classification"] = {…}  →  STOP (D-118-3)
              ▼
            persist:  UPDATE documents SET metadata = metadata_dict  (line 1744 — ONE write, carries the suggestion)

CLASS-03 (accept / dismiss — reversible)
  Browser: row chip  ✓ ──PATCH /documents/{id}/classification/accept──► record prior folder_id
   OR panel card                                                       move to suggested_folder_id (clone move_document)
                                                                       write_audit_entry("classification.apply")
                                                                       mark _classification.status="accepted"
                   ✕ ──PATCH /documents/{id}/classification/dismiss──► clear metadata._classification
                   ↩ Undo ──PATCH .../move (prior folder_id)──────────► reversible (D-118-6)
```

### Recommended Project Structure
```
backend/app/
├── models/
│   └── classification_rule.py        # NEW: RuleCreate/Update/Response (clone document_view.py shape); reuse ViewFilter for match_expr
├── services/
│   ├── classification_rule_service.py # NEW: CRUD clone of document_view_service.py (is_global hard-false, _uid guard, own+global 404)
│   └── classification_matcher.py      # NEW (the only genuinely net-new logic): match(match_expr_dict, metadata_dict) -> bool, PURE
└── api/
    ├── classification_rules.py        # NEW: router clone of document_views.py (CRUD + audit); mount in main.py:423-area
    └── documents.py                   # EDIT: splice rule-eval pass (1583→1733); add accept/dismiss endpoints (clone move_document:1304)

frontend/src/
├── App.tsx                            # EDIT: add "classification-rules" to the ActiveView union (App.tsx:9)
├── lib/api.ts                         # EDIT: rule CRUD fns + accept/dismiss fns + types
├── components/
│   ├── classification/
│   │   ├── ClassificationSection.tsx  # NEW: clone RelationshipsSection.tsx — own fetch of the doc's _classification, accept/dismiss
│   │   ├── ClassificationRulesPage.tsx# NEW: rules list + push/split builder panel (sketch 037-A)
│   │   └── RuleBuilderPanel.tsx        # NEW: ViewCondition chip strip (reuse 029/114) + folder action + scope segmented + live count
│   ├── ingestion/
│   │   ├── AutomationGroup.tsx        # NEW: sidebar "Automation" group (clone ViewsGroup.tsx + NavRow)
│   │   └── DocumentList.tsx           # EDIT: add the row chip (→ folder ✓ ✕) when a doc has a "suggested" _classification
│   └── metadata/
│       └── DocumentDetailPanel.tsx    # EDIT: add a third <PanelSection title="Classification"> after Relationships (line 253)
```

### Pattern 1: Leak-safe own+global library CRUD (CLASS-01)
**What:** Clone `document_view_service.py` + `document_views.py` verbatim, swapping table/model.
**When to use:** The `/classification-rules` CRUD router and its service.
**Key invariants to carry (all from the 113 clone-target):**
- `create_rule` HARD-SETS `is_global=False` server-side; never trust a caller arg (RLS WITH CHECK forces it too — defense-in-depth). `[VERIFIED: document_view_service.py:86]`
- `list_rules` returns own + global via `.or_(f"user_id.eq.{_uid(user_id)},is_global.eq.true")` with the `_uid()` UUID-coercion guard (the service-role client bypasses RLS — this predicate is the sole gate). `[VERIFIED: document_view_service.py:101]`
- `get_rule` gates own-OR-global → `None` → router 404 (never 403, no existence leak). `update_rule`/`delete_rule` own-scoped (`.eq("user_id", caller)`). `[VERIFIED: document_view_service.py:113,166,182]`
- Validate `match_expr` fields + operands at CREATE and UPDATE via `validate_fields`/`validate_operands` before the write → 422 on an unknown/`_`-prefixed field or malformed operand. `[VERIFIED: document_views.py:109-114]`
- Fire `write_audit_entry("classification.rule.create", ...)` after create (await inline; it swallows errors so the live round-trip is the verification). `[VERIFIED: document_views.py:129]`
- The `enabled` toggle is a PATCH on the existing UPDATE path (no new endpoint).

```python
# Source: clone of backend/app/services/document_view_service.py:65 (create_view)
# NEW classification_rule_service.create_rule — same shape, is_global hard-false
async def create_rule(user_id, name, match_expr: dict, suggest_folder_id, supabase=None) -> dict:
    payload = {
        "user_id": str(user_id),
        "name": name,
        "match_expr": match_expr,            # validated AST jsonb (router ran validate_fields)
        "suggest_folder_id": str(suggest_folder_id) if suggest_folder_id else None,
        "is_global": False,                  # HARD-SET — never from the caller (T-113-06 analog)
        "enabled": True,
    }
    result = await aexec(_client(supabase).table("classification_rules").insert(payload))
    return result.data[0]
```

### Pattern 2: The in-Python condition matcher (CLASS-02 — the net-new primitive)
**What:** A PURE `classification_matcher.py` that evaluates a `ViewFilter` AST against a plain metadata dict — no DB, no I/O, no `eval`.
**When to use:** Inside the `ingest_document` rule-eval pass, where the doc is not yet persisted.
**Why net-new:** The Phase 113/114 compiler produces `Fragment`s consumed ONLY by the resolver's `_apply()` PostgREST-builder calls against the DB. There is no in-memory evaluator (grep-verified: zero matches for any dict-vs-AST matcher). `[VERIFIED: view_filter_compiler.py compile_filter → Fragment; document_view_resolver.py:226 _apply]`

**Design rules for the matcher (carry the 113/114 semantics so preview-count ≈ on-upload-match):**
- Parse `match_expr` through `ViewFilter.model_validate(...)` first → the `Literal` op-discriminator rejects unknown ops at parse (no op-ladder, no `eval` — Pitfall 5 from 113). `[VERIFIED: document_view.py:42]`
- Run `validate_fields` against the live whitelist (built-ins ∪ enabled custom defs) → `_`-prefixed and unknown fields rejected; this is the SAME guard the CRUD router runs at save. `[VERIFIED: view_filter_compiler.py:263]`
- Flat AND only (`ViewFilter.op == "and"`); a rule matches iff ALL conditions match (D-113-7).
- Implement each operator over the dict with the SAME normalization the compiler uses, so the preview count (which runs through SQL) and the on-upload match agree:
  - `eq`: case-insensitive for `document_type`/`language` (both stored lowercase) and free-text (`title`/`author`/`summary`); exact for boolean/number. `[matches view_filter_compiler.py:135 _op_eq]`
  - `one_of`: case-insensitive membership for normalized fields.
  - `contains`: case-insensitive substring (`ILIKE %v%` analog). `gte`/`lte`/`before`/`after`/`between`: comparison (dates as ISO strings sort correctly; custom-number range is REJECTED at validate by `validate_operands` — `_op_range` lexical trap, WR-01). `[VERIFIED: view_filter_compiler.py:201-260]`
  - `is_empty`: key absent OR value in `("", [])`.
  - `within_next`/`older_than`: relative-date window from `date.today()` (the same server-clock math `_relative_window` uses; D-114-16). The `date` field value is the doc's metadata date string.
- `_confidence`/`_source` are nested provenance keys — NEVER a match dimension (the `_`-prefix reject already enforces this).

```python
# Source: NEW classification_matcher.py — PURE, no DB. Reuses ViewFilter + validate_fields.
def match_metadata(match_expr: dict, metadata: dict, whitelist: set[str]) -> bool:
    flt = ViewFilter.model_validate(match_expr)        # Literal op-reject at parse (Pitfall 5)
    view_filter_compiler.validate_fields(flt, whitelist)  # _-prefix + whitelist guard (reuse)
    if not flt.conditions:
        return False  # an empty rule matches nothing on upload (never auto-suggest blindly)
    return all(_match_one(c, metadata) for c in flt.conditions)  # flat AND (D-113-7)
```

### Pattern 3: Reversible accept / dismiss (CLASS-03)
**What:** Two PATCH endpoints cloning `move_document` (`documents.py:1304`) + the audited metadata-PATCH pattern (`documents.py:1358`).
**Accept:** read the doc (own-scoped, 404 on miss) → record prior `folder_id` into the suggestion object (for Undo) → validate the target folder is readable (own+global, clone `move_document:1325`) → UPDATE `folder_id` + mark `metadata._classification.status="accepted"` + stamp `prior_folder_id` → `write_audit_entry("classification.apply", {document_id, rule_id, from_folder, to_folder})`. Audit ONLY after the move succeeds (the 112/116 honesty discipline — never optimistic). `[VERIFIED: documents.py:1304, 1444]`
**Dismiss:** own-scoped UPDATE clearing `metadata._classification` (pop the key). No move, no audit (mirrors the "dismiss leaves the rule untouched" decision).
**Undo:** the frontend calls the existing `PATCH /documents/{id}/move` with the recorded `prior_folder_id` — reversible by construction (D-118-6). No special endpoint needed for Undo.

```python
# Source: clone of backend/app/api/documents.py:1304 (move_document) + :1446 (audit)
@router.patch("/{document_id}/classification/accept")
async def accept_classification(document_id, current_user=Depends(...), supabase=Depends(...)):
    doc = supabase.table("documents").select("folder_id, metadata").eq("id", document_id)\
        .eq("user_id", current_user["id"]).maybe_single().execute()
    if not doc.data: raise HTTPException(404, "Document not found")     # never 403
    sugg = (doc.data.get("metadata") or {}).get("_classification") or {}
    target = sugg.get("suggested_folder_id")
    # validate target readable (clone move_document:1325) → move → mark accepted → audit
```

### Anti-Patterns to Avoid
- **Reusing the SQL compiler for upload-time match.** It produces DB query fragments, not a bool. The doc isn't persisted. Build the in-Python matcher.
- **A silent auto-move.** The rule-eval pass writes a SUGGESTION ONLY (`metadata._classification`); the move happens ONLY on explicit Accept (CLASS-02/the milestone anti-feature "Silent autonomous auto-filing").
- **Putting `auth.uid()` logic in the BackgroundTask.** There is no `auth.uid()` in `ingest_document` (it runs service-role, no JWT). Filter rules by `user_id == uploader OR is_global` in Python (D-118-8). A global rule is evaluated against the uploader's OWN upload only.
- **An array of suggestions.** First-match-wins → exactly ONE object (D-118-3). Stop on the first matching enabled rule.
- **A fabricated confidence %.** Show the matched rule + `condition_summary` (provenance), never a number (the 028/036 honesty principle).
- **Optimistic audit / optimistic move on the UI.** Re-fetch / claim "audit logged" only on a 200 (the 112 T-112-04-01 lesson; clone `RelationshipsSection`'s re-fetch-not-optimistic discipline).
- **An "Accept all".** Every accept is individual with its own audit row (the 036-B graft note; deferred-tray must honor this too).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Field-whitelist + `_`-prefix reject for `match_expr` | A new validator | `view_filter_compiler.validate_fields` | Identical semantics; reuse keeps the rule condition and the view filter in lockstep. `[VERIFIED: view_filter_compiler.py:263]` |
| Operand-presence / numeric-range safety | A new check | `view_filter_compiler.validate_operands` | Already rejects empty `one_of`, missing `between` bounds, range-on-custom-number (the lexical-comparison trap). `[VERIFIED: view_filter_compiler.py:214]` |
| Op-discrimination / reject-unknown-op | A dict op-ladder | `ViewFilter`/`ViewCondition` `Literal` parse | The `Literal` discriminator rejects unknown ops at `model_validate` — no `eval`, no ladder (Pitfall 5). `[VERIFIED: document_view.py:42]` |
| "Would match N of M" preview | A new count endpoint | `POST /document-views/resolve` (`count_only:true`) | Already leak-safe, audit-free, AST-driven count over existing docs. `[VERIFIED: document_views.py:263]` |
| Folder move on Accept | A new move path | Clone `move_document` (`PATCH /documents/{id}/move`) | Owner-gate + target-folder readability already correct. `[VERIFIED: documents.py:1304]` |
| Own+global library CRUD with 404-not-403 | A new service | Clone `document_view_service.py` | The `_uid()` guard + own+global OR + own-scoped update/delete are battle-tested across 113/115/117. `[VERIFIED: document_view_service.py]` |
| Panel accordion section with own fetch + count badge | A new component | Clone `RelationshipsSection.tsx` + `PanelSection` | The fetch-on-mount/re-fetch, honest empty≠loading≠error states, count-lift-to-badge are all solved. `[VERIFIED: RelationshipsSection.tsx; DocumentDetailPanel.tsx:244]` |
| Sidebar group with NavRow + G-pill + lazy count | A new sidebar group | Clone `ViewsGroup.tsx` + `NavRow` | The lazy+cached count, the `G` global pill, the kebab edit/rename/delete are all in `ViewsGroup`. `[VERIFIED: ViewsGroup.tsx]` |
| The condition chip strip in the builder | A new builder | Reuse the `ViewCondition` chip strip (sketch 029/114 FilterBar) | Same `field op value` + AND grammar; sketch 037-A explicitly reuses the 029 chip strip. `[CITED: .planning/sketches/037-rule-builder-and-list/README.md]` |

**Key insight:** Phase 118's entire surface area is "already shipped, in a sibling shape." The ONE thing with no precedent is the in-Python AST matcher (`classification_matcher.py`) — and even that reuses the AST model + the two validators. Everything else is a clone. Resist the temptation to invent.

## Runtime State Inventory

> This phase is **additive/greenfield**, not a rename/refactor/migration. No stored string is being renamed; no live-service config, OS-registered state, secret, or build artifact carries a value this phase changes. Steps below are answered explicitly per the protocol.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `metadata._classification` is a NEW nested key written forward-only on new uploads; existing docs are untouched (D-118-2 no backfill). `classification_rules` rows are user-created at runtime, none seeded. | None |
| Live service config | None — no external service (n8n/Datadog/etc.) holds a classification value. | None |
| OS-registered state | None — no scheduler/process registration involved. | None |
| Secrets/env vars | None — no new secret or env var; the DM feature flag `document_management_enabled` already exists (110). | None |
| Build artifacts | None — no package rename, no egg-info, no Docker tag change (no new dependency). | None |

**Nothing found in any category — verified by: the phase adds a new metadata key + new rule rows + new UI, edits `ingest_document` and `DocumentDetailPanel` additively, and ships NO migration and NO package.**

## Common Pitfalls

### Pitfall 1: Reusing the SQL compiler at the pre-persist call site
**What goes wrong:** A planner sees "reuse the Phase 113 compiler" and wires `compile_filter()` + the resolver into `ingest_document`, then discovers the resolver queries a persisted table the doc isn't in yet.
**Why it happens:** The compiler LOOKS like a general condition engine, but its output (`Fragment`) is consumed ONLY by `_apply()`'s PostgREST builder calls against the DB.
**How to avoid:** Build `classification_matcher.py` to evaluate the AST against the local `metadata_dict` in Python. Reuse the AST model + `validate_fields`/`validate_operands`, NOT `compile_filter`/`resolve_filter`.
**Warning signs:** Any import of `resolve_filter` or `compile_filter` inside `documents.py`'s ingest path; a metadata `UPDATE` written before the suggestion is computed.

### Pitfall 2: Normalization drift between preview count and on-upload match
**What goes wrong:** The builder's "would match N" preview (SQL, via `/document-views/resolve`) and the actual on-upload match (in-Python matcher) disagree because one lowercases `document_type` and the other doesn't.
**Why it happens:** Two evaluators for the same AST.
**How to avoid:** Mirror the compiler's normalization in the matcher EXACTLY: lowercase `document_type`/`language` and case-insensitive free-text `eq`/`one_of`/`contains`; ISO-date comparison for ranges; relative-date from the server clock. A unit test should assert "matcher agrees with the documented SQL semantics" per operator.
**Warning signs:** A rule that previews "would match 5" but suggests on an upload it shouldn't (or vice versa).

### Pitfall 3: A cross-user global-rule leak in the BackgroundTask
**What goes wrong:** The rule read in `ingest_document` accidentally evaluates another user's PRIVATE rule, or a global rule reads another user's docs.
**Why it happens:** No `auth.uid()` in the BG task; the service-role client bypasses RLS, so an unscoped `.select("*")` returns ALL rules.
**How to avoid:** Read rules with `.or_(f"user_id.eq.{uploader_uid},is_global.eq.true")` (mirror `list_views`); evaluate each rule's `match_expr` against the UPLOADER'S OWN `metadata_dict` only (D-118-8). A global rule exposes its definition but never another user's data.
**Warning signs:** A `.select("*").execute()` on `classification_rules` with no user/global predicate inside `documents.py`.

### Pitfall 4: A silent auto-move
**What goes wrong:** The rule-eval pass moves the document instead of suggesting.
**Why it happens:** Treating classification as "filing" rather than "suggest-then-confirm."
**How to avoid:** The pass writes ONLY `metadata._classification` (status `suggested`). The `folder_id` UPDATE happens ONLY in the accept endpoint after explicit user action (CLASS-02; the milestone anti-feature line).
**Warning signs:** Any `folder_id` write inside the ingest rule-eval pass.

### Pitfall 5: Suggested-folder name goes stale / the folder was deleted
**What goes wrong:** `suggested_folder_id` points at a folder that was deleted (the FK is `ON DELETE SET NULL`), or the cached `suggested_folder_name` in the suggestion object is stale.
**Why it happens:** `classification_rules.suggest_folder_id` is `ON DELETE SET NULL` by design (A3) — a rule survives its folder's deletion.
**How to avoid:** At rule-eval time, resolve the folder name fresh and skip the suggestion (or render "folder deleted") if `suggest_folder_id` resolved to NULL or an unreadable folder. At accept time, re-validate the target folder is readable (clone `move_document:1325`) → 404 if gone.
**Warning signs:** An accept that moves to a NULL/unknown folder; a chip showing a deleted folder's name.

## Code Examples

### Splice point in `ingest_document` (CLASS-02)
```python
# Source: backend/app/api/documents.py — the rule-eval pass goes BETWEEN these two existing blocks.
# AFTER (line ~1583): metadata_dict is built + doc_type/language normalized + re-extract merge guard ran.
# BEFORE (line 1733-1744): the SINGLE persist UPDATE that writes "metadata": metadata_dict.

# ── NEW: classification rule-eval pass (CLASS-02 / D-118-2/3/4/8) ──────────────
if metadata_dict:  # no metadata → nothing to match (graceful, never blocks ingest)
    try:
        from app.services import classification_matcher  # noqa: PLC0415
        # Read rules: uploader's own + global, owner-first then global, oldest created_at first (D-118-4).
        rules = (
            supabase.table("classification_rules").select("*")
            .or_(f"user_id.eq.{user_id},is_global.eq.true")
            .eq("enabled", True)
            .order("is_global").order("created_at")  # owner(false) before global(true); oldest first
            .execute()
        ).data or []
        whitelist = _METADATA_BUILTINS | {
            d["field_key"] for d in read_enabled_field_defs(supabase, user_id)  # SYNC reader
        }
        for rule in rules:                       # first-match-wins (D-118-3)
            if classification_matcher.match_metadata(rule["match_expr"], metadata_dict, whitelist):
                metadata_dict["_classification"] = classification_matcher.build_suggestion(rule, supabase, user_id)
                break
    except Exception:  # noqa: BLE001 — classification never blocks ingestion (mirror the metadata degrade)
        log.warning("classification rule-eval failed; skipping suggestion", exc_info=True)
# The existing persist at line 1744 now carries metadata_dict["_classification"] in ONE write.
```

### The suggestion object shape (D-118-5)
```python
# Source: NEW classification_matcher.build_suggestion — provenance, NO confidence %.
{
    "rule_id": rule["id"],
    "rule_name": rule["name"],
    "condition_summary": "document_type = invoice AND author contains Acme",  # human-readable AST render
    "suggested_folder_id": rule["suggest_folder_id"],
    "suggested_folder_name": "Invoices",   # resolved fresh; None/"(deleted)" if the folder is gone (Pitfall 5)
    "status": "suggested",                  # → "accepted" after Accept; key cleared on Dismiss
    # prior_folder_id is stamped at ACCEPT time (for Undo, D-118-6), not here.
}
```

### Frontend: third PanelSection (UX-01)
```tsx
// Source: clone of frontend/src/components/metadata/DocumentDetailPanel.tsx:244 (Relationships section)
// Add AFTER the Relationships <PanelSection>, before the closing </div> at line 254.
<PanelSection title="Classification" count={classCount ?? undefined}>
  <ClassificationSection
    docId={doc.id}
    suggestion={doc.metadata?._classification}   // own fetch or re-derive from the doc
    onChanged={onReconcile}                        // re-fetch after accept/dismiss (not optimistic)
    onTotalChange={setClassCount}                  // 1 when a "suggested" exists, else 0/undefined
  />
</PanelSection>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 113 single `metadata @> $1::jsonb` containment | Phase 114 widened to `list[Fragment]` + typed columns + relative-date | Phase 114 | The matcher must mirror the WIDENED operator set (gte/lte/one_of/contains/is_empty/within_next/older_than/before/after/between), not just `eq`. `[VERIFIED: view_operators_extra.py]` |
| Per-keystroke `createView→resolve→deleteView` for previews | `POST /document-views/resolve` ad-hoc (no audit pollution) | Phase 114 CR-01 | The builder's "would match N" preview reuses this directly. `[VERIFIED: document_views.py:263]` |
| `response_model` on resolve routes | NO `response_model` (plain dict) | 112 CR-01 / 113 IN-03 | If the rules router returns rows carrying `metadata`, do NOT add a `response_model` that strips `_classification`/`_source`/`_confidence`. |

**Deprecated/outdated:** None relevant — all clone-targets are current (113/114/117 shipped within the last week).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `ORDER BY` `is_global ASC, created_at ASC` correctly encodes "owner-private first, then global; oldest first" (booleans sort false<true in Postgres). | Pattern/Code Examples | If Postgres bool sort differs in this supabase-py path, eval order flips global-before-owner — violates D-118-4. Mitigate: a unit test asserting owner-rule wins over a global rule with the same/earlier `created_at`. LOW risk (Postgres sorts `false < true`). |
| A2 | `metadata._classification` does not collide with any flat `metadata @>` filter or break existing list/resolve. | Suggestion shape | A `_`-prefixed key is already excluded from filters by `validate_fields` (D-111-9 proven for `_confidence`/`_source`), so a new `_classification` is safe by the same rule. LOW risk — but the planner should add a regression test mirroring `test_111_flat_filter_compat`. |
| A3 | The DM feature flag (`document_management_enabled`) gating lives at the UI surface (111/112/113 precedent), so no new gate is needed in the rule-eval pass. | (gating) | If the flag must hard-gate the BG rule-eval, an "off" flag would still write suggestions. LOW risk — follow the 113 precedent (A1 in `document_views.py:41`), confirm with the planner whether the ingest pass should early-return when the flag is off. |

**Note:** None of these are compliance/security/retention assumptions — they are eval-order, key-collision, and gating-placement details the planner can lock with a one-line test or a CONTEXT confirm.

## Open Questions

1. **Should the ingest rule-eval pass respect the `document_management_enabled` flag?**
   - What we know: 113/112/111 put the DM gate at the UI surface, NOT in the backend write paths.
   - What's unclear: whether an operator who turns DM "off" expects new uploads to STOP getting suggestions written.
   - Recommendation: Follow the precedent (no backend gate) for v1; if the planner wants belt-and-suspenders, an early `return` when the flag is off is cheap. Flag for the planner; not blocking.

2. **`condition_summary` rendering — backend or frontend?**
   - What we know: D-118-5 wants a human-readable condition string in the suggestion object.
   - What's unclear: whether to render it once at suggest-time (backend, frozen) or derive it live in the panel (frontend, always current to the rule).
   - Recommendation: Render it backend at suggest-time and store it in the object (the rule could be edited/deleted later; the suggestion should show the condition that MATCHED, frozen — provenance, not live state). The panel can additionally link to the live rule. Not blocking.

3. **Row-chip data source on `DocumentList`.**
   - What we know: the chip needs the doc's `_classification` to render.
   - What's unclear: whether `DocumentList`'s existing doc rows already carry full `metadata` (they should — `GET /documents` returns the blob).
   - Recommendation: Confirm `Document.metadata` is on the list row type; if so the chip reads `doc.metadata._classification` with zero new fetch. Verify in `DocumentList.tsx` during planning.

## Environment Availability

> Phase 118 is a code/config-only change against the already-running local stack (FastAPI on :54322, Supabase local). No NEW external dependency is introduced.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase (:54322) | All live integration tests + rule CRUD | ✓ (running per STATE.md 117 tests) | local | — |
| Backend uvicorn (:54322) | Live route tests + Chrome-MCP UAT | ✓ | in-repo | — |
| `classification_rules` table + RLS | CLASS-01/02 | ✓ (migration 071 applied 110-02) | live | — |
| `classification.apply` / `classification.rule.create` audit enums | CLASS-01/03 | ✓ (`audit_service.py:24`, live CHECK per 110-02) | live | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

> nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`). This section is consumed by the Nyquist strategy.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend, live against :54322) + Vitest/RTL (frontend) |
| Config file | `backend/` pytest (conftest plants a fake cloud SUPABASE_URL — live tests inject the real local client, per `document_view_service.py:31`); frontend Vitest |
| Quick run command | `cd backend && python -m pytest tests/integration/test_118_*.py tests/unit/test_118_*.py -x` |
| Full suite command | backend `python -m pytest`; frontend `npm test` (in `frontend/`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLASS-01 | Rule CRUD: create hard-sets `is_global=false`; own+global list; 404-not-403 on cross-user; `classification.rule.create` audit row lands live | live-integration | `pytest tests/integration/test_118_rule_crud.py -x` | ❌ Wave 0 |
| CLASS-01 | `validate_fields`/`validate_operands` reject `_`-prefixed/unknown field + bad operand at create/update (422) | unit | `pytest tests/unit/test_118_rule_validation.py -x` | ❌ Wave 0 |
| CLASS-02 | `classification_matcher.match_metadata` per operator agrees with documented SQL semantics (eq case-insensitivity, one_of, contains, ranges, is_empty, relative-date) | unit | `pytest tests/unit/test_118_matcher.py -x` | ❌ Wave 0 |
| CLASS-02 | On upload, first-match-wins writes exactly ONE `_classification` object (not array); enabled-only; owner-before-global order; NO folder move | live-integration | `pytest tests/integration/test_118_ingest_suggest.py -x` | ❌ Wave 0 |
| CLASS-02 | Leak-safe: a second user's PRIVATE rule never matches the uploader's doc; a global rule evaluates against the uploader's OWN metadata only | live-integration (two-user) | `pytest tests/integration/test_118_rule_leak.py -x` | ❌ Wave 0 (secure-phase non-vacuous re-run) |
| CLASS-02 | `_classification` does not break flat `metadata @>` filters (regression, mirror `test_111_flat_filter_compat`) | live-integration | `pytest tests/integration/test_118_flat_filter_compat.py -x` | ❌ Wave 0 |
| CLASS-03 | Accept moves to suggested folder + writes `classification.apply` audit (live) + records prior folder; status→accepted | live-integration | `pytest tests/integration/test_118_accept.py -x` | ❌ Wave 0 |
| CLASS-03 | Dismiss clears `_classification`, no move, no audit; Undo moves back to prior folder (reversible) | live-integration | `pytest tests/integration/test_118_dismiss_undo.py -x` | ❌ Wave 0 |
| UX-01 | `ClassificationSection` honest states (suggested ≠ moved / accepted receipt / no-match calm); accept/dismiss re-fetch not optimistic; a11y (keyboard + coarse-pointer always-on, AA tokens) | frontend unit (RTL) | `npm test -- ClassificationSection` | ❌ Wave 0 |
| UX-01 | Rule builder: chip strip + folder action + scope segmented + live "would match N" count; rules-list row anatomy; Automation sidebar group | frontend unit (RTL) | `npm test -- RuleBuilderPanel ClassificationRulesPage AutomationGroup` | ❌ Wave 0 |
| UX-01 | Row chip on `DocumentList` (→ folder ✓ ✕) renders only for a "suggested" doc | frontend unit (RTL) | `npm test -- DocumentList` | ✅ extend existing |

### Sampling Rate
- **Per task commit:** `pytest tests/.../test_118_<area>.py -x` (the just-touched area).
- **Per wave merge:** backend `pytest -k 118` + frontend `npm test -- <changed components>`; plus the prior-phase regression spot (`-k "117 or 116 or 113"`) since `ingest_document` and `DocumentDetailPanel` are shared edits.
- **Phase gate:** full backend suite green live on :54322 + frontend suite (net-new failures 0 via base-checkout) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `tests/unit/test_118_matcher.py` — covers CLASS-02 (the net-new matcher; one test per operator + flat-AND + empty-rule)
- [ ] `tests/unit/test_118_rule_validation.py` — covers CLASS-01 (whitelist/operand reject)
- [ ] `tests/integration/test_118_rule_crud.py` — covers CLASS-01 (CRUD + audit + 404-not-403)
- [ ] `tests/integration/test_118_ingest_suggest.py` — covers CLASS-02 (first-match-wins, one object, no move)
- [ ] `tests/integration/test_118_rule_leak.py` — covers CLASS-02 leak-safety (two-user; secure-phase re-runs non-vacuous)
- [ ] `tests/integration/test_118_flat_filter_compat.py` — covers CLASS-02 regression (`_classification` doesn't break `@>`)
- [ ] `tests/integration/test_118_accept.py` / `test_118_dismiss_undo.py` — covers CLASS-03
- [ ] frontend: `ClassificationSection.test.tsx`, `RuleBuilderPanel.test.tsx`, `ClassificationRulesPage.test.tsx`, `AutomationGroup.test.tsx`; extend `DocumentList.test.tsx`
- [ ] No framework install needed — pytest + Vitest already present.

### SC#10 4-axis UAT obligation (CLAUDE.md "UAT scoreboard recipe")
The **rule-eval pass itself is deterministic AST matching — NO LLM call, NOT provider-routed.** BUT the upload path's **metadata-build is cross-provider** (Phase 111 `extract_metadata_enriched` runs the user-selected provider). A rule condition tests THAT metadata. So:
- **Cross-provider axis APPLIES to the upload path** — a `document_type = invoice` rule must fire identically whether the metadata was extracted by OpenAI, Anthropic, Google, or OpenRouter (the providers' extracted `document_type` casing/wording can differ → the matcher's case-insensitive normalization is exactly what must hold cross-provider). Author ≥1 UAT row per provider: upload the same doc, confirm the suggestion fires the same.
- **Multi-tool / parallel-thread / long-message axes** are NOT directly exercised by classification (it's a one-shot ingest pass + REST CRUD, no streaming/agent-loop). Author the cross-provider rows under VALIDATION.md; note the other three axes as N/A-with-justification (classification touches neither streaming, the agent loop, nor provider-routed chat). This mirrors how 117 (also a non-streaming DM phase) carried cross-provider UAT but treated parallel-thread/long-message as the streaming-surface obligation it isn't on.
- Chrome-MCP G-4 lived-experience UAT (UX-01): suggested-not-moved reads instantly; accept → receipt + Undo; dismiss clears; mobile bottom-sheet; rules page builder live count. Operator-defined "I'd recognize failure here" scenarios at scope time.

## Security Domain

> `security_enforcement` is not `false` in config → enabled. Section included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | All `/classification-rules` + accept/dismiss endpoints behind `Depends(get_current_user)` (clone document_views). The ingest rule-eval pass runs service-role in a BG task — app-code user-scoping is the gate (D-118-8). |
| V3 Session Management | no | No new session surface; JWT via existing `get_current_user`. |
| V4 Access Control | yes | Own+global reads via `.or_(user_id.eq.<uuid>,is_global.eq.true)` with the `_uid()` UUID-coercion guard; create hard-sets `is_global=false`; update/delete own-scoped; cross-user miss → 404-not-403 (no existence leak). The two-user leak test (CLASS-02) is the proof, NOT the RLS label. |
| V5 Input Validation | yes | `match_expr` validated by `validate_fields`/`validate_operands`; `ViewFilter` `Literal` op-reject at parse; folder ids coerced to UUID; the matcher never `eval`s — pure dict comparison. |
| V6 Cryptography | no | No crypto in scope. |

### Known Threat Patterns for {FastAPI + supabase-py service-role + in-Python matcher}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user rule leak in the BG task (service-role bypasses RLS) | Information Disclosure | App-code `user_id == uploader OR is_global` predicate; evaluate against uploader's OWN metadata only; live two-user test (D-118-8). |
| Forged `is_global=true` on rule create (privilege/visibility) | Elevation / Tampering | Service hard-sets `is_global=false`; RLS WITH CHECK forces it (defense-in-depth) — clone `document_view_service.py:86`. |
| Injection / SSTI via a `match_expr` value | Tampering | The matcher does NOT interpolate or `eval` — it compares the bound dict value with Python operators; `validate_fields` rejects `_`-prefixed/unknown fields. The preview-count path binds via PostgREST params (SC#4, inherited from 113/114). |
| `.or_()` grammar break via a non-UUID user_id | Tampering | `_uid()` coerces to a canonical UUID string (raises on malformed) — the one runtime-value-into-DSL spot is safe by construction. |
| Existence-leak oracle (404 vs 403) | Information Disclosure | Every cross-user/unseeable miss → uniform 404, never 403 (clone the 113/116/117 contract). |
| Silent auto-move (the milestone anti-feature) | Tampering / honesty | The ingest pass writes a SUGGESTION only; the `folder_id` move happens ONLY on explicit Accept with an audit row. |
| Accept moves a doc into another user's folder | Access Control | Accept re-validates the target folder is readable (own+global) before the move — clone `move_document:1325`. |

## Sources

### Primary (HIGH confidence — code read this session)
- `backend/app/api/documents.py` — `ingest_document` metadata-build → persist (1455-1748), `move_document` (1304), `update_document_metadata` audit (1358-1452). The rule-eval splice point + accept/dismiss clone-targets.
- `backend/app/services/view_filter_compiler.py` — `compile_filter`→`Fragment`, `validate_fields`/`validate_operands`, operator registry. The compiler-reuse boundary.
- `backend/app/services/view_operators_extra.py` — the widened operator set (gte/lte/one_of/contains/is_empty/within_next/older_than/before/after/between).
- `backend/app/services/document_view_resolver.py` — `resolve_filter`/`_apply` (the SQL-against-DB proof) + the leak-safe caller-scoping pattern.
- `backend/app/services/document_view_service.py` — the CRUD clone-target (is_global hard-false, `_uid()` guard, own+global 404).
- `backend/app/api/document_views.py` — the router clone-target (CRUD + audit + ad-hoc resolve `count_only`).
- `backend/app/models/document_view.py` — `ViewFilter`/`ViewCondition` AST to reuse for `match_expr`.
- `backend/app/services/audit_service.py:24` — `classification.apply` + `classification.rule.create` enums live.
- `supabase/migrations/071_dm_foundations.sql:72-86,152-158` — `classification_rules` shape + RLS (no migration needed).
- `frontend/src/components/relationships/RelationshipsSection.tsx` — the panel-section clone-target.
- `frontend/src/components/metadata/DocumentDetailPanel.tsx:221-254` — the reserved Classification slot.
- `frontend/src/components/ingestion/ViewsGroup.tsx` + `NavRow` — the sidebar-group clone-target.
- `frontend/src/App.tsx:9` — the `ActiveView` union to extend.
- `frontend/src/lib/api.ts:1971` — `moveDocument` client fn.

### Secondary (operator-locked design contract)
- `.planning/sketches/036-classification-suggestion/README.md` — Winner A (row chip + panel card), honesty rules, tray-as-secondary graft.
- `.planning/sketches/037-rule-builder-and-list/README.md` — Winner A (list + push/split builder), chip strip, rule-row anatomy, preview-only open-question (resolved by D-118-2).
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — the shared push/split shell + accordion (027/112/117/118 inhabit the same panel).

### Tertiary (LOW confidence)
- None — no WebSearch was needed; the phase is entirely in-repo composition.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every module read this session; no external package.
- Architecture / compiler-reuse decision: HIGH — the "in-Python matcher required" conclusion is grounded in the actual call-site (doc not persisted) + the verified absence of any dict evaluator.
- Pitfalls: HIGH — derived from the 111/112/113/116/117 close-out lessons in STATE.md + the read code.
- Validation/Security: HIGH — clones the 113/116/117 leak-safe + audit-after-write contracts.

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (stable; the only volatility is sibling DM phases touching the same shared files — re-check `documents.py` `ingest_document` line numbers and `DocumentDetailPanel` mount points at plan time, as Phase 117 already shifted them).
