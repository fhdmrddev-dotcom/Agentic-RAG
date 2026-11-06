# Phase 303: Word Template Bare Tokens - Pattern Map

**Mapped:** 2026-11-06
**Files analyzed:** 6 (2 source modified, 2 test new, 2 docs modified)
**Analogs found:** 6 / 6
**Env check (measured):** `backend/venv` has docxtpl `0.20.2` (same pin as `Dockerfile.sandbox`), python-docx `1.2.0`, jinja2 `3.1.6`. Tests can render for real, in-process, no sandbox.

## File Classification

| File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `backend/app/services/tools/render_template.py` (inside `_RENDER_DRIVER_SRC` + handler msg ~L1088) | service (sealed sandbox driver) | transform / file-I/O | itself: 296-03 driver-only edit (`_name_button_values`) | exact |
| `backend/app/services/template_render_service.py` | service (in-app copy) | transform / file-I/O | itself (verbatim mirror of the driver functions) | exact |
| `backend/tests/unit/test_303_bare_tokens.py` (RED: behaviour of both copies) | test | file-I/O | `test_template_render.py` L138-193 + `test_296_render_template.py` L42-56 | exact |
| `backend/tests/unit/test_303_driver_service_parity.py` (D-10) | test (parity) | transform | `test_291_acroform_reader_parity.py` (whole file) | exact |
| `docs/HOT-FILE-LEDGER.md` (2 sections + 2 scan-list rows) | docs | - | 296-03 entry at L24829 | exact |
| `CLAUDE.md` (2 FIRING rows; `template_render_service.py` is not in the FIRING table, only the scan list) | docs | - | CLAUDE.md L423 row | exact |

