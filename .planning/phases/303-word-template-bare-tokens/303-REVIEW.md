---
phase: 303-word-template-bare-tokens
reviewed: 2026-11-06T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - backend/app/services/tools/render_template.py
  - backend/app/services/template_render_service.py
  - backend/tests/unit/test_303_bare_tokens.py
  - backend/tests/unit/test_303_driver_service_parity.py
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
fix_status: fixed 6 / skipped 1 (WR-01 accepted, D-20) — see "Fix status" at the end
---

# Phase 303: Code Review Report

**Reviewed:** 2026-11-06
**Depth:** standard (diff `8226f8703..HEAD`, plus the callers and callees the diff depends on)
**Files Reviewed:** 4
**Status:** issues_found

## Summary

I checked these properties and they hold:

- **Both copies match.** The driver and the service copies of `_CitedCell`, `_cell`, `_replace_in_paragraph`, `run_replace_docx`, `_hits` and `_docx_texts` are the same code apart from type hints.
- **Escaping still happens.** `_CitedCell` has no `__html__`, so markupsafe falls back to `str()` and escapes it. `test_bare_name_escapes_exactly_like_value` proves this.
- **A whole record is still caught.** `__repr__` is not overridden, so `{{ rows }}` and `{{ r }}` still print `'source_chunk_id':` and the scan catches them.
- **No regex injection.** The key goes through `re.escape` and the replacement is a function, so backslashes in a value stay literal (the `\1` / `\g<0>` cases are tested).
- **No new header/footer variants.** The first-page and even-page variants are only walked when `is_linked_to_previous` is false.
- **The prefix survives the cut.** The `record text: ` prefix is added after the 80-character truncation, so it is always present.
- **The driver is still self-contained.**
- **The integrity gate is not weakened.** A record-text hit goes down the existing `residual_clean: false` path.

The problems are where the fix's reach does not match the phase goal. The goal says the user never gets back "a blank where a value belongs". I drove each finding below with `backend/venv/Scripts/python.exe` against the service copy; the driver copy is identical code.

1. **A bare loop column still renders blank with a clean verdict (CR-01).** The fix makes `{{ r.cause }}` print the value only when the model happens to emit a `cause` column. The parse oracle never asks the model for that column.
2. **The coercion only covers `str()`.** Comparisons and filters on a bare cell silently work on the dict instead of the value.
3. **The wider run_replace match makes an existing cascade easier to hit.** A cited value that contains a token-shaped string is substituted again or erased.
4. **A rejected file stays in `/sandbox/output`.** The "not delivered" file is left there, so a later `execute_code` harvest can still publish it. This predates the phase, but the phase now routes record-text failures through that path.

## Critical Issues

### CR-01: A bare loop column (`{{ r.cause }}`) renders blank with `residual_clean: true`, because the parse oracle never asks the model for that column

**File:** `backend/app/services/template_render_service.py:402-406` (oracle); render path `:664-677`; prompt `backend/app/services/harness/phase_types.py:1657-1665`

**Issue:** D-02 lists the loop row `{{ r.cause }}` as one of the six bare-token locations this phase fixes. The fix (`_CitedCell.__str__`) only works when the row actually has a `cause` key. Here is how that key gets into the row:

- `parse_docx_template_variables` only records a column for a loop-var deref that ends in `.value`: `\{\{\s*(var)\.(col)\.value\s*\}\}`.
- Bare loop derefs are deliberately left out. The docstring says they are "driver-computed (the D-11 derived-compute hook)", which is true of `score` only.
- So for a template with `{%tr for r in rows %}…{{ r.cause }}`, the oracle returns `columns: {}`.
- The emit prompt then says `collections (one entry per row): rows` with no column names, and the model has to guess the row keys.
- Any guess other than `cause` makes `r.cause` a Jinja `Undefined`. That prints `""`, and the residual scan sees nothing.

Driven:

```
oracle: {'scalars': ['name'], 'collections': ['rows'], 'columns': {}}  names: ['name']
render (row keyed 'root_cause'): {'rendered': True, 'error': None}
assert_integrity: {'opened': True, 'residual_tags': [], 'residual_clean': True, ...}
cell text: ['Cause: ']
```

That is a blank where a value belongs, handed back with a clean verdict, on one of the template forms the phase says it fixed.

