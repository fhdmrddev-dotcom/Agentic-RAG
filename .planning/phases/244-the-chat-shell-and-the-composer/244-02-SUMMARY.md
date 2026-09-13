---
phase: 244-the-chat-shell-and-the-composer
plan: 02
subsystem: api
tags: [fastapi, sandbox, docker, system-prompt, prompt-injection, path-traversal, vitest, pytest, ast-fence]

# Dependency graph
requires:
  - phase: 100-workspace-templates
    provides: "POST /threads/{id}/workspace/files, validate_upload, workspace_files + TTL + RLS"
  - phase: 151-skill-assets
    provides: "the widened 15-extension allow-list and its three content validators"
  - phase: 101-render-template
    provides: "_copy_in — the NamedTemporaryFile -> copy_to_runtime -> unlink shape this reuses"
provides:
  - "`.pdf` accepted at the chat-attachment door, with a %PDF- container validator (D-244-24 RULED)"
  - "ONE fenced source of truth for the extension allow-list, across three former hand-typed copies"
  - "Thread attachments hydrated into /sandbox/attachments/, once per sandbox session, traversal-fenced"
  - "A system-prompt section announcing the thread's attachments, General mode only, filename sanitised"
  - "Ledger rows + sections for three files that had none, one of them FIRING G-5 for its entire life"
affects: [244-05, 244-06, SEED-247, chat attachments, execute_code, workspace_files]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "?raw cross-tier set-equality fence (frontend suite parses backend .py source)"
    - "AST call-site fences that take SOURCE, so they can be falsified against mutated revisions"
    - "ast-stripped source fences: docstring + comments removed before asserting on code"
    - "ONE expiry gate, two readers — SQL decides membership, no second rule downstream"

key-files:
  created:
    - frontend/src/lib/workspaceAllowedExt.ts
    - frontend/src/lib/__tests__/workspaceAllowedExt.lockstep.test.ts
    - backend/tests/unit/test_244_workspace_pdf.py
    - backend/tests/unit/test_244_attachment_hydration.py
    - backend/tests/unit/test_244_attachment_prompt_line.py
  modified:
    - backend/app/api/workspace.py
    - backend/app/services/tool_dispatcher.py
    - backend/app/services/agent_loop.py
    - frontend/src/components/panel/TemplateUpload.tsx
    - .planning/sketches/236-the-file-that-belongs-to-this-chat/COPY.js
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md

key-decisions:
  - "D-244-24 taken: .pdf gets its OWN category set and its OWN magic-byte validator — not _TEXT_EXT (NUL-bearing) and not a bare _ALLOWED_EXT add (falls to an unreachable 422)"
  - "workspace_read's binary branch is UNTOUCHED — hydration is a second correct route, not a first one made to lie"
  - "The announced container path is imported from the hydration, never re-derived — one rule, one home"
  - "The announcement is General mode only: Explorer's tool set carries no workspace tool and no execute_code"
  - "Attachment hydration adds NO second expiry rule; list_files_in_thread's SQL gate stays the only one"

patterns-established:
  - "Cross-tier lockstep as a MECHANISM: three hand-typed copies collapsed to one source + a ?raw set-equality fence"
  - "Every fence in this plan was FALSIFIED against a planted defect and the file restored md5-identical"
  - "A source fence that reads prose can be made to lie by its own docstring — strip with ast before asserting"

requirements-completed: [SHELL-04]

# Metrics
duration: ~95min
completed: 2026-09-11
---

# Phase 244 Plan 02: The Agent Can Actually Use It — Summary

**`SHELL-04`'s second clause made true: `.pdf` is accepted with container validation, every
attachment is readable from `/sandbox/attachments/` inside `execute_code`, and the turn's system
prompt says so — General mode only, with the filename sanitised before it crosses into the model's
instructions.**

## Performance

- **Duration:** ~95 min
- **Started:** 2026-09-11 22:36 (+04:00)
- **Completed:** 2026-09-11 23:2x (+04:00)
- **Tasks:** 3 of 3 (each TDD: RED commit → GREEN commit)
- **Files modified:** 13 (5 created, 8 modified)

