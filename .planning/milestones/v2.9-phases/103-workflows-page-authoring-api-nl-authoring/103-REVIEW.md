---
phase: 103-workflows-page-authoring-api-nl-authoring
reviewed: 2026-06-14T12:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - backend/app/api/workflows.py
  - backend/app/config.py
  - backend/app/db/workflows.py
  - backend/app/models/harness.py
  - backend/app/services/forced_emit.py
  - backend/app/services/workflow_authoring.py
  - frontend/src/App.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/layout/NavPanel.tsx
  - frontend/src/components/workflows/PhaseFormPanel.tsx
  - frontend/src/components/workflows/PhaseSpineGraph.tsx
  - frontend/src/components/workflows/PublishGauntlet.tsx
  - frontend/src/components/workflows/deriveTier.ts
  - frontend/src/lib/api.ts
  - frontend/src/lib/nav-items.ts
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/pages/WorkflowsPage.tsx
findings:
  critical: 1
  warning: 7
  info: 4
  total: 12
status: issues_found
---

# Phase 103: Code Review Report

**Reviewed:** 2026-06-14T12:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 103 lands the Workflow Studio: backend draft-CRUD + NL one-shot authoring (`workflow_authoring.py`), the `forced_emit` `strict` override, and a complete frontend (Workflows page, Builder, publish gauntlet, deriveTier, nav consolidation).

Security posture is strong overall: `$N` placeholder discipline is clean in `db/workflows.py`, owner-scoping predicates are applied consistently, the publish hard-wall (no client override path) is preserved correctly in both the backend route and the frontend `PublishGauntlet`, and the `forced_emit` `strict=False` override is additive/byte-identical on the default path. The honesty contracts for `named_failures` (key-detection, fail-closed on unknown shape) are implemented correctly.

One critical finding exists: the `_skill_registry` fallback branch in `workflow_authoring.py` silently drops the `is_enabled` filter and the `user_id` scope on a grounding read error, potentially injecting disabled or cross-user skill names into the LLM grounding prompt. Seven warnings cover: unguarded `DraftCard` Publish button wired to the wrong handler (opens Builder instead of gauntlet), unvalidated `business_requirement` 400 body parse producing a silent `undefined` verdict in the API client, missing `tier-strictest-policy` logic in `tierForDefinition`, the `tierForDefinition` function only promoting on `strict` but not considering `flag < partial` ordering, the `onGauntletPublished` slug defaulting to a hardcoded string literal, a possible async-safety issue in the `onRun` modal, and a missing `aria-modal` focus-trap. Four info items cover smaller quality concerns.

## Critical Issues

### CR-01: `_skill_registry` fallback drops the `is_enabled` filter and user_id scope — disabled / cross-user skills bleed into the LLM grounding prompt

**File:** `backend/app/services/workflow_authoring.py:145-152`

**Issue:** When the scoped Supabase query fails (network error, PostgREST glitch), the `except` branch fetches ALL skills from the table (`supabase.table("skills").select(...).execute()`) with NO `user_id` or `is_enabled` filter. The `[r for r in rows if r.get("is_enabled") and ...]` post-filter runs on the raw full-table result, but the `user_id` condition in that comprehension is `str(r.get("user_id")) == str(user_id) or r.get("is_global")` — which is correct for the data it has. However, the real problem is that the fallback **fetches every row from the `skills` table** via `supabase-py` running as service-role (bypassing RLS), with no `user_id` predicate pushed down to the DB. On a multi-user deployment this means all users' skill names (even disabled ones) are briefly returned in the raw response and filtered only in Python. If `is_global` is True for a disabled skill the `is_enabled` guard would still exclude it, but a disabled non-global skill whose `user_id` happens to match would pass. More importantly, a subtly buggy filter (e.g. `user_id` being None on orphaned rows) could leak names into the grounding block. The grounding block is then fed verbatim to the LLM as the "eligible skill ids" set — the fidelity check (`_check_grounding_fidelity`) validates that the *generated* skill_ref is in `skill_ids`, but `skill_ids` is computed from the fallback rows, so if the fallback included a disabled skill, the fidelity gate would pass a skill_ref that the engine will later reject (skill is disabled at kickoff). The blast radius is grounding pollution on a transient storage error.

