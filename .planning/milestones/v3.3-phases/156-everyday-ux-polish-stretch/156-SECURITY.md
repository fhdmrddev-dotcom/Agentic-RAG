---
phase: 156-everyday-ux-polish-stretch
requirement: POLISH-01
audited: 2026-07-17
asvs_level: L1
block_on: [critical, high]
threats_total: 6
threats_closed: 6
threats_open: 0
status: SECURED
register_authored_at_plan_time: true
---

# Phase 156 — Everyday UX Polish (STRETCH): Security Audit (SECURITY.md)

Verification of every declared threat mitigation against the **implemented code** (not
documentation/intent). The STRIDE register was authored at plan time across all 4 PLANs
(`156-01`…`156-04`) and is treated as COMPLETE — this audit verifies dispositions, it does
not scan for new threats. All 3 SUMMARYs that carry a Threat-Surface section declare "No
`## Threat Flags` — nothing new introduced." Implementation files were READ-ONLY throughout.

**Verification method — short-circuit (workflow-sanctioned).** Per secure-phase Step 3,
`threats_open: 0 AND register_authored_at_plan_time: true` → the audit skips the
gsd-security-auditor spawn and the orchestrator verifies each mitigation directly against the
live tree. This is a pure-client, grep-verifiable register (no backend/auth/DB surface); every
control below was re-checked by hand (greps + the two security-relevant lock tests) rather than
trusted from the SUMMARY claims.

**Result: SECURED.** 6/6 threats resolved (4 `mitigate` verified in code, 2 `accept`
boundaries hold). 0 open. Diff scope confirmed against `git diff 8a875603^..8486e0c3` (all 4
plans + the code-review remediation + the collapsible-layout refinement) — **11 files, every
one under `frontend/**`**; no `backend/**`, no `*.py`, no auth/session/migration/SQL surface
touched (Architectural Responsibility Map: Browser/Client only).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| user-controlled thread title → rendered DOM | Auto-generated / user-renamed thread titles rendered by `HighlightTitle` across the history column, the ⌘K palette, and the mobile drawer | thread titles (owner-scoped, RLS) |
| keyboard/global shortcut → modal focus | ⌘K opens a modal over any view; focus-trap/Esc/restore crosses here | focus state only |
| client render ↔ RLS-scoped data | `threads`/`folders` are already owner/RLS-scoped by the backend; the client is **not** a trust boundary | owner-scoped thread/folder lists |

Pure-client IA refactor + polish. No endpoint, query, migration, auth path, or session is
added or changed by any of the 11 touched files.

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence (verified against live tree) |
|-----------|----------|-------------|--------|----------------------------------------|
| **T-156-01** | Tampering (stored XSS) — `HighlightTitle` title + filter highlight across the engine, `ChatHistoryColumn`, `ThreadCommandPalette`, and the mobile drawer | mitigate | **CLOSED** | `grep -rl dangerouslySetInnerHTML` across all 6 phase+refinement source files (`threadGroups.tsx`, `ChatHistoryColumn.tsx`, `NavPanel.tsx`, `ThreadCommandPalette.tsx`, `ChatLayout.tsx`, `ChatArea.tsx`) = **0 files**. Highlights render as JSX text nodes (React auto-escapes). `threadGroups.test.tsx` carries the `<img src=x onerror=…>` inert-text proof (3 `onerror` refs) — asserts the title renders as visible text with no `<img>` element. Test run green. |
| **T-156-02** | Information Disclosure — inline filter / ⌘K palette / mobile filter set ("loaded threads") | **accept** | **CLOSED** (accepted-risk — boundary held) | The filter/palette/drawer operate ONLY over the caller's own already-loaded, RLS-scoped `threads`; they add **no** fetch and **no** cross-user data path. Diff scope is `frontend/**` exclusively — client is not the trust boundary (ASVS V4 N/A). Logged AR-156-01. |
| **T-156-03** | Denial of Service / focus-trap correctness — the ⌘K modal focus-trap + Esc + restore | mitigate | **CLOSED** | `ThreadCommandPalette.tsx` imports `ui/dialog` / `@radix-ui/react-dialog` (3 matches); **0** hand-rolled focus-trap markers (`focusTrap`/`trapFocus`/manual Tab-keydown listeners). Focus-trap, Esc, scroll-lock, and focus-restore are delegated to the vendored, battle-tested Radix Dialog; the hand-owned code is only the inert `role=listbox` roving. |
| **T-156-04** | Information Disclosure — the `matchesTitle` predicate | **accept** | **CLOSED** (accepted-risk — boundary held) | `matchesTitle` is a pure substring test over the caller's own RLS-scoped threads; adds no fetch and no cross-user data. ASVS V4 N/A — client not a trust boundary. Logged AR-156-02. |
| **T-156-05** | Elevation of Privilege — the operator (Control Room) shield in the rail + mobile drawer | mitigate | **CLOSED** | `nav-items.test.ts` lock test **passes** (part of the 22-green run). The `NAV_ITEMS` array (`nav-items.ts:30-59`) holds only chat / workflows / documents / classification-rules / library-health / governance / skills / settings — **no control-room/operator route entry**. The 7 `grep -i 'operator\|control room'` hits are ALL in comments/JSDoc (VIS-01 vanish-behavior prose), not array members. The shield renders in NavPanel's footer gated by `isOperator &&` (5 refs), OUTSIDE the array (D-07 non-discoverable contract). |
| **T-156-SC** | Tampering (supply chain) — npm installs | mitigate | **CLOSED** | `grep -c cmdk frontend/package.json` = **0**; no `from "cmdk"` anywhere in `src/`. The ⌘K palette is hand-rolled on the already-present `@radix-ui/react-dialog`; **no package was installed this phase**, no install task, no `checkpoint:human-verify`. Supply-chain surface unchanged. |

