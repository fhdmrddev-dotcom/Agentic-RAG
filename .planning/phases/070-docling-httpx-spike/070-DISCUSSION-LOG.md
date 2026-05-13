# Phase 070: Docling httpx Spike - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 070-docling-httpx-spike
**Areas discussed:** Spike exit bar, 3-path enumeration policy, CI test design + Docling model download, Path (a) upgrade depth, Ingestion-control-flow non-regression (added by user mid-discussion)

---

## Spike exit bar

### Q1: Minimum proof bar that ends the spike

| Option | Description | Selected |
|--------|-------------|----------|
| Import coexistence only | Phase 070 ships when `import docling` + `from supabase import create_client` work together. No actual PDF extraction. | |
| Import + minimal extract | Same plus one `DocumentConverter().convert(<fixture.pdf>)` returns non-empty, AND a supabase client smoke call works. (Recommended) | ✓ |
| Import + extract + ABC fit | Same plus brief proof Docling output coerces to 069 `ExtractedDocument` shape. | |

**User's choice:** Recommended → Import + minimal extract
**Notes:** Locks D-070-01. Spike test will instantiate `DocumentConverter`, run `.convert()` on the committed Phase 069 fixture, assert non-empty result.

### Q2: Supabase SDK smoke check in spike

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — smoke call in the spike test | Spike test calls `supabase.table('documents').select(...).limit(1).execute()` alongside Docling import. (Recommended) | ✓ |
| No — rely on existing integration tests | Spike only proves Docling-side; existing integration tests catch supabase regressions post-merge. | |

**User's choice:** Yes — smoke call in the spike test
**Notes:** Locks D-070-02. The spike test exercises both SDKs in one process.

### Q3: 070/071 boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Hard line: no DoclingExtractor in 070 | Spike test imports `docling.DocumentConverter` directly (not via `extraction_service.py`). (Recommended) | ✓ |
| Soft line: DoclingExtractor stub | Phase 070 lands a commented skeleton class in `extraction_service.py`. | |
| Spike script only | Phase 070 ships a standalone `probe_docling_compat.py` plus CI test. | |

**User's choice:** Recommended → Hard line, no DoclingExtractor in 070
**Notes:** Locks D-070-03. Phase 071 owns the class.

### Q4: Matrix depth in 070-SUMMARY.md

| Option | Description | Selected |
|--------|-------------|----------|
| Verbatim attempt logs | Per rejected path: actual pip commands, exact errors, time spent, why we moved on. (Recommended) | ✓ |
| One-line rationale each | Short bullet per path; lighter; relies on reader trust. | |

**User's choice:** Recommended → Verbatim attempt logs
**Notes:** Locks D-070-04.

---

## 3-path enumeration policy

### Q5: Attempt all three paths or stop at first green?

