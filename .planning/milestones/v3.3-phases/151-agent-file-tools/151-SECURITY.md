# Phase 151 — Agent File Tools: Security Audit (SECURITY.md)

**Phase:** 151 — agent-file-tools (FILE-01, FILE-02)
**Audited:** 2026-07-14
**ASVS Level:** 2
**block_on:** high
**Register origin:** authored at plan time across 151-01..04 `<threat_model>` blocks (15 threats: 14 `mitigate` + 1 `accept`; `T-SC` package-audit = N/A). Verification only — no new register constructed, no blind scan for net-new vulnerabilities.
**Result:** SECURED — 15/15 threats CLOSED, 0 OPEN. No unregistered flags. `threats_open: 0`.

The audit adopted the FORCE stance: every mitigation was treated as ABSENT until a grep/read match
proved it present at the exact served seam (the handlers/resolvers in
`backend/app/services/tool_dispatcher.py`, the gate in `backend/app/services/openai_service.py`, the
validator in `backend/app/api/workspace.py`, and the live index in `supabase/full-schema.sql`). The
two load-bearing app-layer gates — the owner-only `.eq("user_id")` reads/writes on the RLS-less
service-role client, and the fail-closed `_CAPABILITY_FLAG_TOOLS` in-flight refusal wired into
`dispatch_tool` — were traced through the actual dispatch path, not the docstrings. All four
code-review `WR-*` fixes and the `IN-01` fix are present in the served code and strengthen the
declared mitigations. All 67 Phase-151 mitigation-proof unit tests pass against the served source
(`test_151_fetch_handler` / `_attach_handler` / `_upload_allowlist` / `_registration` /
`_tool_schema` / `_cross_provider_schema`).

---

## Threat Verification

### Plan 01 — FILE-02 `fetch_document_file` (T-01)

| Threat ID | Category | Disposition | Status | Evidence (file:line) |
|-----------|----------|-------------|--------|----------------------|
| T-151-02-01 | Information Disclosure | mitigate | CLOSED | Owner→global resolver `_fetch_owned_document_bytes` runs `.eq("id", document_id).eq("user_id", uid)` FIRST — `tool_dispatcher.py:295-298`; owner miss → explicit `get_globally_visible_folder_ids` fallback `:302-308`; non-owner → `{"error": "...not found or access denied."}` `:310-312`. Service-role has NO RLS backstop, so this app gate is load-bearing (docstring `:278-279`). Proof: `test_151_fetch_handler.py::test_cross_user_not_found_never_reads_others_doc` (owner empty + global empty → not-found, `download` `assert_not_called`). |
| T-151-02-02 | Tampering | mitigate | CLOSED | `documents.filename` scrubbed before landing — `os.path.basename` + charset scrub `re.sub(r"[^a-zA-Z0-9._\- ]", "_", …)` + `re.sub(r"\.{2,}", ".", …)` → `container_path = f"/sandbox/input/{safe}"` — `tool_dispatcher.py:387-390`. Proof: `test_path_traversal_filename_sanitized` (`../../etc/x` → scrubbed basename under `/sandbox/input/`, no `..` segment, `copy_to_runtime` arg asserted). |
| T-151-02-03 | Denial of Service | mitigate | CLOSED | `documents.file_size` gate computed PRE-download — `tool_dispatcher.py:326-342`; bytes go to disk via `copy_to_runtime`, never into `ToolResult`. **WR-03 hardening present:** NULL/0 `file_size` is treated as untrusted and refused PRE-download (`if not file_size:` `:333-337`) — the prior `or 0` unlimited-bypass is gone; plus a post-download `len(file_bytes) > cap_bytes` metadata-drift backstop `:352-356`. Proof: `test_over_cap_refused_before_download` + `test_null_or_zero_file_size_refused_before_download` (both `download.assert_not_called`). |
| T-151-02-04 | Integrity | mitigate | CLOSED | Over-cap / no-original / unknown-size all return an `{"error"}` dict and the handler relays it BEFORE `_ship` runs — `tool_dispatcher.py:379-382`; refuse-never-truncate, no partial `copy_to_runtime`. Same gates as T-151-02-03; `copy_to_runtime.assert_not_called` on every refusal path. |
| T-151-02-05 | Elevation of Privilege | mitigate | CLOSED | Two-layer sandbox gate. HIDE: appended only inside `if sandbox_enabled:` — `openai_service.py:1164-1169`. REFUSE (fail-closed, provider-uniform): `_CAPABILITY_FLAG_TOOLS["fetch_document_file"] = ("sandbox_enabled", …)` — `tool_dispatcher.py:3715`, enforced in `dispatch_tool` via `_capability_disabled_message` BEFORE handler lookup — `:3769-3776`. Proof: `test_151_registration.py` present-when-on / absent-when-off + capability-flag assertions. |