## Accomplishments

- **A person can attach the likeliest first file — a signed contract PDF — and the door accepts
  it.** `_PDF_EXT` + `_pdf_magic_ok` (`raw[:5] == b"%PDF-"`) as a fourth category, mirroring
  `_image_magic_ok`. The three shipped branches, the three size checks, the filename sanitiser and
  the TTL stamp are byte-unchanged. No new `kind`, no new table, **no migration** (D-244-01).
- **The agent can USE a binary attachment.** `_handle_execute_code` now hydrates the thread's
  non-expired workspace files into `/sandbox/attachments/`, once per sandbox session, using the
  copy mechanism that already existed in the same function. `pypdf`, `openpyxl`, `python-docx`,
  `python-pptx` and `PIL` are already in `agentic-rag-sandbox:101.1` — **this plan installs no
  packages** (T-244-02-SC verified by reading `docs/SANDBOX-PACKAGES.md`).
- **The agent is TOLD.** A sixth conditional append on the shared path, in the shipped `memory_note`
  shape, naming each file, its size, its mime and the exact container path — and saying what the
  data model says: scoped to this conversation, **not** in the knowledge base, **not** findable by
  `search_documents`, and expiring.
- **The allow-list stopped being three hand-typed copies kept equal by two comments pointing at
  each other.** One source (`workspaceAllowedExt.ts`), one `?raw` set-equality fence, one
  `COPY.js`-parsing sentence pin.

## Task Commits

1. **Task 1: Accept `.pdf`, and make the allow-list lockstep a mechanism**
   - `69fd6fa10` (test — RED) · `a4f01582b` (feat — GREEN)
2. **Task 2: Hydrate the thread's attachments into the sandbox**
   - `c0863ebce` (test — RED) · `633b0ad95` (feat — GREEN)
3. **Task 3: The attachment line in the turn's system prompt**
   - `e56f924c3` (test — RED) · `53a1f0173` (feat — GREEN)

**TDD gate compliance:** every task has a `test(244-02)` commit preceding its `feat(244-02)`
commit, in that order, in git log. No `refactor` commit was needed.

## Files Created/Modified

| File | What changed |
|---|---|
| `backend/app/api/workspace.py` | `_PDF_EXT`, `_pdf_magic_ok`, a fourth `validate_upload` branch (+36/−2) |
| `backend/app/services/tool_dispatcher.py` | `_attachment_container_path`, `_hydrate_thread_attachments`, a 4-line guarded call site, the `attachments` note key (+153) |
| `backend/app/services/agent_loop.py` | `_one_line`, `_build_attachment_note`, the sixth conditional append (+102) |
| `frontend/src/lib/workspaceAllowedExt.ts` | NEW — the single frontend source of the allow-list (54 L) |
| `frontend/src/components/panel/TemplateUpload.tsx` | the hand-typed `accept=` literal deleted; reads the constant |
| `.planning/sketches/.../COPY.js` | `COPY.engine.ALLOWED_EXT` gains `.pdf` — the acceptance bar tracks the build |
| `scripts/vitest-count-gate.cjs` | the new suite in BOTH knobs (`src/lib` has no directory entry) |
| `docs/HOT-FILE-LEDGER.md` / `CLAUDE.md` | 3 rows added, 2 refreshed, 5 sections, same commit as their code |

## Evidence — every fence was falsified, none is assumed

