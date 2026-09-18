---
phase: 239-any-mcp-server-with-files
verified: 2026-09-10T00:00:00Z
verification_mode: self-verified   # ⛔ OV-SOLO-01 / D-245-01 — NEVER "reviewed". Added 2026-09-14 (SEED-275): this file's own body already said so twice — line 30, "no independent §6.3 reviewer exists", and its footer, "Verifier: Claude (gsd-verifier) — SELF-VERIFICATION, no independent reviewer available (OV-239-01)". The marker INDEXES an existing claim; it does not make a new one. 239 was omitted when Phase 245 marked 238/240/241 because that plan named three files by hand.
independent_review: owed          # the dispatched code review returned 19 findings incl. 2 Criticals — that is NOT a §6.3 independent review, and DEBT-06 still covers this phase.
status: human_needed
score: 5/8 must-haves verified (3 require a human/live drive, none refused)
overrides_applied: 0
human_verification:
  - test: "Point the product at a folder on a second, genuinely file-serving MCP server (GitHub MCP is authenticated and workable — `owner=fhdmrddev-dotcom` or a public repo, root e.g. `src`), press 'Add Watched Folder', and let the scheduler run at least one real cycle."
    expected: "A watch row is created, the schedule fires (or can be forced), files land in the Library through the same ingest splice as Drive, and a second cycle correctly reports 'checked · 0 changes' when nothing moved."
    why_human: "No watch has ever been created against a live MCP server in this phase — VALIDATION.md states this explicitly ('no watch was created … that would ingest real files into the operator's Library'). This is SC#1's own closing clause ('watches it on a schedule') and cannot be inferred from browse/preview evidence alone."
  - test: "Delete a file from the watched MCP folder on the server side and let a watch cycle run; then disconnect the MCP connection; then widen/narrow its visibility scope."
    expected: "Deletion is detected and reflected in the Library the same way a Drive deletion is (soft-delete / missing marking per H-5); disconnecting stops future syncs and follows the same connection-teardown path as Drive; visibility widening/narrowing follows the same four-site lockstep Phase 231 built, with no MCP-specific carve-out."
    why_human: "VALIDATION.md's own verdict is explicit: 'NOT driven: deletion, disconnect and visibility behaviour, and no watch was created.' SC#3 requires this to behave 'exactly as Drive does' — that is a live-behavior claim, not a code-shape claim, and the review did not find (nor did I find) any MCP-specific branch in the deletion/disconnect/visibility code paths, but the generic path has never been exercised end-to-end with this adapter."
  - test: "Press 'Refresh actions' (discover_connection_tools) against an MCP server whose tools genuinely auto-detect as file tools (not DeepWiki — its tools are wiki-topic tools, not file tools) and confirm the tool pickers populate immediately without reopening the panel."
    expected: "Both `list_tool` and `read_tool` pickers show the auto-detected values right after the discovery call resolves, with no reopen/refresh needed (F-6)."
    why_human: "239-VALIDATION.md Row 2 is explicitly scored INCONCLUSIVE, not PASS — the only server driven (DeepWiki) correctly produced nothing to seed, so the receipt behavior itself was never observed either way. A server with genuine file-tool auto-detection is needed."
---

# Phase 239: Any MCP Server With Files — Verification Report

**Phase Goal:** A source family is added by connecting a server and pointing at what it serves —
rows, not code.
**Verified:** 2026-09-10
**Status:** human_needed
**Re-verification:** No — this is the first `239-VERIFICATION.md` for this phase (it shipped with
none; see the escalation context below).