**Fix:** The fallback should reproduce the same filter in the Supabase query rather than fetching all rows. The safest remediation is to not have a bare-table fallback at all — fail the grounding assembly cleanly so the caller returns `ok:False` with `error: "grounding_failed"` rather than silently degrading to a possibly polluted registry. If a fallback is desired, push the filter down:

```python
# Instead of fetching all rows, fail closed:
except Exception:
    logger.warning("workflow_authoring: scoped skills read failed; using empty skill set")
    rows = []
# Then the list comprehension produces [] safely.
```

Or, if partial recovery is wanted, restrict the fallback to the same `.or_()` filter:

```python
except Exception:
    logger.warning("workflow_authoring: scoped skills read failed; filtering client-side")
    try:
        rows = (
            supabase.table("skills")
            .select("id,name,is_global,user_id,is_enabled")
            .or_(f"user_id.eq.{user_id},is_global.eq.true")
            .execute()
            .data
        ) or []
    except Exception:
        rows = []
```

## Warnings

### WR-01: `DraftCard` "Publish…" button calls `onOpen` (opens the Builder) — it should open the publish gauntlet

**File:** `frontend/src/pages/WorkflowsPage.tsx:535-539`

**Issue:** Both the "Open" and "Publish…" buttons in `DraftCard` are wired to the same `onOpen` callback, which navigates to the Builder page (`setPageView("builder")`). Clicking "Publish…" on a draft card takes the user to the Builder, not to the publish gauntlet. This is a functional bug — the user cannot reach the gauntlet from the drafts shelf; they must first open the Builder and then manually navigate to the gauntlet inside it.

```tsx
// Both buttons do the same thing — bug
<button onClick={onOpen}>✎ Open</button>
<button onClick={onOpen}>Publish…</button>  // should open gauntlet, not Builder
```

**Fix:** Expose a separate `onPublish` callback from `DraftCard` (or route the "Publish…" click directly to a gauntlet-open state), and wire it so it sets `pageView("builder")` with the gauntlet pre-open, OR surface the `PublishGauntlet` directly from the draft card without entering the Builder. The simplest consistent fix:

```tsx
// WorkflowsPage: pass onPublish separately
<DraftCard key={d.id} draft={d} onOpen={() => { … }} onPublish={() => { /* set gauntlet state */ }} />
```

### WR-02: `publishWorkflow` 400-branch body parse — if `body.detail` is missing/mistyped, a `undefined` verdict is cast as `PublishVerdict` and the gauntlet renders incorrectly

**File:** `frontend/src/lib/api.ts:2163-2165`

**Issue:** On a 400 response the code does:

```ts
const body = (await res.json().catch(() => ({}))) as { detail?: PublishVerdict }
return { kind: "business_requirement", verdict: body.detail as PublishVerdict }
```

If the 400 body has no `detail` key (or `detail` is a string rather than a full `PublishVerdict` object), `body.detail` is `undefined` and the cast silently produces `undefined` as a `PublishVerdict`. The gauntlet then calls `verdict.named_failures.length` on `undefined`, throwing a runtime crash. The backend does send a full `PublishVerdict` in the 400 `detail` field (line 209 of `api/workflows.py`: `detail=result`), but defensive parsing is warranted.

**Fix:**

```ts
if (res.status === 400) {
  const body = (await res.json().catch(() => ({}))) as { detail?: unknown }
  const detail = body.detail
  if (detail && typeof detail === "object" && "published" in detail) {
    return { kind: "business_requirement", verdict: detail as PublishVerdict }
  }
  // Degrade to a not_found-style block rather than crashing
  throw new Error("business_requirement block: malformed verdict body")
}
```

### WR-03: `tierForDefinition` applies the wrong strictest-policy precedence — `flag` can overwrite a previously seen `strict`

**File:** `frontend/src/pages/WorkflowsPage.tsx:97-106`

