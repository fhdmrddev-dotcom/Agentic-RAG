---
phase: 118-auto-classification
secured: 2026-06-21
asvs_level: L1
register_authored_at_plan_time: true
threats_total: 27
threats_mitigate: 18
threats_accept: 9
threats_closed: 27
threats_open: 0
accepted_risks: 5
unregistered_flags: 0
verification_mode: State B (built from PLAN threat models; no prior SECURITY.md)
block_on: none
---

# Phase 118 — Auto-Classification: Security Audit

**Phase Goal:** Turn richer metadata into routing intelligence — classification rules that
produce a suggestion on upload (never a silent auto-move) the user can accept or dismiss.

**Disposition:** SECURED. All 27 declared threats resolve to CLOSED (18 `mitigate` verified
present in shipped code by file:line — 2 of those are a11y-flagged, recorded per register; 9
`accept` confirmed reasonable). `threats_open: 0`.
Five residual-risk items (the unfixed code-review WARNINGs WR-03/04/05/01/02 that map onto
declared threats) are logged below as accepted risks AR-118-01..05 so they are auditable —
none changes a threat's CLOSED disposition, because each was independently confirmed
currently-safe by reading the shipped source (not by trusting the test or the doc).

**Methodology note (the D-102 / D-110-5 "static would false-green" + Phase 116 hand-spot-check
lesson):** the three highest-stakes controls were verified by reading the production source
directly, NOT by trusting the test harness or the plan's verification claim:
1. the ingest splice leak-safe `.or_()` scoping (documents.py:1887) — read in source;
2. the no-`folder_id`-write invariant at the ingest splice (documents.py:1882-1919) — read in source;
3. the accept-endpoint target-folder re-validation + owner scoping (documents.py:1500-1527) — read in source.
This was necessary because the two ingest-splice "non-vacuous" tests re-implement the pass
rather than driving it (AR-118-03 / WR-05).

---

## Threat Verification

