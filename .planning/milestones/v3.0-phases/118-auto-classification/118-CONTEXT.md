# Phase 118: Auto-Classification - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the now-richer metadata into **routing intelligence**: user-defined classification
rules (`metadata condition → suggested folder`) that, on upload, write a **non-destructive
suggestion** into `metadata._classification` — **never a silent auto-move**. The user
**accepts** (→ move + `classification.apply` audit, reversible) or **dismisses** (clears the
suggestion). Two surfaces ship:

1. **Suggestion UI** — on the document (row chip for one-glance accept/dismiss + the detail
   panel's reserved `Classification` accordion section for full matched-rule provenance).
2. **Classification rules surface** — a dedicated page reached from Documents (sidebar
   **Automation** group, peer to Folders + Views): rules list + right-side push/split builder.

Delivers CLASS-01 (define rules), CLASS-02 (suggestion on upload, never silent move),
CLASS-03 (accept/dismiss, reversible), and UX-01 (Deep Midnight / Aether, mobile-responsive,
WCAG 2.1 AA).

**Hard prerequisites already shipped:** Phase 111 (enriched metadata to match on),
Phase 110 (the `classification_rules` table + audit enum).
</domain>

<decisions>
## Implementation Decisions

### Action scope — folder vs tag
- **D-118-1: Folder-only v1; defer tags.** The `classification_rules` table has
  `suggest_folder_id` only, and the app has **no document-tags concept anywhere in the schema**
  (`grep -i tags supabase/full-schema.sql` → 0 matches). v1 suggests a **folder move only**;
  drop the 🏷 tag radio from sketch 037's builder (folder action only). Tags are a net-new
  feature (new column/table + UI) → **deferred** (see Deferred Ideas). Zero new classification
  schema needed for the action target.

### Existing documents / backfill
- **D-118-2: Preview-only, no backfill.** Rules fire **only on upload** (the `ingest_document`
  rule-eval pass). The builder's **"would match N of M" live preview** counts existing docs but
  does **NOT** retroactively suggest on them. Ship the honest inline line:
  *"existing docs aren't moved — rules suggest on new uploads only."* No backfill job, no
  "run across existing docs now" button in v1. Mirrors the Phase 114 no-re-extraction/no-backfill
  integration truth. (An opt-in backfill sweep is a deferred idea.)

### Multiple matching rules
- **D-118-3: First-match-wins → a single suggestion.** If 2+ enabled rules match one upload,
  evaluate deterministically and stop at the first match → exactly one suggestion object in
  `metadata._classification` (NOT an array). One accept/dismiss decision per doc. No rule
  priority/order UI in v1.
- **D-118-4: Deterministic eval order = owner-private rules first, then global; within each
  group, oldest `created_at` first.** Predictable, and prevents a global rule shadowing the
  user's own rule. (Planner may refine the exact ORDER BY, but the owner-before-global +
  stable-tiebreak intent is locked.)

### Suggestion data shape & lifecycle
- **D-118-5: `metadata._classification` = a single object**, e.g.
  `{ rule_id, rule_name, condition_summary, suggested_folder_id, suggested_folder_name,
  status: "suggested" }`. `condition_summary` is a human-readable rendering of the matched
  rule's condition (the **provenance** shown in the panel card — NO fabricated confidence %).
- **D-118-6: Accept is reversible.** Accepting records the document's **prior `folder_id`** so
  Undo moves it back; accept writes a `classification.apply` audit row (verified live) and
  performs the move, then clears/marks the suggestion. **Dismiss** just clears the suggestion.
  Both leave the rule itself untouched. The whole flow is reversible (CLASS-03).

### Review-at-scale (triage tray)
- **D-118-7: Defer the "N suggestions to review" tray to Phase 119 (Governance Health).**
  Ship 118 with the **on-doc** surfaces only (row chip + panel Classification card — sketch
  036-A primary). Phase 119 already surfaces unclassified / low-confidence docs with action
  links and is the natural home for doc-by-doc batch triage. (Keep the graft note: any future
  tray walks doc-by-doc through the **same** panel card, with **no "Accept all"** — every accept
  is individual with its own audit row.)