### Plan 02 — Migration 101 (D-10)

| Threat ID | Category | Disposition | Status | Evidence (file:line) |
|-----------|----------|-------------|--------|----------------------|
| T-151-02M-01 | Tampering | mitigate | CLOSED | UNIQUE index live in the DB — `supabase/full-schema.sql:2458` (`CREATE UNIQUE INDEX skill_files_skill_filename_uniq ON public.skill_files USING btree (skill_id, filename)`, regenerated from the live-DB dump) + authored migration `supabase/migrations/101_skill_files_unique_index.sql:34-35`. The attach write consumes it: `.upsert(…, on_conflict="skill_id,filename")` — `tool_dispatcher.py:633-639`, collapsing the read-check-then-write TOCTOU to one winner under `WORKER_COUNT=2`. Proof: `test_151_attach_handler.py::test_collision_reports_updated` asserts `on_conflict == "skill_id,filename"`. |
| T-151-02M-02 | Denial of Service | accept | CLOSED (accepted) | Index build on pre-existing duplicate tuples. `CREATE UNIQUE INDEX IF NOT EXISTS` (idempotent, safe re-apply); `skill_files` had no duplicate `(skill_id, filename)` tuples in dev (pre-D-07 per-file insert never created same-name-same-skill rows); operator-applied and `pg_indexes`-verified (`151-02-SUMMARY.md:59-60`). Documented in the Accepted Risks Log below. |
| T-SC | Tampering (supply chain) | N/A | N/A | No npm/pip/cargo install in this phase — the Package Legitimacy Audit is not applicable (RESEARCH-confirmed; migration + handler wiring only, no new dependency). |

### Plan 03 — SC#3 upload widen (T-02 input-validation)

| Threat ID | Category | Disposition | Status | Evidence (file:line) |
|-----------|----------|-------------|--------|----------------------|
| T-151-03-01 | Tampering | mitigate | CLOSED | Per-category magic-byte gate survives the D-09 widen in `validate_upload` — `workspace.py:176-211`: OOXML → `_validate_ooxml_container` (ZIP + `[Content_Types].xml` + part marker) `:127-144`; text-ish → `_looks_like_text` (NUL-reject + utf-8-decode) `:147-160`; image → `_image_magic_ok` (leading magic per ext) `:163-173`. Proof: `test_151_upload_allowlist.py::test_rejects_renamed_binary_as_md` / `_as_png` / `test_rejects_wrong_image_magic` → 422. |
| T-151-03-02 | Denial of Service | mitigate | CLOSED | `len(raw) > MAX_FILE_SIZE` trips BEFORE any decode/parse for EVERY type — `workspace.py:197-198` (above all three category branches); route also pre-checks declared part size `:241-242`. Proof: `test_rejects_oversized_text` / `_image` / `_ooxml` (valid content + oversize → only the size guard can reject → 422). |
| T-151-03-03 | Elevation of Privilege | mitigate | CLOSED | `kind='template_input'` untrusted-provenance stamp preserved on the workspace row — `workspace.py:267,274`. Provenance-routed engine selection makes SSTI structurally impossible for uploads: `select_engine("template_input")` → `"run_replace"` (non-Jinja) with a hard `assert engine != "docxtpl"` — `template_render_service.py:945-951` (`_RUN_REPLACE_PROVENANCES` includes `template_input` `:933`). `render_template` calls it via `select_engine(src["provenance"])` — `tool_dispatcher.py:2932`. A `template_input` file can NEVER reach the docxtpl/Jinja engine. |

### Plan 04 — FILE-01 `attach_skill_file` (T-02 / T-03 / T-04)