The tests do not catch it. Both `test_driver_script_docxtpl_bare_tokens_render_values` and `test_service_docxtpl_bare_tokens_render_values` use a hand-written `FM` that already contains `cause`, so they skip the oracle step that decides whether the model emits it.

CONTEXT puts "the parse oracle" out of scope. The success criteria still depend on it, so either fix it here or narrow SC#1 / D-02 to "only when the field map carries the column" and record that as an owed defect.

**Fix:** Have the oracle accept bare loop derefs as columns too, except for the driver-derived keys:

```python
_DERIVED_ROW_KEYS = {"score"}  # the D-11 default-blank derived field
for var, col in re.findall(
    r"\{\{\s*([A-Za-z_]\w*)\.([A-Za-z_]\w*)(?:\.value)?\s*(?:\|[^}]*)?\}\}", text
):
    if var in loop_vars and col not in _DERIVED_ROW_KEYS:
        columns.setdefault(loop_vars[var], set()).add(col)
```

The prompt (`phase_types.py:1660`) and the coverage check (`phase_types.py:1788`) then name and enforce the column. Add a test that runs a bare-loop template through `parse_docx_template_variables` and checks that `cause` is in `columns["rows"]`.

## Warnings

### WR-01: Coercion only covers `str()`, so comparisons and filters on a bare cell silently use the dict and the verdict stays clean

**File:** `backend/app/services/template_render_service.py:585-599`, `backend/app/services/tools/render_template.py:91-102`

**Issue:** Now that `{{ status }}` prints `Open`, authors are invited to write bare-token templates. But every non-`str` operation on the same name still runs on the dict. Driven in `SandboxedEnvironment(autoescape=True)` with `status="Open"`, `total="42"`, and `blank` (a not-found field):

```
{% if status == 'Open' %}yes{% else %}no{% endif %}  -> 'no'
{{ total|int }}                                      -> '0'
{{ total|length }}                                   -> '4'   (the dict's key count)
{{ blank|default('N/A', true) }}                     -> ''    (the dict is truthy)
{{ blank or 'N/A' }}                                 -> ''
{% if blank %}T{% else %}F{% endif %}                -> 'T'
{{ status[:2] }}                                     -> KeyError (fails loudly, which is fine)
```

The first six give wrong content with `residual_clean: true`. Examples: a conditional section dropped, a total printed as `0`, an author's N/A fallback ignored.

The code comment says "`==` and `|default` resolve exactly as before". Compared with base that is literally true. It is misleading about what bare-token templates can now rely on. D-06 chose the dict subclass on purpose, so this is a known trade-off, but nothing records it as a limit and nothing detects it.

**Fix:** At minimum, record it as a documented limit in both docstrings and in `docs/` next to the residual-scan limits. Better: lint at parse / bind time. In `parse_docx_template_variables`, flag a scalar root used without `.value` inside a `{% if … %}` comparison, an `or`, or a `|int` / `|float` / `|length` / `|default(…, true)` filter, and surface it as an authoring refusal. Do not add `__eq__` / `__bool__` to `_CitedCell`: that changes how existing `.value` templates and context-equality tests behave.

### WR-02: The wider run_replace match makes cascades easier, so a cited value with a token-shaped string is substituted again or silently erased, depending on key order

**File:** `backend/app/services/template_render_service.py:757-769`, `backend/app/services/tools/render_template.py:187-198`

**Issue:** `_replace_in_paragraph` applies one regex per key, in turn, to text that has already been substituted. Each regex now matches any spacing and `.value`. So a value inserted for an earlier key is re-scanned by every later key, and then by `_PLACEHOLDER_TOKEN_RE`. Values come from cited KB content, which is untrusted document text.

Driven:

```
flat = {"client": "Acme", "note": "see {{ client }} and {{ salary }}", "salary": "120000"}
"Client: {{client}} / Note: {{note}}"  ->  "Client: Acme / Note: see  and 120000"
```

The note's literal `{{ salary }}` was replaced with another field's value, and its `{{ client }}` was erased. Which of the two happens depends only on dict order:

```
{"salary": "120000", "note": "literal {{ salary }} text"}  ->  "Note: literal  text"
```

