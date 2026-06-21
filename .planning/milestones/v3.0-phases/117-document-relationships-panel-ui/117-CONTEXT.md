# Phase 117: Document Relationships — Panel UI - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a **Relationships accordion section** to the **existing** `DocumentDetailPanel`
shell (shipped in Phase 112) on the Documents page (`IngestionPage`). The section:

1. **Lists** a document's **outgoing + incoming** typed links — related filename + a
   rel-type chip — with **"linked document (no access)"** masking for targets the caller
   can't see.
2. Lets the user **create** a link (target picker + rel-type) and **remove** one,
   **reflecting changes live**.

Delivers **REL-02**. This is a **frontend feature phase** that **extends the Phase 112
shell — it does NOT build a new surface**. It also requires a **small net-new backend
read seam** (see D-117-7) because Phase 116 shipped only `POST`/`DELETE`, no REST read.

**No SPEC.md** — `.planning/ROADMAP.md` §"Phase 117" SC#1–3 are the authoritative
acceptance bar:
1. Detail view shows a relationship panel listing outgoing + incoming typed links (related
   filename + rel-type chip); inaccessible targets render as "linked document (no access)".
2. The panel supports creating a link (reusing the `MoveToFolderDialog` document-picker
   pattern for target selection) and removing one, reflecting changes live.
3. Matches the Deep Midnight / Aether design system, mobile-responsive, WCAG 2.1 AA
   (UX-01 cross-cutting acceptance).

**G-2 fires:** `/gsd:sketch` (operator-approved mockup of the **relationship panel**)
is required BEFORE `/gsd:plan-phase` (UX-02 cross-cutting acceptance). No relationship-
panel sketch exists yet — the next step after this CONTEXT is the sketch, not planning.

</domain>

<decisions>
## Implementation Decisions

### Create / remove model (Area 1)
- **D-117-1 (Create is outgoing-only):** The create form always authors an **outgoing**
  edge from the open document — `A [rel_type] → X`. The user picks a target X and one of
  the 4 types (`supersedes` / `amends` / `references` / `attached_to`), always read from
  A's perspective ("this supersedes X", "this is attached to X"). Matches the
  single-directed-edge model (D-116-7 — one stored row, inverse derived at read). To
  author "X supersedes A" the user opens X's panel. *Rejected:* a direction toggle
  (more expressive but adds a control + inverse-mapping to the create form for a rarely-
  needed authoring path); type-implied-direction framing (same effect, no added clarity).
- **D-117-2 (Remove works on either direction):** Any link **listed** in A's panel —
  outgoing OR incoming — has a remove control. Consistent posture: "if I can see it here,
  I can unlink it here." Both edges are the **same user's own rows** (the
  `document_relationships` table is user-scoped — migration 071), so the existing
  own-scoped `DELETE /document-relationships/{id}` permits removing an incoming edge from
  A's panel without issue. *Rejected:* remove-outgoing-only (symmetric with create, but
  leaves visible incoming links un-actionable — a worse experience).
  - **Note the deliberate asymmetry:** create is outgoing-only (simple authoring), remove
    is either-direction (consistent "see it → act on it"). This is intentional, not an
    oversight — lock it so reviewers don't "fix" it into symmetry.

### Target document picker (Area 2)
- **D-117-3 (Searchable typeahead, not a plain Select):** The target picker is a
  **searchable typeahead/combobox** — the user types to filter their **visible**
  documents by filename and picks one. The SC says "reuse the `MoveToFolderDialog`
  pattern"; we **keep its dialog + confirm shell** (Dialog → select target → confirm
  button → error line) but **replace its plain `Select`** (which only scales to a handful
  of folders) with a filterable input, because a document KB can hold hundreds/thousands
  of docs and a scroll-only Select is unusable at that size. *Rejected:* plain Select
  verbatim (matches the SC literally but breaks past ~30–40 docs); embedding the full
  `DocumentList` + `FilterBar` (most powerful, but heavy to embed and overkill for picking
  one target).
