---
phase: 291-describe-it-from-your-own-files
plan: 06
subsystem: workflow-authoring (describe door, gap round 1)
tags: [gap-closure, auth-02, security, cr-01, cr-02, wr-08, wr-09, wr-10]
gap_closure_round: 1
requires:
  - "291-02: describe_draft_guards (powers guard, fence, coverage), GenerateRequest.form / references"
  - "291-04: useTemplateFirstDraft formBodyFor / onDraft wire"
  - "291-05: describeRefusalVocabulary grounding_unavailable row"
provides:
  - "execute_code is a power a file cannot grant (POWER_TOOLS, DescribePowers Literal, instruction, _TOOL_LEAD 'Removed: run code.')"
  - "file-derived names inside escaped <document_fields> (read-time proposal) and <missing_fields> (coverage retry)"
  - "Word line-blank labels tail-capped at LABEL_MAX_CHARS; over-long cell labels dropped; AcroForm labels capped at read time"
  - "generate body caps: 1000 fields, 500 options/field, 20,000 options total; % allowed on arm form_fields only"
  - "prompt shows 25 options per field + 'and N more'; inputs and fields_report keep every option"
  - "client mirrors the caps; an unsendable form stops the draft with FORM_NOT_SENDABLE_KEY (never dropped silently)"
  - "could_not_generate:removed_powers_broke_draft renders the server's own sentence"
  - "test_214 S7 pin asserts by value (3 CONNECTION_REFUSAL_* + 1 grounding_unavailable)"
affects:
  - "verify-work 291: SC#4 roster, G-4 S1-S7 (S1 first), SC#5 live fill remain OWED"
  - "/gsd:fast after round 1: WR-03 and WR-05 (SECURITY) scheduled"
tech-stack:
  added: []
  patterns:
    - "file-derived values go in a named, escaped data block; instruction lines only refer to the block"
    - "cut for the PROMPT, never for the data: bounded option list shown to the model, full list kept for inputs"
    - "a mirrored client cap returns WHICH cap tripped, so the refusal can be stated instead of a silent drop"
key-files:
  created:
    - backend/tests/unit/test_291_untrusted_names_fence.py
  modified:
    - backend/app/services/describe_draft_guards.py
    - backend/app/services/describe_files.py
    - backend/app/api/workflow_authoring_doors.py
    - frontend/src/components/workflows/useTemplateFirstDraft.ts
    - frontend/src/components/workflows/describeRefusalVocabulary.ts
    - backend/tests/unit/test_291_powers_guard.py
    - backend/tests/unit/test_291_generate_degraded.py
    - backend/tests/unit/test_291_generate_coverage.py
    - backend/tests/unit/test_291_describe_read.py
    - backend/tests/unit/test_286_workflows_seam_pins.py
    - backend/tests/fixtures/phase286/workflows_openapi.json
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - frontend/src/components/workflows/useTemplateFirstDraft.test.tsx
    - frontend/src/components/workflows/describeRefusalVocabulary.test.ts
    - backend/tests/integration/test_214_argument_seams.py
    - .planning/phases/291-describe-it-from-your-own-files/deferred-items.md
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "execute_code joins POWER_TOOLS (CR-01): the sandbox container has no network restriction, so code is an egress channel stronger than web_search; sandbox_service.py untouched, network_mode deferred as a capability decision"
  - "CR-02 takes BOTH halves: raise the body caps (inputs keep every real choice) AND cut options for the prompt only (25 shown)"
  - "% in a field key is allowed only on arm form_fields (a PDF name is a pypdf dict key, never a Jinja token); { } < > and control characters stay refused on every arm"
  - "the client's form refusal sentence is generic on purpose; the specific cap rides errorDetail and shows only under the technical-names reveal"
metrics:
  duration: "~1h50m"
  completed: 2026-10-23
  tasks: 4
  commits: 7
---

# Phase 291 Plan 06: Gap Round 1 — execute_code is a power, real PDF forms reach the drafter Summary

A file can no longer plant an `execute_code` step (it is stripped and told as "Removed: run code."), file-derived field names and blank labels reach the model only inside escaped data blocks, and a real fillable PDF (250 fields, a 195-option dropdown, a field named "Rate %") now travels whole to the drafter — while any form the body still cannot carry stops the draft with a sentence instead of being dropped without a word.

## What changed, by finding

