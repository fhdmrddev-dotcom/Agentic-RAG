---

---

> ⛔ **DRIVEN 2026-09-12 by `/gsd:verify-work 244` — VERDICT: PARTIAL.**
> R2-2: Arms 1-3 PASS (defect 6b CLOSED, confound resolved). Arm 4 steps 3-4 FAIL -> gap G-7.
> Full readings: `244-UAT.md` § "Round 2 — DRIVEN 2026-09-12". ⚠ Solo run (D-244-21 /
> OV-SOLO-01): this is a SELF-VERIFICATION, never a review.
> The `pending` fields below are left as WRITTEN so the row's own asks stay legible.

phase: 244-the-chat-shell-and-the-composer
plan: 10
row: L-5b
closes: SHELL-04 (the "and the agent can use it" clause, for attachments after the first)
re_opens: .planning/phases/244-the-chat-shell-and-the-composer/244-UAT.md § defect_6b
status: pending
driven_by: pending
driven_on: pending
verdict: pending
---

# 244-10 — L-5b: the SECOND attachment reaches the sandbox

⛔ **WHY THIS ROW EXISTS AND THE UNIT SUITE IS NOT ENOUGH.** `244-10` closes defect 6b behind
five backend cases driven RED-then-GREEN, and **every one of them runs against a `MagicMock`
session**. A fake session proves the dispatcher *asks* for the copy; it cannot prove a byte lands
in a real container. This phase's own recorded lesson is that G-6 shipped behind a GREEN fence
because the test constructed the shape it then asserted — so the plan reports **built, drive
owed**, and `/gsd:verify-work` scores this row.

⛔ **SCORE ON THE AGENT'S OWN PRINTED DIRECTORY LISTING, never on whether it eventually answered.**
Recovery via `workspace_read` is exactly what masked this defect for ten rounds in the original
run. An answer that is correct because the fallback worked is a FAIL for this row.

---

## Setup

Local dev stack (Supabase on 54322, backend on 8000, vite). No cloud surface is touched.
Any provider from the native roster; prefer one whose tool-call emission is not `coerce`.

---

## Arm 1 — the first attachment still works (the control)

