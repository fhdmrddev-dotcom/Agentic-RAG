# Pitfalls Research

**Domain:** Adding a drag-and-drop / no-code visual authoring canvas + non-technical run observability + external connectors ON TOP of an existing governed, multi-tenant harness workflow engine (v3.6 Visual / No-Code Workflow Studio)
**Researched:** 2026-07-24
**Confidence:** HIGH on the governance / round-trip / revert / connector pitfalls (grounded in the actual `WorkflowDefinition` model, `lint_workflow`, `publish_service`, and the org/RLS + secrets code); MEDIUM on competitor-specific patterns and React-Flow scale thresholds (WebSearch-verified, not measured in this repo).

> **Framing.** This milestone is *not* building a workflow engine — the engine (locked ordered phases, per-phase `available_tools` whitelist, closed-registry validation gates, the 8-stage publish gauntlet with the `llm_judge` hard-wall, per-version immutable definitions) already exists and is trusted. The whole risk surface is the **new layer**: a visual editor that produces the *same* `WorkflowDefinition` JSON, a run view for people who can't read the developer timeline, a feature flag that must revert to *exactly today*, and connectors that reach outside the box. Every pitfall below is about that seam, not about generic React/FastAPI hygiene.

---

## Critical Pitfalls

### Pitfall 1: The canvas becomes a second, drift-prone rule engine (governance fork)

**What goes wrong:**
The natural way to give a business user "live in-canvas validation" ("you can't connect these two nodes", "this phase needs an approval before it can publish") is to re-implement the rules in TypeScript on the client so the UI can grey out invalid moves instantly. Within one or two phases the client rules and the server's real gate (`lint_workflow` + the `WorkflowDefinition` strict model + the publish gauntlet) drift. The canvas then either (a) blocks a flow the server would happily accept (frustrating), or worse (b) *permits* a flow the server rejects only at publish — so the "can't draw an invalid workflow" promise is a lie, and a business user hits a wall of developer-jargon gauntlet errors after 20 minutes of drawing.

**Why it happens:**
Round-trip latency. Developers want instant feedback on the canvas, the real validators are Python (`reachability.py`, `publish_service.py`, `workflow_authoring._check_grounding_fidelity`), and calling the server on every node drag feels heavy. So they port "just the easy rules" to the client and it snowballs.

**How to avoid:**
- **One source of structural truth, reused — never re-authored.** `lint_workflow()` (`backend/app/services/harness/reachability.py`) is already a *pure, I/O-free* function returning typed `LintError`s (orphan / unsatisfiable-skip / no-terminal / bad-index / input-unsatisfied). Expose it behind a stateless `POST /workflows/validate` (draft-in → `LintError[]` + the `WorkflowDefinition.model_validate` result out). The canvas calls THAT — debounced (~300–500ms) — and renders the errors on the offending nodes. The client owns *presentation* of errors, never their *definition*.
- **Whitelist / grounding checks stay server-side too.** The `available_tools` per-phase whitelist, the folder-scope ⊆ project-subtree assertion, and skill_ref membership already live server-side in `_check_grounding_fidelity` (T-103-02-03, "KB content can never whitelist itself"). The node config panel must offer tools/skills/folders from a **server-provided grounding bundle** (the same one NL authoring assembles in `_assemble_grounding`), not a client-hardcoded list — otherwise a business user can type a tool name the whitelist would reject.
- **Distinguish the three validation tiers and surface all three in-canvas, but compute all three on the server:** (1) *shape* = `WorkflowDefinition.model_validate` (`extra="forbid"`), (2) *structure* = `lint_workflow`, (3) *publishability* = the gauntlet's cheap pre-run stages (business_requirement present, no unvalidatable interactive phase). Only the golden-run + judge stages stay publish-time (they cost a real LLM run).
- **The canvas can only emit the closed vocabulary.** Nodes map to the 6 `phase_type` literals and the 9 `ValidatorSpec.kind` literals — both LOCKED sets. The palette is generated FROM those literals, so a new node type is impossible to draw unless the model gains a member.

**Warning signs:**
- A `validate`-like function appears in `frontend/src/` that enumerates phase types or tool names.
- The canvas shows a node as "valid" but publish returns a `lint`-stage or `definition_invalid` block.
- Grounding lists (tools/folders/skills) are imported from a frontend constant instead of fetched.

**Phase to address:** In-Canvas Governance phase (the shared-validator endpoint), landed *before* any node vocabulary or free editing. This is the load-bearing phase of the milestone.

---

### Pitfall 2: The flag-off state is not byte-identical to today (the revert gate is a lie) — HARD GATE #1

**What goes wrong:**
Operator HARD requirement #1 is: flip the flag → land on *exactly* today's behavior, as a **tested** acceptance gate. The common failure is a flag that hides the new *UI* but leaves behind non-revertible residue: a schema migration that's `NOT NULL` or changes an existing column, a new required field on `WorkflowDefinition` that makes old published rows fail `model_validate`, a route that's always mounted, or an accidental edit to the two existing authoring doors ("Describe & run" / "Author & govern") or to `PhaseTimeline`/`PhaseCard`/the run surface. Now "flag off" is a *different* system than v3.5, and the revert is unsafe precisely when you need it (something broke).

