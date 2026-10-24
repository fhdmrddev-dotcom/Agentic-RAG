"""run-2921-board.py — Phase 292.1 (292.1-04) cross-provider tool-limit board (D-22, SC#1-SC#4).

BUG-261024-03: at the round cap a model's last tool call was lost when it arrived as TEXT (DeepSeek
DSML) and the Continue button never appeared. 292.1 parses / detects text-form calls, pauses on
them, makes the cap an app setting and lets a typed `continue` resume the paused run. This board
proves it live, per provider, with a FORCED LOW CAP (`chat_max_tool_rounds = 2`, D-19).

Reuses run-273-board.py's helpers (loaded with importlib: the filename has hyphens) — the roster
derivation, the local-DB assertion, the per-request send, the run wait and the reload reader — and
run-292-board.py's mode layout. The markup scan imports the SHIPPED detector
(`app.services.text_tool_calls.detect_markup`), never a re-typed regex.

Every mode runs against the LOCAL stack only: ``conc_probe.assert_localhost_only`` and
``_assert_local_db`` (127.0.0.1 / localhost DSN and Redis) run before any request or DB write
(T-2921-17). The operator runs uvicorn; this script never starts or stops it. Modes that write
(threads, runs, the one app setting) take the local-DB lock (noclobber, stale after 45 min).

  --roster          Print the derivation (run-273 ``derive_roster``) with the OpenRouter row FORCED to
                    a registry-backed ``deepseek/*`` id (D-22 makes it mandatory), plus the production
                    id ``deepseek/deepseek-v4.1-flash-1017`` as an ``extra`` row when the DB registry
                    holds it. Writes ``evidence/roster.txt``.
  --run             Per row: set the cap to 2 (GET-verified), drive up to 3 fresh-thread attempts of a
                    multi-step / two-tool prompt until one pauses, classify the run (structured-pause,
                    text-pause, empty-pause, prose-final), and for every pause POST /runs/{id}/continue
                    and assert the same run_id resumes on the same model/provider with
                    ``continues_used`` +1 and the carrier's first call as the first tool after resume.
                    Then the SC#2 scan over every assistant message of the row's threads. The cap is
                    restored to 15 in a ``finally`` and GET-verified (T-2921-18).
  --typed-continue  SC#3 / D-12 on a paused DeepSeek row (native first, else OpenRouter): POST
                    /threads/{id}/messages {content: "continue"} -> 200 ``continued: true`` with the
                    paused run_id; no new user row, no new runs row, ``continues_used`` +1.
  --long            One row (default deepseek) with a >= 5 KB prompt.
  --parallel        Thread A paused then continuing while thread B accepts a prompt; each run stays in
                    its own thread.
  --reload-check    For every board thread in the evidence: GET /threads/{id}/messages again; content
                    must equal the DB and ``detect_markup`` must be None on every assistant message.

Evidence (T-2921-19): run/thread ids, statuses, model ids and bounded previews only; the JWT and
provider keys are never written.

Usage (backend venv, repo root):
    backend/venv/Scripts/python.exe scripts/run-2921-board.py --roster
    backend/venv/Scripts/python.exe scripts/run-2921-board.py --run [--providers deepseek,openrouter]
    backend/venv/Scripts/python.exe scripts/run-2921-board.py --typed-continue
    backend/venv/Scripts/python.exe scripts/run-2921-board.py --long --providers deepseek
    backend/venv/Scripts/python.exe scripts/run-2921-board.py --parallel --providers google
    backend/venv/Scripts/python.exe scripts/run-2921-board.py --reload-check
  Optional ``--log PATH``: the uvicorn log, so a ``text_tool_markup run=<id>`` WARNING confirms a
  text-pause instead of the id-shape heuristic.
"""
from __future__ import annotations

import argparse
import contextlib
import importlib.util
import io
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

_spec = importlib.util.spec_from_file_location("run_273_board", _REPO / "scripts" / "run-273-board.py")
b273 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(b273)  # type: ignore[union-attr]

_PHASE_DIR = _REPO / ".planning" / "phases" / "292.1-tool-limit-continue-that-always-fires-bug-261024-03"
_EVIDENCE = _PHASE_DIR / "evidence"
_BOARD = _EVIDENCE / "board"
_LOCK = Path(os.getenv("LOCALAPPDATA", "C:/Users/fhdmr/AppData/Local")) / "Temp" / "agentic-rag-localdb.lock"
_LOCK_STALE_S = 45 * 60

