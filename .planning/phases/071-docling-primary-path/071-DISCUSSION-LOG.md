# Phase 071: Docling Primary Path - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 071-docling-primary-path
**Areas discussed:** PyMuPDF subprocess fence design, Docling invocation inside FastAPI, POST /reextract API + dispatch + auto-fallback, Scope locks + SC#1 verification

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| PyMuPDF subprocess fence design | AGPL-required isolation — IPC choice (stdio JSON vs pickle), spawn-per-extract vs persistent worker, timeout/crash semantics, where the child entrypoint lives. | ✓ |
| Docling invocation inside FastAPI | ~600 MB first-run model download + 5-15s/doc CPU-bound. Pre-warm at startup vs lazy on first call, single shared DocumentConverter() vs per-request, run_in_threadpool wrapping. | ✓ |
| POST /reextract API + dispatch + auto-fallback | Relationship to existing POST /reingest, request body shape (engine param required/optional/whitelist), what happens when Docling raises on a doc mid-extract. | ✓ |
| Scope locks + SC#1 verification | Q-v2.6-04 lock (PRD recommends opt-in via reextract — NOT auto-re-run on deploy), Pypdfium2 ship-in-071 vs defer to polish phase, how to actually measure the 20% delta on the user's 551f03f9 reference thesis pair. | ✓ |

**User's choice:** All four areas selected.

---

## PyMuPDF Subprocess Fence Design

### Q1.1: How should the parent FastAPI process pass the PDF bytes to the PyMuPDF child and read results back?

| Option | Description | Selected |
|--------|-------------|----------|
| stdin binary + stdout JSON (recommended) | Parent writes raw PDF bytes to child stdin (no b64 bloat); child reads sys.stdin.buffer.read(); mime + opts via argv; child writes ExtractedDocument as JSON on stdout (images b64 inside JSON). No pickle, no temp files, human-debuggable, identical wire shape across all extractors. | ✓ |
| Temp files on disk | Parent writes input PDF to tempfile, passes path on argv; child reads file, writes JSON output to a sibling temp; parent reads + unlinks both. Easier on huge PDFs but adds cleanup hygiene + disk I/O. | |
| stdio pickle | Smallest wire size, no JSON encode/decode overhead. But pickle.loads is a known RCE vector if anything attacker-influenced ever leaks in. | |

**User's choice:** stdin binary + stdout JSON.

### Q1.2: Should the PyMuPDF child be spawned per extract, or kept alive as a persistent worker pool?

| Option | Description | Selected |
|--------|-------------|----------|
| Spawn-per-extract (recommended) | subprocess.run([...], input=raw_pdf, capture_output=True, timeout=N). Simple, perfect isolation, ~50-100ms fork overhead per call. Fine because Docling is primary — PyMuPDF only fires on opt-in fallback (rare). | ✓ |
| Persistent worker pool | Pre-spawn N children at startup, route each extract to an idle worker via long-lived stdio. Cuts ~100ms fork cost per call but adds queue saturation handling, child crash recovery, restart cycles. Overkill given fallback is rare. | |

**User's choice:** Spawn-per-extract.

### Q1.3: How should PyMuPDF child timeouts and crashes surface to the caller?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard timeout, single attempt, fail loud (recommended) | subprocess.run(timeout=PYMUPDF_TIMEOUT_S, default 60s, env-overridable). On timeout: SIGKILL child + raise ExtractionError. On non-zero exit: capture stderr last line + raise. Caller sees same exception shape as today's pdfplumber errors. | ✓ |
| Graceful retry then fail | On first timeout: SIGTERM → wait 5s → SIGKILL → retry once → then fail. More resilient but doubles worst-case latency. | |
| Soft fail — return empty ExtractedDocument with error fields | Match Phase 069's silent-swallow-for-tables/images pattern. Risk: caller doesn't know text extraction failed; doc gets ingested with empty content + status='completed'. Wrong shape — reject. | |

**User's choice:** Hard timeout, single attempt, fail loud (60s default, env-overridable PYMUPDF_TIMEOUT_S).

### Q1.4: Where should the PyMuPDF child entrypoint live in the repo?