**Why it happens:**
Feature flags are treated as a UI-visibility toggle, not a system-state contract. Migrations feel unrelated to "the flag". And the existing surfaces (`WorkflowBuilderPage`, `PhaseSpineGraph`, `PhaseTimeline`) are shared code — a "small improvement" while you're in there silently changes the flag-off baseline.

**How to avoid:**
- **Additive-only, nullable-only schema — the model already proves the pattern.** Every field added to `WorkflowDefinition` since v2.9 (`project_folder_id`, `inputs`, `assets`, `business_requirement`, `category`) is `X | None = ...` specifically so "old JSONB rows `model_validate()` to defaults" (the zero-migration lock comment in `harness.py`). New canvas metadata (node positions, layout) MUST follow the identical additive-optional rule, and must NEVER be a field the *engine* reads. If a migration isn't a pure additive nullable column, it does not ship in this milestone.
- **Flag-gate at every layer, not just the render.** The flag lives in `app_settings` (the established pattern — `tool_dispatcher` reads `getattr(load_app_settings(), flag_attr)`; MODEL-02 `llm_model_locked` is the precedent). New routes (`/workflows/validate`, canvas save, connector CRUD) must 404/refuse when off (the `require_operator` byte-identical-404 pattern from Phase 146 is the model). The composer/nav entry point hides. The engine path is untouched either way.
- **Make revert a real test, not a claim.** Author a `test_revert_byte_identical` gate: with the flag OFF, (1) the two existing authoring doors render and function identically to a captured v3.5 baseline, (2) an existing published workflow still runs and produces the same deliverable, (3) `GET /workflows` and the run surface return the same shapes, (4) the new routes 404. This is the milestone's acceptance gate — it runs in CI and is re-run live at milestone close.
- **Treat the existing doors + run surface as frozen contracts.** Any diff to `WorkflowBuilderPage`, `PhaseSpineGraph`, `PhaseTimeline`, `PhaseCard`, or the run surface must be *additive behind the flag* (a new prop defaulting to today's behavior), never a rewrite. G-5 hot-file audit at discuss-phase catches this.

**Warning signs:**
- A migration in this milestone is anything other than `ADD COLUMN ... NULL` / a new table.
- The revert story is described in prose ("just turn it off") but no test asserts it.
- A PR touches `PhaseTimeline.tsx` or the run surface without a flag guard.
- Old published workflows 500 or 422 on load after a definition-model change.

**Phase to address:** Revert Foundation phase — the FIRST phase of the milestone. The flag, the layered gating, and the `test_revert_byte_identical` gate ship before any canvas work, so every subsequent phase inherits a proven off-switch.

---

### Pitfall 3: Lossy / corrupting canvas↔definition round-trip (layout data poisons the immutable definition)

**What goes wrong:**
The canvas needs per-node x/y positions, zoom, edge waypoints, collapsed/expanded UI state. The tempting shortcut is to stuff that layout blob *into* the `WorkflowDefinition` JSONB (it's already JSON, it's right there). Two failures follow: (1) `extra="forbid"` on `_StrictBase` **rejects** unknown keys, so either the save 422s or someone relaxes `extra` and blows the injection guard (T-090-01); (2) if layout is co-mingled, then a pure cosmetic drag (moving a node 3px) mutates the *definition* → creates a new version → triggers the golden-run gauntlet, and the immutability/version story becomes meaningless. The inverse loss also happens: importing a definition authored by NL or the existing doors (which have NO layout) into the canvas produces overlapping nodes at 0,0 because there's no layout to round-trip.

**Why it happens:**
"It's all JSON" conflates two things with opposite lifecycles: the **governed definition** (validated, versioned, immutable-on-publish, engine-consumed) and **presentation layout** (cosmetic, per-user, freely mutable, never engine-read). React-Flow's own `toObject()` returns nodes+edges+viewport as one blob, which nudges you toward storing it whole.

**How to avoid:**
- **Two columns, never one.** Definition stays in `workflow_definitions.definition` (untouched, engine-owned). Layout goes in a *separate* additive nullable column or side table (`workflow_layouts`, keyed by definition id + optionally user id) that the engine never reads and `lint_workflow` never sees. A layout write does not bump the definition version.
- **The definition is the source of truth for graph *topology*; layout only positions it.** Nodes/edges the canvas shows are *derived from* `phases[]` + the `phase_index` sequential edges + parsed `skip_to_phase:<slug>` edges (exactly the edge set `reachability.py` already builds — reuse that adjacency logic so the canvas and the linter agree on what an edge IS). Deleting a canvas edge maps to editing a `skip_to_phase` disposition or a phase; it can never create a topology the linter doesn't understand.
- **Deterministic auto-layout for definitions with no saved layout** (NL-seeded drafts, the existing doors, imported starters). A layout algorithm (e.g. dagre/elk vertical spine, mirroring today's `PhaseSpineGraph`) runs when `workflow_layouts` has no row — so every definition opens cleanly in the canvas whether or not it was born there.
- **Round-trip test as a gate:** `definition → canvas model → definition` must be byte-identical on the definition half for every one of the 4 canonical seed shapes + the PM pack. Layout round-trips separately and is allowed to be absent.

**Warning signs:**
- `extra="forbid"` is relaxed on any harness model, or a `position`/`x`/`y`/`layout` key appears inside `definition`.
- Moving a node creates a new `workflow_definitions` version or re-arms the publish gauntlet.
- Opening an NL-authored or starter workflow in the canvas shows stacked nodes at the origin.

**Phase to address:** Canvas↔Definition Round-Trip phase (the serialization contract + auto-layout), immediately after the Revert Foundation and alongside/just-before In-Canvas Governance.

---

### Pitfall 4: Dishonest run observability — "done" when a gate failed, or nodes mapped to the wrong events

**What goes wrong:**
The non-technical run view is meant to show "which node is active, inputs/outputs, gate pass/fail" in plain language. The failure modes: (a) the friendly view collapses a `gate_failed` / `run_failed` into a green "done" checkmark because it only listens for `phase_completed`; (b) it maps a `phase_transition` or a sub-agent's events onto the wrong node (the harness fans out `llm_batch_agents` and spawns sub-agents — those emit on a *producer* stream, keyed differently from the workflow `run_id`); (c) on browser reconnect it replays a stale Realtime snapshot and shows a run as "still on step 2" when it actually failed at step 4 minutes ago. For a business user who *trusts* the pretty view, a dishonest "done" is worse than a raw log — they ship a broken deliverable believing a gate passed.

**Why it happens:**
The engine's event vocabulary is honest and specific (`phase_started`, `phase_transition`, `phase_completed`, `gate_passed`, `gate_failed`, `run_failed`, plus `delta`/`sources`/`citations`), and it deliberately **never emits `phase_completed` for a failed emit phase** (WR-01). But a "simplified" UI that only subscribes to the happy-path events *loses the failure signal by omission*. And Realtime is a best-effort hint (D-v2.5-03), so a naive UI that trusts the last pushed event lies on reconnect.

**How to avoid:**
- **Model the friendly node state as a total function over the FULL event set, not a happy-path subset.** Each node is exactly one of `pending / active / passed / failed / skipped / waiting-for-you`. A node is `passed` ONLY on `phase_completed`; `gate_failed` → `failed`; `run_failed` → the active node `failed` and downstream `skipped`; `llm_human_input` pause → `waiting-for-you`. No event → stays `pending`. Never infer success from absence.
- **Reconcile on (re)connect — the standing rule.** D-v2.5-03: Realtime is a hint, the fetch is truth. On mount/reconnect, fetch the authoritative run+phase state (the `run:{run_id}` Redis Stream supports replay-and-tail per run_id, Phase 061+) and rebuild node states from that, THEN attach the live tail. The run surface already does this — the friendly view must not invent a new, hint-trusting path.
- **Map events by keying, correctly, once.** Sub-agent / batch-fan-out events ride the producer stream; the friendly view subscribes to the workflow `run_id` phase events and shows aggregate progress ("Reviewing 5 documents…"), NOT individual sub-agent chatter mis-attributed to a node. Build the node↔event map in ONE place with a test per event type.
- **Honesty over prettiness is a design contract, not a nicety.** Reuse the run-honesty lessons already banked (174 run-state honesty, 095 never-vanishes run-status strip). A failed gate must be *visibly* failed in plain language ("The approval step didn't pass — here's why"), with a reveal to the raw named-failures for whoever wants them.

**Warning signs:**
- The friendly view only has handlers for `phase_started` / `phase_completed`.
- A run shows all-green but the deliverable is missing or the publish/run audit says `gate_failed`.
- Reconnecting mid-run shows a different (earlier) state than a fresh page load.
- Sub-agent deltas appear as node status changes.

**Phase to address:** Non-Technical Run Observability phase, after the round-trip + governance phases (it needs the node↔phase mapping those establish). G-2 sketch-first applies (it's a live "feels like" surface).

---

### Pitfall 5: Autosave version explosion + multi-user edit clobber on a shared workflow

**What goes wrong:**
A drag canvas invites continuous autosave. If every autosave writes a new `workflow_definitions` row/version, the version table explodes and the immutability semantics blur (which version is "the" draft?). Separately, v3.4 shipped org-shared workflows — two people in the same org can now open the *same* workflow. With last-write-wins PATCH (the current `updateWorkflowDraft` model, single-author), user B's save silently overwrites user A's edits, or an in-flight publish golden-run reads a half-saved draft.

**Why it happens:**
The existing Builder is single-author, describe-first, save-on-edit — it was never designed for continuous autosave or concurrent editors. The org-shared scope (`is_org_shared`) is new underneath it. `publish_definition` already had to add a `status='draft'` WHERE-guard to survive a concurrent double-publish race (WR-03) — that same class of race now applies to *editing*.

**How to avoid:**
- **Draft edits mutate ONE draft row in place; versions are minted only at publish.** The model already works this way — `publish_definition` flips draft→published and returns the new version; a Tweak forks a fresh v(N+1) *draft*. Autosave PATCHes the single draft row (debounced), it does NOT create versions. Layout autosave is even cheaper (separate table, Pitfall 3).
- **Optimistic concurrency on the draft row.** Add a `revision`/`updated_at` token; a PATCH carries the token it read and the server rejects a stale write (409 → the client reloads and re-applies). This is the edit-time analog of the WR-03 publish guard. For v3.6, "second editor gets a soft lock / read-only + a 'someone's editing' banner" is an acceptable first cut; silent clobber is not.
- **Never publish a dirty draft.** The publish path must snapshot/read the persisted draft, and the golden run must not race an in-flight autosave (reuse the draft-status guard).

**Warning signs:**
- `workflow_definitions` row count grows on every keystroke/drag.
- Two testers editing one org-shared workflow lose each other's changes.
- A publish golden-run occasionally validates a definition that doesn't match what the author sees.

**Phase to address:** Concurrency & Autosave phase (draft-in-place + optimistic token + soft lock), bundled with or immediately after the Round-Trip phase. Its UAT MUST include a parallel-thread / two-editor row (the SC#10 parallel axis is exactly this class of bug).

---

### Pitfall 6: SSRF, credential leakage, and cross-tenant credential bleed from user-wired connectors — HARD REQ #3

**What goes wrong:**
The moment a business user can type a URL (webhook target, "call this API", email/JIRA endpoint) or wire a connector, four classic no-code holes open: (1) **SSRF** — the user (or an attacker who compromised a low-priv account) points a connector at `http://169.254.169.254/…` (cloud metadata), `http://localhost:8000` (our own backend), or an internal service, and the *server* fetches it with server credentials; (2) **credential leakage in run logs / the friendly run view** — an OAuth token or API key echoed into a `delta`/output and shown to the user or persisted in `harness_audit`; (3) **cross-tenant credential bleed** — a connector credential stored without org scoping, so an org-shared workflow run resolves *another org's* token; (4) **data exfil** — a business user wires an untrusted external endpoint and the workflow POSTs the org's KB contents to it. n8n shipped a real CVE where SSRF protection *only applied when a credential was attached* — the exact "we half-protected it" trap.

**Why it happens:**
Connectors are the app's first outbound-to-arbitrary-URL surface (today ingestion is manual upload only, "no connectors or automated pipelines" — CLAUDE.md). All prior egress is to known providers via the gateway. The threat model for *user-supplied destinations* is brand new, and the multi-tenant + secrets-at-rest machinery (org RLS, Fernet `enc:v1:`) exists but was built for provider keys, not per-connector per-org credentials.

**How to avoid:**
- **Answer the own-framework-vs-Open-Platform question FIRST, on security grounds.** SEED-013 already frames connectors (REST API + MCP + service accounts + webhooks) with a security posture (per-consumer rate-limit, org-aware permissions as a hard B2B prerequisite, "a service account that can read another org's KB is a customer-loss event"). Building a *second, bespoke* connector framework in the canvas milestone means threat-modeling egress twice and drifting from SEED-013's substrate. **Recommendation for the roadmap: v3.6 ships connectors as a thin, tightly-scoped MVP on the SEED-013/MCP substrate (or defers deep connectors to sequence with Open Platform), NOT a from-scratch canvas-owned connector engine.** Let research/requirements make the call explicitly — but the default should minimize the net-new egress surface.
- **Egress allow-list + SSRF guard on EVERY outbound fetch, unconditionally.** Resolve the target host, block RFC-1918 / link-local / loopback / metadata IPs, block redirects to them, enforce an operator-managed allow-list of destination domains per org. The guard applies whether or not a credential is attached (the n8n CVE lesson). No user-supplied URL is fetched raw.
- **Credentials are org-scoped, encrypted, and resolved server-side by reference.** Reuse the Phase-150 Fernet `enc:v1:` at-rest pattern and the org RLS (`workflow_definitions.org_id`, `get_service_role_supabase` *refuses* to construct without an explicit org — that discipline extends to connector credential reads). A phase references a credential by id; the token is injected at execution, never stored in the definition JSONB and never returned to the client.
- **Secrets never touch logs, audit, or the friendly run view.** A redaction pass on `delta`/output/`harness_audit` metadata; the DeepSeek DSML-leak guard is the precedent for "strip provider-shaped junk before it reaches the user" — a connector-secret redactor is the same shape at the egress boundary.
- **Rate-limit + abuse controls per org/connector** (Redis token bucket — SEED-013 already specifies this) so one workflow can't hammer JIRA/email into a ban or run up a bill.

**Warning signs:**
- Any code path does `requests.get(user_supplied_url)` / `httpx` to a host not on an allow-list.
- A connector credential row has no `org_id`, or is readable by another org in a leak test.
- A token appears in a log line, an audit metadata blob, or the run view.
- SSRF protection is conditional on "if credential attached".

**Phase to address:** External Connectors phase — sequenced LAST in the milestone (or split out to Open Platform), each connector-touching phase gets a mandatory `/gsd:secure-phase` SECURITY.md with `threats_open: 0` (the established bar for trust-boundary phases: 146–150/153/154/158/159). Cross-tenant isolation gets a dedicated leak test (the SEED-124/125 org-leak precedent).

---

### Pitfall 7: A canvas that's still too technical — or so dumbed-down it can't express a real process (adoption failure)

**What goes wrong:**
Two opposite misses, both fatal to the "Legal/HR/Finance user draws their own process" goal. (a) **Jargon leak:** the nodes say `llm_agent`, `available_tools`, `skip_to_phase`, `citations_required`, `folder_scope`, `emitter: render_template` — the business user bounces because it reads like the developer's `WorkflowDefinition`, not their process. (b) **Over-simplification:** the vocabulary is so reduced ("Do a thing" → "Get a result") that it can't express branching on a gate, an approval step, a batch-over-documents fan-out, or a template-fill deliverable — so real processes can't be built and users fall back to asking a developer, defeating the milestone.

**Why it happens:**
The 6 phase types + 9 validator kinds are an *engineering* ontology. Mapping them to business verbs ("Find documents", "Ask the AI", "Get approval", "Produce a report") is real product work that's easy to under-invest in ("we'll just relabel the enum"). Over-simplification happens when the vocabulary is designed from the *simplest* demo, not from the actual PM/Legal/HR processes the engine already runs.

**How to avoid:**
- **Build the business-verb ↔ phase-type map as a first-class, tested artifact, extending existing work.** v3.3 LANG-01 shipped a plain-language layer behind an advanced reveal; SEED-085 is the user-vs-admin terminology split; Phase 124 shipped the workflow "soul" + strict/loose doors. The node vocabulary is the *next* layer on those, not a fresh invention. Every business verb maps deterministically to a phase config; the reveal ("Technical names" ⌥, the Phase 146–148 two-audience pattern) shows the underlying type for whoever wants it.
- **Validate expressiveness against the REAL shipped workflows.** The PM flagship pack (charter/status-report/risk-register), the curated Starter Library, and the 4 canonical seed shapes must ALL be drawable and readable in the business vocabulary. If a starter can't be expressed, the vocabulary is too thin — that's the acceptance bar, not a hand-picked toy.
- **AI-seeds, human-refines (both, not either/or).** NL authoring (SEED-051, realized in 103) seeds a draft canvas the user then edits. This hides the hardest part (choosing phase types + wiring) behind plain English, then lets the user adjust visually — the best-of-both the operator asked for. Guard the seam: the AI-seeded draft must pass the SAME server validation as a hand-drawn one (no privileged path).
- **Sketch-first (G-2) with operator-defined "I'd recognize failure here" scenarios** (G-4) on the canvas, node config, and vocabulary — a real Legal/HR/Finance process is the lived-experience UAT, not a wire-format check.

**Warning signs:**
- A node label or config field shows a raw enum literal (`llm_agent`, `skip_to_phase`) with no plain-language layer.
- A shipped starter/PM-pack workflow cannot be reconstructed in the canvas.
- Users in UAT ask "what's a phase / a gate / a whitelist?"
- The only workflows demoable are 3-node happy paths.

**Phase to address:** Business Vocabulary + AI-Seeded Canvas phase (after governance + round-trip are solid, so the vocabulary sits on a validated model). G-2 sketch-first is mandatory here.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Port validation rules to client TS for instant canvas feedback | Snappy UX, no round-trip | Drifts from `lint_workflow`/gauntlet; "can't draw invalid" becomes false; publish-wall of jargon | **Never** for rule *definition*. Client may cache/render server-computed errors only. |
| Store node layout inside `WorkflowDefinition` JSONB | One blob, one save | 422s on `extra="forbid"` or forces relaxing the injection guard; cosmetic drags mint versions/re-arm gauntlet | **Never.** Separate layout column/table, engine never reads it. |
| Autosave = new definition version | Simple undo/history | Version explosion; immutability semantics blur; publish reads dirty draft | **Never.** PATCH one draft row; version only at publish. |
| Friendly run view listens only to happy-path events | Simplest UI | Shows "done" on `gate_failed`/`run_failed`; business user ships broken deliverable | **Never.** Total function over the full event set. |
| Build a bespoke canvas-owned connector framework | Ships in-milestone, no cross-team seq | Two egress threat models to maintain; drifts from SEED-013/MCP substrate; double the SSRF/credential surface | Only if research explicitly rejects the Open-Platform substrate AND scope is a tightly-guarded MVP. |
| Trust Realtime's last pushed event for run state | No fetch on reconnect | Stale "still running" after a failure (D-v2.5-03 violation) | **Never.** Reconcile-on-fetch, then tail. |
| Relax `extra="forbid"` to accept canvas metadata | Fewer 422s during dev | Re-opens T-090-01 injection guard on the engine's input | **Never.** Keep new fields additive-nullable + typed. |
| Undo/redo as ad-hoc client state snapshots | Quick to build | Diverges from the persisted draft; undo "un-saves" server state incorrectly; corrupts round-trip | Only if undo operates on the same canvas→definition model that's persisted; test undo→save→reload. |

---

## Integration Gotchas

Common mistakes when connecting to external services (the connector track).

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| User-supplied webhook / API URL | Fetch it server-side raw; SSRF to metadata/internal (n8n CVE: guarded only when credential attached) | Unconditional SSRF guard + per-org destination allow-list; block RFC-1918/link-local/loopback/redirects; fetch nothing off-list. |
| Email / JIRA / OAuth tokens | Store in the definition or a global credential table; return to client | Org-scoped credential store, Fernet `enc:v1:` at rest (Phase-150 pattern); reference by id; inject at execution; never in JSONB/client. |
| Cross-org shared workflow with a connector | Resolve credential without org scoping → cross-tenant bleed | Resolve credentials via the org-requiring service-role path (`get_service_role_supabase` refuses without org); dedicated cross-org leak test. |
| Outbound run logs / audit | Token echoed into `delta`/output/`harness_audit` metadata | Redaction pass at the egress boundary (DeepSeek-DSML-strip precedent); secrets never logged/audited/shown. |
| Rate limits / provider bans | Unbounded connector calls per run | Redis token-bucket per org/connector (SEED-013 spec); operator-tunable defaults. |
| MCP as the connector substrate | Assume MCP spec is stable | Pin the MCP spec version; plan a deprecation cycle (SEED-013 risk note). |
| Blocking connector I/O in an async handler | `httpx`/`requests` on the event loop → stalls all workers | Wrap blocking connector calls in `run_in_threadpool` (D-v2.5-01) or use an async client end-to-end. |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Non-memoized React-Flow nodes/edges | Whole canvas re-renders on any state change or single-node drag; drag jank | `React.memo` custom nodes, `useCallback` handlers, node/edge components declared outside parent; only the moved node + its edges re-render | Noticeable ~50 nodes; painful 100–200 |
| Validate-on-every-drag round-trips | Server hammered; laggy feedback | Debounce (~300–500ms) the `POST /workflows/validate`; validate on settle, not per pixel | Any real-time drag with server validation |
| Heavy node CSS (shadows/gradients/animations) | Slow paint at scale | Keep node styles lean; reserve glassmorphic/animated flourishes for idle, not during drag | 100+ nodes |
| Loading full definition + layout + grounding eagerly | Slow canvas open on large workflows | Load definition first (renders spine), fetch grounding/layout async; auto-layout when absent | Large definitions / many folders/skills in grounding |
| Multi-tenant fan-out (org-shared workflows list) | N+1 or unindexed org queries; slow Workflows page per org | Indexed `org_id` reads (RLS already scopes); paginate; the SEED-013 per-consumer concern applies | Many orgs × many workflows |
| Golden-run gauntlet on cosmetic edits | Real LLM run fires on a node move | Layout writes bypass versioning entirely (Pitfall 3); gauntlet only on explicit publish | Any autosave that touches the definition |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Client-side-only whitelist / gate enforcement | Business user (or attacker) submits a definition bypassing tool whitelist / grounding | ALL enforcement server-side (`_check_grounding_fidelity`, `lint_workflow`, gauntlet); canvas can only *display* server verdicts. |
| New routes not flag-gated | Canvas/connector endpoints reachable with flag off → un-reverted attack surface | Byte-identical-404 gate on every new route (Phase-146 `require_operator` pattern). |
| Connector SSRF (guarded only with credential) | Metadata theft, internal enumeration, RCE (n8n CVE class) | Unconditional SSRF guard + allow-list on every outbound fetch. |
| Cross-org credential / KB bleed via shared workflow | Customer-loss event (SEED-013); org A reads org B's tokens/KB | Org-scoped everything; `get_service_role_supabase` requires org; leak test per connector (SEED-124/125 precedent). |
| Secret leakage in run view / audit / logs | Token exfil to the user or persisted | Redaction at egress; secrets referenced-not-embedded; never in `definition` JSONB. |
| Relaxing `extra="forbid"` for canvas keys | Re-opens injection into the engine's typed input (T-090-01) | Keep strict; canvas metadata lives outside the definition model. |
| AI-seeded draft on a privileged path | NL seed skips the grounding/lint gate a hand-drawn one passes | AI-seeded and hand-drawn drafts pass the IDENTICAL server validation. |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Jargon leak (`llm_agent`, `skip_to_phase`, `folder_scope`) | Business user bounces; "this isn't for me" | Business-verb vocabulary + ⌥ Technical-names reveal (LANG-01 / SEED-085 / two-audience pattern). |
| Over-simplified vocabulary | Can't express approval/branch/fan-out/template-fill; users fall back to devs | Validate expressiveness against PM pack + Starter Library + 4 seed shapes as the bar. |
| Dishonest "done" on a failed gate | Ships a broken deliverable trusting the green check | Plain-language failure state ("The approval step didn't pass — here's why") + raw reveal. |
| Publish-wall after 20 min of drawing | Frustration; wasted work | Live in-canvas validation (server-computed) surfaces errors on nodes as you build. |
| Silent clobber on shared-workflow co-edit | Lost work, distrust | Soft lock / optimistic token + "someone's editing" banner. |
| Overlapping nodes at origin on import | Looks broken on first open | Deterministic auto-layout when no saved layout (NL/starter/existing-door definitions). |
| Overwhelming the run view with sub-agent chatter | Cognitive overload | Aggregate progress per node ("Reviewing 5 documents…"), raw detail behind a reveal. |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Feature flag:** UI hides when off — but verify NO non-nullable migration, all new routes 404, both existing doors + run surface byte-identical, old published workflows still run. `test_revert_byte_identical` green.
- [ ] **In-canvas validation:** shows errors — but verify it calls the server `lint_workflow`/`model_validate`, not a client re-implementation; a canvas-"valid" workflow actually publishes.
- [ ] **Round-trip:** canvas opens a workflow — but verify `definition → canvas → definition` is byte-identical (definition half), layout is in a separate store, and a node move does NOT mint a version.
- [ ] **Run view:** shows progress — but verify `gate_failed`/`run_failed` render as *failed* (not omitted), reconnect reconciles-on-fetch (not stale hint), sub-agent events aren't mis-mapped to nodes.
- [ ] **Vocabulary:** nodes have friendly labels — but verify every PM-pack + Starter workflow is drawable/readable, and a Technical-names reveal exists.
- [ ] **Connectors:** email/JIRA works in a demo — but verify SSRF guard fires unconditionally, credentials are org-scoped + encrypted + never logged, cross-org leak test passes, rate-limit exists.
- [ ] **Concurrency:** autosave works solo — but verify two editors on one org-shared workflow don't clobber, and publish can't read a dirty draft.
- [ ] **Perf:** smooth at 10 nodes — but verify memoization holds at 100–200 nodes and validate-on-drag is debounced.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Flag-off not byte-identical (bad migration shipped) | HIGH | If the migration is additive-nullable it's usually harmless; if it changed/NOT-NULLed a column, forward-fix with a compensating additive migration (never a `db reset`); add the missing `test_revert_byte_identical` and re-baseline. |
| Client validation drifted from server | MEDIUM | Delete the client rules; route the canvas to the server `validate` endpoint; add a "canvas-valid ⟺ publishable" contract test. |
| Layout co-mingled into definition | MEDIUM | Migration to split layout into its own column/table; strip layout keys from existing `definition` JSONB; restore `extra="forbid"` if it was relaxed. |
| Dishonest run view shipped | MEDIUM | Rebuild node-state as a total function over all events; add a per-event-type mapping test; force reconcile-on-fetch. |
| Version explosion from autosave | MEDIUM | Migration to collapse draft history to one row per draft; switch autosave to in-place PATCH; version only at publish. |
| Connector SSRF / credential leak found | HIGH | Kill-switch the connector capability (operator kill-switch grid exists, Phase 146–148); add the SSRF guard + org-scoping + redaction; rotate any exposed credentials; leak test before re-enable. |
| Cross-org credential bleed | HIGH (trust) | Immediate kill-switch; audit which orgs were exposed; org-scope the credential store; notify per the operator audit trail. |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls. (Phase *topics*, not final numbers — the roadmapper assigns numbers; ordering rationale is load-bearing.)

| Pitfall | Prevention Phase (topic + order) | Verification |
|---------|----------------------------------|--------------|
| 2. Non-byte-identical revert (HARD GATE #1) | **P1 — Revert Foundation** (FIRST) | `test_revert_byte_identical` green in CI + live at close; all new routes 404 with flag off; no non-nullable migration in the milestone. |
| 3. Lossy/corrupting round-trip | **P2 — Canvas↔Definition Round-Trip** | `definition→canvas→definition` byte-identical (4 seeds + PM pack); layout in separate store; node move mints no version. |
| 1. Governance fork / drift-prone rules | **P3 — In-Canvas Governance** (shared validator endpoint) | Canvas-"valid" ⟺ server-publishable contract test; grounding lists server-provided; `extra="forbid"` intact. |
| 5. Autosave version explosion + co-edit clobber | **P4 — Concurrency & Autosave** | Two-editor parallel UAT row (SC#10 parallel axis); version count flat under autosave; publish can't read dirty draft. |
| 7. Too-technical / too-simple vocabulary (adoption) | **P5 — Business Vocabulary + AI-Seeded Canvas** (G-2 sketch-first) | Every PM-pack/Starter drawable+readable; Technical-names reveal; AI-seed uses identical validation. |
| 4. Dishonest run observability | **P6 — Non-Technical Run Observability** (G-2 sketch-first) | Full-event-set node-state test; reconnect reconciles-on-fetch; failed gate visibly failed; SC#10 cross-provider run rows. |
| 6. SSRF / credential / cross-tenant connector | **P7 — External Connectors** (LAST or deferred to Open Platform) | `secure-phase` SECURITY.md `threats_open:0`; unconditional SSRF guard; org-scoped encrypted credentials; cross-org leak test. |
| Perf traps (React-Flow scale, multi-tenant fan-out) | Woven into **P2/P6** + a **P8 — Scale Hardening** pass if needed | 100–200-node canvas stays responsive; validate-on-drag debounced; org-list reads indexed. |

**Ordering rationale:** The revert gate (P1) must exist before anything else so every later phase is built on a proven off-switch (HARD gate #1). The round-trip contract (P2) and the shared-validator governance endpoint (P3) are the load-bearing foundation the vocabulary (P5) and run view (P6) sit on — build them before the "feels like" surfaces. Connectors (P7) carry the highest new security surface and the own-framework-vs-Open-Platform decision, so they come last (or split to the Open Platform track), each fully `secure-phase`'d. This ordering keeps the engine's governance rails *expressed visually and enforced server-side* at every step, honoring the D-14 red line: no new runtime, Deep byte-identical, harness flag-gated.

---

## Sources

- **Codebase (HIGH — authoritative for this app):**
  - `backend/app/models/harness.py` — `WorkflowDefinition` strict model (`extra="forbid"`, D-07), 6 discriminated `phase_type`s, per-phase `available_tools` whitelist, `ValidatorSpec` (9 kinds), additive-nullable extension pattern, structural `model_validator`s.
  - `backend/app/services/harness/reachability.py` — `lint_workflow` pure structural gate (orphan / unsatisfiable-skip / no-terminal / bad-index / input-unsatisfied) + the edge-set construction to reuse in-canvas.
  - `backend/app/services/harness/publish_service.py` — the multi-stage publish gauntlet, the `llm_judge` hard-wall, honest structured blocks, WR-01/WR-03/WR-04 honesty guards.
  - `backend/app/services/workflow_authoring.py` — `_check_grounding_fidelity` (server-side whitelist/folder/skill grounding; "KB can't whitelist itself"), NL-seed path.
  - `backend/app/services/harness_engine.py` — the run-event vocabulary (`phase_started`/`phase_transition`/`phase_completed`/`gate_passed`/`gate_failed`/`run_failed`) + WRITE-before-EMIT (D-v2.5-03) + never-`phase_completed`-on-failed-emit (WR-01).
  - `frontend/src/pages/WorkflowBuilderPage.tsx`, `PhaseSpineGraph`, `PhaseTimeline`/`PhaseCard` — the existing (single-author, describe-first, read-only-spine) surfaces to extend, not fork.
  - `CLAUDE.md` / `.planning/PROJECT.md` — D-14 red line, Realtime-is-a-hint (D-v2.5-03), org RLS + `get_service_role_supabase` org-requirement, Fernet `enc:v1:` secrets (Phase 150), operator kill-switches (146–148), `app_settings` flag pattern, "no connectors" today.
  - `.planning/seeds/SEED-123` (anchor — ease↔governance heart problem + 3 HARD gates), `SEED-013` (connector substrate, org-aware permissions as B2B prerequisite, SSRF/rate-limit/metering risks).
- **External (MEDIUM — WebSearch-verified, current):**
  - React Flow performance guidance — [reactflow.dev/learn/advanced-use/performance](https://reactflow.dev/learn/advanced-use/performance), [Synergy Codes optimization guide](https://www.synergycodes.com/blog/guide-to-optimize-react-flow-project-performance), [xyflow discussion #4975](https://github.com/xyflow/xyflow/discussions/4975).
  - n8n SSRF (guarded only when credential attached) + multi-tenant credential isolation — [n8n issue #28218](https://github.com/n8n-io/n8n/issues/28218), [Six n8n CVEs / Upwind](https://www.upwind.io/feed/six-n8n-cves-one-day-workflow-security), [Wednesday Solutions multi-tenant n8n](https://www.wednesday.is/writing-articles/building-multi-tenant-n8n-workflows-for-agency-clients), [Reco secure n8n](https://www.reco.ai/hub/secure-n8n-workflows).
  - Competitor governance reconciliation (Glean agent access policies / alignment checks / human oversight by risk tier / audit logging; Beam allowed-actions + tool-access + escalation paths) — [Glean agent governance](https://www.glean.com/product/agent-governance), [Glean guardrail decisions](https://www.glean.com/blog/7-essential-guardrail-decisions-for-deploying-enterprise-ai-agents-successfully), [Beam platform](https://beam.ai/platform).

---
*Pitfalls research for: Visual / No-Code Workflow Studio on a governed multi-tenant harness engine (v3.6)*
*Researched: 2026-07-24*
