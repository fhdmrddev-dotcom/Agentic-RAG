# Phase 281: A Refusal Names Its Cause - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-14
**Phase:** 281-a-refusal-names-its-cause
**Areas discussed:** Mixed-cause emit message, Golden-run link, Describe-door sentences, G-4 failure scenarios

---

## Adjacent bug routing

| Option | Description | Selected |
|--------|-------------|----------|
| Leave open | Receipt naming the wrong target ≠ refusal naming its cause; keeps 281 at 3-4 plans | ✓ |
| Fold into 281 | Same file (`phase_types.py`), adds a task + UAT row | |

**User's choice:** BUG-260828-05 left open.

---

## Mixed-cause emit message

| Question | Options | Selected |
|---|---|---|
| Attempts fail differently | Every cause with counts · Last attempt only · Most specific only | Every cause with counts |
| Missing fields named | First 5 + "and N more" · All, uncapped · Count only | First 5 + "and N more" |
| "What to check" line | Yes, server-written · No, cause only | Yes, server-written |
| Where shown | One string everywhere · Gauntlet only | One string everywhere |

---

## Golden-run link

| Question | Options | Selected |
|---|---|---|
| Replace "(view coming soon)" | Working link to run page · Drop the button | Working link |
| Label | No id, plain verb · Keep id fragment | `▦ Open the golden run that was judged ›` |
| Landing | Failed step if already supported · Top of page | Failed step if already supported |

---

## Describe-door sentences

| Question | Options | Selected |
|---|---|---|
| Shape | Sentence + next step · Sentence only | Sentence + next step |
| Raw code | Only under Show technical names · Never | Only under Show technical names |
| `connection_not_allowed` sub-cases | 3 sentences (additive server sub-reason) · One sentence | 3 sentences |
| Wording | Approve drafts, polish in planning · Give own wording | Approve drafts |

---

## G-4 failure scenarios

| Scenario | Selected |
|---|---|
| A · Emit miss at publish | ✓ |
| B · Golden-run link | ✓ |
| C · Describe-door refusal | ✓ |
| D · Freshness with an archived doc | ✓ |

---

## Claude's Discretion

- Merge key for "same cause"; which attempt counter is user-facing
- Wire shape of the per-cause list on `blocked_step` (additive)
- Name of the describe-door sub-reason field

## Deferred Ideas

- Run page step focus, if not already supported
- Emit cause (b) root cause (model weakness vs placeholder spotlight)
