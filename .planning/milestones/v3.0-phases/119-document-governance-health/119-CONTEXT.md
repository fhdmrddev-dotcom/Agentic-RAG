# Phase 119: Document Governance Health - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship a **separate, light, read-only governance view of document-*structure* health** —
distinct from the existing *retrieval* "Library Health" dashboard. It surfaces three
signals produced by the upstream v3.0 features and links each to the action that fixes it:

1. **Broken/dangling relationships** (from Phase 116 edges)
2. **Unclassified documents** — docs with a pending classification suggestion (Phase 118)
3. **Low-confidence metadata** — docs with any extracted field below the 112 low tier (Phase 111/112)

It is a **pure consumer**: read-only aggregation over the new tables under their existing
RLS, **no new write path**. Each signal row **links/navigates to the document's detail panel**
where the existing actions already live (remove a broken link · accept/dismiss a suggestion ·
edit / re-extract metadata). Lands last in v3.0.

Delivers **DGOV-01** (the governance view + 3 signals), **DGOV-02** (each signal links to its
fix), and **UX-01** (Deep Midnight / Aether, mobile-responsive, WCAG 2.1 AA — by reusing the
Library Health primitives).

**Hard prerequisites already shipped:** Phase 116 (relationships), Phase 118 (classification
suggestions), Phase 111/112 (per-field metadata confidence + `ConfidenceChip`).
</domain>

<decisions>
## Implementation Decisions

### Surface & navigation
- **D-119-1: New TOP-LEVEL nav home "Governance"** — a new `ActiveView "governance"` member
  with its own nav icon, peer to **Library Health** (NOT a tab/section inside the Documents
  page, NOT cards bolted onto the retrieval dashboard). Matches the Classification + Library
  Health precedent (both are top-level homes via `nav-items.ts`). Name is **distinct from
  "Library Health"** to avoid conflating structure-health with retrieval-health (SC#1). Pick a
  **distinct non-reused lucide glyph** (the Classification home already took `Wand2`; Library
  Health uses `Activity`) — exact glyph is Claude's discretion (candidates: `ShieldCheck`,
  `ClipboardCheck`).
- **D-119-2 (LOCKED, load-bearing — the Phase 118 lesson): the plan that adds the new
  `ActiveView` member MUST own its mount + nav IN-PHASE** — all three of:
  (a) extend the `ActiveView` union in `frontend/src/App.tsx:9`,
  (b) add the `ChatLayout.tsx` render branch (additive BEFORE the trailing `KnowledgeHealthPage`
      else, exactly like the `classification-rules` branch at `ChatLayout.tsx:294-301`),
  (c) add the `NAV_ITEMS` entry in `frontend/src/lib/nav-items.ts`.
  Phase 118 shipped its rules page **built-but-unreachable** because no single plan owned the
  ChatLayout branch + nav entry (caught by code-review BLOCKER + verifier, fixed inline
  `6394d16e`). A plan-task checklist for 119 MUST enumerate all three or the surface is dead.

### The three governance signals (definitions + thresholds — LOCKED)
- **D-119-3: Broken/dangling relationship = an edge whose target resolves to NO readable latest
  version** (the document was fully deleted — no `is_latest=True` row the owner can read).
  A target that exists but is masked **"linked document (no access)"** to the owner is **NOT**
  a break — masking stays masking (preserves the Phase 117 semantics; avoids leaking a
  cross-user existence signal). Detection anchors on Phase 116's `_resolve_readable_latest`
  (`document_relationship_service.py`): an edge is broken when that resolver yields nothing for
  the target (vs. yielding a masked-but-present row).
