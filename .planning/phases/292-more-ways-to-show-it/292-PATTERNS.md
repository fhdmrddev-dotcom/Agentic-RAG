# Phase 292: More Ways to Show It - Pattern Map

**Mapped:** 2026-10-24
**Files analyzed:** 41 (13 backend source/migration, 14 frontend source, 14 test/fixture/script; edits + new)
**Analogs found:** 40 / 41 (every file has a Phase 273 analog except the diagram layout algorithm, whose analog is the sketch, not the codebase)

All analogs below were read at HEAD `52f74b585`. Line numbers are that HEAD's.

---

## ⚠ Contract conflicts between the three input docs (the planner must resolve these first)

RESEARCH.md was written from the pre-correction CONTEXT; UI-SPEC.md (signed off) and the corrected
CONTEXT D-05 disagree with it in places. Each needs one explicit pick in the plan, and the pick must
land in BOTH stacks and the shared fixture (CR-01).

| Topic | RESEARCH.md says | UI-SPEC.md says | Recommendation |
|---|---|---|---|
| Verdict words for `y/n/m/q` | yes / no / partly / not stated (Open Question 1) | Favourable / Unfavourable / Neutral / Not stated (UI-D-292-10) | **UI-SPEC** — CONTEXT D-05 was corrected to this on 2026-10-24; RESEARCH's OQ-1 is superseded. Tool description must use the same words |
| Pure diagram layout file name | `diagramModel.ts` | `diagramLayout.ts` | Pick one; the hot-file ledger young row must name the chosen path |
| Shared hover popover | `ArtifactExcerpt.tsx` | `ArtifactTooltip` (portalled, `role="tooltip"`, `{artifactId}-tip`) | **UI-SPEC** behaviour (portal, Escape, anchored); pick one file name |
| String caps | node label 80, edge label 40, option 60, term 80, event title 120, category 32 | node 48, edge 24, option 40, term 60, title 80, detail 200, category 24 (UI-D-292-24: "the backend refuses above them") | **UI-SPEC** — they are what the layout holds at 375px; RESEARCH's are looser than the renderer can draw (I-3 says the guard rejects what the renderer would not draw) |
| Node / edge minimums | 1-25 nodes, edges unconstrained below | `too_few_nodes` (≥ 2 steps), `no_edges` (≥ 1 link) | UI-SPEC; one decision, mirrored in `_R`, guard, fixture |
| Duplicate edge rule | identical `(from, to, label)` twice | any duplicate `from→to` (UI-D-292-27) | UI-SPEC (they would draw on top of each other) |
| Backend `_R` key names | `too_many_nodes`, `self_loop`, `cell_count`, `source_unknown`, `source_no_retrieval`, `not_by_reference`, `unknown_node`… | `too_many_nodes`, `too_few_nodes`, `no_edges`, `self_loop_unlabelled`, `ragged_term`, `unresolved_source`, `reference_new_type`, `reference_into_new_type`, `component_alias`… (UI-SPEC §Rail refusal reasons) | UI-SPEC table is the copy contract; RESEARCH's `source_no_retrieval` vs `source_unknown` split can stay in model-facing `detail` while the people-facing reason is UI-SPEC's single `unresolved_source` |
| Frontend `NoticeReason` additions | `missing-step`, `too-many-items` | `too-many-items`, `wrong-option-count`, `no-items`, `broken-link`, `ragged-term`, `bad-date` | UI-SPEC catalogue |
| Success result keys | `RESULT_KEY_ORDER` unchanged | result must carry `edge_count` (diagram) and `option_count` (comparison) for the rail (UI-D-292-19) | UI-SPEC — `RESULT_KEY_ORDER` (artifact.py:89-92) widens; `ShowArtifactBody` reads the two new keys; result stays < 2000 |

---

## File Classification

