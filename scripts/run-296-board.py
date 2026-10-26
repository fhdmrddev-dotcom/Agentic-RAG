"""run-296-board.py — Phase 296 (296-05) D-21 cross-provider roster board (CLAUDE.md SC#10 rule).

Proves the provider-touching 296 fixes per provider, on the LOCAL stack, with a per-request ``model``
+ ``provider`` on ``POST /threads/{id}/messages`` (no global setting is ever mutated):

  --roster        Print the derivation (run-2921's ``derive``: run-273's ``derive_roster`` over the
                  effective registry, OpenRouter forced to a registry-backed ``deepseek/*`` id) and the
                  per-provider block verdicts. Writes ``evidence/roster/roster.txt``. Read-only.
  --probe         One tiny chat turn on OpenRouter and Moonshot: a ⛔ row is ⛔ because the live API
                  said so TODAY, not because a note said so last week.
  --first-step    291-S6-F8: a draft workflow with ONE declared input ``topic`` and a first ``llm_single``
                  step whose prompt never names the place. Started in-app with ``inputs={topic: Lisbon}``.
                  PASS when the first step's output names Lisbon.
  --pinned-emit   293-F-4: a copy of the owner's one-step ``llm_emit`` form fill with the emit step PINNED
                  to another provider's model, started under each provider. PASS when the run completes,
                  the ``emit_validated`` audit names the PINNED model's provider, and no 400 is recorded.
  --resume-model  SEED-362: a workflow whose first step is a human ask (5 s wait, so it PAUSES), started
                  on a provider other than the owner's default. The ask is answered after the pause; PASS
                  when the re-drive's producer shell (``runs`` row) and the run carry the starting model
                  and provider, and the second step completes.
  --multi-tool    The multi-tool axis + 292.1-IN-01/02's markup scan: one prompt that needs
                  ``search_documents`` then ``execute_code``. PASS when the run completes, both tools ran,
                  and the SHIPPED ``detect_markup`` finds nothing in any saved assistant message.
  --parallel      Thread A streaming while thread B accepts a prompt; each finishes in its own thread.
  --long          A >= 5 KB prompt on one provider (default deepseek).
  --cleanup       Delete every thread and workflow definition the board recorded in
                  ``evidence/roster/created.json`` (threads cascade their runs, phases and messages).
  --table         Print the board table from the per-row evidence (offline).

Blocked rows are written to the board with the reason and the issue id, never omitted:
  * Moonshot — ⛔ account suspended (BUG-261024-01), unless ``--probe`` saw a successful turn;
  * OpenRouter — ⛔ 402 insufficient credit, unless ``--probe`` saw a successful turn;
  * any provider with no key configured.

Safety (T-296-40 / T-296-41): ``conc_probe.assert_localhost_only`` and run-273's ``_assert_local_db``
run before any request; every write mode holds the local-DB lock (noclobber, stale after 45 min);
evidence holds ids, statuses, model ids and bounded previews only — never the JWT or a provider key.
The operator runs uvicorn; this script never starts or stops it.

Usage (backend venv, repo root):
    backend/venv/Scripts/python.exe scripts/run-296-board.py --roster
    backend/venv/Scripts/python.exe scripts/run-296-board.py --probe
    backend/venv/Scripts/python.exe scripts/run-296-board.py --first-step [--providers openai,google]
    backend/venv/Scripts/python.exe scripts/run-296-board.py --cleanup
"""
from __future__ import annotations

import argparse
import contextlib
import importlib.util
import json
import os
import re
import sys
import time
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover
    pass

_REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO / "scripts"))
sys.path.insert(0, str(_REPO / "backend"))

import conc_probe as kit  # noqa: E402