LOW_CAP = 2
RESTORE_CAP = 15
ATTEMPTS = 3
OPENROUTER_DEEPSEEK_PREFERRED = "deepseek/deepseek-v4-pro"
PROD_OPENROUTER_ID = "deepseek/deepseek-v4.1-flash-1017"
# parse_dsml (text_tool_calls.py:234) and the structured-mode parser (tool_parser.py) mint this id
# shape; native SDK ids do not. A heuristic — a `text_tool_markup run=<id>` log line is the proof.
_PARSED_ID = re.compile(r"^call_[0-9a-f]{24}$")

BOARD_PROMPT = (
    "Do these three steps one at a time, each as its own tool call, and wait for each result before "
    "the next: 1) search our documents for the project plan; 2) search our documents again for its "
    "milestones; 3) use Python (execute_code) to draw a bar chart of milestones per quarter. Do not "
    "skip a step and do not combine steps."
)
PARALLEL_B_PROMPT = "In one sentence: what is a project milestone?"


# ── lock + knob ─────────────────────────────────────────────────────────────────────────────────

@contextlib.contextmanager
def _db_lock(tag: str):
    if _LOCK.exists() and time.time() - _LOCK.stat().st_mtime > _LOCK_STALE_S:
        print(f"LOCK stale (> 45 min) — taking over: {_LOCK.read_text(errors='replace')[:120]!r}")
        _LOCK.unlink(missing_ok=True)
    try:
        fd = os.open(str(_LOCK), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        raise SystemExit(f"REFUSING: the local-DB lock is held ({_LOCK}): "
                         f"{_LOCK.read_text(errors='replace')[:200]!r}")
    os.write(fd, f"292.1-04 {tag} {time.strftime('%Y-%m-%dT%H:%M:%S')}".encode())
    os.close(fd)
    print(f"LOCK taken {_LOCK}")
    try:
        yield
    finally:
        _LOCK.unlink(missing_ok=True)
        print(f"LOCK released {_LOCK}")


def _get_cap(base, h) -> dict:
    r = kit._requests().get(f"{base}/settings", headers=h, timeout=30)
    body = r.json() if r.status_code == 200 else {}
    return {"http": r.status_code, "chat_max_tool_rounds": body.get("chat_max_tool_rounds"),
            "explorer_max_tool_rounds": body.get("explorer_max_tool_rounds"),
            "at": time.strftime("%Y-%m-%dT%H:%M:%S")}


def _put_cap(base, h, value: int) -> int:
    r = kit._requests().put(f"{base}/settings", headers=h, timeout=30, json={"chat_max_tool_rounds": value})
    if r.status_code != 200:
        print(f"KNOB PUT {value} -> HTTP {r.status_code}: {r.text[:200]}")
    return r.status_code


def _knob_log(entry: dict) -> None:
    _EVIDENCE.mkdir(parents=True, exist_ok=True)
    p = _EVIDENCE / "knob-reads.jsonl"
    with p.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


@contextlib.contextmanager
def _low_cap(base, h, label: str):
    before = _get_cap(base, h)
    code = _put_cap(base, h, LOW_CAP)
    after = _get_cap(base, h)
    print(f"KNOB {label}: before={before['chat_max_tool_rounds']} PUT {LOW_CAP} -> {code}; "
          f"GET reads chat_max_tool_rounds={after['chat_max_tool_rounds']}")
    _knob_log({"label": label, "phase": "set", "before": before, "put_http": code, "after": after})
    if after["chat_max_tool_rounds"] != LOW_CAP:
        _put_cap(base, h, RESTORE_CAP)
        raise SystemExit(f"KNOB did not read {LOW_CAP} after the PUT — refusing to run the board")
    try:
        yield after
    finally:
        code = _put_cap(base, h, RESTORE_CAP)
        restored = _get_cap(base, h)
        print(f"KNOB {label}: restore PUT {RESTORE_CAP} -> {code}; "
              f"GET reads chat_max_tool_rounds={restored['chat_max_tool_rounds']}")
        _knob_log({"label": label, "phase": "restore", "put_http": code, "after": restored})
        if restored["chat_max_tool_rounds"] != RESTORE_CAP:
            print(f"KNOB ⛔ RESTORE FAILED — Settings still reads {restored['chat_max_tool_rounds']}")


# ── roster ──────────────────────────────────────────────────────────────────────────────────────

def _openrouter_deepseek_ids(conn) -> tuple[list[str], bool]:
    from app.config import MODEL_CAPABILITIES  # noqa: PLC0415
    seed = sorted(k for k, v in MODEL_CAPABILITIES.items()
                  if k.startswith("deepseek/") and v.get("provider") == "openrouter")
    db = [r["model_id"] for r in kit._fetchall(
        conn, "SELECT model_id FROM model_capabilities_overrides WHERE removed = false AND model_id LIKE %s",
        ("deepseek/%",))]
    return sorted(set(seed) | set(db)), PROD_OPENROUTER_ID in db


def derive(conn, *, quiet: bool = False):
    import sc10_188_run_board as sc10  # noqa: PLC0415
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        roster, settings = b273.derive_roster(conn)
        ids, prod_in_db = _openrouter_deepseek_ids(conn)
        orow = next((r for r in roster if r["provider"] == "openrouter"), None)
        chosen = OPENROUTER_DEEPSEEK_PREFERRED if OPENROUTER_DEEPSEEK_PREFERRED in ids else (
            max(ids, key=sc10._version_key) if ids else None)
        print(f"ROSTER openrouter deepseek/* ids (seed ∪ DB overlay): {ids or 'NONE'}")
        if orow is not None:
            print(f"ROSTER openrouter row FORCED (D-22): derived newest={orow['model']} -> {chosen}")
            if chosen:
                orow.update({"model": chosen, "forced_from": orow["model"], "derive_blocked": None})
            else:
                orow["derive_blocked"] = "no registry-backed deepseek/* id for openrouter"
        extras = []
        if prod_in_db:
            extras.append((PROD_OPENROUTER_ID, "the production id, DB overlay"))
        else:
            print(f"ROSTER {PROD_OPENROUTER_ID} is NOT in the DB registry — no production-id extra row")
        derived = (orow or {}).get("forced_from")
        if derived and derived != chosen and str(derived).startswith("deepseek/") and derived != PROD_OPENROUTER_ID:
            extras.append((derived, "the derived newest openrouter id — the production model's family"))
        for mid, why in extras:
            roster.append({**(orow or {"provider": "openrouter"}), "model": mid,
                           "required": False, "extra": True, "forced_from": None, "derive_blocked": None})
            print(f"ROSTER extra row: openrouter {mid} ({why})")
        probe = sc10.probe_keys([r for r in roster if not r.get("derive_blocked")], settings)
    text = buf.getvalue()
    if not quiet:
        print(text)
    return roster, probe, text


def _blocked_reason(entry, probe, wanted) -> str | None:
    pid = entry["provider"]
    if entry.get("derive_blocked"):
        return entry["derive_blocked"]
    if not entry.get("required") and not entry.get("extra") and not (wanted and pid in wanted):
        return "extra (self-hosted) group — not one of the required 8; not driven unless named in --providers"
    if not probe.get(pid, {}).get("has_key"):
        return "no API key configured (override_provider returned settings unchanged)"
    return None


def _selected(roster, probe, wanted):
    for entry in roster:
        if wanted and entry["provider"] not in wanted:
            continue
        yield entry, _blocked_reason(entry, probe, wanted)


# ── per-run readers ─────────────────────────────────────────────────────────────────────────────

def _redis_events(run_id: str, after: str = "-") -> tuple[list[dict], str]:
    import redis  # noqa: PLC0415
    r = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"), decode_responses=True)
    start = after if after == "-" else f"({after}"
    entries = r.xrange(f"run:{run_id}", min=start)
    out, last = [], after
    for eid, fields in entries:
        last = eid
        try:
            ev = json.loads(fields.get("data", "{}"))
        except ValueError:
            continue
        out.append(ev)
    return out, last


def _run_row(conn, run_id) -> dict:
    row = kit._fetchone(conn, "SELECT run_id::text AS run_id, thread_id::text AS thread_id, status, model, provider, "
                              "continues_used, started_at FROM runs WHERE run_id = %s", (run_id,)) or {}
    return {k: (str(v) if k == "started_at" and v is not None else v) for k, v in row.items()}


def _carrier(conn, thread_id) -> list[dict] | None:
    row = kit._fetchone(conn, "SELECT tool_calls FROM messages WHERE thread_id = %s AND role = 'system' "
                              "AND tool_calls @> '[{\"kind\": \"iteration_cap_paused\"}]'::jsonb "
                              "ORDER BY created_at DESC LIMIT 1", (thread_id,))
    return row["tool_calls"] if row else None


def _log_confirms_text(log_path: str | None, run_id: str) -> bool | None:
    if not log_path:
        return None
    try:
        text = Path(log_path).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None
    return f"run={run_id}" in text and "text_tool_markup" in text


def _classify(status: str, carrier: list[dict] | None, log_hit: bool | None) -> str:
    if status != "cap_paused":
        return "prose-final" if status == "completed" else f"other ({status})"
    if not carrier:
        return "paused-no-carrier"
    named = [c for c in carrier if c.get("name")]
    if not named:
        return "empty-pause"
    if log_hit or all(_PARSED_ID.match(str(c.get("tool_call_id") or "")) for c in named):
        return "text-pause"
    return "structured-pause"


def _tool_starts(events: list[dict]) -> list[str]:
    return [e.get("name") for e in events if e.get("type") == "tool_start"]


def _markup_scan(conn, thread_ids: list[str]) -> list[dict]:
    from app.services.text_tool_calls import detect_markup  # noqa: PLC0415
    hits = []
    for tid in thread_ids:
        for m in kit._fetchall(conn, "SELECT id::text AS id, content FROM messages WHERE thread_id = %s "
                                     "AND role = 'assistant'", (tid,)):
            at = detect_markup(m["content"] or "")
            if at is not None:
                hits.append({"thread_id": tid, "message_id": m["id"], "offset": at,
                             "preview": (m["content"] or "")[max(0, at - 40):at + 80]})
    return hits


def _reload_equal(conn, base, h, thread_id) -> dict:
    r = kit._requests().get(f"{base}/threads/{thread_id}/messages", headers=h, timeout=30)
    if r.status_code != 200:
        return {"http": r.status_code, "equal": False, "compared": 0, "diffs": []}
    api = {m.get("id"): (m.get("content") or "") for m in r.json() if m.get("role") == "assistant"}
    db = {m["id"]: (m["content"] or "") for m in kit._fetchall(
        conn, "SELECT id::text AS id, content FROM messages WHERE thread_id = %s AND role = 'assistant'", (thread_id,))}
    diffs = [mid for mid in db if mid in api and api[mid] != db[mid]]
    missing = [mid for mid in db if mid not in api]
    return {"http": 200, "equal": not diffs, "compared": len([m for m in db if m in api]),
            "diffs": diffs, "db_rows_not_in_reload": missing}


def _new_thread(base, h, title) -> str:
    t = kit._requests().post(f"{base}/threads", headers=h, timeout=15, json={"title": title})
    t.raise_for_status()
    return t.json()["id"]


def _wait(conn, run_id, timeout) -> str:
    return b273._wait_run(conn, run_id, timeout)


# ── one pause + continue ────────────────────────────────────────────────────────────────────────

def _attempt(conn, base, h, entry, prompt, timeout, title, log_path) -> dict:
    thread_id = _new_thread(base, h, title)
    run_id, err = b273._send(base, h, thread_id, prompt, entry["model"], entry["provider"])
    if not run_id:
        return {"thread_id": thread_id, "error": err}
    status = _wait(conn, run_id, timeout)
    events, last = _redis_events(run_id)
    carrier = _carrier(conn, thread_id) if status == "cap_paused" else None
    row = _run_row(conn, run_id)
    from app.services.text_tool_calls import detect_markup  # noqa: PLC0415
    live_text = "".join(e.get("content") or "" for e in events if e.get("type") == "delta")
    return {
        "thread_id": thread_id, "run_id": run_id, "status": status, "run": row,
        "classification": _classify(status, carrier, _log_confirms_text(log_path, run_id)),
        "carrier": carrier, "tool_starts": _tool_starts(events),
        "event_types": sorted({e.get("type") for e in events if e.get("type")}),
        "cap_paused_event": next((e for e in events if e.get("type") == "cap_paused"), None),
        "live_markup_at": detect_markup(live_text), "live_preview": live_text[-300:],
        "redis_last_id": last,
    }


def _continue(conn, base, h, att: dict, timeout) -> dict:
    run_id = att["run_id"]
    before = _run_row(conn, run_id)
    r = kit._requests().post(f"{base}/runs/{run_id}/continue", headers=h, timeout=60)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text[:200]}
    status = _wait(conn, run_id, timeout) if r.status_code == 200 and body.get("status") == "ok" else None
    events, _ = _redis_events(run_id, att.get("redis_last_id") or "-")
    after = _run_row(conn, run_id)
    starts = _tool_starts(events)
    named = [c.get("name") for c in (att.get("carrier") or []) if c.get("name")]
    return {
        "http": r.status_code, "body": body, "status_after": status,
        "same_run_id": body.get("run_id") == run_id,
        "continues_used_before": before.get("continues_used"), "continues_used_after": after.get("continues_used"),
        "continues_used_plus_1": (after.get("continues_used") or 0) == (before.get("continues_used") or 0) + 1,
        "model_provider_unchanged": (before.get("model"), before.get("provider")) == (after.get("model"), after.get("provider")),
        "model_provider": [after.get("model"), after.get("provider")],
        "tool_starts_after_resume": starts,
        "carrier_first_call": named[0] if named else None,
        "queued_call_ran_first": (starts[:1] == named[:1]) if named else None,
        "events_after_resume": sorted({e.get("type") for e in events if e.get("type")}),
    }


