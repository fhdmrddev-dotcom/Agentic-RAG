---
phase: 099
slug: 099-workflow-skill-composition
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-10
---

# Phase 099 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Produced by gsd-secure-phase on 2026-06-10 against the post-gap-closure codebase
> (Plans 099-05 / 099-06 merged; re-verification PASSED 7/7 per 099-VERIFICATION.md).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| JSONB authored definition → typed model | `workflow_definitions.definition` JSONB is parsed via `WorkflowDefinition.model_validate()`; a typo'd, injected, or half-formed key is untrusted input crossing into the engine | Phase configs including `skill_ref` (UUID) and `skill_snapshot` (materialized object) |
| Kickoff request → skill resolution | At run-start the HTTP caller's `user_id` scopes the skill resolve query; service-role DB client bypasses RLS, so caller identity is the only ownership check | Skill visibility, enabled-state; the snapshot prefix root |
| Snapshot materializer → Storage | Service-role Storage client writes to `{user_id}/_snapshots/...`; first-segment of the object key determines which authenticated-user's RLS SELECT grant applies | Skill file bytes; the Storage prefix ownership invariant |
| Sub-agent dispatch → tool handler | `run_task_sub_agent` builds `sub_ctx`; the snapshot field on that context gates the `_handle_read_skill_file` resolution path | Snapshot object (instructions, file manifest, storage prefix) |
| Live skill storage → snapshot read | `_handle_read_skill_file` calls Storage either via the snapshot prefix or the live skill prefix depending on `ctx.skill_snapshot` | Skill file bytes |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-099-01 | Tampering / intent violation | Disabled-skill resurrection — publish gate + kickoff | mitigate | `validate_skill_refs` gates on `.eq("is_enabled", True)` + `_is_resolvable` re-check; disabled skill → generic `ValueError` → `HTTPException(400)` BEFORE materialize or run-create; covered by `test_publish_gate_rejects` case (c) | closed |
| T-099-02 | Elevation / IDOR | `skill_ref` pointing at another user's private skill | mitigate | Resolve query uses owned-or-global `.or_(user_id.eq…,is_global.eq.true)`; non-visible id resolves to no row; generic error message never confirms another user's skill exists; kickoff uses `current_user["id"]` as the scope; covered by `test_publish_gate_rejects` case (b) | closed |
| T-099-03 | Information Disclosure | Private skill content copied into snapshot | accept | Accepted; documented in `skill_snapshot.py` module docstring lines 31-38 ("THREAT (T-099-03 / Information Disclosure, ACCEPTED — documented for Phase 109)") — the `{user_id}/_snapshots/...` prefix keeps existing first-segment SELECT RLS; no self-serve global publish today; the prefix is the declared seam for Phase 109 | closed |
| T-099-04 | Tampering | `skill_ref` / `skill_snapshot` JSONB injection on phase configs | mitigate | `_StrictBase ConfigDict(extra="forbid")` rejects any unknown or injected key at `model_validate()` (harness.py:30); `test_skill_ref_additive_optional` asserts a typo'd key raises `pydantic.ValidationError` | closed |
| T-099-05 | Tampering (red-line breach) | Deep byte-identical — `ToolContext.skill_snapshot` default | mitigate | Field defaults `None` at `tool_dispatcher.py:114`; gate in `_handle_read_skill_file` is `if snapshot is not None` (line 479); `_effective_tools` and `_skill_block` both no-op on `None`; `run_task_sub_agent` propagates `parent_ctx.skill_snapshot` which is `None` on every Deep/tasks caller; locked by `test_toolcontext_field_default_none` and `test_deep_noop` | closed |
| T-099-06 | Tampering | Snapshot-without-ref structural validator | mitigate | `@model_validator(mode="after") _skill_snapshot_requires_ref` at `harness.py:203-217` rejects a phase carrying `skill_snapshot` without `skill_ref` (pure shape, no DB); asserted by `test_skill_ref_additive_optional` | closed |
| T-099-07 | Elevation of Privilege | Auto-whitelist expansion — adding unauthorized tool names | mitigate | `_effective_tools` (phase_types.py:177-190) appends EXACTLY one fixed registered name (`"read_skill_file"`) and ONLY when `skill_snapshot` is present; never drops an existing tool; the layer-2 `phase_whitelist=frozenset(_tools)` dispatch backstop is intact; `test_auto_whitelist` covers both paths | closed |
| T-099-08 | Tampering (prompt injection) | `_skill_block` composing snapshot instructions into framing | accept | Author-controlled content (the skill's own `instructions` field) gated at publish via the enabled+visibility check in `validate_skill_refs`; same trust level as the phase prompt itself. Accepted: only the skill's own author (or a global skill visible to the user) can supply instructions that compose into the framing; `_skill_block` returns `""` on `None` snapshot | closed |
| T-099-09 | Information Disclosure | Storage RLS scoping of snapshot files | mitigate | Snapshot prefix `{user_id}/_snapshots/{def-slug}-v{version}/{skill_id}/...` keeps the leading `{user_id}` segment matching the existing first-segment SELECT RLS policy in `017_skills.sql:102-116`; service-role client used for run-time reads; no new bucket or migration required | closed |
| T-099-10 | Denial of Service | Event-loop stall on multi-file Storage copy in materializer | mitigate | All `.download()` and `.upload()` calls in `materialize_skill_snapshots` are wrapped in `run_in_threadpool` (`skill_snapshot.py:214, 218, 243` — three call sites confirmed); import at line 48. **Note:** the run-time READ in `_handle_read_skill_file` snapshot branch (`tool_dispatcher.py:488`) uses an un-wrapped `.download()` for byte-symmetry with the live path (Open Question 4, accepted in-code and flagged as WR-02 in 099-REVIEW.md). This is a known single-file read, not the multi-file materializer write path. WR-02 is an architectural observation — not a severity-block at ASVS Level 1 | closed |
| T-099-11 | Idempotency race | Concurrent first-kickoff materialize under `WORKER_COUNT=2` | mitigate | Materializer is idempotent by content: snapshot lives in DB JSONB + Storage upsert (`"upsert": "true"`); a double-materialize writes the same bytes and the same JSONB; no in-process cache. **Note:** REVIEW.md IN-03 notes the persist-back has no CAS guard (last-write-wins on a concurrent race); the idempotency is same-content-write safety only, not a strong CAS lock. This is an info-level observation accepted as-is for Phase 099 scope | closed |
| T-099-12 | DoS (hot-file growth / G-5) | `threads.py` growth from skill-composition logic | mitigate | Kickoff gains only one `import` statement (line 50) and the thin `_ensure_skill_snapshots` wrapper (line 787); verified no `table("skills")` query and no `skill-files` Storage call in `threads.py` body; all domain logic delegated to `skill_snapshot.py` | closed |
| T-099-CR01-01 | Tampering / Integrity | Materialize manifest source — `skill_files` table query injection | mitigate | Filenames sourced from `skill_files` table via `.eq("skill_id", str(skill_ref))` (`skill_snapshot.py:199-204`); `skill_ref` is a Pydantic-validated UUID (no injection surface); `_FakeSkillFilesQuery` + `test_snapshot_materialize` assert one upload per real `skill_files` row | closed |
| T-099-CR01-02 | Information Disclosure | `skill_files` service-role manifest read | accept | Skill already resolved owned-or-global + enabled before the manifest query (`_resolve_skill_query` at line 184); the FK relationship constrains `skill_files` rows to that one skill; no additional user-scope predicate required. Accepted: the owned-or-global gate is the upstream authority | closed |
| T-099-CR01-03 | Integrity (D-01) | Pre-fix empty-manifest snapshots locked by idempotency | accept | Documented in-code at `skill_snapshot.py:167-172` ("RE-MATERIALIZATION LIMITATION (CR-01)") — definitions whose phases already carry a `skill_snapshot` with `files: []` from before the CR-01 fix will not auto-heal; a future re-materialization sweep is out of scope; the dev DB likely has no such rows. Accepted | closed |
| T-099-CR02-01 | Tampering / Integrity (D-01) | `read_skill_file` resolving live skill instead of snapshot | mitigate | `skill_snapshot=parent_ctx.skill_snapshot` propagated onto `sub_ctx` in `task_service.py:636`; snapshot-routing gate at `tool_dispatcher.py:479` is now reachable on the live harness path; regression-locked by `test_099_snapshot_routing_live_chain` which drives the real `run_task_sub_agent → dispatch_tool` chain and asserts the leaf receives the correct snapshot | closed |
| T-099-CR02-02 | Tampering (red line) | Deep-mode dispatch byte-identical post-propagation | mitigate | `parent_ctx.skill_snapshot` is `None` for every Deep/tasks caller (dataclass default); propagation `skill_snapshot=parent_ctx.skill_snapshot` is a literal `None` assignment; 096+085 suites unchanged; verified by `test_deep_noop` and the CI regression suite | closed |
| T-099-CR02-03 | Spoofing / wrong-skill routing | `read_skill_file` with mismatched `skill_name` | accept | Pre-existing limitation IN-02 (REVIEW.md): snapshot branch captures ALL `read_skill_file` calls in the phase regardless of `skill_name`; snapshot manifest membership check still rejects unknown filenames. Accepted: fail-closed; the error message does not yet include the snapshot skill name (IN-02 cosmetic fix deferred) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-099-01 | T-099-03 | Private skill content copied into snapshot prefix rooted at `{user_id}/_snapshots/...`. First-segment SELECT RLS keeps reads scoped to the author. No self-serve global publish path exists in Phase 099; the snapshot prefix is the declared seam for Phase 109 global-publish design. WR-04 (REVIEW.md) notes that a global definition's first-kickoff runner may root the prefix under their own id — this interaction is also accepted here for Phase 099 scope and explicitly handed to Phase 109 | gsd-secure-phase | 2026-06-10 |
| AR-099-02 | T-099-08 | `_skill_block` composes the skill's `instructions` field directly into the phase system prompt. Author-controlled content is considered the same trust level as the phase prompt itself (no untrusted third-party injection path). The enabled+visibility gate in `validate_skill_refs` is the upstream publish gate for this content | gsd-secure-phase | 2026-06-10 |
| AR-099-03 | T-099-10 (WR-02) | The snapshot-branch `.download()` in `_handle_read_skill_file` (tool_dispatcher.py:488) is un-wrapped (blocking on event loop) for byte-symmetry with the live path. Single-file read; skill files are typically text/small documents. Accepted as Open Question 4 per 099-03-SUMMARY.md. The materializer write path (multi-file) is correctly threadpool-wrapped. A `run_in_threadpool` wrap in the snapshot branch would not change bytes but would fix the D-v2.5-01 compliance gap — deferred to a future phase | gsd-secure-phase | 2026-06-10 |
| AR-099-04 | T-099-11 (IN-03) | The materializer persist-back `update({"definition": ...}).eq("id", definition_id)` has no CAS guard. Two concurrent first-kickoffs can both materialize and last-write-wins. Both writes produce the same bytes (same live skill content at that instant), so D-01 is satisfied in the common case. A one-shot D-01 violation is possible only if the live skill is edited between the two concurrent materializations — an extremely narrow window. Accepted for Phase 099 scope; a CAS predicate guard is the remediation and can be added in a future phase | gsd-secure-phase | 2026-06-10 |
| AR-099-05 | T-099-CR01-03 | Empty-manifest snapshots persisted before the CR-01 fix (commit 7a496829) are locked by the idempotency check and will not auto-heal without an explicit re-materialization sweep. The dev DB likely has no such rows. Accepted as documented in `skill_snapshot.py:167-172` | gsd-secure-phase | 2026-06-10 |
| AR-099-06 | T-099-CR02-03 (IN-02) | The snapshot-routing gate captures all `read_skill_file` calls in the phase regardless of `skill_name`; it is fail-closed (unknown filename → error). The rejection message does not include the snapshot skill's name, making agent self-correction harder. Cosmetic / UX gap; no security boundary crossed. Deferred to a future phase per REVIEW.md IN-02 | gsd-secure-phase | 2026-06-10 |

*Accepted risks do not resurface in future audit runs unless their `re_open_trigger` condition fires.*

---

## Open Threats (Unregistered Flags from SUMMARY.md)

No threat flags were raised in any Phase 099 SUMMARY.md file that lack a corresponding threat ID in the register above. The REVIEW.md WR-01 finding (validate re-gates live skill even for already-materialized phases) is a functional/correctness gap rather than a security STRIDE threat — it affects D-01 semantics (snapshot purpose is to survive source-skill delete/disable) but does not open an attack surface. It is noted here for completeness and should be addressed in a future phase when published global definitions become reachable.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-10 | 19 | 19 | 0 | gsd-secure-phase (claude-sonnet-4-6) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-10

---

## Security Audit Addendum 2026-06-10 (gap plans 099-07 / 099-08)

> Scope: verifies the 9 new STRIDE threats declared in 099-07-PLAN.md and 099-08-PLAN.md
> threat_model blocks. The original 19-threat register (above) remains unchanged and closed.
> ASVS Level 1. block_on: high.

### Trust Boundaries (addendum)

| Boundary | Description |
|----------|-------------|
| published `workflow_definitions` row → amended trigger | `skill_snapshots` column is the only mutable field; every authored column (`slug/version/name/description/status/definition/created_by/is_global/org_id`) still raises SQLSTATE 23514 on change |
| stored `skill_snapshots` JSONB → in-memory `SkillSnapshot` | re-grafted via `SkillSnapshot.model_validate` at every read point (kickoff + `_load_run_definition`) |
| backend `{detail}` HTTP error body → frontend DOM | server-controlled string crosses into the chat banner; rendered as React text children only |

### Threat Register (addendum)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-099-07-01 | Tampering — amended trigger preserves immutability | mitigate | closed | `067_skill_snapshots_sibling_column.sql`: 9-column `IS DISTINCT FROM` allowlist confirmed present in file. Live DB (psycopg2 127.0.0.1:54322): amended function body contains the allowlist; `AUTHORED_COLS_IN_TRIGGER = ['created_by','definition','description','is_global','name','org_id','slug','status','version']`. Test `test_persist_survives_published_trigger` asserts a definition-touching update on a published fake row raises `APIError(23514)`. |
| T-099-07-02 | Tampering / Race — concurrent double-kickoff CAS | mitigate | closed | `skill_snapshot.py:254-256`: `.update({"skill_snapshots": snapshots_map}).eq("id", definition_id).is_("skill_snapshots", "null")` confirmed. The CAS filter means a second writer updates 0 rows with no error. `test_cas_second_materialize_no_op` verifies the 0-row no-op path. |
| T-099-07-03 | Tampering / Integrity — malformed stored snapshot JSON | mitigate | closed | `skill_snapshot.py:288`: `phase.config.skill_snapshot = SkillSnapshot.model_validate(stored)` — `extra="forbid"` on `_StrictBase`; a malformed stored map raises `ValidationError`, kickoff fails closed. The `except Exception → HTTPException(500)` wrapper in `threads.py:837-846` returns structured JSON (no naked traceback). `test_kickoff_unexpected_error_maps_500` verifies. |
| T-099-07-04 | Denial of Service / UX — naked ASGI 500 on materializer failure | mitigate | closed | `threads.py:837-846`: `except Exception as _mat_err … raise HTTPException(status_code=500, detail=f"skill snapshot materialization failed: {_mat_err}")`. Graft confirmed wired before validate/materialize at `threads.py:817`. |
| T-099-07-05 | Information Disclosure — `skill_snapshots` column readability | accept | closed | Accepted: same `workflow_definitions` row, same owned-or-global SELECT RLS (056:43-45); adding the column does not widen row scope. No new exposure surface. Documented in addendum accepted risks log below. |
| T-099-07-06 | Elevation (IDOR) — kickoff definition resolve | n/a (unchanged) | closed | The owned-or-global `.or_` predicate is unchanged (T-092-05); only the SELECT column list was widened. No auth-posture change. No new mitigation required. |
| T-099-08-01 | Tampering / XSS — server `detail` rendered in DOM | mitigate | closed | `frontend/src/components/chat/ChatArea.tsx:534-537`: `reconcileError instanceof ApiError ? reconcileError.message : "Couldn't load…"` rendered as JSX `<span>` text children. Grep count of `dangerouslySetInnerHTML` in ChatArea.tsx = 1 (one code comment only, no live JSX usage). React text children auto-escape HTML. |
| T-099-08-02 | Information Disclosure — raw server `detail` passed to UI | accept | closed | Accepted: the 400 detail originates from the app's own gate (`threads.py` / `skill_snapshot.py` `ValueError`) — a generic message, no PII, no IDOR existence leak (T-099-01/02 still closed). 409 stays on fixed client copy, never the raw body. Documented in addendum accepted risks log below. |
| T-099-08-03 | DoS — stale `failedSendDrafts` re-fills composer unexpectedly | mitigate | closed | `StreamsProvider.tsx`: draft cleared on consume (`onClearPrefill` in ChatArea) AND on banner dismiss (`dismissReconcileError`). Keyed by `threadId` — no cross-thread bleed, mirrors the per-thread `reconcileErrors` isolation. `streamsStore.ts` state field `failedSendDrafts: Map<string, string>` confirmed present (grep count ≥ 2 per 099-08-SUMMARY). |

### Addendum Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-099-07-01 | T-099-07-05 | The `skill_snapshots` column lives on the `workflow_definitions` row under the existing owned-or-global SELECT RLS. A user who can read the definition row can read its materialized snapshots — same trust level as reading the definition JSONB. No new exposure surface introduced by 067. | gsd-secure-phase | 2026-06-10 |
| AR-099-08-01 | T-099-08-02 | The 400 `detail` string is the app's own gate message (disabled/missing/non-visible skill) from `validate_skill_refs` / `_ensure_skill_snapshots`. It contains no PII, no secret material, no cross-user identifiers. The generic `ValueError` message was already verified non-leaking under T-099-01/02 in the original audit. 409 continues to use a fixed client-side copy, never the raw server body. | gsd-secure-phase | 2026-06-10 |

### Unregistered Threat Flags (addendum)

099-08-SUMMARY.md `## Threat Flags` section states: "None — this plan introduces no new network endpoints, auth paths, file access, or schema changes." No unregistered flags to log.

099-07-SUMMARY.md has no `## Threat Flags` section. The single WR-02 observation (un-wrapped `.download()` in `_handle_read_skill_file` snapshot branch) was already accepted as AR-099-03 in the original audit register and is not a new threat surface.

### Addendum Audit Trail

| Audit Date | Gap Plans | Threats Total (addendum) | Closed | Open | Run By |
|------------|-----------|--------------------------|--------|------|--------|
| 2026-06-10 | 099-07 / 099-08 | 9 | 9 | 0 | gsd-secure-phase (claude-sonnet-4-6) |

**Cumulative (original + addendum): 28 threats, 28 closed, 0 open.**

**Addendum sign-off:** verified 2026-06-10
