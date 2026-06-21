# Phase 119: Document Governance Health - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21
**Phase:** 119-Document-Governance-Health
**Areas discussed:** Signal definitions, Surface & nav, Fix actions, Layout/scope/sketch

**Operator directive (carried through all areas):** "make sure to cross-check with the existing
pages and avoid any contradiction." Every option below was grounded against the shipped Documents
page, Library Health (`KnowledgeHealthPage`), the Classification page, and the
relationship/confidence stores before being offered.

**Reported-bugs cross-check (MANDATORY touchpoint):** No `status: open` + `surface: Agentic-RAG`
report overlaps Phase 119's DM-governance domain (open ones are harness/streaming/provider-routing).
The three historically-relevant knowledge-health bugs — BUG-260516-02 (low-confidence infinite
fetch loop), `reingest-button-missing`, `document-status-not-realtime` — are all **closed** (folded
into 071.4). BUG-260516-02's `initializedTabsRef` fix is carried forward as a landmine-to-preserve
(D-119-9), not a reopened bug.

---

## Broken/dangling relationship definition

| Option | Description | Selected |
|--------|-------------|----------|
| Target fully deleted only | Edge whose target resolves to NO readable latest version; "(no access)" masking stays masking | ✓ |
| Also include no-access targets | Surface masked targets as broken too — risks conflating intentional mask with a break | |
| You decide | Defer the resolvability rule to research | |

**User's choice:** Target fully deleted only.
**Notes:** Preserves Phase 117 masking semantics; avoids leaking a cross-user existence signal.
Anchors on 116's `_resolve_readable_latest`. → D-119-3.

---

## Unclassified document definition

| Option | Description | Selected |
|--------|-------------|----------|
| Pending suggestion awaiting action | `metadata._classification.status == "suggested"` — the D-118-7 triage signal | ✓ |
| No folder (root/unfiled) | `folder_id IS NULL` — literal but noisy (many docs live at root) | |
| Both, as two sub-counts | Pending-suggestion docs AND no-folder docs as two rows | |

**User's choice:** Pending suggestion awaiting action.
**Notes:** Directly actionable; the read-side of the tray Phase 118 deferred here. → D-119-4.

---

## Low-confidence metadata threshold + scope

| Option | Description | Selected |
|--------|-------------|----------|
| Any field < 0.5 (reuse 112 tier) | Doc is low-confidence if ANY field `_confidence < 0.5` — reuses `ConfidenceChip` `TIER.MED` | ✓ |
| Any field < 0.75 (not "high") | Stricter; surfaces far more docs; noisy | |
| Configurable threshold | A settings knob — contradicts 112's "hardcoded, not a knob" | |

**User's choice:** Any field < 0.5 (reuse 112 tier).
**Notes:** Governance view and detail panel agree on what "low" means. → D-119-5.

---

## Surface & navigation (placement + name)

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level nav: "Governance" | New `ActiveView "governance"` + own icon, peer to Library Health; distinct name | ✓ |
| Top-level nav: "Document Health" | Same placement, named to contrast retrieval "Library Health" — risk of two "…Health" labels | |
| Section inside Documents page | A tab/panel in IngestionPage — but SC#1 wants its own surface and the page is already dense | |

**User's choice:** Top-level nav: "Governance".
**Notes:** Matches the Classification + Library Health top-level-home precedent. Plan must own
`ActiveView` + `ChatLayout` branch + `NAV_ITEMS` in-phase (the Phase 118 built-but-unreachable
lesson). → D-119-1, D-119-2.

---

## Fix actions (DGOV-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Link to the document's panel | Each row navigates to the detail panel's relevant section; read-only/pure, no new write path | ✓ |
| Hybrid: inline triage + link | Inline accept/dismiss for classification (the D-118-7 tray) + link for the rest | |
| Full inline actions | Accept/dismiss + remove link + re-extract all inline | |

**User's choice:** Link to the document's panel.
**Notes:** Keeps governance read-only (SC#3). The interactive inline triage tray stays deferred.
→ D-119-6.

---

## Layout + sketch (G-2)

| Option | Description | Selected |
|--------|-------------|----------|
| 3 stacked cards, reuse (no sketch) | Counter header + 3 stacked `HealthPanel` cards, paginated lists, positive empty states | ✓ |
| Tabs, reuse (no sketch) | Library-Health-style tabs, one signal at a time | |
| Sketch first (G-2) | Run /gsd:sketch before planning | |

**User's choice:** 3 stacked cards, reuse (no sketch).
**Notes:** Matches "few counters + lists" scope; mobile-stacks; built on Library Health primitives;
carry the `initializedTabsRef` infinite-loop guard. No new G-2 sketch (heavy reuse). → D-119-7/8/9.

---

## Claude's Discretion

- The "Governance" nav glyph + exact h1/label wording (within "distinct from Library Health").
- Backend query shapes per signal (new `document_governance.py` cloning `knowledge_health.py`);
  three routes vs. one summary + three list routes.
- Whether the DM capability flag (DMF-03) gates the Governance nav entry the same way as 113-118.
- The per-field low-confidence query mechanics (unnest vs. jsonb scan).

## Deferred Ideas

- Inline triage tray (D-118-7, interactive form) — read signal only in 119; inline accept/dismiss
  deferred.
- Opt-in backfill sweep (D-118-2) — a write path; contradicts read-only scope.
- Full governance dashboard (charts/trends/gauge) — v1 is counters + lists.
- Tabs layout — rejected for 3 stacked cards.
- Configurable low-confidence threshold — rejected for 112-consistency.
- Additional governance signals (duplicates, stale-metadata, orphaned chunks) — out of scope for
  the DGOV-01 three-signal v1.