def _drive_row(conn, base, h, entry, prompt, args, title) -> dict:
    attempts = []
    for i in range(1, ATTEMPTS + 1):
        att = _attempt(conn, base, h, entry, prompt, args.timeout, f"{title} #{i}", args.log)
        attempts.append(att)
        print(f"  attempt {i}: run={att.get('run_id')} status={att.get('status')} "
              f"class={att.get('classification')} tools={att.get('tool_starts')} {att.get('error') or ''}")
        if att.get("status") == "cap_paused":
            break
    paused = next((a for a in attempts if a.get("status") == "cap_paused"), None)
    cont = None
    if paused:
        cont = _continue(conn, base, h, paused, args.timeout)
        print(f"  continue: http={cont['http']} same_run={cont['same_run_id']} status={cont['status_after']} "
              f"continues_used {cont['continues_used_before']}->{cont['continues_used_after']} "
              f"model/provider unchanged={cont['model_provider_unchanged']} "
              f"first tool after resume={cont['tool_starts_after_resume'][:1]} carrier first={cont['carrier_first_call']}")
    threads = [a["thread_id"] for a in attempts if a.get("thread_id")]
    hits = _markup_scan(conn, threads)
    reloads = {t: _reload_equal(conn, base, h, t) for t in threads}
    tools_used = sorted({n for a in attempts for n in a.get("tool_starts") or []}
                        | set((cont or {}).get("tool_starts_after_resume") or []))
    return {"attempts": attempts, "paused": bool(paused), "continue": cont, "markup_hits": hits,
            "reload": reloads, "tools_used": tools_used}