This existed at base for the tight `{{x}}` form. D-08 extends it to the spaced and `.value` forms, which is how real prose more often looks. The verdict is clean either way, and `matched` also counts keys "found" only inside inserted values.

**Fix:** Substitute in a single pass over the original text, so inserted values are never re-scanned:

```python
_ANY_TOKEN_RE = re.compile(r"\{\{\s*([^{}]*?)\s*\}\}")

def _sub(m):
    inner = m.group(1)
    key = inner if inner in flat_scalars else (
        inner[:-6] if inner.endswith(".value") and inner[:-6] in flat_scalars else None)
    if key is not None:
        matched.add(key)
        return flat_scalars[key]
    return "" if _PLACEHOLDER_TOKEN_RE.fullmatch(m.group(0)) else m.group(0)

replaced_text = _ANY_TOKEN_RE.sub(_sub, full)
touched = bool(matched) or replaced_text != full
```

Make this change in both copies and add a parity case `("value-contains-token", ["X: {{a}}"], {"a": "{{ b }}", "b": "B"}, "X: {{ b }}")`. Note that the residual scan would then honestly fail that output, because `{{` survives. That is the correct outcome for content the engine cannot tell apart from a tag.

### WR-03: A file rejected by the integrity gate is left in `/sandbox/output`, so the next `execute_code` harvest can still publish it

**File:** `backend/app/services/tools/render_template.py:1021`, `:1142-1171` (driver `main` writes `out_path` before `assert_integrity`, `:743-763`)

**Issue:** This predates the phase. Phase 303 now sends every record-text document through this path and relies on "not delivered".

- The driver renders straight to `container_out = /sandbox/output/<out_filename>`, then runs the integrity check.
- On `residual_tokens` or `integrity`, the handler returns `status: failed` but never deletes that file.
- `harvest_output_files` (`sandbox_service.py:201-290`) uploads every file in `/sandbox/output` whose content hash is not already in the run's baseline.
- `tools/sandbox.py:567-575` seeds that baseline only once per run.
- So if `execute_code` ran earlier in the same run, its next call harvests the rejected `.docx` and publishes it as a download link.
- `skills.py:104-131` (`source='sandbox_output'`) can also attach it by name.

The result is that the record-text document the phase says is "never handed back" can still reach the user.

**Fix:** Have the driver render to `/tmp/render-out-<uuid>.<ext>` and move the file into `/sandbox/output/<name>` only after `assert_integrity` passes. Alternatively, on any failed verdict, the handler runs `session.execute_command("rm -f " + shlex.quote(container_out))` before returning. Add a handler test that asserts the delete command runs on a `residual_clean: false` verdict.

## Info

### IN-01: The `run_replace_docx` docstring says no header part is added, but the default header and footer still are

**File:** `backend/app/services/template_render_service.py:790-794`

**Issue:** "a variant the template does not define is never touched, so no header part is added" is only true of the first-page and even-page variants. The default `section.header.paragraphs` / `.tables` access (`:837-840`) is unguarded. Driven: a body-only template comes in with no header/footer parts and comes out with `['word/header1.xml', 'word/footer1.xml']`. Base did the same, and `test_run_replace_adds_no_header_footer_part` deliberately allows `<= 1`. Only the claim is wrong.

**Fix:** Change the docstring to "a first-page / even-page variant the template does not define is never touched; the default header/footer is created if absent (pre-existing)". Or guard the default with `is_linked_to_previous` the same way `_docx_texts` does, if byte-identical goldens allow it.

### IN-02: The record-text failure message still opens with the wrong cause and says "not delivered" twice

**File:** `backend/app/services/tools/render_template.py:1148-1163`

**Issue:** When every hit is record text, the message still starts "still contains unsubstituted placeholder tokens (a silent non-fill) and was NOT delivered…", then appends "…so the file was not delivered." The cause stated first is wrong for that case. The message also does not say the template itself prints a whole record, so the harness's bounded retry (which only changes the field map) cannot fix it.

**Fix:** When all residual tags carry the record prefix, pick a separate lead sentence, e.g. "The template printed a whole cited record as text (for example `{{ r }}` or `{{ rows }}`) instead of a value; the file was NOT delivered. Use `{{ name }}` or `{{ name.value }}` for a single field."

