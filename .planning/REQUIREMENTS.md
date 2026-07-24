# Requirements: v3.6 Visual / No-Code Workflow Studio

**Defined:** 2026-07-24
**Core Value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.
**Milestone goal:** Add a drag-and-drop visual authoring + live-run observability layer ON TOP of the existing governed harness workflow engine, so a non-technical business user can *draw their own process* and watch it run — without losing the engine's governance rails. Build ON what exists; NOT an engine rewrite.

> **Convention:** this project ships **CORE** (committed) + **STRETCH** (gated behind CORE — ship only if CORE lands clean and budget remains; v2.9 105-109 / v3.1 125-131 / v3.2 138-144 / v3.3 156-159 / v3.4 169-173 / v3.5 178-180 precedent).
> **Research base:** `.planning/research/SUMMARY.md` (+ STACK / FEATURES / ARCHITECTURE / PITFALLS). Confidence HIGH; four researchers converged on the same shape and build order.
> **Operator scoping calls (2026-07-24):** connector depth = *governed node model CORE + thin live demo slice STRETCH*; CORE = revert→run-viz + concurrency, STRETCH = live connectors + scale.

## CORE Requirements (committed)

### REVERT — the tested off-switch (operator HARD gate #1)

- [ ] **REVERT-01**: An operator can turn the entire visual canvas layer on/off via a new governed feature key (`visual_workflow_canvas`, default off) — the nav entry and every canvas route are gated (the shipped v3.3 `skill_studio` / feature-visibility pattern); the two existing authoring doors and the engine are untouched when off.
- [ ] **REVERT-02**: With the flag off, the product is provably byte-identical to today — a `test_revert_byte_identical` gate (CI + live milestone-close) asserts the existing "Describe & run" / "Author & govern" doors and the run surface are unchanged. Revertibility is a tested acceptance gate, not a prose claim (extends the standing D-14 red line).

### VALID — the anti-drift governance seam (the differentiator)

- [ ] **VALID-01**: The server exposes `POST /workflows/validate` that reuses the existing `reachability.lint_workflow` + grounding-fidelity checks verbatim — the single source of validation truth; the canvas never re-implements the rules client-side.
- [ ] **VALID-02**: A user editing on the canvas is prevented from drawing an invalid or unsafe workflow — structural / reachability / tool-whitelist / gate violations surface live *as the canvas is built* ("you cannot draw an invalid or unsafe workflow"). *(Headline differentiator — no competitor validates the flow at author-time.)*
- [ ] **VALID-03**: A user sees per-node validation status (badges / inline errors) derived from the server verdict, never from a client-side guess.

### CANVAS — the visual authoring surface

- [ ] **CANVAS-01**: A user can view an existing workflow as a visual node canvas — a read-only projection of its `WorkflowDefinition` (nodes = phases, edges = flow + `skip_to_phase` branches), rendered via `@xyflow/react`.
- [ ] **CANVAS-02**: A user can add, move, connect, and delete phase-nodes; edits round-trip losslessly back to `WorkflowDefinition` (one client serializer) and save through the **existing** draft CRUD (create-once-then-PATCH). Node layout/positions are kept OUT of the immutable definition JSONB.
- [ ] **CANVAS-03**: A user can configure a selected node in a side panel, backed by the existing `PhaseConfig` discriminated-union schema (Pydantic stays authoritative).
- [ ] **CANVAS-04**: The canvas expresses governance as visible rails — locked phase order, per-phase tool whitelists, and validation gates the user cannot wire around (governance rendered, never removed).

### VOCAB — approachability for business users

- [ ] **VOCAB-01**: A business user sees plain-language node names/verbs ("Find documents", "Ask the AI", "Get approval", "Produce a report") with a Technical-names reveal — extends the v3.3 LANG-01 plain-language layer + SEED-085 terminology split.
- [ ] **VOCAB-02**: A user can describe a workflow in natural language and get a seeded, editable canvas draft (wires the existing NL generator, SEED-051, onto the canvas) — and the AI seed structurally cannot emit an unsafe node (the response schema IS the `extra="forbid"` union).
- [ ] **VOCAB-03**: A user can start from a template / starter flow on the canvas (reuses the shipped Starter Workflow Library).

### RUNVIZ — non-technical live run observability

- [ ] **RUNVIZ-01**: A non-technical user can watch a workflow run on the canvas — each node shows live state (pending / active / passed / failed / skipped / waiting-for-you) painted from the same `usePhases(threadId)` run stream the developer `PhaseTimeline` uses (one run stream, two views; no new Redis events, no new demux).
- [ ] **RUNVIZ-02**: The canvas run view is honest — node state is a total function over the FULL event set (never shows "done" on a `gate_failed` / `run_failed`) and reconciles-on-fetch at every reconnect (Realtime is a hint, not truth — D-v2.5-03).