def _verdict(res: dict) -> str:
    if res.get("blocked"):
        return "⛔"
    if res["markup_hits"] or not all(v["equal"] for v in res["reload"].values()):
        return "FAIL (SC#2)"
    c = res.get("continue")
    if not res["paused"]:
        return "OBSERVATION (prose-final on every attempt)"
    ok = (c and c["http"] == 200 and c["same_run_id"] and c["continues_used_plus_1"]
          and c["model_provider_unchanged"] and c["queued_call_ran_first"] is not False)
    return "PASS" if ok else "FAIL (SC#1)"


def _write(name: str, payload: dict) -> str:
    _BOARD.mkdir(parents=True, exist_ok=True)
    p = _BOARD / name
    p.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    return str(p.relative_to(_REPO)).replace("\\", "/")


def _summary_path() -> Path:
    return _EVIDENCE / "board-summary.json"


def _load_summary() -> dict:
    p = _summary_path()
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {"rows": [], "probes": {}}


def _save_summary(s: dict) -> None:
    s["markup_hits"] = sum(len(r.get("markup_hits") or []) for r in s["rows"]) + sum(
        len(p.get("markup_hits") or []) for p in s["probes"].values())
    s["threads_scanned"] = sorted({t for r in s["rows"] for t in (r.get("threads") or [])}
                                  | {t for p in s["probes"].values() for t in (p.get("threads") or [])})
    _summary_path().write_text(json.dumps(s, indent=2, default=str), encoding="utf-8")


