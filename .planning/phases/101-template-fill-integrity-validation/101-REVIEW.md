---
status: issues_found
phase: 101-template-fill-integrity-validation
reviewed: 2026-06-11
depth: deep (adversarial multi-agent)
files_reviewed: 11
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
---

# Phase 101 Code Review — Template-Fill + Integrity Validation

The deterministic core (`template_render_service.py`) and the provenance byte-resolver (`template_asset_service.py`) are well-built and honor the phase's hardest invariants cleanly: the **SSTI containment is sound** (engine selection is purely provenance-keyed in `select_engine`; the untrusted `template_input` path is statically asserted to never reach Jinja and its `run_replace_docx` engine never imports jinja2/docxtpl), `SandboxedEnvironment(autoescape=True)` is correctly applied on the trusted path, **cross-user isolation is correct** (every ephemeral query is `created_by`-scoped and a cross-user/expired/missing row all collapse to a clean "no template" string — 404-not-403, no existence leak, no raw traceback), and **Deep parity holds** (the `dispatch_tool` whitelist guard is byte-unchanged, `get_tools()`/`apply_tool_budget` Deep call sites are untouched, and the handler is inert unless called). The **two gates are present** — a citation/coverage reject BEFORE render and an integrity re-open AFTER render, with field-map preservation on failure (D-08). However, the *end-to-end* fill path is **not functional as shipped**: the `render_template` tool has no JSON schema in `get_tools()`, so the model is never shown the tool and physically cannot call it (CR-01 is the headline — it silently neutralizes the whole feature on the agent path), and even if it could, the success/persist path passes a leading-slash-less `out_filename` into `validate_path`, which rejects it, so every passing render fails to persist (WR-02). A command-injection surface exists where the model-controlled `out_filename` is interpolated unquoted into a sandbox shell command (CR-01-class severity, tracked as CR-… below). The integrity gate also ignores `residual_clean`, so a silent non-fill (surviving `{{tokens}}`) is still delivered (WR-03). None of the happy-path behaviors are covered by tests — only the reject/fail paths are — which is why these escaped.

## Findings

### CR-01: `out_filename` interpolated unquoted into the sandbox shell command (command injection)
- **Severity:** critical
- **File:** `backend/app/services/tool_dispatcher.py:1620,1658-1662`
- **Issue:** `container_out = f"/sandbox/output/{out_filename}"` is built from `args.get("out_filename")` with only `.strip()` applied — no validation, no quoting, no allow-listing of characters. It is then interpolated into a shell command string and executed: `cmd = f"python -u {container_driver} {engine} {container_template} {container_field_map} {container_out}"` → `session.execute_command(cmd)`. The `out_filename` value is model-controlled and therefore prompt-injectable via untrusted document content (a malicious uploaded template or KB doc can steer the model to emit a crafted filename). A value such as `x.docx; curl ... | sh` or `$(...)`/backtick payload executes arbitrary shell **inside the sandbox session**, which is shared per-thread with `execute_code` — so the injection can read/modify other files shipped into that container and corrupt concurrent execution state. The three server-generated paths (`container_template/field_map/driver`) are UUIDs and safe; only `container_out` carries external influence.
- **Evidence:** `container_out = f"/sandbox/output/{out_filename}"` and `cmd = (f"python -u {container_driver} {engine} " f"{container_template} {container_field_map} {container_out}")` … `exec_result = session.execute_command(cmd)`; upstream `out_filename = (args.get("out_filename") or "deliverable.docx").strip() or "deliverable.docx"`.
- **Recommendation:** Validate `out_filename` to a strict basename (e.g. `^[A-Za-z0-9._ -]+\.(docx|pptx|xlsx)$`, reject path separators) BEFORE building the container path, and pass argv as a list / shell-quote each token (`shlex.quote`) rather than f-string-concatenating into one shell string. Reusing `workspace_service.validate_path` semantics or a dedicated filename validator closes this.

