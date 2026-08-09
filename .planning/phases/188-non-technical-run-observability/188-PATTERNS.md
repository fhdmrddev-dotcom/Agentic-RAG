# Phase 188: Non-Technical Run Observability — Pattern Map

**Mapped:** 2026-08-05
**Files analyzed:** 15 (5 net-new, 10 modified)
**Analogs found:** 5 / 5 net-new (4 exact, 1 role-match) — every net-new file has a real, quoted analog
**Read at:** working tree HEAD (`develop`, post-`42d517b9`). Every excerpt below was read this session, not inherited from RESEARCH.

> **How to use this document.** The quotes are the thing. Where RESEARCH described a pattern in prose,
> this file gives the executor the exact bytes to mirror. Where an analog does **not** exist, it says so
> plainly (§ No Analog Found) rather than inventing one.

---

## File Classification

### Net-new

| New file | Role | Data flow | Closest analog | Match quality |
|---|---|---|---|---|
| `frontend/src/lib/phaseState.ts` | utility (pure derivation module) | transform | `frontend/src/lib/workspacePanel.ts` | **exact** — pure `lib/*` module, typed union + lookup maps + total function with a `default:` arm, imports only `@/types` + one sibling `lib` module |
| `frontend/src/lib/phaseState.test.ts` | test (unit + source fence) | transform | `frontend/src/components/workflows/phaseVocabulary.test.ts` (fence idiom) + `frontend/src/lib/workspacePanel.test.ts` (siting/shape) | **exact** — `phaseVocabulary.test.ts` is the shipped *pure-module* `?raw` fence; `DescribeKbPicker.test.tsx` supplies the `FORBIDDEN_SYMBOLS` loop |
| `frontend/src/pages/WorkflowRunPage.tsx` | page (full-surface, non-chat `else` branch) | request-response + event-driven (live slice) | `frontend/src/pages/SkillStudioPage.tsx` | **exact** — entered *with an id*, self-fetches by that id, `onBack` navigation callback, no router, mounted in the same ternary chain |
| `frontend/src/pages/WorkflowRunPage.test.tsx` | test (RTL integration) | request-response | `frontend/src/pages/SkillStudioPage.test.tsx` | **exact** — same shell-with-stubbed-leaves + `vi.mock("@/lib/api", …)` posture |
| `backend/app/api/workflow_runs.py` | route (canvas-gated read router) | CRUD (read-only) | `backend/app/api/workflows.py:600-614` (gate posture) + `backend/app/api/runs.py:700-750` (owner-scoped `workflow_runs` SELECT → 404) | **exact** — both halves are shipped; `runs.py` already SELECTs `workflow_runs` by id under caller ownership |
| `backend/tests/test_188_workflow_run_read.py` | test (pytest + TestClient) | request-response | `backend/tests/test_182_canvas_gate.py` | **exact** — same `_cold_off`/`_flipped_on` helpers, same exact-set OpenAPI fence |

### Modified

