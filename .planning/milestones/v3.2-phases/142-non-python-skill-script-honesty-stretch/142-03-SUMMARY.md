---
phase: 142-non-python-skill-script-honesty-stretch
plan: 03
subsystem: api
tags: [sandbox, tool-dispatcher, skills, honesty, read_skill_file, load_skill, byte-symmetry]

# Dependency graph
requires:
  - phase: 142-non-python-skill-script-honesty-stretch (Plan 01)
    provides: "SCRIPT_EXTS single-source module constant (decode whitelist + load_skill flag scan)"
  - phase: 099-workflow-skill-composition
    provides: "the shared _decode_skill_file_bytes extraction (live read + snapshot read call the SAME decoder → byte-symmetry for free)"
  - phase: 120-collision-fix-context-isolation
    provides: "off the COLL-01 injection seam (honesty-only, no shared-path fork)"
provides:
  - "_decode_skill_file_bytes SCRIPT_EXTS branch — .js/.sh/... decode as reference TEXT with the _SCRIPT_REF_CAVEAT 'not executable here' prefix (SC#3/D-11), replacing the misleading json binary error"
  - "_SCRIPT_REF_CAVEAT — the authored 'reference only — cannot execute it' caveat prefix (single source)"
  - "_skill_runtime_note(file_names) -> str | None — pure SCRIPT_EXTS ext-scan returning the advisory note naming offending scripts, else None"
  - "_SKILL_RUNTIME_NOTE — the authored load_skill runtime-note wording"
  - "_handle_load_skill additive 'runtime_note' key (D-05b) — computed defensively, present only when non-null, never blocks the load"
  - "test_142_read_skill_file.py + test_142_load_skill_flag.py — SC#3 decode + D-11 byte-symmetry + D-05b present/absent/never-blocks + the pure ext-scan"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extend the ONE shared decoder → both read paths (live + 099 snapshot) inherit the change identically (byte-symmetry for free / Pitfall 3)"
    - "Additive default-off result key computed defensively (except → no key), added only-when-present so the unchanged case stays byte-identical (mirrors save_skill lint_warnings)"

key-files:
  created:
    - backend/tests/unit/test_142_read_skill_file.py
    - backend/tests/unit/test_142_load_skill_flag.py
  modified:
    - backend/app/services/tool_dispatcher.py

key-decisions:
  - "runtime_note is present-only-when-non-null (NOT always-present-nullable): the all-Python load result stays byte-identical to today — nothing rides along when there is nothing to warn about. Test test_no_flag_all_python asserts the KEY IS ABSENT, keeping the contract explicit."
  - "The SCRIPT_EXTS decode branch was inserted BETWEEN the text-ext branch and the else — the true-binary else-branch is left byte-identical (D-02), so .png/.docx-that-fail-parse still report as binary."
  - "_skill_runtime_note uses os.path.splitext (path-aware) while _decode_skill_file_bytes uses rsplit('.',1) (its pre-existing extraction shape) — both lower-case and both resolve the same ext for a normal filename; kept each to its local idiom rather than forcing a shared splitter."

patterns-established:
  - "Pattern: when a behavior is shared by two call sites via one extracted function (099's _decode_skill_file_bytes), add new behavior INSIDE that function — never at the call sites — so symmetry is structural, not asserted per-site."

requirements-completed: [SRH-01]

# Metrics
duration: 5min
completed: 2026-07-08
---

# Phase 142 Plan 03: Honest read_skill_file + load_skill Runtime Flag Summary