### Rule-eval safety (locked by SC#2 — carried, not re-decided)
- **D-118-8: Rule-matching reads are explicitly user-scoped in app code** — the rule-eval pass
  runs inside `ingest_document` (a BackgroundTask context with **no `auth.uid()`**), so it must
  filter rules by the uploader's `user_id` (owner rules) + `is_global` in Python, mirroring the
  leak-safe global-share pattern proven in Phases 113/115/117. A **global rule exposes its
  definition** but is evaluated against the **uploader's own** upload only.

### Claude's Discretion
- Exact `metadata._classification` key names and the `ORDER BY` tiebreak (within D-118-4/5 intent).
- Whether `match_expr` reuses the Phase 113 compiler verbatim or a thin classification-eval
  wrapper over it (researcher to confirm operator parity — see Canonical Refs).
- The precise placement of the rule-eval call site between metadata-build and persist in
  `ingest_document`.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 118: Auto-Classification" — Goal, the 4 Success Criteria
  (CLASS-01/02/03 + UX-01), Depends-on (111 metadata, 110 rules table).
- `.planning/REQUIREMENTS.md` — CLASS-01/02/03 requirement text (lines ~50–52).

### Operator-approved G-2 sketches (the acceptance bar for UX)
- `.planning/sketches/036-classification-suggestion/README.md` + `index.html` — Winner **A**
  (on-doc: row chip + panel card); honesty rules ("suggested ≠ moved", matched-rule provenance,
  audit receipt + reversible Undo); the **B-graft** = defer tray as secondary launcher only.
- `.planning/sketches/037-rule-builder-and-list/README.md` + `index.html` — Winner **A**
  (rules list + right-side push/split builder); chip-strip condition → action → scope segmented
  → live "would match N" preview; rule-row anatomy `● name [G] · condition → action · toggle · ⋯`;
  **open-question resolved by D-118-2** (preview-only).
