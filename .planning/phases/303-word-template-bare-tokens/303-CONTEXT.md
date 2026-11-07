# Phase 303: Word Template Bare Tokens - Context

**Gathered:** 2026-11-06
**Status:** Ready for planning
**Mode:** delegated end to end by the operator ("continue autonomously end to end of this phase"). Every gate took the recommended option; each choice is recorded below as a `D-NN`.

<domain>
## Phase Boundary

A Word template filled from cited records shows the value for a bare `{{ name }}`, or the run stops at the integrity check with a reason. It never hands back a document carrying a record's dict text, or a blank where a value belongs. Templates written with `{{ name.value }}`, `|default` and `score` render byte-for-byte as before. Both copies of the fill code (the sealed sandbox driver `_RENDER_DRIVER_SRC` and `template_render_service.py`) behave the same, pinned by a test.

Not in scope: new template features, a new engine, PDF/pptx/xlsx behaviour, the handler's flow, the parse oracle, any UI.

</domain>

<decisions>
## Implementation Decisions

### The repro (SC#1), already run at discuss time
- **D-01: The repro ran BEFORE any fix, through the real driver source, and it is RED.** `_RENDER_DRIVER_SRC` was written to a file and run as `python -u render_driver.py <engine> <template> <field_map.json> <out>`, the same invocation the sandbox uses, with docxtpl `0.20.2` (the same pin as `backend/Dockerfile.sandbox`). Not a mirror: the service functions were not called. Evidence, base commit and produced documents: `evidence/red-base/` (`repro.py`, `repro-output-base.txt`, the six template/output pairs, `field_map.json`, `BASE_COMMIT.txt`).
- **D-02: The repro found THREE defects, not one. All three are in scope**, because each is a bare-token document reaching the user while the verdict reads clean, which is exactly what FIX-15 and the "How we'd know this failed" list name:
  1. **docxtpl engine (library templates):** bare `{{ name }}` writes `{'value': 'Ann', 'source_chunk_id': 'c1', ...}` into body, header, footer, table cell, nested table and loop rows (`{{ r.cause }}`). Verdict: `residual_clean: true`. This is BUG-261022-01, now confirmed.
  2. **run_replace engine (uploaded templates):** `{{ name }}` with spaces, and `{{ name.value }}`, are BLANKED (the exact-match token is `"{{" + key + "}}"`, so anything else falls to `_PLACEHOLDER_TOKEN_RE` and is erased). The document reads empty where the value belongs. Verdict clean. Only tight `{{name}}` fills.
  3. **Nested tables are invisible to both run_replace and the residual scan:** `{{name}}` inside a nested table survives unfilled and `residual_tags_in` does not see it. Verdict clean.
- **D-03: The in-container / in-app half of SC#1 is an owed UAT row, not a blocker.** This shell is refused `docker` (and Docker SDK access was refused by the permission classifier on 2026-11-06), so a run id from a real app run cannot be produced here. The driver-script run IS the real driver code at the real pin. Row U-1 below (a real run, with a run id, of a library template using bare tokens) is run by Claude through the app if the backend is up at verification, otherwise recorded as owed and named first.

### Size (the roadmap's "the repro decides the size")
- **D-04: It stays a PHASE with ONE plan.** Two files, both copies, roughly 60–100 source lines plus tests: past G-3's one-file / ten-line line, well inside G-8's 3–5 cap. One plan, TDD (`tdd_mode` is on): RED tests first, then the fix in both copies, then the parity and golden checks. No worktree fan-out is needed.

