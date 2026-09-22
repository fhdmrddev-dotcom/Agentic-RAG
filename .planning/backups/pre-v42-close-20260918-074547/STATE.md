---
gsd_state_version: 1.0
milestone: v4.2
milestone_name: The Connected Knowledge You Can Actually Run
status: executing
last_updated: "2026-09-17T18:40:00.000Z"
# ⚠ REPAIRED 2026-09-17 at the Phase 254 add: `last_activity` is now a SINGLE-QUOTED scalar.
#   It was YAML-INVALID AT HEAD -- `yaml.safe_load` on this frontmatter failed at line 6 col 183,
#   a bare `: ` inside the unquoted value ("each register only knew the one below it: 253-01 ...").
#   MEASURED on `git show HEAD:.planning/STATE.md`, so the break PRE-DATES this edit and was not
#   introduced by it. ⛔ A register no parser can read is the failure mode this project keeps
#   paying for -- the quoting is the fix; keep the value quoted when appending to it.
last_activity: '2026-09-18 -- PHASE 254 CLOSED. Re-verification returned passed (was human_needed); the prior verdict is preserved, not overwritten. THE OPERATOR RULED ON ALL FIVE REVIEW ASKS, AS A GRADED SPLIT: REFUSED 2 (BUS-251 / phase 249 and BUS-250 / phase 250 -- drafted refusals adopted, both items now [CLOSED], independent_review owed -> refused), LEFT OPEN 3 (BUS-249 / 251, BUS-256 / 252, BUS-257 / 253 still [OPEN], rows still read owed) so the available review capacity goes to the two security-bearing rows and the one carrying two live criticals. The operator ran all four bus commands in session; claude ran NONE (REG-03) and ruled on nothing (D-05). A REFUSAL IS NOT A PASS: both refused phases keep verification_mode self-verified, no 6.3 review ran, and the accepted risk is that a builder read its own work. MEASURED AFTER THE RULING: yaml.safe_load sweep -> refused x2, owed x3; agent-bus list --to gemini 9 -> 7; DEBT-06 unticked box x1 and ticked box x0; 26 requirements unchanged; honesty gate exit 0, 17/17. DEBT-06 CLAUSES RE-DERIVED FROM DISK rather than edited: unmet 10 -> 8, accounted 4 -> 6. ROADMAP: the 254 checklist box is ticked, the counts line moved 7/8 -> 8/8 with the prior reading preserved inline, and both 249/250 Progress rows keep their prior verdict VERBATIM after a SUPERSEDED marker, proven by substring rather than by eye. THE VERIFIER FOUND ONE REAL DRIFT AND IT WAS FIXED: the two secondary Requirements-Coverage rows (REQUIREMENTS.md:331 and ROADMAP.md:408) still read the pre-ruling ten / four -- the hand-typed-list defect this family keeps re-paying, caught by the phase own verifier and by no gate. NEW INCIDENTAL FINDING: the phase 244 VERIFICATION frontmatter is UNPARSEABLE YAML (an unquoted colon-space inside a value), so no parser can read that register at all -- the same failure STATE.md was repaired for on 2026-09-17, and it is why 244 reads unmet for a worse reason than an absent key. ALSO THIS SESSION: the frontend test suite went from 22 broken suites / 49 failed / 72 errors to ZERO errors and 1 failing test in 8,414 -- 11 test-only commits, no product code touched, every fix driven RED and restored md5-identical; the one remaining failure is WorkflowBuilderPage.canvas.test.tsx (a SEED-171 flaky suite), proven byte-unchanged by this session. Two ROADMAP register gaps were also repaired: phase 253 had NO checklist row at all, so its box could never be ticked, and a blank line split the Progress table in two. OWED: DEBT-06 is NOT ticked and v4.2 is complete on PHASES only -- the older arm (239, 241, 242, 244, 245) is untouched and 251 / 252 / 253 remain owed by choice. Next action: /gsd:complete-milestone v4.2, or leave 251 / 252 / 253 for gemini until 2026-09-24. SUPERSEDED: 2026-09-17 -- /gsd:execute-phase 254 COMPLETE, all 4 plans, 3 waves. VERIFICATION: status human_needed (254-VERIFICATION.md, verification_mode self-verified), 254-HUMAN-UAT.md persisted at f6d1270de, 1 pending item. THE GOAL SENTENCE IS NOT ACHIEVED AND THE VERIFICATION SAYS SO WITHOUT SOFTENING IT: zero rows read done or refused (anchored grep, driven), all five read owed. That is not a gap a plan can close -- done needs gemini answering (cannot be driven from here, M-5) and refused needs an OPERATOR ruling (REG-03 forbids claude answering or closing a bus item; AGENTS.md 6.3 forbids the builder ruling on its own work). NOT routed to plan-phase --gaps, deliberately. Orchestrator re-drove the deliverable independently on the merged tree: independent_review present in 5 *-VERIFICATION.md under .planning/phases/ (was 4), anchored done|refused 0, DEBT-06 box - [ ] 1 / - [x] 0, 254-REVIEW-INDEX.md line 11 bus_items_opened_answered_or_closed: 0, agent-bus list --to gemini 9, .agent-bus/OPEN.md byte-unchanged since the wave-1 merge. Waves 1-2 merged from worktrees (torn down via teardown-worktree.sh, venv + node_modules asserted intact); 254-03 and 254-04 ran SEQUENTIALLY ON THE MAIN TREE by design, because the worktree merge path restores ROADMAP.md from a backup and would have discarded 254-04 edit. CODE REVIEW GATE NOT INVOKED AND THAT IS NAMED, NOT HIDDEN: the phase changed 20 files and ZERO are source (no backend/, no frontend/, no migrations), so its subject set is empty. Gates: schema drift false, G-7 clear, claude-md 104,782 chars 69.9%, hot-file ledger exit 0 but watched 0 so it CANNOT be cited. Next action: the operator rules on the five items in 254-REVIEW-INDEX.md; then /gsd:verify-work 254 to re-verify. SUPERSEDED: 2026-09-17 -- /gsd:execute-phase 254 WAVE 3 COMPLETE. 254-04 executed on the MAIN TREE by design (no worktree: this plan writes .planning/ROADMAP.md, and the worktree merge path restores ROADMAP.md from a backup after merging, which would have silently discarded the edit). Commits 3a531f796, 477c14098, 97b5dc6ae, 05e6a9110, 3017852ea. THE DELIVERABLE IN ONE NUMBER: a sweep counting independent_review over the five v4.2 build phases returned 4 before this plan and returns 5 after -- 251-VERIFICATION.md had carried NO such key for the phase entire life, so every count of the field silently omitted it, the same invisibility class as a hot file with no ledger row. The key was ADDED, with builder: and reviewer:, both also absent. NOTHING WAS FLIPPED AND DEBT-06 WAS NOT TICKED, which is the deliverable and not a shortfall: all five values still read owed (asserted by yaml.safe_load, never by grep), all five still read verification_mode: self-verified, the box is still - [ ], and claude ran no agent-bus.sh answer or close. THREE SURPRISES, each driven rather than argued. (1) THE DERIVATION FOUND A ROW DEBT-06 HAD NEVER NAMED: 239 reads independent_review: owed on disk and sits in neither arm and has no bus ask; it is now in the amended requirement unmet clause and routed as a finding. (2) THIS PLAN OWN ACCEPTANCE FENCE IS DEFECTIVE and was reported rather than worked around: grep -h ^independent_review: | grep -cE (done|refused) reads 5, because the plan own action block REQUIRES every comment to say that a ruling would make it refused and only a 6.3 review makes it done. The fence cannot tell a VALUE from its own explanation -- the same lexer class 253 fixed for SQL comments, one register over. Three readings published: plan-as-written 5, value-only 0, yaml.safe_load owed x5. (3) The PostToolUse honesty hook NEVER FIRED on any of the five register edits, because it matches Write|Edit and the edits arrived from a script -- the same matcher-blindness 253 fixed for MultiEdit. Gate run by hand instead: exit 0, subject 16. TWO INHERITED CLAIMS CORRECTED: 250 owed: list had FIVE entries not four (now six, the prior five byte-unchanged); and the briefing claim that done|refused returns 0 across EVERY *-VERIFICATION.md is false -- it returns 0 under .planning/phases/ and TWO under .planning/ (243 refused, 246 done, both pre-existing, written 2026-09-16 by the DEBT-06 audit). DEBT-06 AMENDED NOT TICKED: two labelled clauses on separate lines, re-derived from the files -- ten unmet (239, 241, 242, 244, 245, 249, 250, 251, 252, 253) against four already accounted for (238 complete, 240 complete, 243 refused, 246 done); the range token 242-246 banned from both because it merges four discharged rows with two unmet ones. The amendment widens the requirement to FOURTEEN rows, not D-03 re-typed ten -- ten is the size of the UNMET half only. ROADMAP: seven rows appended to, never overwritten, SUPERSEDED marker count 3 -> 10 (+7 exactly), 254 row 3/4 -> 4/4, pipe-rows 86 -> 86, and the 7 / 8 v4.2 phases closed counts line left BYTE-IDENTICAL to HEAD (md5 72a230988a502bf4b29a8d325d2d8936) because a numerator moves at a phase CLOSE, which is verify-work call. 254-REVIEW-INDEX.md written: ten findings triaged with one recommended disposition each (7 from 251-REVIEW.md + 3 authored by 254 -- two spellings of one state, a bare false, and a 245 row two registers hold with no file to hold it), the structural finding re-derived (grep for independent_review across scripts/ .claude/ .github/ docs/ AGENTS.md CLAUDE.md returns NO MATCHES, exit 1, so the flip is documentation and the measured decay is ten hours), the ADOPTED READING byte-identical (md5 08fe04f7d9438e28d4734a71c5ba0240, 1416 bytes, one distinct value across six files), a flip recipe, and five answer+close pairs pre-filled and UNRUN. bus_writes: 0 deliberately NOT copied from the 251-BUS-TRIAGE analog, because 254-01 DID amend five item bodies; the honest keys are bus_items_opened_answered_or_closed: 0 and bus_item_bodies_amended: 5. Gates: seeds 297/297 exit 0 with 4 plan files / 15 paths (non-zero at last -- the discuss-time run was green over zero), SEED-177 NOT FOLDED on a ROADMAP path collision and left byte-unchanged, unswept 134 / 114 reported as two figures never summed; G-7 clear, 0 gap-closure plans; hot-file ledger subject 15 but watched 0, so its green means nothing to see and it CANNOT be cited; no reported bug carries folded_into: 254 and BUG-260916-01 stays open as an INPUT to 249 review. OWED: five rows still read owed and that is correct -- BUS-249 / 250 / 251 / 256 / 257 are all still [OPEN] behind a 9-item gemini queue unmoved since 2026-09-16; DEBT-06 covers fourteen rows and the older arm (239, 241, 242, 244, 245) is genuinely unmet, with 239 carrying no ask at all; ten findings triaged and none fixed, two of them criticals. CLAUDE MAY NOT RULE ON THE REFUSALS (REG-03). Next action: /gsd:verify-work 254, then the operator rules on the five items in 254-REVIEW-INDEX.md. SUPERSEDED: 2026-09-17 -- /gsd:plan-phase 254 COMPLETE. 4 plans, 3 waves (2dcc87c95, fence narrowing 1e8a677b6, plan-check round 1 at 07af40f46), CONTEXT corrections at f293a602d. 254-01 amends the five filed bus asks in place (deadline 2026-09-24 + rank); 254-02 the claude floor pass on 251 stamped review_type: self-assessed; 254-03 five per-phase refusal DRAFTS; 254-04 the three registers claude owns + 254-REVIEW-INDEX.md. RESEARCH SKIPPED (operator choice). Two workflow gates fired on SUBSTRING FALSE POSITIVES and were passed with the evidence recorded: the UI gate matched `view` inside reVIEW 38 times and `ui` inside bUIlt/reqUIrements 35 times; the AI-SPEC gate matched `agent` in the phase goal. FOUR CORRECTIONS LANDED IN CONTEXT AT PLAN TIME, each preserved beside its original. (1) M-11 REFUTES D-03, which I wrote at discuss time: the older arm does NOT uniformly stay owed -- measured 238 complete, 240 complete, 243 refused, 246 done, and only 241/242/244/245 unmet, the same set DEBT-06-AUDIT.md reaches on its own. `independent_review` takes SIX states across the ten phases, including 242 = `false` (in no register vocabulary) and 245, which has NO verification file at all while two registers hold a row for it. (2) scripts/agent-bus.sh has NO amend verb (open|list|answer|close|archive) -- my CONTEXT claim would have had a plan call nothing. (3) THREE DEBT-06 artifacts already existed and the discussion never saw them: DEBT-06-REFUSALS.md (operator-ruled 2026-09-14, the refusal FORMAT), DEBT-06-AUDIT.md (the COUNTING RULE: a review without review_type: independent is a code-review pass -- it binds D-08), DEBT-06-BUS-DRAFTS.md. (4) M-7: nothing outside .planning/ reads independent_review, so the register flip is DOCUMENTATION, not an enforced state, and building that gate is forbidden new capability (G-7). PLAN-CHECK found 1 blocker + 2 warnings over 11 checks and the blocker was worth the pass: 254-04 Task 2 could be satisfied by writing a FALSE sentence into DEBT-06 itself -- token presence proved nothing, the project own presence-assertions-cannot-see-content-drift failure. Fixed with an inline fence that RE-DERIVES both sets from the ten files at execution time and set-compares them against two separately-lined clauses; the range token 242-246 is banned because it merges four discharged rows with two unmet ones. THE FENCE FOUND A DEFECT IN ITSELF ON ITS FIRST DRIVE (a greedy grep -o swallowed the second clause) and 3 counterfactuals were driven; I re-drove it against the CURRENT tree and it exits 1 -- it can fail. The derivation stays INLINE and is BARRED from scripts/, because a committed script reading independent_review is the very gate M-7 says must not be built here. OWED/KNOWN: the ROADMAP Goal wants each row reading done or refused and THIS PHASE CAN REACH NEITHER at close -- done needs gemini (cannot be driven from here), refused needs the operator ruling (REG-03); 254-04 asserts a row reading done/refused at this close is a FAILED criterion. SEED-177 matched on a ROADMAP path collision and is routed NOT FOLDED, seed left byte-unchanged. Next action: /gsd:execute-phase 254 (wave 1 is two parallel plans; 254-02 is the long pole). SUPERSEDED: 2026-09-17 -- /gsd:discuss-phase 254 COMPLETE. 254-CONTEXT.md + 254-DISCUSSION-LOG.md written; 11 decisions (D-01..D-11) + 5 measured facts (M-1..M-5). SCOPE: 249-253 only; the older owed arm (238/240/241/242-246, BUS-252..255) stays out. FOUR THINGS MEASURED AT SCOPING THAT CHANGE THE PHASE: (1) the five review asks are ALREADY FILED and unanswered -- BUS-251/250/249/256/257, filed 2026-09-16, behind a 9-item gemini queue, so 254 is not a filing phase; (2) DEBT-06 as worded (REQUIREMENTS.md:185) names 238/240/241/242-246 and NOT ONE phase this milestone built, so reviewing 249-253 ticks none of it -- D-02 amends the text, D-03 records that the amendment widens it to ten phases so 254 closes only its 249-253 arm and DEBT-06 stays UNTICKABLE at this close; (3) 251 is the ONLY one of the five with no review file of any kind AND its verification frontmatter carries NO independent_review key at all -- a sweep counting `independent_review: owed` returns 4 and silently omits it; (4) all five read verification_mode: self-verified, claude-built. COMPLETION IS TIME-BOXED: gemini has until 2026-09-24, then a per-phase WRITTEN REFUSAL drafted by claude and ruled on by the operator (REG-03: claude may not close bus items). Order is risk-ranked 251 -> 253 -> 252 -> 249 -> 250. 251 also gets a claude /gsd:code-review pass as a QUALITY FLOOR, labelled self-assessed -- it ticks nothing. Findings are TRIAGED not fixed (G-7). Verdicts land in the REVIEWED phase dir (<phase>-REVIEW-IND.md / -REVIEW-REFUSAL.md), never over the existing *-REVIEW.md files. Seeds gate 297/297 exit 0 but matched 0 triggers because the phase has no PLAN.md -- MUST re-run at plan time. Next action: /gsd:plan-phase 254. SUPERSEDED: 2026-09-17 -- Phase 254 ADDED to the v4.2 ROADMAP: "Independent review of 249-253", the phase that discharges DEBT-06 instead of carrying it a seventh time. Operator asked for a new phase at the END (254), NOT --insert (which would have produced 253.1, since 254 did not exist to insert after). `gsd-sdk query phase.add` returned correct JSON and wrote its ROADMAP entry into the WRONG SECTION -- a `### Phase 254:` block (wrong heading level) appended after the archived v2.8 <details> block, touching NONE of v4.2 four registers. THIS IS THE SECOND OCCURRENCE IN TWO DAYS; Roadmap Evolution recorded the identical defect for Phase 252 on 2026-09-16. Reverted from a pre-call backup; six ROADMAP registers hand-edited (Phase Table, Phase Checklist, Phase Details, Coverage, Progress, and the closed-phase line 7/7 -> 7/8). STATE.md hand-edited; state.* NOT called. Scope MEASURED at scoping: grep verification_mode across the five *-VERIFICATION.md files returns `self-verified` for ALL of 249, 250, 251, 252, 253, with independent_review owed (reviewer: null on 250; BUS-256 on 252; BUS-257 on 253). Phase dir created: .planning/phases/254-independent-review-of-249-253/. Next action: /gsd:discuss-phase 254. SUPERSEDED: 2026-09-17 -- Phase 253 VERIFIED, gaps_found (bookkeeping only), then CLOSED on code. Sequence worth reading in order, because each register only knew the one below it: 253-01 + 253-02 shipped -> 253-VERIFICATION.md passed 14/14, ZERO gaps -> 253-REVIEW.md found TWO LIVE CRITICALS that verification had missed -> operator locked five findings -> 253-03 (gap-closure round 1) closed them, FF-merged feb3d4752 -> 253-REVIEW-R2.md reviewed THAT round and found TWO MORE BLOCKERS, both the same vacuity defect class the phase exists to kill -> both fast-fixed inline under G-3 (3cedc6e51, 71affadd1), NO round 2 spent, G-7 still 1 of 2. R2-CR-01: the parity gate floor counted migration FILES not tuples PARSED -- DRIVEN, neutering both ACL regexes gave `mirrored: 0/0 ... schema ACL parity OK` EXIT 0; MIN_ACL_TUPLES=100 (real 133) now exits 2. Self-test 29 -> 35 -> 37 arms. R2-CR-02: backend-tests CI has NEVER been green -- 40 of 40 runs failed, psycopg2-binary is in the local venv but NOT requirements.txt, so CI died in COLLECTION and ran zero tests; the two fences this phase added were therefore executed by nothing. Fixed to the extent honestly possible: the job still cannot exit 0 (71-failure baseline), so a DEDICATED must-pass step runs the three scripts/ fences alone -- 26 passed, exit 0 locally. VERIFIER re-drove all 5 ROADMAP success criteria independently against 71affadd1 and they HOLD: greenfield harness exit 0 on a real scratch DB with a CONTROL read proving the refusal is not a false green; SC#3 stripping 3 REVOKEs from full-schema.sql -> exit 1, md5 restored identical; SC#4 literal-aware; backend 71 failed / 4897 passed / 0 collection errors, at the ceiling. The ONE gap was bookkeeping and is CLOSED: R2''s 13 unfixed findings lived only inside the review file -- now SEED-290, each with a re-open trigger. Seeds gate 297/297, 0 duplicates. WR-05 is the one with teeth: E''...'' escape strings defeat BOTH lexers, the same permissive-direction defect as CR-02/CR-03, surviving one syntax over -- latent (zero E'' in the corpus today) and UNFENCED. WR-04 is a FALSE docstring this phase itself added, and it is the stated reason another finding was deferred -- a deferral resting on a refuted premise. OWED: independent_review (DEBT-06 / BUS-257) -- the SIXTH consecutive self-verified close; schema-acl-parity.yml has NEVER executed (gh run list -> HTTP 404, the file is not on master, so --self-test''s only runner has never run); the fixed backend-tests.yml has not run either; the live MultiEdit dispatch needs a session restart to observe. develop is 190 commits unpushed. Next action: /gsd:progress, or push develop so the two CI workflows finally execute. SUPERSEDED: 2026-09-17 -- /gsd:execute-phase 253 wave 3 COMPLETE. 253-03 (gap-closure round 1) executed in a worktree and FF-merged to develop at feb3d4752; worktree torn down with teardown-worktree.sh, both junctions detached first, venv + node_modules asserted intact. All five locked findings closed: CR-01 (the ACL parity gate now READS supabase/full-schema.sql -- DRIVEN INDEPENDENTLY BY THE ORCHESTRATOR ON THE MERGED TREE: 3 resize_embedding_column REVOKE lines stripped -> gate exit 1, where the reviewer measured exit 0; restore md5-identical a4f570396a44035102567ec1e3b7ff62), CR-02 (literal-aware lexer ported into check-greenfield-privileges.py), WR-02 (TWO independent causes, not one -- the hook path extraction b6dce5010 AND the settings.json matcher 566978a57, operator-approved 2026-09-17; fixing either alone is inert in a live session), WR-06 (no-DB half closed; DB half residue written down with a re-open trigger), WR-08 (CI path filter). Gates re-run ON THE MERGED TREE: ACL parity exit 0, 133/133, tail 653 lines md5 da9c5616; self-test 35/35 arms (was 29); G-7 clear, rounds completed 1 of 2; claude-md size 104,782 chars 69.9%; seeds 296/296, 3 fired all routed not folded; backend 71 failed / 4897 passed / 2 xfailed / 2 xpassed / 0 collection errors -- 71 unique node-ids across the SAME 24 files 253-02 published, +19 passed fully accounted (14 lexer + 5 CI-path). NEW FINDING: .claude/settings.json measures 9/4/202, FIRES G-5 at 4 phases, and was in NEITHER register for its entire life -- .claude/ is EXEMPT from check-hot-file-ledger.cjs, so no gate could ever have demanded it. That is the FOURTH file this one plan found structurally invisible to its own guardrail. Advisory round-1 code review written to 253-REVIEW-R2.md, deliberately NOT 253-REVIEW.md -- the latter is round 1 gap source and the workflow step as written would have clobbered it. OWED: independent_review (DEBT-06 / BUS-257, sixth consecutive self-verified close); the two GitHub jobs have never executed; the live MultiEdit dispatch needs a session restart to observe. Next action: /gsd:verify-work 253. SUPERSEDED: 2026-09-17 -- /gsd:code-review 253 then /gsd:plan-phase 253 --gaps. REVIEW: issues_found, 2 critical / 11 warning / 5 info over 10 files, standard depth (cfe73e289). CR-01: the ACL parity gate never opens supabase/full-schema.sql -- the artifact it protects -- DRIVEN (ACL stripped from that file, gate printed OK exit 0). CR-02: check-greenfield-privileges.py _strip_sql_comments uses line.find("--"), so a REVOKE after a --bearing literal is invisible -> false GREEN in the PERMISSIVE direction. Operator locked the gap scope to five findings: CR-01, CR-02, WR-02 (hook matcher Write|Edit, MultiEdit fires nothing), WR-06 (greenfield harness invoked by nothing), WR-08 (backend-tests.yml paths miss the supplement). PLANNED: one plan 253-03-PLAN.md (cc28c98f6), wave 3, depends_on 253-02, gap_closure_round 1, autonomous FALSE (Task 3 edits .claude/settings.json). G-7 clear -- rounds completed 1, cap 2. plan-checker VERIFICATION PASSED, 0 blockers, every interface claim re-derived against the live files. ROADMAP SC#3 and SC#4 are the two the review showed unmet against the phase goal. Next action: /gsd:execute-phase 253 (wave 3). SUPERSEDED: 2026-09-17 -- /gsd:execute-phase 253 complete. Both plans executed in worktrees and merged to develop (253-01 at a56d6fea1, 253-02 at e7200477d). All gates re-run ON THE MERGED TREE: greenfield harness exit 0, ACL parity 133/133 exit 0, self-test 29/29, CLAUDE.md size gate 104,538 chars, backend baseline 71 failed / 0 collection errors, D-11 md5 pair identical. Verification PASSED 14/14, 5/5 success criteria, 0 gaps, status human_needed (the CI job has never executed -- it cannot be driven locally). Next action: /gsd:code-review 253 to discharge BUS-257. SUPERSEDED: /gsd:plan-phase 253 complete. 253-01 + 253-02 PLAN.md written (a843be9cd), SERIAL (wave 1 -> wave 2), plan-checker VERIFICATION PASSED (0 blockers). REG-02 sweep RAN for the first time (296/296, 3 seeds, 1 folded 2 false positives). BUS-257 filed to gemini AT PLAN TIME per D-21. Next action: /gsd:execute-phase 253.'
# ⚠ RECONCILED 2026-09-16 (251-04). Wave 1 flagged this block as internally inconsistent and
#   Waves 2 and 3 carried the finding forward unfixed. The values it held were:
#     total_phases: 12 · completed_phases: 1 · total_plans: 19 · completed_plans: 9 · percent: 8
#   ⛔ EVERY ONE OF THOSE FIVE WAS WRONG, and they were wrong in DIFFERENT ways, which is why
#   no single "off by one" reading explains them. v4.2 has FIVE phases (247-251), not 12 — the 12
#   is inherited from an earlier milestone and was never reset. `completed_phases: 1` stood while
#   FOUR phases carried a `*-VERIFICATION.md` on disk. And `percent: 8` agreed with neither its own
#   numerator (1/12 = 8%) nor the ROADMAP, which read `4 / 5` at the same moment.
#   ⭐ Re-derived from the phase directories, never from a summary line — the same rule the
#   ROADMAP Progress table states about itself and had also stopped obeying.
progress:
  total_phases: 8
  completed_phases: 7
  total_plans: 31
  completed_plans: 31
  percent: 88