- **D-117-4 (Candidate list hides self + already-linked):** The typeahead excludes the
  **current document** (a self-link is blocked by the `no_self_rel` CHECK + the create
  endpoint's uniform 422 anyway) AND any document **already linked to it with the chosen
  `rel_type`**, so every choice in the list is actionable (no redundant picks). The
  backend's idempotent-create (D-116-6) is the safety net if a stale candidate slips
  through — the UI exclusion is for clarity, not correctness. *Rejected:* hide-self-only
  (simpler, leans entirely on idempotency, but lets the user pick an already-linked doc
  and wonder why nothing changed).

### Section layout & labels (Area 3 — feeds the G-2 sketch; sketch finalizes visuals)
- **D-117-5 (Grouped by direction):** The section renders **two labeled subgroups** —
  **Outgoing** (`A → X`) then **Incoming** (`Y → A`) — each row showing the related
  filename + a rel-type chip. This mirrors how the data is fetched (outgoing/incoming
  queries) and makes the create/remove asymmetry (D-117-1/2) legible. *Rejected:* one
  flat list with a per-row direction cue (denser, but direction reads weaker); grouped-by-
  rel-type (reads by meaning, but splits the create/remove asymmetry across groups).
- **D-117-6 (Incoming rows use inverse labels):** Outgoing chips show the `rel_type`
  verbatim ("Supersedes"); **incoming chips use the inverse label** ("Superseded by", etc.)
  drawn from the **same vocabulary the backend already defines** —
  `tool_dispatcher._INVERSE_LABEL` (`supersedes→superseded_by`, `amends→amended_by`,
  `references→referenced_by`, `attached_to→has_attachment`). Single source of truth for
  the wording — the frontend mirrors the backend's `label`/`direction` fields, never
  invents its own phrasing. **The sketch may refine the exact display strings/casing.**

### Backend read seam — the net-new work this phase carries (researcher MUST own)
- **D-117-7 (Net-new REST read endpoint — share, do NOT fork the leak-safe read):**
  Phase 116 shipped **only** `POST` (create) + `DELETE` (remove) — **there is no REST
  read endpoint.** The complete leak-safe read traversal (outgoing + incoming over the
  subject's full `(user_id, filename)` version-id set, **follow-to-latest**, per-endpoint
  **caller-readability re-check** → mask unseeable as "linked document (no access)") lives
  **only** inside the agent-tool handler `_handle_get_related_documents`
  (`tool_dispatcher.py:492-649`). The panel cannot call an agent tool. **Decision (policy
  LOCKED):** add a **net-new authenticated `GET` endpoint** for the panel, and **extract
  the read traversal into the shared `document_relationship_service`** so the agent tool
  AND the new REST route call **one source of truth** — mirroring how Phase 115 extracted
  `resolve_filter` → `document_view_resolver.py`. **Never duplicate the leak-safe read
  into the route** (drift would re-open the SC#2 leak). The exact **route shape** (e.g.
  `GET /document-relationships?document_id=...` vs `GET /documents/{id}/relationships`),
  the **response model** (subject + outgoing[]/incoming[] compact rows + masked entries),
  and the **extraction mechanism** are **researcher/planner discretion** within this
  policy. **`threads.py` untouched** (G-5 extension contract).
- **D-117-8 (Leak-safe masking reaffirmed — verify LIVE):** A link whose target the
  caller can't see renders as **"linked document (no access)"** with `document_id: null` —
  never the title/id/metadata (carried from D-116-9). The per-viewer readability re-check
  is the SOLE access gate (relationships are whole-KB, own-scoped; `folder_subtree_ids` is
  NOT threaded). **Verify the two-user leak LIVE in secure-phase**, not via the RLS label
  (the D-102/D-110-5 "static would false-green" lesson; reaffirmed by 113/115/116).

### Live update & honest states (Area 4)
- **D-117-9 (Re-fetch on mutation, not optimistic):** After a successful create or remove,
  **re-fetch the relationships list for the open document** and re-render. Matches Phase
  112's reconcile posture (Realtime is best-effort — D-v2.5-03) and is the **most honest**:
  the UI shows exactly what the server returns, including follow-to-latest resolution,
  inverse labels, and "no access" masking — none of which an optimistic row can compute
  correctly. *Rejected:* optimistic-insert-then-reconcile (snappier, but the optimistic
  row would briefly mis-render direction/label/masking before the reconcile corrects it —
  dishonest flicker on a trust-load-bearing surface).
- **D-117-10 (Honest state set — 112 precedent):** The section renders honest states:
  **empty** → "No relationships yet" + a create affordance; **loading** → skeleton/quiet
  loading (not a layout jump); **error** → honest "couldn't load relationships" (never a
  silent empty that reads as "no links"); **no-access** → "linked document (no access)"
  (D-117-8). The create dialog has its own error line (MoveToFolderDialog shape) and a
  disabled-until-valid confirm. Exact copy/skeleton design = sketch + planner discretion.

### No DM feature-flag UI gate (consistent with prior DM phases)
- **D-117-11 (No `document_management_enabled` UI gate added here):** The flag exists in
  `app_settings` (`user_settings.py:137`, default `True`) but is **enforced nowhere in the
  frontend** — Phases 112/113/114 all shipped their DM surfaces ungated, and 116
  explicitly declined to add a backend gate. There is **no UI gating pattern to follow**,
  so 117 does **not** introduce one (introducing a gate on just this section would be
  inconsistent and out of scope). If product wants UI gating of all DM surfaces, that is
  its own cross-cutting phase.

### Claude's / Researcher's Discretion
- The **route shape + response model + extraction mechanism** for the read seam (D-117-7).
- The **data source** for the typeahead candidates (reuse an existing documents fetch vs a
  filename-filtered list endpoint) and where the **self/already-linked exclusion** (D-117-4)
  is computed (client filter vs server param) — pick the least-complex correct option.
- Exact **copy** for empty/error states, **skeleton** design, **chip** styling, the
  section **count/warn badge** (PanelSection supports one — optional), and the **create
  dialog's mobile** behavior (bottom-sheet vs centered dialog) — all subject to the G-2
  sketch.
- Whether incoming-row **inverse-label display strings** are title-cased / spaced from the
  backend snake_case (`superseded_by` → "Superseded by") in the frontend or surfaced
  pre-formatted by the read endpoint (D-117-6).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & success criteria (read FIRST — no SPEC.md for this phase)
- `.planning/ROADMAP.md` §"Phase 117: Document Relationships — Panel UI" — authoritative
  goal, REL-02, SC#1–3 (list outgoing+incoming + no-access masking; create via
  `MoveToFolderDialog` pattern + remove + live reflection; Deep Midnight / mobile / WCAG
  2.1 AA), and the **G-2 sketch** requirement.
