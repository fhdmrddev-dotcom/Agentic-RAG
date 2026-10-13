---
phase: 278
slug: one-home-for-tools-and-filters
status: verified
threats_open: 0
asvs_level: 1
created: 2026-10-13
register_authored_at_plan_time: true
verification_mode: self-verified
---

# Phase 278 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> The register was written at plan time (20 threats across 278-01..04, all `mitigate`). The audit
> verified that each mitigation exists. It did not scan for new threats. All evidence was re-run at
> HEAD `275c7777b` on 2026-10-13 rather than copied from a SUMMARY.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| model → dispatch_tool → handler | Tool names and arguments from the LLM reach the closed registry. The handlers enforce the folder-scope wall, skill org visibility, the retention wall, the connector trifecta + approval, the phase whitelist and the capability kill-switch | untrusted model output; reaches the user's KB, sandbox and connectors |
| agent/user filter → SQL column | A date word chosen by the model or a saved View maps to a column name used in a query | closed-choice identifier → SQL |
| test suite → security walls | The walls are proven only by fences and patches. A vacuous fence, or a patch that reaches nothing, silently loses that proof | proof integrity |
| operator browser → backend → Anthropic | SC#5 live smoke: one real two-tool turn through the split dispatcher | user KB content, sandbox code |
| executor → databases | Evidence reads the LOCAL dev DB. The Supabase MCP points at PRODUCTION and its writes are approval-gated | read-only SELECTs |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (evidence at HEAD) | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-278-01 | Elevation of privilege | `_TOOL_REGISTRY` | mitigate | `test_278_registry_pin.py` green: names, order and bindings vs base, static-literal AST, mutation scan | closed |
| T-278-02 | Tampering | tool schemas sent to providers | mitigate | `test_278_registry_pin.py` sha256 of `get_tools()` over 8 flag combos + `RENDER_TEMPLATE_TOOL`, green | closed |
| T-278-03 | Elevation of privilege (undetected) | absence fences (expert handlers, born_for, auth_scheme, retention, list_connections) | mitigate | anchor-first asserts + `seen == len(...)` in `test_222_auth_scheme`, `test_264_born_for_carrier`, `test_264_load_skill_born_for`, `test_275_agent_wall`, `test_075_1_observability`: 75 passed | closed |
| T-278-04 | Repudiation | "tests changed only by retargets" | mitigate | `scripts/check-test-retarget-only.py` exists, absolute no-assert rule (WR-04 hardened `c6316eb0a`) | closed |
| T-278-05 | Denial of service (gate) | backend gate 71/71 | mitigate | AST pin as `xfail(strict=True)`; `278-base-failed.txt` recorded; final gate failing SET == base (`520d5e2ad`) | closed |
| T-278-06 | Tampering | date word → column map | mitigate | `test_278_vocabulary_one_home.py` green: pinned values + key order, `is` identity, AST ban on literal copies (widened WR-03 `c2f3411f2`) | closed |
| T-278-07 | Information disclosure | Find / Views / agent filter results | mitigate | base-value pin green; full unit gate failing set == base; SEED-336 deliberately unchanged | closed |
| T-278-08 | Denial of service (boot) | new import edge into the three importers | mitigate | `document_vocabulary.py` has zero `app` imports (grep: none) | closed |
| T-278-09 | Elevation of privilege | moved handlers (`_doc_out_of_scope`, `_resolve_skill_visibility_or`, `unretrievable`, connector approval) | mitigate | `test_278_pure_move.py` green: 99 bindings AST-identical to `25b4235c5`, one home each, symtable check, fresh-interpreter import | closed |
| T-278-10 | Tampering (silent) | test patches after the move | mitigate | `tool_dispatcher.py` drops unused imports; `test_278_pure_move.py` §6 asserts the D-04 re-exports are the same objects | closed |
| T-278-11 | Repudiation | move commit retarget-only | mitigate | `check-test-retarget-only.py 18abc1ed5~1 18abc1ed5` → `CLEAR`, exit 0 | closed |
| T-278-12 | Tampering | comments/docstrings carrying security rationale | mitigate | `--no-loss 18abc1ed5~1 18abc1ed5` → `CLEAR` (4,332 removed lines all reappear), exit 0 | closed |
| T-278-13 | Elevation of privilege | dynamically registered tool | mitigate | registry pin green; `check-extension-contract.cjs` audits 17 files incl. every `tools/*.py`, 0 violations; `test_255_extension_contract_guard.py` green | closed |
| T-278-14 | Tampering | SSTI containment in render driver | mitigate | `test_190_ssti_fence.py` repointed to `tools/render_template.py`, green | closed |
| T-278-15 | Denial of service (boot) | import cycles | mitigate | no `tools/*.py` imports `tool_dispatcher` at module level (grep: none); pure-move fresh-import test green | closed |
| T-278-16 | Repudiation | `search.query` audit trail after the move | mitigate | SC#5 live row `b3d65512`, run_id `09c962aa-…`, key set == pre-278 (`278-VALIDATION.md`) | closed |
| T-278-17 | Tampering | production database | mitigate | evidence by local asyncpg reads only; no Supabase MCP call and no write in this phase | closed |
| T-278-18 | Information disclosure (silent regression) | full unit suite | mitigate | failing node-id SET normalised and compared to base: identical at 71 | closed |
| T-278-19 | Repudiation (record rot) | CLAUDE.md / ledger / SEED-224 | mitigate | corrections beside originals (`3b625c8fd`); size, ledger and seeds gates exit 0 at HEAD | closed |
| T-278-20 | Tampering | `retrieval_service.py` comment edit | mitigate | `ast.dump` of `2757b9e51~1` vs HEAD identical (re-run 2026-10-13) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks.

Residual notes. These are not threats in the register, and are recorded so they are not lost:

- WR-04's wrong-family retarget case (a path repointed to the wrong `tools/*.py` module) is not detected by the checker. It is documented under "HOW THIS COULD LIE" in `scripts/check-test-retarget-only.py`. The anchor-first fences (T-278-03) fail if the anchor is absent from the new target, which covers the security-bearing fences.
- `tests/integration` was not run (it mutates the local DB). The security-bearing walls are proven by the unit-level fences above.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-13 | 20 | 20 | 0 | Claude (orchestrator, self-verified; evidence re-run at HEAD — 69 pins + 75 fence tests passed, both checkers CLEAR, extension gate 0 violations) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-13
