"""The 6-step end-to-end spike orchestrator + row-growth + &<> probe + Pitfall log.

Phase 097 Wave 2 (SEED-051) — THROWAWAY spike, Plan 097-03 Task 2. This is the
headline run that answers unknown (b): does KB-grounded docxtpl fill produce a CLEAN,
re-openable `.docx`?

It composes the shipped pieces (NEVER re-implements them — the red line):
  1. PARSE     — DocxTemplate(template).get_undeclared_template_variables()  (coverage oracle)
  2. RETRIEVE  — app.services.retrieval_service.search_documents(folder_ids=...) (bound scope)
  3. FIELD-MAP — field_map.emit_field_map() via derive_fields.emit_with_fallback (REAL Anthropic call)
  4. CHECK     — derive_fields.check_coverage (deterministic citation/coverage stats)
  5. RENDER    — render_docx.render() with SandboxedEnvironment(autoescape=True)
  6. INTEGRITY — render_docx.assert_integrity() re-opens the file (the corruption guard)

It REUSES Plan 02's derive_fields (parse + retrieve + check + model fallback) and
field_map.emit_field_map rather than re-implementing them. On top of the real run it
adds the de-risking probes:
  - ROW GROWTH (Pitfall 5): synthetic 1/5/20-row field-maps -> assert table rows == header + N.
  - &<> CORRUPTION PROBE (Pitfall 2): the 1-row variant carries an `Acme & <Corp>`-laden
    value -> assert the file still re-opens and the literal text survives.
  - RESIDUAL-TAG (Pitfall 1), SYNTAX-BOUNDARY (Pitfall 4), UNCITED ROWS (Pitfall 6),
    FRESHNESS (Pitfall 7) — each logged clean / corrupt / not-exercised / observed.

Writes out/risk-register-filled.docx (+ -1/-5/-20 variants), out/corruption.log (the
Phase 101 UAT seed), out/unknown-b.md (the written answer), and
out/risk-register-filled.fieldmap.json (the live field-map the headline doc rendered
from — keeps Plan 02's field-map.json intact as separate evidence).

Run from the repo root:
    backend/venv/Scripts/python.exe scripts/spike-097/run_spike.py \
        --folder <id> --template scripts/spike-097/templates/risk-register.docx
"""

from __future__ import annotations

import argparse
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

from docx import Document
from docxtpl import DocxTemplate

# derive_fields' module-level bootstrap sets sys.path (spike dir + backend/) and loads
# backend/.env, then imports app.services READ-ONLY. Importing it here reuses all of
# that (parse + retrieve + check + model fallback) without re-implementing it.
import derive_fields as df  # noqa: E402
import render_docx as rd  # noqa: E402

SPIKE_DIR = Path(__file__).resolve().parent
OUT_DIR = SPIKE_DIR / "out"
FILLED_PATH = OUT_DIR / "risk-register-filled.docx"
LIVE_FM_PATH = OUT_DIR / "risk-register-filled.fieldmap.json"
FIELD_MAP_JSON = OUT_DIR / "field-map.json"      # Plan 02 evidence (read-only here)
UNKNOWN_B_PATH = OUT_DIR / "unknown-b.md"
GROWTH_NS = (1, 5, 20)
AMP_PROBE = "Acme & <Corp> risk"                 # the deliberate & < > corruption probe value


