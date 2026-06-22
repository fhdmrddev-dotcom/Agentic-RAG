---
phase: 121
slug: one-front-door-for-workflows-ia
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-23
---

# Phase 121 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
>
> **Phase shape:** pure frontend removal. The Deep/Harness composer toggle (`workflow-mode-selector`)
> and the in-chat workflow picker (`workflow-picker`) — plus their props/state/handlers — were deleted
> from `MessageInput.tsx` and `ChatArea.tsx`, leaving a 2-pill composer (Model + General/Explorer).
> The server-enforced lock authority (409), the per-thread workflow lock, the mount reconcile, and the
> Workflows-page launch route are all in the PRESERVE LIST and were left byte-identical. **Zero backend
> files, zero migrations, and zero packages were touched** (diff `131584b6^..HEAD` spans only 2 frontend
> source files + 3 test files). A removal that reduces client surface while never weakening server
> authority is **net neutral-to-positive** for the security posture.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client (composer / React) → API (`backend/app/api/threads.py`) | Mode-switch + send requests cross here; the **server is the authority**. This phase only removes client UI on the client side of the boundary — the server route is untouched. | Thread mode-switch + chat send (user-scoped JWT auth at the API) |
| Thread A run state → Thread B composer | The per-thread workflow lock must never leak across threads — it is keyed by the owning thread id, never global. | Per-thread lock state (in-client store, owner-scoped) |
| test harness → component under test (Plan 02) | Vitest renders real components and mocks the api + store seams; no real network, no real auth. No production trust boundary is crossed by tests. | None (mocked seams) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-121-01 | Elevation of Privilege | composer mode control → `threads.py` 409 lock | mitigate (preserve) | Client-side mode bypass (forging "Deep" to escape a Harness lock) is mitigated by the **server-enforced 409**, which is unchanged. Removing the pill *reduces* client surface and cannot weaken the server. 409 banner preserved at `ChatArea.tsx:470-471` (`reconcileError instanceof ApiError && reconcileError.status === 409 ? "workflow-lock-error-banner"`); backend `threads.py` untouched (phase diff for `backend/` is empty). Plan 02 keeps the 409 test (`ChatAreaBanner` test b) byte-unchanged GREEN as the asserted contract. | closed |
| T-121-02 | Tampering | `useWorkflowLockForThread(thread?.id)` per-thread lock | mitigate (preserve) | Cross-thread lock leak (Thread A's run locking Thread B) is mitigated — the lock is keyed by the **owning thread id**, never global. Preserved at `ChatArea.tsx:85` (`useWorkflowLockForThread(thread?.id ?? null)`) and the full `getThreadWorkflow` set/clear-per-thread reconcile at `ChatArea.tsx:161-179`. **Live UAT proof:** parallel-thread axis passed — Thread A locked + Thread B free simultaneously, no bleed (121-HUMAN-UAT.md axis 2, 4/4 PASS). | closed |
| T-121-03 | Injection / XSS | removed pill labels | mitigate (eliminated) | The removed pills rendered enum-derived labels (`"Deep"`/`"Harness"`, workflow names) as React **text children** (auto-escaped), never `innerHTML`. Removing them eliminates the (already-nil) surface entirely. No new render path was added (D-01 — no `.runchip`; D-04 — no chat-side workflow nudge). Source scan of both changed files finds **no `dangerouslySetInnerHTML`/`innerHTML` sink** (the sole match is a comment documenting React text-escaping). | closed |
| T-121-SC | Tampering (supply-chain) | npm / pip / cargo installs | accept | **Zero packages added or removed** in this phase (RESEARCH § Package Legitimacy Audit: N/A; both SUMMARYs `tech-stack.added: []`). Verified: phase diff `131584b6^..HEAD` touches no `package.json`, no lockfile, no `backend/`, no `supabase/migrations/`. No supply-chain surface. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-121-01 | T-121-SC | Supply-chain risk accepted as N/A — Phase 121 is a pure removal that adds/removes zero packages (vitest/RTL already present). No new dependency surface to vet. | Developer (secure-phase) | 2026-06-23 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-23 | 4 | 4 | 0 | Claude (secure-phase orchestrator — short-circuit: plan-time register, all CLOSED; controls hand-verified in source + live UAT corroboration, not rubber-stamped) |

**Method note:** `register_authored_at_plan_time: true` (both 121-01-PLAN.md and 121-02-PLAN.md carry parseable `<threat_model>` blocks) and `threats_open: 0` ⇒ the workflow short-circuit applies (no user gate, no auditor spawn). Per project secure-phase discipline the orchestrator did **not** rubber-stamp: all 4 controls were verified in shipped source (`rg`/`git diff` evidence cited per row) and the two preserve-controls (T-121-01 409, T-121-02 per-thread lock) are independently corroborated by the live SC#10 UAT (121-HUMAN-UAT.md, 4/4 PASS). No mitigation is vacuous.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-23