### Plan 292-01 — backend contract + migration

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/models/artifact.py` (edit) | model (closed vocabulary + validation) | transform / validation | itself — `ChartArgs`/`MetricArgs` arms, `StoredArtifactSpec`, `_R` | exact (extend in place) |
| `backend/app/services/artifact_sources.py` (NEW) | utility (pure resolver) | transform | `show_artifact_tool.build_caption` + `_clean_document` (show_artifact_tool.py:207-285); `citation_markers._deduplicate_citations` (citation_markers.py:70-84) | role-match |
| `backend/app/services/show_artifact_tool.py` (edit) | service (tool handler) | request-response | itself — `handle_show_artifact` (541-679), `_stored_spec` (526-535), `_note` (443-449), `build_result` (452-505) | exact |
| `backend/app/services/artifact_history.py` (edit) | utility (persist-time rewrite) | transform | itself — `redact_artifact_args` (75-94), `_placeholder` (63-72) | exact |
| `backend/app/db/artifacts.py` (edit, one message) | db helper | CRUD | itself line 131-132 | exact |
| `backend/app/services/openai_service.py` (edit, `SHOW_ARTIFACT_TOOL` only) | config (tool schema) | request-response | itself — `SHOW_ARTIFACT_TOOL` `chart`/`metric` objects (1226-1245), `transform.filter[]` nested objects (1249-1263) | exact |
| `backend/app/services/tools/base.py` (edit, +1 field) | model (dataclass leaf) | — | itself — `turn_tool_calls` field (69-74) | exact |
| `backend/app/services/agent_loop.py` (edit, +2 kwargs) | service wiring | — | itself — `turn_tool_calls=persisted_tool_calls` at 2221 and 3136 | exact |
| `supabase/migrations/213_message_artifacts_more_components.sql` (NEW) | migration | — | `supabase/migrations/202_message_artifacts.sql` (header 1-55, CHECKs 68-69, COMMENTs 79-108, VERIFY 179-214) | exact |
| `supabase/full-schema.sql` (regenerated) | artifact | — | `bash scripts/regenerate-full-schema.sh` (never hand-edit) | n/a |
| `backend/tests/unit/fixtures/artifact_record_292.json` (NEW) | test fixture | — | `fixtures/artifact_record_v1.json` (top-level record + `examples[]`) | exact |
| `backend/tests/unit/fixtures/artifact_bad_specs_292.json` (NEW) | test fixture | — | `fixtures/artifact_bad_specs_v1.json` (`about`/`bad`/`good`, `$repeat` convention) | exact |
| `backend/tests/unit/test_292_artifact_models.py` (NEW) | test | — | `test_273_artifact_models.py` | exact |
| `backend/tests/unit/test_292_show_artifact_new_types.py` (NEW) | test | — | `test_273_show_artifact_tool.py` (`_ctx`, `_Store`, patch-where-used) | exact |
| `backend/tests/unit/test_292_artifact_sources.py` (NEW) | test | — | `test_273_show_artifact_tool.py` caption cases | role-match |
| `backend/tests/unit/test_292_artifact_history.py` (NEW) | test | — | `test_273_artifact_history.py` | exact |
| `backend/tests/unit/test_292_artifact_parity.py` (NEW) | test | — | `test_273_review_fixes.py` (`PARITY_FIXTURE`, `_expand`, parametrized bad/good at :18-60) | exact |
| `backend/tests/unit/test_292_migration_213_shape.py` (NEW) | test | — | `test_273_migration_202_shape.py` (`_strip_comments`, `_norm`, `_code`) | exact |
| edits: `test_273_artifact_models.py:120,137,140`, `test_273_migration_202_shape.py:110`, `test_273_tool_wiring.py:168`, `test_278_pure_move.py` `RETIRED` | test | — | `test_278_pure_move.py:188-215` RETIRED entries | exact |

### Plan 292-02 — frontend guard, renderers, copy, rail

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/components/chat/artifacts/artifactSpec.ts` (edit) | model (wire type + guard) | validation | itself — `parseChart` (267-297), `parseMetric` (299-318), `parseRecord` (385-440) | exact |
| `frontend/src/components/chat/artifacts/artifactRegistry.ts` (edit) | registry | — | itself `REGISTRY` (42-46) | exact |
| `frontend/src/components/chat/artifacts/artifactCopy.ts` (edit) | copy home | — | itself — `kindChipLabel` (197-222), `KIND_ALIASES`/`kindAlias` (227-241), `noticeText` (248-275), `rowsPhrase` (71-73) | exact |
| `frontend/src/components/chat/artifacts/captionModel.ts` (edit) | utility (pure) | transform | itself `captionSegments` (43-73) | exact |
| `frontend/src/components/chat/artifacts/ArtifactFrame.tsx` (edit, one slot) | component (frame) | — | itself `<figcaption>` (49-58) | exact |
| `diagramModel.ts` / `diagramLayout.ts` (NEW) | utility (pure layout) | transform | `chartModel.ts` (pure model, no React, 1-70) for shape; algorithm from sketch `index.html:321-378` | role-match (no layout analog) |
| `DiagramArtifact.tsx` (NEW) | component (renderer) | — | `TableArtifact.tsx` (body contract); `TeamPicture.tsx:416-420` (ResizeObserver guard) | role-match |
| `comparisonModel.ts` (NEW) | utility (pure) | transform | `chartModel.ts`; `TableArtifact.sortedRowIndexes` (28-42) | role-match |
| `ComparisonArtifact.tsx` (NEW) | component (renderer) | — | `TableArtifact.tsx` (sticky header, `overflow-auto`, `<table>` markup) | exact |
| `timelineModel.ts` (NEW) | utility (pure, clock injected) | transform | `chartModel.ts` | role-match |
| `TimelineArtifact.tsx` (NEW) | component (renderer) | — | `MetricArtifact.tsx` (glyph + words carry meaning, tone tokens 21-23) | role-match |
| `ArtifactExcerpt.tsx` / `ArtifactTooltip.tsx` (NEW) | component (shared popover) | event-driven | `ArtifactNotice.tsx` (artifact-local leaf); no portalled tooltip analog in `artifacts/` | partial |
| `frontend/src/components/chat/tool-bodies/ShowArtifactBody.tsx` (edit) | component (rail body) | request-response (reads tool result) | itself — `COMPONENTS` (39), `describeResult` (107-141), default body (165-192) | exact |
| tests NEW: `diagramModel.test.ts`, `DiagramArtifact.test.tsx`, `comparisonModel.test.ts`, `ComparisonArtifact.test.tsx`, `timelineModel.test.ts`, `TimelineArtifact.test.tsx`, `artifactRenderers.fence.test.ts` | test | — | `chartModel.test.ts`, `TableArtifact.test.tsx` (`rec()` helper), `artifactParity.fence.test.ts` (`?raw` source read) | exact |
| test edits: `artifactSpec.test.ts:73,250`, `ArtifactBlock.test.tsx:48-56,143`, `captionModel.test.ts`, `__tests__/fixtures.ts`, `ShowArtifactBody.test.tsx`, `MessageItem.artifacts.test.tsx` | test | — | themselves | exact |
| `scripts/vitest-count-gate.cjs` (edit) | config (gate) | — | itself `BASELINE` (4259-4271) + `TARGETS` (6319-6329) | exact |

