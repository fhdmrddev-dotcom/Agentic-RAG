# A — Project-Management Artifact Taxonomy & Maintenance Workflows

**Research dimension:** Domain taxonomy — canonical PM artifacts, their data models, and the workflows that produce/maintain them.
**Purpose for v2.9:** Project Management is the FLAGSHIP DEMO domain for the generalized workflow capability. This catalog gives the structured data models we will turn into template-fill outputs and harness workflow definitions, plus an explicit read on which artifacts are extract-from-docs vs generate-from-template vs human-judgment, and which are cross-domain generalizable (so we design a generic capability, not a PM-hardcoded one).
**Grounding:** PMBOK 7 / PMI, PRINCE2 7, and practitioner template sources. Source URLs inline.
**Date:** 2026-06-08

---

## 0. How the standards frame "artifacts" (the shape of the domain)

PMBOK 7 deliberately stops prescribing a fixed document set and instead offers an **Artifacts** performance domain organized into 9 loose categories — and explicitly says it is "not a finite checklist" ([Project Management Academy](https://projectmanagementacademy.net/resources/blog/types-of-project-management-artifacts/), [Dee Project Manager](https://deeprojectmanager.com/project-management-artifacts/)):

| PMBOK 7 category | Representative artifacts |
|---|---|
| **Strategy** | Business Case, Project Charter, Project Roadmap |
| **Logs & Registers** | Risk Register, Issue Log, Change Log, Assumption Log, Stakeholder Register, Backlog, Lessons Learned Register |
| **Plans** | Communications Mgmt Plan, Cost Mgmt Plan, Quality Plan, Resource Mgmt Plan, Release/Transition Plan |
| **Hierarchy charts** | WBS, Product Breakdown Structure, Risk Breakdown Structure, Org/Resource Breakdown Structure |
| **Baselines** | Scope Baseline, Schedule Baseline, Cost Baseline, Performance Measurement Baseline, Milestone schedule |
| **Visual data & info** | Gantt, Burndown/Burnup, Histogram, Cumulative-flow, Dashboards, Affinity/Information radiators |
| **Reports** | Status/Highlight Report, Risk Report, Quality Report, Closure Report, Earned-Value Report |
| **Agreements & contracts** | SOW, NDA, Vendor contracts, MOUs |
| **Other** | Requirements Documentation, Team Charter, Activity List, Metrics, Test plans |

PRINCE2 7 takes the opposite, prescriptive stance and is the cleaner mental model for our **maintenance-cadence** axis. It classifies every "management product" into exactly **3 types** ([whatisprince2.net](https://www.whatisprince2.net/management-products), [prince2.wiki](https://prince2.wiki/management-products/)):

- **Baselines** (12 products) — "define what will be delivered and how; once approved they are controlled and **versioned**" (Business Case, PID, Plans, Product Descriptions, Work Package, Management Approaches). → *one-shot-then-version-on-change.*
- **Records** — "continuously updated logs and registers that track day-to-day status **without version control**" (Daily Log, Lessons Log, Issue Register, Risk Register, Quality Register, Product Register). → *high-cadence, append/update.*
- **Reports** — "time-based **snapshots** that support decisions / managing by exception" (Highlight, Checkpoint, End Stage, Exception, End Project). → *generated on a cadence from the records + baselines.*

**This baseline / record / report split is the single most useful design lens for v2.9.** It maps almost 1:1 onto three workflow archetypes our harness already supports:

- **Baseline** = `llm_single` or `llm_human_input` generation → publish/lock → versioned re-issue on change request.
- **Record** = incremental update workflows (ingest an input → extract/merge rows → upsert into a structured store). Naturally a recurring/append cadence.
- **Report** = scheduled `programmatic` + `llm_single` roll-up that *reads* records/baselines and *renders* a snapshot (the template-fill use case).

---

## The Catalog (20 artifacts)

For each: **(a)** purpose · **(b)** data model · **(c)** inputs · **(d)** cadence · **(e)** LLM/RAG amenability · **(f)** daily-routine chain · **(g)** cross-domain generalizable?

Legend for amenability: **EXTRACT** (pull structured rows from unstructured docs) · **TEMPLATE-FILL** (retrieve from KB → populate a fixed template) · **ROLL-UP** (aggregate/transform existing structured data) · **JUDGMENT** (needs human decision; LLM drafts/assists only).

---

### 1. Project Charter  *(Strategy — Baseline)*
- **(a) Purpose:** Authorizes the project, names the sponsor/PM, and sets initial objectives, scope, budget, and high-level risks ([Asana](https://asana.com/resources/project-charter), [Smartsheet](https://www.smartsheet.com/content/project-charter-elements)).
- **(b) Data model:** `purpose/justification`, `objectives[]` (SMART), `success_criteria[]`, `high_level_scope` (in/out), `key_deliverables[]`, `milestones[]` (name, target_date), `budget_summary`, `sponsor`, `project_manager`, `key_stakeholders[]`, `high_level_risks[]`, `assumptions[]`, `constraints[]`, `approval` (name, role, date). Five "always present" elements: purpose, objectives, scope, key stakeholders, high-level risks ([6sigma.us](https://www.6sigma.us/project-management/elements-of-a-project-charter/)).
- **(c) Inputs:** Business case, SOW/contract, sponsor interview, kickoff notes, prior similar charters in KB.
- **(d) Cadence:** One-shot at initiation; re-baselined only on major scope/sponsor change.
- **(e) Amenability:** **TEMPLATE-FILL + JUDGMENT.** Structure is highly templatable; objectives/success-criteria need human ratification. Great template-fill demo: "draft a charter from this business case + KB."
- **(f) Chain:** upload business case → retrieve org KB norms/prior charters → draft charter sections → `ask_user` to confirm objectives & budget → render docx.
- **(g) Generalizable:** **YES — high.** A "charter" generalizes to any initiative-authorization doc (grant proposal, product PRD, research protocol cover sheet).

### 2. Business Case  *(Strategy — Baseline)*
- **(a) Purpose:** Justifies investment — is the project desirable, viable, achievable ([prince2.wiki/business-case](https://prince2.wiki/management-products/baselines/business-case/)).
- **(b) Data model:** `executive_summary`, `problem/opportunity`, `options_considered[]` (incl. do-nothing), `recommended_option`, `expected_benefits[]` (measurable + owner + baseline + target), `dis-benefits[]`, `costs` (capex/opex, time-phased), `timescale`, `investment_appraisal` (NPV/ROI/payback), `major_risks[]`. PRINCE2 keeps benefits in a separate **Benefits Management Approach** but the case carries the appraisal.
- **(c) Inputs:** Market/financial data, cost estimates, strategy docs, stakeholder goals, KB of comparable projects.
- **(d) Cadence:** One-shot; PRINCE2 mandates **review at each stage boundary** for continued viability.
- **(e) Amenability:** **JUDGMENT + ROLL-UP.** Financials need human numbers; LLM is strong at structuring options, drafting benefit statements, and the stage-boundary "is this still viable?" check.
- **(f) Chain:** stage-end → recompute benefits vs actuals from cost/schedule records → flag viability drift → draft updated case → `ask_user`.
- **(g) Generalizable:** **YES — high.** Any "should we invest" decision memo.

### 3. Project Roadmap / Milestone List  *(Strategy / Baseline — visual)*
- **(a) Purpose:** High-level timeline of phases and major milestones with target dates.
- **(b) Data model:** `milestone_id`, `name`, `description`, `phase`, `planned_date`, `actual_date`, `status`, `dependencies[]`, `owner`. (Milestone List per [Dee PM](https://deeprojectmanager.com/project-management-artifacts/).)
- **(c) Inputs:** Charter, schedule, stakeholder commitments.
- **(d) Cadence:** Set at planning; reviewed monthly/at stage boundaries.
- **(e) Amenability:** **ROLL-UP.** Derivable from the schedule's milestone-flagged tasks.
- **(f) Chain:** schedule update → extract milestone rows → recompute slippage → render roadmap strip.
- **(g) Generalizable:** **YES.** Any phased plan with checkpoints.

### 4. Scope Statement & Scope Baseline  *(Baseline)*
- **(a) Purpose:** Defines deliverables, acceptance criteria, exclusions, constraints, assumptions — the approved reference for scope control.
- **(b) Data model:** `product_scope_description`, `deliverables[]` (with acceptance_criteria), `acceptance_criteria[]`, `exclusions[]`, `constraints[]`, `assumptions[]`. The Scope Baseline = Scope Statement + WBS + WBS Dictionary (PMBOK).
- **(c) Inputs:** Requirements doc, charter, stakeholder workshops.
- **(d) Cadence:** One-shot baseline; changes only via approved change requests.
- **(e) Amenability:** **TEMPLATE-FILL.** Exclusions/acceptance criteria benefit from KB retrieval of standards.
- **(g) Generalizable:** **YES.** Any "definition of what's in/out."

### 5. Work Breakdown Structure (WBS) + WBS Dictionary  *(Hierarchy chart — Baseline)*
- **(a) Purpose:** Deliverable-oriented hierarchical decomposition of 100% of project work; the dictionary narrates each element ([PMI](https://www.pmi.org/learning/library/work-breakdown-structure-basic-principles-4883)).
- **(b) Data model:** *Tree* of `wbs_id` (outline code e.g. 1.2.3), `element_name`, `parent_id`, `level`, `type` (deliverable/work-package). **WBS Dictionary** per work package: `wbs_id`, `description`, `boundaries/scope`, `deliverables`, `acceptance_criteria`, `assigned_owner`, `estimated_duration`, `estimated_cost`, `resources`, `milestones`, `risks`, `predecessor/successor` ([PMI definition](https://www.pmi.org/learning/library/wbs-web-enabled-interface-process-7965)). Work packages are the lowest leaf and carry owner/duration/cost/risk.
- **(c) Inputs:** Scope statement, deliverables list, SME decomposition, prior WBS templates in KB.
- **(d) Cadence:** Planning one-shot; refined via progressive elaboration; re-baselined on scope change.
- **(e) Amenability:** **TEMPLATE-FILL + JUDGMENT.** LLM is strong at decomposing a deliverable into candidate work packages and drafting dictionary entries; the 100%-rule completeness check needs human review. Hierarchical (tree) data model — note for the structured-output design: not flat tabular.
- **(f) Chain:** new deliverable approved → decompose into work packages → draft dictionary entries from KB norms → `ask_user` approve → feed cost/schedule.
- **(g) Generalizable:** **YES — high.** Any hierarchical decomposition (curriculum syllabus, BOM, audit-scope tree).

### 6. Requirements Documentation + Requirements Traceability Matrix (RTM)  *(Other / control)*
- **(a) Purpose:** Captures each requirement and traces it forward to deliverables, design, and test cases, and backward to its source/business objective ([Requiment RTM guide](https://www.requiment.com/requirements-traceability-matrix-rtm-guide/), [project-management.com](https://project-management.com/requirements-traceability-matrix-rtm/)).
- **(b) Data model (tabular):** `req_id`, `req_name`, `shall_statement/description`, `source` (stakeholder/contract), `business_need/objective_link`, `priority` (business impact × complexity), `category` (functional/non-functional), `related_req_ids[]` (dependencies), `deliverable/WBS_link`, `design_ref`, `test_case_id`, `verification_method`, `status` (proposed/approved/in-dev/verified/rejected), `owner`. The "Related Requirements ID" column tracks dependencies; format flexes to add architecture/design/test columns.
- **(c) Inputs:** Requirements workshops, contracts, user stories, change requests, test results.
- **(d) Cadence:** Living document; updated whenever requirements/tests change; reviewed each iteration.
- **(e) Amenability:** **EXTRACT + ROLL-UP — very high.** Bidirectional traceability is exactly graph/RAG-shaped: extract `shall` statements from a spec, link to test IDs, and report coverage gaps (orphan requirements / untested requirements). Strong flagship feature.
- **(f) Chain:** new spec uploaded → extract `shall` statements as req rows → match to existing tests/deliverables in KB → flag untraced reqs → update matrix → coverage report.
- **(g) Generalizable:** **YES — very high.** Traceability is domain-agnostic (regulatory control → evidence, hazard → mitigation, audit assertion → workpaper). This is the most reusable "graph artifact" in the catalog.

### 7. Project Schedule (Gantt / Critical Path / Schedule Baseline)  *(Baseline — visual)*
- **(a) Purpose:** Time-phased plan of activities with dependencies; identifies the critical path (longest dependent chain = minimum duration) ([projectmanager.com critical path](https://www.projectmanager.com/blog/critical-path-on-gantt), [Asana CPM](https://asana.com/resources/critical-path-method)).
- **(b) Data model (tabular + graph):** per task: `task_id`, `name`, `wbs_link`, `planned_start/finish`, `actual_start/finish`, `duration`, `% _complete`, `predecessors[]` with `dependency_type` (FS/SS/FF/SF) and `lag/lead`, `resources[]`, `milestone_flag`, `constraint`, plus computed `early_start/early_finish/late_start/late_finish`, `total_float/free_float` (float = LS−ES; critical-path tasks have **zero float**), `is_critical`. Baseline snapshot stored for variance.
- **(c) Inputs:** WBS/activity list, duration estimates, resource calendars, dependency logic, progress updates.
- **(d) Cadence:** Built once; **updated as often as daily/weekly** with progress; re-baselined on approved change.
- **(e) Amenability:** **ROLL-UP + JUDGMENT (compute-heavy, not pure LLM).** CPM/float is deterministic math → belongs in a `programmatic` phase (code execution), not LLM token-prediction. LLM's role: parse status updates into `%complete`/actual-date deltas, then *narrate* the critical-path impact. Important design note: schedule logic must be computed, not "reasoned."
- **(f) Chain:** standup notes → extract task progress → `execute_code` recomputes critical path & float → flag newly-critical tasks / slippage → update schedule + status narrative.
- **(g) Generalizable:** **PARTIAL.** The dependency-graph + CPM engine is reusable; but it's specialized enough to be a candidate **`phase_type` plugin** rather than a generic template-fill.

### 8. Cost Baseline / Budget  *(Baseline)*
- **(a) Purpose:** Authorized, time-phased budget against which spend is measured (excludes management reserve) — the basis for Earned-Value variance ([Runn](https://www.runn.io/blog/cost-baseline), [PM Study Circle](https://pmstudycircle.com/cost-baseline/)).
- **(b) Data model:** bottom-up roll-up — `activity_cost_estimate` → `work_package_cost` (+`contingency_reserve`) → `control_account` → `cost_baseline` (Σ control accounts) → `+management_reserve` = `project_budget`. Time-phased into periods → renders as an **S-curve**. Fields: `cost_account_id`, `wbs_link`, `planned_value_by_period`, `contingency`, `EAC/ETC`, `actual_cost`.
- **(c) Inputs:** Estimates, WBS, risk quantitative analysis (for contingency), schedule (for time-phasing), invoices/actuals.
- **(d) Cadence:** Baseline one-shot; actuals updated weekly/monthly; re-baselined on change.
- **(e) Amenability:** **ROLL-UP (programmatic).** Aggregation + EVM math = code. LLM extracts cost lines from estimates/invoices and explains variances.
- **(g) Generalizable:** **PARTIAL.** Budget roll-up is generic; EVM is PM-specific math (candidate plugin).

### 9. Risk Register  *(Log/Register — Record; PRINCE2 Risk Register)*
- **(a) Purpose:** Living catalog of identified risks (threats & opportunities) with assessment and responses ([Smartsheet](https://www.smartsheet.com/risk-register-templates), [Dee PM](https://deeprojectmanager.com/risk-register-template/), [PRINCE2 template](https://mplaza.training/templates/prince2/risk-register/)).
- **(b) Data model (tabular):** `risk_id`, `title`, `description` (cause→event→effect), `category` (from Risk Breakdown Structure), `date_identified`, `identified_by`, `type` (threat/opportunity), `probability` (1–5 or %), `impact` (1–5, by cost/time/quality/safety), `risk_score = P×I`, `RAG_rating`, `proximity/likely_date`, `response_strategy` (avoid/transfer/mitigate/accept | for opp: exploit/share/enhance/accept), `response_actions[]`, `response_cost`, `owner`, `action_owner`, `residual_probability/impact`, `status` (open/managed/closed), `trigger`. PRINCE2 adds `risk_response_category` and links to the Risk Management Approach.
- **(c) Inputs:** Risk workshops, standup/meeting notes, issue log (issues that were risks), status reports, lessons learned, SME input, KB of prior project risks.
- **(d) Cadence:** **High** — reviewed at every status meeting / standup; risks added/closed continuously.
- **(e) Amenability:** **EXTRACT + ROLL-UP — very high.** This is the *canonical flagship demo*: extract candidate risks from meeting minutes, dedupe against existing register, auto-compute P×I score and RAG, surface for human confirmation. Score recompute is trivial code.
- **(f) Chain (the headline daily routine):** standup notes → LLM identifies new risk statements → dedupe vs register → draft P/I + response → `ask_user` confirm → upsert rows → close risks marked resolved → recompute P×I & RAG → regenerate prob-impact matrix + risk report.
- **(g) Generalizable:** **YES — very high.** "Register with scored rows + lifecycle status" is the universal pattern (compliance findings, security vulns, clinical adverse events, audit observations).

### 10. Probability-Impact Matrix  *(Visual / risk-analysis tool)*
- **(a) Purpose:** Qualitative risk-analysis grid that prioritizes risks by P×I into red/amber/green zones ([Mudassir Iqbal](https://mudassiriqbal.net/probability-and-impact-matrix/), [PMTI](https://www.4pmti.com/learn/risk-probability-impact-matrix/)). PMBOK 7 lists it as a core qualitative analysis tool.
- **(b) Data model:** A scale definition (`probability_levels` e.g. 1–5 = 0.1–0.9; `impact_levels` e.g. 1–5), a `cell_score = P×I` (1–25), and `RAG_thresholds` mapping score → red/amber/green. The matrix itself is a *derived projection* of the risk register, not an independently maintained store: each risk plots at (P, I).
- **(c) Inputs:** Risk register rows (P and I per risk).
- **(d) Cadence:** Regenerated whenever the register changes.
- **(e) Amenability:** **ROLL-UP (pure projection).** Should be a rendered view/report, never hand-maintained. Good `panel_renderer` plugin candidate.
- **(g) Generalizable:** **YES.** Any 2-axis scoring heatmap (effort/impact, value/risk, severity/likelihood).

### 11. RAID Log  *(Composite Record)*
- **(a) Purpose:** Single consolidated log of **R**isks, **A**ssumptions, **I**ssues, **D**ependencies (some teams: Actions/Decisions) — the PM's working command board ([Digital PM](https://thedigitalprojectmanager.com/project-management/raid-log/), [Asana](https://asana.com/templates/raid-log)).
- **(b) Data model:** shared columns `id`, `category` (R/A/I/D), `description`, `impact` (H/M/L), `probability` (H/M/L, risks only), `priority`, `owner`, `status` (open/in-progress/resolved/closed), `due_date`, `mitigation/resolution`, `date_logged`, `last_updated`, `next_action`, `next_update`. Best practice: keep R/A/I/D as **distinct sections/views** because each has a different review cadence and action pattern.
- **(c) Inputs:** Meeting minutes, standups, emails, status reports.
- **(d) Cadence:** **Daily/standup-driven** — the highest-churn artifact.
- **(e) Amenability:** **EXTRACT — very high.** The archetypal "minutes → categorized log entries" extraction. One LLM pass classifies a note into R/A/I/D and routes it.
- **(f) Chain:** standup transcript → classify each item into R/A/I/D → route risks to risk register, dependencies to dependency tracker, issues to issue log → set owner/due → flag overdue items.
- **(g) Generalizable:** **YES — high.** The "classify free text into a typed register" pattern is fully domain-agnostic.

### 12. Issue Log / Issue Register  *(Record)*
- **(a) Purpose:** Tracks problems that have already occurred and need resolution ([Mastt](https://www.mastt.com/resources/issue-log), [Asana](https://asana.com/templates/issue-log)).
- **(b) Data model:** `issue_id`, `description`, `date_logged`, `reporter`, `category/type`, `impact` (time/cost/quality), `priority` (low/med/high/critical), `owner`, `status` (open/in-review/in-progress/resolved/closed), `target_resolution_date`, `actual_resolution_date`, `resolution_notes`, `escalation_flag`, `linked_risk_id`.
- **(c) Inputs:** Standups, emails, support tickets, test defects, escalations.
- **(d) Cadence:** Daily — added on occurrence, driven to closure.
- **(e) Amenability:** **EXTRACT.** Same extraction pattern as RAID/risk; LLM drafts resolution notes from thread context.
- **(g) Generalizable:** **YES.** Generic ticket/case log.

### 13. Change Log / Change Request Register  *(Record)*
- **(a) Purpose:** Records change requests and their approval/implementation status ([ProjectManager](https://www.projectmanager.com/templates/change-log-template), [Tactical PM](https://www.tacticalprojectmanager.com/change-log-template/)).
- **(b) Data model:** `change_no`, `date_identified`, `requestor`, `request_type` (scope/schedule/cost/quality), `description`, `reason`, `impact_assessment` (cost/schedule/scope/risk), `estimated_cost`, `priority`, `CCB_decision` (approved/rejected/deferred), `decision_date`, `decision_by`, `implementation_status`, `linked_baseline_versions`, `notes`.
- **(c) Inputs:** Change request forms, CCB minutes, stakeholder requests, variance findings.
- **(d) Cadence:** Event-driven; reviewed at change-control board cadence (often weekly).
- **(e) Amenability:** **EXTRACT + ROLL-UP.** LLM drafts impact assessment by retrieving affected scope/schedule/cost from KB; approval is **JUDGMENT** (human/CCB).
- **(g) Generalizable:** **YES.** Generic approval-gated change workflow (ties naturally to the harness's validation-gate primitive).

### 14. Assumption Log  *(Record)*
- **(a) Purpose:** Lists assumptions and constraints made during planning, so they can be validated/converted to risks ([PMBOK Logs & Registers](https://trustedinstitute.com/concept/pmp-pmbok7/models-methods-artifacts/logs-and-registers/)).
- **(b) Data model:** `assumption_id`, `description`, `category`, `date_logged`, `owner`, `validation_status` (unvalidated/validated/invalidated), `validation_date`, `confidence`, `impact_if_false`, `linked_risk_id` (when an invalidated assumption becomes a risk).
- **(c) Inputs:** Planning sessions, charter, meeting minutes.
- **(d) Cadence:** Reviewed periodically; spikes at planning and stage boundaries.
- **(e) Amenability:** **EXTRACT.** LLM surfaces implicit assumptions from planning docs ("we assume vendor X delivers by…").
- **(g) Generalizable:** **YES.**

### 15. Stakeholder Register + Engagement Assessment Matrix  *(Log/Register + analysis)*
- **(a) Purpose:** Identifies stakeholders, analyzes power/interest/influence, and tracks current-vs-desired engagement ([Project Mgmt Fandom](https://project-management.fandom.com/wiki/Stakeholders_engagement_assessment_matrix), [PM Study Circle](https://pmstudycircle.com/stakeholder-engagement-assessment-matrix/)).
- **(b) Data model — Register:** `stakeholder_id`, `name`, `role/title`, `organization`, `category` (internal/external), `interest/expectations`, `requirements`, `power` (H/L), `interest` (H/L), `influence`, `impact`, `classification` (Power/Interest quadrant: Manage Closely / Keep Satisfied / Keep Informed / Monitor; or **Salience** = power × legitimacy × urgency), `engagement_strategy`, `communication_prefs`, `contact_info`. **Engagement Assessment Matrix:** rows = stakeholders, columns = 5 engagement levels — **Unaware → Resistant → Neutral → Supportive → Leading** — with `C` = current and `D` = desired marked per stakeholder; the C→D gap drives communication planning.
- **(c) Inputs:** Org charts, kickoff, interviews, emails, RACI, prior project registers in KB.
- **(d) Cadence:** Created at initiation; reviewed periodically (engagement levels shift over time).
- **(e) Amenability:** **EXTRACT + JUDGMENT.** LLM extracts stakeholders/roles from docs and *suggests* power/interest classification; the engagement assessment (C/D) is human judgment. Sensitivity note: stakeholder data is often confidential.
- **(f) Chain:** new email thread / org change → extract new stakeholders → classify on power/interest → flag engagement gaps (resistant key players) → recommend comms actions.
- **(g) Generalizable:** **YES — high.** "Actor register + influence map" generalizes (contacts CRM, audience map, contributor map).

### 16. Communications Management Plan  *(Plan — Baseline)*
- **(a) Purpose:** Defines who gets what information, by what method, how often, in what format ([Smartsheet](https://www.smartsheet.com/content/project-communication-templates), [PM Docs](https://www.projectmanagementdocs.com/template/project-planning/communications-management-plan/)).
- **(b) Data model (matrix):** rows of `audience/stakeholder`, `information/content`, `purpose/objective`, `method/vehicle` (email/meeting/dashboard), `frequency` (daily/weekly/milestone), `format` (level of detail), `owner/sender`, `channel`, `confidentiality`, `escalation_path`.
- **(c) Inputs:** Stakeholder register + engagement matrix (the C→D gaps), org comms norms.
- **(d) Cadence:** Planning one-shot; updated as stakeholders/engagement change.
- **(e) Amenability:** **TEMPLATE-FILL + ROLL-UP.** Strongly derivable from the stakeholder register; LLM proposes cadence/method per quadrant.
- **(g) Generalizable:** **YES.** Generic "distribution plan."

### 17. Status Report / Highlight Report  *(Report — snapshot)*
- **(a) Purpose:** Periodic snapshot of project health for stakeholders; PRINCE2's Highlight Report is the routine PM→Board update ([ProjectManager status](https://www.projectmanager.com/guides/status-report), [Mastt RAG](https://www.mastt.com/blogs/project-rag-status-dashboard), [prince2.wiki reports](https://prince2.wiki/management-products/reports/)).
- **(b) Data model:** `project`, `report_date`, `reporting_period`, `PM`, `sponsor`, `overall_RAG`, per-dimension RAG (`schedule`, `budget`, `scope`, `quality`, `resources`, `risk`), `executive_summary`, `accomplishments_this_period[]`, `planned_next_period[]`, `milestone_status[]`, `top_risks[]` (often top 5), `top_issues[]`, `key_decisions_needed[]`, `budget_spent_%`, `% complete`. RAG = Red (needs attention) / Amber (caution, managed) / Green (on track).
- **(c) Inputs:** Schedule, cost baseline, risk register, issue log, milestone list, prior report.
- **(d) Cadence:** **Weekly or per reporting period** (PRINCE2: per time-driven interval set by the Board).
- **(e) Amenability:** **ROLL-UP — very high.** The canonical "read all the records → render a snapshot template" report. RAG can be rule-computed (schedule variance > X → red) then narrated. Excellent scheduled-workflow + template-fill demo.
- **(f) Chain:** weekly trigger → pull schedule/cost/risk/issue deltas since last report → compute per-dimension RAG → draft narrative → fill report template → render docx/pptx → (optionally email).
- **(g) Generalizable:** **YES — very high.** "Scheduled roll-up snapshot of N data sources into a branded template" is THE generic reporting capability — applies to any domain dashboard/report.

### 18. Meeting Minutes (MoM)  *(Record / input artifact)*
- **(a) Purpose:** Documented record of a meeting: attendees, discussion, decisions, action items ([Wrike](https://www.wrike.com/blog/action-items-with-meeting-notes-template/), [Smartsheet](https://www.smartsheet.com/content/project-management-meeting-minutes-templates)).
- **(b) Data model:** `meeting_title`, `date/time`, `location`, `attendees[]` (name, role, present/absent), `agenda_items[]`, per-item `discussion_summary`, `decisions[]`, `action_items[]` (description, owner, due_date, status), `risks/issues_raised[]`, `next_meeting`.
- **(c) Inputs:** Agenda, live transcript/recording, chat.
- **(d) Cadence:** Per meeting (often daily standups → weekly status → milestone reviews).
- **(e) Amenability:** **EXTRACT — very high.** Transcript → structured minutes is a flagship LLM task, AND minutes are the #1 *input* that feeds risk/issue/RAID/action-item updates. **MoM is the hub input** of the daily routine.
- **(f) Chain:** transcript → generate minutes (decisions + actions) → fan out: actions → action register, risks → risk register, issues → issue log, decisions → decision log.
- **(g) Generalizable:** **YES — very high.** Universal "meeting → structured outcomes" pattern.

### 19. Decision Log + Action Item Register  *(Record)*
- **(a) Purpose:** Decision Log records key decisions, rationale, and who made them; Action Register tracks tasks with owners and deadlines ([ProjectManager decision log](https://www.projectmanager.com/blog/project-decision-log), [Asana action log](https://asana.com/templates/action-log)).
- **(b) Data model — Decision Log:** `decision_id`, `decision_statement`, `date`, `decision_makers[]`, `rationale`, `alternatives_considered[]`, `impact`, `status` (proposed/approved/declined/superseded), `approved_by`, `linked_actions[]`. **Action Register:** `action_id`, `description`, `owner`, `due_date`, `status`, `source` (which meeting/decision), `priority`, `notes`.
- **(c) Inputs:** Meeting minutes, change log, emails.
- **(d) Cadence:** Continuous; reviewed at every standup (open actions).
- **(e) Amenability:** **EXTRACT.** Direct downstream of MoM extraction.
- **(g) Generalizable:** **YES — high.** Universal decision/action tracking.

### 20. Lessons Learned Register & Project Closure / End Project Report  *(Record → Report)*
- **(a) Purpose:** Captures what went well/badly and recommendations (continuous in PRINCE2's **Lessons Log**), rolled into the closure report at project end ([PMI lessons](https://www.pmi.org/learning/library/lessons-learned-sharing-knowledge-8189), [PM Docs closure](https://www.projectmanagementdocs.com/template/project-closure/lessons-learned/)).
- **(b) Data model — Lessons Register:** `lesson_id`, `date`, `category` (planning/execution/comms/risk/procurement/quality — or by PMBOK knowledge area), `phase`, `situation/context`, `what_happened`, `impact`, `root_cause`, `what_went_well`, `what_to_improve`, `recommendation`, `recommendation_category` (process/people/tools/governance), `priority`, `owner`, `target_date`, `status`. **Closure Report** adds: objectives-vs-actuals, benefits realized, budget/schedule variance, deliverable acceptance, outstanding risks/issues handed to operations.
- **(c) Inputs:** Retro meeting notes, status reports, variance data, risk/issue history.
- **(d) Cadence:** Lessons captured **continuously**; closure report = one-shot at project/stage end.
- **(e) Amenability:** **EXTRACT + ROLL-UP + (cross-project RAG).** High value: a KB of lessons becomes *retrieval input to future charters/risk registers* — closes the learning loop. This is where our existing `remember/recall` + KB search shine.
- **(f) Chain:** retro transcript → extract lessons + recommendations → categorize → store in cross-project lessons KB → (at start of next project) retrieve relevant lessons into new risk register/charter.
- **(g) Generalizable:** **YES — very high.** Universal "post-mortem → reusable knowledge" loop.

---

## Cross-cutting analysis for v2.9 design

### A. The three workflow archetypes (map artifacts → harness primitives)

| Archetype | PRINCE2 type | Artifacts | Harness fit | LLM mode |
|---|---|---|---|---|
| **Generate-and-lock** | Baseline | Charter, Business Case, Scope Statement, WBS, Comms Plan, Cost/Schedule Baseline | `llm_single`/`llm_human_input` → publish → version-on-change | TEMPLATE-FILL + JUDGMENT |
| **Incremental register update** | Record | Risk, Issue, Change, Assumption, RAID, Stakeholder, Decision, Action, Lessons | recurring: ingest input → extract rows → dedupe/merge → upsert | EXTRACT (high amenability) |
| **Scheduled roll-up snapshot** | Report | Status/Highlight Report, Prob-Impact Matrix, Roadmap, EV Report, Closure Report | scheduled `programmatic`+`llm_single` reading records/baselines → render template | ROLL-UP |

### B. Amenability tiers (what to demo first)

- **Tier 1 — slam dunks (EXTRACT/ROLL-UP, low judgment):** Meeting-minutes generation, RAID log routing, Risk Register update, Issue Log, RTM traceability, Status Report roll-up, Prob-Impact Matrix projection, Lessons extraction. **These are the flagship demos.** They exercise: unstructured-input → structured-rows, dedupe/merge, score recompute, and template render.
- **Tier 2 — strong with a human gate:** Charter, Business Case, WBS, Scope, Stakeholder classification, Change impact assessment. LLM drafts, `ask_user` ratifies. Perfect for the harness's `llm_human_input` phase type + validation gates.
- **Tier 3 — compute-not-LLM:** Critical-path/float, EVM, cost roll-up, S-curve. Belongs in `programmatic`/`execute_code` phases; LLM only narrates results. **Design warning:** do NOT let the LLM "reason" schedule math.

### C. The "daily PM routine" reference chain (the demo spine)

The single most compelling demo is the **standup-to-artifacts cascade**, because it touches the most artifacts from one input:

```
Standup transcript (input)
  └─► [llm_single] generate Meeting Minutes (decisions + action items)
        ├─► [llm_agent] classify each note → RAID category
        │     ├─► Risks   → upsert Risk Register → [programmatic] recompute P×I + RAG → re-render Prob-Impact Matrix
        │     ├─► Issues  → upsert Issue Log; close resolved
        │     ├─► Actions → upsert Action Register; flag overdue
        │     ├─► Decisions → append Decision Log
        │     └─► Deps    → update Dependency tracker
        ├─► [programmatic] update schedule %complete from progress notes → recompute critical path
        └─► [llm_single, scheduled weekly] roll up all records → Status/Highlight Report (template-fill docx/pptx)
```

This one chain demonstrates: EXTRACT, dedupe/merge into a structured store, deterministic score recompute, projection rendering, and template-fill report — i.e. every capability v2.9 is trying to prove, in the flagship domain.

### D. Cross-domain generalizability verdict (design generic, not PM-hardcoded)

The catalog cleanly separates into **generic patterns** (build these as the platform capability) vs **PM-specific specializations** (ship as content/plugins, not core):

**GENERIC capabilities to build (reusable across every domain):**
1. **Typed register with lifecycle status** (Risk/Issue/Change/Stakeholder/Action/Lessons all share: id, description, owner, status, dates, scored fields). → one configurable "register" data primitive + RLS-scoped table or JSONB.
2. **Classify-and-route free text into a typed register** (RAID/minutes pattern). → generic extraction workflow.
3. **Bidirectional traceability graph** (RTM). → the single most reusable artifact; domain-agnostic "X traces to Y, report coverage gaps."
4. **Scheduled roll-up snapshot into a branded template** (Status Report). → the generic reporting/template-fill engine — directly serves the "upload docx/pptx template and fill from KB" v2.9 requirement.
5. **Generate-and-lock baseline doc with human ratification** (Charter/Scope/WBS). → maps to `llm_human_input` + publish/version.
6. **2-axis scored heatmap projection** (Prob-Impact). → generic `panel_renderer`.
7. **Cross-project knowledge loop** (Lessons → future inputs). → already partly built (`remember/recall` + KB search).

**PM-SPECIFIC (ship as a project's workflow library / plugin, NOT in core):**
- Critical-path / float computation, EVM, S-curve → candidate **`phase_type` plugin** (the deferred Plugin Contract).
- The specific column sets, RAG thresholds, P×I scales, engagement levels (Unaware→Leading), Power/Interest quadrants → **template/schema content** authored per project, not hardcoded.

**Implication:** The PM domain validates the v2.9 thesis perfectly — a *project = folder + workflow library + KB scope* where each workflow is "strictly one business requirement" maps directly onto "one artifact, one maintenance workflow." Build the 7 generic capabilities above; express PM (and any other domain) as **authored content** (template files + workflow definitions + register schemas), not code. The "upload a template temporarily and fill it from the KB" requirement is exactly capability #4, with the PM artifacts (charter.docx, status-report.pptx, risk-register.xlsx) as the flagship template set.

---

## Source list

- PMBOK 7 artifact categories: [Project Management Academy](https://projectmanagementacademy.net/resources/blog/types-of-project-management-artifacts/) · [Dee Project Manager](https://deeprojectmanager.com/project-management-artifacts/) · [TrustEd — Logs & Registers](https://trustedinstitute.com/concept/pmp-pmbok7/models-methods-artifacts/logs-and-registers/)
- PRINCE2 management products (baselines/records/reports): [whatisprince2.net](https://www.whatisprince2.net/management-products) · [prince2.wiki](https://prince2.wiki/management-products/) · [Knowledge Train](https://www.knowledgetrain.co.uk/project-management/prince2/prince2-management-products) · [Business Case](https://prince2.wiki/management-products/baselines/business-case/) · [Reports](https://prince2.wiki/management-products/reports/)
- Risk Register: [Smartsheet](https://www.smartsheet.com/risk-register-templates) · [Dee PM](https://deeprojectmanager.com/risk-register-template/) · [PRINCE2 template](https://mplaza.training/templates/prince2/risk-register/) · [PMI](https://www.pmi.org/learning/library/project-risk-management-success-tool-6078)
- Probability-Impact Matrix: [Mudassir Iqbal](https://mudassiriqbal.net/probability-and-impact-matrix/) · [PMTI](https://www.4pmti.com/learn/risk-probability-impact-matrix/) · [Project Mgmt Academy](https://projectmanagementacademy.net/resources/blog/risk-matrix/)
- RTM: [Requiment](https://www.requiment.com/requirements-traceability-matrix-rtm-guide/) · [project-management.com](https://project-management.com/requirements-traceability-matrix-rtm/) · [PMI-PBA TrustEd](https://trustedinstitute.com/concept/pmi-pba/requirements-traceability-monitoring/requirements-traceability-matrix/)
- WBS + Dictionary: [PMI basic principles](https://www.pmi.org/learning/library/work-breakdown-structure-basic-principles-4883) · [PMI WBS dictionary](https://www.pmi.org/learning/library/wbs-web-enabled-interface-process-7965)
- Schedule / Critical Path / Float: [ProjectManager](https://www.projectmanager.com/blog/critical-path-on-gantt) · [Asana CPM](https://asana.com/resources/critical-path-method)
- Cost Baseline / Budget: [Runn](https://www.runn.io/blog/cost-baseline) · [PM Study Circle](https://pmstudycircle.com/cost-baseline/) · [Galorath](https://galorath.com/project/baseline/cost/)
- Stakeholder Register / Engagement / Salience / Power-Interest: [PM Study Circle](https://pmstudycircle.com/stakeholder-engagement-assessment-matrix/) · [Project Mgmt Fandom](https://project-management.fandom.com/wiki/Stakeholders_engagement_assessment_matrix) · [BrainBOK classification](https://www.brainbok.com/guide/pm-study-notes/stakeholder-classification) · [PMI stakeholder analysis](https://www.pmi.org/learning/library/stakeholder-analysis-pivotal-practice-projects-8905)
- RAID Log: [Digital PM](https://thedigitalprojectmanager.com/project-management/raid-log/) · [Asana](https://asana.com/templates/raid-log) · [Smartsheet](https://www.smartsheet.com/content/raid-templates)
- Issue Log / Change Log: [Mastt issue log](https://www.mastt.com/resources/issue-log) · [ProjectManager change log](https://www.projectmanager.com/templates/change-log-template) · [Tactical PM](https://www.tacticalprojectmanager.com/change-log-template/)
- Communications Plan: [Smartsheet](https://www.smartsheet.com/content/project-communication-templates) · [PM Docs](https://www.projectmanagementdocs.com/template/project-planning/communications-management-plan/)
- Status / Highlight / RAG Report: [ProjectManager](https://www.projectmanager.com/guides/status-report) · [Mastt RAG](https://www.mastt.com/blogs/project-rag-status-dashboard)
- Project Charter: [Asana](https://asana.com/resources/project-charter) · [Smartsheet](https://www.smartsheet.com/content/project-charter-elements) · [6sigma.us](https://www.6sigma.us/project-management/elements-of-a-project-charter/)
- Meeting Minutes: [Wrike](https://www.wrike.com/blog/action-items-with-meeting-notes-template/) · [Smartsheet](https://www.smartsheet.com/content/project-management-meeting-minutes-templates)
- Decision Log / Action Register: [ProjectManager](https://www.projectmanager.com/blog/project-decision-log) · [Asana action log](https://asana.com/templates/action-log)
- Lessons Learned / Closure: [PMI](https://www.pmi.org/learning/library/lessons-learned-sharing-knowledge-8189) · [PM Docs](https://www.projectmanagementdocs.com/template/project-closure/lessons-learned/)
