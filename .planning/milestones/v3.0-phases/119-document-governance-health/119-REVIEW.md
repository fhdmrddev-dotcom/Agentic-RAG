---
phase: 119-document-governance-health
reviewed: 2026-06-21T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - backend/app/api/document_governance.py
  - backend/app/main.py
  - backend/tests/integration/test_119_broken.py
  - backend/tests/integration/test_119_leak.py
  - backend/tests/integration/test_119_low_conf.py
  - backend/tests/integration/test_119_unclassified.py
  - backend/tests/test_119_governance.py
  - backend/tests/unit/test_119_low_conf_scan.py
  - frontend/src/App.tsx
  - frontend/src/components/health/GovernanceRow.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/lib/api.ts
  - frontend/src/lib/nav-items.ts
  - frontend/src/pages/__tests__/GovernancePage.test.tsx
  - frontend/src/pages/GovernancePage.tsx
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 119: Code Review Report

**Reviewed:** 2026-06-21
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 119 adds a read-only Document Governance surface: a backend aggregation router
(`document_governance.py`) exposing three owner-scoped signals (broken relationships /
unclassified / low-confidence) and a frontend top-level home (`GovernancePage`) with a
link-out-only row component (`GovernanceRow`). I reviewed the implementation
adversarially against the four security/correctness focus areas (owner-scoping leak
safety, broken-relationship existence-oracle, low-confidence numeric guards, frontend
read-only + infinite-loop guard + nav-triad reachability).

**The headline security claims hold up under tracing.** Every Supabase query in
`document_governance.py` that touches `documents` / `document_relationships` carries
`.eq("user_id", _uid(caller))` or rides the already-owner-scoped `_resolve_readable_latest`
(detail below). The `_latest_exists_anywhere` existence probe does NOT introduce a
cross-user existence oracle: its boolean only decides whether the CALLER's OWN edge is
reported, and the masked-not-broken case correctly produces no output (no foreign id,
filename, or content ever reaches the response). The low-confidence scan correctly treats
`0.0` as low and guards `bool`/`None`/non-numeric values. `GovernanceRow` imports no write
helper and the `initializedTabsRef` guard prevents the empty-response refetch loop. The
nav triad (App.tsx union member + ChatLayout branch + nav-items entry) is complete and
reachable in both desktop (`NavPanel`) and mobile (`ChatLayout` drawer) — the Phase 118
built-but-unreachable lesson was applied.

No BLOCKERs. The findings below are correctness edge cases and quality issues that degrade
robustness but do not break the security model or the happy path.

## Warnings

### WR-01: Duplicate React `key` when both ends of a broken edge are dangling

**File:** `frontend/src/pages/GovernancePage.tsx:194-212` (root cause: `backend/app/api/document_governance.py:183-197`)
**Issue:** `_fetch_broken_relationships` appends a SEPARATE item per broken endpoint of a
single edge (lines 184-187: `if src_broken: ...` and `if tgt_broken: ...`). When BOTH
endpoints are orphaned old-version references (a reachable state — two re-uploaded targets
on one edge), the edge produces **two** items that share the same `edge.get("id")` as their
`relationship_id`. The frontend then renders both with `key={item.relationship_id}`
(line 201), producing duplicate React keys — a console warning and potential render
reconciliation glitch (rows can be dropped or mis-updated).
**Fix:** Make the React key unique per item, e.g. combine the relationship id with the
broken end id:
```tsx
<GovernanceRow
  key={`${item.relationship_id}:${item.broken_doc_id}`}
  ...
/>
```
Alternatively, give each backend item a stable composite id (`f"{edge_id}:{broken_doc_id}"`)
and key on that.

### WR-02: Readable-end link-out fails to open when the surviving end is an old-version id

**File:** `backend/app/api/document_governance.py:157-197` and `frontend/src/pages/GovernancePage.tsx:195-211`
**Issue:** For a broken edge, the surviving (readable) end is surfaced as
`readable_doc_id` / `document_id` = the ORIGINAL edge endpoint id (`tgt`/`src`), NOT the
follow-to-latest resolved id. `_is_readable` (lines 157-164) computes only a boolean and
discards the resolved row. If the surviving end's edge was keyed on an OLD version
(the same orphaned-old-version scenario that produces broken edges in the first place),
`readable_doc_id` is an `is_latest=False` id. The frontend resolves the openable doc via
`documents.find(d => d.id === openId)` (line 197/101), but `listDocuments()` returns only
`is_latest=True` rows — so the click resolves to `undefined`, the panel never opens, and the
row silently does nothing. The row still renders as enabled (docId is non-null), so the user
gets a dead click with no feedback.
**Fix:** Have `_is_readable` (or a sibling) return the RESOLVED latest id and carry THAT as
`readable_doc_id` / `document_id`, so the link-out targets a row `listDocuments()` actually
returns:
```python
async def _readable_latest_id(doc_id: str) -> str | None:
    if doc_id not in readable_latest_id:
        row = await _resolve_readable_latest(doc_id, user_id, supabase=supabase)
        readable_latest_id[doc_id] = row["id"] if (row and row.get("is_latest")) else None
    return readable_latest_id[doc_id]
# ... broken_ends.append((src, await _readable_latest_id(tgt)))
```

### WR-03: Governance row may surface a doc the panel cannot resolve (cap mismatch)

