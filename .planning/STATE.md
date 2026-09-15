---
gsd_state_version: 1.0
milestone: v4.2
milestone_name: The Connected Knowledge You Can Actually Run
status: in-progress
last_updated: "2026-09-15T23:30:00.000Z"
last_activity_251_context: 2026-09-15 — Phase 251 CONTEXT LOCKED (251-CONTEXT.md, D-251-01..15) at d44142c61. ⚠ THREE REQUIREMENT PREMISES RE-MEASURED AT DISCUSS-PHASE AND ONE IS STALE. REG-01 CONFIRMED: 8 duplicate ids, each a pair of DISTINCT seeds; highest id 276; 283 files. REG-02 confirmed (~160 planted of 283). ⛔ REG-03's premise is STALE and the requirement is RE-SCOPED IN WRITING (D-12): it says 23 items are open --to operator; measured 5 (BUS-040/208/246/247/248), four of them NEWER than BUS-171, and 22 of BUS-171's 23 named items are CLOSED — the triage itself ALREADY SHIPPED at 88a9ff861 (2026-09-14), whose third arm found one true orphan held by nothing for 14 days and planted SEED-276. Planning REG-03 as written would re-do yesterday's work. ⭐ TWO DEFECTS NOBODY NAMED, both larger than the ones the requirements DO name: (1) CLAUDE.md's documented sweep filters on `surface: Agentic-RAG`, a key present in 128 of 283 seeds — the rule cannot see 55% of its own register, and 5 seeds carry NO `status` at all (SEED-084/163/164/165/166), so they are invisible to any status scan; (2) `trigger_when` is free-form English in 157 files and ABSENT in 126, so REG-02's 'prints the seeds whose trigger is already true' is not literally computable — D-01 adds structured trigger_paths/trigger_surfaces BESIDE the prose. Also measured: 448 references to the 8 dup ids across 130 files, 378 (84%) inside sealed .planning/milestones/ — so archives are NOT rewritten (D-06) and the old id keeps a redirect stub (D-05); the oldest seed keeps the id (D-07); the gate refuses [duplicate-id] AND /gsd:capture gains a next-id allocator, because the cause was two agents each reading 'highest is N' (D-08). Sweep is driven RED on FOUR arms incl. the COUNTERFACTUAL plus a non-zero parsed-file count (D-04) — Phase 242 measured check-hot-file-ledger.cjs exiting 0 over zero parsed files. Bulk frontmatter pass proves every BODY md5-identical (D-11). 32 bus items open total: 5 to:operator, 26 to:gemini (OUT of scope, counted by the hook — D-15), 1 to:claude (BUS-171). ⛔ CLAUDE MAY NOT CLOSE BUS ITEMS (D-13). ⚠ THE SDK CORRUPTED THIS FILE DURING THIS SESSION AND WAS REVERTED: `state.record-session` returned recorded:false yet still rewrote the frontmatter — truncating status/last_activity mid-sentence, DELETING the five last_activity_248/249/249_gap/250/250_review keys, and resetting progress 5/4/80% to v4.0-era 12/1/8%. Restored from 1aebafcf7^ and hand-edited. The banner below is correct: do NOT call the state.* verbs. Next: /gsd:plan-phase 251.
last_activity_250_review: 2026-09-15 — Phase 250 CODE REVIEW round, run and CLOSED by claude. /gsd:code-review 250 returned 3 Critical + 6 Warning + 5 Info over 12 files. ALL 9 Critical+Warning are FIXED and 4 of 5 Info; IN-03 deferred with a reason (it is inside the byte-locked finalizer whose ORDERING is the contract WR-01 turns on). ⭐ THE DURABLE RESULT IS NOT THE DEFECTS — IT IS THAT FOUR OF THE TEN PROPOSED FIXES WERE WRONG, INCOMPLETE OR INAPPLICABLE, AND ONLY DRIVING THEM SHOWED IT. CR-01's one-liner REDS TWO EXISTING D-078-01 FENCES (it discards a 13-char final reply to keep the 1300-char user message actually causing the overflow); neither 'user first' (shipped) nor 'non-user first' (proposed) is right, so the shipped rule is THE LARGEST PROTECTED GROUP PAYS. CR-02's second guard changed 0 of 3024 outputs — the orphan is stranded by `while len(protected) > 1`, not by `keep`, so the finding's symptom was real and its DIAGNOSIS was refuted. CR-03's Anthropic half does not apply (thinking is OFF by design, D-05). IN-05's suggested branch-count shape went stale WITHIN THE HOUR when WR-02 merged two arms. ⭐ TWO FINDINGS ESCALATED ON CONTACT. WR-06 was filed as 'an untested claim' and is MEASURED FALSE: liveness reads FALSE after loadMessages resolves on a thread whose run is live, and reconcile() — the only thing that sets streamingThreads — is listener-driven (visibility/focus/pageshow), which OPENING A THREAD TRIGGERS NEITHER. So every open todo on a live run reads 'Not ticked' until the user tabs away and back. Filed BUG-260915-01 and NOT fixed: the remedy is a trigger change in StreamsProvider.tsx (102 commits / 37 phases, G-5 FIRING) — a phase, not a closure round (G-7). The new provider suite is a CHARACTERIZATION: red there means the window CLOSED. ⭐ WR-03 SHIPPED A PERMANENT GATE RATHER THAN A WIDER REGEX — the conditional hook that blanked the page was catchable by a rule ALREADY CONFIGURED here (eslint react-hooks/rules-of-hooks) that nothing ran. scripts/check-react-hooks-rules.cjs + a PostToolUse hook; `eslint src` outright is unreachable (406 errors measured), this rule carries 2, both pre-existing, pinned as a SET not a count. Driven RED on the real defect AND on all three shapes the hand-rolled regex misses. ⚠ WR-04 TIGHTENED AN EXISTING ASSERTION: it forbade /run ended/i anywhere in textContent, which forbade the a11y fix outright since RUN_ENDED_TITLE contains those words; it now asserts the marker LITERAL. ⛔ Gates RE-DERIVED at close, never quoted: backend 71 failed / 4864 passed with the SET byte-identical to 250-backend-baseline-set.txt on every one of six full runs; count gate OK 287/287 0 failing exit 0 — which CONTRADICTS this phase's own baseline ('not reachable') and confirms its own prediction that a later green means the flake resolving; claude-md 99,021 chars; ledger OK; deploy drift PASS; G-7 clear. ⚠ SEED-171 GAINED TWO SUITES (now SEVEN, and two are outside the workflow surface): two consecutive gate runs on the same tree failed 3 both times with ZERO OVERLAP in the set — the seed's central claim in its cleanest form, and proof that matching a baseline COUNT is not matching its SET. ⛔ OWED: IN-03, and BUG-260915-01's behaviour fix.
last_activity_250: 2026-09-15 — Phase 250 BUILT, VERIFIED and CLOSED by claude ALONE, on the operator's explicit instruction ("please run this phase yourself end to end... do not involve Gemini and do it yourself"). Full run: discuss → plan → execute → verify, no AskUserQuestion, 3 plans (G-8 target met). ⭐ THE MEASUREMENT CAME FIRST AND IT CHANGED THE PHASE: the ROADMAP blocked planning on whether the stuck todo carries '(run ended - not completed)' because the two arms lead to OPPOSITE fixes. Measured live before a line was planned: 78 open todos / 26 threads, 25 MARKED (newest 2026-09-13 14:31 — the operator's own report date), 53 unmarked of which 49 predate the reconciler and the other 4 sit on 2 threads whose runs ended timed_out/cancelled, never completed. ⭐ THE REPORT'S DICHOTOMY WAS FALSE — both arms are true of DIFFERENT rows: HONEST-04 is the COPY arm, and HONEST-03 gets a LOCATED gate defect rather than a hunt. One measurement answered two requirements. ⭐ BUG-260902-01's 'there is no reconciliation at all' is REFUTED — it ships with exactly ONE call site; its GATE was the defect. ⭐ SEED-105 ALREADY HELD THIS DESIGN, planted 2026-07-06 at a live operator UAT, with ALL THREE re-open triggers fired — ten weeks and two bug reports against the absence of a decision already made (REG-02's case in one seed; seed now status: answered). ⭐ A FENCE REFUTED MY OWN PLAN BEFORE A LINE SHIPPED: D-250-08 argued the new terminal-set predicate SUBSUMED the cap_disposition clause; test_5b was written to prove it and instead showed the producer ordering delivers a cap-paused run as terminal_status=='completed', so dropping the clause marked a RESUMABLE run 'not completed'. Both clauses ship; D-250-08 corrected in place with the original struck through. ⛔ THE HONEST-02 TRAP THAT WOULD HAVE SHIPPED A LIE: full_reasoning_content is RESET inside the loop (2 sites), so reading it at the empty-output fallback reports 'no reasoning' about a model that reasoned every iteration — for exactly the gpt-5.6 family the bug names. A never-reset counter was added and both reset sites say why it is absent from them. ⭐ NO MIGRATION AND NO BACKFILL, which BUG-260902-01 expected to be unavoidable: the panel reads RUN STATE, not the marker, so all 53 unmarked rows (49 predating the reconciler) read honestly without one stored row being rewritten. Driven in a real browser on BOTH threads the reports are about — /run ended/i is FALSE on both pages. ⭐ THREE FENCES READ A COMMENT AS CODE IN ONE SESSION (the Python twin of stripComments.testutil.ts), and a fourth passed VACUOUSLY: the panel's 'does not animate' selector was '.animate-dotBounce' against a shipped 'motion-safe:animate-dotBounce' — caught by its own live-run positive control. ⭐ Gates RE-DERIVED, never read from a claim: backend 71 failed / SET identical to baseline; count gate was RED AT BASELINE with 3 INHERITED failures (captured from the persisted JSON before any re-run, cap untouched) and reads OK at close with +13 attributed exactly; ledger gate fired on 4 files with NO ROW (3 FIRING) and is OK after rows + same-commit sections; tsc app-config 65, none naming this phase's files; G-7 clear; deploy drift PASS. ⛔ A SHIPPED FENCE WAS RETIRED CONSCIOUSLY per SEED-177 — test_075_4_empty_response_iter_count.py asserted the exact sentence HONEST-02 replaced; BUG-260522-01's real claim survives the rewording, so it now pins the CLAIM not the SENTENCE, plus a second test so a future 'simplification' back to one message cannot pass silently. ⛔ OWED, none a defect: the live mirror-image control (a row must never read NOT TICKED while a run streams — two unit fences cover it, one operator click closes it), HONEST-02's per-provider rows (an empty-output run cannot be produced on demand — structural proof instead), the parallel-thread axis live, the word 'NOT TICKED' itself (claude's call from the operator's own vocabulary), and DEBT-06's independent review — WAIVED BY INSTRUCTION, NOT SATISFIED, a fifth owed row beside 238/240/241/249. ✅ SC#10 cross-provider DRIVEN 8/8 at every provider's REAL context budget, roster DERIVED from MODEL_CAPABILITIES — and the first run of that board produced TWO VACUOUS PASSES (google/zhipu never overflowed) which were caught and fixed rather than published.
last_activity_249_gap: 2026-09-15 — Phase 249 GAP-CLOSURE ROUND 1 (G-7: 1 of a permitted 2). /gsd:code-review 249 returned 2 BLOCKERS + 11 warnings; SSRF, SQLi, picker-feed availability and the optional-prop defaults were explicitly CLEAN. ⛔ BOTH BLOCKERS WERE REGRESSIONS THIS PHASE INTRODUCED, and both were REPRODUCED BY DRIVING before a line changed. CR-01: the widened verified_models also fed JudgeModelPicker, so every operator-added option was a guaranteed 400 — driven, glm-4.7-flash offered and refused; registry_models now carries the validator's exact set (61 vs the union's 82). ⭐ CR-02 IS THE WORST FINDING OF THE PHASE: tool loss was computed only over UNREGISTERED ids, so a self-hosted row added through the NEW door was registered, resolved native_tools=False, and got NO marker anywhere — the phase silenced its own headline warning on exactly the models it unblocked, and the Settings chip HAD fired for such a model before. Root cause is conceptual and mine: I fused "is it registered?" (drives the unverified chip) with "will it call tools?" (drives the consequence). Fixed by computing from RESOLVED capability; the operator's flagged count went 13 -> 16, i.e. three real cases were being silenced on their own machine. Third wording added — "no tools", never "unverified", because that would be false about a model they entered. Also fixed WR-01 (__context__ still held the row-bearing DETAIL; now raised OUTSIDE the except so neither chain slot is set), WR-02 (catch the violation FAMILY, not 3 of 5 leaves), WR-03/WR-08 (three comments I wrote were factually wrong about their own code — corrected in place), WR-05/WR-06 (a THIRD copy of the tooltip still said timeout=90s, two elements above the one I "fixed"), WR-10. Four deferred WITH REASONS (WR-04/07/09/11) — WR-07 is the uncomfortable one: a 4th hand-typed roster mirror, same class this phase exists to close. ⛔ MY SELF-VERIFICATION PASSED THIS PHASE WITH BOTH BLOCKERS PRESENT — every gate green, six fences driven RED, three browser scenarios — and neither was catchable by a gate, because CR-01 is a disagreement between two components whose own tests are both correct and CR-02 is a warning that correctly does not fire by its own logic. That is the argument for DEBT-06 in one paragraph. Gates after: backend 71 failed / 4804 passed, SET identical; count gate total 8357 / pinned 7550 (+11, fully attributed) but FAILED 1 — src/pages/WorkflowBuilderPage.canvas.test.tsx, SEED-171's fifth named suite, its recorded AssertionError signature, PROVABLY UNMODIFIED by this phase (git diff over frontend/src/pages + components/workflows is EMPTY). Captured from the gate's persisted JSON BEFORE any re-run; cap untouched at 2; run NOT repeated to obtain a green. ⚠ This phase's baseline and first close both read count gate OK, so this is its FIRST red — on the third invocation over unchanged workflow code.
last_activity_249: 2026-09-15 — Phase 249 BUILT, VERIFIED and CLOSED by claude ALONE, on the operator's explicit instruction ("execute this phase in to end yourself without gemini... I want to come tomorrow to see it complete"). Full run: discuss → plan → execute → verify, no AskUserQuestion. ⭐ THE PHASE WAS SMALLER THAN ITS ROADMAP ROW, AND MEASURING FIRST IS WHY: MODEL-06 was ALREADY SHIPPED (broadcast + subscriber wired at all 4 seams) and MODEL-09 DID NOT REPRODUCE (fresh live sweep 8/8 healthy, 0 opaque provider_error, against BUG-260809-01's "0/8, 6 hiding why") — so neither was rebuilt; the first got a two-direction fence, the second a written closure. ⭐ MODEL-04's defect was ONE SYMBOL in two languages: the add endpoint validated the SSRF DISCOVERY allowlist (8 clouds) instead of the routing roster (11), and the UI hand-typed the same 8 a third time, so ollama/lmstudio/custom were unaddable for the endpoint's whole life; both now derive from config.ROUTING_PROVIDERS and are pinned by a ?raw lockstep fence, with PROVIDER_ENDPOINTS byte-unchanged. ⭐ MODEL-05's chip EXISTED — on Settings, not on the composer where models are picked; moved, and it now states the consequence. Driven live: 13 of the operator's configured models silently lose tool calling, and THE MODEL THEY CURRENTLY RUN is one of them. ⚠ verified_models was BUILT-INS ONLY, so MODEL-04's success would have lit MODEL-05's warning — now a union. ⭐ FOUR GREEN FENCES WERE HIDING SOMETHING: ModelRegistryTab.test.tsx asserted toHaveLength(8) — the 8 WAS the defect — and was running outside the count gate entirely; ModelPillRow claimed timeout=90s against a real 300, and its own test asserted the false number. ⭐ MODEL-08 reproduced live before the fix (set 0/51/999 -> returned False) and surfaced a SECOND finding the bug report never mentions: exc_info=True logged asyncpg's DETAIL line, i.e. THE ENTIRE app_settings ROW including enc:v1 envelopes and the operator's tunnel URL (T-081.1-04). ⭐ Gates RE-DERIVED, never read from a claim: backend 71 failed with the SET identical to baseline (all 71 names), count gate OK 8346 / failed 0 / 283 files with +46 attributed exactly to this phase's four suites, ledger gate OK with FIVE rows added that had never existed (incl. api/evals.py, FIRING at 7 phases). Six fences driven RED against plants and restored; the first plant found a real bug in the fence's own parser. ⛔ OWED, none a defect: MODEL-04 end-to-end in chat (no live self-hosted endpoint answered), MODEL-06 multi-worker observation (this box runs TWO independent single-worker uvicorn --reload servers on :8000 — an environment hazard in itself), MODEL-09's CLOUD half (one operator click), and DEBT-06's independent review — WAIVED BY INSTRUCTION, NOT SATISFIED, a fourth owed row beside 238/240/241. ⛔ 242's owed UAT row 5 deliberately NOT ridden (D-249-27). ⚠ SEED-172 finding #2 — the 600s SDK ceiling get_llm_client never sets — bites EXACTLY the local models this phase just unblocked.
last_activity_248: 2026-09-15 — Phase 248 BUILT by gemini, REVIEWED INDEPENDENTLY by claude, G-4 UAT DRIVEN and operator-APPROVED. Awaiting gemini's commit + verification_mode frontmatter. Review arc: 6 findings raised across threat-model / plans / build (BUS-232, 234, 235, 240, 242), 5 confirmed and fixed, 1 REFUTED BY MY OWN MEASUREMENT and retracted within the hour (BUS-237/238 — policy-expression function calls do NOT require EXECUTE by the querying role; driven with SET ROLE anon against the applied migration). ⭐ Gates all RE-DERIVED, never read from the builder's claim: backend 71 failing with ZERO names outside the 72-name baseline union (re-run after connector.py changed post-first-run — "frontend-only revision" would have been unsound); count gate OK 279/279 0 failing; connectors.py BYTE-UNCHANGED through two edit rounds so the sixth-landing extraction stays untriggered; ledger watched 6→7 after McpAuthDoor.tsx got its row; deploy drift PASS. ⚠ MY OWN BASELINE CLAIM WAS WRONG AND IS CORRECTED IN PLACE: "count gate OK is NOT reachable for this phase" (BUS-231, 248-GATE-BASELINE.md:132) is REFUTED — it is green; I generalised a flake into a property from two red samples. ⛔ OWED AT CLOSE, none a defect: migration 181 is LOCAL-ONLY (production still reads 13/13); CRED-04 ships operator-run, so "cannot silently skip" overclaims; G-4 scenario S2 (the McpAuthDoor door) unreached — code parity proven, a person seeing it is not; and an unexplained −1 in the count gate's grand total (8297→8300 = +3 against +4 pinned, no pinned file decreased, so it is in an unpinned suite).
last_activity: 2026-09-14 — Phase 248 CONTEXT LOCKED then ROLES REVERSED. ⚠ ORDER MATTERS: claude ran discuss-phase under the old ruling and committed 248-CONTEXT.md (15 decisions D-248-01..15) at 415f57f8e; the operator THEN reversed to "handover planning and execution to gemini and you review". GEMINI BUILDS, CLAUDE REVIEWS (arm-pair.sh 248 gemini → BUS-228/229); BUS-227 ("do not start 248") RETRACTED IN FULL by BUS-230 and closed. Expected close is peer-reviewed, not self-verified. ⛔ DISCLOSED §6.3 EXPOSURE: the reviewer shaped the design — every decision was operator-chosen via AskUserQuestion, but claude framed the options, so at review claude may NOT defend a decision because it is in that file, and 248's verdict must state the shaping in words (the honesty gate checks marker PRESENCE, never truth). Re-running discuss-phase under gemini remains the operator's clean-separation option. ⭐ BASELINES CAPTURED BEFORE THE BUILDER STARTED (248-GATE-BASELINE.md, BUS-231): backend 72/71/72 on a byte-identical tree — SEED-274 reproduced — so the gate is a SET (71-name stable core, 72-name union, ONE flipping test) and NOT the "71, zero headroom" CLAUDE.md publishes; frontend count gate RED at baseline with 3 inherited failures, so "count gate OK" is NOT a reachable acceptance criterion for this phase. Three measured findings changed the phase before a question was asked — CRED-02's headline defect is ALREADY FIXED at e615c0dad and the dishonesty MOVED to the affordance; the advisor reports a SECOND 13-finding lint CRED-03 does not name; custom_client_id has THREE homes and McpConfig's is RFC-7591-minted, so a positive shape rule would break the Phase 222 BYO door. REQUIREMENTS.md's CRED-02 citation corrected in the same commit (two bugs share id BUG-260828-02). Phase 247 remains CLOSED ON CODE at 3d5f62dc6 with G-4 lived-experience UAT OWED — operator only. Next: /gsd:plan-phase 248.
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 8
  completed_plans: 8
  percent: 80