### CONCUR — safe co-edit (v3.4 made workflows org-shareable)

- [ ] **CONCUR-01**: Editing a draft on the canvas autosaves by updating the draft row in place — a cosmetic node drag never mints a new definition version or re-arms the golden-run gauntlet.
- [ ] **CONCUR-02**: Two people editing the same org-shared workflow cannot silently clobber each other — a concurrency guard (soft-lock / optimistic-concurrency token) protects the shared draft; publish is guarded against reading a dirty draft.

### CONN — external-integration node model (operator HARD gate #3, CORE half)

- [ ] **CONN-01**: A user can place a governed **external-action node** on the canvas whose capabilities ride the existing per-phase tool-whitelist guard (an MCP-backed node model — zero new governance concept); the milestone **records the own-framework-vs-Open-Platform decision** (research verdict: MCP-first, first-party-thin, broad catalog sequenced with Open Platform SEED-013/014). CORE ships the governed node vocabulary + the recorded decision — no live outbound egress (that is CONN-02/03, STRETCH).

## STRETCH Requirements (gated behind CORE)

### CONN — thin live connector slice (operator HARD gate #3, live-proof half)

- [ ] **CONN-02**: A user can run 2–3 first-party **live** connectors from a workflow — email out, JIRA/ticket create, Slack notify — as the demo-able external-integration proof (MCP-backed action nodes). Broad catalog / inbound webhooks / public API sequence with Open Platform (SEED-013), NOT forked into v3.6.
- [ ] **CONN-03**: Every connector outbound is secured — an unconditional SSRF / egress allow-list guard on every outbound fetch *regardless of credential state* (avoids the n8n "guarded only when a credential is attached" CVE class), org-scoped Fernet-encrypted credentials resolved server-side by reference (never in the definition JSONB or the client), and a dedicated cross-org credential-leak test. Rides with CONN-02; mandatory `/gsd:secure-phase` (`threats_open: 0`).

### SCALE — conditional hardening

- [ ] **SCALE-01**: The canvas stays responsive at scale — React Flow `onlyRenderVisibleElements` + node memoization if node counts exceed ~100–150, `elkjs` auto-layout only if run-viz must depict `llm_batch_agents` fan-out as a branching layout, and indexed org-scoped Workflows-list reads at many-orgs × many-workflows scale. Ship only if a real workflow or org fan-out exceeds the expected small scale.

## Future Requirements (deferred — → Open Platform milestone, SEED-013/014)

- **OPEN-01**: Broad connector catalog (many providers), a connector marketplace, and per-connector auth flows beyond the first-party few.
- **OPEN-02**: Inbound webhooks / event triggers that START a workflow from an external system.
- **OPEN-03**: Public REST API + MCP server + service accounts (the app-as-integration-target half of the Open Platform).
- **OPEN-04**: Real-time collaborative multi-cursor canvas editing (CRDT/OT) — heavy infra; soft-lock (CONCUR-02) is the v3.6 cut.
- **OPEN-05**: Free-placement node-layout persistence (`workflow_layouts` side table) — only if a sketch/discuss pass confirms deterministic auto-layout is insufficient; otherwise auto-layout only (zero migration).

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

Which phases cover which requirements. Populated during roadmap creation (Phase column filled by the roadmapper).

| Requirement | Phase | Status |
|-------------|-------|--------|
| REVERT-01 | TBD | Pending |
| REVERT-02 | TBD | Pending |
| VALID-01 | TBD | Pending |
| VALID-02 | TBD | Pending |
| VALID-03 | TBD | Pending |
| CANVAS-01 | TBD | Pending |
| CANVAS-02 | TBD | Pending |
| CANVAS-03 | TBD | Pending |
| CANVAS-04 | TBD | Pending |
| VOCAB-01 | TBD | Pending |
| VOCAB-02 | TBD | Pending |
| VOCAB-03 | TBD | Pending |
| RUNVIZ-01 | TBD | Pending |
| RUNVIZ-02 | TBD | Pending |
| CONCUR-01 | TBD | Pending |
| CONCUR-02 | TBD | Pending |
| CONN-01 | TBD | Pending |
| CONN-02 (STRETCH) | TBD | Pending |
| CONN-03 (STRETCH) | TBD | Pending |
| SCALE-01 (STRETCH) | TBD | Pending |

**Coverage:**
- CORE requirements: 17 total (REVERT ×2, VALID ×3, CANVAS ×4, VOCAB ×3, RUNVIZ ×2, CONCUR ×2, CONN-01 ×1)
- STRETCH requirements: 3 total (CONN-02, CONN-03, SCALE-01)
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 20 ⚠️ (filled at roadmap creation)

---
*Requirements defined: 2026-07-24 (after research-first domain study — 4 dimensions + synthesis)*
*Last updated: 2026-07-24 after initial definition*
