---
phase: 266-expert-knowledge-in-a-real-org
verified: 2026-09-25T00:00:00Z
verification_mode: self-verified   # ⛔ OV-SOLO-01 — NEVER "reviewed". No independent §6.3 reviewer exists.
status: passed
score: 9/9 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "backend/app/services/run_producer.py is byte-unchanged across the whole phase — per D-266-11"
    reason: "Code review finding CR-01 (a restricted first-party Expert with zero folders resolved to an empty scope, which retrieval reads as 'no folder filter' — searching every org the caller belongs to) is downstream of the resolver and can only be closed at the seam that consumes effective_folder_ids. Operator accepted a +14-line guard (ExpertScopeUnavailable) in run_producer.py as a security fix, overriding D-266-11. Confirmed in code: git diff 522e7b4fc HEAD -- backend/app/services/run_producer.py shows a targeted, additive guard only; RED test_266_restricted_empty_scope_refuses.py (73cb9726a) → GREEN fix (2c4102070); 608 passed across Expert/run_producer/scoping suites."
    accepted_by: "operator (2026-09-25)"
    accepted_at: "2026-09-25"
human_verification:
  - test: "UI-2 — with an Expert mid-install, open the composer's invite dialog and confirm the Financial Analyzer row shows the 'install first / still installing' reason and does not activate."
    expected: "The invite is blocked with a visible reason line while installing; the Expert does not become active on that thread."
    why_human: "Explicitly left out of the operator's simplified 3-step live check (266-UAT-LOG.md 'UI rows'). Covered only by unit tests (ComposerExpert.test.tsx / inviteGate); never driven in a live browser. Recorded as OWED, not PASS, by the phase's own SUMMARY and STATE.md."
  - test: "UI-4 (not-installed branch) — sign in as a non-manager member of an org that has NOT installed the Financial Analyzer and open its detail modal/card."
    expected: "The modal/card shows 'An org admin needs to install…' and no Install button (no button that does nothing)."
    why_human: "The live check only exercised the ready-org case (a non-manager viewing an already-installed org). The not-installed non-manager line is unit-tested only (expertCatalog.test.ts), never driven live. Recorded as OWED in 266-UAT-LOG.md and 266-05-SUMMARY.md."
---

# Phase 266: Expert Knowledge in a Real Org Verification Report

**Phase Goal:** When an org installs, or is entitled to, a first-party Expert, that Expert's knowledge
exists inside that org — copied, ingested and embedded there — so the Financial Analyzer answers from
its report for a real user in a real org. Closes v4.3 PACK-05 / SEED-304.
**Verified:** 2026-09-25
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC#1 (PACK-18) — fresh org install lands **in that org's Library**, terminal success, non-null vectors, chunk_count > 0 | ✓ VERIFIED | `266-UAT-LOG.md` SC#1: doc `731bfa9a-…` org A, `status completed`, `chunk_count 3`, `embedded 3/3`, folder org A, `is_org_shared true`, owned by installer (not a system user); `expert_installs` row org A `status installed`. Live evidence + SQL output quoted, backed by `evidence/01-sc1-install-u1.txt`. Code path traced: `POST /experts/{id}/install` → `install_expert_service` → `async_mint_document_row(org_id=…)` → `_enqueue_or_splice` (the one ingest pipeline, `test_266_install_service.py` 17 green cases). |
| 2 | SC#2 (PACK-19) — second install into the same org: identical documents/chunks/folders counts before/after | ✓ VERIFIED | `266-UAT-LOG.md` SC#2: `(documents, chunks, folders, installs) = (1, 3, 1, 1)` before and after; `max(updated_at)` unchanged. Idempotency logic directly read (`expert_install_service.py`, arms i-vii) and unit-proved (`test_266_install_idempotency.py`, part of the 122 passing phase-266 backend cases run directly). |
| 3 | SC#3 (PACK-19) — driven two-org fence: org A cannot reach org B's copy via document read, search (keyword+vector RPC), chat retrieval, or the Expert's resolved scope; org B's member can (positive control); the resolver leg was driven RED by a plant | ✓ VERIFIED | `backend/tests/integration/test_266_two_org_fence.py` — **directly executed: 6 passed**, base-resolver RED confirmed (3 failed/3 passed against `522e7b4fc`). Live drive: SC#3a (U1→B's doc: `/content` 404, `/chunks` 404, list excludes it), SC#3-control (U2→B's doc: 200/200), SC#3b/c (audit-log `search.query`→`documents.org_id` join: every row = A, B's id never appears, with and without the Expert active). `resolve_expert_bundle` code read directly: `is_system` folders come ONLY from `expert_installs` for `caller_org_id`, admitted only when `f_org_id == caller_org_id` (the `is_system_folder` bypass is gone, replaced by a comment naming SEED-304); fence `test_266_system_folder_bypass_fence.py` included in the 122 directly-run green cases. |
| 4 | SC#4 (PACK-20) — live transcript in a real org citing `$124.5M`/`+18.2%` from the org's own copy, plus one refused out-of-scope question | ✓ VERIFIED | `266-UAT-LOG.md` SC#4-revenue (regex matches `'$124.5 million'`/`'+18.2%'`, retrieved chunk quoted, `search.query`→org join = A), SC#4-refusal (declines, names what the scope holds, invents nothing, 0 retrieved ids), SC#4-flip (a two-org user switched to org B cites org B's copy — the non-vacuous "not the seed org / not the other org" proof). Full assistant transcripts quoted in the log and in `evidence/06-sc4-answer-refusal-flip.txt`. |
| 5 | Active org proven for every drive (X-Org-Id sent + org of every written/cited row), never assumed | ✓ VERIFIED | Every UAT-LOG row states the `X-Org-Id` header sent and cross-checks it against the SQL-measured `org_id` of the row acted on or cited; `org_members` sets for U1/U2 quoted single-org before SC#3. |
| 6 | `test_260_financial_analyzer_conversation.py` relabelled as dispatcher-wiring-only, cited as proof of nothing about PACK-05 | ✓ VERIFIED | Module docstring change confirmed present; no assertion line removed (`git diff` grep in 266-05-SUMMARY.md); file runs green alongside the fence (13 passed together, re-confirmed with `-k 266`/direct fence run). |
| 7 | `run_producer.py` byte-unchanged across the phase (D-266-11) | ✗ FAILED → **PASSED (override)** | `git diff --stat 522e7b4fc HEAD -- backend/app/services/run_producer.py` → **+14 lines** (not byte-unchanged). This is CR-01's fix, explicitly overridden by the operator as OV-266-02 (STATE.md, dated 2026-09-25) with a written reason and evidence. See `overrides:` above. |
| 8 | STATE.md records D-266-16 (no G-2 sketch) as a guardrail-override decision, not a skip | ✓ VERIFIED | `grep -n "OV-266-01" .planning/STATE.md` present, names D-266-16, G-2, and the UI-3 finding it foreshadowed. |
| 9 | Every non-test source file the phase touched has a re-derived ledger row/section, and `check-hot-file-ledger`/`check-claude-md-size` pass | ✓ VERIFIED | Both gates run directly: `ledger gate OK — every watched file has a row` (333 rows); `claude-md size gate OK` (118,795 chars, 79.2% of limit). |