# ── modes ───────────────────────────────────────────────────────────────────────────────────────

def run_board(token, org_id, conn, args) -> int:
    base, h = kit.base_url(), b273._headers(token, org_id)
    roster, probe, _ = derive(conn, quiet=True)
    wanted = set(filter(None, args.providers.split(","))) if args.providers else None
    summary = _load_summary()
    with _db_lock("board --run"), _low_cap(base, h, "board --run"):
        for entry, reason in _selected(roster, probe, wanted):
            label = f"{entry['provider']} {entry['model']}" + (" (extra)" if entry.get("extra") else "")
            row = {"provider": entry["provider"], "model": entry["model"], "required": entry.get("required"),
                   "extra": bool(entry.get("extra")), "calling_mode": entry.get("calling_mode")}
            if reason:
                row.update({"blocked": reason, "verdict": "⛔"})
                print(f"BOARD {label} ⛔ {reason}")
            else:
                print(f"BOARD {label}")
                res = _drive_row(conn, base, h, entry, BOARD_PROMPT, args, f"292.1 board {entry['provider']}")
                first = next((a for a in res["attempts"] if a.get("status") == "cap_paused"), res["attempts"][-1])
                row.update({
                    "verdict": _verdict(res), "classification": first.get("classification"),
                    "run_id": first.get("run_id"), "thread_id": first.get("thread_id"),
                    "attempts": len(res["attempts"]), "continue": res["continue"],
                    "markup_hits": res["markup_hits"], "tools_used": res["tools_used"],
                    "threads": [a["thread_id"] for a in res["attempts"] if a.get("thread_id")],
                    "reload_equal": all(v["equal"] for v in res["reload"].values()),
                })
                row["evidence"] = _write(f"{entry['provider']}{'-extra' if entry.get('extra') else ''}-"
                                         f"{first.get('run_id') or 'nosend'}.json",
                                         {"entry": {k: entry.get(k) for k in ("provider", "model", "calling_mode",
                                                                              "required", "extra", "forced_from")},
                                          "prompt": BOARD_PROMPT, **res})
                print(f"BOARD {label} -> {row['verdict']} class={row['classification']} evidence={row['evidence']}")
            summary["rows"] = [r for r in summary["rows"]
                               if (r["provider"], r["model"]) != (row["provider"], row["model"])] + [row]
            _save_summary(summary)
    _print_table(summary)
    return 0