- `.planning/sketches/MANIFEST.md` §"Phase 118 session" (+ entries #20, #25, #027) — the shared
  `DocumentDetailPanel` push/split shell that 112/117/118 all inhabit; sidebar collapse-to-rail.

### Substrate this phase builds on
- `supabase/migrations/071_dm_foundations.sql` §"2.3 classification_rules" — table shape
  (`match_expr jsonb`, `suggest_folder_id` ON DELETE SET NULL, `is_global`, `enabled`); A3
  decision rationale (rule survives folder delete). **No tag column** (confirms D-118-1).
- `backend/app/services/audit_service.py:13` (`VALID_ACTION_TYPES`) — `classification.apply` +
  `classification.rule.create` already present (Phase 110 forward-provisioned). Audit boot/CI
  drift-guard at lines 30–51.
- `backend/app/api/documents.py:1455` (`ingest_document`) — the metadata-build branch (Phase 111
  enriched/legacy at ~lines 40–124 from the def); the rule-eval pass inserts **between
  metadata-build and persist** per SC#2.
- `frontend/src/components/metadata/DocumentDetailPanel.tsx` — `PanelSection` accordion;
  Metadata section (112) + Relationships section (117). **118 adds a `Classification` section
  the same way** (the file's own header comment reserves the slot).
- `frontend/src/components/relationships/RelationshipsSection.tsx` (Phase 117) — the closest
  analog for a net-new `ClassificationSection` (owns its own fetch, lifts a count badge to the
  PanelSection).

### Reuse for the rule-condition compiler & leak-safe sharing
- Phase 113 filter-AST compiler (`backend/app/services/document_view_*` / the closed operator
  registry → `metadata @> $1::jsonb` parameterized compile) — `match_expr` is the same
  metadata-condition AST family; reuse the closed registry + field-whitelist + `$n` binding
  (no eval, no interpolation). Researcher: confirm operator parity. See
  `.planning/phases/113-*/113-RESEARCH.md` / `113-PATTERNS.md`.
- Phase 115 (`document_view_resolver.py`, leak-safe `resolve_filter`) + Phase 117 leak-mask
  pattern — the precedent for user-scoped reads + global-definition-but-own-scope-results.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`classification_rules` table** (migration 071): exists with RLS; `match_expr jsonb`,
  `suggest_folder_id`, `is_global`, `enabled`. **No migration needed for the action target**
  (folder-only v1) — possibly none at all for 118 unless a rules CRUD service needs an index.
- **Audit enum**: `classification.apply` + `classification.rule.create` already valid — no enum
  extension, no drift-guard change.
- **`DocumentDetailPanel` + `PanelSection`**: drop-in accordion slot for the Classification
  section; `RelationshipsSection` (117) is the structural copy-target.
- **ConfidenceChip / honest-state language** (112/028): reuse the honest-provenance grain —
  but classification shows **matched rule + condition**, never a confidence %.
- **Phase 113 filter-AST compiler + Phase 115 resolver**: the rule-condition evaluation engine
  and the leak-safe user-scoping pattern.
- **Sidebar NavRow + `G` global-pill + live-count** (031/114): the Automation group + rule-row
  scope pill + "would match N" preview reuse these.

### Established Patterns
- **Leak-safe global sharing** (113/115/117): global definition exposed, results/eval scoped to
  the viewer/uploader; cross-user miss returns 404-not-403. Applies to global rules (D-118-8).
- **Right-side push/split panel** (`minmax(0,1fr) <panel>`, no-router state-switch) authors
  document detail (027/112) AND workflow phase forms (103) → the rule **builder** uses the same
  shell (sketch 037-A).
- **Never silent / honest receipts** (098/102/104/112): "suggested ≠ moved", audit-only-after-
  write, reversible — same honesty discipline.
- **No-backfill on config change** (Phase 114): rules act forward-only on upload (D-118-2).

### Integration Points
- `ingest_document` (`documents.py:1455`) — net-new rule-eval pass between metadata-build and
  persist; writes `metadata._classification`; user-scoped rule read (no `auth.uid()`).
- A net-new `/classification-rules` CRUD router (clone the `document_view_service` / metadata-
  field-service shape; `is_global=false` hard-set on create unless explicitly global) + main.py
  mount.
- A net-new accept/dismiss endpoint (move + `classification.apply` audit + record prior folder
  for Undo; dismiss clears `_classification`).
- Frontend: net-new Classification-rules page + sidebar Automation group; `ClassificationSection`
  in the detail panel; row chip in `DocumentList`; the builder in the push/split panel.

</code_context>

<specifics>
## Specific Ideas

- **Load-bearing honesty (from the sketch intake):** a rule match is **deterministic** → show
  the matched rule + its condition as provenance, **never a fabricated confidence %** (the 028
  honesty principle applied to classification). "Suggested" must read **instantly** as *not yet
  moved*.
- **Row chip shape (036-A):** compact `→ folder ✓ ✕` on the list row for one-glance accept/
  dismiss; the full provenance card lives in the panel's Classification section.
- **Rule-row anatomy (037-A):** `● name [G] · condition (mono) → 📁 action · [toggle] · ⋯` —
  enabled dot green / disabled dim, `G` pill = global, toggle switch enables/disables live,
  kebab = edit/delete.
- **Builder flow (037-A):** chip-strip condition (`field op value` + ＋condition, AND) → action
  (📁 folder — tag radio dropped per D-118-1) → scope segmented (👤 Only me / 🌐 Global `G`) →
  live "would match N of M" preview with the forward-only honesty line.

</specifics>

<deferred>
## Deferred Ideas

- **Document tags / 🏷 tag suggestion action** — needs a net-new tags concept (column/table + UI)
  the app doesn't have today. Revisit as its own phase if tags become a product surface; then the
  classification rule action gains a tag target (D-118-1).
- **Opt-in backfill sweep** — an explicit "run this rule across existing docs now" one-shot
  suggestion pass over the existing corpus (still no auto-move). Deferred from D-118-2; candidate
  for Phase 119 Governance Health or a later enhancement.
- **"N suggestions to review" triage tray** — the secondary doc-by-doc launcher grafted from
  sketch 036-B. Deferred to **Phase 119 (Governance Health)** per D-118-7; must reuse the same
  panel card with **no "Accept all."**
- **Rule priority/ordering UI** — explicit user-controlled precedence beyond the
  owner-before-global + created_at default (D-118-3/4). Only if first-match-wins proves too blunt.

</deferred>

---

*Phase: 118-Auto-Classification*
*Context gathered: 2026-06-21*
