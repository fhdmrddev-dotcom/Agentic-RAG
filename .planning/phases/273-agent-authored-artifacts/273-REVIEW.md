---
phase: 273-agent-authored-artifacts
reviewed: 2026-10-04T00:00:00Z
depth: standard
files_reviewed: 40
files_reviewed_list:
  - backend/app/api/threads.py
  - backend/app/db/artifacts.py
  - backend/app/models/artifact.py
  - backend/app/models/message.py
  - backend/app/services/agent_loop.py
  - backend/app/services/artifact_history.py
  - backend/app/services/harness/grounding.py
  - backend/app/services/openai_service.py
  - backend/app/services/show_artifact_tool.py
  - backend/app/services/structured_text_holdback.py
  - backend/app/services/tool_dispatcher.py
  - frontend/src/components/chat/MessageItem.tsx
  - frontend/src/components/chat/StepRow.tsx
  - frontend/src/components/chat/ToolCallDetails.tsx
  - frontend/src/components/chat/ToolCallPanel.tsx
  - frontend/src/components/chat/artifacts/ArtifactBlock.tsx
  - frontend/src/components/chat/artifacts/ArtifactErrorBoundary.tsx
  - frontend/src/components/chat/artifacts/ArtifactFrame.tsx
  - frontend/src/components/chat/artifacts/ArtifactNotice.tsx
  - frontend/src/components/chat/artifacts/ChartArtifact.tsx
  - frontend/src/components/chat/artifacts/MetricArtifact.tsx
  - frontend/src/components/chat/artifacts/TableArtifact.tsx
  - frontend/src/components/chat/artifacts/artifactCopy.ts
  - frontend/src/components/chat/artifacts/artifactRegistry.ts
  - frontend/src/components/chat/artifacts/artifactSpec.ts
  - frontend/src/components/chat/artifacts/captionModel.ts
  - frontend/src/components/chat/artifacts/chartModel.ts
  - frontend/src/components/chat/tool-bodies/ShowArtifactBody.tsx
  - frontend/src/components/chat/tool-bodies/index.ts
  - frontend/src/components/chat/toolStepDerivation.ts
  - frontend/src/index.css
  - frontend/src/lib/api/threads.ts
  - frontend/src/lib/toolMeta.ts
  - frontend/src/lib/toolNames.ts
  - frontend/src/providers/StreamsProvider.tsx
  - frontend/src/types/index.ts
  - scripts/full-schema-supplement.sql
  - scripts/run-273-board.py
  - scripts/vitest-count-gate.cjs
  - supabase/migrations/202_message_artifacts.sql
findings:
  critical: 2
  warning: 7
  info: 6
  total: 15
status: issues_found
---

# Phase 273: Code Review Report

**Reviewed:** 2026-10-04
**Depth:** standard (phase-273 hunks of the hot files; the new files in full)
**Files Reviewed:** 40
**Status:** issues_found

## Summary

Reviewed the phase-273 diff (`f764734979..HEAD`) against 273-CONTEXT D-01..D-21 / I-1..I-5 / OV-273-04, with the
seven priority checks the caller named.

**What held up (checked, not assumed):**
- **(1) Cross-user/thread access — clean.** Every pool read in `db/artifacts.py` binds `thread_id AND user_id`
  (`_BY_REF_SQL`, `_LABELS_SQL`); a malformed ref returns `None` without a query; `thread_id`/`user_id` in the
  handler come from `ctx`, never from args. Reload attach (`artifact_history.attach_artifacts`) runs on the
  user-JWT client with an explicit thread + user filter, after both routes' thread-ownership 404.
- **(2) Migration 202 — clean.** RLS on; one SELECT policy whose predicate equals the messages one; PUBLIC/anon/
  authenticated/service_role all revoked before the narrow grants; trigger function EXECUTE revoked from PUBLIC
  first; the immutability trigger's FK-upkeep exemption is correct (positive form, NULL falls through to the raise).
  `full-schema-supplement.sql` mirrors the grants.
- **(6) History redaction** is pure, persist-time, covers refused calls, and keeps the id-first result (I-3).
- **(7) No blocking supabase-py in async paths** — `attach_artifacts` uses `aexec`; the store uses asyncpg.
- Frontend typecheck (`npx tsc -p tsconfig.app.json --noEmit`): zero errors in any phase-273 file.

**What did not:** the backend validator and the frontend guard disagree on what a valid spec is, so the model
is told "shown" for specs the only renderer refuses (CR-01, reproduced); and the STRUCTURED holdback only helps
when the parse *succeeds* — a failed or truncated `show_artifact` block is flushed into the answer verbatim,
which is exactly SC#2's "spec as prose" failure mode (CR-02, reproduced). The rest are robustness and data-
fidelity defects.