| Fence | Planted defect | RED output (verbatim) | Restored |
|---|---|---|---|
| Allow-list lockstep | `.pdf` deleted from `workspaceAllowedExt.ts` | `expected [ '.csv', '.docx', '.gif', …(12) ] to deeply equal [ … …(13) ]` — 3 of 6 red | md5 `5a63ea3e3adca51608f084de66ec8219` |
| T-244-02-02 traversal | `dest = f"{_ATTACHMENTS_DIR}/{src_path}"` | `assert ['/sandbox/attachments/../../etc/passwd'] == ['/sandbox/attachments/passwd']` — 5 parametrised cases red | md5 `35c2afce75d1f51df19b80bf5a81c0c1` |
| T-244-02-03 injection | `name = raw_path.lstrip("/")` | `AssertionError: injected text reached the prompt on a line of its own, outside the list entry` — 4 red | md5 `877936016fd7566f5ab02edf2fe23370` |
| Explorer gate (AST) | an ungated source string, in the suite | `AssertionError: … NOT inside an agent_mode/explorer gate` | n/a — driven against a string |
| Ordering (AST) | append placed after the terminator, in the suite | `AssertionError: … would never reach messages[0]['content']` | n/a — driven against a string |

**Initial RED, before any implementation:**

- Task 1 backend: `4 failed, 11 passed` — a real `%PDF-1.7` payload refused, `.pdf` absent from
  `_ALLOWED_EXT`, the refusal sentence's list missing `.pdf`, and an oversize `.pdf` never reaching
  the size check because the type gate fired first.
- Task 1 frontend: `Failed to resolve import "../workspaceAllowedExt". Does the file exist?`
- Task 2: `11 failed, 1 passed`. ⚠ The 1 pass was the zero-attachment case, and it was CORRECT that
  it passed — its contract is *"byte-identical to today"*, which today trivially satisfies. It
  became load-bearing only once the hydration existed, and that is recorded rather than counted as
  coverage.
- Task 3: collection error — `ImportError: cannot import name '_build_attachment_note' from
  'app.services.agent_loop'`.

## Gates

| Gate | Result |
|---|---|
| `pytest tests/unit -q --continue-on-collection-errors` | **72 failed / 4593 passed / 2 xfailed / 2 xpassed, 0 collection errors** — see the set diff below |
| The three new suites, targeted | **46 passed** (15 pdf + 12 hydration + 19 prompt line) |
| `npx tsc -p tsconfig.app.json --noEmit` | **67 errors — byte-identical to the documented base**, and **none in any file this plan touched** |
| `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | **`count gate OK — 260/260 pinned files present, no per-file decrease, 0 failing`** (verdict verbatim) |
| `node scripts/check-hot-file-ledger.cjs 244` | this plan's 3 `[no-row]` files are GONE; the 6 that remain belong to `244-01` / `244-05` / `244-06` |
| `node scripts/check-claude-md-size.cjs` | `92,391 chars · 61.6% of limit · [OK]` — no `[duplicate-row]`, no `[disposition-too-long]` |

### The count gate, verdict line verbatim, run from the repo root at `GSD_VITEST_MAX_WORKERS=2`

```
  total                                      7313    8083    +770
  total 8083  ·  failed 0  ·  pinned total 7313