def _load(name: str, file: str):
    spec = importlib.util.spec_from_file_location(name, _REPO / "scripts" / file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


b273 = _load("run_273_board", "run-273-board.py")
b2921 = _load("run_2921_board", "run-2921-board.py")

_PHASE_DIR = _REPO / ".planning" / "phases" / "296-close-v4-7-debt"
_OUT = _PHASE_DIR / "evidence" / "roster"
_CREATED = _OUT / "created.json"
_LOCK = Path(os.getenv("LOCALAPPDATA", "C:/Users/fhdmr/AppData/Local")) / "Temp" / "agentic-rag-localdb.lock"
_LOCK_STALE_S = 45 * 60

ACCOUNT_BLOCKS = {
    "moonshot": "account suspended for insufficient balance (HTTP 429, BUG-261024-01) — the provider refuses every call",
    "openrouter": "402 insufficient credit (BUG-261024-03 / 292.1 OpenRouter row) — operator top-up owed",
}
_ACCOUNT_ID = re.compile(r"\b(org|ak|sk|key|acct)-[A-Za-z0-9_]{6,}")
LISBON = "Lisbon"
PREVIEW = 300
MULTI_TOOL_PROMPT = (
    "Do these two steps in order, each as its own tool call: 1) search our documents for anything about "
    "revenue; 2) use Python (execute_code) to compute 17 * 23 and print the result. Then answer in two "
    "sentences: what the search found, and the number."
)
PARALLEL_A = "Write a 200-word overview of how a quarterly business review is usually run."
PARALLEL_B = "In one sentence: what is a project milestone?"
EMIT_SOURCE_NAME = "Fill Vendor Intake Sheet"
EMIT_INPUTS = {"company_name": "Northwind Logistics", "contact_email": "ap@northwind.example",
               "tax_id": "12-3456789", "phone": "+1 555 0100"}


# ── lock, ledger, writers ────────────────────────────────────────────────────────────────────────

@contextlib.contextmanager
def _db_lock(tag: str):
    if _LOCK.exists() and time.time() - _LOCK.stat().st_mtime > _LOCK_STALE_S:
        print(f"LOCK stale (> 45 min) — taking over: {_LOCK.read_text(errors='replace')[:120]!r}")
        _LOCK.unlink(missing_ok=True)
    try:
        fd = os.open(str(_LOCK), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        raise SystemExit(f"REFUSING: the local-DB lock is held ({_LOCK}): {_LOCK.read_text(errors='replace')[:200]!r}")
    os.write(fd, f"296-05 run-296-board {tag} {time.strftime('%Y-%m-%dT%H:%M:%S')}".encode())
    os.close(fd)
    print(f"LOCK taken {_LOCK}")
    try:
        yield
    finally:
        _LOCK.unlink(missing_ok=True)
        print(f"LOCK released {_LOCK}")


def _ledger() -> dict:
    if _CREATED.exists():
        return json.loads(_CREATED.read_text(encoding="utf-8"))
    return {"threads": [], "definitions": []}


def _record(kind: str, ident: str) -> None:
    led = _ledger()
    if ident not in led[kind]:
        led[kind].append(ident)
    _OUT.mkdir(parents=True, exist_ok=True)
    _CREATED.write_text(json.dumps(led, indent=2), encoding="utf-8")


def _write(name: str, payload: dict) -> str:
    _OUT.mkdir(parents=True, exist_ok=True)
    p = _OUT / f"{name}.json"
    # Provider error bodies name account / key ids (Moonshot's 429 carries `org-…` and `ak-…`): an
    # identifier is not a secret, but evidence has no use for it, so it never reaches git.
    text = _ACCOUNT_ID.sub(r"\1-<redacted>", json.dumps(payload, indent=2, default=str))
    if "Bearer " in text or "sk-" in text:  # T-296-41: never write a credential, even by accident
        raise SystemExit(f"REFUSING to write {p.name}: it carries a credential-shaped string")
    p.write_text(text, encoding="utf-8")
    return str(p.relative_to(_REPO))


def _bounded(text) -> str:
    s = text if isinstance(text, str) else json.dumps(text, default=str)
    return s[:PREVIEW]


# ── roster + blocks ──────────────────────────────────────────────────────────────────────────────

def _roster(conn):
    roster, probe, text = b2921.derive(conn, quiet=True)
    rows = [r for r in roster if r.get("required") and not r.get("extra")]
    probes = {}
    pf = _OUT / "probe.json"
    if pf.exists():
        probes = json.loads(pf.read_text(encoding="utf-8")).get("results", {})
    for r in rows:
        pid = r["provider"]
        reason = None
        if r.get("derive_blocked"):
            reason = r["derive_blocked"]
        elif not probe.get(pid, {}).get("has_key"):
            reason = "no API key configured"
        elif pid in ACCOUNT_BLOCKS and probes.get(pid, {}).get("verdict") != "PASS":
            seen = probes.get(pid, {}).get("error")
            reason = ACCOUNT_BLOCKS[pid] + (f"; --probe saw: {seen}" if seen else "")
        r["blocked"] = reason
    return rows, text


def _active(rows, wanted):
    return [r for r in rows if not r["blocked"] and (not wanted or r["provider"] in wanted)]


def _default_route(conn) -> tuple[str | None, str | None]:
    import asyncio  # noqa: PLC0415
    from app.models.user_settings import load_app_settings_async  # noqa: PLC0415
    s = asyncio.run(load_app_settings_async())
    return getattr(s, "active_provider", None), getattr(s, "llm_model", None)


# ── HTTP + DB helpers ────────────────────────────────────────────────────────────────────────────

def _new_thread(base, h, title) -> str:
    tid = b2921._new_thread(base, h, title)
    _record("threads", tid)
    return tid


def _send(base, h, thread_id, payload: dict) -> tuple[int, dict]:
    r = kit._requests().post(f"{base}/threads/{thread_id}/messages", headers=h, timeout=60, json=payload)
    try:
        body = r.json()
    except ValueError:
        body = {"raw": r.text[:200]}
    return r.status_code, body


def _workflow_run(conn, thread_id) -> dict | None:
    return kit._fetchone(conn, "SELECT id::text AS id, status, model, metadata, created_at FROM workflow_runs "
                               "WHERE thread_id = %s ORDER BY created_at DESC LIMIT 1", (thread_id,))


def _wait_workflow(conn, thread_id, timeout, until=("completed", "failed", "cancelled")) -> dict | None:
    deadline = time.time() + timeout
    wr = None
    while time.time() < deadline:
        wr = _workflow_run(conn, thread_id)
        if wr and wr["status"] in until:
            return wr
        time.sleep(3)
    return wr


def _phases(conn, wr_id) -> list[dict]:
    return kit._fetchall(conn, "SELECT slug, phase_index, status, output FROM workflow_phases "
                               "WHERE workflow_run_id = %s ORDER BY phase_index", (wr_id,))


def _audits(conn, wr_id) -> list[dict]:
    rows = kit._fetchall(conn, "SELECT event_type, metadata FROM harness_audit WHERE run_id = %s "
                               "ORDER BY created_at", (wr_id,))
    for r in rows:  # some writers store a JSON string in the jsonb column (double-encoded)
        if isinstance(r["metadata"], str):
            try:
                r["metadata"] = json.loads(r["metadata"])
            except ValueError:
                r["metadata"] = {"raw": r["metadata"]}
    return rows


def _runs_rows(conn, thread_id) -> list[dict]:
    return kit._fetchall(conn, "SELECT run_id::text AS run_id, status, model, provider, error, started_at "
                               "FROM runs WHERE thread_id = %s ORDER BY started_at", (thread_id,))


def _create_definition(base, h, body: dict) -> tuple[str | None, str]:
    r = kit._requests().post(f"{base}/workflows", headers=h, timeout=30, json=body)
    if r.status_code != 201:
        return None, f"create HTTP {r.status_code}: {r.text[:200]}"
    did = r.json()["id"]
    _record("definitions", did)
    return did, ""


def _blocked_payload(row, mode) -> dict:
    return {"mode": mode, "provider": row["provider"], "model": row["model"], "verdict": "⛔",
            "reason": row["blocked"]}


# ── --probe ──────────────────────────────────────────────────────────────────────────────────────

def probe(token, org_id, conn, args) -> int:
    base, h = kit.base_url(), b273._headers(token, org_id)
    rows, _ = _roster(conn)
    results = {}
    with _db_lock("probe"):
        for r in rows:
            if r["provider"] not in ACCOUNT_BLOCKS:
                continue
            tid = _new_thread(base, h, f"296 probe {r['provider']}")
            code, body = _send(base, h, tid, {"content": "Reply with the single word: ready.",
                                              "model": r["model"], "provider": r["provider"]})
            run_id = body.get("run_id")
            status = b273._wait_run(conn, run_id, 120) if run_id else f"send HTTP {code}"
            row = kit._fetchone(conn, "SELECT status, error FROM runs WHERE run_id = %s", (run_id,)) if run_id else None
            msgs = kit._fetchall(conn, "SELECT content FROM messages WHERE thread_id = %s AND role = 'assistant'", (tid,))
            answer = " ".join((m["content"] or "") for m in msgs).strip()
            ok = status == "completed" and bool(answer) and "never wrote an answer" not in answer
            results[r["provider"]] = {"model": r["model"], "thread_id": tid, "run_id": run_id, "status": status,
                                      "error": _bounded((row or {}).get("error") or ""),
                                      "answer_preview": _bounded(answer), "verdict": "PASS" if ok else "⛔"}
            print(f"PROBE {r['provider']:<10} {r['model']} -> {status} · {results[r['provider']]['verdict']} "
                  f"{results[r['provider']]['error'][:120]}")
    _write("probe", {"results": results})
    return 0


# ── --first-step (291-S6-F8) ─────────────────────────────────────────────────────────────────────

def _first_step_def(tag: str) -> dict:
    return {
        "slug": f"t296-first-step-{tag}", "version": 1, "name": f"296 board first step {tag}",
        "inputs": [{"key": "topic", "label": "Topic", "type": "text"}],
        "phases": [{"slug": "brief", "phase_index": 0, "name": "Brief",
                    "config": {"phase_type": "llm_single",
                               "prompt": "Write exactly one sentence about the place the person gave as the "
                                         "topic, and name that place in the sentence."}}],
    }


def first_step(token, org_id, conn, args) -> int:
    base, h = kit.base_url(), b273._headers(token, org_id)
    rows, _ = _roster(conn)
    wanted = set(filter(None, args.providers.split(",")))
    with _db_lock("first-step"):
        for r in rows:
            if wanted and r["provider"] not in wanted:
                continue
            if r["blocked"]:
                print(f"FIRST-STEP {r['provider']:<10} ⛔ {r['blocked']}")
                _write(f"first-step-{r['provider']}", _blocked_payload(r, "first-step"))
                continue
            did, err = _create_definition(base, h, _first_step_def(f"{r['provider']}-{int(time.time())}"))
            res = {"mode": "first-step", "provider": r["provider"], "model": r["model"], "definition_id": did}
            if did:
                tid = _new_thread(base, h, f"296 first-step {r['provider']}")
                code, body = _send(base, h, tid, {"content": "Write the brief.", "model": r["model"],
                                                  "provider": r["provider"], "workflow_definition_id": did,
                                                  "inputs": {"topic": LISBON}})
                res.update({"thread_id": tid, "send_http": code, "send": _bounded(body)})
                wr = _wait_workflow(conn, tid, args.timeout) if code in (200, 201) else None
                ph = _phases(conn, wr["id"]) if wr else []
                out = json.dumps(ph[0]["output"], default=str) if ph else ""
                res.update({"workflow_run": wr and {"id": wr["id"], "status": wr["status"], "model": wr["model"]},
                            "first_step_status": ph[0]["status"] if ph else None,
                            "first_step_output_preview": _bounded(out),
                            "names_lisbon": LISBON.lower() in out.lower()})
                res["verdict"] = "PASS" if (wr and wr["status"] == "completed" and res["names_lisbon"]) else "FAIL"
            else:
                res.update({"error": err, "verdict": "FAIL"})
            print(f"FIRST-STEP {r['provider']:<10} {r['model']} -> {res['verdict']} "
                  f"(run {(res.get('workflow_run') or {}).get('status')}, Lisbon={res.get('names_lisbon')})")
            _write(f"first-step-{r['provider']}", res)
    return 0


# ── --pinned-emit (293-F-4) ──────────────────────────────────────────────────────────────────────

def _emit_source(conn, user_id) -> dict:
    row = kit._fetchone(conn, "SELECT definition::text AS d FROM workflow_definitions WHERE created_by = %s "
                              "AND name = %s ORDER BY updated_at DESC LIMIT 1", (user_id, EMIT_SOURCE_NAME))
    if not row:
        raise SystemExit(f"no owner definition named {EMIT_SOURCE_NAME!r} to copy for --pinned-emit")
    d = json.loads(row["d"])
    return json.loads(d) if isinstance(d, str) else d


def pinned_emit(token, org_id, conn, args) -> int:
    base, h = kit.base_url(), b273._headers(token, org_id)
    rows, _ = _roster(conn)
    user_id = b273._user_id(token)
    src = _emit_source(conn, user_id)
    active = _active(rows, None)
    wanted = set(filter(None, args.providers.split(",")))
    with _db_lock("pinned-emit"):
        for r in rows:
            if wanted and r["provider"] not in wanted:
                continue
            if r["blocked"]:
                print(f"PINNED-EMIT {r['provider']:<10} ⛔ {r['blocked']}")
                _write(f"pinned-emit{args.tag and '-' + args.tag}-{r['provider']}", _blocked_payload(r, "pinned-emit"))
                continue
            # --pin none = the CONTROL row (the same emit, unpinned, on the run's own provider);
            # --pin <provider> = pin that provider's roster model; default openai (deepseek for openai).
            pin_to = args.pin or ("deepseek" if r["provider"] == "openai" else "openai")
            if pin_to == "none":
                pin = {"provider": r["provider"], "model": None}
            else:
                pin = next((a for a in active if a["provider"] == pin_to and a["provider"] != r["provider"]),
                           None) or next(a for a in active if a["provider"] != r["provider"])
            body = json.loads(json.dumps(src))
            body.update({"slug": f"t296-pinned-emit-{r['provider']}-{int(time.time())}",
                         "name": f"296 board pinned emit {r['provider']}", "status": "draft"})
            for p in body["phases"]:
                if p["config"].get("phase_type") == "llm_emit":
                    p["config"]["model"] = pin["model"]
            did, err = _create_definition(base, h, body)
            res = {"mode": "pinned-emit", "provider": r["provider"], "model": r["model"],
                   "pinned_model": pin["model"], "pinned_provider": pin["provider"], "definition_id": did}
            if did:
                tid = _new_thread(base, h, f"296 pinned-emit {r['provider']}")
                code, sbody = _send(base, h, tid, {"content": "Fill the form.", "model": r["model"],
                                                   "provider": r["provider"], "workflow_definition_id": did,
                                                   "inputs": EMIT_INPUTS})
                res.update({"thread_id": tid, "send_http": code, "send": _bounded(sbody)})
                wr = _wait_workflow(conn, tid, args.timeout) if code in (200, 201) else None
                aud = _audits(conn, wr["id"]) if wr else []
                validated = [a["metadata"] for a in aud if a["event_type"] == "emit_validated"]
                providers_seen = sorted({str((m or {}).get("provider")) for m in validated})
                errors = [_bounded(a["metadata"]) for a in aud if a["event_type"] in ("emit_failed", "run_failed")]
                attempted = sorted({f"{(a['metadata'] or {}).get('provider')}:{(a['metadata'] or {}).get('model')}"
                                    for a in aud if a["event_type"] == "emit_failed"})
                res.update({"workflow_run": wr and {"id": wr["id"], "status": wr["status"]},
                            "emit_validated_providers": providers_seen, "emit_failed_on": attempted,
                            "failures": errors,
                            "has_400": any("400" in e for e in errors)})
                res["verdict"] = "PASS" if (wr and wr["status"] == "completed"
                                            and providers_seen == [pin["provider"]] and not res["has_400"]) else "FAIL"
            else:
                res.update({"error": err, "verdict": "FAIL"})
            print(f"PINNED-EMIT {r['provider']:<10} run on {r['model']} pin {pin['model']} -> {res['verdict']} "
                  f"(emit on {res.get('emit_validated_providers')}, run {(res.get('workflow_run') or {}).get('status')})")
            _write(f"pinned-emit{args.tag and '-' + args.tag}-{r['provider']}", res)
    return 0


# ── --resume-model (SEED-362) ────────────────────────────────────────────────────────────────────

def _resume_def(tag: str) -> dict:
    return {
        "slug": f"t296-resume-{tag}", "version": 1, "name": f"296 board resume {tag}",
        "phases": [
            {"slug": "pick", "phase_index": 0, "name": "Pick",
             "config": {"phase_type": "llm_human_input", "prompt": "Pick a colour.",
                        "options": ["Blue", "Green"], "timeout_seconds": 5}},
            {"slug": "say", "phase_index": 1, "name": "Say",
             "config": {"phase_type": "llm_single", "prompt": "In one sentence, say which colour was picked."}},
        ],
    }


def _pending_prompt(conn, wr_id) -> dict | None:
    row = kit._fetchone(conn, "SELECT m.tool_calls FROM messages m JOIN workflow_runs wr ON wr.thread_id = m.thread_id "
                              "WHERE wr.id = %s AND m.role = 'system' AND m.tool_calls @> '[{\"kind\": \"ask_user_prompt\"}]'::jsonb "
                              "ORDER BY m.created_at DESC LIMIT 1", (wr_id,))
    tc = (row or {}).get("tool_calls")
    return tc[0] if isinstance(tc, list) and tc else None


def resume_model(token, org_id, conn, args) -> int:
    base, h = kit.base_url(), b273._headers(token, org_id)
    rows, _ = _roster(conn)
    default_provider, default_model = _default_route(conn)
    wanted = set(filter(None, args.providers.split(",")))
    with _db_lock("resume-model"):
        for r in rows:
            if wanted and r["provider"] not in wanted:
                continue
            if r["blocked"]:
                print(f"RESUME-MODEL {r['provider']:<10} ⛔ {r['blocked']}")
                _write(f"resume-model-{r['provider']}", _blocked_payload(r, "resume-model"))
                continue
            res = {"mode": "resume-model", "provider": r["provider"], "model": r["model"],
                   "owner_default": {"provider": default_provider, "model": default_model},
                   "non_default": r["provider"] != default_provider}
            did, err = _create_definition(base, h, _resume_def(f"{r['provider']}-{int(time.time())}"))
            if not did:
                res.update({"error": err, "verdict": "FAIL"})
                _write(f"resume-model-{r['provider']}", res)
                continue
            tid = _new_thread(base, h, f"296 resume-model {r['provider']}")
            code, sbody = _send(base, h, tid, {"content": "Start.", "model": r["model"], "provider": r["provider"],
                                               "workflow_definition_id": did})
            res.update({"definition_id": did, "thread_id": tid, "send_http": code})
            wr = _wait_workflow(conn, tid, 120, until=("paused", "completed", "failed", "cancelled"))
            res["status_before_answer"] = wr and wr["status"]
            prompt = _pending_prompt(conn, wr["id"]) if wr else None
            first_runs = _runs_rows(conn, tid)
            if not (wr and wr["status"] == "paused" and prompt):
                res.update({"verdict": "FAIL", "why": "the run did not pause on the ask"})
                _write(f"resume-model-{r['provider']}", res)
                print(f"RESUME-MODEL {r['provider']:<10} FAIL (status {res['status_before_answer']})")
                continue
            # A PAUSED workflow run is answered under its WORKFLOW-RUN id (the producer's `runs` row
            # already ended, so its id answers 409 "already ended"; api/runs.py's anchor fallback).
            ans = kit._requests().post(f"{base}/runs/{wr['id']}/ask_user_response", headers=h,
                                       timeout=30, json={"tool_call_id": prompt.get("tool_call_id"),
                                                         "response_text": "Blue", "choice_index": 0})
            res["answer_http"] = ans.status_code
            res["answer_body"] = _bounded(ans.text)
            wr2 = _wait_workflow(conn, tid, args.timeout)
            runs_after = _runs_rows(conn, tid)
            shells = [x for x in runs_after if x["run_id"] not in {y["run_id"] for y in first_runs}]
            ph = _phases(conn, wr2["id"]) if wr2 else []
            res.update({
                "workflow_run_after": wr2 and {"status": wr2["status"], "model": wr2["model"],
                                               "metadata_provider": (wr2["metadata"] or {}).get("provider")},
                "first_segment_runs": [{k: x[k] for k in ("run_id", "status", "model", "provider")} for x in first_runs],
                "resumed_segment_runs": [{k: x[k] for k in ("run_id", "status", "model", "provider")} for x in shells],
                "phases": [{"slug": p["slug"], "status": p["status"], "output_preview": _bounded(p["output"])} for p in ph],
            })
            # ⚠ MEASURED 2026-10-27: the re-drive's producer shell is minted with the placeholder
            # model/provider 'unknown' BY DESIGN (harness_engine._build_resume_context: "the shell is
            # never used for an LLM call"), and no audit row or stream event names the model, so the
            # resumed segment's model cannot be read from the DB. The observable half of SEED-362 is
            # the run's RECORD: workflow_runs.model + metadata.provider are what 296-02's resume rule
            # reads (`run["model"] if run.get("model") and _run_provider`), pinned by its unit test.
            md_provider = ((wr2 or {}).get("metadata") or {}).get("provider")
            res["recorded_for_resume"] = {"model": (wr2 or {}).get("model"), "provider": md_provider}
            same = (wr2 or {}).get("model") == r["model"] and md_provider == r["provider"]
            ok = bool(wr2 and wr2["status"] == "completed" and same and shells and ph
                      and ph[-1]["status"] == "completed")
            res["verdict"] = "PASS" if ok else "FAIL"
            print(f"RESUME-MODEL {r['provider']:<10} {r['model']} -> {res['verdict']} (resumed on "
                  f"{[(x['model'], x['provider']) for x in shells]}, run {wr2 and wr2['status']})")
            _write(f"resume-model-{r['provider']}", res)
    return 0


# ── --multi-tool (axis + 292.1-IN-01/02 markup scan) ─────────────────────────────────────────────

def multi_tool(token, org_id, conn, args) -> int:
    from app.services.text_tool_calls import detect_markup  # noqa: PLC0415 — the SHIPPED detector
    base, h = kit.base_url(), b273._headers(token, org_id)
    rows, _ = _roster(conn)
    wanted = set(filter(None, args.providers.split(",")))
    order = sorted(rows, key=lambda x: x["provider"] != "deepseek")  # DeepSeek first (292.1)
    with _db_lock("multi-tool"):
        for r in order:
            if wanted and r["provider"] not in wanted:
                continue
            if r["blocked"]:
                print(f"MULTI-TOOL {r['provider']:<10} ⛔ {r['blocked']}")
                _write(f"multi-tool-{r['provider']}", _blocked_payload(r, "multi-tool"))
                continue
            tid = _new_thread(base, h, f"296 multi-tool {r['provider']}")
            code, body = _send(base, h, tid, {"content": MULTI_TOOL_PROMPT, "model": r["model"], "provider": r["provider"]})
            run_id = body.get("run_id")
            status = b273._wait_run(conn, run_id, args.timeout) if run_id else f"send HTTP {code}"
            msgs = kit._fetchall(conn, "SELECT id::text AS id, content, tool_calls FROM messages WHERE thread_id = %s "
                                       "AND role = 'assistant' ORDER BY created_at", (tid,))
            tools = [tc.get("name") for m in msgs for tc in (m["tool_calls"] or []) if isinstance(tc, dict)]
            markup = [{"message_id": m["id"], "at": detect_markup(m["content"] or "")} for m in msgs
                      if detect_markup(m["content"] or "") is not None]
            final = (msgs[-1]["content"] or "").strip() if msgs else ""
            res = {"mode": "multi-tool", "provider": r["provider"], "model": r["model"], "thread_id": tid,
                   "run_id": run_id, "status": status, "tools": tools, "markup_hits": markup,
                   "final_preview": _bounded(final)}
            both = "search_documents" in tools and "execute_code" in tools
            res["verdict"] = "PASS" if (status == "completed" and both and not markup and final) else "FAIL"
            print(f"MULTI-TOOL {r['provider']:<10} {r['model']} -> {res['verdict']} (tools {tools}, markup {len(markup)})")
            _write(f"multi-tool-{r['provider']}", res)
    return 0


# ── --parallel / --long ──────────────────────────────────────────────────────────────────────────

def parallel(token, org_id, conn, args) -> int:
    base, h = kit.base_url(), b273._headers(token, org_id)
    rows, _ = _roster(conn)
    target = (args.providers or "google").split(",")[0]
    r = next(x for x in rows if x["provider"] == target)
    if r["blocked"]:
        _write(f"parallel-{target}", _blocked_payload(r, "parallel"))
        return 0
    with _db_lock("parallel"):
        ta, tb = _new_thread(base, h, "296 parallel A"), _new_thread(base, h, "296 parallel B")
        _, ba = _send(base, h, ta, {"content": PARALLEL_A, "model": r["model"], "provider": r["provider"]})
        time.sleep(1.0)
        a_live = kit._fetchone(conn, "SELECT status FROM runs WHERE run_id = %s", (ba.get("run_id"),))
        code_b, bb = _send(base, h, tb, {"content": PARALLEL_B, "model": r["model"], "provider": r["provider"]})
        sa = b273._wait_run(conn, ba.get("run_id"), args.timeout)
        sb = b273._wait_run(conn, bb.get("run_id"), args.timeout) if bb.get("run_id") else f"HTTP {code_b}"
        own = all(kit._fetchone(conn, "SELECT thread_id::text AS t FROM runs WHERE run_id = %s", (rid,))["t"] == t
                  for rid, t in ((ba.get("run_id"), ta), (bb.get("run_id"), tb)) if rid)
        res = {"mode": "parallel", "provider": target, "model": r["model"], "thread_a": ta, "thread_b": tb,
               "a_status_when_b_sent": (a_live or {}).get("status"), "b_send_http": code_b,
               "a_final": sa, "b_final": sb, "each_in_own_thread": own}
        res["verdict"] = "PASS" if (res["a_status_when_b_sent"] == "streaming" and code_b in (200, 201)
                                    and sa == "completed" and sb == "completed" and own) else "FAIL"
    print(f"PARALLEL {target} -> {res['verdict']} ({res})")
    _write(f"parallel-{target}", res)
    return 0


def long_message(token, org_id, conn, args) -> int:
    base, h = kit.base_url(), b273._headers(token, org_id)
    rows, _ = _roster(conn)
    target = (args.providers or "deepseek").split(",")[0]
    r = next(x for x in rows if x["provider"] == target)
    if r["blocked"]:
        _write(f"long-{target}", _blocked_payload(r, "long"))
        return 0
    prompt = ("Here is a CSV of revenue by quarter and region with notes. Give the total revenue per quarter "
              "as four lines, nothing else.\n\n" + b273.fixture_csv(True))
    with _db_lock("long"):
        tid = _new_thread(base, h, f"296 long {target}")
        code, body = _send(base, h, tid, {"content": prompt, "model": r["model"], "provider": r["provider"]})
        status = b273._wait_run(conn, body.get("run_id"), args.timeout) if body.get("run_id") else f"HTTP {code}"
        msgs = kit._fetchall(conn, "SELECT content FROM messages WHERE thread_id = %s AND role = 'assistant'", (tid,))
        final = " ".join((m["content"] or "") for m in msgs).strip()
    res = {"mode": "long", "provider": target, "model": r["model"], "thread_id": tid,
           "prompt_bytes": len(prompt.encode("utf-8")), "status": status, "final_preview": _bounded(final)}
    res["verdict"] = "PASS" if (res["prompt_bytes"] >= 5 * 1024 and status == "completed" and final) else "FAIL"
    print(f"LONG {target} -> {res['verdict']} ({res['prompt_bytes']} bytes, {status})")
    _write(f"long-{target}", res)
    return 0


# ── --cleanup / --table ──────────────────────────────────────────────────────────────────────────

def _execute(conn, sql: str, params: tuple) -> None:
    with conn.cursor() as cur:
        cur.execute(sql, params)


def cleanup(conn) -> int:
    led = _ledger()
    with _db_lock("cleanup"):
        for tid in led["threads"]:
            wrs = [w["id"] for w in kit._fetchall(conn, "SELECT id::text AS id FROM workflow_runs WHERE thread_id = %s", (tid,))]
            for w in wrs:
                _execute(conn, "DELETE FROM harness_audit WHERE run_id = %s", (w,))
            _execute(conn, "UPDATE threads SET active_workflow_run_id = NULL WHERE id = %s", (tid,))
            _execute(conn, "DELETE FROM threads WHERE id = %s", (tid,))
        for did in led["definitions"]:
            _execute(conn, "DELETE FROM workflow_definitions WHERE id = %s", (did,))
        left_t = kit._fetchone(conn, "SELECT count(*) AS n FROM threads WHERE id::text = ANY(%s)", (led["threads"],))["n"]
        left_d = kit._fetchone(conn, "SELECT count(*) AS n FROM workflow_definitions WHERE id::text = ANY(%s)",
                               (led["definitions"],))["n"]
    print(f"CLEANUP threads {len(led['threads'])} (left {left_t}) · definitions {len(led['definitions'])} (left {left_d})")
    _write("cleanup", {"threads_deleted": len(led["threads"]), "threads_left": left_t,
                       "definitions_deleted": len(led["definitions"]), "definitions_left": left_d})
    return 0 if (left_t == 0 and left_d == 0) else 1


def table() -> int:
    for p in sorted(_OUT.glob("*.json")):
        if p.name in ("created.json", "cleanup.json", "probe.json"):
            continue
        d = json.loads(p.read_text(encoding="utf-8"))
        print(f"| {d.get('mode')} | {d.get('provider')} | {d.get('model')} | {d.get('verdict')} | "
              f"{d.get('reason') or ''} | {p.relative_to(_REPO).as_posix()} |")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    for m in ("roster", "probe", "first-step", "pinned-emit", "resume-model", "multi-tool", "parallel", "long",
              "cleanup", "table"):
        g.add_argument(f"--{m}", action="store_true")
    ap.add_argument("--providers", default="")
    ap.add_argument("--timeout", type=int, default=420)
    ap.add_argument("--pin", default="", help="--pinned-emit: provider to pin, or none (control)")
    ap.add_argument("--tag", default="", help="evidence-name suffix, e.g. control")
    args = ap.parse_args()
    if args.table:
        return table()
    kit.load_env()
    kit.assert_localhost_only()
    b273._assert_local_db()
    conn = kit.connect_db()
    conn.autocommit = True
    if args.roster:
        rows, text = _roster(conn)
        lines = [f"{r['provider']:<10} {r['model']:<28} " + (f"⛔ {r['blocked']}" if r["blocked"] else "active")
                 for r in rows]
        print("\n".join(lines))
        print(f"ROSTER rows: {len(rows)} (7 natives + OpenRouter required)")
        _OUT.mkdir(parents=True, exist_ok=True)
        (_OUT / "roster.txt").write_text(text + "\n" + "\n".join(lines) + "\n", encoding="utf-8")
        return 0 if len(rows) == 8 else 1
    if args.cleanup:
        return cleanup(conn)
    token = kit.get_bearer_token()
    user_id = b273._user_id(token)
    org_id = b273._single_org(conn, user_id)
    print(f"board user {user_id} · single org {org_id} (asserted from org_members)")
    modes = {"probe": probe, "first_step": first_step, "pinned_emit": pinned_emit, "resume_model": resume_model,
             "multi_tool": multi_tool, "parallel": parallel, "long": long_message}
    for name, fn in modes.items():
        if getattr(args, name):
            return fn(token, org_id, conn, args)
    return 2


if __name__ == "__main__":
    sys.exit(main())
