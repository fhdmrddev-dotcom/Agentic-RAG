---
phase: 093-harness-cross-provider-parity
reviewed: 2026-06-02T22:01:32Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - backend/app/services/task_service.py
  - backend/app/services/harness/phase_types.py
  - backend/app/models/harness.py
  - backend/app/services/logging_sink.py
  - backend/app/main.py
  - backend/app/config.py
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 093: Code Review Report (Gap-Closure Batch 06–09)

**Reviewed:** 2026-06-02T22:01:32Z
**Depth:** deep (cross-file: import graph + call chains)
**Files Reviewed:** 6 (the 5 in-scope files + `config.py`, which carries the coupled step-cap knob change)
**Status:** issues_found

> Scope: ONLY the diff since base `d0089de3` (the 01–05 surface was reviewed separately and is archived as `093-REVIEW-01-05-batch.md` — not re-reviewed here).

## Summary

The four gap-closure changes (093-06 log-sink, 093-07 finish-event consumption, 093-08 sub-agent model resolution, 093-09 force-synthesis + step-cap raise) are well-engineered, heavily commented, and mostly faithful mirrors of the byte-frozen Deep `agent_loop.py` reference. I verified the "verbatim agent_loop.py" claims against the actual source: the `finish`-event `thought_signature` hydration (`agent_loop.py:1503-1506`), the `usage`/`usage_delta` SUM (`agent_loop.py:1399-1416`), the conditional-spread reasoning/sig replay (`agent_loop.py:1866-1901`), and the per-iteration reasoning reset (`agent_loop.py:1907-1908`) all match. The `tools=[]` synthesis turn correctly trips the `_has_tools=False` gate (`task_service.py:319`), skipping BOTH the STRUCTURED inject (`:325`) and the `parse_structured_tool_calls` post-parse (`:462`) — so the synthesized answer can never be blanked by a spurious tool-call parse. The step-cap sentinel-equality substitution invariant holds (all three knobs at 12: `config.max_steps == _MODEL_DEFAULT_MAX_STEPS == 12` → substitution still fires → effective cap genuinely 12). The force-synthesis fallback is exception-wrapped (`:813`) and reuses the cross-iteration `_sub_usage` so token accumulation continues across the extra call. The default log path is verified gitignored (`git check-ignore backend/logs/backend.log` passes).

**RED LINE assessment — Deep byte-identical:** No CRITICAL regression to the Deep path. The finish-event hydration, the reasoning/usage boxes, and the force-synthesis branch are all genuinely additive with None-default / absent-key / early-`break` semantics, so a converging Deep `task()`/`analyze_document` call is byte-identical (it hits `if not tool_calls: break` and never reaches the new exhaustion code; absent finish-sig/reasoning are no-op conditional spreads). The new `runs.input/output_tokens` persistence is a telemetry-only column write — it does not touch the SSE stream or the returned summary, so it does not breach the byte-identical-STREAM invariant. HOWEVER, the 093-08 model-resolution rewire IS a Deep-path **behavior change** that the byte-identical framing should account for: a Deep `task()` sub-agent now honors `user_settings.sub_agent_model` where it previously ignored it — see WR-01.

The remaining warnings are the log-sink startup crash-safety gap (WR-02) and the connection-string redaction gap (WR-03). No source files were modified during this review.

## Warnings

### WR-01: 093-08 changes Deep `task()` sub-agent model resolution (no longer byte-identical on the RED-LINE path)

**File:** `backend/app/services/task_service.py:532` (call site) + `:49-89` (`_resolve_sub_agent_effective_model`)
**Issue:**
Pre-093-08 the sole production Deep caller `tool_dispatcher.py:1189` (`task()`) → `run_task_sub_agent` resolved its model via `resolve_sub_agent_model_safely(..., override_model=None, fallback_model=parent_ctx.model)`. With `override_model=None`, the resolver's candidate chain was `None or user_settings.llm_model or parent_ctx.model or settings.llm_model` — i.e. the Deep `task()` sub-agent **ignored `sub_agent_model` entirely** and ran on the main `llm_model`.

Post-093-08 the new helper passes `override_model = user_settings.sub_agent_model` as the highest-priority candidate. So a Deep user who has set `sub_agent_model` will now see their `task()` sub-agents run on that model where they previously ran on `llm_model`. This is a real, user-observable behavior change on the shared Deep path — exactly the class of change the RED LINE flags ("does the model-resolution change alter behavior for a Deep `task()`/`analyze_document` call").