**Made the two skill-file READ surfaces honest about non-Python scripts and added the proactive per-skill runtime flag on `load_skill` — a `.js`/`.sh` bundled file now decodes as reference TEXT with a "reference only — this sandbox runs Python only and cannot execute it" caveat (SC#3/D-11) instead of the false "binary — upload a text version" error, and because that branch lives in the ONE shared `_decode_skill_file_bytes`, the live read and the 099 snapshot read return the identical string automatically; `load_skill` now rides a non-blocking `runtime_note` naming any bundled script the Python-only sandbox cannot run (D-05b) — all additive, model-facing, byte-identical when there is nothing to say (D-02/D-12).**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-08T01:17:10Z
- **Completed:** 2026-07-08T01:22:36Z
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- **SC#3 / D-11 honest decode:** `_decode_skill_file_bytes` gets an `elif ext in SCRIPT_EXTS:` branch immediately BEFORE the existing `else`. A `.js`/`.sh`/`.ts`/… file now decodes as utf-8 source (`errors="replace"`, `\x00`-stripped) prefixed with the authored `_SCRIPT_REF_CAVEAT` ("[reference only — '{filename}' is a {ext} script; this sandbox runs Python only and cannot execute it. …]") as PLAIN TEXT — matching the `.py`/`.md` text-return contract, not the json error object. `read_skill_file` stops lying that a script is unreadable binary.
- **D-11 byte-symmetry (099 red line):** the change is inside the ONE shared decoder, so the live read path (`_handle_read_skill_file` live branch) and the 099 snapshot read path call the identical function and return the identical string — proven by `test_byte_symmetry_live_equals_snapshot`, which drives BOTH call sites for the same `.js` payload (different Storage prefixes, identical decoded output) and asserts equality. The two call sites were NOT touched (`git diff` = 20 additive lines, all inside the decoder + the new constant).
- **D-05b proactive load_skill flag:** a pure module-level `_skill_runtime_note(file_names)` scans each filename's extension against the shared Plan-01 `SCRIPT_EXTS` and returns the authored note naming the offending files (else `None`). `_handle_load_skill` computes it inside a defensive `try/except` (mirroring `save_skill`'s `lint_warnings` posture) and attaches a `"runtime_note"` key to the result JSON ONLY when non-null — so an all-Python skill's `load_skill` result is byte-identical to today, and a skill bundling `helper.js` tells the model at load time that the sandbox cannot run it.
- **D-02 / D-12 red lines held:** the true-binary else-branch is byte-identical (`.png` still reports "binary — upload a text version"), no capability file was touched (`sandbox_service.py` / `Dockerfile.sandbox` show zero diff), and no skill's stored instructions were edited (mechanism-only — the note rides the result, not the skill body).

## Task Commits

Each task committed atomically (Tasks 2/3 are the GREEN halves of the Task 1 RED scaffold — TDD):

1. **Task 1: read-decode + load_skill-flag test scaffolds (RED)** — `794a47b8` (test)
2. **Task 2: _decode_skill_file_bytes SCRIPT_EXTS reference-text branch (GREEN)** — `b263f39c` (feat)
3. **Task 3: _skill_runtime_note flag on _handle_load_skill (GREEN)** — `b1ad8fcf` (feat)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP/REQUIREMENTS) — see final docs commit.

## Files Created/Modified
- `backend/tests/unit/test_142_read_skill_file.py` (new) — `test_js_returns_reference_text` / `test_sh_returns_reference_text` (caveat-prefixed source string, not a json error), `test_true_binary_still_binary` (PNG magic bytes → unchanged json binary message, D-02), `test_byte_symmetry_live_equals_snapshot` (drives the live + 099-snapshot `_handle_read_skill_file` paths for one `.js` payload; asserts different download prefixes but identical decoded result). Local `_FakeStorage` + `_LiveSkillQuery` fakes modeled on `test_099_skill_composition`; uses the conftest `make_tool_context` fixture.
- `backend/tests/unit/test_142_load_skill_flag.py` (new) — `test_flag_present_for_js` (result carries `runtime_note` naming `helper.js`), `test_no_flag_all_python` (no `runtime_note` key; load intact), `test_note_never_blocks` (monkeypatched `_skill_runtime_note` raises → load still returns name/instructions/files), `test_runtime_note_pure` (the ext-scan returns the note for a `.js`, `None` for all-Python/empty). A `_FakeSupabase`/`_PassthroughQuery` in-memory pair + `ToolContext` built directly (mirrors `test_load_skill_collision`).
- `backend/app/services/tool_dispatcher.py` — added `_SCRIPT_REF_CAVEAT` + the `elif ext in SCRIPT_EXTS:` branch in `_decode_skill_file_bytes`; added `_SKILL_RUNTIME_NOTE` + the pure `_skill_runtime_note` helper; wired the defensive `runtime_note` additive key into `_handle_load_skill`'s result build.