| Option | Description | Selected |
|--------|-------------|----------|
| backend/extractors/pymupdf_isolated.py (recommended) | Top-level package, NOT under app/. Invoked as 'python -m extractors.pymupdf_isolated'. AGPL fence is structural — fitz import path is physically separate from app/. | ✓ |
| backend/app/extractors/pymupdf_isolated.py | Lives under app/ next to other services. AGPL fence still works but separation is by convention, not by package layout. | |
| Standalone script + dedicated requirements-extractor-subprocess.txt | Maximum AGPL-fence rigor: PyMuPDF installed in a separate Python venv. Heavier setup; per Phase 070 docling stayed in-process so PyMuPDF would be the only isolated dep. Likely overkill. | |

**User's choice:** backend/extractors/pymupdf_isolated.py (top-level, not under app/).

---

## Docling Invocation Inside FastAPI

### Q2.1: How should the ~600 MB Docling model artifact be made available?

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy on first extract, model cached by Docling (recommended) | Docling auto-downloads to ~/.cache/docling on first call. First extract is slow (~1-2 min); subsequent are normal. Production runbook gets 'pre-pull' command. Zero startup-time tax in dev. | ✓ |
| Pre-warm in FastAPI lifespan startup | Add a startup hook that runs a 1-page warmup convert. App boot blocks on first 600 MB download. Painful for dev autoreload. | |
| Explicit operator command + healthcheck gate | Add 'python -m extractors.docling_warmup' command + readiness probe that returns 503 until warmup completes. Operator-grade ceremony for v2.6 self-host. | |

**User's choice:** Lazy on first extract, model cached by Docling.

### Q2.2: How should the DocumentConverter() instance be managed across requests?

| Option | Description | Selected |
|--------|-------------|----------|
| Module-level singleton, lazy-instantiated, thread-safe (recommended) | Module-top _DOCLING: DocumentConverter | None = None; first call constructs under threading.Lock; reused for all subsequent extracts. DocumentConverter is documented thread-safe in docling 2.x. | ✓ |
| New DocumentConverter per extract | Construct fresh inside DoclingExtractor.extract(). Safer if docling has hidden per-call state but pays construction cost on every extract. | |
| FastAPI dependency-injection scoped instance | get_docling_converter() FastAPI dep cached per app lifespan. Ceremony for ingestion code that's not even an HTTP-handler-direct caller. | |

**User's choice:** Module-level singleton, lazy-instantiated, thread-safe.

### Q2.3: Docling.convert() is CPU-bound (5-15s/doc). How should it be wrapped re: the FastAPI async event loop?

| Option | Description | Selected |
|--------|-------------|----------|
| Plain sync inside ingest_document (recommended) | ingest_document already runs in BackgroundTasks (FastAPI threadpool, not async loop). Per CLAUDE.md D-v2.5-01 'no blocking I/O in async handlers' applies to async handlers — ingest_document is sync. No extra wrapping needed. | ✓ |
| anyio.to_thread.run_sync wrap inside async caller | If/when an async caller needs to invoke DoclingExtractor.extract directly. Add wrap at the async caller, NOT inside the extractor. Phase 071 doesn't need this. | |
| Separate thread pool for extract operations | Bound the number of concurrent CPU-bound extracts to prevent OOM. Real concern at scale but proper queue is deferred to v3.4 — don't half-build. | |

**User's choice:** Plain sync inside ingest_document.

### Q2.4: Docling outputs structured tables/images differently from today's pdfplumber/python-docx. How should the new fields land?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend ExtractedDocument with optional new fields, populated only by Docling (recommended) | Add full_markdown: str | None = None, bbox: dict | None = None on TableData/ImageData — None when LegacyExtractor produces them, populated when Docling does. Backward-compatible; LegacyExtractor goldens stay green. | ✓ |
| New ExtractedDocumentV2 alongside the V1 | Forces every caller to handle both. Unnecessary ceremony. | |
| Docling adapter normalizes to V1 shape, drops bbox/full_markdown | Throws away Docling's structured output. Defeats the entire RAG-DOCLING-01 + Phase 076 calibration value — reject. | |

**User's choice:** Extend ExtractedDocument with optional new fields, populated only by Docling.

---

## POST /reextract API + Dispatch + Auto-Fallback

