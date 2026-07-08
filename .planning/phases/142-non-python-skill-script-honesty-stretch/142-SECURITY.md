---
phase: 142
slug: non-python-skill-script-honesty-stretch
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-08
---

# Phase 142 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> SRH-01 — honesty-only phase (D-01/D-02, no new runtime capability). Makes the agent tell the truth when a skill bundles a non-Python script the Python-only sandbox cannot execute, and de-duplicates repeated dead-binary/module gaps within a run. The single correctness-critical property is T-142-01: the honesty reshape must NEVER suppress a genuine error.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| sandbox stdout/stderr/exit_code → `_classify_runtime_gap` | Untrusted, model- and user-code-influenced strings decide whether a failure is reshaped | stdout/stderr text + exit code |
| model-supplied `code` arg → pre-flight repeat-guard | Model-controlled string checked for already-failed dead tokens before the sandbox is touched | tool arguments (untrusted) |
| run-scoped `dead_gap_tokens_in_run` set → parent/sub-agent contexts | State-sharing boundary; a sub-agent's dead call must not bleed into the parent | run-scoped token set |
| skill file bytes (`.js`/`.sh`) → model context via `read_skill_file` | Additional untrusted skill content returned as reference text | decoded script source |
| ZIP entry names → `import_skill` ext-scan | Untrusted archive entry names, already `_sanitize_zip_name`-validated before the scan | basename extensions |
| tool-schema string → all provider gateways | Developer-authored contract string; no untrusted input | static capability facts |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-142-01 | Tampering / Repudiation | `_classify_runtime_gap` reshape suppressing a real error | mitigate | Reshape fires ONLY on a fixed-allowlist hit, never on error-type/exit-code alone. POST-HOC classifier gated on non-zero exit (`tool_dispatcher.py:1390` `if actual_exit_code != 0:` before `_classify_runtime_gap` :1391) — CR-01(1a) fix `330453f3`. G-C binary requires the shell to NAME the token as missing via per-token boundary-anchored regex `_BINARY_GAP_RES` (:2164-2171, used :2236) — bare `"not found"` co-occurrence no longer hits (CR-01 1b). `"let "` dropped from `JS_TOKENS` (:2094) and `_strip_py_line_comments` (:2174-2202) runs before the G-B scan (:2255) so a Python comment can't masquerade as JS (CR-01 1c). Module branch requires a KNOWN module (:2242-2246). G-A requires a non-absolute path under a known bundle dir (:2269-2279). Negative `test_non_gap_passthrough` proves genuine ValueError / missing `/sandbox/output/*.csv` / real SyntaxError / bare non-zero exit all return None. | closed |
| T-142-04 | DoS (unbounded key growth) | `GAP_MESSAGES` / `dead_gap_tokens_in_run` keys | mitigate | Only classifier-returned tokens are `.add`-ed (`tool_dispatcher.py:1397`). Binary/module/JS tokens are drawn from fixed frozensets (`KNOWN_MISSING_BINARIES` :2085, `KNOWN_MISSING_MODULES` :2089, `JS_TOKENS` :2094); one precompiled regex per allowlist token (:2164-2171). G-A path recording narrowed by WR-01 fix `017e7000` to `scripts/`\|`assets/`\|`resources/`-prefixed relative misses only (:2269-2279) — no arbitrary model-supplied path can grow the set. Boundedness documented in the field comment (:100-106). | closed |
| T-142-05 | Tampering (cross-run / sub-agent state bleed) | run-scoped set threading | mitigate | Field defaults `None` (`tool_dispatcher.py:106`) → literal no-op for every unwired caller (guarded `is not None` at pre-flight :993 and post-hoc :1396). Init once per run OUTSIDE the iteration loop (`agent_loop.py:1593`); threaded by-reference into BOTH `ToolContext` builds — resume :1645, main loop :2429. Sub-agents get a FRESH `set()` (`task_service.py:608`), not the parent reference, so a sub-agent's dead call never short-circuits the parent. | closed |
| T-142-02 | Information Disclosure / Injection (prompt-injection via skill content) | `_decode_skill_file_bytes` returns `.js`/`.sh` source as text | accept | Same posture as today's `.md`/`.py` reads — NOT a new class. `_SCRIPT_REF_CAVEAT` (`tool_dispatcher.py:845-848`) frames the content as reference-only, non-executable; decode branch (:887-895) returns caveat + source as plain text via the SHARED decoder (owner/global RLS gating upstream in `_handle_read_skill_file` unchanged). No new read authority granted — only the decode message changes for text previously mislabeled binary. See Accepted Risks Log AR-142-01. | closed |
| T-142-D14 | Tampering (shared-path fork) | capability-facts placement | mitigate | Facts live on the single-source `EXECUTE_CODE_TOOL.description` (`openai_service.py:596-599`), appended once by `get_tools()` (:1050) and translated uniformly by every gateway. Explicitly NOT on `SYSTEM_PROMPT` — an `agent_loop.py` scan for the capability tokens (soffice/pdftoppm/markitdown/"cannot be installed"/"Python only") returns only the unrelated disabled-tools string (:1364), not these facts. `test_execute_code_capability_facts` pins tokens on the description only. Deep byte-identical. | closed |
| T-142-03 | Tampering (path traversal) | `import_skill` ext-scan | mitigate | Every entry passes `_sanitize_zip_name` BEFORE the per-skill loop (`skills.py:271-274`, step 3). The scan inspects ONLY `os.path.splitext(os.path.basename(relative))[1]` (:329, :338) on already-validated entries — no path is constructed from untrusted input, no new traversal surface. Mechanism-only; never blocks the import. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-142-01 | T-142-02 | `read_skill_file` now returns `.js`/`.sh` script bytes as reference TEXT instead of the old false "binary — upload a text version" message. This grants NO new read authority: the same owner/global RLS scoping in `_handle_read_skill_file` still gates which skill files are readable (unchanged upstream), and the content is the SAME class of untrusted-skill-text already returned for `.md`/`.py` reads. The `_SCRIPT_REF_CAVEAT` prefix (`tool_dispatcher.py:845-848`) explicitly frames the content as reference-only, non-executable ("do not attempt to run it"). Prompt-injection via skill content is a pre-existing, out-of-scope posture for this honesty-only phase — not a new attack class introduced here. | operator | 2026-07-08 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-08 | 6 | 6 | 0 | gsd-security-auditor (opus, verify-mitigations mode) |