# ---------------------------------------------------------------------------
# Step 1-4 — the REAL end-to-end (reuses derive_fields)
# ---------------------------------------------------------------------------
def real_field_map(cfg: dict, template_path: Path, models: list[str]) -> dict:
    """Run steps 1-4 against the bound KB folder and return the real field-map + stats.

    Mirrors derive_fields.main() steps 1-4 but RETURNS the field-map (main only returns
    an int exit code). Makes one REAL forced-tool Anthropic emission — the headline
    SC#1 artifact is grounded in live KB content, not a fixture."""
    placeholder_keys = sorted(DocxTemplate(str(template_path)).get_undeclared_template_variables())
    supabase = df.get_supabase()
    folder_ids = cfg["subtree_folder_ids"]                       # BOUND server-side scope (Pattern 2)
    chunks, avg_sim = asyncio.run(
        df.search_documents(
            query=df.RETRIEVAL_QUERY,
            user_id=cfg["user_id"],
            supabase=supabase,
            folder_ids=folder_ids,
        )
    )
    if not chunks:
        raise SystemExit(
            "[error] retrieval returned ZERO chunks under the bound scope — cannot ground the "
            "headline fill. Confirm Plan 097-01 ingested the Project Meridian corpus."
        )
    for i, ch in enumerate(chunks):
        ch["spotlight_id"] = f"chunk-{i + 1}"
    retrieved_ids = {ch["spotlight_id"] for ch in chunks}

    field_map, meta, _ = df.emit_with_fallback(chunks, placeholder_keys, models)
    fm_dict = field_map.model_dump()
    stats = df.check_coverage(fm_dict, retrieved_ids, placeholder_keys)
    return {
        "fm_dict": fm_dict,
        "meta": meta,
        "stats": stats,
        "placeholder_keys": placeholder_keys,
        "avg_similarity": round(avg_sim, 4),
        "chunk_count": len(chunks),
    }


# ---------------------------------------------------------------------------
# Synthetic field-maps — the row-growth (Pitfall 5) + &<> probe (Pitfall 2) fixtures
# ---------------------------------------------------------------------------
def _cited(value, src: str = "synthetic-1"):
    """A Cited-shaped dict (value None => null source, matching the model contract)."""
    return {
        "value": value,
        "source_chunk_id": (src if value is not None else None),
        "source_doc": "synthetic",
        "source_page": None,
    }


def _synth_row(idx: int, p: int, i: int, *, risk_id: str | None = None, cause: str | None = None) -> dict:
    """One synthetic risk row with NUMERIC probability/impact so score = P x I renders
    (the real KB states these as words, so its score column is blank — see unknown-b.md)."""
    return {
        "risk_id": _cited(risk_id or f"S-{idx:02d}"),
        "cause": _cited(cause or f"Synthetic cause {idx}"),
        "event": _cited(f"Synthetic event {idx}"),
        "effect": _cited(f"Synthetic effect {idx}"),
        "probability": _cited(str(p)),
        "impact": _cited(str(i)),
        "response_strategy": _cited(f"Mitigation strategy {idx}"),
        "owner": _cited(f"Owner {idx}"),
        "status": _cited("open"),
    }


def synth_field_map(n: int, *, amp_probe: bool = False) -> dict:
    """An n-row synthetic field-map. When amp_probe, row 1 carries the `&<>` corruption
    probe so the 1-row growth variant doubles as the Pitfall 2 evidence file."""
    rows = []
    for k in range(n):
        p = (k % 5) + 1
        i = ((k + 2) % 5) + 1
        if amp_probe and k == 0:
            rows.append(_synth_row(
                k + 1, p, i,
                risk_id="S-01 (Acme & <Corp>)",
                cause=f"{AMP_PROBE}: vendor <contract> & SLA breach > threshold",
            ))
        else:
            rows.append(_synth_row(k + 1, p, i))
    return {
        "project_name": _cited("Synthetic Project & <Co>" if amp_probe else "Synthetic Project"),
        "report_date": _cited("Week 9"),
        "rows": rows,
    }