## Critical Issues

### CR-01: Backend accepts specs the frontend guard refuses — the model is told "Shown to the user" while the user sees "This artifact can't be shown"

**File:** `backend/app/models/artifact.py:520-547` (`validate_dataset`) vs `frontend/src/components/chat/artifacts/artifactSpec.ts:281-284, 207, 234, 403`
**Issue:** I-2/D-12 require that a spec the model gets a success for is one the renderer draws; the model gets the
first chance to fix a bad spec. The two validators diverge on at least four axes, each reproduced against
`validate_args` (all return `ChartArgs`/`TableArgs`, i.e. stored + success result + "Shown to the user below your
answer as chart N"):
1. **scatter with a string x** (`kind: scatter, x: "region"`) — backend accepts; frontend `parseChart:282`
   `kind === "scatter" && xCol.type !== "number"` → `invalid-settings`. A very plausible model mistake.
2. **x column also listed in y** (`x: "r", y: ["r","s"]`) — backend accepts; frontend `:284` refuses.
3. **Numbers outside JS double range** — `_coerce_number` accepts any `_STRICT_NUMBER` string and converts with
   `int(s)` (unbounded) or `float(s)` (a 400-digit decimal → `inf`, verified `[[inf]]`). A huge int stores fine
   and `JSON.parse` yields `Infinity` → `cellOk` fails → notice. The `inf` case reaches asyncpg, which serialises
   `Infinity`, Postgres rejects the jsonb, and the model gets a misleading "couldn't save … try again".
4. **Length units** — Python `len()` counts code points, JS `.length` counts UTF-16 units. A 70-emoji title is 70
   for the backend (≤120 ok) and 140 for `isStr(spec.title, 1, 120)` → notice. Same for column names (64).

Every case is a successful tool result for the model (no retry) and a notice for the user, on reload and live.
**Fix:** make `validate_dataset` the superset of the frontend guard, and pin the parity with a shared fixture:
```python
# validate_dataset, chart branch
x_name = chart.get("x")
if x_name in ys:
    return [], _refusal("fallback", "chart.x must not also be a y series.")
if kind == "scatter" and by_name[x_name].get("type") != "number":
    return [], _refusal("series_not_number", "a scatter chart needs a number column on x.", column=_col_word(x_name))

# _coerce_number: refuse non-finite / out-of-double-range values on EVERY path
val = float(s) if "." in s else int(s)
if not math.isfinite(float(val)) or abs(val) > 1.7e308:
    return False, None

# length caps: measure UTF-16 units to match the frontend, e.g.
def _js_len(s: str) -> int: return len(s.encode("utf-16-le")) // 2
```
Add a `?raw`/fixture fence that runs the same adversarial specs through both `validate_args` and
`parseArtifactRecord` and asserts they agree.

### CR-02: STRUCTURED path — a `show_artifact` block that fails to parse is flushed into the answer verbatim (SC#2 leak)

**File:** `backend/app/services/agent_loop.py:2696-2701`, `backend/app/services/structured_text_holdback.py:97-100`
**Issue:** The holdback holds everything from the first ```` ```json ```` / `{"tool":` opener, then
`finish(False)` returns the held text and the loop emits it as a `delta` (and `full_content` persists it). That is
correct for an ordinary JSON answer, but it is also what happens to a *tool call that failed to parse* — the
likeliest case being a large `show_artifact` call truncated at the output-token limit (unterminated fence; the
parser's `md_pattern` needs the closing ```` ``` ````), or a trailing comma from a weak model. Reproduced:
`feed('Here is the chart.\n```json\n{"tool": "show_artifact", "arguments": {... "rows": [["Q1", 1')` then
`finish(False)` returns the whole held JSON. Up to 500 rows of spec land in the chat body, live and on reload —
the exact "one provider emits the spec as prose" failure mode the holdback (OV-273-04) was added to close, and
it is invisible to the model (no tool error, so no D-12 retry).
**Fix:** distinguish "held text that is a failed tool call" from "held text that is an answer":
```python
_FAILED_CALL = re.compile(r'"tool"\s*:\s*"(?P<name>[A-Za-z_][\w]*)"')
...
if _structured_holdback is not None:
    _held = _structured_holdback.finish(bool(structured_calls))
    if not structured_calls and _held:
        m = _FAILED_CALL.search(_held)
        if m and m.group("name") in known_tool_names:
            # never show it; strip it from what persists, tell the person plainly,
            # and (better) feed a tool error back so the model can retry with fewer rows
            full_content = full_content[: len(full_content) - len(_held)]
            notice = "\n\n*The agent's tool call was cut off and was not run.*"
            full_content += notice
            await _emit(redis, run_id, 'delta', content=notice)
            _held = ""
    ...
```
and add a holdback test for the unterminated-fence and malformed-JSON cases.

## Warnings

### WR-01: Inline structured-format `show_artifact` calls always arrive with truncated (invalid) arguments

**File:** `backend/app/services/tool_parser.py:86` (consumed by `agent_loop.py:2691`; made reachable by `show_artifact`'s nested schema and the holdback's deliberate `{"tool":` hold)
**Issue:** The inline fallback regex captures `arguments` with a non-greedy `(\{[\s\S]*?\})\s*\}`. For any args
object whose last value is itself an object — every chart call, since `chart` is the natural last key — the
match stops at the inner `}}` and drops the outer brace. Reproduced: a valid inline chart call parses to
`'{"component":"chart",...,"chart":{"kind":"bar","x":"q","y":["rev"]}'` (missing final `}`), so
`json.loads` fails → "Error parsing tool arguments". `show_artifact` is the first tool whose args nest two
levels; OpenRouter rows that fall back to the inline form can never emit a chart.
**Fix:** replace the regex with a brace-balanced scan (`json.JSONDecoder().raw_decode` from the opener's `{`),
then read `tool` / `arguments` from the decoded object.

### WR-02: A NUL character in any cell or title makes the insert fail with a misleading "try the call again"

**File:** `backend/app/models/artifact.py:428-441` (`_coerce_text`), `backend/app/services/show_artifact_tool.py:567-583`
**Issue:** Text cells and titles are not checked for `\x00`. Postgres `jsonb` rejects `\u0000`, so
`insert_artifact` raises, and the handler returns `save_failed` — "the artifact could not be stored; try the
call again." Retrying the same data fails identically, so the model loops until the iteration cap. Document-
derived text containing NUL is a known class here (`_strip_nul` exists in `agent_loop` for exactly this, and
the v3.7 `.msg` NUL incident).
**Fix:** strip or refuse NUL in `_coerce_text` and the title/label/unit validators (strip is consistent with
`_strip_nul`), e.g. `return True, v.replace("\x00", "")`.

### WR-03: The "server-derived" caption carries model-typed document names, not the resolved document

**File:** `backend/app/services/show_artifact_tool.py:161-172`
**Issue:** D-04 says the caption is "never written by the model". `_source_of` reads `document_name` /
`filename` from the call's **args** — text the model typed — and `query_tables` resolves that name through
`resolve_document_id` (a lookup that can match a different spelling), echoing the model's string back in its
result. So the caption can show a name that is not the document the rows came from, and a prompt-injected
model can put arbitrary ≤200-char text into the provenance line (it only needs a call that resolves to
something).
**Fix:** take the document name from the tool's **result** (the resolved document's filename / id → filename
lookup), or store the resolved `document_id` on the persisted call and render its real filename.

### WR-04: Numbers are rounded to 2 decimals everywhere — small values render as "0"

**File:** `frontend/src/components/chat/artifacts/artifactCopy.ts:48-54`
**Issue:** `formatNumber` (`maximumFractionDigits: 2`) is used for table cells, metric values, tooltip values
and caption filter values. A rate of `0.0045`, a p-value of `0.0012` or a share of `0.004` renders as `0`; a
metric of `0.0045` shows a bare `0` headline with a `▲` delta. That misstates the stored data on the surface
whose whole point is faithful numbers (SC#3 / G4-1 "the plotted numbers match the source").
**Fix:** use significant digits for small magnitudes, e.g.
`Math.abs(n) > 0 && Math.abs(n) < 1 ? new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3 }).format(n) : NUMBER.format(n)`.

### WR-05: Stacked bar/area with mixed-sign values draws overlapping segments

**File:** `frontend/src/components/chat/artifacts/ChartArtifact.tsx:288, 312`; `chartModel.ts:115-126`
**Issue:** `visibleDomain` computes the stacked domain as separate positive and negative sums (sign-offset
semantics), but `BarChart` / `AreaChart` use recharts' default `stackOffset="none"`, which stacks cumulatively:
`[5, -3]` draws the second segment from 5 down to 2, on top of the first. The tooltip says −3; the bar shows a
segment inside the positive one. Profit/loss or variance data hits this directly.
**Fix:** `<BarChart stackOffset="sign" …>` (and for area either `stackOffset="sign"` or refuse negative values
for `area` in both validators).

### WR-06: STRUCTURED holdback stalls ordinary JSON answers and diverges live vs reload on an aborted stream

**File:** `backend/app/services/structured_text_holdback.py:79-95`, `agent_loop.py:2385-2395`
**Issue:** (a) After any ```` ```json ```` fence or `{"tool":` in prose, every later chunk is held until stream
end — an OpenRouter user who asks for a JSON example sees the answer freeze, then appear at once. (b) If the
drain raises (per-call timeout → `timed_out`, a non-retryable provider error) while text is held, `finish()` is
never called: the held text is in `full_content` (and persisted where the terminal path persists content) but
was never emitted live, so the reloaded message holds text the live view never showed (I-2).
**Fix:** (a) release a held ```` ```json ```` block once its closing fence arrives and the block does not
contain `"tool"` (the parser only accepts objects with a `tool` key); (b) in the exception paths, call
`_structured_holdback.finish(False)` and emit (or deliberately drop *and* strip from `full_content`) the held text
so live and persisted content agree.

### WR-07: Unbounded refusal `detail` can exceed the 2,000-char cut and lose the refusal marker

**File:** `backend/app/services/show_artifact_tool.py:514-527`
**Issue:** The unknown-reference refusal lists **every** label in the thread (`", ".join(labels)`), unbounded.
On a long thread the JSON passes 2,000 chars, and both `tool_end` (`result[:2000]`) and persistence cut it, so
it is no longer JSON: `nodeStateOf` misses `status: "refused"` (green "done" node instead of amber),
`ShowArtifactBody` falls back to "Show an artifact", and `redact_artifact_args` labels the rows "not stored"
rather than "refused".
**Fix:** cap the list (`labels[-20:]` plus `"… and N earlier"`) and assert in a test that every refusal payload
is `< RESULT_MAX_CHARS`.

## Info

### IN-01: Caption provenance is wrong for Continue runs and over-broad within a run

**File:** `backend/app/services/agent_loop.py:2176`, `show_artifact_tool.py:175-203`
**Issue:** A Continue run's `persisted_tool_calls` starts empty, so an artifact emitted after a cap pause reads
"Values provided by the agent" though the data came from the paused run's `query_tables`. Within a run, every
data-bearing call (including an unrelated `web_search`) is listed as the artifact's source.
**Fix:** seed the Continue list with the paused run's persisted data-bearing calls; consider narrowing to calls
whose results the rows could have come from.

### IN-02: Artifact stored but message not persisted on a cancel at the wrong moment

**File:** `backend/app/services/agent_loop.py:3141-3200`
**Issue:** The artifact row is inserted and the `artifact` event emitted inside dispatch; the call is appended to
`persisted_tool_calls` only after `await _emit(... 'tool_end' ...)`. A cancel landing between the two shows the
artifact live but never on reload (no `{missing}` either), and leaves an orphan row.
**Fix:** append the persisted call before the `tool_end` emit, or accept and document it.

### IN-03: `truncateValue` can split a surrogate pair

**File:** `frontend/src/components/chat/artifacts/artifactCopy.ts:71-73`
**Issue:** `s.slice(0, 39)` counts UTF-16 units; an emoji at the cut renders as a lone surrogate (U+FFFD).
**Fix:** `Array.from(s).slice(0, VALUE_MAX_CHARS - 1).join("")` (and measure with `Array.from(s).length`).

### IN-04: Table sort uses the machine locale

**File:** `frontend/src/components/chat/artifacts/TableArtifact.tsx:39`
**Issue:** `localeCompare` without a locale contradicts artifactCopy's pinned-`en-US` rule; sort order differs
by browser locale.
**Fix:** `String(va).localeCompare(String(vb), "en-US")`.

### IN-05: "Same N rows" caption hides sort / column-selection operations

**File:** `backend/app/services/show_artifact_tool.py:332-334`; `captionModel.ts:316-318`
**Issue:** `same_rows` is true for a sort-only or select-only redraw, and the same-rows caption omits
`operations`, so "sorted by revenue, high to low" / "columns: …" never appear.
**Fix:** when `same_rows` and operations are non-empty, append the operation phrases.

### IN-06: Error boundary never resets; mount comment now documents the wrong element

**File:** `frontend/src/components/chat/artifacts/ArtifactErrorBoundary.tsx:17-28`; `frontend/src/components/chat/MessageItem.tsx:954-967`
**Issue:** The boundary keeps `render-failed` even if a replayed frame replaces the record (same key). Separately,
the artifact mount was inserted between the long BUG-260710-01 comment and `<RunTerminalStatus>`, so that comment
now sits above the artifact line instead of the element it describes.
**Fix:** reset state when `record.id` changes (key the boundary by id, or use `getDerivedStateFromProps`); move
the mount above the BUG-260710-01 comment block.

---

_Reviewed: 2026-10-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
