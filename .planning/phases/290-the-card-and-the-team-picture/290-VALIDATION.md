# Phase 290 Validation: G-4 scenarios and success-criteria rows

**Authored:** 2026-10-21 at planning. Rows are defined now (G-4: failure scenarios fixed at scope time, UI-SPEC §6), driven later.
**Driven at:** `/gsd:verify-work 290`, after 290-04. Not inside any plan: planting the stress drafts mutates the local DB, so the drive is serial (worktree rule 4) and runs under the local-DB lock (`C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock`, noclobber, released after).
**Driver:** Chrome MCP (claude-in-chrome or chrome-devtools) against the running app; if no browser tool is available, the operator drives and the agent reads the DOM text. Every row needs a screenshot AND a read of the rendered text. A wire format or a testid alone does not pass a row (G-4, G-8 lesson).
**Stack:** backend `:8000` (started by the operator; never restarted by an agent), Vite `[::1]:5173`, local Supabase `127.0.0.1:54322`. Prove the merged 290 code is live first (the library card shows `row-steps` on a known 2-step workflow). Prove the dev account's active org first (the account is in two orgs).
**Themes and widths:** every row in dark AND light. Card rows also at 375 px.

Verdict vocabulary: `PASS`, `FAIL` (with what was seen), `BLOCKED` (with the reason and an issue id). No row is dropped.

---

## Fixtures to use or plant

| Name | Source | Shape |
|---|---|---|
| Real 2-3 step workflow | an existing local-DB definition (94 local cards have 2 steps, 25 have 3; production's 7 stepped definitions are all 2-3) | record its id and phase types before driving |
| Literature review | seeded (mig 061) | `programmatic` → `llm_batch_agents` (max 5) → `llm_single`, no gates |
| Plan → Execute → Verify | seeded | 3 steps, `regex_match` + `retry` on step 3 |
| Vendor risk review (stress) | PLANT as a local draft | the 290-01 `vendorRiskReview` fixture: 7 steps, all 7 types, 1 judge with `config.criteria`, 2 checks, 1 `skip_to_phase` from the step-2 check to step 5 |
| Single step | PLANT if none exists | one `llm_agent` |
| Two-step, no gates | PLANT if the real one has gates | `llm_agent` (no KB tool) → `llm_emit` |
| Grounded three-step | PLANT | `llm_agent` with `search_documents` → `llm_single` → `llm_emit` |

**Planting recipe:** snapshot the caller's draft ids first (`GET /workflows/drafts`). Create each draft through the app's own route, `POST /workflows` (draft create, `backend/app/api/workflows.py:1168`), with the definition JSON from `frontend/src/components/workflows/__fixtures__/teamFixtures.ts`. After the drive, delete exactly the planted ids with `DELETE /workflows/{id}` and diff the id list against the snapshot. Never write through the Supabase MCP (it is production).

---

## G-4 lived-experience scenarios (UI-SPEC §6, operator-defined)

| # | Scenario | Drive | Fail if | Pass | Verdict |
|---|---|---|---|---|---|
| S1 | Chips show type ids | Library page with Vendor risk review and the real 2-3 step workflow; then 375 px | any chip shows `llm_agent`, `llm_emit`, a slug, `PHASE_TYPE_LABELS` text (`AI agent step`) or an author's step name; or `+N more` is clipped at 375 px | only the seven type sentences, in run order; `→ +4 more` on the stress card; pressing it names all 7 in visible words and shows `Show less` | |
| S2 | A line appears between two steps | Builder → Canvas → Team on Literature review and on the two-step workflow; then on Vendor risk review | any line joins two step nodes on the first two; on Vendor risk review, more than one step-to-step line, or the one present is not the ⤳ from the step-2 check to step 5 labelled `⤳ only if the check fails` | handoff lines from the orchestrator only; the caption says steps never pass work to each other | |
| S3 | A 1-step workflow shows a worker that doesn't exist | Team on the single-step workflow | anything other than the orchestrator, one step, its own gates and `One step, so there is no team to coordinate.` is drawn (an extra step, an empty seat, a placeholder judge) | exactly those nodes and that sentence | |
| S4 | A no-judge workflow shows an empty judge slot with no words | Team on the two-step no-gate workflow and on Plan → Execute → Verify | an empty card, blank slot, dashed placeholder or unlabeled gap appears where a judge would be | `Nothing checks this work.` on the first; `Checked by rule, not by a judge.` on the second, each said once | |
| S5 | Looks right on the sketch, breaks on real size | Team on the real 2-3 step workflow and on Vendor risk review, dark and light | text clips, titles overlap, lines point at the wrong node, or the picture squeezes text instead of scrolling horizontally | legible at both sizes; the 7-step row scrolls inside the plane | |

## Success criteria and decision rows

| Row | What is checked | How | Verdict |
|---|---|---|---|
| SC#1 (VIS-04, D-05) | The card matches sketch 290-card-chip-line winner B | screenshot the real card beside `.planning/sketches/290-card-chip-line/index.html` (served via `python -m http.server 8765` in `.planning/sketches`), plus a DOM read of the chip texts | |
| D-02 measurement | "The description no longer dominates" is already true on the 179 C card | record that the resting card shows no purpose sentence and that line 1 is the name; a measurement, not new work | |
| SC#2 (VIS-01) | A workflow opens as a picture of its orchestrator, steps and judge/checks | Vendor risk review in Team, ⌥ Technical names off and on; with ⌥ on, the ledger lists every drawn line with its source path and ends with `0 step-to-step links…` | |
| SC#3 (VIS-01) | No edge the schema lacks | covered by S2; record the DOM count of `[data-line-kind="jump"]` per workflow (expected 0, 0, 1) | |
| SC#4 (VIS-01) | Single-agent honesty | covered by S3 | |
| D-17 / D-18 | The engine-added check is drawn only where it runs | Team on the grounded three-step: step 1 carries a Check reading `Must prove it` and `If it fails: redo the step (up to 2 times), then ask you`; an escalated non-KB step carries no check (the seal drift is the filed BUG, D-20) | |
| D-20 observation | How `Nothing checks this work.` reads on a writing (`llm_emit`) step | operator present, on the real 2-3 step emit workflow; record the operator's reading verbatim; if it reads as false, raise a follow-up rather than changing 290 | |
| Run page | No switch on the run page (D-06) | open a run of any workflow; the canvas header shows no `Steps | Team` tablist | |
| Read-only builder | The switch works on a starter and on another person's published workflow (D-07) | open a starter in the builder read-only; Team renders | |
| Return to Steps | Selection and unsaved edits survive; the plane re-fits | select a step, edit its name without saving, switch Team → Steps; the selection and the edit are still there. The plane re-fits on return (accepted, RESEARCH A4; UI-SPEC §2's "scroll position is not lost" is corrected to this) | |
| Keyboard | The Team view never reorders (RESEARCH F-6) | in an editable builder, select a step, switch to Team, press ⌥→; back in Steps the order is unchanged | |
