---
quick_id: 260611-irx
slug: worker-log-rotation-pid
type: quick
completed: 2026-06-11
code_commit: b5e916e23fadfe9ea607f0afaa95952db445215c
files_modified:
  - backend/app/services/logging_sink.py
  - backend/tests/test_093_log_sink.py
test_result: "11 passed, 1 warning (test_093_log_sink.py — backend venv)"
---

# Quick 260611-irx: Per-process log filename — Windows multi-worker rotation crash fix

## One-liner

`install_file_log_sink()` now inserts `os.getpid()` into the resolved log filename
(`backend.log` → `backend.<pid>.log`) so each multi-worker uvicorn process owns its
own `RotatingFileHandler` target — fixing the Windows `WinError 32` crash when one
worker's `doRollover` tried to `os.rename` a file another worker still held open.

## Root cause

Multi-worker uvicorn is the default (`WORKER_COUNT=2`, D-PRD-12). Every worker
process imports `main.py` and installs the D-20 file log-sink on the **same**
`backend/logs/backend.log`. When the file reaches `maxBytes` and one worker rotates
(`RotatingFileHandler.doRollover` → `os.rename(backend.log, backend.log.1)`), Windows
refuses the rename because another worker still holds `backend.log` open for append
(WinError 32 — "file is being used by another process"). The crash surfaced live
during thread navigation. Per-process filenames make every worker rotate only the
file it exclusively owns, so the rename never collides. On POSIX this additionally
stops two workers interleaving lines into one file.

## Code change — `backend/app/services/logging_sink.py`

In `install_file_log_sink()`, AFTER the absolute-path resolution and BEFORE
`os.makedirs`/handler construction, inserted the PID into the filename:

```python
path = Path(raw_path)
if not path.is_absolute():
    path = _BACKEND_DIR / path

# Per-process log filename — multi-worker Windows-rename root cause. [11-line comment]
path = path.with_name(f"{path.stem}.{os.getpid()}{path.suffix}")
resolved = str(path)
```

`os` was already imported; `maxBytes`/`backupCount`/`encoding` unchanged.

**Lines changed:** 4 original lines (the `path = Path(raw_path)` … `resolved = str(path)`
block) expanded to 15 — added an 11-line root-cause comment plus the one-line
`path = path.with_name(...)` rename, then `resolved = str(path)`. Net: +11 lines in
`logging_sink.py`. No other line in the file touched.

## Kept intact (verified by grep + passing tests)

- env-var opt-in gate (`raw_path = os.getenv("LOG_FILE_PATH") or os.getenv("BACKEND_LOG_FILE")`; no var → `None`, no handler)
- `_gsd_093_sink` idempotency guard (keys on the handler attribute, not the path — left as-is; a 2nd call still returns the already-resolved per-PID path and adds no 2nd handler)
- `_RedactingFilter` attach (secret redaction — all 6 redaction tests green)
- root-level INFO bump (`if current == NOTSET or current > INFO: setLevel(INFO)`)
- `try/except OSError` degrade-to-console-and-return-`None` (unwritable path test green)
- `os.chmod(resolved, 0o600)` best-effort permissions

## Test changes — `backend/tests/test_093_log_sink.py`

The per-PID filename breaks every test that read the **hardcoded configured name**
(`tmp_path / "backend.log"` or `tmp_path / "logs" / "backend.log"`) because the handler
now writes `backend.<pid>.log`. Each was redirected to read the **actual** sink file
while preserving its assertion intent. Added imports `os` + `pathlib.Path`, and a
`_sink_file()` helper that returns the single installed handler's `.baseFilename`
(asserting exactly one sink handler).

| Test | Old read path | New read | Why / intent preserved |
|------|---------------|----------|------------------------|
| `test_installs_rotating_file_handler_when_env_set` | `result == str(logfile)` + `_read(str(logfile))` | assert `result` is the per-PID variant (same parent + `name == f"backend.{getpid()}.log"`), parent dir still created, `_read(result)` | Proves handler added + **parent-dir-created** + return-value contract; now asserts the per-PID name explicitly instead of the bare configured name |
| `test_redacts_openai_style_key` | `_read(str(tmp_path / "backend.log"))` | `_read(_sink_file())` | `sk-…` key redaction proof unchanged — reads the real file |
| `test_redacts_authorization_bearer_token` | same | `_read(_sink_file())` | Bearer-token redaction proof unchanged |
| `test_redacts_jwt_shaped_token` | same | `_read(_sink_file())` | JWT redaction proof unchanged |
| `test_redacts_live_provider_env_value` | same | `_read(_sink_file())` | live provider-key-value redaction proof unchanged |
| `test_redacts_url_embedded_credentials` | same | `_read(_sink_file())` | URL-embedded-password redaction + host-visible proof unchanged |
| `test_redacts_dynamic_secret_named_env_value` | same | `_read(_sink_file())` | dynamic secret-named env redaction proof unchanged |
| `test_clean_record_is_not_mangled` | same | `_read(_sink_file())` | "clean record reaches file verbatim, no REDACTED" proof unchanged |
| `test_idempotent_second_call_adds_no_second_handler` | `first == second == str(logfile)` | `first == second == _sink_file()` + `Path(first).name == f"backend.{getpid()}.log"` + one handler | **idempotency-adds-one** proof preserved; both calls resolve to the same per-PID file |

**No security assertion weakened** — every `assert <secret> not in contents` /
`assert "REDACTED..." in contents` is byte-identical; only the file path being read
changed from a hardcoded name to the actual on-disk sink file.

Unaffected (no hardcoded read path): `test_opt_in_no_env_returns_none_and_installs_no_handler`,
`test_unwritable_path_returns_none_and_does_not_raise`.

## Verification

```
cd backend && venv/Scripts/python.exe -m pytest tests/test_093_log_sink.py -q
→ 11 passed, 1 warning in 0.27s
```

Acceptance criteria:
- `grep -c "getpid" backend/app/services/logging_sink.py` = 2 (≥ 1) ✓
- env-var opt-in / `_gsd_093_sink` / `_RedactingFilter` / OSError degrade all present + unchanged ✓
- `test_093_log_sink.py` passes fully (11/11); no hardcoded `backend.log` read assertion remains ✓
- no `backend/app/**` file other than `logging_sink.py` modified ✓

Containment: `git show --stat HEAD` lists exactly
`backend/app/services/logging_sink.py` + `backend/tests/test_093_log_sink.py`.

## Deviations

None. Plan Task 1 executed exactly as written. The test-path updates were
anticipated by the plan (the PID filename "WILL break tests that hardcode the read
path") and implemented via the plan-preferred mechanism (the handler's `.baseFilename`
through the existing `_sink_handlers()` helper, plus the `install_file_log_sink()`
return value).

## Operator note

Cosmetic side effect: the active log file is now `backend.<pid>.log` rather than
`backend.log`. The existing `.gitignore` rules (`logs/` + `*.log`) still cover it, so
the secret-leak mitigation is unchanged. A live re-UAT that greps the log must target
`backend.*.log` (or the per-worker file) instead of a fixed `backend.log` name.

## Self-Check: PASSED

- `backend/app/services/logging_sink.py` — FOUND (contains `getpid`, intact guards)
- `backend/tests/test_093_log_sink.py` — FOUND (11/11 green, reads actual sink file)
- commit `b5e916e23fadfe9ea607f0afaa95952db445215c` — FOUND on `v2.5-dev`
