---
phase: 119-document-governance-health
audited: 2026-06-21
auditor: gsd-security-auditor
asvs_level: 1
register_authored_at_plan_time: true
threats_total: 12
threats_closed: 12
threats_open: 0
status: SECURED
block_on: high
---

# Phase 119 — Document Governance Health: Security Audit (SECURITY.md)

**Verdict: SECURED.** All 12 declared threats across the two plan threat models
(backend 119-01, frontend 119-02) resolve to CLOSED — 8 `mitigate` controls verified
present in the shipped code with file:line evidence, 4 `accept` dispositions logged
below with their no-write / no-dependency invariants verified. `threats_open: 0`.

The single most load-bearing control — **T-119-01-01 owner-scoping as the SOLE leak
gate under the RLS-bypassing service-role client** — was verified NON-VACUOUS by RE-RUNNING
the two-user live leak proof against the real local Postgres + the real service-role
Supabase client this session (`pytest tests/integration/test_119_leak.py -q` → **3 passed**,
not skipped). The test seeds real cross-user true-positives per signal per user, drives the
REAL HTTP routes via TestClient, and asserts BOTH that A never sees B's ids AND that each
user sees its OWN positives — so an "all clear" / blanket-empty bug cannot false-green.

This is plan-time-authored register verification, not a fresh vulnerability scan. The 4
code-review WARNINGs (WR-01..04) and 4 INFO items are robustness/UX edge cases that do not
break the security model; WR-01/02/03 were fixed in-phase and WR-04 was accepted (see
Observations). None reopens a declared threat.

---

## Threat Verification — Backend (Plan 119-01)

| Threat ID | Category | Disposition | Verdict | Evidence |
|-----------|----------|-------------|---------|----------|
| T-119-01-01 | Information Disclosure | mitigate | CLOSED | Every governance query carries `.eq("user_id", _uid(caller))`: broken edges `document_governance.py:148-149`; `_latest_exists_anywhere` lineage probe `:117-119`; unclassified `:228`; low-confidence `:291`. `_uid` coerces to canonical UUID (`document_relationship_service.py:75-87`). Broken signal also rides the owner-scoped `_resolve_readable_latest` (`:162-266`). **Live two-user leak proof re-run this session: `test_119_leak.py` 3 passed (NON-VACUOUS — seeded per-signal cross-user true-positives, drives the real routes via TestClient + real service-role client, asserts A never sees B AND A sees its own positives).** |
| T-119-01-02 | Information Disclosure (existence oracle) | mitigate | CLOSED | Masking != deletion: `_latest_exists_anywhere` returns True for an alive-but-unreadable target so a masked target is NEVER reported broken (`document_governance.py:72-123`, `_is_broken` at `:173-180`). The probe is content-free (returns a count + lineage key only, never a foreign id/filename/metadata). `test_119_leak.py::test_masked_target_not_reported_as_broken_for_either_viewer` GREEN this session — asserts the private target id AND title never appear in B's list, and the owner A also does not see it as broken (non-vacuity twin). WR-02 fix carries the RESOLVED-latest id as `readable_doc_id`, not a raw cross-user/old id (`:157-171`). |
| T-119-01-03 | DoS / Information Disclosure (malformed id → 500) | mitigate | CLOSED | `_uid()` raises `ValueError` on a malformed user_id (`document_relationship_service.py:87`), caught by the 502 wrap on all 3 routes (`document_governance.py:354-360, 375-379, 395-399`). `_resolve_readable_latest` returns None on an unresolvable id (calm-resolution contract, `:185-186` of the service). PostgREST bound predicates only — no SQL string interpolation. |
| T-119-01-04 | Tampering (low-conf provenance) | mitigate | CLOSED | The scan emits the RAW `metadata._confidence[field]` value into `low_fields` / `min_confidence` — never fabricated (`document_governance.py:306-324`). Single `LOW_CONF_CUTOFF = 0.5` constant referencing the ConfidenceChip TIER.MED source-of-truth, no second threshold (`:60-63`). BUG-260620 narrowing (`_`-prefix / empty-value / user-confirmed exclusions, `:312-316`) tightens the scan to the panel's `isLow` without fabricating: it still surfaces the raw scored value. |
| T-119-01-05 | Repudiation (audit gap on reads) | accept | CLOSED | Logged accepted risk AR-119-01. Reads are not audited (mirrors `resolve_view`/`get_relationships`). Verified zero write path: the router has only 3 `@router.get` handlers (`:342, 363, 382`), no POST/PATCH/DELETE; no migration added (newest is `075_*` from Phase 116); `threads.py` byte-untouched. |
| T-119-01-SC | Tampering (pip installs) | accept | CLOSED | Logged accepted risk AR-119-03. Zero new dependency: `git diff` over the phase window shows no change to `backend/requirements.txt`; `document_governance.py` imports only existing modules (fastapi, supabase, app.dependencies, document_relationship_service). |