- `.planning/REQUIREMENTS.md` — REL-02 (this phase); REL-01/03/04 (Phase 116, done) for
  the backend contract this UI sits on; UX-01 (design/a11y) + UX-02 (G-2 sketch gate).

### The immediate predecessor — the backend this UI consumes (read before touching)
- `.planning/phases/116-document-relationships-backend-agent-tool/116-CONTEXT.md` — the
  full relationship backend model: D-116-1 (follow-to-latest), D-116-2 (both directions +
  inverse labels), D-116-5/6/7 (visible-both create gate, idempotent, single directed
  edge), D-116-9 (leak-safe "no access" masking — the SC#2 invariant 117 surfaces).
- `backend/app/api/document_relationships.py` — the **live write surface** the panel calls:
  `POST ""` (visible-both gate → idempotent persist → `relationship.create` audit) and
  `DELETE /{relationship_id}` (own-scoped, uniform 404, `relationship.delete` audit).
  **No GET here yet** — D-117-7 adds it.
- `backend/app/services/document_relationship_service.py` — `_resolve_readable_latest`,
  `_subject_version_ids`, `_uid`, `create_relationship`, `delete_relationship`. **The
  extraction target for D-117-7** (add a shared `get_related_documents`-style read fn here).
- `backend/app/services/tool_dispatcher.py:492-649` `_handle_get_related_documents` +
  `_INVERSE_LABEL` (~line 478) + `_NO_ACCESS_MASK` (~line 489) — **the canonical leak-safe read logic
  to extract/share** (D-117-7) and the **inverse-label vocabulary** the chips reuse
  (D-117-6). Do NOT re-derive this — extract it.

### The shell this section plugs into (Phase 112)
- `frontend/src/components/metadata/DocumentDetailPanel.tsx` — the shared right-side
  push/split panel; add the **Relationships `PanelSection`** alongside the existing
  Metadata section (the shell reserves this slot). Reuse its mobile bottom-sheet shape,
  panel-scoped AA tokens, focus management, and `onReconcile` re-fetch pattern.
- `.planning/phases/112-metadata-enrichment-document-detail-panel-manual-edit/112-CONTEXT.md`
  — the panel shell contract (D-01 entry point, honest-states posture, panel-scoped AA
  tokens, `onReconcile` reconcile-after-edit) 117 mirrors.
- `frontend/src/components/panel/PanelSection.tsx` — the accordion shell + warn/count
  badge the Relationships section reuses.

### Design contract (G-2 — sketch is the NEXT step, not yet done)
- `.claude/skills/sketch-findings-agentic-rag/references/document-detail-panel.md` §"Phase
  117" (lines ~24, ~123-127) — the shell reserves the `Relationships` accordion section;
  reuse `MoveToFolderDialog` for the target picker; **extend this shell, not a new
  surface**. The 117 sketch extends THIS findings file.
- `.claude/skills/sketch-findings-agentic-rag/references/documents-page-composition.md` —
  Documents-page composition the panel lives within.
- Invoke `Skill("sketch-findings-agentic-rag")` before any UI implementation (project
  CLAUDE.md auto-load rule for the document detail panel surface).

### The picker pattern (SC#2 reference)
- `frontend/src/components/health/MoveToFolderDialog.tsx` — the dialog + confirm + error-
  line shell to reuse; replace its plain `Select` with a searchable typeahead (D-117-3).

### UAT / cross-cutting
- `CLAUDE.md` §"UAT scoreboard recipe" — **SC#10 4-axis cross-provider UAT does NOT apply
  here** (this phase does NOT touch streaming, the agent loop, or provider routing — same
  reasoning as Phase 112's D-08). Acceptance = **G-4 lived-experience UI UAT** (open panel
  → see outgoing/incoming + masked rows → create via typeahead → remove → live re-fetch;
  two-user leak proof LIVE) + **WCAG 2.1 AA** + the honest-states matrix.
- `CLAUDE.md` §"Workflow guardrails" G-2 — sketch-before-plan for this UX phase (fires).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`DocumentDetailPanel.tsx` shell** — add a Relationships `PanelSection`; reuse its
  `useIsMobile` bottom-sheet, panel-scoped AA tokens (`--panel-*`), close/focus handling,
  and the `onReconcile` re-fetch hook (D-117-9 re-fetch fits this exactly).
- **`PanelSection.tsx`** — APG accordion + warn/count badge for the section header.
- **`MoveToFolderDialog.tsx`** — the dialog + confirm + error-line shell for the create
  flow; swap its `Select` for a typeahead (D-117-3).
- **`document_relationship_service.py`** (`_resolve_readable_latest`, `_subject_version_ids`,
  `delete_relationship`) — the leak-safe read primitives to **extract + share** (D-117-7).
- **`tool_dispatcher._handle_get_related_documents` + `_INVERSE_LABEL` + `_NO_ACCESS_MASK`**
  — the canonical read traversal + inverse vocabulary + mask string to reuse, not re-derive.
- **`document_relationships` REST router** (`POST`/`DELETE`) — the live write surface; the
  panel's create/remove call these directly.

### Established Patterns
- **G-5 extension contract** — net-new = one shared read fn + one `GET` route + frontend;
  `threads.py` untouched (this phase never touches the shared SSE/agent-loop path).
- **Per-viewer leak-safe read; "no access" masking; not-found-not-403** (D-113-4 / D-115-6 /
  D-116-9) — verified LIVE in secure-phase, not via the RLS label.
- **`run_in_threadpool` / `aexec`** around every sync `supabase-py` call in async routes
  (D-v2.5-01) — applies to the new `GET` route.
- **Reconcile after mutation; Realtime is best-effort** (D-v2.5-03) — re-fetch on
  create/remove (D-117-9), the same posture as 112's metadata edit.
- **Honest states / no-green-without-truth** — empty vs error are distinct; masked targets
  never leak (112/116 honesty posture).
- **One UX, N adapters** — no per-provider branch; this is a pure REST + frontend surface.

### Integration Points
- New shared read fn in `document_relationship_service.py` + a new `GET` route in (or
  mounted alongside) `document_relationships.py` (router already mounted in `main.py`).
- New `frontend/src/lib/api.ts` client fns: `listRelationships`/`getRelated`,
  `createRelationship`, `deleteRelationship` (none exist yet) + matching `types.ts` types.
- New Relationships `PanelSection` inside `DocumentDetailPanel.tsx` + a create dialog
  component (typeahead) reusing the `MoveToFolderDialog` shell.

</code_context>

<specifics>
## Specific Ideas

- **Extend the shell, never a new surface** — the Relationships section is one more
  accordion in the Phase 112 `DocumentDetailPanel`; the sketch reserves the slot.
- **Honesty + leak-safety are load-bearing** (carried from 112/116) — "linked document
  (no access)" masking with no id leak; re-fetch (not optimistic) so the UI shows the
  server's truth (follow-to-latest, inverse labels, masking); empty ≠ error.
- **Share the read, don't fork it** — the leak-safe traversal must have ONE
  implementation (extracted into the service), called by both the agent tool and the new
  panel GET, or the SC#2 leak invariant will drift (the 115 `resolve_filter` precedent).
- **Deliberate create/remove asymmetry** — outgoing-only create, either-direction remove;
  intentional, lock it against "fix to symmetry" reviews.
- **G-2 sketch is the gate** — the relationship panel needs an operator-approved mockup
  before planning; this CONTEXT constrains that sketch (grouped-by-direction, typeahead
  picker, inverse labels) but the sketch finalizes the visuals.

</specifics>

<deferred>
## Deferred Ideas

- **Direction toggle in the create form** (author "X supersedes A" from A's panel) —
  rejected for v1 (D-117-1); revisit only if users report the open-the-other-doc detour
  is painful.
- **Relationship graph visualization** — explicitly out of v3.0 Tier A scope
  (REQUIREMENTS §"Out of scope": "Tier A ships a list/panel; a visual graph is later").
- **Agent-driven create/remove of relationships** — deferred at 116 (D-116-8); the agent
  stays read-only (`get_related_documents`); humans curate via this panel.
- **Versions accordion section** in the detail panel — separate later work (112 deferred);
  not this phase.
- **DM feature-flag UI gating of all DM surfaces** — the flag exists but is UI-enforced
  nowhere (D-117-11); a cross-cutting gating phase if product wants it, not here.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` — surfaced by `todo.match-phase 117` at score **0.2**
  (matched only the word "before"); it is the NL→workflow-authoring spike, entirely
  off-domain from document relationships. **Not folded.**

</deferred>

---

*Phase: 117-document-relationships-panel-ui*
*Context gathered: 2026-06-20*