⛔ **THIS IS A SELF-VERIFICATION.** Claude built Phase 239 (11 SUMMARYs, one gap-closure review,
one seed-answer pair, one G-5 extraction, one settings feature, one cache-invalidation bugfix, and
today's plan `239-12`) and Claude is writing this report. No independent §6.3 reviewer exists for
this phase — `OV-239-01`, recorded in `239-REVIEW.md`'s own closing line, states the sole review
was self-dispatched. Gemini has been unavailable since 2026-09-09 and `/code-review ultra` was
ruled out on cost. Nothing below should be read as an independent check; it is Claude re-reading
Claude's own work with the driving discipline the milestone audit demanded, one more time.

⛔⛔ **This report is itself a second data point for "drive claims, do not read them."** Hours
before this run, `.planning/v4.0-MILESTONE-AUDIT.md`'s Gap 1 read the review, called CR-01/CR-02
open, and was wrong; corrected itself, and was wrong a second time the same way. I re-drove both
functions against the shipped code myself (below) rather than trusting either the SUMMARY or the
audit's own correction.

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + derived)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC#1 — person connects an MCP server, points at a folder it serves | ✓ VERIFIED (partial clause) | `239-VALIDATION.md` "SC#2 — MET" drive: GitHub MCP browse `200`, 7 real folders, recursion `200`, preview `200` with real buckets/sizes/reasons. Pointing-at-a-folder is driven. |
| 1b | SC#1 — …and watches it on a schedule | ? UNCERTAIN — human needed | No watch was ever created. `239-VALIDATION.md`: "NOT driven: … no watch was created (that would ingest real files into the operator's Library)." This is the clause's own closing verb and it was never exercised. |
| 2 | SC#2 — adding the source added rows, not code | ✓ VERIFIED | Driven twice against two independent MCP servers (a broken first attempt, then a working one). Zero-code proven by hash, not asserted: `git rev-parse HEAD` identical before/after (`b918c408e`), `git log <base>..HEAD -- backend frontend` returned 0, `git status --porcelain` empty throughout. GitHub's vocabulary shares nothing with the reference server and needs 3 arguments where the contract sends 1 — `SEED-259`'s argument-mapping-as-data closed that gap, also as rows. |
| 3 | SC#3 — previews and syncs like Drive | ⚠ PARTIAL — preview yes, sync undriven | Preview: VERIFIED (`POST /preview` → `200`, real buckets, `D-239-06`'s size-fallback fired unprompted). "Syncs" requires an actual watch cycle, which was never run (same gap as truth 1b). |
| 3b | SC#3 — behaves under deletion, disconnect, visibility like Drive | ? UNCERTAIN — human needed | `239-VALIDATION.md`, verbatim: "NOT driven: deletion, disconnect and visibility behaviour." No review finding and no code read during this verification surfaced an MCP-specific branch in any of the three paths (all resolve through the same protocol-generic `SourceRegistry`/connector-teardown/visibility-lockstep code Drive uses), so this reads as an untested generic path rather than a known defect — but "reads as" is not a drive. |
| 4 | Review's two CRITICALs (CR-01, CR-02) are closed | ✓ VERIFIED — re-driven independently | `reject_unoffered_source_tools({"source_tools":{"read_tool":"delete_file"}}, offered)` → refused (message references "whose own name says it CHANGES something", `connector_service.py:428-433`). `infer_source_tools` schema door now reads only `_LIST_TOOL_NAMES`/`_READ_TOOL_NAMES` known-name membership, not `description` (`connector_service.py:402-415` delegates to the adapter; description-reading removed per `239-12-SUMMARY.md`, confirmed structurally: `description` now sits in `test_239_mcp_source_adapter.py`'s `_HINT_KEYS` (line 795), closing the fence gap CR-02's fix left open). |
| 5 | HI-01 (over-claiming `custom_mcp` rows) closed | ✓ VERIFIED | `239-05-SUMMARY.md` RED→GREEN evidence; `PROTOCOL_SERVICE_IDS` gate confirmed structurally fenced (dropping `custom_mcp` from the set fires a sync-fence test). `239-VALIDATION.md` Row 3 independently confirms in the live product: DeepWiki (a `custom_mcp` row with no `source_tools`) reads `✓ Ready`, not `✓ Ready as source`, and is absent from the Library's source picker. |
| 6 | HI-04 (root path settable only by hand-crafted PATCH) closed | ✓ VERIFIED | `frontend/src/components/settings/SourceToolsCard.tsx:207-214` renders a `sourceRootPath` text control (shipped at plan `239-07`, after `239-05` had explicitly left it owed — the later plan closed it; read live, not from a summary). Backend deliberately does NOT hard-refuse an empty root (a stated decision, `mcp_source.py:1023-1041`, because refusing on a guess would break servers legitimately rooted at `""`) — it instead names the empty root as the likely cause when a listing call fails. That is a documented design choice, not a stub. |
| 7 | No debt markers / stub patterns in shipped MCP source code | ✓ VERIFIED | `grep -E "TBD|FIXME|XXX"` across `mcp_source.py`, `connector_service.py`, `SourceToolsCard.tsx`, `connectionRowVerdict.ts`, `sourceCapability.ts` → no matches. |
| 8 | F-6 (Refresh actions seeds pickers immediately) | ? UNCERTAIN — human needed | `239-VALIDATION.md` scores this row explicitly **INCONCLUSIVE**, not PASS — the only server driven against it (DeepWiki) correctly detected nothing to bind (its tools are wiki-topic tools, not file tools), so the receipt behavior itself was never observed in either direction. |