def _print_table(summary) -> None:
    print("\nBOARD_TABLE")
    print("| Provider | Model | Mode | Class | Continue (same run / +1 / model kept / queued first) | Markup | Verdict |")
    print("|---|---|---|---|---|---|---|")
    for r in summary["rows"]:
        if r.get("blocked"):
            print(f"| {r['provider']} | {r['model']} | {r.get('calling_mode') or '—'} | — | — | — | ⛔ {r['blocked']} |")
            continue
        c = r.get("continue") or {}
        cc = (f"{c.get('same_run_id')} / {c.get('continues_used_before')}→{c.get('continues_used_after')} / "
              f"{c.get('model_provider_unchanged')} / {c.get('queued_call_ran_first')}") if c else "—"
        print(f"| {r['provider']}{' (extra)' if r.get('extra') else ''} | {r['model']} | {r.get('calling_mode')} | "
              f"{r.get('classification')} | {cc} | {len(r.get('markup_hits') or [])} | {r['verdict']} |")
    print(f"\nmarkup_hits total = {summary.get('markup_hits')}")


def _deepseek_entries(roster, probe):
    out = []
    for pid, pred in (("deepseek", lambda e: True), ("openrouter", lambda e: str(e["model"]).startswith("deepseek/"))):
        for e in roster:
            if e["provider"] == pid and pred(e) and not _blocked_reason(e, probe, {pid}):
                out.append(e)
    return out


