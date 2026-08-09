# Requirements: v3.6 Visual / No-Code Workflow Studio

**Defined:** 2026-07-24
**Core Value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.
**Milestone goal:** Add a drag-and-drop visual authoring + live-run observability layer ON TOP of the existing governed harness workflow engine, so a non-technical business user can *draw their own process* and watch it run — without losing the engine's governance rails. Build ON what exists; NOT an engine rewrite.

> **Convention:** this project ships **CORE** (committed) + **STRETCH** (gated behind CORE — ship only if CORE lands clean and budget remains; v2.9 105-109 / v3.1 125-131 / v3.2 138-144 / v3.3 156-159 / v3.4 169-173 / v3.5 178-180 precedent).
> **Research base:** `.planning/research/SUMMARY.md` (+ STACK / FEATURES / ARCHITECTURE / PITFALLS). Confidence HIGH; four researchers converged on the same shape and build order.
> **Operator scoping calls (2026-07-24):** connector depth = *governed node model CORE + thin live demo slice STRETCH*; CORE = revert→run-viz + concurrency, STRETCH = live connectors + scale.
> **Deep competitor crawl (2026-07-24 — Beam / Glean / n8n, `.planning/research/deep-dive/`):** confirmed NONE grade strictness by KB-grounding — the operator's *strict-when-grounded / flexible-when-open* rule is category white-space → added a first-class **GOVERN** category (two per-node dials: grounding-strictness + action-risk) as a **dedicated CORE phase**. n8n SSRF-CVE lessons sharpen CONN-03.

## CORE Requirements (committed)

### REVERT — the tested off-switch (operator HARD gate #1)

- [x] **REVERT-01**: An operator can turn the entire visual canvas layer on/off via a new governed feature key (`visual_workflow_canvas`, default off) — the nav entry and every canvas route are gated (the shipped v3.3 `skill_studio` / feature-visibility pattern); the two existing authoring doors and the engine are untouched when off.
- [x] **REVERT-02**: With the flag off, the product is provably byte-identical to today — a `test_revert_byte_identical` gate (CI + live milestone-close) asserts the existing "Describe & run" / "Author & govern" doors and the run surface are unchanged. Revertibility is a tested acceptance gate, not a prose claim (extends the standing D-14 red line).

### VALID — the anti-drift governance seam (the differentiator)

- [x] **VALID-01**: The server exposes `POST /workflows/validate` that reuses the existing `reachability.lint_workflow` + grounding-fidelity checks verbatim — the single source of validation truth; the canvas never re-implements the rules client-side.
- [x] **VALID-02**: A user editing on the canvas is prevented from drawing a **structurally** invalid workflow — reachability / tool-whitelist / gate-wiring violations surface live *as the canvas is built* ("you cannot draw an invalid workflow"). *(Headline differentiator — no competitor validates the flow at author-time.)* Per-node grounding *strictness* is layered on top by GOVERN (graded, not blanket).
- [x] **VALID-03**: A user sees per-node validation status (badges / inline errors) derived from the server verdict, never from a client-side guess.

### CANVAS — the visual authoring surface

- [x] **CANVAS-01**: A user can view an existing workflow as a visual node canvas — a read-only projection of its `WorkflowDefinition` (nodes = phases, edges = flow + `skip_to_phase` branches), rendered via `@xyflow/react`.
- [x] **CANVAS-02**: A user can add, move, connect, and delete phase-nodes; edits round-trip losslessly back to `WorkflowDefinition` (one client serializer) and save through the **existing** draft CRUD (create-once-then-PATCH). Node layout/positions are kept OUT of the immutable definition JSONB.
- [x] **CANVAS-03**: A user can configure a selected node in a side panel, backed by the existing `PhaseConfig` discriminated-union schema (Pydantic stays authoritative).
- [x] **CANVAS-04**: The canvas expresses governance as visible rails — locked phase order, per-phase tool whitelists, and validation gates the user cannot wire around (governance rendered, never removed). The rails are **graded** per GOVERN — strict on grounded nodes, flexible on open agentic nodes.

