"""
scoreboard_smoke.py — Phase 104 (PM-01 / SC#10) cross-provider kickoff harness.

The automatable backbone of the SC#10 4-axis cross-provider scoreboard. For each
pinned registry model ID, this harness kicks off the SEEDED "Weekly Status Report"
template-fill workflow def (provisioned by scripts/seed-pm-pack.py, Plan 02) through
the SHIPPED single-textarea kickoff path — POST /threads -> POST /threads/{id}/
messages with {content: <kickoff_prompt>, workflow_definition_id, provider, model}
(threads.py:1155,1326-1359; message.py:8-18) — polls the workflow run to terminal,
and records the per-model outcome (produced .docx, citation gate, integrity gate,
truncation, honest-failure vs silent narration) to a timestamped JSON under
scripts/pm-pack/out/.

This harness is a PURE CLIENT. It imports NO backend write paths — only the
five-piece plumbing kit from conc_probe.py (load_env -> assert_localhost_only FIRST
-> report_env_presence -> get_bearer_token -> connect_db) plus its create_thread /
kickoff_workflow / DB read helpers (096-PATTERNS.md Assignment 6: copy the kit, do
not hand-roll, do not touch backend code). ZERO engine code, ZERO new route.

Why it is OPT-IN gated (T-104-03-02): a full cross-provider sweep fires a REAL
golden-style kickoff (retrieval + a forced/coerced emission shot) PER pinned model
ID — that is real provider spend. The harness REFUSES to fire any provider call
unless `--run` is passed (or PM_SCOREBOARD_RUN=1 is set). Without the gate it only
PREVIEWS the model matrix it WOULD drive and exits 0 (the safe default the executor
verifies via ast.parse — it never auto-fires the sweep).

The EXACT registry model IDs matter (D-104-6 / S-7, config.py:206-313): a wrong-case
ID (minimax-m3 vs MiniMax-M3, GLM-4.6 vs glm-4.6) silently MISSES the capability
registry and degrades to COERCE — the field-map is narrated as text, not forced.
The pinned defaults below are case-correct and tier-tagged.

Usage
-----
  # Operator starts the backend uvicorn in a visible terminal first, then:
  #   PREVIEW (safe — no provider spend; lists the matrix and exits):
  backend/venv/Scripts/python.exe scripts/pm-pack/scoreboard_smoke.py
  #   LIVE sweep (opt-in — burns provider calls):
  backend/venv/Scripts/python.exe scripts/pm-pack/scoreboard_smoke.py --run
  #   one tier representative only:
  backend/venv/Scripts/python.exe scripts/pm-pack/scoreboard_smoke.py --run --models gpt-5.4
  #   the long-deliverable truncation row:
  backend/venv/Scripts/python.exe scripts/pm-pack/scoreboard_smoke.py --run --models deepseek-v4-pro --long

Greppable markers: SCOREBOARD_ROW / SCOREBOARD_RESULT.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Reuse the five-piece plumbing kit + create_thread/kickoff_workflow/_fetch helpers
# from conc_probe.py by import — the same way longmsg_workflow_smoke.py reuses it
# (096-PATTERNS.md Assignment 6). NO backend import; NO hand-rolled auth/DB plumbing.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import conc_probe as kit  # noqa: E402 — localhost-gated five-piece kit


# ─────────────────────────────────────────────────────────────────────────────
# Pinned scoreboard model IDs — EXACT registry IDs (config.py:206-313; D-104-6).
# A WRONG-CASE id silently degrades to COERCE (forced_emit.py:246 default-safe
# miss) — these are case-correct and tier-tagged. (provider, model_id, tier).
# ─────────────────────────────────────────────────────────────────────────────

SCOREBOARD_MODELS: list[tuple[str, str, str]] = [
    # TIER-FORCE + strict
    ("openai",   "gpt-4o",           "FORCE+strict"),   # 104-03: served OpenAI forcing model (gpt-5.4 not in registry)
    ("deepseek", "deepseek-v4-pro",  "FORCE+strict"),
    # TIER-FORCE (no strict)
    ("anthropic", "claude-opus-4-8", "FORCE"),         # thinking off
    ("google",    "gemini-2.5-pro",  "FORCE"),
    ("minimax",   "MiniMax-M2.7",    "FORCE"),          # PascalCase — case-miss watch (MiniMax-M3 not in registry; newest M2.x)
    ("zhipu",     "glm-4.6",         "FORCE"),
    # TIER-COERCE (unforceable)
    ("moonshot",  "kimi-k2.6",       "COERCE"),
]

# provider -> the API-key env var (PRESENCE-only check; values are NEVER printed).
_PROVIDER_KEY_ENV: dict[str, str] = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "google": "GOOGLE_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
    "moonshot": "MOONSHOT_API_KEY",
    "zhipu": "ZHIPU_API_KEY",
    "minimax": "MINIMAX_API_KEY",
}

# Watch flag — the MiniMax row carries the known reported-bug risk
# (minimax-m3-invalid-tool-args-400); the exact PascalCase id mitigates the
# case-drop path, but the forced-tool-args 400 is a separate live risk.
_WATCH_NOTE: dict[str, str] = {
    "MiniMax-M2.7": "watch: minimax-m3-invalid-tool-args-400 (forced tool args)",
}

# The seeded Status def's free-text kickoff. Scope is BAKED INTO THE DEF
# (definition.project_folder_id -> the per-account PM Demo Project folder,
# threads.py:1326-1359) — NOT chosen at send-time, so the prompt is purely the
# content ask. The 2-phase pipeline retrieves from the demo folder, then emits
# the cited, integrity-checked .docx.
DEFAULT_KICKOFF_PROMPT = (
    "Produce this week's weekly status report for the project, grounded in the "
    "project knowledge base: fill the reporting period, overall RAG status and "
    "summary, accomplishments this period, planned next period, risks and "
    "blockers, and key milestones. Every value must be cited to a source in the "
    "knowledge base — do not invent figures or status."
)

# A deliberately oversized ask for the long-deliverable / truncation axis — meant
# to push DeepSeek/Moonshot toward is_truncated (template_render_service.py:507-530)
# so the harness can record an HONEST failure (never a half-emitted .docx).
LONG_KICKOFF_PROMPT = (
    DEFAULT_KICKOFF_PROMPT
    + " For EVERY section, expand each bullet into a full multi-sentence "
    "paragraph with sub-points, quantitative detail, cross-references between "
    "risks and milestones, an owner and a target date for each item, and a "
    "rationale paragraph explaining the RAG colour for each workstream. Be "
    "exhaustive across all workstreams and all open and closed risks."
)

# Status def's slug (the manifest also carries the fixed def id; we prefer the
# manifest id and fall back to a live slug lookup if the manifest is stale).
STATUS_SLUG = "pm-weekly-status-report"

_TERMINAL_WORKFLOW_STATES = frozenset({"completed", "failed", "cancelled"})


# ─────────────────────────────────────────────────────────────────────────────
# Manifest — read the Status def id (+ demo folder) emitted by seed-pm-pack.py.
# ─────────────────────────────────────────────────────────────────────────────

def load_manifest() -> dict:
    """Read scripts/pm-pack/pm_pack_ids.json (the Plan-02 seed manifest)."""
    path = Path(__file__).resolve().parent / "pm_pack_ids.json"
    if not path.exists():
        print(
            "CANNOT RUN: scripts/pm-pack/pm_pack_ids.json not found. Run the seed "
            "first: backend/venv/Scripts/python.exe scripts/seed-pm-pack.py "
            "(set SEED_PM_RUN_INGEST=1 to also embed the corpus for a real run)."
        )
        sys.exit(1)
    return json.loads(path.read_text(encoding="utf-8"))


def resolve_status_def_id(manifest: dict, conn) -> str:
    """The Status def id — manifest first (the fixed seed UUID), then a live
    slug lookup against the published rows as a fallback if the manifest drifted."""
    for d in manifest.get("definitions", []):
        if d.get("slug") == STATUS_SLUG and d.get("def_id"):
            return str(d["def_id"])
    # Fallback: resolve by slug from the live DB (max published version).
    def_id, _definition = kit.resolve_definition(conn, STATUS_SLUG)
    return str(def_id)


# ─────────────────────────────────────────────────────────────────────────────
# Outcome capture — read DB truth for ONE kicked-off Status run. Pure reads via
# the kit's parameterized helpers (RealDictCursor, rollback-per-poll). NO writes.
# ─────────────────────────────────────────────────────────────────────────────

# Allowlisted constant SQL — only the parameterized %s value is dynamic
# (the conc_probe / eval_cross_provider posture: never interpolate into SQL).
_SQL_EMIT_PHASE_OUTPUT = (
    "SELECT phase_index, slug, status, output FROM workflow_phases "
    "WHERE workflow_run_id = %s ORDER BY phase_index"
)
_SQL_GATE_EVENTS = (
    "SELECT event_type, count(*) AS n FROM harness_audit "
    "WHERE run_id = %s GROUP BY event_type"
)
_SQL_PRODUCED_FILE = (
    # 104-03: the real workspace_files columns are `path` + `mime_type` (there is no
    # file_path/file_name) — the prior names raised UndefinedColumn and the harness
    # reported produced_file=null even on success.
    "SELECT path, mime_type FROM workspace_files "
    "WHERE thread_id = %s ORDER BY created_at DESC LIMIT 5"
)


def _coerce_jsonb(value):
    """workflow_phases.output / harness_audit.metadata are sometimes stored as
    a jsonb STRING containing JSON (double-encoded — eval_cross_provider.py note);
    normalize both shapes to a Python object."""
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (ValueError, TypeError):
            return {}
    return value or {}


def capture_outcome(conn, thread_id: str, workflow_run_id: str,
                    terminal_state: str) -> dict:
    """Read the durable outcome for a finished Status run and classify it.

    Distinguishes the SC#10 acceptance bar's three honesty outcomes:
      - produced_file  : a .docx was actually emitted (the FORCE-tier success bar)
      - honest_failure : the run failed a gate / truncated WITHOUT a silent file
      - narrated_text  : the COERCE/false-green failure mode — terminal 'completed'
                         but NO produced file (the field-map was narrated as prose)
    """
    phases = kit._fetchall(conn, _SQL_EMIT_PHASE_OUTPUT, (workflow_run_id,))
    audit = kit._fetchall(conn, _SQL_GATE_EVENTS, (workflow_run_id,))
    files = kit._fetchall(conn, _SQL_PRODUCED_FILE, (thread_id,))

    audit_counts = {row["event_type"]: int(row["n"]) for row in audit}

    # The emit phase output carries the produced-file path + integrity/citation
    # signal (validator_kinds.py output_file_valid re-opens output_file.path).
    emit_out = {}
    for p in phases:
        out = _coerce_jsonb(p.get("output"))
        if isinstance(out, dict) and ("output_file" in out or out.get("emitter")):
            emit_out = out
            break

    produced_file = None
    of = emit_out.get("output_file") if isinstance(emit_out, dict) else None
    if isinstance(of, dict) and of.get("path"):
        produced_file = str(of["path"])
    if produced_file is None and files:
        # Fall back to the most-recent .docx workspace_files row for the thread
        # (104-03: the column is `path`, not file_path/file_name).
        for f in files:
            name = (f.get("path") or "")
            if name.lower().endswith((".docx", ".doc")):
                produced_file = str(name)
                break

    truncated = bool(emit_out.get("is_truncated") or emit_out.get("truncated"))
    gate_failed = audit_counts.get("gate_failed", 0) > 0

    # Citation / integrity gate signals — best-effort from the emit output + audit.
    citation_gate = None
    integrity_gate = None
    if isinstance(emit_out, dict):
        if "citation_gate" in emit_out:
            citation_gate = "pass" if emit_out.get("citation_gate") else "fail"
        if "integrity_gate" in emit_out:
            integrity_gate = "pass" if emit_out.get("integrity_gate") else "fail"
    if citation_gate is None:
        citation_gate = "fail" if gate_failed else ("pass" if produced_file else "n/a")
    if integrity_gate is None:
        integrity_gate = "pass" if produced_file else "n/a"

    completed = terminal_state == "completed"
    # narrated_text (the false-green trap): terminal 'completed' but NO .docx —
    # the model narrated the field-map as prose instead of forcing the emission.
    narrated_text = completed and produced_file is None and not truncated
    # honest_failure: a non-completed terminal, OR a truncation that fired the
    # guard without leaving a half-emitted file (never silent narration).
    honest_failure = (not completed) or (truncated and produced_file is None)

    return {
        "terminal_state": terminal_state,
        "produced_file": produced_file,
        "citation_gate": citation_gate,
        "integrity_gate": integrity_gate,
        "truncated": truncated,
        "honest_failure": honest_failure,
        "narrated_text": narrated_text,
        "audit_counts": audit_counts,
        "phase_states": [
            {"phase_index": p["phase_index"], "slug": p["slug"], "status": p["status"]}
            for p in phases
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Drive ONE (model) row end-to-end — create thread, kick off the Status def, poll
# to terminal, capture the outcome. One bad row never aborts the sweep.
# ─────────────────────────────────────────────────────────────────────────────

def run_model_row(token: str, conn, provider: str, model: str, tier: str,
                  def_id: str, prompt: str, timeout_s: int) -> dict:
    row: dict = {
        "provider": provider,
        "model": model,
        "tier": tier,
        "run_id": None,
        "workflow_run_id": None,
        "terminal_state": "unknown",
        "produced_file": None,
        "citation_gate": "n/a",
        "integrity_gate": "n/a",
        "truncated": False,
        "honest_failure": False,
        "narrated_text": False,
        "watch": _WATCH_NOTE.get(model, ""),
        "note": "",
        "wall_clock_s": 0.0,
    }

    key_env = _PROVIDER_KEY_ENV.get(provider)
    if key_env and not os.getenv(key_env):
        row["note"] = f"{key_env} MISSING - row skipped (never blocks others)"
        row["terminal_state"] = "missing_api_key"
        return row

    started = time.time()
    try:
        thread_id = kit.create_thread(token, f"PM scoreboard {provider}/{model}")
        run_id = kit.kickoff_workflow(token, thread_id, prompt, provider, model, def_id)
        row["run_id"] = run_id
        workflow_run_id = kit.resolve_workflow_run_id(conn, thread_id)
        row["workflow_run_id"] = workflow_run_id

        status = "unknown"
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            status = kit.workflow_status(conn, workflow_run_id) or "unknown"
            if status in _TERMINAL_WORKFLOW_STATES:
                break
            time.sleep(3.0)

        row["terminal_state"] = status
        if status in _TERMINAL_WORKFLOW_STATES:
            outcome = capture_outcome(conn, thread_id, workflow_run_id, status)
            row.update({k: outcome[k] for k in (
                "produced_file", "citation_gate", "integrity_gate",
                "truncated", "honest_failure", "narrated_text",
            )})
            row["phase_states"] = outcome["phase_states"]
            row["audit_counts"] = outcome["audit_counts"]
        else:
            row["note"] = f"timeout: workflow_runs.status still {status!r} after {timeout_s}s"
            row["honest_failure"] = True  # a timeout is an honest non-completion
    except kit.BackendUnavailable:
        raise  # main() prints the clean message
    except Exception as e:  # one model's failure never aborts the sweep
        row["note"] = f"{type(e).__name__}: {e}"
        row["honest_failure"] = True
    row["wall_clock_s"] = round(time.time() - started, 1)
    return row


# ─────────────────────────────────────────────────────────────────────────────
# Output — greppable rows + a timestamped JSON artifact under scripts/pm-pack/out/.
# ─────────────────────────────────────────────────────────────────────────────

def _out_dir() -> Path:
    d = Path(__file__).resolve().parent / "out"
    d.mkdir(parents=True, exist_ok=True)
    return d


def write_artifact(rows: list[dict], prompt: str) -> Path:
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = _out_dir() / f"scoreboard-{ts}.json"
    artifact = {
        "generated_at": ts,
        "kickoff_prompt": prompt,
        "status_slug": STATUS_SLUG,
        "rows": rows,
    }
    path.write_text(json.dumps(artifact, indent=2, default=str), encoding="utf-8")
    return path


def print_rows(rows: list[dict]) -> int:
    """Greppable SCOREBOARD_ROW lines + a SCOREBOARD_RESULT summary.

    A FORCE-tier row PASSES when it produced a cited, integrity-clean .docx. A
    COERCE-tier row PASSES on a real produced file OR an honest failure — but a
    silent narrated_text is always a FAIL (T-104-03-01)."""
    print("\n## PM cross-provider Status-fill scoreboard (SC#10)\n")
    passed = 0
    for r in rows:
        force_ok = (
            r["produced_file"] is not None
            and r["citation_gate"] != "fail"
            and r["integrity_gate"] != "fail"
            and not r["narrated_text"]
        )
        if r["tier"].startswith("FORCE"):
            ok = force_ok
        else:  # COERCE — produced file OR honest failure, never silent narration
            ok = (force_ok or r["honest_failure"]) and not r["narrated_text"]
        if r["terminal_state"] == "missing_api_key":
            verdict = "MISSING"
        else:
            verdict = "PASS" if ok else "FAIL"
            if ok:
                passed += 1
        line = (
            f"{r['provider']:<10} {r['model']:<18} {r['tier']:<13} "
            f"state={r['terminal_state']:<10} file={'yes' if r['produced_file'] else 'no':<3} "
            f"cite={r['citation_gate']:<5} integ={r['integrity_gate']:<5} "
            f"trunc={str(r['truncated']):<5} narrated={str(r['narrated_text']):<5} "
            f"honest_fail={str(r['honest_failure']):<5} {verdict}"
        )
        if r["watch"]:
            line += f"  [{r['watch']}]"
        if r["note"]:
            line += f"  ({r['note']})"
        print(f"SCOREBOARD_ROW {line}")
    gated = [r for r in rows if r["terminal_state"] != "missing_api_key"]
    print(f"\nSCOREBOARD_RESULT {passed}/{len(gated)} rows PASS "
          f"({len(rows) - len(gated)} MISSING-key rows skipped)")
    return 0 if passed == len(gated) and gated else 2


# ─────────────────────────────────────────────────────────────────────────────
# Entry point.
# ─────────────────────────────────────────────────────────────────────────────

def _parse_args(argv: list[str] | None):
    ap = argparse.ArgumentParser(
        prog="scoreboard_smoke.py",
        description=(
            "Cross-provider kickoff harness for the SC#10 PM scoreboard. Kicks off "
            "the seeded Weekly Status Report def per pinned registry model ID and "
            "records the per-model outcome (produced .docx, citation/integrity "
            "gates, truncation, honest-failure vs silent narration). OPT-IN: "
            "preview-only unless --run is passed (no provider spend by default)."
        ),
    )
    ap.add_argument(
        "--run", action="store_true",
        help="OPT-IN: actually fire the cross-provider sweep (burns provider "
             "calls). Without it the harness only previews the model matrix.",
    )
    ap.add_argument(
        "--models", nargs="*",
        help="Restrict to these EXACT registry model IDs (default: all pinned "
             "tier representatives). Case matters (MiniMax-M3, glm-4.6).",
    )
    ap.add_argument(
        "--long", action="store_true",
        help="Use the long-deliverable kickoff (the truncation axis) — expect "
             "is_truncated as an HONEST failure, never a half-emitted .docx.",
    )
    ap.add_argument(
        "--timeout", type=int,
        default=int(os.getenv("PM_SCOREBOARD_TIMEOUT_S", "900")),
        help="Per-model wall-clock bound to a terminal workflow state (s).",
    )
    return ap.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)

    # Resolve the OPT-IN gate (T-104-03-02): --run flag OR PM_SCOREBOARD_RUN=1.
    do_run = bool(args.run) or os.getenv("PM_SCOREBOARD_RUN") == "1"

    # Select the model matrix (case-sensitive filter — a miss is surfaced loudly).
    selected = SCOREBOARD_MODELS
    if args.models:
        wanted = list(args.models)
        selected = [m for m in SCOREBOARD_MODELS if m[1] in wanted]
        unknown = [w for w in wanted if w not in {m[1] for m in SCOREBOARD_MODELS}]
        if unknown:
            print(
                f"WARNING: unknown/case-mismatched model id(s): {unknown}. "
                f"Pinned ids are EXACT (case matters): "
                f"{[m[1] for m in SCOREBOARD_MODELS]}"
            )
        if not selected:
            print("CANNOT RUN: --models matched no pinned scoreboard ids.")
            return 1

    prompt = LONG_KICKOFF_PROMPT if args.long else DEFAULT_KICKOFF_PROMPT

    if not do_run:
        # SAFE DEFAULT — preview only, NO provider calls, NO DB connection.
        print(
            "PREVIEW ONLY — no provider calls fired (pass --run or set "
            "PM_SCOREBOARD_RUN=1 to drive the live sweep).\n"
        )
        print("## Model matrix this harness WOULD drive (seeded Status def):\n")
        for provider, model, tier in selected:
            watch = f"  [{_WATCH_NOTE[model]}]" if model in _WATCH_NOTE else ""
            print(f"  - {provider:<10} {model:<18} {tier}{watch}")
        print(
            f"\nkickoff_prompt ({'long-deliverable' if args.long else 'standard'}): "
            f"{prompt[:80]}..."
        )
        print("\nSCOREBOARD_RESULT PREVIEW (no rows executed — opt-in gate closed)")
        return 0

    # ── LIVE sweep (opt-in) — five-piece kit, localhost hard-gated first ──
    kit.load_env()
    kit.assert_localhost_only()  # T-104-03-02 sibling: never drive cloud
    kit.report_env_presence()    # presence only — never secret values

    try:
        token = kit.get_bearer_token()
        conn = kit.connect_db()
    except kit.BackendUnavailable as e:
        print(f"\nCANNOT RUN: {e}")
        print(
            "This harness needs (1) local Supabase up and (2) the backend uvicorn "
            "running in a visible terminal, AND the PM pack seeded (run "
            "scripts/seed-pm-pack.py with SEED_PM_RUN_INGEST=1 first)."
        )
        return 1

    try:
        manifest = load_manifest()
        def_id = resolve_status_def_id(manifest, conn)
        print(
            f"Driving the seeded Status def {def_id} across {len(selected)} model "
            f"row(s) against {kit.base_url()} (per-model timeout {args.timeout}s).\n"
        )
        rows: list[dict] = []
        for provider, model, tier in selected:
            print(f"-> {provider}/{model} ({tier}) ...")
            row = run_model_row(token, conn, provider, model, tier, def_id,
                                prompt, args.timeout)
            rows.append(row)

        artifact_path = write_artifact(rows, prompt)
        rc = print_rows(rows)
        print(f"\nArtifact: {artifact_path}")
        print("(Fill the 104-VALIDATION.md SC#10 scoreboard from this JSON.)")
        return rc
    except kit.BackendUnavailable as e:
        print(f"\nCANNOT CONTINUE: {e}")
        print("SCOREBOARD_RESULT FAIL (backend unavailable)")
        return 1
    finally:
        try:
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