| Threat ID | Category | Disposition | Status | Evidence (file:line) |
|-----------|----------|-------------|--------|----------------------|
| T-151-04-04 | Elevation of Privilege / Tampering | mitigate | CLOSED | Owner-only WRITE gate: target skill resolved `.eq("name", target_skill_name).eq("user_id", uid)` — `tool_dispatcher.py:589-591` (NOT the `.or_(is_global.eq.true)` READ filter); empty `.data` OR `is_system` → refuse, no upload/upsert — `:596-600`. Service-role has no RLS backstop → app gate is load-bearing. Proof: `test_refuse_when_skill_not_owned` + `test_refuse_when_skill_is_system` (both `upload.assert_not_called` + `upsert.assert_not_called`). |
| T-151-04-02 | Tampering / Elevation | mitigate | CLOSED | The doc→skill→execute_code chain is bounded, not elevated. Upload widen (Plan 03) keeps magic-byte + size + `template_input` provenance; attach preserves provenance and never elevates a `template_input` file to the trusted Jinja engine (verified T-151-03-03). Owner-scope bounds who can attach (T-151-04-04) and the storage path is owner-prefixed (T-151-04-01). Python skill files being executable via execute_code injection (`tool_dispatcher.py` skill-file injection) is the intended, owner-scoped skill behavior — no cross-user escalation. |
| T-151-04-03 | Information Disclosure (legitimate, explicit) | mitigate | CLOSED | Owner-scope holds on BOTH ends: the KB doc via the reused owner→global resolver `_fetch_owned_document_bytes` — `tool_dispatcher.py:537-541` (`kb_document` source), and the skill via the owner-only gate `:589-591`. **WR-04 disposition present:** an `is_global` skill the caller OWNS stays writable BY DESIGN (making a skill global is an explicit owner action), and the refusal copy was corrected to cite only built-in (`is_system`) skills so it never overstates enforcement — `:596-600` (comment `:583-587`). Proof: `test_owned_global_skill_is_writable` (owner-scope holds, `is_global` does not block), `test_not_owned_refusal_copy_does_not_overstate` (copy asserts no false "not a global" claim), `test_source_kb_document_resolver_error_propagates` (cross-user doc refusal propagates, `upload.assert_not_called`). |
| T-151-04-01 | Tampering | mitigate | CLOSED | Storage path always owner-prefixed `storage_path = f"{uid}/{skill_id}/{filename}"` — `tool_dispatcher.py:611`; `uid` from ctx, `skill_id` from the RESOLVED owned skill, `filename` sanitized to a safe basename (basename + charset scrub) `:577-579` — no segment is ever a raw model arg. Proof: `test_owner_prefixed_path_defends_traversal` (`../../etc/passwd` filename → lands under `owner-1/skill-1/`, no `..` segment). |
| T-151-04-05 | Elevation of Privilege | mitigate | CLOSED | Two-layer self-improve gate. HIDE: appended only inside `if self_improve_on:` — `openai_service.py:1154-1161`. REFUSE (fail-closed, provider-uniform): `_CAPABILITY_FLAG_TOOLS["attach_skill_file"] = ("self_improve_enabled", …)` — `tool_dispatcher.py:3719`, enforced in `dispatch_tool` `:3769-3776`. Proof: `test_attach_skill_file_present_when_self_improve_on` / `_absent_when_self_improve_off` / `_not_sandbox_gated`. |

**Closed:** 15/15 (14 `mitigate` grep/read-verified + 1 `accept` documented). **Open:** 0.

---

## Load-Bearing App-Layer Gate Verification (no RLS backstop)

Per the audit constraint, the two gates the register calls "load-bearing (service-role has NO RLS
backstop)" were traced end-to-end in the served code:

1. **Owner-only doc read** — `_fetch_owned_document_bytes` (`tool_dispatcher.py:295-312`): the FIRST
   query is `.eq("id", document_id).eq("user_id", uid)`; the global fallback is an explicit
   `get_globally_visible_folder_ids` allowlist `.in_("folder_id", gfids)`, never a broad `.or_()`. A
   non-owner id yields empty `.data` → honest not-found. Reused verbatim for `attach` source #4.
2. **Owner-only skill write** — `_handle_attach_skill_file` (`tool_dispatcher.py:589-600`): the
   target resolves `.eq("name", …).eq("user_id", uid)`; empty `.data` OR `is_system` refuses. This is
   the owner-scope WRITE filter, NOT the `.or_(is_global.eq.true)` READ filter used elsewhere.
3. **Fail-closed in-flight REFUSE** — `dispatch_tool` (`tool_dispatcher.py:3769-3776`) calls
   `_capability_disabled_message` (`:3734-3744`) BEFORE the `_TOOL_REGISTRY` handler lookup, for BOTH
   new tools. A model that calls a tool whose operator kill-switch is OFF gets a plain
   `capability_disabled` ToolResult — identical across OpenAI/Anthropic/Google/OpenRouter, no
   `provider ==` fork. Defense-in-depth with the get_tools HIDE layer.

