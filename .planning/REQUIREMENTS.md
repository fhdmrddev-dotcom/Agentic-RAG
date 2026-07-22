# Requirements: v3.5 UX Consolidation & Chat Polish

**Defined:** 2026-07-22
**Core Value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.

**Milestone goal:** Clear the parked chat-surface bug backlog and consolidate the accumulated UI/UX rough edges — including the new v3.4 org surfaces — into one coherent, polished, honest experience, before the large v3.6 Visual Workflow Studio build. A **Medium cleanup milestone** — mostly bug-fix + polish, no large net-new build; deliberately kept separate from v3.6 (operator-confirmed split).

> **Reported-bugs mandate:** this milestone is the home of the parked `surface: Agentic-RAG` chat-surface backlog. Each requirement below names its **source reports** under `.planning/reported-bugs/`. At every `/gsd:discuss-phase`, re-list open/deferred `surface: Agentic-RAG` reports and fold the matching ones explicitly (some "open" reports may already be fixed-pending-verification — triage fix-vs-verify at discuss-phase).

---

## v1 Requirements (CORE — committed)

The parked chat-surface bug backlog + v3.4 org-surface polish. Each maps to exactly one roadmap phase.

### STATE — Run-state & lifecycle honesty

- [x] **STATE-01**: A cancelled or killed run never leaves an empty chat bubble or an orphaned run card — the surface honestly reflects "cancelled — no output yet"
- [x] **STATE-02**: The "Response stopped" / stop indicator survives navigation away-and-back AND a full reload
- [x] **STATE-03**: The "Setting up agent…" state no longer hides live model activity — the user sees the model working during setup
- [x] **STATE-04**: Run timers stay accurate across navigation — no timer reset or duplicate avatar when navigating to a workflow run

*Source reports: `cancelled-run-empty-bubble-early-cancel`, `killed-workflow-empty-chat-card`, `cancelled-run-stop-indicator-lost-on-navigation`, `setting-up-agent-hides-model-activity`, `BUG-260610-01-workflow-run-nav-timer-reset-duplicate-avatar`.*

### XPROV — Cross-provider streaming fidelity

- [x] **XPROV-01**: Newer reasoning models (gpt-5.6 and class) send correct request params — no model-parameter 400 errors on chat or with tools
- [ ] **XPROV-02**: DeepSeek tool-call markup never leaks into the visible chat content (re-parse/strip guard holds on long turns)
- [x] **XPROV-03**: Title-generation cross-provider fallback is honest — no misleading fallback banner when a provider succeeds

*Source reports: `BUG-260714-01-gpt56-model-parameter-error`, `BUG-260711-02-gpt56-reasoning-tools-chat-completions-400` (deferred), `BUG-260708-01-deepseek-tool-call-markup-leak-reparse`, `BUG-260623-01-title-gen-cross-provider-fallback-banner`.*

### RENDER — Chat render correctness

- [ ] **RENDER-01**: No duplicate user message bubble (optimistic temp row + persisted row must reconcile to one)
- [ ] **RENDER-02**: The final answer renders un-folded at a clean terminal — no reload required to see it out of the narration fold
- [ ] **RENDER-03**: No intermittent silent send-drop — a submitted general-chat message always sends or surfaces an honest failure
- [ ] **RENDER-04**: An approved skill/description version pointer updates in the UI without a reload

*Source reports: `BUG-260712-02-duplicate-user-bubble-optimistic-temp-plus-persisted-row`, `BUG-260707-03-final-answer-stays-folded-in-narration-until-reload`, `general-chat-intermittent-silent-send-drop`, `BUG-260706-01-approve-description-version-pointer-stale-until-reload`. Related open minor: `BUG-260609-02`, `BUG-260609-04`.*

### EXEC — Code execution reliability

- [ ] **EXEC-01**: The `execute_code` tool's `libraries` parameter installs the requested packages reliably (no silent no-op / wasted retry rounds)

*Source report: `BUG-260708-02-execute-code-libraries-param-unreliable-install`.*

### ORGUX — v3.4 org-surface polish

- [ ] **ORGUX-01**: The org-admin shell, org switcher, and profile-menu identity anchor are polished and honest across states (member vs org-admin, 1-org vs multi-org)
- [ ] **ORGUX-02**: The invitations and SSO surfaces (invite dialog, invitations tab, `/invite` landing, SSO tab, identifier-first sign-in) are polished and error-honest

*Source: new v3.4 surfaces shipped in phases 166–168 (no bug reports yet — proactive polish while fresh). Cross-provider/live-UAT status-lag on 166/167/168 rolls in here.*

---

## STRETCH Requirements (gated behind CORE — ship only if CORE lands clean and budget remains)

Committed to the roadmap as gated phases (v2.9 105-109 / v3.1 125-131 / v3.2 138-144 / v3.3 156-159 / v3.4 169-173 precedent). Operator selected all three tracks at scoping.

### POLISH — Chat UI/UX polish seeds

