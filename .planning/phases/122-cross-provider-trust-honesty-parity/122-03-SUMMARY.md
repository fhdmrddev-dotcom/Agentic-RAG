---
phase: 122-cross-provider-trust-honesty-parity
plan: 03
subsystem: cross-provider eval / forced-emit scoreboard
tags: [MP-03, eval, forced-emit, scoreboard, emit_tier, cross-provider, tier-change-gate, operator-gate]

requires:
  - phase: 122-02
    provides: "the forced_emit recovery ladder + emit_rung telemetry on the success dict (the winning rung name the scoreboard scores) + the honest-fail floor (emitted=None + failure reason)"
  - phase: 122-01
    provides: "emit_tier Literal[force_strict|force|coerce] on every MODEL_CAPABILITIES row (the declared tier the scoreboard scores against, default-SAFE coerce on registry miss)"
provides:
  - "a --forced-emit mode in scripts/eval_cross_provider.py (parallel to --workflow) that drives the REAL forced_emit ladder per (provider x EASY/HARD schema) and scores 4 axes (trigger/force/recovery/honest_fail) PASS/FAIL/DOCUMENTED"
  - "a dated forced-emit-scoreboard-<date>.{json,md} artifact writer mirroring emit_capability_table (model NAMES + verdicts only, never key material)"
  - "the operator grep-before-tier-flip ritual in .planning/eval/README.md (the MP-03 tier-change gate — NOT an automated pytest gate, D-122-06)"
  - "a structure-only pytest (fake forced_emit result, no live keys) proving the axis-scoring + writer + localhost-gate + DOCUMENTED-clears-the-gate contract"
affects:
  - "no runtime path — measurement-only (D-04/D-122-06): nothing in the app reads the scoreboard at runtime; it gates emit_tier flips via an operator ritual"

tech-stack:
  added: []
  patterns:
    - "direct-call eval harness: import forced_emit and drive it per (provider x schema) — NOT via body.model (which does not steer harness phases, Pitfall 6); the requested model steers the shot directly"
    - "the HARD schema (optional-heavy + additionalProperties confidence object) is the deliberate strict-rung trip-wire (Pitfall 1) that makes the recovery axis non-vacuous"
    - "PASS/FAIL/DOCUMENTED cells — a DOCUMENTED axis is an explicit known-limitation row whose declared emit_tier already reflects reality, so it CLEARS the gate (D-122-07); not a silent skip"
    - "localhost-gated, git-diffable, manual-gate eval: assert_localhost_only fires first, the artifact carries verdicts only, the operator greps the latest before any tier flip (no CI secrets)"
    - "load a script (not a package) under test via importlib.spec_from_file_location from the repo root"

key-files:
  created:
    - "backend/tests/unit/test_eval_forced_emit.py"
  modified:
    - "scripts/eval_cross_provider.py"
    - ".planning/eval/README.md"

key-decisions:
  - "The matrix is a DIRECT-CALL harness with NO bearer token / NO DB connection / NO agent run — forced_emit never WRITES, so the localhost gate (already in main()) is sufficient and no DB read is needed (T-122-03-03 SQL-injection surface is N/A — no new dynamic SQL)"
  - "The score_forced_emit_axes function is PURE (no I/O, no provider call) so the structure-only test drives it with a synthetic result; the live forced_emit call lives in _drive_forced_emit_cell, which the test never touches"
  - "recovery=PASS whenever the ladder won (top OR lower rung) — a top-rung win means recovery was never NEEDED (PASS), a lower-rung win means recovery DID fire (PASS); recovery=FAIL only when the ladder fell all the way to the honest-fail floor. force=PASS is the stricter axis (won on the declared TOP rung specifically)"
  - "trigger=FAIL on a provider_error (the model was never reached on any rung) but honest_fail still PASS (the ladder returned a clean non-silent failure) — the two axes measure different honesty properties"
  - "real settings resolution uses the app's own load_app_settings_async() + override_provider(provider) (NOT a hand-rolled settings object); forced_emit's cross-provider key/base_url injection is the second line of defense for the operator's live run"

patterns-established:
  - "Provider as a first-class eval axis: the scoreboard scores per (provider x schema_difficulty) cell, gating native-7 and reporting OpenRouter best-effort"
  - "The tier-change gate is an operator grep ritual over a dated artifact, not CI — the structure-only pytest proves shape, the operator's --forced-emit run proves providers"