count gate OK — 260/260 pinned files present, no per-file decrease, 0 failing.
```

⚠ **`260/260` is the load-bearing figure, not `8083`.** The gate's `[missing-file]` failure fires
when a pinned baseline file *did not run at all*, so a clean `260/260` is the proof that
`workspaceAllowedExt.lockstep.test.ts` both **ran** (TARGETS) and **met its pin of 6** (BASELINE) —
the two-knob trap this script documents eleven times over, and which `src/lib` is its standing
example of. **A growing total is the gate WORKING**; the `+770` and the five `— new` suites belong
to the phase's other plans and to unadopted suites, not to this one.

⚠ **This reading is from MY worktree only.** The plan's own execution context requires the wave's
single full gate run **after** the second merge, with the registry hunks re-applied by hand.

### ⚠ The backend failing SET, by filename — and the one row that is NOT this plan's

**Captured BEFORE any edit** (`grep -c`, never `| tail`): **71 failed / 4548 passed / 2 xfailed /
2 xpassed / 0 collection errors**, across 24 files:

```
test_061_consumer · test_071_1_threadpool_sweep · test_075_4_unknown_provider_error
test_111_1_reembed_kickoff · test_182_validate · test_190_review_fix_data_layer
test_200_1_phase_output_shape · test_chat_tool_approval · test_cross_worker_cancellation
test_db_runs · test_explorer_agent · test_extraction_service · test_forced_emit
test_get_model_capability_inference · test_lifespan · test_module7_tools
test_multimodal_query · test_per_format_ingestion · test_phase56_iteration_start
test_published_workflow_ownership · test_retrieval_service · test_sandbox_service
test_sql_service · test_streaming_reliability
```

**After Task 2: `71 failed / 4575 passed` — the failing SET was BYTE-IDENTICAL to the baseline
(`diff` returned nothing).**

**After Task 3: `72 failed / 4593 passed`, and the set diff names exactly ONE addition:**

```
> FAILED tests/unit/test_230_ingestion_jobs_db.py::test_live_claim_exclusivity_and_stale_recovery
```

⛔ **It is NOT this plan's, and here is the evidence rather than the assertion:**

1. **The file is provably unmodified by this plan** —
   `git diff --numstat <base> HEAD -- backend/tests/unit/test_230_ingestion_jobs_db.py` is **empty**,
   as is the diff over `backend/app/db/`.
2. **It passes in isolation** — `1 passed` on the same tree, immediately afterwards.
3. **Its failure mode names its own cause.** The assertion is
   `assert len(claimed_b) == 1` → `assert 0 == 1`: worker B claimed nothing from a **live Postgres**
   (`live_pg_pool`) using `FOR UPDATE SKIP LOCKED`. A concurrent claimant had already taken the row.
   **Plan `244-01` was executing in a sibling worktree against the SAME local Supabase** — which is
   verbatim the hazard CLAUDE.md's parallel-execution rule 4 names: *"Worktrees isolate files, not
   Postgres."*

⚠ **Said the way this project requires: the file is PROVABLY UNMODIFIED, and one green sample is
not proof of innocence.** The honest reading is *shared-database contention between two concurrent
worktree agents*, not a regression — but it is recorded here rather than smoothed away, because a
zero-headroom gate reading 72 must never be published as 71.

## Decisions Made

1. **`.pdf` gets its own category, not a membership.** Adding it to `_TEXT_EXT` would fail
   `_looks_like_text` (a PDF is NUL-bearing); adding it bare to `_ALLOWED_EXT` would fall past all
   three category branches to the belt-and-braces 422 that had been unreachable since Phase 151.
2. **`workspace_read`'s binary branch stays exactly as it is.** Its `"Content available via REST
   API."` note is *honest* for a text-reading tool. Hydration is a **second, correct route**; making
   the first one lie would have been the cheaper change and the wrong one.
3. **The once-per-session flag is set BEFORE the work, not after.** A hard failure must not
   re-attempt container I/O on every subsequent `execute_code` call. Per-FILE failures are named
   individually, so nothing is lost by it. (The shipped `_output_baseline_seeded` analog sets after;
   this divergence is deliberate and documented at the site.)
4. **The prompt imports `_attachment_container_path` rather than re-deriving a basename.** Two
   sanitisers for one rule would eventually disagree and hand the model a path the container does
   not contain — **a defect no test of either half alone could see**. `agent_loop` already imports
   `tool_dispatcher` at module level and the reverse edge does not exist, so this is cycle-safe.
5. **The displayed filename is derived from the container path**, not re-sanitised from the raw
   name — so the name the model reads is the name on disk.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — missing critical functionality] `_attachment_container_path` had no length cap**

- **Found during:** Task 3, by Task 3's own injection fence — **not** by Task 2's six cases, which
  asserted traversal and never length.
- **Issue:** a 4,000-character filename produced a 4,000-character container path. Two consequences:
  most filesystems refuse a path component over 255 bytes (an `ENOENT` the agent cannot diagnose),
  and — once Task 3 announces that path — a single filename floods the turn's system prompt.
- **Fix:** `_ATTACHMENT_NAME_MAX = 120` applied inside `_attachment_container_path` (the one home),
  cutting the tail so the `uuid8-` prefix that distinguishes workspace paths survives.