---

# Project State

> ⚠ **This file was RESET at the v4.0 close (2026-09-10)** — the fourth reset, and the reason is the
> same each time. The previous STATE.md had reached **1,893 lines**. **Nothing was deleted:** the
> full v4.0 file is archived verbatim at `.planning/milestones/v4.0-STATE-at-close.md`, including
> every per-phase position entry, the Phase 240 and 241 debt banners, the *Inherited from v3.9*
> section, the register-integrity sweep, the Deferred Items table and both guardrail overrides.
>
> ⚠ **Hand-edit this file. Do NOT call the `state.*` SDK verbs** — seven of them write false records
> and corrupted this file five times during Phase 190 alone while reporting success.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-13)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and
can be taught new behaviors (skills) that persist and can be shared.

**Current focus:** **v4.2 The Connected Knowledge You Can Actually Run** — started 2026-09-13.
Phases **247+**. Phases 247, 248, **249** and **250** closed. Requirements: `.planning/REQUIREMENTS.md`. ⚠ Phase 250's CODE REVIEW round closed on 2026-09-15 (9 of 9 Critical+Warning fixed, 4 of 5 Info; see `250-REVIEW.md` → *Resolution log*) and left **`BUG-260915-01` filed but NOT fixed** — open todos read `Not ticked` on a LIVE run after a plain thread open, because nothing reconciles on thread-switch. Its fix is a trigger change in `StreamsProvider.tsx` (G-5 FIRING), so it is a PHASE, not a closure round. Next action: **Phase 251 (Register Integrity)** — the last phase of v4.2. ⚠ It is sequenced last on purpose so it sweeps this milestone's own output, and Phase 250 just produced two live examples for it: `REQUIREMENTS.md` still reads `WATCH 0/8` and `CRED 0/4` for two CLOSED phases, and `SEED-105` sat `planted` for ten weeks with all three triggers fired.