def typed_continue(token, org_id, conn, args) -> int:
    base, h = kit.base_url(), b273._headers(token, org_id)
    roster, probe, _ = derive(conn, quiet=True)
    summary = _load_summary()
    result = {"attempts": [], "threads": []}
    with _db_lock("board --typed-continue"), _low_cap(base, h, "board --typed-continue"):
        for entry in _deepseek_entries(roster, probe):
            for i in range(1, ATTEMPTS + 1):
                att = _attempt(conn, base, h, entry, BOARD_PROMPT, args.timeout,
                               f"292.1 typed-continue {entry['provider']} #{i}", args.log)
                result["attempts"].append({k: att.get(k) for k in ("thread_id", "run_id", "status", "classification")}
                                          | {"provider": entry["provider"], "model": entry["model"]})
                result["threads"].append(att["thread_id"])
                print(f"TYPED {entry['provider']} attempt {i}: status={att.get('status')} class={att.get('classification')}")
                if att.get("status") != "cap_paused":
                    continue
                tid, rid = att["thread_id"], att["run_id"]
                n_user = kit._fetchone(conn, "SELECT count(*) AS n FROM messages WHERE thread_id = %s AND role = 'user'", (tid,))["n"]
                n_runs = kit._fetchone(conn, "SELECT count(*) AS n FROM runs WHERE thread_id = %s", (tid,))["n"]
                used = _run_row(conn, rid).get("continues_used")
                r = kit._requests().post(f"{base}/threads/{tid}/messages", headers=h, timeout=60, json={"content": "continue"})
                body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text[:200]}
                status = _wait(conn, rid, args.timeout) if body.get("continued") else None
                n_user2 = kit._fetchone(conn, "SELECT count(*) AS n FROM messages WHERE thread_id = %s AND role = 'user'", (tid,))["n"]
                n_runs2 = kit._fetchone(conn, "SELECT count(*) AS n FROM runs WHERE thread_id = %s", (tid,))["n"]
                used2 = _run_row(conn, rid).get("continues_used")
                probe_res = {
                    "provider": entry["provider"], "model": entry["model"], "thread_id": tid, "paused_run_id": rid,
                    "http": r.status_code, "body": body, "continued": body.get("continued") is True,
                    "same_run_id": body.get("run_id") == rid, "message_id_null": body.get("message_id", "x") is None,
                    "user_rows_before_after": [n_user, n_user2], "runs_rows_before_after": [n_runs, n_runs2],
                    "continues_used_before_after": [used, used2], "status_after": status,
                }
                ok = (r.status_code == 200 and probe_res["continued"] and probe_res["same_run_id"]
                      and n_user2 == n_user and n_runs2 == n_runs and (used2 or 0) == (used or 0) + 1)
                probe_res["verdict"] = "PASS" if ok else "FAIL (SC#3)"
                result["probe"] = probe_res
                print(f"TYPED probe -> {probe_res['verdict']} http={r.status_code} continued={probe_res['continued']} "
                      f"same_run={probe_res['same_run_id']} user rows {n_user}->{n_user2} runs {n_runs}->{n_runs2} "
                      f"continues_used {used}->{used2}")
                break
            if result.get("probe"):
                break
    if not result.get("probe"):
        result["verdict"] = "OWED (no DeepSeek row paused in 3 attempts each)"
        print(f"TYPED {result['verdict']}")
    result["markup_hits"] = _markup_scan(conn, result["threads"])
    result["evidence"] = _write("typed-continue.json", result)
    summary["probes"]["typed_continue"] = result
    _save_summary(summary)
    return 0


def run_long(token, org_id, conn, args) -> int:
    base, h = kit.base_url(), b273._headers(token, org_id)
    roster, probe, _ = derive(conn, quiet=True)
    target = (args.providers or "deepseek").split(",")[0]
    entry = next((e for e in roster if e["provider"] == target and not e.get("extra")), None)
    if not entry or _blocked_reason(entry, probe, {target}):
        raise SystemExit(f"--long: no drivable row for {target}")
    filler = "\n".join(
        f"- Milestone {i}: Q{(i % 4) + 1} 2026 — workstream {chr(65 + i % 6)} delivers deliverable {i} "
        f"after review by the steering group; dependencies: milestone {max(1, i - 1)}; risk: medium; "
        f"owner: team {chr(70 + i % 5)}." for i in range(1, 41))
    prompt = f"Here is our project plan, inlined in full.\n\n{filler}\n\n{BOARD_PROMPT}"
    assert len(prompt.encode("utf-8")) >= 5 * 1024, "the long prompt must be >= 5 KB"
    summary = _load_summary()
    with _db_lock("board --long"), _low_cap(base, h, "board --long"):
        res = _drive_row(conn, base, h, entry, prompt, args, f"292.1 long {target}")
    first = next((a for a in res["attempts"] if a.get("status") == "cap_paused"), res["attempts"][-1])
    out = {"provider": target, "model": entry["model"], "prompt_bytes": len(prompt.encode("utf-8")),
           "verdict": _verdict(res), "classification": first.get("classification"), "run_id": first.get("run_id"),
           "continue": res["continue"], "markup_hits": res["markup_hits"],
           "threads": [a["thread_id"] for a in res["attempts"] if a.get("thread_id")]}
    out["evidence"] = _write(f"long-{target}-{first.get('run_id')}.json", {**out, "prompt": prompt[:600] + "…", **res})
    summary["probes"]["long"] = out
    _save_summary(summary)
    print(f"LONG {target} {entry['model']} {out['prompt_bytes']} B -> {out['verdict']} class={out['classification']}")
    return 0