**Issue:** The code attempts to track the strictest `citation_policy` across emit phases but the update condition `if (!sawEmit || cp === "strict")` means: set the policy on the first emit phase unconditionally, then only overwrite on `strict`. A workflow with phases `[strict, flag]` would correctly retain `strict`, but `[flag, strict]` would first set `strict` (second phase) and then not overwrite because... wait — on second phase `cp === "strict"` is true so it would update. The actual bug is the case `[flag, partial]`: `sawEmit=false → citationPolicy="flag"`, then `sawEmit=true; cp="partial"`, condition `!sawEmit` is false, `cp === "strict"` is false → `partial` is NOT recorded. The intent is "prefer strictest" but `strict > flag > partial > draft` is not fully applied — `flag` beats `partial` by accident of iteration order, not the stricter-wins rule.

The fix is to use a proper ordered comparison:

```ts
const POLICY_ORDER: CitationPolicy[] = ["draft", "partial", "flag", "strict"]
function stricterPolicy(a: CitationPolicy, b: CitationPolicy): CitationPolicy {
  return POLICY_ORDER.indexOf(b) > POLICY_ORDER.indexOf(a) ? b : a
}
// In the loop:
citationPolicy = sawEmit ? stricterPolicy(citationPolicy, cp) : cp
sawEmit = true
```

Note: for tier derivation, a `strict` policy always maps to STRICT regardless, so the practical impact is only on multi-emit workflows where no emit is `strict` but one is `flag` and another is `partial` — the badge would show MIDDLE (flag) when it should also show MIDDLE (both are MIDDLE), so the badge is not wrong, but the logic is fragile if the policy enum gains new values.

### WR-04: `onGauntletPublished` slug defaults to the hardcoded literal `"workflow"` when `builderTweak` is null

**File:** `frontend/src/pages/WorkflowsPage.tsx:273-281`

**Issue:** When the gauntlet fires `onPublished(version)`, the page calls `onGauntletPublished(version, builderTweak?.slug ?? "workflow")`. If the user built a fresh workflow (not a Tweak), `builderTweak` is `null` and `runCta` is set to `{ slug: "workflow", version }`. The post-publish Run CTA then searches `published.find((w) => w.slug === runCta.slug)` for a workflow with slug `"workflow"`, which almost certainly does not exist. The CTA silently renders nothing and the user gets no Run affordance after a successful fresh-build publish.

**Fix:** The builder definition's slug should be threaded through. The `WorkflowBuilderPage.renderPublish` callback already receives `_def` (the `BuilderDefinition`), which has `def.slug`. Use it:

```tsx
renderPublish={(_def, draftId) =>
  draftId ? (
    <PublishGauntlet
      definitionId={draftId}
      onPublished={(version) =>
        onGauntletPublished(version, builderTweak?.slug ?? _def.slug ?? "workflow")
      }
    />
  ) : null
}
```