## ✅ v4.1 IS DEPLOYED — 2026-09-13, and this closes three of the seven carried items below

**Measured at the deploy, not read from a record:**

| | Before | After |
|---|---|---|
| `production` tip | `e65610ac2` | **`eebc4c42f`** |
| `production..develop` | **292 commits** | **0** |
| `master` | `2f2142316` | `84e3b020f` |
| Cloud migrations pending | claimed 4 (`177-180`) | **0** |
| `get_advisors(security)` ERROR findings | **2** | **0** |

⚠ **`scripts/pending-cloud-migrations.sh` OVER-REPORTED BY TWO, and the reason is structural, not a
bug:** it diffs **git refs** against `origin/production`, never the live database. `177` and `178`
were measured **already applied** in cloud (RLS on both tables, `anon` absent from both ACLs,
`app_settings_multimodal_max_vision_calls_bound` present). Only `179` and `180` were genuinely
pending; both are additive `ADD COLUMN IF NOT EXISTS`, applied by the operator via the SQL editor and
verified live — `removed` NOT NULL DEFAULT false, its partial index present, **33 override rows, 0
tombstoned** (nothing vanished from the picker), and all four self-hosted endpoint columns with their
defaults on the single `app_settings` row. ⭐ **Confirm a migration against the DATABASE, never
against a git diff.**

