# Phase 137: Skill Evals Panel UI (PANEL-01) - Pattern Map

**Mapped:** 2026-07-03
**Files analyzed:** 17 (11 net-new · 6 modified)
**Analogs found:** 17 / 17 (this is a pure in-repo consolidation — every file has a strong analog)

> **Framing (from RESEARCH):** This phase is "lift state, re-skin render." `SkillEvalSection.tsx`
> is the **battle-tested machinery source of truth** (survived 133/134/135/136 live UAT). The
> discipline is to LIFT its state + handlers into Studio-level components and only rewrite the JSX
> against the operator-approved sketches (053–057). Do NOT re-implement the run/SSE/reconcile logic.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/src/App.tsx` (M) | config/nav-state | request-response | self (`tunerSkillId` block, :21-25) | exact (extend in place) |
| `frontend/src/components/layout/ChatLayout.tsx` (M) | layout/router | request-response | self (`skill-tuner` branch, :316-324) | exact (extend in place) |
| `frontend/src/pages/SkillStudioPage.tsx` (N) | page (focused full-surface) | request-response | `frontend/src/pages/SkillTunerPage.tsx` | exact |
| `frontend/src/components/skills/studio/EvalsTab.tsx` (N) | component (stateful container) | event-driven (SSE) + request-response | `frontend/src/components/skills/SkillEvalSection.tsx` | exact (lift-state source) |
| `frontend/src/components/skills/studio/RunBar.tsx` (N) | component (picker + launch) | request-response | `SkillEvalSection.tsx` picker+Run (:569-614) | role-match |
| `frontend/src/components/skills/studio/RunHistory.tsx` (N) | component (expandable list) | request-response | `SkillEvalSection.tsx` readout (:836-921) | role-match |
| `frontend/src/components/skills/studio/RunCaseDetail.tsx` (N) | component (per-case detail + ratings) | request-response | `SkillEvalSection.tsx` per-arm render (:844-916) + `handleRate` (:419-427) | exact |
| `frontend/src/components/skills/studio/ProposalCard.tsx` (N) | component (proposal lifecycle) | request-response | `SkillEvalSection.tsx` proposal block (:650-834) + handlers (:432-513) | exact |
| `frontend/src/components/skills/studio/VersionsTab.tsx` (N) | component (table + compare/diff) | request-response + transform | `SkillTestCasesSection.tsx` version list (:200-214) + `lib/lineDiff.ts` | role-match |
| `frontend/src/components/skills/studio/LifecycleStepper.tsx` (N) | component (shared status) | request-response | `SkillEvalSection.tsx` gate render (:539-567) + `types` PublishGate | role-match (chrome is net-new/sketch) |
| `frontend/src/components/skills/studio/TriggeringTab.tsx` (N) | component (thin wrapper) | none (mount-only) | `ChatLayout.tsx` `SkillTunerPage` mount (:324) | exact |
| `frontend/src/components/skills/SkillFormDialog.tsx` (M) | component (detail panel) | request-response | self (section mounts, :535-550) | exact (remove + add) |
| `frontend/src/components/skills/PublishGateDialog.tsx` (M) | component (dialog) | request-response | self (unmet branch, :117-126) | exact (add link) |
| `frontend/src/components/skills/SkillCard.tsx` (M) | component (card) | request-response | self (PublishGateDialog mount, :269-276) | exact (thread callback) |
| `frontend/src/pages/SkillsPage.tsx` (M) | page (3-pane) | request-response | self (`onTuneSkill` entry, :187-207) | exact (add "Open studio") |
| Test files (N) — `*.test.tsx` for the studio components | test | — | `SkillEvalSection.test.tsx` (fresh-mock pattern) | exact |
| `frontend/src/lib/api.ts` (M, optional) | client fn | request-response | self (existing eval/version fns) — likely client-side join, no new fn | role-match |

---

## Pattern Assignments

### `frontend/src/App.tsx` (config/nav-state, MODIFY in place)

**Analog:** self — the shipped `tunerSkillId` precedent.

**ActiveView union** (`:9`) — add `"skill-studio"`:
```tsx
export type ActiveView = "chat" | "documents" | "skills" | "settings" | "library-health" | "workflows" | "classification-rules" | "governance" | "skill-tuner"
//  ADD: | "skill-studio"
```

**Selected-skill + navigator state** (`:21-25`) — the exact shape to clone for `studioSkillId` + `studioTab`:
```tsx
const [tunerSkillId, setTunerSkillId] = useState<string | null>(null)
const handleTuneSkill = (skillId: string) => {
  setTunerSkillId(skillId)
  setActiveView("skill-tuner")
}
```
**Studio analog:** add `studioSkillId` + `studioTab` (`"evals" | "triggering" | "versions"`) state + `handleOpenStudio(skillId, tab)`. **Legacy redirect (D-01):** repoint `handleTuneSkill` to `setActiveView("skill-studio")` with `tab="triggering"` — no orphan Tuner surface. Thread the new state + navigators down to `<ChatLayout>` (`:42-50`) exactly as `tunerSkillId`/`onTuneSkill` are threaded today.

---

### `frontend/src/components/layout/ChatLayout.tsx` (layout, MODIFY in place)

**Analog:** self — the `skill-tuner` mount branch.

**Mount branch** (`:316-324`) — add an analogous `activeView === "skill-studio"` branch BEFORE the trailing `KnowledgeHealthPage` else:
```tsx
) : activeView === "skill-tuner" ? (
  <SkillTunerPage skillId={tunerSkillId} onBack={() => onNavigate("skills")} />
) : (
  <KnowledgeHealthPage />
)
```
**Studio analog:** `<SkillStudioPage skillId={studioSkillId} tab={studioTab} onTabChange={...} onBack={() => onNavigate("skills")} />`. Extend the `Props` interface (`:42`, `:46`) and destructure the new props just like `tunerSkillId` / `onTuneSkill`. Note this branch lives inside the `<main>` else-chain (`:288-328`), NOT the chat/`WorkspacePanel` branch — the full-surface hides the 3-pane SkillsPage.

---

### `frontend/src/pages/SkillStudioPage.tsx` (page, NET-NEW)

**Analog:** `frontend/src/pages/SkillTunerPage.tsx` — the shipped focused-full-surface precedent.

**Component signature + guard** (SkillTunerPage `:51-57`, `:87-94`, `:519-532`):
```tsx
interface Props {
  skillId: string | null   // App holds the selection; null → calm guard
  onBack: () => void       // "‹ Skills" returns
}
export function SkillTunerPage({ skillId, onBack }: Props) {
  const { skills, loading, updateSkill } = useSkills()
  const skill = useMemo(() => skills.find((s) => s.id === skillId) ?? null, [skills, skillId])
  ...
  if (!skillId) { /* calm centered guard + "‹ Skills" back button */ }
```

**Focused-surface header** (SkillTunerPage `:537-556`) — the header chrome to adapt for the D-01 persistent header (skill name · vN · LIVE badge · one-line gate strip):
```tsx
<div className="px-8 pt-6 pb-4 shrink-0 border-b border-border/10">
  <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
    <ChevronLeft className="h-4 w-4" />
    Skills
  </button>
  <div className="flex items-center gap-2.5">
    <Target className="h-5 w-5 text-primary" aria-hidden="true" />
    <h1 className="text-xl font-headline font-bold text-foreground">{`… · ${skill.name}`}</h1>
  </div>
</div>
```

**Add for Studio (net-new, no analog line):** tab chrome (`Evals · Triggering · Versions`) driven by the `tab` prop → renders `<EvalsTab>` / `<TriggeringTab>` / `<VersionsTab>`. Landing tab = Evals (D-01). Tabs deep-linkable via the `tab` prop from App state. Header gate strip = a **condensation of `getPublishGate`** (never a second truth-teller — reuse the `LifecycleStepper`'s server source).

---

### `frontend/src/components/skills/studio/EvalsTab.tsx` (stateful container, NET-NEW)

**Analog:** `frontend/src/components/skills/SkillEvalSection.tsx` — **lift ALL of this file's state + handlers; re-skin the render.**

**Import block** (SkillEvalSection `:19-49`) — the exact client fns + utils to carry over:
```tsx
import { useEffect, useRef, useState } from "react"
import { Loader2, Play, ThumbsUp, ThumbsDown, Sparkles, Check, X, RotateCw, ArrowUpCircle } from "lucide-react"
import {
  getProviders, startEvalRun, getEvalRun, listEvalRuns, subscribeToRun, rateEvalResult,
  proposeImprovement, listProposals, getProposal, approveProposal, rejectProposal,
  rerunProposalReeval, forcePromoteProposal, getPublishGate,
} from "@/lib/api"
import { lineDiff } from "@/lib/lineDiff"
import type { EvalResult, EvalRun, SkillProposal, PromotionGate, PublishGate } from "@/types"
```

**Stream reuse — `attach(rid)` (SkillEvalSection `:202-280`) — LIFT VERBATIM (do not rewrite, RESEARCH "Don't Hand-Roll"):**
```tsx
void subscribeToRun(rid, "0", {
  onEvalCaseStarted: ({ testCaseId, variant }) => setLive((p) => ({ ...p, [`${testCaseId}:${variant}`]: "running" })),
  onEvalCaseDone:    ({ testCaseId, variant, status }) => setLive((p) => ({ ...p, [`${testCaseId}:${variant}`]: status })),
  onEvalVerdict:     ({ testCaseId, variant, verdictState, verdictPassed }) => setLive(/* idempotent base·badge merge */),
  onEvalComplete:    () => void loadReadout(rid),      // DB is authoritative
  onTerminal:        async (kind, err) => { /* BUG-260702-03 bounded re-attach self-heal (reattachRef ≤ 20) */ },
}, ctrl.signal)
```

**Skill-switch guard — `currentSkillRef` + per-fetch `requestedSkill` (SkillEvalSection `:165`, `:183-198`) — CARRY INTO EVERY LIFTED HANDLER (BUG-260701-02 fix):**
```tsx
const currentSkillRef = useRef(skillId)
async function loadReadout(rid: string) {
  const requestedSkill = skillId
  const { eval_run, eval_results } = await getEvalRun(requestedSkill, rid)
  if (currentSkillRef.current !== requestedSkill) return   // skill switched mid-fetch → drop
  setEvalRun(eval_run); setResults(eval_results)
}
```

**Skill-switch reset block** (SkillEvalSection `:311-388`) — the mount/`[skillId]` effect that (1) publishes `currentSkillRef`, (2) clears prior readout/live/proposal/gate state, (3) hydrates providers, latest run (+reattach if running), latest proposal (+reattach re-eval), and publish gate. Lift this whole effect; the picker selection is deliberately preserved across skills (D-12).

**Refetch-not-optimistic mutation shape** (SkillEvalSection `handleRate` `:419-427`, `handleApprove` `:453-468`) — every write hits the owner-gated endpoint THEN re-fetches the DB:
```tsx
await rateEvalResult(skillId, r.id, r.rating === choice ? null : choice)
const rid = runId ?? evalRun?.id
if (rid) await loadReadout(rid)   // thumbs state stays derived from the DB
```

**Compose:** `<LifecycleStepper>` (top) → `<RunBar>` → `<RunHistory>` (top row = live run) → `<ProposalCard>` (below history, D-08). Ordering per RESEARCH Open Question 2.

---

### `frontend/src/components/skills/studio/RunBar.tsx` (picker + launch, NET-NEW)

**Analog:** `SkillEvalSection.tsx` provider/model picker + Run button (`:569-614`) + `handleRun` (`:390-410`).

**Picker + kickoff** (`:570-614`): two `<select>`s (provider → resets model to `models[0]`; model), disabled while `running`, then the Run button:
```tsx
<Button size="sm" onClick={handleRun} disabled={running || !provider || !model}>
  {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
  Run eval
</Button>
```
Provider list from `getProviders()` (`:337-342`, sets `provider`/`model` from `active`/`active_model`). **Re-skin** into the D-12 compact run bar directly above the run-history list; keep selection preserved across skills.

---

### `frontend/src/components/skills/studio/RunHistory.tsx` (expandable list, NET-NEW)

**Analog:** `SkillEvalSection.tsx` durable readout (`:836-921`) for the row/rollup content; `frontend/src/lib/providerLogo.tsx` for the D-04 provider-logo avatars; `listEvalRuns` (api `:1726`) for the list.

**Honest rollup line** (SkillEvalSection `:631-637`) — the "N not measured" append is load-bearing (D-04):
```tsx
{evalRun && evalRun.measured_count != null && (
  <p className="text-xs font-medium text-foreground">
    {evalRun.passed_count ?? 0}/{evalRun.measured_count} with-skill cases passed
    {evalRun.measured_count < evalRun.case_count && ` · ${evalRun.case_count - evalRun.measured_count} not measured`}
  </p>
)}
```

**Provider logo** (`providerLogo.tsx` `:89-92`) — returns a mark component or null; caller renders a `Bot` fallback for null:
```tsx
const Mark = providerLogo(run.provider)   // keys are runs.provider strings: zhipu (not glm), moonshot (not kimi)
{Mark ? <Mark size={16} /> : <Bot className="h-4 w-4" />}
```

**Re-skin (net-new chrome per 055-B):** rows expand IN PLACE to `<RunCaseDetail>`. The RUNNING run is the top row showing live per-arm progress with NO mid-run verdicts (verdicts land at finalize). Interrupted run (`EvalRun.status === "interrupted"`) → banner + re-run affordance, never a silent failure.

---

### `frontend/src/components/skills/studio/RunCaseDetail.tsx` (per-case detail + ratings, NET-NEW)

**Analog:** `SkillEvalSection.tsx` per-case/per-arm render (`:836-916`) — the side-by-side arms, verdict badge, judge reason, thumbs.

**`verdictBadge` honesty helper** (`:68-79`) — LIFT VERBATIM (never fabricate pass/fail):
```tsx
function verdictBadge(r: EvalResult): string | null {
  switch (r.verdict_state) {
    case "graded": return r.verdict_passed ? "PASS" : "FAIL"
    case "not_measured": return "not measured"   // excluded-never-failed
    case "judge_error": return "judge error"     // neither pass nor fail
    default: return null
  }
}
```

**Thumbs — "your rating" DISTINCT from the judge verdict (D-04)** (`:868-897`): thumbs up/down buttons with `aria-pressed={r.rating === "up"|"down"}`, calling `handleRate`. Keep these visually separated from the judge's PASS/FAIL badge (two truths, never blended). The `VARIANTS = ["with_skill", "without_skill"]` (`:60`) and per-case grouping `byCase` (`:525-531`) drive the side-by-side arms.

---

### `frontend/src/components/skills/studio/ProposalCard.tsx` (proposal lifecycle, NET-NEW)

**Analog:** `SkillEvalSection.tsx` proposal block (`:650-834`) + handlers (`handlePropose` `:432-447`, `handleApprove/Reject/Rerun/ForcePromote` `:453-513`) — LIFT the handlers verbatim, re-skin the render (D-08, chrome aligned to Studio).

**`renderGateCounts` honest terminal counts** (`:97-112`) — same renderer on BOTH promoted + not_promoted branches:
```tsx
function renderGateCounts(gate: PromotionGate | null | undefined) {
  if (!gate) return null   // interrupted/unreconciled → render nothing, never a fabricated pass
  return (/* Gate passed/not · no-regression · improved · prev/still/newly pass · not measured */)
}
```

**Diff render via `lineDiff`** (`:687-706`) — the SAME util VersionsTab uses:
```tsx
{lineDiff(proposal.base_instructions, proposal.proposed_instructions).map((row, i) => (
  <span key={i} className={row.type === "add" ? "…emerald…" : row.type === "remove" ? "…destructive…" : "…foreground/70…"}>
    {row.type === "add" ? "+ " : row.type === "remove" ? "- " : "  "}{row.text || " "}
  </span>
))}
```

**Status-driven action rows** (`:728-830`) — `proposed` → Approve/Reject; `re_evaling`/`approved` → live progress (+ Reject escape); `promoted` → "Promoted… (forced override)" + gate counts; `not_promoted` → destructive line + Force-promote + gate counts; `interrupted` → "not promoted" + Re-run. **Preserve ALL 135 honesty locks** (`override_forced`, `PromotionGate` counts, honest interrupted). **D-09 add:** a post-run "Propose an improvement?" nudge when a finished run has ≥1 failed measured case — points to the existing `handlePropose`.

---

### `frontend/src/components/skills/studio/VersionsTab.tsx` (table + compare/diff, NET-NEW)

**Analog:** `SkillTestCasesSection.tsx` version list (`:200-214`) for the source data; `frontend/src/lib/lineDiff.ts` for the compare diff; `SkillEvalSection.tsx` diff render (`:687-706`) for the diff JSX.

**Version list source** (SkillTestCasesSection `:48`, `:206-212`):
```tsx
const [c, v] = await Promise.all([listTestCases(skillId), listSkillVersions(skillId)])
...
{versions.map((v) => (
  <li key={v.id}>v{v.version_number} · {v.source} · {new Date(v.created_at).toLocaleString()}</li>
))}
```

**PITFALL — provenance chip enum (RESEARCH Pitfall 1):** `SkillVersion.source` is a `string` typed as one of the FIVE real values — map these, there is **no `"forced"` value**:
```
"manual" → hand-edited · "import" → imported · "tuner" → tuner-promoted
"self_improve" → proposal-promoted · "backfill" → original/migrated
```
The force-promoted fact lives on `SkillProposal.override_forced` (join `listProposals(skillId)` on `proposal.new_skill_version_id === version.id`), NOT on the version. A `version.source === "forced"` branch is dead code.

**PITFALL — version→eval binding (RESEARCH Pitfall 2 / D-15):** `GET /skills/{id}/versions` has NO eval rollup. Client-side join: `listSkillVersions(skillId)` × `listEvalRuns(skillId)`, group runs by `EvalRun.skill_version_id`, surface each version's latest rollup or "never evaled". Both fns already exist in `api.ts`; this is the D-15 "one candidate read" — recommend the client join (no backend change, no migration).

**Compare picker + diff (net-new chrome per 056-B):** any-to-any Compare v[x] ↔ v[y] → ONE unified `lineDiff(vx.instructions, vy.instructions)` render. **"Restore" is deliberately ABSENT** (versions immutable, VER-01).

---

### `frontend/src/components/skills/studio/LifecycleStepper.tsx` (shared status, NET-NEW — chrome is sketch-net-new)

**Analog (data source, not chrome):** `SkillEvalSection.tsx` publish-gate render (`:539-567`) + `unmetGateLine` (`:118-128`); `types` `PublishGate` (`:654-662`).

**One-truth server render** (SkillEvalSection `:543-567`) — the client NEVER recomputes `met` (D-07 / 054 lock); it renders these server fields only:
```tsx
{publishGate.met
  ? <p>Publish ready — eval passed {publishGate.passed}/{publishGate.measured} on the current version</p>
  : <p>{unmetGateLine(publishGate.state)}</p>}
{publishGate.last_override && <p>Published without a passing eval on {new Date(publishGate.last_override.created_at).toLocaleDateString()}</p>}
```

**`PublishGate` shape** (`types/index.ts :654-662`) — the stepper's ONLY status source:
```tsx
interface PublishGate {
  met: boolean
  state: "never_evaled" | "latest_failed" | "passed_on_older_version" | "passed"
  measured: number | null; passed: number | null; passing_run_id: string | null
  reason: string
  last_override: { gate_state: string; created_at: string } | null
}
```

**Net-new (sketch 054-B, no code analog):** the Cases → Eval → Gate → Published stepper with counts on stage nodes, ONLY the current stage narrating, and the ⚡ collision rendered as a met Gate node (bound to `passing_run_id`) WITH the Eval node carrying the newest run's honest count — each labeled with its run·version binding. `passed_on_older_version` reads "the passing eval is stale — it measured vN-1, the live skill is vN." **D-10: ONE shared component** consumed by both the Studio header (condensed) and the slim detail panel (full).

---

### `frontend/src/components/skills/studio/TriggeringTab.tsx` (thin wrapper, NET-NEW)

**Analog:** `ChatLayout.tsx` `SkillTunerPage` mount (`:324`).

Mount `<SkillTunerPage skillId={skillId} onBack={...} />` UNMODIFIED (D-02). Do NOT edit `SkillTunerPage.tsx` internals or `components/skills/tuner/*` (re-opens the 041/042/043/045 winners). Since `SkillTunerPage` renders its own `‹ Skills` header, the wrapper may need to suppress/adapt that so it sits cleanly inside the tab — verify against the 057-A sketch; keep the change on the wrapper, never the Tuner.

---

### `frontend/src/components/skills/SkillFormDialog.tsx` (detail panel, MODIFY)

**Analog:** self — the section mount site (`:531-550`).

**REMOVE** the two section mounts (D-07):
```tsx
{savedSkillId && <div className="mt-6 pt-6 border-t border-border/10"><SkillTestCasesSection skillId={savedSkillId} /></div>}
{savedSkillId && <div className="mt-6 pt-6 border-t border-border/10"><SkillEvalSection skillId={savedSkillId} /></div>}
```
**ADD** in their place: the shared `<LifecycleStepper>` (status section, D-10) + an "Open studio" button (calls the threaded `onOpenStudio(savedSkillId, "evals")`) + counts. The existing `onTuneThis` prop threading (`:524-528`) is the precedent for how a navigator callback reaches this component. Drop the `SkillTestCasesSection` + `SkillEvalSection` imports (`:14-15`).

---

### `frontend/src/components/skills/PublishGateDialog.tsx` (dialog, MODIFY)

**Analog:** self — the unmet branch (`:117-126`).

**Add "Review evals →" on the UNMET branch** (D-06) — the existing unmet copy block:
```tsx
{gate && !gate.met && (
  <div className="flex flex-col gap-1.5">
    <p className="text-sm font-medium text-foreground">{UNMET_COPY[gate.state]}</p>
    {gate.reason && <p className="text-xs text-muted-foreground">{gate.reason}</p>}
    <p className="text-xs text-muted-foreground">Run an eval from this skill's Evals section, then try again…</p>
    {/* ADD: a "Review evals →" link → onReviewEvals(skillId) → Studio·Evals */}
  </div>
)}
```
Add an `onReviewEvals?: (skillId: string) => void` prop (or reuse the `handleOpenStudio` navigator). **PITFALL 5:** this dialog is mounted deep — thread the callback App → ChatLayout → SkillsPage → SkillCard → PublishGateDialog, exactly like `onTuneSkill` is threaded today.

---

### `frontend/src/components/skills/SkillCard.tsx` (card, MODIFY)

**Analog:** self — the PublishGateDialog mount (`:269-276`).

Pass the new navigator through to the dialog:
```tsx
<PublishGateDialog
  skillId={skill.id}
  open={showPublishDialog}
  onOpenChange={setShowPublishDialog}
  onConfirm={async (override) => { await onToggleGlobal(skill.id, override) }}
  // ADD: onReviewEvals={onReviewEvals}