# UPDATED 2026-09-17 at Phase 254 EXECUTION COMPLETE (254-04, wave 3): total_plans 27 -> 31 and
#   completed_plans 27 -> 31. Phase 254 has FOUR plans and all four are executed, and NEITHER count
#   had ever been moved for them -- the Phase 254 ADD note below says so in its own words ("254 has no
#   plans yet"), and no plan-time edit corrected it afterwards. So this is +4 to BOTH, not +4 to one.
#   completed_phases and percent are HELD at 7 / 8 and 88 -- 254 is EXECUTED, not VERIFIED, and this
#   file has been wrong before precisely by counting EXECUTED as VERIFIED. /gsd:verify-work 254 moves
#   them, never a plan. ⛔ Hand-edited. state.* was NOT called.
# UPDATED 2026-09-17 at Phase 254 ADD: total_phases 7 -> 8, percent 100 -> 88. completed_phases and
#   BOTH plan counts are UNCHANGED -- 254 has no plans yet, and adding a phase moves the DENOMINATOR
#   only. percent drops 100 -> 88 and that is the number MOVING IN THE HONEST DIRECTION, the same way
#   it did when 253 was added. The gsd-sdk `phase.add` verb wrote its ROADMAP entry into the archived
#   milestone block at the bottom of the file (second occurrence in two days) and was reverted; all
#   six ROADMAP registers were hand-edited. ⛔ Hand-edited. state.* was NOT called.
# ✅ UPDATED 2026-09-17 at Phase 253 GAP-CLOSURE EXECUTION: completed_plans 26 -> 27 (253-03 merged
#   at feb3d4752). total_plans and percent UNCHANGED -- 253 was already counted in total_phases.
#   ⛔ Hand-edited. state.* was NOT called.
# ✅ UPDATED 2026-09-17 at Phase 253 GAP-CLOSURE PLANNING: total_plans 26 -> 27 (253-03,
#   round 1, from 253-REVIEW.md CR-01/CR-02/WR-02/WR-06/WR-08). completed_plans and percent are
#   UNCHANGED -- planning is not execution. ⛔ Hand-edited. state.* was NOT called.
# ✅ UPDATED 2026-09-16 at Phase 253 PLANNING: total_plans 24 -> 26 (253 has two plans, D-20).
#   completed_plans and percent are UNCHANGED -- planning is not execution, and percent tracks
#   completed_phases/total_phases (6/7), never plans. ⛔ Hand-edited. state.* was NOT called.
# ⚠ MOVED 2026-09-16 (milestone audit). It read `5 / 5 · 100%` and that was TRUE of the phases
#   as they existed. `.planning/v4.2-MILESTONE-AUDIT.md` closed `gaps_found` — 4 blockers,
#   9 warnings, flows 1/3, integration 16/22 — and added **Phase 252** to close them, so the
#   denominator is 6. ⛔ The five closed phases are NOT reopened; 252 is a new sixth phase.
# ✅ UPDATED 2026-09-16 at Phase 252 close: 6 / 6 phases, 24 / 24 plans, 100%.
#   ⚠ total_plans moved 19 -> 24, which is 252 own five -- not a re-count of the others.
#   ⛔ 100% is a statement about PLANS EXECUTED, never about the milestone being closeable:
#   DEBT-06 is the one requirement outstanding, BUS-246/247/248 are owed operator rulings,
#   and 252 itself closed self-verified with independent_review: owed (BUS-256).
# ✅ UPDATED 2026-09-16 at Phase 253 discuss: total_phases 6 -> 7. 253 is the code-review phase
#   added from 252-REVIEW.md CR-01/02/03/08; completed_phases and the plan counts are UNCHANGED
#   because 253 has no plans yet. ⛔ percent drops 100 -> 86 and that is the number MOVING IN THE
#   HONEST DIRECTION -- 100% was only ever a statement about plans executed.
# ⚠ THE state.* SDK VERBS CORRUPTED THIS FILE AGAIN, 2026-09-16, and the banner above predicted it.
#   `state.record-session` returned `recorded: false` ("No session fields found") and then the
#   `commit` verb rewrote the file anyway (57093cea7): last_activity reverted to 2026-09-15,
#   progress reset to 14/3/24/15/21, and the RECONCILED comment block was DELETED. Restored from
#   57093cea7^ and hand-edited. ⛔ Hand-edit. Do not call state.* -- this is the sixth occurrence.
# UPDATED 2026-09-17 at Phase 253 EXECUTION: completed_plans 24 -> 26 (both 253 plans executed
#   and merged). completed_phases and percent were held at 6 / 7 until verification ran, because
#   this file has been wrong before precisely by counting EXECUTED as VERIFIED.
# UPDATED 2026-09-17 at Phase 253 VERIFICATION: completed_phases 6 -> 7, percent 86 -> 100.
#   253-VERIFICATION.md: 14 / 14 must-haves, 5 / 5 ROADMAP success criteria, 0 gaps, G-7 clear.
#   The verifier RE-MEASURED rather than read -- it re-ran the greenfield harness end to end, drove
#   the partial-revoke and comment-swallow REDs itself, drove the TABLE half RED beyond the SUMMARY,
#   drove the hook in an ISOLATED CLAUDE_PROJECT_DIR, and re-derived 7 of the 12 ledger triples.
#   100% IS A STATEMENT ABOUT PHASES VERIFIED AND NOTHING ELSE. Two items are owed and named:
#     (1) the schema-acl-parity CI JOB HAS NEVER EXECUTED -- confirm on the next push touching a
#         matching path; it cannot be driven from a local worktree. The local hook (the PRIMARY
#         half under CLAUDE.md's two-guards rule) WAS driven, twice, independently.
#     (2) independent_review: owed -- DEBT-06 / BUS-257, the FIFTH consecutive self-verified phase
#         (249-253), while Gemini is back and OV-SOLO-01 is re-armed. Phase 253's own ROADMAP flag
#         reads: this one gets a reviewer, or it says in writing why not.
# THE state.* CORRUPTION FIRED A SEVENTH TIME, 2026-09-16, inside plan 253-01's worktree commit
#   (a37cc673d). Frontmatter came back as 14 / 3 / 26 / 17 / 21 and the RECONCILED comment block
#   was DELETED WHOLESALE -- the same signature as occurrence six (57093cea7), which the banner
#   above had already predicted in writing. Restored from 09f4cfbe5 by the orchestrator, which is
#   the single writer for this file per execute-phase's worktree contract. The BODY paragraph that
#   plan 253-01 added is KEPT; only the frontmatter was reverted. Hand-edit. Do not call state.*.
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
Phases **247+**. Phases 247, 248, **249** and **250** closed. Requirements: `.planning/REQUIREMENTS.md`. ⚠ Phase 250's CODE REVIEW round closed on 2026-09-15 (9 of 9 Critical+Warning fixed, 4 of 5 Info; see `250-REVIEW.md` → *Resolution log*) and left **`BUG-260915-01` filed but NOT fixed** — open todos read `Not ticked` on a LIVE run after a plain thread open, because nothing reconciles on thread-switch. Its fix is a trigger change in `StreamsProvider.tsx` (G-5 FIRING), so it is a PHASE, not a closure round. ⭐ **Phase 251 (Register Integrity) is CLOSED 2026-09-16 and v4.2 is complete on code — all five phases.** ⚠ **SUPERSEDED THE SAME DAY, and the original is kept rather than overwritten because its claim was reasonable and wrong.** It read *"Next action: `/gsd:complete-milestone`, after the operator rules on `251-BUS-TRIAGE.md`."* **`/gsd:audit-milestone 4.2` ran first and closed `gaps_found`** — 4 blockers, 9 warnings, `flows 1/3`, `integration 16/22` — moving **`CRED-01`, `CRED-03`, `WATCH-04` and `HONEST-03`** from ✅ satisfied to ⛔ unsatisfied. ⭐ *"Complete on code"* was true of every phase read on its own terms and false of the five read together. **Next action: `/gsd:discuss-phase 252`** (`.planning/v4.2-MILESTONE-AUDIT.md` §8 is its scope). The operator's ruling on `251-BUS-TRIAGE.md` — `BUS-246` / `BUS-247` / `BUS-248` — is still owed and does not block 252. ⛔ **`BUG-260915-01`'s stated mechanism is measurably FALSE** — `setViewingThread` already fires `reconcile` (`StreamsProvider.tsx:1936-1942`), so the sentence above about *"nothing reconciles on thread-switch"* is wrong and its fix candidate #1 would ship a no-op; correct the report before building. ⚠ **Both of Phase 250's live examples were closed by 251-04**: `REQUIREMENTS.md`'s `WATCH 0/8` and `CRED 0/4` are now ticked against a named artifact each (25 of 26; `DEBT-06` left unticked **with its reason**), and the register is swept by something executable that is now CALLED at `/gsd:discuss-phase` and `/gsd:new-milestone`. ⛔ **`DEBT-06` is the one requirement outstanding and it is a real gap, not bookkeeping** — 238/240/241 plus 249 and 250 all carry `independent_review: owed`, and `BUS-247` records a self-verified close that shipped two blockers with every gate green.