⚠ **The Vercel MCP cannot see this project.** It is authenticated to `fahed-mrads-projects`, which
holds exactly one project — `rag-app`, built from `fhdautomation/rag-app`, last deployed February.
**That is not Agentic RAG.** Frontend build state is dashboard-only from here; the operator confirmed
the live app serves the new version by hand.

## ⛔ Carried out of the v4.1 close — status re-derived 2026-09-13 at v4.2 scoping

Written at the close, 2026-09-13. **These were the input to this milestone.** ⭐ Each now carries its
measured disposition rather than being re-copied forward — three are discharged, and item 1 was never
owed work at all.

1. ⛔ **`RECALL-01` is UNMET and that is a finished decision, not owed work.** Phase 246 proved by
   `EXPLAIN (ANALYZE)` that no `hnsw_ef_search` value fixes the small-tenant recall cliff *through
   the index*: 40/60/80 → **Index Scan, ONE row**, ~0.05 recall, ~4 ms; 100/150/200 → **Seq Scan**,
   recall 1.000, **~1,100 ms**. Default reverted to 40. **Re-open path: `SEED-273`
   (`hnsw.iterative_scan`)** — and any future attempt must inspect a PLAN, not only a recall number,
   because measuring recall alone is exactly how Phase 241 reached the opposite conclusion.
2. ⛔ **Migrations `179` and `180` are NOT in cloud — measured at the close**, not read from a
   record (`model_capabilities_overrides.removed` absent; all four self-hosted endpoint columns
   absent). `176 / 177 / 178` ARE present. **A promotion that carries the code without 179 and 180
   breaks on arrival.**
3. ⛔ **`origin/production` is 287 commits behind `develop`.** v4.1's entire output is undeployed —
   **the state v4.1 was opened to end for v4.0.** Also still owed from 242: the **non-code** deploy
   parity half (env vars, seed rows, provider keys, `SANDBOX_IMAGE`), and 242's UAT row 5, whose
   re-open trigger IS the next promotion.
4. ⭐ **`SEED-172`'s trigger FIRED at this close, reported by the operator as lived friction:** a
   local Ollama / LM Studio model must be added **by hand**, with its **timeout** and **context
   window** configured by hand, because `POST /admin/models` validates its provider argument against
   the 8-cloud **SSRF discovery allowlist** rather than the routing roster. ⛔ **Skipping the manual
   step is not cosmetic** — an id absent from `MODEL_CAPABILITIES` resolves `capability_source =
   inferred` and silently loses `native_tools`, which short-circuits above every tool gate.
   **Leading candidate for the next milestone**, with `SEED-040` and `SEED-135`.
5. ⛔ **The independent §6.3 review is still owed by 238, 240 and 241** — `DEBT-03` was always
   *"say so in the record"*, never *"do it"*, and 245 did not do it. Gemini is available again, so
   the blocker that justified the deferral is gone.
6. ⚠ Named residues with triggers: `SEED-272` (a failed attachment copy never gives up or
   recovers) · 245's `238-M-9-microsoft-arm`, `233-row-3-refusal-arm`, `240-five-mail-rows` ·
   `SHELL-03`'s fail-closed arm and Deep-mode `ask_user` path, both undriven.
7. ⚠ **Register integrity is the recurring defect, now twice in consecutive milestones.** The
   ROADMAP Progress table read `0 / 5 phases complete` with all five phases closed; v4.0 shipped the
   same class in the requirement COUNT. **Re-derive from the phase directories, never from a summary
   line.** Also open: **8 duplicate seed IDs** across 280 seeds (`022, 092, 228, 229, 231, 253, 259,
   269`), so a reference by ID cannot be resolved.

## Current Position

Phase: **247 — Sources & Watches · CLOSED ON CODE** at `3d5f62dc6`. Next: **248 — The Credential Boundary**
Plan: 247-01 .. 247-04 — **all 4 shipped across 3 waves**, every plan carrying a SUMMARY
Status: **Closed on code; G-4 lived-experience UAT OWED (operator only).** Built by gemini, reviewed
wave-by-wave by claude (`BUS-214` / `BUS-217` / `BUS-218` / `BUS-219`); five findings raised and fixed
(`1f37737ae`); `SEED-253`'s Drive-path fence retired under **`D-247-01`** with the reason in the test
body (`3d5f62dc6`). Gates re-derived under claude's own runs: wider blast radius **460 passed / 0
failed** · 247's own suites 37 · frontend 118/118 · standing red 16-33 with the **same membership** as
the pinned baseline · honesty gate 10/10 · ledger gate OK.
Last activity: 2026-09-14 — close **given** (`BUS-221`), **RETRACTED** (`BUS-222`), and **re-given on
wider evidence** (`BUS-223`)

⚠ **THE RETRACTION IS THE FINDING, AND IT IS CLAUDE'S OWN — recorded here rather than in the phase
folder, because it is a rule for 248 onward, not a fact about 247.** The first close was given over
**three red suites, all CAUSED by the phase** — measured both ends (70 passed at base `987e7a685`, 2
failed at HEAD), so **not inherited** — and all three were invisible because the review ran every file
247 **TOUCHED** and no file that **DEPENDS** on what 247 changed. One of them was a **fence**.
⛔ **A reviewer who runs only the phase's own suites measures the phase's own CLAIMS, never its
CONSEQUENCES.** For every phase from 248: run the touched suites **AND their dependents**, and
establish **base-vs-HEAD** on anything red rather than assuming inheritance.
⚠ A limit of the honesty gate found by using it: it printed `honesty gate OK — 10/10` over a
`verification_mode: peer-reviewed` marker that was **not yet true**. **It checks PRESENCE, never TRUTH.**

⭐ **First phase of v4.2, and the first planned end-to-end under the re-armed `OV-SOLO-01`** —
gemini sketched, discussed, planned; claude reviewed and did not shape it. The plan-gate review
found two things worth recording beyond this phase:

