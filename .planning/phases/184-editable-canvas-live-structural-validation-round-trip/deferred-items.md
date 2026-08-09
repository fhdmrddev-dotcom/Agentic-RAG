# Phase 184 — Deferred / out-of-scope discoveries

Items found during execution that are **not caused by this phase's changes** and were
therefore NOT fixed (scope-boundary rule: only auto-fix issues directly caused by the
current task's changes).

---

## From plan 184-01 (2026-07-27)

### 1. Pre-existing untracked scratch directories under `scripts/`

`git status --porcelain scripts/` reports these as untracked on a clean tree — they
predate this phase and are unrelated to it:

```
?? scripts/.sse_after_run1/
?? scripts/_uat111/          (axis_c_fix.py, diag_and_axisc.py, diag_out.txt, results.json, run_uat111.py)
?? scripts/_uat111_1/
?? scripts/pm-pack/out/
```

These look like Phase-111 UAT scratch output and a PM-pack build artifact. They are
either `.gitignore` candidates or deletable leftovers, but deciding that is not this
phase's call. **Not touched.**

Note: `git status --porcelain frontend/` is clean, which is the check the D-184-08 gate
actually cares about — `scripts/vitest-count-gate.cjs` writes its JSON report to
`os.tmpdir()` and leaves nothing anywhere in the repo.

### 2. `npm run build` cannot exit 0 on `develop`

`"build": "tsc -b && vite build"` and `tsc -b` carries **33 pre-existing errors** on
`develop` (`SettingsPage`, `OrgProvider`, `StreamsProvider`, `streamsStore`, and others —
none in this phase's blast radius). Any plan in this phase whose acceptance criteria say
"`npm run build` exits 0" is stating something unsatisfiable on an untouched checkout.

**Use instead** (established in 184-01, operator-accepted, consistent with D-ITEM-183-01):
- `npx tsc -b 2>&1 | grep -c "error TS"` ≤ **33** — a DIFFERENTIAL gate, never "must be zero"
- `npx vite build` exit 0 — the real bundle/`~icons`-resolution proof, and the path Vercel uses

Plans 184-02 … 184-13 should apply the same split rather than re-discovering this.

### 3. `gsd-sdk` state verbs partially no-op against this `STATE.md` shape

`state.update-progress` → `"Progress field not found"`; `state.record-session` →
`"No session fields found"`; `state.record-metric` → `"phase, plan, and duration required"`
despite positional args. `state.advance-plan` and `roadmap.update-plan-progress` both worked.
The missed fields were hand-edited (the documented `gsd-sdk` verb-gap fallback). Later plans
should expect the same and verify `STATE.md` by diff rather than trusting the verb's exit.

### 4. `requirements.mark-complete` over-claims on multi-plan requirements

Driven by a plan's `requirements:` frontmatter, it flips the requirement to **Complete**
even when the plan is 1 of 13 contributing plans. In 184-01 it marked **CANVAS-02**
(the editable-canvas round-trip) complete before any canvas code existed. Reverted.

**Rule for the rest of this phase:** do not run `requirements.mark-complete` per plan for
CANVAS-02 / CANVAS-03 / CANVAS-04 / VALID-02 / VALID-03. Mark them once, at phase
completion, when the behaviour they describe is actually observable.

---

*Opened by plan 184-01. Append, do not rewrite.*