### Q3.1: How should /reextract relate to the existing POST /documents/{id}/reingest endpoint?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate endpoint, distinct semantics (recommended) | POST /documents/{id}/reextract — NEW. Body: {engine: 'docling'|'pymupdf'|'pypdfium2'}. Returns 202. Different from /reingest which uses the global default extractor. Matches PRD §5 verbatim. | ✓ |
| Extend /reingest with optional engine param | Smaller API surface. Conflates two operationally distinct intents. Diverges from PRD §5 contract. | |
| Single /reextract that subsumes /reingest | Cleanest API surface but breaks any frontend/script calling /reingest. Out of scope. | |

**User's choice:** Separate endpoint, distinct semantics.

### Q3.2: What should /reextract do to the existing chunks/tables/images for that document?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard delete + replace (recommended) | DELETE existing document_chunks + document_tables + document_images for this document_id, then re-run ingest pipeline. Simple, predictable, matches user intent. | ✓ |
| Soft replace — mark old as superseded, insert new with version_number+1 | More auditable but doubles storage cost; chunk queries need 'WHERE is_latest=True' filter. Document versioning was designed for source-bytes change, not engine swap. | |
| Keep existing rows, add new with extractor='docling-rerun-001' tag | Side-by-side comparison friendly but creates duplicate chunks in vector search results. Bad for retrieval quality. | |

**User's choice:** Hard delete + replace.

### Q3.3: When Docling raises mid-extract on a document, what should the dispatcher do?

| Option | Description | Selected |
|--------|-------------|----------|
| Fail loud, status='failed', user retries via /reextract with engine=pymupdf (recommended) | Matches today's behavior. Bounds blast radius: bad PDFs don't silently get poor-quality chunks. Pairs with PRD's opt-in re-extraction philosophy (Q-v2.6-04). | ✓ |
| Auto-fallback to PyMuPDF on Docling exception | More resilient; hides failures. Risk: silent quality regressions, harder to debug, harder to bill. | |
| Auto-fallback only on specific error classes | Best-of-both but the whitelist is hard to maintain — docling 2.x exception taxonomy isn't stable. Deferred. | |

**User's choice:** Fail loud, status='failed', user retries via /reextract with engine=pymupdf.

### Q3.4: How should get_extractor(mime) decide which engine to return?

| Option | Description | Selected |
|--------|-------------|----------|
| EXTRACTOR_PRIMARY env var → default 'docling' (recommended) | Read EXTRACTOR_PRIMARY at module import; default 'docling'; values 'docling'|'pymupdf'|'legacy' valid. Per-request override via explicit caller param (used by /reextract). Operator can rollback to legacy in seconds. Matches PRD §5 line 162. | ✓ |
| app_settings table read on every call | Admin-tunable via UI without restart. Pairs with v3.1 admin shell. Defer. | |
| Hard-code 'docling' for v2.6 | Simplest. Zero rollback path. PRD §5 explicitly names the env var. | |

**User's choice:** EXTRACTOR_PRIMARY env var → default 'docling'.

---

## Scope Locks + SC#1 Verification

### Q4.1: Q-v2.6-04 (re-extraction migration policy) must be locked before this phase ships. PRD recommends (b). Confirm?

| Option | Description | Selected |
|--------|-------------|----------|
| (b) opt-in via POST /reextract per-document (recommended) | PRD recommendation. Bounds blast radius. Pairs with v3.1 admin shell. Existing rows backfilled to extractor='pypdf-legacy' tag only — NO auto re-extract. New uploads use Docling. | ✓ |
| (a) auto-re-extract all existing documents on Docling deploy | Regenerates all chunk embeddings + vision-LLM calls cost-uncapped. PRD explicitly rejects. | |
| (c) defer until v3.1 admin shell ships | Skips /reextract entirely until v3.1. Loses per-document fallback story. Reject. | |

**User's choice:** (b) opt-in via POST /reextract per-document.

### Q4.2: PRD §5 names pypdfium2 as 'license-safe last-resort fallback'. ROADMAP SC#3 only names PyMuPDF. Ship Pypdfium2Extractor in 071?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer Pypdfium2Extractor to a polish phase (recommended) | ROADMAP SC#3 binding requirement is PyMuPDF as the named fallback. PRD §5 lists pypdfium2 as 'last-resort' — needed only if BOTH Docling and PyMuPDF fail. Phase 071 already has heavy lift. | ✓ |
| Ship all three engines in 071 | Future-proofs the lineup. ~1 extra plan worth of work. pypdfium2 is Apache 2.0 — no AGPL fence. | |
| Ship pypdfium2 as the LegacyExtractor replacement | Out of scope — changes Legacy goldens. | |