### How a bare token is fixed (docxtpl, defect 1)
- **D-05: Fix BOTH ways: coerce at render, and detect at the integrity check.** Coercion makes the author's template work, which is what they meant. Detection is the backstop for anything coercion does not reach (`{{ r }}` printing a whole row, `{{ rows }}` printing a list, a future context shape), so a record's text can never ship with a clean verdict.
- **D-06: Coercion = `_cell` returns a `dict` subclass whose `__str__` returns the value as a string.** It stays a `dict`, so `{{ name.value }}` (Jinja falls back from attribute to item lookup), `{% if name %}`, `==`, `|default` and every existing context equality check behave exactly as today. `__repr__` is NOT overridden, so a whole row printed as a dict still shows `'source_chunk_id'` and is caught by D-07. Applies to scalars and to every row cell (`_build_row`). `score` stays a plain string. Autoescape stays on (`SandboxedEnvironment(autoescape=True)` is ⛔ pinned by `test_190_ssti_fence.py`); escaping calls `str()` on the object, so the value is escaped exactly as `{{ name.value }}` is. The planner must confirm the subclass passes Jinja's sandbox unchanged.
- **D-07: Detection = the residual scan also flags rendered record text.** A text span containing `'source_chunk_id':` counts as a hit. It flows through the existing not-delivered path (`residual_clean: false` → `reason: residual_tokens`), so no new handler branch. The failure message in `_handle_render_template` gains one clause that names record text, so the reason is worded, not just "unsubstituted tokens". Exact words are Claude's discretion; they must say a field printed as raw record text and was not delivered.