| Option | Description | Selected |
|--------|-------------|----------|
| Try (a) first; stop at first green | If (a) green, ship it; pro-forma reject (b)/(c). (Recommended — SC#4 says rejection rationale, not empirical rejection.) | ✓ |
| Try (a) then verify (b) is impossible | If (a) green, also check `pip index versions docling` to falsify (b) empirically. | |
| Attempt all three regardless | Prototype (b) and (c) even if (a) works. | |

**User's choice:** Recommended → Try (a) first; stop at first green
**Notes:** Locks D-070-05. Plan 1 explicitly includes a one-shot `pip index versions docling` check to support the (b) rejection — cheap empirical falsification.

### Q6: Decision-loop on (a) failure

| Option | Description | Selected |
|--------|-------------|----------|
| Loop me in | Stop and surface what (a) broke; user picks (b)/(c). | |
| Claude proceeds | Follow PRD-recommended fallback order: (a) → (c) → (b). User reviews at phase close. | ✓ |

**User's choice:** Claude proceeds
**Notes:** Locks D-070-06. Spike is time-boxed; pausing mid-spike for path-choice drains the budget.

---

## CI test design + Docling model download

### Q7: What does `test_pdf_extractor_*.py` assert?

| Option | Description | Selected |
|--------|-------------|----------|
| Two-part compat test | `test_docling_supabase_coexist` + `test_supabase_smoke_post_resolution`. (Recommended — matches exit bar.) | ✓ |
| One end-to-end test | Single test runs Docling against fixture and asserts table/image counts. | |
| Pure import smoke + manual extract | CI imports only; manual extract documented in SUMMARY.md. | |

**User's choice:** Recommended → Two-part compat test
**Notes:** Locks D-070-07.

### Q8: Fixture PDF

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse 069's reference.pdf | Already committed at `backend/tests/fixtures/extraction/reference.pdf` (~3.3 KB). License-clean. (Recommended.) | ✓ |
| Add a Docling-strength PDF | New ~50-200 KB multi-column / borderless-table fixture. | |
| Use the user's reference thesis | 4 MB; license-questionable for repo commit. | |

**User's choice:** Recommended → Reuse 069's reference.pdf
**Notes:** Locks D-070-08.

### Q9: Docling ~600 MB first-run model download

| Option | Description | Selected |
|--------|-------------|----------|
| Allow first-run download in CI | Let DocumentConverter cache to `~/.cache/docling`. Adds ~1-2 min to first run. (Recommended for solo-dev CI.) | ✓ |
| Mark as manual-only with @pytest.mark.docling | Skipped in CI; runs locally. | |
| Pre-cache models in repo or CI image | More work; deterministic. | |
| Use Docling's minimal config | Skip heaviest models; spike proves install only. | |

**User's choice:** Recommended → Allow first-run download in CI
**Notes:** Locks D-070-09.

### Q10: Test file location

| Option | Description | Selected |
|--------|-------------|----------|
| `backend/tests/integration/test_pdf_extractor_docling_compat.py` | Matches SC#2 glob verbatim. (Recommended.) | ✓ |
| `backend/tests/integration/test_docling_httpx_compat.py` | Names the actual concern; would amend SC#2 wording. | |

**User's choice:** Recommended → `test_pdf_extractor_docling_compat.py`
**Notes:** Locks D-070-10.

---

## Path (a) upgrade depth

### Q11: Upgrade depth if path (a) wins

| Option | Description | Selected |
|--------|-------------|----------|
| Full upgrade + call-site sweep in 070 | Bump supabase==2.29.x, sweep gotrue/supafunc renames, full pytest green. (Recommended — SC#3 demands aligned pins.) | ✓ |
| Pin-only; sweep deferred to 071 | Update requirements.txt; renames defer; risks broken main. | |
| Sub-phase split | Spike proves compatibility in isolated venv; 071 owns sweep + pin. | |

**User's choice:** Recommended → Full upgrade + call-site sweep in 070
**Notes:** Locks D-070-11.

### Q12: Adjacent risks

| Option | Description | Selected |
|--------|-------------|----------|
| PRD's named risks: aexec + storage SDK | Spike test calls supabase.storage.from_(...).list() to prove storage works. (Recommended.) | ✓ |
| Add an explicit aexec smoke | Plus a run_in_threadpool-wrapped supabase call. | |
| Defer adjacent checks to full test suite | Spike's two-part test is enough. | |

**User's choice:** Recommended → PRD's named risks (storage smoke)
**Notes:** Locks D-070-12. The `aexec` / `run_in_threadpool` surface is covered by D-070-11's "full backend pytest green" gate, so no dedicated test needed.

---

## Matrix packaging + guardrail

### Q13: Matrix doc packaging

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in 070-SUMMARY.md | Matrix as `## Rejected Paths` section. (Recommended — matches SC#4 verbatim.) | ✓ |
| Standalone 070-SPIKE.md | Separate file linked from SUMMARY.md. | |

**User's choice:** Recommended → Inline in 070-SUMMARY.md
**Notes:** Locks D-070-13.

### Q14: Pin-regression guardrail

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — comment block + the integration test | requirements.txt comment near supabase/httpx pins citing Phase 070 + the CI test as regression gate. (Recommended.) | ✓ |
| No extra guardrail beyond the test | CI test alone. | |

**User's choice:** Recommended → Comment block + integration test
**Notes:** Locks D-070-14.

---

## Ingestion-control-flow non-regression (added by user mid-discussion)

The user surfaced a real concern: "what if we imported the document and started the ingestion, what happens if we navigated away in UI? or refreshed the page".

**Investigation done in-session:** Read `backend/app/api/documents.py:269` — current upload path queues `background_tasks.add_task(ingest_document, ...)` after the response is sent. FastAPI runs `BackgroundTasks` in the threadpool decoupled from the HTTP request lifetime. Status surfaces via Supabase Realtime on `documents.status` / `ingestion_step` updates. Navigate-away / page-refresh during ingestion already has zero effect today; UI reconciles on reload via the documents list query.

**Conclusion:** Phase 070 is a dep-resolution spike and doesn't touch the ingestion control flow. The current navigate-away/refresh resilience floor is structurally already in place. The deeper durability gap (worker dies mid-ingestion → row stuck in `status='processing'`) is real but lives in SEED-001 §"proper ingestion queue", deferred to v3.4 Automations.

### Q15: How to capture in 070 CONTEXT.md

| Option | Description | Selected |
|--------|-------------|----------|
| Non-regression assertion + flag for 071 | Add non-regression line to CONTEXT plus deferred-idea pointing at Phase 071 to verify Docling under heavy/slow conditions. (Recommended.) | ✓ |
| Also note worker-death in deferred ideas | Same plus explicit worker-restart / retry-queue deferred bullet linked to SEED-001. | |
| Skip — out of scope | Don't add to 070 CONTEXT.md. | |

**User's choice:** Recommended → Non-regression assertion + flag for 071
**Notes:** Locks D-070-15. Captured in `<code_context>` § Non-regression and `<deferred>` § "Verify Docling's heavy first-run download + slow extract doesn't OOM" with explicit re-open trigger. Worker-restart durability is captured separately in `<deferred>` pointing at SEED-001 / v3.4 Automations.

---

## Claude's Discretion

The following details were explicitly left open for `gsd-planner` / executor to decide based on the path that actually wins:

- Exact supabase 2.29.x patch version (latest 2.29.x at spike time).
- `pytest.fixture` scoping for supabase client in the spike test.
- Whether `test_supabase_smoke_post_resolution` is in the same file as `test_docling_supabase_coexist` (recommended: same file).
- Format of the requirements.txt comment block (match existing comment style in the file).
- Which storage bucket the smoke call lists from (pick any existing bucket in dev Supabase).
- The exact text of the PROJECT.md Key Decisions row (match existing D-* row style).
- The 2-plan split content (advisory in CONTEXT.md; planner finalizes based on winning path).

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section. Briefly:

- DoclingExtractor class construction → Phase 071.
- Docling quality benchmark vs LegacyExtractor → Phase 071 SC#1.
- Subprocess fence implementation (path c contingency) → Phase 071.
- Re-extraction migration for existing documents → Phase 071 SC#3.
- Confidence threshold recalibration → Phase 076.
- Docling-under-heavy-ingestion verification (OOM / worker-block check) → Phase 071, with explicit re-open trigger.
- Worker-restart / retry-queue durability → SEED-001 / v3.4 Automations milestone.