- **D-119-4: Unclassified document = `metadata._classification.status == "suggested"`** (a
  pending classification suggestion the user has neither accepted nor dismissed). This is the
  **read-side of the D-118-7 triage signal** Phase 118 deferred here. (NOT "folder_id is null /
  root" — many docs legitimately live at root; pending-suggestion is the actionable signal.)
- **D-119-5: Low-confidence metadata = a doc has ANY extracted field with
  `metadata._confidence[field] < 0.5`** — reuses the EXACT `ConfidenceChip` low cutoff
  (`TIER.MED = 0.5`, `frontend/src/components/metadata/ConfidenceChip.tsx`, hardcoded by 112's
  D-05) so the governance view and the detail panel agree on what "low" means. **No configurable
  threshold knob** (contradicts 112's deliberate "hardcoded, not a settings knob" decision).
  Doc-level "any field below" — exact below-the-hood query shape (e.g. per-field unnest vs.
  jsonb scan) is Claude's discretion.

### Fix actions (DGOV-02)
- **D-119-6: Every signal row LINKS/NAVIGATES to the document's detail panel** — it does NOT
  embed inline actions. Broken-rel → the panel's Relationships section (remove the link);
  unclassified → the Classification section (accept/dismiss); low-confidence → the Metadata
  section (inline edit / re-extract). This keeps governance **read-only / pure** with **no new
  write path** (SC#3). The interactive inline triage tray (accept/dismiss from the governance
  surface) is explicitly **NOT folded** here — see Deferred.

### Layout & sketch
- **D-119-7: Counter header + 3 stacked `HealthPanel` cards** (broken / unclassified /
  low-confidence), each a **paginated list with a positive empty state** ("all clear"). Matches
  the v3.0 "start as a few counters + lists" scope; mobile-stacks naturally; built directly on
  the Library Health primitives. **NOT** the Library-Health-style Tabs (one signal hidden at a
  time), and **NOT** a full charts/trends dashboard.
- **D-119-8: NO new G-2 sketch** — heavy reuse of the established HealthPanel visual is the
  acceptance bar (SC#1 scopes the phase to "reusing the `HealthPanel` card + paginated /
  actionable-empty-state patterns"). The roadmap deliberately did not mark 119 "(G-2 sketch)".
- **D-119-9 (LOCKED landmine): carry the `initializedTabsRef` infinite-fetch guard** into every
  paginated card. `KnowledgeHealthPage.tsx` (BUG-260516-02, fixed in 071.4) proved that a
  legitimately-empty API response + `items.length === 0` guard + `tabData` in deps = an endless
  re-fetch loop that shakes the UI. Use the `useRef<Set<key>>` initialized-tabs pattern
  (`KnowledgeHealthPage.tsx:237-251`), and clear it on Refresh.

### Claude's Discretion
- The "Governance" nav glyph and the exact h1/label wording (within "distinct from Library
  Health").
- The backend query shapes for each signal (a new `document_governance.py` router cloning the
  `knowledge_health.py` `_fetch_*` + `_pagination_params` + paginated-route shape) — including
  whether the three signals are three routes or one summary + three list routes.
- Whether the DM capability flag (DMF-03, Phase 110) gates the Governance nav entry the same way
  it gates the other DM surfaces — confirm during planning against how 113-118 wired the flag.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 119: Document Governance Health" — Goal, the 3 Success Criteria
  (DGOV-01/02 + UX-01), Depends-on (116 relationships, 118 classification, 111 confidence).
- `.planning/REQUIREMENTS.md` — DGOV-01/02 requirement text (lines ~67–68); the Deferred list
  ("Full governance dashboard (start as a few counters + lists)").

### The reuse target — the existing retrieval health surface (clone its patterns, NOT its data)
- `frontend/src/pages/KnowledgeHealthPage.tsx` — THE structural analog. Reuse: paginated-tab
  fetch shape, `HealthEmptyState variant="positive"`, `HealthDocumentRow`, `PaginationControls`,
  and **critically** the `initializedTabsRef` infinite-loop guard (lines 237-251, 389) — see
  D-119-9. **Do NOT bolt governance onto this page** (SC#1) — it is the *retrieval* dashboard.
- `frontend/src/components/health/` — `HealthPanel.tsx`, `HealthEmptyState.tsx`,
  `HealthDocumentRow.tsx`, `PaginationControls.tsx` (the card + empty-state + row + pager
  primitives to reuse for the 3 stacked cards).
- `backend/app/api/knowledge_health.py` — the router-clone target: per-signal `_fetch_*`
  functions + `_pagination_params` + `@router.get` paginated routes (e.g. `/low-confidence/...`,
  `/stale`). A new `document_governance.py` mirrors this shape over the DM tables.

### The navigation seam (D-119-2 — must own all three in-phase)
- `frontend/src/App.tsx:9` — the `ActiveView` union (extend with `"governance"`).
- `frontend/src/lib/nav-items.ts` — `NAV_ITEMS` (add the Governance entry; note the
  three-homes contract + distinct-glyph convention in the header comment).
- `frontend/src/components/layout/ChatLayout.tsx:294-301` — the `classification-rules` render
  branch is the exact template for the additive `governance` branch (before the trailing
  `KnowledgeHealthPage` else).

### The signal data sources (read-only aggregation under existing RLS)
- `backend/app/services/document_relationship_service.py` — `_resolve_readable_latest` +
  `_NO_ACCESS_MASK` (`is_latest`-gated own-or-global resolution). Broken-rel detection (D-119-3)
  reads here; distinguish "deleted/unresolvable" (broken) from "masked but present" (not broken).
- `backend/app/api/documents.py` (`ingest_document` ~`:1455`) — where Phase 118 writes
  `metadata._classification` (status `suggested`/`accepted`/`dismissed`); the unclassified
  signal (D-119-4) queries `status == "suggested"`. `POST /documents/{id}/reextract` exists as
  the low-confidence fix target.
- `frontend/src/components/metadata/ConfidenceChip.tsx` — `TIER = { HIGH: 0.75, MED: 0.5 }`;
  low-confidence (D-119-5) reuses `TIER.MED = 0.5` verbatim. `metadata._confidence[field]` is
  the per-field store (Phase 111/112).
- `frontend/src/components/metadata/DocumentDetailPanel.tsx` — the link target for every fix
  action (D-119-6): Metadata + Relationships (117) + Classification (118) sections.

### Carried-forward decisions from Phase 118 (the immediate predecessor)
- `.planning/phases/118-auto-classification/118-CONTEXT.md` — D-118-7 (triage tray deferred to
  119), D-118-2 (opt-in backfill sweep deferred candidate), the `metadata._classification`
  object shape (D-118-5), and the never-silent / reversible honesty discipline.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`KnowledgeHealthPage` + `frontend/src/components/health/*`** — the entire card / empty-state /
  row / pagination kit, plus the `initializedTabsRef` infinite-loop guard. The new Governance
  page is "Library Health, three different lists, read-only, link-out instead of inline-remove".
- **`knowledge_health.py` router** — `_fetch_*` + `_pagination_params` + paginated `@router.get`
  shape to clone into `document_governance.py`.
- **`document_relationship_service._resolve_readable_latest`** — already encodes own-or-global
  `is_latest` resolution + `_NO_ACCESS_MASK`; broken-rel detection reads it (deleted = no
  resolution; masked = present-but-hidden, NOT broken).
- **`ConfidenceChip` `TIER` + `metadata._confidence`** — the low-confidence threshold + per-field
  store, shared with the detail panel so "low" means the same thing everywhere.
- **`DocumentDetailPanel`** (Metadata/Relationships/Classification sections) — the single
  link-out target for all three fix actions.
- **`ActiveView` + `NAV_ITEMS` + `ChatLayout` branch** — the navigation triad to extend (own all
  three in-phase per D-119-2).

### Established Patterns
- **Top-level nav home, no-router `useState<ActiveView>` switch** (Phase 103 three-homes
  contract; Classification + Library Health) — Governance is a peer home, same wiring.
- **Read-only aggregation under existing RLS** — no new table, no new write path; the governance
  queries are owner-scoped reads over `document_relationships` / `documents.metadata`.
- **Positive/actionable empty states** (HLTH-01/02/03, Phase 049; `HealthEmptyState`) — "all
  clear" reads as a good state, not an error.
- **DM capability flag gating** (DMF-03, Phase 110; 113-118 wiring) — confirm the Governance
  surface + nav entry gate the same way.

### Integration Points
- New top-level surface: extend `ActiveView` (App.tsx:9) + add `NAV_ITEMS` entry (nav-items.ts)
  + add the `ChatLayout` render branch (~ChatLayout.tsx:294-301) — **all three, one plan**.
- New `backend/app/api/document_governance.py` router (clone `knowledge_health.py`) + `main.py`
  mount; owner-scoped reads only.
- The page links out to existing `DocumentDetailPanel` sections — no new write endpoints.

</code_context>

<specifics>
## Specific Ideas

- **"Light, lands-last" is the operative constraint** — this is a consumer surface that makes the
  upstream v3.0 work *legible*, not a new capability. Counters + lists, link-out, reuse — resist
  any urge to grow it into a full dashboard.
- **One honesty rule inherited from 118/112:** show the *real* provenance (matched-rule condition
  for classification; raw `_confidence` score for low-confidence; the actual broken target's
  filename) — never a fabricated score or status. Reuse `ConfidenceChip`'s honest tiering.
- **Distinct-from-Library-Health is a UX requirement, not a nicety** — the two surfaces answer
  different questions (is my retrieval working? vs. is my document structure healthy?). The name +
  glyph must make that obvious at a glance.
- **Cross-check directive (operator):** every option here was grounded against the shipped
  Documents page, Library Health, Classification page, and the relationship/confidence stores to
  avoid contradictions — downstream agents should keep that discipline (e.g. don't re-introduce a
  confidence threshold that disagrees with `ConfidenceChip`, don't treat masking as breakage).

</specifics>

<deferred>
## Deferred Ideas

- **Inline triage tray (D-118-7, *interactive* form)** — accept/dismiss a pending suggestion
  directly from the governance surface. 119 surfaces pending-suggestion docs as a *read* signal
  and links to the panel to act; the inline tray (still **no "Accept all"**, doc-by-doc through
  the same panel card) stays deferred. Revisit if link-out proves too slow at scale.
- **Opt-in backfill sweep (D-118-2)** — "run classification rules across existing docs now". A
  write path; contradicts the read-only governance scope. Stays deferred.
- **Full governance dashboard** — charts, trends, health-score gauge, history. v1 is counters +
  lists only (REQUIREMENTS Deferred list).
- **Tabs layout** — considered and rejected in favor of 3 stacked cards (D-119-7).
- **Configurable low-confidence threshold knob** — rejected (D-119-5) to stay consistent with
  112's hardcoded tiers.
- **Additional governance signals** (duplicates, stale-metadata, orphaned chunks, etc.) — out of
  scope for the DGOV-01 three-signal v1.

</deferred>

---

*Phase: 119-Document-Governance-Health*
*Context gathered: 2026-06-21*
