# Phase 070: Docling httpx Spike - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Resolve **Q-v2.6-01**: docling 2.x pins `httpx>=0.28` while supabase 2.10 pins `httpx<0.28`. The PRD enumerates three resolution paths — (a) supabase-py 2.10 → 2.29 upgrade (with package renames `gotrue`→`supabase-auth`, `supafunc`→`supabase-functions`), (b) docling pin-back to an `httpx<0.28`-compatible version if one exists, (c) subprocess isolation for Docling — and recommends (a) first, falling back to (c). This phase picks one path, proves it with a CI-green integration test that exercises `docling` + `supabase` coexistence in a single Python process, locks the chosen pins in `requirements.txt`, and records a rejection matrix for the unchosen paths in `070-SUMMARY.md` so future maintainers don't relitigate.

The phase is a **time-boxed dependency-resolution spike** — narrow, decision-oriented, two-plan budget. Output is a chosen path + a working CI proof, not a Docling extractor.

**What this phase does NOT do:**
- Write `DoclingExtractor` against the 069 `PdfExtractor` ABC. That class lands in Phase 071 (RAG-DOCLING-01).
- Touch `backend/app/services/extraction_service.py` beyond what's needed for the spike test (the spike test imports `docling.DocumentConverter` directly, not via the dispatcher).
- Add a `pymupdf` or `pypdfium2` dependency — those are Phase 071 fallbacks. Spike scope is Docling-vs-supabase only.
- Change the ingestion pipeline control flow (`BackgroundTasks` decoupling, status badges, Realtime broadcast). Navigate-away / refresh resilience during ingestion is preserved verbatim (see `<code_context>` § Non-regression).
- Implement the AGPL subprocess fence for PyMuPDF — D-PRD-07 Appendix (closed in Phase 069 Plan 02) defines the contract; Phase 071 implements the fence.
- Run a benchmark of Docling output quality vs current pipeline. The spike proves it *runs*, not that it's *better* — quality benchmarking is Phase 071 SC#1 (within-20%-delta on the reference thesis pair).
- Recalibrate confidence thresholds for Docling chunk distributions. That's Phase 076 (RAG-RECAL-01, Q-v2.6-03).
- Build admin-tunable `EXTRACTOR_PRIMARY` config or per-document fallback. Phase 071.

</domain>

<decisions>
## Implementation Decisions

### Spike exit bar (D-070-01, D-070-02)

- **D-070-01:** The spike succeeds when **import coexistence + minimal extract + supabase smoke** all pass in a single test run. Concretely: in one Python process, `import docling`, instantiate `docling.document_converter.DocumentConverter`, call `.convert(fixture_pdf_path)` on the committed reference fixture, assert the result is non-empty (has at least a `document.export_to_markdown()` or equivalent string of length > 0). In the same test run, a `from supabase import create_client` plus a trivial `supabase.table("documents").select("id").limit(1).execute()` proves the supabase SDK still works under the chosen resolution. **Import-only is insufficient** — it would miss runtime conflicts where wheels load but client construction trips httpx. **Full ABC integration is too much** — that's Phase 071.

- **D-070-02:** The supabase smoke call is non-negotiable when path (a) wins (because the upgrade is the load-bearing change); it's still required if (c) wins (because the spike test needs to prove supabase didn't break while we changed how Docling is invoked). Use any harmless table read against the dev Supabase instance; the test does NOT mutate state.

### 070 / 071 boundary (D-070-03)

- **D-070-03:** Hard line — Phase 070 ships **no** `DoclingExtractor` class, no stub, no skeleton. The spike test imports `docling.document_converter.DocumentConverter` directly. Phase 071 owns `class DoclingExtractor(PdfExtractor)` against the 069 ABC. This keeps the 2-plan budget honest and prevents 071's scope from leaking back into 070.

### Attempt order (D-070-05, D-070-06)

- **D-070-05:** Try path **(a) supabase-py 2.10 → 2.29 upgrade first**. If green (spike test passes), stop. Record (b) and (c) in the rejection matrix as "not empirically attempted because (a) worked" with one-sentence pro-forma rationale per path. SC#4 says "rejection rationale," not "empirical rejection of every alternative" — for (b) specifically, the spike includes a one-shot check (`pip index versions docling` or PyPI lookup) that no docling version pins `httpx<0.28`, falsifying (b) cheaply. For (c) the rationale is "subprocess overhead unjustified once in-process works."

