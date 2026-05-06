---
phase: 067
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/.env
  - backend/.env.example
  - supabase/SETUP.md
  - REDIS-SETUP.md
autonomous: true
requirements:
  - STREAM-04-polish
must_haves:
  truths:
    - "`RUN_HARD_TIMEOUT_SECONDS` line is absent from `backend/.env` after this plan ships (D-067-06)"
    - "`RUN_HARD_TIMEOUT_SECONDS` cosmetic refs are absent from `backend/.env.example`, `supabase/SETUP.md`, `REDIS-SETUP.md` after this plan ships"
    - "Backend boots cleanly after deletion (Pydantic `extra=ignore` at `app/config.py:245` makes this safe)"
    - "The dead-code documentation comment at `backend/app/config.py:366-371` (which references the obsolete env var) is preserved — it is documentation about a deleted symbol"
    - "The integration test at `backend/tests/integration/test_061_hard_timeout.py:44` (which references the obsolete env var by NAME in a docstring) is preserved — that test is the Phase 066 plan 04 deletion guard"
  artifacts:
    - path: "backend/.env"
      provides: ".env without the obsolete RUN_HARD_TIMEOUT_SECONDS=600 stopgap line"
      contains: ""
  key_links:
    - from: "backend/.env"
      to: "no RUN_HARD_TIMEOUT_SECONDS"
      via: "single-line deletion"
      pattern: "RUN_HARD_TIMEOUT_SECONDS"
---

<objective>
Delete the obsolete stopgap `RUN_HARD_TIMEOUT_SECONDS=600` line from `backend/.env` and any cosmetic references in `backend/.env.example`, `supabase/SETUP.md`, and `REDIS-SETUP.md` (D-067-06). The wrapper consumer was deleted in Phase 066 D-066-01; Pydantic `extra="ignore"` at `app/config.py:245` silently drops the env var today, so the line is documentation rot.

This is a one-line config-file edit plus exhaustive grep-and-clean of cosmetic references. Backend reload after the edit is the verification.

Purpose: cleanup of obsolete stopgap from Phase 066's pre-fix mitigation. No runtime behavior change — Pydantic already ignores the var. Removes operator confusion ("what does this env var do?").

Output: backend/.env without RUN_HARD_TIMEOUT_SECONDS; .env.example, supabase/SETUP.md, REDIS-SETUP.md cleaned of any operator-facing reference; backend still boots; the dead-code documentation comment at config.py:366-371 (about the deleted symbol) and the test docstring at test_061_hard_timeout.py:44 (about the deletion guard) are intentionally preserved.
</objective>

<execution_context>
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/workflows/execute-plan.md
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:/Vibe Apps/Agentic RAG/.planning/PROJECT.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-CONTEXT.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-RESEARCH.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-PATTERNS.md

<interfaces>
<!-- The obsolete env var and its safe-to-delete posture. -->

From `backend/app/config.py:245` (Pydantic `extra="ignore"` — makes the deletion mechanically safe):

    class Settings(BaseSettings):
        model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

From `backend/app/config.py:366-371` (dead-code documentation — INTENTIONALLY PRESERVED; this comment explains WHY the symbol no longer exists):

    # budgets live on MODEL_CAPABILITIES.llm_call_timeout_seconds +
    # LLM_CALL_TIMEOUT_OVERRIDES env (resolved via get_per_call_timeout()).
    # The legacy `RUN_HARD_TIMEOUT_SECONDS` env-var symbol is silently
    # parsed-and-ignored (Pydantic Settings `extra="ignore"` at line 129) so
    # legacy deploys with the env set don't error at startup, but the value
    # has no effect.

From `backend/tests/integration/test_061_hard_timeout.py:44` (docstring — INTENTIONALLY PRESERVED; this test is the Phase 066 plan 04 deletion guard).