### Plan 292-03 — cross-stack fence, board, close-out

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/components/chat/__tests__/artifactParity292.fence.test.ts` (NEW) | test (cross-stack fence) | — | `artifactParity.fence.test.ts` (whole file, 165 L) | exact |
| `scripts/run-292-board.py` (NEW) | script (live UAT) | batch | `scripts/run-273-board.py` (`derive_roster` :197, `seed` :286, `_artifacts` :367, `_drive_turn` :382, `_reload` :415, `_leak` :430, `run_board` :444) | exact |
| `292-VALIDATION.md`, `SEED-337-*.md`, `docs/HOT-FILE-LEDGER.md`, `CLAUDE.md` | docs | — | 273's equivalents | n/a |

---

## Pattern Assignments

### `backend/app/models/artifact.py` (model, validation) — extend in place

**Analog:** itself (809 L, Phase 273 only).

**Closed vocabulary — keep ONE flat Literal** (lines 52-61). The frontend fence regex
`^ComponentName\s*=\s*Literal\[([^\]]*)\]` (artifactParity.fence.test.ts:21-25) reads it, so a
`Union[...]` alias would read zero names:
```python
ComponentName = Literal["chart", "table", "metric"]
ChartKind = Literal["line", "bar", "area", "scatter"]
...
ARTIFACT_COMPONENTS: tuple[str, ...] = get_args(ComponentName)
CHART_KINDS: tuple[str, ...] = get_args(ChartKind)
```
New Literals (`TabularComponent`, `NodeKind`, `Verdict`) follow the same `X = Literal[...]` +
`X_S = get_args(X)` pair.

**Label regex — derive, don't retype** (line 99 today is hand-typed):
```python
ARTIFACT_LABEL_RE = re.compile(r"^(chart|table|metric) [1-9][0-9]*$")
```
→ build from `ARTIFACT_COMPONENTS` (RESEARCH Pattern 1).

**Refusal catalogue** (lines 112-140) + `_refusal`/`_raise` (158-167). New reasons are new `_R`
entries; `_refusal` already falls back to `_R["fallback"]` above `MAX_REASON_CHARS` (120):
```python
def _raise(key: str, detail: str, **fmt: Any) -> None:
    r = _refusal(key, detail, **fmt)
    raise PydanticCustomError("artifact_refusal", "{reason}", {"reason": r.reason, "detail": r.detail})
```
Closed-alias pattern to copy for `COMPONENT_ALIASES` (lines 80-82 + use at 724-730):
```python
KIND_ALIASES: tuple[str, ...] = ("pie", "donut", "radar", ...)
...
if word in KIND_ALIASES:
    return _refusal("kind_alias", detail, alias=word)
return _refusal("kind_unknown", detail)
```
The unknown-component branch to widen (lines 716-721) — `detail` must become
`", ".join(ARTIFACT_COMPONENTS)`, never retyped:
```python
if e.get("type") in ("union_tag_invalid", "union_tag_not_found"):
    return _refusal("unknown_component",
        "`component` must be one of chart, table, metric. Use a table for anything else.")
```

**UTF-16 length + decode-once helpers to reuse for every new string/list** (181-204):
```python
def _check_js_len(v: Any, cap: int, field_name: str) -> Any:
    if isinstance(v, str) and _js_len(v) > cap:
        _raise("fallback", f"`{field_name}` must be at most {cap} characters (an emoji counts as 2).")
    return v

def _decode_once(v: Any, field_name: str) -> Any:
    """BUG-260529-01: weak models send nested args as JSON strings. Decode once, never twice."""
```
Per-field validator shape to copy for every new nested model (`MetricEnc`, 267-276):
```python
class MetricEnc(_Strict):
    label: str | None = Field(default=None, max_length=64)
    @field_validator("label", "compare_label")
    @classmethod
    def _labels_js_len(cls, v: str | None, info) -> str | None:
        return _check_js_len(v, 64, f"metric.{info.field_name}")
```
Enum lower-casing `mode="before"` (ChartEnc 261-264) — copy for `kind` / `verdict`.
Decode list fields at each level (Pitfall 5) the way `_decode_nested` does (369-372):
```python
@field_validator("columns", "transform", "chart", "metric", mode="before", check_fields=False)
@classmethod
def _decode_nested(cls, v: Any, info) -> Any:
    return _decode_once(v, info.field_name)