*Status: open · closed — Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Unregistered Flags

**None.** All 3 SUMMARYs carrying a Threat-Surface section (`156-02`, `156-03`, `156-04`)
declare "No `## Threat Flags` — nothing new introduced"; `156-01` (the shared engine) built
the T-156-01 XSS control itself. Every changed file maps to a registered threat's disposition
or is inert (tests, presentational rail/column/handle markup). No `unregistered_flag` logged.

---

## Code-Review Findings (context — remediation confirmed in HEAD)

`156-REVIEW.md` opened findings (HI-01 folder-group keying + LW-01/02/03 + MD-01). All are
addressed in the committed HEAD and independently live-re-confirmed (see
`156-VERIFICATION.md` "Live Felt-Experience UAT Results" + the refinement note):

- **HI-01** (folder view: duplicate groups) — fixed `c0fbf22b`; live-confirmed (folder view:
  no duplicate groups, "Unfiled" 361 last, 399 threads preserved).
- **MD-01** (New-Chat-from-Settings error path) — happy path works; the fire-and-forget error
  path is the pre-existing app-wide pattern, skipped-with-rationale in the REVIEW remediation
  table. Not a security finding (no trust boundary).
- **LW-01/02/03** — fixed `c0fbf22b`.

These are UX hardening, not part of the declared threat register; noted for completeness.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-156-01 | T-156-02 | The inline column filter, the ⌘K palette, and the mobile drawer search all narrow ONLY the caller's own already-loaded, RLS-scoped `threads` — no new fetch, no cross-user query, no server round-trip. The client is not the trust boundary (ASVS V4 N/A); diff scope is `frontend/**` exclusively. Accepted residual: a user can search their own thread titles client-side, which is the intended feature. | Operator (secure-phase gate) | 2026-07-17 |
| AR-156-02 | T-156-04 | The shared `matchesTitle` predicate is a pure client-side substring test over the same owner-scoped `threads` set; it adds no data access. Same boundary as AR-156-01. | Operator (secure-phase gate) | 2026-07-17 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-17 | 6 | 6 | 0 | secure-phase orchestrator (short-circuit: register@plan-time + threats_open:0 — mitigations verified against the live tree via grep + `nav-items.test.ts`/`threadGroups.test.tsx` lock tests; auditor spawn skipped per Step 3) |

---

## Sign-Off

- [x] All threats have a disposition (4 mitigate / 2 accept)
- [x] Accepted risks documented in Accepted Risks Log (AR-156-01, AR-156-02)
- [x] `threats_open: 0` confirmed
- [x] `status: SECURED` set in frontmatter

**Approval:** verified 2026-07-17

---

## Result

**SECURED — 6/6 threats CLOSED (4 mitigate verified in code, 2 accept boundaries held), 0 open.**
No implementation gap. Phase 156 may ship on the security axis. The whole phase — including the
collapsible-layout refinement (`8486e0c3`) — is frontend-only (11 files, all `frontend/**`), so
no server-side trust boundary was introduced. (The live-browser felt-experience UAT half was
closed separately in `156-VERIFICATION.md` "Live Felt-Experience UAT Results" and the 9/9-pass
`156-UAT.md` — the source of truth for the SC + refinement runtime proofs.)
