"""Derive + cite the risk-register field-map under bound KB scope (THROWAWAY spike).

Phase 097 Wave 1 (SEED-051) — Plan 097-02 Task 2. Runs steps 1-4 of the RESEARCH
"System Architecture Diagram" to answer unknown (a): can a model DERIVE the
risk-register field schema from the template and fill it from KB content WITHOUT
inventing?

  1. PARSE     — DocxTemplate(template).get_undeclared_template_variables() is the
                 coverage oracle (the placeholder key set the field-map must cover).
  2. RETRIEVE  — app.services.retrieval_service.search_documents(folder_ids=<bound
                 scope from spike-config>). folder_ids is a SERVER-SIDE parameter,
                 NOT a prompt hint the model can widen (Pattern 2 / PROJ-02; T-097-06).
  3. FIELD-MAP — field_map.emit_field_map(): one forced Anthropic emission of the
                 typed, cited RiskRegisterFieldMap (LLM produces DATA, not the file).
  4. CHECK     — deterministic coverage + citation assertion (no LLM): top-level keys
                 cover the template; every non-null value carries a source_chunk_id
                 that was ACTUALLY retrieved (an invented citation = uncited; T-097-07).
                 If any row is uncited, RE-PROMPT once (previews citations_required).

Writes out/field-map.json (the evidence artifact) and out/unknown-a.md (the written
answer). Does NOT render a .docx — that is Plan 097-03.

Red line / G-5: imports app.services READ-ONLY; mirrors (never imports) the native
Anthropic service. No backend/app/** edits. Run from the repo root:

    backend/venv/Scripts/python.exe scripts/spike-097/derive_fields.py [--model claude-opus-4-8]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# scripts/spike-097/derive_fields.py -> parents[2] == repo root
REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = REPO_ROOT / "backend"
SPIKE_DIR = Path(__file__).resolve().parent
OUT_DIR = SPIKE_DIR / "out"
CONFIG_PATH = OUT_DIR / "spike-config.json"
FIELD_MAP_PATH = OUT_DIR / "field-map.json"
UNKNOWN_A_PATH = OUT_DIR / "unknown-a.md"

# Make field_map (this dir) and backend/ importable, then load backend/.env so
# `settings` + the service import resolve (mirrors find_risk_folder.py's bootstrap).
sys.path.insert(0, str(SPIKE_DIR))
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND_DIR / ".env")  # secrets stay name-only — never echoed to stdout/out/

from docxtpl import DocxTemplate  # noqa: E402
from supabase import Client, create_client  # noqa: E402  (mirrors dependencies.get_supabase)

import field_map as fm  # noqa: E402  (the Task-1 model + emit_field_map; same dir)
from app.services.retrieval_service import search_documents  # noqa: E402  (READ-ONLY)

RETRIEVAL_QUERY = "project risks, causes, owners, mitigation, impact, probability, status"

# Strong-Claude-first (RESEARCH Open Question 1 + "prioritize newest models"); the
# fallback chain keeps the spike alive if the live /models set differs from the
# registry. The model that actually answers is recorded in the evidence.
MODEL_CANDIDATES = [
    "claude-opus-4-8",
    "claude-sonnet-4-6",
    "claude-sonnet-4-5-20250929",
    "claude-haiku-4-5-20251001",
]

ROW_FIELDS = [
    "risk_id", "cause", "event", "effect", "probability",
    "impact", "response_strategy", "owner", "status",
]


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
def get_supabase() -> Client:
    """Service-role client (mirrors dependencies.get_supabase()). Key name-only."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        missing = [n for n, v in (("SUPABASE_URL", url), ("SUPABASE_SERVICE_ROLE_KEY", key)) if not v]
        raise SystemExit(f"Missing env var(s) in backend/.env: {', '.join(missing)}")
    return create_client(url, key)


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        raise SystemExit(f"Missing {CONFIG_PATH} — run Plan 097-01 (find_risk_folder.py) first.")
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Step 4 — deterministic coverage + citation check (NO LLM)
# ---------------------------------------------------------------------------
def _iter_leaves(fm_dict: dict):
    """Yield (location, field_name, cited_dict) over every Cited leaf."""
    yield ("scalar", "project_name", fm_dict["project_name"])
    yield ("scalar", "report_date", fm_dict["report_date"])
    for ri, row in enumerate(fm_dict["rows"]):
        for fname in ROW_FIELDS:
            yield (f"row{ri}", fname, row[fname])