```
→ add `"diagram", "comparison", "timeline"` here, and a matching decode on `nodes`, `edges`,
`options`, `terms`, `cells`, `events` inside each encoding model.

**Bool-before-pydantic refusal** (the `source` handle, Pitfall 3) — copy the cell pattern at 357-366:
```python
# bool is an int in Python and a lax float in pydantic — refuse it before either sees it.
if isinstance(cell, (bool, dict, list)):
```

**The arms + union** (414-433). Tabular arms gain three `None` keys (Pitfall 1), exactly like
`TableArgs.chart: None = None` today:
```python
class TableArgs(_ArgsBase):
    component: Literal["table"]
    chart: None = None
    metric: None = None

ShowArtifactArgs = Annotated[Union[ChartArgs, TableArgs, MetricArgs], Field(discriminator="component")]
_ADAPTER: TypeAdapter = TypeAdapter(ShowArtifactArgs)
```
New arms get a sibling base (`_Encoded`, RESEARCH Pattern 4) that reuses `_ArgsBase`'s `_title_len`
(330-335) and `_blank_reference_is_none` (337-340) validators, and a `mode="before"` model validator
that words the D-08 `from_artifact` refusal before field errors. Copy the after-validator's
"worded refusal re-raised as PydanticCustomError" idiom (406-409).

**Stored spec — separate model per type** (466-473 stays byte-unchanged;
`test_273_artifact_models.py:481-482` round-trips it):
```python
class StoredArtifactSpec(_Strict):
    title: str = Field(min_length=1, max_length=MAX_TITLE_CHARS)
    columns: list[StoredColumn] = Field(min_length=1, max_length=MAX_COLUMNS)
    rows: list[list[Cell]] = Field(min_length=1, max_length=MAX_ROWS)
    chart: StoredChartEnc | None = None
    metric: StoredMetricEnc | None = None
```
Copy `StoredChartEnc._slots_parallel_y` (452-456) as the shape of a stored-side invariant check
(e.g. timeline events sorted, comparison cells == options).

**Byte cap** — measure the whole stored spec like `validate_dataset` does (620-627):
```python
size = len(json.dumps({...}, ensure_ascii=False).encode("utf-8"))
if size > MAX_SPEC_BYTES - _SPEC_RESERVE_BYTES:
    return [], _refusal("too_large", ..., kib=f"{math.ceil(size / 1024):,}")
```

**Entry point** (762-779) — return annotation widens; `_strip_nul_deep` (744-759) already runs first.

---

### `backend/app/services/artifact_sources.py` (NEW — pure utility, transform)

**Analogs:** `show_artifact_tool.build_caption` (257-285) for "server facts only, never model
text"; `_clean_document` (207-211) for document-name hygiene; `citation_markers._deduplicate_citations`
(70-84) — import it, never re-implement.

**Import / module rule:** stdlib + `app.services.citation_markers` + `app.models.artifact` only
(citation_markers imports nothing from `app`). No DB, no provider.

**The numbering the model saw** (citation_markers.py:70-84, 120-138):
```python
def _deduplicate_citations(citations: list[dict]) -> list[dict]:
    seen: set[tuple] = set()
    unique: list[dict] = []
    for c in citations:
        key = (c["document_id"], c.get("chunk_index"))
        if key not in seen:
            seen.add(key); unique.append(c)
    return unique
...
# manifest line: f"[{n}] {filename} · chunk {chunk_index + 1}"  (n = i + 1)
```
So `source: n` ↦ `unique[n-1]` → `{document: _clean_document(c["filename"]), page: None,
excerpt: excerpt_for(c.get("passage"), element_text)}`; `is_full_doc` rows have `passage: None`.

**Document hygiene to reuse** (show_artifact_tool.py:207-211):
```python
def _clean_document(v: Any) -> str | None:
    if not isinstance(v, str):
        return None
    v = v.replace("\x00", "").strip()
    return v[:_MAX_DOCUMENT_CHARS] if v else None
```
Excerpt length: count with `_js_len` (artifact.py:181-188), 280 UTF-16 units.

---

### `backend/app/services/show_artifact_tool.py` (service, request-response)

**Analog:** itself.

**Imports** (50-64) — add the new stored models and the sources module; keep the patch-where-used
rule (docblock 34-35) so tests patch `app.services.show_artifact_tool.<name>`.

**Belt + validate** (549-572) unchanged. Branch on `parsed.component` right after line 574 before
any `parsed.columns` access. Tabular by-reference path (588-631): before `apply_transforms`
(613), refuse when `parent["component"]` is a new type (D-08):
```python
p_spec = parent.get("spec") or {}
try:
    columns, rows, lineage_ops, same_rows = apply_transforms(p_spec, parsed.transform)
except _TransformRefused as exc:
    return _out(refusal_payload(exc.refusal))
```

**Caption is unchanged** — call it with the item count (587):
```python
caption = build_caption(getattr(ctx, "turn_tool_calls", None), len(rows))
```
Read the new context field the same defensive way: `getattr(ctx, "turn_citations", None)`.

**Stored-spec assembly** (526-535) — copy as `_stored_encoded_spec(...)`; dump edges with
`model_dump(by_alias=True)` so the key is `from`:
```python
def _stored_spec(title, columns, rows, chart, metric) -> dict:
    spec = {...}
    return StoredArtifactSpec.model_validate(spec).model_dump()
