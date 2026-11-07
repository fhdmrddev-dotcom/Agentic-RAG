---
phase: 303
slug: word-template-bare-tokens
status: verified
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: 2026-11-06
---

# Phase 303 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register source: `303-01-PLAN.md` `<threat_model>` (T-303-01..08 + T-303-SC), re-verified against
> the post-review code (D-17 oracle, D-18 one-pass substitution, D-19 refused-file delete).
> Every `mitigate` row below was checked by reading the code and by a passing test. Docs alone were not taken as evidence.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| field map (LLM-emitted cited values) → render context | values are untrusted text that land inside OOXML via Jinja (library templates) or python-docx run text (uploaded templates) | cited KB text, untrusted |
| uploaded template → run_replace engine | an untrusted .docx; must never reach Jinja (`select_engine` routes `template_input` to run_replace) | user-uploaded document, untrusted |
| sealed sandbox driver → handler | the driver's one JSON verdict decides whether a file is delivered to the user | render verdict + produced file (integrity-bearing) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-303-01 | Elevation of privilege (SSTI) | `_CitedCell` (both copies), `render_docx_template` | mitigate | `_CitedCell(dict)` defines only `__slots__ = ()` and `__str__`. It has no `__getattr__`, `__html__`, `__format__` or `__repr__` (`tools/render_template.py:91-102`, `template_render_service.py:594-608`). `SandboxedEnvironment(autoescape=True)` is unchanged at `render_template.py:165` and `template_render_service.py:716`. The phase diff `6ca60a1f7..HEAD` has no hunk touching `SandboxedEnvironment`, jinja imports or dunders. `test_190_ssti_fence.py`, `test_template_render.py::test_render_driver_is_self_contained` and `test_303_driver_service_parity.py::test_cell_parity` (asserts `not hasattr(cell, "__html__")` in both copies) are green. | closed |
| T-303-02 | Tampering (XML/markup injection) | bare `{{ name }}` output | mitigate | Because there is no `__html__`, markupsafe escapes `str(cell)`. `test_303_bare_tokens.py:275 test_bare_name_escapes_exactly_like_value` runs on both copies. run_replace still writes through python-docx `runs[0].text =` (`render_template.py:210`, `template_render_service.py:791`), which escapes on write. | closed |
| T-303-03 | Tampering (regex injection) | `_replace_in_paragraph`, both copies (now ONE alternation pass, D-18) | mitigate | `alts = "\|".join(re.escape(k) for k in sorted(flat_scalars, key=len, reverse=True))` is at `render_template.py:193` and `template_render_service.py:772`. The replacement is the function `_sub`, which returns `flat_scalars[key]` verbatim (`:197-203` / `:776-782`), so `\1`, `\g<0>` and backslashes stay literal. Each pass runs over the ORIGINAL text, so an inserted value is never re-scanned. Tests: `test_run_replace_inserts_backslash_values_literally`, `test_run_replace_never_rescans_an_inserted_value`, and the parity cases `backslash` and `value-contains-token`. Audit probe (service copy): keys `a.b` / `a*b` match only literally (`{{ab}}` is not hit by `a.b`), and the value `\1 \g<0> \\ $&` is inserted verbatim. | closed |
| T-303-04 | Tampering / integrity (half-filled or record-text document delivered) | docx `residual_tags_in` + handler gate + refused-file delete (D-19) | mitigate | The record mark `'source_chunk_id':` gets the prefix `record text: ` AFTER the 80-char cut (`render_template.py:590-593`, `template_render_service.py:897-900`). The verdict sets `residual_clean = len(residuals) == 0` (`render_template.py:718`), and the handler refuses when `residual_clean` is false (`:1176-1215`). The scan walks nested tables and every header/footer variant guarded by `is_linked_to_previous` (`:599-619`). **D-19:** `_discard_refused_output()` runs `rm -f <shlex-quoted container_out>` on the `no_verdict` (`:1160`), `residual_tokens` and `integrity` (`:1207`) paths. A failed delete is logged and the refusal is returned unchanged. Tests: `test_whole_record_printed_is_not_delivered`, `test_residual_scan_reaches_nested_header_footer_and_first_page`, `test_residual_scan_marks_record_text_in_every_location`, `test_handler_names_record_text_in_failure_message`, `test_handler_removes_a_refused_file_from_sandbox_output[residual\|integrity\|no-verdict]` (asserts the exact `rm -f '/sandbox/output/Q3 risk report.docx'` command and `written == []`), `test_handler_keeps_a_delivered_file`, `test_handler_refusal_reason_survives_a_failed_delete`. | closed |
| T-303-05 | Elevation of privilege | untrusted upload engine selection | mitigate | `select_engine` (`template_render_service.py:1060-1078`, with `assert engine != "docxtpl"` for uploads) and `_DOCXTPL_PROVENANCES` have no hunk in the phase diff `6ca60a1f7..HEAD` (grep over the diff found no `def select_engine`, `_DOCXTPL_PROVENANCES` or `assert engine` lines). `run_replace_docx` imports only `from docx import Document` (`render_template.py:216`); no jinja2/docxtpl import was added. | closed |
| T-303-06 | Integrity (silent output drift on shipped templates) | header/footer walk additions | mitigate | The first-page and even-page variants are walked only `if not hf.is_linked_to_previous` (`render_template.py:241-245`, `template_render_service.py:864`). `test_run_replace_adds_no_header_footer_part` is green. The golden compare was re-run by the auditor: `compare.py base after-review` gives `RESULT: ALL IDENTICAL` (8 parts across 6 renders). | closed |
| T-303-07 | Denial of service (ReDoS) | per-paragraph alternation regex | accept | See Accepted Risks AR-303-01. Re-checked for the D-18 alternation form. | closed |
| T-303-08 | Information disclosure | record text echoed in `residual_tags` | accept | See Accepted Risks AR-303-02. | closed |
| T-303-SC | Tampering (supply chain) | package installs | accept | See Accepted Risks AR-303-03. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-303-01 | T-303-07 | **Re-checked against the D-18 alternation form.** The pattern is `\{\{\s*(?P<key>k1\|k2\|…)(?:\.value)?\s*\}\}\|(?P<unknown>\{\{\s*[A-Za-z_][\w.]*\s*\}\})`. The keys are `re.escape`d literals, the anchors are literal, there are no nested quantifiers, and `\s` and `[\w.]` are disjoint, so backtracking per start position is bounded. Cost is O(text × keys), and both are bounded by the template and the field map. Measured on the service copy with pathological inputs (an unclosed `{{ aaaa…`, repeated `{{a`, `{{` plus a long whitespace run, 50-char keys): 10k → 0.001 s, 100k → 0.009 s, 1M → 0.085 s, which is linear. Python's `re` cache absorbs repeat compiles. | plan-time register (303-01-PLAN), re-confirmed by gsd-security-auditor | 2026-11-06 |
| AR-303-02 | T-303-08 | The excerpt is the run's own cited data, returned to the same user and agent that produced it. A `{{token}}` survivor already behaved this way. Each hit is capped at 80 chars plus the `record text: ` prefix (`render_template.py:593`). The failure payload's `field_map`/`verdict` echo predates this phase. | plan-time register (303-01-PLAN), re-confirmed by gsd-security-auditor | 2026-11-06 |
| AR-303-03 | T-303-SC | No package was installed or upgraded. `git diff 6ca60a1f7 HEAD --stat` over `backend/app`, `backend/Dockerfile.sandbox`, `backend/requirements*.txt`, `frontend/package*.json` and `supabase` lists only `render_template.py` and `template_render_service.py`. docxtpl 0.20.2, python-docx 1.2.0 and jinja2 3.1.6 stay as pinned (D-14). | plan-time register (303-01-PLAN), re-confirmed by gsd-security-auditor | 2026-11-06 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