- **Files modified:** `backend/app/services/tool_dispatcher.py`
- **Verification:** the parametrised `/AAAA…(4000).txt` case in
  `test_244_attachment_prompt_line.py` went from red (`len(entry_lines[0]) < 400`) to green; the 12
  hydration cases stayed green.
- **Committed in:** `53a1f0173`

**2. [Rule 2 — missing critical functionality] nothing bounded the NUMBER of files hydrated**

- **Found during:** Task 2, writing the helper.
- **Issue:** the 10 MB cap is enforced per FILE at the upload door (three times), but nothing capped
  how many workspace rows a thread accumulates — and the agent writes here too. An unbounded loop of
  container I/O per session is the DoS arm of T-244-02-05.
- **Fix:** `_ATTACHMENT_HYDRATION_MAX_FILES = 50`, with the truncation **NAMED in the tool result**,
  never silent (the `confirm_preview` refusal discipline).
- **Files modified:** `backend/app/services/tool_dispatcher.py`
- **Verification:** covered by the hydration suite's result-note assertions.
- **Committed in:** `633b0ad95`

**3. [Rule 1 — bug] two source fences could be made to lie by their own docstrings**

- **Found during:** Tasks 2 and 3.
- **Issue:** `test_hydration_adds_no_second_expiry_rule` and
  `assert_nothing_provider_specific` read `inspect.getsource(...)` and matched the **prose**. The
  docstrings deliberately quote `expires_at IS NULL OR expires_at > now()` and the word "provider"
  in order to *record the invariant*, so each fence failed on the very sentence documenting what it
  guards — a false positive that would have been "fixed" by deleting the documentation.
- **Fix:** both fences now strip the docstring via `ast` and the `#` comments via a line-anchored
  regex before asserting, and each asserts the stripped body is non-empty first, so a strip that
  removed everything cannot pass vacuously.
- **Files modified:** the two test modules.
- **Verification:** both green, and both still fail against a body that genuinely re-implements the
  forbidden thing.
- **Committed in:** `633b0ad95`, `53a1f0173`

**4. [Rule 2 — completeness] three files had no ledger row, one FIRING for its entire life**

- **Found during:** Task 1, running `check-hot-file-ledger.cjs`.
- **Issue:** `244-CONTEXT.md` D-244-20 asserts *"all of this phase's hot files HAVE ledger rows"*.
  **Measured false** — and `backend/app/api/workspace.py` measures **11 / 6 / 654**, i.e. it has
  been **FIRING G-5 and invisible to it since it was created**. `244-PATTERNS.md` C-8 records the
  same measurement independently.
- **Fix:** rows + sections for `workspace.py`, `TemplateUpload.tsx` and the net-new
  `workspaceAllowedExt.ts` (added at CREATION, per the `settingsSearchPayload.ts` precedent), and
  the STALE triples for `tool_dispatcher.py` (`77/32/4679` → `80/34/4868`) and `agent_loop.py`
  (`39/20/3154` → `41/20/3275`) re-derived — all in the same commits as their code.
- **Committed in:** `a4f01582b` (3 new rows), `633b0ad95`, `53a1f0173`

---

**Total deviations:** 4 auto-fixed (2 × Rule 2 security/correctness, 1 × Rule 1 bug, 1 × Rule 2
registry completeness). **No Rule 4 architectural question arose. No migration was needed or
written**, which is what makes the ROADMAP's *"Migrations: none"* true rather than aspirational.

**Impact on plan:** no scope creep. The two caps are correctness requirements the threat register
already implied; the fence repairs are defects in the tests, not in the shipped code.

## Issues Encountered

- **A `--reporter=basic` flag does not exist in this vitest version** and fails with `ERR_LOAD_URL`
  while trying to load a reporter module. The plan's verification block specifies it; the default
  reporter was used instead. Worth correcting in future plans.
- **The commit-msg hook caps a message at 12 content lines.** Three commits were rewritten to fit.
  The detail moved here, which is where the hook says it belongs.
- **Two `Bash` invocations were refused by the worktree-isolation guard** for using `$(pwd)` and a
  `for` loop around `git log`. Split into plain commands; no workaround was attempted.

## Threat Flags