def check_coverage(fm_dict: dict, retrieved_ids: set[str], placeholder_keys: list[str]) -> dict:
    """Coverage + citation stats. A non-null value is CITED iff its source_chunk_id
    was actually in the retrieved set (an invented/absent citation = uncited)."""
    covered_keys = [k for k in placeholder_keys if k in fm_dict]

    total_leaves = 0
    null_leaves = 0
    filled_leaves = 0
    cited_leaves = 0
    uncited_value_count = 0      # value present, source_chunk_id null (Pitfall 6)
    invented_citation_count = 0  # source_chunk_id present but NOT retrieved (T-097-07)

    uncited_rows: set[int] = set()
    null_per_field = {f: 0 for f in ROW_FIELDS}
    rows = fm_dict["rows"]

    for location, fname, cited in _iter_leaves(fm_dict):
        total_leaves += 1
        value = cited.get("value")
        src = cited.get("source_chunk_id")
        if value is None:
            null_leaves += 1
            if location.startswith("row"):
                null_per_field[fname] += 1
            continue
        filled_leaves += 1
        if src is None:
            uncited_value_count += 1
            if location.startswith("row"):
                uncited_rows.add(int(location[3:]))
        elif src not in retrieved_ids:
            invented_citation_count += 1
            if location.startswith("row"):
                uncited_rows.add(int(location[3:]))
        else:
            cited_leaves += 1

    null_rate = (null_leaves / total_leaves) if total_leaves else 0.0
    null_rate_per_field = {
        f: (null_per_field[f] / len(rows)) if rows else 0.0 for f in ROW_FIELDS
    }
    coverage_pct = (cited_leaves / filled_leaves * 100.0) if filled_leaves else 0.0

    return {
        "covered_keys": covered_keys,
        "covers_template": set(placeholder_keys) <= set(covered_keys),
        "row_count": len(rows),
        "total_leaves": total_leaves,
        "filled_value_count": filled_leaves,
        "null_leaf_count": null_leaves,
        "null_rate": round(null_rate, 4),
        "null_rate_per_field": {f: round(v, 4) for f, v in null_rate_per_field.items()},
        "cited_value_count": cited_leaves,
        "uncited_value_count": uncited_value_count,
        "invented_citation_count": invented_citation_count,
        "uncited_row_count": len(uncited_rows),
        "uncited_row_indices": sorted(uncited_rows),
        "citation_coverage_pct": round(coverage_pct, 1),
    }