- **D-070-06:** If (a) fails at the spike test (importable but supabase smoke breaks, or extract breaks under the upgraded `aexec` pattern, or the storage SDK regresses), **Claude proceeds without asking** — follow the PRD-recommended fallback order: (a) → (c) → (b). The chosen-path decision lands in 070-SUMMARY.md; user reviews at phase close. This is a time-boxed spike; pausing mid-spike for path-choice drains the budget.

### CI test design (D-070-07, D-070-08, D-070-09, D-070-10)

- **D-070-07:** One test file with two test functions:
  1. `test_docling_supabase_coexist` — imports both packages, instantiates `DocumentConverter` and a supabase client, runs `DocumentConverter().convert(<fixture>)` and asserts non-empty result. This is the load-bearing assertion.
  2. `test_supabase_smoke_post_resolution` — separate test that runs a trivial `supabase.table("documents").select("id").limit(1).execute()` plus a `supabase.storage.from_("documents").list("", {"limit": 1})` call to exercise the storage SDK surface PRD §13 Q-v2.6-01 named as a risk. Either both pass → spike green; one fails → record in matrix and either fix the upgrade or escalate to (c).
  Test file lives at `backend/tests/integration/test_pdf_extractor_docling_compat.py` — matches the SC#2 glob `test_pdf_extractor_*.py` verbatim, no ROADMAP amendment needed.

- **D-070-08:** Spike fixture is **the existing 069 `backend/tests/fixtures/extraction/reference.pdf`** (~3.3 KB reportlab-synth). License-clean, tiny, deterministic. The spike is proving *coexistence + runs*, not *Docling quality* — quality benchmarking is Phase 071 with the user's reference thesis pair. Zero new fixture vetting cost; Phase 071 can add a Docling-strength fixture when it needs one.