### How a bare token is fixed (run_replace, defect 2)
- **D-08: A key in the map matches `{{ key }}`, `{{key}}` and `{{ key.value }}` with any inner whitespace**, in BOTH copies of `_replace_in_paragraph`. Matching uses `re.escape(key)` and a function replacement (a value containing `\1` or `\` must not be read as a regex group). A key that IS in the map is never blanked. Unknown placeholder-shaped tokens are still blanked as today (existing "lean blank" design, unchanged here). This is SC#4's "behave the same on a bare token".

### What the integrity check scans (defect 3, SC#2)
- **D-09: Both `residual_tags_in` copies and both `run_replace_docx` walks cover: body paragraphs, every table cell RECURSIVELY (nested tables), and every header and footer variant of every section** (default, first-page, even-page). Text boxes, footnotes and SmartArt stay the existing documented limit; python-docx does not reach them and the parse oracle does not read them either. The docxtpl engine already renders headers, footers and nested tables (repro shows it); only the scan was blind.

### The two copies (SC#4)
- **D-10: One parity test drives both copies over the same fixtures and fails if they diverge:** `_replace_in_paragraph` on bare spaced, tight, `.value`, unknown and run-split tokens; `_cell` stringification; and `residual_tags_in` on a document with a repr in a header, a footer and a nested table. The driver copy is loaded by `exec` of `_RENDER_DRIVER_SRC`, the pattern `test_291_pdf_fill_driver.py` and `test_296_render_template.py` already use. The driver stays self-contained (no `app.*` import; `test_render_driver_is_self_contained` guards it).

### Golden runs (SC#3)
- **D-11: Deterministic before/after, captured at the base commit BEFORE any edit.** Render every in-repo trusted template through the driver script with a fixed field map: `scripts/pm-pack/templates/{compliance-gap-report,risk-register,weekly-status-report}.docx`, `backend/tests/fixtures/templates/risk-register.docx` (uses `{{ r.score }}`), a `|default` template, and `backend/tests/fixtures/templates/arbitrary-split-token.docx` through run_replace. After the fix, `word/document.xml` and every header/footer part must be byte-identical. All six shipped templates use `.value` tokens (measured at discuss), so any diff is a regression. Evidence goes in `evidence/golden/`.
- **D-12: The live publish-gauntlet golden run is UAT row U-2.** Re-run the golden run of one already-published template workflow through the app (needs backend + a provider). Claude drives it if the backend is up at verification; otherwise owed.

### Guardrails
- **D-13: G-5 honoured by construction.** `backend/app/services/tools/render_template.py` (`6 / 3 / 1163`) and `backend/app/services/template_render_service.py` (`8 / 3 / 988`) both FIRE. The named seam ("a third engine should be split out of the driver string first") does not apply: no engine is added. Edits stay inside `_cell`, `_replace_in_paragraph`, the walks, `residual_tags_in` and one message clause. Both ledger rows and their `docs/HOT-FILE-LEDGER.md` sections update in the same commit, cells ≤ 200 chars.
- **D-14: No image rebuild, no migration, no new env var, no research.** The driver ships into the container at call time and uses only libraries already in `agentic-rag-sandbox:101.1`. If a plan ever touches `Dockerfile.sandbox`, the tag and `SANDBOX_IMAGE` change in the same commit (a failure condition of this phase).
- **D-15: Not a streaming / agent-loop / provider-routing / UI phase**, so the 8-row cross-provider scoreboard and G-2/G-4 do not apply. The render is deterministic code in the sandbox; the model's only part is the field map, which this phase does not change.
- **D-16: Backend baseline gate stays at ≤ 71 failed** (`node scripts/check-backend-unit-baseline.cjs`). No frontend files change, so the vitest count gate is not run.

### UAT rows (authored into VALIDATION.md by the planner)
- **U-1 (SC#1, first to run):** a real app run, with its run id kept, of a library template carrying bare `{{ name }}` in body, header and a nested table. Before the fix it would show record text; after, the values.
- **U-2 (SC#3):** the live golden run of one published template workflow, output unchanged.

### Code-review rulings (added 2026-11-06 after `303-REVIEW.md`, delegated)
- **D-17 (CR-01 → fix in this phase):** the parse oracle `parse_docx_template_variables` (both doors read it) also records a bare loop-column deref `{{ r.col }}` as a column of its collection, EXCEPT the driver-computed `score`. Without it the model is never told to emit `col`, so a bare loop column reads blank with a clean verdict, which is this phase's own failure condition ("a blank where a value belongs"). This amends the boundary line "the parse oracle" (read-only) for this one rule. Existing `.value` templates and `{{ r.score }}` produce the same placeholder list as before.
- **D-18 (WR-02 → fix):** run_replace substitutes every known key in ONE pass over the paragraph's original text (one alternation regex, function replacement), in both copies, so a cited value containing `{{ other }}` is never rewritten or erased by a later key.
- **D-19 (WR-03 → fix):** when the integrity gate refuses a file, the produced file is removed from `/sandbox/output` before the handler returns, so a later `execute_code` sweep or a `sandbox_output` attach cannot deliver it. SC#2's "no document with record text in it reaches the user".
- **D-20 (WR-01 → accepted, known limit):** comparisons and filters on a bare cell (`== 'x'`, `|int`, `|length`, `|default(.., true)`, `or`) act on the record, exactly as they did before 303. Not overridden (`__eq__`/`__bool__` would change `.value` templates' semantics). Recorded under Deferred.
- **D-21 (IN-01/02/03 → fix):** correct the `run_replace_docx` docstring (the default header/footer part can still be added — old behaviour), word the failure message for an all-record-text verdict without the "unsubstituted placeholder tokens" lead or a doubled "not delivered", and add tests for the remaining header/footer variants, the cross-copy marker string, and the oracle step behind D-17.

### Claude's Discretion
- Exact wording of the record-text failure clause (D-07).
- Name of the `dict` subclass and whether it is shared by scalar and row cells (it should be).
- Test file name(s), following the `test_303_*.py` convention.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The bug and the requirement
- `.planning/reported-bugs/docx-template-bare-token-may-render-a-dict-repr.md` — BUG-261022-01, folded into 303
- `.planning/REQUIREMENTS.md` — FIX-15
- `.planning/ROADMAP.md` §"Phase 303" — goal, 4 success criteria, failure list, flags
- `.planning/research/PITFALLS.md` §"Pitfall 21" — the two-copies trap, coercion caveats (`|default`, `{% if %}`, comparisons), golden-run warning
- `.planning/phases/303-word-template-bare-tokens/evidence/red-base/` — the RED repro (D-01, D-02)

### Code
- `backend/app/services/tools/render_template.py` — `_RENDER_DRIVER_SRC` (`_cell`, `_build_row`, `build_context`, `_replace_in_paragraph`, `run_replace_docx`, `residual_tags_in`, `assert_integrity`) and the handler's failure message (~line 1083)
- `backend/app/services/template_render_service.py` — the second copy of the same functions, plus `parse_docx_template_variables` (read-only here)
- `backend/Dockerfile.sandbox` — docxtpl `0.20.2` pin (unchanged)

### Tests that pin behaviour
- `backend/tests/unit/test_template_render.py` — existing render, residual and driver tests (incl. `test_render_driver_is_self_contained`, `test_render_template_residual_tokens_not_delivered`, `test_driver_replace_coalesces_matched_token_equal_to_original`)
- `backend/tests/unit/test_296_render_template.py`, `backend/tests/unit/test_291_pdf_fill_driver.py` — the `exec(_RENDER_DRIVER_SRC)` loading pattern
- `backend/tests/unit/test_278_pure_move.py` — AST pin of the 278 move (check it still passes after edits)
- `backend/tests/unit/test_190_ssti_fence.py` — ⛔ `SandboxedEnvironment(autoescape=True)`

### Guardrails
- `docs/HOT-FILE-LEDGER.md` §`backend/app/services/tools/render_template.py` and §`backend/app/services/template_render_service.py`
- `CLAUDE.md` — backend baseline gate (71), G-3/G-5/G-8, sandbox image tag rule

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `exec(compile(_RENDER_DRIVER_SRC, ...), ns)` — loads the driver copy in-process for parity tests.
- `backend/tests/fixtures/templates/risk-register.docx`, `arbitrary-split-token.docx` and the three `scripts/pm-pack/templates/*.docx` — golden inputs, all `.value`-style.
- `evidence/red-base/repro.py` — builds bare-token templates with python-docx (body, header, footer, cell, nested table, row loop) and runs the driver as a script; reuse it for the GREEN re-run.

### Established Patterns
- Driver functions are verbatim mirrors of the service functions, guarded by comments only today; D-10 adds the test.
- The handler treats `residual_clean: false` as not-delivered and keeps the field map as fallback; D-07 rides that path.
- Driver never crashes: every exit prints one JSON verdict line.

### Integration Points
- Only the two files above change in `backend/app`. `harness/emitters.py` reads the handler through `tool_dispatcher`; nothing there changes.

</code_context>

<specifics>
## Specific Ideas

- Repro output at base (`evidence/red-base/repro-output-base.txt`): docxtpl bare → dict text in all six locations with `residual_clean: true`; run_replace `{{ name }}` → `Body: ` (blank); run_replace nested `{{name}}` survives.
- docxtpl `.value` and `.value|default('N/A')` render `Ann` everywhere already; those outputs are the "must not change" reference.

</specifics>

<deferred>
## Deferred Ideas

- D-20: comparisons/filters on a bare cell (`{% if status == 'Open' %}`, `|int`, `|length`, `|default(.., true)`) act on the record dict, as before 303. A template-read/bind-time lint that flags these forms is the natural follow-up; re-open when a real template uses one.
- Unknown placeholder tokens in run_replace are still blanked silently. Whether an unknown token should fail the run instead is a separate design choice, not part of FIX-15.
- Text boxes, footnotes and SmartArt stay unscanned (documented limit). Scanning raw `word/*.xml` would reach them; a future phase can take it if a real template needs it.
- Seeds sweep: 0 seeds matched (the phase declared no `files_modified` yet at discuss time; re-run at plan time once the PLAN names its files).

</deferred>

---

*Phase: 303-word-template-bare-tokens*
*Context gathered: 2026-11-06*
