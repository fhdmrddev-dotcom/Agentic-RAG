---
phase: 292-more-ways-to-show-it
reviewed: 2026-10-24T00:00:00Z
depth: standard
diff_base: ba8e38c05
diff_head: e2c1e8b2e
files_reviewed: 23
files_reviewed_list:
  - backend/app/db/artifacts.py
  - backend/app/models/artifact.py
  - backend/app/services/agent_loop.py
  - backend/app/services/artifact_history.py
  - backend/app/services/artifact_sources.py
  - backend/app/services/openai_service.py
  - backend/app/services/show_artifact_tool.py
  - backend/app/services/tools/base.py
  - frontend/src/components/chat/artifacts/ArtifactFrame.tsx
  - frontend/src/components/chat/artifacts/ArtifactTooltip.tsx
  - frontend/src/components/chat/artifacts/ComparisonArtifact.tsx
  - frontend/src/components/chat/artifacts/DiagramArtifact.tsx
  - frontend/src/components/chat/artifacts/TimelineArtifact.tsx
  - frontend/src/components/chat/artifacts/artifactCopy.ts
  - frontend/src/components/chat/artifacts/artifactRegistry.ts
  - frontend/src/components/chat/artifacts/artifactSpec.ts
  - frontend/src/components/chat/artifacts/captionModel.ts
  - frontend/src/components/chat/artifacts/comparisonModel.ts
  - frontend/src/components/chat/artifacts/diagramLayout.ts
  - frontend/src/components/chat/artifacts/timelineModel.ts
  - frontend/src/components/chat/tool-bodies/ShowArtifactBody.tsx
  - scripts/apply_migration_213.py
  - supabase/migrations/213_message_artifacts_more_components.sql
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: fixed
fix_round: 1
fixed_at: 2026-10-24
fixed: [CR-01, WR-01, WR-02, WR-03, WR-04, WR-05, IN-02, IN-04, F-1]
deferred: [IN-01, IN-03]
needs_live_verification: [F-1]
---

# Phase 292: Code Review Report

