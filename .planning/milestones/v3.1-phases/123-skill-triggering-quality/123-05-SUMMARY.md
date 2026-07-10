---
phase: 123-skill-triggering-quality
plan: 05
subsystem: frontend
tags: [skills, trigger-tuning, tuner-ui, scoreboard, candidate-cards, case-editor, live-run, reachability, sse, react]

# Dependency graph
requires:
  - phase: 123-04 skill_tuner.py routes
    provides: "POST /skills/{id}/tuner/runs · GET .../stream (tuner_progress/tuner_provider_done/tuner_complete SSE) · GET .../runs/{id} (held-out scoreboard, per-cell fires+no_false) · PATCH /skills/{id} (author-confirm winner write)"
  - phase: 112 ConfidenceChip / GovernancePage
    provides: "the focused-surface self-fetch idiom + Aether ghost-border/font-headline/font-mono chrome reused by the Tuner shell"
provides:
  - "frontend/src/pages/SkillTunerPage.tsx — the Trigger Tuner focused full-surface (041-A): ‹ Skills back, current·live·drives-firing description, two-column body, live-run orchestration over startTunerRun/streamTunerRun/getTunerResults, author-confirm winner write via updateSkill"
  - "frontend/src/components/skills/tuner/ProviderScoreboard.tsx — the N-column per-provider grid (042-A, no-analog): a non-target provider never renders, N=1 is the clean baseline, OpenRouter≠native, EVERY cell shows BOTH fires + no-false"
  - "frontend/src/components/skills/tuner/CandidateCard.tsx — held-out score + per-provider grid + explicit diff-confirm strip (Use→diff→confirm→updateSkill, never auto-applied)"
  - "frontend/src/components/skills/tuner/CaseEditor.tsx — two-column should-fire/should-NOT + provenance tags + 60/40 split bar"
  - "frontend/src/components/skills/tuner/LiveRunCard.tsx — per-provider lanes (queued≠running, no fake percent) + never-vanishing elapsed timer (stable start-ts) + reconcile-on-return + Cancel"
  - "the reachability triad: App.tsx ActiveView 'skill-tuner' + tunerSkillId state + onTuneSkill; ChatLayout skill-tuner mount branch; SkillsPage 'Tune triggers' entry action — owned in ONE plan"
  - "api.ts: startTunerRun / getTunerResults / streamTunerRun SSE helper + the tuner wire types (TunerCell both fires/no_false, TunerCandidate, TunerScoreboard)"