| | |
|---|---|
| **Given** | a FRESH thread (no prior `execute_code` in it, so no cached sandbox session) |
| **Do** | attach `Meridian-Q4-pricing.xlsx` via the composer's `+` → "Attach a file". Send: *"What is in the attached file? List every row."* |
| **Wait for** | the run to reach `completed` — ⛔ not mid-stream. A transcript read mid-stream is not the transcript (defect 6a's retraction). |
| **Pass when** | the agent's own printed listing of `/sandbox/attachments` contains the `.xlsx` filename, AND the answer reproduces real cell content from the sheet |
| **Verdict** | `pending` |
| **Evidence** | `pending` — paste the agent's verbatim listing line |

## Arm 2 — THE DEFECT: a second attachment, in the SAME thread

| | |
|---|---|
| **Given** | the SAME thread as Arm 1, with its sandbox session now cached (`SandboxSessionManager` holds it per `thread_id` for 30 min) |
| **Do** | attach `uat-note.pdf`. Send: *"Read the attached PDF and quote its first line."* |
| **Wait for** | the run to reach `completed` |
| **Pass when** | the agent's printed `/sandbox/attachments` listing in **that second run** contains **BOTH** filenames, AND the answer carries real content from the PDF |
| **Fail when** | the listing shows only the `.xlsx` — this is the shipped defect verbatim: `/sandbox/attachments [] ['c679b991-Meridian-Q4-pricing.xlsx']` |
| **Verdict** | `pending` |
| **Evidence** | `pending` — the verbatim listing line, and the quoted first line of the PDF |

### Round-count observation (⛔ NOT a pass condition)

Record the number of agent rounds in Arm 2. The defect run took **12**, reaching the file at round
10 via the fallback; a fixed run should reach it in its first or second tool call. ⛔ **A round
count is not a contract** — it is recorded so a silent regression to the fallback path is visible,
never to fail the row on its own.

Rounds observed: `pending`

## Arm 3 — the ordering/type confound, RESOLVED

| | |
|---|---|
| **Why** | the original UAT's single run attached `.xlsx` first and `.pdf` second, so **ORDERING IS CONFOUNDED WITH FILE TYPE**. Whether a fresh thread's FIRST `.pdf` hydrates was explicitly NOT ESTABLISHED. |
| **Given** | a SECOND fresh thread |
| **Do** | attach `uat-note.pdf` as its **FIRST** attachment. Send: *"Read the attached PDF and quote its first line."* |
| **Pass when** | the `.pdf` appears in the agent's printed `/sandbox/attachments` listing and its content is quoted |
| **Meaning** | ⭐ This arm is what licenses the sentence *"the second attachment did not hydrate"* instead of *".pdf does not hydrate"*. If Arm 3 FAILS, the finding is a different one and the fix in `244-10` is not the whole story — say so rather than reconciling it. |
| **Verdict** | `pending` |
| **Evidence** | `pending` |

---

## Environment note — rows created, named for deletion

⛔ The drive creates rows in the operator's **LOCAL** database only. Nothing cloud is touched, no
`documents` row is minted (SHELL-04's negative guarantee — L-5 step 5 proved it returns 0 rows).
Name them here as L-5 and L-6 did:

| Table | What | Delete after |
|---|---|---|
| `threads` | the two fresh threads created above | yes |
| `messages` | their transcripts | cascade |
| `workspace_files` | `/{uuid8}-Meridian-Q4-pricing.xlsx`, `/{uuid8}-uat-note.pdf` (×2 threads) | yes — or leave: TTL is 24 h |
| `documents` | ⛔ **none expected.** If a row appears, that is a SEPARATE blocker on SHELL-04's negative clause. | n/a |

## ⛔ Arm 4 — ADDED BY `244-14` (review WR-03): a failed copy must not go quiet

`244-10` recorded a path as copied BEFORE attempting it, so ONE Supabase Storage blip marked the
file copied for the rest of the ~30-minute session and named it on exactly one tool result. Every
later `execute_code` filtered the path out, so the model heard nothing — the same silence defect
6b cost ten wasted agent rounds to discover. `244-14` records on SUCCESS and retries up to
`_ATTACHMENT_HYDRATION_MAX_ATTEMPTS = 2`, naming the failure on every attempt.

⚠ **This arm is BLOCKED unless a failure can be induced honestly.** ⛔ Do not fake one by editing
the code — that measures the edit. The cheap honest lever is to delete the Storage object (or
revoke access to it) between two `execute_code` calls in one thread, so the row still lists and
the content read fails. If that is not reachable, record **BLOCKED with the reason** and lean on
cases F1/F2/F3 in `backend/tests/unit/test_244_attachment_hydration.py` — never silently omit it.

| # | Step | Expected | Verdict |
|---|---|---|---|
| 1 | Attach two files; break the SECOND one's Storage object; run `execute_code` | the tool result names the second file (`Could not load the attached file …`) and the first still arrives | `pending` |
| 2 | Run `execute_code` a SECOND time, still broken | ⛔ the note is **present again** — this is the half that was silent | `pending` |
| 3 | Run `execute_code` a THIRD time | the note is **gone** and no further container I/O is attempted for it — given up on, deliberately and once | `pending` |
| 4 | Repair the Storage object after ONE failure instead, then run `execute_code` again | the file **arrives** in `/sandbox/attachments/` — a blip does not cost the file for the session | `pending` |

## Out of scope for this row — do NOT re-litigate

- **defect 6a** — RETRACTED the same session. The chip is **LATE, not absent**; severity MINOR.
- **the `uuid8-` filename prefix** and the **"Template"** label in the panel — both are DELIBERATE
  storage decisions (`workspace.py:336`, `:350` / D-12), verified in source. ⛔ A presentation
  finding, not a storage change, and not this plan's job.
- **L-5 steps 1-5 and 7**, and all six L-6 steps — passed, untouched by `244-10`.
