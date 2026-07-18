# Phase 154: Plain-Language Layer - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

> **Discuss mode:** Operator granted full autonomy ("identify grey areas as usual,
> then go with your comprehensive recommendation for each choice, proceed directly
> to planning + research, then execution — unattended, trust your judgement"). Gray
> areas below were identified and decided by Claude with a stated recommendation for
> each; no interactive selection. All decisions are Claude's best judgment, auditable
> in DISCUSSION-LOG.md.

<domain>
## Phase Boundary

Extend the two-audience contract — **plain-language labels by default, technical
vocabulary behind an advanced reveal** — across the app, as a **display-only**
frontend layer, without breaking any enum / API / audit contract (Pitfall 15) and
with Deep Mode byte-identical.

This phase GENERALIZES three already-shipped, operator-approved patterns into one
app-wide contract (SEED-085):
- **Phase 146** `⌥ Technical names` toggle + `showTechnical` (currently local
  `useState`, admin-only) — the global plain⇄technical flip.
- **Phase 103** `PhaseFormPanel` / `FieldLabel` / `HintDot` — plain label + an
  always-visible one-line helper + an inline `ⓘ` exposing the raw schema term
  (dense authoring forms).
- **Phase 124** two-door (Describe & run / Author & govern) — the strict↔loose
  disclosure precedent this pattern rhymes with.

**In scope:** a single-source term-map, an app-wide reveal context + a Settings
toggle, consolidation of the admin Control Room's local `showTechnical` onto that
context, and plain-language relabeling of a bounded, prioritized set of the
highest-jargon END-USER surfaces.

**Out of scope (redirect to deferred / other phases):** any backend / SSE / enum /
API / audit-action-name / DB-value rename (contract break — barred by SC#2);
server-side persistence of the preference (→ SEED-117, v3.4 config consolidation);
net-new admin-surface relabeling (146–149 were built plain-first, only consume the
shared context); accessibility fixes (→ Phase 155); nav/thread-list layout polish
(→ Phase 156 POLISH-01); any new capability, knob, or feature.
</domain>

<decisions>
## Implementation Decisions

### Reveal state — scope, persistence, audience (D-01)
- **D-01:** The app-wide reveal state lives in a NEW React context
  (`TechnicalNamesProvider` + `useTechnicalNames()`), persisted to `localStorage`
  **modeled on `frontend/src/hooks/useTheme.ts`** (the shipped app-wide-UI-preference
  analog). **Default OFF (plain language).** A **"Show technical names"** toggle
  exposed in **Settings**, available to **every user** — technical field/enum names
  are not secret, so NO operator/VIS-01 gate (VIS-01 gates *features*, not *labels*).
  SC#3 ("an operator/advanced user can flip the reveal") is satisfied by any user
  being able to flip it; it does not require restricting who can.
- **D-01a:** **Refactor `ControlRoomPage`'s local `showTechnical` `useState` to
  consume this ONE shared context** (the existing `TechnicalNamesToggle` control
  and `HealthSignals`/`CapabilityGrid`/`AuditTab`/`ModelRegistryTab`/`FeatureVisibility`
  props keep working, now reading the shared state). One source of truth ⇒ no drift
  between the admin toggle and the app-wide toggle. This is a consolidation, not a
  behavior change for the operator.
- **D-01b (rejected alternative):** server-side `user_settings.preferences` persistence
  — rejected for THIS phase because reviving `user_settings.preferences` is explicitly
  flagged v3.4 config-consolidation work (SEED-117) and would add schema/API surface
  that fights the "display-only, no contract break" invariant. A client localStorage
  preference is the correct, in-scope weight. Captured as a deferred idea.

### Single-source term-map (D-02)
- **D-02:** Build ONE glossary module — `frontend/src/lib/termMap.ts` — mapping each
  technical term/field/enum-display-key → `{ plain: string, helper?: string,
  technical: string }` (the SEED-085 "single source of truth: friendly label ↔ schema
  field ↔ one-line plain helper"). A tiny consumer — `usePlainLabel(key)` and/or a
  `<PlainLabel term=…/>` component — renders plain-or-technical by reading the D-01
  context. Every relabeled surface routes through the term-map so nothing drifts and
  future surfaces inherit the contract for free.
- **D-02a:** The term-map keys are **display concerns only**. They map a
  human-facing string; they NEVER replace the underlying enum value, API field name,
  or audit action string sent to / stored by the backend (see D-05).

### Reveal mechanism — global toggle vs inline ⓘ (D-03)
- **D-03:** The **global toggle is the PRIMARY app-wide mechanism** (flips all
  term-map labels between plain and technical at once — the Control-Room model, now
  app-wide). **Retain** the Phase 103 inline `ⓘ` + always-visible plain-helper in
  dense authoring forms (the Builder / `PhaseFormPanel`) where per-field guidance
  matters — both mechanisms read the same term-map. Do NOT rip out the ⓘ pattern; do
  NOT force an ⓘ onto every surface. Simple surfaces use the toggle; form surfaces
  keep the ⓘ+helper.

### Coverage boundary — what "app-wide" means for THIS phase (D-04)
- **D-04:** Deliver the **spine** (D-01 context + D-02 term-map + Settings toggle +
  D-01a admin consolidation) PLUS plain-language relabeling of a **bounded, prioritized
  set of the highest-jargon END-USER surfaces**. Candidate priority set (final list +
  concrete term inventory produced by the researcher during plan-phase):
  1. **Chat / composer** — mode labels (General / Explorer; any "Deep Mode" / "Harness"
     wording surfaced to users), run-surface vocabulary.
  2. **Workflow user surfaces** — Run modal (partly plain from 103/152), run surface,
     publish-gauntlet wording, workflow "soul".
  3. **Documents** — "chunks", "embeddings", "confidence", "metadata", extraction terms.
  4. **Settings** — provider / model / embedding jargon (where a real user reads it).
- **D-04a:** The **net-new v3.3 admin surfaces (146–149)** were built PLAIN-FIRST and
  already carry the ⌥ toggle — they are NOT relabeled here; they only migrate to
  **consume the shared D-01 context** (via D-01a). No admin re-copy work.
- **D-04b:** The researcher produces the concrete term inventory (grep the candidate
  surfaces for raw schema/enum terms) + the final ranked surface list; the planner
  scopes waves so the spine ships first, then surfaces attach to it. Scope stays
  BOUNDED — this phase establishes the contract + covers the worst offenders; the
  term-map makes later surfaces cheap. Uncovered surfaces are a documented follow-up,
  not a failure.

### Contract safety + frontend-only (D-05, locked constraint)
- **D-05:** **Frontend display-only. NO backend, NO migration, NO SSE-copy change,
  NO enum/API/audit-action rename.** The term-map maps DISPLAY strings only; underlying
  values (enum members, API field names, audit action names, DB columns) flow
  UNTOUCHED. Deep Mode is byte-identical **by construction** — the phase does not touch
  any backend or shared agent-loop path. The AuditTab already maps raw action → plain
  at the render layer; that stays the pattern (raw stored, plain displayed).
- **D-05a (verification approach):** verify no enum/const/API-key/audit-action string
  was renamed (grep diff of the changed files shows only DISPLAY strings + the new
  context/term-map/consumers changed); `threads.py` / `agent_loop.py` / gateway /
  migrations untouched (`git diff --name-only` shows zero backend files).

### Guardrail assessments (MANDATORY, CLAUDE.md)
- **G-2 (sketch-before-plan for UX):** **No new sketch required.** Phase 154 reuses
  THREE shipped, operator-approved visual patterns (the Phase 146 `⌥ Technical names`
  toggle, the Phase 103 `ⓘ`+helper, the Phase 124 two-door). The roadmap deliberately
  lists 154 as "UI hint" only and OMITS it from the G-2 sketch-gated set (146/147/148/149/152/153).
  Acceptance bar = "matches the existing ⌥ / ⓘ patterns pixel-consistently." Operator
  granted full autonomy to proceed. If any genuinely NEW visual surface emerges during
  planning, re-raise G-2 before building it.
- **G-5 (hot files):** `frontend/src/components/chat/MessageItem.tsx` and
  `frontend/src/providers/StreamsProvider.tsx` are G-5 hot files (last touched by 153).
  If a to-be-relabeled string lives in either, change ONLY the display string
  additively via the term-map — NO render/stream-logic edit; re-run their existing
  test suites as non-regression. Prefer relabeling in composer/ChatArea shells, not
  MessageItem internals.
- **G-3 (lightweight):** N/A — multi-file phase (spine + several surfaces).
- **G-6 (failure criteria upfront):** see `## How we'd know this failed` below.

### Reported-bugs cross-check (MANDATORY, CLAUDE.md)
- Swept `.planning/reported-bugs/*.md` for `status: open` AND `surface: Agentic-RAG`
  (15 reports). **None overlap the LANG-01 labeling/terminology domain** — all are
  streaming / provider / run-honesty / chat-display / layout bugs belonging to other
  phases (128-class, POLISH-01/156, provider-parity). **None folded.** Notably
  `setting-up-agent-hides-model-activity` (a chat-banner *honesty/timing* bug, not a
  *wording* bug) and `chat-list-too-narrow-nav-panel-crowding` (layout → POLISH-01)
  are display-adjacent but out of the LANG-01 domain — left open.

### How we'd know this failed (G-6)
- A relabel silently changed an underlying enum/API/audit value → a downstream API
  call, filter, or audit row breaks (contract break — the cardinal LANG-01 failure).
- Flipping "Show technical names" only affects the admin Control Room (state didn't go
  app-wide) OR flips some surfaces but not others (term-map not the single source).
- The preference doesn't persist across a page reload (localStorage wiring broken).
- Two toggles (admin + app-wide) disagree (D-01a consolidation missed).
- Deep Mode diffs from byte-identical (a backend file was touched — should be zero).
- A "plain" label is actually MORE confusing / inconsistent with the ⓘ raw term.

### Claude's Discretion
- Exact naming of the context/hook (`useTechnicalNames` vs `useAdvancedMode`),
  the localStorage key, and the `<PlainLabel>` API — planner/executor choose,
  consistent with `useTheme` + the existing `TechnicalNamesToggle` vocabulary.
- Final term-map key set + the ranked surface list within the D-04 boundary —
  researcher + planner decide from the live term inventory.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement + roadmap (this phase)
- `.planning/ROADMAP.md` §"Phase 154: Plain-Language Layer" — goal + 3 success criteria.
- `.planning/REQUIREMENTS.md` — LANG-01 row + "Out of Scope" (the "explicit from-your-docs labels" anti-feature is a sibling contract).
- `.planning/seeds/SEED-085-user-friendly-vs-admin-terminology.md` — the anchor seed: two-audience contract, single-source term-map, admin/advanced reveal.

### Shipped patterns to generalize (reuse — do NOT reinvent)
- `frontend/src/components/admin/TechnicalNamesToggle.tsx` — the `⌥ Technical names` control (prop-controlled leaf; keep it, feed it the shared context).
- `frontend/src/components/admin/ControlRoomPage.tsx` (≈L191–L218, L618+) — the current LOCAL `showTechnical` `useState` + how it threads to `HealthSignals`/`CapabilityGrid`/`AuditTab`/`ModelRegistryTab`/`FeatureVisibility` (the consolidation target, D-01a).
- `frontend/src/components/workflows/PhaseFormPanel.tsx` (`FieldLabel`, `HintDot`, `help`) — the Phase 103 plain-label + always-visible-helper + inline `ⓘ` raw-term pattern (retain per D-03; a term-map consumer model).
- `frontend/src/hooks/useTheme.ts` — the app-wide localStorage UI-preference model for D-01 (adapt into a Provider so all consumers share one state instance and flip in real time).

### Guardrail + convention
- `C:/Vibe Apps/Agentic RAG/CLAUDE.md` §"Workflow guardrails" (G-2/G-5) + §"Reported bugs cross-check" + the D-14 shared-path red line.

### Research (to be produced during plan-phase)
- `.planning/research/SUMMARY.md` — Glean/Beam plain-language framing (light on specifics; the concrete term inventory is a plan-phase research deliverable, not pre-existing).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`useTheme.ts`** — copy its localStorage-persist + hydrate shape into a
  `TechnicalNamesProvider`/`useTechnicalNames()` (add a Provider so state is shared
  app-wide, not per-hook).
- **`TechnicalNamesToggle.tsx`** — reuse verbatim; it's already prop-controlled
  (`enabled`+`onToggle`) — wire it to the context in both the Control Room and Settings.
- **`PhaseFormPanel.tsx` `FieldLabel`/`HintDot`** — the ⓘ+helper primitive to keep
  (D-03) and potentially generalize as a term-map consumer.
- **`AuditTab.tsx`** — already renders raw-action → plain via `showTechnical`; the
  reference for "raw stored, plain displayed" (D-05).

### Established Patterns
- Prop-drilled `showTechnical` from ControlRoomPage → leaves (to be replaced by
  context consumption, D-01a; the leaf prop signatures can stay).
- App-wide UI preference = localStorage + hydrate-on-mount (`useTheme`).
- Plain-first authoring form with reachable raw term (Phase 103).

### Integration Points
- Mount `TechnicalNamesProvider` high in the tree (App-level, alongside/near the
  existing providers) so chat, documents, workflows, settings, AND `/admin` all read it.
- Settings page (`frontend/src/pages/SettingsPage.tsx`) — home for the app-wide toggle.
- ControlRoomPage — swap local state for context (keep the inline toggle control).
</code_context>

<specifics>
## Specific Ideas

- SEED-085 verbatim shape: "a consistent plain-language default everywhere a real user
  touches, with the raw technical term available on demand (ⓘ / a 'show technical names'
  admin toggle)" + "a small glossary / term-map as the single source of truth (friendly
  label ↔ schema field ↔ one-line plain helper), so every surface renders consistently
  and nothing drifts." Phase 154 IS that generalization.
- Keep the existing `⌥ Technical names` vocabulary + control shape — consistency with
  the operator surface users may also encounter.
</specifics>

<deferred>
## Deferred Ideas

- **Server-side persistence of the reveal preference** (`user_settings.preferences`)
  → SEED-117 (v3.4 config consolidation). localStorage is the in-scope weight here.
- **Exhaustive app-wide term coverage** — Phase 154 covers the spine + highest-jargon
  surfaces; remaining low-traffic surfaces inherit the term-map cheaply later (a
  documented follow-up list, not this phase's bar).
- **Nav / thread-list layout & crowding** (`chat-list-too-narrow-nav-panel-crowding`)
  → Phase 156 POLISH-01.
- **Chat-banner honesty/timing** (`setting-up-agent-hides-model-activity`) → 128-class
  streaming/honesty work, not a wording fix.
- **Accessibility of the new toggle + relabeled surfaces** → Phase 155 (A11Y-01) audits
  all net-new v3.3 surfaces last, by design.

### Reviewed Todos (not folded)
None — no `todo.match-phase` matches surfaced for this phase.
</deferred>

---

*Phase: 154-plain-language-layer*
*Context gathered: 2026-07-15*