Every Storage/DB/container call on both handlers is `run_in_threadpool`-wrapped (or `aexec`, itself a
threadpool wrapper) — D-v2.5-01 / Pitfall 1 held; no bare blocking I/O in the served path.

---

## Code-Review Fixes — Present in Served Code (strengthen the mitigations)

`151-REVIEW.md` (0 critical, 4 warning, 1 info). All fixes verified present:

- **WR-01** (honest-failure wrapper): both resolver SELECTs wrapped in `try/except → {"error": …}` —
  `tool_dispatcher.py:294-312`; the attach skills SELECT likewise `:588-595`. No raw PostgREST/DB text
  leaks into model context. Proof: `test_resolver_db_error_returns_honest_refusal_no_leak`,
  `test_handler_db_error_returns_honest_refusal`, `test_skill_select_db_error_refuses_honestly`.
- **WR-02** (sandbox_output size cap): harvested bytes capped at `_ATTACH_INLINE_MAX_BYTES` BEFORE
  upload — `tool_dispatcher.py:507-511`. Proof: `test_source_sandbox_output_oversized_refused`
  (`upload.assert_not_called`). Closes the "largest, least-trustworthy source was uncapped" gap.
- **WR-03** (NULL/0 file_size + post-download backstop): see T-151-02-03 — `:333-337` + `:352-356`.
- **WR-04** (owner-gate copy accuracy): refusal copy scoped to built-in skills only; owned-`is_global`
  writable by design — see T-151-04-03.
- **IN-01** (orphan cleanup): on DB-upsert failure after a successful Storage upload, best-effort
  `remove([storage_path])` — `tool_dispatcher.py:644-657`. Proof:
  `test_orphan_object_removed_on_db_upsert_failure`.

---

## Accepted Risks Log

| Risk ID | Description | Disposition | Rationale / Control |
|---------|-------------|-------------|---------------------|
| T-151-02M-02 | Migration 101 unique-index build could fail on pre-existing duplicate `(skill_id, filename)` tuples | accept | `CREATE UNIQUE INDEX IF NOT EXISTS` is idempotent; `skill_files` had no duplicate `(skill_id, filename)` tuples in dev (the pre-D-07 per-file insert path never created same-name-same-skill rows); operator applied it to the live local DB and `pg_indexes` confirmed `skill_files_skill_filename_uniq` (`151-02-SUMMARY.md:59-60`), full-schema regenerated from the live dump (`full-schema.sql:2458`). The accepted-risk window did not materialize. Cloud apply (before live) carries the same idempotent property. |

---

## Unregistered Flags

None. Each SUMMARY (151-01..04) declares `## Threat Flags: None beyond the plan's <threat_model>`
(`151-01-SUMMARY.md:121-122`, `151-02:95-96`, `151-03` provenance note, `151-04:129-130`). Both tools
are handler-only additions through the existing `dispatch_tool` gate — no new network endpoint, auth
path, table, or bucket (D-08: reuses `skill_files` + `skill-files`). No new attack surface appeared
during implementation without a threat mapping.

---

## Incidental Observations (not declared threats; non-blocking, no ship gate)

- **Attach source cap asymmetry:** `inline` and `sandbox_output` cap at 5 MB
  (`_ATTACH_INLINE_MAX_BYTES`), while `kb_document` caps at 50 MB (`fetch_document_file_max_mb`). All
  four sources ARE now bounded (WR-02 closed the one uncapped source), so this is a tuning
  inconsistency, not a DoS gap. `SEED-117` already tracks migrating the fetch cap to `app_settings`.
- **Cloud parity (operator-gated deploy half, not a code gap):** migration 101 (this phase) plus 099
  (Phase 149) and 100 (Phase 150) must be pasted into cloud Supabase before Phase 151 ships live —
  auto-surfaced by `scripts/pending-cloud-migrations.sh`. The migration file is present and correct in
  the repo; only the operator deploy action remains.
- **Pre-existing unit-test rot (out of scope):** the full `pytest tests/unit` tier carries ~63
  failures across ~18 UNRELATED service test files, verified pre-existing at baseline
  (`151-04-SUMMARY.md:124`, logged to `deferred-items.md`, SEED-056/SEED-049). None touch Phase-151
  files; all 67 Phase-151 mitigation-proof tests pass.

---

_Audited by gsd-security-auditor. Implementation files read-only — no code modified. Only this
SECURITY.md was written._