- ⛔ **The standing-red pin could not pass.** `247-PREFLIGHT.md` pinned
  `sourceComposition.test.tsx` at *"strictly 17 failed | 32 passed"*; the reviewer measured
  **16 | 33 three consecutive runs** on a tree whose `frontend/` and `backend/` are
  **byte-identical** to the preflight's own base. Four readings exist across four sources
  (16/18/17/16, total always 49). ⭐ **It is not flaky WITHIN a session — it does not reproduce
  ACROSS runners**, which is the worse property: a plan measures a stable number, writes it as a
  contract, and the next runner fails it having changed nothing. Replaced by a **set** contract —
  the 16 failing test NAMES are captured in `247-STANDING-RED-BASELINE.md`.
  ⚠ **Same class as `SEED-274`, planted the same day** for the backend ceiling (71/72/72/77 on one
  tree against a gate CLAUDE.md calls zero-headroom). **Two gates pinned to an integer over a value
  that moves.**
- ⚠ **A G-5 obligation was nearly resolved on a counting technicality.** The preflight read
  `sourceHealthVocabulary.ts` as *"clean at 2 phases"*; the ledger row reads `6 / 3 / 560` and says
  *"G-5 FIRES on the next touch"* — and 247-03 is that touch. Its buckets are `235`, `240`,
  `BUG-260912-01`: **three work units, two numeric**, so the recipe and the row genuinely disagree.
  Resolved by **discharging it explicitly** (safe-as-is, written rationale) rather than by picking a
  count. ⭐ The rationale was then **driven, not accepted**: zero imports and zero state both hold,
  and **18 modules import it** — a fan-in that makes splitting it actively wrong.

### v4.2 disposition of the seven carried items

| # | Carried item | Disposition at v4.2 scoping |
|---|---|---|
| 1 | `RECALL-01` unmet | ⛔ **Not owed work — a finished decision.** Out of scope, re-open path `SEED-273`. Any retry must inspect a **PLAN**, not a recall number |
| 2 | Migrations 179/180 not in cloud | ✅ **DISCHARGED** — applied and verified live 2026-09-13 |
| 3 | `production` 287 behind | ✅ **DISCHARGED** — now 0. ⚠ 242's UAT row 5 is unblocked and owed; **241's row 5 is EXPIRED, not owed** (migration 176 was already in cloud, so the no-columns arm it proves is unreproducible forever) |
| 4 | `SEED-172` fired | ➡ **SCOPED** as `MODEL-04` / `MODEL-05`, with `SEED-040` and `SEED-135` |
| 5 | Independent §6.3 review owed by 238/240/241 | ➡ **SCOPED** as `DEBT-06`, widened to 242-246, as a **standing gate** not a phase. `OV-SOLO-01` re-armed; `BUS-202` already waiting on Phase 246 |
| 6 | Named residues with triggers | ⏸ Carried unchanged — `SEED-272`, `238-M-9-microsoft-arm`, `233-row-3-refusal-arm`, `240-five-mail-rows`, `SHELL-03`'s fail-closed and Deep-mode arms |
| 7 | Register integrity (8 duplicate seed ids; 161 planted) | ➡ **SCOPED** as `REG-01` / `REG-02` / `REG-03` — the first time this has been given requirement ids rather than a close-note |

## Carried into v4.1 from the v4.0 close

The nine sections below were written at the v4.0 close. **They are the input to this milestone, not
history** — items 1, 2, 3, 4, 5 and 6 are now scoped into v4.1 phases; items 7, 8 and 9 remain live
constraints on how it is built.

---

## ✅ v4.0 CONNECTED KNOWLEDGE — CLOSED 2026-09-10

**The premise came true.** A source is connected once and then read by itself: Google Drive,
OneDrive/SharePoint via Microsoft Graph, **any** MCP file server, and mail — four families over ONE
`browse / list / read / check` contract, with connection-scoped visibility enforced at all four RLS
sites and a durable queue underneath.

**Record:** [`MILESTONES.md`](MILESTONES.md) · roadmap archive
[`milestones/v4.0-ROADMAP.md`](milestones/v4.0-ROADMAP.md) · requirements
[`milestones/v4.0-REQUIREMENTS.md`](milestones/v4.0-REQUIREMENTS.md) · audit
[`milestones/v4.0-MILESTONE-AUDIT.md`](milestones/v4.0-MILESTONE-AUDIT.md) · state at close
[`milestones/v4.0-STATE-at-close.md`](milestones/v4.0-STATE-at-close.md).

⚠ **All fourteen phase directories moved to `.planning/milestones/v4.0-phases/` at this close**, so every `NNN-*.md` named below lives there — e.g. `.planning/milestones/v4.0-phases/238-microsoft-graph-onedrive/238-UAT.md`. `.planning/phases/` is now empty of v4.0 work. ⚠ One stray remains there: `206-mcp-connector-client-workflow-scoped/206-01-PLAN.md`, an **older draft** of a file already archived complete under `milestones/v3.8-phases/` (it reappeared at `ba59d36b0`, after the v3.8 archive). Left in place rather than deleted — it is not this milestone's to remove.

---

## ⛔ CARRIED PAST THE CLOSE — decisions, not oversights

Each of these was **stated at the close rather than absorbed into it.** A closing milestone that
lists only what passed is not a record.

### 1. ⚠⚠ ONE OWED ITEM HAS AN EXPIRY DATE — read this before any production push

**Phase 241's UAT row 5 must run on CLOUD *before* migration 176 is applied there.** After 176
lands, the "no columns" arm it exists to prove is unreproducible **forever**. Five of 241's six rows
are driven and passed; row 5 is the one that dies. File: `.planning/milestones/v4.0-phases/241-recall-at-corpus-scale/241-HUMAN-UAT.md`.

⚠ It collides with the item directly below: **applying the pending migrations is exactly what kills
it.** Row 5 first, then the migrations — in that order, or not at all.

### 2. ⛔ Cloud is 15 migrations behind

`153, 154, 155, 156, 166..176` are all pending; **v4.0 has not deployed.** Operator decision
2026-09-10: they are applied immediately **before** the next push, not now. Run
`bash scripts/pending-cloud-migrations.sh` and apply the printed set in NUMERIC ORDER, once each,
by pasting into the cloud Supabase SQL editor.

### 3. ⛔ Three phases owe an independent §6.3 review — 238, 240, 241

No independent reviewer exists: Gemini has been unavailable since 2026-09-09 and the operator has
ruled out `/code-review ultra` on cost. **Their verdicts are the builder's own, and the v4.0
milestone audit is a self-audit for the same reason.** What that does not weaken is the mechanical
evidence — a hash, a byte-identical file, a driven function. What it weakens is every judgement call
about whether an owed item was acceptable. ⚠ See `OV-SOLO-01` below: **its re-arm trigger has now
fired and the condition it described is still true.**

### 4. ⛔ Two UAT sets are credential-blocked

| Phase | Rows | Blocked on |
|---|---|---|
| 238 | **9** | one Azure app registration (`MICROSOFT_OAUTH_CLIENT_ID/SECRET`) — **run M-1 first, it unblocks the other 8**; SharePoint rows S-1/S-2 separately on `SEED-256` (no work/school tenant) |
| 238 | **ELEVEN — 9 M rows + S-1/S-2** | ⚠ **CORRECTED 2026-09-13 (Phase 245) — the row above is preserved, not deleted. NOT BLOCKED: ✅ SC#1 CLOSED.** All nine of 238's M rows were **DRIVEN LIVE on 2026-09-07** (`238-VERIFICATION.md:213-231` — 7 full pass, 2 half at the time; **four defects found by driving and NONE by the 15-case unit suite**). The operator completed the Azure registration *hours after* `238-SUMMARY.md` was written. ⚠ **And the "9" above was ambiguous** — it read as though S-1/S-2 were included, while `REQUIREMENTS.md` read as though they were not. **Resolved at the anchor: `238-VERIFICATION.md`'s footer now states ELEVEN rows and defines "nine" as the M rows only.** Terminal state: **8 ✅ PASS · 1 ⛔ BLOCKED (M-9 — no `/Finance/` folder in the OneDrive account, an operator action; blocking id `BUG-260913-01`; trigger: that folder existing, or the next phase touching Graph ingestion) · 2 ⛔ RETIRED (S-1/S-2 — `SEED-256`, ground `drive_type: personal`)** |
| 241 | **1** (row 5 of 6) | a read-capable cloud DSN — ⚠ **and it expires, see item 1** |