None. `303-01-SUMMARY.md ## Threat Flags` reads "None. No new endpoint, auth path or schema surface". The post-review fixes (D-17 oracle column rule, D-18 one-pass substitution, D-19 `rm -f` in the sandbox) add no new endpoint, auth path or schema. D-19's sandbox command is built argv-safely with `shlex.quote`, over a server-built path whose filename is the sanitised `out_filename`.

## Auditor Observations (informational, not open threats)

- **D-19 reach (by design, recorded in 303-REVIEW Fix status):** the refused-file delete covers `no_verdict`, `residual_tokens` and `integrity`. It does NOT cover `sandbox_error`, an exception raised inside `_ship_and_run`. If `copy_from_runtime` raised after the driver wrote a residual-tainted file, that file would stay in `/sandbox/output` until a later `execute_code` harvest. Reaching this needs a sandbox infrastructure failure mid-run, so it is low severity and below `block_on: high`. If a delete-on-error is ever wanted, the re-open is a best-effort `_discard_refused_output()` in the `except` arm.
- **D-18 residual (accepted in review):** a cited value that contains a literal `{{ x }}` now survives into the document, so the residual scan refuses the file. This fails closed (the file is not delivered) rather than open.
- **D-20 / WR-01 (accepted, known limit):** comparisons and filters on a bare cell act on the dict. This is a correctness limit, not a security one, and it is recorded in CONTEXT Deferred.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-06 | 9 | 9 | 0 | gsd-security-auditor (post-review code, HEAD 8049e09bd). Suites run: `test_303_bare_tokens`, `test_303_driver_service_parity`, `test_190_ssti_fence`, `test_template_render`, **124 passed, 0 failed**. Golden compare re-run: ALL IDENTICAL. Regex-injection and ReDoS probes run on the service copy. |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-06