| Finding | Closed by | Commit(s) |
|---|---|---|
| **CR-01** (SC#3) — `execute_code` missing from the power set | `POWER_TOOLS`, `DescribePowers.tools` Literal, `DESCRIBE_POWERS_INSTRUCTION`, `_TOOL_LEAD["execute_code"] = "Removed: run code."` | 425eb094a → a2857dc5a |
| **WR-09** — file names spliced into instruction prose | `<missing_fields>` block in the coverage retry; `<document_fields>` block (`_fence_value`) in `proposal_prompt`; `_anchor_tail` caps line labels; over-long cell labels dropped | 425eb094a → a2857dc5a |
| **CR-02** (SC#1) server — real PDF shapes refused | `enum_options` max 500, `fields` max 1000, `_FORM_OPTIONS_TOTAL_MAX = 20_000`, `_FIELD_KEY_FORBIDDEN` / `_FIELD_KEY_JINJA` split with an arm-aware `model_validator`; `PROMPT_ENUM_SHOWN = 25` | 462d36859 → f919b6bb6 |
| **CR-02** client — silent drop | mirrored caps; `formBodyFor` → `{ body, blocked }`; `onDraft` early return `setErrorState(FORM_NOT_SENDABLE_KEY, blocked)`; `_acro_to_fields` label cap (W1) | a33f5d14a → 2fbb7c9c1 |
| **WR-08** — broke-draft refusal read the generic words | `could_not_generate:removed_powers_broke_draft` row = `_BROKE_DRAFT_DETAIL` split at its last sentence | a33f5d14a → 2fbb7c9c1 |
| **WR-10** — S7 pin counted any `"reason_code":` | 3 × `"reason_code":\s*CONNECTION_REFUSAL_` + 1 × `"reason_code":\s*"grounding_unavailable"` | 9fcff3a48 |

## TDD — RED captured before GREEN

**Task 1 RED** (`425eb094a`, run on unmodified source): `14 failed, 33 passed`. Quoted lines:
- `AssertionError: assert frozenset({'a...'web_search'}) == frozenset({...}) — Extra items in the right set: 'execute_code'`
- `assert [] == [{'kind': 'tool', 'slug': 'compute', 'tool': 'execute_code'}]` (llm_agent and llm_batch_agents)
- `AssertionError: assert 'execute_code' not in ['search_documents', 'execute_code']` (generate-level plant)
- `ValidationError ... tools.0 Input should be 'web_search', 'save_skill', 'attach_skill_file' or 'remember' ... input_value='execute_code'`
- `assert ('<document_fields>' in "An author attached ...")`; `ValueError: substring not found` (`<missing_fields>`)
- `AssertionError: assert 'a&lt;/missing_fields&gt;b' in 'These fields are not covered by any input or step: a</missing_fields>b. ...'`
- `AssertionError: assert 419 <= 120` (line label); cell label `assert [{'anchor_kind': 'cell', ...}] == []`

**Task 2 RED** (`462d36859`): `4 failed, 63 passed`. The accept case was refused at base:
`form.fields  List should have at most 200 items after validation, not 250 [type=too_long ...]`; the 20,000-total accept case: `form.fields.0.enum_options  List should have at most 50 items after validation, not 500`; the prompt case did not say "and 170 more". ⚠ The REFUSE cases (1001 fields, 501 options, 20,001 total, `%` on template_fields/blanks, braces on every arm) passed at base too, because the base caps were stricter; they are regression guards for the raised caps, not RED drives.

**Task 3 RED** (`a33f5d14a`): frontend `11 failed, 127 passed` — e.g. `expected [ 'describe' ] to deeply equal [ 'describe', 'form' ]` (the 250-field PDF was dropped), `expected "vi.fn()" to not be called at all, but actually been called 1 times` (1001 fields drafted blind), `expected 'The model couldn't produce a usable …' to be 'Your attached files asked for actions…'`, `expected 'undefined' to be 'string'` (`FORM_NOT_SENDABLE_KEY`). Backend: `AssertionError: assert 300 <= 120` (tooltip label). The template_fields 1001-field fallback case passed at base as intended (behaviour unchanged).

**WR-10:** the S7 backend case was RED at base (4 `"reason_code":` hits vs a pinned 3); it passes after the by-value rewrite.

## Re-baselines read, never blind

- `PIN286_CAPTURE=1`: `git diff --numstat -- backend/tests/fixtures/phase286/` → `2  2  workflows_openapi.json` only, exactly `"maxItems": 50 → 500` and `"maxItems": 200 → 1000`. `workflows_moved_ast.json` / `workflows_routes.json` showed no numstat (line-ending rewrite only) and were restored. Paragraph appended to the `test_286_workflows_seam_pins.py` docstring.
- `export-openapi.py` + `build-public-openapi.cjs`: `2  2  openapi.public.json`, `2  2  openapi.snapshot.json` — the same two `maxItems` values in each. `--check` exits 0.

## Gate results (run once, Task 4)

- **Backend unit baseline** (`node scripts/check-backend-unit-baseline.cjs`, local-DB lock taken and released):
  `70 failed, 8946 passed, 1 skipped, 2 xfailed, 2 xpassed, 46 warnings in 485.10s` → `[GATE PASSED] Backend unit baseline satisfied (failed: 70 <= 71, errors: 0).`
- **Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, repo root of the worktree):
  `total 11684 · failed 1 · pinned total 10663` → **`RESULT: COUNT GATE VIOLATED (1 reason(s))`** — `[failing-tests] 1 test(s) failed`. No per-file decrease (new file `describeRefusalVocabulary.test.ts` at 27 shows as `new`).
  The one failure, captured from the gate's own JSON report BEFORE any re-run: `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` → *"WorkflowBuilderPage canvas door — flag ON (D-183-01) clicking Canvas flips aria-selected and mounts the canvas; clicking Spine returns"*, `Error: STACK_TRACE_ERROR` after 6429 ms. `git diff --numstat 5fd2de572 HEAD` on that suite and on `WorkflowBuilderPage.tsx` is empty: **provably unmodified** by this plan. Re-run alone: `158 passed (158)`. One green sample is not proof of innocence; it is recorded as an observation, and the gate was not edited (`git diff --stat 5fd2de572 HEAD -- scripts/vitest-count-gate.cjs` is empty).
- **Targeted frontend suites:** `useTemplateFirstDraft.test.tsx` + `describeRefusalVocabulary.test.ts` + `WorkflowBuilderPage.test.tsx` → `3 passed (3), 161 passed (161)`.
- **tsc** (`npx tsc -p tsconfig.app.json --noEmit`): 63 errors in 28 files at HEAD; 63 errors in 28 files with the four frontend files of this plan swapped back to base. **Set diff of erroring files: empty.** No file this plan touched is in the set.
- `node scripts/check-hot-file-ledger.cjs .planning/phases/291-describe-it-from-your-own-files` → `ledger gate OK — every watched file has a row.`
- `node scripts/check-claude-md-size.cjs` → `claude-md size gate OK` (98,003 chars, 65.3%).
- `node scripts/build-public-openapi.cjs --check` → `OK — docs/public/api/openapi.public.json is current`.
- `node scripts/check-gap-closure-rounds.cjs 291` → `G-7 clear — 1 round(s) completed, no new capability built inside a closure round.`
- `test_214_argument_seams.py -k S7` → `2 passed`.
- No migration, no schema change, no sandbox change: `git diff --stat 5fd2de572 HEAD -- supabase/migrations backend/app/services/sandbox_service.py` is empty.

## Deviations from Plan

1. **[Rule 2 - test strength] A RED case that passed vacuously was strengthened.** `test_a_missing_key_that_tries_to_close_the_block_is_escaped` passed at base because the raw key itself supplied the one `</missing_fields>`; it now also asserts the escaped form `a&lt;/missing_fields&gt;b`, which fails at base. Committed in the RED commit.
2. **Refuse cases cannot be RED.** The plan asked every Task 2 case to fail before the edit; the refuse cases are refused by the stricter base caps too. Stated above rather than claimed.
3. **`_acro_to_fields` label falls back to the field name** when the capped tooltip is whitespace (`[:LABEL_MAX_CHARS].strip() or f.name`), so a label is never empty.

Otherwise the plan executed as written. `WorkflowBuilderPage.tsx`, `workflow_authoring.py`, `place_anchor`, `_clean_proposals`, `make_fillable_copy`, `read_acroform_fields` and `sandbox_service.py` are unchanged.

## G-5 / ledger

`useTemplateFirstDraft.ts` FIRES ("Extraction FIRST next"); this plan adds no new concern — the existing cap mirror and one early return in the existing callback — so G-5 is honoured by construction, and the extraction is still owed by the next phase that names the file. Five scan-list rows re-derived (`12/5/1155`, `4/2/196`, `4/2/793`, `4/1/1329`, `4/1/530`), five `— Phase 291 (291-06, gap round 1)` sections appended with the replaced cells verbatim, and the CLAUDE.md FIRING row updated (80-char cell), all in commit `9fcff3a48`.

## Owed — NOT closed by this round

- **SC#4** — `RUN_291_AUTHORING_ROSTER=1` roster run across the full native roster plus OpenRouter.
- **G-4 S1-S7** (291-VALIDATION.md) — run **S1** first.
- **SC#5** — live fill run on a fillable PDF and a confirmed Word copy.
- **Scheduled /gsd:fast immediately after round 1:** WR-03, and **WR-05 (SECURITY)** — minted `input:<key>` citations.
- Everything else (WR-01/02/04/06/07, IN-01..IN-08, sandbox `network_mode`) is in `deferred-items.md` → "Deferred at 291-06", each with its trigger.

AUTH-02 stays Pending until SC#4, S1-S7 and SC#5 run.

## Threat Flags

None. No new endpoint, auth path or schema; the body caps were raised but bounded in aggregate (T-291-06-03).

## Self-Check: PASSED

- FOUND: backend/tests/unit/test_291_untrusted_names_fence.py
- FOUND commits: 425eb094a, a2857dc5a, 462d36859, f919b6bb6, a33f5d14a, 2fbb7c9c1, 9fcff3a48