```
and its failure handling (642-646):
```python
except ValidationError:
    logger.exception("show_artifact: stored spec failed its own model")
    return _out(refusal_payload(_refusal("fallback", "the artifact could not be assembled; check the encoding.")))
```

**Insert / emit / result** (648-679) unchanged; `row_count=` = nodes / terms / events.

**`_note`** (443-449) tells the model to use `from_artifact` — add a per-type note for the new
three ("call show_artifact again with the full data"). **`build_result`** (452-505): keep
`RESULT_ID_KEY` first; add `edge_count` / `option_count` (UI-D-292-19) and widen
`RESULT_KEY_ORDER` (artifact.py:89-92) in the same commit; keep the `minimal` fallback < 2000.

**Handler-only refusals** live in `_HR` (99-106); `_refusal_text` (124-143) keeps every refusal
< 2000 chars — route every new refusal through `_out(...)`.

---

### `backend/app/services/artifact_history.py` (utility, transform)

**Analog:** itself, `redact_artifact_args` (75-94) and `_placeholder` (63-72):
```python
def _placeholder(rows: Any, result: Any) -> str:
    if not isinstance(rows, list):
        return f"{ROWS_PLACEHOLDER_NOT_STORED}>"
    n = len(rows)
    art_id = _artifact_id(result)
    if art_id:
        return f"{ROWS_PLACEHOLDER_STORED}{art_id}, {n} rows>"
    if is_refusal_result(result):
        return f"{ROWS_PLACEHOLDER_NOT_STORED}: refused, {n} rows>"
    return f"{ROWS_PLACEHOLDER_NOT_STORED}, {n} rows>"
