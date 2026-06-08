# Unknown (b) — Does KB-grounded docxtpl fill produce a CLEAN, re-openable `.docx`?

**Spike:** Phase 097 Plan 03 (Wave 2) — THROWAWAY · **Generated:** 2026-06-08T20:17:17.319473+00:00
**Headline artifact (SC#1):** `out/risk-register-filled.docx` — real KB -> real cited field-map -> real file.
**Provider / model that filled it:** anthropic native forced tool-use · `claude-opus-4-8` (stop_reason=tool_use).
**Render shape:** `DocxTemplate.render(jinja_env=SandboxedEnvironment(autoescape=True))` — SSTI containment (TMPL-03 / T-097-08) + XML-safe `&<>`. Render ran LOCAL (backend venv) for the fast loop; production render is the sealed Docker sandbox (Phase 101).

## Verdict: YES — docxtpl produces a clean, re-openable .docx

KB-grounded docxtpl fill produced an openable risk-register artifact from real KB content; the {%tr %} table grew correctly at 1/5/20 rows; autoescape contained the `&<>` probe; and the mandatory re-open gate passed with no residual markup. **GO** on the docxtpl path for trusted library templates (the Phase 101 production target).

---

## 1. Did the real fill produce an openable file?

The real end-to-end run retrieved **5 chunk(s)** under the bound folder scope (avg similarity 0.484), forced one cited field-map emission (6 rows, 100.0% citation coverage), built the docxtpl context, and rendered `risk-register-filled.docx`.

- python-docx re-open gate (Pitfall 3): **PASSED — file opens**
- tables / total rows in the produced file: **1 table(s), 7 rows** (header + 6 body rows)
- residual `{{`/`{%` markup scan (Pitfall 1): **clean — no leftover tags**

> **Score column note (honest):** the real KB states probability/impact as WORDS (High/Medium/Low), which do not parse as ints, so the deterministic `score = P x I` compute leaves the real doc's Score column blank. That is expected behaviour, not corruption — the **synthetic** `-1/-5/-20.docx` files use numeric P/I and DO show P x I in the Score column.

## 2. Did the `{%tr %}` table grow correctly at 1 / 5 / 20 rows? (Pitfall 5 — the load-bearing surprise)

| Synthetic rows (N) | Expected table rows | Actual table rows | Result |
|--------------------|---------------------|-------------------|--------|
| 1 | header + 1 = 2 | 2 | PASS |
| 5 | header + 5 = 6 | 6 | PASS |
| 20 | header + 20 = 21 | 21 | PASS |

**Row growth: ALL PASS — docxtpl repeats the body row exactly once per risk.** This is the single most likely docx-path surprise, and `{%tr %}` handled it cleanly where python-docx / python-pptx cannot grow a table at all.

## 3. Did autoescape contain `& < >`? (Pitfall 2)

The 1-row variant seeded the value **`Acme & <Corp> risk`** (plus `vendor <contract> & SLA breach > threshold`). With `autoescape=True`, docxtpl escaped `&`/`<`/`>` to `&amp;`/`&lt;`/`&gt;` in the OOXML.

- `out/risk-register-filled-1.docx` re-opened via python-docx: **YES**
- the literal `Acme & <Corp> risk` text survived in a cell: **YES — shows as literal text, not broken markup**
- Pitfall 2 verdict: **clean — autoescape contained the XML-hostile chars**

## 4. SSTI containment (TMPL-03 / T-097-08)

`jinja2.sandbox.SandboxedEnvironment` is wired into every render (real + synthetic), proving the containment mechanism Phase 101's untrusted-upload path inherits — even though the spike template is trusted. The maintained sandbox env blocks attribute/builtin access; production additionally renders inside the sealed, network-less Docker sandbox.

## 5. Any corruption observed, and where?

No corruption observed across the real fill, the 1/5/20-row growth renders, or the &<> probe — every produced file re-opened cleanly with the expected structure.

The six named failure modes are logged in `out/corruption.log` (the Phase 101 UAT seed): Pitfall 1 (run-split) clean·N/A for docxtpl, Pitfall 2 (&<>) clean, Pitfall 3 (won't-open) clean, Pitfall 4 (tag boundary) clean, Pitfall 5 (variable rows) clean, Pitfall 6 (uncited rows) clean; plus Pitfall 7 (freshness, observe-only: single-version corpus) and pptx/xlsx not-exercised seed rows for Phase 101.

## 6. Note for Task 3 (operator real-editor open)

python-docx re-open proves the file PARSES; it does not prove Word/LibreOffice renders it without a repair banner. Task 3 is the operator opening `out/risk-register-filled.docx` in a real editor to confirm: no repair banner, the risk table grew one row per risk, scalar tags filled, and (on the synthetic `-1/-5/-20.docx`) the Score column shows P x I and the `&<>` probe shows as literal text. Their result is appended back to this file + corruption.log.