(Test filenames are Claude's discretion per CONTEXT; one file holding both is also fine under G-8.)

## Pattern Assignments

### `render_template.py` — the driver string (L66-727, `r'''...'''`)

Functions to edit, all inside `_RENDER_DRIVER_SRC`:

| Function | Line | Change (decision) |
|---|---|---|
| `_cell` | 88-96 | return the `dict` subclass with `__str__` → value (D-06) |
| `_build_row` | 99-103 | no code change needed if `_cell` returns the subclass; `score` stays `""` (D-06) |
| `_replace_in_paragraph` | 157-184 | spaced / tight / `.value` matching, `re.escape(key)`, function replacement (D-08) |
| `run_replace_docx._walk` callers | 187-205 | recurse nested tables; walk first-page + even-page header/footer (D-09) |
| `_hits` / `residual_tags_in` docx arm | 543-562 | record-text marker + recursive cells + all header/footer variants (D-07, D-09) |

Current `_cell` / `_build_row` (driver L88-103) — the shape to wrap, not reshape:
```python
def _cell(cited):
    cited = cited or {}
    v = cited.get("value") if isinstance(cited, dict) else None
    return {
        "value": "" if v is None else v,
        "source_chunk_id": cited.get("source_chunk_id") if isinstance(cited, dict) else None,
        "source_doc": cited.get("source_doc") if isinstance(cited, dict) else None,
        "source_page": cited.get("source_page") if isinstance(cited, dict) else None,
    }
```

Current exact-match token (driver L170-176; service L736-743 identical) — the defect-2 site:
```python
    for key, value in flat_scalars.items():
        token = "{{" + key + "}}"
        if token in replaced_text:
            matched.add(key)
            replaced_text = replaced_text.replace(token, value)
    # Blank any remaining placeholder-shaped token (unmatched intended placeholders).
    blanked_text = _PLACEHOLDER_TOKEN_RE.sub("", replaced_text)
    touched = matched or (blanked_text != replaced_text)
```
Keep the `matched` / `touched` structure (101-06 WR-04, pinned by `test_driver_replace_coalesces_matched_token_equal_to_original`). Replace the `in` / `.replace` with `re.compile(r"\{\{\s*" + re.escape(key) + r"(?:\.value)?\s*\}\}")` and `pat.sub(lambda m: value, ...)` (function repl, D-08). `_PLACEHOLDER_TOKEN_RE` (L84 / service L54) is unchanged.

Current walks (driver L196-203; service L796-805 identical):
```python
    _walk(doc.paragraphs)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                _walk(cell.paragraphs)
    for section in doc.sections:
        _walk(section.header.paragraphs)
        _walk(section.footer.paragraphs)
```
Current residual docx arm (driver L553-562; service L842-851) — `cell.text` in python-docx 1.2 does NOT include nested-table text (repro: `"Cell: Ann\n"` while `NESTED>Nested: {{name}}` survives), and headers/footers are not read at all:
```python
        doc = Document(out_path)
        texts = [p.text for p in doc.paragraphs]
        for t in doc.tables:
            for row in t.rows:
                for cell in row.cells:
                    texts.append(cell.text)
        return _hits(texts)
```
`_hits` (driver L543-548; service L825-830):
```python
def _hits(texts):
    out = []
    for txt in texts:
        if txt and any(tok in txt for tok in _RESIDUAL_TOKENS):
            out.append(txt.strip()[:80])
    return out
```

**Driver constraints (must hold after the edit):**
- No `app.*` import; `SandboxedEnvironment(autoescape=True)` stays as an assignment (`test_template_render.py::test_render_driver_is_self_contained` L603-625; `test_190_ssti_fence.py` regex `=\s*SandboxedEnvironment\(autoescape=True\)` L94 scans BOTH files, L70-71).
- The string is `r'''`: never write `'''` inside it; `\{` regexes are fine (raw).
- Never crashes: every path prints one JSON verdict (`main`, L663-722). `residual_clean = len(residuals) == 0` (L653), so a record-text hit added in `_hits` reaches `reason: residual_tokens` with no new branch (D-07).
- `test_278_pure_move.py` already RETIRES `_RENDER_DRIVER_SRC` and `_handle_render_template` (L208-229), so no 278 edit is needed; confirm it still passes.

### `render_template.py` — handler message (L1082-1103)

```python
        reason = "residual_tokens" if (verdict.get("rendered") and verdict.get("opened")) else "integrity"
        msg = (
            "The rendered file opened but still contains unsubstituted placeholder tokens "
            "(a silent non-fill) and was NOT delivered. The cited field-map is preserved "
            "below as fallback."
            if reason == "residual_tokens"
            else "The rendered file failed the integrity re-open and was NOT delivered. "
                 "The cited field-map is preserved below as fallback."
        )
```
D-07 adds one clause on the `residual_tokens` arm when a residual tag is record text. Test analog: `test_template_render.py::test_render_template_residual_tokens_not_delivered` (L984-1048) — copy wholesale (fake `resolve_template_source`, `settings.sandbox_enabled=True`, fake `run_in_threadpool` returning a verdict, `ws_write_file` that raises), swap `residual_tags` for a record-text hit and assert the new words appear in `payload["message"]`.

### `template_render_service.py` — the in-app copy

Same functions, typed signatures, longer docstrings: `_cell` L585-596, `build_context` L599-640, `_build_row(row, numeric_hook)` L643-656 (the `numeric_hook` branch writes plain values into `r[k]`; leave it), `_replace_in_paragraph` L701-754 (returns `(replaced, matched)` tuple; the driver returns `None` — keep both return shapes), `run_replace_docx` L757-815 (also returns `replaced_keys` / `unmatched_keys`; the matched set must still record keys matched via spaced/`.value` forms), `_hits` L825-830, `residual_tags_in` L833-882. Update the `residual_tags_in` docstring ("docx → body paragraphs + table cells") and the `run_replace_docx` docstring ("each section header/footer") to the D-09 surface. Define the dict subclass once per copy (driver cannot import the service).

## Test Patterns

### Loading the driver in-process (use as the fixture)
Source: `test_296_render_template.py` L42-48 (same in `test_291_pdf_fill_driver.py` L83-86, `test_291_acroform_reader_parity.py` L84-90):
```python
@pytest.fixture()
def driver():
    from app.services.tools.render_template import _RENDER_DRIVER_SRC

    ns: dict = {"__name__": "render_driver_under_test"}
    exec(compile(_RENDER_DRIVER_SRC, "<render_driver>", "exec"), ns)
    return ns
```
`__name__` must not be `"__main__"` or `main()` runs.

### Parity test shape (D-10)
Source: `test_291_acroform_reader_parity.py` — module docstring names the two copies and why they drift; fixture builders as top-level functions; one `@pytest.mark.parametrize("build", [...], ids=[...])` test that runs both copies on the same file and asserts equality, with a non-vacuity assert first:
```python
    ours = read_acroform_fields(data)
    assert ours, "fixture carries no fields — the comparison would be vacuous"
    expected = [...]
    got = [... for f in driver_reader(str(path))]
    assert got == expected
```
For `_replace_in_paragraph` parity on run-split tokens, reuse the fake-run harness in `test_template_render.py` L1069-1094 (`_Run` / `_Para` with `text` as a property joining runs), driving both `ns["_replace_in_paragraph"]` and the service's, asserting text equal to each other AND to the expected value.

### Building docx fixtures with python-docx (body, header, footer, cell, nested table, loop)
Source: `.planning/phases/303-word-template-bare-tokens/evidence/red-base/repro.py` L12-45 — copy `build()` and `texts()` into the test (into `tmp_path`, not the evidence dir):
```python
    d = Document()
    d.add_paragraph("Body: " + body_tok)
    sec = d.sections[0]
    sec.header.paragraphs[0].text = "Header: " + header_tok
    sec.footer.paragraphs[0].text = "Footer: " + footer_tok
    t = d.add_table(rows=1, cols=1)
    t.cell(0, 0).text = "Cell: " + cell_tok
    inner = t.cell(0, 0).add_table(rows=1, cols=1)
    inner.cell(0, 0).text = "Nested: " + nested_tok
    # loop table: "{%tr for r in rows %}" / "{{ r.cause }}" "{{ r.score }}" / "{%tr endfor %}"
```
`texts()` reads nested cells via `c.tables` — the recursion the fix needs. For first-page/even-page variants add `sec.different_first_page_header_footer = True` and write `sec.first_page_header.paragraphs[0].text` (and `d.settings.odd_and_even_pages_header_footer = True` for even).

Field map, same as the repro (L47-48):
```python
fm = {"scalars": {"name": {"value": "Ann", "source_chunk_id": "c1", "source_doc": "d.pdf", "source_page": 2}},
      "collections": {"rows": [{"cause": {"value": "Late vendor", "source_chunk_id": "c2", "source_doc": None, "source_page": None}}]}}
```

### Real render through the service / driver
Source: `test_template_render.py` L138-193 (`RISK_REGISTER_DOCX` / `SPLIT_TOKEN_DOCX` resolved from `pathlib.Path(__file__).resolve().parents[1] / "fixtures" / "templates"`, L63-67):
```python
    ctx = build_context(field_map_dict)
    out = tmp_path / "filled.docx"
    render_docx_template(str(RISK_REGISTER_DOCX), ctx, str(out))
    verdict = assert_integrity(str(out), "docx")
```
Driver equivalent: `ns["build_context"]`, `ns["render_docx_template"]`, `ns["assert_integrity"]`. For the script-level check (D-01 / D-11 golden), the repro's subprocess call is the pattern: write `_RENDER_DRIVER_SRC` to a file, `subprocess.run([sys.executable, "-u", driver, engine, tpl, fmp, out])`, parse the last stdout line.

### Golden byte-identity (D-11)
Compare `word/document.xml` and every `word/header*.xml` / `word/footer*.xml` with `zipfile.ZipFile(...).read(name)` between the base capture in `evidence/golden/` and the post-fix render. Inputs: `scripts/pm-pack/templates/{compliance-gap-report,risk-register,weekly-status-report}.docx`, `backend/tests/fixtures/templates/risk-register.docx`, a `|default` template, `backend/tests/fixtures/templates/arbitrary-split-token.docx` (run_replace).

## Shared Patterns / Pitfalls for the planner

1. **Header access can ADD parts (golden risk).** In python-docx, reading `.paragraphs` on a header/footer with no definition calls `_get_or_add_definition()`, which adds a new header part on the first section. `run_replace_docx` saves the document, so walking `first_page_header` / `even_page_header` unconditionally would change output bytes for templates that lack them. Guard the NEW variants with `if not hf.is_linked_to_previous:` (that property is `not _has_definition` and does not mutate). Leave the existing default `section.header` / `section.footer` calls as they are, so current bytes do not move. The residual scan only reads, so mutation there is harmless, but use the same guard for parity.
2. **`_hits` truncates to 80 chars** (`txt.strip()[:80]`). A long value pushes `'source_chunk_id':` past the cut, so the handler cannot find record text by searching `residual_tags`. Make the driver mark the hit itself (e.g. a fixed prefix on record-text hits, or an excerpt starting at the marker) and key the D-07 message clause on that marker.
3. **Dict subclass inside the sandbox.** `SandboxedEnvironment.getattr` tries `getattr` then `obj[attr]`, so `{{ name.value }}` resolves through item lookup; markupsafe `escape()` calls `str()` when there is no `__html__`. Do not override `__repr__` (D-06: a whole row printed must still show `'source_chunk_id'`). A test should render `{{ name }}`, `{{ name.value }}`, `{{ name.value|default('N/A') }}`, `{% if name %}` and a value with `&<>` through the real `SandboxedEnvironment(autoescape=True)`.
4. **Context equality tests stay green**: a dict subclass compares equal to a dict (`test_flat_map_renders_identical`, `test_flat_map_renders_same_bytes`).
5. **RED first (tdd_mode on)**: commit the failing tests before the fix; the repro output `evidence/red-base/repro-output-base.txt` is the expected RED shape (docxtpl bare → dict text with `residual_clean: true`; run_replace spaced → `Body: ` blank; nested `{{name}}` survives).
6. **Baseline gate**: `node scripts/check-backend-unit-baseline.cjs` must stay ≤ 71 failed (D-16). Targeted per task: `test_template_render.py test_296_render_template.py test_291_pdf_fill_driver.py test_291_acroform_reader_parity.py test_278_pure_move.py test_190_ssti_fence.py test_303_*.py`.

## Ledger update pattern (D-13, same commit)

**Scan-list row** (`docs/HOT-FILE-LEDGER.md` L12102 and L12187), format `| [path](anchor) | triple (was ...) | ⚠ **FIRES** ... | cell ≤ 200 chars |`:
```
| [`backend/app/services/tools/render_template.py`](docs/HOT-FILE-LEDGER.md#backendappservicestoolsrender_templatepy) | 6 / 3 / 1163 (was `3 / 2 / 1094`) | ⚠ **FIRES** (3 phases, crossed in 296) | 296-03 (291-WR-04): button answers written as PDF names on the field node; the read-back checks /V's type. Driver only. ⛔ SandboxedEnvironment(autoescape=True) |
```
**CLAUDE.md FIRING row** (L423), cell ≤ 80 chars:
```
| `backend/app/services/tools/render_template.py` | 6 / 3 / 1163 (was `3 / 2 / 1094`) | 296-03: button /V written as a name, read back typed · now FIRES · ⛔ |
```
`template_render_service.py` has no CLAUDE.md FIRING row today; it FIRES at 3 phases, so 303 should add one (≤ 80 chars) alongside the scan-list update.

**Detail-section paragraph** — append under `### backend/app/services/tools/render_template.py — Phase 291 (291-03)` (L24821, the 296-03 paragraph is L24829) and under `### backend/app/services/template_render_service.py` (L24691). Shape of the 296-03 paragraph: `<plan-id> (<finding id>): <what changed, in words>. ⚠ <G-5 status>. Triple \`N / N / N\` (was \`...\`). Previous scan-list cell kept verbatim: <old cell>.` Re-derive triples with the CLAUDE.md recipe at commit time, not from this file. `node scripts/check-claude-md-size.cjs` enforces both caps.

## No Analog Found

None. Every file has an exact in-repo analog.

## Metadata

**Analog search scope:** `backend/app/services/tools/`, `backend/app/services/`, `backend/tests/unit/` (all `_RENDER_DRIVER_SRC` users), `backend/tests/fixtures/templates/`, `scripts/pm-pack/templates/`, phase `evidence/red-base/`, `docs/HOT-FILE-LEDGER.md`, `CLAUDE.md`
**Files scanned:** 12
**Pattern extraction date:** 2026-11-06