| Threat ID | Category | Disposition | Verdict | Evidence (file:line) |
|-----------|----------|-------------|---------|----------------------|
| T-118-01-01 | Tampering | mitigate | CLOSED | `classification_matcher.match_metadata` is pure: `ViewFilter.model_validate` op-reject at `classification_matcher.py:71`, `validate_fields` at :72, empty-rule→False at :74; no eval/interpolation/DB. Non-vacuous: `test_118_matcher.py::test_unknown_op_rejected_at_parse` + `::test_empty_rule_matches_nothing` PASS live. |
| T-118-01-02 | Information Disclosure | mitigate | CLOSED | `_`-prefix provenance-key guard: `view_filter_compiler.validate_fields:274-275` rejects any `_`-prefixed field unconditionally → `_confidence`/`_source`/`_classification` can never be a match dimension. Non-vacuous: `test_118_matcher.py::test_underscore_prefixed_field_rejected` PASS. |
| T-118-01-SC | Tampering | accept | CLOSED | No new package (no requirements change in Plan 01). Reasonable. |
| T-118-02-01 | Elevation/Tampering | mitigate | CLOSED | `create_rule` HARD-SETS `is_global: False` (`classification_rule_service.py:89`) + `enabled: True` (:90), never reads a caller arg. Non-vacuous: `test_118_rule_crud.py` create asserts is_global=false. |
| T-118-02-02 | Information Disclosure | mitigate | CLOSED | Own+global read with `_uid()` coercion: `list_rules` :105, `get_rule` :128; uniform 404 (router :141, :157, :172); STRICT ownership at router :140. `grep -c 403 classification_rules.py` == 0 (verified). |
| T-118-02-03 | Tampering (`.or_()` DSL) | mitigate | CLOSED (residual AR-118-01) | `_uid()` (`classification_rule_service.py:53-64`) coerces user_id to a canonical UUID before interpolation; used at :105/:128. Note: the phase ADDED 3 more uncoerced sites — see AR-118-01. Verdict CLOSED because the rule_service sites (this threat's named component) DO coerce; the new sites are currently-safe defense-in-depth gaps logged as residual. |
| T-118-02-04 | Tampering (SSTI/injection) | mitigate | CLOSED | `validate_fields` + `validate_operands` at create (router :92) and update (:145); `ViewFilter` Literal op-reject at parse; matcher never eval()s. |
| T-118-02-05 | Repudiation | mitigate | CLOSED | `write_audit_entry(action_type="classification.rule.create")` at router :107-112, after create. Non-vacuous: `test_118_rule_crud.py::test_create_writes_rule_create_audit` PASS live (real audit_log round-trip). |
| T-118-02-SC | Tampering | accept | CLOSED | No new package. Reasonable. |
| T-118-03-01 | Information Disclosure | mitigate | CLOSED (residual AR-118-02, AR-118-03) | Ingest splice leak-safe read at `documents.py:1887` `.or_(f"user_id.eq.{user_id},is_global.eq.true").eq("enabled",True)` + per-rule eval against the uploader's OWN `metadata_dict` (:1896). **Hand-verified in source.** Residuals: missing `_uid()` (AR-118-01) and missing Python fail-closed re-filter (AR-118-02); the "non-vacuous" leak test re-implements the read (AR-118-03). All currently-safe. |
| T-118-03-02 | Tampering/honesty (no silent move) | mitigate | CLOSED (residual AR-118-03) | **Hand-verified in source:** the inserted block (`documents.py:1882-1902`) writes ONLY `metadata_dict["_classification"]` (:1897); the subsequent persist UPDATE (:1904-1919) writes metadata/status/chunk_count/full_markdown/extractor — NO `folder_id`. Silent auto-filing structurally impossible. Test asserts on a reimplementation (AR-118-03). |
| T-118-03-03 | Access Control | mitigate | CLOSED | `accept_classification` re-validates target folder readable (own+global) BEFORE move at `documents.py:1500-1512` → 404 if gone/unreadable. Non-vacuous: `test_118_accept.py::test_accept_unreadable_folder_404` PASS live (deletes folder, asserts 404). |
| T-118-03-04 | Information Disclosure | mitigate | CLOSED (residual AR-118-01) | Owner-scoped SELECT/UPDATE in accept (:1481-1482, :1522-1523) and dismiss (:1565-1566, :1581-1582); uniform 404 throughout, no 403. Non-vacuous: `test_118_accept.py::test_accept_cross_user_404_not_403` PASS live (real endpoint, asserts 404 not 403). Accept `.or_()` at :1505 lacks `_uid()` (AR-118-01). |
| T-118-03-05 | Repudiation | mitigate | CLOSED | `write_audit_entry(action_type="classification.apply")` at `documents.py:1532`, written ONLY after the move UPDATE succeeds (:1526 guard). Non-vacuous: `test_118_accept.py::test_accept_writes_classification_apply_audit` PASS live (real endpoint + real audit_log read). |
| T-118-03-06 | Denial of Service | mitigate | CLOSED | Whole rule-eval pass wrapped in `try/except Exception` (`documents.py:1883-1902`) → logs warning, continues; ingest completes. Non-vacuous: `test_118_ingest_suggest.py::test_classification_never_blocks_ingest_on_error` PASS (malformed AST raises in matcher, pass swallows it). |
| T-118-03-SC | Tampering | accept | CLOSED | No new package. Reasonable. |
| T-118-04-01 | Elevation | mitigate | CLOSED | `createRule` body (`api.ts:2269`) = `{ name, match_expr, suggest_folder_id }` — OMITS `is_global`. Server hard-sets false (T-118-02-01). No client scope-forge surface on create. |
| T-118-04-02 | Information Disclosure | accept | CLOSED | Client surfaces backend 404s honestly (`acceptClassification`/`dismissClassification` throw on non-ok); cannot widen the uniform-404 contract. Reasonable — the client is not a trust boundary. |
| T-118-04-SC | Tampering | accept | CLOSED | No new package. Reasonable. |
| T-118-05-01 | Information Disclosure | accept | CLOSED | Suggestion written only into the uploader's OWN doc metadata (Plan 03 user-scoped eval, T-118-03-01); list/detail fetch only the caller's own docs. No cross-user render path. Reasonable. |
| T-118-05-02 | Tampering/honesty | mitigate | CLOSED | `ClassificationSection.runMutation` awaits the mutation then calls `onChanged()` re-fetch — never optimistic (`ClassificationSection.tsx:88-93`); Accept/Dismiss/Undo all route through it (:161/:174/:213). |
| T-118-05-03 | a11y (not security) | mitigate | CLOSED | Accept/Dismiss/Undo are `<button>` with `aria-label` (`ClassificationSection.tsx:163,176`), coarse-pointer always-on (`.rel-x-touch` pattern per the file header). Out of security scope; recorded per register. |
| T-118-05-SC | Tampering | accept | CLOSED | No new package. Reasonable. |
| T-118-06-01 | Elevation | mitigate | CLOSED (informational WR-01 → AR-118-04) | `RuleBuilderPanel` CREATE path calls `createRule(name, matchExpr, suggestFolder)` (`RuleBuilderPanel.tsx:203`) — never sends `is_global`; the `scope` state (:114) is captured but not transmitted. Self-elevation impossible. The decorative scope control is a UX-honesty defect (WR-01 / AR-118-04), not a security hole. |
| T-118-06-02 | Information Disclosure | accept | CLOSED | `listRules()` returns only own+global (backend leak-safe `.or_()`, T-118-02-02); the UI cannot render another user's private rule because the backend never returns it. Reasonable. |
| T-118-06-03 | a11y (not security) | mitigate | CLOSED | Keyboard-operable native radios + aria-labels (`RuleBuilderPanel.tsx:339-364`); AA tokens. Out of security scope; recorded per register. |
| T-118-06-SC | Tampering | accept | CLOSED | No new package. Reasonable. |

**Closed: 27/27. Open: 0.**

---

## Accepted Risks Log

These are residual items mapped onto declared threats. Each was independently confirmed
CURRENTLY SAFE by reading the shipped source; they are logged so the residual is auditable.
None blocks the phase (`block_on: none`, ASVS L1).

### AR-118-01 — `_uid()` UUID coercion missing at 3 new service-role `.or_()` sites (WR-03)
**Maps to:** T-118-02-03, T-118-03-01, T-118-03-04
**Sites:** `documents.py:1887` (ingest splice), `documents.py:1505` (accept endpoint),
`classification_matcher.py:269` (`_resolve_folder_name`).
**Assessment:** The Plan-02 `classification_rule_service` sites DO route through `_uid()`
(:105/:128). The three NEW Plan-03 sites interpolate `user_id` / `current_user['id']` raw into
the PostgREST `.or_()` grammar. The interpolated value is `get_current_user`'s server-validated
Supabase Auth UUID (for the BG-task splice, the `user_id` passed to `ingest_document` is the
authenticated uploader's id) — NOT attacker-shaped — so this is NOT a confirmed-exploitable
injection. It is a defense-in-depth inconsistency: the leak-safety of these sites rests on an
external invariant (user_id is always a well-formed UUID) rather than being safe by construction.
**Residual accepted.** **Recommendation (backlog, non-blocking):** hoist `_uid()` to a shared
util and route all three sites through it so they are safe-by-construction like the service layer.

### AR-118-02 — Ingest rule read lacks the Python-side fail-closed re-filter (WR-04)
**Maps to:** T-118-03-01
**Site:** `documents.py:1885-1894`.
**Assessment:** Every other service-role own+global read in the codebase pairs the DB `.or_()`
with a Python-side re-filter (`embedding_service.read_enabled_field_defs:291-296`,
`classification_rule_service.list_rules` dedupe loop). The ingest rule read trusts the
`.or_(...).eq("enabled",True)` result verbatim. `(A OR B) AND enabled` compiles correctly today,
so this is CURRENTLY SAFE — but it is the single highest-stakes leak site in the phase (it
evaluates rules against another user's metadata if scoping ever drifts) and is the ONE site
without defense-in-depth. **Residual accepted.** **Recommendation (backlog, non-blocking):** add
`rules = [r for r in rules if r.get("is_global") or str(r.get("user_id")) == str(user_id)]`
after the read, mirroring the siblings.

### AR-118-03 — Ingest-splice leak/no-move proofs are VACUOUS for the splice (WR-05)
**Maps to:** T-118-03-01, T-118-03-02 (VERIFICATION VACUOUSNESS)
**Sites:** `test_118_ingest_suggest.py:149-167` (hand-rolled read + match loop, asserts on the
duplicate), `test_118_rule_leak.py:193-245` (`_read_rules_for_uploader` re-implements the splice
read, asserts on the duplicate). Confirmed: NO test in the suite calls `ingest_document(...)`
(grep across `tests/` returns zero call sites).
**Assessment:** The plan for T-118-03-01 explicitly claimed "Verified by the live two-user
`test_118_rule_leak.py` (secure-phase re-runs non-vacuous)" and the 118-03 SUMMARY claims
"`test_118_rule_leak` non-vacuous 2/2". **This claim is INACCURATE for the production splice.**
Both tests pass live against :54322 (verified: 4/4 PASSED, not skipped) but assert on a
hand-copied reimplementation of the read+match loop, NOT on `documents.metadata._classification`
after a real ingest nor on `documents.folder_id` being unchanged. A regression in the real splice
(e.g. accidentally adding a `folder_id` write, or dropping the `.or_()` scope) would NOT be caught.
**Threats T-118-03-01/02 are nonetheless rated CLOSED-IN-CODE** because the auditor independently
read the production splice (`documents.py:1882-1919`) and confirmed (a) the leak-safe `.or_()`
scoping at :1887 and (b) that the block writes ONLY `metadata_dict["_classification"]` with no
`folder_id` anywhere in the pass or the persist UPDATE. The TEST GAP is the accepted residual.
**Recommendation (backlog, non-blocking but recommended before the next edit to ingest_document):**
add one integration test that invokes the real `ingest_document(...)` against a seeded doc and
asserts `metadata._classification.status == "suggested"` AND `folder_id` UNCHANGED — so the
no-silent-move invariant is regression-protected end-to-end, not by harness agreement with a copy.
NOTE: the accept/dismiss/CRUD tests are NOT affected — they call the REAL endpoint functions
(`accept_classification`/`dismiss_classification`/the CRUD service) and are non-vacuous.

### AR-118-04 — "Global" scope control in RuleBuilderPanel is decorative (WR-01)
**Maps to:** T-118-06-01 (informational — strengthens, does not weaken, the threat)
**Site:** `RuleBuilderPanel.tsx:114, 194-203, 324-364`.
**Assessment:** The builder renders a "👤 Only me / 🌐 Global" segmented control and tracks
`scope` in state, but `handleSave` never reads it and never sends `is_global`. A user selecting
"Global" silently gets a private rule. This is a CORRECTNESS/HONESTY defect in a "never silent"
feature — but it is NOT a security elevation; it makes is_global self-elevation impossible (the
threat T-118-06-01 is CLOSED precisely because the control does nothing). **Residual accepted (a
UX/honesty backlog item, not a security gap).** **Recommendation (backlog):** disable the control
with an explanatory tooltip ("Global rules are seeded by an administrator"), or remove it until a
real admin global-create path exists.

### AR-118-05 — Global-rule toggle/edit 404s with no user feedback (WR-02)
**Maps to:** T-118-06-02 (informational — list contract is correct; affordance gating is the gap)
**Site:** `AutomationGroup.tsx:98-108`, `RuleBuilderPanel.tsx:194-198`.
**Assessment:** `listRules()` correctly returns own AND global rules (leak-safe, T-118-02-02), and
`AutomationGroup` renders the toggle/edit/delete affordances for every row including global rules
the caller does not own. The server correctly rejects the mutation with a 404 (own-scoped
update/delete), so there is NO unauthorized state change — the access-control boundary holds. The
defect is purely UX: `handleToggle`'s only failure handling is `console.error`, so the user sees a
toggle that silently does nothing. **Residual accepted (a UX backlog item; the security boundary
is intact).** **Recommendation (backlog):** gate the mutate affordances on ownership (render
disabled with a "global rule — read only" tooltip) and surface a visible error on a caught 404.

---

## Unregistered Flags

**None.** SUMMARY `## Threat Flags` sections (118-03/05/06 declare "None"; 118-01/02/04 declare no
new surface, 118-02 explicitly "no new endpoint"). The only new network surfaces are the DECLARED
`/classification-rules` CRUD router (T-118-02-*) and the `/documents/{id}/classification/{accept,
dismiss}` endpoints (T-118-03-*). No new package, no new migration, no new auth path beyond the
declared register. `threads.py` byte-untouched (G-5). CLASS-01 reachability gap-closure
(commit 6394d16e — `ChatLayout.tsx:294` render branch + `nav-items.ts:31` nav entry) confirmed in
shipped source; it is a reachability fix, not a new attack surface.

---

## Audit Trail

- **Test run (live :54322):** `pytest -k 118` → **41 passed, 0 failed** (15.13s). All integration
  tests ran live (not skipped) — confirmed against the local Supabase REST gate.
- **Highest-stakes controls hand-verified in source (not via test/doc):** ingest splice leak-safe
  `.or_()` scoping (documents.py:1887); no-`folder_id`-write invariant (documents.py:1882-1919);
  accept target-folder re-validation + owner scoping (documents.py:1500-1527); rule-service
  is_global hard-set (classification_rule_service.py:89-90); router uniform-404 / `grep -c 403`==0.
- **Vacuousness finding:** the two ingest-splice "non-vacuous" tests re-implement the pass rather
  than driving `ingest_document` (AR-118-03); the SUMMARY's "non-vacuous 2/2" self-claim is
  inaccurate for the splice. Threats remain CLOSED via independent source read; test gap logged.
- **WR-03/04/05/01/02 (code-review WARNINGs routed to secure-phase):** all five assessed, all map
  onto declared threats, all confirmed currently-safe → logged as AR-118-01..05. None reopens a
  threat.

_Audited: 2026-06-21 by gsd-security-auditor (State B). ASVS L1. block_on: none._
