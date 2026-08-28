# 214-06 — deferred items

Out-of-scope discoveries made while executing plan `214-06`. Logged, not fixed
(scope boundary: only issues DIRECTLY caused by this plan's own changes are auto-fixed).

---

## D1 · ⚠ On a NATIVE capability row, an `upstream` argument source is INERT — and one arm sends the WRONG step's text

**Where:** `backend/app/services/harness/phase_types.py` — GATE 7 calls `_adapter_args`,
which calls `args.resolve_arguments` with `upstream_outputs={}`. GATE 6 (MCP) passes the
real `accumulated_outputs`. The two shapes therefore disagree about a feature both advertise.

**Measured** (`send_email`; sources `to`=fixed, `subject`=upstream(`draft`),
`body`=upstream(`draft`); accumulated `draft` then `later`):

```
executor (upstream_outputs={})  -> {'to': 'ops@…', 'body': "A LATER PHASE'S TEXT"}
with the real bag               -> {'to': 'ops@…', 'subject': {…draft…}, 'body': {…draft…}}
```

Two distinct failures, and the second is the dangerous one:

1. a NON-body property (`subject`) sourced `upstream` resolves to **nothing** and is
   dropped — the mail leaves with no subject and no error;
2. the BODY property is filled by the `body_arg` fallback from `content`, which
   `_external_action_inputs` sets from the **LATEST** phase's text. A step that declares
   *body: from the `draft` step* sends a **different step's words**. That is a silent
   wrong-value send, not an omission.

**Why it is not fixed here:** the fix is in `phase_types.py`, which plan `214-06`'s
`files_modified` deliberately excludes and whose G-5 disposition rests on this plan's diff
staying out of it. It originates in plan `214-01` Task 3's re-point, not in this plan.

**What this plan did instead:** the pause MIRRORS the executor's arm exactly rather than
"improving on" it, and the asymmetry is pinned in the affirmative by
`test_the_pause_mirrors_the_NATIVE_arms_empty_upstream_bag_rather_than_improving_on_it`.
A pause that showed the *declared* source while the send used a different one would be the
worse defect — a person would authorise a subject line that never leaves.

**Suggested owner:** plan `214-14` (the seam audit) or a `/gsd:fast` on the GATE 7 call.

---

## D2 · ⚠ The approval prompt — arguments included — is ALREADY written to `harness_audit`

**Where:** `backend/app/services/harness_engine.py` — `_resolve_failure_with_ask_user`'s
governance receipt (`validator_ask_user_approved`, D-187-18) sets
`metadata["finding"] = error_message`, and for an armed checkpoint that IS
`_ACTION_RISK_FINDING_PREFIX + sentence`.

**So D-213-14's "shown once, recorded never" is true of `_write_send_receipt` and FALSE of
the approval receipt.** It has been so since Phase 187 — this plan did not create it.

**What this plan changes is the CONTENT, not the channel.** Pre-214 the sentence carried
`config.tool_args`, i.e. the author's own stored constants. Under D-214-15 it carries the
RESOLVED object, which can include launcher-supplied text (`ask`) and LLM-produced text
(`upstream`). That is a widening of an existing information-disclosure surface —
threat `T-214-06-03`'s `mitigate` disposition is therefore **not fully met** by this plan.

**Why it is not fixed here:** removing or redacting the finding changes what a GOVERNANCE
receipt records — the row is what proves *what a person approved* — and the receipt is
shared with every non-armed `ask_user` gate. That is deviation **Rule 4** (architectural),
and this plan's own action explicitly forbids altering the audit surface.

**What this plan did instead:** pinned the leak in the affirmative
(`test_MEASURED_the_approval_receipt_ALREADY_copies_the_whole_sentence_into_the_ledger`)
and BOUNDED it (`test_the_leak_is_confined_to_that_one_receipt_and_no_other_row`), so it
can never again be invisible and cannot spread to a second event type unnoticed.

**Suggested owner:** an operator decision — redact the resolved values out of `finding` for
the armed arm, or record that a governance receipt is *meant* to carry what was approved
and close `T-214-06-03` as `accept` with that reasoning written down.