From the grep audit (initial discovery — `grep -rn RUN_HARD_TIMEOUT_SECONDS .` covering source-of-truth files):
- `backend/.env` — operator-set live config; the actual `=600` line. **DELETE.**
- `backend/.env.example` — operator template; verify presence and delete if found.
- `supabase/SETUP.md` — operator setup doc; verify presence and delete if found.
- `REDIS-SETUP.md` — operator setup doc; verify presence and delete if found.
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `.planning/phases/.../066-*-PLAN.md`, `.planning/phases/067-frontend-streaming-ux-fix/...` — planning artifacts; **PRESERVE** (these document the historical decision).
- `backend/app/config.py:366-371` — dead-code documentation comment; **PRESERVE** (explains the symbol's deletion).
- `backend/tests/integration/test_061_hard_timeout.py:44` — Phase 066 deletion-guard test docstring; **PRESERVE** (the test enforces the wrapper's continued absence).

Phase 066 evidence — Plan 02 deleted the runtime consumer (the `asyncio.timeout(settings.run_hard_timeout_seconds)` wrapper at threads.py:855); Plan 04 added `test_061_hard_timeout.py` as a 4-test deletion guard. Plan 067-04 closes the loop by deleting the now-orphaned operator-facing env-var declaration.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Delete RUN_HARD_TIMEOUT_SECONDS line from backend/.env</name>
  <files>backend/.env</files>
  <read_first>
    - backend/.env (locate the `RUN_HARD_TIMEOUT_SECONDS=600` line — typically near other timeout/budget env vars)
    - .planning/phases/067-frontend-streaming-ux-fix/067-PATTERNS.md (Pattern K — Pydantic `extra="ignore"` confirms the deletion is safe)
  </read_first>
  <behavior>
    - Single-line deletion. The Pydantic `extra="ignore"` config at `backend/app/config.py:245` already silently drops the var, so the runtime behavior was already ignoring it. The deletion makes this explicit in the operator-facing template.
    - If a comment block references the obsolete var (e.g. `# stopgap before Phase 067 ships`), delete the entire stopgap-comment + value pair so the file reads cleanly.
  </behavior>
  <action>
    Read `backend/.env`. Locate the `RUN_HARD_TIMEOUT_SECONDS=600` line. Delete it. If there is a preceding comment that explains the line as a stopgap (e.g. lines like `# Phase 066 stopgap — apply before Phase 067 ships` from the ROADMAP narrative at line 391), delete that comment too. Save the file.

    Do NOT touch any other env var. Do NOT touch the file's structural ordering (other vars stay in the same relative positions).

    If the file does not contain `RUN_HARD_TIMEOUT_SECONDS` at all, this task is a no-op — record that in the SUMMARY and move on.
  </action>
  <acceptance_criteria>
    - `grep -c "RUN_HARD_TIMEOUT_SECONDS" backend/.env` returns 0.
    - Backend imports config cleanly: `cd backend && venv/Scripts/python.exe -c "from app.config import settings; print('OK', settings.consumer_timeout_seconds)"` returns "OK 610" (or whatever value is configured) exit 0.
    - Settings has NO `run_hard_timeout_seconds` field (Phase 066 D-066-02 deleted it): `cd backend && venv/Scripts/python.exe -c "from app.config import settings; assert not hasattr(settings, 'run_hard_timeout_seconds'), 'Settings field still present'; print('OK')"` returns "OK".
  </acceptance_criteria>
  <verify>
    <automated>cd backend && venv/Scripts/python.exe -c "from app.config import settings; assert not hasattr(settings, 'run_hard_timeout_seconds'), 'Settings field still present'; print('OK', settings.consumer_timeout_seconds)"</automated>
  </verify>
  <done>
    backend/.env no longer references RUN_HARD_TIMEOUT_SECONDS. Settings imports cleanly and `consumer_timeout_seconds` (its replacement budget per Phase 066 D-066-02) is the active timeout setting.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Clean cosmetic refs from .env.example, supabase/SETUP.md, REDIS-SETUP.md (exhaustive grep-and-clean)</name>
  <files>backend/.env.example, supabase/SETUP.md, REDIS-SETUP.md</files>
  <read_first>
    - backend/.env.example
    - supabase/SETUP.md
    - REDIS-SETUP.md
    - Initial grep audit results from CONTEXT.md `<code_context>` "Suggested plan ordering" #4 ("search exhaustive — pattern mapper noted possible rot")
  </read_first>
  <behavior>
    - For each operator-facing doc, search for `RUN_HARD_TIMEOUT_SECONDS`. If a reference is present (env var declaration in `.env.example`, or a setup-doc paragraph in supabase/SETUP.md or REDIS-SETUP.md), delete the line/paragraph.
    - PRESERVE the following references (they are intentional):
      - `backend/app/config.py:366-371` — dead-code documentation comment about the deleted symbol.
      - `backend/tests/integration/test_061_hard_timeout.py:44` — deletion-guard test docstring.
      - All `.planning/` references — these document historical decisions.
    - If a doc has no reference, the file is a no-op; record that in the SUMMARY.
  </behavior>
  <action>
    Run a targeted check on each of the three operator-facing files:

    1. **backend/.env.example** — Read. Search for `RUN_HARD_TIMEOUT_SECONDS`. If present, delete the line (and any preceding stopgap comment line, mirroring Task 1's structural cleanup). If absent, no-op.

    2. **supabase/SETUP.md** — Read. Search for `RUN_HARD_TIMEOUT_SECONDS`. If present, delete the paragraph or table row that contains it. If absent, no-op.

    3. **REDIS-SETUP.md** — Read. Search for `RUN_HARD_TIMEOUT_SECONDS`. If present, delete the paragraph or table row that contains it. If absent, no-op.

    For each doc, after editing, verify the file is still well-formed Markdown (no broken table rows, no dangling paragraph headers).

    Do NOT touch:
    - `backend/app/config.py` — the dead-code comment is preserved.
    - `backend/tests/integration/test_061_hard_timeout.py` — the test docstring is preserved.
    - Anything in `.planning/` — historical decisions are immutable.
  </action>
  <acceptance_criteria>
    - `grep -c "RUN_HARD_TIMEOUT_SECONDS" backend/.env.example` returns 0.
    - `grep -c "RUN_HARD_TIMEOUT_SECONDS" supabase/SETUP.md` returns 0.
    - `grep -c "RUN_HARD_TIMEOUT_SECONDS" REDIS-SETUP.md` returns 0.
    - `backend/app/config.py:366-371` dead-code comment intact: `grep -c "The legacy .RUN_HARD_TIMEOUT_SECONDS. env-var symbol" backend/app/config.py` returns 1 (preserved).
    - `backend/tests/integration/test_061_hard_timeout.py` test docstring intact: `grep -c "RUN_HARD_TIMEOUT_SECONDS" backend/tests/integration/test_061_hard_timeout.py` returns at least 1 (preserved).
    - Cumulative grep across all FOUR operator-facing surfaces returns 0 occurrences in operator-facing config (planning artifacts and dead-code-comment preserved as documented above).
  </acceptance_criteria>
  <verify>
    <automated>cd backend && venv/Scripts/python.exe -c "from app.config import settings; print('OK')"</automated>
  </verify>
  <done>
    backend/.env.example, supabase/SETUP.md, REDIS-SETUP.md are free of any operator-facing reference to RUN_HARD_TIMEOUT_SECONDS. Dead-code comment in config.py and deletion-guard test docstring preserved. Backend continues to boot cleanly.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Operator → backend config | Operator may have set `RUN_HARD_TIMEOUT_SECONDS` in a deployed `.env`; deletion of the line in this repo's `.env` does NOT change the operator's deployed copy (those are deployment-environment specific). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-067-04-01 | Tampering | Config file rotation | accept | This plan removes a documentation-rot line; no security boundary is touched. |
| T-067-04-02 | Information disclosure | Removing the env var name | accept | The env var name was already public (in `.planning/ROADMAP.md`, in the dead-code comment at `config.py:366`). Deletion does not increase disclosure. |
| T-067-04-03 | Denial of Service | Backend boot regression | mitigate | Pydantic `extra="ignore"` at `config.py:245` was confirmed — operators with `RUN_HARD_TIMEOUT_SECONDS` set in their deployment env will continue to boot cleanly (the var is silently dropped). Verified by Task 1 acceptance criterion. |

No new auth/authz, no new external network egress, no new user-input parsing. Threat surface is bounded to operator-facing config docs.
</threat_model>

<verification>
Phase-wide checks for this plan:
- Backend imports cleanly without RUN_HARD_TIMEOUT_SECONDS in any operator-facing config or template.
- Settings object has no run_hard_timeout_seconds attribute (Phase 066 D-066-02 already deleted the field).
- Dead-code comment and test docstring (the two intentional preservations) still present.

No live verification required — Plan 05 will run a backend restart with the new .env to confirm operationally.
</verification>

<success_criteria>
- Operator-facing references to `RUN_HARD_TIMEOUT_SECONDS` are absent from `backend/.env`, `backend/.env.example`, `supabase/SETUP.md`, `REDIS-SETUP.md`.
- Backend imports config cleanly and Settings has no `run_hard_timeout_seconds` attribute.
- Dead-code comment at `backend/app/config.py:366-371` preserved.
- Deletion-guard test docstring at `backend/tests/integration/test_061_hard_timeout.py:44` preserved.
- All `.planning/` historical references untouched.
</success_criteria>

<output>
After completion, create `.planning/phases/067-frontend-streaming-ux-fix/067-04-SUMMARY.md` documenting:
- Whether the var was found and removed in `backend/.env` (most likely yes — ROADMAP narrative at line 391 explicitly notes the operator was directed to add it).
- For each of `backend/.env.example`, `supabase/SETUP.md`, `REDIS-SETUP.md`: presence at start, action taken (delete or no-op), state at end.
- Confirmation that the two intentional preservations (config.py dead-code comment, test_061_hard_timeout.py docstring) are intact.
- Backend boot smoke result.
</output>