```
Purity contract (docstring 78-80): untouched entries returned as the SAME object. RESEARCH
§Code Examples gives the extended loop over `_ENCODED_KEYS = ("diagram", "comparison", "timeline")`.
The placeholder strings must start with the existing constants so `_check_placeholder`
(artifact.py:207-226) — extended to the three keys — recognises an echo.

---

### `backend/app/services/openai_service.py` (config, tool schema) — `SHOW_ARTIFACT_TOOL` only

**Analog:** itself 1167-1280. Nested nullable object shape to copy (`chart`, 1226-1235):
```python
"chart": {
    "type": ["object", "null"],
    "properties": {
        "kind": {"type": "string", "enum": list(CHART_KINDS)},
        "x": {"type": "string"},
        "y": {"type": "array", "items": {"type": "string"}},
        "stacked": {"type": ["boolean", "null"]},
    },
    "required": ["kind", "x", "y"],
},
```
Array-of-objects shape (`transform.filter`, 1249-1263): `"items": {"type": "object",
"properties": {...}, "required": [...]}`. Enums derive from the Literals via the import at
line 18 (`from app.models.artifact import ARTIFACT_COMPONENTS, CHART_KINDS`) — add `NODE_KINDS`,
`VERDICTS`. Enum fields stay **non-nullable** (`{"type": "string", "enum": ...}`, as `chart.kind`).
Description (1180-1203): keep the chart `Example:` FIRST (`test_273_tool_wiring.py:182-185`
decodes it), total ≤ 3,000 chars (`:179`). No anyOf/oneOf/additionalProperties (`:128-134`).
`google_service.py` is NOT edited: `_translate_nullable_type` (≈ 278+) and
`_GOOGLE_UNSUPPORTED_SCHEMA_KEYS` (249-266) already handle the shape (none of the new property
names — incl. `from` — is in that set).

---

### `backend/app/services/tools/base.py` (+1 field) and `agent_loop.py` (+2 kwargs)

**Analog field** (base.py:69-74) — copy the comment style and default:
```python
# Phase 273 (D-04 / Pattern 5) — the caption source of show_artifact. Set BY REFERENCE to
# agent_loop's `persisted_tool_calls` list in BOTH ToolContext builds (273-04), ...
turn_tool_calls: list[dict] | None = None
```
`turn_citations: list[dict] | None = None` keeps the leaf stdlib-only (docblock 12-13).

**Analog kwargs** (agent_loop.py:2221 resume build, 3136 main build):
```python
turn_tool_calls=persisted_tool_calls,  # 273 (D-04) — caption source (by-reference)
```
→ add `turn_citations=retrieved_citations,` beside each. `retrieved_citations` is declared at
:1967 and extended at :2249 / :3186. Zero branches; `SYSTEM_PROMPT` untouched
(`test_273_tool_wiring.py:195-203`).

**`test_278_pure_move.py` RETIRED entry** (pattern at 188-215):
```python
"_handle_query_documents_by_view": (
    "Phase 284 (284-04, R-02, 2026-10-16): deliberate post-move edit. ... pinned by test_284_..."
),
```
→ `"ToolContext": "Phase 292 (292-01, D-07, 2026-10-24): deliberate post-move edit. ToolContext gains turn_citations ... Pinned by test_292_artifact_sources.py."`

---

### `supabase/migrations/213_message_artifacts_more_components.sql` (migration)

**Analog:** `202_message_artifacts.sql`. Copy its header discipline (1-55: WHAT/WHY, apply via SQL
editor, never `db push`/`db reset`, idempotent, regenerate full-schema, ⚠ PRODUCTION ordering),
the `BEGIN; … COMMIT;` frame (57/177), the COMMENT ON style (79-108) and a VERIFY block in comments
(179-214). The two inline CHECKs being widened (68-69) are auto-named
`message_artifacts_label_check` / `message_artifacts_component_check`:
```sql
label        text NOT NULL CHECK (label ~ '^(chart|table|metric) [1-9][0-9]*$'),
component    text NOT NULL CHECK (component IN ('chart', 'table', 'metric')),
```
Body = RESEARCH §Migration 213 (DROP IF EXISTS + ADD for each, COMMENTs, VERIFY querying
`pg_constraint` for exactly one CHECK per column). No grant/policy/function → supplement unchanged.

**Shape test analog:** `test_273_migration_202_shape.py:1-60` — `_migration()` glob (change to
`213_*.sql`), `_strip_comments`, `_norm`, `_code`; assert the CHECK set equals `ARTIFACT_COMPONENTS`
and the label regex names all six. Line 110 of the 202 test changes to the frozen historical three.

---

### `frontend/src/components/chat/artifacts/artifactSpec.ts` (model, guard)

**Analog:** itself. Closed tables read through `own()` (30-47):
```ts
export type ComponentName = "chart" | "table" | "metric"
const COMPONENT_TABLE: Record<string, ComponentName> = { chart: "chart", table: "table", metric: "metric" }
export const ARTIFACT_COMPONENT_NAMES = ["chart", "table", "metric"] as const
const CHART_KIND_TABLE: Record<string, ChartKind> = { line: "line", ... }
const LABEL_RE = /^(chart|table|metric) [1-9][0-9]*$/
```
→ add `NODE_KIND_TABLE`, `VERDICT_TABLE`; derive `LABEL_RE` from the six names.

**Narrowing helpers to reuse** (184-226): `Refusal`, `isObj`, `isInt`, `isStr(v, min, max)` (counts
UTF-16 like `_js_len`), `strOrNull`, `isNullish`, `invalid(noun)`.

**Arm shape to copy** (`parseMetric`, 299-318; `parseChart` alias refusal 270-275):
```ts
function parseMetric(raw: unknown, columns: ArtifactColumn[]): MetricEncoding {
  const noun: ComponentName = "metric"
  if (!isObj(raw)) invalid(noun)
  ...
  if (!isNullish(raw.label) && !isStr(raw.label, 0, 120)) invalid(noun)
  return { ..., label: (raw.label as string | null | undefined) ?? null }
}
```
Worded refusal with a truncated data value (columnByName, 260-265):
```ts
if (!hit) throw new Refusal("missing-column", { noun, column: truncateValue(name as string) })
```
RESEARCH §Code Examples `parseDiagram` is the target shape for the three new arms.

**`parseRecord` branch point** (401-420): `parseColumns(spec.columns, noun)` at 404 requires ≥ 1
column — branch on `component` BEFORE it for the new three; keep the `isNullish(spec.chart)`
cross-checks pattern (409-417) so a diagram spec carrying `chart` is `invalid`. Output object
(434) gains `diagram`/`comparison`/`timeline` (null for tabular) and `columns: []`/`rows: []` for
the new types. `parseCaption` (353-383) unchanged.

**`NoticeReason` / `NoticeContext`** (137-157) — additive union members from the UI-SPEC catalogue;
`NoticeContext.noun` widens automatically with `ComponentName`.

---

### `frontend/src/components/chat/artifacts/artifactRegistry.ts`

**Analog:** itself (42-55). Eager imports, like `TableArtifact` / `MetricArtifact` (24-25):
```ts
const REGISTRY: Record<string, ArtifactRenderer> = {
  chart: ChartArtifactLazy,
  table: TableArtifact,
  metric: MetricArtifact,
}
export function rendererFor(component: unknown): ArtifactRenderer | null {
  if (typeof component !== "string") return null
  return own(REGISTRY, component) ?? null
}
```
Docblock line 2 ("exactly three") is updated to six.

---

### `frontend/src/components/chat/artifacts/artifactCopy.ts`

**Analog:** itself. Every new string lands here (docblock 1-21: interpolate only a closed noun, a
closed alias, a count, or a ≤ 40-char data value). Patterns to copy:
- count phrase with singular — `rowsPhrase` (71-73): `` `${formatNumber(n)} ${n === 1 ? "row" : "rows"}` ``
  → `stepsPhrase`, `linksPhrase` (`no links`), `optionsTermsPhrase`, `eventsPhrase`.
- kind chip — `kindChipLabel` (197-217): add `if (component === "diagram") return "Flow diagram"`, etc.
  before the chart `switch`.
- closed alias table + `own()` lookup — `KIND_ALIASES`/`kindAlias` (227-241) → `COMPONENT_ALIASES`/
  `componentAlias` with UI-SPEC §Component alias table keys.
- `noticeText` switch (248-275) — new cases; widen `"unknown-component"` (255) to the six-noun
  sentence plus the alias form.
- pinned `en-US` number formatting (48-68) — reuse `formatNumber` for every count.

---

### `captionModel.ts` + `ArtifactFrame.tsx` (caption second line)

**Analog:** `captionSegments` (captionModel.ts:43-73). The count segment is pushed last (70):
```ts
if (record.component !== "metric") parts.push(rowsPhrase(caption.row_count))
```
→ replace with a per-component phrase from validated spec lengths; add an optional `note` to
`CaptionSegments` (30-34) for the comparison second line (UI-SPEC §Caption). Frame slot to extend
(ArtifactFrame.tsx:49-58):
```tsx
<figcaption data-testid="artifact-caption" className="flex flex-wrap items-center gap-x-1 gap-y-1 ...">
  <span data-testid="artifact-label-chip" className={CHIP}>{record.label}</span>
  <Icon className="size-3 shrink-0" aria-hidden="true" data-icon={caption.icon} />
  <span>{caption.parts.join(CAPTION_SEGMENT_JOIN)}</span>