Also owed from earlier in the milestone and never driven: **233's five G-4 rows**, **236's live
SC#1 was driven** (2026-09-06, 8/8 providers — this one is DONE), **237's rule-builder surface was
never manually clicked** (owed by decision).

### 5. ⛔ `QUEUE-06` is not met out of the box

241 measured the defect and shipped the remedy, but **the default is unchanged**: at
`hnsw.ef_search = 40` a tenant owning 0.2% of a 100k-chunk corpus scores `recall@20` **0.040**.
`ef_search = 200` restores **1.000**. ⚠ The degradation is a **cliff, not a slope** — an install can
cross it with **no deploy and no setting change**. `D-v4.0-EF-DEFAULT` records why the default was
left alone; the cost is that the requirement is honestly unticked.

### 6. ⛔ `SURF-03`'s home is an open SCOPING decision, not a build

There is no in-app notification surface in this product. The recommendation is an app-shell signal
**plus** the Health-tab row; **closing it against the Health tab alone does not satisfy it.** This
is a product question for the operator at the next `/gsd:new-milestone`.

### 7. ⚠ `retrieval_service.py`'s G-5 extraction, owed since 231

241 was the deliberate **second** landing (11 non-comment lines, fence driven RED at 13).
**A third landing must propose the extraction FIRST.**

### 8. ⚠ Register debt that the next milestone opens against