### WR-01: `render_template` has no tool schema — the model can never call it (feature non-functional end-to-end)
- **Severity:** warning
- **File:** `backend/app/services/openai_service.py:768-784` (get_tools); `backend/app/services/tool_dispatcher.py:2271`; `backend/app/services/template_render_service.py:115` (`build_field_map_tool_schema` is never wired)
- **Issue:** The handler is registered in `_TOOL_REGISTRY` and admitted on both whitelist layers, but there is **no `render_template` schema** in `get_tools()` and `build_field_map_tool_schema()` is referenced only in docstrings — never called by production code. `apply_tool_budget` Stage 1 filters the schemas returned by `get_tools()` to those in the whitelist; since no `render_template` schema exists, the per-phase `tools_override` contains zero `render_template` entries, so the model is never told the tool exists and cannot emit the call. In Deep chat the tool is likewise invisible. The 101-05/101-04 summaries explicitly claim the tool is "callable from BOTH workflow fill phases AND Deep chat" and admitted on "the schemas the model sees" — both contradicted by the code. Net effect: the entire fill feature is dead on the agent path; only the deterministic core is reachable (via tests).
- **Evidence:** `get_tools()` builds `tools = [SEARCH_DOCUMENTS_TOOL, ... ASK_USER_TOOL]` plus optional `WEB_SEARCH_TOOL`/`EXECUTE_CODE_TOOL` — no render-template schema; `apply_tool_budget`: `schemas = [t for t in schemas if t["function"]["name"] in whitelist]`; grep confirms `render_template` appears in no schema-name constant anywhere in `backend/app/**`.
- **Recommendation:** Add a `RENDER_TEMPLATE_TOOL` schema (built from `build_field_map_tool_schema` for `input_schema`) and append it to `get_tools()` (gated like `execute_code` on `sandbox_enabled`), OR have the harness fill-phase explicitly inject the render schema into `tools_override`. Without a schema in the filtered list the whitelist admission is a no-op.

### WR-02: success/persist path passes a leading-slash-less `out_filename` to `validate_path`, so every passing render fails to persist
- **Severity:** warning
- **File:** `backend/app/services/tool_dispatcher.py:1514,1752-1758`; `backend/app/services/workspace_service.py:84-85`
- **Issue:** On the happy path the handler calls `ws_write_file(..., path=out_filename, ...)` where `out_filename` defaults to `"deliverable.docx"` (bare filename, no leading slash). `write_file` → `validate_path` requires `path.startswith("/")` and raises `PathValidationError("Path must start with /")`, which is a `WorkspaceError` subclass and is caught at the persist `try/except`, returning `status: failed, reason: persist_failed`. So a deliverable that passes BOTH gates is never delivered — the exact data-loss outcome the gates were built to avoid, now triggered on the *success* branch. The two existing render_template tests both poison `ws_write_file` and only exercise the reject/fail branch (`out_filename: "out.docx"`), so the success path is untested and the bug is invisible.
- **Evidence:** `out_filename = (args.get("out_filename") or "deliverable.docx").strip() or "deliverable.docx"`; `result = await ws_write_file(... path=out_filename, content=produced)`; `validate_path`: `if not path.startswith("/"): raise PathValidationError("Path must start with /")`.
- **Recommendation:** Normalize before persist — `path = out_filename if out_filename.startswith("/") else "/" + out_filename` (after the basename validation from CR-01). Add a success-path test that asserts `ws_write_file` IS called and `status == "ok"`.

### WR-03: integrity gate ignores `residual_clean` — a silent non-fill (`{{token}}` survivors) is still delivered
- **Severity:** warning
- **File:** `backend/app/services/tool_dispatcher.py:1726`
- **Issue:** The AFTER-render gate is `if not (verdict.get("rendered") and verdict.get("opened"))`. The driver computes `residual_clean` / `residual_tags` (the silent-miss detector, T-101-02-05) but the handler never consults it. A file that opens cleanly yet still contains unsubstituted placeholder markup (`{{project_name}}`, an unmatched run-replace token, a non-rendered Jinja tag) passes the gate and is persisted and shown to the user. The phase's own contract is "NO `{{`/`}}` survives a fill … the residual scan catches a surviving token as an honest fail" — but that honest fail is never enforced as a delivery block.
- **Evidence:** gate: `if not (verdict.get("rendered") and verdict.get("opened")):` (no `residual_clean` term); driver verdict carries `"residual_clean"` and `"residual_tags"` that are parsed back (`verdict["residual_clean"] = ...`) but unused on the decision.
- **Recommendation:** Fold `residual_clean` into the gate (`rendered and opened and residual_clean`), or at minimum return a degraded `status` that surfaces `residual_tags` so the harness retry loop re-renders rather than shipping a half-filled file. If a partial fill is intentionally deliverable, make that an explicit decision in the docstring; today it is silent.

