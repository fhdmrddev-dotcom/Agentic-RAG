---
created: 2026-05-23T15:30:00Z
purpose: Resume Phase 075.5 (Google native SDK adoption) live-test loop after a clean machine reboot
status: ready-to-resume
last_commit: 4d5c517 (hardened restart-backend.ps1)
last_blocker: orphan multiprocessing-spawn workers serving stale code on port 8001 despite kill attempts; clean reboot eliminates them
---

# Resume After Reboot — Phase 075.5 (Gemini native SDK)

## What's committed and survives the reboot

| Commit | What it does |
|---|---|
| `79d4d57` | New `backend/app/services/google_service.py` (305 → 470 lines) — native Google Gen AI SDK adapter; mirrors `anthropic_service.py` shape; router branch in `threads.py`; sub-agent constraint safety net; 9 unit tests |
| `c317e62` | `_sanitize_schema_for_google` strips `additionalProperties`, `$ref`, `oneOf`, `anyOf`, etc. from tool parameter schemas (Google's strict OpenAPI subset rejects them with 400); 2 more unit tests |
| `1768fb1` | `_encode_signature_for_json` / `_decode_signature_for_part` — base64 round-trip for `thought_signature` bytes (Google SDK returns raw bytes, agent loop / json.dumps / DB persist all need JSON-safe str); 3 more unit tests |
| `4d5c517` | Hardened `scripts/restart-backend.ps1` — kills python.exe + pythonw.exe orphans, polls port for release, launches headless with logs to `backend/uvicorn.{out,err}.log` |
| `bd8dad9` | Earlier same-session hotfix to the OpenAI-compat in-flight echo (since obsoleted by 075.5 but harmless — keeps non-Google paths working) |
| `d58ab11` | Phase 075.4 verification flipped to `gaps_found` with GAP-075.4-01 documenting the root cause (openai-python SDK serialization unreliable for Google's extra_content) |
| `2cc234e` | `.planning/phases/075.4-.../075.4-POST-UAT-TRIAGE.md` — 8 operator findings (F-1..F-8) from live cross-provider UAT |

**Frontend config:** `frontend/.env.local` reverted to project default `VITE_API_BASE_URL=http://localhost:8000`. The port-8001 detour was a transient workaround for the phantom socket on 127.0.0.1:8000 held by dead PID 13656 with stale code. After the reboot, that phantom is gone — port 8000 is clean and is where every other script/doc/default in the project points.

## What was proven before the reboot

- **Standalone smoke test PASSED** end-to-end against real `gemini-3-flash-preview`: round 1 captured 449-byte thought_signature (now base64-encoded as a 340-char str), round 2 echoed it through native SDK, Gemini returned `finish_reason=stop`. **Architecture works.**
- **All 14 unit tests GREEN** in `backend/tests/unit/test_075_5_google_native.py`.
- The bug we keep hitting in the LIVE UI was a stale-process problem, NOT a code problem. Backend workers spawned by killed reloaders survived (multiprocessing.spawn detaches from parent) and kept serving old code on port 8001. The clean reboot eliminates them.

## Steps to resume after reboot

### 1. Confirm git state is intact

```bash
cd "/c/Vibe Apps/Agentic RAG"
git log --oneline -10
# Top line should be: 4d5c517 fix(075.5): harden restart-backend.ps1 ...
git status
# Should show clean working tree (or just .claude/settings.local.json drift)
```

### 2. Start infrastructure

```bash
# Supabase + Redis (auto-start on Docker Desktop boot per CLAUDE.md;
# verify they're up — if not:
docker compose -f docker-compose.dev.yml up -d
supabase start  # if not auto-started
```

### 3. Start backend on the project's default port 8000

```bash
# Use the hardened restart script (kills any future orphans + launches headless):
powershell -ExecutionPolicy Bypass -File scripts/restart-backend.ps1

# OR launch directly via bash (also clean):
cd backend
rm -f uvicorn.out.log uvicorn.err.log
nohup ./venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info > uvicorn.out.log 2> uvicorn.err.log &
```

> **Why no `--reload`?** WatchFiles on Windows was demonstrably failing to load my edits during the session (worker subprocesses inherited cached module state OR survived their parent reloader). Without `--reload`, code loads exactly once at startup — predictable. If you want hot-reload back later, only ONE worker should run, and you must restart the WHOLE script between edits. Add `--reload` to the uvicorn command if you trust your editor's save-write pattern triggers WatchFiles.

### 4. Verify backend health

```bash
curl http://localhost:8000/health
# Expected: {"status":"ok","redis":"ok"}

netstat -ano | grep "8000.*LISTENING"
# Expected: exactly ONE listener (one PID). After reboot, the phantom
# PID 13656 / 15848 entries from the prior session are GONE.
```

### 5. Start frontend (Vite)

```bash
cd frontend
npm run dev
# Should print: ready in Xms, Local: http://localhost:5173
```

### 6. Verify Vite is hitting port 8000

In the browser at http://localhost:5173 → DevTools Network tab → any request → URL should be `http://localhost:8000/...` (the project default; this is what every other script/doc expects).

### 7. Live re-test the Gemini-3 prompt

- Fresh chat thread
- Model: `gemini-3-flash-preview`
- Prompt: `search for Fahed Mrad dissertation, make a professional pptx for defence session and include comprehensive charts and visuals`
- **Expected after reboot (single clean backend, fresh code load):** the run completes past the first tool call and chains through. No `additional_properties` error, no `bytes is not JSON serializable` error.

### 8. If it works → continue to Step 3 of the loop

Step 3 is the **cross-provider Chrome MCP UAT** — same prompt against Sonnet 4.6 / Kimi 2.6 / GPT 5.4 / Gemini-3.5-flash, watching for the other 7 issues (F-2..F-8). I'll drive Chrome MCP, you watch.

### 9. If it still fails → check process state FIRST

Most failures so far were stale-process artifacts, not code bugs. Before assuming code is broken:

```bash
# How many uvicorn workers are running?
tasklist | grep "python.exe"
# With --reload: 1 reloader (~37MB) + 1 worker (~200MB). More = orphans.
# Without --reload (recommended per step 3): just 1 process (~200MB).

# What's listening on 8000?
netstat -ano | grep "8000.*LISTENING"
# Should be exactly ONE listener. More than one = orphan port-holders.

# Which worker is bound to which port? Use wmic to inspect command lines:
wmic process where "Name='python.exe'" get ProcessId,ParentProcessId,CommandLine | head -10
```

If ANY orphans, kill them with `taskkill //F //PID <N>` and restart.

## Task list state (to re-enter in the next session)

When you resume, paste this to Claude so the task tracker matches reality:

```
- [x] Step 1a — Phase 075.5 google_service.py draft + smoke test PASSED
- [x] Step 1b — wire router + sub-agent constraint + delete old path
- [x] Step 1c — additionalProperties sanitizer
- [x] Step 1d — thought_signature base64 round-trip
- [ ] Step 2 — operator re-test Gemini-3 multi-tool (BLOCKED on stale-process orphans, resume after reboot)
- [ ] Step 3 — Chrome MCP cross-provider live UAT (Sonnet/Kimi/GPT/Gemini)
- [ ] Step 4 — write capture-only triage doc
- [ ] Step 5 — operator prioritizes triage findings
- [ ] Step 6 — fix one at a time with live confirmation
```

## Open items from the earlier UAT (do NOT bundle — fix one at a time per the loop rule)

| ID | What | Notes |
|---|---|---|
| F-1 | Gemini-3 multi-tool round-trip | Architecturally fixed via 075.5, needs LIVE confirmation after reboot |
| F-2 | Generic Gemini "Invalid argument" on round 2 | Likely downstream of F-1; re-verify after F-1 is live-confirmed |
| F-3 | Fake "thinking" / "synthesizing" placeholder | Native SDK exposes a real thinking stream — wiring deferred to follow-on phase |
| F-4 | Long pauses moving to execute_code | Suspect harvest_output_files D-v2.5-01 violation re-emerged; separate fix |
| F-5 | Sub-agent UI shows wrong model | Frontend display issue; safety net landed in `sub_agent_service.py`, frontend filter already in place |
| F-6 | Resume button false-positive | Existing bug report at `.planning/reported-bugs/resume-button-appears-during-active-code-execution.md` |
| F-7 | Status not reflected in UI | Related to F-4 + F-6 |
| F-8 | LangSmith errors | Operator reported many — need to check LangSmith REST API for trace cleanliness |

## Notes on the cleanup work

- **Port stays at 8000** after reboot — the project default that every script, env example, and doc points at. The 8001 detour during the session was a transient workaround for the phantom dead-PID listener on 127.0.0.1:8000; reboot reclaims that socket.
- `backend/uvicorn.out.log` and `backend/uvicorn.err.log` are the SINGLE source of truth for backend output. Earlier we had logs in 3 places (backend.log at repo root from months ago, plus two uvicorn.* variants); current setup is unambiguous.
- The `.continue-here.md` style files (anti-pattern handoffs) are not used here — this single doc IS the handoff.
