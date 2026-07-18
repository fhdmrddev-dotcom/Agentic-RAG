# Phase 124: Workflow Studio UX — Soul + Strict↔Loose - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 9 (4 net-new components/modules + 3 edited-host mounts + 2 preserve-byte-identical)
**Analogs found:** 9 / 9 (all in-repo; pure-frontend re-skin — zero external packages)

> This phase is a **pure-frontend, additive re-skin**. Every datum the new components read already exists in the live code. The dominant discipline is **one shared tier derivation + one shared glyph map** consumed by all render sites, and a **G-5 red line** keeping the run-surface soul a sibling of `PhaseTimeline`/`PhaseCard`, never an internal edit. All analogs below were read live this session; line numbers are verified.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/src/components/workflows/soulData.ts` (NET-NEW, extract) | utility | transform (def JSONB → atoms) | `WorkflowsPage.tsx:44-139` (`tierForDefinition` / `PHASE_GLYPHS` / `entryInputKeys`) | exact (verbatim extraction) |
| `frontend/src/components/workflows/WorkflowSoul.tsx` (NET-NEW) | component | request-response (read-only render) | `WorkflowsPage.tsx:184-198` (`TierBadge`) + `PhaseChain` (155-182) | role-match (presentational atom over derived data) |
| `frontend/src/components/workflows/PhaseSpine.tsx` (NET-NEW, horizontal) | component | request-response (read-only render) | `PhaseSpineGraph.tsx` (vertical spine + `PHASE_GLYPHS` 24-31) | role-match (same glyph vocab, different axis) |
| `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` (NET-NEW shell) | component | event-driven (intra-view state fork) | `WorkflowsPage.tsx:209-212` (`PageView` intra-view state) + `WorkflowBuilderPage.tsx:271-352` (describe box) | role-match (wraps existing Builder) |
| `frontend/src/components/panel/WorkspacePanel.tsx` (EDIT — additive sibling only) | component (mount) | request-response | `WorkspacePanel.tsx:163-191` (the `<PanelSection>` idiom itself) | exact (copy the established sibling idiom) |
| `frontend/src/components/workflows/PublishGauntlet.tsx` (EDIT — prepend only, D-06) | component (mount) | request-response | `PublishGauntlet.tsx` modal body (prepend point) | exact (prepend `<WorkflowSoul scale="pub">`) |
| `frontend/src/pages/WorkflowsPage.tsx` (EDIT — restyle card to scale-keyed soul + door entry) | page | request-response | self (`TierBadge`/`PhaseChain`/`PageView`) | exact |
| `frontend/src/components/panel/PhaseTimeline.tsx` | component | streaming (live) | — | **PRESERVE BYTE-IDENTICAL (G-5 / D-07)** |
| `frontend/src/components/panel/PhaseCard.tsx` | component | streaming (live) | — | **PRESERVE BYTE-IDENTICAL (G-5 / D-07)** |
| `frontend/src/components/layout/ChatLayout.tsx` `doRun` (91-100) | utility (launch) | request-response | — | **PRESERVE BYTE-IDENTICAL (D-01)** |

---

## Pattern Assignments

### `frontend/src/components/workflows/soulData.ts` (utility, transform) — NET-NEW (extract + share)

**Analog:** `frontend/src/pages/WorkflowsPage.tsx` (the canonical def→atom helpers — currently page-private, must be extracted so all 3 soul sizes + both doors consume ONE copy).

**Imports pattern** (`WorkflowsPage.tsx:37`):
```tsx
import { deriveTier, type CitationPolicy, type ValidatorKind } from "@/components/workflows/deriveTier"
```

**Tier derivation — EXTRACT VERBATIM** (`WorkflowsPage.tsx:79-129`). This is the single highest-leverage excerpt: the strictest-emit-policy selection (`POLICY_ORDER` / `stricterPolicy`) + the validator-kind union, then `deriveTier`. Re-implementing it per soul size is the exact drift this phase's invariant forbids:
```tsx
const ALL_VALIDATOR_KINDS: ReadonlySet<string> = new Set<ValidatorKind>([
  "citations_required", "output_file_valid", "freshness", "structure_check", "llm_judge_rubric",
])
const POLICY_ORDER: readonly CitationPolicy[] = ["draft", "partial", "flag", "strict"]
function stricterPolicy(a: CitationPolicy, b: CitationPolicy): CitationPolicy {
  return POLICY_ORDER.indexOf(b) > POLICY_ORDER.indexOf(a) ? b : a
}
function tierForDefinition(def: DefShape | null | undefined) {
  const phases = def?.phases ?? []
  let citationPolicy: CitationPolicy = "draft"
  let sawEmit = false
  for (const p of phases) {
    if (p.config?.phase_type === "llm_emit") {
      const cp = p.config?.citation_policy
      if (cp === "strict" || cp === "flag" || cp === "partial" || cp === "draft") {
        citationPolicy = sawEmit ? stricterPolicy(citationPolicy, cp) : cp
        sawEmit = true
      }
    }
  }
  const kinds = new Set<ValidatorKind>()
  for (const p of phases)
    for (const v of p.validators ?? [])
      if (v.kind && ALL_VALIDATOR_KINDS.has(v.kind)) kinds.add(v.kind as ValidatorKind)
  return deriveTier(citationPolicy, kinds)   // ← deriveTier.ts:102, pure + client-side
}
```

**Glyph map — EXTRACT + SHARE** (`WorkflowsPage.tsx:44-51`, identical by value at `PhaseSpineGraph.tsx:24-31`). Currently duplicated in 3 files; centralize to ONE export so the `◆` emit node can never desync:
```tsx
export const PHASE_GLYPHS: Record<string, string> = {
  programmatic: "⚙", llm_single: "✎", llm_agent: "🤖",
  llm_batch_agents: "⛓", llm_human_input: "☺", llm_emit: "◆",
}
```

**Needs atom — EXTRACT** (`WorkflowsPage.tsx:131-139`). Handles the `input_keys` → `inputs[].key` → `["kickoff_prompt"]` fallback chain:
```tsx
function entryInputKeys(def: DefShape | null | undefined): string[] {
  if (!def) return []
  if (Array.isArray(def.input_keys) && def.input_keys.length > 0) return def.input_keys
  const fromInputs = (def.inputs ?? []).map((i) => i?.key).filter((k): k is string => !!k)
  if (fromInputs.length > 0) return fromInputs
  return ["kickoff_prompt"]
}
```

**Output/deliverable resolver — NEW (mechanism verified; see A1/A2 below).** The `DefShape` read-shape to reuse is `WorkflowsPage.tsx:61-74`. The deliverable mechanism (D-03): a workflow WITH a terminal `llm_emit` phase produces a file; ABSENT → honest "produces: answer in chat". Verified field: `phases[].config.phase_type === "llm_emit"` (backend `LlmEmitPhaseConfig`, harness.py:123-154; `emitter` default `"render_template"` at harness.py:141). **The friendly label string (e.g. "Status Report · .docx") is NOT a guaranteed static field** — A1 below.

---

### `frontend/src/components/workflows/WorkflowSoul.tsx` (component, request-response) — NET-NEW

**Analog:** `frontend/src/pages/WorkflowsPage.tsx` — `TierBadge` (184-198) is the scale-keyed-atom seed; generalize to a `scale: "card" | "run" | "pub"` prop.

**Tier-chip pattern to generalize** (`WorkflowsPage.tsx:184-198`) — glyph + WORD, never colour-alone (WCAG 1.4.1); `data-tier` carries the invariant test hook:
```tsx
function TierBadge({ def }: { def: DefShape | null | undefined }) {
  const tier = tierForDefinition(def)   // ← the ONE shared derivation (now from soulData.ts)
  return (
    <span data-testid="tier-badge" data-tier={tier.id} title={tier.description}
      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wide text-foreground">
      <span aria-hidden="true">{tier.glyph}</span>{tier.label}
    </span>
  )
}
```

**Honest empty-state pattern (D-03)** — the atom is ALWAYS rendered, never hidden:
- `business_requirement == null` (draft; harness.py:240 null-on-draft) → render **"draft · purpose not declared yet."**
- no terminal `llm_emit` phase → render **"produces: answer in chat"** (never a fabricated deliverable name).
- Anti-pattern to avoid (Pitfall 4): any conditional that HIDES the purpose/output atom, or a hardcoded deliverable label.

**XSS rule (V5 — Security):** `business_requirement`, phase names, input keys, deliverable labels are user-authored. Render as **plain React text children** (auto-escaped) — **never** `dangerouslySetInnerHTML`. Mirrors the existing PhaseCard/PhaseSpineGraph discipline (all agent strings rendered as escaped children).

**Scale-keyed atom contract (046-A, SC#1+SC#2):** ONE renderer per atom, `scale` prop tunes layout/typography only — data + derivation identical across card/run/pub. Purpose is HERO at every size. Atom order LOCKED to 046-A (discretion is copy/tokens/filenames only).

---

### `frontend/src/components/workflows/PhaseSpine.tsx` (component, request-response) — NET-NEW (horizontal glyph-dot)

**Analog:** `frontend/src/components/workflows/PhaseSpineGraph.tsx` (the read-only VERTICAL spine; the horizontal glyph-dot row is a separate net-new component sharing only the glyph vocab).

**Glyph map source** — now imported from `soulData.ts`, NOT re-declared (`PhaseSpineGraph.tsx:24-31` is the donor):
```tsx
const PHASE_GLYPHS: Record<string, string> = {
  programmatic: "⚙", llm_single: "✎", llm_agent: "🤖",
  llm_batch_agents: "⛓", llm_human_input: "☺", llm_emit: "◆",
}
```

**Emit-node tint pattern to reuse** (`PhaseSpineGraph.tsx:150, 166-177`) — the `◆` `llm_emit` node is visually tinted; copy the `accent-violet` border/text treatment:
```tsx
const isEmit = phase.config.phase_type === "llm_emit"
// node bullet className:
isEmit ? "border-accent-violet text-accent-violet" : "border-border text-foreground"
```

**Ordering pattern** (`PhaseSpineGraph.tsx:103`) — sort by `phase_index`, input order irrelevant:
```tsx
const ordered = [...phases].sort((a, b) => a.phase_index - b.phase_index)
```

**046-A spine deltas (LOCKED — must match the sketch):** type ribbons + phase-index numbers **STRIPPED** (the analog renders `{phase.config.phase_type}` ribbon at line 207-209 and `phase_index {n}` at 211-213 — both DROPPED in the new horizontal spine). Phase names become quiet `title=` at card scale, visible at run/pub scale. Anti-pattern (Pitfall 5): a spine showing "server"/"agent" ribbons or index digits is a sketch-fidelity failure.

---

### `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` (component, event-driven) — NET-NEW shell

**Analogs:** (a) intra-view state fork — `WorkflowsPage.tsx:209-212`; (b) Door A describe box lineage — `WorkflowBuilderPage.tsx:271-352`; (c) Door B IS the existing `WorkflowBuilderPage` drafted view.

**Intra-view fork pattern** (`WorkflowsPage.tsx:209-212`) — router-less local state, the established Studio idiom (no route, no API):
```tsx
type PageView = "library" | "builder"
export function WorkflowsPage({ folders, onLaunch }: WorkflowsPageProps) {
  const [pageView, setPageView] = useState<PageView>("library")
```

**Door A "Describe & run" — reuse the describe-box shape/copy** (`WorkflowBuilderPage.tsx:271-352`, the 018-A lineage). The textarea + draft CTA + honest hint:
```tsx
<textarea aria-label="business requirement" value={describe}
  onChange={(e) => setDescribe(e.target.value)}
  placeholder="Describe the goal in plain language…" rows={5}
  className="w-full resize-none rounded-lg border border-border bg-card px-4 py-4 ..." />
<button type="button" disabled={!canDraft} onClick={onDraft}
  className="rounded-md bg-primary px-5 py-2 ...">
  {state.phase === "composing" ? "Composing…" : "Draft the workflow"}
</button>
```
Door A also shows the soul preview (`<WorkflowSoul scale="card">`) + the **"switch to Author & govern ›"** strip (047-A — nothing lost by picking fast; advanced is one click away, never removed).

**Door B "Author & govern" — REUSE the existing Builder (do NOT rebuild advanced controls).** The govern door mounts `WorkflowBuilderPage` (drafted view): the read-only `PhaseSpineGraph` (left) + the 400px push `PhaseFormPanel` (right). The `PhaseFormPanel` already owns `citation_policy` (PhaseFormPanel.tsx:688), gate config, per-phase `folder_scope`, and per-phase `model`, and its change handlers already drive `deriveTier` live. Drafted-view shell to mount (`WorkflowBuilderPage.tsx:354-358`):
```tsx
// ── DRAFTED: read-only spine graph (left) + 400px push form panel (right). ──
return (
  <div className="flex h-full flex-col bg-background">
    <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
```

**Locked door behaviors (047-A — LOCKED):** govern-door advanced controls **recompute the tier live** (reuse the existing Builder dial path → `deriveTier`); `llm_judge_rubric` is **LOCKED always-on** (`TIERS.*.judgeAlwaysOn === true` at deriveTier.ts:49, 63, 71, 77 + the gauntlet hard wall) — render it non-removable, do NOT re-model it. A persistent **"‹ both doors"** return is always present.

---

### `frontend/src/components/panel/WorkspacePanel.tsx` (mount — EDIT, additive sibling ONLY) — G-5 RED LINE

**Analog:** the file itself — copy the established `<PanelSection>` sibling idiom (`WorkspacePanel.tsx:163-191`).

**Additive-sibling pattern (D-07 / G-5)** — add a NEW `<PanelSection>` ABOVE the existing `title="Workflow"` section at line 187. The `PhaseTimeline` section stays UNCHANGED:
```tsx
// WorkspacePanel.tsx:187-191 — add a NEW <PanelSection> ABOVE this; do NOT edit PhaseTimeline
{showTimeline && (
  <PanelSection title="Workflow" count={phases.length || undefined}>
    <PhaseTimeline threadId={threadId} />   {/* ← UNCHANGED. Soul header is a separate section. */}
  </PanelSection>
)}
```
The new section renders `<WorkflowSoul scale="run">`. **Run-frame definition sourcing (A2 — resolved):** the run-surface `ThreadWorkflowState` (api.ts:1069-1104) carries only run-state `phases` (`{slug, phase_index, status}` — WorkflowPhaseState, api.ts:1108-1112) + `definition_name`, **NOT** the full authored definition. The run-soul therefore needs an **additive read of the published definition by id** (the same `WorkflowDefinitionJSON` JSONB the card already gets via `PublishedWorkflow.definition`, api.ts:1121-1126) — a sibling-only read, **never** by consuming `usePhases`/`PhaseCard` internals.

**Anti-patterns (Pitfall 2 + 3):** any diff line inside `panel/PhaseTimeline.tsx` or `panel/PhaseCard.tsx`; a new prop on `PhaseCardProps`; the soul header consuming `usePhases(threadId)` for live phase state, or rendering an elapsed timer / per-phase slug (would re-open BUG-260610-01 / BUG-260609-04 — flip their `re_open_trigger` if touched).

---

### `frontend/src/components/workflows/PublishGauntlet.tsx` (mount — EDIT, prepend ONLY, D-06)

**Analog:** the file itself — prepend `<WorkflowSoul scale="pub">` ABOVE the existing modal body. The 8-stage `STAGES` ladder (PublishGauntlet.tsx:58-67) + verdict rendering stay BYTE-UNCHANGED (the ladder re-skin is WUX-03 / Phase 127).

**Prepend point:** above the gauntlet content inside the existing modal shell (which already owns the z-9000/Escape/focus contract — PublishGauntlet.tsx:1-40 header). Reuse the modal as-is; only the soul block is new.

**Anti-pattern (D-06):** touching the gauntlet ladder/verdict rendering. Soul block PREPEND only.

---

### PRESERVE BYTE-IDENTICAL (no analog — do-not-touch)

| File | Role | Why preserved |
|------|------|---------------|
| `frontend/src/components/panel/PhaseTimeline.tsx` | streaming (live timeline) | D-07 G-5 RED LINE. Soul header is a SIBLING in `WorkspacePanel`, never an edit here. Verify with `git diff --stat` (must be empty). |
| `frontend/src/components/panel/PhaseCard.tsx` | streaming (live card) | D-07 G-5 RED LINE. No new prop, no internal thread. |
| `frontend/src/components/layout/ChatLayout.tsx` `doRun` (91-100) | launch | D-01 — `createThread → postMessage(workflowDefinitionId) → create_workflow_run` is the ONLY launch path. The two-door fork lives at the Studio ENTRY only; the library-card Run is never wrapped. |

**Preserved launch path** (`ChatLayout.tsx:91-100`):
```tsx
const doRun = useCallback(async (def: PublishedWorkflow, kickoff: string) => {
  const thread = await createThread(def.name)
  await postMessage(thread.id, kickoff, { workflowDefinitionId: def.id })
  await loadThreads(); selectThread(thread); onNavigate("chat")
}, [loadThreads, selectThread, onNavigate])
```

---

## Shared Patterns

### Tier derivation (one source of truth — applies to ALL soul sizes + the govern door)
**Source:** `frontend/src/components/workflows/deriveTier.ts` (`deriveTier` 102-129, `TIERS` 57-79) — REUSE VERBATIM, never duplicate.
**Wrapper to extract + share:** `tierForDefinition` (`WorkflowsPage.tsx:106-128`) → `soulData.ts`.
**Apply to:** `WorkflowSoul` (card/run/pub), `WorkflowDoorSwitch` (govern door live recompute), `PublishGauntlet` soul block.
**Invariant:** card / run / pub MUST render the same `data-tier` for one fixture (the consistency test). The chip is ALWAYS derived (`deriveTier`), never a stored label.
```tsx
// deriveTier.ts:102 — pure, client-side, imports NOTHING from the API client
export function deriveTier(citationPolicy: CitationPolicy, validatorKinds: Set<ValidatorKind>): Tier
// TIERS.STRICT 🔒 / MIDDLE ◐ / LOOSE ○ — each carries { id, glyph, label, description, judgeAlwaysOn:true }
```

### Glyph vocabulary (one map — applies to the spine in every size)
**Source:** `PHASE_GLYPHS` (`WorkflowsPage.tsx:44-51` ≡ `PhaseSpineGraph.tsx:24-31`, duplicated by value).
**Apply to:** `PhaseSpine` (horizontal), and de-dupe the 3 existing copies onto the new `soulData.ts` export.
```tsx
{ programmatic: "⚙", llm_single: "✎", llm_agent: "🤖", llm_batch_agents: "⛓", llm_human_input: "☺", llm_emit: "◆" }
```

### XSS-safe rendering (applies to every atom rendering user-authored strings)
**Source:** existing repo discipline (PhaseCard / PhaseSpineGraph render all agent strings as escaped React text children).
**Apply to:** `business_requirement`, phase names, input keys, deliverable labels in `WorkflowSoul` / `PhaseSpine`.
**Rule:** plain React text children only — never `dangerouslySetInnerHTML`.

### G-5 source-grep backstop (applies to the run-soul component)
**Source:** `PhaseSpineGraph.test.tsx:153-158` — the precedent assertion.
**Apply to:** `WorkflowSoul.test.tsx` (the run-soul source must never import `PhaseTimeline`/`PhaseCard`) + a `git diff --stat` check on the two hot files (must be empty).
```tsx
it("the SOURCE never imports PhaseTimeline or PhaseCard (G-5)", () => {
  const src = workflowSoulSource
  expect(src).not.toMatch(/PhaseTimeline/)
  expect(src).not.toMatch(/PhaseCard/)
})
```

### Honest empty-state (applies to the soul's purpose + output atoms)
**Source:** D-03 contract; field nullability verified (harness.py:240 `business_requirement: str | None`; harness.py:123-154 emit optionality).
**Apply to:** `WorkflowSoul` purpose atom (null → "draft · purpose not declared yet") + output atom (no terminal `llm_emit` → "produces: answer in chat"). Atom ALWAYS rendered.

---

## No Analog Found

None — every file has a close in-repo analog. Two presentation-data shapes need a plan-time confirmation (not governance risks; from RESEARCH Assumptions Log):

| Item | Role | Data Flow | Confirmation needed |
|------|------|-----------|---------------------|
| Output-atom deliverable LABEL string (A1) | utility (resolver) | transform | The friendly label (e.g. "Status Report · .docx") is NOT a guaranteed static field. Verified mechanism only = "terminal `llm_emit` present → file; absent → chat". Match 046-A's rendered example; derive label from workflow name + emitter/asset kind; confirm exact string with operator at UAT. The honest fallback ("produces: answer in chat") is LOCKED. |
| Run-surface full-definition source (A2 — resolved direction) | component (run-soul) | request-response | `ThreadWorkflowState` (api.ts:1069-1104) does NOT carry the authored definition (only run-state phases + `definition_name`). Source the published `WorkflowDefinitionJSON` additively by id (same JSONB the card uses via `PublishedWorkflow.definition`) — sibling-only read, never `PhaseCard`/`usePhases` internals. |

---

## Metadata

**Analog search scope:** `frontend/src/components/workflows/`, `frontend/src/components/panel/`, `frontend/src/pages/`, `frontend/src/components/layout/`, `frontend/src/lib/api.ts`, `backend/app/models/harness.py`.
**Files scanned (read live this session):** `deriveTier.ts`, `PhaseSpineGraph.tsx`, `WorkflowsPage.tsx`, `WorkspacePanel.tsx`, `PublishGauntlet.tsx`, `WorkflowBuilderPage.tsx`, `PhaseTimeline.tsx`, `PhaseSpineGraph.test.tsx`, `api.ts` (run-frame + PublishedWorkflow types), `ChatLayout.tsx` (`doRun` + mount), `harness.py` (`WorkflowDefinition`).
**Pattern extraction date:** 2026-06-27
**Acceptance bar:** sketches 046-A (purpose-led soul) + 047-A (explicit-fork two doors) — operator-approved 2026-06-26; the build MUST match them (SC#4). Discretion is filenames / CSS tokens / copy strings only — subject to matching the sketches.