## Decisions Made
- **Present-only-when-non-null runtime_note (not always-present-nullable):** the plan offered either shape. Chose present-only so the all-Python `load_skill` result is literally byte-identical to today's `{name, instructions, files}` — the note is additive surface that appears ONLY when there is a script to warn about. `test_no_flag_all_python` asserts `"runtime_note" not in payload` to lock the contract.
- **Branch placed between text-ext and else (D-02 intact):** inserting the SCRIPT_EXTS `elif` before the `else` leaves the true-binary path byte-identical — a `.png` or an undecodable type still returns the json "binary — upload a text version" message. The new branch only reclaims text-that-was-mislabeled-binary.
- **Local ext idioms kept:** `_skill_runtime_note` uses `os.path.splitext` (path-aware) and `_decode_skill_file_bytes` keeps its pre-existing `rsplit('.',1)` shape; both lowercase and resolve the same ext for normal filenames, so no shared splitter was forced onto the 099-extracted decoder.

## Deviations from Plan

None — plan executed exactly as written. The three decisions above are implementation-precision choices fully inside the plan's stated `<behavior>` / `<authored_content>`; they change no acceptance outcome and add no scope.

## Deferred Issues

None introduced by this plan. The two new test files add 8 tests (6 assert new behavior, 2 assert the unchanged D-02 / no-op-when-all-python guards). No pre-existing failures were touched; the only warning in every run is the pre-existing unrelated `urllib3`/`chardet` `RequestsDependencyWarning`.

## Threat Surface
No new security-relevant surface beyond the plan's registered **T-142-02** (accept): `_decode_skill_file_bytes` now returns `.js`/`.sh` source as text — the SAME posture as today's `.md`/`.py` reads (NOT a new class). Owner/global RLS already gates which skill files are readable (unchanged upstream in `_handle_read_skill_file`), and the `_SCRIPT_REF_CAVEAT` explicitly frames the content as reference-only, non-executable. No new read authority is granted — only the decode message changes for text that was previously mislabeled binary. `_skill_runtime_note` scans only owner/global-RLS-gated filenames. No network endpoints, auth paths, or schema changes.

## User Setup Required
None — honesty-only mechanism (D-02). No migration, no Docker rebuild, no new dependency.

## Next Phase Readiness
- Plan 03 was the final wave of Phase 142. The three honesty surfaces are now live end-to-end: the reactive reshape + per-run repeat-guard (Plan 02), the proactive `execute_code` tool-description facts (Plan 04), the import-time note + `SkillsPage` render (Plan 05), and now the `read_skill_file` decode + `load_skill` runtime flag (this plan).
- No blockers. Live evidence of the SC#3 read-honesty + D-05b load-flag reaching a model is a cross-provider UAT item (per 142-VALIDATION.md); the automated `test_byte_symmetry_live_equals_snapshot` proves the 099 red line holds by construction against the shared decoder.

## Self-Check: PASSED
- `backend/tests/unit/test_142_read_skill_file.py` — FOUND
- `backend/tests/unit/test_142_load_skill_flag.py` — FOUND
- `backend/app/services/tool_dispatcher.py` — FOUND
- Commit `794a47b8` (test) — FOUND
- Commit `b263f39c` (feat) — FOUND
- Commit `b1ad8fcf` (feat) — FOUND
- Verification: `test_142_read_skill_file.py` + `test_142_load_skill_flag.py` + `test_099_skill_composition.py` + `test_tool_dispatcher.py` = **38/38 GREEN**; sibling `test_142_runtime_gap.py` + `test_142_repeat_guard.py` = **12/12 GREEN**; `git diff --stat` shows `sandbox_service.py` / `Dockerfile.sandbox` untouched (D-02); `_decode_skill_file_bytes` diff is 20 additive lines with both read call sites unchanged.

---
*Phase: 142-non-python-skill-script-honesty-stretch*
*Completed: 2026-07-08*