def _all_cell_text(path: Path) -> str:
    doc = Document(str(path))
    return "\n".join(c.text for t in doc.tables for row in t.rows for c in row.cells)


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------
def main() -> int:
    cfg = df.load_config()
    parser = argparse.ArgumentParser(description="Spike 097-03 end-to-end docx fill + pitfall log.")
    parser.add_argument("--folder", default=None, help="Override the bound KB folder id (default: spike-config).")
    parser.add_argument("--template", default=None, help="Override the template path (default: spike-config).")
    parser.add_argument("--model", default=None, help="Override the Claude model id (default: registry fallback chain).")
    args = parser.parse_args()

    if args.folder:
        cfg["subtree_folder_ids"] = [args.folder]
    template_path = Path(args.template) if args.template else (df.REPO_ROOT / cfg["template_path"])
    models = [args.model] if args.model else df.MODEL_CANDIDATES

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # --- STEP 1-6: REAL END-TO-END (SC#1) ---
    print(f"[real] steps 1-4 — bound folder_ids={cfg['subtree_folder_ids']} ...")
    real = real_field_map(cfg, template_path, models)
    if real["meta"].get("stop_reason") == "max_tokens":
        print("[error] live emission TRUNCATED (stop_reason=max_tokens) — raise emit_field_map max_tokens.")
        return 2
    ctx = rd.build_context(real["fm_dict"])
    real_render = rd.render(str(template_path), ctx, str(FILLED_PATH))
    real_integ = rd.assert_integrity(str(FILLED_PATH), expect_min_rows=2)
    real_rows = real_integ["rows"]
    real_clean = real_integ["opened"] and real_integ["residual_clean"] and real_render["rendered"]
    print(f"[real] {real['stats']['row_count']} rows · {real['stats']['citation_coverage_pct']}% citation "
          f"· filled.docx rows={real_rows} opened={real_integ['opened']} residual_clean={real_integ['residual_clean']}")

    # Persist the live field-map the headline doc rendered from (Plan 02's field-map.json untouched).
    LIVE_FM_PATH.write_text(json.dumps({
        "spike": "097-03",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": real["meta"]["model"],
        "stop_reason": real["meta"]["stop_reason"],
        "bound_folder_ids": cfg["subtree_folder_ids"],
        "chunk_count": real["chunk_count"],
        "avg_similarity": real["avg_similarity"],
        "row_count": real["stats"]["row_count"],
        "citation_coverage_pct": real["stats"]["citation_coverage_pct"],
        "uncited_row_count": real["stats"]["uncited_row_count"],
        "invented_citation_count": real["stats"]["invented_citation_count"],
        "null_rate": real["stats"]["null_rate"],
        "project_name": real["fm_dict"]["project_name"],
        "report_date": real["fm_dict"]["report_date"],
        "rows": real["fm_dict"]["rows"],
    }, indent=2, ensure_ascii=False), encoding="utf-8")

    # --- ROW GROWTH (Pitfall 5) + &<> probe (Pitfall 2 in the n=1 file) ---
    growth: dict[int, dict] = {}
    for n in GROWTH_NS:
        out = OUT_DIR / f"risk-register-filled-{n}.docx"
        rr = rd.render(str(template_path), rd.build_context(synth_field_map(n, amp_probe=(n == 1))), str(out))
        ig = rd.assert_integrity(str(out), expect_min_rows=1 + n)
        growth[n] = {
            "rendered": rr["rendered"], "error": rr["error"],
            "rows": ig["rows"], "expect": 1 + n, "ok": ig["rows"] == (1 + n),
            "residual_clean": ig["residual_clean"], "opened": ig["opened"],
        }
        print(f"[grow] n={n}: rows={ig['rows']} expect={1 + n} ok={growth[n]['ok']} residual_clean={ig['residual_clean']}")
    growth_all_ok = all(g["ok"] and g["opened"] and g["residual_clean"] for g in growth.values())

    # --- &<> probe assertion (Pitfall 2) — read back the n=1 file ---
    amp_text = _all_cell_text(OUT_DIR / "risk-register-filled-1.docx")   # raises if corrupt
    amp_present = AMP_PROBE in amp_text
    amp_clean = amp_present and growth[1]["opened"]
    print(f"[amp ] &<> probe literal present in -1.docx: {amp_present} (re-opened clean: {growth[1]['opened']})")

    # --- Pitfall 6 / 7 from Plan 02's field-map.json (read-only) ---
    fmj = json.loads(FIELD_MAP_JSON.read_text(encoding="utf-8"))
    uncited = fmj.get("uncited_row_count", 0)
    invented = fmj.get("invented_citation_count", 0)
    cov_pct = fmj.get("citation_coverage_pct", 0.0)
    multi_version = fmj.get("multi_version_observed", False)
    freshness_note = fmj.get("freshness_note", "not recorded")

    # --- WRITE the corruption log: one row per Pitfall 1-6 (+7 observe + pptx/xlsx seed) ---
    rd.CORRUPTION_LOG.write_text(
        "# Phase 097 Plan 03 — corruption.log (the Phase 101 UAT seed, G-6)\n"
        f"# generated: {datetime.now(timezone.utc).isoformat()}\n"
        "# format: <pitfall> | <status: clean|corrupt|not-exercised|observed> | <where-broke / evidence>\n"
        "# render shape: DocxTemplate.render(jinja_env=SandboxedEnvironment(autoescape=True))\n\n",
        encoding="utf-8",
    )
    rd.log_pitfall(
        "Pitfall 1 | docx run-split silent miss",
        "clean" if real_integ["residual_clean"] else "corrupt",
        ("no residual {{ / {% / placeholder text in risk-register-filled.docx — docxtpl tags are "
         "run-safe by DESIGN (each tag lives in one run/row), so the run-split silent-miss class "
         "does not apply to the docxtpl path; the non-Jinja run-replace path is Phase 101. "
         f"residual_tags={real_integ['residual_tags']}")
        if real_integ["residual_clean"] else
        f"RESIDUAL MARKUP LEFT IN FILE: {real_integ['residual_tags']}",
    )
    rd.log_pitfall(
        "Pitfall 2 | unescaped & < > XML corruption",
        "clean" if amp_clean else "corrupt",
        (f"seeded value '{AMP_PROBE}' (+ vendor <contract> & SLA) into risk-register-filled-1.docx; "
         "autoescape=True escaped & < > to &amp; &lt; &gt; in the OOXML; the file re-opened via "
         "python-docx and the literal text survived intact")
        if amp_clean else
        f"&<> probe FAILED: present={amp_present}, opened={growth[1]['opened']} — autoescape did not contain it",
    )
    rd.log_pitfall(
        "Pitfall 3 | produced file won't open",
        "clean" if real_integ["opened"] else "corrupt",
        (f"the mandatory python-docx re-open gate passed on risk-register-filled.docx "
         f"(tables={real_integ['tables']}, rows={real_rows}); a corrupt file would have raised here "
         "and never been delivered — previews the production output_file_valid gate")
        if real_integ["opened"] else
        "Document(risk-register-filled.docx) RAISED — the file is corrupt / won't open",
    )
    rd.log_pitfall(
        "Pitfall 4 | docxtpl tag spans a structural boundary",
        "clean" if real_render["rendered"] and all(g["rendered"] for g in growth.values()) else "corrupt",
        ("no TemplateSyntaxError on the real fill or the 1/5/20-row renders — each {%tr %} tag sits in "
         "its OWN table row (make_template.py), so for/endfor stay balanced across the structural boundary")
        if real_render["rendered"] else
        f"TemplateSyntaxError on render: {real_render['error']}",
    )
    rd.log_pitfall(
        "Pitfall 5 | variable-length rows (the load-bearing surprise)",
        "clean" if growth_all_ok else "corrupt",
        ("{%tr %} grew the body row exactly: "
         + ", ".join(f"n={n} -> {growth[n]['rows']} rows (header+{n}={growth[n]['expect']})" for n in GROWTH_NS)
         + " — docxtpl's table-row repeat is correct for variable-length registers (python-docx/pptx CANNOT grow tables)")
        if growth_all_ok else
        "ROW GROWTH MISMATCH: " + ", ".join(
            f"n={n} got {growth[n]['rows']} expected {growth[n]['expect']}" for n in GROWTH_NS if not growth[n]["ok"]),
    )
    rd.log_pitfall(
        "Pitfall 6 | hallucinated / uncited rows",
        "clean" if (uncited == 0 and invented == 0) else "corrupt",
        (f"Plan 02 field-map.json: uncited_row_count={uncited}, invented_citation_count={invented}, "
         f"citation_coverage={cov_pct}% — every non-null value is cited to a retrieved <doc> "
         "(the deterministic cite-or-null check previews citations_required)"),
    )
    rd.log_pitfall(
        "Pitfall 7 | stale / multi-version data (observe-only)",
        "observed" if multi_version else "not-exercised",
        freshness_note + " — the freshness gate is Phase 102; the spike only OBSERVES.",
    )
    rd.log_pitfall(
        "Pitfall (pptx) | .pptx variable-row table growth",
        "not-exercised",
        "docx-first — deferred to Phase 101 (python-pptx cannot grow tables: pptx #192). Phase 101 UAT row.",
    )
    rd.log_pitfall(
        "Pitfall (xlsx) | .xlsx cell-write / chart strip",
        "not-exercised",
        "docx-first — deferred to Phase 101 (openpyxl cell-write + chart-preservation). Phase 101 UAT row.",
    )
    print(f"[log ] wrote {rd.CORRUPTION_LOG}")

    # --- WRITE unknown-b.md (the written answer) ---
    UNKNOWN_B_PATH.write_text(_render_unknown_b(
        real=real, real_integ=real_integ, real_clean=real_clean,
        real_render=real_render,
        growth=growth, growth_all_ok=growth_all_ok,
        amp_present=amp_present, amp_clean=amp_clean,
        uncited=uncited, invented=invented, cov_pct=cov_pct,
        multi_version=multi_version, freshness_note=freshness_note,
    ), encoding="utf-8")
    print(f"[ans ] wrote {UNKNOWN_B_PATH}")

    return 0