Mitigating context (why this is a Warning, not a Critical): the change makes `task()` **consistent** with the byte-frozen `sub_agent_service.py:49-52` (the `analyze_document` sub-agent), which has *always* prioritized `sub_agent_model` as the top override. The divergence being closed is real, and the new behavior is the more-correct one. But the gap-closure scope claims Deep stays byte-identical, and this is not — it should be an explicitly-signed-off intentional Deep-path change, with the eval `task`-cell skeleton diff re-run to confirm no unintended downstream effect.

Secondary nuance: the new chain does NOT consult `settings.sub_agent_model` (the `.env` env-override) the way the byte-frozen reference does (`sub_agent_service.py:51`). So an operator who sets `sub_agent_model` via env-only (no DB value) gets it honored for `analyze_document` but NOT for `task()` — a residual inconsistency between the two sub-agent paths.

**Fix:** Confirm this is intended and record it as a deliberate Deep-path behavior change in VALIDATION/CONTEXT (it is the correct alignment, not an accident). To fully match the canonical contract, fold the env override into the override candidate so both sub-agent paths resolve identically:
```python
_user_sub_agent_model = (
    getattr(user_settings, "sub_agent_model", None) if user_settings else None
) or (settings.sub_agent_model or None)  # match sub_agent_service.py:49-52 precedence
```
Then re-run the eval `task`-cell skeleton diff (and a live Deep `task()` smoke with a non-default `sub_agent_model` set) to prove no regression.

### WR-02: `install_file_log_sink()` is not crash-safe at startup — an unwritable `LOG_FILE_PATH` aborts boot

**File:** `backend/app/main.py:31` + `backend/app/services/logging_sink.py:134-141`
**Issue:**
`install_file_log_sink()` is called bare at module import (`main.py:31`) with no surrounding try/except. Inside, `os.makedirs(path.parent, exist_ok=True)` (`:134`) and `RotatingFileHandler(resolved, ...)` (`:136`) can raise `OSError`/`PermissionError` for an unwritable, invalid, or read-only `LOG_FILE_PATH`. Because this runs at import time (before `lifespan`), an exception there **crashes the entire backend at startup** — turning an opt-in diagnostic convenience into a hard boot blocker. The docstring sells the sink as "strictly opt-in … byte-identical console-only logging" when unset, but when SET-but-misconfigured it is strictly fatal. Every other best-effort startup hook in this file (Redis ping `:209-213`, settings migration `:217-221`, resume sweep `:237-238`) is wrapped to "log + continue"; this one is not.

**Fix:** Make the sink installation best-effort, consistent with the rest of `main.py` startup:
```python
try:
    _log_sink_path = install_file_log_sink()
    if _log_sink_path:
        logger.info("backend file log-sink active: %s", _log_sink_path)
except Exception:
    logger.warning("file log-sink install failed; continuing console-only", exc_info=True)
```
(Or wrap the `makedirs` + handler construction inside `install_file_log_sink` itself and return `None` on failure.)

### WR-03: redaction filter misses connection-string secrets (`REDIS_URL` / `POSTGRES_DSN` passwords)

**File:** `backend/app/services/logging_sink.py:44-72` (`_SECRET_ENV_VARS` + `_REDACTION_PATTERNS`)
**Issue:**
The filter redacts `sk-…`, `Bearer`/`Authorization`, JWTs, and the literal values of 11 named provider-key env vars. It does NOT cover credential-bearing connection strings that this codebase explicitly acknowledges carry secrets:
- `settings.redis_url` — `main.py:206-207` literally comments "may contain credentials in cloud setups, e.g. `rediss://default:PASSWORD@host`". A `rediss://user:PASSWORD@host` string matches none of the structural patterns, and `REDIS_URL` is not in `_SECRET_ENV_VARS`.
- `settings.postgres_dsn` — `config.py:751` default `postgresql://postgres:postgres@127.0.0.1:54322/postgres`; a cloud DSN embeds a real password. Not covered.
- `LANGSMITH_API_KEY` (`main.py:70`), `embedding_api_key`, `rerank_api_key` — present in `main.py:_API_KEY_COLUMNS` but absent from `_SECRET_ENV_VARS`. LangSmith keys are often `lsv2_…` (not `sk-…`), so the `sk-` shape pattern misses them too.