## Threat Verification — Frontend (Plan 119-02)

| Threat ID | Category | Disposition | Verdict | Evidence |
|-----------|----------|-------------|---------|----------|
| T-119-02-01 | Elevation of Privilege (built-but-unreachable) | mitigate | CLOSED | The D-119-2 triad is complete and reachable in ONE plan: `App.tsx:9` ActiveView union includes `"governance"`; `nav-items.ts:15,39` imports the distinct `ShieldCheck` glyph + adds `{ view: "governance", ... }`; `ChatLayout.tsx:12` imports GovernancePage and `:301-307` renders it on `activeView === "governance"` — this branch PRECEDES the trailing `<KnowledgeHealthPage />` else (`:308-309`), so an unhandled view can never fall through. Vitest `GovernancePage.test.tsx` renders the mounted component (reachability lock). |
| T-119-02-02 | Tampering (unintended write from read-only surface) | mitigate | CLOSED | `GovernanceRow.tsx` imports zero write helper — grep for `deleteDocument\|reingestDocument\|MoveToFolderDialog\|moveDocument` → no matches; it imports only `getFileIcon` + `cn` and is a single link-out `<button>` → `onOpen(docId)` (`:16-17, 29-49`). The 3 governance api helpers are GET-only (`api.ts:2011, 2018, 2025`). Vitest link-out test asserts NO write endpoint (`moveDocument`/`acceptClassification`/`dismissClassification`/`updateDocumentMetadata`/`deleteRelationship`) fires on row click (`GovernancePage.test.tsx:152-179`); a second test asserts rows expose no inline delete/reingest/move controls (`:181-194`). |
| T-119-02-03 | DoS (infinite re-fetch loop on empty) | mitigate | CLOSED | `initializedTabsRef` guard fires each card's fetch exactly once (`GovernancePage.tsx:150-160`); Refresh `.clear()`s it then re-fires (`:164-171`). Vitest no-loop test asserts each endpoint was called exactly once on an empty (total:0) response after settle (`GovernancePage.test.tsx:130-150`) and Refresh re-fires to count 2 (`:239-251`). |
| T-119-02-04 | Tampering (fabricated confidence) | mitigate | CLOSED | The low-conf row chip renders the RAW `item.min_confidence` via the Phase-112 `ConfidenceChip` imported from `@/components/metadata/ConfidenceChip` (`GovernancePage.tsx:28, 254`) — never a fabricated score. Single 0.5 cutoff source-of-truth (the backend `LOW_CONF_CUTOFF` agrees, no second constant). |
| T-119-02-05 | Information Disclosure (client-side data) | accept | CLOSED | Logged accepted risk AR-119-02. The frontend renders only what the owner-scoped backend (T-119-01-01, proven non-vacuous live) returns; no client-side trust boundary beyond the JWT-authenticated fetch (`api.ts:2012, 2019, 2026` use `getAuthHeaders()`). |
| T-119-02-SC | Tampering (npm installs) | accept | CLOSED | Logged accepted risk AR-119-03. Zero new dependency: `git diff` over the phase window shows no change to `frontend/package.json`; new imports (`ShieldCheck` lucide glyph, existing components) introduce no package. |

---

## Accepted Risks Log