### WR-04: `_replace_in_paragraph` (sandbox driver) "no-change" guard compares against the original text, not the post-replace text
- **Severity:** warning
- **File:** `backend/app/services/tool_dispatcher.py:1286-1291` (driver) vs `backend/app/services/template_render_service.py:441-452` (production helper)
- **Issue:** The in-sandbox driver copy diverges from the audited production helper. Production computes `touched = matched or (blanked_text != replaced_text)` and writes when a scalar matched OR a placeholder was blanked. The driver only writes `if blanked_text != full` — comparing the *blanked* text to the *original* paragraph text. When a scalar substitution produces text equal to the original `full` (e.g. a `{{token}}` replaced by a value that reconstitutes the original string, or replace-with-empty cases), `blanked_text == full` is true and the driver returns WITHOUT writing the coalesced runs — so the matched token can survive in a later run fragment (a silent non-fill that WR-03 then ships). It is the driver, not the audited helper, that actually runs in production.
- **Evidence:** driver: `blanked_text = _PLACEHOLDER_TOKEN_RE.sub("", replaced_text)` … `if blanked_text == full: return` … `runs[0].text = blanked_text`; production: `touched = matched or (blanked_text != replaced_text)` … `if not touched: return ...`.
- **Recommendation:** Mirror the production logic in the driver: track `matched` and use `touched = matched or (blanked_text != replaced_text)`; gate the early-return on `touched`, not on `blanked_text == full`. Better, ship the production helpers into the sandbox verbatim instead of re-implementing them so the two copies cannot drift.

### IR-01: two source-of-truth copies of the deterministic helpers will drift
- **Severity:** info
- **File:** `backend/app/services/tool_dispatcher.py:1186-1470` (`_RENDER_DRIVER_SRC`) vs `backend/app/services/template_render_service.py`
- **Issue:** `build_context`, `_cell`, `_build_row`, `_replace_in_paragraph`, `run_replace_docx`, `residual_tags_in`, `assert_integrity` are inlined a second time as a source string in the driver. WR-04 is already a concrete instance of the two copies drifting; the `numeric_hook` parameter and the production `_build_row`'s richer behavior are also absent in the driver. Maintaining two hand-kept copies of security-relevant render logic is fragile.
- **Evidence:** Both modules define `def assert_integrity(out_path, fmt)`, `def residual_tags_in(...)`, `def build_context(...)` with near-identical but non-identical bodies.
- **Recommendation:** Generate the driver string by reading the actual `template_render_service` source (or a curated subset) at ship time, or add a test that diffs the two implementations' behavior against shared fixtures to fail on drift.

### IR-02: registry test asserts handler count but not schema/visibility — masked WR-01
- **Severity:** info
- **File:** `backend/tests/unit/test_tool_dispatcher.py:22,50-59`
- **Issue:** `test_registry_has_exactly_25_entries` and the admission tests verify the handler is registered and whitelist-admitted, but nothing asserts a `render_template` schema is present in `get_tools()` or reaches the model. That coverage gap is exactly why WR-01 (no schema → uncallable) shipped green.
- **Evidence:** test checks `_TOOL_REGISTRY` membership and `_effective_tools`/`phase_whitelist` admission; no assertion against `get_tools()` or `apply_tool_budget` output containing a render_template entry.
- **Recommendation:** Add a test asserting `any(t["function"]["name"] == "render_template" for t in apply_tool_budget(get_tools(...), model, frozenset({"render_template", ...})))` once WR-01 is fixed.