affects: [123-06 inline lint + Tune-this handoff (navigates into the Tuner surface with a skillId — the entry action this plan owns)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reachability triad owned in-phase (the Phase-118 built-but-unreachable lesson): the ActiveView union member + the ChatLayout mount branch + the SkillsPage entry action ship together so the surface is reachable the moment it compiles"
    - "Focused full-surface entered WITH a skillId via the ActiveView no-router switch (mirrors GovernancePage + the publish-gauntlet precedent) — App holds tunerSkillId as per-view selection state threaded through ChatLayout"
    - "N-column scoreboard driven PURELY by the server-returned cells — a provider the org doesn't run is simply absent from the cell list, so it never renders (a score you can't act on is a fabricated measurement; honesty-is-load-bearing)"
    - "Author-confirm-not-auto-apply: revealing the diff strip is NOT the write; the winner description is written via PATCH /skills (updateSkill, re-lints) ONLY on explicit confirm (042-A / D-03)"
    - "Never-vanishing elapsed timer: elapsed = now − stableStartTs, ticked while running, frozen on terminal — never reset on a transient stream-end (the 095 lesson)"
    - "Queued ≠ running: a queued provider lane renders 'queued', never a fabricated 0%/running percent (043-A honesty)"
    - "Purpose-built tuner SSE reader (streamTunerRun) speaks ONLY the tuner_* vocab + the done/error terminal — never the chat subscribeToRun path; AbortSignal cancels (leave-and-reconcile, D-v2.5-03)"

key-files:
  created:
    - frontend/src/pages/SkillTunerPage.tsx
    - frontend/src/pages/SkillTunerPage.test.tsx
    - frontend/src/components/skills/tuner/ProviderScoreboard.tsx
    - frontend/src/components/skills/tuner/ProviderScoreboard.test.tsx
    - frontend/src/components/skills/tuner/CandidateCard.tsx
    - frontend/src/components/skills/tuner/CaseEditor.tsx
    - frontend/src/components/skills/tuner/LiveRunCard.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/pages/SkillsPage.tsx
    - frontend/src/lib/api.ts

key-decisions:
  - "The reachability triad (App ActiveView union + ChatLayout mount branch + SkillsPage 'Tune triggers' entry action) is owned in Task 1 of THIS plan — the surface is reachable in-phase, not built-but-unreachable (Phase-118 lesson)."
  - "The 'Tune triggers' entry action lives on the SELECTED skill in the right detail pane (only on a saved skill, never while creating) — it is the reachability entry point, NOT a cold top-level nav item; the Tuner is entered WITH a skillId."
  - "ProviderScoreboard derives its column set PURELY from the server-returned cells (no client-side target list) — so a non-target provider can never be fabricated into a column, and N=1 falls out as the clean single-column baseline with no degraded affordance."
  - "Built a purpose-built streamTunerRun SSE reader rather than reusing the chat subscribeToRun — the tuner vocab (tuner_progress/tuner_provider_done/tuner_complete + done/error terminal) is disjoint from chat events, and a focused reader keeps the chat path untouched."
  - "On the terminal 'done' the page RECONCILES the scoreboard from the authoritative GET results (the SSE tuner_complete is a best-effort hint, D-v2.5-03), falling back to the SSE-carried scoreboard if the results read fails."
  - "CaseEditor's 60/40 split bar mirrors the backend DEFAULT_HELD_OUT_TRAIN_RATIO=0.6 (first 60% train, rest held-out) so the displayed counts are honest, and the copy states the winner is picked by the held-out 40%."

requirements-completed: [TRIG-01]

# Metrics
duration: 10min
completed: 2026-06-23
---

# Phase 123 Plan 05: Skill Trigger Tuner — React Surface + Reachability Summary

**Builds the TRIG-01 Trigger Tuner React surface (sketches 041-A/042-A/043-A) and makes it REACHABLE in-phase: the focused full-surface `SkillTunerPage` (entered WITH a `skillId`), the no-analog N-column `ProviderScoreboard` (a non-target provider never renders, N=1 is the clean baseline, OpenRouter≠native, every cell shows BOTH fires + no-false), the `CandidateCard` author-confirm diff strip (Use→diff→confirm→PATCH, never auto-applied), the two-column `CaseEditor` (should-fire/should-NOT false-fire rail + 60/40 split bar), the `LiveRunCard` (queued≠running, never-vanishing stable-start-ts timer, reconcile-on-return), the api client calls + tuner SSE helper, and the reachability triad — App `ActiveView` member + ChatLayout mount branch + SkillsPage "Tune triggers" entry action — all owned in this one plan (the Phase-118 built-but-unreachable lesson).**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-23T18:19:59Z
- **Completed:** 2026-06-23T18:30:05Z
- **Tasks:** 3 (Task 1 + Task 2a TDD + Task 2b TDD)
- **Files modified:** 11 (7 created, 4 modified)

## Accomplishments

- **Task 1 — Reachability triad + shell + api (`a8066dc6`):**
  - `App.tsx`: added `"skill-tuner"` to the `ActiveView` union + a sibling `tunerSkillId` state + an `onTuneSkill = (id) => { setTunerSkillId(id); setActiveView("skill-tuner") }` navigator, both threaded into `ChatLayout`.
  - `ChatLayout.tsx`: the `activeView === "skill-tuner"` mount branch (mirrors the governance branch, BEFORE the trailing `KnowledgeHealthPage` else) renders `<SkillTunerPage skillId={tunerSkillId} onBack={() => onNavigate("skills")} />`; passes `onTuneSkill` down to `<SkillsPage>`.
  - `SkillsPage.tsx`: added the `onTuneSkill?` prop + a **"Tune triggers"** action on the SELECTED skill in the right detail pane (only on a saved skill, never while creating) — the reachability entry point.
  - `SkillTunerPage.tsx`: the focused full-surface shell (041-A) — `‹ Skills` back, the skill's current description labeled "current · live · drives firing", a two-column body, and the full live-run orchestration (`startTunerRun` → `streamTunerRun` lanes → terminal `getTunerResults` reconcile), plus the author-confirm winner write via `useSkills().updateSkill`.
  - `api.ts`: `startTunerRun(skillId, body)` (202 non-blocking, 409 = in-flight), `getTunerResults(skillId, runId)` (404 = not-complete-yet), and the purpose-built `streamTunerRun` SSE reader (tuner_* vocab + done/error terminal + AbortSignal cancel) + the tuner wire types (`TunerCell` with `axes.{fires,no_false}`, `TunerCandidate`, `TunerScoreboard`, `StartTunerRunResponse`).
- **Task 2a — N-column ProviderScoreboard + CandidateCard (TDD, `464546cd`; ProviderScoreboard.test.tsx 7/7 RED→GREEN):**
  - `ProviderScoreboard.tsx` (no-analog, 042-A): an N-column grid where the columns are derived from the server-returned cells — a provider the org doesn't run NEVER renders; N=1 is the clean single-column baseline with NO degraded/missing affordance; OpenRouter renders as a DISTINCT column from native zhipu/z-ai. EVERY cell shows BOTH a `fires` (recall) AND a `no-false` (the false-fire rail) sub-score, never a hidden aggregate, with the no-false rail tinting red-ward as it regresses.
  - `CandidateCard.tsx` (042-A): the held-out score (the pick-by number) + the per-provider grid (via ProviderScoreboard) + the explicit diff-confirm strip — "Use" reveals old-vs-new, confirm calls the injected `onConfirm` (wraps `updateSkill`), nothing auto-applies.
- **Task 2b — CaseEditor + LiveRunCard + page compose (TDD, `1486018e`; SkillTunerPage.test.tsx + ProviderScoreboard.test.tsx 14/14 together):**
  - `CaseEditor.tsx` (043-A): two columns (should-fire / should-NOT = the false-fire rail) with per-row provenance tags (seeded/sibling/held/you), an add bar with a fire/no toggle + add/remove, and the 60/40 train/held-out split bar (mirrors the backend `split_held_out`).
  - `LiveRunCard.tsx` (043-A): per-provider lanes where queued ≠ running (NO fake percent on a queued lane), a never-vanishing elapsed timer derived from a stable start-ts (ticked while running, frozen on terminal), an explicit "runs in the background — reconciles on return", and Cancel.
  - `SkillTunerPage.tsx` composes CaseEditor + LiveRunCard + the Task-2a ProviderScoreboard/CandidateCard into the two-column body; the page-level test proves the full author-confirm path (Use → diff → confirm → updateSkill, no auto-apply).

## Task Commits

1. **Task 1: reachability triad + SkillTunerPage shell + api** — `a8066dc6` (feat)
2. **Task 2a: N-column ProviderScoreboard + CandidateCard (TDD)** — `464546cd` (feat)
3. **Task 2b: CaseEditor + LiveRunCard + page compose (TDD)** — `1486018e` (feat)

**Plan metadata:** (final docs commit — this SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md)

## Files Created/Modified

- `frontend/src/pages/SkillTunerPage.tsx` (created) — the focused full-surface + the live-run orchestration + the author-confirm winner write.
- `frontend/src/pages/SkillTunerPage.test.tsx` (created) — page-level author-confirm + LiveRunCard queued≠running/stable-timer + CaseEditor two-column/60-40 coverage (7 tests).
- `frontend/src/components/skills/tuner/ProviderScoreboard.tsx` (created) — the no-analog N-column grid, both sub-scores per cell.
- `frontend/src/components/skills/tuner/ProviderScoreboard.test.tsx` (created) — N-column adaptivity (3-col / 1-col-clean-baseline / non-target-never-renders) + both-sub-scores-per-cell + OpenRouter≠native + CandidateCard author-confirm (7 tests).
- `frontend/src/components/skills/tuner/CandidateCard.tsx` (created) — held-out score + per-provider grid + diff-confirm strip.
- `frontend/src/components/skills/tuner/CaseEditor.tsx` (created) — two-column should-fire/should-NOT + provenance tags + 60/40 split bar.
- `frontend/src/components/skills/tuner/LiveRunCard.tsx` (created) — per-provider lanes + never-vanishing timer + reconcile-on-return.
- `frontend/src/App.tsx` (modified) — ActiveView "skill-tuner" + tunerSkillId state + onTuneSkill navigator.
- `frontend/src/components/layout/ChatLayout.tsx` (modified) — the skill-tuner mount branch + threading onTuneSkill to SkillsPage.
- `frontend/src/pages/SkillsPage.tsx` (modified) — the "Tune triggers" entry action + onTuneSkill prop.
- `frontend/src/lib/api.ts` (modified) — startTunerRun / getTunerResults / streamTunerRun + the tuner wire types.

## Deviations from Plan

None — plan executed exactly as written. No bugs, no missing-critical functionality, no blocking issues, no architectural changes. No packages installed. No schema migration.

(One implementation note, not a deviation: Task 1 created minimal type-only stubs for the four tuner components so `SkillTunerPage.tsx` could compile + commit cleanly within Task 1's tsc gate; Tasks 2a/2b then filled those stubs to GREEN via TDD. The exported component prop/type contracts the page imports were stable from Task 1 onward, so the compose required no page rewiring in 2b. The page's full compose was authored in Task 1 since the plan's Task-1 `done` is "the focused-surface shell + api calls compile" and the orchestration is what the shell IS — the components were the only stubbed parts.)

## Threat Surface

All five trust boundaries from the plan's `<threat_model>` are honored:

- **T-123-05-01 (scoreboard fabricates an aggregate / renders a provider the org doesn't run):** the N-column grid is driven PURELY by the server-returned cells — a non-target provider is simply absent and never renders (proven by `ProviderScoreboard.test.tsx` "a provider NOT in the target set never renders"); every cell shows BOTH `fires` AND `no-false` (proven by "EVERY cell shows BOTH a fires AND a no-false sub-score") — no hidden aggregate. N=1 is the clean baseline (no degraded affordance, asserted) and OpenRouter≠native (asserted).
- **T-123-05-02 (winner auto-applied without author confirmation):** the diff-confirm strip is an explicit gate; `onConfirm` (which wraps `updateSkill` → PATCH /skills) is called ONLY on confirm — proven non-vacuous by the CandidateCard test (onConfirm not called on mount, not called when the strip is merely revealed, called once with the candidate on confirm) AND the page-level test (updateSkill not called on run completion, called only after Use→confirm with the winner description).
- **T-123-05-03 (fake percent for a queued provider / vanishing timer):** queued ≠ running (a queued lane renders "queued", never a `%` — asserted); the elapsed timer derives from the stable start-ts and reads a real ~3s value, never a reset 0 (asserted).
- **T-123-05-04 (cross-user skill read via a crafted skillId):** owner-scoping is enforced SERVER-SIDE (the Plan-04 routes 404 cross-user); the UI carries no service-role capability — it only calls the owner-scoped routes with the author's bearer token.
- **T-123-05-SC (npm/pip installs):** zero new packages installed this plan.

No new security surface introduced beyond the plan's threat model. No threat flags.

## Known Stubs

None. The four tuner components were stubbed only transiently within Task 1 (type-only) and were fully implemented to GREEN in Tasks 2a/2b. No hardcoded empty data flows to the UI: the scoreboard/candidates render from the live server scoreboard, the case editor holds author-edited client state (empty until auto-seed/edit — an honest empty state, not a stub), and the live-run lanes are populated from the real `startTunerRun` target set + SSE progress.

## Verification

- **Task 2a:** `npx vitest run src/components/skills/tuner/ProviderScoreboard.test.tsx` → 7/7 GREEN (the load-bearing N-column + both-sub-scores gate).
- **Task 2b:** `npx vitest run src/pages/SkillTunerPage.test.tsx src/components/skills/tuner/ProviderScoreboard.test.tsx` → 14/14 GREEN together (the compose did not regress 2a).
- `npx tsc --noEmit` → clean (no errors) after every task.
- Reachability triad grep gates: `skill-tuner` ≥1 in BOTH App.tsx and ChatLayout.tsx; `onTuneSkill`/`handleTuneSkill` ≥1 in App.tsx + ChatLayout.tsx + SkillsPage.tsx; `updateSkill` in SkillTunerPage.tsx (author-confirm PATCH); `tuner_progress` in api.ts (SSE helper). All pass.
- Adjacent-suite regression spot-check: `ChatLayoutLaunch.test.tsx` + `GovernancePage.test.tsx` → 8/8 GREEN (no regression from the App/ChatLayout/SkillsPage edits).
- SC#10 4-axis live UAT remains the phase-verification dev gate authored in `123-VALIDATION.md` (not runtime code).

## Issues Encountered

None. The plan's interfaces (the Plan-04 route shape, the cell `{provider, model, axes:{fires,no_false}, score}` shape, the App/ChatLayout/SkillsPage seams) matched the live code exactly; no Rule 1–4 deviations were triggered.

## Next Phase Readiness

- **Plan 06** (inline lint + "Tune this" handoff) can navigate into the Tuner surface with a `skillId` — the `onTuneSkill(skillId)` entry action + the `skill-tuner` ActiveView mount are now live; a "Tune this" affordance elsewhere can reuse the same App-level `handleTuneSkill` navigator.
- The Tuner UI consumes the full Plan-04 contract end-to-end (start → stream tuner_* → reconcile via results) and writes the confirmed winner via the existing owner-scoped PATCH /skills.

## Self-Check: PASSED

- All 7 created files + the 4 modified files exist on disk (verified by the staged-file list at each commit).
- All 3 task commits present in git history (`a8066dc6`, `464546cd`, `1486018e`).
- Both vitest suites GREEN (14/14 together); tsc clean; the reachability triad grep gates all pass; the full click-path (Skills → select skill → "Tune triggers" → SkillTunerPage with skillId → run → confirm → PATCH) is wired and reachable.

---
*Phase: 123-skill-triggering-quality*
*Completed: 2026-06-23*