Since the sink exists so "the agent self-scans the log for diagnostics," an exception or warning that interpolates `redis_url`/`postgres_dsn` (common in connection-error tracebacks) would write a plaintext DB/Redis password into the on-disk log. The gitignore protects against *commit* leakage but not against the secret living on disk for the agent (and anything reading the file) to see.

**Fix:** Add a connection-string password pattern and extend the env-var list:
```python
# redact userinfo password in URLs: scheme://user:PASSWORD@host
(re.compile(r"(?i)\b([a-z][a-z0-9+.\-]*://[^\s:@/]+):([^\s@/]+)@"), r"\1:***REDACTED***@"),
```
and add `REDIS_URL`, `POSTGRES_DSN`/`DATABASE_URL`, `LANGSMITH_API_KEY`, `EMBEDDING_API_KEY`, `RERANK_API_KEY` to `_SECRET_ENV_VARS`. (Note the env-value pass requires `len(value) >= 8`, so the local default password `"postgres"` is exactly at the 8-char boundary and would redact; shorter dev passwords slip through, acceptable for local-only DSNs but worth a code comment.)

## Info

### IN-01: `run_task_sub_agent` has a latent `NameError` if `max_steps <= 0`

**File:** `backend/app/services/task_service.py:669` (loop) + `:786` (`else:` reads `content`)
**Issue:** `for step in range(max_steps): ... else:` — when `max_steps == 0` the loop body never executes, so `content` and `tool_calls` are unbound when the new `else:` branch reads `summary = content or ""` (`:786`), raising `NameError`. Not reachable in production today (Deep `task()` clamps `max(1, …)` at `tool_dispatcher.py:1130`; the harness uses `_EXPLORER_STEP_CAP=12` / `config.max_steps` default 12), so this is latent, not live — but the 093-09 `else:` rewrite newly *reads* `content` there, making the fragility slightly more exposed than before.
**Fix:** Initialize `content, tool_calls = "", []` before the loop, or assert `max_steps >= 1` at function entry.

### IN-02: custom `LOG_FILE_PATH` outside `logs/` / `*.log` is not gitignore-protected

**File:** `backend/app/services/logging_sink.py:118-125`
**Issue:** The leak mitigation relies on the resolved path landing under `logs/` or ending `.log` (both gitignored — verified). An operator who sets `LOG_FILE_PATH=debug.txt` (or any tracked-tree path) gets a secret-bearing log that `git add .` would stage. The docstring documents the convention but the code does not enforce or warn on it.
**Fix:** Optionally warn when the resolved path is neither under a `logs/` segment nor ends in `.log`:
```python
if "logs" not in path.parts and path.suffix != ".log":
    logger.warning("LOG_FILE_PATH %s is outside the gitignored logs/ + *.log convention — it may be committable", resolved)
```

### IN-03: log-injection surface via forged newlines in mirrored messages

**File:** `backend/app/services/logging_sink.py:84-104` (`_RedactingFilter.filter`)
**Issue:** The filter sets `record.msg` to the interpolated, possibly LLM/user-influenced string and the formatter prepends `%(asctime)s %(levelname)s %(name)s`. A message containing embedded newlines could forge additional log lines in the file. Severity is low: the sink only MIRRORS messages the app already logs to the console (identical exposure there) and adds no new body-logging. Noted for completeness per the review scope's log-injection lens.
**Fix (optional):** Collapse newlines before writing (`message.replace("\n", " \\n ")`). Weigh against the diagnostic value of multi-line tracebacks — likely not worth it for a local diagnostic sink.

### IN-04: assistant-replay always sets `"content": content` (pre-existing, NOT introduced by 093-07)

**File:** `backend/app/services/task_service.py:739`
**Issue:** The Deep reference uses a *conditional* content spread `**({"content": full_content} if full_content else {})` (`agent_loop.py:1893`), whereas `run_task_sub_agent` unconditionally sets `"content": content` (possibly `""`) on the assistant tool-call replay message. The 093-07 diff only ADDED the `thought_signature` / `reasoning_content` spreads around this line — the `"content": content` line is unchanged context (pre-existing since Phase 085), so it is out of scope for this gap-closure batch. Flagged only so a future reviewer does not mistake the divergence for a 093-07 regression. An empty-string `content` on a tool-call turn is accepted by all current providers, so there is no live defect.
**Fix:** None required for this phase. If unifying with the Deep contract later, switch to the conditional spread.

---

_Reviewed: 2026-06-02T22:01:32Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
