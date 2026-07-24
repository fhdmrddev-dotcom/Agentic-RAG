# Stack Research — v3.6 Visual / No-Code Workflow Studio

**Domain:** A drag-and-drop, node-based **visual authoring canvas** + **non-technical live run-observability** layer, added ON TOP of an existing governed harness workflow engine (React 19 + Vite 8 + Tailwind 3 + shadcn/ui frontend; FastAPI + Supabase + Redis backend; raw-SDK, NO-LangChain runtime).
**Researched:** 2026-07-24
**Confidence:** HIGH on the canvas + supporting libs (versions/licenses/React-19 fit verified against npm registry, xyflow repo `package.json`, and official docs). MEDIUM on the connector-framework option space (framed as an open decision per operator mandate, not decided) and on whether an auto-layout lib is needed at all (argued below — likely NOT for the linear spine).

> **Scope discipline.** This researches ONLY the NEW stack for the visual canvas + run-viz + the connector *option space*. The existing stack — React 19.2.4, Vite 8, Tailwind 3.4, shadcn/ui, zustand 5, @tanstack/react-query 5, @lobehub/icons, lucide-react, recharts; FastAPI + Supabase (Postgres/pgvector/Auth/Storage/Realtime) + Redis Streams; raw provider SDKs via `MODEL_CAPABILITIES`; the `harness_engine` + `WorkflowDefinition` Pydantic model + `reachability.lint_workflow` + the 8-stage publish gauntlet — is **fixed and NOT re-researched.** The engine stays the executor (the D-14 red line). The headline: **the entire net-new runtime cost is ONE canvas library + two tiny helpers; everything else is composition of what's already installed.**

---

## Headline findings (read this first)

1. **`@xyflow/react` (React Flow v12) is the recommendation — near-zero-risk fit.** MIT-licensed, React-19-compatible (peer `react: ">=17"`), and — critically — **it uses zustand internally**, the exact store the app already ships (`zustand@5.0.13`). It renders nodes/edges as ordinary React components, so custom phase-nodes are plain Tailwind/shadcn JSX. No competitor comes close on React-native fit + ecosystem + license cleanliness.