### GOVERN — graded per-node governance (the deep-crawl differentiator)

*Deep competitor crawl (Beam / Glean / n8n) confirmed NONE grade strictness by KB-grounding — category white-space, buildable directly on the existing validation-gate library. The concrete "governed ↔ flexible" reconciliation SEED-123 names: **KB-retrieval is what turns strictness ON.***

- [x] **GOVERN-01**: Each node carries a **grounding mode** — *Grounded / strict* auto-attaches the immutable `citations_required` **coverage** gate (every value traceable to a retrieved source, zero invented citations, else fail / route to HITL) vs *Open / flexible* (an open agentic / reasoning / tool step, NOT gated on KB citation). A single workflow can freely MIX strict-grounded and open nodes; on a grounded node the strict gate is structurally enforced and NOT author-loosenable-away. Additive to the engine — Deep byte-identical when unset (D-14). *(Amended 2026-07-28 at `/gsd:spec-phase 185`: the original wording said "`citations_required` + confidence gate … above the confidence threshold". The engine has no confidence concept — no threshold, no score, no source of a score (`grep -rn confidence backend/app/services/harness/ backend/app/models/harness.py` → nothing). The shipped gate is deterministic coverage via `check_coverage`. Operator decision: drop the word rather than invent the concept. See `185-SPEC.md`.)*
- [x] **GOVERN-02**: The canvas visibly marks each node's governance state (grounded-strict-cited vs open-flexible), so a business user can see which steps are trustworthy/cited vs exploratory; the "can't draw an unsafe workflow" rails apply **graded** — enforced on grounded nodes, relaxed on open ones.
- [x] **GOVERN-03**: Each node can carry an **action-risk** checkpoint — an outbound / write / external-action node gets an approval / human-in-the-loop gate before it executes, built on the existing `llm_human_input` phase-type substrate (the second orthogonal dial, adopted from Beam's per-node consent pattern).

### VOCAB — approachability for business users

- [x] **VOCAB-01**: A business user sees plain-language node names/verbs ("Find documents", "Ask the AI", "Get approval", "Produce a report") with a Technical-names reveal — extends the v3.3 LANG-01 plain-language layer + SEED-085 terminology split.
- [x] **VOCAB-02**: A user can describe a workflow in natural language and get a seeded, editable canvas draft (wires the existing NL generator, SEED-051, onto the canvas) — and the AI seed structurally cannot emit an unsafe node (the response schema IS the `extra="forbid"` union).
- [x] **VOCAB-03**: A user can start from a template / starter flow on the canvas (reuses the shipped Starter Workflow Library).

### RUNVIZ — non-technical live run observability

- [ ] **RUNVIZ-01**: A non-technical user can watch a workflow run on the canvas — each node shows live state (pending / active / passed / failed / skipped / waiting-for-you) painted from the same `usePhases(threadId)` run stream the developer `PhaseTimeline` uses (one run stream, two views; no new Redis events, no new demux).
- [ ] **RUNVIZ-02**: The canvas run view is honest — node state is a total function over the FULL event set (never shows "done" on a `gate_failed` / `run_failed`) and reconciles-on-fetch at every reconnect (Realtime is a hint, not truth — D-v2.5-03).
- [ ] **RUNVIZ-03**: A workflow run and its finished deliverable have **their own home** — launching a workflow stops redirecting into Chat, a run stays retrievable *after the fact* (not only while it streams), and the produced artefact is reachable **from the run** rather than only from a live panel. *(Added 2026-07-31 from the operator call after Phase 185 UAT: "a workflow that is RUNNING, and its output, should have their own place — not be dumped into chat." Verified 2026-07-31 in code, not assumed: `frontend/src/pages/WorkflowsPage.tsx` never owns a run route — it calls `onLaunch` = `ChatLayout.doRun` (`ChatLayout.tsx:233`, wired at `:596`), which creates a thread, kicks the run, and redirects into Chat; the page's own docblock states it verbatim — "Run creates a NEW chat thread + kicks off a REAL server-side run … + redirects into Chat" (`WorkflowsPage.tsx:9-13`). This is NOT already covered by RUNVIZ-01/02: those govern the run VIEW's live per-node state (`usePhases(threadId)`, total-function state, reconcile-on-fetch, cross-provider parity) and none of their success criteria mentions the launch redirect, the message list, the composer, or where the finished deliverable lands. Design evidence — explicitly disclaimed as a commitment by its author: `.planning/sketches/145-the-review-moment/README.md` proposes a dedicated run surface with its own header and spine, **no message list and no composer**. Supersedes SEED-051's "Execution = in a thread … NO separate execution route" and re-opens D-094-UNIFY for workflow-run artefacts — see the dated notes appended to both seeds.)*

### CONCUR — safe co-edit (v3.4 made workflows org-shareable)

- [x] **CONCUR-01**: Editing a draft on the canvas autosaves by updating the draft row in place — a cosmetic node drag never mints a new definition version or re-arms the golden-run gauntlet.
- [x] **CONCUR-02**: Two people editing the same org-shared workflow cannot silently clobber each other — a concurrency guard (soft-lock / optimistic-concurrency token) protects the shared draft; publish is guarded against reading a dirty draft.

### CONN — external-integration node model (operator HARD gate #3, CORE half)

- [x] **CONN-01**: A user can place a governed **external-action node** on the canvas whose capabilities ride the existing per-phase tool-whitelist guard (an MCP-backed node model — zero new governance concept); the milestone **records the own-framework-vs-Open-Platform decision** (research verdict: MCP-first, first-party-thin, broad catalog sequenced with Open Platform SEED-013/014). CORE ships the governed node vocabulary + the recorded decision — no live outbound egress (that is CONN-02/03, STRETCH).

## STRETCH Requirements (gated behind CORE)

### CONN — thin live connector slice (operator HARD gate #3, live-proof half)

- [ ] **CONN-02**: A user can run 2–3 first-party **live** connectors from a workflow — email out, JIRA/ticket create, Slack notify — as the demo-able external-integration proof (MCP-backed action nodes). Broad catalog / inbound webhooks / public API sequence with Open Platform (SEED-013), NOT forked into v3.6.
- [ ] **CONN-03**: Every connector outbound is secured — an unconditional SSRF / egress allow-list guard on every outbound fetch *regardless of credential state* (avoids the n8n "guarded only when a credential is attached" CVE class; the sibling "authenticated ≠ safe" RCE class → sandbox all expression/template evaluation, NO arbitrary-code node on a business canvas), org-scoped Fernet-encrypted credentials resolved server-side by reference (never in the definition JSONB or the client), and a dedicated cross-org credential-leak test. Rides with CONN-02; mandatory `/gsd:secure-phase` (`threats_open: 0`).

### SCALE — conditional hardening

- [ ] **SCALE-01**: The canvas stays responsive at scale — React Flow `onlyRenderVisibleElements` + node memoization if node counts exceed ~100–150, `elkjs` auto-layout only if run-viz must depict `llm_batch_agents` fan-out as a branching layout, and indexed org-scoped Workflows-list reads at many-orgs × many-workflows scale. Ship only if a real workflow or org fan-out exceeds the expected small scale.

## Future Requirements (deferred — → Open Platform milestone, SEED-013/014)

- **OPEN-01**: Broad connector catalog (many providers), a connector marketplace, and per-connector auth flows beyond the first-party few.
- **OPEN-02**: Inbound webhooks / event triggers that START a workflow from an external system.
- **OPEN-03**: Public REST API + MCP server + service accounts (the app-as-integration-target half of the Open Platform).
- **OPEN-04**: Real-time collaborative multi-cursor canvas editing (CRDT/OT) — heavy infra; soft-lock (CONCUR-02) is the v3.6 cut.
- **OPEN-05**: Free-placement node-layout persistence (`workflow_layouts` side table) — only if a sketch/discuss pass confirms deterministic auto-layout is insufficient; otherwise auto-layout only (zero migration). *(Sketch-conditional on Phase 184.)*

## Out of Scope

Explicitly excluded. Anti-features from research documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Free-form drag-anything-to-anything DAG canvas | The field's recurring failure ("becomes confusing / too crowded") AND it would let a business user compose an ungoverned/unsafe flow — constrain to the engine's linear phase-spine grammar. |
| Bespoke 275/400-app connector catalog built inside v3.6 | A "forever-maintenance job" (SEED-013) — adopt MCP as the substrate + sequence breadth with Open Platform; v3.6 ships a governed node model + a thin live proof only. |
| Raw code / custom-script node on the business canvas | Keep arbitrary code inside the sandboxed `execute_code` phase — a business canvas must not become a code editor. |
| User-facing "autonomy level" slider that loosens governance | Wrong for a governed builder (Beam ships one); our governance is structural, not a dial. |
| A second / parallel run-execution route or runtime for the visual layer | Violates the D-14 red line — the harness engine stays the ONLY executor; the canvas is a projection, not a runtime. |
| Replacing the two existing authoring doors ("Describe & run" / "Author & govern") | Operator HARD gate #1 — both doors stay untouched and flag-revertible; the canvas is a THIRD door. |
| LangGraph / LangChain / Flowise / n8n as an embedded runtime | Violates the raw-SDK rule and forks the runtime the harness engine already owns (study their UX only). |
| tldraw as the canvas library | Non-MIT SDK license + mandatory production watermark — `@xyflow/react` (MIT) is the pick. |

## Traceability

Which phases cover which requirements. Filled at roadmap creation 2026-07-24, revised same day after the deep competitor crawl added the GOVERN CORE phase (CORE Phases 181-189, STRETCH Phases 190-191; numbering skips reserved 178-180 = the v3.5 STRETCH carry-forwards).

| Requirement | Phase | Status |
|-------------|-------|--------|
| REVERT-01 | Phase 181 | Complete |
| REVERT-02 | Phase 181 | Complete |
| VALID-01 | Phase 182 | Complete |
| VALID-02 | Phase 184 | Complete |
| VALID-03 | Phase 184 | Complete |
| CANVAS-01 | Phase 183 | Complete |
| CANVAS-02 | Phase 184 | Complete |
| CANVAS-03 | Phase 184 | Complete |
| CANVAS-04 | Phase 184 | Complete |
| GOVERN-01 | Phase 185 | Complete |
| GOVERN-02 | Phase 185 | Complete |
| GOVERN-03 | Phase 185 | Complete |
| CONCUR-01 | Phase 186 | Complete |
| CONCUR-02 | Phase 186 | Complete |
| VOCAB-01 | Phase 187 | Complete |
| VOCAB-02 | Phase 187 | Complete |
| VOCAB-03 | Phase 187 | Complete |
| RUNVIZ-01 | Phase 188 | Pending |
| RUNVIZ-02 | Phase 188 | Pending |
| RUNVIZ-03 | Phase 188 | Pending |
| CONN-01 | Phase 189 | Complete |
| CONN-02 (STRETCH) | Phase 190 | **Pending — MECHANISM SHIPPED, LIVE PROOF OWED** (settled at 190-19, 2026-08-09 — see below) |
| CONN-03 (STRETCH) | Phase 190 | **Pending — EVERY SECURITY CLAUSE SHIPPED AND DRIVEN; the requirement's OWN mandatory gate has not run** (settled at 190-19, 2026-08-09 — see below) |
| SCALE-01 (STRETCH) | Phase 191 | Pending |

### CONN-02 / CONN-03 — settled at Phase 190's close, and settled as NOT complete

Phase 190 executed 19 of 19 plans. Both requirements were left `Pending` by every plan **by the
phase convention `D-190-DEF-02` set at 190-01** (they are marked together at close, never
mid-phase), so this is the place they are decided. **Neither is marked complete, and the reason
is stated rather than left implicit — leaving a box silently unticked is as dishonest as ticking
it wrongly.**

**CONN-03 — why not complete.** Every substantive clause is shipped **and driven**, not merely
written: the unconditional egress guard runs **before and independently of** any credential
(D-06, driven RED by moving the guard below the resolver in production source — an unbound step
aimed at `169.254.169.254` then raised *nothing at all*); expression/template evaluation is
sandboxed and no arbitrary-code node exists (SC#3 — and 190-14 states honestly that this was
**PROVED, not BUILT**: 190 added no evaluator, so the deliverable is a fence over an existing
property); credentials are org-scoped, Fernet `enc:v1:`-encrypted and resolved server-side by
reference, fail-CLOSED at both ends; and the dedicated cross-org leak test exists **and the leak
was reproduced before it was closed** (org A held org B's decrypted bot token, verbatim).
**What is missing is named in the requirement's own text:** *"mandatory `/gsd:secure-phase`
(`threats_open: 0`)"*. **That gate has not run.** Marking CONN-03 complete would assert a gate
that has not happened, in the one phase whose entire discipline is not over-claiming (D-31).
→ **Closing condition: `/gsd:secure-phase 190` returning `threats_open: 0`.** The register it must
disposition — including two surfaces no plan's threat model covers — is collected in
`190-VALIDATION.md` § Residuals.

**CONN-02 — why not complete.** All three adapters exist behind one MCP-shaped seam, the executor
sends behind six ordered gates, the author can bind a connection on the canvas, Settings →
Connections ships whole, and the credential check runs on the stored connection and provably
sends nothing. **But the requirement's word is *run*, and the phase's own demo sentence is the
acceptance bar: it is half built and zero demonstrated.** Measured at close against the live
database: **0** `connector_connections` rows, **0** workflow definitions of *any* status containing
an `external_action` phase, and `live_connectors` absent from `feature_visibility` (⇒ cold default
`off`). **No message, ticket or email has left this application.**
→ **Closing condition: the three live-send rows in `190-VALIDATION.md` § Manual-Only
Verifications**, which need operator-provided destinations (D-30) plus the artefact chain
`BLOCK-190-UAT-01` names. **First row to run: Slack `post_message`** — it falsifies T13 (the
likeliest shipped defect) and retires assumption A3 in the same run.

⚠ **A measured enlargement of D-30, recorded here so it is not rediscovered:** the `send_email`
row needs a **publicly-routable SMTP host with TLS**, not merely "a throwaway mailbox". The local
`supabase_inbucket` catch-all was investigated and **refuted twice** — no reachable SMTP listener,
and `egress.py` refuses a loopback plaintext destination by design (`scheme_not_tls` /
`address_not_public` / `host_not_allowed`, all four variants driven). That refusal is the guard
working, not a defect.

**Coverage:**
- CORE requirements: 21 total (REVERT ×2, VALID ×3, CANVAS ×4, GOVERN ×3, CONCUR ×2, VOCAB ×3, RUNVIZ ×3, CONN-01 ×1) → Phases 181-189
- STRETCH requirements: 3 total (CONN-02, CONN-03, SCALE-01) → Phases 190-191
- Mapped to phases: 24 ✓
- Unmapped: 0 — every requirement maps to exactly one phase; no duplicates.

---
*Requirements defined: 2026-07-24 (after research-first domain study — 4 dimensions + synthesis)*
*Last updated: 2026-07-24 — GOVERN category added after the deep competitor crawl (Beam/Glean/n8n); traceability re-mapped to Phases 181-191 (11 phases, 23 reqs)*
*Amended 2026-07-31 — RUNVIZ-03 added to Phase 188 (operator call after Phase 185 UAT: a running workflow and its output need their own place, not chat). CORE 20 → 21 reqs, 23 → 24 mapped. No phase renumbered; no other requirement changed.*