- **D-070-09:** Allow Docling's ~600 MB first-run model download in CI. Cache to the runner's `~/.cache/docling` (Docling's default). First run is slow (~1-2 min); subsequent runs are fast. No `@pytest.mark.docling` skip-gate, no minimal-config tricks — the spike's whole point is to prove Docling's real runtime works under the chosen pins, not a synthetic subset. If CI runner caching turns out to be flaky, Phase 071 can add a pre-warm step.

- **D-070-10:** Test file at `backend/tests/integration/test_pdf_extractor_docling_compat.py`. Marker: `@pytest.mark.integration` if that marker exists in the project pytest config (check before writing); otherwise plain `integration/` folder placement is enough.

### Path (a) upgrade depth — if path (a) wins (D-070-11, D-070-12)

- **D-070-11:** Full upgrade + call-site sweep land in Phase 070, NOT deferred to 071. Concretely:
  1. Bump `supabase==2.10.0` → `supabase==2.29.x` in `backend/requirements.txt` (pin to the latest 2.29.x at spike time).
  2. Grep the entire `backend/` tree for `from gotrue` and `from supafunc` imports; rewrite to `from supabase_auth` and `from supabase_functions` respectively. Also check for any direct `gotrue.X` / `supafunc.X` attribute access.
  3. Run the full backend pytest suite. If anything breaks, fix in-phase (we own the change). Spike is not green until main is green.
  4. SC#3 says "requirements.txt reflects the chosen pins" — partial pins with broken imports would leave main red; not acceptable.

- **D-070-12:** Adjacent-risk smoke checks named in PRD §13 Q-v2.6-01:
  - **Supabase storage SDK** — `supabase.storage.from_("documents").list("", {"limit": 1})` in `test_supabase_smoke_post_resolution` (D-070-07).
  - **`aexec` pattern / `run_in_threadpool`** — the spike doesn't need a dedicated test here; the existing backend pytest suite (especially `test_threads_*.py` and integration tests that hit run-backed streaming) exercises `run_in_threadpool` heavily. The full-suite green requirement in D-070-11 covers this. If pytest goes red on `aexec`/threadpool paths post-upgrade, that's the signal to investigate before merge.

### Matrix packaging (D-070-04, D-070-13)

- **D-070-04:** Rejection matrix entries record: (i) the path identifier (a/b/c), (ii) **verbatim pip commands attempted** (`pip install supabase==2.29.0 docling==2.x` etc.), (iii) **verbatim error output** (pip resolver error, runtime ImportError, supabase client construction failure), (iv) wall-clock time spent on the attempt, (v) one-paragraph rejection rationale. For paths that were *pro-forma rejected* without empirical attempts (per D-070-05), still record the rationale — but flag clearly as "not attempted" so future maintainers know the rejection is theoretical.

- **D-070-13:** Matrix lives **inline in `070-SUMMARY.md`** as a `## Rejected Paths` section. No standalone `070-SPIKE.md`. ROADMAP SC#4 names `070-SUMMARY.md` verbatim. Section format: one `### Path (b) ...` / `### Path (c) ...` subsection per rejected option with the five fields from D-070-04.

### Regression guardrail (D-070-14)

- **D-070-14:** Add a comment block to `backend/requirements.txt` immediately above the `supabase==X` / `httpx==Y` lines stating: "Pinned by Phase 070 (Q-v2.6-01 resolution). Bumping past `<some upper bound>` re-introduces the docling httpx<0.28 conflict — re-run `backend/tests/integration/test_pdf_extractor_docling_compat.py` before changing." Plus the CI test itself acts as the regression gate — any future PR that bumps a pin in a way that re-breaks coexistence will trip the test.

### Non-regression: ingestion control flow (D-070-15)

- **D-070-15:** The spike does NOT change ingestion control flow. Today's path:
  1. `POST /documents` (`backend/app/api/documents.py:129+`) inline-extracts text, queues `background_tasks.add_task(ingest_document, ...)` at line 269, returns 200.
  2. `ingest_document` (line 634+, sync function) runs in FastAPI's threadpool after the response is sent — *decoupled from request lifetime*. Navigate-away or page-refresh after upload has zero effect.
  3. Status surfaces via Supabase Realtime on `documents.status` + `documents.ingestion_step` updates; UI reconciles on reload.
  Phase 070's chosen-path implementation MUST preserve this. Specifically: path (a) is a pure dep upgrade — no control-flow risk. Path (c) subprocess isolation, if it wins, would invoke a child `python -m extractor` from inside `ingest_document` (or its Phase-071 successor); the child's lifetime is bound to the parent task, which is bound to the FastAPI process — same failure model as today. No regression. (Deeper durability — survives-worker-restart — is SEED-001 territory, deferred. See `<deferred>`.)

### 2-plan split (advisory; gsd-planner finalizes)

ROADMAP allocates 2 plans. Suggested split, assuming path (a) wins:

1. **Plan 1 — Spike + upgrade + CI test:** Run the spike attempts in order (D-070-05). If (a) green, bump `supabase==2.29.x` + sweep `gotrue`/`supafunc` import renames + run full backend pytest suite + write `test_pdf_extractor_docling_compat.py` + verify CI green. Output: green main + green new test + chosen pins committed. This plan delivers SC#1 (partial — chosen path locked), SC#2 (CI integration test green), SC#3 (requirements.txt reflects pins).
2. **Plan 2 — Matrix + PROJECT.md decision recording + guardrail comment:** Author the `## Rejected Paths` section in `070-SUMMARY.md` per D-070-04/13. Append a "Q-v2.6-01 closure" entry to `.planning/PROJECT.md` Key Decisions table referencing 070-SUMMARY.md. Add the requirements.txt comment block per D-070-14. (If path (c) wins instead, this plan also documents the `EXTRACTOR_DOCLING_ISOLATION=subprocess|in-process` env var per SC#3.) Delivers SC#1 (PROJECT.md update), SC#4 (matrix), SC#3 (env var doc if applicable).

If path (c) wins instead, Plan 1's content shifts to "subprocess wrapper design + IPC contract + CI test"; Plan 2's content stays similar but additionally documents the env var. `gsd-planner` finalizes the split based on which path actually ships.

### Claude's Discretion

- Exact supabase 2.29.x patch version to pin (latest 2.29.x at spike time; check PyPI).
- Whether the spike test uses `pytest.fixture`-scoped supabase client or instantiates inline — either works; pick whatever reads cleanly.
- Whether `test_supabase_smoke_post_resolution` lives in the same file as `test_docling_supabase_coexist` or split. Same file is cleaner unless test isolation pushes back.
- Format of the requirements.txt comment block — match the existing style of comments in that file (e.g., the `# Phase 069 test fixtures` line at line 24).
- Whether the storage smoke call lists from the `documents` bucket or another existing bucket — pick whatever exists in the dev Supabase instance.
- The exact text of the PROJECT.md Key Decisions row — match the existing style of D-v2.5-* / D-PRD-* rows; ~3-line entry with rationale + outcome columns.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 070's direct upstream artifacts

- `.planning/ROADMAP.md` §Phase 070 (lines 266-275) — Goal + 4 Success Criteria + 2-plan budget + Wave 0 dependency on Phase 069.
- `.planning/PRDs/v2.6.md` §3 Theme A bullet 1 (Docling httpx-conflict spike scope).
- `.planning/PRDs/v2.6.md` §5 (line 152 `docling>=2.x` pin contingent on Q-v2.6-01; line 163 `EXTRACTOR_DOCLING_ISOLATION` env var for path-c contingency).
- `.planning/PRDs/v2.6.md` §13 Q-v2.6-01 (line 431) — three options + recommendation `(a) first, fall back to (c)`.
- `.planning/REQUIREMENTS.md` RAG-DOCLING-02 — verified by Phase 070's CI integration test.

### Locked decisions (already-decided context)

- `.planning/prd-reset/DECISIONS.md` D-PRD-07 (lines 502-580+) — Docling-first + PyMuPDF AGPL fallback. The decision that *this milestone ships Docling*; Phase 070 just resolves the dep conflict that gates it.
- `.planning/prd-reset/DECISIONS.md` D-PRD-07 Appendix (Phase 069 Plan 02, lines ~599-664) — PyMuPDF AGPL subprocess fence contract. Sets precedent if path (c) subprocess isolation wins for Docling.
- `.planning/prd-reset/DECISIONS.md` D-PRD-03 — Closed core + open peripherals (informs subprocess-fence rationale).
- `.planning/PROJECT.md` Key Decisions table — D-v2.5-01 (`run_in_threadpool` rule), D-v2.5-02 (single-worker — still in force at 070), D-v2.5-11 (atomic stream-architecture deployment, sets shipping precedent for path (c) if chosen).
- `CLAUDE.md` — venv mandatory; "Python backend must use a venv virtual environment"; no LangChain / no LangGraph (none touched here but worth a glance during review); migrations not relevant — Phase 070 has zero schema changes.

### Seed context (informs spike strategy)

- `.planning/seeds/SEED-006-multimodal-extraction-quality.md` §Docling Evaluation (lines 79-92) — original deferral rationale; documents the rename pair `gotrue→supabase-auth` / `supafunc→supabase-functions` and the ~600 MB model download. **Reference text for the matrix** in 070-SUMMARY.md.
- `.planning/codebase/CONCERNS.md` §`httpx` Version Conflict Blocks Docling Adoption (lines ~680-685) — concise framing of the conflict.

### Phase 069 artifacts (the seam that Phase 070 doesn't touch but unblocks)

- `.planning/phases/069-pdfextractor-abstraction-scaffold/069-CONTEXT.md` — full context for the ABC + LegacyExtractor + dispatcher that Phase 071 will plug Docling into. Phase 070 does NOT modify `extraction_service.py`.
- `.planning/phases/069-pdfextractor-abstraction-scaffold/069-01-SUMMARY.md` — what Phase 069 shipped.

### Code surfaces relevant to the spike

- `backend/requirements.txt` — `supabase==2.10.0` (line 4) + `httpx>=0.27.0` (line 23). The pins that move under path (a).
- `backend/scripts/probe_multimodal.py` (lines 184-200 + 256-292) — already has a `probe_docling()` function with `from docling.document_converter import DocumentConverter`. **Reference implementation** for how to invoke Docling; the spike test reuses this import line.
- `backend/app/services/extraction_service.py` — Phase 069's ABC + LegacyExtractor + `get_extractor(mime)` dispatcher. **NOT touched by Phase 070.**
- `backend/app/api/documents.py:129-289` — upload + ingestion control flow that 070 must NOT regress (D-070-15).

### New files this phase creates

- `backend/tests/integration/test_pdf_extractor_docling_compat.py` — the SC#2 CI gate. Contains `test_docling_supabase_coexist` + `test_supabase_smoke_post_resolution`.

### Files updated this phase

- `backend/requirements.txt` — supabase + httpx pins (+ docling line added) + comment block per D-070-14.
- `.planning/PROJECT.md` — Q-v2.6-01 closure entry in Key Decisions table.
- `.planning/phases/070-docling-httpx-spike/070-SUMMARY.md` — matrix + spike narrative (Plan 2 output).
- Possibly some `backend/**/*.py` files for the `gotrue`/`supafunc` rename sweep (path (a) only).

### Pip / external research surfaces

- PyPI `docling` package: https://pypi.org/project/docling/ — check available versions vs httpx pin (informs path (b) feasibility).
- PyPI `supabase` package: https://pypi.org/project/supabase/ — confirm 2.29.x is the latest and what httpx range it ships.
- supabase-py 2.x changelog (GitHub `supabase-community/supabase-py` releases) — confirms `gotrue`→`supabase-auth` rename timing.

### No DB changes, no migrations, no frontend touches

- Zero migrations. No `supabase/migrations/NNN_*.sql`. Migrations 039-049 reserved; none claimed by Phase 070.
- No `full-schema.sql` regen needed.
- No frontend files modified.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`backend/scripts/probe_multimodal.py` lines 187-200** — has `probe_docling()` with the exact `from docling.document_converter import DocumentConverter` invocation pattern. Spike test reuses this import + the convert-call pattern. The probe script is not committed to ingestion path; it's a standalone diagnostic — but the import is identical.
- **`backend/tests/fixtures/extraction/reference.pdf`** — committed in Phase 069 (~3.3 KB, reportlab-synth, license-clean). Reused as the spike fixture per D-070-08. Zero new fixture cost.
- **`backend/tests/integration/test_documents.py`** — existing integration test patterns for supabase client mocking + fixture supabase access. The spike test follows the same `@pytest.fixture` + `Client` usage pattern.
- **`backend/app/services/extraction_service.py`** — Phase 069's `PdfExtractor` ABC + `LegacyExtractor` + `get_extractor(mime)` dispatcher. **Read-only for Phase 070.** The seam exists; Phase 071 plugs Docling in via a new `DoclingExtractor`.

### Established Patterns

- **Sync-to-async wrapping** — `CLAUDE.md` rule: "Do not run blocking I/O directly inside async handlers — wrap with `run_in_threadpool`". The supabase smoke calls inside the spike test are synchronous; the test functions themselves can be sync `def` (pytest-friendly) — no async wrapping needed in test code.
- **Test fixture supabase client** — `backend/tests/integration/test_documents.py` patterns for instantiating a Client against the dev Supabase URL. Use the same pattern in the spike test.
- **Lazy heavy-dep imports** — multimodal_service.py + probe_multimodal.py lazy-import `pdfplumber`, `fitz`, `docling` inside function bodies (line 42, line 116, line 190). Spike test can put `from docling.document_converter import DocumentConverter` at module top — test imports are expected to be heavy.
- **Single uvicorn worker** — D-v2.5-02 in force; the spike doesn't change this. (Multi-worker is Phase 073/079, not 070.)

### Integration Points

- **Spike test invocation:** `pytest backend/tests/integration/test_pdf_extractor_docling_compat.py -v` — matches SC#2 glob.
- **Failure surface (post-merge):** if a future PR bumps supabase past the pin tested, the spike test goes red. That's the regression gate.

### Non-regression: ingestion control flow (D-070-15)

- **Today's ingestion is HTTP-decoupled.** `backend/app/api/documents.py:269` queues `background_tasks.add_task(ingest_document, ...)` AFTER the upload row is created. The HTTP request returns immediately; the heavy work runs in FastAPI's threadpool after response. Navigate-away or page-refresh during ingestion has zero effect — the task continues, status updates land in `documents.status` / `documents.ingestion_step`, Supabase Realtime broadcasts to any client, UI reconciles on reload via the documents list query.
- **Phase 070 doesn't change this.** The spike is a dep pin shift (+ if path (a), a call-site rename sweep). The ingestion control flow stays verbatim.
- **Deeper durability gap exists but is OUT OF SCOPE.** If the FastAPI worker dies mid-ingestion (uvicorn reload, OOM, crash), the in-flight task dies with it; the document row stays in `status='processing'`. SEED-001 §"proper ingestion queue" already flags this; deferred to v3.4 Automations. Phase 070 does not regress the current floor *and* does not lift it.

### Phase 32.5 chunking pipeline interaction

- Phase 070 doesn't run any chunking. The spike test asserts `DocumentConverter().convert()` returns non-empty — chunking/embedding/storage is not exercised. Phase 071 will wire Docling output through `chunk_text` / `embed_chunks` (which consume `ExtractedDocument.text` exactly as they consume `LegacyExtractor`'s output today).

</code_context>

<specifics>
## Specific Ideas

- **The PRD's recommended attempt order is the binding spike order.** (a) → (c) → (b). Don't reshuffle; don't skip (a). If (a) is green, stop and ship.
- **The spike is time-boxed.** 2 plans, dependency-resolution work. If path (a) blows up in non-obvious ways (e.g., 2.10 → 2.29 breaks Realtime subscriptions), escalate via 070-SUMMARY.md notes and proceed to (c) per D-070-06 — don't sink another half-day debugging supabase upgrade arcana.
- **The CI test is the success criterion.** Per SC#2, `pytest backend/tests/integration/test_pdf_extractor_*.py` must be green. Write the test FIRST (red), then make it green by applying the chosen resolution. Classical TDD ordering. Plan 1 includes both the test author-step and the resolution-apply step.
- **The matrix is for future maintainers, not for the current decision.** It exists so that 18 months from now, someone asking "why didn't we just pin docling back?" has a documented answer (probably: "no docling version pins httpx<0.28"). Write it concisely and authoritatively.
- **Path (c) subprocess isolation, if it wins, uses the PyMuPDF subprocess-fence precedent.** D-PRD-07 Appendix (Phase 069 Plan 02) documents a stdio/IPC contract for an AGPL fence. Reuse the same shape for Docling: subprocess invokes `python -m extractor.docling_isolated <input_path>`, returns pickled or JSON `ExtractedDocument` on stdout. Phase 070 doesn't implement this — it documents that the contract exists and that path (c)'s `EXTRACTOR_DOCLING_ISOLATION` env var would gate it.
- **Don't commit `docling` to `requirements.txt` until path is chosen.** Path (a) likely adds `docling>=2.x` + bumps supabase; path (c) likely adds `docling>=2.x` to a separate `requirements-extractor-subprocess.txt` so the main FastAPI process never imports docling. The pin location depends on the winning path. Plan 1's resolution-apply step is when the pin lands.
- **Run the spike in the project's venv per `CLAUDE.md` rule.** Not in a fresh global pip env; the spike test's "supabase smoke" only proves anything if it runs against the same dependency tree the rest of the backend uses.
- **PROJECT.md update style** — match the existing `D-v2.5-NN` / `D-PRD-NN` rows in the Key Decisions table. Format: `| **D-v2.6-01**: Q-v2.6-01 resolution: <chosen path> | <rationale> | <outcome: green at Phase 070> |`.

</specifics>

<deferred>
## Deferred Ideas

- **Build a `DoclingExtractor` against the 069 ABC** — Phase 071's job (RAG-DOCLING-01). Phase 070 stops at "we can import + invoke `DocumentConverter`."

- **Benchmark Docling output quality vs LegacyExtractor on the reference thesis pair** — Phase 071 SC#1 (within-20%-delta). The spike PDF is too small to be a quality signal.

- **Implement the subprocess fence for Docling (path (c) contingency)** — if path (c) wins, design lives in 070-SUMMARY.md; actual implementation is Phase 071. The `EXTRACTOR_DOCLING_ISOLATION=subprocess|in-process` env var lands in Plan 2 documentation, not Plan 1 code.

- **Multi-worker / `--workers N` interaction with Docling** — Phase 073 (asyncpg pool) + Phase 079 (D-v2.5-02 supersession). 070 stays single-worker.

- **Re-extraction migration for existing documents under Docling** — Phase 071 SC#3 (per-document fallback via `POST /documents/{id}/reextract`). Phase 070 doesn't touch existing data.

- **Recalibrate confidence thresholds for Docling-extracted chunk distributions** — Phase 076 (RAG-RECAL-01, Q-v2.6-03).

- **Verify Docling's heavy first-run download + slow extract doesn't OOM / block the FastAPI worker under heavy concurrent ingestion** — Phase 071 ingestion-load concern. Phase 070's spike test runs Docling once on a tiny fixture in isolation; it doesn't exercise worker concurrency. **Re-open trigger:** Phase 071 verification surfaces OOM, blocked-worker, or stuck-in-`status='processing'` rows under realistic ingestion load.

- **Worker-restart / retry-queue durability for in-flight ingestion** — out of scope for 070, out of scope for v2.6 entirely. Today `BackgroundTasks` lives in the FastAPI process; worker death loses the in-flight ingest. **Already captured in SEED-001 §"proper ingestion queue"** with re-trigger pointing at v3.4 Automations milestone. Phase 070 explicitly preserves the current navigate-away/refresh resilience floor (D-070-15) without lifting the worker-death floor. **Re-open trigger:** v3.4 milestone planning, or any production incident where a worker dies mid-ingest and the recovery story bites.

- **Reviewed Todos (not folded)** — None; no relevant todos surfaced by the cross-reference step for this phase.

</deferred>

---

*Phase: 070-docling-httpx-spike*
*Context gathered: 2026-05-14*
