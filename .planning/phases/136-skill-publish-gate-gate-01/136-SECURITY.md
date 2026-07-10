---
phase: 136
slug: skill-publish-gate-gate-01
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-03
---

# Phase 136 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> GATE-01 — the skill publish gate (server-enforced eval-pass gate on private→global share).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client → `PATCH /skills/{id}/toggle-global` | Untrusted `override` flag + any client-supplied gate data; the server is the enforcement point | `{override: bool}` (all other gate data ignored) |
| client → `POST /skills` | Untrusted `is_global` on create — the born-global bypass vector | `SkillCreate` body (`is_global` ignored, hard-set false) |
| client → `GET /skills/{id}/publish-gate` | Any authenticated user can request a gate compute for a skill id — must be owner-scoped | skill_id (path) + auth user |
| toggle handler → `skill_publish_overrides` | Service-role INSERT (bypasses RLS); app-code `.eq(user_id)` is the real gate | override audit row (gate snapshot + when) |
| gate compute → eval substrate | Reads `eval_runs`/`skill_versions`/`skills`; must not trust display labels (`verdict_summary`) as truth | numeric `passed_count`/`measured_count`, pinned `instructions` |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-136-01 | Elevation of Privilege (mass-assignment) | `create_skill` `is_global` | mitigate | `create_skill` insert hard-sets `"is_global": False` ignoring the body; import path also hard-codes false | closed |
| T-136-02 | Tampering / Repudiation | toggle-global override | mitigate | Server re-verifies ownership, recomputes the gate, RECORDS the override (gate snapshot + skill_version_id + when) into append-only, write-policy-less `skill_publish_overrides` | closed |
| T-136-03 | Tampering (forged gate payload) | toggle / GET publish-gate / client renderers | mitigate | Server ignores client gate data; recomputes from `eval_runs`; 409 body is server→client only; all three client renderers render server fields, never compute `met` | closed |
| T-136-04 | Information Disclosure (IDOR) | gate compute reads / override table / toggle endpoints | mitigate | Every read/write filtered by `.eq("user_id", user_id)`; endpoints owner-verify (403) before compute; owner-only SELECT RLS on `skill_publish_overrides` (migration 084, verified live) | closed |
| T-136-05 | Tampering (integrity of the "proven" claim) | gate compute D-04 | mitigate | Content-equality binds a passing run to the CURRENT instructions; an edit or old-version pass never satisfies the gate | closed |
| T-136-06 | Elevation of Privilege (client-side bypass) | direct API call skipping the dialog | mitigate | Server is the gate — a direct PATCH without a passing eval still 409s; dialog is UX only; force-publish only sends `override=true` which the server records | closed |
| T-136-07 | Tampering (display-label drift) | gate compute D-03 | mitigate | `met` recomputed from numeric `measured_count`/`passed_count`; `verdict_summary` text never trusted | closed |
| T-136-SC | Tampering (supply chain) | pip/npm installs | accept | Zero new packages — Package Legitimacy Audit N/A; no new supply-chain surface | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Evidence (grep-verified in implemented code)

- **T-136-01** — `backend/app/api/skills.py:185` `"is_global": False,  # HARD-SET — never from the caller (D-08 / T-118-02-01)`; import path `backend/app/api/skills.py:255` `"is_global": False`. Regression test `test_create_skill_ignores_body_is_global` + `test_import_and_save_skill_stay_private`.
- **T-136-02** — `backend/app/api/skills.py:459-497`: on `not gate.met and body.override`, resolves latest `skill_version_id` (`:466-478`) then INSERTs one `skill_publish_overrides` row with `gate_state` (`:487`), `gate_snapshot` = `{measured_count, passed_count, reason}` (`:488-492`), `user_id`, and DB-default `created_at` — both reads/write `run_in_threadpool`-wrapped. Ownership re-verified `:431-432`; gate recomputed `:451`. Migration `supabase/migrations/084_skill_publish_overrides.sql:39-71` is append-only with zero INSERT/UPDATE/DELETE policies. Test `test_force_publish_records_override`.
- **T-136-03** — Server recompute: `skills.py:451` (toggle) and `:540` (GET) call `compute_publish_gate`; 409 detail is server→client only `skills.py:455-458`. Client renders server fields only — `PublishGateDialog.tsx:110-126` (`gate.met`/`gate.passed`/`gate.measured`/`gate.state`/`gate.reason`), `SkillEvalSection.tsx:543-567`, `api.ts:1593-1605` (409 surfaces the server `gate` via `PublishGateError`, never fabricates a pass). No client-side `met` computation exists.
- **T-136-04** — Owner-scoping `.eq("user_id", …)` on every read: `publish_gate_service.py:78, 96, 113, 129`; toggle writes `skills.py:432, 471, 486, 505`; GET `skills.py:529`. Endpoint owner-verify 403: `skills.py:436-440` (toggle), `:535-539` (GET). RLS confirmed LIVE on `:54322`: `relrowsecurity=True`, exactly one policy `SELECT USING (auth.uid() = user_id)`, zero write policies.
- **T-136-05** — `publish_gate_service.py:145-147` `_on_current_version`: `pinned_instructions is not None and pinned_instructions == current_instructions` (content-equality, never version-id). Tests `test_edit_after_pass_resets_gate`, `test_promoted_near_dup_version_counts_as_current`.
- **T-136-06** — `skills.py:450-458`: gate check inside the `new_value is True` branch raises 409 on unmet+no-override regardless of the client path; `SkillCard.tsx:225-233` dialog is UX only. Test `test_toggle_global_blocked_when_no_passing_eval`.
- **T-136-07** — `publish_gate_service.py:53-62` `_passes_d03` reads only numeric `measured_count`/`passed_count`; no reference to `verdict_summary` anywhere in the gate compute. Test `test_interrupted_run_does_not_satisfy`.
- **T-136-SC** — All four plan summaries (`136-0{1..4}-SUMMARY.md`) declare `tech-stack.added: []`; no `requirements.txt` / `package.json` dependency change in the phase diff.

---

## Unregistered Flags

None. All four plan SUMMARY files ("Threat Surface" / "Threat Surface Scan" sections) explicitly declare "No new threat surface" / "No threat flags" — no new network endpoint (the two new routes are registered threats), auth path, file access, or schema surface appeared during implementation beyond the authored register. Every new surface (the gated toggle, `GET /skills/{id}/publish-gate`, `skill_publish_overrides`) maps to an existing threat ID.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-136-01 | T-136-SC | Zero new pip/npm packages introduced by Phase 136 (all four plan summaries: `tech-stack.added: []`). No new supply-chain surface; Package Legitimacy Audit is N/A. | gsd-security-auditor | 2026-07-03 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-03 | 8 | 8 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-03