⭐ **PHASE 252 IS CLOSED — 2026-09-16, 5 / 5 success criteria, 21 commits, `252-VERIFICATION.md`.** The paragraph above is kept verbatim rather than rewritten, because two of its sentences were REFUTED by the phase they pointed at. ⛔ **It said `BUG-260915-01`'s fix is "a trigger change in `StreamsProvider.tsx`" — measured false**: `setViewingThread` already fires `reconcile` (`:1936-1942`), so candidate #1 was already shipped and building it would have been a no-op. The real hole was that `reconcile` set no loading signal at all, plus a **global** in-flight lock; the report is corrected and the fix is per-thread. ⛔ **And "v4.2 is complete on code" was true of every phase read alone and false of the five read together** — which is the finding the audit made and 252 discharged. ⭐ **252 refuted SEVEN inherited claims, three of them in its own planning documents**, including a B-2 test probe that was a **FALSE GREEN**: `logging_sink.py` redacts the `sk-` shape before `caplog` sees it, so the leak assertion passed *before* the fix. ⭐ Its new `check-schema-acl-parity.cjs` fired for real on run one and found `resize_embedding_column` — the RPC `BUG-260911-01` found callable unauthenticated in production, which NULLs every vector — unmirrored, so **every greenfield deploy re-opened it**. ⛔ **`DEBT-06` is NOT ticked by 252**, which the ROADMAP itself called a `DEBT-06` row: it closed `self-verified` with `independent_review: owed`, and the request is posted at **`BUS-256`**. **Next action: `/gsd:code-review 252`**, then `/gsd:complete-milestone` once the operator rules on `BUS-246` / `BUS-247` / `BUS-248`. ⛔ Still owed and named rather than omitted: the live **G-4 S2** row, migration **181 not applied to cloud** (`CRED-04`'s `get_advisors(security)` at promotion confirms it), and `connectors.py`'s extraction at its **seventh** landing.

