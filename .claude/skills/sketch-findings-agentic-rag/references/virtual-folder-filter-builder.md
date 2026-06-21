# Virtual-Folder Filter & View Builder (Phase 114 — sketches 029, 030)

The no-DSL surface where a user composes a metadata filter on the Documents page and saves it as a reusable view. Winners: 029-A (chip-strip builder) + 030-A (operator-encodes-direction relative-date control). Backed by the Phase 113 closed-registry compiler; Phase 114 adds the operator set + relative dates.

## Design Decisions

- **One surface, two uses (D-114-1).** The builder is an **inline chip strip on the Documents page** — NOT a modal (breaks push-never-overlay) and NOT a separate page. `Where [chip] [chip] ＋condition … N match · Save as view`. Ad-hoc filtering and saved views are the *same* mental model; **Save-as-view just persists what you're already looking at**. Selecting a saved view loads its filter back into the same bar.
- **Live debounced match count (D-114-2).** As conditions change, show **"N documents match"** (debounced). Immediate feedback is what makes a no-DSL builder trustworthy. The count turns **amber at zero**. Drive it from an **additive count-only resolve mode** (`select("id", count="exact")` + `head=True`, own+global DISTINCT dedupe) — never materialize the full listing per keystroke (SC#3 at ~10k docs). D-114-15.
- **Views are mutable, edited in place (D-114-3).** Editing a saved view reopens the bar pre-filled and PATCHes the same row — a personal convenience, not an immutable published artifact (no version/copy semantics; that's for workflows).
- **Type-aware operators, NO on-screen type lecture.** The operator menu shows only operators valid for the chosen field's type — and that's the ONLY place the type system appears. **The developer-facing "operator-by-type matrix" was deleted** (it exposed `string/enum/hot·indexed/cast` to a user who just picks a field, and it caused an awkward `title · author · summary · language` wrap). The control already adapts; one quiet hint ("The choices change to fit the field you pick") is enough.
  - string (`title/author/summary/language`): is · is not · contains · one of · is empty
  - `document_type` (hot, indexed): is · is not · one of · contains · is empty
  - `date` (hot, indexed): within next… · older than… · before · after · between · is empty
  - number (custom, cast): = · ≠ · > · < · between · is empty
  - enum/boolean (custom): is · one of · is empty
- **Relative-date control = the operator encodes the direction (030-A).** The date operator dropdown carries the full vocabulary including `within next…` / `older than…`; choosing a relative entry reveals a `[N] [unit]` stepper. Show:
  - a **live resolved-window readout** (`→ Jun 19 – Sep 17, 2026`) — the dates that will actually match;
  - a plain **"recomputed-live" line** ("Updates automatically — the dates shift forward as time passes"), because a relative view drifts with the calendar (D-114-4);
  - for `within next…`, an **overdue-excluded note** ("Shows items coming due in this window. Already-overdue items are not included.") — "coming due soon", not "overdue + soon" (D-114-5);
  - optionally a tiny **today→window timeline** so the semantics are felt.
  - Months count as ≈30 days; the headline dates are the contract. Server derives "today" at resolve time (D-114-16 — gives Phase 115's agent-tool live-recompute for free).
- **Case-insensitive matching that "just works" on real data (D-114-10).** `document_type`/`language` are already stored lowercase, so **lowercase the query value at resolve/save** (mirror `retrieval_service.py:264-266`, which the view-resolve path doesn't do yet). Free-text fields (`title/author/summary`) use `lower()=lower()`/`ILIKE` on both sides. `contains` = `ILIKE %v%`; `one_of` = case-insensitive membership; `is_empty` = absent OR `''`/`[]`.
- **Plain end-user language throughout.** No "ANDed", "never extracted", "query", "compiles", color self-references, or phase numbers on screen. Operator words render in **plain sans, not code-style monospace** (reserve mono for counts/dates).

## CSS Patterns

```css
/* condition chip — plain-language, sans operator word */
.chip { display:inline-flex; align-items:center; gap:6px; background:var(--color-surface);
  border:1px solid var(--color-border); border-radius:var(--radius-full); padding:4px 6px 4px 10px; font-size:var(--text-sm); }
.chip .cf { font-weight:500; }                 /* field */
.chip .co { color:var(--color-primary); font-size:var(--text-xs); }  /* operator — SANS, not mono */
.chip .rm { background:none; border:none; color:var(--color-text-dim); cursor:pointer; }
.add-cond { background:transparent; border:1px dashed var(--color-border); color:var(--color-text-muted);
  border-radius:var(--radius-full); padding:5px 12px; }

/* live count, amber at zero */
.count-live b { color:var(--color-primary); }
.count-live.zero b { color:var(--color-warning); }

/* relative-date stepper + resolved readout */
.stepper { display:inline-flex; border:1px solid var(--color-border); border-radius:var(--radius-sm); overflow:hidden; }
.stepper button { background:var(--color-muted); width:30px; }
.stepper input { border:none; width:54px; text-align:center; }
.resolved .headline .win { color:var(--color-success); font-family:var(--font-mono); }
.resolved .live-note { color:var(--color-primary); }  /* pulsing dot = recomputes live */
.resolved .warn-note { color:var(--color-warning); } /* overdue excluded */
```

## HTML Structures

- **Filter bar (029-A):** `Where` lead → chips → `＋ condition` → spacer → right cluster (`N match` · `Save as view`). Conditions edit in a small popover anchored to the chip. "Save as view" → inline name input → confirmation toast → the view appears in the sidebar Views group.
- **Relative-date control (030-A):** `Field ▾ | Operator ▾ | [stepper N][unit ▾]` then the resolved-window readout block + timeline beneath. Variant B (segmented mode) and C (preset chips) are documented alternatives in the source.

## Backend contract the build inherits (R-114-A / R-114-B resolved)

- The Phase 113 compiler output **widens** from one `metadata @> $1::jsonb` containment dict to an **ordered list of bound WHERE-fragment descriptors**. Containment survives only for promoted typed-column exact + boolean/number eq. Rewrite the three 113 containment-dict unit tests; **keep the SC#4 injection test byte-for-byte green** (bound literals, no f-string SQL, field names from the whitelist only).
- The AST grows optional `value2`/`values`/`unit` (between / one_of / relative) — additive; existing `eq` rows still parse, no row migration.
- Typed columns (`date`, `document_type`) are `GENERATED ALWAYS AS (...) STORED` from `metadata->>'…'` — **auto-backfill, no re-extraction**. The date cast MUST be ISO-regex-guarded (`CASE WHEN … ~ '<iso>' THEN (…)::date ELSE NULL END`) so a malformed stored date breaks neither the ALTER nor future inserts.

## What to Avoid

- ❌ A modal or separate-page builder (breaks push-never-overlay; fragments filtering).
- ❌ An on-screen operator/type matrix or any DB/index/type jargon (deleted — the control adapts).
- ❌ Monospace for plain operator words; "ANDed"/"query"/"never extracted"/phase numbers in copy.
- ❌ Baking an absolute window at save time for relative dates (must recompute server-side at resolve).
- ❌ Materializing the full listing for the live count (use the count-only mode).
- ❌ Re-introducing deferred features: sort-by-field, nested OR/NOT, metadata→pseudo-folder grouping, user-shared views.

## Origin

Synthesized from sketches **029** (winner A — chip strip) + **030** (winner A — operator-encodes-direction), revised 2026-06-19 after the integration audit (workflow `wf_dc339594-8bb`). Source files: `sources/029-filter-builder-bar/`, `sources/030-operator-and-relative-date-control/`. Decisions: `.planning/phases/114-*/114-CONTEXT.md` (D-114-1..6, 10..16; R-114-A/B resolved).