**File:** `frontend/src/pages/GovernancePage.tsx:98-111,196-238`
**Issue:** The page resolves a clicked governance row to a full `Document` only from the
in-memory `documents` array fetched once by `listDocuments()` (line 106). `listDocuments`
issues a single unpaginated PostgREST select, which is subject to Supabase's implicit
~1000-row default cap; the low-confidence scan separately caps at `LOW_CONF_SCAN_CAP = 2000`
(`document_governance.py:67`). For a library with >1000 latest docs, a governance signal can
surface a row whose doc id is NOT in `documents`, so `selectedDoc` stays `null` and the
detail panel never opens — another silent dead click. The `loadDocuments` catch
(lines 108-110) also swallows any list failure, so a transient `/documents` error produces
the same dead-click behavior with no user-visible reason.
**Fix:** Fetch the clicked document on demand by id (a single `getDocument(id)` call) rather
than relying on a bounded pre-fetched list, or surface a small inline "couldn't open this
document" message when `selectedDocId` is set but `selectedDoc` resolves to `null`. At
minimum, document the >1000-doc limitation if the on-demand fetch is deferred.

### WR-04: `_latest_exists_anywhere` returns `False` for an unknown id, conflating "deleted" with "never existed / corrupt id"

**File:** `backend/app/api/document_governance.py:104-107`
**Issue:** When the endpoint-id row lookup returns no rows (line 104), the function returns
`False` → `_is_broken` reports the edge as broken. The docstring argues the FK CASCADE makes
this state unreachable, but the code is the live gate and the assumption is fragile: a NULL
endpoint id, a manually-inserted/migrated edge, or any future schema change that drops or
relaxes the CASCADE would cause edges to be reported broken on a false premise. More
importantly, the same branch swallows the distinction between "lineage genuinely gone" and
"the id is malformed/non-existent" — both collapse to broken without any signal. Combined
with the broad `except Exception -> 502` at the route layer, a data-integrity anomaly is
invisible.
**Fix:** Keep the conservative default but make the unexpected case observable, e.g.
`logger.warning("governance: edge endpoint %s has no documents row (treating as broken)", endpoint_id)`
before `return False`, so an unexpected dangle (CASCADE regression, bad migration) is loud in
the logs rather than silently reshaping the broken count.

## Info

### IN-01: Inconsistent count noun between header line and per-card subheader

**File:** `frontend/src/pages/GovernancePage.tsx:259-262,282-284`
**Issue:** The page header pluralizes the broken count as "link/links" (line 260) while each
card's subheader pluralizes ALL three signals as "document/documents" (line 283). For the
broken card, "N documents" is slightly misleading — the count is broken EDGES/ends, not
documents (and per WR-01 a single edge can contribute two entries).
**Fix:** Use a signal-appropriate noun in the card subheader (e.g. "links" for broken,
"documents" for the other two), or standardize on "items".

### IN-02: `EMPTY_CARD` is spread then immediately overridden with the same value

**File:** `frontend/src/pages/GovernancePage.tsx:55,90-92`
**Issue:** `EMPTY_CARD` already declares `items: []`, but each initial state spreads it and
re-specifies `items: []` (`{ ...EMPTY_CARD, items: [] }`). The override exists only to widen
the `readonly []` type that `as const` produces. It reads as redundant/confusing.
**Fix:** Drop `as const` from `EMPTY_CARD` and type it as `CardState<never>` (or
`Omit<CardState<unknown>, "items">`), or keep the spread but add a one-line comment that the
`items: []` override is a type-widening workaround, not a value change.

### IN-03: Broken-relationships endpoint fetches all edges with no DB-side bound (N+1 resolver calls)

**File:** `backend/app/api/document_governance.py:145-201`
**Issue:** `_fetch_broken_relationships` selects ALL of the caller's edges (no `.limit()`),
then for each unique endpoint performs up to two sequential threadpool DB round-trips
(`_resolve_readable_latest` + `_latest_exists_anywhere`, the latter itself up to two
round-trips). The unclassified/low-confidence fetchers are explicitly capped
(`.range(...)` / `LOW_CONF_SCAN_CAP`), but broken is not. Performance is out of v1 scope, but
the asymmetry is worth noting — a user with many relationships incurs an unbounded, latency-
heavy request behind the 502 wrap.
**Fix:** (Deferred-to-perf-pass acceptable.) Consider an upper bound on edges scanned per
request mirroring `LOW_CONF_SCAN_CAP`, or batch the existence probe.

### IN-04: Live-DB integration tests are skip-guarded — CI without local Postgres exercises only mocks/units

**File:** `backend/tests/integration/test_119_leak.py:74-78` (and the three sibling integration files)
**Issue:** All four integration files (`test_119_leak`, `test_119_broken`, `test_119_low_conf`,
`test_119_unclassified`) carry a module-level `pytest.mark.skipif(not PG_AVAILABLE, ...)`.
The two-user leak proof — the SOLE non-vacuous verification that owner-scoping holds against
the RLS-bypassing service-role client — silently skips wherever local Postgres/Supabase is
unreachable (e.g. a CI runner without the local stack). The remaining always-on coverage is
the MagicMock unit tests (`test_119_governance`, `test_119_low_conf_scan`), which cannot prove
cross-user isolation. This is consistent with the prior-phase harness convention and the
tests ARE non-vacuous when run, but the security guarantee is only verified in environments
that happen to have the live DB.
**Fix:** Ensure the phase's CI/UAT gate explicitly runs against the live local stack (the
project's documented :54322 flow) so the leak proof actually executes, and treat a SKIP of
`test_119_leak.py` as a gate failure rather than a pass — otherwise the sole isolation proof
can quietly no-op.

---

_Reviewed: 2026-06-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