⭐ **`/gsd:code-review 252` RAN 2026-09-16 — `252-REVIEW.md` (`86bed4d09`), 14 findings: 2 critical, 9 warning, 3 info.** The paragraph above is kept rather than rewritten. ⛔ **Its `Next action: /gsd:code-review 252` is DISCHARGED, and the review did not come back clean.** ⚠ **Both criticals were re-verified by the orchestrator by hand rather than relayed, and both hold.** **CR-01** — `grep -c connector_tokens scripts/full-schema-supplement.sql` → **0**, while `129:85` and `151:90` both carry `REVOKE ALL ON TABLE public.connector_tokens FROM anon, authenticated`; in `full-schema.sql` the table appears 27 times, **all `COMMENT ON`, zero `GRANT`/`REVOKE`** — so a **greenfield** deploy is born with the OAuth ciphertext readable by any org member. The supplement's `connector_connections` column grant is also **five columns behind** `_TABLE_SELECTABLE_KEYS` (16 vs 19 — `auth_type`, `status`, `error_message`, `default_approval_posture`, `default_ingest_visibility`), so every connector list read is `42501` on a fresh DB. ⭐ **Local and production are unaffected — they were built by replaying migrations.** **CR-02** — the parity gate 252 shipped **cannot fail on a partial revoke**: deleting one `REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM PUBLIC;` line left the shipped `analyse()` printing `missing: 0 []`. ⛔ **CR-01 PRE-DATES 252 and is not its regression** — what 252 added is a §6 header claiming *"table OR function"* over a gate enforcing only functions. **Phase 253 is added to the ROADMAP for CR-01/CR-02/CR-03/CR-08** (`2c737c205`); G-7 was checked and is **clear** (252 ran zero gap-closure plans), so this is a phase, not a round. The nine behavioural findings (CR-04..07, CR-09..11) are **G-3 `/gsd:fast` sized** and are deliberately NOT in 253. **Next action: rule on `BUS-246` / `BUS-247` / `BUS-248`, then `/gsd:discuss-phase 253`.** ⛔ `/gsd:complete-milestone` is still blocked on those three rulings and on `DEBT-06`.

⭐ **`/gsd:discuss-phase 253` COMPLETE — 2026-09-16, `253-CONTEXT.md` + `253-DISCUSSION-LOG.md` (`bb31214f1`).** 23 decisions across four areas, every option preserved in the log. ⛔ **Its `Next action: /gsd:discuss-phase 253` above is DISCHARGED; the `BUS-246`/`247`/`248` rulings are separately recorded as ruled and do not block 253.** ⭐ **The discussion MEASURED the blast radius rather than inheriting CR-01's, and it is WIDER than the review states**: only **7** tables carry table/column ACL statements across every migration (25 statements), and **six of the seven are mirrored in NEITHER bootstrap artifact** — `connector_tokens`, `connector_watches`, `connector_watch_items`, `connector_sync_runs`, `user_settings`, `app_settings`. ⛔ **The last two are the exact tables `BUG-260911-01` found in production with RLS disabled and `anon` holding all privileges.** All seven are mirrored, no exception list (D-16). ⭐ **SC#1's "as `authenticated`" arm gets a real database**: `scripts/check-greenfield-privileges.py` builds a scratch DB on the running local Postgres via asyncpg (never `supabase db reset`), replays the stock preamble **derived at runtime from `pg_default_acl`** — measured pristine, since **no migration anywhere runs `ALTER DEFAULT PRIVILEGES`** — and asserts as `authenticated`. ⚠ A harness that omits that preamble is a **FALSE GREEN** and is named in D-03 so it is rejected deliberately. ⛔ **Two plans, SERIAL** (D-20) — worktree rule 4 binds: the harness mutates the shared local cluster. ⛔ **`DEBT-06`: the gemini review item is filed AT PLAN TIME, not at close** (D-21) — gemini already holds 8 open items filed today, and a close-time item would be ninth in line and this would be the **fifth** consecutive `self-verified` close. ⚠ **REG-02's sweep could NOT run at discuss time** — `check-seeds-register.cjs --phase 253` exits `FATAL: no phase directory matches` because it matches against `files_modified` in PLAN.md files that do not exist yet; **it must be re-run at `/gsd:plan-phase 253`.** A manual grep was done instead and folded `SEED-266` arm (a). **Next action: `/gsd:plan-phase 253`.**

⭐ **`/gsd:plan-phase 253` COMPLETE — 2026-09-16, `253-01-PLAN.md` + `253-02-PLAN.md` (`a843be9cd`).** ⛔ **Its `Next action: /gsd:plan-phase 253` above is DISCHARGED.** **Two plans, SERIAL** (`wave 1` → `wave 2`, `depends_on: [253-01]`) exactly as D-20 locks — the ROADMAP's older *"target 3"* is superseded and the plan says so rather than silently following it. `gsd-plan-checker`: **VERIFICATION PASSED, 0 blockers**, all five ROADMAP success criteria traced to a named task, every codebase claim re-run rather than relayed. ⚠ **RESEARCH WAS SKIPPED** — an operator choice, recorded because a skipped step must never read as a completed one; `253-PATTERNS.md` (7/7 analogs) carried the pass instead.

⛔ **THE PATTERN PASS REFUTED THREE CONTEXT.md CLAIMS, and all three were re-verified by the orchestrator by hand rather than relayed.** ⭐ **The consequential one: NOTHING INVOKES `scripts/check-schema-acl-parity.cjs`.** `grep -rln "check-schema-acl-parity"` over the whole repository returns **15 hits and ZERO executable invokers** — no hook, no CI job, no npm script; every non-gate hit is a planning doc or a comment. **That falsifies D-07's *"one hook entry"* and D-18's *"`--self-test`, which already runs wherever the gate runs"***, both written as though the gate were wired. **The gate 252 shipped to prove the bootstrap artifact is honest has only ever run when a human typed it**, so its four new RED arms would have been a file, not a guard. `253-02` Task 3 now wires it as **both** a CI workflow and a registered PostToolUse hook, and the hook half is **DRIVEN** against a real planted defect with an md5-verified restore. ⭐ **Second:** `full-schema.sql`'s last **433** lines are byte-identical to the supplement (`6a58a47651156ef6dccdf75b93365e66`, both) — the tail is a `cat`, so D-11's same-commit rule is satisfiable by replacing that region and re-asserting the md5, **without** `regenerate-full-schema.sh` (which hard-exits without Docker, denied to the executor). ⭐ **Third:** `scripts/check-hot-file-ledger.cjs` **cannot see a single file this phase touches** — `WATCHED = [/^backend\/app\//, /^frontend\/src\//]` at `:67`. It printed `scan list: 281 rows · subject: 12 files · watched: 0 · ledger gate OK`. ⛔ **That green is the FINDING, not the clearance**, and it is the structural cause of CR-08's *"no ledger row for its entire life"* — the ledger's author was never careless, the gate was blind by construction. D-23 is planned as a MANUAL task carrying its own re-derived evidence and is explicitly forbidden from citing the gate as proof.