### IN-03: Test gaps

**File:** `backend/tests/unit/test_303_bare_tokens.py:397-403`, `backend/tests/unit/test_303_driver_service_parity.py:115-121`

**Issue:**

- The residual-scan reach test covers `nested / header / footer / first_header`, but not `first_footer`, `even_header`, `even_footer` or a header table (`header_cell`). Only the run_replace walk test covers those.
- `_RECORD_TEXT_MARK` is not pinned across the copies directly; only `_RECORD_TEXT_PREFIX` is. A matching edit to both marks would still pass parity.
- No test drives the oracle step from CR-01.

**Fix:** Extend the `where` parametrisation to all seven locations. Add `driver["_RECORD_TEXT_MARK"] == service._RECORD_TEXT_MARK == "'source_chunk_id':"`. Add the oracle test described in CR-01.

---

## Fix status (2026-11-06, gsd-code-fixer, dispositions D-17..D-21 in 303-CONTEXT.md)

| Finding | Status | Commit | What changed |
|---|---|---|---|
| CR-01 | fixed: requires human verification (logic) | `1b2233402` | D-17. `parse_docx_template_variables` records `{{ r.col }}` as well as `{{ r.col.value }}` as a column, except `score` (`_DERIVED_ROW_KEYS`). The four shipped templates parse identically: measured before == after, and pinned against the legacy rule by `test_oracle_unchanged_for_shipped_templates`. The oracle step is tested (`test_oracle_records_bare_loop_column_but_not_score`). Filtered tokens (`{{ r.x|upper }}`) are still not read, for scalars and columns alike (pre-existing limit). |
| WR-01 | skipped: accepted, D-20 | — | Known limit, recorded under Deferred in CONTEXT. No code change. |
| WR-02 | fixed: requires human verification (logic) | `7c6c9ce13` | D-18. Both copies of `_replace_in_paragraph` run ONE alternation pass over the paragraph's original text (known keys `re.escape`d, longest first, then the unknown-placeholder blank; function replacement). An inserted value is never rewritten or erased. `matched` counts template keys only. ⚠ **Residual consequence, accepted:** a cited value that contains a literal `{{ x }}` (or any `{{`/`}}`/`{%`) now survives into the document, so the residual scan flags it and the file is NOT delivered. That is an honest refusal of content the engine cannot tell apart from a tag, never a silent rewrite. |
| WR-03 | fixed | `da008d678` | D-19. On `residual_tokens`, `integrity` and `no_verdict` the handler runs `rm -f <shlex-quoted /sandbox/output path>` through the same `sandbox_manager` session (in the threadpool) before returning. A failed delete is logged (`could not remove refused output`) and the refusal is returned unchanged. A delivered file is never deleted. `harvest_failed` does not delete: that file passed integrity. The `sandbox_error` path (an exception inside the sandbox run) also does not delete, because the session state is unknown there. |
| IN-01 | fixed | `161276fc7` | The `run_replace_docx` docstring now says the default header/footer part is still created when absent (pre-existing). |
| IN-02 | fixed | `161276fc7` | An all-record-text verdict leads with "A field printed as raw record text: the template printed a whole cited record …", says "NOT delivered" once and names the template-side fix. A mixed verdict names both causes, once. The plain residual and integrity messages are byte-identical to before. |
| IN-03 | fixed | `161276fc7` | The residual-scan reach test covers all eight locations (nested, header, footer, header table, first-page header/footer, even-page header/footer), for both a surviving token and record text. `_RECORD_TEXT_MARK` is pinned across the copies. The oracle test landed with CR-01. |

**Verification.** The eight in-scope suites (`test_303_bare_tokens`, `test_303_driver_service_parity`, `test_template_render`, `test_296_render_template`, `test_291_pdf_fill_driver`, `test_291_acroform_reader_parity`, `test_278_pure_move`, `test_190_ssti_fence`) went from 153 to **200 passed, 0 failed**. The handler suites `test_citation_policy`, `test_emitters` and `test_llm_emit_executor` pass (62), and so do the oracle consumers (258). Golden: `evidence/golden/after-review` vs `base` → **RESULT: ALL IDENTICAL**. The ledger and size gates exit 0. The full backend baseline was not run here.

---

_Reviewed: 2026-11-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