requirements-completed: [MP-03]

duration: ~6min
completed: 2026-06-23
---

# Phase 122 Plan 03: Forced-Emit Cross-Provider Scoreboard (MP-03) Summary

**Made provider a first-class eval axis: a new `--forced-emit` mode in `scripts/eval_cross_provider.py` drives the REAL `forced_emit` recovery ladder (Plan 122-02) per `(provider × EASY/HARD schema)`, scores the 4 axes (trigger/force/recovery/honest_fail) as PASS/FAIL/DOCUMENTED, and writes a dated `forced-emit-scoreboard-<date>.{json,md}` artifact — so an `emit_tier` flip becomes measured (the operator grep-before-flip ritual), not assumed ("no silent tier flip", SC#3).**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-23T04:22:47Z
- **Completed:** 2026-06-23T04:29:11Z
- **Tasks:** 2 (both `type="auto"`)
- **Files:** 1 created, 2 modified

## Accomplishments

- **The `--forced-emit` matrix is live, parallel to `--workflow`.** A new `action="store_true"` flag (mirroring the `--workflow` flag template) dispatches in `main()` to `run_forced_emit_matrix` — a **direct-call harness** that imports `forced_emit` and drives it per `(provider, {easy, hard})`. Direct-call is deliberate (RESEARCH Open Q2 → A3): `forced_emit` resolves its tier + rung ladder from the model's `emit_tier`, and the *requested* model steers the shot directly — unlike harness phases, where `body.model` does not steer the sub-agent (Pitfall 6).
- **Two schemas, one of them the live trip-wire.** `_forced_emit_schemas()` builds an **EASY** schema (clean required-only — every model should win on its top rung) and a **HARD** schema (optional-heavy + an `additionalProperties` confidence object). The HARD schema is the Pitfall-1 trip-wire that 400s the OpenAI-schema family on the STRICT rung, forcing a descent to a lower rung — it is precisely what makes the `recovery` axis non-vacuous (a clean schema would always win on the top rung, so recovery could never be exercised).
- **4-axis scoring as a PURE function.** `score_forced_emit_axes(result, declared_emit_tier)` reads the ladder's result dict (`emitted` / `emit_rung` / `failure`) and scores `trigger` (model reached + attempted), `force` (won on the declared TOP rung), `recovery` (won somewhere on the ladder — top OR a lower rung after a higher one failed), `honest_fail` (a clean `_failure` when nothing won — never silent, never fabricated). Being pure, it is the unit the structure-only test drives with synthetic results (no live keys).
- **PASS / FAIL / DOCUMENTED cells.** `_build_forced_emit_cell` assembles the RESEARCH "MP-03 scoreboard artifact shape" (`schema_difficulty` / `provider` / `model_effective` / `declared_emit_tier` / `winning_rung` / `axes` / `documented[]` / `gated`). A `documented[]` entry overrides its axis to `DOCUMENTED` — a known-limitation row whose declared `emit_tier` already reflects reality, so it **clears the gate** (`_cell_gate_ok`, D-122-07). A `FAIL` with no documented note fails the cell honestly.
- **The dated artifact writer mirrors `emit_capability_table` exactly.** `emit_forced_emit_scoreboard` reuses `_eval_artifact_dir()` + `date.today().isoformat()` + a `.json` writer + an `md_lines` twin (`| provider | difficulty | tier | trigger | force | recovery | honest_fail | rung | gated |` + a documented-notes appendix) + the two `print(... written: ...)` lines. Writes `forced-emit-scoreboard-<stamp>.{json,md}`; full-matrix only (a partial `--provider` re-run never clobbers a full scoreboard).
- **native-7 gates; OpenRouter is best-effort.** `gated = provider in NATIVE_7`; the greppable `print_forced_emit_scoreboard` (EVAL_ROW / EVAL_SUMMARY markers) and the exit code (`0`/`2`/`1`) honor it — OpenRouter prints `BEST-EFFORT-*` and never flips the exit code (D-122-07).
- **The operator grep ritual is documented (the tier-change gate).** `.planning/eval/README.md` gained a "Forced-emit scoreboard" section + a "forced-emit grep ritual" mirroring the existing "Emit trigger" + "grep ritual": the operator runs `--forced-emit`, greps the latest dated scoreboard for the provider whose tier they intend to change, and attaches it to VALIDATION.md before flipping any `emit_tier`. It states explicitly that DOCUMENTED clears the gate and that native-7 gates while OpenRouter is best-effort, and that this is **NOT** a CI/pytest gate (live keys = secrets + cost + flakiness, rejected — D-122-06).
- **Structure-only pytest proves the shape (no live keys).** `backend/tests/unit/test_eval_forced_emit.py` injects fake `forced_emit` result dicts and asserts: axis scoring (force=PASS on top rung, recovery=PASS on a lower rung after a strict failure, honest_fail=PASS on a clean failure, trigger=FAIL on `provider_error`), the json/md twin writer (and the partial-run no-write guard), the localhost hard-gate (`SystemExit` on a cloud `SUPABASE_URL`), and DOCUMENTED-clears-the-gate. **11/11 green.** The live proof is the operator run.

## Task Commits

1. **Task 1: `--forced-emit` matrix + dated scoreboard writer** — `286111c0` (feat)
2. **Task 2: structure-only pytest + README grep ritual** — `912c6768` (test)

**Plan metadata:** _(this commit)_ `docs(122-03): complete forced-emit scoreboard plan`

## Files Created/Modified

- `scripts/eval_cross_provider.py` (+476) — Added the `--forced-emit` argparse flag (mirroring `--workflow`), the `main()` dispatch branch (direct-call, no token/DB), `FORCED_EMIT_AXES`, `_forced_emit_schemas()` (EASY + HARD with the `additionalProperties` trip-wire), `_FORCED_EMIT_PROMPT`, the pure `score_forced_emit_axes()`, `_build_forced_emit_cell()` + `_cell_gate_ok()`, the async `_drive_forced_emit_cell()` (real `forced_emit` call via `load_app_settings_async` + `override_provider`), `print_forced_emit_scoreboard()` (greppable EVAL_ROW/EVAL_SUMMARY), `emit_forced_emit_scoreboard()` (the dated json+md twin), and `run_forced_emit_matrix()` (the entry + exit-code logic). **Zero edits to `forced_emit.py`** — the scoreboard observes the real boundary, it never re-implements it (D-14 red line).
- `backend/tests/unit/test_eval_forced_emit.py` (NEW, +179) — Structure-only test loading the script via `importlib`; fake forced_emit result factories; 11 tests across axis-scoring, the artifact writer, the localhost gate, and DOCUMENTED-clears-the-gate.
- `.planning/eval/README.md` (+~95) — The "Forced-emit scoreboard" section + the operator grep-before-tier-flip ritual (the MP-03 tier-change gate).

## How It Was Verified

- **Task 1 verify (plan-automated):** `scripts/eval_cross_provider.py --help | grep -- --forced-emit` → the flag is listed.
- **Task 1 source/structure check:** a lazy-import probe confirmed `_parse_args(['--forced-emit', '--provider', 'openai']).forced_emit == True`, `_forced_emit_schemas()` builds `easy`+`hard` with the HARD `additionalProperties: True`, and `FORCED_EMIT_AXES == ('trigger','force','recovery','honest_fail')` — all WITHOUT importing the backend (pydantic-only lazy import).
- **Task 2 verify (plan-automated):** `pytest backend/tests/unit/test_eval_forced_emit.py -x -q` → **11/11 pass** (fake gateway, no live keys; the cloud-`SUPABASE_URL` → `SystemExit` assertion fires).
- **No-regression:** `pytest backend/tests/unit/test_forced_emit.py backend/tests/unit/test_103_forced_emit_strict.py -q` → **21/21 pass** (this plan made ZERO edits to `forced_emit.py`; it only consumes the ladder).
- **README ritual present:** grep confirmed the "Forced-emit scoreboard" heading, the "forced-emit grep ritual" + "before flipping any `emit_tier`", the "DOCUMENTED clears the gate (D-122-07)", and the "native-7 GATES" lines.

## Decisions Made

- **Direct-call harness, no DB/HTTP write surface.** The matrix never drives an agent run and never WRITES — so it needs no bearer token and no DB connection. The localhost hard-gate at the top of `main()` (existing, unchanged) is sufficient. This collapses the T-122-03-03 SQL-injection surface to N/A (no new dynamic SQL) and keeps the harness import-light.
- **`recovery` is the lenient axis, `force` is the strict one.** `recovery=PASS` whenever the ladder won at all (a top-rung win means recovery was never *needed*; a lower-rung win means recovery *fired*) — `recovery=FAIL` only when the ladder reached the honest-fail floor. `force=PASS` is the precise "won on the declared TOP rung" signal. This split lets a HARD-schema descent (the expected DeepSeek/OpenAI behavior) show as `force=FAIL` + `recovery=PASS`, which a `documented[]` note then converts to a gate-clearing DOCUMENTED row.
- **`trigger` vs `honest_fail` measure different properties.** `trigger=FAIL` on a `provider_error` (the model was never reached on any rung) but `honest_fail=PASS` (the ladder still returned a clean, non-silent failure) — a provider being down is honest about being down, but it is not a successful emission attempt.
- **Real settings via the app's own helpers.** `_drive_forced_emit_cell` resolves settings with `load_app_settings_async()` + `override_provider(provider)` (the SAME path the app uses to switch credentials), not a hand-rolled object — so the operator's live run exercises the real cross-provider key/base_url resolution that `forced_emit`'s injection block also guards.

## Deviations from Plan

None — plan executed exactly as written.

The plan named `config.py:672-682 _SUB_AGENT_MODEL_DEFAULTS` as "the effective roster" reference; the matrix uses the `PROVIDERS` roster (the representative model per provider, the eval's own constant) directly per the `<read_first>` reuse-verbatim list, which is the correct first-class-axis roster for a direct-call shot (the sub-agent-default table matters only for the body.model-doesn't-steer harness path, which this mode deliberately bypasses).

## Issues Encountered

- **One corrected import target during implementation:** the first draft of `_drive_forced_emit_cell` referenced a non-existent `app.services.user_settings.resolve_user_settings`. Corrected to the real `app.models.user_settings.load_app_settings_async` + `override_provider` before any commit (caught by reading the actual `user_settings` module). No committed code ever carried the wrong import.

## Known Stubs

None. The matrix drives the real `forced_emit` ladder; the scoring is a fully-wired pure function; the writer produces a real dated artifact. The artifact itself is produced only on the operator's live `--forced-emit` run (by design — D-122-06; the committed code + its structure-only test are fully runnable WITHOUT live API keys). No placeholder values, no hardcoded-empty data flowing to a surface, no unwired paths.

## Threat Flags

None. The plan's threat register is honored in code:
- **T-122-03-01 (Tampering — cloud writes):** `assert_localhost_only()` fires at the top of `main()` before any work; the structure-only test asserts a cloud `SUPABASE_URL` raises `SystemExit`.
- **T-122-03-02 (Information Disclosure — secrets in output):** the scoreboard artifact carries model NAMES + verdicts ONLY; a missing provider key marks the cell MISSING via presence-only `os.getenv` (never the value); the `_drive_forced_emit_cell` exception path logs `type(e).__name__` only (never message content).
- **T-122-03-03 (Tampering — SQL injection):** N/A — the direct-call harness reads no DB (no new dynamic SQL).
- **T-122-03-04 (Authentication — bearer mint):** N/A — the matrix mints no bearer (no agent run).
- **T-122-03-SC (supply chain):** no packages installed — the eval imports already-pinned backend venv deps.

No NEW security surface (no new endpoint, auth path, file access, or schema change) was introduced.

## Next Phase Readiness

- **The MP-03 gate is ready for the operator.** At validate-phase the operator runs `scripts/eval_cross_provider.py --forced-emit`, which writes `.planning/eval/forced-emit-scoreboard-<date>.{json,md}`, and attaches it to VALIDATION.md — the live MP-03 evidence (D-122-06). The scoreboard is the only thing that may justify an `emit_tier` promotion/demotion (the operator grep ritual); the Plan 122-02 ladder never mutates the registry.
- **Provider is now a first-class axis in the eval.** Any future `emit_tier` change (e.g. promoting a DeepSeek row back to `force_strict`, or a STRETCH Phase 129 MiniMax arg-repair landing) is gated on a fresh forced-emit scoreboard, not an assumption.

## Self-Check: PASSED

- Files verified on disk: `scripts/eval_cross_provider.py`, `backend/tests/unit/test_eval_forced_emit.py`, `.planning/eval/README.md`, `122-03-SUMMARY.md` — all FOUND.
- Commits verified in git log: `286111c0` (feat — matrix + writer), `912c6768` (test — structure-only + README) — all FOUND.

---
*Phase: 122-cross-provider-trust-honesty-parity*
*Completed: 2026-06-23*