⚠ **A FOURTH MEASUREMENT CORRECTS THE DISCUSSION'S OWN BLAST RADIUS, and the original is kept above rather than overwritten.** The paragraph above says *"7 tables, 25 statements"*. Re-derived mechanically and confirmed independently by the plan-checker: **32** `GRANT`/`REVOKE` statements (excluding `EXECUTE ON FUNCTION`) across **12** migration files — `118 126 127 128 129 150 151 156 168 169 172 177` — and **`126`, `127` and `150` are named NOWHERE in `253-CONTEXT.md`**, each carrying a `connector_connections` column grant. **The seven distinct tables DO reproduce**; it is the statement count and the file list that were under-counted. D-05's *no exception list* puts all three in scope, and both plans re-derive the set rather than typing either figure. ⚠ **And D-17's *"15 → 19"* would have made the D-08 fence permanently RED**: the migration union is **20**, because `118:115` grants `created_by`, which is not a response key at all. The fence is specified as three assertions with the reverse difference pinned **by name**, so it cannot be loosened away on day one.

⭐ **REG-02's SWEEP RAN — the loop the CONTEXT left open is CLOSED.** `node scripts/check-seeds-register.cjs --phase 253` could not run at discuss time (no PLAN.md files to read `files_modified` from); with the plans on disk it reads **`296/296 parsed · 0 duplicate ids · gate OK`** and fires **three** seeds, one more than the manual grep found. `SEED-266` **folded** (arm (a); `253-02` Task 4F appends the `status_note`, status and `partial: true` untouched). `SEED-188` and `SEED-284` are **NOT folded — false positives**, routed in writing in `253-CONTEXT.md` rather than left silent. ⚠ The sweep also reported *"the phase declares NO surfaces"*, so it was **path-only** — recorded, never passed off as a clean sweep.

⛔ **THE GSD DECISION-COVERAGE GATE IS VACUOUS, AND IT HAS NEVER FIRED IN THIS MILESTONE.** §13a is the **blocking** translation gate whose whole job is to refuse to mark a phase planned when a discuss-phase decision was dropped. It returned `passed: true`. ⭐ **Measured, not assumed:** `.claude/get-shit-done/bin/lib/decisions.cjs:35` requires `- **D-01:** text` — colon and bold-close *before* the body — while every CONTEXT.md in this milestone writes `- **D-01: text**`, colon *inside* the bold. Blast radius, measured across phases **247-253**: gate-visible decisions **0, 0, 0, 0, 0, 0, 0** against actual counts including **20** (251), **46** (252) and **23** (253). ⚠ **The planner's own diagnosis of this was WRONG** (*"it looks for a literal `CONTEXT.md`"*) — given the explicit path it parses the file fine and extracts zero. **All 23 decisions D-01..D-23 were instead verified covered by a literal-token grep**, which is the actual evidence for this phase. This is the fourth vacuous guard this project has measured; it wants a seed, and it is NOT 253's scope.

⭐ **`DEBT-06`: `BUS-257` IS FILED, AT PLAN TIME, per D-21** — not at close, because gemini already held 8 items filed the same day and a ninth would have made this the **fifth** consecutive `self-verified` close (249, 250, 251, 252). ⚠ **Phase 253 is CRITICAL under `AGENTS.md` §3.1**, hitting three of five tests — #1 credentials (`connector_tokens` holds OAuth ciphertext), #3 the permission model, #5 can fail open — so **the seats SWAP: Claude builds, gemini reviews**, and Claude running `/gsd:discuss-phase 253` was correct rather than a separation breach. ⛔ **`DEBT-06`'s structural half stays unmet regardless**: `grep -rln "independent_review" scripts/ .claude/hooks/` still returns nothing, so the field its close condition is written against has no gate behind it.

⚠ **Owed and named rather than omitted:** `253-02` Task 3D edits `.claude/settings.json` to register the hook — **additive-only**, with a `JSON.parse` re-validation and the `git diff` pasted into the SUMMARY, but it is an operator config file and the executor will need approval. **Next action: `/gsd:execute-phase 253`** (wave 1 first; `/clear` first — fresh context window).

⭐ **AND THE SESSION THAT RAN THAT REVIEW FOUND TWO MORE, BOTH OPERATOR-DIRECTED AND BOTH ABOUT LOCAL MODELS.** `SEED-289` + `BUG-260916-01`, planted 2026-09-16. ⛔ **They are ONE story and belong in ONE phase: the app substitutes a GUESS for the operator's own configuration, on the same model set, twice.** (1) **`SEED-289` — tools OFF by default on a guess.** Measured through the shipped `_tools_lost_model_ids`: **15 of 94 configured models** run with native tool calling off, and **13 of them only because nothing has a registry row**, so `config.py:594` infers False from the provider. ⭐ **The operator's direction is *default ON unless we can know otherwise*, and we CAN know** — OpenRouter's `supported_parameters` is **already parsed** by `_extract_caps_openrouter` and simply never reaches the resolver; Ollama's `/api/show` returns `capabilities:["tools"]`; LM Studio's `/api/v0/models` returns `capabilities.trained_for_tool_use`. ⭐ **And `custom` is not a fourth server — it is Ollama or LM Studio behind a tunnel**, so the probe is by SHAPE and **no guessing tier remains**. ⛔ ON-by-default is safe ONLY with the third part: Ollama refuses with a specific catchable **400 `does not support tools`**, so catch it, retry once without tools, and write `native_tools=false` onto the row — asked once, never again. ⛔ The probe must NOT widen `PROVIDER_ENDPOINTS`; that is the SSRF allowlist and self-hosted providers are absent from it on purpose. (2) **`BUG-260916-01` — a timeout above 600s is accepted and cannot take effect.** `get_llm_client` (`openai_service.py:1251`) passes **no `timeout=` and no `max_retries=`**, so `openai==2.28.0`'s `DEFAULT_TIMEOUT(read=600)` and `DEFAULT_MAX_RETRIES=2` bind while admin accepts **`[1, 3600]`**. ⭐ **The operator had already hit it and worked around it** — three of their six LM Studio rows read **900** and get **600**; the other 13 local models have no row and run on the **300s** inferred default. ⚠ **`BUS-246` carried this as `SEED-172` #2 and blamed httpx — httpx's own default is 5s, the 600 is the SDK's.** A number right for a wrong reason stayed open either way. ⛔ **Neither is in Phase 253's scope** (253 is the schema-ACL gap and nothing else); both are sized as ONE phase after it.

⭐ **`253-01` IS EXECUTED — 2026-09-16, `253-01-SUMMARY.md`, 4 commits (`10002454c`, `3192f480f`, `c73463658`, `95e9a1314`) off base `09f4cfbe5`.** ⛔ **Its `Next action: /gsd:plan-phase 253` above is DISCHARGED; `253-02` (wave 2) is next and is BLOCKED ON NOTHING but this.** ⭐ **CR-01 IS CONFIRMED LIVE AND CLOSED, measured as `authenticated` on a real scratch database rather than argued from text:** `SELECT access_token_ciphertext FROM public.connector_tokens` **SUCCEEDED** before the mirror and answers `permission denied` after; `has_table_privilege('anon', 'public.app_settings'|'public.user_settings', 'SELECT')` read **True → False** — `BUG-260911-01`'s exact pair, re-opened by every greenfield deploy; **1045 derived violations → 0**. All seven ACL-bearing tables mirrored with no exception list; §5 is **20** columns, not D-17's 19 (`created_by` is granted by 118 and is NOT a response key — MC-3), pinned by a 7-case no-database pytest that was RED-driven against four planted defects with an md5-verified restore. ⛔ **THE HARNESS'S FIRST RUN FOUND A DEFECT NOBODY WAS LOOKING FOR, AND IT IS BIGGER THAN THE ONE THE PHASE WAS SCOPED FOR: `supabase/full-schema.sql` DID NOT APPLY AT ALL.** `type "vector" does not exist` (42704) — `pg_dump` emits `set_config('search_path','',false)` at `:29`, that is a SESSION setting, and §6's `ON FUNCTION public.match_document_chunks(vector, uuid, …)` is unqualified, so the **entire greenfield paste rolls back**. Introduced at `a7efe17d1` (**Phase 252-01, the same day**) and unappliable end-to-end until `3192f480f`. ⭐ **The fix is a §0 `SET search_path = public;` and deliberately NOT a `public.vector` qualification** — qualifying changes the signature TEXT `check-schema-acl-parity.cjs` compares against the migrations, so a correct artifact would have turned that gate red. ⚠ **MC-2 re-derived and the CONTEXT's figure does not reproduce: 32 statements across TWELVE files** (`118·126·127·128·129·150·151·156·168·169·172·177`), not 25 — and `126`, `127`, `150` were named in no register. ⚠ **MC-4 confirmed by measurement: `node scripts/check-hot-file-ledger.cjs 253` prints `subject: 12 files · watched: 0 · ledger gate OK`** — the gate is blind to every file this plan touched and **must not be cited**; D-23 stays MANUAL on `253-02`. ⚠ **Two acceptance criteria were NOT met and are named rather than quietly satisfied**: Task 2's *"supplement md5 still reads `6a58a476…`"* and *"`git status` clean after Task 2"* — both were impossible once the artifact turned out to be unappliable, and the property the RED actually rests on (`grep -c connector_tokens` → **0**) was asserted instead. Backend ceiling **71 failed / 0 collection errors**, intact, failing SET published (24 files, none touched here); `check-schema-acl-parity.cjs` still exits 0 (16/16). ⛔ `independent_review: owed` — **DEBT-06**, `BUS-257`. ⚠ `total_plans: 26` in the frontmatter above was **left alone rather than guessed**: it is not reconcilable with the per-phase rows and inventing a number here is exactly the false record this file's reset banner warns about.