**User's choice:** Defer Pypdfium2Extractor to a polish phase.

### Q4.3: How should SC#1 (Docling produces table+image counts within 20% of DOCX on the user's reference thesis pair, document_id 551f03f9...) actually be measured?

| Option | Description | Selected |
|--------|-------------|----------|
| Live UAT via Chrome MCP against your real Supabase (recommended) | Reference doc 551f03f9 lives in your real Supabase. Verification script: re-extract via /reextract, query counts, assert |pdf - docx|/max(pdf,docx) <= 0.2. Captured in 071-VERIFICATION.md. No fixture committed (thesis is copyrighted). | ✓ |
| License-clean synthetic fixture in tests/fixtures/ | Generate fake academic-paper PDF + DOCX. Reproducible in CI. Synthetic doc may not exercise the real Docling/pdfplumber diff. Use as ADDITIONAL pytest gate. | |
| Both — synthetic in CI + live UAT for the binding gate | Synthetic gives regression net + reproducible CI signal; live UAT closes the actual user-observed bug. Recommended additive. | |

**User's choice:** Live UAT via Chrome MCP against your real Supabase. (Synthetic fixture STILL added per D-071-16 as a regression net, but live UAT is the binding SC#1 gate.)

### Q4.4: ROADMAP says Phase 071 has 4 plans. Suggested split (gsd-planner finalizes). Confirm or adjust?

| Option | Description | Selected |
|--------|-------------|----------|
| 1=schema+migrations, 2=Docling, 3=PyMuPDF fence, 4=/reextract+telemetry+UAT (recommended) | Plan 1: migrations 039-044. Plan 2: DoclingExtractor + dispatcher rewire + ExtractedDocument extension. Plan 3: PyMuPDF subprocess fence. Plan 4: POST /reextract + pdf_extraction_runs writes + Chrome MCP UAT. Wave-friendly: 2+3 parallelizable after 1; 4 needs all three. | ✓ |
| 1=schema+Docling, 2=PyMuPDF fence, 3=/reextract+telemetry, 4=UAT+verification | Lighter Plan 1 split. Less parallelizable. | |
| Let gsd-planner decide — don't pre-commit | Skip the suggestion. | |

**User's choice:** 1=schema+migrations, 2=Docling, 3=PyMuPDF fence, 4=/reextract+telemetry+UAT.

---

## Mid-Discussion Tangent (Out-of-Phase, Resolved)

The user surfaced the Supabase CLI version (v2.78.1 → v2.98.2 update available) mid-discussion, conflating it with the supabase-py Python SDK pin (D-v2.6-01: `supabase==2.29.0`). Clarified that the CLI and the Python SDK version independently and the CLI bump has zero relation to docling. CLI updated via Scoop to 2.98.2; local Docker stack restarted via `supabase stop` + `supabase start` (preserved volumes); all keys unchanged (deterministic supabase-demo JWT keys); endpoints healthy. Edge runtime container is now running by default (was stopped before) — flagged as harmless since the project uses FastAPI not Edge Functions.

This tangent has zero impact on Phase 071's locked decisions. Captured here for audit traceability only.

---

## Claude's Discretion

- Exact `DocumentConverter()` constructor options (e.g., `pipeline_options` for OCR enable/disable) — pick docling 2.x defaults unless the synthetic fixture surfaces obvious gaps.
- Whether `DoclingExtractor` lives in `extraction_service.py` or a sibling `extractors/docling.py` subpackage — recommend subpackage once ≥ 3 engines exist.
- Exact `pdf_extraction_runs` write timing — recommend "insert at end with full row" (atomic).
- Exact `bbox` JSON shape — pick what Docling provides natively.
- Exact text of the `D-v2.6-04` row in PROJECT.md — match `D-v2.6-01` row style.
- Whether `PyMuPDFExtractor.supports(mime)` returns True for both PDF and DOCX — recommend PDF-only for v2.6.
- Whether `LegacyExtractor` sets `extractor_name='pypdf-legacy'` explicitly — recommend explicit.
- Whether to add a `--no-docling` env switch for test environments — recommend YES.

## Deferred Ideas

(Captured fully in CONTEXT.md `<deferred>` section — not duplicated here.)