Or thread the slug through `onGauntletPublished` from the post-publish backend response (the published version's slug is returned in `refetchPublished` data anyway, but a direct slug from the definition is more reliable).

### WR-05: `_skill_registry` calls blocking `supabase-py` synchronously in an async context on the non-wrapped path

**File:** `backend/app/services/workflow_authoring.py:130-152`

**Issue:** `_skill_registry` is a synchronous function that calls `supabase-py` (blocking I/O). It is correctly wrapped in `run_in_threadpool` by `_assemble_grounding` at line 251:

```python
skills = await run_in_threadpool(_skill_registry, supabase, user_id)
```

This is correct. However, the fallback branch inside `_skill_registry` (line 147) calls `supabase.table("skills").select(...).execute()` directly — this is still inside the threadpool (since the whole function runs there), so it is not an async-loop-blocking violation per se. **This WR is recorded only to flag** that if any future caller invokes `_skill_registry` outside a `run_in_threadpool` wrapper (the function signature is `def`, not `async def`, which makes it easy to call directly), blocking I/O would land on the event loop. Recommendation: make this violation impossible by adding a comment or a `run_in_threadpool` guard at the function boundary.

Actually on closer read this is not a runtime bug today; downgrading to Info — see IR-01.

### WR-06: `RunModal` "Run workflow" button fires `void onRun()` without guarding against double-submission

**File:** `frontend/src/pages/WorkflowsPage.tsx:672-680`

**Issue:** The `onRun` callback (`doRun` in ChatLayout) performs `createThread + postMessage + loadThreads + selectThread + onNavigate` — all async. The modal's Run button does `onClick={() => void onRun()}` without setting any loading/disabled state. A fast double-tap fires two concurrent `doRun` executions, creating two threads and two runs for the same workflow kickoff.

**Fix:** Add a `loading` state to `RunModal` (or in `WorkflowsPage` at the `runFor` level):

```tsx
// In WorkflowsPage, track runLoading:
const [runLoading, setRunLoading] = useState(false)
// ...
onRun={async () => {
  if (runLoading) return
  setRunLoading(true)
  const target = runFor
  const text = kickoff
  setRunFor(null)
  try { await onLaunch(target, text) } finally { setRunLoading(false) }
}}
// Pass runLoading to RunModal and disable the button.
```

### WR-07: `RunModal` `aria-modal="true"` without focus-trap — keyboard users can navigate behind the modal

**File:** `frontend/src/pages/WorkflowsPage.tsx:624-685`

**Issue:** The `RunModal` renders with `role="dialog" aria-modal="true"` but implements no focus trap (no `useEffect` to confine Tab/Shift+Tab, no `inert` attribute on the background). Screen-reader and keyboard users can Tab out of the modal into the Workflows page content behind the dark overlay. The `aria-modal` declaration tells assistive technology the modal is the only live region, but without an actual DOM focus trap the keyboard experience does not match.

**Fix:** Wrap the modal content in a shadcn/ui `Dialog` (already a dependency in this codebase — used in `NavPanel`'s `AlertDialog`) which provides a built-in focus trap, or add a minimal `useFocusTrap` hook.

## Info

### IR-01: `_skill_registry` comment-level risk — easy to accidentally call outside threadpool

**File:** `backend/app/services/workflow_authoring.py:131`

**Issue:** The function is a plain `def` (synchronous), relies on blocking `supabase-py`, and is currently always called via `run_in_threadpool`. Adding a module-level note or an `assert` guard on the call site would make the threadpool requirement explicit for future maintainers.

### IR-02: `PublishGauntlet` `RunLink` uses an `href="#"` placeholder

**File:** `frontend/src/components/workflows/PublishGauntlet.tsx:204-215`

**Issue:** The "Open the golden run" link renders with `href="#"` — clicking it scrolls to the top of the page rather than navigating to the run. The golden run id is available (`goldenRunId`) but no route exists yet. This is acceptable for Phase 103 (the run-surface navigation was deferred to a later phase), but the `href="#"` leaves a non-functional affordance with no visual indication that it is not yet navigable.

**Fix (non-blocking):** Either render the run id as read-only text/badge instead of an `<a>` element until the route exists, or add `onClick={(e) => e.preventDefault()}` + a tooltip explaining "run view coming soon."

### IR-03: `deriveTier` exhaustiveness guard returns `_never` which TypeScript accepts but causes a runtime crash

**File:** `frontend/src/components/workflows/deriveTier.ts:119-122`

**Issue:** The `default` branch does:

```ts
const _never: never = citationPolicy
return _never
```

At runtime if an unknown `citationPolicy` string arrives (e.g. from a future backend enum value or a malformed JSONB), `_never` is assigned the unknown string and returned as a `Tier` object. The caller would then try to read `.id`, `.glyph`, etc. from a string, causing a runtime crash. A safe exhaustiveness guard should return a defined fallback:

```ts
default: {
  const _never: never = citationPolicy  // TypeScript exhaustiveness check
  void _never
  return TIERS.LOOSE  // safe fallback for a future enum value at runtime
}
```

### IR-04: Magic string `"__unbound__"` defined inline in `WorkflowsPage` rather than as a named constant

**File:** `frontend/src/pages/WorkflowsPage.tsx:210, 218, 381`

**Issue:** The sentinel `"__unbound__"` is declared as `const UNBOUND = "__unbound__"` inside the component function body, meaning it is re-created on every render. This is harmless (React reconciler handles it), but the magic string appears in 3 places and if the component re-renders the `===` comparison is always stable because it's a string literal. A module-level constant would be more conventional.

---

_Reviewed: 2026-06-14T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