| | |
|---|---|
| Planted seeds | **161** of 275 — ⚠ CLAUDE.md's sweep rule says `/gsd:new-milestone` reads every `trigger_when`. **At 161 that sweep is a phase of work, not a step in a command**, and a `trigger_when` nobody reads is a deferral with no re-open, which is a deletion that looks like a decision |
| Open reported bugs (`surface: Agentic-RAG`) | **34** |
| New seeds from 241 | `SEED-265` (connection-by-id / saved-View recall axes were never built) · `SEED-266` (`full-schema.sql` ACL + `row_security`) · `SEED-267` / `SEED-268` (WR-02/03/04/06, and the harness's unproven exact arm) |
| ⚠ `SEED-177` | still reads `status: planted` while its retire-the-egress-fence trigger **already fired** |
| Plans with no SUMMARY.md | `232-04` (landed `1ae6defbb`) and `235-17` (landed `29858f01f`) — in git, absent from the phase record |
| `BUS-171` | the operator-queue triage (23 items `--to operator`) is **parked, not dropped** |
| `SEED-242` | still armed — `app.<domain>` at the next production push |

### 9. ⭐ The method finding worth carrying into the next milestone

**A review is a CLAIM about code, not the code.** Measured three times in one hour by the audit
written to catch it: the audit asked *"is a VERIFICATION file present?"* and never opened the review
that was there; the correction opened the review and escalated its two CRITICALs to *"open, data
loss"* and never opened the code — they had been fixed two days earlier, in an ancestor of the
auditing commit. **Each register only knows the one below it, and the code is the bottom. Drive it,
or do not report it.**

---

## Deferred Items

Acknowledged and deferred at the v4.0 close (`gsd-sdk query audit-open` → **48 open items**). None
is engineering; **the verification debt listed above is the part that matters.** Full item-level
table: `.planning/milestones/v4.0-STATE-at-close.md` is the pre-close snapshot; the live list is
re-derivable at any time with `gsd-sdk query audit-open`.

| Category | Count | Detail |
|---|---|---|
| quick_tasks | **29** | 28 `missing` + 1 `unknown` — historical records whose files no longer exist (was 28 at the v3.9 close; one added) |
| seeds | **14** | all `dormant`: 003, 004, 040, 041, 042, 043, 045, 046, 084, 127, 163, 164, 165, 166 — ⚠ unchanged for two milestones running |
| todos | **1** | `spike-nl-workflow-authoring.md` — largely satisfied by the Phase 097 spike answer |
| uat_gaps | **2** | 233 (`unknown`, 5 rows) · 241 (`partial`, 5/6 driven) |
| verification_gaps | **2** | 239 (`human_needed`, **no code defects** — its 2 CRITICALs and 4 HIGHs are closed and were independently re-driven) · 241 (`human_needed`) |
| debug_sessions / threads / context_questions | **0** | clear |

## Guardrail overrides

### OV-248-01 — Claude builds Phase 248 END TO END, so 248 has no independent reviewer (operator, 2026-09-14)

**Operator instruction, verbatim:** *"you will handle next phase end to end yourself."*

The next unstarted phase is **248 — The Credential Boundary** (`CRED-01..04`).

⚠ **The concern was stated once, at the time, and is recorded rather than re-litigated.** 248 is the
**trust-boundary** phase of this milestone: a credential that comes to rest in a column every org
member can read (`BUG-260907-02`, driven live 2026-09-13), and 13 anon-executable `SECURITY DEFINER`
functions. **A phase Claude builds, Claude cannot review** (`AGENTS.md` §6.3), so 248 closes
`self-verified` with `independent_review: owed` — adding to the `DEBT-06` backlog this session spent
the day measuring. **249, 250 and 251 carry no trust boundary and were offered as no-cost
alternatives.** The operator has the facts; the decision stands.

⛔ **What this override does NOT suspend:** the threat model stays MANDATORY, the dispatched
code-review subagent stays MANDATORY (`config.json` `security_enforcement: true`, `code_review: true`)
— and neither is an independent gate, which is exactly why 248's verdict file must say
`verification_mode: self-verified` and never "reviewed". ⭐ The honesty gate now ENFORCES that
automatically: `scripts/check-verification-honesty.cjs` derives its scan set over phases >= 238, live
and archived, and will pick 248 up the moment a `VERIFICATION.md` or `VERDICT.md` appears.

⚠ **`CRED-03`'s trap is the one to carry into the build:** `REVOKE … FROM anon` is a **no-op** while
the default `PUBLIC` grant stands — measured when migration 177's first version applied cleanly and
verify still read `FAIL`. Revoke from `PUBLIC`, then grant back. And a `CRED-01` fence must make at
least one assertion **as `anon`**: every gate in this project reads through the service role, which is
precisely the blind spot that hid `BUG-260911-01`.

**Re-open trigger:** if an independent reviewer becomes available before 248 closes, this override
lapses and the review is taken — it is not spent by having been granted.

OV-248-01-status: live   # flip to `retired-<YYYY-MM-DD>` when 248 closes or an independent reviewer takes it. ⛔ do not delete it — an absent marker reads as an absent decision.


Both v4.0 overrides are preserved verbatim in `.planning/milestones/v4.0-STATE-at-close.md` →
*Guardrail overrides*. Record every new override here, per the CLAUDE.md orchestrator protocol.

### G-7 (gap-closure round cap) — Phase 244, round 2 → plan `244-15`

`node scripts/check-gap-closure-rounds.cjs 244` reads `rounds completed: 2 (cap is 2)` and prints
`G-7 fires`. **Re-derived by the orchestrator at the merge of `244-15`, not inherited from the
executor's claim** — the gate's own derivation names both rounds (`8cd9d8119` → 244-09..13,
`8a27ab7f8` → 244-15).

Waved through on the gate's **worded** escape hatch, with the criterion:

> *"SC#3: an approval answered in one home does not settle it in the other, and the run line +
> composer keep a lock the server has already dropped."*

Verdict: **`G-7 passed WITH OVERRIDES`** — never `clear`. Rests on the operator's recorded ruling at
the close of round 2 (`244-UAT.md` § *Operator rulings — 2026-09-12*). The
`[new-capability-in-closure]` arm stayed clear on its own merits.

⛔ **This is the last round available.** A third gap-closure round needs the operator, not a flag —
if verification returns `gaps_found` on this phase again, triage (fast-fix / defer / accept) is the
only door, and `/gsd:plan-phase 244 --gaps` must NOT be routed to.

### ⭐ OV-SOLO-01 — RE-ARMED 2026-09-13. ITS TRIGGER FIRED AND WAS ACTED ON THE SAME DAY.

⭐⭐ **THE TRIGGER FIRED: Gemini is available again (operator, 2026-09-13).** The ruling's own
re-arm trigger read *"Gemini's quota returns, or the v4.1 close, whichever is first"* — the first
arm arrived. **The two-agent separation of `AGENTS.md` §3 / §6.3 is BACK IN FORCE from this moment:**
a phase's builder may not be its reviewer, and a solo run is no longer authorised for new phases.

⚠ **This is the whole reason the trigger was written down.** The PREVIOUS version of this override
carried a date-based trigger that arrived and went unacted-on for a day, and Phase 245's SC#4 exists
because of that lapse. **It did not lapse a second time: the trigger fired and was honoured in the
same session**, before any work was handed out under the old regime.

⛔ **What does NOT change retroactively.** Every phase already closed under the ruling (238, 240,
241, 242, 243, 244, 245) stays **`verification_mode: self-verified`** and keeps
**`independent_review: owed`**. Re-arming the rule does not retro-review anything; those debts are
still owed and are still listed where they were. **The honesty gate
(`scripts/check-verification-honesty.cjs`) and its PostToolUse hook stay in force permanently** —
they are not an artefact of solo running, they are how any future self-verification stays visible.

**Next re-arm trigger (for the re-armed state):** if Gemini becomes unavailable again, this flips
back to `live` **with a dated entry and a named expected-return**, never silently.

OV-SOLO-01-status: retired-2026-09-13   # RE-ARMED — Gemini returned 2026-09-13, the trigger's first arm. Flip back to `live` ONLY with a dated entry naming why. ⛔ do not delete it — an absent marker SKIPS the claims-review arm.

#### ⬇ The ruling as it stood while solo running was authorised (2026-09-11 → 2026-09-13) — preserved, not overwritten

OV-SOLO-01-status-historical: live   # machine-readable index for scripts/check-verification-honesty.cjs. Flip to `retired-<YYYY-MM-DD>` when the ruling is re-armed; ⛔ do not delete it — an absent marker SKIPS the claims-review arm.

**Ruling (operator, 2026-09-11, at v4.1 scoping):** **solo running continues.** The substitute for the
independent gate is the **dispatched code-review subagent**, which is **MANDATORY** on any phase
touching a trust boundary. ⛔ **It is NOT an independent gate**, and every phase closed under it must
read **"self-verified"** in its own VERIFICATION.md — never "reviewed". `/code-review ultra` stays
**ruled out on cost**.

⭐ **It is also not worthless, and that is measured rather than assumed:** on Phase 239 exactly this
arrangement returned **19 findings including 2 Criticals**, one being a destructive tool bindable as
the file *reader* and then called by the watch loop on every file, unattended.

**What does NOT lapse either way:** decisions still go to the operator, never self-settled. Baselines
are still captured before source work. RED-first still holds. The mechanical gates — backend ceiling,
count gate, hot-file ledger, CLAUDE.md size — are unaffected by who is at the keyboard and remain the
honest floor.

**Re-arm trigger:** Gemini's quota returns, **or the v4.1 close, whichever is first.** ⚠ The previous
version of this override carried a date-based trigger that arrived and was not acted on for a day —
which is precisely how a self-verification comes to read like a review. **`DEBT-03` (Phase 245) exists
to close that gap in writing**, on phases 238, 240 and 241.

**Applies to:** every phase in v4.1 (242-246).

**Confirmed by Phase 245 (DEBT-03 / SC#4), 2026-09-13:** measured **complete at HEAD before the phase
began** — all four elements and the re-arm trigger present. Cited verbatim in `245-VERDICT.md` §SC#4.
⛔ Nothing here was re-derived, reordered or rewritten. ⚠ The register said `pending`; the artifact
said `done`. **Three registers can be wrong in the direction of "still owed" too** — the same class of
error as the stale Azure claim `245-03` corrects, running the other way.

---

#### ⚠ The original entry, preserved — OV-SOLO-01 before the ruling

`OV-SOLO-01` (operator, 2026-09-08) set aside `AGENTS.md` §3 / §6.3 — the two-agent separation
itself — for 2026-09-08 and 2026-09-09, with the re-arm trigger *"Gemini's quota returns, or
**2026-09-10**, whichever is first."*

⛔ **2026-09-10 has arrived and Gemini is still unavailable.** The override is therefore **neither
expired-and-honoured nor silently extended** — it is recorded here as an **open operator decision**,
because letting it lapse unnoticed is exactly how a self-verification comes to read like a review.
Three phases (238, 240, 241) already closed under it.

**The operator's ruling is needed on one question:** does solo running continue into the next
milestone, and if so, what stands in for the independent gate? `/code-review ultra` is ruled out on
cost, and a code-review subagent that claude dispatches is claude's own work checking itself —
⭐ **though not worthless: on Phase 239 exactly that arrangement returned 19 findings including 2
Criticals**, one of which (a destructive tool bindable as the file *reader*, then called by the
watch loop on every file, unattended) would otherwise have shipped.

**What does NOT lapse either way:** decisions still go to the operator, never self-settled.
Baselines are still captured before source work. RED-first still holds. The mechanical gates —
backend ceiling, count gate, ledger, CLAUDE.md size — are unaffected by who is at the keyboard and
remain the honest floor.

## Gates at the v4.0 close

| Gate | Reading |
|---|---|
| Backend unit | **71 failed / 4491 passed** — the project ceiling **exactly**, and the failing **SET** diffed identical in both directions, not merely an equal count |
| Vitest count gate | RED on 3-4 **provably-unmodified** `SEED-171` flakes — captured before any re-run, per the triage procedure |
| Hot-file ledger · CLAUDE.md size · G-7 | all clear |

## Accumulated Context

Cleared at the v4.0 close. The decision log lives in `.planning/PROJECT.md` (`## Key Decisions`) —
eight v4.0 decisions were added there at this close. The pre-reset snapshot is
`.planning/milestones/v4.0-STATE-at-close.md`. **Open items carried forward are the nine sections
above — nothing else survives the reset silently.**

## Phase 244 — owed verification (recorded 2026-09-12)

⚠⚠ **SUPERSEDED AT THE ROUND-2 CLOSE, 2026-09-12 — the original text is preserved below, never
overwritten, because what it got WRONG is the useful part.** It reads *"zero `244-VALIDATION.md` rows
have been driven"* and lists L-2 / L-7 / L-1 / L-3 / L-4 / L-5 / L-6 as owed. **Two full browser
rounds have since run** (`244-UAT.md` § R1, § R2), and re-verification measures **4 of 5 ROADMAP
success criteria DRIVEN AND CLOSED** — SHELL-01, SHELL-02, SHELL-04's headline, SHELL-05. The
owed-list below is therefore not merely out of date, it names as owed several rows that have since
passed. ⛔ **A stale owed-list is worse than no list: it sends the next session to re-drive work that
is done and lets the one genuinely owed row hide inside seven.**

### ✅ CLOSED 2026-09-13 — the owed row was DRIVEN and it PASSED

⭐ **`244-15-UAT-ROW.md` was driven in a real browser on 2026-09-13 (attempt 2) and PASSES.**
`SHELL-03` closes; re-verification reads **`passed`, 5/5 driven-and-closed**. The text below this
block described the position when ONE row was still owed, and is kept because its checklist is what
made attempt 2 work.

| arm | verdict | the measurement |
|---|---|---|
| 1 — chat → panel | **PASS** | panel controls gone at **+12.6 s**, still gone at **+48.3 s**, no refresh. `R2-4` still showed *"NEEDS YOU"* **three minutes** after answering |
| 2 — panel → chat | **PASS** | chat controls gone at **+2.0 s**, still gone at **+56.3 s**. `R2-4` had all three still at 546.8 / 988.4 at +20 s |
| 3 — run line + composer | **PASS** | `data-run-line-state` `"live"` → gone; composer usable by **+12.6 s** / **+13.3 s**, re-read usable at +31.3 s and +56.3 s |
| 4 — the receipt | **measured** | card unmounts; the stream carries *"— aborted by user · phase: act · reason recorded by the step"*. ⚠ whether that is an acceptable receipt is an **operator judgement**, left open |
| 5 — third home | **PASS** | 1237.6 / 1237.6 / 1382 against `aside.left` 1156, spine climbing |

Two runs on two threads (`34117b9f` answered in CHAT, `25279958` answered in PANEL), so neither arm is
passed by a one-way fix. Both reached **`run=failed` / `act=failed`** server-side, so the UI was not
clearing itself optimistically. ⛔ **Safety held:** `to:` was `uat-do-not-send@example.invalid`
(RFC-unroutable), both settled with **"Do not run it"**, *"Approve this step"* was never clicked, no
email sent.

⛔ **What the PASS does NOT cover, recorded so it is not later assumed:**

- the **fail-closed** arms never ran — `wire_reported_live_at_settle` was **false** both times, so the
  `liveAnchor || capPaused` refusal was never exercised. jsdom Tests 3/4/5 remain its only evidence;

- the **Deep-mode** `ask_user` path is still **undriven**;
- `WR-02` / `WR-03` stay deferred with triggers (`deferred-items.md` §§ 12-13), and `SEED-272` still
  holds SHELL-04's second gap.

⚠ **A METHOD FINDING WORTH MORE THAN THE ROW — attempt 1 produced a defect-shaped reading that was
WITHDRAWN, not published.** The chat column said *"The run was stopped"* and re-enabled the composer
while the DB still read `active` with the ask pending — the exact inverse of the fail-closed
invariant, and one sentence from being written up as critical. The process table killed it: the
backend runs **`uvicorn --reload`**, and **this session's own `git merge` calls rewrote tracked files
underneath it**, restarting the workers mid-run. The client was rendering a dead stream.
⭐ **A UAT driven against a `--reload` backend while the driver is merging branches is measuring its
own tooling.** Establish the box is quiet FIRST, and treat any mid-drive worker restart as
invalidating every observation after it.

---

### ⚠ The position while the row was still owed (kept — its checklist is what made attempt 2 work)

### The CURRENT position — ONE row owed, and it is named

⛔ **Phase 244 is BUILT + REVIEWED, NOT CLOSED.** Re-verification (`244-VERIFICATION.md`,
`re_verification: true`) returns **`human_needed`**, score **4/5 driven-and-closed**.

**The single blocking item:**

> **Drive `.planning/phases/244-the-chat-shell-and-the-composer/244-15-UAT-ROW.md`** — five arms, all
> `pending`. It scores **SC#3's second clause**: *answering an approval in either home settles it in
> both*, plus the run-line and composer readings.

**Why it cannot be waved through on the fences.** `G-8` was driven **FALSE in a real browser on two
real workflow runs**. Round 2 (`244-15`, merged `6acc0bf28`) built the settle path for it, and the
code is real — ten load-bearing claims were spot-checked against the live tree and all held. But
**every assertion added is a jsdom mount over a mocked `@/lib/api`**, and this phase has been burned
by exactly that twice: `244-03` shipped a green mount fence over this same blocker and the operator
found it live nineteen plans later; `244-12` shipped fences proving the approval MOUNTS when the half
that broke was whether it ANSWERS. `D-244-14` binds — *`BUG-260828-07` is severity HIGH and closes on
a DRIVEN row, not a fence.*

**Round-2 gates, measured by the orchestrator on the merged tree (not inherited from an executor):**
count gate `total 8270 · failed 0 · pinned 7480 · 277/277` · ledger gate OK (66 files parsed, 30
watched — not the Phase-242 vacuous-CRLF shape) · CLAUDE.md 97k OK · `tsc -p tsconfig.app.json` 67 → 67,
zero new · **backend untouched by round 2**, so the locked 71-failed ceiling is unaffected.

**Round-2 review dispositions** (`244-REVIEW-gap-round-2.md`, 0 critical / 3 warning):

- **`WR-01` FIXED** as a G-3 fast-fix (`f0398f045`) — it was a regression `244-15` itself introduced:
  the settle ran on **every** answered ask, so answering a prompt on a Deep chat run disarmed the 8s
  stop-confirmation timer and `StopControl` re-rendered a pressable **Stop** over a still-streaming
  run. Driven RED first, pressing Stop for real rather than hand-seeding the slice.

- **`WR-02` / `WR-03` DEFERRED** as decisions with fireable triggers — `deferred-items.md` §§ 12-13.

⛔ **G-7's round cap is SPENT (2 of 2, overridden — see § Guardrail overrides).** If the owed drive
finds a defect, `/gsd:plan-phase 244 --gaps` is **NOT available**. Triage is the only door: fast-fix
(G-3) / defer with a trigger / accept. A third round needs the operator, not a flag.

⚠ **Also new, and not this round's scope:** SHELL-04 gained a second gap in round 2 — a failed
cloud-attachment copy never gives up and never recovers — deferred to **`SEED-272`** by explicit
operator ruling.

---

### ⚠ ORIGINAL TEXT, 2026-09-12 (stale — kept for the record, do NOT act on its owed-list)

Phase 244 is **BUILT, NOT VERIFIED**. Verification returned `human_needed`: 5/5 success
criteria have real wired code (8 load-bearing claims spot-checked against the live tree,
all held), and **zero `244-VALIDATION.md` rows have been driven**. The ROADMAP states
verbatim: *"No success criterion closes on a unit test."*

⛔ Do NOT mark 244 complete until these are driven and written back into
`.planning/phases/244-the-chat-shell-and-the-composer/244-VALIDATION.md`:

1. **L-2 FIRST** — the cap-paused composer still lets the operator act **after a reload**.
   This is the one claim the phase's own authors flagged as unsettleable by reasoning;
   Phase 228 removed the reload that used to free them.

2. **L-7** — the app-shell attention signal, **both directions** (fires for a stopped
   source, stays silent for a healthy one). Never driven end-to-end since Phase 235
   shipped the mechanism — oldest code, highest residual risk.

3. L-1, L-3, L-4, L-5, L-6, then the 8-row cross-provider board (D-244-02).

Also owed, one line each:

- `REQUIREMENTS.md:207-208` carries a SHELL-04/SHELL-05 traceability note that
  **contradicts locked D-244-18 / finding F-1**. Record the correction beside it, not over it.

- 12 of 18 code-review findings remain open — `deferred-items.md`, each with a re-open
  trigger. `WR-08` is *worse-shaped* after the 244-07 fix round.

- `connectors.py` took its FIFTH landing; the split is proposed in writing and declined
  once more. A sixth propose-and-decline is the pattern that deferral exists to stop.

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