- [ ] **POLISH-01**: The SEED-045 minor-enhancements umbrella — the remaining collected chat/nav polish items (the rail New-Chat + chat-list usability anchors already shipped in Phase 156; this is the remainder)
- [ ] **POLISH-02**: Provider logos / nav-presence consistency across the chat surface (SEED-058)
- [ ] **POLISH-03**: The citation footer is legibly a superset of the inline `[n]` markers — cited-vs-retrieved is clear (SEED-119)
- [ ] **POLISH-04**: A run-state-aware todos panel — todos reflect the live run's state honestly (SEED-105)
- [ ] **POLISH-05**: Workspace-panel reliability + polish pass (SEED-039)

*Seeds: SEED-045, SEED-058, SEED-119, SEED-105, SEED-039. Note: SEED-098 (tool-card dedup) already largely shipped via quick-task 260630-226 — verify/close, not a fresh build (see Out of Scope).*

### LANG — Plain-language / terminology extensions

- [ ] **LANG-01**: Extend the v3.3 plain-language layer (LANG-01 / `termMap`) onto the new org + chat surfaces so jargon doesn't creep back in (SEED-085)

*Seed: SEED-085. Extends the shipped v3.3 Phase-154 plain-language reveal.*

### LOOP — Agent-loop behavior honesty (deferred majors)

- [ ] **LOOP-01**: The agent honors an explicit step-by-step / todo-loop request instead of collapsing it into one turn
- [ ] **LOOP-02**: Anthropic's end-of-cycle output shows a user-facing summary, not a raw action list
- [ ] **LOOP-03**: Excessive tool iterations on multi-step tasks are reduced (bounded / honest)

*Source reports (deferred majors/minors, touch the agent loop — G-5 care): `agent-ignores-step-by-step-request-no-todo-loop`, `anthropic-end-of-cycle-shows-actions-not-summary`, `anthropic-excessive-tool-iterations-on-multi-step-tasks`. Related deferred: `BUG-260626-02` (baseline leak into final-emit), `BUG-260626-03` (run-end todo finalizer). May warrant its own careful phase.*

---

## Out of Scope

Explicitly excluded from v3.5. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Visual / No-Code Workflow Studio (SEED-123) | The v3.6 milestone — a Large net-new build; operator-confirmed to stay a **separate** milestone from this cleanup pass. Requirements captured in SEED-123. |
| Config-consolidation retrofit (SEED-117 §1/§3) | Deferred, slot TBD (the pure "retrofit every knob into Control Room tabs" + prompt governance + cost/budget caps + scheduler). Not this milestone. |
| v3.4 STRETCH carry-forwards (169–173) | Dept-admin, entitlements, permission-aware citations, OIDC SSO, dept-skills — fold back per their own `re_open_trigger`s in `v3.4-STRETCH-CARRYFORWARD.md`, not auto-pulled into v3.5. |
| Any net-new feature capability | v3.5 is cleanup + polish only — no new user-facing capability. |
| OpenRouter-specific bugs (BUG-260714-02) | OpenRouter is experimental (external upstream 404 / no-endpoints); fix only if native-safe + low-complexity, never at the cost of the shared path. |
| SEED-098 tool-card dedup (fresh build) | Already largely shipped via quick-task 260630-226 (unified essence line). At most a verify/close, not a new POLISH requirement. |
| New migrations unless a fix truly needs one | Cleanup milestone — prefer app-layer fixes; migrations start at slot 114 only if a bug fix genuinely requires schema change. |

---

## Traceability

Which phases cover which requirements. Populated during roadmap creation (`/gsd:new-milestone` → roadmapper).

| Requirement | Phase | Status |
|-------------|-------|--------|
| STATE-01 | Phase 174 | Complete |
| STATE-02 | Phase 174 | Complete |
| STATE-03 | Phase 174 | Complete |
| STATE-04 | Phase 174 | Complete |
| XPROV-01 | Phase 175 | Complete |
| XPROV-02 | Phase 175 | Pending |
| XPROV-03 | Phase 175 | Complete |
| RENDER-01 | Phase 176 | Pending |
| RENDER-02 | Phase 176 | Pending |
| RENDER-03 | Phase 176 | Pending |
| RENDER-04 | Phase 176 | Pending |
| EXEC-01 | Phase 176 | Pending |
| ORGUX-01 | Phase 177 | Pending |
| ORGUX-02 | Phase 177 | Pending |
| POLISH-01 | Phase 178 | Pending (STRETCH) |
| POLISH-02 | Phase 178 | Pending (STRETCH) |
| POLISH-03 | Phase 178 | Pending (STRETCH) |
| POLISH-04 | Phase 178 | Pending (STRETCH) |
| POLISH-05 | Phase 178 | Pending (STRETCH) |
| LANG-01 | Phase 179 | Pending (STRETCH) |
| LOOP-01 | Phase 180 | Pending (STRETCH) |
| LOOP-02 | Phase 180 | Pending (STRETCH) |
| LOOP-03 | Phase 180 | Pending (STRETCH) |

**Coverage:**
- CORE requirements: 14 total → Phases 174-177
- STRETCH requirements: 9 total → Phases 178-180
- Mapped to phases: 23 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-22*
*Last updated: 2026-07-22 after v3.5 roadmap creation (23/23 requirements mapped to Phases 174-180)*