2. **The schema is a LINEAR SPINE, not a free DAG — the canvas must be CONSTRAINED, not just dropped in.** `WorkflowDefinition.phases` is an ordered list (`phase_index`) with at most **one `skip_to_phase:<slug>` on-fail branch per validator** (`backend/app/models/harness.py`; the existing read-only `PhaseSpineGraph.tsx` already honours this). React Flow is a general free-DAG canvas by default. The build's core work is **teaching React Flow the engine's grammar** (6 phase-type node types, run-order edges, one dashed skip edge, no arbitrary `depends_on`, no parallel lanes the engine can't run) via `isValidConnection`, controlled state, and a serialize-back-to-`WorkflowDefinition` step. This is the "express governance visually, never remove it" mandate made concrete — and it is the whole reason this is a large UX build, not a library install.

3. **Keep `WorkflowDefinition` JSON as the single source of truth; drive React Flow in CONTROLLED mode.** The canvas is a *view + editor* over the same `BuilderDefinition` the existing form panel edits. Nodes/edges are *derived from* the definition and every change *serializes back to it*. This is the "build ON what exists" contract: the canvas becomes a third authoring door beside the read-only spine + form panel — it does not become a second source of truth.

4. **Auto-layout is probably NOT needed initially.** Because the authored graph is a deterministic vertical spine (`phase_index` order + one skip edge), positions are a trivial hand-rolled vertical stack — exactly what `PhaseSpineGraph.tsx` already computes with plain CSS. Pull in `elkjs`/`dagre` **only** if/when the run-viz wants to depict `llm_batch_agents` fan-out as a visible team. Recommend deferring the layout dep.

5. **Undo/redo is the one genuine gap React Flow leaves — fill it with `zundo`.** React Flow ships pan/zoom, `<MiniMap/>`, `<Controls/>`, `<Background/>` out of the box but **no history**. `zundo@2.3.0` is a <1 KB temporal middleware **for zustand v5** — a glove fit for the app's existing store. No need for a bespoke immer-patch history stack.

6. **Connectors (req #3) = frame, don't decide.** The app already owns the right substrate — a `tool_dispatcher` with **per-phase tool whitelists at a single dispatch guard** (the governance rail external actions would ride) + a documented Open-Platform / app-as-MCP-server direction (SEED-013) that already names n8n as the "dumb pipe" consumer. The lowest-risk, most-aligned path is **MCP-as-connector-substrate** (each email/JIRA action = a whitelisted tool), with **Nango** as the managed-OAuth option if the connector set grows. This section stays an option space; the milestone decides.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended (for THIS domain) |
|------------|---------|---------|-----------------|
| **`@xyflow/react`** (React Flow v12) | **^12.11.2** | The node-based canvas: draggable phase-nodes, flow edges, pan/zoom, minimap, controls, `isValidConnection` connection-validation hook, controlled node/edge state | **MIT-licensed**, actively maintained, **React-19-compatible** (peer `react: ">=17"`), the de-facto standard for governed workflow builders (109K weekly downloads vs 65K X6 / 36K Rete). Decisive for us: **it uses zustand internally** — the same store the app ships — and renders **nodes/edges as ordinary React components**, so a custom "Ask the AI" / "Get approval" node is plain Tailwind + shadcn JSX in the Deep-Midnight theme, not a foreign rendering model. Its `isValidConnection` + custom `nodeTypes` are exactly the hooks needed to enforce the engine's linear-spine grammar in-canvas. No server runtime, no LangChain surface — a pure client view over `WorkflowDefinition`. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **`zundo`** | **^2.3.0** | Undo/redo (the one thing React Flow omits). A ~1 KB `temporal` middleware for zustand v5. | Wrap the canvas editor's zustand store (or the derived nodes/edges slice) so ⌘Z/⌘⇧Z work over add-node / move / connect / delete / config-edit. Works with `zustand@5.0.13` (already installed). Prefer over a hand-rolled immer-patch stack. |
| **`react-hook-form`** + **`zod`** + **`@hookform/resolvers`** | **^7.66.1** / **^4.1.13** / **^5.2.2** | The shadcn/ui-idiomatic form stack for the **side-panel node config** (per-phase fields: prompt, tools whitelist, folder scope, validators, timeouts). shadcn's `<Form>` is built on RHF+zod. | **Optional / net-new.** The existing `PhaseFormPanel.tsx` uses plain controlled inputs and works. Adopt RHF+zod for the richer node-config forms + *instant* client-side field hints. **HARD constraint:** Pydantic (`harness.py` `_StrictBase extra="forbid"` + `reachability.lint_workflow`) stays the **authoritative** validator — the zod schemas are a client-side *mirror for fast feedback only*, never a fork. Keep the live gauntlet verdict server-authoritative (call the validate/lint API on change). |
| **`elkjs`** *(defer)* | ^0.9.x | Auto-layout engine (maintained; the Java ELK ported to JS) — auto-arrange nodes if a graph ever needs it. | **Do NOT add up front.** The authored spine is a deterministic vertical stack (hand-rolled, as `PhaseSpineGraph` already does). Add `elkjs` **only** if the run-viz depicts `llm_batch_agents` fan-out as a branching team layout. Preferred over `dagre` because **`dagre`/`@dagrejs/dagre` is effectively unmaintained**; `elkjs` is active. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite 8 (installed) | Dev server + bundler | React Flow v12 is ESM-first and Vite-native — zero config. Import its stylesheet once: `import '@xyflow/react/dist/style.css'` (then theme via Tailwind/CSS vars to Deep Midnight). |
| `onlyRenderVisibleElements` prop | Built-in viewport culling | React Flow's answer to node-count scale. At the expected 5–50 phases (harness workflows are short) it is **not** needed; flip it on only if a run-viz ever renders large batch fan-outs. |
| Existing keyboard-accessible spine (`PhaseSpineGraph.tsx`) | a11y fallback | Keep it. A drag-canvas is inherently hard to make WCAG-AA (the v3.3 A11Y-01 bar). The read-only `<button>`-per-node spine is a legitimate keyboard/screen-reader alternative view — retain it as the accessible fallback, don't delete it. |

## Installation

```bash
# Core — the canvas (MIT)
npm install @xyflow/react

# Supporting — undo/redo (zustand-native), + the shadcn form stack for node config
npm install zundo react-hook-form zod @hookform/resolvers

# Auto-layout — DEFER. Install ONLY if run-viz needs branching batch-fan-out layout:
# npm install elkjs
```

No backend Python additions are required for the canvas or run-viz — both read/write the existing `WorkflowDefinition` JSON via the existing authoring API (`generateWorkflow` / `createWorkflowDraft` / `updateWorkflowDraft`) and the existing run stream. Connector work (req #3) is a separate, later Python/infra decision (see the option space below).

## Integration points into the existing engine (the load-bearing detail)

| Existing artifact | Role in v3.6 | Constraint |
|---|---|---|
| `backend/app/models/harness.py` — `WorkflowDefinition` / 6-member `PhaseConfig` union / `ValidatorSpec` | The canvas's **serialization target** — it is the single source of truth. Nodes ⇢ `PhaseSpec` (`slug`, `phase_index`, `config`, `validators`, `name`); edges ⇢ run-order (`i→i+1`, implicit in `phase_index`) + `skip_to_phase:<slug>` on-fail. | `extra="forbid"` means the canvas can emit **only** known fields — a safety net: an invalid drawing 422s at save. The 6 phase types are the closed `nodeTypes` set. |
| `frontend/src/components/workflows/PhaseSpineGraph.tsx` (read-only vertical spine) | **The thing being made editable.** Its glyph vocabulary (`PHASE_GLYPHS`), skip-edge parsing (`parseSkipTarget`), and node-title fallback port directly onto React Flow custom nodes/edges. | Keep it as the **a11y fallback view** + the "View only" preview. The G-5 red line still holds: the canvas MUST NOT import/mutate the live run-surface `PhaseTimeline`/`PhaseCard`. |
| `frontend/src/pages/WorkflowBuilderPage.tsx` + `PhaseFormPanel.tsx` | The canvas is a **third door** next to describe-first + the read-only-spine+form editor. The `BuilderDefinition` state shape, `onPhaseChange` immutable-merge, and create-once-then-PATCH persist (`onPersist`) are reused verbatim. | **Preserve-v1/revert (operator HARD gate #1):** the new canvas is a NEW route/component behind a feature flag. Flag off → today's describe-first + read-only-spine flow is byte-identical. |
| `reachability.lint_workflow` + the 8-stage publish gauntlet (llm_judge hard-wall) | **Live in-canvas validation** — the "can't draw an invalid/unsafe workflow" requirement. Call the existing lint/validate endpoint on graph change; surface orphan / `INPUT_UNSATISFIED` / unreachable-skip as inline node badges. | The gauntlet stays **server-authoritative**. Client zod is fast-feedback only. Publish still runs the full gauntlet — the canvas just moves the *first* feedback earlier. |
| `tool_dispatcher` per-phase tool whitelist (single dispatch guard) | Node config exposes the whitelist as plain-verb toggles ("Find documents" = `search_documents`, etc., extending the v3.3 plain-language layer + SEED-085). Also the **governance rail future connectors ride** (req #3). | The whitelist is the security boundary; the canvas renders it, never widens it beyond what the guard allows. |
| The live run stream (`usePhases` / run surface, Phases 094/095/103) | The **run-observability** view. Option A: a **read-only React Flow instance** driven by live phase state — active node highlighted, `animated` edges on the running transition, gate pass/fail chips on nodes. Option B: extend the existing timeline. React Flow's `animated` edge + node-state styling makes Option A cheap and reuses the authoring node components. | Must stay TRUTHFUL to the schema (the SEED-086 / 103 "no fake DAG" honesty rule): the spine is `i→i+1` + one dashed skip; `llm_batch_agents` is the ONLY real fan-out. |

## Alternatives Considered

| Recommended | Alternative | When the Alternative Would Win (and why it doesn't here) |
|-------------|-------------|-------------------------|
| `@xyflow/react` | **`reactflow`** (the v11 npm package name) | Same library, old name. v12 renamed to `@xyflow/react` + improved perf and SSR. **Use `@xyflow/react`, not `reactflow`** — the latter is v11 and frozen. |
| `@xyflow/react` | **Rete.js** | Rete is a *dataflow/compute-graph* framework (nodes process data through sockets) — great for node-based *computation editors*, wrong mental model for an ordered, governed phase spine. Smaller community (36K vs 109K weekly). No advantage here. |
| `@xyflow/react` | **AntV X6** | MIT, powerful, but its React story is a wrapper over a vanilla/Vue-leaning core — nodes are not first-class React components, so Tailwind/shadcn theming + the app's React architecture fight it. Choose X6 only for a non-React or heavily-BPMN diagram surface. |
| `@xyflow/react` | **tldraw** | Infinite-canvas SDK — **not workflow-shaped** (flowcharts are an awkward side-path) AND **not MIT**: the tldraw SDK license requires a license key in production and shows a "Made with tldraw" watermark unless you buy a commercial license. A licensing + fit trap for a governed workflow builder. Avoid. |
| `@xyflow/react` | **Drawflow / LiteGraph.js** | Drawflow is a tiny vanilla-JS canvas (no React model, thin maintenance); LiteGraph targets game/audio node graphs. Neither fits a React-19 governed authoring surface. |
| `zundo` | immer-patch history stack (hand-rolled) | Viable but more code + a new `immer` dep. `zundo` is zustand-native, <1 KB, and the app already uses zustand — no reason to hand-roll. |
| `elkjs` (only if needed) | `dagre` / `@dagrejs/dagre` | `dagre` is a simpler drop-in but **unmaintained**; `elkjs` is active + more configurable. For our linear spine, **neither** is needed initially — hand-rolled vertical layout wins on simplicity. |
| `react-hook-form` + `zod` | Keep plain controlled inputs (status quo) | The existing `PhaseFormPanel` controlled inputs already work. RHF+zod is the *idiomatic shadcn upgrade* for richer node-config forms, but it is **optional** — adopt it for DX, not necessity, and never let zod fork the Pydantic source of truth. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **LangGraph / LangChain** (as a graph runtime or agent framework) | Violates the project's HARD rule (raw-SDK only). The harness engine already IS the governed graph executor; adding LangGraph forks the runtime and duplicates orchestration the app owns. | The existing `harness_engine.run_workflow` + `PHASE_TYPE_REGISTRY`. The canvas is a **view**, not a runtime. |
| **Flowise / LangFlow as the runtime** | These ARE workflow *engines* (their canvas is bolted to their own executor + LangChain under the hood). Adopting either replaces the governed engine — the exact "engine rewrite" this milestone forbids. Study them as **UX references** (operator HARD gate #2), never as dependencies. | Take the visual/UX patterns; keep our engine. |
| **n8n as an embedded runtime** | n8n is a full automation engine. Running it would create a **competing workflow runtime** beside the harness (two governance models, two schemas). SEED-013 already frames n8n as an *external consumer* of our API, not something we host inside. | Reference n8n's **declarative node/credential model** as a design pattern for our own connector registry; do not embed n8n. |
| **tldraw (in production)** | Non-MIT SDK-license + mandatory watermark/license-key in production (see Alternatives). | `@xyflow/react` (MIT, no key, no watermark). |
| **`reactflow` (v11 package)** | Frozen old-name package; v12 lives at `@xyflow/react`. | `@xyflow/react@^12`. |
| **`dagre` for auto-layout** (if a layout lib is added at all) | Unmaintained. | `elkjs` — and only if the linear spine ever needs auto-arranging (it likely doesn't). |
| **A second source of truth for the graph** (canvas state that diverges from `WorkflowDefinition`) | Would fork the shared path — the canvas and the two existing doors would drift. | Controlled React Flow derived from, and serialized back to, the one `WorkflowDefinition` JSON. |

## External-connector framework — OPTION SPACE (operator HARD gate #3 — framed, NOT decided)

The milestone MUST answer up front: **ship our own connector framework, or sequence with / depend on the Open Platform track (SEED-013/031)?** Research frames the options; it does not choose. Key context already in-repo: a `tool_dispatcher` with **per-phase tool whitelists at a single dispatch guard** (the governance rail any external action would ride), a documented **app-as-MCP-server** direction (SEED-013 Phase 2), MCP *client* wiring already used by the dev tooling, and SEED-013's worked example that already names **n8n as the external "dumb pipe" consumer** of our API.

| Option | What it is | Fit with our governance + no-LangChain + self-hostable direction | Cost / risk |
|---|---|---|---|
| **A. MCP-as-connector-substrate** *(lean, most-aligned lean)* | Each external action (send email, create JIRA issue) = a **tool** registered into the existing per-phase whitelist. Connect to external MCP servers (Gmail/JIRA MCP servers exist in the ecosystem) and/or expose our own. | **Best fit.** Rides the existing dispatch guard + whitelist governance unchanged — a connector is "just another gated tool." Zero LangChain. Aligns with the already-planned app-MCP-server. Per-phase whitelist = the safety rail is already visual-able. | MCP spec still evolving (pin a version — SEED-013 risk note). Each connector still needs an MCP server + auth. |
| **B. Nango (self-hostable)** | Open-source, self-hostable embedded-integration platform: managed OAuth token refresh + syncs + webhooks for 400+ APIs; integrations are code in a repo (writable by a coding agent). | Good if the curated connector set grows beyond a handful — solves the **OAuth-token-refresh** grind we'd otherwise hand-roll per provider. Self-hostable matches the on-prem/BYO deployment direction. Not a runtime (it's a connectivity layer), so no engine fork. | New service to run/operate. License is fair-source (self-host free edition) — verify terms at decision time. |
| **C. Paragon / ActionKit** | Closed-source embedded iPaaS + a separate agent tool-calling product (ActionKit) with an official MCP server + white-label Connect Portal. | Fastest to a broad connector catalog + embeddable end-user OAuth UI. BUT **closed runtime + license checks against Paragon's cloud** conflict with the self-hostable/open direction and the "no external runtime" stance. | Enterprise budget; vendor lock-in; runs config against Paragon cloud. Only if enterprise-budget + willing to accept a closed dependency. |
| **D. Native provider SDKs per connector** | Hand-write each connector against the provider's own REST/SDK (Gmail API, Atlassian/JIRA REST). | Maximum control + zero new platform dep; fine for a **small curated set** (email + JIRA). Doesn't scale to "and other providers" without turning into a maintenance job (SEED-013's "forever job" warning). | Per-connector OAuth + maintenance owned by us. |
| **E. n8n node-model as a design PATTERN** | Not a runtime — borrow n8n's declarative node + credential JSON contract to shape **our own** connector registry. | Useful design reference for a home-grown registry that plugs into the tool-dispatcher. | Design input only; not a shippable dependency. |

**Framing recommendation to surface (not a decision):** The path that respects every constraint (no new runtime, no LangChain, governed-by-the-existing-whitelist, self-hostable) is **A (MCP-as-connector-substrate) riding the existing per-phase tool whitelist**, with **B (Nango)** adopted for managed OAuth *if* the connector count grows, and **D** acceptable for the first one or two hand-picked connectors (email/JIRA). **C (Paragon)** only under an enterprise-budget, closed-dependency-accepted scenario. The genuine open question the milestone must resolve is **sequencing**: does v3.6 ship a minimal connector slice itself, or does it *depend on* the Open Platform milestone (SEED-013) landing the app-MCP-server + service-accounts first? That is a roadmap decision, not a library choice.

## Stack Patterns by Variant

**If the run-observability view is built as a second React Flow instance (recommended):**
- Reuse the authoring custom-node components in a `nodesDraggable={false}` / `nodesConnectable={false}` read-only React Flow, driven by the live `usePhases` run state.
- Use React Flow `animated` edges on the currently-executing transition + node-level "running/passed/failed" styling; gate pass/fail = a chip on the node.
- Because it reuses the authoring nodes, the "author view" and "run view" stay visually coherent — the non-technical user watches *their own drawing* execute.

**If the run-observability view instead extends the existing timeline:**
- Keep `PhaseTimeline`/`PhaseCard` and add active-node emphasis there. Lower net-new surface, but the author-view↔run-view visual coherence is weaker. Prefer the React Flow variant unless G-5 hot-file pressure on the run surface argues otherwise.

**If in-canvas validation feels laggy calling the server on every change:**
- Debounce the lint/validate API call; render a lightweight client-side zod mirror for *instant* per-field hints, reconciled by the authoritative server verdict. Never let the client mirror become the gate.

**If node count ever exceeds ~150 (unlikely — harness workflows are short):**
- Flip on React Flow's `onlyRenderVisibleElements` viewport culling. Not needed at the expected 5–50 phases.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@xyflow/react@12.11.2` | React 19.2.4 / react-dom 19.2.4 (installed) | Peer range `react: ">=17"` — React 19 is explicitly in-range; v12 added SSR/hydration + React-19-era support. MIT. |
| `@xyflow/react@12.11.2` | `zustand@5.0.13` (installed) | React Flow uses zustand internally; no version conflict. Coherent with the app's existing store. |
| `zundo@2.3.0` | `zustand@4.2.0+` / `zustand@5` | Works with zustand v5 (installed 5.0.13). ~1 KB temporal middleware. |
| `react-hook-form@7.66.1` | React 19 | React-19-compatible; shadcn `<Form>` is built on it. |
| `zod@4.1.13` | `@hookform/resolvers@5.2.2` | Resolvers v5 supports zod v4. Pin resolvers ≥5 for zod-4. |
| `elkjs` (deferred) | Vite 8 / React Flow 12 | Runs in a Web Worker for large graphs; unnecessary for the linear spine. |

## Sources

- npm registry / xyflow repo `packages/react/package.json` (via `gh api`) — **@xyflow/react latest = 12.11.2**, `peerDependencies.react: ">=17"`, MIT — HIGH
- [reactflow.dev](https://reactflow.dev/) + [Migrate to React Flow 12](https://reactflow.dev/learn/troubleshooting/migrate-to-v12) + [Performance docs](https://reactflow.dev/learn/advanced-use/performance) — v12 rename, `onlyRenderVisibleElements`, MIT, custom React nodes — HIGH
- [React Flow layouting overview](https://reactflow.dev/learn/layouting/layouting) + [xyflow discussion #1786](https://github.com/xyflow/xyflow/discussions/1786) — dagre unmaintained / elkjs active; layout only if needed — HIGH (maintenance status) / MEDIUM (our need)
- [zundo — npm](https://www.npmjs.com/package/zundo) + [charkour/zundo](https://github.com/charkour/zundo) — v2.3.0, temporal middleware, zustand v4.2+/v5, <700 B — HIGH
- [react-hook-form / zod / @hookform/resolvers versions](https://ui.shadcn.com/docs/forms/react-hook-form) (shadcn Form docs + npm) — 7.66.1 / 4.1.13 / 5.2.2, shadcn-idiomatic — HIGH
- [tldraw license](https://tldraw.dev/community/license) + [tldraw license-key docs](https://tldraw.dev/sdk-features/license-key) — NOT MIT; production license-key + watermark — HIGH (the "avoid" rationale)
- [npmtrends: react-flow vs rete / antv-x6](https://npmtrends.com/@antv/x6-vs-bpmn-js-vs-react-flow-renderer) + [React Flow alternative comparisons] — download/adoption + React-fit rationale — MEDIUM
- [Nango: self-hosted integration platforms for AI agents](https://nango.dev/blog/best-self-hosted-api-integration-platforms-for-ai-agents/) + [Paragon vs Nango](https://nango.dev/blog/paragon-vs-nango/) + [Composio: Paragon alternatives](https://composio.dev/content/paragon-alternatives) — connector option space (Nango self-hostable / Paragon+ActionKit MCP / ActionKit) — MEDIUM (framing, not a decision)
- In-repo evidence: `backend/app/models/harness.py` (WorkflowDefinition/PhaseConfig/ValidatorSpec — linear spine + skip_to_phase), `frontend/src/components/workflows/PhaseSpineGraph.tsx` + `PhaseSpine.tsx` (read-only spine to be made editable), `frontend/src/pages/WorkflowBuilderPage.tsx` (BuilderDefinition + persist flow), `frontend/package.json` (React 19.2.4, Vite 8, zustand 5, no canvas/form/zod deps yet), SEED-013 (app-MCP-server + n8n-as-consumer + per-phase whitelist governance) — HIGH

---
*Stack research for: v3.6 Visual / No-Code Workflow Studio — visual authoring canvas + non-technical run-observability layer on the existing governed harness engine*
*Researched: 2026-07-24*
</content>
</invoke>