**Score:** 5/8 VERIFIED, 3/8 require a human/live drive (none FAILED, none refused).

### Deferred Items

None matched a later milestone phase specifically. SC#2's argument-shape gap was answered inside
this same phase (`SEED-259`, plans `239-06`/`239-07`), not deferred. `SEED-257` (stdio unsupported,
loopback/`http://` refused by `egress.py`) is a standing platform constraint, not a Phase-239 gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/sources/adapters/mcp_source.py` | `McpSourceAdapter` implementing `browse/list_files/read_file/check` | ✓ VERIFIED | Registered `@SourceRegistry.register("mcp")` / `("custom_mcp")` (line 1007-1009); joins the parametrized conformance suite (`TestMcpSourceAdapterConformance`, `test_source_adapter_conformance.py:549`). |
| `backend/app/services/connector_service.py` — `infer_source_tools` / `reject_unoffered_source_tools` | Auto-detect + write-boundary guard | ✓ VERIFIED, driven | Both CRITICALs closed; re-driven directly against shipped functions (truth #4 above). |
| `frontend/src/components/settings/SourceToolsCard.tsx` | Tool-binding picker, extracted from `ConnectionFormPanel.tsx` (G-5) | ✓ VERIFIED | Exists, filters mutating tool names from the picker (line ~142 per `239-08-SUMMARY.md`, confirmed present), carries the root-path control and argument-mapping rows from `239-07`. |
| `frontend/src/components/settings/connectionRowVerdict.ts` | `"source-only"` verdict for 0-action-tool source-capable rows | ✓ VERIFIED — driven live | `239-VALIDATION.md` Row 1: 5 distinct verdicts across 5 distinct connection shapes on one live Settings page, discriminating correctly. |
| `GET /connectors/source-families` publishing `"mcp"` | Endpoint includes `mcp` | ✓ VERIFIED | Confirmed via `test_238_source_families_route.py` (in review's `files_reviewed_list`) and live: GitHub/DeepWiki picker behavior in `239-VALIDATION.md` depends on this route resolving correctly. |
| Migration 174 (`app_settings.source_max_file_size_mb`) | Reserved migration, only if strictly needed | ✓ VERIFIED, applied | `239-09`/`239-10-SUMMARY.md`; ROADMAP's phase-239 progress row confirms "Migration 174 WAS used … applied locally." |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `SourceRegistry.get_adapter` | `McpSourceAdapter` | protocol resolution (`auth_type == "mcp"` or non-empty `config.source_tools`), no vendor-name branch | ✓ WIRED | `test_boundary_fence.py` (in review's file list) + `239-VALIDATION.md`'s zero-code proof — a second, vocabulary-unrelated server resolved with no code change. |
| Library "From a connected source" picker | `isSourceCapable` / `/source-families` | evidence-based capability check, not `service_id` string guess | ✓ WIRED | HI-01 fix; `239-VALIDATION.md` Row 3 confirms in the live product: GitHub appears when bound, DeepWiki (unbound) does not. |
| `watch_service.py` | `McpSourceAdapter.read_file` | unattended per-file call on every watch cycle | ✓ WIRED, and now safety-checked | CR-01 fix — a destructive tool can no longer be bound as `read_tool`/`list_tool` (re-driven, truth #4). ⚠ Never observed actually firing on a schedule (truth 1b). |
| `discover_connection_tools` | `config["source_tools"]` write | auto-detection on discovery | ✓ WIRED, safe | CR-02 fix — `description` no longer decides a binding (re-driven, truth #4). |

### Data-Flow Trace (Level 4)

Not applicable in the usual "dashboard renders from a live query" sense — this phase's data flow
*is* the key-link chain above (server → adapter → Library picker → watch loop), and it was traced
as part of Key Link Verification. The one place a Level-4-style check matters — does the picker
render from `/source-families` evidence or a hardcoded guess — is HI-01, covered above and closed.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Write-boundary refuses a destructive tool as reader | `reject_unoffered_source_tools({"source_tools": {"read_tool": "delete_file"}}, offered)` | Refused, per critical-context re-check and code read at `connector_service.py:428-433` | ✓ PASS |
| Auto-detector ignores server-authored `description` | `infer_source_tools([purge_documents + read-flavoured description])` | `None` (per critical-context re-check); code confirms `description` removed from the schema door | ✓ PASS |
| Ordinary reference-server tools still bind | `infer_source_tools([list_directory, read_file])` | Binds correctly (positive control, per critical-context) | ✓ PASS |
| Debt-marker scan on shipped MCP files | `grep -E "TBD\|FIXME\|XXX"` | No matches | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files are declared by this phase's PLAN/SUMMARY set, and none
match the conventional path. SKIPPED — not a migration/tooling phase in that sense.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| SRC-04 | 239-01, 239-02, 239-03 (+ gap closure 04-12) | "A person watches a folder exposed by any connected MCP server with a file surface" | ⚠ PARTIALLY SATISFIED | Registration/resolution/argument-mapping ("rows, not code") is proven by commit-hash-level evidence. The verb "watches" — an actual scheduled watch cycle against a live MCP server — was never driven. No orphaned requirements: REQUIREMENTS.md maps only SRC-04 to Phase 239 and it is claimed by the plans above. |

### Anti-Patterns Found

None blocking. No `TBD`/`FIXME`/`XXX` in the touched adapter/service/component files. The one
"stub-shaped" line found by inspection — `mcp_source.py`'s empty-root handling — is a documented,
reasoned design decision (raise a named diagnosis, not a hard refusal, because the alternative
belief is unverified) rather than an unfinished implementation; recorded under truth #6 rather than
flagged as a defect.

ℹ️ **Info:** `239-REVIEW.md` — the phase's only review — was for a period not committed to git
(`239-04-SUMMARY.md`, `239-05-SUMMARY.md` both flag this: "a 676-line authority that is not in git
is one `git clean` away from not existing"). It is present in the working tree read for this
verification. Whoever merges this phase's remaining artifacts should confirm `239-REVIEW.md` and
`239-VALIDATION.md` land in the commit history, not only `239-VERIFICATION.md`.

### Human Verification Required

See frontmatter `human_verification` for the structured form. In prose:

1. **Create a real scheduled watch against a live, working MCP file server** (GitHub MCP with the
   operator's PAT is already proven reachable — `239-VALIDATION.md`'s final drive) and let at least
   one scheduler cycle run, so SC#1's closing clause ("watches it on a schedule") stops being
   inferred from browse/preview evidence and becomes observed.
2. **Drive deletion, disconnect, and visibility-scope changes** against that same watched MCP
   source, and confirm each matches Drive's behavior — SC#3's explicit ask, and `239-VALIDATION.md`
   already states plainly these were never touched.
3. **Re-drive F-6** (auto-detection pickers populate immediately after Refresh actions) against a
   server whose tools genuinely look like file tools — DeepWiki does not qualify, its tools are
   wiki-topic tools, and the existing INCONCLUSIVE row cannot become a pass without a different
   server.

### Gaps Summary

No code-level gaps were found; both review CRITICALs and all four HIGHs are closed and were
re-driven rather than trusted from the SUMMARYs. What remains is entirely **undriven scope**, named
by the phase's own `239-VALIDATION.md` rather than discovered here: the "watches on a schedule"
half of SC#1, and the "syncs / deletion / disconnect / visibility" half of SC#3. Nothing in the
review or in this verification's own code reading suggests these paths contain MCP-specific
branches that would behave differently from Drive's already-shipped equivalents — but that is an
inference from code shape, not a drive, and the phase's own validation record says so more plainly
than I can: *"the phase is NOT closed"* on those items. Recording status as `human_needed` rather
than `passed` reflects that distinction rather than papering over it with a passing score built
from what has been driven so far.

---

_Verified: 2026-09-10_
_Verifier: Claude (gsd-verifier) — SELF-VERIFICATION, no independent reviewer available (`OV-239-01`)_