| ID | Threat | Rationale | Boundary intact? |
|----|--------|-----------|------------------|
| AR-119-01 | T-119-01-05 — reads not audited | Read-only governance aggregation introduces NO write path; mirrors `resolve_view`/`get_relationships`; `VALID_ACTION_TYPES` has no read action. Verified: 3 GET-only routes, zero migration, zero write endpoint, `threads.py` untouched. | Yes — no state mutation reachable from this surface. |
| AR-119-02 | T-119-02-05 — client-side data trust | The frontend is a pure consumer; the only trust boundary is the JWT-authenticated fetch into the owner-scoped backend. Owner-scoping proven non-vacuous live (T-119-01-01). | Yes — no client-side authority over what data is returned. |
| AR-119-03 | T-119-01-SC / T-119-02-SC — supply chain (pip/npm) | No package installed this phase. `requirements.txt` / `package.json` unchanged in the phase commit window; all imports are pre-existing modules/components. Vacuously satisfied. | Yes — no new dependency surface introduced. |

---

## Observations (non-blocking — do NOT reopen any declared threat)

These are code-review WARNING/INFO items reconfirmed during this audit. They are
robustness/UX edge cases, NOT gaps in any declared mitigation, and do not affect the
SECURED verdict. Recorded for the milestone backlog.

- **OBS-119-01 (was WR-04, accepted):** `_latest_exists_anywhere` returns `False` (→ broken) for an unknown endpoint id, conflating "lineage genuinely deleted" with "corrupt/never-existed id" under the FK-CASCADE premise (`document_governance.py:104-107`). Security-neutral: the false-broken case surfaces only the CALLER'S OWN edge and leaks no foreign data; the concern is observability (a CASCADE regression would silently reshape the broken count). Reviewer fix (add a `logger.warning`) was accepted as backlog, not implemented. Does not reopen T-119-01-02 (the masked-not-broken existence-oracle suppression is unaffected).
- **OBS-119-02 (was WR-01/02/03, fixed in-phase):** the React duplicate-key (WR-01, `GovernancePage.tsx:218` composite key), the old-version link-out dead click (WR-02, `_readable_latest_id` carries the resolved-latest id `:157-171`), and the >1000-doc / failed-list dead click (WR-03, the honest `selectedUnresolvable` alert `:111, 325-340`) are all addressed. None was a security gap; all are UX robustness.
- **OBS-119-03 (was IN-03):** `_fetch_broken_relationships` enumerates all of the caller's edges with no DB-side `.limit()`, incurring N+1 resolver round-trips (`document_governance.py:145-201`). A latency/DoS-amplification note for a user with many relationships; out of v1 scope, behind the 502 wrap. Performance backlog, not a security gap.
- **OBS-119-04 (was IN-04):** the four live integration files (incl. the SOLE non-vacuous owner-scoping proof `test_119_leak.py`) are `skipif(not PG_AVAILABLE)`-guarded. The leak proof silently no-ops on a CI runner without the local stack. This audit MITIGATED that risk by RE-RUNNING the leak test live this session (3 passed). The standing recommendation: the phase gate must run against the live :54322 stack and treat a SKIP of `test_119_leak.py` as a gate failure.

---

## Unregistered Flags

None. Both SUMMARYs' "Threat surface scan" sections affirm no NEW security surface beyond
the plan threat models. The one structural addition (`_latest_exists_anywhere`) is covered
by the declared T-119-01-02 disposition (content-free existence probe, verified above) and
proven non-vacuous by `test_119_leak.py`. No new attack surface appeared during
implementation that lacks a threat mapping.

---

## Audit Method

- Loaded both plan `<threat_model>` blocks, both SUMMARYs, the code review, and all
  implementation files (backend router + resolver source + mount; frontend page/row/nav triad).
- Each `mitigate` threat verified by reading the cited file and confirming the control is
  present AND applies to ALL entry points (every governance query, every nav surface).
- Each `accept` threat verified by confirming its underlying invariant in code (GET-only
  routes, zero migration, zero dependency, `threads.py` untouched) and logging it above.
- The load-bearing T-119-01-01/02 owner-scoping + existence-oracle controls verified by
  RE-RUNNING the live two-user leak proof — not trusting the SUMMARY's claim blind. 3 passed.
- Implementation files were not modified. Only this SECURITY.md was written.

*Audited 2026-06-21 by gsd-security-auditor. ASVS Level 1. block_on: high → no HIGH/open threat → phase may ship.*