⭐ **`253-02` IS EXECUTED — 2026-09-17, `253-02-SUMMARY.md`, 4 commits (`b9067a904`, `8790c4119`, `22972ca6e`, `4df90a080`) off base `a56d6fea1`; merged to `develop` at `e7200477d`. PHASE 253 IS EXECUTED, NOT VERIFIED — `/gsd:verify-work 253` is the next action.** ⭐ **CR-02 AND CR-03 ARE CLOSED, and the gate's REACH is the number that matters: it saw `16/16` function tuples and now sees `133/133` — 61 function + **72 table/column** tuples derived from 32 statements across 12 migrations, where the shipped `aclsIn()` returned **zero** table entries.** The RED was reproduced on this machine BEFORE the fix, not argued: deleting the single line `REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM PUBLIC;` from a copy of the supplement still printed `function ACLs found: 16 · mirrored: 16`, `missing: 0`, **exit 0** — and that function is the RPC `BUG-260911-01` found callable unauthenticated in production, which NULLs every vector in `document_chunks` and `skill_embeddings`. CR-03 is the same failure one layer down and was shown live: the shipped `statements()` collapses migration 180's **three** `COMMENT ON COLUMN` statements into **one** chunk, so an ACL after a double-dash inside a string literal is invisible. ⚠ **THE ARMS WERE THEMSELVES FALSIFIED, AND ONE WAS VACUOUS** — three defects planted in scratchpad COPIES (gate md5 identical before/after) made 3, 5 and 4 arms fail respectively; the **dollar-quote arm PASSED against its own planted defect** and was replaced with a false-positive control that does fail when the lexer is reverted. `--self-test` closes **29/29**. ⭐ **MC-4 IS CLOSED — the gate is invoked by something other than a human typing it:** `grep` for it across `.github/` and `.claude/` read **0** before and reads **8** now, and the PostToolUse hook was driven loud-vs-silent **with the defect still planted**, so its negatives (`frontend/src/App.tsx`, `supabase/seed.sql`) prove the path filter rather than a clean tree. ⛔ **The CI workflow was NOT driven from here** — the YAML parses and both command strings reproduce locally, and the SUMMARY says plainly that the local hook is the driven half. ⚠ **D-07 WAS NOT IMPLEMENTED AS LITERALLY WORDED, and it is named rather than quietly satisfied:** per-column-SET tuples were **measured** to raise **7 false reds** against a correct supplement — the migrations are a history and the supplement a final state — with **zero** genuinely absent columns behind any of them, so keys are per-COLUMN, which is strictly more sensitive. ⚠ **SC#5 produced two FINDINGS, not bookkeeping:** `sourceHealthVocabulary.ts` had predicted its own firing in writing and **252-03 was that touch**, which neither register dispositioned (wrong by two phases); `WatchedFoldersSection.tsx` **changed state** — its row read `no (3 phases)` and it now FIRES at 4. The two registers disagreed with each other on four files. ⚠ **The first drive of the CLAUDE.md ledger gate was a BADLY-PLACED PLANT** (rows appended outside the table's contiguous run, so all three defects "passed"); re-planted inside, **284 rows parsed** and all three fire exit 1, ledger restored md5-identical. Gates on the merged tree: greenfield harness **exit 0** (independently proving `full-schema.sql` still applies end to end), ACL parity **133/133 exit 0**, CLAUDE.md **104,538 chars**, backend **71 failed / 0 collection errors** with a failing SET byte-identical to 253-01's, D-11 md5 pair identical. ⛔ `independent_review: owed` — **DEBT-06**, `BUS-257`; `grep -rln "independent_review" scripts/ .claude/hooks/` returns nothing, so DEBT-06's **structural** half is unmet regardless, and this is the fifth consecutive phase closing self-verified. ⚠ **STATE.md's frontmatter was CORRUPTED A SEVENTH TIME inside `253-01`'s worktree commit** and restored by the orchestrator — see the banner in the frontmatter above.

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

⭐ **PHASE 254 ADDED 2026-09-17 — `Independent review of 249-253`, by operator instruction.** Everything
below in this section is preserved rather than rewritten. **Current phase: 254. Next recommended run:
`/gsd:discuss-phase 254`** (or `/gsd:plan-phase 254` if the scope needs no discussion — it is a review
phase, not a build phase). ⛔ **The reviewer must be the agent that did NOT build**: claude built all
five, so a claude-run review discharges `DEBT-06` for none of them. Gemini is back and `OV-SOLO-01` is
re-armed. ⛔ **`/code-review ultra` stays ruled out on cost**; the normal `/gsd:code-review <phase>` is
the instrument. ⚠ **`independent_review` is `owed` on all five, measured not read** — `grep
verification_mode` across `249`..`253`'s `*-VERIFICATION.md` returns `self-verified` five times.
⚠ Phase **253 has no Phase Checklist row in the ROADMAP at all** (247-252 do) — noticed while adding
254's, left UNFIXED and recorded here rather than silently repaired, because a register correction made
in passing is how the 248 `[ ]` drift survived an audit.

⭐ **CONTEXT CAPTURED 2026-09-17 — `254-CONTEXT.md` + `254-DISCUSSION-LOG.md`.** **Next action:
`/gsd:plan-phase 254`.** ⛔ **The phase is NOT about filing review requests — they are already filed
and unanswered** (`BUS-251`/`250`/`249`/`256`/`257`, 2026-09-16, behind a 9-item gemini queue). What
254 owns is the **completion condition**: a 2026-09-24 deadline, after which each unanswered phase
closes with a **written refusal** drafted by claude and ruled on by the operator. ⚠ **`DEBT-06` as
worded names 238/240/241/242-246 — not one phase this milestone built** — so `D-02` amends its text
and `D-03` records the consequence: the amended requirement covers ten phases, 254 closes only the
249-253 arm, and **`DEBT-06` is not tickable at this phase's close.** ⛔ **251 is invisible twice
over** — no review file of any kind, and no `independent_review` key in its verification frontmatter,
so a sweep counting that key returns **4 of 5**.