/>
```
Add `onReviewEvals` to `SkillCard`'s Props and drill it from `SkillsPage` (the `onTuneSkill` prop is the existing precedent for a card-level navigator).

---

### `frontend/src/pages/SkillsPage.tsx` (3-pane page, MODIFY)

**Analog:** self — the `onTuneSkill` entry action (`:182-207`) + `useResizablePanel` (`:36-37`).

**Entry-action precedent** (`:187-198`) — clone for an "Open studio" button:
```tsx
{selectedSkill && onTuneSkill && (
  <div className="px-6 pt-4 shrink-0">
    <Button variant="outline" size="sm" className="w-full justify-center gap-2" onClick={() => onTuneSkill(selectedSkill.id)}>
      <Target className="h-4 w-4" /> Tune triggers
    </Button>
  </div>
)}
```
**Add:** an "Open studio" entry → `onOpenStudio(selectedSkill.id, "evals")`. The 044-A lint "Tune this →" handoff RE-POINTS to Studio·Triggering (D-06). Panel-state preservation on `‹ Skills` return is inherent to the SkillsPage 3-pane state (selection lives in `selectedSkill`; the resizable width persists via `useResizablePanel({ storageKey: "skills-detail-panel-width" })`, `:36-37`).

---

### Test files (`*.test.tsx`, NET-NEW)

**Analog:** `frontend/src/components/skills/SkillEvalSection.test.tsx` (`:1-55`) — the fresh-authored, fully-mocked pattern.

**PITFALL 4 (SEED-056 rot):** author ALL fresh; fully mock `@/lib/api`; do NOT import helpers from rotted siblings. The header convention to reproduce:
```tsx
// `@/lib/api` is fully mocked … Authored fresh (MEMORY project_frontend_vitest_rot) — not leaning on a rotted sibling.
const getPublishGate = vi.fn(); const getProviders = vi.fn(); /* … */
vi.mock("@/lib/api", () => ({ getPublishGate: (...a) => getPublishGate(...a), /* … */ }))
import { SkillEvalSection } from "./SkillEvalSection"
```
Wave-0 gaps (RESEARCH): `SkillStudioPage.test.tsx`, `LifecycleStepper.test.tsx`, `RunHistory.test.tsx`, `RunCaseDetail.test.tsx`, `VersionsTab.test.tsx`, `ProposalCard.test.tsx`; extend `SkillFormDialog.test.tsx` + `PublishGateDialog.test.tsx`. Command: `cd frontend && npx vitest run <path>`.

---

## Shared Patterns

### One truth-teller (publish gate)
**Source:** `SkillEvalSection.tsx` `:539-567` (gate render) + `types/index.ts` `:654-662` (`PublishGate`).
**Apply to:** `LifecycleStepper` (both homes), `SkillStudioPage` header strip, `PublishGateDialog`, the Publish button.
The client renders `PublishGate` fields ONLY — never derives `met` client-side (D-07 / 054 lock). Every status surface condenses the SAME `getPublishGate` response.

### Stream reuse (no bespoke EventSource)
**Source:** `SkillEvalSection.tsx` `:202-280` (`attach` / `subscribeToRun`).
**Apply to:** `EvalsTab`, `RunHistory` (live top row), `ProposalCard` (re-eval progress).
Eval `eval_*` events ride the companion `public.runs` row; `subscribeToRun` carries them with zero new stream code. The DURABLE readout always comes from `getEvalRun` (survives Redis TTL). Includes the BUG-260702-03 bounded re-attach self-heal (`reattachRef ≤ 20`) — a transient drop is NOT a run failure.

### Skill-switch guard (refetch-not-optimistic)
**Source:** `SkillEvalSection.tsx` `:165`, `:183-198`, `:286-295`, `:311-388`.
**Apply to:** every lifted handler that crosses a skill boundary.
`currentSkillRef` + per-fetch `requestedSkill` capture → bail before any `setState` if the skill changed (BUG-260701-02 fix). Every mutation hits the owner-gated endpoint THEN re-fetches the DB; never optimistic (T-135-04).

### Unified line diff
**Source:** `frontend/src/lib/lineDiff.ts` (`lineDiff(base, next): DiffRow[]`) + render at `SkillEvalSection.tsx` `:687-706`.
**Apply to:** `VersionsTab` (version compare) AND `ProposalCard` (proposal diff). One renderer, two homes. Pure/React-free — trivially unit-testable.

### Provider logos
**Source:** `frontend/src/lib/providerLogo.tsx` `:89-92` (`providerLogo(provider): ProviderMark | null`).
**Apply to:** `RunHistory` row avatars (D-04). Keys are the resolved `runs.provider` strings (`zhipu` not `glm`; `moonshot` not `kimi`); `null` → caller renders a `Bot` fallback. Single-source icon convention (Phase 127/128) — sketch Kimi/GLM/MiniMax placeholders are NOT shipped art.

### Focused full-surface via ActiveView (no router)
**Source:** `App.tsx` `:9,:21-25` + `ChatLayout.tsx` `:316-324` + `SkillTunerPage.tsx` (`skillId` + `onBack` guard).
**Apply to:** the whole Studio shell + the legacy `skill-tuner` redirect. The reachability triad (App union + ChatLayout mount + entry action) is owned in-phase (the Phase-118 built-but-unreachable lesson).

### Deep prop-drill navigator
**Source:** `App.handleTuneSkill` → `ChatLayout` (`onTuneSkill`) → `SkillsPage` (`:187-207`) → `SkillCard` → `SkillFormDialog` (`onTuneThis`).
**Apply to:** `handleOpenStudio` and `onReviewEvals` — thread identically; no component reaches App state directly.

---

## No Analog Found

No files lack a code analog. Two components carry **net-new visual chrome** (sketch-defined) even though their DATA plumbing has a strong analog — the planner should build the chrome against the sketch `index.html` mockups, not from an existing component:

| File | Role | Data analog | Chrome source (no code analog) |
|------|------|-------------|--------------------------------|
| `LifecycleStepper.tsx` | shared status | `SkillEvalSection` gate render `:539-567` + `PublishGate` type | sketch 054-B (Cases→Eval→Gate→Published stepper + ⚡ collision) |
| `VersionsTab.tsx` compare picker | table + diff | `lineDiff` + `SkillTestCasesSection` version list | sketch 056-B (scan-first table + any-to-any compare picker) |

---

## Metadata

**Analog search scope:** `frontend/src/pages/`, `frontend/src/components/skills/` (+ `skills/tuner/`), `frontend/src/components/layout/`, `frontend/src/lib/`, `frontend/src/hooks/`, `frontend/src/types/`.
**Files scanned (direct read):** `App.tsx`, `ChatLayout.tsx`, `SkillStudioPage`-precedent `SkillTunerPage.tsx`, `SkillEvalSection.tsx` (924 lines, full), `SkillTestCasesSection.tsx`, `SkillFormDialog.tsx`, `PublishGateDialog.tsx`, `SkillCard.tsx`, `SkillsPage.tsx`, `lineDiff.ts`, `providerLogo.tsx`, `useResizablePanel.ts`, `api.ts` (eval/version/gate fns), `types/index.ts`, `SkillEvalSection.test.tsx`.
**Pattern extraction date:** 2026-07-03