</figcaption>
```
→ append `{caption.note && <span className="basis-full italic text-muted-foreground">{caption.note}</span>}`.

---

### `diagramModel.ts` / `comparisonModel.ts` / `timelineModel.ts` (NEW pure models)

**Analog:** `chartModel.ts` (1-70) — docblock declares "PURE model. No React", imports only types
from `./artifactSpec` and helpers from `./artifactCopy`:
```ts
import type { ArtifactRecord, Cell } from "./artifactSpec"
import { EMPTY_CELL, formatCompact, formatNumber, kindChipLabelOf, rowsPhrase, truncateValue } from "./artifactCopy"
```
Stable-sort-with-index tiebreak to copy (TableArtifact.tsx:28-42 `sortedRowIndexes`, `a - b` fallback).
Algorithms: RESEARCH Pattern 5 (layout), 6 (timeline, `today` injected, hand-parsed dates, `Date.UTC`
both sides), 7 (comparison identical-row rule). No codebase analog for the layered layout itself.

---

### `DiagramArtifact.tsx` / `ComparisonArtifact.tsx` / `TimelineArtifact.tsx` (NEW renderers)

**Analog (body contract):** `TableArtifact.tsx` / `MetricArtifact.tsx` — props are
`ArtifactBodyProps` (a guard-passed record), text only, `data-testid` on the root:
```tsx
import type { ArtifactBodyProps } from "./artifactSpec"
export function TableArtifact({ record }: ArtifactBodyProps) {
  const { columns, rows } = record.spec
  const [sort, setSort] = useState<SortState | null>(null)   // local view state, resets on reload
  ...
  return (<div data-testid="artifact-table" className="max-h-[512px] overflow-auto"> ...
```
**Comparison** copies the table markup: sticky header `sticky top-0 z-[1] ... bg-popover`
(TableArtifact.tsx:70), `aria-sort`-style ARIA on the toggle (`aria-pressed`), `cn()` from
`@/lib/utils`, row hover `hover:bg-muted/50` (97). Sticky FIRST column is new (UI-D-292-14).
**Timeline / verdict tones** copy MetricArtifact's "glyph + words carry the meaning; colour is
secondary" rule and tone constants (MetricArtifact.tsx:21-23, 84-87).
**Diagram width** — copy the ResizeObserver guard (TeamPicture.tsx:416-420):
```ts
measure()
if (typeof ResizeObserver === "undefined") return
const observer = new ResizeObserver(() => measure())
observer.observe(root)
return () => observer.disconnect()
```
Marker id from `useId()`; model ids never used as DOM ids (RESEARCH Pattern 5).

---

### `tool-bodies/ShowArtifactBody.tsx` (rail body)

**Analog:** itself. Closed table (39) → six:
```ts
const COMPONENTS: Record<string, true> = { chart: true, table: true, metric: true }
```
Essence branch (133-138) and expanded body parts (183-189) gain per-type arms reading only
`row_count`, `edge_count`, `option_count` via `count()` (50-52). The docblock's closed list of
read keys (7-14) is extended in the same edit — it is the L-3/L-4 defence.

---

### Tests (both stacks)

- **Frontend component test pattern** (TableArtifact.test.tsx:1-15):
  ```ts
  function rec(raw: unknown): ArtifactRecord {
    const r = parseArtifactRecord(raw)
    if (!r.ok) throw new Error(`fixture failed to parse: ${r.reason}`)
    return r.record
  }
  ```
  Fixtures go in `__tests__/fixtures.ts` via `base(id, label, component, spec, caption, rowCount)`
  (fixtures.ts:21-45; widen the `component` param type) with realistic sketch data.
- **Source fence** (`artifactRenderers.fence.test.ts`) uses `?raw` imports like
  artifactParity.fence.test.ts:14-16.
- **Cross-stack 292 fence** copies artifactParity.fence.test.ts whole: `expand()` for `$repeat`
  (76-87), `asRecord()` lifting a case into a stored record (94-139), NON-VACUITY counts (142-145),
  bad→refused / good→ok loops (147-156). The existing fence is NOT edited (RESEARCH §Tests).
- **Backend parity reader** copies `test_273_review_fixes.py:18-60` (`PARITY_FIXTURE`, `_expand`,
  parametrized bad/good through `validate_args`).
- **Handler test** copies `test_273_show_artifact_tool.py:38-90` (`_ctx(**over)` SimpleNamespace,
  `_Store` fake insert, `MOD = "app.services.show_artifact_tool"` patch target) and adds
  `turn_citations=[...]` to `_ctx`.
- **Count gate**: every new frontend suite adopted in BOTH knobs in the creating commit —
  `BASELINE` filename pin (scripts/vitest-count-gate.cjs:4259-4271 style, with a phase comment)
  and `TARGETS` path (6319-6329).

---

### `scripts/run-292-board.py` (script, batch)

**Analog:** `scripts/run-273-board.py` — reuse `derive_roster(conn)` (:197, roster from
`MODEL_CAPABILITIES`, never re-typed), `_assert_local_db` (:158), `_drive_turn` (:382, per-request
`model`/`provider`), `_artifacts(conn, thread_id)` (:367, verdict from `message_artifacts`),
`_reload` (:415), `_leak` (:430). Replace `fixture_csv`/`seed` (:106/:286) with three KB fixture
documents (RESEARCH OQ-4).

---

## Shared Patterns

### Closed vocabulary across two stacks (I-1)
**Source:** `artifact.py:52-61` (Literal + `get_args`), `artifactSpec.ts:30-47` (`own()` tables),
`202_message_artifacts.sql:68-69` (CHECK), fenced by `artifactParity.fence.test.ts:33-46`.
**Apply to:** every enum this phase adds (component, node kind, verdict). Backend Literal, migration
CHECK, frontend table, registry move in the same wave; the fence goes green only when both merge
(RESEARCH: known in-worktree red for Plan 02).

### Worded refusals, never JSON (D-20 / L-4)
**Source:** `_R` + `_refusal`/`_raise` (artifact.py:112-167); `refusal_payload` keys exactly
`status/reason/detail` (153-155); `_refusal_text` < 2000 (show_artifact_tool.py:124-143);
`noticeText` (artifactCopy.ts:248-275); `parseArtifactRecord` discards exception messages
(artifactSpec.ts:455-469).
**Apply to:** every new rule, both stacks; never an `error` key.

### Text-only rendering of model strings (I-3)
**Source:** ArtifactFrame.tsx docblock 6-9 and TableArtifact.tsx:9 ("Every cell renders as React text").
**Apply to:** all three renderers + the tooltip; fenced by the new `artifactRenderers.fence.test.ts`.

### Prototype-safe lookup
**Source:** `own()` in `frontend/src/components/workflows/ownProperty.ts` (zero imports by contract).
**Apply to:** REGISTRY, COMPONENT/NODE_KIND/VERDICT tables, glyph table, alias table.

### UTF-16 length parity
**Source:** `_js_len`/`_check_js_len` (artifact.py:181-194) ↔ `isStr` (artifactSpec.ts:207-209).
**Apply to:** every new string cap; the shared bad-spec fixture includes an emoji-at-cap case.

### Decode once per level (BUG-260529-01)
**Source:** `_decode_once` (artifact.py:197-204), `_decode_nested` (369-372).
**Apply to:** the three encoding objects and every list inside them.

### Server facts only for provenance (D-04 / D-07)
**Source:** `build_caption` (show_artifact_tool.py:257-285), `_source_of` WR-03 rule (240-254).
**Apply to:** `artifact_sources.resolve_sources` — document/excerpt come from the run's citation
list, never model args.

### By-reference run accumulator on ToolContext
**Source:** `turn_tool_calls` field (base.py:69-74) + its two builds (agent_loop.py:2221, 3136).
**Apply to:** `turn_citations` (same comment shape, same two sites, `None` default for unwired callers).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `diagramModel.ts` / `diagramLayout.ts` (layout algorithm) | utility | transform | No layered-graph layout exists in the tree (`TeamPicture`'s `layoutLines` measures DOM; this must be pure). Port the sketch (`.planning/sketches/292-more-ways-to-show-it/index.html:321-378`) per RESEARCH Pattern 5 / UI-D-292-05 |
| `ArtifactExcerpt.tsx` / `ArtifactTooltip.tsx` (portalled anchored tooltip) | component | event-driven | Nothing in `artifacts/` portals; RESEARCH rejects Radix Tooltip (needs `TooltipProvider`, 100 roots). Build per UI-SPEC §Shared tooltip; only the artifact-local leaf shape of `ArtifactNotice.tsx` carries over |

## Metadata

**Analog search scope:** `backend/app/models`, `backend/app/services` (show_artifact_tool, artifact_history, citation_markers, tools/base, openai_service, google_service, agent_loop), `backend/app/db/artifacts.py`, `supabase/migrations/202_*`, `frontend/src/components/chat/artifacts/**`, `frontend/src/components/chat/tool-bodies/ShowArtifactBody.tsx`, `frontend/src/components/chat/__tests__/artifactParity.fence.test.ts`, `frontend/src/components/workflows/{TeamPicture.tsx,ownProperty.ts}`, `backend/tests/unit/test_273_*`, `test_278_pure_move.py`, `scripts/run-273-board.py`, `scripts/vitest-count-gate.cjs`
**Files scanned:** 26
**Pattern extraction date:** 2026-10-24