**Unregistered flags:** None. The Threat Surface / Threat Model Compliance sections of 142-02/03/04/05-SUMMARY.md each map to a registered threat ID (T-142-01/04/05 in Plan 02, T-142-02 in Plan 03, T-142-D14 in Plan 04, T-142-03 in Plan 05); no plan reported new/unmapped attack surface.

**REVIEW fix verification (the load-bearing check for this phase):** 142-REVIEW.md found and marked-fixed 2 critical T-142-01 blockers plus 2 warnings. All four fixes are CONFIRMED present in executable code, not merely documented:
- **CR-01** (classifier suppressed genuine errors) — fix `330453f3` verified: post-hoc gate on non-zero exit at `tool_dispatcher.py:1390`; boundary-anchored `_BINARY_GAP_RES` per-token regexes at :2164-2171; `"let "` absent from `JS_TOKENS` :2094; `_strip_py_line_comments` at :2174-2202 applied at :2255.
- **CR-02** (repeat-guard poisoned the run via bare substring) — fix `6904701c` verified: `_code_references_dead_token` (:2306-2311) matches binary/module identifiers at `\b…\b` word boundaries, keeping containment only for distinctive JS/path tokens.
- **WR-01** (G-A swallowed genuine relative misses) — fix `017e7000` verified: G-A gated on `_SKILL_BUNDLE_DIRS` (:2102) + non-absolute path at :2269-2279.
- **WR-02** (short-circuit skipped SSE lifecycle) — fix `8ba38181` verified: the pre-flight short-circuit emits a matched `code_execution_start`/`code_execution_complete` pair at :1007-1010 before returning.

**Residual advisories (NOT threat gaps — every declared mitigation is present in executable code):** IN-01 (ext extraction uses `rsplit('.',1)` in `_decode_skill_file_bytes` :860 vs `os.path.splitext` in the two other sites — latent inconsistency, no `SCRIPT_EXTS` member affected, no security impact), IN-02 (stale `_decode_skill_file_bytes` docstring at :858 still claims pre-099 byte-identity that the SCRIPT_EXTS branch intentionally broke — cosmetic). Weighed from 142-REVIEW.md; neither is a mitigation gap.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Each `mitigate` threat proven by file:line evidence in executable code
- [x] The two T-142-01 REVIEW blockers (CR-01, CR-02) and both warnings verified fixed in code
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-08