**Score:** 9/9 truths verified (1 via a written, dated, evidence-backed override).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/195_expert_installs_and_seed_retirement.sql` | `expert_installs` table + RLS + grants, index widen, 188 retirement | ✓ VERIFIED | Read directly: `CREATE TABLE IF NOT EXISTS public.expert_installs`, RLS + REVOKE/GRANT pattern, retirement comment naming SEED-177/D-206-07. Applied to local DB; `check-schema-acl-parity.cjs` run directly → `schema ACL parity OK — mirrored: 191/191`. |
| `backend/app/services/expert_install_service.py` | install/derive-state/list logic, the one ingest path | ✓ VERIFIED | Substantive service; 71 unit cases across 3 test files pass directly. |
| `backend/tests/integration/test_266_two_org_fence.py` | real-RLS two-org fence, single-org subject, positive control, resolver plant | ✓ VERIFIED (301 lines, ≥120 min) | Run directly: **6 passed**. |
| `.planning/phases/266-expert-knowledge-in-a-real-org/266-UAT-LOG.md` | SC#1..4 rows, each with its own SQL/transcript evidence | ✓ VERIFIED | Contains all required rows plus `document_ids` joins; 11 evidence transcripts present under `evidence/`. |
| `.planning/phases/266-expert-knowledge-in-a-real-org/266-PROD-PARITY.md` | ordered, approval-gated production checklist, nothing applied | ✓ VERIFIED | Contains `get_advisors`, explicit "per-action operator approval" language, migration-before-deploy ordering; states nothing was applied. |
| Frontend Install UI (`ExpertDetailModal.tsx`, `ExpertCard.tsx`, `expertCatalog.ts`, `InviteExpertDialog.tsx`, `LibraryPage.tsx`/`NavRow.tsx` provenance) | Install/Installing/Ready/Failed states, invite gate, Library provenance caption | ✓ VERIFIED, WIRED, DATA FLOWING | Directly re-ran the 5 phase-266 frontend suites: **87 passed (87)**. `NavRow.tsx` caption confirmed rendered with no CSS-hiding class (`text-[11px] leading-tight text-muted-foreground truncate`) — the UI-3 defect (tooltip-only) is fixed and operator-confirmed live ("shows now"). |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `266-UAT-LOG.md` SC#4 row | `audit_log.search.query.metadata.document_ids` → `documents.org_id` | SQL join, quoted verbatim | ✓ WIRED | Join query and output shown live in the log for SC#3b/c and SC#4-revenue/refusal/flip; `audit_log.org_id` explicitly never cited (documented pitfall). |
| `resolve_expert_bundle` | `db/experts.get_expert_install` | awaited only when `bundle.is_system` | ✓ WIRED | Confirmed by direct code read (`expert_service.py`); only reached for `is_system` bundles, org-scoped by `caller_org_id`. |
| `run_producer._resolve_thread_scoping` | `ExpertScopeUnavailable` (CR-01 fix) | raised when `scope_mode == "restricted" and not expert_folder_ids` | ✓ WIRED | Confirmed by direct code read (`run_producer.py:463-471`) and by the guard's call sites sitting inside broad `except Exception` handlers at both the live-kickoff and continuation build sites (`:778`, `:917`), so the refusal surfaces as a run error rather than an unhandled crash. `test_266_restricted_empty_scope_refuses.py` (3 cases) run directly and pass. |
| `test_266_two_org_fence.py` | `tests/integration/_rls_harness.py` | `open_user_conn` + `assert_auth_uid` preflight | ✓ WIRED | Confirmed present in the file; suite passes under real RLS against local Postgres (`127.0.0.1:54322`). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| Install UI (`ExpertDetailModal`/`ExpertCard`) | `install` state on the Expert row | `GET /experts` / `GET /experts/{id}` → `overlay_install_state` → `list_install_summaries`/`get_expert_install` | ✓ real DB-derived state, never stored twice | ✓ FLOWING |
| Financial Analyzer chat answer | `resolved.effective_folder_ids` → retrieval scope | `expert_installs` row for the caller's org (real Postgres row, not a mock) | ✓ live-driven; SC#1-4 show real embeddings and real search-audit joins | ✓ FLOWING |
| Library folder provenance caption | `folderProvenance[node.id]` | `listExpertInstalls()` → `provenanceByFolder()` | ✓ real install rows; caption text rendered, no hiding class | ✓ FLOWING (operator-confirmed live) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Backend unit baseline at the recorded ceiling | `pytest tests/unit -q --continue-on-collection-errors` (backend, this session) | `71 failed, 5656 passed, 1 skipped, 2 xfailed, 2 xpassed` | ✓ PASS (matches CLAUDE.md's locked ceiling exactly; `check-backend-unit-baseline.cjs` independently confirmed `[GATE PASSED]`) |
| Phase-266 backend unit suites | `pytest tests/unit -q -k 266` | `122 passed, 5610 deselected` | ✓ PASS |
| Phase-266 integration fence | `pytest tests/integration/test_266_two_org_fence.py -q -rs` | `6 passed` | ✓ PASS |
| Phase-266 frontend suites | `npx vitest run` (5 targeted files) | `5 files, 87 tests, all passed` | ✓ PASS |
| Schema ACL parity | `node scripts/check-schema-acl-parity.cjs` | `mirrored: 191/191`, OK | ✓ PASS |
| Hot-file ledger | `node scripts/check-hot-file-ledger.cjs .planning/phases/266-expert-knowledge-in-a-real-org` | `333 rows`, OK | ✓ PASS |
| CLAUDE.md size gate | `node scripts/check-claude-md-size.cjs` | `118,795 chars, 79.2%`, OK | ✓ PASS |
| Seeds register gate | `node scripts/check-seeds-register.cjs` | `322/322 parsed, 0 duplicate ids`, OK | ✓ PASS |
| Full-repo vitest count gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | `total 8827  ·  failed 0  ·  pinned total 8075` · `count gate OK — 327/327 pinned files present, no per-file decrease, 0 failing.` (completed after ~35 min in this session — slow, not stuck) | ✓ PASS |

**Note on the full vitest count gate:** this ran slowly (~35 minutes) but completed independently within this verification session and its verdict line matches `266-05-SUMMARY.md`'s quoted figures exactly (`8827` total, `8075` pinned, `327/327`), including the five newly-adopted test files from a later, unrelated phase (`RunHero.test.tsx`, `automationFacts.test.ts`, etc. — landed after 266 closed, consistent with `develop` moving on). `FolderNode.test.tsx`'s raised pin (18 → 20) was separately confirmed present in `scripts/vitest-count-gate.cjs:235`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| PACK-18 | 266-01..05 | Corpus copied into the installing org and ingested there, terminal success, real embeddings | ✓ SATISFIED | SC#1 truth above |
| PACK-19 | 266-01, 266-02, 266-05 | Idempotent, org-contained provisioning; driven two-org fence | ✓ SATISFIED | SC#2, SC#3 truths above |
| PACK-20 | 266-05 | Financial Analyzer answers from its report live, refuses out-of-scope | ✓ SATISFIED | SC#4 truth above |

No orphaned requirements: REQUIREMENTS.md maps only PACK-18/19/20 to this phase, and all three are claimed by a 266 plan's `requirements:` frontmatter.

### Anti-Patterns Found

None blocking. `grep` sweeps for `TODO|FIXME|XXX|HACK|PLACEHOLDER` and empty-return stubs across the phase's created/modified files turned up nothing beyond documented, deliberate defers (SEED-314, SEED-315, and the WR-01..08/IN-01..05 review findings, all explicitly recorded as open and pending operator triage rather than silently present).

### Code Review Findings (266-REVIEW.md) — Resolution Status

| Finding | Severity | Status | Verification |
|---|---|---|---|
| CR-01 — an uninstalled/empty-scope restricted Expert ran unscoped retrieval (empty list read as "no filter") | Critical | **FIXED** | Confirmed in code (`run_producer.py` `ExpertScopeUnavailable` guard) and by direct test execution (`test_266_restricted_empty_scope_refuses.py`, 3/3 pass). Overridden D-266-11 with OV-266-02, recorded above. |
| WR-01..WR-08, IN-01..IN-05 | Warning/Info | **OPEN — pending operator triage** | None falsifies a ROADMAP success criterion as currently measured (single markdown corpus, no cross-org-root-import scenario driven, no installer-leaves-org scenario driven in this phase's UAT). Recorded here as non-blocking per the phase's own resolution log; two already have seeds (SEED-314, SEED-315) or are addressed by prior findings (F-1 fixed live). Recommend the operator triage fix/defer/accept per G-7, rather than opening a new gap-closure round on an already fully-passing ROADMAP scorecard. |

## Human Verification Required

### 1. UI-2 — invite blocked while installing

**Test:** With the Financial Analyzer mid-install (or a second uninstalled Expert) in a live browser, open the composer's invite dialog.
**Expected:** The Financial Analyzer row shows the "install first" / "still installing" reason and does not activate.
**Why human:** Never driven live — the operator's simplified 3-step check omitted this step; it is unit-tested only (`ComposerExpert.test.tsx`). Explicitly recorded as OWED in `266-UAT-LOG.md` and `266-05-SUMMARY.md`.

### 2. UI-4 (not-installed branch) — non-manager sees the correct status line

**Test:** Sign in as a non-manager member of an org that has NOT installed the Financial Analyzer; open its detail modal/card.
**Expected:** The modal/card shows "An org admin needs to install…" and no button.
**Why human:** Only the ready-org non-manager case was driven live (because the org used for UI-1 had already been installed). The not-installed case is unit-tested only. Explicitly recorded as OWED.

### Also noted (process, not a code truth)

**Independent review is owed.** Per AGENTS.md/CLAUDE.md, the phase code review (`266-REVIEW.md`) should be conducted by an agent that did not shape the build; `266-05-SUMMARY.md` and `STATE.md` both record this as owed, not done. This verification (goal-backward, by a separate invocation) is not a substitute for that review, and is noted here for the operator's awareness rather than as a blocking finding — the review that was done (`266-REVIEW.md`) found and the phase fixed one Critical (CR-01), confirmed above.

## Gaps Summary

No ROADMAP success criterion is unmet. All four (SC#1-4 / PACK-18/19/20) are backed by live, org-joined evidence that this verification independently re-derived at the code and test level (not merely re-read from the SUMMARY): the two-org fence and phase-266 unit suites were re-executed directly (128 backend + 87 frontend cases, all green), the backend baseline matches the locked ceiling exactly, schema parity/ledger/CLAUDE.md-size/seeds gates all pass on direct re-run, and the one Critical code-review finding (CR-01, an empty-scope Expert searching every org) is confirmed fixed in `run_producer.py` with its own RED/GREEN test and is explicitly, traceably overridden against D-266-11 by the operator.

What remains is two explicitly-owed live UI checks (UI-2, UI-4 not-installed line) that the phase's own SUMMARY and STATE.md already flag as owed rather than claim as passed — this verification surfaces them as human-verification items rather than silently accepting the unit-test-only coverage as sufficient, per the phase's own "not passed, not hidden" discipline. Eight open code-review warnings/infos (WR-01..08, IN-01..05) are recorded and pending operator triage; none of them contradicts a measured ROADMAP success criterion, and two already have seeds tracking them (SEED-314, SEED-315).

---

_Verified: 2026-09-25_
_Verifier: Claude (gsd-verifier)_

## Human verification — resolved (2026-09-25)

Both owed live rows were driven by the operator after the verifier wrote `human_needed`: UI-4 (not-installed, non-manager: "An org admin needs to install…", no button; invite shows an install-first reason) and UI-2 (invite blocked while installing). Operator: **"both passed"**. See `266-HUMAN-UAT.md`. Status moved `human_needed` → `passed` on that evidence.