None. Every trust boundary this plan crosses was already in the plan's `<threat_model>` and all
seven dispositions are `mitigate`:

| Threat | Status |
|---|---|
| T-244-02-01 spoofed `.pdf` | `_pdf_magic_ok`, driven RED against 5 lying payloads |
| T-244-02-02 container-path traversal | basename reduction + charset narrowing + dot strip + length cap, driven RED |
| T-244-02-03 prompt injection via filename | CR/LF + control chars collapsed, markdown structure stripped, length capped, one `- ` line per entry, driven RED |
| T-244-02-04 cross-thread leak | `list_files_in_thread` is keyed on `ctx.thread_id` / `thread_id`, never a client-supplied id |
| T-244-02-05 hydration DoS | once-per-session guard + `copy_to_runtime` (no base64 preamble) + the shipped 10 MB cap + a NEW file-count cap |
| T-244-02-06 expired file resurfacing | both readers consume the SQL-gated listing; a source fence forbids a second rule in each |
| T-244-02-SC package installs | **none.** `pypdf` / `openpyxl` / `python-docx` / `python-pptx` verified present in `docs/SANDBOX-PACKAGES.md` |

## Known Stubs

None. No hardcoded empty value, placeholder string or unwired data source was introduced. (The
`placeholder` matches in `tool_dispatcher.py` / `agent_loop.py` are pre-existing and belong to the
`render_template` token machinery, untouched here.)

## User Setup Required

None — no env var, no migration, no external service. ⚠ One operator-visible note for the phase's
UAT: the sandbox session is cached per `thread_id` until idle eviction (default 30 min), so
attachments added to a thread whose container is already warm are hydrated on the **next** session,
not mid-session. This is the same cache semantics `SANDBOX_IMAGE` changes already have.

## Next Phase Readiness

**Ready.** `244-05` (the composer affordance) and `244-06` (the two doors) can both assume:

- the door accepts `.pdf`, and `WORKSPACE_ALLOWED_EXT` / `WORKSPACE_ACCEPT_ATTR` are importable from
  `@/lib/workspaceAllowedExt` for any new `accept=` — ⛔ **do not re-type the list**, the fence will
  go red and it is right to;
- the three refusal sentences are pinned to `COPY.engine`, so the sketch's refusal copy and the
  server's 422 cannot drift;
- the agent really can read an attachment, so a chip that says *"this chat only"* is backed by
  behaviour rather than by a promise.

**Owed, and named rather than left silent:**

- **The 8-row cross-provider board in `244-VALIDATION.md` § A is AUTHORED and entirely UNDRIVEN**
  (`⬜ owed` on all of P-1..P-8, plus X-1/X-2/X-3). This plan's criterion was that the board EXISTS
  with registry-derived ids — not that it is green. **O1 failing on any row would be a shared-path
  defect, not a provider quirk.** ⚠ Read the provider back from the run record, never from the
  control you clicked (the 2026-09-11 abandoned board).
- **Nothing here was independently reviewed.** Per D-244-21 Gemini is unavailable, so this is
  **self-verified**, not reviewed.

## Self-Check: PASSED

- **All 5 created files exist on disk** — `workspaceAllowedExt.ts`,
  `workspaceAllowedExt.lockstep.test.ts`, `test_244_workspace_pdf.py`,
  `test_244_attachment_hydration.py`, `test_244_attachment_prompt_line.py`.
- **All 6 commits are reachable** from `HEAD` on `223b3ea4f..HEAD`, in RED→GREEN order for each of
  the three tasks.
- **No file was deleted by any commit** — `git diff --diff-filter=D HEAD~1 HEAD` is empty after
  every one.
- **`STATE.md` and `ROADMAP.md` were NOT touched** — the orchestrator owns those writes.

---
*Phase: 244-the-chat-shell-and-the-composer*
*Plan: 02*
*Completed: 2026-09-11*
*⚠ Self-verified, NOT reviewed — D-244-21: Gemini is unavailable, so this phase has no independent
reviewer and a review round here would be a self-assessment.*
