---
quick_id: 260611-irx
slug: worker-log-rotation-pid
type: quick
created: 2026-06-11
files_modified:
  - backend/app/services/logging_sink.py
  - backend/tests/test_093_log_sink.py
must_haves:
  truths:
    - "With WORKER_COUNT>=2, each uvicorn worker process writes/rotates its OWN log file — no two processes share one RotatingFileHandler target, so os.rename during rollover never collides (Windows WinError 32 fixed)"
    - "The opt-in behavior (no LOG_FILE_PATH/BACKEND_LOG_FILE -> no handler -> None), the redaction filter, the idempotency guard, and the best-effort OSError degrade all remain intact"
  artifacts:
    - path: "backend/app/services/logging_sink.py"
      provides: "per-process log filename (PID inserted before the suffix) so each worker owns its rotation target"
      contains: "getpid"
---

<objective>
Fix the Windows multi-worker RotatingFileHandler rollover crash (WinError 32 on os.rename during doRollover) reported live during thread navigation. Root cause: multi-worker uvicorn (WORKER_COUNT>=2, D-PRD-12 default) makes each worker PROCESS install its own RotatingFileHandler on the SAME backend/logs/backend.log; when one worker rotates (rename backend.log -> backend.log.1) Windows refuses because another worker still holds the file open. Fix = make the log filename per-process by inserting os.getpid() into the resolved path (backend.log -> backend.<pid>.log) so each worker rotates only the file it owns. Zero new dependency, safe-by-construction, cross-platform (also avoids two workers interleaving lines into one file on POSIX).
</objective>

<tasks>

<task type="auto">
  <name>Task 1: Per-process log filename in install_file_log_sink + keep tests green</name>
  <files>backend/app/services/logging_sink.py, backend/tests/test_093_log_sink.py</files>
  <action>
  In backend/app/services/logging_sink.py install_file_log_sink(), AFTER the absolute-path
  resolution (path = _BACKEND_DIR / path when relative) and BEFORE os.makedirs/handler
  construction, insert the PID into the filename:

      path = path.with_name(f"{path.stem}.{os.getpid()}{path.suffix}")
      resolved = str(path)

  with a comment explaining the multi-worker Windows-rename root cause. `os` is already
  imported. Do NOT change: the opt-in env-var gate, the `_gsd_093_sink` idempotency guard
  (it keys on the handler attribute, not the path — leave it as-is), the `_RedactingFilter`
  attach, the root-level INFO bump, or the try/except OSError degrade-to-console-and-return-None.
  Keep maxBytes/backupCount/encoding unchanged. Touch NOTHING else under backend/app/**.

  Then run the 093 log-sink suite. The per-PID filename WILL break tests that hardcode the
  read path `tmp_path / "backend.log"` (e.g. test_installs_rotating_file_handler_when_env_set,
  and every redaction test that calls _read(str(tmp_path / "backend.log"))) because the handler
  now writes backend.<pid>.log. Update those tests to read the ACTUAL sink file rather than a
  hardcoded name — prefer the return value of install_file_log_sink() (the resolved path) or the
  sink handler's `.baseFilename` (via the existing `_sink_handlers()` helper). Keep the assertions'
  INTENT identical (redaction still proven, parent-dir-created still proven, idempotency-adds-one
  still proven). Do not weaken any security assertion.
  </action>
  <verify>
    <automated>cd backend &amp;&amp; venv/Scripts/python.exe -m pytest tests/test_093_log_sink.py -q</automated>
  </verify>
  <acceptance_criteria>
    - grep -c "getpid" backend/app/services/logging_sink.py >= 1
    - the env-var opt-in, _gsd_093_sink idempotency guard, _RedactingFilter, and OSError degrade are all still present (unchanged)
    - tests/test_093_log_sink.py passes fully (no hardcoded backend.log path assertion left that the PID filename would break)
    - no backend/app/** file other than logging_sink.py modified
  </acceptance_criteria>
  <done>Each worker process gets a per-PID log file; the 093 suite is green; opt-in/redaction/idempotency/degrade all intact.</done>
</task>

</tasks>

<output>
After completion, create .planning/quick/260611-irx-worker-log-rotation-pid/260611-irx-SUMMARY.md
</output>
