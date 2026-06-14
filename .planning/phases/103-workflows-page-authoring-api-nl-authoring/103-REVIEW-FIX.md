---
phase: 103-workflows-page-authoring-api-nl-authoring
fixed_at: 2026-06-14T15:25:00Z
review_path: .planning/phases/103-workflows-page-authoring-api-nl-authoring/103-REVIEW.md
iteration: 1
findings_in_scope: 12
fixed: 9
false_positive: 1
deferred: 1
skipped_redundant: 1
status: partial
---

# Phase 103: Code Review Fix Report

**Fixed at:** 2026-06-14T15:25:00Z
**Source review:** `.planning/phases/103-workflows-page-authoring-api-nl-authoring/103-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings triaged: 12 (1 Critical, 7 Warning, 4 Info)
- Fixed: 9 (CR-01, WR-02, WR-03, WR-04, WR-05, WR-06, IR-01, IR-02, IR-03, IR-04 — see per-finding count below)
- False positive: 1 (WR-05-as-written → already correctly wrapped; the review itself downgraded it to IR-01, which IS fixed)
- Deferred: 1 (WR-01 — the real fix is a net-new draft-resume feature outside 103 scope)
- Test results: backend 7/7 green; frontend 55/55 green (52 baseline + 3 net-new regression tests); `tsc -b` clean on all touched source files.

> Note on counts: the review lists WR-05 twice in spirit — the WARNING WR-05 body
> self-downgrades to IR-01 ("Actually on closer read this is not a runtime bug
> today; downgrading to Info — see IR-01"). I treated the blocking-I/O concern as
> IR-01 (fixed via an explicit contract note) and the genuine 7 warnings as
> WR-01..WR-04, WR-06 plus the double-submit guard the triage prompt labels WR-05.

## Fixed Issues

### CR-01: `_skill_registry` fallback dropped owner/`is_enabled` scope — fail closed
**Files modified:** `backend/app/services/workflow_authoring.py`
**Commit:** `2ac09c05`
**Applied fix:** Replaced the bare full-table `supabase.table("skills").select(...).execute()` fallback (which pulled EVERY user's rows over the wire under service-role and leaned on a Python-side filter) with a **fail-closed** path: on the scoped-read exception it RETRIES the same `.or_(user_id.eq / is_global.eq.true)` predicate pushed down to the DB; if that also fails it returns `[]` (no skill grounding) rather than a possibly-polluted set. This matches the rest of the service's owner-scoping discipline (the `try` branch already pushes the predicate down; `_resolve_template_placeholders` already degrades-to-empty on error). The downstream grounding-fidelity gate then validates `skill_ref ∈` an honestly-scoped set, so a transient PostgREST error can no longer inject a disabled/cross-user skill name into the LLM grounding block.

### IR-01: `_skill_registry` blocking-I/O / threadpool contract made explicit
**Files modified:** `backend/app/services/workflow_authoring.py` (same commit as CR-01)
**Commit:** `2ac09c05`
**Applied fix:** Strengthened the docstring into an explicit BLOCKING-I/O CONTRACT note: the function is a plain `def` calling synchronous `supabase-py` and MUST be invoked via `run_in_threadpool` (it is, by `_assemble_grounding`); never call it directly from an async handler. No behavior change — a maintainer guardrail per D-v2.5-01. (This is the Info finding the WARNING WR-05 in REVIEW.md explicitly downgraded to.)

### WR-02: `publishWorkflow` 400-branch — defend against a detail-less / mistyped body
**Files modified:** `frontend/src/lib/api.ts`, `frontend/src/lib/api.workflows.test.ts`
**Commit:** `be10cff0`
**Applied fix:** The 400 branch no longer casts `body.detail` blindly to `PublishVerdict`. It verifies `detail && typeof detail === "object" && "published" in detail` before returning `{ kind: "business_requirement", verdict }`; otherwise it throws an honest `Error("business_requirement block: malformed verdict body …")` so an `undefined` verdict can never reach the gauntlet (which would crash on `verdict.named_failures.length`). The backend still rides the full `PublishVerdict` in `detail` (`api/workflows.py:209`), so the happy path is unchanged. Added a regression test pinning that a detail-less body AND a bare-string `detail` both throw.

### WR-03: `tierForDefinition` strictest-policy precedence made deterministic
**Files modified:** `frontend/src/pages/WorkflowsPage.tsx`, `frontend/src/pages/WorkflowsPage.test.tsx`
**Commit:** `21bb320f`
**Applied fix:** Replaced the iteration-order-dependent `if (!sawEmit || cp === "strict")` update with a `POLICY_ORDER = ["draft","partial","flag","strict"]` + `stricterPolicy(a,b)` helper, so the loop does `citationPolicy = sawEmit ? stricterPolicy(citationPolicy, cp) : cp`. Now the STRICTEST declared emit policy wins regardless of phase order (the prior `[flag, partial]` drop is gone). I reimplemented the precedence locally rather than delegating to `deriveTier` because `deriveTier` consumes an already-chosen single `citation_policy` (it does not pick across multiple emit phases) — the two concerns are distinct, so reuse would not fit the shape. Added a `[flag, strict, partial]` multi-emit regression test asserting STRICT.

### WR-04: post-publish Run CTA slug for a FRESH build
**Files modified:** `frontend/src/pages/WorkflowsPage.tsx`
**Commit:** `21bb320f`
**Applied fix:** `onGauntletPublished(version, builderTweak?.slug ?? "workflow")` became `builderTweak?.slug ?? (typeof _def.slug === "string" ? _def.slug : "workflow")`. For a fresh build (`builderTweak === null`) the just-built definition's own slug (`_def.slug`, already passed to `renderPublish`) is the correct lookup key, so `published.find(w => w.slug === runCta.slug)` resolves the new row and the Run CTA no longer silently disappears after a successful fresh-build publish.

### WR-05: `RunModal` double-submission guard (one click = one thread)
**Files modified:** `frontend/src/pages/WorkflowsPage.tsx`, `frontend/src/pages/WorkflowsPage.test.tsx`
**Commit:** `21bb320f`
**Applied fix:** Added a `runSubmitting` state in `WorkflowsPage`. The modal's `onRun` now early-returns while in flight, sets `runSubmitting=true`, awaits `onLaunch`, and clears it in `finally`; the Run + Cancel buttons are `disabled` while submitting and the Run label shows "Running…". `RunModal` gained a `submitting` prop. A fast double/triple-tap now fires `onLaunch` exactly once (pinned by a new in-flight-guard test using a deferred promise). D-103-1 is preserved: Run is still enabled on EMPTY input (it disables only on in-flight).

### WR-06: `RunModal` focus contract (Escape-to-close + initial focus + Tab containment)
**Files modified:** `frontend/src/pages/WorkflowsPage.tsx`
**Commit:** `21bb320f`
**Applied fix:** Added a lightweight, dependency-free focus contract for the `aria-modal` dialog: initial focus on the kickoff textarea (`useEffect` + ref), an `Escape` keydown that closes the modal (no-op while submitting), and simple Tab/Shift+Tab containment that wraps focus within the dialog's focusable set. Chose this over rewriting to shadcn `Dialog` to keep the change minimal and avoid touching the locked modal layout. **Residual:** the background is not `inert` (a true full trap would mark page content inert); the Tab-cycle containment plus Escape-to-close covers the keyboard escape-behind path the review flagged. Logic-bug note: this is interaction logic — see "requires human verification" below.

### IR-02: golden-run `RunLink` is no longer a dead `href="#"`
**Files modified:** `frontend/src/components/workflows/PublishGauntlet.tsx`
**Commit:** `ea449755`
**Applied fix:** The "Open the golden run" affordance changed from `<a href="#">` (which scrolls to top) to a `disabled` `<button>` with an honest `title="Run view coming soon — … (D-103-A)"` and a "(view coming soon)" label, since the run-surface route is deferred to 103.1/104 (SPEC D-103-A). No dead navigation. The `run-link` test asserts presence by testid only, so it stays green.

### IR-03: `deriveTier` default branch returns a safe `TIERS.LOOSE` at runtime
**Files modified:** `frontend/src/components/workflows/deriveTier.ts`
**Commit:** `9f6cac92`
**Applied fix:** The exhaustiveness `default` kept the compile-time `const _never: never = citationPolicy` check (now `void _never`) but returns `TIERS.LOOSE` instead of the raw string, so a future enum value / malformed JSONB can no longer return a non-`Tier` and crash the caller on `.id`/`.glyph`.

### IR-04: `UNBOUND` sentinel hoisted to module scope
**Files modified:** `frontend/src/pages/WorkflowsPage.tsx`
**Commit:** `21bb320f`
**Applied fix:** Moved `const UNBOUND = "__unbound__"` out of the component body to module scope (no longer recreated per render); all three call sites are unchanged.

## False Positive

### WR-05 (as literally written in REVIEW.md): blocking `supabase-py` in an async context
**File:** `backend/app/services/workflow_authoring.py:130-152`
**Verdict:** FALSE POSITIVE — and the REVIEW.md author agrees. The WR-05 body itself
states: *"this is still inside the threadpool (since the whole function runs there),
so it is not an async-loop-blocking violation per se … Actually on closer read this
is not a runtime bug today; downgrading to Info — see IR-01."*
**Evidence:** `_skill_registry` is invoked exclusively via
`await run_in_threadpool(_skill_registry, supabase, user_id)` at
`workflow_authoring.py:251` (inside `_assemble_grounding`), the only call site. The
fallback's synchronous `.execute()` runs inside that same threadpool — never on the
event loop. There is no runtime violation to fix. The forward-looking maintainer
concern was addressed as **IR-01** (the explicit BLOCKING-I/O CONTRACT docstring).

## Deferred

### WR-01: `DraftCard` "Publish…" and "Open" both call `onOpen`
**File:** `frontend/src/pages/WorkflowsPage.tsx:531-537`
**Reason:** The review's prescribed fix ("route Publish… to the publish gauntlet")
cannot be honestly implemented within Phase 103 scope, because of two verified
architectural facts:

1. **`WorkflowBuilderPage` is birth-only.** It always opens at the describe-box
   `"empty"` state and takes NO draft prop — it never loads an existing draft's
   definition into a `"drafted"` state (`WorkflowBuilderPage.tsx:60-66, 79-102`;
   `builderTweak` only carries `{slug, version}` for the header label, never the
   definition). The draft card's `onOpen` is `() => { setBuilderTweak(null);
   setPageView("builder") }` — a fresh describe box, not the selected draft.
2. **The gauntlet (`renderPublish`) only renders in the `"drafted"` state with a
   persisted `draftId`** (`WorkflowBuilderPage.tsx:210-212` — `renderPublish` is in
   the drafted-state JSX; `PublishGauntlet` is gated on `draftId != null`).

Therefore the gauntlet is NOT reachable for an EXISTING draft today regardless of
which handler "Publish…" calls — re-wiring "Publish…" to a still-empty Builder would
be a cosmetic change that does not surface the gauntlet (a fake fix). The genuine fix
is **draft-resume-into-Builder** (load a saved draft into the `"drafted"` state so
the gauntlet becomes reachable), which is a NET-NEW feature: the SPEC scopes the
Builder as describe-first / birth-only (REQ-5, D-103-C), and draft-resume is neither
in `<spec_lock>` In-scope nor a code-review-fix-sized change. The literal symptom
(two buttons, one handler) is real but benign — both navigate to the same Builder.

**Re-open trigger:** when draft-resume-into-Builder is built (a `WorkflowBuilderPage`
that accepts an `initialDefinition`/`draftId` and seeds the `"drafted"` state), wire
"Publish…" to open that resumed Builder with the gauntlet expanded, and split the
`DraftCard` `onOpen`/`onPublish` callbacks. Track alongside the deferred Builder
template-upload affordance (CONTEXT `<deferred>`).

## Verification — requires human confirmation

- **WR-06** (`RunModal` focus trap) is interaction logic; the unit suite cannot prove
  the lived keyboard experience. Manually confirm: Escape closes the modal; Tab does
  not escape behind the overlay; initial focus lands in the textarea. Residual: the
  background is not `inert`.

---

_Fixed: 2026-06-14T15:25:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
