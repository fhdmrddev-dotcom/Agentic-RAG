"""run-273-board.py — Phase 273 (273-06) SC#10 cross-provider board for agent-authored artifacts (D-21).

Four modes, all against the LOCAL stack only (the conc_probe localhost hard-gate runs before any
request, and the DB DSN is asserted to be 127.0.0.1 / localhost):

  --roster   Print the EFFECTIVE roster derivation and exit. Effective = the ``MODEL_CAPABILITIES``
             seed overlaid by ``public.model_capabilities_overrides`` through the SAME union the
             Model Registry screen uses (``app.services.model_registry.build_model_registry_rows``),
             keeping rows that are enabled, not deprecated and not removed, then the newest id per
             provider by ``sc10_188_run_board._version_key`` (ties: last-declared, every tied id
             printed). The overlay read is cross-checked against a direct SQL count, because
             ``load_all_model_overrides`` never raises and returns an EMPTY cache on a DB blip — a
             seed-only roster would otherwise look exactly like a real one.
             Required rows: the 7 native providers + OpenRouter. Any other derived group (self-hosted)
             is listed as an EXTRA row, ⛔ unless named in ``--providers``.

  --seed     As the dev user (real GoTrue password-grant JWT) with an explicit ``X-Org-Id`` after
             asserting from ``org_members`` that the user is in exactly ONE org: upload the spreadsheet
             fixture ``273-board-revenue.csv`` (16 rows, quarter × region, distinct revenue values;
             idempotent by filename), wait for ingestion, and assert that the REAL ``query_tables``
             handler reads all 16 rows back.

  --run      Per derived row: a fresh thread; prompt A (inline CSV ≥ 5 KB with a notes column — also
             the long-message axis) then prompt B in the SAME thread; per-request ``model`` +
             ``provider`` (no global setting is mutated). Per run it collects ``messages.tool_calls``,
             the thread's ``message_artifacts`` rows, the ``runs`` row and the Redis ``run:{run_id}``
             stream (read immediately after the run: ``delta`` text + ``artifact`` events), then
             GET ``/threads/{id}/messages`` as the dev user and stores every returned artifact item
             verbatim under ``reload_artifacts`` (the input of ``frontend/uat/273-board-render.test.ts``).
             One JSON per run under ``evidence/board/``; BOARD_TABLE printed at the end.

  --observe  STRUCTURED-path observations (plan-check WARNING 9) on ONE row (default openrouter), each
             in a fresh thread: (i) a ``search_documents`` turn, (ii) a non-tool ```json reply. Records
             the persisted tool calls, the concatenated Redis ``delta`` text and the persisted content.

Verdicts — 273-06 must_haves, applied literally and read from PERSISTED data, never the transcript:
  V1 emitted   run A has a ``show_artifact`` call with status ``done`` whose result is not a refusal
               and names an artifact id, AND a ``message_artifacts`` row carries run A's ``run_id``.
  V2 rendered  (board half) every ``reload_artifacts`` item is a record, never ``{missing: true}``, and
               the count equals the thread's ``message_artifacts`` rows. The frontend-guard half
               (vitest) and the Chrome reload half are scored in 273-VALIDATION.md, not here.
  V3 by-ref    run B created a NEW row whose ``parent_id`` is run A's artifact AND run B made ZERO
               data-bearing / retrieval / ``execute_code`` calls.
  LEAK         (SC#2 on STRUCTURED rows; recorded as an observation on native rows) no Redis ``delta``
               of either run contains ``show_artifact`` or ``"rows"``, and no persisted assistant
               content holds a ```json block.

Usage (backend venv, repo root; the operator runs uvicorn):
    backend/venv/Scripts/python.exe scripts/run-273-board.py --roster
    backend/venv/Scripts/python.exe scripts/run-273-board.py --seed
    backend/venv/Scripts/python.exe scripts/run-273-board.py --run [--providers openai,google]
    backend/venv/Scripts/python.exe scripts/run-273-board.py --observe [--providers openrouter]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
import time
from pathlib import Path

try:  # ⛔ / ✅ in the output — never let a cp1252 console kill the run
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover
    pass

_REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO / "scripts"))
sys.path.insert(0, str(_REPO / "backend"))

import conc_probe as kit  # noqa: E402

_PHASE_DIR = _REPO / ".planning" / "phases" / "273-agent-authored-artifacts"
_EVIDENCE = _PHASE_DIR / "evidence" / "board"

# The 7 native providers + OpenRouter (CLAUDE.md roster rule). The GROUPS are derived from the
# registry; this set only decides which derived groups are REQUIRED rows vs extra rows, and a
# required provider absent from the derivation is printed ⛔ rather than silently missing.
REQUIRED_PROVIDERS = ("openai", "anthropic", "google", "deepseek", "zhipu", "minimax", "moonshot", "openrouter")
# Served by always-native SDK adapters (agent_loop WR-05 boundary): never STRUCTURED.
_NATIVE_SDK = {"anthropic", "google"}

FIXTURE_NAME = "273-board-revenue.csv"
QUARTERS = ("Q1", "Q2", "Q3", "Q4")
REGIONS = ("North", "South", "East", "West")
# 16 distinct revenue values (USD thousands), quarter-major. Distinct so a tooltip value names its cell.
REVENUE = {
    ("Q1", "North"): 1210, ("Q1", "South"): 980, ("Q1", "East"): 1335, ("Q1", "West"): 1104,
    ("Q2", "North"): 1268, ("Q2", "South"): 1017, ("Q2", "East"): 1392, ("Q2", "West"): 1151,
    ("Q3", "North"): 1342, ("Q3", "South"): 1076, ("Q3", "East"): 1459, ("Q3", "West"): 1203,
    ("Q4", "North"): 1415, ("Q4", "South"): 1129, ("Q4", "East"): 1532, ("Q4", "West"): 1288,
}
assert len(set(REVENUE.values())) == 16

_NOTE = (
    "{q} {r}: revenue recognised on signed contracts only; renewals booked in the quarter they were "
    "invoiced; one-off project work excluded from the recurring figure; FX translated at the quarter-end "
    "rate; figures are unaudited management accounts and may be restated after the year-end close; "
    "regional allocation follows the billing address of the contracting entity, not the delivery site."
)


def fixture_csv(with_notes: bool) -> str:
    head = "quarter,region,revenue_usd_k" + (",notes" if with_notes else "")
    lines = [head]
    for q in QUARTERS:
        for r in REGIONS:
            row = f"{q},{r},{REVENUE[(q, r)]}"
            if with_notes:
                row += ',"' + _NOTE.format(q=q, r=r) + '"'
            lines.append(row)
    return "\n".join(lines) + "\n"


PROMPT_A = (
    "Here is our FY25 revenue by region and quarter:\n\n```csv\n{csv}```\n\n"
    "Show it as a line chart."
)
PROMPT_B = "Make it a bar chart and show only Q3."
OBSERVE_PROMPTS = {
    "search": "What does our onboarding guide say about laptop setup?",
    "json": "Show me an example retention config as a JSON code block — do not call any tool.",
}

# V3's forbidden set: run-272's retrieval list + execute_code, widened by 273-03's DATA_BEARING_TOOLS
# (query_tables / query_documents_by_view / web_search are re-reads of data too). Stricter, never looser.
_RETRIEVAL_272 = {
    "search_documents", "grep", "grep_documents", "query_documents", "read_document",
    "analyze_document", "get_document", "fetch_document", "list_documents",
}

_JSON_FENCE = re.compile(r"```json", re.I)


# ── shared helpers (the run-272 skeleton) ───────────────────────────────────────────────────────

def _headers(token: str, org_id: str) -> dict:
    return {"Authorization": f"Bearer {token}", "X-Org-Id": org_id}


def _single_org(conn, user_id: str) -> str:
    rows = kit._fetchall(conn, "SELECT org_id::text AS org_id FROM org_members WHERE user_id = %s", (user_id,))
    if len(rows) != 1:
        raise SystemExit(f"dev user is in {len(rows)} orgs — refusing (an absence would be vacuous)")
    return rows[0]["org_id"]


def _user_id(token: str) -> str:
    import base64
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload))["sub"]


def _assert_local_db() -> None:
    dsn = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_DSN") or kit.DEFAULT_DB_URL
    if not re.search(r"@(127\.0\.0\.1|localhost):", dsn):
        raise SystemExit("REFUSING: the DB DSN is not 127.0.0.1/localhost (T-273-31)")
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    if not re.search(r"//([^@/]*@)?(127\.0\.0\.1|localhost)[:/]", redis_url + "/"):
        raise SystemExit("REFUSING: REDIS_URL is not 127.0.0.1/localhost (T-273-31)")


def _wait_run(conn, run_id: str, timeout: int) -> str:
    deadline = time.time() + timeout
    status = None
    while time.time() < deadline:
        row = kit._fetchone(conn, "SELECT status FROM runs WHERE run_id = %s", (run_id,))
        status = row["status"] if row else None
        if status and status != "streaming":
            return status
        time.sleep(2)
    return f"NOT TERMINAL ({status})"


# ── roster ──────────────────────────────────────────────────────────────────────────────────────

async def _effective_async() -> dict:
    from app.config import get_model_capability_async  # noqa: PLC0415
    from app.models.user_settings import load_all_model_overrides, load_app_settings_async  # noqa: PLC0415
    from app.services.model_registry import build_model_registry_rows  # noqa: PLC0415

    settings = await load_app_settings_async()
    overrides = await load_all_model_overrides()
    rows = await build_model_registry_rows()
    for r in rows:  # warm the sync override cache resolve_calling_mode reads
        try:
            await get_model_capability_async(r["model_id"])
        except Exception:  # pragma: no cover
            pass
    return {"settings": settings, "overrides": overrides, "rows": rows}


def derive_roster(conn) -> tuple[list[dict], object]:
    import sc10_188_run_board as sc10  # noqa: PLC0415
    from app.config import MODEL_CAPABILITIES  # noqa: PLC0415
    from app.models.user_settings import override_provider  # noqa: PLC0415
    from app.services.openai_service import CallingMode, resolve_calling_mode  # noqa: PLC0415

    eff = asyncio.run(_effective_async())
    settings, overrides, rows = eff["settings"], eff["overrides"], eff["rows"]

    direct = kit._fetchone(conn, "SELECT count(*) AS n FROM model_capabilities_overrides WHERE removed = false", ())
    print(f"ROSTER overlay rows read by load_all_model_overrides: {len(overrides)} · direct SQL (removed=false): {direct['n']}")
    if len(overrides) != direct["n"]:
        raise SystemExit("ROSTER the overlay read does not match the table — refusing a seed-only roster")
    print(f"ROSTER seed ids (MODEL_CAPABILITIES): {len(MODEL_CAPABILITIES)} · union rows: {len(rows)}")

    eligible = [r for r in rows if r["enabled"] and not r["deprecated"]]
    print(f"ROSTER eligible (enabled, not deprecated, not removed): {len(eligible)}")
    groups: dict[str, list[dict]] = {}
    for r in eligible:
        groups.setdefault(str(r["provider"]), []).append(r)

    roster: list[dict] = []
    for provider in sorted(set(groups) | set(REQUIRED_PROVIDERS)):
        pool = groups.get(provider, [])
        required = provider in REQUIRED_PROVIDERS
        if not pool:
            roster.append({"provider": provider, "model": "—", "required": required, "source": "—",
                           "tied": [], "group_size": 0, "native_tools": None, "emit_tier": None,
                           "derive_blocked": "no enabled, non-deprecated id in the effective registry"})
            continue
        top = max(sc10._version_key(r["model_id"]) for r in pool)
        tied = [r for r in pool if sc10._version_key(r["model_id"]) == top]
        chosen = tied[-1]
        roster.append({
            "provider": provider, "model": chosen["model_id"], "required": required,
            "source": "overlay (DB-only row)" if chosen["model_id"] not in MODEL_CAPABILITIES
            else ("seed + overlay" if chosen["capability_source"] == "db_override" else "seed"),
            "capability_source": chosen["capability_source"],
            "tied": [r["model_id"] for r in tied], "group_size": len(pool),
            "native_tools": chosen["native_tools"], "emit_tier": chosen["emit_tier"],
        })

    for entry in roster:
        if entry.get("derive_blocked"):
            entry["calling_mode"] = "—"
            continue
        pid = entry["provider"]
        ov = override_provider(settings, pid)
        if pid in _NATIVE_SDK:
            mode = "NATIVE (native SDK adapter)"
        else:
            m = resolve_calling_mode(entry["model"], ov)
            mode = "STRUCTURED" if m == CallingMode.STRUCTURED else "NATIVE"
        entry["calling_mode"] = mode
    strategy = getattr(settings, "openrouter_tool_strategy", "quality")
    print(f"ROSTER openrouter_tool_strategy (app settings) = {strategy!r}")
    print(f"ROSTER groups={len(roster)} (required {sum(r['required'] for r in roster)}, "
          f"extra {sum(not r['required'] for r in roster)})")
    for r in roster:
        tie = f" tied_with={r['tied']}" if len(r["tied"]) > 1 else ""
        tag = "REQUIRED" if r["required"] else "EXTRA"
        print(f"ROSTER {tag:8} provider={r['provider']:<10} newest={r['model']} source={r['source']} "
              f"native_tools={r['native_tools']} emit_tier={r['emit_tier']} "
              f"predicted_calling_mode={r['calling_mode']} ids_in_group={r['group_size']}{tie}"
              + (f" ⛔ {r['derive_blocked']}" if r.get("derive_blocked") else ""))
    structured = [r["provider"] for r in roster if r["calling_mode"] == "STRUCTURED"]
    print(f"ROSTER rows predicted STRUCTURED: {structured or 'NONE'}")
    if not structured:
        print("ROSTER ⚠ no derived row is predicted STRUCTURED — the live SC#2 holdback check needs a "
              "STRUCTURED row; see 273-UAT-LOG.md (the plan assumed OpenRouter is STRUCTURED).")
    # Every eligible id that WOULD route STRUCTURED with a per-request model + provider (no setting
    # mutated) — the candidates for the --observe / leak probe when no derived row is STRUCTURED.
    cands = []
    for r in eligible:
        pid = str(r["provider"])
        if pid in _NATIVE_SDK:
            continue
        ov = override_provider(settings, pid)
        if getattr(ov, "active_provider", "") != pid:
            continue  # no key — would silently run on another provider
        if resolve_calling_mode(r["model_id"], ov) == CallingMode.STRUCTURED:
            cands.append(f"{pid}:{r['model_id']}")
    print(f"ROSTER STRUCTURED-routing candidates (keyed, enabled, any group): {cands or 'NONE'}")
    print()
    return roster, settings


# ── --seed ──────────────────────────────────────────────────────────────────────────────────────

def seed(token: str, org_id: str, user_id: str, conn) -> int:
    requests = kit._requests()
    base = kit.base_url()
    h = _headers(token, org_id)
    row = kit._fetchone(conn, "SELECT id::text AS id FROM documents WHERE user_id = %s AND filename = %s "
                              "AND is_latest = true", (user_id, FIXTURE_NAME))
    if row:
        doc_id = row["id"]
        print(f"SEED {FIXTURE_NAME} exists id={doc_id}")
    else:
        r = requests.post(f"{base}/documents/upload", headers=h, timeout=60,
                          files={"file": (FIXTURE_NAME, fixture_csv(False).encode("utf-8"), "text/csv")})
        print(f"SEED upload {FIXTURE_NAME} HTTP {r.status_code}")
        r.raise_for_status()
        doc_id = r.json()["id"]
    deadline = time.time() + 300
    status = None
    while time.time() < deadline:
        status = (kit._fetchone(conn, "SELECT status FROM documents WHERE id = %s", (doc_id,)) or {}).get("status")
        if status in ("completed", "failed"):
            break
        time.sleep(2)
    print(f"SEED ingestion status={status}")
    if status != "completed":
        return 1
    tables = kit._fetchall(conn, "SELECT table_index, headers, jsonb_array_length(rows) AS n FROM document_tables "
                                 "WHERE document_id = %s ORDER BY table_index", (doc_id,))
    print(f"SEED document_tables: {[(t['table_index'], t['headers'], t['n']) for t in tables]}")

    from app.dependencies import get_supabase  # noqa: PLC0415
    from app.services.multimodal_service import handle_query_tables  # noqa: PLC0415
    out = json.loads(asyncio.run(handle_query_tables({"document_name": FIXTURE_NAME}, user_id, get_supabase())))
    if isinstance(out, dict) and out.get("error"):
        print(f"SEED query_tables ERROR: {out['error']}")
        return 1
    got = {}
    for tbl in out:
        hdr = [str(x).strip().lower() for x in tbl["headers"]]
        try:
            qi, ri, vi = hdr.index("quarter"), hdr.index("region"), hdr.index("revenue_usd_k")
        except ValueError:
            continue
        for rw in tbl["rows"]:
            got[(str(rw[qi]), str(rw[ri]))] = str(rw[vi])
    ok = len(got) == 16 and all(str(v) == got.get(k, "").replace(",", "").split(".")[0] for k, v in REVENUE.items())
    print(f"SEED query_tables read {len(got)} rows · all 16 values equal the fixture: {ok}")
    return 0 if ok else 1


# ── --run ───────────────────────────────────────────────────────────────────────────────────────

def _redis_events(run_id: str) -> dict:
    import redis  # noqa: PLC0415
    r = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"), decode_responses=True)
    entries = r.xrange(f"run:{run_id}")
    ttl = r.ttl(f"run:{run_id}")
    deltas, types, artifacts = [], {}, 0
    for _id, fields in entries:
        try:
            ev = json.loads(fields.get("data", "{}"))
        except ValueError:
            continue
        t = ev.get("type")
        types[t] = types.get(t, 0) + 1
        if t == "delta":
            deltas.append(ev.get("content") or "")
        elif t == "artifact":
            artifacts += 1
    text = "".join(deltas)
    return {"present": bool(entries), "ttl": ttl, "event_types": types, "delta_count": len(deltas),
            "delta_text": text, "artifact_events": artifacts}


def _run_messages(conn, thread_id: str, started_at, until) -> list[dict]:
    sql = ("SELECT id::text AS id, role, content, tool_calls, created_at FROM messages WHERE thread_id = %s "
           "AND role = 'assistant' AND created_at >= %s" + (" AND created_at < %s" if until else "") +
           " ORDER BY created_at")
    params = (thread_id, started_at) + ((until,) if until else ())
    return kit._fetchall(conn, sql, params)


def _artifacts(conn, thread_id: str) -> list[dict]:
    return kit._fetchall(conn, "SELECT id, label, component, parent_id, run_id::text AS run_id, tool_call_id, "
                               "row_count, caption, created_at::text AS at FROM message_artifacts "
                               "WHERE thread_id = %s ORDER BY created_at", (thread_id,))


def _send(base, h, thread_id, content, model, provider) -> tuple[str | None, str]:
    requests = kit._requests()
    r = requests.post(f"{base}/threads/{thread_id}/messages", headers=h, timeout=60,
                      json={"content": content, "model": model, "provider": provider})
    if r.status_code not in (200, 201):
        return None, f"send HTTP {r.status_code}: {r.text[:200]}"
    return r.json().get("run_id"), ""


def _drive_turn(conn, base, h, thread_id, content, entry, timeout) -> dict:
    from app.models.artifact import is_refusal_result  # noqa: PLC0415
    from app.services.artifact_history import _artifact_id  # noqa: PLC0415

    run_id, err = _send(base, h, thread_id, content, entry["model"], entry["provider"])
    if not run_id:
        return {"error": err}
    status = _wait_run(conn, run_id, timeout)
    redis_ev = _redis_events(run_id)  # immediately after the run — TTL 600 s on completed
    run = kit._fetchone(conn, "SELECT status, model, provider, error, started_at, completed_at "
                              "FROM runs WHERE run_id = %s", (run_id,))
    msgs = _run_messages(conn, thread_id, run["started_at"], None)
    calls = [tc for m in msgs for tc in (m["tool_calls"] or [])]
    show = [tc for tc in calls if tc.get("name") == "show_artifact"]
    refused = [tc for tc in show if is_refusal_result(tc.get("result"))]
    ok_ids = [_artifact_id(tc.get("result")) for tc in show
              if tc.get("status") == "done" and not is_refusal_result(tc.get("result"))]
    content_all = "\n".join((m["content"] or "") for m in msgs)
    final = (msgs[-1]["content"] or "").strip() if msgs else ""
    return {
        "run_id": run_id, "run_status": status,
        "run": {k: (str(v) if v is not None else None) for k, v in (run or {}).items()},
        "assistant_messages": [{"id": m["id"], "content": m["content"], "tool_calls": m["tool_calls"]} for m in msgs],
        "tool_call_names": [tc.get("name") for tc in calls],
        "show_artifact_calls": len(show), "refused_calls": len(refused),
        "artifact_ids_from_results": [i for i in ok_ids if i],
        "final_answer_empty": final == "",
        "final_answer_is_fallback": "never wrote an answer" in final,
        "persisted_json_fence": bool(_JSON_FENCE.search(content_all)),
        "redis": redis_ev,
    }


def _reload(base, h, thread_id) -> tuple[int, list, list]:
    requests = kit._requests()
    r = requests.get(f"{base}/threads/{thread_id}/messages", headers=h, timeout=30)
    if r.status_code != 200:
        return r.status_code, [], []
    flat, by_msg = [], []
    for m in r.json():
        if m.get("role") != "assistant":
            continue
        arts = m.get("artifacts")
        by_msg.append({"message_id": m.get("id"), "artifacts": arts})
        flat.extend(arts or [])
    return 200, flat, by_msg


def _leak(turn: dict) -> list[str]:
    out = []
    text = (turn.get("redis") or {}).get("delta_text", "")
    if "show_artifact" in text:
        out.append("delta carries 'show_artifact'")
    if '"rows"' in text:
        out.append("delta carries '\"rows\"'")
    if turn.get("persisted_json_fence"):
        out.append("persisted content holds a ```json block")
    if not (turn.get("redis") or {}).get("present"):
        out.append("Redis stream absent (expired?) — leak probe NOT measured")
    return out


def run_board(token: str, org_id: str, conn, args) -> int:
    import sc10_188_run_board as sc10  # noqa: PLC0415
    from app.services.show_artifact_tool import DATA_BEARING_TOOLS  # noqa: PLC0415

    forbidden = set(DATA_BEARING_TOOLS) | _RETRIEVAL_272 | {"execute_code"}
    base = kit.base_url()
    h = _headers(token, org_id)
    roster, settings = derive_roster(conn)
    probe = sc10.probe_keys([r for r in roster if not r.get("derive_blocked")], settings)
    wanted = set(filter(None, args.providers.split(","))) if args.providers else None
    out = _EVIDENCE.parent / args.out
    out.mkdir(parents=True, exist_ok=True)
    prompt_a = PROMPT_A.format(csv=fixture_csv(True))
    print(f"BOARD prompt A = {len(prompt_a.encode('utf-8'))} bytes (long-message axis needs >= 5120)")
    assert len(prompt_a.encode("utf-8")) >= 5120
    print(f"BOARD V3 forbidden tools: {sorted(forbidden)}")

    table = []
    for entry in roster:
        pid = entry["provider"]
        row = {"provider": pid, "model": entry["model"], "required": entry["required"],
               "calling_mode": entry.get("calling_mode")}
        if entry.get("derive_blocked"):
            row["blocked"] = entry["derive_blocked"]
        elif not entry["required"] and not (wanted and pid in wanted):
            row["blocked"] = "extra (self-hosted) group — not one of the required 8; not driven unless named in --providers"
        elif wanted and pid not in wanted:
            continue
        elif not probe[pid]["has_key"]:
            row["blocked"] = "no API key configured (override_provider returned settings unchanged)"
        if row.get("blocked"):
            table.append(row)
            print(f"BOARD {pid} ⛔ {row['blocked']}")
            continue

        t = kit._requests().post(f"{base}/threads", headers=h, timeout=15, json={"title": f"273 board {pid}"})
        t.raise_for_status()
        thread_id = t.json()["id"]
        row["thread_id"] = thread_id

        a = _drive_turn(conn, base, h, thread_id, prompt_a, entry, args.timeout)
        arts_a = _artifacts(conn, thread_id)
        code_a, reload_a, by_msg_a = _reload(base, h, thread_id)
        b = _drive_turn(conn, base, h, thread_id, PROMPT_B, entry, args.timeout) if a.get("run_id") else {"error": "turn A not sent"}
        arts_all = _artifacts(conn, thread_id)
        code_b, reload_b, by_msg_b = _reload(base, h, thread_id)

        # V1
        a_rows = [x for x in arts_all if a.get("run_id") and x["run_id"] == a["run_id"]]
        v1 = bool(a.get("artifact_ids_from_results")) and bool(a_rows) and a.get("run_status") == "completed"
        first_id = a_rows[0]["id"] if a_rows else None
        # V2 (board half)
        missing = [x for x in reload_b if not isinstance(x, dict) or x.get("missing") or "id" not in x]
        v2_board = code_b == 200 and not missing and len(reload_b) == len(arts_all) and len(arts_all) > 0
        # V3
        b_rows = [x for x in arts_all if b.get("run_id") and x["run_id"] == b["run_id"]]
        b_forbidden = [n for n in b.get("tool_call_names", []) if n in forbidden]
        v3 = (b.get("run_status") == "completed" and first_id is not None
              and any(x["parent_id"] == first_id for x in b_rows) and not b_forbidden)
        leak = _leak(a) + _leak(b) if a.get("run_id") else ["not measured"]

        row.update({
            "v1": "PASS" if v1 else "FAIL", "v2_board": "PASS" if v2_board else "FAIL", "v3": "PASS" if v3 else "FAIL",
            "refused_calls": (a.get("refused_calls", 0), b.get("refused_calls", 0)),
            "empty_answer": (a.get("final_answer_empty"), b.get("final_answer_empty")),
            "fallback_answer": (a.get("final_answer_is_fallback"), b.get("final_answer_is_fallback")),
            "leak": leak or ["none"],
            "b_tool_calls": b.get("tool_call_names"), "b_forbidden": b_forbidden,
            "b_parent_ids": [x["parent_id"] for x in b_rows], "first_artifact": first_id,
            "artifact_rows": len(arts_all), "reload_records": len(reload_b), "reload_missing": len(missing),
        })
        for key, turn, arts, reload_items, by_msg, code in (
            ("A", a, arts_a, reload_a, by_msg_a, code_a), ("B", b, arts_all, reload_b, by_msg_b, code_b)
        ):
            rid = turn.get("run_id") or "nosend"
            (out / f"{pid}-{key}-{rid}.json").write_text(json.dumps({
                "provider": pid, "model": entry["model"], "turn": key, "thread_id": thread_id,
                "prompt": prompt_a if key == "A" else PROMPT_B,
                "calling_mode_predicted": entry.get("calling_mode"),
                "verdicts": {k: row[k] for k in ("v1", "v2_board", "v3")},
                "turn_data": turn, "message_artifacts": arts,
                "reload_http": code, "reload_artifacts": reload_items, "reload_by_message": by_msg,
            }, indent=2, default=str), encoding="utf-8")
        print(f"BOARD {pid} {entry['model']} V1={row['v1']} V2(board)={row['v2_board']} V3={row['v3']} "
              f"refused={row['refused_calls']} empty={row['empty_answer']} fallback={row['fallback_answer']} "
              f"leak={row['leak']} B calls={row['b_tool_calls']} thread={thread_id}")
        table.append(row)

    (out / "board-summary.json").write_text(json.dumps(table, indent=2, default=str), encoding="utf-8")
    print("\nBOARD_TABLE")
    print("| Provider | Model (derived) | Mode (predicted) | V1 emitted | V2 board half | V3 by-ref | refused A/B | empty A/B | leak probe |")
    print("|---|---|---|---|---|---|---|---|---|")
    for r in table:
        if r.get("blocked"):
            print(f"| {r['provider']} | {r['model']} | {r.get('calling_mode') or '—'} | ⛔ | ⛔ | ⛔ | — | — | {r['blocked']} |")
        else:
            print(f"| {r['provider']} | {r['model']} | {r['calling_mode']} | {r['v1']} | {r['v2_board']} | {r['v3']} | "
                  f"{r['refused_calls'][0]}/{r['refused_calls'][1]} | {r['empty_answer'][0]}/{r['empty_answer'][1]} | "
                  f"{'; '.join(r['leak'])} |")
    return 0


# ── --observe ───────────────────────────────────────────────────────────────────────────────────

def observe(token: str, org_id: str, conn, args) -> int:
    base = kit.base_url()
    h = _headers(token, org_id)
    roster, _settings = derive_roster(conn)
    target = (args.providers or "openrouter").split(",")[0]
    entry = next((r for r in roster if r["provider"] == target and not r.get("derive_blocked")), None)
    if not entry:
        raise SystemExit(f"no derived row for {target}")
    out = _EVIDENCE.parent / "structured"
    out.mkdir(parents=True, exist_ok=True)
    for key, prompt in OBSERVE_PROMPTS.items():
        t = kit._requests().post(f"{base}/threads", headers=h, timeout=15, json={"title": f"273 observe {target} {key}"})
        t.raise_for_status()
        thread_id = t.json()["id"]
        turn = _drive_turn(conn, base, h, thread_id, prompt, entry, args.timeout)
        persisted = "\n".join((m["content"] or "") for m in turn.get("assistant_messages", []))
        delta = (turn.get("redis") or {}).get("delta_text", "")
        res = {
            "tool_calls": turn.get("tool_call_names"),
            "delta_has_call_text": any(s in delta for s in ("search_documents", "show_artifact", '"tool"', '"rows"')),
            "persisted_has_json_fence": bool(_JSON_FENCE.search(persisted)),
            "delta_equals_persisted": delta == persisted,
            "delta_len": len(delta), "persisted_len": len(persisted),
        }
        (out / f"{target}-{key}-{turn.get('run_id')}.json").write_text(json.dumps({
            "provider": target, "model": entry["model"], "thread_id": thread_id, "prompt": prompt,
            "calling_mode_predicted": entry.get("calling_mode"), "result": res, "turn_data": turn,
        }, indent=2, default=str), encoding="utf-8")
        print(f"OBSERVE {target} ({key}) thread={thread_id} run={turn.get('run_id')} status={turn.get('run_status')} | {res}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--roster", action="store_true")
    g.add_argument("--seed", action="store_true")
    g.add_argument("--run", action="store_true")
    g.add_argument("--observe", action="store_true")
    ap.add_argument("--providers", default="")
    ap.add_argument("--timeout", type=int, default=420)
    ap.add_argument("--out", default="board",
                    help="evidence subdirectory (default 'board'); a re-run passes e.g. 'board-rerun'")
    args = ap.parse_args()
    kit.load_env()
    kit.assert_localhost_only()
    _assert_local_db()
    conn = kit.connect_db()
    conn.autocommit = True
    if args.roster:
        derive_roster(conn)
        return 0
    token = kit.get_bearer_token()
    user_id = _user_id(token)
    org_id = _single_org(conn, user_id)
    print(f"dev user {user_id} · single org {org_id} (asserted from org_members)")
    if args.seed:
        return seed(token, org_id, user_id, conn)
    if args.observe:
        return observe(token, org_id, conn, args)
    return run_board(token, org_id, conn, args)


if __name__ == "__main__":
    sys.exit(main())