def _render_unknown_b(*, real, real_integ, real_clean, real_render, growth, growth_all_ok,
                      amp_present, amp_clean, uncited, invented, cov_pct,
                      multi_version, freshness_note) -> str:
    stats = real["stats"]
    meta = real["meta"]
    openable = real_integ["opened"] and real_integ["residual_clean"]
    if openable and growth_all_ok and amp_clean:
        verdict = "YES — docxtpl produces a clean, re-openable .docx"
        verdict_line = (
            "KB-grounded docxtpl fill produced an openable risk-register artifact from real KB content; "
            "the {%tr %} table grew correctly at 1/5/20 rows; autoescape contained the `&<>` probe; and "
            "the mandatory re-open gate passed with no residual markup. **GO** on the docxtpl path for "
            "trusted library templates (the Phase 101 production target)."
        )
    else:
        verdict = "NO / WITH DEFECT — see where-broke below"
        verdict_line = (
            "At least one gate did NOT hold (openability, row growth, or &<> containment). This is a real, "
            "valuable spike finding — recorded honestly, not hidden. See the per-probe table."
        )
    growth_rows = "\n".join(
        f"| {n} | header + {n} = {growth[n]['expect']} | {growth[n]['rows']} | "
        f"{'PASS' if growth[n]['ok'] else 'FAIL'} |"
        for n in GROWTH_NS
    )
    return f"""# Unknown (b) — Does KB-grounded docxtpl fill produce a CLEAN, re-openable `.docx`?

**Spike:** Phase 097 Plan 03 (Wave 2) — THROWAWAY · **Generated:** {datetime.now(timezone.utc).isoformat()}
**Headline artifact (SC#1):** `out/risk-register-filled.docx` — real KB -> real cited field-map -> real file.
**Provider / model that filled it:** anthropic native forced tool-use · `{meta['model']}` (stop_reason={meta['stop_reason']}).
**Render shape:** `DocxTemplate.render(jinja_env=SandboxedEnvironment(autoescape=True))` — SSTI containment (TMPL-03 / T-097-08) + XML-safe `&<>`. Render ran LOCAL (backend venv) for the fast loop; production render is the sealed Docker sandbox (Phase 101).

## Verdict: {verdict}

{verdict_line}

---

## 1. Did the real fill produce an openable file?

The real end-to-end run retrieved **{real['chunk_count']} chunk(s)** under the bound folder scope (avg similarity {real['avg_similarity']}), forced one cited field-map emission ({stats['row_count']} rows, {stats['citation_coverage_pct']}% citation coverage), built the docxtpl context, and rendered `risk-register-filled.docx`.

- python-docx re-open gate (Pitfall 3): **{'PASSED — file opens' if real_integ['opened'] else 'FAILED — file is corrupt'}**
- tables / total rows in the produced file: **{real_integ['tables']} table(s), {real_integ['rows']} rows** (header + {stats['row_count']} body rows)
- residual `{{{{`/`{{%` markup scan (Pitfall 1): **{'clean — no leftover tags' if real_integ['residual_clean'] else 'DIRTY: ' + str(real_integ['residual_tags'])}**

> **Score column note (honest):** the real KB states probability/impact as WORDS (High/Medium/Low), which do not parse as ints, so the deterministic `score = P x I` compute leaves the real doc's Score column blank. That is expected behaviour, not corruption — the **synthetic** `-1/-5/-20.docx` files use numeric P/I and DO show P x I in the Score column.

## 2. Did the `{{%tr %}}` table grow correctly at 1 / 5 / 20 rows? (Pitfall 5 — the load-bearing surprise)

| Synthetic rows (N) | Expected table rows | Actual table rows | Result |
|--------------------|---------------------|-------------------|--------|
{growth_rows}

**Row growth: {'ALL PASS — docxtpl repeats the body row exactly once per risk' if growth_all_ok else 'MISMATCH — see FAIL rows'}.** This is the single most likely docx-path surprise, and `{{%tr %}}` handled it cleanly where python-docx / python-pptx cannot grow a table at all.

## 3. Did autoescape contain `& < >`? (Pitfall 2)

The 1-row variant seeded the value **`{AMP_PROBE}`** (plus `vendor <contract> & SLA breach > threshold`). With `autoescape=True`, docxtpl escaped `&`/`<`/`>` to `&amp;`/`&lt;`/`&gt;` in the OOXML.

- `out/risk-register-filled-1.docx` re-opened via python-docx: **{'YES' if growth[1]['opened'] else 'NO — corrupt'}**
- the literal `{AMP_PROBE}` text survived in a cell: **{'YES — shows as literal text, not broken markup' if amp_present else 'NO'}**
- Pitfall 2 verdict: **{'clean — autoescape contained the XML-hostile chars' if amp_clean else 'CORRUPT'}**

## 4. SSTI containment (TMPL-03 / T-097-08)

`jinja2.sandbox.SandboxedEnvironment` is wired into every render (real + synthetic), proving the containment mechanism Phase 101's untrusted-upload path inherits — even though the spike template is trusted. The maintained sandbox env blocks attribute/builtin access; production additionally renders inside the sealed, network-less Docker sandbox.

## 5. Any corruption observed, and where?

{'No corruption observed across the real fill, the 1/5/20-row growth renders, or the &<> probe — every produced file re-opened cleanly with the expected structure.' if (openable and growth_all_ok and amp_clean) else 'A defect WAS observed — see the FAIL rows above and out/corruption.log for the where-broke note.'}

The six named failure modes are logged in `out/corruption.log` (the Phase 101 UAT seed): Pitfall 1 (run-split) clean·N/A for docxtpl, Pitfall 2 (&<>) {'clean' if amp_clean else 'CORRUPT'}, Pitfall 3 (won't-open) {'clean' if real_integ['opened'] else 'CORRUPT'}, Pitfall 4 (tag boundary) {'clean' if real_render['rendered'] else 'CORRUPT'}, Pitfall 5 (variable rows) {'clean' if growth_all_ok else 'CORRUPT'}, Pitfall 6 (uncited rows) {'clean' if (uncited == 0 and invented == 0) else 'CORRUPT'}; plus Pitfall 7 (freshness, observe-only: {'multi-version present' if multi_version else 'single-version corpus'}) and pptx/xlsx not-exercised seed rows for Phase 101.

## 6. Note for Task 3 (operator real-editor open)

python-docx re-open proves the file PARSES; it does not prove Word/LibreOffice renders it without a repair banner. Task 3 is the operator opening `out/risk-register-filled.docx` in a real editor to confirm: no repair banner, the risk table grew one row per risk, scalar tags filled, and (on the synthetic `-1/-5/-20.docx`) the Score column shows P x I and the `&<>` probe shows as literal text. Their result is appended back to this file + corruption.log.
"""


if __name__ == "__main__":
    raise SystemExit(main())