def run_parallel(token, org_id, conn, args) -> int:
    base, h = kit.base_url(), b273._headers(token, org_id)
    roster, probe, _ = derive(conn, quiet=True)
    target = (args.providers or "deepseek").split(",")[0]
    entry = next((e for e in roster if e["provider"] == target and not e.get("extra")), None)
    if not entry or _blocked_reason(entry, probe, {target}):
        raise SystemExit(f"--parallel: no drivable row for {target}")
    summary = _load_summary()
    with _db_lock("board --parallel"), _low_cap(base, h, "board --parallel"):
        a = _attempt(conn, base, h, entry, BOARD_PROMPT, args.timeout, f"292.1 parallel A {target}", args.log)
        tb = _new_thread(base, h, f"292.1 parallel B {target}")
        cont_http, b_run = None, None
        if a.get("status") == "cap_paused":
            r = kit._requests().post(f"{base}/runs/{a['run_id']}/continue", headers=h, timeout=60)
            cont_http = r.status_code
        b_run, err = b273._send(base, h, tb, PARALLEL_B_PROMPT, entry["model"], entry["provider"])
        a_final = _wait(conn, a["run_id"], args.timeout)
        b_final = _wait(conn, b_run, args.timeout) if b_run else err
        ra, rb = _run_row(conn, a["run_id"]), (_run_row(conn, b_run) if b_run else {})
    out = {"provider": target, "model": entry["model"], "thread_a": a["thread_id"], "run_a": a["run_id"],
           "a_first_status": a.get("status"), "a_continue_http": cont_http, "a_final": a_final,
           "thread_b": tb, "run_b": b_run, "b_final": b_final,
           "a_in_own_thread": ra.get("thread_id") == a["thread_id"], "b_in_own_thread": rb.get("thread_id") == tb,
           "threads": [a["thread_id"], tb]}
    out["markup_hits"] = _markup_scan(conn, out["threads"])
    ok = out["a_in_own_thread"] and out["b_in_own_thread"] and b_run and not out["markup_hits"]
    out["verdict"] = ("PASS" if ok and a.get("status") == "cap_paused" and cont_http == 200
                      else ("OBSERVATION (A did not pause; B still accepted)" if ok else "FAIL"))
    out["evidence"] = _write(f"parallel-{target}.json", out)
    summary["probes"]["parallel"] = out
    _save_summary(summary)
    print(f"PARALLEL {target}: A {a.get('status')}→continue {cont_http}→{a_final}; B {b_final}; "
          f"own threads A={out['a_in_own_thread']} B={out['b_in_own_thread']} -> {out['verdict']}")
    return 0


def reload_check(token, org_id, conn, args) -> int:
    base, h = kit.base_url(), b273._headers(token, org_id)
    summary = _load_summary()
    threads = summary.get("threads_scanned") or []
    if not threads:
        print("RELOAD no board threads in evidence/board-summary.json yet")
        return 1
    hits = _markup_scan(conn, threads)
    bad = {}
    for t in threads:
        r = _reload_equal(conn, base, h, t)
        if not r["equal"] or r["http"] != 200:
            bad[t] = r
    print(f"RELOAD threads={len(threads)} markup_hits={len(hits)} reload_mismatches={len(bad)}")
    (_EVIDENCE / "reload-check.json").write_text(json.dumps(
        {"at": time.strftime("%Y-%m-%dT%H:%M:%S"), "threads": threads, "markup_hits": hits, "mismatches": bad},
        indent=2, default=str), encoding="utf-8")
    return 0 if not hits and not bad else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    for m in ("roster", "run", "typed-continue", "long", "parallel", "reload-check"):
        g.add_argument(f"--{m}", action="store_true")
    ap.add_argument("--providers", default="")
    ap.add_argument("--timeout", type=int, default=420)
    ap.add_argument("--log", default=None, help="uvicorn log path: confirms a text-pause by its WARNING line")
    args = ap.parse_args()
    kit.load_env()
    kit.assert_localhost_only()
    b273._assert_local_db()
    conn = kit.connect_db()
    conn.autocommit = True
    if args.roster:
        _, _, text = derive(conn)
        _EVIDENCE.mkdir(parents=True, exist_ok=True)
        (_EVIDENCE / "roster.txt").write_text(text, encoding="utf-8")
        print(f"wrote {(_EVIDENCE / 'roster.txt').relative_to(_REPO)}")
        return 0
    token = kit.get_bearer_token()
    user_id = b273._user_id(token)
    org_id = b273._single_org(conn, user_id)
    print(f"dev user {user_id} · single org {org_id} (asserted from org_members)")
    if args.typed_continue:
        return typed_continue(token, org_id, conn, args)
    if args.long:
        return run_long(token, org_id, conn, args)
    if args.parallel:
        return run_parallel(token, org_id, conn, args)
    if args.reload_check:
        return reload_check(token, org_id, conn, args)
    return run_board(token, org_id, conn, args)


if __name__ == "__main__":
    sys.exit(main())