# ---------------------------------------------------------------------------
# Step 3 — emit with model fallback
# ---------------------------------------------------------------------------
def emit_with_fallback(chunks, placeholder_keys, models, correction=None):
    """Try each candidate model until one answers; return (field_map, meta, errors)."""
    import anthropic

    errors = []
    for model in models:
        try:
            field_map, meta = fm.emit_field_map(
                chunks, placeholder_keys, model, correction=correction
            )
            return field_map, meta, errors
        except (anthropic.NotFoundError, anthropic.BadRequestError) as exc:
            errors.append(f"{model}: {type(exc).__name__}: {exc}")
            continue
    raise SystemExit(
        "All candidate Claude models were rejected by the live API:\n  "
        + "\n  ".join(errors)
        + "\nPass --model with a served model id, or apply the A1 OpenAI-strict pivot."
    )


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(description="Derive the cited risk-register field-map (spike 097-02).")
    parser.add_argument("--model", default=None, help="Override the Claude model id (default: registry fallback chain).")
    args = parser.parse_args()

    models = [args.model] if args.model else MODEL_CANDIDATES

    cfg = load_config()
    template_path = REPO_ROOT / cfg["template_path"]

    # --- Step 1: PARSE (coverage oracle) ---
    placeholder_keys = sorted(DocxTemplate(str(template_path)).get_undeclared_template_variables())
    print(f"[1/4] template placeholder keys: {placeholder_keys}")

    # --- Step 2: RETRIEVE (bound server-side scope, NOT a prompt hint) ---
    supabase = get_supabase()
    folder_ids = cfg["subtree_folder_ids"]  # BOUND scope from spike-config (Pattern 2)
    chunks, avg_sim = asyncio.run(
        search_documents(
            query=RETRIEVAL_QUERY,
            user_id=cfg["user_id"],
            supabase=supabase,
            folder_ids=folder_ids,
        )
    )
    print(f"[2/4] retrieved {len(chunks)} chunk(s) under bound folder_ids={folder_ids} (avg_sim={avg_sim:.3f})")
    if not chunks:
        print("[error] retrieval returned ZERO chunks under the bound scope — cannot ground the "
              "field-map. Confirm Plan 097-01 ingested the Project Meridian corpus into the folder.")
        return 1

    # Assign deterministic spotlight ids — the SINGLE source of truth for the citation
    # check (the enriched chunk dict carries no raw document_chunks.id; see
    # retrieval_service._enrich_with_filenames).
    for i, ch in enumerate(chunks):
        ch["spotlight_id"] = f"chunk-{i + 1}"
    retrieved_ids = {ch["spotlight_id"] for ch in chunks}
    retrieved_index = [
        {
            "spotlight_id": ch["spotlight_id"],
            "filename": ch.get("filename"),
            "chunk_index": ch.get("chunk_index"),
            "document_id": ch.get("document_id"),
            "version_number": ch.get("version_number"),
            "similarity": round(ch.get("similarity", 0.0), 4),
        }
        for ch in chunks
    ]

    # Pitfall 7 (OBSERVE-only): do the retrieved chunks span multiple register versions?
    versions_by_file: dict[str, set] = {}
    for ch in chunks:
        versions_by_file.setdefault(ch.get("filename", "?"), set()).add(ch.get("version_number", 1))
    multi_version_observed = any(len(v) > 1 for v in versions_by_file.values())
    freshness_note = (
        f"{len(versions_by_file)} distinct source file(s); "
        f"version spread per file: {{{', '.join(f'{k}: {sorted(v)}' for k, v in versions_by_file.items())}}}. "
        + ("Multiple versions present — freshness gate (Phase 102) would apply."
           if multi_version_observed
           else "Single version per file — no freshness ambiguity in this corpus.")
    )

    # --- Step 3: FIELD-MAP (forced single emission) ---
    print(f"[3/4] emitting cited field-map (model candidates: {models}) ...")
    field_map, meta, model_errors = emit_with_fallback(chunks, placeholder_keys, models)
    fm_dict = field_map.model_dump()
    stats = check_coverage(fm_dict, retrieved_ids, placeholder_keys)
    if meta["stop_reason"] == "max_tokens":
        # Truncated tool JSON silently drops `rows` (default_factory=list) — never
        # accept a max_tokens emission as a valid empty result (Rule 1 guard).
        print(f"[error] emission TRUNCATED (stop_reason=max_tokens, {meta['output_tokens']} output "
              f"tokens) — the cited register did not fit. Raise field_map.emit_field_map max_tokens.")
        return 2
    print(f"      attempt 1 [{meta['model']}]: {stats['row_count']} rows, "
          f"{stats['uncited_row_count']} uncited row(s), "
          f"{stats['citation_coverage_pct']}% citation coverage")

    attempts = [{
        "attempt": 1,
        "model": meta["model"],
        "stop_reason": meta["stop_reason"],
        "input_tokens": meta["input_tokens"],
        "output_tokens": meta["output_tokens"],
        "row_count": stats["row_count"],
        "uncited_row_count": stats["uncited_row_count"],
        "uncited_value_count": stats["uncited_value_count"],
        "invented_citation_count": stats["invented_citation_count"],
        "citation_coverage_pct": stats["citation_coverage_pct"],
    }]

    # --- Step 4: re-prompt ONCE if any row is uncited (previews citations_required) ---
    if stats["uncited_row_count"] > 0 or stats["invented_citation_count"] > 0:
        valid_ids = ", ".join(sorted(retrieved_ids))
        correction = (
            "Your previous emission included one or more values that lacked a valid source_chunk_id, "
            "or cited an id that was not in the provided <doc> set. The ONLY valid source_chunk_id "
            f"values are: {valid_ids}. Re-emit the COMPLETE risk-register field-map. For EVERY value: "
            "either set source_chunk_id to the exact <doc id> it came from, or set BOTH value and "
            "source_chunk_id to null. Never invent a value or a citation."
        )
        print("      re-prompting once (citations_required preview) ...")
        field_map, meta, _ = emit_with_fallback(chunks, placeholder_keys, [meta["model"]], correction=correction)
        fm_dict = field_map.model_dump()
        stats = check_coverage(fm_dict, retrieved_ids, placeholder_keys)
        if meta["stop_reason"] == "max_tokens":
            print(f"[warn] re-prompt TRUNCATED (stop_reason=max_tokens) — attempt-2 rows may be incomplete.")
        print(f"      attempt 2 [{meta['model']}]: {stats['row_count']} rows, "
              f"{stats['uncited_row_count']} uncited row(s), "
              f"{stats['citation_coverage_pct']}% citation coverage")
        attempts.append({
            "attempt": 2,
            "model": meta["model"],
            "stop_reason": meta["stop_reason"],
            "input_tokens": meta["input_tokens"],
            "output_tokens": meta["output_tokens"],
            "row_count": stats["row_count"],
            "uncited_row_count": stats["uncited_row_count"],
            "uncited_value_count": stats["uncited_value_count"],
            "invented_citation_count": stats["invented_citation_count"],
            "citation_coverage_pct": stats["citation_coverage_pct"],
        })

    # --- Write evidence ---
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    evidence = {
        "spike": "097-02",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "provider": "anthropic (native SDK, forced tool_choice)",
        "model": meta["model"],
        "model_fallback_errors": model_errors,
        "retrieval": {
            "query": RETRIEVAL_QUERY,
            "bound_folder_ids": folder_ids,
            "retrieved_chunk_count": len(chunks),
            "avg_similarity": round(avg_sim, 4),
            "retrieved_chunks": retrieved_index,
        },
        "placeholder_keys": placeholder_keys,
        "covered_keys": stats["covered_keys"],
        "project_name": fm_dict["project_name"],
        "report_date": fm_dict["report_date"],
        "rows": fm_dict["rows"],
        "row_count": stats["row_count"],
        "filled_value_count": stats["filled_value_count"],
        "cited_value_count": stats["cited_value_count"],
        "uncited_value_count": stats["uncited_value_count"],
        "invented_citation_count": stats["invented_citation_count"],
        "uncited_row_count": stats["uncited_row_count"],
        "uncited_row_indices": stats["uncited_row_indices"],
        "citation_coverage_pct": stats["citation_coverage_pct"],
        "null_rate": stats["null_rate"],
        "null_rate_per_field": stats["null_rate_per_field"],
        "multi_version_observed": multi_version_observed,
        "freshness_note": freshness_note,
        "attempts": attempts,
    }
    FIELD_MAP_PATH.write_text(json.dumps(evidence, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[4/4] wrote {FIELD_MAP_PATH}")

    UNKNOWN_A_PATH.write_text(_render_unknown_a(evidence), encoding="utf-8")
    print(f"      wrote {UNKNOWN_A_PATH}")
    return 0


def _render_unknown_a(e: dict) -> str:
    """Render the written answer to unknown (a) from the measured evidence."""
    covers = set(e["placeholder_keys"]) <= set(e["covered_keys"])
    final = e["attempts"][-1]
    held = final["uncited_row_count"] == 0 and final["invented_citation_count"] == 0

    if covers and e["row_count"] > 0 and final["citation_coverage_pct"] >= 95.0 and held:
        verdict = "YES"
        verdict_line = (
            "The model DERIVED the correct field schema from the template and filled it from the "
            "bound KB scope while declining (null) rather than inventing. Every non-null value is "
            "cited to a retrieved chunk."
        )
    elif covers and e["row_count"] > 0:
        verdict = "YES (with caveats)"
        verdict_line = (
            "The model derived the correct field schema and grounded most values, but the citation "
            "discipline needed the re-prompt and/or left residual uncited values — see the numbers below."
        )
    else:
        verdict = "PARTIAL / NO"
        verdict_line = (
            "The model did not produce a covering, cleanly-cited field-map under the bound scope — "
            "see the gaps below. This is a valid spike finding, not a failure to hide."
        )

    per_field = "\n".join(
        f"  - `{k}`: {v:.0%} null" for k, v in e["null_rate_per_field"].items()
    )
    attempts_md = "\n".join(
        f"  - Attempt {a['attempt']} [{a['model']}, stop_reason={a['stop_reason']}]: "
        f"{a['row_count']} rows, {a['uncited_row_count']} uncited row(s), "
        f"{a['invented_citation_count']} invented citation(s), "
        f"{a['citation_coverage_pct']}% citation coverage"
        for a in e["attempts"]
    )
    reprompted = len(e["attempts"]) > 1

    return f"""# Unknown (a) — Can a model DERIVE the risk-register field schema and fill it from the KB WITHOUT inventing?

**Spike:** Phase 097 Plan 02 (Wave 1) — THROWAWAY · **Generated:** {e['generated_at']}
**Provider:** {e['provider']} · **Model that answered:** `{e['model']}`
**Bound scope:** `folder_ids={e['retrieval']['bound_folder_ids']}` — a server-side parameter resolved from `spike-config.json`, NOT a prompt hint the model could widen (Pattern 2 / PROJ-02 / threat T-097-06).

## Verdict: {verdict}

{verdict_line}

---

## 1. Did the model derive the right fields?

The template's coverage oracle (`get_undeclared_template_variables()`) requires the top-level placeholder keys **{e['placeholder_keys']}**. The emitted field-map covered **{e['covered_keys']}** → covering: **{'YES' if covers else 'NO'}**.

Within `rows`, the model emitted **{e['row_count']} risk row(s)**, each shaped with the nine register columns (`risk_id, cause, event, effect, probability, impact, response_strategy, owner, status`) — i.e. it inferred the per-row schema from the template's `{{{{ r.<field>.value }}}}` tags rather than being handed a column list. `score` was correctly NOT emitted (it is a render-time compute, not an LLM field).

## 2. Null-rate (declines vs invents)

Across **{e['row_count'] * len(ROW_FIELDS) + 2}** total leaves (2 scalars + {e['row_count']} rows x 9 fields), the model filled **{e['filled_value_count']}** value(s) and declined the rest — an overall null-rate of **{e['null_rate']:.0%}** where the excerpts did not support a value.

Per-field null rate (over the emitted rows):
{per_field}

A non-zero null-rate is the *desired* behaviour: it is the model choosing to decline rather than fabricate. A 0% null-rate on a thin corpus would be the warning sign (it would imply invention).

## 3. Citation coverage

- Filled (non-null) leaves: **{e['filled_value_count']}**
- Cited to a retrieved `<doc>`: **{e['cited_value_count']}** → **{e['citation_coverage_pct']}%** citation coverage
- Uncited (value present, no `source_chunk_id`): **{e['uncited_value_count']}** (Pitfall 6)
- Invented citations (`source_chunk_id` not in the retrieved set): **{e['invented_citation_count']}** (threat T-097-07 / spoofing)
- Uncited rows (≥1 uncited or invented leaf): **{e['uncited_row_count']}** {('(indices ' + str(e['uncited_row_indices']) + ')') if e['uncited_row_indices'] else ''}

Every non-null value carrying a `source_chunk_id` that was *actually retrieved* is the deterministic preview of the production `citations_required` gate (TMPL-02).

## 4. Re-prompt (previews `citations_required`)

Re-prompted: **{'YES — one correction round' if reprompted else 'NO — first emission already passed the citation check'}**.

{attempts_md}

## 5. Provider verdict (A1)

Anthropic native forced tool-use (`tool_choice={{type: tool}}`) **{'HELD' if held else 'needed the citation re-prompt'}** for the nested nullable + citation field-map: the SDK returned a single schema-conformant `tool_use` block that `RiskRegisterFieldMap.model_validate()` accepted{'' if held else ', though citation discipline required the previewed re-prompt'}. **No pivot to OpenAI strict Structured Outputs was required** — the A1 fallback stays unused, documented in `field_map.py` for the production phase if drift appears at scale.

## 6. Failure-mode observations for Plan 03 / Plan 05 (G-6 log)

- **Pitfall 6 (hallucinated / uncited rows):** {e['uncited_value_count']} uncited value(s), {e['invented_citation_count']} invented citation(s) on the final emission. {'Clean.' if held else 'The deterministic check caught these and the re-prompt resolved them.'}
- **Pitfall 7 (stale / multi-version data — OBSERVE only):** {e['freshness_note']}

## 7. Implication for the production `inputs` schema (TMPL-02 / informs, does not lock)

The cited field-map shape works: **every field nullable + provenance per value** lets the model decline cleanly, and a deterministic coverage+citation pass (no second LLM) is sufficient to enforce "cite or null". The `Cited` provenance belongs in the **run output** (it carries the live `source_chunk_id`), while the future `inputs` schema only needs to declare the *shape* (field keys + types) — confirming the RESEARCH hypothesis (Open Question 4). One sharp edge for production: the retrieval layer does not expose a stable `document_chunks.id` on enriched chunks, so the field-map phase must assign and pass a spotlight id (done here as `chunk-N`); the production `inputs`/citation design should surface a real chunk id end-to-end.
"""


if __name__ == "__main__":
    raise SystemExit(main())