⭐ **PLANNED 2026-09-17 — 4 plans in 3 waves. Next action: `/gsd:execute-phase 254`.**
⛔ **`D-03` IS REFUTED BY `M-11`, MEASURED AT PLAN TIME, AND BOTH ARE KEPT:** the older arm does NOT
uniformly stay owed — **238 `complete` · 240 `complete` · 243 `refused` · 246 `done`**, leaving only
**241 / 242 / 244 / 245** unmet, which is the set `DEBT-06-AUDIT.md` reaches independently.
⚠ **`independent_review` takes SIX states across the ten phases** — `complete`, `done`, `refused`,
**`false`** (242, in no register's vocabulary), key-absent, and `owed`; **245 has no
`*-VERIFICATION.md` at all** while two registers hold a row for it. All three routed as findings,
none fixed here. ⭐ **The plan-check earned its pass**: `254-04` Task 2 could have been satisfied by
writing a **false sentence into `DEBT-06` itself**. The replacement fence re-derives both sets from
the ten files at execution time — **driven RED on the current tree, exit 1** — and stays INLINE,
barred from `scripts/`, because a committed script reading `independent_review` is the gate `M-7`
says must not be built inside a review phase.

✅ **PHASE 254 IS EXECUTED — 2026-09-17, `254-04` closed, plan 4 / 4. NOT VERIFIED.** Everything below
in this section is preserved rather than rewritten. **Next action: `/gsd:verify-work 254`**, then the
operator rules on the five items in `254-REVIEW-INDEX.md`. Commits: `3a531f796` · `477c14098` ·
`97b5dc6ae` · `05e6a9110` · `3017852ea`.
⭐ **THE DELIVERABLE IN ONE NUMBER: a sweep counting `independent_review` over the five v4.2 build
phases returned `4` before this plan and returns `5` after.** `251-VERIFICATION.md` had carried **no
such key for the phase's entire life**, so every count of the field silently omitted it — the same
invisibility class as a hot file with no ledger row. The key was **ADDED**, with `builder:` and
`reviewer:`, both also absent.
⛔ **NOTHING WAS FLIPPED TO `done` OR `refused` AND `DEBT-06` WAS NOT TICKED — that is the
deliverable, not a shortfall.** All five values still read `owed` (asserted by `yaml.safe_load`, never by
grep); all five still read `verification_mode: self-verified`; the box is still `- [ ]`; and claude ran
**no** `agent-bus.sh answer` or `close`.
⭐ **THREE SURPRISES, each DRIVEN rather than argued.** **(1) The derivation found a row `DEBT-06` had
never named:** `239` reads `independent_review: owed` on disk, sits in neither arm, and **has no bus ask
at all**. It is now in the amended requirement's unmet clause and routed as a finding. *A hand-typed list
is the defect this family keeps re-paying.* **(2) This plan's OWN acceptance fence is DEFECTIVE, and it
was reported rather than worked around:** `grep -h '^independent_review:' | grep -cE '(done|refused)'`
reads **5**, because the plan's own `<action>` block *requires* every comment to say that a ruling would
make it `refused` and only a §6.3 review makes it `done`. **The fence cannot tell a VALUE from its own
explanation** — the same lexer class 253 fixed for SQL comments, one register over. Three readings are
published: plan-as-written **5**, value-only **0**, `yaml.safe_load` → **`owed` ×5**. **(3) The
PostToolUse honesty hook NEVER FIRED** on any of the five register edits: it matches `Write|Edit` and the
edits arrived from a script — the same matcher-blindness `253` fixed for `MultiEdit`. The gate was run
by hand instead: **exit 0, `subject: 16`**.
⚠ **Two inherited claims corrected, both driven:** `250-VERIFICATION.md`'s `owed:` list held **five**
entries, not four (now six; the prior five byte-unchanged); and the briefing's claim that
`independent_review: \(done\|refused\)` returns **0** across *every* `*-VERIFICATION.md` is false — it
returns **0** under `.planning/phases/` and **2** under `.planning/` (`243` `refused`, `246` `done`, both
**pre-existing**, written 2026-09-16 by the DEBT-06 audit). The criterion as *intended* holds.
⛔ **`DEBT-06` AMENDED, NOT TICKED.** Two labelled clauses on separate lines, re-derived from the files:
**ten unmet** (239 · 241 · 242 · 244 · 245 · 249 · 250 · 251 · 252 · 253) against **four already
accounted for** (238 `complete` · 240 `complete` · 243 `refused` · 246 `done`). The range token
`242-246` is banned from both clauses — it merges four discharged rows with two unmet ones. ⚠ The
amendment widens the requirement to **fourteen** rows, not D-03's re-typed *ten*: **ten is the size of the
UNMET half only**, and the bullet shows its work.
⭐ **ROADMAP: seven rows appended to, never overwritten** — `— **SUPERSEDED VERDICT FOLLOWS:**` count
**3 → 10** (+7 exactly), 254's row `3/4 → 4/4`, pipe-rows `86 → 86`, and the `⚠ **7 / 8 v4.2 phases
closed` counts line left **BYTE-IDENTICAL** to `git show HEAD:` (md5 `72a230988a502bf4b29a8d325d2d8936`)
— **a numerator moves when a phase CLOSES, and that is `/gsd:verify-work`'s call, never a plan's.**
⭐ **`254-REVIEW-INDEX.md` is the operator's one document:** ten findings triaged with exactly one
recommended disposition each (**7** from `251-REVIEW.md` + **3 authored by 254** — two spellings of one
state (`complete` vs `done`), a bare `false` in no register's vocabulary, and a `245` row **two registers
hold with no file to hold it**); the structural finding re-derived (`grep -rn independent_review` over
`scripts/ .claude/ .github/ docs/ AGENTS.md CLAUDE.md` → **NO MATCHES, exit 1**, so the flip is
**documentation, not an enforced state**, and the measured decay is **ten hours**); the `ADOPTED READING`
byte-identical (md5 `08fe04f7d9438e28d4734a71c5ba0240`, 1416 bytes, **one** distinct value across six
files); a flip recipe for the next session; and **five `answer`+`close` pairs pre-filled and UNRUN**.
⚠ **`bus_writes: 0` was deliberately NOT copied from the `251-BUS-TRIAGE.md` analog** — `254-01` *did*
amend five item bodies, so the honest keys are `bus_items_opened_answered_or_closed: 0` and
`bus_item_bodies_amended: 5`, the first backed by the header-diff reading **0**.
⚠ **Gates:** seeds **297/297 exit 0** with **`4 plan file(s), 15 path(s)`** — non-zero at last, where
the discuss-time run was green over **zero**; `SEED-177` **NOT FOLDED** (a ROADMAP path collision) and
left byte-unchanged; unswept **134 / 114**, two figures never summed. **G-7 clear**, 0 gap-closure plans.
⛔ **The hot-file ledger gate reads `subject: 15 · watched: 0`, so its green means *nothing to see*,
never *clear* — it CANNOT be cited as coverage for this phase (M-10).** No reported bug carries
`folded_into: 254`, and **`BUG-260916-01` stays `open`** as a named INPUT to 249's review.
⛔ **OWED, named rather than implied:** five rows still read `owed` **and that is correct** —
`BUS-249` / `BUS-250` / `BUS-251` / `BUS-256` / `BUS-257` are all still `[OPEN]`, behind a 9-item
`to:gemini` queue that has not moved since 2026-09-16, and **claude may not rule on the refusals
(`REG-03`)**. `DEBT-06` now covers fourteen rows and the older arm (239 · 241 · 242 · 244 · 245) is
genuinely unmet, **`239` with no ask at all**. Ten findings are triaged and **none is fixed**, two of
them criticals. And **nothing reads `independent_review`**, so every row above is an assertion no gate
re-checks.

⭐ **EXECUTING 2026-09-17 — waves 1 and 2 done, `254-03` closed. Plan: 3 / 4. Next action:
`/gsd:execute-phase 254` (wave 3 — `254-04`, the three registers claude owns + `254-REVIEW-INDEX.md`).**
`254-01` `57df2665e` (five bus asks amended in place — deadline **2026-09-24**, rank
`251 → 253 → 252 → 249 → 250`; nothing opened, answered, closed or archived) · `254-02` `5040048e6`
(`251-REVIEW.md`, the quality floor, **2 critical · 2 warning · 3 info**, `still_live: 4`,
`discharges_debt_06: false`) · **`254-03`** `c551be798` → `d2dc1358e` → `260d7e0f4` → `636efd593`
(**five `*-REVIEW-REFUSAL.md` drafts**, one per reviewed phase, each
`status: draft-pending-operator-ruling`).
⛔ **NOTHING IS RULED AND NO REGISTER MOVED BY `254-03`.** All five drafts name the **operator** as
the decider (D-05 / `REG-03`), and each **voids itself if its bus ask is answered** — before or after
the deadline. The M-8 adopted reading is fenced **byte-identical across all five** (section-body md5,
`sort -u` == 1) and the fence was **driven RED** on a one-word change, then restored to an identical
md5 pair.
⭐ **TWO CLAIMS THIS PLAN WAS TOLD TO WRITE WERE DRIVEN FIRST AND REFUTED, and both corrections are
recorded beside their originals rather than over them:**
**(1) `schema-acl-parity.yml` HAS now executed** — `gh run list` returns `completed success` on
`develop`, 2026-09-17T14:05:28Z, where 253's verification recorded `HTTP 404 / never run`; and
**`backend-tests` is GREEN for the first time in this repository's history** (two successes the same
day, after 40 consecutive failures). ⚠ Still owed: **one green run proves the job executes, not that
it can fail** — the deliberately-unmirrored-REVOKE and neutered-regex RED pushes are unrun.
**(2) A raw whole-file `md5sum` against `git show HEAD:<path>` is UNSOUND on this box** — it reports a
**false tamper** on `251-REVIEW.md` (worktree `27789` bytes vs blob `27327`, a difference of exactly
**462** = its line count; blob LF, worktree CRLF via the wave-1 checkout's `core.autocrlf` smudge).
`git status` is clean and `cmp` after `tr -d '\r'` is identical. **Fence register files on
CR-normalised CONTENT, never on a raw blob md5.**
⚠ **`251-VERIFICATION.md` still carries NO `independent_review` key** —
`grep -c` returns **0** — so a sweep of owed rows returns 4 and silently omits 251. `254-04` **ADDS**
the key; `254-03` deliberately did not.


Phase: **251 — Register Integrity** — ⭐ **CLOSED 2026-09-16**, and with it **v4.2 is complete on
code, all five phases**. Plans **251-01** `b38bd8444` · **251-02** `eff1afa7e` · **251-03**
`78c8cf010` · **251-04** `8458be004` → `f49b9d51b` → `e7cfc5a4e` → `134cb4ffa`.
Plan: **4 / 4 done.** Status: **phase complete.** ⚠ **Its next-action was SUPERSEDED 2026-09-16 and the
original is preserved here rather than overwritten:** it read *"next action `/gsd:complete-milestone`,
after the operator rules on `251-BUS-TRIAGE.md`."* The audit ran first, closed **`gaps_found`**, and
**Phase 252** sat between this phase and the close, and is now **CLOSED (2026-09-16, 5/5)**. **Next action: `/gsd:code-review 252`**, then `/gsd:complete-milestone` once `BUS-246`/`247`/`248` are ruled on.
⛔ Nothing about Phase 251's own verdict changes — none of the audit's 4 blockers is in `REG-01/02/03`.

⭐ **VERIFIED 2026-09-16 — `251-VERIFICATION.md`, 3 / 3 ROADMAP success criteria, `gaps_found: none`.**
`verification_mode: self-verified` · `independent_review: owed` (DEBT-06) — the verifier was a
subagent of the same session that orchestrated the build, so this is NOT the §6.3 two-agent
separation `OV-SOLO-01` re-armed. ⛔ **Every criterion was RE-DERIVED from the tree, never read from
a SUMMARY:** REG-02 was proven by EXTRACTING the fenced command out of `discuss-phase.md` and
`new-milestone.md` **as authored** and RUNNING it — a prose-only mention still passes
`grep -rn "check-seeds-register"` with zero runnable calls, so presence-grep is not evidence here.
REG-03 proven by `git diff 97bb24e4d..HEAD -- .agent-bus/` being **empty**: claude wrote nothing.

⚠ **A METHOD TRAP THE VERIFIER HIT AND PUBLISHED RATHER THAN QUIETLY FIXED — it is the D-11 trap
from the opposite direction.** Its first body-identity re-derivation compared a **git blob** against
`fs.readFileSync` on the local working tree, where `core.autocrlf=true`, and reported **153 / 276
seeds with whole-body LF→CRLF drift**. Re-run as **blob-vs-blob** via `git archive`, bypassing the
checkout entirely: **0 line-ending diffs at every phase commit**, with only the 4 legitimate body
diffs (the D-06/D-17 live-citation updates plus the one `[id-in-heading]` fix). ⛔ **On this box a
working-tree read is not a source of truth for byte identity** — CLAUDE.md warns that `git diff`
cannot SEE line-ending damage; this is the same fact producing a **false positive** instead of a
false negative. Recorded in `251-VERIFICATION.md` → *Method note*.

⭐ **THE REGISTER IS GREEN — verdict line verbatim, after 251-04:**

```
  register: 293 files · parsed: 293 · skipped: 0 · duplicate ids: 0
  unswept:  134 carry no trigger_when at all · 114 carry prose but no structured trigger
seeds register gate OK — 293/293 parsed, 0 duplicate ids, 293/293 carry all 5 required keys.
```

exit **0** · `--self-test` **8 / 8 arms PASS** (6/6 after 251-03; two arms added by 251-04, and
**both had been SEEN to fail first**). ⚠ **`293`, up from 292 by exactly one** — `SEED-286`, planted
by the bus triage's third arm. **No other file entered or left the register.**

### What 251-04 decided, and the three findings it did not inherit quietly

1. ⛔ **Plan 03's carried gate defect is FIXED.** The D-05 carve-out read `stubs.length === 1` — a
   COUNT with no constraint on the group — so a **keeper + live squatter + stub** trio was waved
   through as *resolved* while carrying an unresolved collision. Now `members.length === 2 &&
   stubs.length === 1`. **Driven RED against a planted trio before the fix**, and the same drive is
   now self-test arm `1c`. ⚠ This required editing `scripts/`, which Plan 03 was forbidden (D-17) —
   recorded as a deviation rather than slipped in.

2. ⛔ **`[id-in-heading]` ADDED, and it caught a real file on its first run.** Plan 03 found four
   renumbered seeds still titling themselves with the old id and recorded that the gate greps
   `seed_id:` and never headings. The new code fires **only on a disagreement**: measured across the
   live register, **221 headings match, 42 name no id, 28 files have no `# ` line** — failing those
   70 would buy nothing. **Exactly one disagreed: `SEED-068`, titled `# SEED-063` since a v2.8
   renumber.** Corrected in the same commit, provably one line.

3. ⛔ **The wiring was proven by EXECUTION, not by `grep`.** A step that merely NAMES the sweep
   satisfies `grep -rn "check-seeds-register"` and fires nothing — driven: with the fence replaced by
   a prose mention, the grep still hits and **zero runnable calls remain**. ⭐ **This is the third
   consecutive wave in which the counterfactual arm was the only arm that worked.**

### The mechanisms this phase leaves behind

- **The sweep is CALLED**, not merely written: `discuss-phase.md` `<step name="cross_reference_seeds">`
  and `new-milestone.md` §2.5, which no longer instructs a human to read every seed by hand.

- **The operator's queue is a number they see at every session start.** The SessionStart hook prints
  `5 open to:operator, oldest 15 days · 26 open to:gemini · 1 open to:claude`, and **prints nothing at
  all when both queues are empty** — the silence contract was kept, not traded.

- **`age_days` has ONE home** (`scripts/lib/bus-age.sh`). Two copies existed and had already diverged;
  a third was not written.

- ⚠ **Three VENDORED framework files now carry project edits** (`.claude/get-shit-done/` at v1.42.3):
  `workflows/discuss-phase.md`, `workflows/new-milestone.md`, `workflows/plant-seed.md`. They are
  recorded by path in CLAUDE.md beside the G-7 entry **so a future `chore(gsd)` update can re-apply
  them as a set.** One precedent survived one update; that is a precedent, not a guarantee.

### ⛔ What is OWED, stated as a decision rather than left to be discovered

- **`DEBT-06` is the one v4.2 requirement outstanding**, and its box was **left unticked with the
  reason written down** while the other 25 were ticked against a named artifact. No independent §6.3
  review has run for 238/240/241, and 249 and 250 closed `self-verified`.

- **Six bus items await the operator** — `BUS-040/208/246/247/248` and `BUS-171` itself.
  ⛔ **Claude wrote nothing to the bus**; `git diff --name-only .agent-bus/` is EMPTY across the whole
  plan. The `answer` / `close` commands ship pre-filled in `251-BUS-TRIAGE.md`.

- ⚠ **`SEED-286` is new and unrouted** — a chat thread's KB folder scope cannot be changed once the
  thread starts. Found in `BUS-040`, held by **nothing** for 16 days.

- ⚠ **The register is still largely unswept, by design**: `134 carry no trigger_when at all · 114
  carry prose but no structured trigger`. D-18 requires **both** figures and forbids summing them.
  This phase built the instrument and wired it; **it did not shrink the backlog**, and the box means
  the first thing, never the second.

### ⚠ The pre-251-04 position below is superseded and is kept rather than overwritten

Phase: **251 — Register Integrity** (the last phase of v4.2). Plans **251-01** at `b38bd8444`,
**251-02** at `eff1afa7e`, and **251-03 SHIPPED** at `78c8cf010` (summary `f5125638b`).
Plan: 251-01 (the gate) + 251-02 (the migration) + 251-03 (the renumber) done · **251-04 owed** —
it wires the sweep into the two GSD touchpoints.
Status: Ready to execute 251-04

⭐ **THE REGISTER IS GREEN FOR THE FIRST TIME — verdict line verbatim, after 251-03:**

```
  register: 292 files · parsed: 292 · skipped: 0 · duplicate ids: 0
  unswept:  134 carry no trigger_when at all · 114 carry prose but no structured trigger
seeds register gate OK — 292/292 parsed, 0 duplicate ids, 292/292 carry all 5 required keys.
```

exit **0** · `--self-test 6/6 arms PASS`. ⚠ **`134` is up from `126` by exactly the eight stubs, and
that is CORRECT** — a stub carries `trigger_when: unset`, which the gate counts as no trigger.
Reporting `126` would mean it had stopped counting eight real files.

**251-03's result:** 8 movers renumbered to **277-284** (`022→277 · 092→278 · 228→279 · 229→280 ·
231→281 · 253→282 · 259→283 · 269→284`), 8 redirect stubs at the original ids, and **37 live
citations rewritten across 18 files, each decided by READING the hit** — 55 more left byte-unchanged
because they mean the KEEPER. ⛔ `backend/`, `frontend/`, `scripts/` and `.planning/milestones/` are
**byte-unchanged**, asserted.

⛔ **FOUR ids are read from product code, not the one D-17 names.** `SEED-253` (discuss-phase),
`SEED-229` + `SEED-231` (planning), and **`SEED-092` found AT EXECUTION** — its four references are
a11y comments that spell out `SEED-092-remainder`, so a per-id ruling would have called all six
"keeper" and left four pointing at the wrong seed forever. **91 occurrences across 35 files stay on a
stub by decision; 54 of them mean a mover.** Every one is listed by file in
`.planning/phases/251-register-integrity/251-RENUMBER-LEDGER.md` §3e.

⛔ **FOUR moved files still titled themselves with the OLD id in their `# H1`** — the `SEED-068` bad
precedent one field over. **The gate greps `seed_id`, never headings, so it read `duplicate ids: 0`
throughout and was structurally incapable of catching it.** A renumber must check the BODY.

⛔ **A FINDING IN THE SHIPPED GATE, DRIVEN AND NOT FIXED — owed to 251-04.**
`duplicateGroups()` reads `if (stubs.length === 1) continue;`, a COUNT on the stubs rather than a
shape check on the group, so a **keeper + squatter + stub** trio is waved through as resolved while
carrying a live collision. Measured on a fixture (arm D). The fix is
`members.length === 2 && stubs.length === 1` plus a self-test arm; it edits `scripts/`, which 251-03
forbids. ⚠ **The next free seed id is `286`** — 277-284 are now taken and 285 already was.

⭐ **284/284 BODIES PROVEN BYTE-IDENTICAL by a digest set derived independently of the migration**
(a byte scan, not the migration's regex reader), diffed both directions, empty both ways. ⛔ Not by
a git-side content comparison, which was MEASURED blind: a whole-file line-ending rewrite of
`SEED-171` destroyed **553 bytes** and `git diff --stat` printed **zero lines**. `git status
--porcelain` DOES flag the file — so git can see THAT a file was touched, never WHAT changed.

⚠ **`git checkout -- <dir>` IS NOT A RESTORE.** Run mid-plan to roll the register back, it
re-materialised 242 files through `core.autocrlf=true` and moved **224 body digests** while
`git status` reported the tree CLEAN. 280 of 284 were recovered byte-exact; the residual 4
(`SEED-013/144/145/194`) lost a working-tree-only line-ending mixture git has never stored and that
no clone reproduces. **Use a byte copy when you need bytes back.**

⛔ **251-03's id space has ZERO headroom, measured:** 276 distinct ids, **highest is 285**, and
`277-284` are free — **exactly eight, for eight renumbers**. A ninth must jump to **286**; the run is
not contiguous. ⚠ And D-08's allocator is now `max(id)+1`: the OLD count-based form emits
**`SEED-285`, which ALREADY EXISTS** — it produces the ninth collision on its very next use.

⚠ **`SEED-001` carries NO date at all**, so `seedDate()` is not total. 251-02 never called it;
**251-03's D-07/D-20 tie-break does, and `SEED-001` is not a duplicate pair member — but the gap is
live for any pair whose members lack both `created:` and `planted:`.**

### ⚠ The pre-migration position below is superseded and is kept rather than overwritten

⚠ **`251-01` found the plan's own register size had rotted by one IN ITS BASE COMMIT** — `97bb24e4d`
planted `SEED-285`, so the register is **284**, not the **283** that `251-01-PLAN.md`, `251-02-PLAN.md`
and `251-RESEARCH.md` all state. The gate derives `registerSize` by `readdirSync` and needed no change;
**a plan that hardcodes 283 does.** Pre-migration census (every figure from a named command):
`.planning/phases/251-register-integrity/251-GATE-BASELINE.md`.

⛔ **Baseline for 02/03 to be measured against:** `register 284 · parsed 284 · skipped 0` ·
**8** `[duplicate-id]` · **5** `[no-frontmatter]` · **396** `[missing-key]` · **27** `[unknown-status]` ·
**73/284** seeds carry all five required keys · unswept **126 / 158** (two figures, never summed) ·
`--self-test 6/6 arms PASS`.

### ⚠ The 2026-09-15 position below is STALE and is kept rather than overwritten

Phase: **247 — Sources & Watches · CLOSED ON CODE** at `3d5f62dc6`. Next: **248 — The Credential Boundary**
Plan: 247-01 .. 247-04 — **all 4 shipped across 3 waves**, every plan carrying a SUMMARY
Status: Ready to execute
wave-by-wave by claude (`BUS-214` / `BUS-217` / `BUS-218` / `BUS-219`); five findings raised and fixed
(`1f37737ae`); `SEED-282`'s Drive-path fence retired under **`D-247-01`** with the reason in the test
body (`3d5f62dc6`). Gates re-derived under claude's own runs: wider blast radius **460 passed / 0
failed** · 247's own suites 37 · frontend 118/118 · standing red 16-33 with the **same membership** as
the pinned baseline · honesty gate 10/10 · ledger gate OK.
Last activity: 2026-09-15 -- Phase 251 planning complete
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

## Roadmap Evolution

- **Phase 252 added 2026-09-16 — by the milestone audit, not by a feature request.**
  `/gsd:audit-milestone 4.2` closed **`status: gaps_found`**: `requirements 15/26 satisfied · 6 partial
  · 5 unsatisfied`, `integration 16/22`, `flows 1/3`, **4 blockers · 9 warnings**. Report:
  `.planning/v4.2-MILESTONE-AUDIT.md`. Phase dir: `.planning/phases/252-close-the-v42-audit-gaps/`.
  ⛔ It moved **`CRED-01`, `CRED-03`, `WATCH-04`, `HONEST-03`** from ✅ satisfied to ⛔ unsatisfied.
  ⭐ **All five phases' own verifications read `passed` and every gate was green** — the four blockers
  are each a seam between two things that are individually correct, which is `DEBT-06`'s argument
  arriving from outside the registers.
  ⚠ **`gsd-sdk query phase.add` was tried first and wrote the entry into the WRONG SECTION** — the
  bottom of the file, inside the archived v2.5 block, touching **none** of v4.2's four registers
  (Phase Table, Phase Checklist, Phase Details, Progress). It was reverted from a backup and the five
  edits were made by hand. **Another instance of the recorded rule: hand-edit the planning registers,
  do not trust the SDK write verbs.**
  ⚠ The audit also corrected the ROADMAP **Phase Checklist** box for **248**, which read `[ ]` while
  its Progress row read ✅ CLOSED 2026-09-15 with a peer-reviewed 4/4 verification on disk.

- **Phase 254 added 2026-09-17 — by operator instruction, to discharge `DEBT-06` rather than carry it
  forward a seventh time.** Phase dir: `.planning/phases/254-independent-review-of-249-253/`.
  Scope measured at scoping rather than read from a summary line — `grep verification_mode` across the
  five `*-VERIFICATION.md` files returns **`self-verified` for all of 249, 250, 251, 252 and 253**, with
  `independent_review: owed` (`reviewer: null` on 250; `BUS-256` on 252; `BUS-257` on 253).
  ⚠ **`gsd-sdk query phase.add` wrote the entry into the WRONG SECTION AGAIN — the identical defect this
  section recorded one day earlier for Phase 252.** It appended a `### Phase 254:` block (wrong heading
  level; details here are `####`) to the **bottom of the file**, after the archived v2.8 `<details>`
  block, touching **none** of v4.2's four registers. Reverted from a backup taken before the call; the
  six edits (Phase Table, Phase Checklist, Phase Details, Coverage, Progress, and the `7 / 7` → `7 / 8`
  closed-phase line) were made by hand. **Two occurrences of the same write defect, one day apart:
  `phase.add` returns correct JSON and writes a useless entry — read the diff, never the return value.**
  ⛔ The operator asked for **`254`, a new phase at the end**, not `--insert`; `--insert 254` would have
  produced `253.1`, since 254 did not exist to insert after.

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