| Modified file | Role | Data flow | Change class |
|---|---|---|---|
| `frontend/src/providers/StreamsProvider.tsx` | provider / reducer | event-driven | two fail-open fixes + a real-slug overlay + `DB_PHASE_STATUS` move-out |
| `frontend/src/types/index.ts` | model (type) | — | additive union widening (`"unknown"`) |
| `frontend/src/components/panel/PhaseCard.tsx` | component (leaf) | — | one `STATUS_META` entry (compiler-forced) |
| `frontend/src/components/panel/PhaseTimeline.tsx` | component | — | `TERMINAL_RUN_STATUSES` move-out → import |
| `frontend/src/components/workflows/PhaseNode.tsx` | component (adapter) | — | read `data.run`, pass `status` |
| `frontend/src/components/workflows/PhaseNodeCard.tsx` | component (presentational leaf) | — | narrow `NodeRunStatus`, render ring + run line |
| `frontend/src/components/workflows/WorkflowCanvas.tsx` | component (container) | — | ⚠ **capped** prop mirror only |
| `frontend/src/components/workflows/runVocabulary.ts` (suggested) | utility | transform | net-new *canvas words* table — see § No Analog Found note 2 |
| `frontend/src/components/layout/ChatLayout.tsx` | layout | — | `doRun` tail + one render branch |
| `frontend/src/App.tsx` | config (union) | — | one union member |
| `backend/app/main.py` | config | — | one `include_router` line |
| `backend/app/middleware/canvas_gate.py` | middleware | — | one frozenset member |
| `backend/tests/test_182_canvas_gate.py` | test | — | `_CANVAS_PATHS` / `_CANVAS_SCHEMAS` literals |
| `backend/tests/test_revert_byte_identical.py` | test | — | one 404-when-off probe (mandatory by the file's own header) |
| `scripts/vitest-count-gate.cjs` | config ⚠ **load-bearing** | — | `TARGETS` + `BASELINE` entries |

---

## Pattern Assignments — NET-NEW FILES

### 1. `frontend/src/lib/phaseState.ts` (utility, transform)

**Analog:** `frontend/src/lib/workspacePanel.ts` (223 L, Phase 095.1)
**Secondary analog for the docblock voice:** `frontend/src/lib/stepCount.ts`

**Why this analog:** it is the only shipped `lib/*` module that carries *all three* of the shapes 188
needs — an exported lookup `Record`, an exported `Set` constant, and a **total** mapping function whose
last arm is `default:`. It is also consumed by both `components/panel/*` and non-component code, which is
exactly Req 8's constraint.

**Docblock pattern** (`workspacePanel.ts:1-30` — the header shape to mirror; note it names WHY it is
pure, which is the sentence Req 8's grep depends on):

```ts
/**
 * Phase 095.1 Plan 01 Task 1 — the deterministic, provider-independent
 * workspace-panel selector (D-095.1-01 / D-095.1-02).
 * …
 * Pure logic — NO React, NO hooks, NO JSX. Deliberately importable from
 * non-component code (mirrors stepCount.ts). All returned labels are PLAIN
 * STRINGS (model/user-derived); the render consumer (Plan 02) renders them as
 * React text children, NEVER `dangerouslySetInnerHTML` (T-095.1-01-01). This
 * module returns DATA only; the XSS contract is enforced at the consumer.
 */
import type { ToolCall } from "@/types"
import { dedupToolCalls } from "./stepCount"
```

**Exported lookup `Record` pattern** (`workspacePanel.ts:156-167`):

```ts
// Pretty display names for non-execute_code meaningful tools.
const PRETTY_TOOL_NAMES: Record<string, string> = {
  search_documents: "Search documents",
  query_documents: "Query documents",
  …
}
```

**Exported `Set` constant pattern** (`workspacePanel.ts:43-59` — the shape `TERMINAL_RUN_STATUSES` moves into):

```ts
export const MEANINGFUL_TOOLS = new Set<string>([
  "execute_code",
  "workspace_write",
  …
])

/** Minimum MEANINGFUL deduped steps before an UNPLANNED run earns a panel. */
export const GATE_MIN_STEPS = 2
```

**THE TOTAL FUNCTION pattern — copy this shape for `phaseStatusFromDb` and `canvasReading`**
(`workspacePanel.ts:67-88`). Note the docblock states the *whole* mapping in prose, and the
`default:` arm is named as the honest catch-all, never as success:

```ts
/**
 * Map a raw tool/todo status to the read-only panel status vocabulary.
 *
 * Frontend `ToolCall.status` is `running | done | interrupted | preparing`;
 * `write_todos` items carry `pending | in_progress | completed`. Normalize both:
 * `done`/`completed` → completed, `running`/`preparing`/`in_progress` →
 * in_progress, everything else (incl. `interrupted`) → pending.
 */
function mapStatus(s: string | undefined): DerivedPanelItem["status"] {
  switch (s) {
    case "done":
    case "completed":
      return "completed"
    case "running":
    case "preparing":
    case "in_progress":
    case "in-progress":
      return "in_progress"
    default:
      return "pending"
  }
}
```

**Typed-union-on-an-interface pattern** (`workspacePanel.ts:61-65`) — the shape `CanvasReading` mirrors:

```ts
/** A derived, read-only panel item. Status mirrors the source tool/todo. */
export interface DerivedPanelItem {
  label: string
  status: "pending" | "in_progress" | "completed"
}
```

**Import ceiling for this file (Req 8's ESM-cycle constraint, measured):** `lib/workspacePanel.ts` imports
`@/types` + one sibling `./stepCount`. `phaseState.ts` must import **only** `@/types`. No `lib/*` module in
the tree imports a component today — do not make this the first.

---

### 2. `frontend/src/lib/phaseState.test.ts` (test, transform)

**Primary analog for the FENCE:** `frontend/src/components/workflows/phaseVocabulary.test.ts` (883 L)
**Primary analog for the `FORBIDDEN_SYMBOLS` loop:** `frontend/src/components/workflows/DescribeKbPicker.test.tsx`
**Analog for siting + factory shape:** `frontend/src/lib/workspacePanel.test.ts`

> **How the source is read: `?raw`, NEVER `fs.readFileSync`.** The whole tree uses Vite's `?raw` loader.
> `PublishGauntlet.test.tsx:38-46` states why in its own comment: `tsconfig.app.json` does not give the
> test `node` types, so `readFileSync` does not typecheck, and `?raw` is cwd-independent. There are
> **zero** `readFileSync` source fences in `frontend/src`.

**The import line** (`phaseVocabulary.test.ts:28-29`):

```ts
import { describe, it, expect } from "vitest"
import phaseVocabularySource from "./phaseVocabulary?raw"
```

**The `FORBIDDEN_SYMBOLS` fence — the exact working pattern** (`DescribeKbPicker.test.tsx:53-66` for the
declaration, `:393-408` for the source-side loop). Copy **both halves**; the list is declared once and
consumed twice (call-count assertion + source grep):

```ts
/** Everything the picker may NOT reach. All must stay at zero. */
const FORBIDDEN_SYMBOLS = [
  "createFolder",
  "listSkills",
  "generateWorkflow",
  "createWorkflowDraft",
  "updateWorkflowDraft",
  "publishWorkflow",
  "validateWorkflow",
] as const

const expectNothingElseCalled = () => {
  for (const name of FORBIDDEN_SYMBOLS) expect(api[name]).toHaveBeenCalledTimes(0)
}
```

```ts
// ── 7. THE SOURCE FENCE: exactly one api symbol, and no route name ────────────
//
// Needles are ASSEMBLED FROM PARTS so this file's own source cannot satisfy a grep run
// over it (the 187-24 lesson), and every one carries a positive control below.

const API_SYMBOL = ["list", "Folders"].join("")
const API_MODULE_RE = new RegExp(`from\\s+["']@/lib/api["']`)
const ROUTE_LITERAL = ["/", "folders"].join("")

describe("DescribeKbPicker — source purity: one api symbol, zero routes", () => {
  it("imports from the api client EXACTLY ONCE and names EXACTLY ONE symbol from it", () => {
    const imports = describeKbPickerSource.match(/from\s+["']@\/lib\/api["']/g) ?? []
    expect(imports).toHaveLength(1)
    expect(describeKbPickerSource).toMatch(API_MODULE_RE)
    expect(describeKbPickerSource).toMatch(new RegExp(API_SYMBOL))
    for (const symbol of FORBIDDEN_SYMBOLS) {
      expect(describeKbPickerSource).not.toMatch(new RegExp(symbol))
    }
  })
```

⚠ **The needle-assembly rule is load-bearing for Phase 188.** Req 2's grep forbids raw DB status literals
(`"active"`, `"completed"`, …) and `phase_index` in the canvas *render path*. If the test file spells those
literals inline, and the fence is ever run over a file set that includes the test, the guard becomes
vacuous. Assemble them: `const DB_LITERAL = ["comp", "leted"].join("")`. This is the 187-24 lesson the
comment above names.

**The "zero local re-derivations" fence — count-the-declarations pattern** (`phaseVocabulary.test.ts:846-859`,
including its **positive control**, which is mandatory house style):

```ts
  it("reads ONE membership body — the loop is not written twice in this module", () => {
    const decls = phaseVocabularySource.match(/function firstKbTool/g) ?? []
    expect(decls).toHaveLength(1)
    expect(phaseVocabularySource).toMatch(/hasDial && firstKbTool\(/)
    expect(phaseVocabularySource).not.toMatch(/availableTools\.some\(/)
    const calls = phaseVocabularySource.match(/firstKbTool\(/g) ?? []
    expect(calls.length).toBeGreaterThanOrEqual(2)
    // POSITIVE CONTROL — the pattern that must be absent above really does match the
    // shape it forbids, so its absence is a measurement and not a tautology.
    expect("inputs.availableTools.some((tool) => inputs.kbTools.includes(tool))").toMatch(
      /availableTools\.some\(/,
    )
  })
```

**The purity block** (`phaseVocabulary.test.ts:862-882`) — copy verbatim in shape for `phaseState.ts`:

```ts
describe("phaseVocabulary — purity + anti-duplication (D-183-13)", () => {
  it("imports nothing from the API client", () => {
    expect(phaseVocabularySource).not.toMatch(/from\s+["']@\/lib\/api["']/)
  })

  it("does NOT re-declare the glyph map (soulData owns it)", () => {
    expect(phaseVocabularySource).not.toMatch(/const PHASE_GLYPHS/)
  })
  …
  it("declares exactly ONE parseSkipTarget", () => {
    const decls = phaseVocabularySource.match(/export function parseSkipTarget/g) ?? []
    expect(decls).toHaveLength(1)
  })
})
```

**The factory + fixture shape for a pure-module suite** (`workspacePanel.test.ts:15-26`):

```ts
import { describe, it, expect } from "vitest"
import type { ToolCall } from "@/types"
import { humanize, inferLabel, deriveWorkspacePanel } from "./workspacePanel"

/** Minimal ToolCall factory — only the fields humanize() reads matter here. */
function tc(name: string, args: Record<string, string> = {}): ToolCall {
  return { name, args, status: "done" }
}
```

⚠ **This file lands outside BOTH gate knobs by default.** See § Shared Patterns → *The count gate*.

---

### 3. `frontend/src/pages/WorkflowRunPage.tsx` (page, request-response + event-driven)

**Analog:** `frontend/src/pages/SkillStudioPage.tsx` (the D-01 focused full-surface, Phase 137-06)

**Why this analog and not `WorkflowsPage` / `GovernancePage` / `KnowledgeHealthPage`:** those three
*self-fetch a list with no props* (`<GovernancePage />`, `<ClassificationRulesPage />`,
`<KnowledgeHealthPage />` are all rendered bare). `WorkflowRunPage` is entered **with an id** and returns
via a navigation callback — which is exactly `SkillStudioPage` and `ControlRoomPage`/`OrgAdminShell`.

**Header docblock pattern** (`SkillStudioPage.tsx:1-21`) — note it names the single-source invariants the
page owns, which is the paragraph 188 must write for the `phase_index → slug` join:

```tsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 137 Plan 06 (PANEL-01 / D-01 / D-03 / D-05) — the Skill Studio shell.
//
// The focused full-surface (sketch 053-A + 057-A): a PERSISTENT header on every tab
// … Mirrors the shipped SkillTunerPage ActiveView precedent (no router).
//
// Two single-source invariants owned HERE (never re-derived by a consumer):
//   • liveVersionNumber = deriveLiveVersion(skill, versions) — the shared W1 helper
//     … Threaded to the header, the strip, EvalsTab, and VersionsTab so all four agree
// ─────────────────────────────────────────────────────────────────────────────
```

**Props contract** (`SkillStudioPage.tsx:37-47`) — the shape `WorkflowRunPage`'s props mirror
(`runId: string | null` + `onBack` / `onNavigate`):

```tsx
interface Props {
  /** The skill under study. App holds this selection (per-view state); a null id →
   *  the calm guard (opened without a target). */
  skillId: string | null
  /** The active tab (deep-linkable via the App-held studioTab param). */
  tab: StudioTab
  /** Switch the active tab (deep-linkable — App updates studioTab). */
  onTabChange: (tab: StudioTab) => void
  /** Return to the 3-pane Skills surface ("‹ Skills"), preserving selection. */
  onBack: () => void
}
```

**Fetch-by-id with a stale-response guard** (`SkillStudioPage.tsx:75-100`) — copy this **verbatim in
shape** for `getWorkflowRun(runId)`. The `currentSkillRef` + `alive()` pattern is what stops a stale run's
payload landing on a newly-opened run:

```tsx
  const currentSkillRef = useRef(skillId)

  useEffect(() => {
    currentSkillRef.current = skillId
    // Reset on skill switch (no prior skill's gate/versions/cases leak — T-137-02).
    setGate(null)
    setVersions([])
    setCases([])
    if (!skillId) return
    const requested = skillId
    let cancelled = false
    const alive = () => !cancelled && currentSkillRef.current === requested
    // Each read is independent + skill-switch-guarded; a single failure never nukes the others.
    getPublishGate(skillId)
      .then((g) => alive() && setGate(g))
      .catch(() => {})
    …
    return () => {
      cancelled = true
    }
  }, [skillId])
```

**The null-id calm guard** (`SkillStudioPage.tsx:131-145`) — the shape for the UI-SPEC's
`That run isn't available.` / `‹ Back to Workflows` error state:

```tsx
  // skillId null → a calm centered guard with a "‹ Skills" back (the SkillTunerPage pattern).
  if (!skillId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <Sparkles className="h-10 w-10 text-muted-foreground/30" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Open the Skill Studio from a skill (Skills → select → Open studio).
        </p>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Skills
        </Button>
      </div>
    )
  }
```

**Full-surface shell + header layout** (`SkillStudioPage.tsx:153-175`) — the region stack the UI-SPEC's
four regions inherit (`flex h-full flex-col overflow-hidden` + a `shrink-0` bordered header):

```tsx
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Persistent header (every tab): ‹ Skills · name · vN · LIVE · condensed gate strip. */}
      <header className="flex shrink-0 flex-col gap-3 border-b border-border/10 px-8 pt-6 pb-3">
        <div>
          <button
            onClick={onBack}
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Skills
          </button>
          <div className="flex items-center gap-2.5">
            …
            <h1 className="font-headline text-xl font-bold text-foreground">{skill?.name ?? "Skill"}</h1>
            <span className="font-mono text-sm text-muted-foreground">v{liveVersionNumber}</span>
```

⚠ **Deviation the UI-SPEC pins:** the run header is `px-6` (not `px-8`) and the workflow name is
**20px/600 Manrope** (`font-headline text-xl` is 20px — matches), and `‹ Workflows` is the back label.
Keep the *structure*, take the *values* from `188-UI-SPEC.md § Regions`.

**Deliverable list — copy the ICON MAP, do not import `FilesSection`.** `FilesSection` reads
`useViewingThread()` (`FilesSection.tsx:103`), not a prop, so it cannot be reused on a run surface without
mutating chat state. Mirror `FilesSection.tsx:44-69`:

```tsx
// Per-extension office icons (sketch-016): docx/pptx/xlsx templates get a
// distinct glyph so the kind reads at a glance …
const OOXML_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
…
function iconFor(file: WorkspaceFile) {
  const mime = file.mime_type
  const ext = file.path.split(".").pop()?.toLowerCase() ?? ""
  if (ext === "docx" || mime === OOXML_DOCX) return FileText
  if (ext === "xlsx" || mime === OOXML_XLSX) return FileSpreadsheet
  …
}
```

…and the two already-thread-parameterised helpers, called with `run.thread_id`:

```ts
// frontend/src/providers/StreamsProvider.tsx:3216
export function useWorkspaceFiles(threadId: string | null): {
  data: WorkspaceFile[]; isLoading: boolean; error: Error | null; reconcile: () => Promise<void>
}

// frontend/src/lib/api.ts:1550
export async function downloadWorkspaceFile(
  threadId: string,
  fileId: string,
  filename: string,
): Promise<void>
```

---

### 4. `frontend/src/pages/WorkflowRunPage.test.tsx` (test, request-response)

**Analog:** `frontend/src/pages/SkillStudioPage.test.tsx`

**API-layer mock pattern** (`SkillStudioPage.test.tsx:53-72`) — note the **factory-per-symbol** form
(`(...a: unknown[]) => fn(...)`), which keeps the module mock hoist-safe, and that `vi.mock` is declared
**before** the component import:

```tsx
// ── Mock the api surface consumed by the shell (+ the CRUD fns useSkills imports). ──
const listSkills = vi.fn()
const getPublishGate = vi.fn()
const listSkillVersions = vi.fn()
const listTestCases = vi.fn()

vi.mock("@/lib/api", () => ({
  listSkills: (...a: unknown[]) => listSkills(...(a as [])),
  createSkill: vi.fn(),
  …
  getPublishGate: (...a: unknown[]) => getPublishGate(...(a as [string])),
  listSkillVersions: (...a: unknown[]) => listSkillVersions(...(a as [string])),
  listTestCases: (...a: unknown[]) => listTestCases(...(a as [string])),
}))

import { SkillStudioPage, type StudioTab } from "./SkillStudioPage"
import { deriveLiveVersion } from "@/lib/skillVersion"
```

**Leaf-stub pattern** (`SkillStudioPage.test.tsx:18-32`) — 188 stubs `WorkflowCanvas` the same way, so the
page suite tests composition (no `ReactFlowProvider` needed) and the node paint is tested in
`PhaseNodeCard.test.tsx`:

```tsx
// ── Stub the three tab bodies (we test the shell composition, not the leaves). ──
vi.mock("@/components/skills/studio/EvalsTab", () => ({
  EvalsTab: ({ skillId, skillVersion }: { skillId: string; skillVersion: number }) => (
    <div data-testid="evals-stub">
      evals · {skillId} · v{skillVersion}
    </div>
  ),
}))
```

**Fixture-factory pattern** (`SkillStudioPage.test.tsx:74-88`):

```tsx
function mkSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-1",
    user_id: "u1",
    name: "Doc Summarizer",
    …
    ...overrides,
  }
}
```

**Header note to copy** (`SkillStudioPage.test.tsx:11`) — the house rule for a net-new suite:

```
 * Authored fresh (MEMORY project_frontend_vitest_rot) — no import from a rotted sibling.
```

---

### 5. `backend/app/api/workflow_runs.py` (route, read-only CRUD)

**Analog A — the gate posture:** `backend/app/api/workflows.py:600-614` (D-182-05, quoted verbatim)
**Analog B — the owner-scoped `workflow_runs` SELECT:** `backend/app/api/runs.py:700-750`
**Analog C — the joined durable phase read:** `backend/app/api/threads.py:1092-1108, 1197-1235`

**Router declaration** — mirror the flat, prefixed one-liner (`workflows.py:89`,
`document_relationships.py:61`, `metadata_fields.py:28`). Do **not** put `require_canvas` at router level:
`workflows.py` deliberately keeps it per-route.

```python
router = APIRouter(prefix="/workflows", tags=["workflows"])
```
⇒ `router = APIRouter(prefix="/workflow-runs", tags=["workflow-runs"])`

**THE GATE POSTURE — copy exactly** (`workflows.py:600-614`, read at HEAD):

```python
@router.post(
    "/validate",
    response_model=ValidateResponse,
    dependencies=[Depends(require_canvas())],  # D-182-05 — require_canvas ALONE (never require_visible)
)
async def validate_workflow(
    body: WorkflowDefinition,
    # WR-08: ``require_canvas`` above ALREADY validated this bearer token and published the
    # identity on ``request.state.canvas_caller``. Consume it — do NOT re-run get_current_user,
    # which cost a 2nd GoTrue round-trip + a 2nd auth.users ban query on every canvas edit.
    current_user: dict = Depends(canvas_caller),
    # service-role: the grounding fidelity reads span the owner's folder tree + skill
    # registry (scoped BY HAND on user_id inside grounding.py — service-role bypasses RLS).
    supabase=Depends(get_supabase),
) -> ValidateResponse:
```

⚠ **One deliberate deviation from this analog.** `workflows.py:613` uses `Depends(get_supabase)`
(service-role) and says why in an inline `# service-role:` comment. Phase 188's route has no such reason —
RESEARCH § Security and CLAUDE.md's RLS rule both call for the **user-JWT** client, so use
`Depends(get_user_supabase_client)` (the `threads.py:1041` posture) and keep RLS as the belt to the
ownership check's braces.

**Import block to mirror** (`workflows.py:20-32`):

```python
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

from app.config import settings
from app.dependencies import (
    canvas_caller,
    get_current_user,
    get_pg_pool,
    get_redis,
    get_supabase,
    require_canvas,
    require_visible,
)
```

**OWNERSHIP-GATED SELECT → 404 — the exact shipped idiom for `workflow_runs`** (`runs.py:700-750`; this is
the closest analog in the tree because it already resolves a `workflow_runs.id` under caller ownership):

```python
    # ── Step 1: ownership SELECT → 404 (never leak existence; T-092-09) ──
    row_resp = await aexec(
        supabase.table("runs")
        .select("run_id, status, thread_id, continues_used, org_id")
        .eq("run_id", str(run_id))
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    row = row_resp.data if row_resp is not None else None
    …
        wf_self_resp = await aexec(
            supabase.table("workflow_runs")
            .select("id, thread_id, continues_used")
            .eq("id", str(run_id))
            .eq("user_id", current_user["id"])
            .maybe_single()
        )
        wf_self = wf_self_resp.data if wf_self_resp is not None else None
    …
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
```

Three details to carry: `.eq("user_id", current_user["id"])` on the **same** SELECT as the id (never a
second query), `.maybe_single()` (returns `None` instead of raising on no-row), and the
`row_resp.data if row_resp is not None else None` guard — `aexec` can return `None`.

**Docstring pattern for the ownership promise** (`threads.py:1043-1052`):

```python
    """PURE READ — reconcile a thread's Deep/Harness mode + lock + phase + Continue.

    Ownership-gated FIRST (T-092-04 — 404, never leak existence). Then a joined
    read over the thread anchor -> workflow_runs -> workflow_definitions ->
    workflow_phases … NEVER writes …
    """
```

**The joined run → definition read** (`threads.py:1092-1108`) — the SQL shape for D-188-14's
"the definition version that actually ran":

```python
        wf_row = await _rls_fetchrow(
            """
            SELECT wr.status,
                   wr.continues_used,
                   wd.slug  AS definition_slug,
                   wd.name  AS definition_name,
                   cp.slug  AS current_phase_slug,
                   cp.phase_index AS current_phase_index,
                   (SELECT count(*) FROM workflow_phases wp
                     WHERE wp.workflow_run_id = wr.id) AS total_phases
            FROM workflow_runs wr
            JOIN workflow_definitions wd ON wd.id = wr.definition_id
            LEFT JOIN workflow_phases cp ON cp.id = wr.current_phase_id
            WHERE wr.id = $1
            """,
            UUID(active_workflow_run_id) if isinstance(active_workflow_run_id, str) else active_workflow_run_id,
        )
```

**The durable per-phase array + `phase_type` derivation** (`threads.py:1197-1235`) — the `phases: []`
half of the D-188-14 response shape, already written once. Do not re-derive it a second way:

```python
        phase_rows = await _rls_fetch(
            "SELECT slug, phase_index, status FROM workflow_phases "
            "WHERE workflow_run_id = $1 ORDER BY phase_index",
            UUID(phases_source_run_id) if isinstance(phases_source_run_id, str) else phases_source_run_id,
        )
        if phase_rows:
            # Derive slug → phase_type from the definition JSON so the frontend
            # timeline can render the correct 3D icon for completed/historical runs
            # (the workflow_phases table doesn't store phase_type).
            slug_to_type: dict[str, str] = {}
            …
            phases_list = [
                WorkflowPhaseState(
                    slug=r["slug"],
                    phase_index=r["phase_index"],
                    status=r["status"],
                    phase_type=slug_to_type.get(r["slug"]),
                )
                for r in phase_rows
            ]
```

⚠ The RLS-scoped fetch helpers (`_rls_fetchrow` / `_rls_fetch`, `threads.py:1074-1080`) are **local
closures inside `get_thread_workflow`**, not shared exports. If the new route uses asyncpg, copy the
closure shape; if it uses `supabase-py`, use `aexec(...)` as `runs.py` does. **Never a bare blocking
`supabase-py` call in an async handler** (CLAUDE.md).

**Router registration** (`main.py:701, 717`) — the import list *and* the `include_router` line, with the
one-line phase comment every registration carries:

```python
from app.api import threads, runs, documents, … , workflows, metadata_fields, …  # noqa: E402

app.include_router(workflows.router)  # Phase 092 MODE-01 — published-workflows picker feed
…
app.include_router(org.router)  # Phase 166 ADMIN-01/02/04 — org-admin surface …
```

**Canvas-gate registration** (`canvas_gate.py:56-66`) — the frozenset the new **path template** joins,
with its own instruction that the edit ships in the same commit:

```python
# THE ONE source of canvas-gated absolute paths for the whole app — read by BOTH halves
# below (the request-path gate and the schema filter). When Phase 183+ mounts a new canvas
# route, add its absolute path HERE in the SAME commit that mounts it — that single edit is
# what makes the route non-discoverable while off, on both channels. (Router prefix is
# "/workflows", hence the absolute form.)
CANVAS_GATED_PATHS: frozenset[str] = frozenset(
    {
        "/workflows/validate",
        "/workflows/grounding-bundle",
    }
)
```

⚠ The comment's parenthetical says "Router prefix is `/workflows`" — that is now false for 188's member.
Correct it in the same edit rather than leaving a docblock that names the wrong prefix (the
`PhaseNode.tsx:184-186` house rule: *"a comment that still names a slot the component now fills is the
same defect as a false docblock"*).

---

### 6. `backend/tests/test_188_workflow_run_read.py` (test, request-response)

**Analog:** `backend/tests/test_182_canvas_gate.py`

**Header + literal-declaration pattern** (`test_182_canvas_gate.py:34-61`) — note *why* the paths are
test-local literals; 188 must not import `CANVAS_GATED_PATHS` either:

```python
from types import SimpleNamespace

# The two canvas-gated routes (182-02). Kept as literals here — this file is the EXPECTATION
# side, so it must not read ``CANVAS_GATED_PATHS`` (a test that imports the constant it is
# checking would pass even if someone emptied the constant).
_VALIDATE_PATH = "/workflows/validate"
_BUNDLE_PATH = "/workflows/grounding-bundle"
_CANVAS_PATHS = (_VALIDATE_PATH, _BUNDLE_PATH)

# The honest 404 baseline: a path in the SAME namespace that was never built.
_UNBUILT_PATH = "/workflows/__nope__/__nope__"

# The five models declared ONLY by the two canvas routes.
_CANVAS_SCHEMAS = (
    "ValidateResponse",
    "Verdict",
    "GroundingBundleResponse",
    "PaletteFolder",
    "PaletteSkill",
)

# CONTROLS — a schema and a path from NON-canvas routes on the same router. These are what
# prove the filter removes the canvas surface and NOT more …
_CONTROL_SCHEMA = "PublishVerdict"
_CONTROL_PATH = "/workflows/published"
```

**The flag helpers — three lines each, copied per-file by convention, never shared** (`test_182_canvas_gate.py:64-85`):

```python
async def _is_op_true(user_id):
    return True


def _cold_off(monkeypatch):
    """Flag off (cold default): an empty feature_visibility map -> canvas resolves "off"."""
    from app.models import user_settings as us

    monkeypatch.setattr(us, "load_app_settings", lambda: SimpleNamespace(feature_visibility={}))


def _flipped_on(monkeypatch):
    """Operator On flip: a stored {"audience": "everyone"} record for the canvas key."""
    from app.models import user_settings as us

    monkeypatch.setattr(
        us,
        "load_app_settings",
        lambda: SimpleNamespace(
            feature_visibility={"visual_workflow_canvas": {"audience": "everyone"}}
        ),
    )
```

**THE EXACT-SET OPENAPI FENCE** (`test_182_canvas_gate.py:304-312`) — this is the assertion that goes RED
when `CANVAS_GATED_PATHS` gains `/workflow-runs/{workflow_run_id}` without a matching literal update:

```python
    assert set(off_again["paths"]) == set(off_doc["paths"])
    assert set(off_again["components"]["schemas"]) == set(off_doc["components"]["schemas"])

    # Exactly the canvas surface moved — nothing else drifted between the two states.
    assert set(on_doc["paths"]) - set(off_doc["paths"]) == set(_CANVAS_PATHS)
    assert set(on_doc["components"]["schemas"]) - set(
        off_doc["components"]["schemas"]
    ) == set(_CANVAS_SCHEMAS)
    assert not set(off_doc["paths"]) - set(on_doc["paths"])
```

⚠ **Read the new `_CANVAS_SCHEMAS` members off the assertion's own failure output.** RESEARCH A5 flags
that `WorkflowDefinition` is shared with `POST /workflows/validate`, so which models actually move is a
measurement, not a prediction. Run the test, read the diff it prints, then write the literals.

**THE 404-WHEN-OFF PROBE — mandatory by `test_revert_byte_identical.py`'s own header** (`:18-20`):

```
Each future canvas route (183+) MUST add its own "404 when off" assertion to
``test_require_canvas_404s_when_off`` (or a sibling) so the reachable-route set stays provably
empty while off — the gate grows WITH the surface it protects.
```

The probe body to mirror (`test_revert_byte_identical.py:122-165`) — note the **positive control** at the
bottom, which is what stops the 404 meaning "never built":

```python
    _cold_off(monkeypatch)

    # operator — "off" resolves BEFORE the operator no-op, so an operator gets the same 404
    monkeypatch.setattr(deps, "is_operator", _is_op_true)
    resp_op = client.get(_BUNDLE_PATH)
    assert resp_op.status_code == 404, resp_op.text
    assert resp_op.status_code != 403

    # end user — 404
    monkeypatch.setattr(deps, "is_operator", _is_op_false)
    resp_user = client.get(_BUNDLE_PATH)
    assert resp_user.status_code == 404, resp_user.text
    assert resp_user.status_code != 403
    …
    assert resp_malformed.json() == {"detail": "Not Found"}

    # POSITIVE CONTROL — the 404s above are the GATE, not an absent route. Both paths are
    # genuinely mounted with the probed method, so "404" cannot mean "never built" here.
    mounted = {
        (getattr(r, "path", None), m)
        for r in app.routes
        for m in (getattr(r, "methods", None) or set())
    }
    assert (_BUNDLE_PATH, "GET") in mounted, f"{_BUNDLE_PATH} is not mounted — the 404 is vacuous"
    assert (_VALIDATE_PATH, "POST") in mounted, f"{_VALIDATE_PATH} is not mounted — 404 is vacuous"
```

The 188 probe is the *easy* case: a body-free `GET`, so nothing can race the flag gate — the same shape
`_BUNDLE_PATH` has. Use a well-formed UUID in the path so a 422 can never race the 404.

---

## Pattern Assignments — MODIFIED FILES (the exact current bytes)

### `frontend/src/providers/StreamsProvider.tsx`

**(a) `DB_PHASE_STATUS` + the `?? "done"` fail-open — current code at `:3290-3341`:**

```ts
// Phase 098-UAT run-honesty fix (B): map a DB-native workflow_phases.status to the
// Phase status union the PhaseCard renders verbatim (active→running, completed→done).
const DB_PHASE_STATUS: Record<string, Phase["status"]> = {
  pending: "pending",
  active: "running",
  completed: "done",
  failed: "failed",
  skipped: "skipped",
}

async function reconcilePhases(threadId: string, signal?: AbortSignal): Promise<Phase[]> {
  const wf = await getThreadWorkflow(threadId, signal)
  // Live/ACTIVE harness run → the existing forward-only skeleton floor (UNCHANGED):
  // total_phases rows, the current one running. Slugs are unknown ahead of live
  // phase_started (only current_phase_slug is known), so non-current rows carry
  // positional placeholder slugs the live events replace.
  if (wf.mode === "harness" && !wf.lock_is_stale) {
    const total = wf.total_phases ?? 0
    if (total <= 0) return []
    const current = wf.current_phase_index ?? 0
    return Array.from({ length: total }, (_, i): Phase => ({
      slug: i === current ? (wf.current_phase_slug ?? `phase-${i}`) : `phase-${i}`,
      phaseIndex: i,
      phaseType: "unknown",
      status: i < current ? "done" : i === current ? "running" : "pending",
      subAgents: [],
      pendingAsk: null,
    }))
  }
  …
  const rows = wf.phases ?? []
  if (rows.length === 0) return []
  return rows
    .slice()
    .sort((a, b) => a.phase_index - b.phase_index)
    .map((r): Phase => ({
      slug: r.slug,
      phaseIndex: r.phase_index,
      phaseType: r.phase_type ?? "unknown",
      status: DB_PHASE_STATUS[r.status] ?? "done",
      subAgents: [],
      pendingAsk: null,
  }))
}
```

Three edits land here: (1) `DB_PHASE_STATUS` moves to `lib/phaseState.ts` and this file imports
`phaseStatusFromDb`; (2) `?? "done"` → the total function's `"unknown"`; (3) the **live** branch (the
`Array.from` skeleton, lines above) overlays real `slug` + `phaseType` from `wf.phases` by `phase_index`
— RESEARCH OQ4 measured that `wf.phases` is fully populated from t=0, so the overlay is complete.
⚠ Overlay **identity only** (`slug`, `phaseType`); leave the positional `status` derivation alone or the
forward-only floor (`PhaseTimeline.tsx:115-127`) can move backward.

**(b) THE SECOND, REACHABLE fail-open — `finalizeAllPhasesForThread` at `:2802-2827`:**

```ts
        // Phase 098-UAT run-honesty fix (A): on a SUCCESSFUL run completion, sweep
        // any lingering non-terminal phase to "done". A phase flips running→done
        // ONLY when its own phase_completed SSE is observed live; across the
        // ask_user pause / a consumer reattach phase-0's completed can be missed,
        // and nothing else corrects it in-session (onRunCompleted was a no-op; the
        // terminal reconcile floor returned []). Mirror the DB ground truth (every
        // phase of a completed run IS completed). NEVER touch a phase that
        // legitimately ended failed/skipped — those are terminal truths, not
        // stragglers. Closure threadId only (PANEL-09); phasesByThread only.
        finalizeAllPhasesForThread: (threadId) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.phasesByThread)
            const prev = next.get(threadId)
            if (!prev || prev.length === 0) return {}
            let changed = false
            const swept = prev.map((p) => {
              if (p.status === "running" || p.status === "retrying" || p.status === "pending") {
                changed = true
                return { ...p, status: "done" as const }
              }
              return p
            })
            if (!changed) return {}
            next.set(threadId, swept)
            return { phasesByThread: next }
          }),
```

The fix is dropping `|| p.status === "pending"` — **one token**. The docblock's own words
(*"NEVER touch a phase that legitimately ended failed/skipped — those are terminal truths"*) are the
argument for it: a `pending` phase a `skip_to_phase` jumped over is a *never-ran* truth by the same logic.

**The pattern for the sibling that already got this right** (`:2828-2839`) — note it explains its by-INDEX
choice and enumerates what it never touches. Write the 188 amendment in this voice:

```ts
        // BUG-260609-01 mid-run fix: flip EARLIER phases (phaseIndex < beforeIndex)
        // still in {running,retrying} → done when a later phase goes live. By-INDEX
        // (survives a placeholder-slug mismatch); never touches skipped/failed/pending
        // or the current/later phases, so a real skip/failure is never masked.
```

### `frontend/src/types/index.ts` — the `Phase` interface at `:1010-1025`

```ts
export interface Phase {
  slug: string
  phaseIndex: number
  phaseType: string
  status: "pending" | "running" | "done" | "failed" | "retrying" | "skipped"
  attempt?: number
  error?: string
  subAgents: TaskRunIndexItem[]
  pendingAsk: string | null
  /** GAP-C (D-11) — the live emit sub-step … */
  emitSubStep?: EmitSubStep
  /** GAP-C (D-11) — the terminal emit failure value … */
  emitFailure?: EmitFailure
}
```

`EmitFailure` (the closed set the UI-SPEC's three failure clauses read) is directly above at `:1003-1008`:

```ts
export type EmitFailure =
  | "model_failed_to_emit"
  | "citation_gate_rejected"
  | "render_failed"
  | "integrity_failed"
  | "no_template_bound"
```

**Additive-type-widening precedent:** `PhaseSpec.name_seeded_by_ai` (187-02) — an optional additive field
with a docblock naming the phase that added it. Same discipline for `| "unknown"`.

### `frontend/src/components/panel/PhaseCard.tsx` — `STATUS_META` at `:56-79`

```ts
// ── STATUS_GLYPH (DATA-CONTRACT §5.3) — status → glyph + REAL text + AA color
//    token (non-color-alone, UI-SPEC §A11Y). Status text uses --color-text /
//    --panel-status-* (≥4.5:1) — NEVER --muted-foreground-dim (3.59:1 fail).
//    `retrying` text reads "Attempt N" (filled in at render from phase.attempt). ──
interface StatusMeta {
  glyph: string
  /** Base text (retrying substitutes "Attempt N" at render). */
  text: string
  /** Tailwind class for the AA-contrast status text color. */
  textClass: string
}
const STATUS_META: Record<Phase["status"], StatusMeta> = {
  pending: { glyph: "○", text: "Locked", textClass: "text-panel-muted-foreground" },
  running: { glyph: "●", text: "Running", textClass: "text-[hsl(var(--panel-status-active))]" },
  done: { glyph: "✓", text: "Complete", textClass: "text-[hsl(var(--panel-status-done))]" },
  // Lightened red text on the dim fill clears 4.5:1 (UI-SPEC §A11Y contrast note).
  failed: { glyph: "✕", text: "Failed", textClass: "text-[hsl(0_80%_80%)]" },
  // WR-04: the pill LABEL TEXT uses the LIGHTENED --accent-violet-text …
  retrying: { glyph: "↻", text: "Attempt", textClass: "text-accent-violet-text" },
  skipped: { glyph: "⤳", text: "Skipped", textClass: "text-panel-muted-foreground" },
}
```

This `Record<Phase["status"], …>` is **the** compiler forcing-function of D-188-08: widening the union
produces exactly one error, here. The new entry is `unknown: { glyph: "?", text: "Unknown", textClass: … }`
— **add** a row, change none. `?` is inherited from `VERDICT_MARK.unknown` (`nodePresentation.ts`, the
const begins at `:174`; the `unknown` member is at `:185` — RESEARCH corrected CONTEXT's `:176` cite).

### `frontend/src/components/panel/PhaseTimeline.tsx:34-40`

```ts
/** The run-level reconcile frame this timeline needs (subset of ThreadWorkflowState). */
type RunFrame = Pick<
  ThreadWorkflowState,
  "mode" | "definition_name" | "run_status" | "current_phase_index" | "total_phases"
>

const TERMINAL_RUN_STATUSES = new Set(["completed", "failed", "cancelled", "timed_out"])
```

Move the `Set` to `lib/phaseState.ts` and import it. D-188-21: **carry `timed_out` forward unchanged**
(RESEARCH OQ5 measured it dead but the decision is locked; record the measurement, do not delete).

### `frontend/src/components/workflows/PhaseNode.tsx` — the badge/slot contract at `:160-226`

```tsx
  // DO NOT FILL THE FREED SLOT with a governance mark. The freed slot belongs to
  // Phase 188 (run state) and Phase 189 (external actions), and `BadgeSlots` is a max-2
  // tuple union, so a third badge is a typecheck error rather than a review comment …
  //
  // Slot 2 is unchanged: `Waits for you`, on `llm_human_input` only (D-183-07).
  const waitsForYou: BadgeSlot = {
    testId: "canvas-waits-for-you",
    tone: "primary",
    label: "Waits for you",
    dataAttr: { "data-waits-for-you": "true" },
  }
  const badges: BadgeSlots = data.waitsForYou ? [waitsForYou] : []

  // `status`, `technicalLine` and `stepNumber` are still deliberately NOT passed: Wave 0
  // landed the seam and Phase 188 lands those. `verdict` WAS in that list until 184-10
  // and `grounded` until 185-09 — the line is corrected each time rather than left,
  // because a comment that still names a slot the component now fills is the same defect
  // as a false docblock.
  …
  return (
    <PhaseNodeCard
      slug={data.slug}
      phaseType={data.phaseType}
      icon={renderPhaseMark(data.phaseType)}
      title={data.title}
      subtitle={technical ? data.technicalTitle : data.subtitle}
      tint={tint}
      badges={badges}
      verdict={verdict}
      grounded={data.grounded}
      selected={selected}
      anchors={<EdgeAnchors />}
    />
  )
```

⚠ **The `:182-186` comment is a maintenance obligation, not decoration.** 188 removes `status` from that
list and must state that `technicalLine` and `stepNumber` remain unspent (UI-SPEC § Card Body Budget
rule 2 — `technicalLine` is DECLINED). `badges` is untouched: **188 spends zero slots.**

`⤳` — the collision the UI-SPEC forbids reusing — is at `PhaseNode.tsx:257` (RESEARCH corrected
`icon-convention.md` §4's stale `:238` cite):

```tsx
      <EdgeAnchors />
      <span aria-hidden="true">⤳</span>
      <span>
        on fail → goes to <span className="font-mono font-medium">{data.declaredTarget}</span> — no
        such step
      </span>
```

### `frontend/src/components/workflows/PhaseNodeCard.tsx`

**The opaque alias 188 replaces** (`:173-179`):

```tsx
 * 184 has no run state at all, so declaring the literals here would be inventing
 * them. The alias is deliberately opaque today; Phase 188 replaces it with its own
 * union, which cannot break a 184 caller because 184 has none — the adapter never
 * passes it and the card renders nothing for it.
 */
export type NodeRunStatus = string
```

**The prop slot** (`:203-204`):

```tsx
  /** Phase 188's run state. Declared, rendered as nothing in 184. */
  status?: NodeRunStatus
```

**The border ternary 188 prepends one branch to** (`:304-315`) — "mutually exclusive on purpose, one
border-colour utility per state":

```tsx
      <div
        className={cn(
          "mx-auto block w-[248px] rounded-[22px] border pb-5 pt-[42px] px-5 text-center",
          "bg-card/30 backdrop-blur-sm",
          "shadow-[0_1px_0_hsl(var(--foreground)/0.06)_inset,0_18px_36px_-22px_rgba(0,0,0,0.95)]",
          selected
            ? "border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
            : grounded
              ? "border-[hsl(220_30%_100%/0.34)]"
              : "border-border/50",
        )}
        style={{ minHeight: CANVAS_LAYOUT.NODE_MIN_HEIGHT }}
      >
```

**The ⛨ seal — the invariant, and the sibling-of-the-mark placement the ring copies** (`:403-443`):

```tsx
          THEREFORE IT IS NEVER CONDITIONAL ON RUN STATE. This block reads `grounded`
          and nothing else — no `status`, no selection, no run phase. … `PhaseNodeCard.test.tsx`
          pins that mechanically, twice: a `?raw` props fence proving this block never names the
          run-state prop, and a four-value render asserting the seal's class list and text are
          IDENTICAL across every run state. */}
      {grounded ? (
        <span
          data-testid="canvas-node-seal"
          data-grounded="true"
          className={cn(
            "pointer-events-none absolute right-[17px] top-[11px] z-[6] grid h-[21px] w-[21px]",
            "place-items-center rounded-full text-[11px] leading-none",
            "border border-[hsl(220_30%_100%/0.34)] bg-[hsl(220_30%_100%/0.1)] text-foreground",
          )}
        >
          <span aria-hidden="true">⛨</span>
          <span className="sr-only">{GOVERNANCE_SEAL_LABEL}</span>
        </span>
      ) : null}
```

⚠ **The existing seal test is a FOUR-value render.** D-188-04 widens it to **seven**. That is an edit to a
shipped guard, not a new one.

**THE RING'S PLACEMENT ANALOG — the 3D mark well it is concentric with** (`:445-475`). Copy the
`pointer-events-none absolute left-1/2 … -translate-x-1/2 place-items-center` composition and the
overflow warning verbatim:

```tsx
      {/* The 3D mark FLOATING ABOVE THE CARD'S TOP EDGE, horizontally centred on it
          (`themes/canvas-184.css` `body.card-b .node .icowrap`: `left:50%; top:-26px;
          62×62`) …

          It overflows the node box upward by 26px. That is the SAME overflow the
          verdict mark already relies on, and it is why nothing in this subtree — or in
          the node wrapper around it — may ever take `overflow-hidden`. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-26px] grid h-[62px] w-[62px] -translate-x-1/2 place-items-center"
      >
```

⚠ The ring is `top-[-31px] h-[72px] w-[72px] z-[5]` (UI-SPEC), rendered **immediately before** this span
so the mark paints above the arc. Note this element carries **no** `style={{ transform }}` — the only
transform in the ring subtree is the `.canvas-ring-spin` class (UI-SPEC § Motion, D-188-07(2)).

### `frontend/src/components/workflows/WorkflowCanvas.tsx` — ⚠ HARD CAP ≤ 15 ins / ≤ 4 del

**THE PROP-MIRROR PRECEDENT — `marks?:`, measured at 5 comment lines + 1 declaration** (`:801-807`):

```tsx
  /**
   * The server-derived verdict mark for one node, or `undefined` when the server said
   * nothing about it. Supplied by the page from `verdictModel.markFor` — **this canvas
   * derives no severity and asks no server for one**; its own suite forbids the string
   * that names the validation seam, which is what keeps that boundary structural.
   */
  marks?: (slug: string) => VerdictMarkKind | undefined
```

**The destructure list** (`:865-881`) — one identifier is added, nothing else moves:

```tsx
export function WorkflowCanvas({
  phases,
  selectedSlug,
  onSelectNode,
  onClearSelection,
  kbTools,
  nameContext,
  editable = false,
  marks,
  nudges,
  onNudge,
  onCommitNodes,
  onInsertAt,
  onRequestRemove,
  notice,
  session,
}: WorkflowCanvasProps) {
```

**THE `settledNodes` MEMO — the two lines that change** (`:926-956`, read at HEAD):

```tsx
  const settledNodes = useMemo<CanvasNode[]>(
    () =>
      projection.nodes.map((node) => {
        if (node.type !== CANVAS_NODE_TYPES.phase) return node

        // The cosmetic offset is merged into a COPY of the position. A zero offset
        // reuses the model's own object, so an idle canvas hands the library a stable
        // reference and does not re-measure on every parent render.
        const dy = nudges?.[node.id] ?? 0
        const position = dy === 0 ? node.position : { x: node.position.x, y: node.position.y + dy }

        const measured = measuredById[node.id]

        return {
          ...node,
          position,
          // Carried so `adoptUserNodes`'s else-branch finds a measurement on the object
          // we hand it. Without this every rebuilt node is briefly `hidden`.
          ...(measured === undefined ? {} : { measured }),
          // THE ONE READ-ONLY OPT-OUT THAT FLIPS, and it flips PER NODE: the end cap and
          // the broken-reference stub keep the `false` the model gave them.
          draggable: editable,
          selected: node.id === selectedSlug,
          // The verdict is threaded exactly as the ⌥ reveal is (D-183-08 / D-184-06), so
          // `PhaseNode` stays a context-free leaf and cannot grow a second source of
          // truth for a value only the server owns.
          data: { ...node.data, technical: showTechnical, verdict: marks?.(node.id) },
        }
      }),
    [projection.nodes, selectedSlug, showTechnical, editable, marks, nudges, measuredById],
  )
```

⚠ **The memo split is load-bearing and must not be collapsed** (`:918-925` + `:958-973`):

```tsx
   * Split from the overlay deliberately. `handleNodesChange` fires `setDragOverlay` on
   * every pointer frame; when the overlay was a dependency of the ONE memo, a drag
   * rebuilt every node object AND a fresh `data` object for each, so React Flow
   * re-rendered all of them ~60×/s and the cards visibly flickered.
```

`runState` belongs in **`settledNodes`** (which excludes `dragOverlay`), and the page must `useCallback`
the lookup — an inline arrow at the call site is a new identity every render and defeats the memo.

The measured minimum diff (RESEARCH OQ7, itemised against `marks`): **10 insertions / 2 deletions**, plus
the UI-SPEC's one-line `ariaLabel` append ⇒ **11 / 2**. Cap: **≤ 15 / ≤ 4**, pinned with
`git diff --numstat -- frontend/src/components/workflows/WorkflowCanvas.tsx` (the `187-08` ≤7/≤2 discipline).

### `frontend/src/components/layout/ChatLayout.tsx`

**`doRun`'s tail — current code at `:233-269`** (the WR-04 cleanup that must survive is quoted in full so
the executor can see exactly which two lines D-188-12 replaces):

```tsx
  const doRun = useCallback(
    async (
      def: PublishedWorkflow,
      kickoff: string,
      opts?: { templateFile?: File | null; folderId?: string | null },
    ) => {
      const templateFile = opts?.templateFile ?? null
      const folderId = opts?.folderId ?? null
      const thread = await createThread(def.name)
      // WR-04: a post-create failure (a template 422 — now a routine step — or a
      // postMessage 409/network error) must NOT strand the created thread shell …
      try {
        if (templateFile) await uploadWorkspaceTemplate(thread.id, templateFile)
        await postMessage(thread.id, kickoff, {
          workflowDefinitionId: def.id,
          ...(folderId ? { folderId } : {}),
        })
      } catch (e) {
        void deleteLaunchThread(thread.id).catch(() => {}) // don't leak the launch shell
        throw e
      }
      // Only reached on a successful launch — never runs after a thrown/cleaned failure.
      await loadThreads()
      selectThread(thread)
      onNavigate("chat")
    },
    [loadThreads, selectThread, onNavigate],
  )
```

Only `selectThread(thread); onNavigate("chat")` changes. Everything above the `// Only reached` comment is
Req 6's second acceptance criterion (*the thread is still created and still anchors the run*) and is a
guard against over-deleting.

**The render branch — the positional-fallback trap, and the five inline comments that already name it**
(`:577-648`). The 188 branch goes **immediately before** `<KnowledgeHealthPage />`, in this voice:

```tsx
      ) : (
        <main className="flex-1 overflow-hidden">
          {activeView === "documents" ? (
            <IngestionPage onNavigate={onNavigate} />
          …
          ) : activeView === "governance" ? (
            // Phase 119 (DGOV-01/02): the Governance top-level home mounts here as
            // a peer to Library Health (the D-119-2 navigation triad — App.tsx
            // union + this branch + the nav-items entry, all owned in-phase so the
            // surface is reachable; the Phase 118 built-but-unreachable lesson).
            // Self-fetches the 3 governance signals — no props; three-homes, no router.
            <GovernancePage />
          …
          ) : activeView === "org-admin" ? (
            …
            <OrgAdminShell onBack={() => onNavigate("chat")} />
          ) : (
            <KnowledgeHealthPage />
          )}
        </main>
      )}
```

**The free win, structurally:** the composer, the message list and `<WorkspacePanel>` are all inside the
`activeView === "chat" ?` branch at `:541-576`. A view on the `else` side renders none of them, so SPEC
Req 6's "no message list and no composer" is a property of the layout.

**`activeRunId` state** — `ChatLayout` already owns per-view state in exactly this style; `panelState` and
`drawerOpen` are the local precedents, and `studioSkillId` is the App-held precedent for a per-view id.

### `frontend/src/App.tsx:91` — the `ActiveView` union (11 → 12, one line)

```tsx
export type ActiveView = "chat" | "documents" | "skills" | "settings" | "library-health" | "workflows" | "classification-rules" | "governance" | "skill-studio" | "control-room" | "org-admin"
```

### `scripts/vitest-count-gate.cjs` — ⚠ LOAD-BEARING, two knobs

**`TARGETS` — what RUNS** (`:192-211`, verbatim):

```js
// ── The Wave-0 blast radius (184-VALIDATION.md § "quick run command"). ──
const TARGETS = [
  "src/components/workflows",
  "src/pages/WorkflowBuilderPage.test.tsx",
  "src/pages/WorkflowBuilderPage.canvas.test.tsx",
  "src/components/admin/revertByteIdentical.test.tsx",
  // Added in 184.1. This suite is the ONLY thing pinning the flag-off Builder header —
  // D-181-01's Builder half was unguarded until it existed — so leaving it outside the
  // gate's blast radius would mean the one guard for a byte-identity promise could be
  // deleted without the gate noticing. It is deliberately NOT added to BASELINE: it
  // postdates the 424 pin, so it reports as `new` and its own count is free to grow.
  "src/pages/WorkflowBuilderPage.header.test.tsx",
  // Added post-round-5 (CR-R5-01 / verification truth 14). TARGETS and BASELINE are TWO
  // knobs: TARGETS decides what RUNS, BASELINE decides what is PINNED, and a page-level
  // suite lands outside BOTH by default because the directory entry above only covers
  // `src/components/workflows`. Round 5 pinned three suites and still left GAP A's only
  // end-to-end wire fence unguarded — this file was never even EXECUTED by the gate. That
  // is round-3's WR-16 recurring, so the fix is the entry, not another comment about it.
  "src/pages/WorkflowBuilderPage.describe.test.tsx",
]
```

**`BASELINE` — what is PINNED** (`:92-190`, the head and tail of the block; the middle is the
per-file rationale comments, which are the house style for every new pin):

```js
// ── The pin. Keyed by BARE filename (testResults[].name is an absolute path). ──
const BASELINE = {
  …
  "definitionOps.test.ts": 232,
  "canvasModel.fixtures.test.ts": 100,
  "canvasModel.purity.test.ts": 69,
  "SeedReceipt.test.tsx": 68,
  // 185-08: 42 → 33. Req 6 deleted the slot-1 grounding word-badge; the 9 `it()`
  // blocks over its three faces went with it. Measured, not computed.
  "phaseVocabulary.test.ts": 33,
  "WorkflowCanvas.test.tsx": 31,
  …
  "DescribeKbPicker.test.tsx": 37,
  "ProblemsTray.test.tsx": 30,
  "verdictModel.test.ts": 29,
  "canvasModel.test.ts": 26,
  "PublishGauntlet.test.tsx": 24,
  "WorkflowBuilderPage.canvas.test.tsx": 128,
  "WorkflowBuilderPage.describe.test.tsx": 19,
  "PhaseFormPanel.test.tsx": 19,
  "WorkflowBuilderPage.test.tsx": 15,
  "PhaseSpineGraph.test.tsx": 14,
  "soulData.test.ts": 14,
  "WorkflowDoorSwitch.test.tsx": 23,
  "PhaseSpine.test.tsx": 11,
  "deriveTier.test.ts": 9,
  "WorkflowSoul.test.tsx": 8,
  "revertByteIdentical.test.tsx": 7,
}

// Still COMPUTED, never hand-written — the reduce is the single source …
const BASELINE_TOTAL = Object.values(BASELINE).reduce((a, b) => a + b, 0) // 946
```

**Consequences for 188, read off the two blocks above:**

| New/target file | Runs today? | Pinned today? | Required action |
|---|---|---|---|
| `src/lib/phaseState.test.ts` | ❌ | ❌ | add to **both** |
| `src/pages/WorkflowRunPage.test.tsx` | ❌ | ❌ | add to **both** |
| `src/components/panel/__tests__/PhaseReconcile.test.tsx` (existing — the Pitfall-1 RED lives here) | ❌ | ❌ | add to **both** if 188 relies on it |
| `src/components/workflows/PhaseNodeCard.test.tsx` (68 cases, runs) | ✅ | ❌ | add to `BASELINE` — 188's seal-at-seven guard lands here |
| `src/components/workflows/PhaseNode.test.tsx` (13 cases, runs) | ✅ | ❌ | add to `BASELINE` — Req 2 + Req 5 guards land here |

**Pin-value rule, from the script's own header:** read the number from the script's printed `actual`
column across **two agreeing runs**, never hand-count `it(` literals (`definitionOps.test.ts` declares
~122 and runs 232 under `it.each`), then observe one deletion catching `[count-decrease]`.

---

## Shared Patterns

### Fail CLOSED on an unrecognised state
**Source:** `workspacePanel.ts:75-88` (`default: return "pending"` — the *least* claim, never the most),
plus the two 188 fail-opens quoted above.
**Apply to:** `phaseStatusFromDb`, `canvasReading`, the run-band map (UI-SPEC's *anything else → State
unknown*), and the `finalizeAllPhasesForThread` predicate.
**Cautionary precedent in-tree:** the publish gauntlet's `findIndex → -1` painted an unknown
`blocked_stage` as 8/8 GREEN. `?? "done"` is the same lesson, third occurrence.

### Observe the falsification RED first
**Source:** `DescribeKbPicker.test.tsx:1-6` — the header states it as a property of the file:

```
 * WRITTEN AND OBSERVED RED BEFORE THE COMPONENT EXISTED. Round 4's whole subject was
 * guards that never bit, so every fence below carries a POSITIVE CONTROL that proves the
 * needle can match. A fence nobody has watched fail is a gesture.
```
**Apply to:** both 188 fail-open tests (D-188-09). Paste raw output into the plan summary.
⚠ RESEARCH Pitfall 2: the `?? "done"` RED must drive the **terminal** branch of `reconcilePhases`
(rows from `wf.phases`). The **live** branch never touches `DB_PHASE_STATUS` — a test that drives it is
green before *and* after and proves nothing.

### Positive controls on every absence assertion
**Source:** `phaseVocabulary.test.ts:854-858` and `DescribeKbPicker.test.tsx:365-371`.
**Apply to:** every Req 2 grep, the Req 5 string-inequality, the seal-identity assertions.

### Canvas gate — one edit, both halves, same commit
**Source:** `canvas_gate.py:56-60` (the constant's own instruction) + `dependencies.py:615-696`
(`require_canvas`, quoted in full above at the step-order comments).
**Apply to:** the new route. Request side: `require_canvas` is the authority (`_is_canvas_path` does exact
membership on the *request* path — `canvas_gate.py:135-137` — so a template never matches). Schema side:
the **template** in `CANVAS_GATED_PATHS` is load-bearing.

### Ownership-gated read → 404, never 403, never 200-with-empty
**Source:** `threads.py:1053-1063` and `runs.py:700-750`.
**Apply to:** `GET /workflow-runs/{workflow_run_id}`. Detail string mirrors the family: `"Run not found"`
at the handler; the *gate's* 404 body is byte-identical `{"detail": "Not Found"}`.

### Every authored string renders as a plain text child
**Source:** `workspacePanel.ts:27-30` (*"the render consumer renders them as React text children, NEVER
`dangerouslySetInnerHTML` (T-095.1-01-01)"*) and `PhaseNode.tsx`'s house grep clause.
**Apply to:** the workflow name, phase titles and the run band's `Failed at "{step title}"`.

### `useCallback` any function passed into a memo dependency
**Source:** `SkillStudioPage.tsx:104-129` (`refreshGate` / `refreshVersions`).
**Apply to:** the page's `runState` lookup (RESEARCH Pitfall 6).

---

## No Analog Found

| File / element | Role | Data flow | Reason |
|---|---|---|---|
| The **status ring SVG** inside `PhaseNodeCard.tsx` | presentational leaf | — | **There is no `stroke-dasharray`/`stroke-dashoffset` arc anywhere in `frontend/src`.** The canvas's only SVG idioms are React Flow's own edges. Build it from `188-UI-SPEC.md § The Status Ring` (which supplies `C = 213.628`, the per-reading dasharray table, and `offset = (D + G/2) − p`) — **compute every number from the formula in code; the decimals in the table are expected results for falsification, not literals to paste.** The nearest *placement* analog is the 3D mark well quoted above; there is no geometry analog. |
| `frontend/src/components/workflows/runVocabulary.ts` (the canvas BUSINESS-word table) | utility | transform | Partial analog only. `components/workflows/phaseVocabulary.ts` is the right *shape* (a vocabulary module with `?raw`-fenced purity), but D-188-02 forbids merging the two — one derivation, **two** vocabularies. If the planner sites the words in `phaseVocabulary.ts` instead of a new file, the Req 8 grep must then distinguish *vocabulary* from *derivation*, which is harder to fence. A separate file is cheaper. |
| An elapsed-time formatter (`fmtElapsed`) | utility | transform | No shared elapsed helper exists in `lib/`. `FilesSection.tsx:38-42` shows the house shape for a small local formatter (a plain `if`-ladder returning a string, sited next to its one consumer). RESEARCH § Alternatives rejects adding `date-fns`/`dayjs` for one label. |
| A **reconnect-driven** `reconcile()` call | hook wiring | event-driven | **Does not exist at HEAD.** `usePanelReconcile`'s own docblock (`:20-22`) states the D-086-15 exclusion (no `visibilitychange`/`focus`/`pageshow`), and the only production `reconcile()` call in the tree is `PendingAskCard.tsx:239` for its own hook. SPEC Req 4's *"reconciles on fetch at every reconnect"* is aspirational — the plan must say which option it takes (RESEARCH Pitfall 3). |
| `GET /workflow-runs` (a list) | route | CRUD | Deliberately out of scope (SPEC). Named here so no executor infers a list route from the router's plural prefix. |

---

## Metadata

**Analog search scope:** `frontend/src/lib/`, `frontend/src/pages/`, `frontend/src/components/{workflows,panel,layout}/`,
`frontend/src/providers/`, `backend/app/api/`, `backend/app/middleware/`, `backend/tests/`, `scripts/`.
**Files read this session:** 26 (17 frontend, 7 backend, 1 script, plus the 4 phase documents).
**Early-stop:** the analog search stopped at 6 strong matches — every net-new file has an exact or
role-match analog with quoted code, and the modified files have their current bytes quoted.

**Corrections to inherited line-number cites (measured this session, matching RESEARCH § State of the Art):**

| Cited as | Actually at HEAD |
|---|---|
| `types/index.ts:1013` (`Phase["status"]`) | `:1014` |
| `nodePresentation.ts:176` (`VERDICT_MARK`) | const begins `:174`; `unknown` member `:185` |
| `PhaseNode.tsx:238` (`⤳`) | `:257` |
| `StreamsProvider.tsx:2811-2826` (the sweep) | `:2802-2827` incl. its docblock; the predicate is `:2818` |
| `WorkflowCanvas.tsx:952` (the `data` merge) | `:952` — confirmed |
| `PhaseCard.tsx:67-79` (`STATUS_META`) | `:67-79` — confirmed |
| `PhaseTimeline.tsx:40` (`TERMINAL_RUN_STATUSES`) | `:40` — confirmed |
| `workflows.py:600-612` (the gate precedent) | `:600-614` |

*Phase: 188-non-technical-run-observability*
*Pattern extraction date: 2026-08-05*
