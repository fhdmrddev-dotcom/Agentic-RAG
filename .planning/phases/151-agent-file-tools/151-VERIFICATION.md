---
phase: 151-agent-file-tools
verified: 2026-07-14T00:00:00Z
status: human_needed
score: 4/4 roadmap success criteria code-verified; 1 human-only gate remaining (SC#10 live 4-axis UAT)
overrides_applied: 0
human_verification:
  - test: "Cross-provider: fire fetch_document_file AND attach_skill_file on OpenAI, Anthropic, Google, and OpenRouter (one representative model each)"
    expected: "Both tools construct/execute successfully on all 4 providers; no schema-translation error, no silent tool-call drop"
    why_human: "Real LLM tool-call behavior varies per provider at runtime; static schema translation is unit-proven (test_151_cross_provider_schema.py) but live model tool-selection/argument-fill behavior is not"
  - test: "Multi-tool: fetch_document_file → execute_code (open the real .docx with python-docx) → attach_skill_file(source=sandbox_output) in ONE turn"
    expected: "The agent fetches the real original bytes, operates on them in the sandbox, and attaches the real generated artifact to an owned skill — not a text reconstruction"
    why_human: "End-to-end 3-tool chain requires live sandbox + live model tool orchestration; cannot be proven by mocked unit tests"
  - test: "Parallel-thread: start a fetch_document_file in Thread A while Thread B accepts a new prompt"
    expected: "No cross-thread file/session bleed — Thread B's sandbox session is independent of Thread A's in-flight fetch"
    why_human: "Sandbox session caching per thread_id is a live concurrency property, not mockable in the unit tier"
  - test: "Long-message: attach_skill_file(source=inline) with a large payload after ≥50 prior messages, on a weak model (MiniMax/DeepSeek/GLM)"
    expected: "The inline content arrives intact (or is honestly refused at the 5MB cap) — no weak-model argument mangling silently truncates/corrupts the content"
    why_human: "Weak-model tool-argument fidelity under long context is a live behavioral property of the specific provider/model, not something a mock can simulate"
  - test: "Cross-user live check: with a second real account's document/skill id, confirm fetch_document_file and attach_skill_file both refuse live (not just in mocked unit tests)"
    expected: "Both tools return the honest 'not found or access denied' / 'no skill named ... that you own' error against a real second Supabase user row, end-to-end through the live service-role client"
    why_human: "Unit tests mock ctx.supabase entirely; a live run against the real local Supabase instance with a genuine second user is the actual SC#4 proof the service-role-has-no-RLS-backstop design depends on"
---

# Phase 151: Agent File Tools Verification Report

**Phase Goal:** The agent can materialize a real KB file into its sandbox to faithfully convert/render/operate on it (via `fetch_document_file`, owner/RLS-scoped, size-capped), and can attach files it creates — or a template the user hands it mid-conversation — to a skill it owns (via `attach_skill_file`, owner-only write, race-immune upsert), each reusing an existing owner-scope resolver rather than inventing a new one. Both tools register in the flat `_TOOL_REGISTRY` without touching `threads.py`.
**Verified:** 2026-07-14
**Status:** human_needed
**Re-verification:** No — initial verification

## Phase Convention Note

Per the explicit 146–150 false-green-avoidance convention documented in this phase's task brief: FILE-01/FILE-02 are intentionally left `Pending` in REQUIREMENTS.md until `/gsd:verify-work` + `/gsd:secure-phase` run the live SC#10 cross-provider 4-axis UAT authored in `151-VALIDATION.md`. This verification does NOT fail the phase for the `Pending` checkboxes — it instead verified the CODE delivers every roadmap Success Criterion, then isolated the one remaining gate (live 4-axis UAT) as the sole `human_needed` item. No automated failures were invented in place of that manual gate.

## Goal Achievement

### Observable Truths (mapped to ROADMAP Success Criteria)

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| 1 | SC#1 — `fetch_document_file` streams a KB document's ORIGINAL bytes into the sandbox (owner/RLS-scoped, size-capped), enabling real convert/render/operate | ✓ VERIFIED | `tool_dispatcher.py:265-426` (`_fetch_owned_document_bytes` + `_handle_fetch_document_file`); owner→global scope at `:294-312`; D-01 honest no-original error `:317-321`; D-02 PRE-download size cap `:326-342` (WR-03 hardened: NULL/0 `file_size` now refuses rather than bypassing, plus a post-download re-check backstop `:349-356`); ships to `/sandbox/input/<safe>` via `run_in_threadpool` `:392-419`. 10/10 `test_151_fetch_handler.py` unit tests green (confirmed by direct pytest run). |
| 2 | SC#2 — `attach_skill_file` saves a file the agent created onto a skill it owns (reusing `skill_files`+bucket); cannot write to skills it does not own or built-in skills | ✓ VERIFIED (see note) | `tool_dispatcher.py:549-677`; owner-only gate `.eq("name",...).eq("user_id", uid)` + `is_system` reject `:588-600` (WR-04 hardened: refusal copy no longer overclaims); reuses existing `skill_files` table + `skill-files` bucket, no new schema (D-08). **Note:** code intentionally allows writing to a skill that IS `is_global=true` **if the caller owns it** — a deliberate, reviewed, and unit-tested design decision (`test_owned_global_skill_is_writable`), not an oversight. See "Requirements Coverage" below for the literal-text nuance against ROADMAP SC#2's wording. |
| 3 | SC#3 — A user can hand the agent an existing template file mid-conversation and the agent attaches it to a skill | ✓ VERIFIED | `workspace.py:176-218` widened `validate_upload` (text-ish + image + OOXML, magic-byte gated per category, `MAX_FILE_SIZE` DoS guard first); `TemplateUpload.tsx:55` `accept=` widened in lockstep; `attach_skill_file(source="workspace")` (`tool_dispatcher.py:454-469`) consumes the uploaded `workspace_files` row via `_get_file_content`. 21/21 `test_151_upload_allowlist.py` + 17/17 pre-existing `test_workspace_template.py` green. |
| 4a | SC#4 (owner-scope half) — Neither tool can read or write another user's documents or skills, owner-scope enforced, proven cross-user | ✓ VERIFIED (unit) | `_fetch_owned_document_bytes` owner miss → global-folder fallback → honest error (T-01 unit: `test_cross_user_not_found_never_reads_others_doc`); `attach_skill_file` owner SELECT empty `.data` → refuse (T-04 unit: `test_refuse_when_skill_not_owned`). Service-role has no RLS backstop — both gates are app-layer `.eq(user_id)` filters, confirmed load-bearing by direct code read. Path-traversal defended on both write paths (`test_path_traversal_filename_sanitized`, `test_owner_prefixed_path_defends_traversal`). |
| 4b | SC#4 (cross-provider half) / SC#10 — Both hold across providers | ? UNCERTAIN (human) | Static schema-translation backstop is unit-proven (`test_151_cross_provider_schema.py`, both tools survive `_convert_tools_to_google`/`_convert_tools_to_anthropic`), but the **live** 4-axis cross-provider/multi-tool/parallel-thread/long-message UAT specified in `151-VALIDATION.md` has NOT been executed — no run IDs, Chrome MCP evidence, or UAT results artifact found anywhere in the phase directory or git history. This is the sole remaining gate. |
| 5 | Reuse-not-invent: both tools reuse an existing owner-scope resolver rather than inventing a new one | ✓ VERIFIED | `attach_skill_file`'s `kb_document` source (`_resolve_attach_source_bytes:533-541`) directly imports and calls `_fetch_owned_document_bytes` (the Plan-01 FILE-02 resolver) — traced by direct read, not just docstring claim. No duplicated owner-scope SELECT logic. |
| 6 | G-5 dual-wiring contract: both tools register in the flat `_TOOL_REGISTRY` without touching `threads.py` | ✓ VERIFIED | `grep threads.py` across the full `cfe45bcb..cec3c9c5` phase-151 commit range returns 0 files — confirmed via `git diff --name-only`. `_TOOL_REGISTRY` contains both `"fetch_document_file"` and `"attach_skill_file"` (registry size 29, confirmed by live Python import), each gated in `_CAPABILITY_FLAG_TOOLS` (`sandbox_enabled` / `self_improve_enabled` respectively) and in `openai_service.get_tools()`'s conditional appends. |

**Score:** 5/6 fully code-verified truths; 1 (4b, live cross-provider UAT) requires human/live execution — not a code gap, a manual gate not yet run.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `backend/app/services/tool_dispatcher.py` | `_handle_fetch_document_file` + `_fetch_owned_document_bytes` + `_handle_attach_skill_file` + `_resolve_attach_source_bytes` + registry/capability-flag lines | ✓ VERIFIED | All symbols present, importable, wired (confirmed by live `python -c` import + registry assertions) |
| `backend/app/services/openai_service.py` | `FETCH_DOCUMENT_FILE_TOOL` (sandbox-gated) + `ATTACH_SKILL_FILE_TOOL` (self_improve-gated) flat schemas | ✓ VERIFIED | Both schemas present at `:477-532` and `:1087-1113`; `anyOf`/`oneOf`-free confirmed via `json.dumps` assertion; gated appends at `:1161`/`:1169` |
| `backend/app/config.py` | `fetch_document_file_max_mb` operator-tunable cap | ✓ VERIFIED | `config.py:891` `fetch_document_file_max_mb: int = 50` (env `FETCH_DOCUMENT_FILE_MAX_MB`) |
| `supabase/migrations/101_skill_files_unique_index.sql` | ADDITIVE `CREATE UNIQUE INDEX` on `skill_files(skill_id, filename)` | ✓ VERIFIED | File present, correct DDL; **live-DB check via psycopg2 confirms the index actually exists in the local Postgres instance** (`SELECT indexname FROM pg_indexes ...` → 1 row), not just claimed in the SUMMARY |
| `supabase/full-schema.sql` | Regenerated bootstrap artifact reflecting the new index | ✓ VERIFIED | `skill_files_skill_filename_uniq` present at line 2458 |
| `backend/app/api/workspace.py` | Generalized `validate_upload` replacing OOXML-only `validate_ooxml` | ✓ VERIFIED | `validate_upload` at `:176-211`; `validate_ooxml = validate_upload` alias preserves Phase-100 callers (`:218`) |
| `frontend/src/components/panel/TemplateUpload.tsx` | Widened `accept=` | ✓ VERIFIED | `:55` — `.docx,.pptx,.xlsx,.md,.json,.csv,.txt,.py,.js,.sh,.png,.jpg,.jpeg,.gif,.webp` |
| `backend/tests/unit/test_151_*.py` (6 files) + count-assertion fixes | Full behavior coverage | ✓ VERIFIED | 97/97 phase-151 tests pass (live pytest run); `test_085_tool_registration.py` + `test_tool_dispatcher.py` count assertions updated and green |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `openai_service.get_tools()` | `FETCH_DOCUMENT_FILE_TOOL` | `sandbox_enabled` conditional append | ✓ WIRED | `:1164-1169` |
| `openai_service.get_tools()` | `ATTACH_SKILL_FILE_TOOL` | `self_improve_enabled` conditional append | ✓ WIRED | `:1154-1161` |
| `tool_dispatcher._TOOL_REGISTRY` | `_handle_fetch_document_file` / `_handle_attach_skill_file` | `dispatch_tool` lookup | ✓ WIRED | `:3655`, `:3657` |
| `_handle_fetch_document_file` | `documents` bucket | `run_in_threadpool(storage.download)` | ✓ WIRED | `:346-348`, threadpool-wrapped (D-v2.5-01 compliant) |
| `_handle_attach_skill_file` (source=`kb_document`) | `_fetch_owned_document_bytes` | reused resolver call | ✓ WIRED | `:537` — direct call, not a re-implementation |
| `skill_files` upsert | `skill_files_skill_filename_uniq` | `on_conflict="skill_id,filename"` | ✓ WIRED | `:633-639` upsert call matches the live index; confirmed both the code AND the DB index exist and agree |
| `upload_template` route | `validate_upload` | magic-byte/size gate at the door | ✓ WIRED | `:248` |
| `TemplateUpload.tsx accept=` | `workspace.py _ALLOWED_EXT` | lockstep allowlist | ✓ WIRED | Both sets match (docx/pptx/xlsx + md/json/csv/txt/py/js/sh + png/jpg/jpeg/gif/webp) |

### Data-Flow Trace (Level 4)

Not applicable in the UI-rendering sense (this phase ships two backend agent tools + a validator, no new dynamic-data UI component). The relevant data-flow question — "does the resolved data actually reach the destination, not a stub" — was traced instead as the Key Link table above: real Storage bytes flow resolver → threadpool download → sandbox `copy_to_runtime` / Storage `.upload`, confirmed by direct code read (not docstring claim).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Registry import + gate assertions | `python -c "from app.services.tool_dispatcher import _TOOL_REGISTRY, _CAPABILITY_FLAG_TOOLS; ..."` | `_TOOL_REGISTRY` size 29, both tools present with correct gates | ✓ PASS |
| Flat-schema (no anyOf/oneOf) | `json.dumps(FETCH_DOCUMENT_FILE_TOOL/ATTACH_SKILL_FILE_TOOL)` assertion | Both clean | ✓ PASS |
| Live-DB unique index check | `psycopg2` `SELECT indexname FROM pg_indexes WHERE tablename='skill_files' ...` | `[('skill_files_skill_filename_uniq',)]` | ✓ PASS |
| `threads.py` untouched across the whole phase | `git diff cfe45bcb..cec3c9c5 --name-only \| grep threads.py` | empty | ✓ PASS |
| No new `provider ==` code branch | `grep "^\s*if provider ==\|elif provider =="` | 0 matches (the 3 raw `grep -c "provider =="` hits are docstring/comment mentions of the ABSENCE of a fork, not code) | ✓ PASS |
| Frontend build | `cd frontend && npx vite build` | exit 0 (pre-existing chunk-size warnings only, unrelated to 151) | ✓ PASS |
| Pending-cloud-migrations tracker | `bash scripts/pending-cloud-migrations.sh` | Lists `101_skill_files_unique_index.sql` alongside 095-100 as pending vs `origin/production` | ✓ PASS |

### Probe Execution

N/A — this phase has no `scripts/*/tests/probe-*.sh` convention; no probes declared in PLAN/SUMMARY. Skipped.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| FILE-02 | 151-01 | `fetch_document_file` — materialize KB doc original bytes into sandbox, owner/RLS-scoped, size-capped | ✓ SATISFIED (code) | See Truth #1. REQUIREMENTS.md correctly shows `Pending` — false-green-avoidance convention, closes at verify-work+secure-phase after live UAT |
| FILE-01 | 151-02/03/04 | `attach_skill_file` — agent attaches created files (or a user-handed template) to an owned skill, owner-scoped, reusing `skill_files`+bucket | ✓ SATISFIED (code), 1 WARNING | See Truth #2/#5. REQUIREMENTS.md correctly shows `Pending`. **WARNING:** Plan 04's own frontmatter `must_haves.truths` states the tool "refuses global/is_system skills" — the shipped code refuses only `is_system` (+ non-owned), and deliberately permits writing to a skill that is `is_global=true` **when owned by the caller**. This is a reviewed, tested (`test_owned_global_skill_is_writable`), and reasoned decision (see the plan's own `T-151-04-03` threat-register entry, which explicitly disposes this exact scenario as "mitigate...the legitimate action stays owner-driven"), and the misleading refusal copy that originally overclaimed "(not a global...skill)" was corrected in WR-04. Core security invariant (no cross-user write) holds. Flagged as a WARNING, not a BLOCKER, because the security-relevant property is intact and the deviation from the literal must-have phrase is a documented, tested design call, not an oversight. |

No orphaned requirements — REQUIREMENTS.md's Phase 151 row set (FILE-01, FILE-02) exactly matches what the four plans declare in their `requirements:` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any phase-151-modified file | — | Clean |
| `tool_dispatcher.py` | (WR-04 resolution) | `attach_skill_file` permits writing to an owned `is_global` skill | ℹ️ Info | See Requirements Coverage above — documented, tested, reviewed deviation from one PLAN-frontmatter phrase; not a stub or oversight |
| `tool_dispatcher.py:580-660` | IN-01 (fixed) | Orphan-cleanup best-effort `remove` on DB-upsert failure after Storage upload succeeds | ℹ️ Info | Code-review-flagged and fixed (`cec3c9c5`); best-effort only (not a two-phase commit) — acceptable per the review's own framing (self-healing on retry) |

All 4 code-review WARNING findings (WR-01 honest-failure wrapper, WR-02 sandbox_output size cap, WR-03 NULL-file_size DoS bypass, WR-04 misleading refusal copy) plus the 1 INFO finding (IN-01 orphan cleanup) were verified FIXED by direct source read — the fix commits (`51a4f90e`, `2fc1b611`, `e2f130f6`, `dff9cc73`, `cec3c9c5`) are present in git history and the corresponding code changes are live in the files as read.

### Human Verification Required

The phase's own `151-VALIDATION.md` mandates a live SC#10 4-axis cross-provider UAT (Manual-Only Verifications section) that has not yet been executed — no run IDs, UAT results, or Chrome MCP evidence exist anywhere in the phase directory or git log. Per the phase's explicit false-green-avoidance convention, this is the correct and sole reason for `human_needed` status; the underlying code for every axis is in place and unit-tested.

### 1. Cross-provider tool-call execution

**Test:** Fire `fetch_document_file` and `attach_skill_file` on one representative model each from OpenAI, Anthropic, Google, and OpenRouter.
**Expected:** Both tools construct and execute successfully on all 4 providers — no schema-translation error, no silently dropped tool call.
**Why human:** Real LLM tool-selection/argument-fill behavior varies per provider at runtime; only the static schema-translation shape is unit-proven.

### 2. Multi-tool chain in one turn

**Test:** Single prompt: `fetch_document_file` → `execute_code` (open the real `.docx` with python-docx) → `attach_skill_file(source="sandbox_output")`.
**Expected:** The agent fetches real original bytes, operates on them for real in the sandbox, and attaches the genuinely generated artifact — not a text reconstruction.
**Why human:** End-to-end 3-tool live orchestration cannot be proven by mocked unit tests.

### 3. Parallel-thread isolation

**Test:** Start a `fetch_document_file` call in Thread A; immediately send a new prompt in Thread B.
**Expected:** No cross-thread file/session bleed — sandbox sessions are cached per `thread_id`.
**Why human:** Live concurrency property, not mockable in the unit tier.

### 4. Long-message / weak-model argument fidelity

**Test:** Exercise `attach_skill_file(source="inline")` with a large payload after ≥50 prior messages, on a weak model (MiniMax/DeepSeek/GLM).
**Expected:** Inline content arrives intact or is honestly refused at the 5 MB cap — no silent argument mangling.
**Why human:** Weak-model tool-argument fidelity under long context is a live, model-specific behavior.

### 5. Live cross-user refusal

**Test:** With a second real account's document/skill id, confirm both tools refuse live (end-to-end through the real local Supabase instance, not a mock).
**Expected:** Honest "not found or access denied" / "no skill named ... that you own" errors.
**Why human:** Unit tests mock `ctx.supabase` entirely; this is the actual proof that the service-role-has-no-RLS-backstop design holds against a real second user row.

### Gaps Summary

No code gaps found. All ROADMAP Success Criteria are delivered in the codebase, verified by direct source read (not SUMMARY claims), live database inspection (the migration 101 unique index genuinely exists in the local Postgres instance), a live pytest run (97/97 phase-151 tests green, 63 pre-existing unrelated failures confirmed NOT phase-151-caused by exact-count cross-check against `deferred-items.md`), a live frontend build (exit 0), and git-history verification that `threads.py` was never touched and no new `provider ==` code branch was introduced. All 5 code-review findings (4 WARNING + 1 INFO) were confirmed fixed by direct source inspection, not by trusting the SUMMARY's "fixed" claim.

The sole remaining item is the live SC#10 4-axis cross-provider UAT specified in `151-VALIDATION.md` — this is explicitly a manual/human gate per the phase's own convention, not a code defect, and no evidence exists that it has been run yet. Status is `human_needed` accordingly.

One WARNING-level note (not a blocker): `attach_skill_file` permits writing to an owned `is_global` skill, which is a slightly narrower literal reading than ROADMAP SC#2's "cannot write to global/built-in skills" phrase and Plan 04's own must_haves.truths bullet — but the deviation is a reviewed (WR-04), tested (`test_owned_global_skill_is_writable`), and reasoned (`T-151-04-03`) design decision, and the core security invariant (no cross-user write) holds. Surfaced for awareness; does not block phase progression.

---

_Verified: 2026-07-14_
_Verifier: Claude (gsd-verifier)_