**Reviewed:** 2026-10-24
**Depth:** standard (the phase's own hunks, `git diff ba8e38c05 e2c1e8b2e`; the new files read in full)
**Files Reviewed:** 23
**Status:** issues_found

## Summary

I reviewed the three new artifact types (diagram, comparison, timeline) end to end: backend validation,
source resolution, stored spec, tool schema, history redaction, migration 213, the frontend guard, the
three renderers and the tooltip. I checked them against 292-CONTEXT D-01..D-26 and I-1..I-4, and
against the defects in 273-REVIEW.

**Checked and found sound (each one traced or reproduced, not assumed):**
- **XSS / I-3.** No `dangerouslySetInnerHTML` or `innerHTML` anywhere under `artifacts/`. Every model
  string and every excerpt renders as a React text node. Inline styles carry only numbers produced by
  the layout. The `<marker>` ids come from the guard-validated record id (`^a_[0-9a-z]{10}$`) plus a
  sanitised `useId()`. No model node id ever becomes a DOM id, a key or a URL fragment.
- **Prototype keys.** `NODE_ID_RE` does accept `__proto__` and `constructor` (I reproduced:
  `validate_args` returns `DiagramArgs`). But node ids are only ever used as `Map` / `Set` keys
  (`diagramLayout.ts:150`, `artifactSpec.ts:559`), so this is safe. Every closed table (component,
  node kind, verdict, glyph, verdict word, alias) is read through `own()`. `BADGE_TONE[verdict]` and
  `PAD_X[kind]` are indexed only with guard-validated literals.
- **Layout termination.** The back-edge DFS is iterative. With the back edges removed, the remaining
  edges form a DAG by construction, so Kahn's pass always drains. Self-loops are classed as back edges.
  Cycles cannot loop forever.
- **Cross-tenant sources.** A handle only ever indexes `ctx.turn_citations`, which is this run's own
  `retrieved_citations`. An out-of-range, zero, boolean or non-integral handle is refused. A forged
  number cannot reach a document outside the run (WR-01 covers the within-run mis-numbering).
- **History redaction (D-11).** All three encodings are replaced. A placeholder echoed back is refused
  before any decode. A refused call is labelled "refused". The redaction is pure: no input is mutated.
- **Schema.** No `anyOf`/`oneOf`. Nullable objects use `["object","null"]`, which the Gemini sanitiser
  collapses. The enums stay non-nullable. The tool count is unchanged (I-4).
- **Migration 213.** It widens exactly the two CHECKs, keeps RLS and the size and row caps, is
  idempotent, and its VERIFY counts one CHECK per column.
- **273 regressions.** NUL is stripped before validation (WR-02 still holds). Refusal details go
  through `_refusal_text` (WR-07). The caption takes document names from server data, never model
  args (WR-03). `_cut` slices by code point, so it never splits a surrogate pair (IN-03).

**Not sound:** the backend validator and the frontend guard disagree again, in three new ways. In each
case the model is told "Shown to the user" while the user sees "This artifact can't be shown" (CR-01,
all three cases reproduced). That is the 273 CR-01 class reappearing on the new arms. The other
findings cover source numbering, renderer correctness and robustness.

## Critical Issues

### CR-01: Backend accepts encoded specs the frontend guard refuses — model told "shown", user sees the notice (273 CR-01 class, reintroduced)

**Files:**
- `backend/app/models/artifact.py:541` (`_DATE_RE`), `:613-626` (`is_event_date`), `:584-602` (`_req_text` / `_opt_text`), `:1063` (`StoredSource.document`)
- `backend/app/services/artifact_sources.py:49-54` (`_clean_document`)
- vs `frontend/src/components/chat/artifacts/artifactSpec.ts:393` (`DATE_RE`), `:370-372` (`isText`), `:525` (`parseSource`)

**Issue:** CONTEXT says the frontend's only allowed asymmetry is that it renders 1 node and 0 edges.
I reproduced three more, each of which stores a row and returns a success result for a spec that only
renders as a notice, live and on reload. Because the model got a success, it never gets the D-12
chance to fix the spec.

1. **Non-ASCII digits in dates.** In a Python `str` pattern, `\d` matches any Unicode decimal digit,
   and `int()` parses them. So `is_event_date("٢٠٢٤-01-15")` and `is_event_date("２０２４-01")` both
   return `True`, `validate_args` returns `TimelineArgs`, and `StoredTimelineEvent` accepts the value.
   In JavaScript, `\d` is ASCII-only, so `parseCalendarDate` returns null and the guard throws
   `bad-date`. Fullwidth digits are a plausible copy from CJK documents.
2. **Source document length counted in different units.** `_clean_document` cuts at
   `v[:200]` **code points**, and `StoredSource.document` uses `max_length=200` (also code points).
   The frontend counts **UTF-16 units**: `isStr(raw.document, 0, 200)`. A filename of 150 emoji plus
   `.pdf` resolves to 154 code points / 304 UTF-16 units (reproduced). It passes the backend and fails
   the guard, and one bad source refuses the whole artifact. This also breaks the module's own rule
   that "every string cap counts UTF-16 units".
3. **"Blank" means different things.** `_req_text` checks `v.strip()`, but Python's `strip()` does
   not remove U+FEFF. JavaScript's `trim()` does. So an option, term name, node label or event title of
   `"\ufeff"` passes the backend (reproduced: `ComparisonArgs`) and fails `isText`, which gives
   `invalid-settings`.

**Fix:** restrict the backend to the browser's alphabet and units, then add the three cases to the
shared `artifact_bad_specs_v1.json` parity fixture so both validators are pinned:
```python
_DATE_RE = re.compile(r"^([0-9]{4})-(0[1-9]|1[0-2])(?:-([0-9]{2}))?$")   # ASCII only, as JS \d
_SOURCE_STR = re.compile(r"^(?:\[\s*([0-9]{1,9})\s*\]|([0-9]{1,9}))$")

_JS_TRIM = " \t\n\v\f\r\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"
def _is_blank(v: str) -> bool:      # blank by BOTH rules (Python strip and JS trim)
    return not v.strip() or not v.strip(_JS_TRIM)

# artifact_sources._clean_document: cut by UTF-16 units, never mid-pair
def _clean_document(v):
    ...
    return _cut_units(v, MAX_SOURCE_DOCUMENT_CHARS) if v else None   # no ellipsis; reuse _cut's loop
# StoredSource.document: replace max_length with a _stored_js_cap validator
```

## Warnings

### WR-01: A `source: n` handle resolves against citations the model never saw numbered (same response, and on resume)

**Files:** `backend/app/services/show_artifact_tool.py:671`; `backend/app/services/agent_loop.py:2222, 2250, 2351-2354, 3138, 3164-3188`

**Issue:** The numbered manifest is injected once per iteration, before the provider call
(`apply_citation_instruction`, `agent_loop.py:2351`). Tools from that response then run in order, and
each one appends to `retrieved_citations` (`:3188`). The ToolContext holds that same list by reference.
So when one response contains both `search_documents` and `show_artifact` (a common shape for "find X
and chart it"), `show_artifact` resolves `n` against citations that were added after the model's
manifest was built, or that it never saw at all. On a first-iteration batch the model has no manifest
and is guessing, yet any `n` up to the new count resolves.

The resolved excerpt is real document text, chosen by word overlap, so a wrong attribution looks
authoritative in the tooltip. The resume path (`:2222`) has the same problem: the paused batch was
written against the paused run's manifest, but it resolves against the fresh run's list. The handle
can never leave the run (so no cross-tenant leak), but D-07's "points at a result retrieved earlier
in the same turn, the [n] the model saw" does not hold.

**Fix:** freeze the size of the manifest the model saw, and refuse anything beyond it:
```python
# agent_loop, where the manifest is injected each iteration:
tool_ctx.turn_citations_seen = len(_deduplicate_citations(retrieved_citations))  # 0 before any retrieval
# resume ctx: turn_citations_seen = 0  (the paused manifest is not this run's)

# show_artifact_tool._show_encoded:
resolved = resolve_sources(handles, ctx.turn_citations, texts, seen=getattr(ctx, "turn_citations_seen", 0))
# artifact_sources.resolve_sources: k = min(len(unique), seen); refuse h > k with
#   "source N wasn't in the list you were shown; search first, then call show_artifact in a later step."
```

### WR-02: A "Not stated" (`q`) cell accepts and shows a document excerpt

**Files:** `backend/app/models/artifact.py:751-773` (`ComparisonCell.source`); `frontend/src/components/chat/artifacts/ComparisonArtifact.tsx:149-152, 236-251`; `captionModel.ts:90-91`

**Issue:** `q` means "not stated in what was retrieved" (D-05). The cell is forced to read `Not stated`
whatever its text says. But a `q` cell may still carry `source: n`. The backend resolves it, the guard
accepts it, and hovering shows a quoted clause from a document under a cell that says the document is
silent. On top of that, the caption's second line switches to "Hover or focus a cell for its clause"
even when the only sourced cells are `q` cells. The provenance surface ends up contradicting the
verdict it decorates.

**Fix:** refuse it at the model layer (`ComparisonCell` `model_validator(mode="after")`:
`if self.verdict == "q" and self.source is not None: _raise("fallback", "a q (not stated) cell carries no source; omit it.")`).
Mirror it in `StoredComparisonCell`, and in `parseComparison` treat a sourced `q` cell as
`invalid-settings` (or ignore its source). Count only non-`q` sourced cells in `captionSegments`.

### WR-03: Chart / table / metric calls are now refused when a model fills the new encodings with empty values

**Files:** `backend/app/models/artifact.py:506-530` (`ChartArgs` / `TableArgs` / `MetricArgs`: `diagram: None = None` …) vs `:945-953` (`_Encoded._own_data_only`)

**Issue:** The schema now advertises three nullable objects, each with `required` sub-keys, on every
`show_artifact` call. The encoded arms tolerate empty fillers in foreign fields (`{}`, `[]`, `""`,
`"null"` become None). The tabular arms tolerate only `null`. Reproduced: a valid chart call plus
`"diagram": {}` returns the generic refusal "its settings weren't valid" with detail
"`diagram`: Input should be None." Before 292 that key did not exist in the schema, so no model sent
it. Models that fill every advertised property (coerce-tier Moonshot / Kimi and some OpenRouter rows,
which CONTEXT D-26 already flags) can now fail charts that used to work. That is a cross-provider
regression risk on 273's arms that the SC#10 board (292-03) may or may not exercise.

**Fix:** apply the same empty-filler normalisation in `_ArgsBase` (a `model_validator(mode="before")`
that sets `diagram`/`comparison`/`timeline` to None when they are `{}`/`[]`/`""`/`"null"`). Add one
chart test per filler shape.

### WR-04: Diagram edge labels escape the layout box — self-loop labels are clipped, back-edge labels sit under nodes

**Files:** `frontend/src/components/chat/artifacts/diagramLayout.ts:225-239, 243-258`; `DiagramArtifact.tsx:186-207`; `ArtifactFrame.tsx:35`

**Issue:** Labels are `whitespace-nowrap` with no width bound. A self-loop label starts at
`a.x + a.width + 20` and runs right. At the 311px fallback width, a single self-looped node in its row
ends near x=193, so a 24-character label (about 160px) ends near x=379. That is past the diagram, and
the frame's `overflow-hidden` cuts it off mid-word. That breaks D-16 ("fits the chat column at every
viewport") and hides the reason the loop exists.

Back-edge labels are anchored `end` at `rx ≈ width − 8` and run left across the node area. Labels
render before the node boxes in the DOM, so the nodes cover them.

**Fix:** clamp each label's anchor so `labelX + estimatedWidth ≤ width` (self-loop: if it would
overflow, place the label above the loop with `labelAlign: "end"` at `a.x + a.width`). Give labels a
`max-width` with `truncate` plus a `title`/aria fallback. Render edge labels after the nodes (or at
`z-[1]`) so back-edge labels stay readable. Add a layout test asserting
`labelX (+ width estimate) ≤ layout.width` for every edge.

### WR-05: `Date.UTC` maps years 0–99 to 1900–1999, so deadline pills for those dates are wrong

**File:** `frontend/src/components/chat/artifacts/timelineModel.ts:65-67`

**Issue:** `daysBetween` calls `Date.UTC(b.y, b.m - 1, b.d, 12)`. For `0 ≤ y ≤ 99`, ECMAScript adds
1900 (verified: `new Date(Date.UTC(50,2,1)).getUTCFullYear() === 1950`). Both the backend and the guard
accept day-precision years 0001–0099 (only year 0 is refused, by `datetime.MINYEAR` and
`parseCalendarDate`). So a deadline on `0024-05-10` (for example, a model's typo for 2024) gets a pill
computed against 1924 rather than year 24. The month-precision path is pure arithmetic and is correct,
so the two precisions disagree for the same year.

**Fix:** compute day numbers without the two-digit-year rule, e.g.
```ts
function dayNumber(y: number, m: number, d: number): number {
  const t = new Date(Date.UTC(2000, m - 1, d, 12)); t.setUTCFullYear(y); return Math.round(t.getTime() / DAY_MS)
}
```
Alternatively, refuse years < 1000 in both validators (a contract date before 1000 is a typo), which
also closes the stored-row path.

## Info

### IN-01: The tooltip is positioned once and detaches on scroll or resize

**File:** `frontend/src/components/chat/artifacts/ArtifactTooltip.tsx:65-73`
**Issue:** `position: fixed` is computed in a layout effect keyed only on `[anchor, source]`. If the
chat scrolls (wheel or keyboard) while a node, cell or source line is hovered or focused, the anchor
moves and the tooltip stays where it was.
**Fix:** recompute on `scroll` (capture) and `resize` while mounted, or dismiss on scroll.

### IN-02: One malformed citation makes every source read "nothing was retrieved"

**File:** `backend/app/services/artifact_sources.py:123-132`
**Issue:** If any citation lacks `document_id`, `_deduplicate_citations` raises `KeyError`. The catch
then sets `unique = []`, so every handle is refused with "nothing was retrieved in this turn", even
when other citations are fine. That is a false sentence to the model.
**Fix:** filter `c.get("document_id") is not None` before deduplicating, matching the manifest builder
if it does the same; otherwise use a distinct refusal detail.

### IN-03: Long node labels are silently clamped at narrow widths

**File:** `frontend/src/components/chat/artifacts/diagramLayout.ts:186-189`; `DiagramArtifact.tsx:265`
**Issue:** At `nw = 88`, a label gets about 9 characters per line, so a 48-character label needs 6
lines. Height is capped at 4 lines and `line-clamp-4` hides the rest. The full label only exists in
`aria-label`.
**Fix:** expose the full label via a `title`, or let node height grow up to the 6 lines the cap
implies.

### IN-04: `_clean_document` is duplicated

**File:** `backend/app/services/artifact_sources.py:49-54` vs `backend/app/services/show_artifact_tool.py:213`
**Issue:** Two copies of the caption's document-hygiene rule, kept equal only by a comment. CR-01's
fix has to land in both.
**Fix:** move the function into `app.models.artifact` (already imported by both) and import it from
there.

## Fix log

Fixed 2026-10-24 by the gsd-code-fixer, on `develop`, one commit per finding, each with a failing test
first. Cross-stack cases sit in the shared fixture `backend/tests/unit/fixtures/artifact_bad_specs_292.json`,
which both `test_292_artifact_parity.py` and `artifactParity292.fence.test.ts` read. The backend-only halves
are in `backend/tests/unit/test_292_review_fixes.py`.

| Finding | Commit | What changed |
|---|---|---|
| CR-01 + IN-04 | `8738d5d85` | Dates and source handles match `[0-9]` only. Required text is blank by Python `strip` OR JS `trim` (U+FEFF), and blank optional text is stored as null. `clean_document_name` now lives in `app.models.artifact`: it cuts at 200 UTF-16 units and never splits a pair. The caption and the per-element source both import it, so the old duplicate is gone (IN-04). `StoredSource.document` and the stored required strings check the same rules. The fixture gains 8 bad cases, plus `stored_sources` and `document_names` sections. |
| WR-02 | `fdf2ed22c` | The backend refuses a sourced `q` cell in words (new `_R` key `not_stated_with_source`: "a cell marked not stated cites a source"), and `StoredComparisonCell` mirrors it. **Deviation, on purpose:** the frontend guard does not refuse such a cell. It validates the source, then drops it. A measured 3 of the 12 local comparison rows already carry sourced `q` cells, including the G4-2 openai record `a_91uke5giiv` and board openai `a_d9gad5mrif`. A guard refusal would have turned those owed G-4 threads into notices. The fixture pins this with a new `refused_then_tolerated` section: the backend refuses, and the guard parses with every `q` source null. That is the safe direction of asymmetry, not the CR-01 one. The caption's hover note and the cell tooltip count only cells with a verdict. |
| WR-03 | `876845f5a` | `_ArgsBase` reads `{}` / `[]` / `""` / `"null"` / `"{}"` / `"[]"` in `diagram` / `comparison` / `timeline` as absent on chart, table and metric calls, without mutating the caller's args. `_Encoded`'s foreign-field rule uses the same `_is_empty_filler`. |
| WR-01 | `96d3137d2` | `agent_loop` sets `citations_shown` where it injects the manifest and passes `ToolContext.turn_citations_seen`. The resume build passes 0, and so does any unwired caller. `resolve_sources(seen=)` refuses a handle above that count ("search first, then call show_artifact in a later step"). |
| IN-02 | `b5eb78177` | A citation with no `document_id` key is skipped instead of collapsing every source to `[]`. An unhashable id gets its own detail. |
| WR-05 | `43a1f6974` | Day counts are integer day numbers, computed with days-from-civil arithmetic. No `Date.UTC`, so years 1-99 are read literally. The test cross-checks every month's first and last day against `Date.UTC` for years ≥ 100. |
| WR-04 | `cbdf05af9` | The layout gives every edge a `labelMaxWidth`, the room from its anchor to the body edge. Centred labels slide inward to fit. The renderer truncates past that width, puts the full text in `title`, and paints labels after the nodes. **Partial:** a back-edge label can still overlap a node in the gutter-side area. It now paints on top and stays readable, but hovering it leaves the node's hover state. The review's "place the self-loop label above the loop" option was not taken, because above the node it would collide with incoming arrows and their labels. |
| F-1 | `a127c2462` | The `show_artifact` description's comparison clause now tells the model to call `component comparison` instead of writing a markdown table when the user asks to compare named options on several terms (2,526 → 2,761 chars; the chart example is still first; SYSTEM_PROMPT is untouched). For `test_278_registry_pin`, the old description, restored in memory, hashed to all 8 pinned 292-01 digests, so the description is the only byte change. The digests were then re-captured, with the old ones kept in a comment. **Needs live verification:** re-run the verbatim D-22 prompt on anthropic and openai. |

**Deferred (Info, documented, not fixed):**
- **IN-01** (the tooltip detaches on scroll or resize). Re-open with the next phase that touches `ArtifactTooltip.tsx`, or if a G-4 drive shows it.
- **IN-03** (long node labels clamped at narrow widths; the full text is only in `aria-label`). Re-open alongside IN-01, or when the WR-04 label work is next revisited.

**Measured after the fixes:**
- Backend `pytest tests/unit -k "273 or 292 or 278 or closed_core"`: 598 passed (522 before).
- Frontend targeted vitest (artifacts, both parity fences, tool-bodies): 20 files, 327 passed (319 before).
- Count-gate pins raised in the same commits: artifactParity292 13 → 16, artifactSpec 64 → 65, captionModel 21 → 22, timelineModel 16 → 17, diagramLayout 20 → 21, DiagramArtifact 17 → 18.

---

_Reviewed: 2026-10-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
